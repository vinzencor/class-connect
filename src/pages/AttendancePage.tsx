import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  Search,
  Calendar,
  UserCheck,
  UserX,
  Clock,
  Users,
  Download,
  TrendingUp,
  CheckCircle,
  GraduationCap,
  CalendarCheck,
  FileText,
  Sun,
  Sunrise,
  Sunset,
  Moon,
  CalendarDays,
  Loader2,
  RefreshCw,
  Video,
  Filter,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useBranch } from '@/contexts/BranchContext';
import { supabase } from '@/lib/supabase';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
} from 'recharts';
import { BarChart3, PieChart, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { batchService } from '@/services/batchService';
import { useToast } from '@/hooks/use-toast';
import { EsslAttendanceSyncResult, syncEsslAttendance } from '@/services/esslService';

interface BatchItem {
  id: string;
  name: string;
  student_ids?: string[];
}

// ── Types & Constants ──────────────────────────────────────
type AttendanceStatus = 'present' | 'absent' | 'holiday' | 'half_day' | 'online_present';
type SessionType = 'full' | 'morning' | 'evening' | 'night';
type AttendanceSource = 'manual' | 'meet_join' | 'essl';

interface PersonEntry {
  id: string;
  name: string;
  role: string;
}

interface AttendanceEntry {
  date: string;
  personId: string;
  personName: string;
  status: AttendanceStatus | null;
  source?: AttendanceSource;
  session?: string | null;
  markedAt?: string;
}

const formatDateStr = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatEsslDateTime = (date: Date, hour: number, minute: number) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return `${y}/${m}/${d} ${hh}:${mm}`;
};

const SESSION_OPTIONS: { value: SessionType; label: string; icon: typeof Sun }[] = [
  { value: 'full', label: 'Full Day', icon: Sun },
  { value: 'morning', label: 'Morning', icon: Sunrise },
  { value: 'evening', label: 'Evening', icon: Sunset },
  { value: 'night', label: 'Night', icon: Moon },
];

const STATUS_OPTIONS: { value: AttendanceStatus; label: string; icon: typeof UserCheck; color: string }[] = [
  { value: 'present', label: 'Present', icon: UserCheck, color: 'text-emerald-600' },
  { value: 'online_present', label: 'Online Present', icon: Video, color: 'text-violet-600' },
  { value: 'absent', label: 'Absent', icon: UserX, color: 'text-rose-600' },
  { value: 'holiday', label: 'Holiday', icon: Sun, color: 'text-blue-600' },
  { value: 'half_day', label: 'Half Day', icon: Clock, color: 'text-amber-600' },
];

const SOURCE_OPTIONS: { value: AttendanceSource; label: string }[] = [
  { value: 'manual', label: 'Manual' },
  { value: 'meet_join', label: 'Meet Join' },
  { value: 'essl', label: 'ESSL' },
];

const UNMARKED_STATUS_VALUE = '__unmarked__';

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'present':
      return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
    case 'online_present':
      return 'bg-violet-500/10 text-violet-600 border-violet-500/20';
    case 'absent':
      return 'bg-rose-500/10 text-rose-600 border-rose-500/20';
    case 'holiday':
      return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
    case 'half_day':
      return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'present':
      return <UserCheck className="w-3 h-3 mr-1" />;
    case 'online_present':
      return <Video className="w-3 h-3 mr-1" />;
    case 'absent':
      return <UserX className="w-3 h-3 mr-1" />;
    case 'holiday':
      return <Sun className="w-3 h-3 mr-1" />;
    case 'half_day':
      return <Clock className="w-3 h-3 mr-1" />;
    default:
      return null;
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'present': return 'Present';
    case 'online_present': return 'Online Present';
    case 'absent': return 'Absent';
    case 'holiday': return 'Holiday';
    case 'half_day': return 'Half Day';
    default: return '-';
  }
};

// ── Student Attendance View Component ─────────────────────
function StudentAttendanceView() {
  const { user } = useAuth();
  const { branchVersion } = useBranch();
  const [loading, setLoading] = useState(true);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [stats, setStats] = useState({ present: 0, online_present: 0, absent: 0, late: 0, holiday: 0, half_day: 0, total: 0, percentage: 0 });

  useEffect(() => {
    if (user?.id && user?.organizationId) {
      fetchMyAttendance();
    }
  }, [user?.id, user?.organizationId, branchVersion]);

  const fetchMyAttendance = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select('id, date, status, class_id, marked_at, session, attendance_source')
        .eq('student_id', user!.id)
        .eq('organization_id', user!.organizationId!)
        .order('date', { ascending: true });

      if (error) throw error;
      const records = data || [];
      setAttendanceRecords(records);

      const present = records.filter((r: any) => r.status === 'present').length;
      const online_present = records.filter((r: any) => r.status === 'online_present').length;
      const absent = records.filter((r: any) => r.status === 'absent').length;
      const late = records.filter((r: any) => r.status === 'late').length;
      const holiday = records.filter((r: any) => r.status === 'holiday').length;
      const half_day = records.filter((r: any) => r.status === 'half_day').length;
      const total = records.length;
      setStats({
        present, online_present, absent, late, holiday, half_day, total,
        percentage: total > 0 ? Math.round(((present + online_present) / total) * 100) : 0,
      });

      const monthMap: Record<string, { present: number; online_present: number; absent: number; late: number; holiday: number; half_day: number; total: number }> = {};
      records.forEach((r: any) => {
        const monthKey = new Date(r.date).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
        if (!monthMap[monthKey]) monthMap[monthKey] = { present: 0, online_present: 0, absent: 0, late: 0, holiday: 0, half_day: 0, total: 0 };
        monthMap[monthKey].total++;
        if (r.status === 'present') monthMap[monthKey].present++;
        else if (r.status === 'online_present') monthMap[monthKey].online_present++;
        else if (r.status === 'absent') monthMap[monthKey].absent++;
        else if (r.status === 'late') monthMap[monthKey].late++;
        else if (r.status === 'holiday') monthMap[monthKey].holiday++;
        else if (r.status === 'half_day') monthMap[monthKey].half_day++;
      });
      setChartData(
        Object.entries(monthMap).map(([month, d]) => ({
          month, present: d.present, online_present: d.online_present, absent: d.absent, late: d.late,
          holiday: d.holiday, half_day: d.half_day,
          percentage: d.total > 0 ? Math.round(((d.present + d.online_present) / d.total) * 100) : 0,
        }))
      );
    } catch (err) {
      console.error('Failed to fetch student attendance:', err);
    } finally {
      setLoading(false);
    }
  };

  const pieData = [
    { name: 'Present', value: stats.present, color: '#10b981' },
    { name: 'Online Present', value: stats.online_present, color: '#8b5cf6' },
    { name: 'Absent', value: stats.absent, color: '#ef4444' },
    { name: 'Late', value: stats.late, color: '#f59e0b' },
    { name: 'Holiday', value: stats.holiday, color: '#3b82f6' },
    { name: 'Half Day', value: stats.half_day, color: '#f97316' },
  ].filter((d) => d.value > 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="text-muted-foreground">Loading your attendance...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">My Attendance</h1>
        <p className="text-muted-foreground mt-1">Your individual attendance record and statistics</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Classes</p>
                <p className="text-3xl font-bold text-foreground">{stats.total}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Present</p>
                <p className="text-3xl font-bold text-emerald-600">{stats.present}</p>
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
                <p className="text-3xl font-bold text-rose-600">{stats.absent}</p>
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
                <p className="text-3xl font-bold text-violet-600">{stats.percentage}%</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center">
                <Activity className="w-6 h-6 text-violet-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {chartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="border shadow-card lg:col-span-2">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">Monthly Attendance</CardTitle>
                  <CardDescription>Your attendance breakdown by month</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="present" name="Present" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="online_present" name="Online Present" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="absent" name="Absent" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="holiday" name="Holiday" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="half_day" name="Half Day" fill="#f97316" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border shadow-card">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                  <PieChart className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">Overall Summary</CardTitle>
                  <CardDescription>Total attendance ratio</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <RechartsPieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </RechartsPieChart>
              </ResponsiveContainer>
              <div className="text-center mt-2">
                <p className="text-2xl font-bold text-primary">{stats.percentage}%</p>
                <p className="text-xs text-muted-foreground">Overall Attendance</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="border shadow-card">
        <CardHeader>
          <CardTitle className="text-lg">Recent Attendance</CardTitle>
          <CardDescription>Your attendance history (last 30 records)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Date</TableHead>
                  <TableHead>Session</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Marked At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendanceRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <Calendar className="w-10 h-10 text-muted-foreground/40" />
                        <p>No attendance records found.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  [...attendanceRecords].reverse().slice(0, 30).map((record: any, idx: number) => (
                    <TableRow key={record.id} className="animate-fade-in" style={{ animationDelay: `${idx * 30}ms` }}>
                      <TableCell className="font-medium">
                        {new Date(record.date).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{record.session || 'Full Day'}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getStatusBadge(record.status)}>
                          {getStatusIcon(record.status)}
                          {getStatusLabel(record.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{record.attendance_source || 'manual'}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {record.marked_at ? new Date(record.marked_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────
export default function AttendancePage() {
  const { user } = useAuth();
  const { currentBranchId, branchVersion } = useBranch();
  const { toast } = useToast();
  const canAccessStaffAttendance = user?.role === 'admin' || user?.role === 'super_admin';
  const canAccessLeaveRequests = user?.role !== 'batch_coordinator';
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('students');
  const [studentStatusFilter, setStudentStatusFilter] = useState<'all' | AttendanceStatus>('all');
  const [studentSourceFilter, setStudentSourceFilter] = useState<'all' | AttendanceSource>('all');

  // Date picker state
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  // Session state
  const [activeSession, setActiveSession] = useState<SessionType>('full');

  // People lists
  const [studentList, setStudentList] = useState<PersonEntry[]>([]);
  const [staffList, setStaffList] = useState<PersonEntry[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [staffLoading, setStaffLoading] = useState(false);

  // Attendance records
  const [studentAttendance, setStudentAttendance] = useState<AttendanceEntry[]>([]);
  const [staffAttendance, setStaffAttendance] = useState<AttendanceEntry[]>([]);
  const [attendanceRefreshKey, setAttendanceRefreshKey] = useState(0);
  const [isEsslSyncing, setIsEsslSyncing] = useState(false);
  const [esslSyncSummary, setEsslSyncSummary] = useState<EsslAttendanceSyncResult | null>(null);

  // Leave requests
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [leavesLoading, setLeavesLoading] = useState(false);
  // Leave batch filter
  const [leaveBatchId, setLeaveBatchId] = useState<string>('all');

  // Batch filter state
  const [batchList, setBatchList] = useState<BatchItem[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('all');
  const [batchStudentIds, setBatchStudentIds] = useState<Set<string> | null>(null);

  const selectedDateStr = useMemo(() => formatDateStr(selectedDate), [selectedDate]);

  // ── Fetch students ──────────────────────────────────────
  useEffect(() => {
    const fetchStudents = async () => {
      if (!user?.organizationId) return;
      setStudentsLoading(true);
      try {
        let query = supabase
          .from('profiles')
          .select('id, full_name, role')
          .eq('organization_id', user.organizationId)
          .eq('role', 'student');
        if (currentBranchId) query = query.eq('branch_id', currentBranchId);
        const { data, error } = await query;
        if (error) throw error;
        if (data) {
          setStudentList(data.map((d: any) => ({ id: d.id, name: d.full_name || 'Unknown', role: d.role || 'student' })));
        }
      } catch (err) {
        console.error('Failed to fetch students:', err);
      } finally {
        setStudentsLoading(false);
      }
    };
    fetchStudents();
  }, [user?.organizationId, branchVersion]);

  // ── Fetch batches ───────────────────────────────────────
  useEffect(() => {
    const fetchBatches = async () => {
      if (!user?.organizationId) return;
      try {
        const data = await batchService.getBatches(user.organizationId, currentBranchId);

        // Fetch all students to parse their batch IDs flexibly
        const { data: allStudents } = await supabase
          .from('profiles')
          .select('id, metadata')
          .eq('organization_id', user.organizationId)
          .eq('role', 'student');

        const batchesWithStudents: BatchItem[] = data.map(b => ({ id: b.id, name: b.name, student_ids: [] }));

        if (allStudents) {
          allStudents.forEach(p => {
            let bId = null;
            if (typeof p.metadata === 'string') {
              try { const m = JSON.parse(p.metadata); bId = m.batch_id || m.batch || m.batchId; } catch { }
            } else if (p.metadata && typeof p.metadata === 'object') {
              const m = p.metadata as any;
              bId = m.batch_id || m.batch || m.batchId;
            }
            if (bId) {
              const batch = batchesWithStudents.find(b => b.id === bId);
              if (batch) batch.student_ids!.push(p.id);
            }
          });
        }
        setBatchList(batchesWithStudents);
      } catch (err) {
        console.error('Failed to fetch batches:', err);
      }
    };
    fetchBatches();
  }, [user?.organizationId, currentBranchId, branchVersion]);

  // ── Update batch student filter ────────────────────────
  useEffect(() => {
    if (selectedBatchId === 'all') {
      setBatchStudentIds(null);
    } else {
      const batch = batchList.find(b => b.id === selectedBatchId);
      if (batch?.student_ids) {
        setBatchStudentIds(new Set(batch.student_ids));
      } else {
        setBatchStudentIds(new Set());
      }
    }
  }, [selectedBatchId, batchList]);

  // ── Fetch staff ─────────────────────────────────────────
  useEffect(() => {
    const fetchStaff = async () => {
      if (!canAccessStaffAttendance) {
        setStaffList([]);
        return;
      }
      if (!user?.organizationId) return;
      setStaffLoading(true);
      try {
        let query = supabase
          .from('profiles')
          .select('id, full_name, role')
          .eq('organization_id', user.organizationId)
          .neq('role', 'student');
        if (currentBranchId) query = query.eq('branch_id', currentBranchId);
        const { data, error } = await query;
        if (error) throw error;
        if (data) {
          setStaffList(data.map((d: any) => ({ id: d.id, name: d.full_name || 'Unknown', role: d.role || 'staff' })));
        }
      } catch (err) {
        console.error('Failed to fetch staff:', err);
      } finally {
        setStaffLoading(false);
      }
    };
    fetchStaff();
  }, [canAccessStaffAttendance, user?.organizationId, branchVersion, currentBranchId]);

  // ── Fetch leave requests ────────────────────────────────
  useEffect(() => {
    const fetchLeaveRequests = async () => {
      if (!user?.organizationId) return;
      setLeavesLoading(true);
      try {
        const { data, error } = await supabase
          .from('leave_requests')
          .select('*')
          .eq('organization_id', user.organizationId)
          .order('created_at', { ascending: false });
        if (error) throw error;
        const studentIds = [...new Set((data || []).map((r: any) => r.student_id))];
        let studentMap: Record<string, { name: string; batch_id?: string; branch_id?: string | null }> = {};
        if (studentIds.length > 0) {
          const { data: profiles } = await supabase.from('profiles').select('id, full_name, metadata, branch_id').in('id', studentIds);
          (profiles || []).forEach((p: any) => {
            let batchId = null;
            if (typeof p.metadata === 'string') {
              try { const m = JSON.parse(p.metadata); batchId = m.batch_id || m.batch || m.batchId; } catch { }
            } else if (p.metadata && typeof p.metadata === 'object') {
              const m = p.metadata as any;
              batchId = m.batch_id || m.batch || m.batchId;
            }
            studentMap[p.id] = { name: p.full_name, batch_id: batchId, branch_id: p.branch_id };
          });
        }
        // Filter leave requests by branch (via student's branch_id)
        const filteredData = currentBranchId
          ? (data || []).filter((r: any) => studentMap[r.student_id]?.branch_id === currentBranchId)
          : (data || []);
        setLeaveRequests(filteredData.map((r: any) => ({
          ...r,
          student_name: studentMap[r.student_id]?.name || 'Unknown Student',
          student_batch_id: studentMap[r.student_id]?.batch_id || null
        })));
      } catch (err) {
        console.error('Failed to fetch leave requests:', err);
      } finally {
        setLeavesLoading(false);
      }
    };
    fetchLeaveRequests();
  }, [user?.organizationId, branchVersion]);

  // ── Load attendance for selected date + session ─────────
  useEffect(() => {
    const fetchDateAttendance = async () => {
      if (!user?.organizationId) return;
      try {
        let query = supabase
          .from('attendance')
          .select('id, student_id, status, marked_at, date, session, attendance_source')
          .eq('organization_id', user.organizationId)
          .eq('date', selectedDateStr);

        if (activeSession === 'full') {
          query = query.or('session.is.null,session.eq.full');
        } else {
          query = query.eq('session', activeSession);
        }
        if (currentBranchId) query = query.eq('branch_id', currentBranchId);

        const { data, error } = await query;
        if (error) { console.error('Failed to fetch attendance:', error); return; }

        const studentIds = new Set(studentList.map(s => s.id));
        const staffIds = new Set(staffList.map(s => s.id));
        const studentEntries: AttendanceEntry[] = [];
        const staffEntries: AttendanceEntry[] = [];

        for (const record of (data || [])) {
          const entry: AttendanceEntry = {
            date: record.date,
            personId: record.student_id,
            personName: '',
            status: record.status as AttendanceStatus,
            source: (record.attendance_source as AttendanceSource) || 'manual',
            session: record.session,
            markedAt: record.marked_at || undefined,
          };
          if (studentIds.has(record.student_id)) {
            entry.personName = studentList.find(s => s.id === record.student_id)?.name || 'Unknown';
            studentEntries.push(entry);
          } else if (staffIds.has(record.student_id)) {
            entry.personName = staffList.find(s => s.id === record.student_id)?.name || 'Unknown';
            staffEntries.push(entry);
          }
        }
        setStudentAttendance(studentEntries);
        setStaffAttendance(staffEntries);
      } catch (err) {
        console.error('Failed to load attendance from Supabase:', err);
      }
    };
    fetchDateAttendance();
  }, [user?.organizationId, branchVersion, studentList, staffList, selectedDateStr, activeSession, attendanceRefreshKey]);

  const handleSyncEsslLogs = useCallback(async () => {
    try {
      setIsEsslSyncing(true);
      const result = await syncEsslAttendance(
        formatEsslDateTime(selectedDate, 0, 0),
        formatEsslDateTime(selectedDate, 23, 59),
      );
      setEsslSyncSummary(result);
      setAttendanceRefreshKey((current) => current + 1);
      toast({
        title: 'ESSL sync completed',
        description: `${result.syncedRecords} attendance record(s) synced from ${result.totalLogs} device log(s).`,
      });
    } catch (error) {
      console.error('ESSL sync failed:', error);
      toast({
        title: 'ESSL sync failed',
        description: error instanceof Error ? error.message : 'Could not sync attendance from ESSL',
        variant: 'destructive',
      });
    } finally {
      setIsEsslSyncing(false);
    }
  }, [selectedDate, toast]);

  // ── Build list helpers ──────────────────────────────────
  const buildDateList = (people: PersonEntry[], attendance: AttendanceEntry[]) => {
    const dateRecords = attendance.filter((r) => r.date === selectedDateStr);
    const recordMap = new Map(dateRecords.map((r) => [r.personId, r]));
    return people.map((p) => {
      const record = recordMap.get(p.id);
      return { ...p, status: record?.status || null, source: record?.source, markedAt: record?.markedAt };
    });
  };

  const dateStudents = useMemo(() => buildDateList(studentList, studentAttendance), [studentList, studentAttendance, selectedDateStr]);
  const dateStaff = useMemo(() => buildDateList(staffList, staffAttendance), [staffList, staffAttendance, selectedDateStr]);

  const filteredStudents = useMemo(
    () => {
      let list = dateStudents;
      if (batchStudentIds) {
        list = list.filter(s => batchStudentIds.has(s.id));
      }
      if (studentStatusFilter !== 'all') {
        list = list.filter((s) => s.status === studentStatusFilter);
      }
      if (studentSourceFilter !== 'all') {
        list = list.filter((s) => s.source === studentSourceFilter);
      }
      return list.filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()));
    },
    [dateStudents, searchQuery, batchStudentIds, studentStatusFilter, studentSourceFilter]
  );

  // ── Sync attendance to Supabase ─────────────────────────
  const syncAttendanceToSupabase = useCallback(
    async (personId: string, status: AttendanceStatus, source: AttendanceSource = 'manual') => {
      if (!user?.organizationId) return;
      try {
        const sessionVal = activeSession === 'full' ? null : activeSession;
        let matchQuery = supabase
          .from('attendance')
          .select('id')
          .eq('student_id', personId)
          .eq('date', selectedDateStr)
          .eq('organization_id', user.organizationId);
        if (sessionVal) {
          matchQuery = matchQuery.eq('session', sessionVal);
        } else {
          matchQuery = matchQuery.or('session.is.null,session.eq.full');
        }
        const { data: existing } = await matchQuery.maybeSingle();

        if (existing) {
          await supabase.from('attendance').update({ status, attendance_source: source, marked_at: new Date().toISOString(), marked_by: user.id }).eq('id', existing.id);
        } else {
          let branchId = currentBranchId;
          if (!branchId) {
            const { data: prof } = await supabase.from('profiles').select('branch_id').eq('id', user.id).maybeSingle();
            branchId = prof?.branch_id ?? null;
          }
          await supabase.from('attendance').insert({
            organization_id: user.organizationId,
            student_id: personId,
            date: selectedDateStr,
            status,
            attendance_source: source,
            session: sessionVal,
            marked_at: new Date().toISOString(),
            marked_by: user.id,
            ...(branchId ? { branch_id: branchId } : {}),
          } as any);
        }
      } catch (err) {
        console.error('Failed to sync attendance to Supabase:', err);
      }
    },
    [user?.organizationId, user?.id, selectedDateStr, currentBranchId, activeSession]
  );

  const toggleStatus = useCallback(
    (personId: string, newStatus: AttendanceStatus, people: PersonEntry[], setter: React.Dispatch<React.SetStateAction<AttendanceEntry[]>>) => {
      const person = people.find((p) => p.id === personId);
      if (!person) return;
      setter((prev) => {
        const filtered = prev.filter((r) => !(r.personId === personId && r.date === selectedDateStr));
        filtered.push({
          date: selectedDateStr, personId, personName: person.name, status: newStatus,
          source: 'manual',
          session: activeSession === 'full' ? null : activeSession, markedAt: new Date().toISOString(),
        });
        return filtered;
      });
      syncAttendanceToSupabase(personId, newStatus, 'manual');
    },
    [selectedDateStr, syncAttendanceToSupabase, activeSession]
  );

  const markAllStatus = useCallback(
    (people: PersonEntry[], setter: React.Dispatch<React.SetStateAction<AttendanceEntry[]>>, status: AttendanceStatus) => {
      setter((prev) => {
        const filtered = prev.filter((r) => r.date !== selectedDateStr);
        const newEntries = people.map((p) => ({
          date: selectedDateStr, personId: p.id, personName: p.name, status,
          source: 'manual' as AttendanceSource,
          session: activeSession === 'full' ? null : activeSession, markedAt: new Date().toISOString(),
        }));
        return [...filtered, ...newEntries];
      });
      people.forEach((p) => syncAttendanceToSupabase(p.id, status, 'manual'));
    },
    [selectedDateStr, syncAttendanceToSupabase, activeSession]
  );

  // ── Stats ───────────────────────────────────────────────
  const computeStats = (dateList: { status: string }[], totalPeople: number) => {
    const present = dateList.filter((s) => s.status === 'present').length;
    const online_present = dateList.filter((s) => s.status === 'online_present').length;
    const absent = dateList.filter((s) => s.status === 'absent').length;
    const holiday = dateList.filter((s) => s.status === 'holiday').length;
    const half_day = dateList.filter((s) => s.status === 'half_day').length;
    const percentage = totalPeople > 0 ? Math.round(((present + online_present) / totalPeople) * 100) : 0;
    return { present, online_present, absent, holiday, half_day, total: totalPeople, percentage };
  };

  const studentStats = useMemo(() => computeStats(dateStudents, studentList.length), [dateStudents, studentList]);
  const staffStats = useMemo(() => computeStats(dateStaff, staffList.length), [dateStaff, staffList]);

  // ── Leave batch filter logic ───────────────────────────
  const filteredLeaveRequests = leaveBatchId === 'all'
    ? leaveRequests
    : leaveRequests.filter((r) => r.student_batch_id === leaveBatchId);

  // ── Render helpers ──────────────────────────────────────
  const renderStatsCards = (stats: { present: number; online_present: number; absent: number; holiday: number; half_day: number; total: number; percentage: number }) => (
    <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
      <Card className="border shadow-card"><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Present</p><p className="text-3xl font-bold text-emerald-600">{stats.present}</p></div><div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center"><UserCheck className="w-6 h-6 text-emerald-600" /></div></div></CardContent></Card>
      <Card className="border shadow-card"><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Online Present</p><p className="text-3xl font-bold text-violet-600">{stats.online_present}</p></div><div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center"><Video className="w-6 h-6 text-violet-600" /></div></div></CardContent></Card>
      <Card className="border shadow-card"><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Absent</p><p className="text-3xl font-bold text-rose-600">{stats.absent}</p></div><div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center"><UserX className="w-6 h-6 text-rose-600" /></div></div></CardContent></Card>
      <Card className="border shadow-card"><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Holiday</p><p className="text-3xl font-bold text-blue-600">{stats.holiday}</p></div><div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center"><Sun className="w-6 h-6 text-blue-600" /></div></div></CardContent></Card>
      <Card className="border shadow-card"><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Half Day</p><p className="text-3xl font-bold text-amber-600">{stats.half_day}</p></div><div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center"><Clock className="w-6 h-6 text-amber-600" /></div></div></CardContent></Card>
      <Card className="border shadow-card"><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Attendance %</p><p className="text-3xl font-bold text-violet-600">{stats.percentage}%</p></div><div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center"><TrendingUp className="w-6 h-6 text-violet-600" /></div></div></CardContent></Card>
    </div>
  );

  const renderAttendanceTable = (
    people: { id: string; name: string; role: string; status: AttendanceStatus | null; source?: AttendanceSource; markedAt?: string }[],
    personList: PersonEntry[],
    setter: React.Dispatch<React.SetStateAction<AttendanceEntry[]>>,
    loading: boolean,
    emptyIcon: React.ReactNode,
    emptyText: string
  ) => (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>Name</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground">Loading...</TableCell></TableRow>
          ) : people.length === 0 ? (
            <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground"><div className="flex flex-col items-center gap-2">{emptyIcon}<p>{emptyText}</p></div></TableCell></TableRow>
          ) : (
            people.map((person, idx) => (
              <TableRow key={person.id} className="animate-fade-in" style={{ animationDelay: `${idx * 40}ms` }}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="w-9 h-9"><AvatarFallback className="bg-primary/10 text-primary text-sm">{person.name.charAt(0)}</AvatarFallback></Avatar>
                    <span className="font-medium text-foreground">{person.name}</span>
                  </div>
                </TableCell>
                <TableCell><Badge variant="outline" className="capitalize">{person.role}</Badge></TableCell>
                <TableCell>
                  {person.status ? (
                    <Badge variant="outline" className={getStatusBadge(person.status)}>
                      {getStatusIcon(person.status)}
                      {getStatusLabel(person.status)}
                    </Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  {person.source ? (
                    <Badge variant="outline" className="capitalize">{person.source}</Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <Select
                    value={person.status ?? UNMARKED_STATUS_VALUE}
                    onValueChange={(val) => {
                      if (val === UNMARKED_STATUS_VALUE) return;
                      toggleStatus(person.id, val as AttendanceStatus, personList, setter);
                    }}
                  >
                    <SelectTrigger className="w-36 h-8"><SelectValue placeholder="Mark status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNMARKED_STATUS_VALUE}>-</SelectItem>
                      {STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <span className="flex items-center gap-1"><opt.icon className={cn("w-3 h-3", opt.color)} />{opt.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );

  // ── Student view ────────────────────────────────────────
  if (user?.role === 'student') return <StudentAttendanceView />;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">Attendance Tracking</h1>
          <p className="text-muted-foreground mt-1">Manage student and staff attendance</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline"><Download className="w-4 h-4 mr-2" />Export</Button>
        </div>
      </div>

      {/* Date Picker & Session Selector */}
      <Card className="border shadow-card">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            {/* Date Picker */}
            <div className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Date:</span>
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[240px] justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}>
                    <Calendar className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, 'EEEE, dd MMM yyyy') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => { if (date) { setSelectedDate(date); setDatePickerOpen(false); } }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <div className="hidden sm:flex items-center gap-1">
                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { const y = new Date(); y.setDate(y.getDate() - 1); setSelectedDate(y); }}>Yesterday</Button>
                <Button variant="ghost" size="sm" className={cn("h-8 text-xs", formatDateStr(new Date()) === selectedDateStr && "bg-primary/10 text-primary")} onClick={() => setSelectedDate(new Date())}>Today</Button>
                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { const t = new Date(); t.setDate(t.getDate() + 1); setSelectedDate(t); }}>Tomorrow</Button>
              </div>
            </div>

            {/* Session Selector */}
            <div className="flex items-center gap-2 sm:ml-auto">
              <span className="text-sm font-medium text-muted-foreground">Session:</span>
              <div className="flex bg-muted rounded-lg p-1 gap-1">
                {SESSION_OPTIONS.map((session) => {
                  const Icon = session.icon;
                  return (
                    <Button
                      key={session.value}
                      variant={activeSession === session.value ? 'default' : 'ghost'}
                      size="sm"
                      className={cn("h-8 text-xs gap-1", activeSession === session.value && "shadow-sm")}
                      onClick={() => setActiveSession(session.value)}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {session.label}
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Mobile quick date buttons */}
          <div className="flex sm:hidden items-center gap-1 mt-3">
            <Button variant="ghost" size="sm" className="h-8 text-xs flex-1" onClick={() => { const y = new Date(); y.setDate(y.getDate() - 1); setSelectedDate(y); }}>Yesterday</Button>
            <Button variant="ghost" size="sm" className={cn("h-8 text-xs flex-1", formatDateStr(new Date()) === selectedDateStr && "bg-primary/10 text-primary")} onClick={() => setSelectedDate(new Date())}>Today</Button>
            <Button variant="ghost" size="sm" className="h-8 text-xs flex-1" onClick={() => { const t = new Date(); t.setDate(t.getDate() + 1); setSelectedDate(t); }}>Tomorrow</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border shadow-card">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-foreground">ESSL Attendance Sync</p>
              <p className="text-sm text-muted-foreground">Pull punch logs from the ESSL device for the selected date and mark matched users as present.</p>
            </div>
            <Button variant="outline" onClick={handleSyncEsslLogs} disabled={isEsslSyncing}>
              {isEsslSyncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              {isEsslSyncing ? 'Syncing...' : 'Sync ESSL Logs'}
            </Button>
          </div>

          {esslSyncSummary && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Total Logs</p>
                  <p className="text-2xl font-semibold">{esslSyncSummary.totalLogs}</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Matched</p>
                  <p className="text-2xl font-semibold text-emerald-600">{esslSyncSummary.matchedLogs}</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Synced</p>
                  <p className="text-2xl font-semibold text-primary">{esslSyncSummary.syncedRecords}</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Unmatched</p>
                  <p className="text-2xl font-semibold text-amber-600">{esslSyncSummary.unmatchedLogs}</p>
                </div>
              </div>

              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Name</TableHead>
                      <TableHead>Employee Code</TableHead>
                      <TableHead>Card</TableHead>
                      <TableHead>Punch Time</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {esslSyncSummary.preview.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">No ESSL transactions were returned for this date.</TableCell>
                      </TableRow>
                    ) : (
                      esslSyncSummary.preview.map((item, index) => (
                        <TableRow key={`${item.employeeCode || item.cardNumber || 'preview'}-${index}`}>
                          <TableCell className="font-medium">{item.personName || 'Unmatched'}</TableCell>
                          <TableCell>{item.employeeCode || '—'}</TableCell>
                          <TableCell>{item.cardNumber || '—'}</TableCell>
                          <TableCell>{item.timestamp ? new Date(item.timestamp).toLocaleString('en-IN') : '—'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={item.matched ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 border-amber-500/20'}>
                              {item.matched ? 'Matched' : 'Unmatched'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="students" className="gap-2"><GraduationCap className="w-4 h-4" />Students ({studentList.length})</TabsTrigger>
          {canAccessStaffAttendance && (
            <TabsTrigger value="staff" className="gap-2"><Users className="w-4 h-4" />Staff ({staffList.length})</TabsTrigger>
          )}
          {canAccessLeaveRequests && (
            <TabsTrigger value="leaves" className="gap-2"><CalendarCheck className="w-4 h-4" />Leaves ({leaveRequests.length})</TabsTrigger>
          )}
        </TabsList>

        {/* STUDENTS TAB */}
        <TabsContent value="students" className="space-y-6">
          {renderStatsCards(studentStats)}
          <Card className="border shadow-card">
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle className="text-lg">Student Attendance — {format(selectedDate, 'dd MMM yyyy')}{activeSession !== 'full' ? ` (${activeSession.charAt(0).toUpperCase() + activeSession.slice(1)})` : ''}</CardTitle>
                  <CardDescription>Use the dropdown to mark individual attendance. Unmarked entries stay as - until you select a status.</CardDescription>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="Search students..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 w-56" />
                  </div>
                  {/* Batch Filter */}
                  <Select value={selectedBatchId} onValueChange={setSelectedBatchId}>
                    <SelectTrigger className="w-48">
                      <Users className="w-4 h-4 mr-2 text-muted-foreground" />
                      <SelectValue placeholder="All Students" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Students</SelectItem>
                      {batchList.map(batch => (
                        <SelectItem key={batch.id} value={batch.id}>
                          {batch.name} ({batch.student_ids?.length || 0})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={studentStatusFilter} onValueChange={(v) => setStudentStatusFilter(v as 'all' | AttendanceStatus)}>
                    <SelectTrigger className="w-48">
                      <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      {STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={studentSourceFilter} onValueChange={(v) => setStudentSourceFilter(v as 'all' | AttendanceSource)}>
                    <SelectTrigger className="w-44">
                      <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
                      <SelectValue placeholder="All Sources" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sources</SelectItem>
                      {SOURCE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20" onClick={() => markAllStatus(studentList, setStudentAttendance, 'present')}>
                    <CheckCircle className="w-4 h-4 mr-2" />All Present
                  </Button>
                  <Button variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20 hover:bg-blue-500/20" onClick={() => markAllStatus(studentList, setStudentAttendance, 'holiday')}>
                    <Sun className="w-4 h-4 mr-2" />Holiday
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {renderAttendanceTable(filteredStudents, studentList, setStudentAttendance, studentsLoading, <GraduationCap className="w-10 h-10 text-muted-foreground/40" />, 'No students found in your organization.')}
            </CardContent>
          </Card>
        </TabsContent>

        {/* STAFF TAB */}
        {canAccessStaffAttendance && (
        <TabsContent value="staff" className="space-y-6">
          {renderStatsCards(staffStats)}
          <Card className="border shadow-card">
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle className="text-lg">Staff Attendance — {format(selectedDate, 'dd MMM yyyy')}{activeSession !== 'full' ? ` (${activeSession.charAt(0).toUpperCase() + activeSession.slice(1)})` : ''}</CardTitle>
                  <CardDescription>Use the dropdown to mark individual attendance.</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20" onClick={() => markAllStatus(staffList, setStaffAttendance, 'present')}>
                    <CheckCircle className="w-4 h-4 mr-2" />All Present
                  </Button>
                  <Button variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20 hover:bg-blue-500/20" onClick={() => markAllStatus(staffList, setStaffAttendance, 'holiday')}>
                    <Sun className="w-4 h-4 mr-2" />Holiday
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {renderAttendanceTable(dateStaff, staffList, setStaffAttendance, staffLoading, <Users className="w-10 h-10 text-muted-foreground/40" />, 'No staff/teachers found in your organization.')}
            </CardContent>
          </Card>
        </TabsContent>
        )}

        {/* LEAVES TAB */}
        {canAccessLeaveRequests && (
        <TabsContent value="leaves" className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border shadow-card"><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Total</p><p className="text-3xl font-bold text-foreground">{filteredLeaveRequests.length}</p></div><div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center"><FileText className="w-6 h-6 text-primary" /></div></div></CardContent></Card>
            <Card className="border shadow-card"><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Pending</p><p className="text-3xl font-bold text-amber-600">{filteredLeaveRequests.filter((r) => r.status === 'pending').length}</p></div><div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center"><Clock className="w-6 h-6 text-amber-600" /></div></div></CardContent></Card>
            <Card className="border shadow-card"><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Approved</p><p className="text-3xl font-bold text-emerald-600">{filteredLeaveRequests.filter((r) => r.status === 'approved').length}</p></div><div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center"><CheckCircle className="w-6 h-6 text-emerald-600" /></div></div></CardContent></Card>
            <Card className="border shadow-card"><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Rejected</p><p className="text-3xl font-bold text-rose-600">{filteredLeaveRequests.filter((r) => r.status === 'rejected').length}</p></div><div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center"><UserX className="w-6 h-6 text-rose-600" /></div></div></CardContent></Card>
          </div>

          <div className="flex flex-wrap gap-2 items-center mt-2">
            <span className="text-sm text-muted-foreground">Filter by Batch:</span>
            <Select value={leaveBatchId} onValueChange={setLeaveBatchId}>
              <SelectTrigger className="w-48">
                <Users className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="All Batches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Batches</SelectItem>
                {batchList.map(batch => (
                  <SelectItem key={batch.id} value={batch.id}>
                    {batch.name} ({batch.student_ids?.length || 0})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card className="border shadow-card mt-2">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Student Leave Requests</CardTitle>
              <CardDescription>All leave requests from students. Approved leaves are automatically reflected in attendance records.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Student</TableHead>
                      <TableHead>Batch</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Requested Date</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leavesLoading ? (
                      <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground">Loading leave requests...</TableCell></TableRow>
                    ) : filteredLeaveRequests.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground"><div className="flex flex-col items-center gap-2"><CalendarCheck className="w-10 h-10 text-muted-foreground/40" /><p>No leave requests found.</p></div></TableCell></TableRow>
                    ) : (
                      filteredLeaveRequests.map((request: any, idx: number) => {
                        const batchName = batchList.find(b => b.id === request.student_batch_id)?.name || '-';
                        return (
                          <TableRow key={request.id} className="animate-fade-in" style={{ animationDelay: `${idx * 40}ms` }}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar className="w-8 h-8"><AvatarFallback className="bg-primary/10 text-primary text-sm">{request.student_name?.charAt(0) || '?'}</AvatarFallback></Avatar>
                                <span className="font-medium text-sm">{request.student_name}</span>
                              </div>
                            </TableCell>
                            <TableCell><Badge variant="outline">{batchName}</Badge></TableCell>
                            <TableCell><p className="text-sm max-w-[300px] truncate">{request.reason}</p></TableCell>
                            <TableCell>
                              <p className="text-sm">{request.requested_date ? new Date(request.requested_date).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) : '-'}</p>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={
                                request.status === 'approved' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                                  request.status === 'rejected' ? 'bg-rose-500/10 text-rose-600 border-rose-500/20' :
                                    'bg-amber-500/10 text-amber-600 border-amber-500/20'
                              }>
                                {request.status === 'approved' && <CheckCircle className="w-3 h-3 mr-1" />}
                                {request.status === 'rejected' && <UserX className="w-3 h-3 mr-1" />}
                                {request.status === 'pending' && <Clock className="w-3 h-3 mr-1" />}
                                {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card className="border shadow-card bg-primary/5">
            <CardContent className="p-4">
              <p className="text-sm text-foreground">
                <strong>Note:</strong> Approved leave requests are automatically marked as "absent (on leave)" in
                the attendance report. To approve or reject pending requests, go to the <strong>Leave Requests</strong> page.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
