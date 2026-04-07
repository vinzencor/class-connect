import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    BarChart3,
    Download,
    TrendingUp,
    TrendingDown,
    Wallet,
    Clock,
    UserCheck,
    UserX,
    CalendarDays,
    Filter,
    ArrowUpCircle,
    ArrowDownCircle,
    FileText,
    Users,
} from 'lucide-react';
import { AdmissionReport } from '@/components/AdmissionReport';

// ── Types ──────────────────────────────────────────────────
interface Transaction {
    id: string;
    type: 'income' | 'expense';
    description: string;
    amount: number;
    category: string;
    date: string;
    mode: string;
    recurrence: 'one-time' | 'monthly';
    paused: boolean;
    parentId?: string;
}

interface TeacherAttendanceRecord {
    date: string;
    personId: string;
    personName: string;
    status: 'present' | 'absent' | null;
    markedAt?: string;
}

interface StaffAttendanceRecord {
    date: string;
    staffId: string;
    staffName: string;
    status: 'present' | 'absent' | null;
    markedAt?: string;
}

const TRANSACTIONS_KEY = 'teammates_transactions';
const STAFF_ATTENDANCE_KEY = 'teammates_staff_attendance';

// ── Helpers ────────────────────────────────────────────────
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

const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
};

// ── Component ──────────────────────────────────────────────
export default function ReportsPage() {
    const [salesDateRange, setSalesDateRange] = useState('all');
    const [teacherFilter, setTeacherFilter] = useState('all');
    const [attendanceDateFilter, setAttendanceDateFilter] = useState('all');

    // Load transactions from localStorage
    const transactions: Transaction[] = useMemo(() => {
        try {
            const saved = localStorage.getItem(TRANSACTIONS_KEY);
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    }, []);

    // Load teacher/staff attendance from localStorage (manually marked from Attendance page)
    const teacherRecords: TeacherAttendanceRecord[] = useMemo(() => {
        try {
            const saved = localStorage.getItem(STAFF_ATTENDANCE_KEY);
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    }, []);

    // Staff records are the same as teacher records (from same localStorage key)
    const staffRecords: StaffAttendanceRecord[] = useMemo(() => {
        try {
            const saved = localStorage.getItem(STAFF_ATTENDANCE_KEY);
            if (!saved) return [];
            const parsed = JSON.parse(saved);
            // Map to StaffAttendanceRecord shape if needed
            return parsed.map((r: any) => ({
                date: r.date,
                staffId: r.staffId || r.personId,
                staffName: r.staffName || r.personName,
                status: r.status ?? null,
                markedAt: r.markedAt,
            }));
        } catch {
            return [];
        }
    }, []);

    // ── Sales Report ─────────────────────────────────────────
    const filteredTransactions = useMemo(() => {
        let filtered = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        if (salesDateRange === 'today') {
            const today = new Date().toISOString().split('T')[0];
            filtered = filtered.filter((t) => t.date.startsWith(today));
        } else if (salesDateRange === 'week') {
            const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            filtered = filtered.filter((t) => new Date(t.date) >= weekAgo);
        } else if (salesDateRange === 'month') {
            const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            filtered = filtered.filter((t) => new Date(t.date) >= monthAgo);
        }
        return filtered;
    }, [transactions, salesDateRange]);

    // Running balance for bank statement
    const statementRows = useMemo(() => {
        let balance = 0;
        return filteredTransactions.map((t) => {
            if (t.type === 'income') balance += t.amount;
            else balance -= t.amount;
            return { ...t, runningBalance: balance };
        });
    }, [filteredTransactions]);

    const salesStats = useMemo(() => {
        const totalReceived = filteredTransactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
        const totalExpenses = filteredTransactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
        const pendingRecurring = transactions
            .filter((t) => t.recurrence === 'monthly' && !t.paused && !t.parentId)
            .reduce((s, t) => s + t.amount, 0);
        return { totalReceived, totalExpenses, netBalance: totalReceived - totalExpenses, pendingRecurring };
    }, [filteredTransactions, transactions]);

    // ── Teacher Report ───────────────────────────────────────
    const uniqueTeachers = useMemo(() => {
        const names = new Set(teacherRecords.map((r) => r.personName));
        return Array.from(names);
    }, [teacherRecords]);

    const filteredTeacherRecords = useMemo(() => {
        let records = [...teacherRecords].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        if (teacherFilter !== 'all') {
            records = records.filter((r) => r.personName === teacherFilter);
        }
        return records;
    }, [teacherRecords, teacherFilter]);

    const teacherStats = useMemo(() => {
        const totalPresent = teacherRecords.filter((r) => r.status === 'present').length;
        const totalAbsent = teacherRecords.filter((r) => r.status === 'absent').length;
        const total = teacherRecords.length;
        const percentage = total > 0 ? Math.round((totalPresent / total) * 100) : 0;
        return { totalPresent, totalAbsent, total, percentage, teacherCount: uniqueTeachers.length };
    }, [teacherRecords, uniqueTeachers]);

    // ── Attendance Report ────────────────────────────────────
    const filteredStaffRecords = useMemo(() => {
        let records = [...staffRecords].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        if (attendanceDateFilter === 'today') {
            const today = new Date().toISOString().split('T')[0];
            records = records.filter((r) => r.date === today);
        } else if (attendanceDateFilter === 'week') {
            const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            records = records.filter((r) => r.date >= weekAgo);
        } else if (attendanceDateFilter === 'month') {
            const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            records = records.filter((r) => r.date >= monthAgo);
        }
        return records;
    }, [staffRecords, attendanceDateFilter]);

    const attendanceStats = useMemo(() => {
        const totalPresent = filteredStaffRecords.filter((r) => r.status === 'present').length;
        const totalAbsent = filteredStaffRecords.filter((r) => r.status === 'absent').length;
        const total = filteredStaffRecords.length;
        const percentage = total > 0 ? Math.round((totalPresent / total) * 100) : 0;
        return { totalPresent, totalAbsent, total, percentage };
    }, [filteredStaffRecords]);

    // ── Export CSV ────────────────────────────────────────────
    const exportSalesReport = () => {
        const headers = ['Date', 'Description', 'Type', 'Category', 'Credit', 'Debit', 'Balance', 'Mode'];
        const rows = statementRows.map((t) => [
            formatDate(t.date),
            t.description,
            t.type === 'income' ? 'Credit' : 'Debit',
            t.category,
            t.type === 'income' ? t.amount.toString() : '',
            t.type === 'expense' ? t.amount.toString() : '',
            t.runningBalance.toString(),
            t.mode,
        ]);
        const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sales_report_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // ── Export PDF (Landscape) ───────────────────────────────
    const exportPDF = (reportType: 'sales' | 'teachers' | 'attendance') => {
        const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        const printStyles = `
            @page { size: landscape; margin: 12mm 15mm; }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a2e; font-size: 11px; }
            .header { text-align: center; margin-bottom: 18px; padding-bottom: 12px; border-bottom: 2px solid #6366f1; }
            .header h1 { font-size: 20px; color: #1e1b4b; margin-bottom: 4px; }
            .header p { color: #64748b; font-size: 11px; }
            .stats { display: flex; gap: 16px; margin-bottom: 18px; }
            .stat-card { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; }
            .stat-card .label { font-size: 9px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
            .stat-card .value { font-size: 18px; font-weight: 700; margin-top: 2px; }
            .stat-card .value.green { color: #059669; }
            .stat-card .value.red { color: #dc2626; }
            .stat-card .value.blue { color: #6366f1; }
            .stat-card .value.amber { color: #d97706; }
            .stat-card .value.violet { color: #7c3aed; }
            table { width: 100%; border-collapse: collapse; margin-top: 6px; }
            th { background: #f1f5f9; color: #334155; font-weight: 600; text-align: left; padding: 8px 10px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; border-bottom: 2px solid #cbd5e1; }
            td { padding: 7px 10px; border-bottom: 1px solid #e2e8f0; font-size: 11px; }
            tr:nth-child(even) { background: #f8fafc; }
            .text-right { text-align: right; }
            .text-green { color: #059669; font-weight: 600; }
            .text-red { color: #dc2626; font-weight: 600; }
            .text-bold { font-weight: 700; }
            .totals-row { background: #eef2ff !important; font-weight: 700; border-top: 2px solid #6366f1; }
            .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 500; }
            .badge-green { background: #dcfce7; color: #166534; }
            .badge-red { background: #fee2e2; color: #991b1b; }
            .badge-outline { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }
            .footer { margin-top: 20px; text-align: center; font-size: 9px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; }
        `;

        let title = '';
        let statsHtml = '';
        let tableHtml = '';

        if (reportType === 'sales') {
            title = 'Sales Report — Account Statement';
            statsHtml = `
                <div class="stats">
                    <div class="stat-card"><div class="label">Amount Received</div><div class="value green">${formatCurrency(salesStats.totalReceived)}</div></div>
                    <div class="stat-card"><div class="label">Amount Spent</div><div class="value red">${formatCurrency(salesStats.totalExpenses)}</div></div>
                    <div class="stat-card"><div class="label">Net Balance</div><div class="value blue">${formatCurrency(salesStats.netBalance)}</div></div>
                    <div class="stat-card"><div class="label">Monthly Pending</div><div class="value amber">${formatCurrency(salesStats.pendingRecurring)}</div></div>
                </div>`;
            const salesRows = statementRows.map((r) => `
                <tr>
                    <td>${formatDate(r.date)}</td>
                    <td>${r.description}</td>
                    <td><span class="badge badge-outline">${r.category}</span></td>
                    <td class="text-right text-green">${r.type === 'income' ? formatCurrency(r.amount) : '—'}</td>
                    <td class="text-right text-red">${r.type === 'expense' ? formatCurrency(r.amount) : '—'}</td>
                    <td class="text-right text-bold">${formatCurrency(r.runningBalance)}</td>
                    <td>${r.mode}</td>
                </tr>`).join('');
            tableHtml = `
                <table>
                    <thead><tr>
                        <th>Date</th><th>Description</th><th>Category</th>
                        <th class="text-right">Credit (₹)</th><th class="text-right">Debit (₹)</th>
                        <th class="text-right">Balance (₹)</th><th>Mode</th>
                    </tr></thead>
                    <tbody>
                        ${salesRows}
                        <tr class="totals-row">
                            <td colspan="3" class="text-right">Totals</td>
                            <td class="text-right text-green">${formatCurrency(salesStats.totalReceived)}</td>
                            <td class="text-right text-red">${formatCurrency(salesStats.totalExpenses)}</td>
                            <td class="text-right">${formatCurrency(salesStats.netBalance)}</td>
                            <td></td>
                        </tr>
                    </tbody>
                </table>`;
        } else if (reportType === 'teachers') {
            title = 'Teacher Attendance Report';
            statsHtml = `
                <div class="stats">
                    <div class="stat-card"><div class="label">Total Teachers</div><div class="value blue">${teacherStats.teacherCount}</div></div>
                    <div class="stat-card"><div class="label">Present</div><div class="value green">${teacherStats.totalPresent}</div></div>
                    <div class="stat-card"><div class="label">Absent</div><div class="value red">${teacherStats.totalAbsent}</div></div>
                    <div class="stat-card"><div class="label">Attendance %</div><div class="value violet">${teacherStats.percentage}%</div></div>
                </div>`;
            const teacherRows = filteredTeacherRecords.map((r) => `
                <tr>
                    <td>${formatDate(r.date)}</td>
                    <td>${r.personName}</td>
                    <td><span class="badge ${r.status === 'present' ? 'badge-green' : 'badge-red'}">${r.status.charAt(0).toUpperCase() + r.status.slice(1)}</span></td>
                    <td>${r.markedAt ? formatTime(r.markedAt) : '—'}</td>
                </tr>`).join('');
            tableHtml = `
                <table>
                    <thead><tr><th>Date</th><th>Teacher Name</th><th>Status</th><th>Marked At</th></tr></thead>
                    <tbody>${teacherRows || '<tr><td colspan="4" style="text-align:center;padding:20px;color:#94a3b8">No records found</td></tr>'}</tbody>
                </table>`;
        } else {
            title = 'Staff Attendance Report';
            statsHtml = `
                <div class="stats">
                    <div class="stat-card"><div class="label">Present</div><div class="value green">${attendanceStats.totalPresent}</div></div>
                    <div class="stat-card"><div class="label">Absent</div><div class="value red">${attendanceStats.totalAbsent}</div></div>
                    <div class="stat-card"><div class="label">Total Records</div><div class="value blue">${attendanceStats.total}</div></div>
                    <div class="stat-card"><div class="label">Attendance %</div><div class="value violet">${attendanceStats.percentage}%</div></div>
                </div>`;
            const staffRows = filteredStaffRecords.map((r) => `
                <tr>
                    <td>${formatDate(r.date)}</td>
                    <td>${r.staffName}</td>
                    <td><span class="badge ${r.status === 'present' ? 'badge-green' : 'badge-red'}">${r.status.charAt(0).toUpperCase() + r.status.slice(1)}</span></td>
                    <td>${r.markedAt ? formatTime(r.markedAt) : '—'}</td>
                </tr>`).join('');
            tableHtml = `
                <table>
                    <thead><tr><th>Date</th><th>Staff Name</th><th>Status</th><th>Marked At</th></tr></thead>
                    <tbody>${staffRows || '<tr><td colspan="4" style="text-align:center;padding:20px;color:#94a3b8">No records found</td></tr>'}</tbody>
                </table>`;
        }

        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>${printStyles}</style></head><body>
            <div class="header"><h1>${title}</h1><p>Generated on ${today}</p></div>
            ${statsHtml}
            ${tableHtml}
            <div class="footer">Teammates — Report generated automatically</div>
        </body></html>`;

        const printWindow = window.open('', '_blank', 'width=1100,height=700');
        if (printWindow) {
            printWindow.document.write(html);
            printWindow.document.close();
            setTimeout(() => { printWindow.print(); }, 400);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div>
                <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
                    Reports
                </h1>
                <p className="text-muted-foreground mt-1">
                    Detailed reports for sales, teachers, attendance, and admissions
                </p>
            </div>

            <Tabs defaultValue="sales" className="space-y-6">
                <TabsList className="bg-muted/50">
                    <TabsTrigger value="sales" className="gap-2">
                        <BarChart3 className="w-4 h-4" />
                        Sales Report
                    </TabsTrigger>
                    <TabsTrigger value="teachers" className="gap-2">
                        <UserCheck className="w-4 h-4" />
                        Teacher Report
                    </TabsTrigger>
                    <TabsTrigger value="attendance" className="gap-2">
                        <CalendarDays className="w-4 h-4" />
                        Attendance Report
                    </TabsTrigger>
                    <TabsTrigger value="admissions" className="gap-2">
                        <Users className="w-4 h-4" />
                        Admission Sources
                    </TabsTrigger>
                </TabsList>

                {/* ═══ SALES REPORT ═══ */}
                <TabsContent value="sales" className="space-y-6">
                    {/* Stats */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card className="border shadow-card">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Amount Received</p>
                                        <p className="text-2xl font-bold text-emerald-600">{formatCurrency(salesStats.totalReceived)}</p>
                                    </div>
                                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                                        <TrendingUp className="w-6 h-6 text-emerald-600" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="border shadow-card">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Amount Spent</p>
                                        <p className="text-2xl font-bold text-rose-600">{formatCurrency(salesStats.totalExpenses)}</p>
                                    </div>
                                    <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center">
                                        <TrendingDown className="w-6 h-6 text-rose-600" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="border shadow-card">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Net Balance</p>
                                        <p className={`text-2xl font-bold ${salesStats.netBalance >= 0 ? 'text-primary' : 'text-destructive'}`}>
                                            {formatCurrency(salesStats.netBalance)}
                                        </p>
                                    </div>
                                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                                        <Wallet className="w-6 h-6 text-primary" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="border shadow-card">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Monthly Pending</p>
                                        <p className="text-2xl font-bold text-amber-600">{formatCurrency(salesStats.pendingRecurring)}</p>
                                    </div>
                                    <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                                        <Clock className="w-6 h-6 text-amber-600" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Bank Statement */}
                    <Card className="border shadow-card">
                        <CardHeader className="pb-4">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                <div>
                                    <CardTitle className="text-lg">Account Statement</CardTitle>
                                    <CardDescription>Bank account statement style report of all transactions</CardDescription>
                                </div>
                                <div className="flex gap-2">
                                    <Select value={salesDateRange} onValueChange={setSalesDateRange}>
                                        <SelectTrigger className="w-36">
                                            <Filter className="w-4 h-4 mr-2" />
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Time</SelectItem>
                                            <SelectItem value="today">Today</SelectItem>
                                            <SelectItem value="week">This Week</SelectItem>
                                            <SelectItem value="month">This Month</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Button variant="outline" size="sm" onClick={exportSalesReport}>
                                        <Download className="w-4 h-4 mr-2" />
                                        CSV
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => exportPDF('sales')}>
                                        <FileText className="w-4 h-4 mr-2" />
                                        PDF
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-lg border overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50">
                                            <TableHead>Date</TableHead>
                                            <TableHead>Description</TableHead>
                                            <TableHead>Category</TableHead>
                                            <TableHead className="text-right text-emerald-700">Credit (₹)</TableHead>
                                            <TableHead className="text-right text-rose-700">Debit (₹)</TableHead>
                                            <TableHead className="text-right">Balance (₹)</TableHead>
                                            <TableHead className="hidden md:table-cell">Mode</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {statementRows.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                                                    No transactions found. Add income or expenses from the Payments page.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                        {statementRows.map((row, i) => (
                                            <TableRow key={row.id} className="animate-fade-in" style={{ animationDelay: `${i * 20}ms` }}>
                                                <TableCell className="text-sm text-muted-foreground">{formatDate(row.date)}</TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        {row.type === 'income' ? (
                                                            <ArrowUpCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                                                        ) : (
                                                            <ArrowDownCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                                                        )}
                                                        <span className="font-medium">{row.description}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell><Badge variant="outline">{row.category}</Badge></TableCell>
                                                <TableCell className="text-right font-semibold text-emerald-600">
                                                    {row.type === 'income' ? formatCurrency(row.amount) : '—'}
                                                </TableCell>
                                                <TableCell className="text-right font-semibold text-rose-600">
                                                    {row.type === 'expense' ? formatCurrency(row.amount) : '—'}
                                                </TableCell>
                                                <TableCell className={`text-right font-bold ${row.runningBalance >= 0 ? 'text-foreground' : 'text-destructive'}`}>
                                                    {formatCurrency(row.runningBalance)}
                                                </TableCell>
                                                <TableCell className="hidden md:table-cell text-muted-foreground">{row.mode}</TableCell>
                                            </TableRow>
                                        ))}
                                        {statementRows.length > 0 && (
                                            <TableRow className="bg-muted/30 font-bold">
                                                <TableCell colSpan={3} className="text-right">Totals</TableCell>
                                                <TableCell className="text-right text-emerald-600">
                                                    {formatCurrency(salesStats.totalReceived)}
                                                </TableCell>
                                                <TableCell className="text-right text-rose-600">
                                                    {formatCurrency(salesStats.totalExpenses)}
                                                </TableCell>
                                                <TableCell className={`text-right ${salesStats.netBalance >= 0 ? 'text-foreground' : 'text-destructive'}`}>
                                                    {formatCurrency(salesStats.netBalance)}
                                                </TableCell>
                                                <TableCell className="hidden md:table-cell" />
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ═══ TEACHER REPORT ═══ */}
                <TabsContent value="teachers" className="space-y-6">
                    {/* Stats */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card className="border shadow-card">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Total Teachers</p>
                                        <p className="text-2xl font-bold text-primary">{teacherStats.teacherCount}</p>
                                    </div>
                                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                                        <UserCheck className="w-6 h-6 text-primary" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="border shadow-card">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Present</p>
                                        <p className="text-2xl font-bold text-emerald-600">{teacherStats.totalPresent}</p>
                                    </div>
                                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                                        <UserCheck className="w-6 h-6 text-emerald-600" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="border shadow-card">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Absent</p>
                                        <p className="text-2xl font-bold text-rose-600">{teacherStats.totalAbsent}</p>
                                    </div>
                                    <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center">
                                        <UserX className="w-6 h-6 text-rose-600" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="border shadow-card">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Attendance %</p>
                                        <p className="text-2xl font-bold text-violet-600">{teacherStats.percentage}%</p>
                                    </div>
                                    <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center">
                                        <TrendingUp className="w-6 h-6 text-violet-600" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Teacher Login Table */}
                    <Card className="border shadow-card">
                        <CardHeader className="pb-4">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                <div>
                                    <CardTitle className="text-lg">Teacher Attendance</CardTitle>
                                    <CardDescription>Attendance marked manually from the Attendance page</CardDescription>
                                </div>
                                <div className="flex gap-2">
                                    <Select value={teacherFilter} onValueChange={setTeacherFilter}>
                                        <SelectTrigger className="w-48">
                                            <Filter className="w-4 h-4 mr-2" />
                                            <SelectValue placeholder="All Teachers" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Teachers</SelectItem>
                                            {uniqueTeachers.map((name) => (
                                                <SelectItem key={name} value={name}>{name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Button variant="outline" size="sm" onClick={() => exportPDF('teachers')}>
                                        <FileText className="w-4 h-4 mr-2" />
                                        PDF
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-lg border overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50">
                                            <TableHead>Date</TableHead>
                                            <TableHead>Teacher Name</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Marked At</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredTeacherRecords.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                                                    No teacher attendance records found. Mark attendance from the Attendance page.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                        {filteredTeacherRecords.map((record, i) => (
                                            <TableRow key={`${record.personId}_${record.date}_${i}`} className="animate-fade-in" style={{ animationDelay: `${i * 20}ms` }}>
                                                <TableCell className="text-sm text-muted-foreground">{formatDate(record.date)}</TableCell>
                                                <TableCell className="font-medium">{record.personName}</TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant="outline"
                                                        className={
                                                            record.status === 'present'
                                                                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                                                : 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                                                        }
                                                    >
                                                        {record.status === 'present' ? (
                                                            <UserCheck className="w-3 h-3 mr-1" />
                                                        ) : (
                                                            <UserX className="w-3 h-3 mr-1" />
                                                        )}
                                                        {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-muted-foreground">
                                                    {record.markedAt ? formatTime(record.markedAt) : '—'}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ═══ ATTENDANCE REPORT ═══ */}
                <TabsContent value="attendance" className="space-y-6">
                    {/* Stats */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card className="border shadow-card">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Present</p>
                                        <p className="text-2xl font-bold text-emerald-600">{attendanceStats.totalPresent}</p>
                                    </div>
                                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                                        <UserCheck className="w-6 h-6 text-emerald-600" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="border shadow-card">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Absent</p>
                                        <p className="text-2xl font-bold text-rose-600">{attendanceStats.totalAbsent}</p>
                                    </div>
                                    <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center">
                                        <UserX className="w-6 h-6 text-rose-600" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="border shadow-card">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Total Records</p>
                                        <p className="text-2xl font-bold text-primary">{attendanceStats.total}</p>
                                    </div>
                                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                                        <CalendarDays className="w-6 h-6 text-primary" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="border shadow-card">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Attendance %</p>
                                        <p className="text-2xl font-bold text-violet-600">{attendanceStats.percentage}%</p>
                                    </div>
                                    <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center">
                                        <TrendingUp className="w-6 h-6 text-violet-600" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Staff Attendance Table */}
                    <Card className="border shadow-card">
                        <CardHeader className="pb-4">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                <div>
                                    <CardTitle className="text-lg">Staff Attendance Records</CardTitle>
                                    <CardDescription>Detailed attendance log for all staff members</CardDescription>
                                </div>
                                <div className="flex gap-2">
                                    <Select value={attendanceDateFilter} onValueChange={setAttendanceDateFilter}>
                                        <SelectTrigger className="w-36">
                                            <Filter className="w-4 h-4 mr-2" />
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Time</SelectItem>
                                            <SelectItem value="today">Today</SelectItem>
                                            <SelectItem value="week">This Week</SelectItem>
                                            <SelectItem value="month">This Month</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Button variant="outline" size="sm" onClick={() => exportPDF('attendance')}>
                                        <FileText className="w-4 h-4 mr-2" />
                                        PDF
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-lg border overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50">
                                            <TableHead>Date</TableHead>
                                            <TableHead>Staff Name</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Marked At</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredStaffRecords.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                                                    No staff attendance records found. Mark attendance from the Attendance page.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                        {filteredStaffRecords.map((record, i) => (
                                            <TableRow key={`${record.staffId}_${record.date}_${i}`} className="animate-fade-in" style={{ animationDelay: `${i * 20}ms` }}>
                                                <TableCell className="text-sm text-muted-foreground">{formatDate(record.date)}</TableCell>
                                                <TableCell className="font-medium">{record.staffName}</TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant="outline"
                                                        className={
                                                            record.status === 'present'
                                                                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                                                : 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                                                        }
                                                    >
                                                        {record.status === 'present' ? (
                                                            <UserCheck className="w-3 h-3 mr-1" />
                                                        ) : (
                                                            <UserX className="w-3 h-3 mr-1" />
                                                        )}
                                                        {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-muted-foreground">
                                                    {record.markedAt ? formatTime(record.markedAt) : '—'}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ═══ ADMISSIONS REPORT ═══ */}
                <TabsContent value="admissions" className="space-y-6">
                    <AdmissionReport />
                </TabsContent>
            </Tabs>
        </div>
    );
}
