import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useBranch } from '@/contexts/BranchContext';
import { supabase } from '@/lib/supabase';
import { branchService, Branch } from '@/services/branchService';
import { batchService } from '@/services/batchService';
import { reportService, AttendanceReportData, FeeCollectionReport, BranchWiseSummary, StudentFeeStatement, TransactionReportRow, SalesStaffReportRow, StudentDetailRow, CourseRegistrationRow, BatchWiseStudentRow, FeePaidRow, FeePendingRow, FeeSummaryRow, CashBookRow, BankBookRow, CollectionReportRow } from '@/services/reportService';
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
  TrendingDown,
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
  GraduationCap,
  BookOpen,
  CheckCircle,
  AlertCircle,
  PieChart,
  Banknote,
  BookMarked,
  ArrowUpCircle,
  ArrowDownCircle,
  Receipt,
  Search,
} from 'lucide-react';
import { AdmissionReport } from '@/components/AdmissionReport';

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

  // Student Details State
  const [studentDetails, setStudentDetails] = useState<StudentDetailRow[]>([]);

  // Course Registration State
  const [courseRegistrations, setCourseRegistrations] = useState<CourseRegistrationRow[]>([]);

  // Batch Wise State
  const [batchWiseStudents, setBatchWiseStudents] = useState<BatchWiseStudentRow[]>([]);

  // Fee Paid State
  const [feePaidList, setFeePaidList] = useState<FeePaidRow[]>([]);

  // Fee Pending State
  const [feePendingList, setFeePendingList] = useState<FeePendingRow[]>([]);

  // Fee Summary State
  const [feeSummary, setFeeSummary] = useState<FeeSummaryRow[]>([]);

  // Cash Book State
  const [cashBook, setCashBook] = useState<CashBookRow[]>([]);

  // Bank Book State
  const [bankBook, setBankBook] = useState<BankBookRow[]>([]);

  // Day Book State (all transactions)
  const [dayBookData, setDayBookData] = useState<TransactionReportRow[]>([]);

  // Income Report State
  const [incomeData, setIncomeData] = useState<TransactionReportRow[]>([]);

  // Expense Report State
  const [expenseData, setExpenseData] = useState<TransactionReportRow[]>([]);

  // Student Statement tab State
  const [statementStudents, setStatementStudents] = useState<Array<{ id: string; name: string; batch_id?: string; batch_name?: string }>>([]);
  const [statementStudentId, setStatementStudentId] = useState('');

  // Batch filter states for fee/collection/statement tabs
  const [allBatches, setAllBatches] = useState<Array<{ id: string; name: string }>>([]);
  const [feePaidBatch, setFeePaidBatch] = useState('');
  const [feePendingBatch, setFeePendingBatch] = useState('');
  const [feeSummaryBatch, setFeeSummaryBatch] = useState('');
  const [collectionBatch, setCollectionBatch] = useState('');
  const [statementBatch, setStatementBatch] = useState('');

  // Collection Report State
  const [collectionReport, setCollectionReport] = useState<CollectionReportRow[]>([]);

  // Logo URL for PDF statements
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    async function loadLogo() {
      if (!currentBranchId && !user?.organizationId) return;
      let url: string | null = null;
      if (currentBranchId) {
        const { data: branch } = await supabase.from('branches').select('logo_url').eq('id', currentBranchId).single();
        if (branch?.logo_url) url = branch.logo_url;
      }
      if (!url && user?.organizationId) {
        const { data: org } = await supabase.from('organizations').select('logo_url').eq('id', user.organizationId).single();
        if (org?.logo_url) url = org.logo_url;
      }
      // Convert to base64 for reliable rendering in print windows
      if (url) {
        try {
          const resp = await fetch(url);
          const blob = await resp.blob();
          const dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
          setLogoUrl(dataUrl);
        } catch (e) {
          console.error('Failed to convert logo to base64:', e);
          setLogoUrl(url);
        }
      }
    }
    loadLogo();
  }, [currentBranchId, user?.organizationId]);

  // Load all batches whenever org/branch changes (used by fee/collection/statement tab filters)
  useEffect(() => {
    if (!user?.organizationId) return;
    batchService.getBatches(user.organizationId, selectedBranch)
      .then(data => setAllBatches((data || []).map(b => ({ id: b.id, name: b.name }))))
      .catch(() => {});
  }, [user?.organizationId, selectedBranch]);

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

  const loadStudentDetails = async () => {
    if (!user?.organizationId) return;
    setLoading(true);
    try {
      const data = await reportService.getStudentDetails(user.organizationId, selectedBranch);
      setStudentDetails(data);
    } catch (error: any) {
      toast.error('Failed to load student details: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadCourseRegistrations = async () => {
    if (!user?.organizationId) return;
    setLoading(true);
    try {
      const data = await reportService.getCourseRegistrations(user.organizationId, selectedBranch, startDate || undefined, endDate || undefined);
      setCourseRegistrations(data);
    } catch (error: any) {
      toast.error('Failed to load course registrations: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadBatchWiseStudents = async () => {
    if (!user?.organizationId) return;
    setLoading(true);
    try {
      const data = await reportService.getBatchWiseStudents(user.organizationId, selectedBranch);
      setBatchWiseStudents(data);
    } catch (error: any) {
      toast.error('Failed to load batch-wise students: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadFeePaidStudents = async () => {
    if (!user?.organizationId) return;
    setLoading(true);
    try {
      const data = await reportService.getFeePaidStudents(user.organizationId, selectedBranch, startDate || undefined, endDate || undefined, feePaidBatch || undefined);
      setFeePaidList(data);
    } catch (error: any) {
      toast.error('Failed to load fee paid list: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadFeePendingStudents = async () => {
    if (!user?.organizationId) return;
    setLoading(true);
    try {
      const data = await reportService.getFeePendingStudents(user.organizationId, selectedBranch, feePendingBatch || undefined);
      setFeePendingList(data);
    } catch (error: any) {
      toast.error('Failed to load fee pending list: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadFeeSummary = async () => {
    if (!user?.organizationId) return;
    setLoading(true);
    try {
      const data = await reportService.getFeeSummary(user.organizationId, selectedBranch, feeSummaryBatch || undefined);
      setFeeSummary(data);
    } catch (error: any) {
      toast.error('Failed to load fee summary: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadCashBook = async () => {
    if (!user?.organizationId) return;
    setLoading(true);
    try {
      const data = await reportService.getCashBook(user.organizationId, selectedBranch, startDate || undefined, endDate || undefined);
      setCashBook(data);
    } catch (error: any) {
      toast.error('Failed to load cash book: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadBankBook = async () => {
    if (!user?.organizationId) return;
    setLoading(true);
    try {
      const data = await reportService.getBankBook(user.organizationId, selectedBranch, startDate || undefined, endDate || undefined);
      setBankBook(data);
    } catch (error: any) {
      toast.error('Failed to load bank book: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadDayBook = async () => {
    if (!user?.organizationId) return;
    setLoading(true);
    try {
      const data = await reportService.getTransactionReport(user.organizationId, selectedBranch, startDate || undefined, endDate || undefined);
      setDayBookData(data);
    } catch (error: any) {
      toast.error('Failed to load day book: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadIncomeReport = async () => {
    if (!user?.organizationId) return;
    setLoading(true);
    try {
      const data = await reportService.getTransactionReport(user.organizationId, selectedBranch, startDate || undefined, endDate || undefined);
      setIncomeData(data.filter(t => t.type === 'income'));
    } catch (error: any) {
      toast.error('Failed to load income report: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadExpenseReport = async () => {
    if (!user?.organizationId) return;
    setLoading(true);
    try {
      const data = await reportService.getTransactionReport(user.organizationId, selectedBranch, startDate || undefined, endDate || undefined);
      setExpenseData(data.filter(t => t.type === 'expense'));
    } catch (error: any) {
      toast.error('Failed to load expense report: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadStatementStudents = async () => {
    if (!user?.organizationId) return;
    setLoading(true);
    try {
      const list = await reportService.getStudents(user.organizationId, selectedBranch);
      setStatementStudents(list);
    } catch (error: any) {
      toast.error('Failed to load students: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadCollectionReport = async () => {
    if (!user?.organizationId) return;
    setLoading(true);
    try {
      const data = await reportService.getCollectionReport(user.organizationId, selectedBranch, startDate || undefined, endDate || undefined, collectionBatch || undefined);
      setCollectionReport(data);
    } catch (error: any) {
      toast.error('Failed to load collection report: ' + error.message);
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

  // ── Shared print/CSV helpers ──────────────────────────────
  const printReportPDF = (title: string, statsHtml: string, tableHtml: string) => {
    const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
    <style>
      @page{size:landscape;margin:12mm 15mm;}
      *{margin:0;padding:0;box-sizing:border-box;}
      body{font-family:'Segoe UI',Arial,sans-serif;color:#1a1a2e;font-size:11px;}
      .header{text-align:center;margin-bottom:18px;padding-bottom:12px;border-bottom:2px solid #6366f1;}
      .header h1{font-size:20px;color:#1e1b4b;margin-bottom:4px;}
      .header p{color:#64748b;font-size:11px;}
      .stats{display:flex;gap:16px;margin-bottom:18px;}
      .sc{flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 14px;}
      .sc .lbl{font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:.5px;}
      .sc .val{font-size:18px;font-weight:700;margin-top:2px;}
      .green{color:#059669;}.red{color:#dc2626;}.blue{color:#6366f1;}.amber{color:#d97706;}.violet{color:#7c3aed;}
      table{width:100%;border-collapse:collapse;margin-top:6px;}
      th{background:#f1f5f9;color:#334155;font-weight:600;text-align:left;padding:8px 10px;font-size:10px;text-transform:uppercase;border-bottom:2px solid #cbd5e1;}
      td{padding:7px 10px;border-bottom:1px solid #e2e8f0;font-size:11px;}
      tr:nth-child(even){background:#f8fafc;}
      .tr{text-align:right;}.tg{color:#059669;font-weight:600;}.tr2{color:#dc2626;font-weight:600;}.tb{font-weight:700;}
      .bg{display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:500;}
      .bg-g{background:#dcfce7;color:#166534;}.bg-r{background:#fee2e2;color:#991b1b;}.bg-o{background:#f1f5f9;color:#475569;border:1px solid #cbd5e1;}
      .totrow{background:#eef2ff !important;font-weight:700;border-top:2px solid #6366f1;}
      .footer{margin-top:20px;text-align:center;font-size:9px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:8px;}
    </style></head><body>
      <div class="header"><h1>${title}</h1><p>Generated on ${today}${selectedBranch ? ' · Branch: ' + (branches.find(b => b.id === selectedBranch)?.name || '') : ''}</p></div>
      ${statsHtml}${tableHtml}
      <div class="footer">Teammates — Report generated automatically</div>
    </body></html>`;
    const win = window.open('', '_blank', 'width=1100,height=700');
    if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 400); }
  };

  const exportCSV = (headers: string[], rows: (string | number)[][], filename: string) => {
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadStudentDetailsCSV = () =>
    exportCSV(
      ['Name', 'Email', 'Phone', 'Gender', 'DOB', 'Course', 'Batch', 'Admission Date', 'Source', 'Branch'],
      studentDetails.map(r => [r.full_name, r.email, r.phone || '', r.gender || '', r.date_of_birth || '', r.course_name || '', r.batch_name || '', formatDate(r.admission_date), r.admission_source || '', r.branch_name || '']),
      'student-details'
    );

  const downloadStudentDetailsPDF = () => {
    const rows = studentDetails.map(r => `<tr><td>${r.full_name}</td><td>${r.email}</td><td>${r.phone || '—'}</td><td>${r.gender || '—'}</td><td>${r.date_of_birth ? formatDate(r.date_of_birth) : '—'}</td><td>${r.course_name || '—'}</td><td>${r.batch_name || '—'}</td><td>${formatDate(r.admission_date)}</td><td>${r.admission_source || '—'}</td></tr>`).join('');
    printReportPDF('Student Details Report',
      `<div class="stats"><div class="sc"><div class="lbl">Total Students</div><div class="val blue">${studentDetails.length}</div></div></div>`,
      `<table><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Gender</th><th>DOB</th><th>Course</th><th>Batch</th><th>Admission Date</th><th>Source</th></tr></thead><tbody>${rows || '<tr><td colspan="9" style="text-align:center">No records</td></tr>'}</tbody></table>`
    );
  };

  const downloadCourseRegCSV = () =>
    exportCSV(
      ['Enrollment #', 'Student', 'Phone', 'Course', 'Batch', 'Total Fee', 'Discount', 'Final Amount', 'Paid', 'Balance', 'Status', 'Date'],
      courseRegistrations.map(r => [r.enrollment_number, r.student_name, r.student_phone || '', r.course_name, r.batch_name || '', r.total_fee, r.discount_amount, r.final_amount, r.amount_paid, r.balance, r.status, formatDate(r.enrollment_date)]),
      'course-registrations'
    );

  const downloadCourseRegPDF = () => {
    const rows = courseRegistrations.map(r => `<tr><td>${r.enrollment_number}</td><td>${r.student_name}</td><td>${r.course_name}</td><td>${r.batch_name || '—'}</td><td class="tr">${formatCurrency(r.final_amount)}</td><td class="tr tg">${formatCurrency(r.amount_paid)}</td><td class="tr tr2">${formatCurrency(r.balance)}</td><td><span class="bg bg-o">${r.status}</span></td><td>${formatDate(r.enrollment_date)}</td></tr>`).join('');
    const total = courseRegistrations.reduce((s, r) => s + r.final_amount, 0);
    const collected = courseRegistrations.reduce((s, r) => s + r.amount_paid, 0);
    printReportPDF('Course Registration Details',
      `<div class="stats"><div class="sc"><div class="lbl">Total Enrollments</div><div class="val blue">${courseRegistrations.length}</div></div><div class="sc"><div class="lbl">Total Fee</div><div class="val blue">${formatCurrency(total)}</div></div><div class="sc"><div class="lbl">Collected</div><div class="val green">${formatCurrency(collected)}</div></div><div class="sc"><div class="lbl">Pending</div><div class="val red">${formatCurrency(total - collected)}</div></div></div>`,
      `<table><thead><tr><th>Enrollment #</th><th>Student</th><th>Course</th><th>Batch</th><th class="tr">Final Amount</th><th class="tr">Paid</th><th class="tr">Balance</th><th>Status</th><th>Date</th></tr></thead><tbody>${rows || '<tr><td colspan="9" style="text-align:center">No records</td></tr>'}</tbody></table>`
    );
  };

  const downloadFeePaidCSV = () =>
    exportCSV(
      ['Student', 'Course', 'Total Fee', 'Amount Paid', 'Mode', 'Paid Date', 'Branch'],
      feePaidList.map(r => [r.student_name, r.course_name || '', r.total_fee, r.amount_paid, r.payment_method || '', formatDate(r.paid_date), r.branch_name || '']),
      'fee-paid-students'
    );

  const downloadFeePaidPDF = () => {
    const rows = feePaidList.map(r => `<tr><td>${r.student_name}</td><td>${r.course_name || '—'}</td><td class="tr">${formatCurrency(r.total_fee)}</td><td class="tr tg">${formatCurrency(r.amount_paid)}</td><td>${r.payment_method || '—'}</td><td>${formatDate(r.paid_date)}</td></tr>`).join('');
    printReportPDF('Fee Paid Student List',
      `<div class="stats"><div class="sc"><div class="lbl">Students Fully Paid</div><div class="val green">${feePaidList.length}</div></div><div class="sc"><div class="lbl">Total Collected</div><div class="val green">${formatCurrency(feePaidList.reduce((s, r) => s + r.amount_paid, 0))}</div></div></div>`,
      `<table><thead><tr><th>Student</th><th>Course</th><th class="tr">Total Fee</th><th class="tr">Amount Paid</th><th>Mode</th><th>Paid Date</th></tr></thead><tbody>${rows || '<tr><td colspan="6" style="text-align:center">No records</td></tr>'}</tbody></table>`
    );
  };

  const downloadFeePendingCSV = () =>
    exportCSV(
      ['Student', 'Course', 'Total Fee', 'Paid', 'Balance', 'Due Date', 'Days Overdue', 'Status'],
      feePendingList.map(r => [r.student_name, r.course_name || '', r.total_fee, r.amount_paid, r.balance, r.due_date ? formatDate(r.due_date) : '', r.days_overdue, r.status]),
      'fee-pending-report'
    );

  const downloadFeePendingPDF = () => {
    const rows = feePendingList.map(r => `<tr><td>${r.student_name}</td><td>${r.course_name || '—'}</td><td class="tr">${formatCurrency(r.total_fee)}</td><td class="tr tg">${formatCurrency(r.amount_paid)}</td><td class="tr tr2">${formatCurrency(r.balance)}</td><td>${r.due_date ? formatDate(r.due_date) : '—'}</td><td class="${r.days_overdue > 0 ? 'tr2' : ''}">${r.days_overdue > 0 ? r.days_overdue + 'd' : '—'}</td></tr>`).join('');
    const totalPending = feePendingList.reduce((s, r) => s + r.balance, 0);
    printReportPDF('Fee Pending Report',
      `<div class="stats"><div class="sc"><div class="lbl">Pending Students</div><div class="val red">${feePendingList.length}</div></div><div class="sc"><div class="lbl">Total Pending</div><div class="val red">${formatCurrency(totalPending)}</div></div><div class="sc"><div class="lbl">Overdue</div><div class="val amber">${feePendingList.filter(r => r.days_overdue > 0).length}</div></div></div>`,
      `<table><thead><tr><th>Student</th><th>Course</th><th class="tr">Total Fee</th><th class="tr">Paid</th><th class="tr">Balance</th><th>Due Date</th><th>Overdue</th></tr></thead><tbody>${rows || '<tr><td colspan="7" style="text-align:center">No records</td></tr>'}</tbody></table>`
    );
  };

  const downloadFeeSummaryCSV = () =>
    exportCSV(
      ['Course', 'Students', 'Total Fee', 'Collected', 'Pending', 'Collection %'],
      feeSummary.map(r => [r.course_name, r.total_students, r.total_fee, r.total_collected, r.total_pending, r.collection_percentage + '%']),
      'fee-summary-report'
    );

  const downloadFeeSummaryPDF = () => {
    const rows = feeSummary.map(r => `<tr><td>${r.course_name}</td><td class="tr">${r.total_students}</td><td class="tr">${formatCurrency(r.total_fee)}</td><td class="tr tg">${formatCurrency(r.total_collected)}</td><td class="tr tr2">${formatCurrency(r.total_pending)}</td><td class="tr">${r.collection_percentage}%</td></tr>`).join('');
    const totals = feeSummary.reduce((a, r) => ({ fee: a.fee + r.total_fee, col: a.col + r.total_collected, pen: a.pen + r.total_pending }), { fee: 0, col: 0, pen: 0 });
    printReportPDF('Fee Summary Report',
      `<div class="stats"><div class="sc"><div class="lbl">Courses</div><div class="val blue">${feeSummary.length}</div></div><div class="sc"><div class="lbl">Total Fee</div><div class="val blue">${formatCurrency(totals.fee)}</div></div><div class="sc"><div class="lbl">Collected</div><div class="val green">${formatCurrency(totals.col)}</div></div><div class="sc"><div class="lbl">Pending</div><div class="val red">${formatCurrency(totals.pen)}</div></div></div>`,
      `<table><thead><tr><th>Course</th><th class="tr">Students</th><th class="tr">Total Fee</th><th class="tr">Collected</th><th class="tr">Pending</th><th class="tr">Collection %</th></tr></thead><tbody>${rows || '<tr><td colspan="6" style="text-align:center">No records</td></tr>'}<tr class="totrow"><td>Total</td><td class="tr">${feeSummary.reduce((s,r)=>s+r.total_students,0)}</td><td class="tr">${formatCurrency(totals.fee)}</td><td class="tr tg">${formatCurrency(totals.col)}</td><td class="tr tr2">${formatCurrency(totals.pen)}</td><td></td></tr></tbody></table>`
    );
  };

  const downloadCashBookCSV = () =>
    exportCSV(
      ['Date', 'Description', 'Category', 'Credit', 'Debit', 'Balance'],
      cashBook.map(r => [formatDate(r.date), r.description, r.category, r.credit || '', r.debit || '', r.running_balance]),
      'cash-book'
    );

  const downloadCashBookPDF = () => {
    const rows = cashBook.map(r => `<tr><td>${formatDate(r.date)}</td><td>${r.description}</td><td><span class="bg bg-o">${r.category}</span></td><td class="tr tg">${r.credit > 0 ? formatCurrency(r.credit) : '—'}</td><td class="tr tr2">${r.debit > 0 ? formatCurrency(r.debit) : '—'}</td><td class="tr tb ${r.running_balance >= 0 ? '' : 'tr2'}">${formatCurrency(r.running_balance)}</td></tr>`).join('');
    const totalIn = cashBook.reduce((s, r) => s + r.credit, 0);
    const totalOut = cashBook.reduce((s, r) => s + r.debit, 0);
    printReportPDF('Cash Book',
      `<div class="stats"><div class="sc"><div class="lbl">Cash In</div><div class="val green">${formatCurrency(totalIn)}</div></div><div class="sc"><div class="lbl">Cash Out</div><div class="val red">${formatCurrency(totalOut)}</div></div><div class="sc"><div class="lbl">Balance</div><div class="val blue">${formatCurrency(totalIn - totalOut)}</div></div></div>`,
      `<table><thead><tr><th>Date</th><th>Description</th><th>Category</th><th class="tr">Cash In</th><th class="tr">Cash Out</th><th class="tr">Balance</th></tr></thead><tbody>${rows || '<tr><td colspan="6" style="text-align:center">No records</td></tr>'}<tr class="totrow"><td colspan="3" class="tr">Totals</td><td class="tr tg">${formatCurrency(totalIn)}</td><td class="tr tr2">${formatCurrency(totalOut)}</td><td class="tr">${formatCurrency(totalIn - totalOut)}</td></tr></tbody></table>`
    );
  };

  const downloadBankBookCSV = () =>
    exportCSV(
      ['Date', 'Description', 'Category', 'Mode', 'Credit', 'Debit', 'Balance'],
      bankBook.map(r => [formatDate(r.date), r.description, r.category, r.mode, r.credit || '', r.debit || '', r.running_balance]),
      'bank-book'
    );

  const downloadBankBookPDF = () => {
    const rows = bankBook.map(r => `<tr><td>${formatDate(r.date)}</td><td>${r.description}</td><td><span class="bg bg-o">${r.category}</span></td><td>${r.mode}</td><td class="tr tg">${r.credit > 0 ? formatCurrency(r.credit) : '—'}</td><td class="tr tr2">${r.debit > 0 ? formatCurrency(r.debit) : '—'}</td><td class="tr tb">${formatCurrency(r.running_balance)}</td></tr>`).join('');
    const totalIn = bankBook.reduce((s, r) => s + r.credit, 0);
    const totalOut = bankBook.reduce((s, r) => s + r.debit, 0);
    printReportPDF('Bank Book',
      `<div class="stats"><div class="sc"><div class="lbl">Receipts</div><div class="val green">${formatCurrency(totalIn)}</div></div><div class="sc"><div class="lbl">Payments</div><div class="val red">${formatCurrency(totalOut)}</div></div><div class="sc"><div class="lbl">Balance</div><div class="val blue">${formatCurrency(totalIn - totalOut)}</div></div></div>`,
      `<table><thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Mode</th><th class="tr">Credit</th><th class="tr">Debit</th><th class="tr">Balance</th></tr></thead><tbody>${rows || '<tr><td colspan="7" style="text-align:center">No records</td></tr>'}<tr class="totrow"><td colspan="4" class="tr">Totals</td><td class="tr tg">${formatCurrency(totalIn)}</td><td class="tr tr2">${formatCurrency(totalOut)}</td><td class="tr">${formatCurrency(totalIn - totalOut)}</td></tr></tbody></table>`
    );
  };

  const downloadDayBookPDF = () => {
    const rows = dayBookData.map(r => `<tr><td>${formatDate(r.date)}</td><td>${r.description}</td><td><span class="bg ${r.type === 'income' ? 'bg-g' : 'bg-r'}">${r.type}</span></td><td><span class="bg bg-o">${r.category}</span></td><td class="tr ${r.type === 'income' ? 'tg' : 'tr2'}">${formatCurrency(r.amount)}</td><td>${r.mode}</td></tr>`).join('');
    const inc = dayBookData.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const exp = dayBookData.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    printReportPDF('Day Book',
      `<div class="stats"><div class="sc"><div class="lbl">Income</div><div class="val green">${formatCurrency(inc)}</div></div><div class="sc"><div class="lbl">Expense</div><div class="val red">${formatCurrency(exp)}</div></div><div class="sc"><div class="lbl">Net</div><div class="val blue">${formatCurrency(inc - exp)}</div></div><div class="sc"><div class="lbl">Entries</div><div class="val blue">${dayBookData.length}</div></div></div>`,
      `<table><thead><tr><th>Date</th><th>Description</th><th>Type</th><th>Category</th><th class="tr">Amount</th><th>Mode</th></tr></thead><tbody>${rows || '<tr><td colspan="6" style="text-align:center">No records</td></tr>'}</tbody></table>`
    );
  };

  const downloadIncomeReportPDF = () => {
    const rows = incomeData.map(r => `<tr><td>${formatDate(r.date)}</td><td>${r.description}</td><td><span class="bg bg-o">${r.category}</span></td><td class="tr tg">${formatCurrency(r.amount)}</td><td>${r.mode}</td></tr>`).join('');
    const total = incomeData.reduce((s, t) => s + t.amount, 0);
    printReportPDF('Income Report',
      `<div class="stats"><div class="sc"><div class="lbl">Total Income</div><div class="val green">${formatCurrency(total)}</div></div><div class="sc"><div class="lbl">Entries</div><div class="val blue">${incomeData.length}</div></div></div>`,
      `<table><thead><tr><th>Date</th><th>Description</th><th>Category</th><th class="tr">Amount</th><th>Mode</th></tr></thead><tbody>${rows || '<tr><td colspan="5" style="text-align:center">No records</td></tr>'}<tr class="totrow"><td colspan="3" class="tr">Total</td><td class="tr tg">${formatCurrency(total)}</td><td></td></tr></tbody></table>`
    );
  };

  const downloadExpenseReportPDF = () => {
    const rows = expenseData.map(r => `<tr><td>${formatDate(r.date)}</td><td>${r.description}</td><td><span class="bg bg-o">${r.category}</span></td><td class="tr tr2">${formatCurrency(r.amount)}</td><td>${r.mode}</td></tr>`).join('');
    const total = expenseData.reduce((s, t) => s + t.amount, 0);
    printReportPDF('Expense Report',
      `<div class="stats"><div class="sc"><div class="lbl">Total Expenses</div><div class="val red">${formatCurrency(total)}</div></div><div class="sc"><div class="lbl">Entries</div><div class="val blue">${expenseData.length}</div></div></div>`,
      `<table><thead><tr><th>Date</th><th>Description</th><th>Category</th><th class="tr">Amount</th><th>Mode</th></tr></thead><tbody>${rows || '<tr><td colspan="5" style="text-align:center">No records</td></tr>'}<tr class="totrow"><td colspan="3" class="tr">Total</td><td class="tr tr2">${formatCurrency(total)}</td><td></td></tr></tbody></table>`
    );
  };

  const downloadCollectionCSV = () =>
    exportCSV(
      ['Date', 'Student', 'Course', 'Amount', 'Mode', 'Collected By', 'Branch'],
      collectionReport.map(r => [formatDate(r.date), r.student_name, r.course_name, r.amount, r.mode, r.collected_by, r.branch_name || '']),
      'collection-report'
    );

  const downloadCollectionPDF = () => {
    const rows = collectionReport.map(r => `<tr><td>${formatDate(r.date)}</td><td>${r.student_name}</td><td>${r.course_name}</td><td class="tr tg">${formatCurrency(r.amount)}</td><td>${r.mode}</td></tr>`).join('');
    const total = collectionReport.reduce((s, r) => s + r.amount, 0);
    printReportPDF('Collection Report',
      `<div class="stats"><div class="sc"><div class="lbl">Total Collected</div><div class="val green">${formatCurrency(total)}</div></div><div class="sc"><div class="lbl">Transactions</div><div class="val blue">${collectionReport.length}</div></div></div>`,
      `<table><thead><tr><th>Date</th><th>Student</th><th>Course</th><th class="tr">Amount</th><th>Mode</th></tr></thead><tbody>${rows || '<tr><td colspan="5" style="text-align:center">No records</td></tr>'}<tr class="totrow"><td colspan="3" class="tr">Total</td><td class="tr tg">${formatCurrency(total)}</td><td></td></tr></tbody></table>`
    );
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
    percentage: 0,
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
        <div className="overflow-x-auto pb-1">
          <TabsList className="bg-muted/50 inline-flex h-auto flex-wrap gap-1 p-1">
            <TabsTrigger value="attendance" className="gap-1.5 text-xs">
              <CalendarDays className="w-3.5 h-3.5" />
              Attendance
            </TabsTrigger>
            <TabsTrigger value="fees" className="gap-1.5 text-xs">
              <IndianRupee className="w-3.5 h-3.5" />
              Fee Collection
            </TabsTrigger>
            {!selectedBranch && (
              <TabsTrigger value="branch-summary" className="gap-1.5 text-xs">
                <Building2 className="w-3.5 h-3.5" />
                Branch Summary
              </TabsTrigger>
            )}
            <TabsTrigger value="student-details" className="gap-1.5 text-xs">
              <GraduationCap className="w-3.5 h-3.5" />
              Student Details
            </TabsTrigger>
            <TabsTrigger value="course-registrations" className="gap-1.5 text-xs">
              <BookOpen className="w-3.5 h-3.5" />
              Course Registrations
            </TabsTrigger>
            <TabsTrigger value="batch-wise" className="gap-1.5 text-xs">
              <Layers className="w-3.5 h-3.5" />
              Batch Wise Students
            </TabsTrigger>
            <TabsTrigger value="fee-paid" className="gap-1.5 text-xs">
              <CheckCircle className="w-3.5 h-3.5" />
              Fee Paid
            </TabsTrigger>
            <TabsTrigger value="fee-pending" className="gap-1.5 text-xs">
              <AlertCircle className="w-3.5 h-3.5" />
              Fee Pending
            </TabsTrigger>
            <TabsTrigger value="fee-summary" className="gap-1.5 text-xs">
              <PieChart className="w-3.5 h-3.5" />
              Fee Summary
            </TabsTrigger>
            <TabsTrigger value="cash-book" className="gap-1.5 text-xs">
              <Banknote className="w-3.5 h-3.5" />
              Cash Book
            </TabsTrigger>
            <TabsTrigger value="bank-book" className="gap-1.5 text-xs">
              <CreditCard className="w-3.5 h-3.5" />
              Bank Book
            </TabsTrigger>
            <TabsTrigger value="day-book" className="gap-1.5 text-xs">
              <BookMarked className="w-3.5 h-3.5" />
              Day Book
            </TabsTrigger>
            <TabsTrigger value="expense-report" className="gap-1.5 text-xs">
              <TrendingDown className="w-3.5 h-3.5" />
              Expense Report
            </TabsTrigger>
            <TabsTrigger value="income-report" className="gap-1.5 text-xs">
              <TrendingUp className="w-3.5 h-3.5" />
              Income Report
            </TabsTrigger>
            <TabsTrigger value="student-statement" className="gap-1.5 text-xs">
              <Receipt className="w-3.5 h-3.5" />
              Student Statement
            </TabsTrigger>
            <TabsTrigger value="collection-report" className="gap-1.5 text-xs">
              <Wallet className="w-3.5 h-3.5" />
              Collection Report
            </TabsTrigger>
            <TabsTrigger value="transactions" className="gap-1.5 text-xs">
              <ArrowUpCircle className="w-3.5 h-3.5" />
              Transactions
            </TabsTrigger>
            <TabsTrigger value="sales-staff" className="gap-1.5 text-xs">
              <UserPlus className="w-3.5 h-3.5" />
              Sales Staff
            </TabsTrigger>
            <TabsTrigger value="admissions" className="gap-1.5 text-xs">
              <Users className="w-3.5 h-3.5" />
              Admissions
            </TabsTrigger>
          </TabsList>
        </div>

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

        {/* ═══ STUDENT DETAILS ═══ */}
        <TabsContent value="student-details" className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button onClick={loadStudentDetails} disabled={loading}>
              <Filter className="w-4 h-4 mr-2" />{loading ? 'Loading...' : 'Load Report'}
            </Button>
            {studentDetails.length > 0 && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={downloadStudentDetailsCSV}><Download className="w-4 h-4 mr-2" />CSV</Button>
                <Button variant="outline" size="sm" onClick={downloadStudentDetailsPDF}><FileText className="w-4 h-4 mr-2" />PDF</Button>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card><CardContent className="p-4 flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Total Students</p><p className="text-2xl font-bold text-primary">{studentDetails.length}</p></div><GraduationCap className="w-8 h-8 text-primary opacity-40" /></CardContent></Card>
            <Card><CardContent className="p-4 flex items-center justify-between"><div><p className="text-sm text-muted-foreground">With Course</p><p className="text-2xl font-bold text-emerald-600">{studentDetails.filter(s => s.course_name).length}</p></div><BookOpen className="w-8 h-8 text-emerald-600 opacity-40" /></CardContent></Card>
            <Card><CardContent className="p-4 flex items-center justify-between"><div><p className="text-sm text-muted-foreground">With Batch</p><p className="text-2xl font-bold text-violet-600">{studentDetails.filter(s => s.batch_name).length}</p></div><Layers className="w-8 h-8 text-violet-600 opacity-40" /></CardContent></Card>
            <Card><CardContent className="p-4 flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Branches</p><p className="text-2xl font-bold text-amber-600">{new Set(studentDetails.map(s => s.branch_id).filter(Boolean)).size || 1}</p></div><Building2 className="w-8 h-8 text-amber-600 opacity-40" /></CardContent></Card>
          </div>
          <Card>
            <CardHeader><CardTitle>Student Directory</CardTitle><CardDescription>{studentDetails.length} students found</CardDescription></CardHeader>
            <CardContent>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead>Email</TableHead>
                      <TableHead>Gender</TableHead><TableHead>DOB</TableHead><TableHead>Course</TableHead>
                      <TableHead>Batch</TableHead><TableHead>Admission Date</TableHead><TableHead>Source</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {studentDetails.length === 0 && <TableRow><TableCell colSpan={9} className="h-32 text-center text-muted-foreground">No records. Click "Load Report".</TableCell></TableRow>}
                    {studentDetails.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.full_name}</TableCell>
                        <TableCell>{r.phone || '—'}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{r.email || '—'}</TableCell>
                        <TableCell>{r.gender || '—'}</TableCell>
                        <TableCell>{r.date_of_birth ? formatDate(r.date_of_birth) : '—'}</TableCell>
                        <TableCell>{r.course_name ? <Badge variant="outline">{r.course_name}</Badge> : '—'}</TableCell>
                        <TableCell>{r.batch_name || '—'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(r.admission_date)}</TableCell>
                        <TableCell>{r.admission_source || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ COURSE REGISTRATION DETAILS ═══ */}
        <TabsContent value="course-registrations" className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button onClick={loadCourseRegistrations} disabled={loading}>
              <Filter className="w-4 h-4 mr-2" />{loading ? 'Loading...' : 'Load Report'}
            </Button>
            {courseRegistrations.length > 0 && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={downloadCourseRegCSV}><Download className="w-4 h-4 mr-2" />CSV</Button>
                <Button variant="outline" size="sm" onClick={downloadCourseRegPDF}><FileText className="w-4 h-4 mr-2" />PDF</Button>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Enrollments</p><p className="text-2xl font-bold text-primary">{courseRegistrations.length}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Fee</p><p className="text-2xl font-bold text-blue-600">{formatCurrency(courseRegistrations.reduce((s, r) => s + r.final_amount, 0))}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Collected</p><p className="text-2xl font-bold text-emerald-600">{formatCurrency(courseRegistrations.reduce((s, r) => s + r.amount_paid, 0))}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Balance</p><p className="text-2xl font-bold text-rose-600">{formatCurrency(courseRegistrations.reduce((s, r) => s + r.balance, 0))}</p></CardContent></Card>
          </div>
          <Card>
            <CardHeader><CardTitle>Course Registrations</CardTitle><CardDescription>{courseRegistrations.length} enrollments found</CardDescription></CardHeader>
            <CardContent>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Enrollment #</TableHead><TableHead>Student</TableHead><TableHead>Course</TableHead>
                      <TableHead>Batch</TableHead><TableHead className="text-right">Total Fee</TableHead>
                      <TableHead className="text-right">Discount</TableHead><TableHead className="text-right">Final</TableHead>
                      <TableHead className="text-right">Paid</TableHead><TableHead className="text-right">Balance</TableHead>
                      <TableHead>Status</TableHead><TableHead>Enrolled On</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {courseRegistrations.length === 0 && <TableRow><TableCell colSpan={11} className="h-32 text-center text-muted-foreground">No records. Click "Load Report".</TableCell></TableRow>}
                    {courseRegistrations.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="text-sm font-mono">{r.enrollment_number}</TableCell>
                        <TableCell className="font-medium">{r.student_name}</TableCell>
                        <TableCell><Badge variant="outline">{r.course_name}</Badge></TableCell>
                        <TableCell>{r.batch_name || '—'}</TableCell>
                        <TableCell className="text-right">{formatCurrency(r.total_fee)}</TableCell>
                        <TableCell className="text-right text-amber-600">{r.discount_amount > 0 ? formatCurrency(r.discount_amount) : '—'}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(r.final_amount)}</TableCell>
                        <TableCell className="text-right text-emerald-600 font-semibold">{formatCurrency(r.amount_paid)}</TableCell>
                        <TableCell className="text-right text-rose-600 font-semibold">{formatCurrency(r.balance)}</TableCell>
                        <TableCell><Badge variant="outline" className="capitalize">{r.status}</Badge></TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(r.enrollment_date)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ BATCH WISE STUDENTS ═══ */}
        <TabsContent value="batch-wise" className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button onClick={loadBatchWiseStudents} disabled={loading}>
              <Filter className="w-4 h-4 mr-2" />{loading ? 'Loading...' : 'Load Report'}
            </Button>
            {batchWiseStudents.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => exportCSV(['Batch', 'Course', 'Student Count', 'Student Names'], batchWiseStudents.map(b => [b.batch_name, b.course_name || '', b.student_count, b.students.map(s => s.name).join('; ')]), 'batch-wise-students')}>
                <Download className="w-4 h-4 mr-2" />CSV
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Batches</p><p className="text-2xl font-bold text-primary">{batchWiseStudents.length}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Students</p><p className="text-2xl font-bold text-emerald-600">{batchWiseStudents.reduce((s, b) => s + b.student_count, 0)}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Active Batches</p><p className="text-2xl font-bold text-violet-600">{batchWiseStudents.filter(b => b.student_count > 0).length}</p></CardContent></Card>
          </div>
          {batchWiseStudents.length === 0 && !loading && (
            <Card className="border-dashed"><CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground"><Layers className="w-12 h-12 mb-4 opacity-40" /><p className="text-lg font-medium">No batch data</p><p className="text-sm">Click "Load Report" to view batch-wise students</p></CardContent></Card>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {batchWiseStudents.map(batch => (
              <Card key={batch.batch_id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{batch.batch_name}</CardTitle>
                    <Badge>{batch.student_count} students</Badge>
                  </div>
                  {batch.course_name && <CardDescription>{batch.course_name}</CardDescription>}
                </CardHeader>
                <CardContent>
                  {batch.students.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">No students enrolled</p>
                  ) : (
                    <ul className="space-y-1">
                      {batch.students.slice(0, 8).map(s => (
                        <li key={s.id} className="text-sm flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                          <span>{s.name}</span>
                          {s.phone && <span className="text-muted-foreground text-xs ml-auto">{s.phone}</span>}
                        </li>
                      ))}
                      {batch.students.length > 8 && <li className="text-xs text-muted-foreground pl-3.5">+{batch.students.length - 8} more</li>}
                    </ul>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ═══ FEE PAID STUDENT LIST ═══ */}
        <TabsContent value="fee-paid" className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm min-w-[150px]"
                value={feePaidBatch}
                onChange={e => setFeePaidBatch(e.target.value)}
              >
                <option value="">All Batches</option>
                {allBatches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <Button onClick={loadFeePaidStudents} disabled={loading}>
                <Filter className="w-4 h-4 mr-2" />{loading ? 'Loading...' : 'Load Report'}
              </Button>
            </div>
            {feePaidList.length > 0 && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={downloadFeePaidCSV}><Download className="w-4 h-4 mr-2" />CSV</Button>
                <Button variant="outline" size="sm" onClick={downloadFeePaidPDF}><FileText className="w-4 h-4 mr-2" />PDF</Button>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <Card><CardContent className="p-4 flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Fully Paid Students</p><p className="text-2xl font-bold text-emerald-600">{feePaidList.length}</p></div><CheckCircle className="w-8 h-8 text-emerald-600 opacity-40" /></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Collected</p><p className="text-2xl font-bold text-emerald-600">{formatCurrency(feePaidList.reduce((s, r) => s + r.amount_paid, 0))}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Unique Students</p><p className="text-2xl font-bold text-primary">{new Set(feePaidList.map(r => r.student_id)).size}</p></CardContent></Card>
          </div>
          <Card>
            <CardHeader><CardTitle>Fee Paid Students</CardTitle><CardDescription>{feePaidList.length} completed fee records</CardDescription></CardHeader>
            <CardContent>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Student</TableHead><TableHead>Batch</TableHead><TableHead>Course</TableHead>
                      <TableHead className="text-right">Total Fee</TableHead><TableHead className="text-right">Amount Paid</TableHead>
                      <TableHead>Mode</TableHead><TableHead>Paid Date</TableHead>
                      {!selectedBranch && <TableHead>Branch</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {feePaidList.length === 0 && <TableRow><TableCell colSpan={selectedBranch ? 7 : 8} className="h-32 text-center text-muted-foreground">No records. Click "Load Report".</TableCell></TableRow>}
                    {feePaidList.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.student_name}</TableCell>
                        <TableCell>{r.batch_name ? <Badge variant="secondary">{r.batch_name}</Badge> : '—'}</TableCell>
                        <TableCell>{r.course_name ? <Badge variant="outline">{r.course_name}</Badge> : '—'}</TableCell>
                        <TableCell className="text-right">{formatCurrency(r.total_fee)}</TableCell>
                        <TableCell className="text-right text-emerald-600 font-semibold">{formatCurrency(r.amount_paid)}</TableCell>
                        <TableCell><Badge variant="secondary">{r.payment_method || 'N/A'}</Badge></TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(r.paid_date)}</TableCell>
                        {!selectedBranch && <TableCell><Badge variant="secondary">{r.branch_name || 'N/A'}</Badge></TableCell>}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ FEE PENDING REPORT ═══ */}
        <TabsContent value="fee-pending" className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm min-w-[150px]"
                value={feePendingBatch}
                onChange={e => setFeePendingBatch(e.target.value)}
              >
                <option value="">All Batches</option>
                {allBatches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <Button onClick={loadFeePendingStudents} disabled={loading}>
                <Filter className="w-4 h-4 mr-2" />{loading ? 'Loading...' : 'Load Report'}
              </Button>
            </div>
            {feePendingList.length > 0 && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={downloadFeePendingCSV}><Download className="w-4 h-4 mr-2" />CSV</Button>
                <Button variant="outline" size="sm" onClick={downloadFeePendingPDF}><FileText className="w-4 h-4 mr-2" />PDF</Button>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card><CardContent className="p-4 flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Pending Students</p><p className="text-2xl font-bold text-rose-600">{feePendingList.length}</p></div><AlertCircle className="w-8 h-8 text-rose-600 opacity-40" /></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Pending</p><p className="text-2xl font-bold text-rose-600">{formatCurrency(feePendingList.reduce((s, r) => s + r.balance, 0))}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Partial Paid</p><p className="text-2xl font-bold text-amber-600">{feePendingList.filter(r => r.status === 'partial').length}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Overdue</p><p className="text-2xl font-bold text-rose-600">{feePendingList.filter(r => r.days_overdue > 0).length}</p></CardContent></Card>
          </div>
          <Card>
            <CardHeader><CardTitle>Fee Pending Students</CardTitle><CardDescription>{feePendingList.length} records with outstanding fees</CardDescription></CardHeader>
            <CardContent>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Student</TableHead><TableHead>Batch</TableHead><TableHead>Course</TableHead>
                      <TableHead className="text-right">Total Fee</TableHead><TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Balance</TableHead><TableHead>Due Date</TableHead>
                      <TableHead>Overdue</TableHead><TableHead>Status</TableHead>
                      {!selectedBranch && <TableHead>Branch</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {feePendingList.length === 0 && <TableRow><TableCell colSpan={selectedBranch ? 9 : 10} className="h-32 text-center text-muted-foreground">No records. Click "Load Report".</TableCell></TableRow>}
                    {feePendingList.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.student_name}</TableCell>
                        <TableCell>{r.batch_name ? <Badge variant="secondary">{r.batch_name}</Badge> : '—'}</TableCell>
                        <TableCell>{r.course_name ? <Badge variant="outline">{r.course_name}</Badge> : '—'}</TableCell>
                        <TableCell className="text-right">{formatCurrency(r.total_fee)}</TableCell>
                        <TableCell className="text-right text-emerald-600">{formatCurrency(r.amount_paid)}</TableCell>
                        <TableCell className="text-right text-rose-600 font-bold">{formatCurrency(r.balance)}</TableCell>
                        <TableCell className="text-sm">{r.due_date ? formatDate(r.due_date) : '—'}</TableCell>
                        <TableCell>{r.days_overdue > 0 ? <Badge variant="destructive">{r.days_overdue}d</Badge> : <Badge variant="secondary">—</Badge>}</TableCell>
                        <TableCell><Badge variant="outline" className={r.status === 'partial' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'} >{r.status}</Badge></TableCell>
                        {!selectedBranch && <TableCell><Badge variant="secondary">{r.branch_name || 'N/A'}</Badge></TableCell>}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ FEE SUMMARY REPORT ═══ */}
        <TabsContent value="fee-summary" className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm min-w-[150px]"
                value={feeSummaryBatch}
                onChange={e => setFeeSummaryBatch(e.target.value)}
              >
                <option value="">All Batches</option>
                {allBatches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <Button onClick={loadFeeSummary} disabled={loading}>
                <Filter className="w-4 h-4 mr-2" />{loading ? 'Loading...' : 'Load Report'}
              </Button>
            </div>
            {feeSummary.length > 0 && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={downloadFeeSummaryCSV}><Download className="w-4 h-4 mr-2" />CSV</Button>
                <Button variant="outline" size="sm" onClick={downloadFeeSummaryPDF}><FileText className="w-4 h-4 mr-2" />PDF</Button>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Courses</p><p className="text-2xl font-bold text-primary">{feeSummary.length}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Fee</p><p className="text-2xl font-bold text-blue-600">{formatCurrency(feeSummary.reduce((s, r) => s + r.total_fee, 0))}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Collected</p><p className="text-2xl font-bold text-emerald-600">{formatCurrency(feeSummary.reduce((s, r) => s + r.total_collected, 0))}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Pending</p><p className="text-2xl font-bold text-rose-600">{formatCurrency(feeSummary.reduce((s, r) => s + r.total_pending, 0))}</p></CardContent></Card>
          </div>
          <Card>
            <CardHeader><CardTitle>Fee Summary by Course</CardTitle></CardHeader>
            <CardContent>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Course</TableHead><TableHead className="text-right">Students</TableHead>
                      <TableHead className="text-right">Total Fee</TableHead><TableHead className="text-right">Collected</TableHead>
                      <TableHead className="text-right">Pending</TableHead><TableHead className="text-right">Collection %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {feeSummary.length === 0 && <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground">No records. Click "Load Report".</TableCell></TableRow>}
                    {feeSummary.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{r.course_name}</TableCell>
                        <TableCell className="text-right">{r.total_students}</TableCell>
                        <TableCell className="text-right">{formatCurrency(r.total_fee)}</TableCell>
                        <TableCell className="text-right text-emerald-600 font-semibold">{formatCurrency(r.total_collected)}</TableCell>
                        <TableCell className="text-right text-rose-600">{formatCurrency(r.total_pending)}</TableCell>
                        <TableCell className="text-right"><Badge variant={r.collection_percentage >= 80 ? 'default' : 'secondary'}>{r.collection_percentage}%</Badge></TableCell>
                      </TableRow>
                    ))}
                    {feeSummary.length > 0 && (
                      <TableRow className="bg-muted/30 font-bold">
                        <TableCell>Total</TableCell>
                        <TableCell className="text-right">{feeSummary.reduce((s, r) => s + r.total_students, 0)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(feeSummary.reduce((s, r) => s + r.total_fee, 0))}</TableCell>
                        <TableCell className="text-right text-emerald-600">{formatCurrency(feeSummary.reduce((s, r) => s + r.total_collected, 0))}</TableCell>
                        <TableCell className="text-right text-rose-600">{formatCurrency(feeSummary.reduce((s, r) => s + r.total_pending, 0))}</TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ CASH BOOK ═══ */}
        <TabsContent value="cash-book" className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button onClick={loadCashBook} disabled={loading}>
              <Filter className="w-4 h-4 mr-2" />{loading ? 'Loading...' : 'Load Report'}
            </Button>
            {cashBook.length > 0 && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={downloadCashBookCSV}><Download className="w-4 h-4 mr-2" />CSV</Button>
                <Button variant="outline" size="sm" onClick={downloadCashBookPDF}><FileText className="w-4 h-4 mr-2" />PDF</Button>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <Card><CardContent className="p-4 flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Cash In</p><p className="text-2xl font-bold text-emerald-600">{formatCurrency(cashBook.reduce((s, r) => s + r.credit, 0))}</p></div><ArrowUpCircle className="w-8 h-8 text-emerald-600 opacity-40" /></CardContent></Card>
            <Card><CardContent className="p-4 flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Cash Out</p><p className="text-2xl font-bold text-rose-600">{formatCurrency(cashBook.reduce((s, r) => s + r.debit, 0))}</p></div><ArrowDownCircle className="w-8 h-8 text-rose-600 opacity-40" /></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Cash Balance</p><p className={`text-2xl font-bold ${cashBook.length ? (cashBook[cashBook.length - 1]?.running_balance >= 0 ? 'text-primary' : 'text-destructive') : ''}`}>{cashBook.length ? formatCurrency(cashBook[cashBook.length - 1]?.running_balance) : '₹0'}</p></CardContent></Card>
          </div>
          <Card>
            <CardHeader><CardTitle>Cash Book</CardTitle><CardDescription>All cash transactions with running balance</CardDescription></CardHeader>
            <CardContent>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead>Category</TableHead>
                      <TableHead className="text-right text-emerald-700">Cash In</TableHead>
                      <TableHead className="text-right text-rose-700">Cash Out</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cashBook.length === 0 && <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground">No cash transactions. Click "Load Report".</TableCell></TableRow>}
                    {cashBook.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(r.date)}</TableCell>
                        <TableCell className="font-medium">{r.description}</TableCell>
                        <TableCell><Badge variant="outline">{r.category}</Badge></TableCell>
                        <TableCell className="text-right text-emerald-600 font-semibold">{r.credit > 0 ? formatCurrency(r.credit) : '—'}</TableCell>
                        <TableCell className="text-right text-rose-600 font-semibold">{r.debit > 0 ? formatCurrency(r.debit) : '—'}</TableCell>
                        <TableCell className={`text-right font-bold ${r.running_balance >= 0 ? 'text-foreground' : 'text-destructive'}`}>{formatCurrency(r.running_balance)}</TableCell>
                      </TableRow>
                    ))}
                    {cashBook.length > 0 && (
                      <TableRow className="bg-muted/30 font-bold">
                        <TableCell colSpan={3} className="text-right">Totals</TableCell>
                        <TableCell className="text-right text-emerald-600">{formatCurrency(cashBook.reduce((s, r) => s + r.credit, 0))}</TableCell>
                        <TableCell className="text-right text-rose-600">{formatCurrency(cashBook.reduce((s, r) => s + r.debit, 0))}</TableCell>
                        <TableCell className="text-right">{cashBook.length ? formatCurrency(cashBook[cashBook.length - 1].running_balance) : ''}</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ BANK BOOK ═══ */}
        <TabsContent value="bank-book" className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button onClick={loadBankBook} disabled={loading}>
              <Filter className="w-4 h-4 mr-2" />{loading ? 'Loading...' : 'Load Report'}
            </Button>
            {bankBook.length > 0 && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={downloadBankBookCSV}><Download className="w-4 h-4 mr-2" />CSV</Button>
                <Button variant="outline" size="sm" onClick={downloadBankBookPDF}><FileText className="w-4 h-4 mr-2" />PDF</Button>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Receipts (Bank)</p><p className="text-2xl font-bold text-emerald-600">{formatCurrency(bankBook.reduce((s, r) => s + r.credit, 0))}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Payments (Bank)</p><p className="text-2xl font-bold text-rose-600">{formatCurrency(bankBook.reduce((s, r) => s + r.debit, 0))}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Bank Balance</p><p className={`text-2xl font-bold ${bankBook.length ? (bankBook[bankBook.length - 1]?.running_balance >= 0 ? 'text-primary' : 'text-destructive') : ''}`}>{bankBook.length ? formatCurrency(bankBook[bankBook.length - 1]?.running_balance) : '₹0'}</p></CardContent></Card>
          </div>
          <Card>
            <CardHeader><CardTitle>Bank Book</CardTitle><CardDescription>UPI, Bank Transfer, Cheque, NEFT/RTGS, Online transactions</CardDescription></CardHeader>
            <CardContent>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead>Category</TableHead><TableHead>Mode</TableHead>
                      <TableHead className="text-right text-emerald-700">Credit</TableHead>
                      <TableHead className="text-right text-rose-700">Debit</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bankBook.length === 0 && <TableRow><TableCell colSpan={7} className="h-32 text-center text-muted-foreground">No bank transactions. Click "Load Report".</TableCell></TableRow>}
                    {bankBook.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(r.date)}</TableCell>
                        <TableCell className="font-medium">{r.description}</TableCell>
                        <TableCell><Badge variant="outline">{r.category}</Badge></TableCell>
                        <TableCell><Badge variant="secondary">{r.mode}</Badge></TableCell>
                        <TableCell className="text-right text-emerald-600 font-semibold">{r.credit > 0 ? formatCurrency(r.credit) : '—'}</TableCell>
                        <TableCell className="text-right text-rose-600 font-semibold">{r.debit > 0 ? formatCurrency(r.debit) : '—'}</TableCell>
                        <TableCell className={`text-right font-bold ${r.running_balance >= 0 ? 'text-foreground' : 'text-destructive'}`}>{formatCurrency(r.running_balance)}</TableCell>
                      </TableRow>
                    ))}
                    {bankBook.length > 0 && (
                      <TableRow className="bg-muted/30 font-bold">
                        <TableCell colSpan={4} className="text-right">Totals</TableCell>
                        <TableCell className="text-right text-emerald-600">{formatCurrency(bankBook.reduce((s, r) => s + r.credit, 0))}</TableCell>
                        <TableCell className="text-right text-rose-600">{formatCurrency(bankBook.reduce((s, r) => s + r.debit, 0))}</TableCell>
                        <TableCell className="text-right">{bankBook.length ? formatCurrency(bankBook[bankBook.length - 1].running_balance) : ''}</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ DAY BOOK ═══ */}
        <TabsContent value="day-book" className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button onClick={loadDayBook} disabled={loading}>
              <Filter className="w-4 h-4 mr-2" />{loading ? 'Loading...' : 'Load Report'}
            </Button>
            {dayBookData.length > 0 && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => exportCSV(['Date', 'Description', 'Type', 'Category', 'Amount', 'Mode'], dayBookData.map(r => [formatDate(r.date), r.description, r.type, r.category, r.amount, r.mode]), 'day-book')}>
                  <Download className="w-4 h-4 mr-2" />CSV
                </Button>
                <Button variant="outline" size="sm" onClick={downloadDayBookPDF}><FileText className="w-4 h-4 mr-2" />PDF</Button>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Income</p><p className="text-2xl font-bold text-emerald-600">{formatCurrency(dayBookData.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0))}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Expense</p><p className="text-2xl font-bold text-rose-600">{formatCurrency(dayBookData.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0))}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Net Amount</p><p className="text-2xl font-bold text-primary">{formatCurrency(dayBookData.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0) - dayBookData.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0))}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Entries</p><p className="text-2xl font-bold">{dayBookData.length}</p></CardContent></Card>
          </div>
          <Card>
            <CardHeader><CardTitle>Day Book</CardTitle><CardDescription>All income and expense entries</CardDescription></CardHeader>
            <CardContent>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead>Type</TableHead>
                      <TableHead>Category</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Mode</TableHead>
                      {!selectedBranch && <TableHead>Branch</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dayBookData.length === 0 && <TableRow><TableCell colSpan={selectedBranch ? 6 : 7} className="h-32 text-center text-muted-foreground">No records. Click "Load Report".</TableCell></TableRow>}
                    {dayBookData.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(r.date)}</TableCell>
                        <TableCell className="font-medium">{r.description}</TableCell>
                        <TableCell><Badge className={r.type === 'income' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}>{r.type}</Badge></TableCell>
                        <TableCell><Badge variant="outline">{r.category}</Badge></TableCell>
                        <TableCell className={`text-right font-semibold ${r.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>{r.type === 'income' ? '+' : '-'}{formatCurrency(r.amount)}</TableCell>
                        <TableCell><Badge variant="secondary">{r.mode}</Badge></TableCell>
                        {!selectedBranch && <TableCell className="text-sm text-muted-foreground">{r.branch_name || '—'}</TableCell>}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ EXPENSE REPORT ═══ */}
        <TabsContent value="expense-report" className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button onClick={loadExpenseReport} disabled={loading}>
              <Filter className="w-4 h-4 mr-2" />{loading ? 'Loading...' : 'Load Report'}
            </Button>
            {expenseData.length > 0 && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => exportCSV(['Date', 'Description', 'Category', 'Amount', 'Mode'], expenseData.map(r => [formatDate(r.date), r.description, r.category, r.amount, r.mode]), 'expense-report')}>
                  <Download className="w-4 h-4 mr-2" />CSV
                </Button>
                <Button variant="outline" size="sm" onClick={downloadExpenseReportPDF}><FileText className="w-4 h-4 mr-2" />PDF</Button>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <Card><CardContent className="p-4 flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Total Expenses</p><p className="text-2xl font-bold text-rose-600">{formatCurrency(expenseData.reduce((s, t) => s + t.amount, 0))}</p></div><TrendingDown className="w-8 h-8 text-rose-600 opacity-40" /></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Entries</p><p className="text-2xl font-bold">{expenseData.length}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Categories</p><p className="text-2xl font-bold text-primary">{new Set(expenseData.map(t => t.category)).size}</p></CardContent></Card>
          </div>
          <Card>
            <CardHeader><CardTitle>Expense Report</CardTitle></CardHeader>
            <CardContent>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead>Category</TableHead>
                      <TableHead className="text-right">Amount</TableHead><TableHead>Mode</TableHead>
                      {!selectedBranch && <TableHead>Branch</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenseData.length === 0 && <TableRow><TableCell colSpan={selectedBranch ? 5 : 6} className="h-32 text-center text-muted-foreground">No expense records. Click "Load Report".</TableCell></TableRow>}
                    {expenseData.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(r.date)}</TableCell>
                        <TableCell className="font-medium">{r.description}</TableCell>
                        <TableCell><Badge variant="outline">{r.category}</Badge></TableCell>
                        <TableCell className="text-right text-rose-600 font-semibold">{formatCurrency(r.amount)}</TableCell>
                        <TableCell><Badge variant="secondary">{r.mode}</Badge></TableCell>
                        {!selectedBranch && <TableCell className="text-sm text-muted-foreground">{r.branch_name || '—'}</TableCell>}
                      </TableRow>
                    ))}
                    {expenseData.length > 0 && (
                      <TableRow className="bg-muted/30 font-bold">
                        <TableCell colSpan={3} className="text-right">Total</TableCell>
                        <TableCell className="text-right text-rose-600">{formatCurrency(expenseData.reduce((s, t) => s + t.amount, 0))}</TableCell>
                        <TableCell />{!selectedBranch && <TableCell />}
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ INCOME REPORT ═══ */}
        <TabsContent value="income-report" className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button onClick={loadIncomeReport} disabled={loading}>
              <Filter className="w-4 h-4 mr-2" />{loading ? 'Loading...' : 'Load Report'}
            </Button>
            {incomeData.length > 0 && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => exportCSV(['Date', 'Description', 'Category', 'Amount', 'Mode'], incomeData.map(r => [formatDate(r.date), r.description, r.category, r.amount, r.mode]), 'income-report')}>
                  <Download className="w-4 h-4 mr-2" />CSV
                </Button>
                <Button variant="outline" size="sm" onClick={downloadIncomeReportPDF}><FileText className="w-4 h-4 mr-2" />PDF</Button>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <Card><CardContent className="p-4 flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Total Income</p><p className="text-2xl font-bold text-emerald-600">{formatCurrency(incomeData.reduce((s, t) => s + t.amount, 0))}</p></div><TrendingUp className="w-8 h-8 text-emerald-600 opacity-40" /></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Entries</p><p className="text-2xl font-bold">{incomeData.length}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Categories</p><p className="text-2xl font-bold text-primary">{new Set(incomeData.map(t => t.category)).size}</p></CardContent></Card>
          </div>
          <Card>
            <CardHeader><CardTitle>Income Report</CardTitle></CardHeader>
            <CardContent>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead>Category</TableHead>
                      <TableHead className="text-right">Amount</TableHead><TableHead>Mode</TableHead>
                      {!selectedBranch && <TableHead>Branch</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {incomeData.length === 0 && <TableRow><TableCell colSpan={selectedBranch ? 5 : 6} className="h-32 text-center text-muted-foreground">No income records. Click "Load Report".</TableCell></TableRow>}
                    {incomeData.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(r.date)}</TableCell>
                        <TableCell className="font-medium">{r.description}</TableCell>
                        <TableCell><Badge variant="outline">{r.category}</Badge></TableCell>
                        <TableCell className="text-right text-emerald-600 font-semibold">{formatCurrency(r.amount)}</TableCell>
                        <TableCell><Badge variant="secondary">{r.mode}</Badge></TableCell>
                        {!selectedBranch && <TableCell className="text-sm text-muted-foreground">{r.branch_name || '—'}</TableCell>}
                      </TableRow>
                    ))}
                    {incomeData.length > 0 && (
                      <TableRow className="bg-muted/30 font-bold">
                        <TableCell colSpan={3} className="text-right">Total</TableCell>
                        <TableCell className="text-right text-emerald-600">{formatCurrency(incomeData.reduce((s, t) => s + t.amount, 0))}</TableCell>
                        <TableCell />{!selectedBranch && <TableCell />}
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ STUDENT STATEMENT ═══ */}
        <TabsContent value="student-statement" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Student Fee Statement</CardTitle>
              <CardDescription>Filter by batch, then select a student to view their complete fee payment history</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-[260px] space-y-1">
                  <p className="text-sm font-medium">Select Student</p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={loadStatementStudents} disabled={loading}>
                      <Search className="w-4 h-4 mr-2" />{loading ? 'Loading...' : 'Load Students'}
                    </Button>
                    {statementStudents.length > 0 && (
                      <>
                        <select
                          className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm min-w-[150px]"
                          value={statementBatch}
                          onChange={e => { setStatementBatch(e.target.value); setStatementStudentId(''); }}
                        >
                          <option value="">All Batches</option>
                          {allBatches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                        <select
                          className="flex-1 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm min-w-[200px]"
                          value={statementStudentId}
                          onChange={e => setStatementStudentId(e.target.value)}
                        >
                          <option value="">Select a student…</option>
                          {(statementBatch
                            ? statementStudents.filter(s => s.batch_id === statementBatch)
                            : statementStudents
                          ).map(s => <option key={s.id} value={s.id}>{s.name}{s.batch_name ? ` (${s.batch_name})` : ''}</option>)}
                        </select>
                      </>
                    )}
                    {statementStudentId && (
                      <Button onClick={() => viewStudentFeeStatement(statementStudentId)} disabled={loading}>
                        <FileText className="w-4 h-4 mr-2" />View Statement
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              {statementStudents.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                  <Receipt className="w-12 h-12 mb-4 opacity-40" />
                  <p className="font-medium">Click "Load Students" then select a student to view their statement</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ COLLECTION REPORT ═══ */}
        <TabsContent value="collection-report" className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm min-w-[150px]"
                value={collectionBatch}
                onChange={e => setCollectionBatch(e.target.value)}
              >
                <option value="">All Batches</option>
                {allBatches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <Button onClick={loadCollectionReport} disabled={loading}>
                <Filter className="w-4 h-4 mr-2" />{loading ? 'Loading...' : 'Load Report'}
              </Button>
            </div>
            {collectionReport.length > 0 && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={downloadCollectionCSV}><Download className="w-4 h-4 mr-2" />CSV</Button>
                <Button variant="outline" size="sm" onClick={downloadCollectionPDF}><FileText className="w-4 h-4 mr-2" />PDF</Button>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <Card><CardContent className="p-4 flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Total Collected</p><p className="text-2xl font-bold text-emerald-600">{formatCurrency(collectionReport.reduce((s, r) => s + r.amount, 0))}</p></div><Wallet className="w-8 h-8 text-emerald-600 opacity-40" /></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Transactions</p><p className="text-2xl font-bold">{collectionReport.length}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Unique Students</p><p className="text-2xl font-bold text-primary">{new Set(collectionReport.map(r => r.student_id)).size}</p></CardContent></Card>
          </div>
          <Card>
            <CardHeader><CardTitle>Collection Report</CardTitle><CardDescription>All fee installment payments collected</CardDescription></CardHeader>
            <CardContent>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Date</TableHead><TableHead>Student</TableHead><TableHead>Batch</TableHead><TableHead>Course</TableHead>
                      <TableHead className="text-right">Amount</TableHead><TableHead>Mode</TableHead>
                      {!selectedBranch && <TableHead>Branch</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {collectionReport.length === 0 && <TableRow><TableCell colSpan={selectedBranch ? 6 : 7} className="h-32 text-center text-muted-foreground">No collection records. Click "Load Report".</TableCell></TableRow>}
                    {collectionReport.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="text-sm text-muted-foreground">{r.date ? formatDate(r.date) : '—'}</TableCell>
                        <TableCell className="font-medium">{r.student_name}</TableCell>
                        <TableCell>{r.batch_name ? <Badge variant="secondary">{r.batch_name}</Badge> : '—'}</TableCell>
                        <TableCell><Badge variant="outline">{r.course_name}</Badge></TableCell>
                        <TableCell className="text-right text-emerald-600 font-semibold">{formatCurrency(r.amount)}</TableCell>
                        <TableCell><Badge variant="secondary">{r.mode}</Badge></TableCell>
                        {!selectedBranch && <TableCell><Badge variant="secondary">{r.branch_name || 'N/A'}</Badge></TableCell>}
                      </TableRow>
                    ))}
                    {collectionReport.length > 0 && (
                      <TableRow className="bg-muted/30 font-bold">
                        <TableCell colSpan={4} className="text-right">Total Collected</TableCell>
                        <TableCell className="text-right text-emerald-600">{formatCurrency(collectionReport.reduce((s, r) => s + r.amount, 0))}</TableCell>
                        <TableCell />{!selectedBranch && <TableCell />}
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ADMISSIONS REPORT TAB */}
        <TabsContent value="admissions" className="space-y-6">
          <AdmissionReport />
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

