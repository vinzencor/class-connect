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
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

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

const STAFF_ATTENDANCE_KEY = 'teammates_staff_attendance';
const STUDENT_ATTENDANCE_KEY = 'teammates_student_attendance';

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

// ── Component ──────────────────────────────────────────────
export default function AttendancePage() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('students');

  // People lists from Supabase
  const [studentList, setStudentList] = useState<PersonEntry[]>([]);
  const [staffList, setStaffList] = useState<PersonEntry[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [staffLoading, setStaffLoading] = useState(false);

  // Attendance from localStorage
  const [studentAttendance, setStudentAttendance] = useState<AttendanceEntry[]>(() => {
    try {
      const saved = localStorage.getItem(STUDENT_ATTENDANCE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [staffAttendance, setStaffAttendance] = useState<AttendanceEntry[]>(() => {
    try {
      const saved = localStorage.getItem(STAFF_ATTENDANCE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // ── Fetch students from Supabase ─────────────────────────
  useEffect(() => {
    const fetchStudents = async () => {
      if (!user?.organizationId) return;
      setStudentsLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, role')
          .eq('organization_id', user.organizationId)
          .eq('role', 'student');

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
  }, [user?.organizationId]);

  // ── Fetch staff from Supabase ────────────────────────────
  useEffect(() => {
    const fetchStaff = async () => {
      if (!user?.organizationId) return;
      setStaffLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, role')
          .eq('organization_id', user.organizationId)
          .in('role', ['teacher', 'faculty', 'staff']);

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
  }, [user?.organizationId]);

  // ── Persist attendance ───────────────────────────────────
  useEffect(() => {
    localStorage.setItem(STUDENT_ATTENDANCE_KEY, JSON.stringify(studentAttendance));
  }, [studentAttendance]);

  useEffect(() => {
    localStorage.setItem(STAFF_ATTENDANCE_KEY, JSON.stringify(staffAttendance));
  }, [staffAttendance]);

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
    },
    [today]
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
    },
    [today]
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
      </Tabs>
    </div>
  );
}
