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
import { Plus, MoreHorizontal, Edit, Trash2, Users, Loader2, Eye, BookOpen } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useBranch } from '@/contexts/BranchContext';
import { batchService } from '@/services/batchService';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Tables } from '@/types/database';

type Batch = Tables<'batches'>;
type StudentProfile = Pick<Tables<'profiles'>, 'id' | 'full_name' | 'email' | 'metadata' | 'is_active'>;
type ModuleSubject = { id: string; name: string };

export default function BatchesPage() {
  const { user } = useAuth();
  const { currentBranchId, branches: contextBranches, branchVersion } = useBranch();
  const { toast } = useToast();
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
  const [formData, setFormData] = useState({ name: '', description: '', moduleSubjectId: '' });
  const [assignStudentId, setAssignStudentId] = useState('');

  useEffect(() => {
    if (user?.organizationId) {
      fetchData();
    }
  }, [user?.organizationId, branchVersion]);

  const fetchModuleSubjects = async () => {
    if (!user?.organizationId) return;
    try {
      const { data, error } = await supabase
        .from('module_subjects')
        .select('id, name')
        .eq('organization_id', user.organizationId)
        .order('name', { ascending: true });
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
      const data = await batchService.getBatches(user.organizationId, currentBranchId);
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
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, metadata, is_active')
        .eq('organization_id', user.organizationId)
        .eq('role', 'student')
        .order('full_name', { ascending: true });

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

  const getBatchValueFromMetadata = (metadata: StudentProfile['metadata']) => {
    if (metadata === null || metadata === undefined) {
      return undefined;
    }

    if (typeof metadata === 'string' || typeof metadata === 'number') {
      const parsedObject = parseMetadataObject(metadata);
      if (parsedObject) {
        const rawValue = (parsedObject as any).batch_id ?? (parsedObject as any).batch ?? (parsedObject as any).batchId;
        return normalizeBatchValue(rawValue);
      }

      return normalizeBatchValue(metadata);
    }

    if (typeof metadata !== 'object' || Array.isArray(metadata)) {
      return undefined;
    }

    const rawValue = (metadata as any).batch_id ?? (metadata as any).batch ?? (metadata as any).batchId;
    return normalizeBatchValue(rawValue);
  };

  const isStudentInBatch = (student: StudentProfile, batch: Batch) => {
    const batchValue = getBatchValueFromMetadata(student.metadata);
    if (!batchValue) return false;

    if (batchValue === batch.id) return true;
    return batchValue.toLowerCase() === batch.name.trim().toLowerCase();
  };

  const studentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    students.forEach((student) => {
      const batchValue = getBatchValueFromMetadata(student.metadata);
      if (!batchValue) return;

      const normalizedValue = batchValue.toLowerCase();
      const batchId = batches.find(
        (batch) => batch.id === batchValue || batch.name.trim().toLowerCase() === normalizedValue
      )?.id;
      if (!batchId) return;
      counts[batchId] = (counts[batchId] || 0) + 1;
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
    setAssignStudentId('');
    setIsStudentsDialogOpen(true);
  };

  const openEditDialog = (batch: Batch) => {
    setSelectedBatch(batch);
    setFormData({ name: batch.name, description: batch.description || '', moduleSubjectId: (batch as any).module_subject_id || '' });
    setIsEditDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({ name: '', description: '', moduleSubjectId: '' });
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
      const created = await batchService.createBatch(
        user.organizationId,
        formData.name.trim(),
        formData.description.trim() || undefined,
        currentBranchId || contextBranches[0]?.id || null,
        formData.moduleSubjectId || null
      );
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
      const updated = await batchService.updateBatch(selectedBatch.id, {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        module_subject_id: formData.moduleSubjectId || null,
      });
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

  const handleAssignStudent = async () => {
    if (!selectedBatch || !assignStudentId) {
      toast({
        title: 'Error',
        description: 'Select a student to assign',
        variant: 'destructive',
      });
      return;
    }

    const target = students.find((student) => student.id === assignStudentId);
    if (!target) return;

    const existingMetadata = parseMetadataObject(target.metadata) || {};
    const updatedMetadata = { ...existingMetadata, batch_id: selectedBatch.id };

    try {
      setIsSaving(true);
      const { error } = await supabase
        .from('profiles')
        .update({ metadata: updatedMetadata } as any)
        .eq('id', assignStudentId);

      if (error) throw error;

      setStudents((current) =>
        current.map((student) =>
          student.id === assignStudentId
            ? { ...student, metadata: updatedMetadata }
            : student
        )
      );
      setAssignStudentId('');
      toast({ title: 'Success', description: 'Student assigned to batch' });
    } catch (error) {
      console.error('Error assigning student:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to assign student',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const selectedBatchStudents = useMemo(() => {
    if (!selectedBatch) return [];
    return students.filter((student) => isStudentInBatch(student, selectedBatch));
  }, [students, selectedBatch]);

  const assignableStudents = useMemo(() => {
    if (!selectedBatch) return [];
    return students.filter((student) => !isStudentInBatch(student, selectedBatch));
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
                  <TableHead className="hidden md:table-cell">Description</TableHead>
                  <TableHead>Students</TableHead>
                  <TableHead className="hidden lg:table-cell">Created</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                      Loading batches...
                    </TableCell>
                  </TableRow>
                ) : filteredBatches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No batches found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredBatches.map((batch) => (
                    <TableRow key={batch.id} className="animate-fade-in">
                      <TableCell>
                        <p className="font-medium text-foreground">{batch.name}</p>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {(batch as any).module_subject_id
                          ? <Badge variant="outline" className="text-xs"><BookOpen className="w-3 h-3 mr-1" />{moduleSubjects.find(ms => ms.id === (batch as any).module_subject_id)?.name || '-'}</Badge>
                          : <span className="text-muted-foreground">-</span>
                        }
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {batch.description || '-'}
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
            setAssignStudentId('');
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

            <div className="border rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium text-foreground">Assign student to batch</p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Select value={assignStudentId} onValueChange={setAssignStudentId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select student" />
                  </SelectTrigger>
                  <SelectContent>
                    {assignableStudents.length === 0 ? (
                      <SelectItem value="no-students" disabled>
                        No students available
                      </SelectItem>
                    ) : (
                      assignableStudents.map((student) => (
                        <SelectItem key={student.id} value={student.id}>
                          {student.full_name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <Button
                  className="bg-primary text-primary-foreground"
                  onClick={handleAssignStudent}
                  disabled={isSaving || !assignStudentId}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Assigning...
                    </>
                  ) : (
                    'Assign'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
