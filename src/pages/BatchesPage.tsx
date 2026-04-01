import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Plus, MoreHorizontal, Edit, Trash2, Users, Loader2, Eye, BookOpen, CalendarDays } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useBranch } from '@/contexts/BranchContext';
import { batchService } from '@/services/batchService';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Tables } from '@/types/database';

type Batch = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  branch_id: string | null;
  module_subject_id: string | null;
  validity_start: string | null;
  validity_end: string | null;
  created_at: string;
};
type StudentProfile = Pick<Tables<'profiles'>, 'id' | 'full_name' | 'email' | 'metadata' | 'is_active' | 'branch_id'>;
type ModuleSubject = { id: string; name: string };

export default function BatchesPage() {
  const { user, profile } = useAuth();
  const { currentBranchId, branches: contextBranches, branchVersion } = useBranch();
  const { toast } = useToast();
  const isAdminUser = user?.role === 'admin' || user?.role === 'super_admin';
  const effectiveBranchId = isAdminUser
    ? (currentBranchId || null)
    : (currentBranchId || profile?.branch_id || user?.branchId || null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [moduleSubjects, setModuleSubjects] = useState<ModuleSubject[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isStudentsDialogOpen, setIsStudentsDialogOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '', moduleSubjectId: '', validityStart: '', validityEnd: '' });

  useEffect(() => {
    if (user?.organizationId) {
      fetchData();
      syncAllBatchEnrollments();
    }
  }, [user?.organizationId, branchVersion, effectiveBranchId]);

  // Global retroactive sync to fix missing class_enrollments for students added to batches
  const syncAllBatchEnrollments = async () => {
    if (!user?.organizationId) return;
    try {
      const { data: allClassBatches } = await supabase.from('class_batches').select('class_id, batch_id');
      if (!allClassBatches?.length) return;

      const { data: allStudents } = await supabase
        .from('profiles')
        .select('id, metadata, branch_id')
        .eq('role', 'student')
        .eq('organization_id', user.organizationId);

      if (!allStudents?.length) return;

      // Fix missing branch_ids (which breaks RLS)
      const missingBranchStudents = allStudents.filter(s => !s.branch_id);
      if (missingBranchStudents.length > 0) {
        const mainBranchId = contextBranches?.find(b => b.is_main_branch)?.id || contextBranches?.[0]?.id;
        if (mainBranchId) {
          const updates = missingBranchStudents.map(s =>
            supabase.from('profiles').update({ branch_id: mainBranchId }).eq('id', s.id)
          );
          await Promise.all(updates);
          console.log(`Healed ${updates.length} students with missing branch_ids`);
        }
      }

      const enrollmentsToInsert: any[] = [];
      allStudents.forEach(student => {
        let batchIds: string[] = [];
        if (typeof student.metadata === 'string') {
          try {
            const m = JSON.parse(student.metadata);
            const rawBatchIds = Array.isArray(m.batch_ids) ? m.batch_ids : [m.batch_id || m.batch || m.batchId].filter(Boolean);
            batchIds = rawBatchIds.map((value: any) => String(value));
          } catch { }
        } else if (student.metadata && typeof student.metadata === 'object') {
          const m = student.metadata as any;
          const rawBatchIds = Array.isArray(m.batch_ids) ? m.batch_ids : [m.batch_id || m.batch || m.batchId].filter(Boolean);
          batchIds = rawBatchIds.map((value: any) => String(value));
        }

        batchIds.forEach((batchId) => {
          const classesForBatch = allClassBatches.filter(cb => cb.batch_id === batchId);
          classesForBatch.forEach(cb => {
            enrollmentsToInsert.push({ class_id: cb.class_id, student_id: student.id });
          });
        });
      });

      if (enrollmentsToInsert.length > 0) {
        await supabase.from('class_enrollments').upsert(enrollmentsToInsert, { onConflict: 'class_id,student_id' });
        console.log(`Synced ${enrollmentsToInsert.length} batch student enrollments retroactively.`);
      }
    } catch (err) {
      console.error('Failed to sync batch enrollments:', err);
    }
  };

  const fetchModuleSubjects = async () => {
    if (!user?.organizationId) return;
    try {
      let query = supabase
        .from('module_subjects')
        .select('id, name')
        .eq('organization_id', user.organizationId);

      if (effectiveBranchId) {
        query = query.eq('branch_id', effectiveBranchId);
      }

      const { data, error } = await query.order('name', { ascending: true });
      if (error) throw error;
      setModuleSubjects(data || []);
    } catch (error) {
      console.error('Error fetching module subjects:', error);
    }
  };

  const fetchData = async () => {
    try {
      setIsLoading(true);
      await Promise.all([fetchBatches(), fetchStudents(), fetchModuleSubjects()]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBatches = async () => {
    if (!user?.organizationId) return;

    try {
      const data = await batchService.getBatches(user.organizationId, effectiveBranchId);
      setBatches(data || []);
    } catch (error) {
      console.error('Error fetching batches:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to fetch batches',
        variant: 'destructive',
      });
      setBatches([]);
    }
  };

  const fetchStudents = async () => {
    if (!user?.organizationId) return;

    try {
      let query = supabase
        .from('profiles')
        .select('id, full_name, email, metadata, is_active, branch_id')
        .eq('organization_id', user.organizationId)
        .eq('role', 'student');

      if (effectiveBranchId) {
        query = query.eq('branch_id', effectiveBranchId);
      }

      const { data, error } = await query.order('full_name', { ascending: true });

      if (error) throw error;
      setStudents((data || []) as StudentProfile[]);
    } catch (error) {
      console.error('Error fetching students:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to fetch students',
        variant: 'destructive',
      });
      setStudents([]);
    }
  };

  const normalizeBatchValue = (rawValue: unknown) => {
    if (rawValue === null || rawValue === undefined) return undefined;

    if (typeof rawValue === 'string' || typeof rawValue === 'number') {
      const value = String(rawValue).trim();
      return value.length > 0 ? value : undefined;
    }

    if (typeof rawValue === 'object') {
      const candidate = rawValue as any;
      const nestedValue = candidate.id ?? candidate.batch_id ?? candidate.name ?? candidate.batch;
      if (nestedValue === null || nestedValue === undefined) return undefined;
      const value = String(nestedValue).trim();
      return value.length > 0 ? value : undefined;
    }

    return undefined;
  };

  const parseMetadataObject = (metadata: StudentProfile['metadata']) => {
    if (metadata === null || metadata === undefined) return undefined;

    if (typeof metadata === 'string') {
      const trimmed = metadata.trim();
      if (!trimmed) return undefined;
      if (!trimmed.startsWith('{')) return undefined;
      try {
        const parsed = JSON.parse(trimmed);
        return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
          ? parsed
          : undefined;
      } catch (error) {
        console.warn('Failed to parse metadata JSON string:', error);
        return undefined;
      }
    }

    if (typeof metadata === 'object' && !Array.isArray(metadata)) {
      return metadata as Record<string, unknown>;
    }

    return undefined;
  };

  const getBatchValuesFromMetadata = (metadata: StudentProfile['metadata']) => {
    if (metadata === null || metadata === undefined) {
      return [] as string[];
    }

    if (typeof metadata === 'string' || typeof metadata === 'number') {
      const parsedObject = parseMetadataObject(metadata);
      if (parsedObject) {
        const arrayValues = Array.isArray((parsedObject as any).batch_ids)
          ? (parsedObject as any).batch_ids
          : [(parsedObject as any).batch_id ?? (parsedObject as any).batch ?? (parsedObject as any).batchId];
        return arrayValues
          .map((value: unknown) => normalizeBatchValue(value))
          .filter((value: string | undefined): value is string => Boolean(value));
      }

      const single = normalizeBatchValue(metadata);
      return single ? [single] : [];
    }

    if (typeof metadata !== 'object' || Array.isArray(metadata)) {
      return [] as string[];
    }

    const rawValues = Array.isArray((metadata as any).batch_ids)
      ? (metadata as any).batch_ids
      : [(metadata as any).batch_id ?? (metadata as any).batch ?? (metadata as any).batchId];

    return rawValues
      .map((value: unknown) => normalizeBatchValue(value))
      .filter((value: string | undefined): value is string => Boolean(value));
  };

  const isStudentInBatch = (student: StudentProfile, batch: Batch) => {
    const batchValues = getBatchValuesFromMetadata(student.metadata);
    if (batchValues.length === 0) return false;

    const normalizedBatchName = batch.name.trim().toLowerCase();
    return batchValues.some((value) => value === batch.id || value.toLowerCase() === normalizedBatchName);
  };

  const studentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    students.forEach((student) => {
      const batchValues = getBatchValuesFromMetadata(student.metadata);
      batchValues.forEach((batchValue) => {
        const normalizedValue = batchValue.toLowerCase();
        const batchId = batches.find(
          (batch) => batch.id === batchValue || batch.name.trim().toLowerCase() === normalizedValue
        )?.id;
        if (!batchId) return;
        counts[batchId] = (counts[batchId] || 0) + 1;
      });
    });
    return counts;
  }, [students, batches]);

  const filteredBatches = batches.filter((batch) => {
    const query = searchQuery.toLowerCase();
    return (
      batch.name.toLowerCase().includes(query) ||
      (batch.description || '').toLowerCase().includes(query)
    );
  });

  const openStudentsDialog = (batch: Batch) => {
    setSelectedBatch(batch);
    setIsStudentsDialogOpen(true);
  };

  const openEditDialog = (batch: Batch) => {
    setSelectedBatch(batch);
    setFormData({
      name: batch.name,
      description: batch.description || '',
      moduleSubjectId: (batch as any).module_subject_id || '',
      validityStart: batch.validity_start || '',
      validityEnd: batch.validity_end || '',
    });
    setIsEditDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({ name: '', description: '', moduleSubjectId: '', validityStart: '', validityEnd: '' });
  };

  const handleCreateBatch = async () => {
    if (!user?.organizationId) return;

    if (!formData.name.trim()) {
      toast({
        title: 'Error',
        description: 'Please provide a batch name',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSaving(true);
      const created: Batch = await batchService.createBatch(
        user.organizationId,
        formData.name.trim(),
        formData.description.trim() || undefined,
        currentBranchId || contextBranches[0]?.id || null,
        formData.moduleSubjectId || null,
        formData.validityStart || null,
        formData.validityEnd || null
      ) as any;
      setBatches((current) => [created, ...current]);
      toast({ title: 'Success', description: 'Batch created successfully' });
      setIsAddDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error creating batch:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create batch',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateBatch = async () => {
    if (!selectedBatch) return;

    if (!formData.name.trim()) {
      toast({
        title: 'Error',
        description: 'Please provide a batch name',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSaving(true);
      const updated: Batch = await batchService.updateBatch(selectedBatch.id, {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        module_subject_id: formData.moduleSubjectId || null,
        validity_start: formData.validityStart || null,
        validity_end: formData.validityEnd || null,
      }) as any;

      if (updated.module_subject_id) {
        try {
          const { data: comboItems } = await supabase
            .from('course_combo_items')
            .select('combo_id')
            .eq('course_id', updated.module_subject_id);

          const comboIds = Array.from(new Set((comboItems || []).map((item: any) => item.combo_id).filter(Boolean)));
          if (comboIds.length > 0) {
            const { data: assignments } = await supabase
              .from('student_combo_assignments')
              .select('student_id, combo_id')
              .in('combo_id', comboIds)
              .eq('organization_id', user!.organizationId!);

            if ((assignments || []).length > 0) {
              const allComboIds = Array.from(new Set((assignments || []).map((row: any) => row.combo_id)));
              const { data: allItems } = await supabase
                .from('course_combo_items')
                .select('combo_id, course_id')
                .in('combo_id', allComboIds);

              const courseIds = Array.from(new Set((allItems || []).map((row: any) => row.course_id)));
              const { data: batchRows } = await supabase
                .from('batches')
                .select('id, module_subject_id')
                .eq('organization_id', user!.organizationId!)
                .in('module_subject_id', courseIds);

              const batchIdsByCourse: Record<string, string[]> = {};
              (batchRows || []).forEach((row: any) => {
                if (!row.module_subject_id) return;
                if (!batchIdsByCourse[row.module_subject_id]) batchIdsByCourse[row.module_subject_id] = [];
                batchIdsByCourse[row.module_subject_id].push(row.id);
              });

              const courseIdsByCombo: Record<string, string[]> = {};
              (allItems || []).forEach((row: any) => {
                if (!courseIdsByCombo[row.combo_id]) courseIdsByCombo[row.combo_id] = [];
                courseIdsByCombo[row.combo_id].push(row.course_id);
              });

              const studentIds = Array.from(new Set((assignments || []).map((row: any) => row.student_id)));
              const { data: studentProfiles } = await supabase
                .from('profiles')
                .select('id, metadata')
                .in('id', studentIds)
                .eq('organization_id', user!.organizationId!);

              const profileById: Record<string, any> = {};
              (studentProfiles || []).forEach((profile: any) => {
                profileById[profile.id] = profile;
              });

              for (const assignment of assignments || []) {
                const comboCourseIds = courseIdsByCombo[assignment.combo_id] || [];
                const comboBatchIds = comboCourseIds.flatMap((courseId) => batchIdsByCourse[courseId] || []);
                const uniqueBatchIds = Array.from(new Set(comboBatchIds));
                if (uniqueBatchIds.length === 0) continue;

                const studentProfile = profileById[assignment.student_id];
                const currentMeta = parseMetadataObject(studentProfile?.metadata) || {};
                const existingBatchIds = Array.isArray((currentMeta as any).batch_ids)
                  ? ((currentMeta as any).batch_ids as any[]).map((value) => String(value))
                  : [];
                const mergedBatchIds = Array.from(new Set([...existingBatchIds, ...uniqueBatchIds]));

                await supabase
                  .from('profiles')
                  .update({ metadata: { ...currentMeta, batch_id: mergedBatchIds[0], batch_ids: mergedBatchIds } } as any)
                  .eq('id', assignment.student_id);
              }

              await syncAllBatchEnrollments();
            }
          }
        } catch (comboSyncError) {
          console.error('Failed syncing combo students after batch update:', comboSyncError);
        }
      }

      setBatches((current) =>
        current.map((batch) => (batch.id === selectedBatch.id ? updated : batch))
      );
      toast({ title: 'Success', description: 'Batch updated successfully' });
      setIsEditDialogOpen(false);
      setSelectedBatch(null);
      resetForm();
    } catch (error) {
      console.error('Error updating batch:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update batch',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteBatch = async (batch: Batch) => {
    if (!confirm(`Delete ${batch.name}? This cannot be undone.`)) return;

    try {
      setIsDeleting(batch.id);
      await batchService.deleteBatch(batch.id);
      setBatches((current) => current.filter((item) => item.id !== batch.id));
      toast({ title: 'Success', description: 'Batch deleted successfully' });
    } catch (error) {
      console.error('Error deleting batch:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete batch',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(null);
    }
  };

  const handleToggleActive = async (batch: Batch) => {
    try {
      const updated: Batch = await batchService.updateBatch(batch.id, { is_active: !batch.is_active }) as any;
      setBatches((current) => current.map((b) => (b.id === batch.id ? updated : b)));
      toast({ title: 'Success', description: `Batch ${updated.is_active ? 'activated' : 'deactivated'}` });
    } catch (error) {
      console.error('Error toggling batch status:', error);
      toast({ title: 'Error', description: 'Failed to update batch status', variant: 'destructive' });
    }
  };

  const selectedBatchStudents = useMemo(() => {
    if (!selectedBatch) return [];
    return students.filter((student) => isStudentInBatch(student, selectedBatch));
  }, [students, selectedBatch]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
            Batches
          </h1>
          <p className="text-muted-foreground mt-1">
            Create and manage student batches across your organization
          </p>
        </div>
        <Dialog
          open={isAddDialogOpen}
          onOpenChange={(open) => {
            setIsAddDialogOpen(open);
            if (open) {
              resetForm();
            }
          }}
        >
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground">
              <Plus className="w-4 h-4 mr-2" />
              Add Batch
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create Batch</DialogTitle>
              <DialogDescription>
                Add a new batch for grouping students.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Batch Name</Label>
                <Input
                  placeholder="Enter batch name"
                  value={formData.name}
                  onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  placeholder="Optional description"
                  value={formData.description}
                  onChange={(event) => setFormData({ ...formData, description: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Module / Subject</Label>
                <Select value={formData.moduleSubjectId} onValueChange={(v) => setFormData({ ...formData, moduleSubjectId: v === '_none_' ? '' : v })}>
                  <SelectTrigger>
                    <BookOpen className="w-4 h-4 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="Select Course (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none_">None</SelectItem>
                    {moduleSubjects.map(ms => (
                      <SelectItem key={ms.id} value={ms.id}>{ms.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Validity Start</Label>
                  <Input
                    type="date"
                    value={formData.validityStart}
                    onChange={(e) => setFormData({ ...formData, validityStart: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Validity End</Label>
                  <Input
                    type="date"
                    value={formData.validityEnd}
                    onChange={(e) => setFormData({ ...formData, validityEnd: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setIsAddDialogOpen(false)}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-primary text-primary-foreground"
                  onClick={handleCreateBatch}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Create Batch'
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border shadow-card">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Input
                placeholder="Search batches..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="pl-3"
              />
            </div>
            <Badge variant="outline" className="self-start sm:self-center">
              {batches.length} batches
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Batch</TableHead>
                  <TableHead className="hidden md:table-cell">Module</TableHead>
                  <TableHead className="hidden md:table-cell">Validity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Students</TableHead>
                  <TableHead className="hidden lg:table-cell">Created</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                      Loading batches...
                    </TableCell>
                  </TableRow>
                ) : filteredBatches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No batches found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredBatches.map((batch) => (
                    <TableRow key={batch.id} className={`animate-fade-in ${!batch.is_active ? 'opacity-60' : ''}`}>
                      <TableCell>
                        <p className="font-medium text-foreground">{batch.name}</p>
                        {batch.description && <p className="text-xs text-muted-foreground">{batch.description}</p>}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {(batch as any).module_subject_id
                          ? <Badge variant="outline" className="text-xs"><BookOpen className="w-3 h-3 mr-1" />{moduleSubjects.find(ms => ms.id === (batch as any).module_subject_id)?.name || '-'}</Badge>
                          : <span className="text-muted-foreground">-</span>
                        }
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-xs">
                        {batch.validity_start || batch.validity_end ? (
                          <span className="flex items-center gap-1">
                            <CalendarDays className="w-3 h-3" />
                            {batch.validity_start ? new Date(batch.validity_start).toLocaleDateString() : '—'}
                            {' → '}
                            {batch.validity_end ? new Date(batch.validity_end).toLocaleDateString() : '—'}
                          </span>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={batch.is_active}
                          onCheckedChange={() => handleToggleActive(batch)}
                          aria-label={batch.is_active ? 'Active' : 'Inactive'}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openStudentsDialog(batch)}
                          className="gap-2"
                        >
                          <Users className="w-4 h-4" />
                          {studentCounts[batch.id] || 0}
                        </Button>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground">
                        {new Date(batch.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openStudentsDialog(batch)}>
                              <Eye className="w-4 h-4 mr-2" />
                              View Students
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEditDialog(batch)}>
                              <Edit className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleDeleteBatch(batch)}
                              disabled={isDeleting === batch.id}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              {isDeleting === batch.id ? 'Deleting...' : 'Delete'}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) {
            setSelectedBatch(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Batch</DialogTitle>
            <DialogDescription>
              Update batch details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Batch Name</Label>
              <Input
                placeholder="Enter batch name"
                value={formData.name}
                onChange={(event) => setFormData({ ...formData, name: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                placeholder="Optional description"
                value={formData.description}
                onChange={(event) => setFormData({ ...formData, description: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Module / Subject</Label>
              <Select value={formData.moduleSubjectId} onValueChange={(v) => setFormData({ ...formData, moduleSubjectId: v === '_none_' ? '' : v })}>
                <SelectTrigger>
                  <BookOpen className="w-4 h-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Select Course (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none_">None</SelectItem>
                  {moduleSubjects.map(ms => (
                    <SelectItem key={ms.id} value={ms.id}>{ms.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Validity Start</Label>
                <Input
                  type="date"
                  value={formData.validityStart}
                  onChange={(e) => setFormData({ ...formData, validityStart: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Validity End</Label>
                <Input
                  type="date"
                  value={formData.validityEnd}
                  onChange={(e) => setFormData({ ...formData, validityEnd: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setIsEditDialogOpen(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-primary text-primary-foreground"
                onClick={handleUpdateBatch}
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isStudentsDialogOpen}
        onOpenChange={(open) => {
          setIsStudentsDialogOpen(open);
          if (!open) {
            setSelectedBatch(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Batch Students</DialogTitle>
            <DialogDescription>
              {selectedBatch ? `${selectedBatch.name} students and assignments` : 'Students'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Student</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedBatchStudents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-6 text-muted-foreground">
                        No students assigned to this batch
                      </TableCell>
                    </TableRow>
                  ) : (
                    selectedBatchStudents.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium text-foreground">
                          {student.full_name}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {student.email}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              student.is_active
                                ? 'bg-success/10 text-success border-success/20'
                                : 'bg-muted text-muted-foreground'
                            }
                          >
                            {student.is_active ? 'active' : 'inactive'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
