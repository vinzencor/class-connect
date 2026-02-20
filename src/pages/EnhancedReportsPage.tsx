import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { branchService, Branch } from '@/services/branchService';
import { reportService, AttendanceReportData, FeeCollectionReport, BranchWiseSummary, StudentFeeStatement } from '@/services/reportService';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  BarChart3,
  Download,
  TrendingUp,
  UserCheck,
  UserX,
  CalendarDays,
  Filter,
  FileText,
  Building2,
  IndianRupee,
  Users,
  Wallet,
} from 'lucide-react';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function EnhancedReportsPage() {
  const { user } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);

  // Attendance Report State
  const [attendanceData, setAttendanceData] = useState<AttendanceReportData[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [students, setStudents] = useState<Array<{ id: string; name: string }>>([]);

  // Fee Report State
  const [feeData, setFeeData] = useState<FeeCollectionReport[]>([]);
  const [branchSummary, setBranchSummary] = useState<BranchWiseSummary[]>([]);

  // Student Fee Statement Dialog
  const [showFeeStatement, setShowFeeStatement] = useState(false);
  const [feeStatement, setFeeStatement] = useState<StudentFeeStatement | null>(null);

  useEffect(() => {
    if (user?.organizationId) {
      loadBranches();
      loadCurrentBranch();
    }
  }, [user?.organizationId]);

  const loadBranches = async () => {
    try {
      const data = await branchService.getBranches(user!.organizationId!);
      setBranches(data);
    } catch (error: any) {
      console.error('Failed to load branches:', error);
    }
  };

  const loadCurrentBranch = async () => {
    try {
      const branchId = await branchService.getUserCurrentBranch(user!.id, user!.organizationId!);
      setSelectedBranch(branchId);
    } catch (error: any) {
      console.error('Failed to load current branch:', error);
    }
  };

  const loadAttendanceReport = async () => {
    if (!user?.organizationId) return;
    setLoading(true);
    try {
      const data = await reportService.getAttendanceReport(
        user.organizationId,
        selectedBranch,
        startDate || undefined,
        endDate || undefined
      );
      setAttendanceData(data);

      // Load students for filter
      const studentList = await reportService.getStudents(user.organizationId, selectedBranch);
      setStudents(studentList);
    } catch (error: any) {
      toast.error('Failed to load attendance report: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadFeeReport = async () => {
    if (!user?.organizationId) return;
    setLoading(true);
    try {
      const data = await reportService.getFeeCollectionReport(
        user.organizationId,
        selectedBranch,
        startDate || undefined,
        endDate || undefined
      );
      setFeeData(data);

      // Load branch-wise summary if viewing all branches
      if (!selectedBranch) {
        const summary = await reportService.getBranchWiseSummary(
          user.organizationId,
          startDate || undefined,
          endDate || undefined
        );
        setBranchSummary(summary);
      }
    } catch (error: any) {
      toast.error('Failed to load fee report: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const viewStudentFeeStatement = async (studentId: string) => {
    if (!user?.organizationId) return;
    try {
      const statement = await reportService.getStudentFeeStatement(user.organizationId, studentId);
      setFeeStatement(statement);
      setShowFeeStatement(true);
    } catch (error: any) {
      toast.error('Failed to load fee statement: ' + error.message);
    }
  };

  const filteredAttendance = selectedStudent
    ? attendanceData.filter(a => a.student_id === selectedStudent)
    : attendanceData;

  const attendanceStats = {
    total: filteredAttendance.length,
    present: filteredAttendance.filter(a => a.status === 'present').length,
    absent: filteredAttendance.filter(a => a.status === 'absent').length,
    late: filteredAttendance.filter(a => a.status === 'late').length,
  };
  attendanceStats.percentage = attendanceStats.total > 0
    ? Math.round((attendanceStats.present / attendanceStats.total) * 100)
    : 0;

  const feeStats = {
    totalCollected: feeData.reduce((sum, f) => sum + f.amount_paid, 0),
    totalPending: feeData.reduce((sum, f) => sum + f.balance, 0),
    totalStudents: new Set(feeData.map(f => f.student_id)).size,
  };

  return (
    <div className="space-y-6 p-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Enhanced Reports</h1>
        <p className="text-muted-foreground mt-1">
          Comprehensive reports with branch filtering and date ranges
        </p>
      </div>

      {/* Global Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Report Filters</CardTitle>
          <CardDescription>Select branch and date range for all reports</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Branch Filter */}
            <div className="space-y-2">
              <Label>Branch</Label>
              <Select value={selectedBranch || 'all'} onValueChange={(val) => setSelectedBranch(val === 'all' ? null : val)}>
                <SelectTrigger>
                  <Building2 className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {branches.map(branch => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name} ({branch.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Start Date */}
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            {/* End Date */}
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            {/* Clear Filters */}
            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                  setSelectedStudent('');
                }}
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="attendance" className="space-y-6">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="attendance" className="gap-2">
            <CalendarDays className="w-4 h-4" />
            Attendance Report
          </TabsTrigger>
          <TabsTrigger value="fees" className="gap-2">
            <IndianRupee className="w-4 h-4" />
            Fee Collection
          </TabsTrigger>
          {!selectedBranch && (
            <TabsTrigger value="branch-summary" className="gap-2">
              <Building2 className="w-4 h-4" />
              Branch Summary
            </TabsTrigger>
          )}
        </TabsList>

        {/* ATTENDANCE REPORT TAB */}
        <TabsContent value="attendance" className="space-y-6">
          <div className="flex justify-between items-center">
            <Button onClick={loadAttendanceReport} disabled={loading}>
              <Filter className="w-4 h-4 mr-2" />
              {loading ? 'Loading...' : 'Load Report'}
            </Button>
          </div>

          {/* Attendance Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Classes</p>
                    <p className="text-2xl font-bold text-primary">{attendanceStats.total}</p>
                  </div>
                  <CalendarDays className="w-8 h-8 text-primary opacity-50" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Present</p>
                    <p className="text-2xl font-bold text-emerald-600">{attendanceStats.present}</p>
                  </div>
                  <UserCheck className="w-8 h-8 text-emerald-600 opacity-50" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Absent</p>
                    <p className="text-2xl font-bold text-rose-600">{attendanceStats.absent}</p>
                  </div>
                  <UserX className="w-8 h-8 text-rose-600 opacity-50" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Attendance %</p>
                    <p className="text-2xl font-bold text-violet-600">{attendanceStats.percentage}%</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-violet-600 opacity-50" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Attendance Table */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Attendance Records</CardTitle>
                  <CardDescription>{filteredAttendance.length} records found</CardDescription>
                </div>
                <Select value={selectedStudent || 'all-students'} onValueChange={(val) => setSelectedStudent(val === 'all-students' ? '' : val)}>
                  <SelectTrigger className="w-64">
                    <Users className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="All Students" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-students">All Students</SelectItem>
                    {students.map(student => (
                      <SelectItem key={student.id} value={student.id}>
                        {student.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Date</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Status</TableHead>
                      {!selectedBranch && <TableHead>Branch</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAttendance.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={selectedBranch ? 4 : 5} className="h-32 text-center text-muted-foreground">
                          No attendance records found. Click "Load Report" to fetch data.
                        </TableCell>
                      </TableRow>
                    )}
                    {filteredAttendance.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(record.date)}</TableCell>
                        <TableCell className="font-medium">{record.student_name}</TableCell>
                        <TableCell>{record.class_name}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              record.status === 'present'
                                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                : record.status === 'late'
                                ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                                : 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                            }
                          >
                            {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                          </Badge>
                        </TableCell>
                        {!selectedBranch && (
                          <TableCell>
                            <Badge variant="secondary">{record.branch_name || 'N/A'}</Badge>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* FEE COLLECTION TAB */}
        <TabsContent value="fees" className="space-y-6">
          <div className="flex justify-between items-center">
            <Button onClick={loadFeeReport} disabled={loading}>
              <Filter className="w-4 h-4 mr-2" />
              {loading ? 'Loading...' : 'Load Report'}
            </Button>
          </div>

          {/* Fee Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Collected</p>
                    <p className="text-2xl font-bold text-emerald-600">{formatCurrency(feeStats.totalCollected)}</p>
                  </div>
                  <Wallet className="w-8 h-8 text-emerald-600 opacity-50" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Pending</p>
                    <p className="text-2xl font-bold text-rose-600">{formatCurrency(feeStats.totalPending)}</p>
                  </div>
                  <IndianRupee className="w-8 h-8 text-rose-600 opacity-50" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Students</p>
                    <p className="text-2xl font-bold text-primary">{feeStats.totalStudents}</p>
                  </div>
                  <Users className="w-8 h-8 text-primary opacity-50" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Fee Collection Table */}
          <Card>
            <CardHeader>
              <CardTitle>Fee Collection Records</CardTitle>
              <CardDescription>{feeData.length} payment records found</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Student</TableHead>
                      <TableHead className="text-right">Total Amount</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Payment Method</TableHead>
                      {!selectedBranch && <TableHead>Branch</TableHead>}
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {feeData.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={selectedBranch ? 7 : 8} className="h-32 text-center text-muted-foreground">
                          No fee records found. Click "Load Report" to fetch data.
                        </TableCell>
                      </TableRow>
                    )}
                    {feeData.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">{record.student_name}</TableCell>
                        <TableCell className="text-right">{formatCurrency(record.total_amount)}</TableCell>
                        <TableCell className="text-right text-emerald-600 font-semibold">
                          {formatCurrency(record.amount_paid)}
                        </TableCell>
                        <TableCell className="text-right text-rose-600 font-semibold">
                          {formatCurrency(record.balance)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              record.status === 'completed'
                                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                : record.status === 'partial'
                                ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                                : 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                            }
                          >
                            {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell>{record.payment_method || 'N/A'}</TableCell>
                        {!selectedBranch && (
                          <TableCell>
                            <Badge variant="secondary">{record.branch_name || 'N/A'}</Badge>
                          </TableCell>
                        )}
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => viewStudentFeeStatement(record.student_id)}
                          >
                            <FileText className="w-4 h-4 mr-1" />
                            Statement
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* BRANCH SUMMARY TAB (only when viewing all branches) */}
        {!selectedBranch && (
          <TabsContent value="branch-summary" className="space-y-6">
            <div className="flex justify-between items-center">
              <Button onClick={loadFeeReport} disabled={loading}>
                <Filter className="w-4 h-4 mr-2" />
                {loading ? 'Loading...' : 'Load Summary'}
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Branch-Wise Summary</CardTitle>
                <CardDescription>Consolidated report across all branches</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Branch</TableHead>
                        <TableHead className="text-right">Students</TableHead>
                        <TableHead className="text-right">Fee Collected</TableHead>
                        <TableHead className="text-right">Pending</TableHead>
                        <TableHead className="text-right">Attendance %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {branchSummary.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                            No branch summary available. Click "Load Summary" to fetch data.
                          </TableCell>
                        </TableRow>
                      )}
                      {branchSummary.map((branch) => (
                        <TableRow key={branch.branch_id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-muted-foreground" />
                              {branch.branch_name}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{branch.total_students}</TableCell>
                          <TableCell className="text-right text-emerald-600 font-semibold">
                            {formatCurrency(branch.total_fee_collected)}
                          </TableCell>
                          <TableCell className="text-right text-rose-600 font-semibold">
                            {formatCurrency(branch.total_pending)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary">{branch.attendance_percentage}%</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                      {branchSummary.length > 0 && (
                        <TableRow className="bg-muted/30 font-bold">
                          <TableCell>Total</TableCell>
                          <TableCell className="text-right">
                            {branchSummary.reduce((sum, b) => sum + b.total_students, 0)}
                          </TableCell>
                          <TableCell className="text-right text-emerald-600">
                            {formatCurrency(branchSummary.reduce((sum, b) => sum + b.total_fee_collected, 0))}
                          </TableCell>
                          <TableCell className="text-right text-rose-600">
                            {formatCurrency(branchSummary.reduce((sum, b) => sum + b.total_pending, 0))}
                          </TableCell>
                          <TableCell className="text-right">
                            {Math.round(
                              branchSummary.reduce((sum, b) => sum + b.attendance_percentage, 0) / branchSummary.length
                            )}%
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Student Fee Statement Dialog */}
      <Dialog open={showFeeStatement} onOpenChange={setShowFeeStatement}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Student Fee Statement</DialogTitle>
            <DialogDescription>Bank statement format showing payment history</DialogDescription>
          </DialogHeader>
          {feeStatement && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Student Name</p>
                  <p className="font-semibold">{feeStatement.student_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Fee</p>
                  <p className="font-semibold">{formatCurrency(feeStatement.total_fee)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Paid</p>
                  <p className="font-semibold text-emerald-600">{formatCurrency(feeStatement.total_paid)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Balance Pending</p>
                  <p className="font-semibold text-rose-600">{formatCurrency(feeStatement.balance_pending)}</p>
                </div>
              </div>

              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Amount Paid</TableHead>
                      <TableHead>Payment Method</TableHead>
                      <TableHead className="text-right">Running Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {feeStatement.payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(payment.date)}</TableCell>
                        <TableCell className="text-right text-emerald-600 font-semibold">
                          {formatCurrency(payment.amount)}
                        </TableCell>
                        <TableCell>{payment.payment_method || 'N/A'}</TableCell>
                        <TableCell className="text-right font-bold">{formatCurrency(payment.running_balance)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

