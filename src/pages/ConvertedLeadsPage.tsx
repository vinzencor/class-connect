import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Search,
  Link as LinkIcon,
  Mail,
  Copy,
  CheckCircle,
  XCircle,
  Clock,
  Send,
  Eye,
  AlertCircle,
  UserCheck,
} from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { useBranch } from '@/contexts/BranchContext';
import { useToast } from '@/hooks/use-toast';
import { registrationService } from '@/services/registrationService';

type Registration = Awaited<ReturnType<typeof registrationService.getRegistrations>>[0];

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'bg-muted text-muted-foreground', icon: Clock },
  link_sent: { label: 'Link Sent', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Send },
  submitted: { label: 'Submitted', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: AlertCircle },
  verified: { label: 'Verified', color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle },
};

export default function ConvertedLeadsPage() {
  const { profile, organization, user } = useAuth();
  const orgId = profile?.organization_id || organization?.id || user?.organizationId || null;
  const { currentBranchId, branchVersion } = useBranch();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(false);

  // Review dialog
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [selectedRegistration, setSelectedRegistration] = useState<Registration | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);

  const loadRegistrations = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const data = await registrationService.getRegistrations(orgId, currentBranchId);
      const scoped = user?.role === 'sales_staff'
        ? (data || []).filter((reg) => ((reg.crm_leads as any)?.assigned_to || null) === user.id)
        : (data || []);
      setRegistrations(scoped);
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to load registrations', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [orgId, currentBranchId, branchVersion, toast, user?.role, user?.id]);

  useEffect(() => {
    loadRegistrations();
  }, [loadRegistrations]);

  const filteredRegistrations = registrations.filter((reg) => {
    const leadData = reg.crm_leads as any;
    const matchesSearch =
      leadData?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      reg.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      reg.mobile_no?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || reg.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: registrations.length,
    pending: registrations.filter((r) => r.status === 'pending').length,
    link_sent: registrations.filter((r) => r.status === 'link_sent').length,
    submitted: registrations.filter((r) => r.status === 'submitted').length,
    verified: registrations.filter((r) => r.status === 'verified').length,
  };

  const copyLink = (token: string) => {
    const link = registrationService.getRegistrationLink(token);
    navigator.clipboard.writeText(link);
    toast({ title: 'Copied', description: 'Registration link copied to clipboard' });
  };

  const sendLink = async (reg: Registration) => {
    try {
      await registrationService.markLinkSent(reg.id);
      const leadData = reg.crm_leads as any;
      const emailLink = registrationService.getRegistrationEmailLink(
        reg.email || leadData?.email || '',
        reg.token,
        leadData?.name || 'Student',
        organization?.name || 'Our Institute'
      );
      window.location.href = emailLink;
      await loadRegistrations();
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to mark link as sent', variant: 'destructive' });
    }
  };

  const openReview = (reg: Registration) => {
    setSelectedRegistration(reg);
    setReviewDialogOpen(true);
  };

  const handleVerify = async () => {
    if (!selectedRegistration || !user?.id) return;
    setProcessing(true);
    try {
      await registrationService.verifyRegistration(selectedRegistration.id, user.id);
      toast({
        title: 'Registration verified',
        description: 'Student account created. Password setup email sent to the student.',
      });
      setReviewDialogOpen(false);
      setSelectedRegistration(null);
      await loadRegistrations();
    } catch (err) {
      console.error(err);
      const message = (err as unknown as Error)?.message || 'Failed to verify registration';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRegistration || !user?.id) return;
    if (!rejectionReason.trim()) {
      toast({ title: 'Validation error', description: 'Please provide a rejection reason', variant: 'destructive' });
      return;
    }
    setProcessing(true);
    try {
      await registrationService.rejectRegistration(selectedRegistration.id, rejectionReason, user.id);
      toast({ title: 'Registration rejected', description: 'The registration has been rejected' });
      setReviewDialogOpen(false);
      setSelectedRegistration(null);
      setRejectionReason('');
      await loadRegistrations();
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to reject registration', variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
          Converted Leads
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage student registrations and verify applications
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="border shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <UserCheck className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <Clock className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.pending}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Send className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.link_sent}</p>
                <p className="text-xs text-muted-foreground">Link Sent</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.submitted}</p>
                <p className="text-xs text-muted-foreground">Submitted</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.verified}</p>
                <p className="text-xs text-muted-foreground">Verified</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border shadow-card">
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 rounded-md border bg-background"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="link_sent">Link Sent</option>
              <option value="submitted">Submitted</option>
              <option value="verified">Verified</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Registrations List */}
      <Card className="border shadow-card">
        <CardContent className="p-0">
          <div className="divide-y">
            {filteredRegistrations.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No registrations found
              </div>
            ) : (
              filteredRegistrations.map((reg) => {
                const leadData = reg.crm_leads as any;
                const statusConfig = STATUS_CONFIG[reg.status];
                const StatusIcon = statusConfig.icon;

                return (
                  <div key={reg.id} className="p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <Avatar className="w-12 h-12">
                        {reg.photo_url && <AvatarImage src={reg.photo_url} />}
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {leadData?.name?.charAt(0) || 'S'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-foreground">
                            {reg.full_name || leadData?.name || 'Unnamed'}
                          </h3>                          {(reg as any).student_profile?.student_number && (
                            <Badge variant="outline" className="font-mono bg-violet-500/10 text-violet-600 border-violet-500/20 text-xs">
                              {(reg as any).student_profile.student_number}
                            </Badge>
                          )}                          <Badge variant="outline" className={statusConfig.color}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {statusConfig.label}
                          </Badge>
                        </div>
                        <div className="flex gap-4 mt-1 text-sm text-muted-foreground">
                          <span>{reg.email || leadData?.email || 'No email'}</span>
                          <span>{reg.mobile_no || leadData?.phone || 'No phone'}</span>
                          {(reg.classes as any)?.name && (
                            <span className="text-primary">Course: {(reg.classes as any).name}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {reg.status === 'pending' && (
                          <>
                            <Button variant="outline" size="sm" onClick={() => copyLink(reg.token)}>
                              <Copy className="w-4 h-4 mr-2" />
                              Copy Link
                            </Button>
                            <Button size="sm" onClick={() => sendLink(reg)}>
                              <Mail className="w-4 h-4 mr-2" />
                              Send Link
                            </Button>
                          </>
                        )}
                        {reg.status === 'link_sent' && (
                          <Button variant="outline" size="sm" onClick={() => copyLink(reg.token)}>
                            <Copy className="w-4 h-4 mr-2" />
                            Copy Link
                          </Button>
                        )}
                        {reg.status === 'submitted' && (
                          <Button size="sm" onClick={() => openReview(reg)}>
                            <Eye className="w-4 h-4 mr-2" />
                            Review
                          </Button>
                        )}
                        {reg.status === 'verified' && (
                          <Button variant="outline" size="sm" disabled>
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Approved
                          </Button>
                        )}
                        {reg.status === 'rejected' && (
                          <Button variant="outline" size="sm" disabled>
                            <XCircle className="w-4 h-4 mr-2" />
                            Rejected
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Student Registration</DialogTitle>
            <DialogDescription>
              Review the submitted details and verify or reject the application
            </DialogDescription>
          </DialogHeader>
          {selectedRegistration && (
            <div className="space-y-6 mt-4">
              {/* Photo */}
              {selectedRegistration.photo_url && (
                <div className="flex justify-center">
                  <Avatar className="w-32 h-32">
                    <AvatarImage src={selectedRegistration.photo_url} />
                    <AvatarFallback>{selectedRegistration.full_name?.charAt(0) || 'S'}</AvatarFallback>
                  </Avatar>
                </div>
              )}

              {/* Personal Details */}
              <div className="space-y-3">
                <h3 className="font-semibold border-b pb-2">Personal Details</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label className="text-muted-foreground">Full Name</Label>
                    <p className="font-medium">{selectedRegistration.full_name || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Date of Birth</Label>
                    <p className="font-medium">{selectedRegistration.date_of_birth || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Gender</Label>
                    <p className="font-medium capitalize">{selectedRegistration.gender || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Mobile</Label>
                    <p className="font-medium">{selectedRegistration.mobile_no || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Email</Label>
                    <p className="font-medium">{selectedRegistration.email || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">WhatsApp</Label>
                    <p className="font-medium">{selectedRegistration.whatsapp_no || 'N/A'}</p>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-muted-foreground">Address</Label>
                    <p className="font-medium">{selectedRegistration.address || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">City</Label>
                    <p className="font-medium">{selectedRegistration.city || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">State</Label>
                    <p className="font-medium">{selectedRegistration.state || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Pincode</Label>
                    <p className="font-medium">{selectedRegistration.pincode || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Aadhaar Number</Label>
                    <p className="font-medium">{selectedRegistration.aadhaar_number || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Parent Details */}
              <div className="space-y-3">
                <h3 className="font-semibold border-b pb-2">Parent Details</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label className="text-muted-foreground">Father's Name</Label>
                    <p className="font-medium">{selectedRegistration.father_name || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Mother's Name</Label>
                    <p className="font-medium">{selectedRegistration.mother_name || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Parent Email</Label>
                    <p className="font-medium">{selectedRegistration.parent_email || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Parent Mobile</Label>
                    <p className="font-medium">{selectedRegistration.parent_mobile || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Academic Details */}
              <div className="space-y-3">
                <h3 className="font-semibold border-b pb-2">Academic Details</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label className="text-muted-foreground">Qualification</Label>
                    <p className="font-medium">{selectedRegistration.qualification || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Graduation Year</Label>
                    <p className="font-medium">{selectedRegistration.graduation_year || 'N/A'}</p>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-muted-foreground">College</Label>
                    <p className="font-medium">{selectedRegistration.graduation_college || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Course & Fee Details */}
              <div className="space-y-3">
                <h3 className="font-semibold border-b pb-2">Course & Fee Details</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label className="text-muted-foreground">Course</Label>
                    <p className="font-medium">{(selectedRegistration.classes as any)?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Batch</Label>
                    <p className="font-medium">{(selectedRegistration.batches as any)?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Total Fee</Label>
                    <p className="font-medium">₹{selectedRegistration.total_amount?.toFixed(2) || '0.00'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Advance Paid</Label>
                    <p className="font-medium">₹{selectedRegistration.advance_payment?.toFixed(2) || '0.00'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Balance</Label>
                    <p className="font-medium">₹{selectedRegistration.balance_amount?.toFixed(2) || '0.00'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Payment Type</Label>
                    <p className="font-medium capitalize">{selectedRegistration.payment_type || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Remarks */}
              {selectedRegistration.remarks && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Remarks</Label>
                  <p className="text-sm">{selectedRegistration.remarks}</p>
                </div>
              )}

              {/* Rejection Reason Input */}
              {selectedRegistration.status === 'submitted' && (
                <div className="space-y-2">
                  <Label>Rejection Reason (if rejecting)</Label>
                  <Textarea
                    placeholder="Provide reason for rejection..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                  />
                </div>
              )}

              {/* Actions */}
              {selectedRegistration.status === 'submitted' && (
                <div className="flex gap-3 pt-4">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setReviewDialogOpen(false)}
                    disabled={processing}
                  >
                    Close
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={handleReject}
                    disabled={processing}
                  >
                    {processing ? 'Rejecting...' : 'Reject'}
                  </Button>
                  <Button
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                    onClick={handleVerify}
                    disabled={processing}
                  >
                    {processing ? 'Verifying...' : 'Verify & Create Account'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
