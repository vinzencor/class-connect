import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Search,
  GraduationCap,
  Users,
  BookOpen,
  Plus,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Hash,
  Calendar,
  CheckCircle,
  IndianRupee,
  TrendingDown,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useBranch } from '@/contexts/BranchContext';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import * as admissionService from '@/services/admissionService';
import type { StudentAdmission, StudentEnrollment } from '@/services/admissionService';

const statusStyles: Record<string, string> = {
  active:    'bg-emerald-500/10 text-emerald-700 border-emerald-500/30',
  completed: 'bg-blue-500/10 text-blue-700 border-blue-500/30',
  dropped:   'bg-rose-500/10 text-rose-700 border-rose-500/30',
  on_hold:   'bg-amber-500/10 text-amber-700 border-amber-500/30',
};

const payStatusStyles: Record<string, string> = {
  completed: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30',
  partial:   'bg-amber-500/10 text-amber-700 border-amber-500/30',
  pending:   'bg-rose-500/10 text-rose-700 border-rose-500/30',
};

function fmt(n: number) {
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;
}

// ─────────────────────────────────────────────────────────────────────────────

export default function AdmissionsPage() {
  const { user } = useAuth();
  const { currentBranchId, branchVersion } = useBranch();

  const [students, setStudents]           = useState<StudentAdmission[]>([]);
  const [loading, setLoading]             = useState(true);
  const [searchQuery, setSearchQuery]     = useState('');
  const [expanded, setExpanded]           = useState<Set<string>>(new Set());
  const [courses, setCourses]             = useState<{ id: string; name: string; fee: number }[]>([]);

  // ── Enroll Dialog ──
  const [enrollDialog, setEnrollDialog] = useState({
    open: false,
    studentId: '',
    studentName: '',
    courseId: '',
    totalFee: '',
    discount: '',
    initialPayment: '',
    dueDate: '',
    payMode: 'Cash',
  });

  // ── Pay Dialog (record a payment for an existing enrollment) ──
  const [payDialog, setPayDialog] = useState({
    open: false,
    enrollmentId: '',
    paymentId: '',
    courseName: '',
    studentName: '',
    remaining: 0,
    amount: '',
    payMode: 'Cash',
    date: new Date().toISOString().split('T')[0],
  });

  // ─────────────────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!user?.organizationId) return;
    setLoading(true);
    try {
      const [studentsData, coursesData] = await Promise.all([
        admissionService.fetchAllStudents(user.organizationId, currentBranchId),
        admissionService.fetchCourses(user.organizationId, currentBranchId),
      ]);
      setStudents(studentsData);
      setCourses(coursesData);
    } catch (err) {
      console.error('Error loading admissions:', err);
      toast.error('Failed to load admissions data');
    } finally {
      setLoading(false);
    }
  }, [user?.organizationId, currentBranchId]);

  useEffect(() => { loadData(); }, [loadData, branchVersion]);

  // ─────────────────────────────────────────────────────────────────────────

  const filteredStudents = useMemo(
    () =>
      students.filter(
        (s) =>
          s.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (s.student_number || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (s.phone || '').includes(searchQuery)
      ),
    [students, searchQuery]
  );

  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  // ── Open enroll dialog, pre-fill fee from selected course ──
  const openEnrollDialog = (student: StudentAdmission) => {
    setEnrollDialog({
      open: true,
      studentId: student.id,
      studentName: student.full_name,
      courseId: '',
      totalFee: '',
      discount: '',
      initialPayment: '',
      dueDate: '',
      payMode: 'Cash',
    });
  };

  const handleCourseChange = (courseId: string) => {
    const fee = courses.find((c) => c.id === courseId)?.fee ?? 0;
    setEnrollDialog((prev) => ({
      ...prev,
      courseId,
      totalFee: fee > 0 ? String(fee) : prev.totalFee,
    }));
  };

  const handleEnroll = async () => {
    const { studentId, studentName, courseId, totalFee, discount, initialPayment, dueDate, payMode } = enrollDialog;
    if (!user?.organizationId || !studentId || !courseId || !totalFee) {
      toast.error('Please fill course and fee amount');
      return;
    }
    try {
      await admissionService.addCourseEnrollment(
        user.organizationId,
        studentId,
        studentName,
        {
          courseId,
          totalFee: parseFloat(totalFee) || 0,
          discountAmount: parseFloat(discount) || 0,
          initialPayment: parseFloat(initialPayment) || 0,
          dueDate: dueDate || null,
          paymentMode: payMode,
        },
        currentBranchId
      );
      toast.success('Student enrolled successfully');
      setEnrollDialog((p) => ({ ...p, open: false }));
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Enrollment failed');
    }
  };

  // ── Open pay dialog ──
  const openPayDialog = (enrollment: StudentEnrollment, studentName: string) => {
    setPayDialog({
      open: true,
      enrollmentId: enrollment.id,
      paymentId: enrollment.payment_id || '',
      courseName: enrollment.course_name,
      studentName,
      remaining: enrollment.remaining ?? 0,
      amount: '',
      payMode: 'Cash',
      date: new Date().toISOString().split('T')[0],
    });
  };

  const handleRecordPayment = async () => {
    const { paymentId, amount, payMode, date, studentName, courseName, remaining } = payDialog;
    const amtNum = parseFloat(amount) || 0;
    if (!paymentId || amtNum <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    if (amtNum > remaining) {
      toast.error(`Amount exceeds remaining balance of ${fmt(remaining)}`);
      return;
    }
    try {
      // Insert fee_payment
      const { error: fpErr } = await supabase.from('fee_payments').insert({
        payment_id: paymentId,
        organization_id: user?.organizationId,
        amount: amtNum,
        date,
        mode: payMode,
      });
      if (fpErr) throw fpErr;

      // Re-fetch the real sum of fee_payments for this payment to avoid stale state
      const { data: fpRows } = await supabase
        .from('fee_payments')
        .select('amount')
        .eq('payment_id', paymentId);
      const newPaid = (fpRows || []).reduce((s: number, r: any) => s + Number(r.amount), 0);

      // Fetch current final amount from payments table
      const { data: payRow } = await supabase
        .from('payments')
        .select('amount')
        .eq('id', paymentId)
        .single();
      const finalAmt = payRow ? Number(payRow.amount) : remaining + amtNum;
      const newStatus = newPaid >= finalAmt ? 'completed' : 'partial';

      await supabase.from('payments')
        .update({ amount_paid: newPaid, status: newStatus })
        .eq('id', paymentId);

      // Also record as income transaction
      await supabase.from('transactions').insert({
        organization_id: user?.organizationId,
        branch_id: currentBranchId || null,
        type: 'income',
        description: `Fee Payment: ${courseName} — ${studentName}`,
        amount: amtNum,
        category: 'Course Fee',
        date: new Date(date).toISOString(),
        mode: payMode,
        recurrence: 'one-time',
        paused: false,
      });

      toast.success('Payment recorded');
      setPayDialog((p) => ({ ...p, open: false }));
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to record payment');
    }
  };

  const handleStatusChange = async (enrollmentId: string, status: string) => {
    try {
      await admissionService.updateEnrollmentStatus(enrollmentId, status as any);
      toast.success('Status updated');
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Stats
  // ─────────────────────────────────────────────────────────────────────────

  const totalStudents     = students.length;
  const totalEnrollments  = students.reduce((s, x) => s + (x.enrollments?.length || 0), 0);
  const activeEnrollments = students.reduce((s, x) => s + (x.enrollments?.filter((e) => e.status === 'active').length || 0), 0);
  const totalOutstanding  = students.reduce(
    (s, x) => s + (x.enrollments?.reduce((a, e) => a + (e.remaining || 0), 0) || 0),
    0
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
          Admission Management
        </h1>
        <p className="text-muted-foreground mt-1">
          Track enrolled students, course registrations, and fee balances
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: <Users className="w-5 h-5 text-blue-600" />, label: 'Total Students',     value: totalStudents,    color: 'bg-blue-500/10' },
          { icon: <BookOpen className="w-5 h-5 text-violet-600" />, label: 'Total Enrollments', value: totalEnrollments, color: 'bg-violet-500/10' },
          { icon: <CheckCircle className="w-5 h-5 text-emerald-600" />, label: 'Active Courses',    value: activeEnrollments, color: 'bg-emerald-500/10' },
          { icon: <TrendingDown className="w-5 h-5 text-amber-600" />, label: 'Outstanding Fees',   value: fmt(totalOutstanding), color: 'bg-amber-500/10' },
        ].map((stat) => (
          <Card key={stat.label} className="border shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold text-foreground mt-0.5">{stat.value}</p>
                </div>
                <div className={`w-10 h-10 rounded-xl ${stat.color} flex items-center justify-center`}>
                  {stat.icon}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search students…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Student List */}
      {loading ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground">Loading…</div>
      ) : filteredStudents.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
          <GraduationCap className="w-12 h-12 opacity-30" />
          <p>No students found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredStudents.map((student) => {
            const isExpanded = expanded.has(student.id);
            const totalPaid = (student.enrollments || []).reduce((s, e) => s + (e.amount_paid || 0), 0);
            const totalRem  = (student.enrollments || []).reduce((s, e) => s + (e.remaining || 0), 0);

            return (
              <Card key={student.id} className="border shadow-sm overflow-hidden">
                {/* Student Header Row */}
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/40 transition-colors"
                  onClick={() => toggleExpand(student.id)}
                >
                  <button className="text-muted-foreground shrink-0">
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>

                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 font-semibold text-primary text-sm">
                    {(student.full_name || '?').charAt(0).toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground">{student.full_name}</span>
                      {student.student_number && (
                        <Badge variant="outline" className="text-xs font-mono text-violet-700 border-violet-300 bg-violet-50">
                          <Hash className="w-3 h-3 mr-1" />{student.student_number}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{student.email}</p>
                  </div>

                  {/* Summary */}
                  <div className="hidden sm:flex items-center gap-6 text-sm shrink-0">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Courses</p>
                      <p className="font-semibold">{student.enrollments?.length || 0}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Paid</p>
                      <p className="font-semibold text-emerald-600">{fmt(totalPaid)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Outstanding</p>
                      <p className={`font-semibold ${totalRem > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{fmt(totalRem)}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs h-8"
                      onClick={(e) => { e.stopPropagation(); openEnrollDialog(student); }}
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Course
                    </Button>
                  </div>

                  {/* Mobile add button */}
                  <Button
                    size="sm"
                    variant="outline"
                    className="sm:hidden gap-1 text-xs h-8 shrink-0"
                    onClick={(e) => { e.stopPropagation(); openEnrollDialog(student); }}
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>

                {/* Enrollment Detail */}
                {isExpanded && (
                  <div className="border-t bg-muted/20">
                    {(!student.enrollments || student.enrollments.length === 0) ? (
                      <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                        <AlertCircle className="w-4 h-4" />
                        No course enrollments yet. Click <strong className="text-foreground">Add Course</strong> to enroll.
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead>Enrollment ID</TableHead>
                            <TableHead>Course</TableHead>
                            <TableHead className="text-right">Total Fee</TableHead>
                            <TableHead className="text-right">Discount</TableHead>
                            <TableHead className="text-right">Paid</TableHead>
                            <TableHead className="text-right">Remaining</TableHead>
                            <TableHead>Due Date</TableHead>
                            <TableHead>Payment</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {student.enrollments!.map((enroll) => (
                            <TableRow key={enroll.id}>
                              <TableCell>
                                <span className="font-mono text-xs text-indigo-600 font-semibold">
                                  {enroll.enrollment_number}
                                </span>
                              </TableCell>
                              <TableCell className="font-medium">{enroll.course_name}</TableCell>
                              <TableCell className="text-right">{fmt(enroll.total_fee ?? enroll.course_fee)}</TableCell>
                              <TableCell className="text-right text-emerald-600">
                                {(enroll.discount_amount ?? 0) > 0 ? `-${fmt(enroll.discount_amount!)}` : '—'}
                              </TableCell>
                              <TableCell className="text-right font-semibold text-emerald-600">
                                {fmt(enroll.amount_paid ?? 0)}
                              </TableCell>
                              <TableCell className={`text-right font-semibold ${(enroll.remaining ?? 0) > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                {fmt(enroll.remaining ?? 0)}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {enroll.due_date ? (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {new Date(enroll.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                                  </span>
                                ) : '—'}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={`text-xs capitalize ${payStatusStyles[enroll.payment_status || 'pending'] || payStatusStyles.pending}`}
                                >
                                  {enroll.payment_status === 'completed' ? 'Paid' : enroll.payment_status === 'partial' ? 'Partial' : 'Pending'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={enroll.status}
                                  onValueChange={(v) => handleStatusChange(enroll.id, v)}
                                >
                                  <SelectTrigger className={`h-7 text-xs w-28 border ${statusStyles[enroll.status] || ''}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="completed">Completed</SelectItem>
                                    <SelectItem value="on_hold">On Hold</SelectItem>
                                    <SelectItem value="dropped">Dropped</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell className="text-right">
                                {(enroll.remaining ?? 0) > 0 && enroll.payment_id && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs gap-1 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                                    onClick={() => openPayDialog(enroll, student.full_name)}
                                  >
                                    <IndianRupee className="w-3 h-3" /> Pay
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Enroll Dialog ── */}
      <Dialog open={enrollDialog.open} onOpenChange={(o) => setEnrollDialog((p) => ({ ...p, open: o }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              Add Course — <span className="text-primary">{enrollDialog.studentName}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Course */}
            <div className="space-y-1.5">
              <Label>Course *</Label>
              <Select value={enrollDialog.courseId} onValueChange={handleCourseChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select course…" />
                </SelectTrigger>
                <SelectContent>
                  {courses.length === 0 ? (
                    <SelectItem value="__none__" disabled>No courses available</SelectItem>
                  ) : (
                    courses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}{c.fee > 0 ? ` — ₹${c.fee.toLocaleString('en-IN')}` : ''}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Fee row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Total Fee (₹) *</Label>
                <Input
                  type="number"
                  placeholder="e.g. 25000"
                  value={enrollDialog.totalFee}
                  onChange={(e) => setEnrollDialog((p) => ({ ...p, totalFee: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Discount (₹)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={enrollDialog.discount}
                  onChange={(e) => setEnrollDialog((p) => ({ ...p, discount: e.target.value }))}
                />
              </div>
            </div>

            {/* Amount due preview */}
            {enrollDialog.totalFee && (
              <p className="text-sm text-muted-foreground">
                Final amount:{' '}
                <span className="font-semibold text-foreground">
                  {fmt(Math.max((parseFloat(enrollDialog.totalFee) || 0) - (parseFloat(enrollDialog.discount) || 0), 0))}
                </span>
              </p>
            )}

            {/* Initial payment */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Initial Payment (₹)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={enrollDialog.initialPayment}
                  onChange={(e) => setEnrollDialog((p) => ({ ...p, initialPayment: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Payment Mode</Label>
                <Select
                  value={enrollDialog.payMode}
                  onValueChange={(v) => setEnrollDialog((p) => ({ ...p, payMode: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['Cash', 'UPI', 'NEFT', 'IMPS', 'Cheque', 'Card'].map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Due date */}
            <div className="space-y-1.5">
              <Label>Due Date</Label>
              <Input
                type="date"
                value={enrollDialog.dueDate}
                onChange={(e) => setEnrollDialog((p) => ({ ...p, dueDate: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEnrollDialog((p) => ({ ...p, open: false }))}>
              Cancel
            </Button>
            <Button
              onClick={handleEnroll}
              disabled={!enrollDialog.courseId || !enrollDialog.totalFee}
            >
              <GraduationCap className="w-4 h-4 mr-2" /> Enroll Student
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Record Payment Dialog ── */}
      <Dialog open={payDialog.open} onOpenChange={(o) => setPayDialog((p) => ({ ...p, open: o }))}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-600" />
              Record Payment
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
              <p><span className="text-muted-foreground">Student:</span> <span className="font-medium">{payDialog.studentName}</span></p>
              <p><span className="text-muted-foreground">Course:</span> <span className="font-medium">{payDialog.courseName}</span></p>
              <p><span className="text-muted-foreground">Remaining:</span> <span className="font-semibold text-amber-600">{fmt(payDialog.remaining)}</span></p>
            </div>

            <div className="space-y-1.5">
              <Label>Amount (₹) *</Label>
              <Input
                type="number"
                placeholder={`Max ${fmt(payDialog.remaining)}`}
                value={payDialog.amount}
                onChange={(e) => setPayDialog((p) => ({ ...p, amount: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={payDialog.date}
                  onChange={(e) => setPayDialog((p) => ({ ...p, date: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Mode</Label>
                <Select
                  value={payDialog.payMode}
                  onValueChange={(v) => setPayDialog((p) => ({ ...p, payMode: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['Cash', 'UPI', 'NEFT', 'IMPS', 'Cheque', 'Card'].map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialog((p) => ({ ...p, open: false }))}>
              Cancel
            </Button>
            <Button
              onClick={handleRecordPayment}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={!payDialog.amount}
            >
              <IndianRupee className="w-4 h-4 mr-1" /> Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
