import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { Tables } from '@/types/database';
import { sendLeaveReminder } from '@/services/whatsappService';
import {
  Plus,
  Loader2,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  CalendarCheck,
  AlertCircle,
} from 'lucide-react';

type LeaveRequest = Tables<'leave_requests'>;

const getStatusColor = (status: string) => {
  switch (status) {
    case 'approved':
      return 'bg-success/10 text-success border-success/20';
    case 'rejected':
      return 'bg-destructive/10 text-destructive border-destructive/20';
    case 'pending':
      return 'bg-warning/10 text-warning border-warning/20';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'approved':
      return <CheckCircle className="w-3.5 h-3.5" />;
    case 'rejected':
      return <XCircle className="w-3.5 h-3.5" />;
    case 'pending':
      return <Clock className="w-3.5 h-3.5" />;
    default:
      return null;
  }
};

// ── Admin/Faculty View ─────────────────────────────────────
function AdminLeaveRequestView() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [leaveRequests, setLeaveRequests] = useState<(LeaveRequest & { student_name?: string })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (user?.organizationId) {
      fetchAllLeaveRequests();
    }
  }, [user?.organizationId]);

  const fetchAllLeaveRequests = async () => {
    try {
      setIsLoading(true);
      if (!user?.organizationId) return;

      // Fetch all leave requests for the organization
      const { data, error } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('organization_id', user.organizationId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch student names
      const studentIds = [...new Set((data || []).map((r: any) => r.student_id))];
      let studentMap: Record<string, string> = {};

      if (studentIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', studentIds);

        (profiles || []).forEach((p: any) => {
          studentMap[p.id] = p.full_name;
        });
      }

      const enriched = (data || []).map((r: any) => ({
        ...r,
        student_name: studentMap[r.student_id] || 'Unknown Student',
      }));

      setLeaveRequests(enriched);
    } catch (error) {
      console.error('Error fetching leave requests:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch leave requests',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (requestId: string, studentId: string, requestedDate: string | null) => {
    if (!user?.id || !user?.organizationId) return;
    setActionLoading(requestId);
    try {
      // 1. Approve the leave request
      const { error: approveError } = await supabase
        .from('leave_requests')
        .update({
          status: 'approved',
          approved_by: user.id,
          approved_date: new Date().toISOString(),
        } as any)
        .eq('id', requestId);

      if (approveError) throw approveError;

      // 2. Mark the student as absent in attendance for the requested date
      const leaveDate = requestedDate || new Date().toISOString().split('T')[0];

      // Check if attendance record already exists for this date
      const { data: existingAttendance } = await supabase
        .from('attendance')
        .select('id')
        .eq('student_id', studentId)
        .eq('date', leaveDate)
        .eq('organization_id', user.organizationId)
        .maybeSingle();

      if (existingAttendance) {
        // Update existing record to absent with leave note
        await supabase
          .from('attendance')
          .update({
            status: 'absent',
            notes: 'On approved leave',
            marked_by: user.id,
            marked_at: new Date().toISOString(),
          } as any)
          .eq('id', existingAttendance.id);
      } else {
        // Get student's branch_id
        const { data: studentProfile } = await supabase
          .from('profiles')
          .select('branch_id')
          .eq('id', studentId)
          .maybeSingle();

        // Create new attendance record as absent (on leave)
        await supabase
          .from('attendance')
          .insert({
            organization_id: user.organizationId,
            student_id: studentId,
            date: leaveDate,
            status: 'absent',
            notes: 'On approved leave',
            marked_by: user.id,
            marked_at: new Date().toISOString(),
            ...(studentProfile?.branch_id ? { branch_id: studentProfile.branch_id } : {}),
          } as any);
      }

      // ── Notify parent via WhatsApp ──
      try {
        const { data: studentDetail } = await supabase
          .from('student_details')
          .select('parent_mobile')
          .eq('student_id', studentId)
          .maybeSingle();

        const parentPhone = studentDetail?.parent_mobile;

        if (parentPhone) {
          const studentName =
            leaveRequests.find((r) => r.student_id === studentId)?.student_name ||
            'Your ward';

          const leaveDateFormatted = new Date(leaveDate).toLocaleDateString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric',
          });

          await sendLeaveReminder({
            to: parentPhone,
            studentName,
            leaveDate: leaveDateFormatted,
            reason: 'Leave approved by admin',
          });
        }
      } catch (waErr) {
        // WhatsApp failure should not block the approval flow
        console.error('WhatsApp parent notification failed:', waErr);
      }

      toast({
        title: 'Success',
        description: 'Leave request approved and attendance updated',
      });

      await fetchAllLeaveRequests();
    } catch (error) {
      console.error('Error approving leave request:', error);
      toast({
        title: 'Error',
        description: 'Failed to approve leave request',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (requestId: string) => {
    setActionLoading(requestId);
    try {
      const { error } = await supabase
        .from('leave_requests')
        .update({
          status: 'rejected',
        } as any)
        .eq('id', requestId);

      if (error) throw error;

      toast({
        title: 'Leave Rejected',
        description: 'Leave request has been rejected',
      });

      await fetchAllLeaveRequests();
    } catch (error) {
      console.error('Error rejecting leave request:', error);
      toast({
        title: 'Error',
        description: 'Failed to reject leave request',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const filteredRequests = leaveRequests.filter((r) => {
    if (activeTab === 'all') return true;
    return r.status === activeTab;
  });

  const pendingCount = leaveRequests.filter((r) => r.status === 'pending').length;
  const approvedCount = leaveRequests.filter((r) => r.status === 'approved').length;
  const rejectedCount = leaveRequests.filter((r) => r.status === 'rejected').length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
          Leave Requests
        </h1>
        <p className="text-muted-foreground mt-1">
          Review and manage student leave requests
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-3xl font-bold text-foreground">{leaveRequests.length}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <FileText className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-3xl font-bold text-amber-600">{pendingCount}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Approved</p>
                <p className="text-3xl font-bold text-emerald-600">{approvedCount}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Rejected</p>
                <p className="text-3xl font-bold text-rose-600">{rejectedCount}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center">
                <XCircle className="w-6 h-6 text-rose-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="w-4 h-4" />
            Pending ({pendingCount})
          </TabsTrigger>
          <TabsTrigger value="approved" className="gap-2">
            <CheckCircle className="w-4 h-4" />
            Approved ({approvedCount})
          </TabsTrigger>
          <TabsTrigger value="rejected" className="gap-2">
            <XCircle className="w-4 h-4" />
            Rejected ({rejectedCount})
          </TabsTrigger>
          <TabsTrigger value="all" className="gap-2">
            <FileText className="w-4 h-4" />
            All ({leaveRequests.length})
          </TabsTrigger>
        </TabsList>

        <Card className="border shadow-card">
          <CardContent className="p-0">
            <div className="rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Student</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Requested Date</TableHead>
                    <TableHead>Status</TableHead>
                    {activeTab === 'pending' && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                        Loading leave requests...
                      </TableCell>
                    </TableRow>
                  ) : filteredRequests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        <div className="flex flex-col items-center gap-2">
                          <CalendarCheck className="w-10 h-10 text-muted-foreground/40" />
                          <p>No {activeTab !== 'all' ? activeTab : ''} leave requests</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRequests.map((request, index) => (
                      <TableRow
                        key={request.id}
                        className="animate-fade-in"
                        style={{ animationDelay: `${index * 40}ms` }}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="w-8 h-8">
                              <AvatarFallback className="bg-primary/10 text-primary text-sm">
                                {(request as any).student_name?.charAt(0) || '?'}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium text-sm">{(request as any).student_name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm max-w-[300px] truncate">{request.reason}</p>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm">
                            {request.requested_date
                              ? new Date(request.requested_date).toLocaleDateString('en-IN', {
                                  weekday: 'short',
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                })
                              : '-'}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`gap-1 ${getStatusColor(request.status)}`}>
                            {getStatusIcon(request.status)}
                            {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                          </Badge>
                        </TableCell>
                        {activeTab === 'pending' && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20"
                                onClick={() => handleApprove(request.id, request.student_id, request.requested_date)}
                                disabled={actionLoading === request.id}
                              >
                                {actionLoading === request.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <>
                                    <CheckCircle className="w-4 h-4 mr-1" />
                                    Approve
                                  </>
                                )}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="bg-rose-500/10 text-rose-600 border-rose-500/20 hover:bg-rose-500/20"
                                onClick={() => handleReject(request.id)}
                                disabled={actionLoading === request.id}
                              >
                                {actionLoading === request.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <>
                                    <XCircle className="w-4 h-4 mr-1" />
                                    Reject
                                  </>
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </Tabs>

      {/* Info */}
      <Card className="border shadow-card bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 text-primary" />
            <p className="text-sm text-foreground">
              <strong>Note:</strong> Approving a leave request automatically marks the student as absent (on leave)
              in the attendance records for the requested date.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Student View ───────────────────────────────────────────
function StudentLeaveRequestView() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reason, setReason] = useState('');
  const [leaveDate, setLeaveDate] = useState('');

  useEffect(() => {
    if (user?.id) {
      fetchLeaveRequests();
    }
  }, [user?.id]);

  const fetchLeaveRequests = async () => {
    try {
      setIsLoading(true);
      if (!user?.id) return;
      const { data, error } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('student_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLeaveRequests(data || []);
    } catch (error) {
      console.error('Error fetching leave requests:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch leave requests',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitRequest = async () => {
    try {
      if (!reason.trim()) {
        toast({
          title: 'Error',
          description: 'Please provide a reason for leave',
          variant: 'destructive',
        });
        return;
      }

      if (!user?.id || !user?.organizationId) {
        throw new Error('Missing user or organization ID');
      }

      setIsSubmitting(true);

      const { error } = await supabase
        .from('leave_requests')
        .insert({
          organization_id: user.organizationId,
          student_id: user.id,
          reason,
          status: 'pending',
          requested_date: leaveDate || new Date().toISOString().split('T')[0],
        } as any);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Leave request submitted successfully',
      });

      setReason('');
      setLeaveDate('');
      setIsDialogOpen(false);
      await fetchLeaveRequests();
    } catch (error) {
      console.error('Error submitting leave request:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit leave request',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
            Leave Requests
          </h1>
          <p className="text-muted-foreground mt-1">
            Request leave from your classes
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground">
              <Plus className="w-4 h-4 mr-2" />
              New Request
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Submit Leave Request</DialogTitle>
              <DialogDescription>
                Request leave from your classes. Your request will be reviewed by faculty.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Date of Leave</label>
                <input
                  type="date"
                  className="w-full p-2 rounded-lg border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  value={leaveDate}
                  onChange={(e) => setLeaveDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Reason for Leave</label>
                <textarea
                  className="w-full p-2 rounded-lg border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  rows={4}
                  placeholder="Enter your reason for leave..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  className="flex-1"
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmitRequest}
                  className="flex-1 bg-primary text-primary-foreground"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Submit Request
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Leave Requests Table */}
      <Card className="border shadow-card">
        <CardHeader>
          <CardTitle>Your Leave Requests</CardTitle>
          <CardDescription>History of all your leave requests</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Reason</TableHead>
                  <TableHead>Requested Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                      Loading leave requests...
                    </TableCell>
                  </TableRow>
                ) : leaveRequests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <CalendarCheck className="w-10 h-10 text-muted-foreground/40" />
                        <p>No leave requests yet. Click "New Request" to submit one.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  leaveRequests.map((request, index) => (
                    <TableRow
                      key={request.id}
                      className="animate-fade-in"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <TableCell>
                        <p className="font-medium text-sm">{request.reason}</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">
                          {request.requested_date
                            ? new Date(request.requested_date).toLocaleDateString('en-IN', {
                                weekday: 'short',
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })
                            : '-'}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`gap-1 ${getStatusColor(request.status)}`}>
                          {getStatusIcon(request.status)}
                          {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="border shadow-card bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 text-primary" />
            <p className="text-sm text-foreground">
              <strong>Note:</strong> Leave requests are reviewed by your faculty and can take up to 24 hours to be processed.
              Approved leave will be automatically reflected in your attendance records.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────
export default function LeaveRequestPage() {
  const { user } = useAuth();

  if (user?.role === 'student') {
    return <StudentLeaveRequestView />;
  }

  return <AdminLeaveRequestView />;
}
