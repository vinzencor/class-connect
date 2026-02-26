import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useBranch } from '@/contexts/BranchContext';
import { supabase } from '@/lib/supabase';
import { branchService, Branch } from '@/services/branchService';
import { batchService } from '@/services/batchService';
import { reportService, AttendanceReportData, FeeCollectionReport, BranchWiseSummary, StudentFeeStatement, TransactionReportRow, SalesStaffReportRow } from '@/services/reportService';
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
  CreditCard,
  UserPlus,
  Layers,
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
  const { currentBranchId } = useBranch();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);

  // Attendance Report State
  const [attendanceData, setAttendanceData] = useState<AttendanceReportData[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [students, setStudents] = useState<Array<{ id: string; name: string }>>([]);
  const [attendanceBatchFilter, setAttendanceBatchFilter] = useState<string>('');
  const [attendanceBatches, setAttendanceBatches] = useState<Array<{ id: string; name: string }>>([]);
  const [studentBatchMap, setStudentBatchMap] = useState<Record<string, string>>({});

  // Fee Report State
  const [feeData, setFeeData] = useState<FeeCollectionReport[]>([]);
  const [branchSummary, setBranchSummary] = useState<BranchWiseSummary[]>([]);

  // Student Fee Statement Dialog
  const [showFeeStatement, setShowFeeStatement] = useState(false);
  const [feeStatement, setFeeStatement] = useState<StudentFeeStatement | null>(null);

  // Transaction Report State
  const [transactionData, setTransactionData] = useState<TransactionReportRow[]>([]);
  const [transactionModeFilter, setTransactionModeFilter] = useState('all');

  // Sales Staff Report State
  const [salesStaffData, setSalesStaffData] = useState<SalesStaffReportRow[]>([]);

  // Logo URL for PDF statements
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    async function loadLogo() {
      if (!currentBranchId && !user?.organizationId) return;
      if (currentBranchId) {
        const { data: branch } = await supabase.from('branches').select('logo_url').eq('id', currentBranchId).single();
        if (branch?.logo_url) { setLogoUrl(branch.logo_url); return; }
      }
      if (user?.organizationId) {
        const { data: org } = await supabase.from('organizations').select('logo_url').eq('id', user.organizationId).single();
        if (org?.logo_url) { setLogoUrl(org.logo_url); return; }
      }
    }
    loadLogo();
  }, [currentBranchId, user?.organizationId]);

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

      // Load batches for filter
      const batchesData = await batchService.getBatches(user.organizationId, selectedBranch);
      setAttendanceBatches((batchesData || []).map(b => ({ id: b.id, name: b.name })));

      // Build student → batch mapping from profiles metadata
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, metadata')
        .eq('organization_id', user.organizationId)
        .eq('role', 'student');
      const mapping: Record<string, string> = {};
      (profiles || []).forEach((p: any) => {
        const meta = typeof p.metadata === 'string' ? (() => { try { return JSON.parse(p.metadata); } catch { return null; } })() : p.metadata;
        const batchId = meta?.batch_id || meta?.batch || meta?.batchId;
        if (batchId) mapping[p.id] = String(batchId);
      });
      setStudentBatchMap(mapping);
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

  const loadTransactionReport = async () => {
    if (!user?.organizationId) return;
    setLoading(true);
    try {
      const data = await reportService.getTransactionReport(
        user.organizationId,
        selectedBranch,
        startDate || undefined,
        endDate || undefined,
        transactionModeFilter !== 'all' ? transactionModeFilter : undefined
      );
      setTransactionData(data);
    } catch (error: any) {
      toast.error('Failed to load transaction report: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadSalesStaffReport = async () => {
    if (!user?.organizationId) return;
    setLoading(true);
    try {
      const data = await reportService.getSalesStaffReport(
        user.organizationId,
        selectedBranch,
        startDate || undefined,
        endDate || undefined
      );
      setSalesStaffData(data);
    } catch (error: any) {
      toast.error('Failed to load sales staff report: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const downloadSalesStaffCSV = () => {
    if (salesStaffData.length === 0) {
      toast.error('No sales staff data to export');
      return;
    }

    const headers = [
      'Sales Staff',
      'Leads Assigned',
      'Leads Converted',
      'Lead Conversion %',
      'Students',
      'Total Fee',
      'Collected',
      'Pending',
      'Transactions',
      'Transaction Income',
      'Collection %',
    ];

    const rows = salesStaffData.map((row) => {
      const collectionPct = row.total_fee > 0 ? Math.round((row.total_collected / row.total_fee) * 100) : 0;
      return [
        row.sales_staff_name,
        row.leads_assigned,
        row.leads_converted,
        `${row.conversion_rate}%`,
        row.total_students,
        row.total_fee,
        row.total_collected,
        row.total_pending,
        row.transactions_count,
        row.transaction_income,
        `${collectionPct}%`,
      ];
    });

    const csv = [headers, ...rows]
      .map((line) => line.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sales-staff-report-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadStatementPDF = (statement: StudentFeeStatement | null) => {
    if (!statement) return;
    const progressPct = statement.total_fee > 0 ? Math.min(Math.round((statement.total_paid / statement.total_fee) * 100), 100) : 0;
    const html = `
      <!DOCTYPE html>
      <html><head><title>Fee Statement - ${statement.student_name}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', sans-serif; padding: 40px; color: #1a1a2e; background: #fff; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; border-bottom: 3px solid #6366f1; padding-bottom: 20px; }
        .header h1 { font-size: 28px; color: #6366f1; }
        .header .date { color: #666; font-size: 13px; }
        .summary-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 24px; }
        .summary-box { padding: 16px; border-radius: 8px; background: #f8f9fa; }
        .summary-box h3 { font-size: 11px; text-transform: uppercase; color: #999; margin-bottom: 6px; letter-spacing: 1px; }
        .summary-box p { font-size: 16px; font-weight: 600; }
        .paid { color: #059669; }
        .pending { color: #dc2626; }
        .total { color: #4f46e5; }
        .progress-bar { width: 100%; background: #e5e7eb; border-radius: 8px; height: 10px; margin-bottom: 24px; }
        .progress-fill { height: 10px; border-radius: 8px; background: #059669; }
        .progress-label { display: flex; justify-content: space-between; font-size: 12px; color: #666; margin-bottom: 4px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
        th { background: #6366f1; color: white; padding: 10px 12px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
        td { padding: 10px 12px; border-bottom: 1px solid #eee; font-size: 14px; }
        tr:nth-child(even) { background: #f8f9fa; }
        .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #eee; text-align: center; color: #999; font-size: 12px; }
        @media print { body { padding: 20px; } }
      </style>
      </head><body>
        <div class="header">
          <div>
            ${logoUrl ? `<img src="${logoUrl}" alt="Logo" style="max-height:60px;max-width:180px;margin-bottom:12px;" />` : ''}
            <h1>📋 FEE STATEMENT</h1>
            <p style="color: #666; margin-top: 4px;">Complete Payment History</p>
          </div>
          <div style="text-align: right;">
            <p class="date">Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
            <p style="font-weight: 600; font-size: 16px; margin-top: 4px;">${statement.student_name}</p>
            <p style="color: #666; font-size: 13px;">${statement.course_name}</p>
          </div>
        </div>

        <div class="summary-grid">
          <div class="summary-box"><h3>Total Fee</h3><p class="total">₹${statement.total_fee.toLocaleString('en-IN')}</p></div>
          <div class="summary-box"><h3>Total Paid</h3><p class="paid">₹${statement.total_paid.toLocaleString('en-IN')}</p></div>
          <div class="summary-box"><h3>Balance Remaining</h3><p class="pending">₹${statement.balance_pending.toLocaleString('en-IN')}</p></div>
          <div class="summary-box"><h3>Payments Made</h3><p>${statement.payments.length}</p></div>
          <div class="summary-box"><h3>Course</h3><p style="font-size:14px;">${statement.course_name}</p></div>
          <div class="summary-box"><h3>Status</h3><p class="${statement.balance_pending <= 0 ? 'paid' : 'pending'}">${statement.balance_pending <= 0 ? 'Fully Paid' : 'Pending'}</p></div>
        </div>

        <div class="progress-label"><span>Payment Progress</span><span>${progressPct}%</span></div>
        <div class="progress-bar"><div class="progress-fill" style="width: ${progressPct}%;"></div></div>

        <h3 style="margin-bottom: 12px; color: #333;">Payment History</h3>
        <table>
          <thead><tr><th>#</th><th>Date</th><th>Description</th><th>Amount Paid</th><th>Mode</th><th>Balance Remaining</th></tr></thead>
          <tbody>
            ${statement.payments.length === 0
        ? '<tr><td colspan="6" style="text-align:center;color:#999;">No payments recorded yet</td></tr>'
        : statement.payments.map((p, i) =>
          `<tr>
                  <td>${i + 1}</td>
                  <td>${formatDate(p.date)}</td>
                  <td>${p.description || 'Installment #' + (i + 1)}</td>
                  <td style="color:#059669;font-weight:600;">₹${p.amount.toLocaleString('en-IN')}</td>
                  <td>${p.payment_method || 'N/A'}</td>
                  <td style="font-weight:600;color:${p.running_balance <= 0 ? '#059669' : '#dc2626'};">₹${p.running_balance.toLocaleString('en-IN')}</td>
                </tr>`
        ).join('')
      }
          </tbody>
        </table>

        <div class="footer">
          <p>This is a computer-generated fee statement. Thank you for your payments.</p>
        </div>
      </body></html>
    `;
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 500);
    }
  };

  const downloadAttendanceReportPDF = () => {
    if (filteredAttendance.length === 0) {
      toast.error('No attendance data to download');
      return;
    }
    const branchName = selectedBranch ? branches.find(b => b.id === selectedBranch)?.name || '' : 'All Branches';
    const html = `
      <!DOCTYPE html>
      <html><head><title>Attendance Report</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', sans-serif; padding: 40px; color: #1a1a2e; background: #fff; }
        .header { margin-bottom: 24px; border-bottom: 3px solid #6366f1; padding-bottom: 16px; }
        .header h1 { font-size: 24px; color: #6366f1; }
        .header p { color: #666; font-size: 13px; margin-top: 4px; }
        .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
        .stat-box { padding: 12px; border-radius: 8px; background: #f8f9fa; text-align: center; }
        .stat-box .label { font-size: 11px; text-transform: uppercase; color: #999; }
        .stat-box .value { font-size: 20px; font-weight: 700; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #6366f1; color: white; padding: 8px 12px; text-align: left; font-size: 12px; }
        td { padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 13px; }
        tr:nth-child(even) { background: #f8f9fa; }
        .present { color: #059669; font-weight: 600; }
        .absent { color: #dc2626; font-weight: 600; }
        .late { color: #d97706; font-weight: 600; }
        .footer { margin-top: 24px; text-align: center; color: #999; font-size: 11px; }
        @media print { body { padding: 20px; } }
      </style>
      </head><body>
        <div class="header">
          <h1>📊 Attendance Report</h1>
          <p>Branch: ${branchName} | ${startDate || 'All dates'} ${endDate ? ' to ' + endDate : ''} | Generated: ${new Date().toLocaleDateString('en-IN')}</p>
        </div>
        <div class="stats">
          <div class="stat-box"><div class="label">Total</div><div class="value">${attendanceStats.total}</div></div>
          <div class="stat-box"><div class="label">Present</div><div class="value" style="color:#059669;">${attendanceStats.present}</div></div>
          <div class="stat-box"><div class="label">Absent</div><div class="value" style="color:#dc2626;">${attendanceStats.absent}</div></div>
          <div class="stat-box"><div class="label">Attendance %</div><div class="value" style="color:#7c3aed;">${attendanceStats.percentage}%</div></div>
        </div>
        <table>
          <thead><tr><th>Date</th><th>Student</th><th>Role</th><th>Class</th><th>Status</th>${!selectedBranch ? '<th>Branch</th>' : ''}</tr></thead>
          <tbody>
            ${filteredAttendance.map(r => `
              <tr>
                <td>${formatDate(r.date)}</td>
                <td>${r.student_name}</td>
                <td>${r.role || 'N/A'}</td>
                <td>${r.class_name}</td>
                <td class="${r.status}">${r.status.charAt(0).toUpperCase() + r.status.slice(1)}</td>
                ${!selectedBranch ? `<td>${r.branch_name || 'N/A'}</td>` : ''}
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="footer"><p>Computer-generated report</p></div>
      </body></html>
    `;
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 500);
    }
  };

  const downloadFeeReportPDF = () => {
    if (feeData.length === 0) {
      toast.error('No fee data to download');
      return;
    }
    const branchName = selectedBranch ? branches.find(b => b.id === selectedBranch)?.name || '' : 'All Branches';
    const html = `
      <!DOCTYPE html>
      <html><head><title>Fee Collection Report</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', sans-serif; padding: 40px; color: #1a1a2e; background: #fff; }
        .header { margin-bottom: 24px; border-bottom: 3px solid #059669; padding-bottom: 16px; }
        .header h1 { font-size: 24px; color: #059669; }
        .header p { color: #666; font-size: 13px; margin-top: 4px; }
        .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
        .stat-box { padding: 12px; border-radius: 8px; background: #f8f9fa; text-align: center; }
        .stat-box .label { font-size: 11px; text-transform: uppercase; color: #999; }
        .stat-box .value { font-size: 20px; font-weight: 700; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #059669; color: white; padding: 8px 12px; text-align: left; font-size: 12px; }
        td { padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 13px; }
        tr:nth-child(even) { background: #f8f9fa; }
        .footer { margin-top: 24px; text-align: center; color: #999; font-size: 11px; }
        @media print { body { padding: 20px; } }
      </style>
      </head><body>
        <div class="header">
          <h1>💰 Fee Collection Report</h1>
          <p>Branch: ${branchName} | ${startDate || 'All dates'} ${endDate ? ' to ' + endDate : ''} | Generated: ${new Date().toLocaleDateString('en-IN')}</p>
        </div>
        <div class="stats">
          <div class="stat-box"><div class="label">Total Collected</div><div class="value" style="color:#059669;">${formatCurrency(feeStats.totalCollected)}</div></div>
          <div class="stat-box"><div class="label">Total Pending</div><div class="value" style="color:#dc2626;">${formatCurrency(feeStats.totalPending)}</div></div>
          <div class="stat-box"><div class="label">Students</div><div class="value">${feeStats.totalStudents}</div></div>
        </div>
        <table>
          <thead><tr><th>Student</th><th style="text-align:right;">Total</th><th style="text-align:right;">Paid</th><th style="text-align:right;">Balance</th><th>Status</th><th>Method</th>${!selectedBranch ? '<th>Branch</th>' : ''}</tr></thead>
          <tbody>
            ${feeData.map(r => `
              <tr>
                <td>${r.student_name}</td>
                <td style="text-align:right;">${formatCurrency(r.total_amount)}</td>
                <td style="text-align:right;color:#059669;font-weight:600;">${formatCurrency(r.amount_paid)}</td>
                <td style="text-align:right;color:#dc2626;font-weight:600;">${formatCurrency(r.balance)}</td>
                <td>${r.status.charAt(0).toUpperCase() + r.status.slice(1)}</td>
                <td>${r.payment_method || 'N/A'}</td>
                ${!selectedBranch ? `<td>${r.branch_name || 'N/A'}</td>` : ''}
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="footer"><p>Computer-generated report</p></div>
      </body></html>
    `;
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 500);
    }
  };

  const filteredAttendance = attendanceData.filter(a => {
    if (selectedStudent && a.student_id !== selectedStudent) return false;
    if (attendanceBatchFilter) {
      const studentBatch = studentBatchMap[a.student_id];
      // Match by batch id or batch name
      if (!studentBatch) return false;
      const batchObj = attendanceBatches.find(b => b.id === attendanceBatchFilter);
      const matchById = studentBatch === attendanceBatchFilter;
      const matchByName = batchObj && studentBatch.toLowerCase() === batchObj.name.trim().toLowerCase();
      if (!matchById && !matchByName) return false;
    }
    return true;
  });

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
                  setAttendanceBatchFilter('');
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
          <TabsTrigger value="transactions" className="gap-2">
            <CreditCard className="w-4 h-4" />
            Transactions
          </TabsTrigger>
          <TabsTrigger value="sales-staff" className="gap-2">
            <UserPlus className="w-4 h-4" />
            Sales Staff
          </TabsTrigger>
        </TabsList>

        {/* ATTENDANCE REPORT TAB */}
        <TabsContent value="attendance" className="space-y-6">
          <div className="flex justify-between items-center gap-2">
            <Button onClick={loadAttendanceReport} disabled={loading}>
              <Filter className="w-4 h-4 mr-2" />
              {loading ? 'Loading...' : 'Load Report'}
            </Button>
            {filteredAttendance.length > 0 && (
              <Button variant="outline" onClick={downloadAttendanceReportPDF}>
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
            )}
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
                <div className="flex gap-3 flex-wrap">
                  <Select value={attendanceBatchFilter || 'all-batches'} onValueChange={(val) => setAttendanceBatchFilter(val === 'all-batches' ? '' : val)}>
                    <SelectTrigger className="w-56">
                      <Layers className="w-4 h-4 mr-2" />
                      <SelectValue placeholder="All Batches" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all-batches">All Batches</SelectItem>
                      {attendanceBatches.map(batch => (
                        <SelectItem key={batch.id} value={batch.id}>
                          {batch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={selectedStudent || 'all-students'} onValueChange={(val) => setSelectedStudent(val === 'all-students' ? '' : val)}>
                    <SelectTrigger className="w-56">
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
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Date</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Status</TableHead>
                      {!selectedBranch && <TableHead>Branch</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAttendance.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={selectedBranch ? 5 : 6} className="h-32 text-center text-muted-foreground">
                          No attendance records found. Click "Load Report" to fetch data.
                        </TableCell>
                      </TableRow>
                    )}
                    {filteredAttendance.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(record.date)}</TableCell>
                        <TableCell className="font-medium">{record.student_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">{record.role || 'N/A'}</Badge>
                        </TableCell>
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
          <div className="flex justify-between items-center gap-2">
            <Button onClick={loadFeeReport} disabled={loading}>
              <Filter className="w-4 h-4 mr-2" />
              {loading ? 'Loading...' : 'Load Report'}
            </Button>
            {feeData.length > 0 && (
              <Button variant="outline" onClick={downloadFeeReportPDF}>
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
            )}
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
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => viewStudentFeeStatement(record.student_id)}
                            >
                              <FileText className="w-4 h-4 mr-1" />
                              Statement
                            </Button>
                          </div>
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

        {/* TRANSACTION REPORT TAB */}
        <TabsContent value="transactions" className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <Select value={transactionModeFilter} onValueChange={setTransactionModeFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Payment Mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modes</SelectItem>
                <SelectItem value="Cash">Cash</SelectItem>
                <SelectItem value="UPI">UPI</SelectItem>
                <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                <SelectItem value="Card">Card</SelectItem>
                <SelectItem value="Cheque">Cheque</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={loadTransactionReport} disabled={loading}>
              <Filter className="w-4 h-4 mr-2" />
              {loading ? 'Loading...' : 'Load Report'}
            </Button>
          </div>

          {transactionData.length > 0 && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Total Income</p>
                    <p className="text-xl font-bold text-emerald-600">
                      {formatCurrency(transactionData.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0))}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Total Expense</p>
                    <p className="text-xl font-bold text-rose-600">
                      {formatCurrency(transactionData.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0))}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Net Amount</p>
                    <p className="text-xl font-bold text-primary">
                      {formatCurrency(
                        transactionData.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0) -
                        transactionData.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
                      )}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Total Transactions</p>
                    <p className="text-xl font-bold">{transactionData.length}</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardContent className="p-0">
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>Date</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Mode</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          {!selectedBranch && <TableHead>Branch</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transactionData.map(txn => (
                          <TableRow key={txn.id}>
                            <TableCell className="text-sm">{formatDate(txn.date)}</TableCell>
                            <TableCell className="text-sm max-w-[200px] truncate">{txn.description}</TableCell>
                            <TableCell><Badge variant="outline" className="text-xs">{txn.category}</Badge></TableCell>
                            <TableCell><Badge variant="secondary" className="text-xs">{txn.mode}</Badge></TableCell>
                            <TableCell>
                              <Badge className={`text-xs ${txn.type === 'income' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                {txn.type}
                              </Badge>
                            </TableCell>
                            <TableCell className={`text-right font-semibold ${txn.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {txn.type === 'income' ? '+' : '-'}{formatCurrency(txn.amount)}
                            </TableCell>
                            {!selectedBranch && <TableCell className="text-sm text-muted-foreground">{txn.branch_name || '—'}</TableCell>}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {transactionData.length === 0 && !loading && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <CreditCard className="w-12 h-12 mb-4 opacity-50" />
                <p className="text-lg font-medium">No transactions found</p>
                <p className="text-sm">Select date range and filters, then click "Load Report"</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* SALES STAFF REPORT TAB */}
        <TabsContent value="sales-staff" className="space-y-6">
          <div className="flex justify-between items-center gap-2">
            <div className="flex gap-2">
              <Button onClick={loadSalesStaffReport} disabled={loading}>
                <Filter className="w-4 h-4 mr-2" />
                {loading ? 'Loading...' : 'Load Report'}
              </Button>
              <Button variant="outline" onClick={downloadSalesStaffCSV} disabled={salesStaffData.length === 0}>
                <Download className="w-4 h-4 mr-2" />
                Download CSV
              </Button>
            </div>
          </div>

          {salesStaffData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Sales Staff Performance</CardTitle>
                <CardDescription>Revenue attribution by sales staff member</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Sales Staff</TableHead>
                        <TableHead className="text-center">Leads</TableHead>
                        <TableHead className="text-center">Converted</TableHead>
                        <TableHead className="text-right">Lead Conv %</TableHead>
                        <TableHead className="text-center">Students</TableHead>
                        <TableHead className="text-right">Total Fee</TableHead>
                        <TableHead className="text-right">Collected</TableHead>
                        <TableHead className="text-right">Pending</TableHead>
                        <TableHead className="text-center">Txns</TableHead>
                        <TableHead className="text-right">Txn Income</TableHead>
                        <TableHead className="text-right">Collection %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {salesStaffData.map(row => (
                        <TableRow key={row.sales_staff_id}>
                          <TableCell className="font-medium">{row.sales_staff_name}</TableCell>
                          <TableCell className="text-center">{row.leads_assigned}</TableCell>
                          <TableCell className="text-center">{row.leads_converted}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant={row.conversion_rate >= 40 ? 'default' : 'secondary'}>
                              {row.conversion_rate}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">{row.total_students}</TableCell>
                          <TableCell className="text-right">{formatCurrency(row.total_fee)}</TableCell>
                          <TableCell className="text-right text-emerald-600 font-semibold">{formatCurrency(row.total_collected)}</TableCell>
                          <TableCell className="text-right text-rose-600">{formatCurrency(row.total_pending)}</TableCell>
                          <TableCell className="text-center">{row.transactions_count}</TableCell>
                          <TableCell className="text-right text-primary">{formatCurrency(row.transaction_income)}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant={row.total_fee > 0 && row.total_collected / row.total_fee >= 0.8 ? 'default' : 'secondary'}>
                              {row.total_fee > 0 ? Math.round((row.total_collected / row.total_fee) * 100) : 0}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* Totals Row */}
                      <TableRow className="bg-muted/30 font-semibold">
                        <TableCell>Total</TableCell>
                        <TableCell className="text-center">{salesStaffData.reduce((s, r) => s + r.leads_assigned, 0)}</TableCell>
                        <TableCell className="text-center">{salesStaffData.reduce((s, r) => s + r.leads_converted, 0)}</TableCell>
                        <TableCell className="text-right">
                          {salesStaffData.reduce((s, r) => s + r.leads_assigned, 0) > 0
                            ? `${Math.round((salesStaffData.reduce((s, r) => s + r.leads_converted, 0) / salesStaffData.reduce((s, r) => s + r.leads_assigned, 0)) * 100)}%`
                            : '0%'}
                        </TableCell>
                        <TableCell className="text-center">{salesStaffData.reduce((s, r) => s + r.total_students, 0)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(salesStaffData.reduce((s, r) => s + r.total_fee, 0))}</TableCell>
                        <TableCell className="text-right text-emerald-600">{formatCurrency(salesStaffData.reduce((s, r) => s + r.total_collected, 0))}</TableCell>
                        <TableCell className="text-right text-rose-600">{formatCurrency(salesStaffData.reduce((s, r) => s + r.total_pending, 0))}</TableCell>
                        <TableCell className="text-center">{salesStaffData.reduce((s, r) => s + r.transactions_count, 0)}</TableCell>
                        <TableCell className="text-right text-primary">{formatCurrency(salesStaffData.reduce((s, r) => s + r.transaction_income, 0))}</TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {salesStaffData.length === 0 && !loading && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <UserPlus className="w-12 h-12 mb-4 opacity-50" />
                <p className="text-lg font-medium">No sales staff data</p>
                <p className="text-sm">Click "Load Report" to view sales staff performance</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Student Fee Statement Dialog */}
      <Dialog open={showFeeStatement} onOpenChange={setShowFeeStatement}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Student Fee Statement</DialogTitle>
            <DialogDescription>Complete payment history — bank statement format</DialogDescription>
          </DialogHeader>
          {feeStatement && (
            <div className="space-y-4">
              {/* Summary Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Student Name</p>
                  <p className="font-semibold">{feeStatement.student_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Course</p>
                  <p className="font-semibold">{feeStatement.course_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Fee</p>
                  <p className="font-semibold text-primary">{formatCurrency(feeStatement.total_fee)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Paid</p>
                  <p className="font-semibold text-emerald-600">{formatCurrency(feeStatement.total_paid)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Balance Remaining</p>
                  <p className="font-semibold text-rose-600">{formatCurrency(feeStatement.balance_pending)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Payments Made</p>
                  <p className="font-semibold">{feeStatement.payments.length}</p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="px-1">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Payment Progress</span>
                  <span>{feeStatement.total_fee > 0 ? Math.round((feeStatement.total_paid / feeStatement.total_fee) * 100) : 0}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2.5">
                  <div
                    className="bg-emerald-500 h-2.5 rounded-full transition-all"
                    style={{ width: `${feeStatement.total_fee > 0 ? Math.min((feeStatement.total_paid / feeStatement.total_fee) * 100, 100) : 0}%` }}
                  />
                </div>
              </div>

              {/* Payment History Table */}
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount Paid</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead className="text-right">Balance Remaining</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {feeStatement.payments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                          No payments recorded yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      feeStatement.payments.map((payment, idx) => (
                        <TableRow key={payment.id}>
                          <TableCell className="text-sm text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell className="text-sm">{formatDate(payment.date)}</TableCell>
                          <TableCell className="text-sm">{payment.description}</TableCell>
                          <TableCell className="text-right text-emerald-600 font-semibold">
                            {formatCurrency(payment.amount)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{payment.payment_method || 'N/A'}</Badge>
                          </TableCell>
                          <TableCell className={`text-right font-bold ${payment.running_balance <= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {formatCurrency(payment.running_balance)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
          {feeStatement && (
            <div className="flex justify-end pt-2">
              <Button onClick={() => downloadStatementPDF(feeStatement)}>
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

