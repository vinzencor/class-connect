import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Users,
  GraduationCap,
  UserCheck,
  TrendingUp,
  Calendar,
  Clock,
  ArrowUpRight,
  Video,
  MoreHorizontal,
  FileText,
  Download,
  Send,
  BookOpen,
  DollarSign,
  Activity,
  PieChart,
  BarChart3,
  ClipboardCheck,
  MapPin,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useBranch } from '@/contexts/BranchContext';
import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
} from 'recharts';

// Student Dashboard
function StudentDashboard() {
  const { user, profile } = useAuth();
  const { currentBranchId, branchVersion } = useBranch();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [todaySessions, setTodaySessions] = useState<any[]>([]);
  const [upcomingSessions, setUpcomingSessions] = useState<any[]>([]);
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [attendanceStats, setAttendanceStats] = useState({ present: 0, absent: 0, late: 0, total: 0, percentage: 0 });
  const [assignedModules, setAssignedModules] = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState<any | null>(null);
  const [sessionModules, setSessionModules] = useState<any[]>([]);
  const [sessionModuleFiles, setSessionModuleFiles] = useState<Record<string, any[]>>({});

  const organizationId = user?.organizationId || profile?.organization_id;

  useEffect(() => {
    if (user?.id && organizationId) {
      fetchStudentData();
    } else if (user?.id && !organizationId) {
      setLoading(false);
    }
  }, [user?.id, organizationId, branchVersion]);

  const fetchStudentData = async () => {
    setLoading(true);
    try {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 14);

      // 1. Get student's batch_id from profile metadata
      const studentBatchId = (profile?.metadata as any)?.batch_id;

      // 2. Get class IDs the student is enrolled in
      let classIds: string[] = [];

      // Try class_enrollments first
      const { data: enrollments } = await supabase
        .from('class_enrollments')
        .select('class_id')
        .eq('student_id', user!.id);

      if (enrollments && enrollments.length > 0) {
        classIds = enrollments.map((e: any) => e.class_id);
      }

      // Also get classes via batch (class_batches)
      if (studentBatchId) {
        const { data: batchClasses } = await supabase
          .from('class_batches')
          .select('class_id')
          .eq('batch_id', studentBatchId);

        if (batchClasses && batchClasses.length > 0) {
          const batchClassIds = batchClasses.map((bc: any) => bc.class_id);
          classIds = [...new Set([...classIds, ...batchClassIds])];
        }
      }

      // 3. Fetch sessions for these classes
      if (classIds.length > 0) {
        const { data: sessionsData } = await supabase
          .from('sessions')
          .select(`
            id,
            title,
            start_time,
            end_time,
            meet_link,
            classes (
              id,
              name,
              subject,
              room_number,
              faculty_id
            )
          `)
          .eq('organization_id', organizationId!)
          .in('class_id', classIds)
          .gte('start_time', startOfDay.toISOString())
          .lte('start_time', nextWeek.toISOString())
          .order('start_time', { ascending: true });

        const sessions = sessionsData || [];

        // Get faculty names
        const facultyIds = [...new Set(sessions.map((s: any) => s.classes?.faculty_id).filter(Boolean))];
        let facultyMap: Record<string, string> = {};
        if (facultyIds.length > 0) {
          const { data: facultyProfiles } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', facultyIds);
          (facultyProfiles || []).forEach((fp: any) => {
            facultyMap[fp.id] = fp.full_name;
          });
        }

        // Enrich sessions with faculty name
        const enrichedSessions = sessions.map((s: any) => ({
          ...s,
          facultyName: s.classes?.faculty_id ? (facultyMap[s.classes.faculty_id] || 'Unknown') : 'TBD',
        }));

        const todayFiltered = enrichedSessions.filter((s: any) => {
          const d = new Date(s.start_time);
          return d >= startOfDay && d <= endOfDay;
        });
        setTodaySessions(todayFiltered);

        const upcomingFiltered = enrichedSessions.filter((s: any) => {
          const d = new Date(s.start_time);
          return d >= tomorrow;
        }).slice(0, 10);
        setUpcomingSessions(upcomingFiltered);

        // 4. Fetch modules for all sessions
        const allSessionIds = enrichedSessions.map((s: any) => s.id);
        if (allSessionIds.length > 0) {
          const { data: smgData } = await supabase
            .from('session_module_groups')
            .select(`
              session_id,
              module_group_id,
              module_groups (
                id,
                name,
                sort_order,
                subject_id,
                module_subjects (
                  id,
                  name
                )
              )
            `)
            .in('session_id', allSessionIds);

          const groupIds = (smgData || []).map((item: any) => item.module_groups?.id).filter(Boolean);

          if (groupIds.length > 0) {
            const { data: filesData } = await supabase
              .from('module_files')
              .select('*')
              .in('group_id', groupIds)
              .order('sort_order', { ascending: true });

            const modulesMap = new Map<string, any>();
            (smgData || []).forEach((item: any) => {
              if (!item.module_groups) return;
              const groupId = item.module_groups.id;
              if (!modulesMap.has(groupId)) {
                const groupFiles = (filesData || []).filter((f: any) => f.group_id === groupId);
                const session = enrichedSessions.find((s: any) => s.id === item.session_id);
                modulesMap.set(groupId, {
                  id: groupId,
                  name: item.module_groups.name,
                  subjectName: item.module_groups.module_subjects?.name || 'Unknown',
                  sessionTitle: session?.title || 'Session',
                  sessionDate: session?.start_time,
                  className: session?.classes?.name || 'Class',
                  files: groupFiles,
                });
              }
            });
            setAssignedModules(Array.from(modulesMap.values()));
          }
        }
      }

      // 5. Fetch attendance data for graph
      const { data: rawAttendance } = await supabase
        .from('attendance')
        .select('date, status, class_id')
        .eq('student_id', user!.id)
        .eq('organization_id', organizationId!)
        .order('date', { ascending: true });

      if (rawAttendance && rawAttendance.length > 0) {
        const present = rawAttendance.filter((a: any) => a.status === 'present').length;
        const absent = rawAttendance.filter((a: any) => a.status === 'absent').length;
        const late = rawAttendance.filter((a: any) => a.status === 'late').length;
        const total = rawAttendance.length;
        setAttendanceStats({
          present,
          absent,
          late,
          total,
          percentage: total > 0 ? Math.round((present / total) * 100) : 0,
        });

        // Group by month for chart
        const monthMap: Record<string, { present: number; absent: number; late: number; total: number }> = {};
        rawAttendance.forEach((a: any) => {
          const monthKey = new Date(a.date).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
          if (!monthMap[monthKey]) monthMap[monthKey] = { present: 0, absent: 0, late: 0, total: 0 };
          monthMap[monthKey].total++;
          if (a.status === 'present') monthMap[monthKey].present++;
          else if (a.status === 'absent') monthMap[monthKey].absent++;
          else if (a.status === 'late') monthMap[monthKey].late++;
        });
        setAttendanceData(
          Object.entries(monthMap).map(([month, data]) => ({
            month,
            present: data.present,
            absent: data.absent,
            late: data.late,
            percentage: data.total > 0 ? Math.round((data.present / data.total) * 100) : 0,
          }))
        );
      }
    } catch (error) {
      console.error('Error fetching student data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewSessionDetails = async (session: any) => {
    setSelectedSession(session);
    setSessionModules([]);
    setSessionModuleFiles({});
    try {
      const { data: smgData } = await supabase
        .from('session_module_groups')
        .select(`
          module_group_id,
          module_groups (
            id,
            name,
            sort_order,
            subject_id,
            module_subjects (
              id,
              name
            )
          )
        `)
        .eq('session_id', session.id);

      const mods = smgData?.map((item: any) => ({
        id: item.module_groups?.id,
        name: item.module_groups?.name,
        sort_order: item.module_groups?.sort_order,
        subjectName: item.module_groups?.module_subjects?.name || 'Unknown',
      })).filter(Boolean) || [];
      setSessionModules(mods);

      const groupIds = mods.map((m: any) => m.id).filter(Boolean);
      if (groupIds.length > 0) {
        const { data: filesData } = await supabase
          .from('module_files')
          .select('*')
          .in('group_id', groupIds)
          .order('sort_order', { ascending: true });

        const filesMap: Record<string, any[]> = {};
        (filesData || []).forEach((f: any) => {
          if (!filesMap[f.group_id]) filesMap[f.group_id] = [];
          filesMap[f.group_id].push(f);
        });
        setSessionModuleFiles(filesMap);
      }
    } catch (err) {
      console.error('Error fetching session details:', err);
    }
  };

  const ATTENDANCE_COLORS = ['#10b981', '#ef4444', '#f59e0b'];

  const pieData = [
    { name: 'Present', value: attendanceStats.present, color: '#10b981' },
    { name: 'Absent', value: attendanceStats.absent, color: '#ef4444' },
    { name: 'Late', value: attendanceStats.late, color: '#f59e0b' },
  ].filter((d) => d.value > 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
            Student Dashboard 👨‍🎓
          </h1>
          <p className="text-muted-foreground mt-1">
            Your classes, attendance, and academic information
          </p>
        </div>
      </div>

      {/* Attendance Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Classes</p>
                <p className="text-3xl font-bold text-foreground">{attendanceStats.total}</p>
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
                <p className="text-3xl font-bold text-emerald-600">{attendanceStats.present}</p>
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
                <p className="text-3xl font-bold text-rose-600">{attendanceStats.absent}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-rose-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Attendance %</p>
                <p className="text-3xl font-bold text-violet-600">{attendanceStats.percentage}%</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center">
                <Activity className="w-6 h-6 text-violet-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Today's Classes */}
      <Card className="border shadow-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Today's Classes</CardTitle>
              <CardDescription>
                {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' })}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {todaySessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p>No classes scheduled for today</p>
            </div>
          ) : (
            todaySessions.map((session: any) => (
              <div key={session.id} className="flex items-center gap-4 p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
                <div className="flex-1">
                  <h4 className="font-semibold text-foreground">{session.title || session.classes?.subject || 'Session'}</h4>
                  <p className="text-sm text-muted-foreground mt-0.5">{session.classes?.name} • {session.facultyName}</p>
                  <div className="flex items-center gap-4 mt-2 text-sm">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(session.start_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      {session.end_time && ` - ${new Date(session.end_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`}
                    </span>
                    {session.classes?.room_number && (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <MapPin className="w-3.5 h-3.5" />
                        {session.classes.room_number}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {session.meet_link && (
                    <a href={session.meet_link} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm">
                        <Video className="w-4 h-4 mr-1" />
                        Join
                      </Button>
                    </a>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => handleViewSessionDetails(session)}>
                    <FileText className="w-4 h-4 mr-1" />
                    Details
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Upcoming Sessions */}
      {upcomingSessions.length > 0 && (
        <Card className="border shadow-card">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Upcoming Sessions</CardTitle>
                <CardDescription>Your scheduled classes in the coming days</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingSessions.map((session: any) => (
              <div key={session.id} className="flex items-center gap-4 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
                <div className="flex-1">
                  <h4 className="font-semibold text-foreground text-sm">{session.title || session.classes?.subject || 'Session'}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">{session.classes?.name} • {session.facultyName}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(session.start_time).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' })}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(session.start_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleViewSessionDetails(session)}>
                  <FileText className="w-4 h-4 mr-1" />
                  Details
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Attendance Graph */}
      {attendanceData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Bar Chart */}
          <Card className="border shadow-card lg:col-span-2">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">Attendance Overview</CardTitle>
                  <CardDescription>Your monthly attendance breakdown</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={attendanceData}>
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
                  <CardTitle className="text-lg">Summary</CardTitle>
                  <CardDescription>Overall attendance ratio</CardDescription>
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
                <p className="text-2xl font-bold text-primary">{attendanceStats.percentage}%</p>
                <p className="text-xs text-muted-foreground">Overall Attendance</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Downloadable Modules */}
      {assignedModules.length > 0 && (
        <Card className="border shadow-card">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Study Materials</CardTitle>
                <CardDescription>Download modules assigned to your classes</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {assignedModules.map((mod: any) => (
              <div key={mod.id} className="p-4 rounded-xl bg-muted/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-foreground">{mod.name}</h4>
                    <p className="text-sm text-muted-foreground">{mod.subjectName} • {mod.className}</p>
                    {mod.sessionDate && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Session: {new Date(mod.sessionDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      </p>
                    )}
                  </div>
                  <Badge variant="secondary">{mod.files?.length || 0} files</Badge>
                </div>
                {mod.files && mod.files.length > 0 && (
                  <div className="space-y-2 pl-4 border-l-2 border-primary/20">
                    {mod.files.map((file: any) => (
                      <div key={file.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">{file.title}</span>
                          {file.file_type && (
                            <Badge variant="outline" className="text-xs">{file.file_type}</Badge>
                          )}
                        </div>
                        <a href={file.file_url} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="sm">
                            <Download className="w-4 h-4" />
                          </Button>
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Session Detail Modal */}
      <Dialog open={!!selectedSession} onOpenChange={(open) => !open && setSelectedSession(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedSession?.title || selectedSession?.classes?.subject || 'Session Details'}</DialogTitle>
            <DialogDescription>
              <div className="flex items-center gap-4 mt-1 text-sm">
                <span>{selectedSession?.start_time ? new Date(selectedSession.start_time).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) : ''}</span>
                <span>
                  {selectedSession?.start_time ? new Date(selectedSession.start_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
                  {selectedSession?.end_time ? ` - ${new Date(selectedSession.end_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : ''}
                </span>
                <span>{selectedSession?.classes?.name}</span>
              </div>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="space-y-2 text-sm">
              <p><strong>Faculty:</strong> {selectedSession?.facultyName || 'TBD'}</p>
              {selectedSession?.classes?.room_number && (
                <p><strong>Room:</strong> {selectedSession.classes.room_number}</p>
              )}
              {selectedSession?.meet_link && (
                <p>
                  <strong>Meet Link:</strong>{' '}
                  <a href={selectedSession.meet_link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    Join Meeting
                  </a>
                </p>
              )}
            </div>

            {sessionModules.length > 0 && (
              <>
                <h4 className="font-semibold text-foreground mt-4">Module Materials</h4>
                {sessionModules.map((mod: any) => (
                  <div key={mod.id} className="p-3 rounded-lg bg-muted/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{mod.name}</p>
                        <p className="text-xs text-muted-foreground">{mod.subjectName}</p>
                      </div>
                    </div>
                    {sessionModuleFiles[mod.id] && sessionModuleFiles[mod.id].length > 0 && (
                      <div className="space-y-1 pl-3 border-l-2 border-primary/20">
                        {sessionModuleFiles[mod.id].map((file: any) => (
                          <div key={file.id} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                              <span className="text-sm">{file.title}</span>
                            </div>
                            <a href={file.file_url} target="_blank" rel="noopener noreferrer">
                              <Button variant="ghost" size="sm">
                                <Download className="w-4 h-4" />
                              </Button>
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}

            {sessionModules.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No modules assigned to this session.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Faculty Dashboard
function FacultyDashboard() {
  const { user, profile } = useAuth();
  const { currentBranchId, branchVersion } = useBranch();
  const [todaySessions, setTodaySessions] = useState<any[]>([]);
  const [upcomingSessions, setUpcomingSessions] = useState<any[]>([]);
  const [assignedModules, setAssignedModules] = useState<any[]>([]);
  const [attendanceStats, setAttendanceStats] = useState<any>({
    totalClasses: 0,
    totalSessions: 0,
    avgAttendance: 0,
  });
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<any | null>(null);
  const [sessionModules, setSessionModules] = useState<any[]>([]);
  const [sessionCompletions, setSessionCompletions] = useState<Record<string, boolean>>({});
  const [sessionBatchIds, setSessionBatchIds] = useState<string[]>([]);
  const [markingComplete, setMarkingComplete] = useState<string | null>(null);
  const [sessionModuleFiles, setSessionModuleFiles] = useState<Record<string, any[]>>({});

  const organizationId = user?.organizationId || profile?.organization_id;

  useEffect(() => {
    if (user?.id && organizationId) {
      fetchFacultyData();
    } else if (user?.id && !organizationId) {
      // User is loaded but no organization - stop loading
      console.warn('User loaded but no organization ID found');
      setLoading(false);
    }
  }, [user?.id, organizationId, branchVersion]);

  const fetchFacultyData = async () => {
    setLoading(true);
    try {
      // Calculate date ranges
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);

      // Batch all queries in parallel - with branch filtering
      const branchFilter = currentBranchId;

      let classesQuery = supabase
          .from('classes')
          .select(`
            id,
            name,
            subject,
            description,
            schedule_day,
            schedule_time,
            room_number,
            meet_link,
            is_active
          `)
          .eq('organization_id', organizationId)
          .eq('faculty_id', user?.id)
          .eq('is_active', true);
      if (branchFilter) classesQuery = classesQuery.eq('branch_id', branchFilter);

      let allSessionsQuery = supabase
          .from('sessions')
          .select(`
            id,
            title,
            start_time,
            end_time,
            meet_link,
            faculty_id,
            classes (
              id,
              name,
              subject,
              room_number,
              faculty_id
            )
          `)
          .eq('organization_id', organizationId)
          .gte('start_time', startOfDay.toISOString())
          .lte('start_time', nextWeek.toISOString());
      if (branchFilter) allSessionsQuery = allSessionsQuery.eq('branch_id', branchFilter);

      let classCountQuery = supabase
          .from('classes')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', organizationId)
          .eq('faculty_id', user?.id)
          .eq('is_active', true);
      if (branchFilter) classCountQuery = classCountQuery.eq('branch_id', branchFilter);

      let sessionCountQuery = supabase
          .from('sessions')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', organizationId)
          .eq('faculty_id', user?.id);
      if (branchFilter) sessionCountQuery = sessionCountQuery.eq('branch_id', branchFilter);

      const [
        { data: classesData },
        { data: allSessionsData },
        { count: classCount },
        { count: sessionCount }
      ] = await Promise.all([
        classesQuery.order('name', { ascending: true }),
        allSessionsQuery.order('start_time', { ascending: true }),
        classCountQuery,
        sessionCountQuery,
      ]);

      // Filter sessions for faculty
      const facultySessions = (allSessionsData || []).filter((session: any) =>
        session.faculty_id === user?.id || session.classes?.faculty_id === user?.id
      );

      // Split into today and upcoming
      const todayFiltered = facultySessions.filter((s: any) => {
        const sessionDate = new Date(s.start_time);
        return sessionDate >= startOfDay && sessionDate <= endOfDay;
      });
      setTodaySessions(todayFiltered);

      const upcomingFiltered = facultySessions.filter((s: any) => {
        const sessionDate = new Date(s.start_time);
        return sessionDate >= tomorrow;
      }).slice(0, 5);
      setUpcomingSessions(upcomingFiltered);

      // Calculate attendance stats
      let avgAttendance = 0;
      if (classesData && classesData.length > 0) {
        const { data: attendanceData } = await supabase
          .from('attendance')
          .select('status, class_id')
          .eq('organization_id', organizationId)
          .in('class_id', classesData.map((c: any) => c.id));

        if (attendanceData && attendanceData.length > 0) {
          const presentCount = attendanceData.filter((a: any) => a.status === 'present').length;
          avgAttendance = Math.round((presentCount / attendanceData.length) * 100);
        }
      }

      setAttendanceStats({
        totalClasses: classCount || 0,
        totalSessions: sessionCount || 0,
        avgAttendance,
      });

      // Fetch assigned modules for the faculty's classes
      await fetchAssignedModules(todayFiltered, upcomingFiltered);

    } catch (error) {
      console.error('Error fetching faculty data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignedModules = async (todaySessionsList: any[], upcomingSessionsList: any[]) => {
    try {
      const allSessions = [...todaySessionsList, ...upcomingSessionsList];
      if (allSessions.length === 0) {
        setAssignedModules([]);
        return;
      }

      const sessionIds = allSessions.map((s: any) => s.id);

      // Fetch module groups linked to these sessions
      const { data: smgData, error: smgError } = await supabase
        .from('session_module_groups')
        .select(`
          session_id,
          module_group_id,
          module_groups (
            id,
            name,
            sort_order,
            subject_id,
            module_subjects (
              id,
              name
            )
          )
        `)
        .in('session_id', sessionIds);

      if (smgError) throw smgError;

      // Get the group IDs
      const groupIds = (smgData || [])
        .map((item: any) => item.module_groups?.id)
        .filter(Boolean);

      if (groupIds.length === 0) {
        setAssignedModules([]);
        return;
      }

      // Fetch files for these module groups
      const { data: filesData, error: filesError } = await supabase
        .from('module_files')
        .select('*')
        .in('group_id', groupIds)
        .order('sort_order', { ascending: true });

      if (filesError) throw filesError;

      // Build the modules with files, grouped by session
      const modulesMap = new Map<string, any>();

      (smgData || []).forEach((item: any) => {
        if (!item.module_groups) return;
        const groupId = item.module_groups.id;
        if (!modulesMap.has(groupId)) {
          const groupFiles = (filesData || []).filter((f: any) => f.group_id === groupId);
          const session = allSessions.find((s: any) => s.id === item.session_id);
          modulesMap.set(groupId, {
            id: groupId,
            name: item.module_groups.name,
            subjectName: item.module_groups.module_subjects?.name || 'Unknown',
            sessionTitle: session?.title || 'Session',
            sessionDate: session?.start_time,
            className: session?.classes?.name || 'Class',
            files: groupFiles,
          });
        }
      });

      setAssignedModules(Array.from(modulesMap.values()));
    } catch (err) {
      console.error('Error fetching assigned modules:', err);
      setAssignedModules([]);
    }
  };

  const handleViewDetails = async (session: any) => {
    setSelectedSession(session);
    setSessionCompletions({});
    setSessionBatchIds([]);
    setSessionModuleFiles({});
    try {
      // Fetch module groups linked to this session
      const { data: smgData, error: smgError } = await supabase
        .from('session_module_groups')
        .select(`
          module_group_id,
          module_groups (
            id,
            name,
            sort_order,
            subject_id,
            module_subjects (
              id,
              name
            )
          )
        `)
        .eq('session_id', session.id);

      if (smgError) throw smgError;
      const mods = smgData?.map((item: any) => ({
        id: item.module_groups?.id,
        name: item.module_groups?.name,
        sort_order: item.module_groups?.sort_order,
        subjectName: item.module_groups?.module_subjects?.name || 'Unknown',
        subjectId: item.module_groups?.subject_id,
      })).filter(Boolean) || [];
      setSessionModules(mods);

      // Fetch files for these module groups
      const groupIds = mods.map((m: any) => m.id).filter(Boolean);
      if (groupIds.length > 0) {
        const { data: filesData } = await supabase
          .from('module_files')
          .select('*')
          .in('group_id', groupIds)
          .order('sort_order', { ascending: true });

        const filesMap: Record<string, any[]> = {};
        (filesData || []).forEach((f: any) => {
          if (!filesMap[f.group_id]) filesMap[f.group_id] = [];
          filesMap[f.group_id].push(f);
        });
        setSessionModuleFiles(filesMap);
      }

      // Fetch batch IDs for this session's class
      if (session.classes?.id) {
        const { data: cbData } = await supabase
          .from('class_batches')
          .select('batch_id')
          .eq('class_id', session.classes.id);
        const batchIds = (cbData || []).map((r: any) => r.batch_id);
        setSessionBatchIds(batchIds);

        // Fetch completions for these batches
        if (batchIds.length > 0) {
          const { data: completionData } = await supabase
            .from('module_completion')
            .select('module_group_id')
            .in('batch_id', batchIds);
          const completionMap: Record<string, boolean> = {};
          (completionData || []).forEach((r: any) => {
            completionMap[r.module_group_id] = true;
          });
          setSessionCompletions(completionMap);
        }
      }
    } catch (err) {
      console.error("Error fetching session modules:", err);
    }
  };

  const handleMarkComplete = async (moduleGroupId: string) => {
    if (!organizationId || sessionBatchIds.length === 0 || !selectedSession) return;
    setMarkingComplete(moduleGroupId);
    try {
      // Insert completion for each batch
      const inserts = sessionBatchIds.map(batchId => ({
        module_group_id: moduleGroupId,
        batch_id: batchId,
        completed_by: user?.id,
        session_id: selectedSession.id,
        organization_id: organizationId,
      }));

      const { error } = await supabase
        .from('module_completion')
        .upsert(inserts, { onConflict: 'module_group_id,batch_id' });

      if (error) throw error;

      setSessionCompletions(prev => ({ ...prev, [moduleGroupId]: true }));
    } catch (err) {
      console.error('Error marking complete:', err);
    } finally {
      setMarkingComplete(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!organizationId) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card className="border shadow-card max-w-md">
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <Activity className="w-6 h-6 text-destructive" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Organization Not Found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Your account is not associated with an organization. Please contact your administrator.
            </p>
            <p className="text-xs text-muted-foreground">
              User ID: {user?.id}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
            Faculty Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Today's schedule and teaching materials
          </p>
        </div>
        <Button onClick={fetchFacultyData} variant="outline" size="sm">
          <Activity className="w-4 h-4 mr-2" />
          Refresh Data
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border shadow-card hover:shadow-soft transition-all hover:-translate-y-1 bg-gradient-to-br from-indigo-500/10 to-purple-500/10">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <Badge variant="outline" className="bg-success/10 text-success border-success/30">Active</Badge>
            </div>
            <div className="mt-4">
              <p className="text-3xl font-bold text-foreground">{attendanceStats.totalClasses}</p>
              <p className="text-sm text-muted-foreground mt-1">Assigned Classes</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-card hover:shadow-soft transition-all hover:-translate-y-1 bg-gradient-to-br from-emerald-500/10 to-green-500/10">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center shadow-lg">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <Badge variant="outline" className="bg-info/10 text-info border-info/30">Today</Badge>
            </div>
            <div className="mt-4">
              <p className="text-3xl font-bold text-foreground">{todaySessions.length}</p>
              <p className="text-sm text-muted-foreground mt-1">Today's Sessions</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-card hover:shadow-soft transition-all hover:-translate-y-1 bg-gradient-to-br from-amber-500/10 to-orange-500/10">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg">
                <ClipboardCheck className="w-6 h-6 text-white" />
              </div>
              <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">Avg</Badge>
            </div>
            <div className="mt-4">
              <p className="text-3xl font-bold text-foreground">{attendanceStats.avgAttendance}%</p>
              <p className="text-sm text-muted-foreground mt-1">Attendance Rate</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Today's Sessions */}
      <Card className="border shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Today's Classes
          </CardTitle>
          <CardDescription>Your scheduled classes for today</CardDescription>
        </CardHeader>
        <CardContent>
          {todaySessions.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
              No classes scheduled for today.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {todaySessions.map((session) => (
                <div key={session.id} className="p-4 rounded-lg border bg-card hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-foreground">{session.classes?.name || 'Class'}</h3>
                      <p className="text-sm text-muted-foreground">{session.title}</p>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm mb-3">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      <span>
                        {new Date(session.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -
                        {new Date(session.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {session.classes?.room_number && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="w-4 h-4" />
                        <span>Room {session.classes.room_number}</span>
                      </div>
                    )}
                    {session.meet_link && (
                      <div className="flex items-center gap-2">
                        <Video className="w-4 h-4 text-primary" />
                        <a href={session.meet_link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm">
                          Join Google Meet
                        </a>
                      </div>
                    )}
                  </div>
                  <Button
                    className="w-full"
                    size="sm"
                    onClick={() => handleViewDetails(session)}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    View Details & Modules
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assigned Modules for Preparation */}
      <Card className="border shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="w-5 h-5 text-primary" />
            Assigned Modules - Prepare in Advance
          </CardTitle>
          <CardDescription>Download teaching materials for your upcoming sessions</CardDescription>
        </CardHeader>
        <CardContent>
          {assignedModules.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
              <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No modules assigned yet</p>
              <p className="text-sm mt-1">Modules linked to your upcoming sessions will appear here</p>
            </div>
          ) : (
            <div className="space-y-4">
              {assignedModules.map((mod) => (
                <div key={mod.id} className="p-4 rounded-lg border bg-card hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-foreground">{mod.name}</h3>
                      <div className="flex items-center gap-3 mt-1">
                        <Badge variant="outline" className="text-xs">{mod.subjectName}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {mod.className} &middot; {mod.sessionTitle}
                        </span>
                      </div>
                      {mod.sessionDate && (
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(mod.sessionDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          {' at '}
                          {new Date(mod.sessionDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Files */}
                  {mod.files && mod.files.length > 0 ? (
                    <div className="space-y-2 mt-3 pt-3 border-t">
                      {mod.files.map((file: any) => (
                        <div key={file.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{file.title}</p>
                              {file.file_size && (
                                <p className="text-xs text-muted-foreground">
                                  {(file.file_size / 1024).toFixed(0)} KB
                                  {file.file_type && ` · ${file.file_type}`}
                                </p>
                              )}
                            </div>
                          </div>
                          <a
                            href={file.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            download
                          >
                            <Button size="sm" variant="outline" className="gap-1.5 flex-shrink-0">
                              <Download className="w-3.5 h-3.5" />
                              Download
                            </Button>
                          </a>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-2 italic">No files uploaded for this module yet.</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upcoming Sessions */}
      <Card className="border shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Upcoming Sessions (Next 7 Days)
          </CardTitle>
          <CardDescription>Your scheduled sessions for the upcoming week</CardDescription>
        </CardHeader>
        <CardContent>
          {upcomingSessions.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              No upcoming sessions scheduled.
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingSessions.map((session) => (
                <div key={session.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{session.classes?.name || 'Class'}</p>
                      <p className="text-sm text-muted-foreground">{session.title}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-medium text-foreground">
                        {new Date(session.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(session.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleViewDetails(session)}
                    >
                      <FileText className="w-4 h-4 mr-1" />
                      Details
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedSession && (
        <Dialog open={!!selectedSession} onOpenChange={() => setSelectedSession(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedSession.classes?.name}</DialogTitle>
              <DialogDescription>{selectedSession.title}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Date</p>
                  <p className="font-medium mt-1">
                    {new Date(selectedSession.start_time).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Time</p>
                  <p className="font-medium mt-1">
                    {new Date(selectedSession.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {selectedSession.end_time && ` - ${new Date(selectedSession.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Subject</p>
                  <p className="font-medium mt-1">{selectedSession.classes?.subject || '-'}</p>
                </div>
              </div>

              {selectedSession.meet_link && (
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-between">
                  <span className="text-sm font-medium text-primary">Google Meet Link</span>
                  <a href={selectedSession.meet_link} target="_blank" rel="noopener noreferrer">
                    <Button size="sm">Join Meeting</Button>
                  </a>
                </div>
              )}

              <div>
                <p className="font-medium mb-3">Module Groups ({sessionModules.length})</p>
                <div className="space-y-3">
                  {sessionModules.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No modules attached to this session.</p>
                  ) : (
                    sessionModules.map((mod, i) => {
                      const isCompleted = sessionCompletions[mod.id] || false;
                      const modFiles = sessionModuleFiles[mod.id] || [];
                      return (
                        <div
                          key={mod.id || i}
                          className={`p-3 rounded-lg border ${isCompleted ? 'bg-muted/30 border-green-200' : ''}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <BookOpen className="w-4 h-4 text-muted-foreground" />
                              <div>
                                <span className={`text-sm ${isCompleted ? 'line-through text-muted-foreground' : ''}`}>{mod.name}</span>
                                <span className="text-xs text-muted-foreground ml-2">({mod.subjectName})</span>
                              </div>
                            </div>
                            {isCompleted ? (
                              <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                                <ClipboardCheck className="w-3 h-3 mr-1" />Completed
                              </Badge>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={markingComplete === mod.id || sessionBatchIds.length === 0}
                                onClick={() => handleMarkComplete(mod.id)}
                              >
                                {markingComplete === mod.id ? (
                                  <span className="animate-spin mr-1">⏳</span>
                                ) : (
                                  <ClipboardCheck className="w-4 h-4 mr-1" />
                                )}
                                Mark Complete
                              </Button>
                            )}
                          </div>
                          {/* Module Files for Download */}
                          {modFiles.length > 0 && (
                            <div className="mt-2 pt-2 border-t space-y-1.5">
                              {modFiles.map((file: any) => (
                                <div key={file.id} className="flex items-center justify-between p-2 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors">
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                                    <div className="min-w-0">
                                      <p className="text-sm truncate">{file.title}</p>
                                      {file.file_size && (
                                        <p className="text-xs text-muted-foreground">
                                          {(file.file_size / 1024).toFixed(0)} KB
                                          {file.file_type && ` · ${file.file_type}`}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  <a
                                    href={file.file_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    download
                                  >
                                    <Button size="sm" variant="ghost" className="gap-1 h-7 px-2">
                                      <Download className="w-3.5 h-3.5" />
                                      Download
                                    </Button>
                                  </a>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setSelectedSession(null)}
              >
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// Chart colors
const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
const GRADIENT_COLORS = {
  primary: ['#6366f1', '#8b5cf6'],
  success: ['#22c55e', '#10b981'],
  warning: ['#f59e0b', '#fbbf24'],
  error: ['#ef4444', '#f87171'],
};

// Admin Dashboard with real data
function AdminDashboard() {
  const { user, profile } = useAuth();
  const { currentBranchId, branchVersion, currentBranch } = useBranch();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalFaculty: 0,
    todaySessions: 0,
    newLeads: 0,
  });
  const [paymentData, setPaymentData] = useState<any[]>([]);
  const [sessionTrend, setSessionTrend] = useState<any[]>([]);
  const [recentLeads, setRecentLeads] = useState<any[]>([]);
  const [upcomingSessions, setUpcomingSessions] = useState<any[]>([]);

  const organizationId = user?.organizationId || profile?.organization_id;

  useEffect(() => {
    if (organizationId) {
      fetchDashboardData();
    } else if (user?.id && !organizationId) {
      // User is loaded but no organization - stop loading
      console.warn('User loaded but no organization ID found');
      setLoading(false);
    }
  }, [organizationId, user?.id, branchVersion]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Calculate date ranges
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      weekAgo.setHours(0, 0, 0, 0);

      // Batch all count queries in parallel
      const branchFilter = currentBranchId;

      // Build queries with optional branch filtering
      let studentsQuery = supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', organizationId)
          .eq('role', 'student');
      if (branchFilter) studentsQuery = studentsQuery.eq('branch_id', branchFilter);

      let facultyQuery = supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', organizationId)
          .eq('role', 'faculty');
      if (branchFilter) facultyQuery = facultyQuery.eq('branch_id', branchFilter);

      let sessionsCountQuery = supabase
          .from('sessions')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', organizationId)
          .gte('start_time', startOfDay.toISOString())
          .lte('start_time', endOfDay.toISOString());
      if (branchFilter) sessionsCountQuery = sessionsCountQuery.eq('branch_id', branchFilter);

      let leadsCountQuery = supabase
          .from('crm_leads')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', organizationId)
          .gte('created_at', weekAgo.toISOString());
      if (branchFilter) leadsCountQuery = leadsCountQuery.eq('branch_id', branchFilter);

      let paymentsQuery = supabase
          .from('payments')
          .select('amount, amount_paid, status')
          .eq('organization_id', organizationId);
      if (branchFilter) paymentsQuery = paymentsQuery.eq('branch_id', branchFilter);

      let weekSessionsQuery = supabase
          .from('sessions')
          .select('start_time')
          .eq('organization_id', organizationId)
          .gte('start_time', weekAgo.toISOString())
          .lte('start_time', endOfDay.toISOString());
      if (branchFilter) weekSessionsQuery = weekSessionsQuery.eq('branch_id', branchFilter);

      let recentLeadsQuery = supabase
          .from('crm_leads')
          .select('id, name, status, created_at')
          .eq('organization_id', organizationId)
          .order('created_at', { ascending: false })
          .limit(5);
      if (branchFilter) recentLeadsQuery = recentLeadsQuery.eq('branch_id', branchFilter);

      let upcomingSessionsQuery = supabase
          .from('sessions')
          .select(`
            id,
            title,
            start_time,
            end_time,
            meet_link,
            classes (name, subject)
          `)
          .eq('organization_id', organizationId)
          .gte('start_time', new Date().toISOString())
          .order('start_time', { ascending: true })
          .limit(5);
      if (branchFilter) upcomingSessionsQuery = upcomingSessionsQuery.eq('branch_id', branchFilter);

      const [
        { count: studentCount },
        { count: facultyCount },
        { count: todaySessionCount },
        { count: leadsCount },
        { data: paymentsData },
        { data: weekSessionsData },
        { data: leadsData },
        { data: sessionsData }
      ] = await Promise.all([
        studentsQuery,
        facultyQuery,
        sessionsCountQuery,
        leadsCountQuery,
        paymentsQuery,
        weekSessionsQuery,
        recentLeadsQuery,
        upcomingSessionsQuery,
      ]);

      // Set stats
      setStats({
        totalStudents: studentCount || 0,
        totalFaculty: facultyCount || 0,
        todaySessions: todaySessionCount || 0,
        newLeads: leadsCount || 0,
      });

      // Process payment data for pie chart
      if (paymentsData && paymentsData.length > 0) {
        const paymentStats = {
          completed: 0,
          pending: 0,
          partial: 0,
          overdue: 0,
        };

        paymentsData.forEach((p: any) => {
          paymentStats[p.status as keyof typeof paymentStats] += p.amount || 0;
        });

        setPaymentData([
          { name: 'Completed', value: paymentStats.completed, color: '#22c55e' },
          { name: 'Pending', value: paymentStats.pending, color: '#f59e0b' },
          { name: 'Partial', value: paymentStats.partial, color: '#6366f1' },
          { name: 'Overdue', value: paymentStats.overdue, color: '#ef4444' },
        ].filter(d => d.value > 0));
      }

      // Process session trend from single query (client-side grouping)
      const last7Days: { day: string; sessions: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);

        const count = (weekSessionsData || []).filter((s: any) => {
          const sessionDate = new Date(s.start_time);
          return sessionDate >= date && sessionDate < nextDay;
        }).length;

        last7Days.push({
          day: date.toLocaleDateString('en-US', { weekday: 'short' }),
          sessions: count,
        });
      }
      setSessionTrend(last7Days);

      // Set leads and sessions
      setRecentLeads(leadsData || []);
      setUpcomingSessions(sessionsData || []);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-primary/10 text-primary';
      case 'contacted': return 'bg-blue-500/10 text-blue-500';
      case 'interested': return 'bg-amber-500/10 text-amber-500';
      case 'follow_up': return 'bg-orange-500/10 text-orange-500';
      case 'converted': return 'bg-green-500/10 text-green-500';
      case 'lost': return 'bg-red-500/10 text-red-500';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const totalPayments = paymentData.reduce((acc, d) => acc + d.value, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!organizationId) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card className="border shadow-card max-w-md">
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <Activity className="w-6 h-6 text-destructive" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Organization Not Found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Your account is not associated with an organization. Please contact support.
            </p>
            <p className="text-xs text-muted-foreground">
              User ID: {user?.id}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
            Admin Dashboard 🎯
          </h1>
          <p className="text-muted-foreground mt-1">
            Overview of your institute
          </p>
        </div>
        <Button onClick={fetchDashboardData} variant="outline" size="sm">
          <Activity className="w-4 h-4 mr-2" />
          Refresh Data
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border shadow-card hover:shadow-soft transition-all hover:-translate-y-1 bg-gradient-to-br from-indigo-500/10 to-purple-500/10">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <Badge variant="outline" className="bg-success/10 text-success border-success/30">Active</Badge>
            </div>
            <div className="mt-4">
              <p className="text-3xl font-bold text-foreground">{stats.totalStudents}</p>
              <p className="text-sm text-muted-foreground mt-1">Total Students</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-card hover:shadow-soft transition-all hover:-translate-y-1 bg-gradient-to-br from-emerald-500/10 to-green-500/10">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center shadow-lg">
                <Users className="w-6 h-6 text-white" />
              </div>
              <Badge variant="outline" className="bg-success/10 text-success border-success/30">Active</Badge>
            </div>
            <div className="mt-4">
              <p className="text-3xl font-bold text-foreground">{stats.totalFaculty}</p>
              <p className="text-sm text-muted-foreground mt-1">Active Faculty</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-card hover:shadow-soft transition-all hover:-translate-y-1 bg-gradient-to-br from-amber-500/10 to-orange-500/10">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">Today</Badge>
            </div>
            <div className="mt-4">
              <p className="text-3xl font-bold text-foreground">{stats.todaySessions}</p>
              <p className="text-sm text-muted-foreground mt-1">Today's Sessions</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-card hover:shadow-soft transition-all hover:-translate-y-1 bg-gradient-to-br from-cyan-500/10 to-blue-500/10">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shadow-lg">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <Badge variant="outline" className="bg-muted text-muted-foreground">This Week</Badge>
            </div>
            <div className="mt-4">
              <p className="text-3xl font-bold text-foreground">{stats.newLeads}</p>
              <p className="text-sm text-muted-foreground mt-1">New Leads (CRM)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Session Trend Chart */}
        <Card className="border shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              Session Trend
            </CardTitle>
            <CardDescription>Sessions scheduled over the last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sessionTrend}>
                  <defs>
                    <linearGradient id="sessionGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5} />
                  <XAxis dataKey="day" tick={{ fill: '#6b7280', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(255,255,255,0.95)',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="sessions"
                    stroke="#6366f1"
                    strokeWidth={2}
                    fill="url(#sessionGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Payment Distribution Chart */}
        <Card className="border shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="w-5 h-5 text-primary" />
              Payment Distribution
            </CardTitle>
            <CardDescription>
              {totalPayments > 0 ? `Total: ${formatCurrency(totalPayments)}` : 'No payment data available'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              {paymentData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <defs>
                      {paymentData.map((entry, index) => (
                        <linearGradient key={`gradient-${index}`} id={`gradient-${index}`} x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor={entry.color} stopOpacity={1} />
                          <stop offset="100%" stopColor={entry.color} stopOpacity={0.7} />
                        </linearGradient>
                      ))}
                    </defs>
                    <Pie
                      data={paymentData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {paymentData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={`url(#gradient-${index})`}
                          stroke={entry.color}
                          strokeWidth={2}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{
                        background: 'rgba(255,255,255,0.95)',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                      }}
                    />
                    <Legend />
                  </RechartsPieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <DollarSign className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p>No payment data yet</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Leads */}
        <Card className="border shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Recent Leads
            </CardTitle>
            <CardDescription>Latest CRM leads</CardDescription>
          </CardHeader>
          <CardContent>
            {recentLeads.length > 0 ? (
              <div className="space-y-3">
                {recentLeads.map((lead) => (
                  <div key={lead.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-primary/10 text-primary text-sm">
                          {lead.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">{lead.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(lead.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className={getStatusColor(lead.status)}>
                      {lead.status?.replace('_', ' ')}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>No leads yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Sessions */}
        <Card className="border shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Upcoming Sessions
            </CardTitle>
            <CardDescription>Next scheduled sessions</CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingSessions.length > 0 ? (
              <div className="space-y-3">
                {upcomingSessions.map((session: any) => (
                  <div key={session.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Video className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{session.classes?.name || session.title}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(session.start_time).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                    {session.meet_link && (
                      <Button size="sm" variant="outline" asChild>
                        <a href={session.meet_link} target="_blank" rel="noopener noreferrer">
                          Join
                        </a>
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>No upcoming sessions</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  if (user?.role === 'student') return <StudentDashboard />;
  if (user?.role === 'faculty') return <FacultyDashboard />;
  return <AdminDashboard />;
}
