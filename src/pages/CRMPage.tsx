import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Search,
  Plus,
  Phone,
  Mail,
  MessageSquare,
  Calendar,
  ArrowRight,
  MoreHorizontal,
  Filter,
  TrendingUp,
  Users,
  UserPlus,
  CheckCircle,
  XCircle,
} from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { useBranch } from '@/contexts/BranchContext';
import { useToast } from '@/hooks/use-toast';
import { crmService } from '@/services/crmService';
import { registrationService } from '@/services/registrationService';
import type { Tables } from '@/types/database';

type Lead = Tables<'crm_leads'>;
type Profile = Tables<'profiles'>;

const STAGES = [
  { key: 'new', label: 'New Lead', color: 'bg-primary/10 text-primary border-primary/20', icon: UserPlus },
  { key: 'contacted', label: 'Contacted', color: 'bg-accent/10 text-accent border-accent/20', icon: Phone },
  { key: 'interested', label: 'Interested', color: 'bg-warning/10 text-warning border-warning/20', icon: TrendingUp },
  { key: 'follow_up', label: 'Follow-up', color: 'bg-secondary text-secondary-foreground border-secondary', icon: Calendar },
  { key: 'converted', label: 'Converted', color: 'bg-success/10 text-success border-success/20', icon: CheckCircle },
  { key: 'lost', label: 'Not Interested', color: 'bg-destructive/10 text-destructive border-destructive/20', icon: XCircle },
];

const getStageStyle = (key: string) => {
  return STAGES.find((s) => s.key === key) || STAGES[0];
};

export default function CRMPage() {
  const { profile, organization, user } = useAuth();
  const { currentBranchId, branchVersion } = useBranch();
  const orgId = profile?.organization_id || organization?.id || user?.organizationId || null;
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'pipeline' | 'list'>('pipeline');

  // Data
  const [leads, setLeads] = useState<Lead[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);

  // Add lead form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [course, setCourse] = useState('');
  const [source, setSource] = useState('');
  const [notes, setNotes] = useState('');
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Local queue for leads created before org is available
  const [pendingLeads, setPendingLeads] = useState<Lead[]>([]);

  // Filters
  const [sourceFilter, setSourceFilter] = useState('all');
  const [assignedFilter, setAssignedFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState<string | null>(null);
  const [dateTo, setDateTo] = useState<string | null>(null);

  // Convert lead dialog
  const [isConvertDialogOpen, setIsConvertDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [courses, setCourses] = useState<{ id: string; name: string; subject: string | null }[]>([]);
  const [batches, setBatches] = useState<{ id: string; name: string; description: string | null }[]>([]);
  const [orgTaxRate, setOrgTaxRate] = useState(18);

  // Conversion form state
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedBatch, setSelectedBatch] = useState('');
  const [courseFee, setCourseFee] = useState('');
  const [discountAmount, setDiscountAmount] = useState('');
  const [taxInclusive, setTaxInclusive] = useState(false);
  const [paymentType, setPaymentType] = useState<'full' | 'emi' | 'installment'>('full');
  const [advancePayment, setAdvancePayment] = useState('');
  const [converting, setConverting] = useState(false);

  const loadData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const data = await crmService.getLeads(orgId, currentBranchId);
      setLeads(data || []);
      const p = await crmService.getAssignableProfiles(orgId);
      setProfiles(p || []);
    } catch (err) {
      console.error(err);
      const message = (err as unknown as Error)?.message || 'Failed to load leads';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [orgId, toast, currentBranchId, branchVersion]);

  const loadCoursesAndBatches = useCallback(async () => {
    if (!orgId) return;
    try {
      const [coursesData, batchesData, taxRate] = await Promise.all([
        crmService.getCourses(orgId, currentBranchId),
        crmService.getBatches(orgId, currentBranchId),
        registrationService.getOrganizationTax(orgId),
      ]);
      setCourses(coursesData || []);
      setBatches(batchesData || []);
      setOrgTaxRate(taxRate);
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to load courses and batches', variant: 'destructive' });
    }
  }, [orgId, toast, currentBranchId, branchVersion]);

  useEffect(() => {
    loadData();
    loadCoursesAndBatches();
  }, [loadData, loadCoursesAndBatches]);

  // Sync any pending leads when organization becomes available
  useEffect(() => {
    const syncPending = async () => {
      if (!orgId || pendingLeads.length === 0) return;
      for (const pending of [...pendingLeads]) {
        try {
          const created = await crmService.createLead({
            organization_id: orgId,
            branch_id: currentBranchId || profile?.branch_id || null,
            name: pending.name,
            phone: pending.phone,
            email: pending.email || null,
            source: pending.source || null,
            notes: pending.notes || null,
            assigned_to: pending.assigned_to || null,
            status: pending.status || 'new',
          });

          // Replace temp lead with created lead
          setLeads((ls) => ls.map((l) => (l.id === pending.id ? created : l)));
          setPendingLeads((p) => p.filter((x) => x.id !== pending.id));
          toast({ title: 'Lead synced', description: `${created.name} saved to your organization` });
        } catch (err) {
          console.error('Failed to sync pending lead', err);
          toast({ title: 'Sync failed', description: (err as unknown as Error)?.message || 'Failed to sync pending lead', variant: 'destructive' });
        }
      }
    };

    syncPending();
  }, [orgId, pendingLeads, toast]);

  const filteredLeads = leads.filter((lead) => {
    const matchesSearch =
      lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (lead.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (lead.phone || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStage = stageFilter === 'all' || lead.status === stageFilter;
    const matchesSource = sourceFilter === 'all' || (lead.source || '').toLowerCase() === sourceFilter.toLowerCase();
    const matchesAssigned = assignedFilter === 'all' || (lead.assigned_to || '') === assignedFilter;

    const matchesDate = (() => {
      if (!dateFrom && !dateTo) return true;
      const created = new Date(lead.created_at);
      if (dateFrom && created < new Date(dateFrom)) return false;
      if (dateTo && created > new Date(dateTo)) return false;
      return true;
    })();

    return matchesSearch && matchesStage && matchesSource && matchesAssigned && matchesDate;
  });

  const pipelineStages = STAGES.map((s) => s.key);

  const stats = {
    total: leads.length,
    new: leads.filter((l) => l.status === 'new').length,
    converted: leads.filter((l) => l.status === 'converted').length,
    conversionRate: leads.length ? Math.round((leads.filter((l) => l.status === 'converted').length / leads.length) * 100) : 0,
  };

  const resetForm = () => {
    setName('');
    setPhone('');
    setEmail('');
    setCourse('');
    setSource('');
    setNotes('');
    setAssignedTo(null);
  };

  const handleAddLead = async () => {
    if (!name.trim() || !phone.trim()) {
      toast({ title: 'Validation error', description: 'Name and phone are required', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const notesToSave = [notes, course ? `Course: ${course}` : null].filter(Boolean).join('\n') || null;

      // Try to resolve orgId now if it wasn't available at render time
      const resolvedOrgId = orgId || await crmService.getCurrentOrganizationId();

      if (resolvedOrgId) {
        const newLead = await crmService.createLead({
          organization_id: resolvedOrgId,
          branch_id: currentBranchId || profile?.branch_id || null,
          name: name.trim(),
          phone: phone.trim(),
          email: email || null,
          source: source || null,
          notes: notesToSave,
          assigned_to: assignedTo || null,
          status: 'new',
        });

        setLeads((s) => [newLead, ...s]);
        toast({ title: 'Lead created', description: `${newLead.name} was added` });
      } else {
        // Queue locally and show message; will sync when org becomes available
        const tempId = `temp-${Date.now()}`;
        const tempLead: Lead = {
          id: tempId,
          organization_id: '',
          branch_id: currentBranchId || profile?.branch_id || null,
          name: name.trim(),
          phone: phone.trim(),
          email: email || null,
          source: source || null,
          notes: notesToSave,
          assigned_to: assignedTo || null,
          converted_to_student_id: null,
          course: course || null,
          next_follow_up: null,
          status: 'new',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        setLeads((s) => [tempLead, ...s]);
        setPendingLeads((p) => [tempLead, ...p]);
        toast({ title: 'Lead queued', description: 'No organization found — lead will be saved once your organization is available.' });
      }

      resetForm();
      setIsAddDialogOpen(false);
    } catch (err) {
      console.error(err);
      const message = (err as unknown as Error)?.message || 'Failed to create lead';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  // Drag handlers---
  const onDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
  };

  const onDropToStage = async (e: React.DragEvent, newStatus: Lead['status']) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    if (!id) return;
    
    // If dropping to "converted", open conversion dialog instead
    if (newStatus === 'converted') {
      const lead = leads.find((l) => l.id === id);
      if (lead) {
        setSelectedLead(lead);
        setIsConvertDialogOpen(true);
      }
      return;
    }

    const prevLeads = leads;
    setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, status: newStatus } : l)));
    try {
      // If it's a temp lead, just update locally and it will be synced when org available
      if (id.startsWith('temp-')) {
        setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, status: newStatus } : l)));
        toast({ title: 'Updated', description: 'Lead moved (queued)' });
        return;
      }

      await crmService.updateLead(id, { status: newStatus });
      toast({ title: 'Updated', description: 'Lead moved' });
    } catch (err) {
      setLeads(prevLeads);
      const message = (err as unknown as Error)?.message || 'Failed to update lead';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  };

  // Calculate fee breakdown
  const calculateFees = () => {
    const fee = parseFloat(courseFee) || 0;
    const discount = parseFloat(discountAmount) || 0;
    const advance = parseFloat(advancePayment) || 0;

    let feeActual = fee - discount;
    let taxAmount = 0;
    let totalAmount = 0;

    if (taxInclusive) {
      totalAmount = feeActual;
      taxAmount = (feeActual * orgTaxRate) / (100 + orgTaxRate);
      feeActual = feeActual - taxAmount;
    } else {
      taxAmount = (feeActual * orgTaxRate) / 100;
      totalAmount = feeActual + taxAmount;
    }

    const balanceAmount = totalAmount - advance;

    return {
      feeActual: feeActual.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      totalAmount: totalAmount.toFixed(2),
      balanceAmount: balanceAmount.toFixed(2),
    };
  };

  const resetConversionForm = () => {
    setSelectedLead(null);
    setSelectedCourse('');
    setSelectedBatch('');
    setCourseFee('');
    setDiscountAmount('');
    setTaxInclusive(false);
    setPaymentType('full');
    setAdvancePayment('');
  };

  const handleConvertLead = async () => {
    if (!selectedLead || !orgId) return;

    if (!selectedCourse || !selectedBatch || !courseFee) {
      toast({ title: 'Validation error', description: 'Course, Batch, and Course Fee are required', variant: 'destructive' });
      return;
    }

    setConverting(true);
    try {
      const registration = await crmService.convertLead(selectedLead.id, {
        organizationId: orgId,
        courseId: selectedCourse,
        batchId: selectedBatch,
        courseFee: parseFloat(courseFee),
        discountAmount: parseFloat(discountAmount) || 0,
        taxInclusive,
        taxPercentage: orgTaxRate,
        paymentType,
        advancePayment: parseFloat(advancePayment) || 0,
      });

      // Update the lead in local state
      setLeads((ls) => ls.map((l) => (l.id === selectedLead.id ? { ...l, status: 'converted' } : l)));

      toast({
        title: 'Lead converted',
        description: `${selectedLead.name} has been converted. Registration link ready to share.`,
      });

      setIsConvertDialogOpen(false);
      resetConversionForm();

      // Navigate to converted leads page after a brief delay to show the toast
      setTimeout(() => {
        window.location.href = '/dashboard/converted-leads';
      }, 1500);
    } catch (err) {
      console.error(err);
      const message = (err as unknown as Error)?.message || 'Failed to convert lead';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setConverting(false);
    }
  };

  const openConvertDialog = (lead: Lead) => {
    setSelectedLead(lead);
    setIsConvertDialogOpen(true);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
            CRM & Admissions
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage leads, enquiries, and conversions
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground">
              <Plus className="w-4 h-4 mr-2" />
              Add Lead
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Lead</DialogTitle>
              <DialogDescription>
                Capture enquiry details for follow-up.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input placeholder="Enter full name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input type="tel" placeholder="+91..." value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" placeholder="email@..." value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Course Interest</Label>
                  <Select value={course} onValueChange={(v) => setCourse(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NEET Coaching">NEET Coaching</SelectItem>
                      <SelectItem value="JEE Mains">JEE Mains</SelectItem>
                      <SelectItem value="JEE Advanced">JEE Advanced</SelectItem>
                      <SelectItem value="Foundation">Foundation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Source</Label>
                  <Select value={source} onValueChange={(v) => setSource(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="website">Website</SelectItem>
                      <SelectItem value="referral">Referral</SelectItem>
                      <SelectItem value="walk-in">Walk-in</SelectItem>
                      <SelectItem value="phone">Phone Call</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="campaign">Campaign</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea placeholder="Add any additional notes..." value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Assigned To</Label>
                <Select value={assignedTo ?? '__unassigned'} onValueChange={(v) => setAssignedTo(v === '__unassigned' ? null : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Assign" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__unassigned">Unassigned</SelectItem>
                    {profiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.full_name} ({p.role})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" className="flex-1" onClick={() => { setIsAddDialogOpen(false); resetForm(); }}>
                  Cancel
                </Button>
                <Button className="flex-1 bg-primary text-primary-foreground" onClick={handleAddLead} disabled={submitting}>
                  {submitting ? 'Adding...' : 'Add Lead'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Convert Lead Dialog */}
<Dialog open={isConvertDialogOpen} onOpenChange={(open) => {
          if (!open) {
            setIsConvertDialogOpen(false);
            resetConversionForm();
          }
        }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Convert Lead to Student</DialogTitle>
              <DialogDescription>
                {selectedLead && `Converting ${selectedLead.name}. Complete the course and fee details to generate a registration link.`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              {/* Lead Info */}
              {selectedLead && (
                <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                  <p className="text-sm"><strong>Name:</strong> {selectedLead.name}</p>
                  <p className="text-sm"><strong>Email:</strong> {selectedLead.email || 'N/A'}</p>
                  <p className="text-sm"><strong>Phone:</strong> {selectedLead.phone}</p>
                </div>
              )}

              {/* Course Selection */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Course *</Label>
                  <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select course" />
                    </SelectTrigger>
                    <SelectContent>
                      {courses.length === 0 && <SelectItem value="__none" disabled>No courses available</SelectItem>}
                      {courses.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} {c.subject && `(${c.subject})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Batch *</Label>
                  <Select value={selectedBatch} onValueChange={setSelectedBatch}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select batch" />
                    </SelectTrigger>
                    <SelectContent>
                      {batches.length === 0 && <SelectItem value="__none" disabled>No batches available</SelectItem>}
                      {batches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Fee Details */}
              <div className="space-y-3 p-4 rounded-lg border">
                <h4 className="font-medium text-sm">Fee Details</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Course Fee *</Label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={courseFee}
                      onChange={(e) => setCourseFee(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Discount Amount</Label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={discountAmount}
                      onChange={(e) => setDiscountAmount(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between py-2">
                  <Label htmlFor="tax-inclusive">Tax Inclusive?</Label>
                  <Switch
                    id="tax-inclusive"
                    checked={taxInclusive}
                    onCheckedChange={setTaxInclusive}
                  />
                </div>

                {/* Calculated Fields */}
                {courseFee && (
                  <div className="space-y-2 pt-2 border-t">
                    <div className="flex justify-between py-1 text-sm">
                      <span className="text-muted-foreground">Fee Actual:</span>
                      <span className="font-medium">₹{calculateFees().feeActual}</span>
                    </div>
                    <div className="flex justify-between py-1 text-sm">
                      <span className="text-muted-foreground">Tax ({orgTaxRate}%):</span>
                      <span className="font-medium">₹{calculateFees().taxAmount}</span>
                    </div>
                    <div className="flex justify-between py-1 text-sm font-semibold border-t pt-2">
                      <span>Total Amount:</span>
                      <span className="text-primary">₹{calculateFees().totalAmount}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Payment Details */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Payment Type *</Label>
                    <Select value={paymentType} onValueChange={(v) => setPaymentType(v as 'full' | 'emi' | 'installment')}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full">Full Payment</SelectItem>
                        <SelectItem value="emi">EMI</SelectItem>
                        <SelectItem value="installment">Installment</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Advance Payment</Label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={advancePayment}
                      onChange={(e) => setAdvancePayment(e.target.value)}
                    />
                  </div>
                </div>

                {courseFee && advancePayment && (
                  <div className="flex justify-between py-1 text-sm">
                    <span className="text-muted-foreground">Balance Amount:</span>
                    <span className="font-medium">₹{calculateFees().balanceAmount}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setIsConvertDialogOpen(false);
                    resetConversionForm();
                  }}
                  disabled={converting}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-primary text-primary-foreground"
                  onClick={handleConvertLead}
                  disabled={converting || !selectedCourse || !selectedBatch || !courseFee}
                >
                  {converting ? 'Converting...' : 'Convert & Generate Link'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Leads</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.new}</p>
                <p className="text-xs text-muted-foreground">New This Week</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.converted}</p>
                <p className="text-xs text-muted-foreground">Converted</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.conversionRate}%</p>
                <p className="text-xs text-muted-foreground">Conversion Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border shadow-card">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search leads..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2 items-center">
              <Select value={stageFilter} onValueChange={setStageFilter}>
                <SelectTrigger className="w-40">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Stage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stages</SelectItem>
                  {STAGES.map((s) => (
                    <SelectItem key={s.key} value={s.key}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  {/* dynamic sources */}
                  {[...new Set(leads.map((l) => l.source || '').filter(Boolean))].map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2">
                <Input type="date" value={dateFrom || ''} onChange={(e) => setDateFrom(e.target.value || null)} className="w-36" />
                <Input type="date" value={dateTo || ''} onChange={(e) => setDateTo(e.target.value || null)} className="w-36" />
              </div>
              <Select value={assignedFilter} onValueChange={setAssignedFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Assigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Assignees</SelectItem>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex rounded-lg border overflow-hidden">
                <Button
                  variant={viewMode === 'pipeline' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('pipeline')}
                  className={viewMode === 'pipeline' ? 'bg-primary text-primary-foreground' : ''}
                >
                  Pipeline
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className={viewMode === 'list' ? 'bg-primary text-primary-foreground' : ''}
                >
                  List
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {viewMode === 'pipeline' ? (
        /* Pipeline View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {pipelineStages.map((stage) => {
            const stageStyle = getStageStyle(stage);
            const stageLeads = filteredLeads.filter((l) => l.status === stage);
            return (
              <Card key={stage} className="border shadow-card" onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDropToStage(e, stage as Lead['status'])}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className={stageStyle.color}>
                      {stageStyle.label}
                    </Badge>
                    <span className="text-sm font-medium text-muted-foreground">
                      {stageLeads.length}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {stageLeads.length > 0 ? (
                    stageLeads.map((lead) => {
                      const assignee = profiles.find((p) => p.id === lead.assigned_to)?.full_name || 'Unassigned';
                      return (
                        <div
                          key={lead.id}
                          draggable
                          onDragStart={(e) => onDragStart(e, lead.id)}
                          className="p-3 rounded-lg border bg-card hover:shadow-soft transition-shadow cursor-pointer"
                        >
                          <div className="flex items-start gap-2">
                            <Avatar className="w-8 h-8">
                              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                {lead.name.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm text-foreground truncate">
                                {lead.name}
                              </p>
                              <p className="text-xs text-muted-foreground">{assignee}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                            <Phone className="w-3 h-3" />
                            <span className="truncate">{lead.phone}</span>
                          </div>
                          {lead.created_at && (
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              <Calendar className="w-3 h-3" />
                              <span>Added: {new Date(lead.created_at).toLocaleDateString()}</span>
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-6 text-muted-foreground text-sm">
                      No leads
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        /* List View */
        <Card className="border shadow-card">
          <CardContent className="p-0">
            <div className="divide-y">
              {filteredLeads.map((lead, index) => {
                const stageStyle = getStageStyle(lead.status);
                const assignee = profiles.find((p) => p.id === lead.assigned_to)?.full_name || 'Unassigned';
                return (
                  <div
                    key={lead.id}
                    className="p-4 hover:bg-muted/50 transition-colors animate-fade-in"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex items-center gap-4">
                      <Avatar className="w-10 h-10">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {lead.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-foreground">{lead.name}</h3>
                          <Badge variant="outline" className={stageStyle.color}>
                            {stageStyle.label}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-4 mt-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5" />
                            {lead.phone}
                          </span>
                          <span className="flex items-center gap-1">
                            <Mail className="w-3.5 h-3.5" />
                            {lead.email}
                          </span>
                          <span>{assignee}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon">
                          <Phone className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon">
                          <MessageSquare className="w-4 h-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>View Details</DropdownMenuItem>
                            <DropdownMenuItem>Add Follow-up</DropdownMenuItem>
                            <DropdownMenuItem>Move Stage</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openConvertDialog(lead)}>
                              Convert to Student
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
