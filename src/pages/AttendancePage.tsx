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
import {
  Search,
  Calendar,
  UserCheck,
  UserX,
  Clock,
  Users,
  Download,
  TrendingUp,
  Filter,
  CheckCircle,
  GraduationCap,
  CalendarCheck,
  FileText,
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

// ── Types & Constants ──────────────────────────────────────
interface PersonEntry {
  id: string;
  name: string;
  role: string;
}

interface AttendanceEntry {
  date: string;
  personId: string;
  personName: string;
  status: 'present' | 'absent';
  markedAt?: string;
}

const getToday = () => new Date().toISOString().split('T')[0];

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'present':
      return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
    case 'absent':
      return 'bg-rose-500/10 text-rose-600 border-rose-500/20';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

// ── Student Attendance View Component ─────────────────────
function StudentAttendanceView() {
  const { user } = useAuth();
  const { branchVersion } = useBranch();
  const [loading, setLoading] = useState(true);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [stats, setStats] = useState({ present: 0, absent: 0, late: 0, total: 0, percentage: 0 });

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
        .select('id, date, status, class_id, marked_at')
        .eq('student_id', user!.id)
        .eq('organization_id', user!.organizationId!)
        .order('date', { ascending: true });

      if (error) throw error;
      const records = data || [];
      setAttendanceRecords(records);

      const present = records.filter((r: any) => r.status === 'present').length;
      const absent = records.filter((r: any) => r.status === 'absent').length;
      const late = records.filter((r: any) => r.status === 'late').length;
      const total = records.length;
      setStats({
        present,
        absent,
        late,
        total,
        percentage: total > 0 ? Math.round((present / total) * 100) : 0,
      });

      // Group by month for chart
      const monthMap: Record<string, { present: number; absent: number; late: number; total: number }> = {};
      records.forEach((r: any) => {
        const monthKey = new Date(r.date).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
        if (!monthMap[monthKey]) monthMap[monthKey] = { present: 0, absent: 0, late: 0, total: 0 };
        monthMap[monthKey].total++;
        if (r.status === 'present') monthMap[monthKey].present++;
        else if (r.status === 'absent') monthMap[monthKey].absent++;
        else if (r.status === 'late') monthMap[monthKey].late++;
      });
      setChartData(
        Object.entries(monthMap).map(([month, d]) => ({
          month,
          present: d.present,
          absent: d.absent,
          late: d.late,
          percentage: d.total > 0 ? Math.round((d.present / d.total) * 100) : 0,
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
    { name: 'Absent', value: stats.absent, color: '#ef4444' },
    { name: 'Late', value: stats.late, color: '#f59e0b' },
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
      {/* Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
          My Attendance
        </h1>
        <p className="text-muted-foreground mt-1">
          Your individual attendance record and statistics
        </p>
      </div>

      {/* Stats Cards */}
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

      {/* Charts */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Bar Chart */}
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
                  <Bar dataKey="absent" name="Absent" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="late" name="Late" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Pie Chart */}
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
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
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

      {/* Recent Attendance Records */}
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
                  <TableHead>Status</TableHead>
                  <TableHead>Marked At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendanceRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="h-32 text-center text-muted-foreground">
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
                        <Badge variant="outline" className={
                          record.status === 'present' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                          record.status === 'late' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' :
                          'bg-rose-500/10 text-rose-600 border-rose-500/20'
                        }>
                          {record.status === 'present' ? (
                            <UserCheck className="w-3 h-3 mr-1" />
                          ) : (
                            <UserX className="w-3 h-3 mr-1" />
                          )}
                          {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                        </Badge>
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
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('students');

  // People lists from Supabase
  const [studentList, setStudentList] = useState<PersonEntry[]>([]);
  const [staffList, setStaffList] = useState<PersonEntry[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [staffLoading, setStaffLoading] = useState(false);

  // Attendance records (loaded from Supabase)
  const [studentAttendance, setStudentAttendance] = useState<AttendanceEntry[]>([]);
  const [staffAttendance, setStaffAttendance] = useState<AttendanceEntry[]>([]);

  // Leave requests
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [leavesLoading, setLeavesLoading] = useState(false);

  // ── Fetch students from Supabase ─────────────────────────
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

        if (currentBranchId) {
          query = query.eq('branch_id', currentBranchId);
        }

        const { data, error } = await query;

        if (error) throw error;
        if (data) {
          setStudentList(
            data.map((d: any) => ({
              id: d.id,
              name: d.full_name || 'Unknown',
              role: d.role || 'student',
            }))
          );
        }
      } catch (err) {
        console.error('Failed to fetch students:', err);
      } finally {
        setStudentsLoading(false);
      }
    };
    fetchStudents();
  }, [user?.organizationId, branchVersion]);

  // ── Fetch staff from Supabase ────────────────────────────
  useEffect(() => {
    const fetchStaff = async () => {
      if (!user?.organizationId) return;
      setStaffLoading(true);
      try {
        let query = supabase
          .from('profiles')
          .select('id, full_name, role')
          .eq('organization_id', user.organizationId)
          .in('role', ['teacher', 'faculty', 'staff']);

        if (currentBranchId) {
          query = query.eq('branch_id', currentBranchId);
        }

        const { data, error } = await query;

        if (error) throw error;
        if (data) {
          setStaffList(
            data.map((d: any) => ({
              id: d.id,
              name: d.full_name || 'Unknown',
              role: d.role || 'staff',
            }))
          );
        }
      } catch (err) {
        console.error('Failed to fetch staff:', err);
      } finally {
        setStaffLoading(false);
      }
    };
    fetchStaff();
  }, [user?.organizationId, branchVersion]);

  // ── Fetch leave requests from Supabase ───────────────────
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

        setLeaveRequests(
          (data || []).map((r: any) => ({
            ...r,
            student_name: studentMap[r.student_id] || 'Unknown Student',
          }))
        );
      } catch (err) {
        console.error('Failed to fetch leave requests:', err);
      } finally {
        setLeavesLoading(false);
      }
    };
    fetchLeaveRequests();
  }, [user?.organizationId, branchVersion]);

  // ── Load today's attendance from Supabase ──────────────────
  useEffect(() => {
    const fetchTodayAttendance = async () => {
      if (!user?.organizationId) return;
      try {
        const todayDate = getToday();
        let query = supabase
          .from('attendance')
          .select('id, student_id, status, marked_at, date')
          .eq('organization_id', user.organizationId)
          .eq('date', todayDate);

        if (currentBranchId) {
          query = query.eq('branch_id', currentBranchId);
        }

        const { data, error } = await query;
        if (error) {
          console.error('Failed to fetch today attendance:', error);
          return;
        }

        if (data && data.length > 0) {
          // Get student IDs to split into student vs staff
          const studentIds = new Set(studentList.map(s => s.id));
          const staffIds = new Set(staffList.map(s => s.id));

          const studentEntries: AttendanceEntry[] = [];
          const staffEntries: AttendanceEntry[] = [];

          for (const record of data) {
            const entry: AttendanceEntry = {
              date: record.date,
              personId: record.student_id,
              personName: '',
              status: record.status as 'present' | 'absent',
              markedAt: record.marked_at || undefined,
            };

            if (studentIds.has(record.student_id)) {
              const student = studentList.find(s => s.id === record.student_id);
              entry.personName = student?.name || 'Unknown';
              studentEntries.push(entry);
            } else if (staffIds.has(record.student_id)) {
              const staff = staffList.find(s => s.id === record.student_id);
              entry.personName = staff?.name || 'Unknown';
              staffEntries.push(entry);
            }
          }

          if (studentEntries.length > 0) setStudentAttendance(studentEntries);
          if (staffEntries.length > 0) setStaffAttendance(staffEntries);
        }
      } catch (err) {
        console.error('Failed to load attendance from Supabase:', err);
      }
    };
    fetchTodayAttendance();
  }, [user?.organizationId, branchVersion, studentList, staffList]);

  // ── Today helpers ────────────────────────────────────────
  const today = getToday();

  const buildTodayList = (
    people: PersonEntry[],
    attendance: AttendanceEntry[]
  ) => {
    const todayRecords = attendance.filter((r) => r.date === today);
    const recordMap = new Map(todayRecords.map((r) => [r.personId, r]));
    return people.map((p) => {
      const record = recordMap.get(p.id);
      return {
        ...p,
        status: record?.status || ('present' as 'present' | 'absent'),
        markedAt: record?.markedAt,
      };
    });
  };

  const todayStudents = useMemo(
    () => buildTodayList(studentList, studentAttendance),
    [studentList, studentAttendance, today]
  );

  const todayStaff = useMemo(
    () => buildTodayList(staffList, staffAttendance),
    [staffList, staffAttendance, today]
  );

  // ── Filtered students (search) ───────────────────────────
  const filteredStudents = useMemo(
    () =>
      todayStudents.filter((s) =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [todayStudents, searchQuery]
  );

  // ── Toggle status ────────────────────────────────────────
  // ── Sync attendance to Supabase ───────────────────────────
  const syncAttendanceToSupabase = useCallback(
    async (personId: string, status: 'present' | 'absent') => {
      if (!user?.organizationId) return;
      try {
        // Check if record exists for this student+date
        const { data: existing } = await supabase
          .from('attendance')
          .select('id')
          .eq('student_id', personId)
          .eq('date', today)
          .eq('organization_id', user.organizationId)
          .maybeSingle();

        if (existing) {
          await supabase
            .from('attendance')
            .update({ status, marked_at: new Date().toISOString(), marked_by: user.id })
            .eq('id', existing.id);
        } else {
          // Use currentBranchId; fall back to user's profile branch_id if "All Branches"
          let branchId = currentBranchId;
          if (!branchId) {
            const { data: prof } = await supabase
              .from('profiles')
              .select('branch_id')
              .eq('id', user.id)
              .maybeSingle();
            branchId = prof?.branch_id ?? null;
          }

          await supabase.from('attendance').insert({
            organization_id: user.organizationId,
            student_id: personId,
            date: today,
            status,
            marked_at: new Date().toISOString(),
            marked_by: user.id,
            ...(branchId ? { branch_id: branchId } : {}),
          } as any);
        }
      } catch (err) {
        console.error('Failed to sync attendance to Supabase:', err);
      }
    },
    [user?.organizationId, user?.id, today, currentBranchId]
  );

  const toggleStatus = useCallback(
    (
      personId: string,
      newStatus: 'present' | 'absent',
      people: PersonEntry[],
      setter: React.Dispatch<React.SetStateAction<AttendanceEntry[]>>
    ) => {
      const person = people.find((p) => p.id === personId);
      if (!person) return;
      setter((prev) => {
        const filtered = prev.filter(
          (r) => !(r.personId === personId && r.date === today)
        );
        filtered.push({
          date: today,
          personId,
          personName: person.name,
          status: newStatus,
          markedAt: new Date().toISOString(),
        });
        return filtered;
      });
      // Sync to Supabase for reports
      syncAttendanceToSupabase(personId, newStatus);
    },
    [today, syncAttendanceToSupabase]
  );

  const markAllPresent = useCallback(
    (
      people: PersonEntry[],
      setter: React.Dispatch<React.SetStateAction<AttendanceEntry[]>>
    ) => {
      setter((prev) => {
        const filtered = prev.filter((r) => r.date !== today);
        const newEntries = people.map((p) => ({
          date: today,
          personId: p.id,
          personName: p.name,
          status: 'present' as const,
          markedAt: new Date().toISOString(),
        }));
        return [...filtered, ...newEntries];
      });
      // Sync all to Supabase
      people.forEach((p) => syncAttendanceToSupabase(p.id, 'present'));
    },
    [today, syncAttendanceToSupabase]
  );

  // ── Stats ────────────────────────────────────────────────
  const computeStats = (
    todayList: { status: string }[],
    totalPeople: number
  ) => {
    const present = todayList.filter((s) => s.status === 'present').length;
    const absent = todayList.filter((s) => s.status === 'absent').length;
    const percentage = totalPeople > 0 ? Math.round((present / totalPeople) * 100) : 0;
    return { present, absent, total: totalPeople, percentage };
  };

  const studentStats = useMemo(
    () => computeStats(todayStudents, studentList.length),
    [todayStudents, studentList]
  );

  const staffStats = useMemo(
    () => computeStats(todayStaff, staffList.length),
    [todayStaff, staffList]
  );

  // ── Render helpers ───────────────────────────────────────
  const renderStatsCards = (stats: { present: number; absent: number; total: number; percentage: number }) => (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="text-3xl font-bold text-primary">{stats.total}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Users className="w-6 h-6 text-primary" />
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
              <TrendingUp className="w-6 h-6 text-violet-600" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderAttendanceTable = (
    people: { id: string; name: string; role: string; status: 'present' | 'absent'; markedAt?: string }[],
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
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                Loading...
              </TableCell>
            </TableRow>
          ) : people.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                <div className="flex flex-col items-center gap-2">
                  {emptyIcon}
                  <p>{emptyText}</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            people.map((person, idx) => (
              <TableRow
                key={person.id}
                className="animate-fade-in"
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="w-9 h-9">
                      <AvatarFallback className="bg-primary/10 text-primary text-sm">
                        {person.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-foreground">{person.name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">{person.role}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={getStatusBadge(person.status)}>
                    {person.status === 'present' ? (
                      <UserCheck className="w-3 h-3 mr-1" />
                    ) : (
                      <UserX className="w-3 h-3 mr-1" />
                    )}
                    {person.status.charAt(0).toUpperCase() + person.status.slice(1)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Select
                    value={person.status}
                    onValueChange={(val) =>
                      toggleStatus(person.id, val as 'present' | 'absent', personList, setter)
                    }
                  >
                    <SelectTrigger className="w-32 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="present">
                        <span className="flex items-center gap-1">
                          <UserCheck className="w-3 h-3 text-emerald-600" />
                          Present
                        </span>
                      </SelectItem>
                      <SelectItem value="absent">
                        <span className="flex items-center gap-1">
                          <UserX className="w-3 h-3 text-rose-600" />
                          Absent
                        </span>
                      </SelectItem>
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

  // ── Student Attendance View ──────────────────────────────
  if (user?.role === 'student') {
    return <StudentAttendanceView />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
            Attendance Tracking
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage student and staff attendance — {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="students" className="gap-2">
            <GraduationCap className="w-4 h-4" />
            Students ({studentList.length})
          </TabsTrigger>
          <TabsTrigger value="staff" className="gap-2">
            <Users className="w-4 h-4" />
            Staff ({staffList.length})
          </TabsTrigger>
          <TabsTrigger value="leaves" className="gap-2">
            <CalendarCheck className="w-4 h-4" />
            Leaves ({leaveRequests.length})
          </TabsTrigger>
        </TabsList>

        {/* ═══ STUDENTS TAB ═══ */}
        <TabsContent value="students" className="space-y-6">
          {renderStatsCards(studentStats)}

          <Card className="border shadow-card">
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle className="text-lg">Student Attendance</CardTitle>
                  <CardDescription>
                    All students are marked as present by default. Use the dropdown to mark individual absences.
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search students..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 w-56"
                    />
                  </div>
                  <Button
                    variant="outline"
                    className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20"
                    onClick={() => markAllPresent(studentList, setStudentAttendance)}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    All Present
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {renderAttendanceTable(
                filteredStudents,
                studentList,
                setStudentAttendance,
                studentsLoading,
                <GraduationCap className="w-10 h-10 text-muted-foreground/40" />,
                'No students found in your organization.'
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ STAFF TAB ═══ */}
        <TabsContent value="staff" className="space-y-6">
          {renderStatsCards(staffStats)}

          <Card className="border shadow-card">
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle className="text-lg">Staff Attendance</CardTitle>
                  <CardDescription>
                    All staff are marked as present by default. Use the dropdown to mark individual absences.
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20"
                  onClick={() => markAllPresent(staffList, setStaffAttendance)}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  All Present
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {renderAttendanceTable(
                todayStaff,
                staffList,
                setStaffAttendance,
                staffLoading,
                <Users className="w-10 h-10 text-muted-foreground/40" />,
                'No staff/teachers found in your organization.'
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ LEAVES TAB ═══ */}
        <TabsContent value="leaves" className="space-y-6">
          {/* Leave Stats */}
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
                    <p className="text-3xl font-bold text-amber-600">{leaveRequests.filter((r) => r.status === 'pending').length}</p>
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
                    <p className="text-3xl font-bold text-emerald-600">{leaveRequests.filter((r) => r.status === 'approved').length}</p>
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
                    <p className="text-3xl font-bold text-rose-600">{leaveRequests.filter((r) => r.status === 'rejected').length}</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center">
                    <UserX className="w-6 h-6 text-rose-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border shadow-card">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Student Leave Requests</CardTitle>
              <CardDescription>
                All leave requests from students. Approved leaves are automatically reflected in attendance records.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Student</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Requested Date</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leavesLoading ? (
                      <TableRow>
                        <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                          Loading leave requests...
                        </TableCell>
                      </TableRow>
                    ) : leaveRequests.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                          <div className="flex flex-col items-center gap-2">
                            <CalendarCheck className="w-10 h-10 text-muted-foreground/40" />
                            <p>No leave requests found.</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      leaveRequests.map((request: any, idx: number) => (
                        <TableRow
                          key={request.id}
                          className="animate-fade-in"
                          style={{ animationDelay: `${idx * 40}ms` }}
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="w-8 h-8">
                                <AvatarFallback className="bg-primary/10 text-primary text-sm">
                                  {request.student_name?.charAt(0) || '?'}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium text-sm">{request.student_name}</span>
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
                            <Badge
                              variant="outline"
                              className={
                                request.status === 'approved'
                                  ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                  : request.status === 'rejected'
                                  ? 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                                  : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                              }
                            >
                              {request.status === 'approved' && <CheckCircle className="w-3 h-3 mr-1" />}
                              {request.status === 'rejected' && <UserX className="w-3 h-3 mr-1" />}
                              {request.status === 'pending' && <Clock className="w-3 h-3 mr-1" />}
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

          {/* Info Note */}
          <Card className="border shadow-card bg-primary/5">
            <CardContent className="p-4">
              <p className="text-sm text-foreground">
                <strong>Note:</strong> Approved leave requests are automatically marked as "absent (on leave)" in
                the attendance report. To approve or reject pending requests, go to the <strong>Leave Requests</strong> page.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
