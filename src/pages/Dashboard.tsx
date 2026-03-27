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
  Layers,
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
  const [attendanceStats, setAttendanceStats] = useState({ present: 0, online_present: 0, absent: 0, late: 0, total: 0, percentage: 0 });
  const [assignedModules, setAssignedModules] = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState<any | null>(null);
  const [sessionModules, setSessionModules] = useState<any[]>([]);
  const [sessionModuleFiles, setSessionModuleFiles] = useState<Record<string, any[]>>({});
  const [sessionSubGroups, setSessionSubGroups] = useState<Record<string, any[]>>({});
  const [sessionSubGroupFiles, setSessionSubGroupFiles] = useState<Record<string, any[]>>({});
  const [sessionDetailsLoading, setSessionDetailsLoading] = useState(false);
  const [sessionDetailsError, setSessionDetailsError] = useState<string | null>(null);
  const [batchInfo, setBatchInfo] = useState<{ id: string; name: string } | null>(null);
  const [courseInfo, setCourseInfo] = useState<{ id: string; name: string } | null>(null);

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
      setBatchInfo(null);
      setCourseInfo(null);

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 14);

      // 1. Get student's batch_id from profile metadata (supports old/new metadata shapes)
      const normalizeBatchValue = (rawValue: unknown): string | null => {
        if (!rawValue) return null;

        if (typeof rawValue === 'string') {
          const trimmed = rawValue.trim();
          return trimmed.length > 0 ? trimmed : null;
        }

        if (typeof rawValue === 'object') {
          const candidate = rawValue as Record<string, unknown>;
          const nested = candidate.id ?? candidate.batch_id ?? candidate.batchId ?? candidate.batch ?? candidate.name;
          if (typeof nested === 'string') {
            const trimmed = nested.trim();
            return trimmed.length > 0 ? trimmed : null;
          }
        }

        return null;
      };

      const metadata = profile?.metadata;
      let studentBatchId: string | null = null;
      if (typeof metadata === 'string') {
        try {
          const parsed = JSON.parse(metadata);
          studentBatchId = normalizeBatchValue(parsed?.batch_id ?? parsed?.batch ?? parsed?.batchId ?? parsed);
        } catch {
          studentBatchId = normalizeBatchValue(metadata);
        }
      } else {
        studentBatchId = normalizeBatchValue((metadata as any)?.batch_id ?? (metadata as any)?.batch ?? (metadata as any)?.batchId);
      }

      let resolvedStudentBatchId = studentBatchId;

      // 1a. Fetch batch and course info
      if (studentBatchId) {
        let batchQuery = supabase
          .from('batches')
          .select('id, name, module_subject_id')
          .eq('organization_id', organizationId!);

        if (currentBranchId) {
          batchQuery = batchQuery.eq('branch_id', currentBranchId);
        }

        const { data: batchById } = await batchQuery.eq('id', studentBatchId).maybeSingle();

        let batchData = batchById;
        if (!batchData) {
          let batchByNameQuery = supabase
            .from('batches')
            .select('id, name, module_subject_id')
            .eq('organization_id', organizationId!);

          if (currentBranchId) {
            batchByNameQuery = batchByNameQuery.eq('branch_id', currentBranchId);
          }

          const { data: batchByName } = await batchByNameQuery
            .ilike('name', studentBatchId)
            .limit(1)
            .maybeSingle();

          batchData = batchByName;
        }

        if (batchData) {
          setBatchInfo({ id: batchData.id, name: batchData.name });
          resolvedStudentBatchId = batchData.id;

          if (batchData.module_subject_id) {
            const { data: courseData } = await supabase
              .from('module_subjects')
              .select('id, name')
              .eq('id', batchData.module_subject_id)
              .maybeSingle();

            if (courseData) {
              setCourseInfo({ id: courseData.id, name: courseData.name });
            }
          }
        }
      }

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
      if (resolvedStudentBatchId) {
        const { data: batchClasses } = await supabase
          .from('class_batches')
          .select('class_id')
          .eq('batch_id', resolvedStudentBatchId);

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
            .select('id, full_name, short_name')
            .in('id', facultyIds);
          (facultyProfiles || []).forEach((fp: any) => {
            facultyMap[fp.id] = fp.short_name || fp.full_name;
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

            // Fetch sub-groups assigned to these sessions
            const { data: ssgData } = await supabase
              .from('session_module_sub_groups')
              .select('session_id, module_sub_group_id, module_sub_groups (id, name, group_id, sort_order)')
              .in('session_id', allSessionIds);

            const allSubGroupIds = (ssgData || []).map((s: any) => s.module_sub_groups?.id).filter(Boolean);
            let sgFilesData: any[] = [];
            if (allSubGroupIds.length > 0) {
              const { data: sgf } = await supabase
                .from('module_files')
                .select('*')
                .in('sub_group_id', allSubGroupIds)
                .order('sort_order', { ascending: true });
              sgFilesData = sgf || [];
            }

            const modulesMap = new Map<string, any>();
            (smgData || []).forEach((item: any) => {
              if (!item.module_groups) return;
              const groupId = item.module_groups.id;
              const sessionId = item.session_id;
              const mapKey = `${sessionId}:${groupId}`;
              if (!modulesMap.has(mapKey)) {
                const groupFiles = (filesData || []).filter((f: any) => f.group_id === groupId);
                const session = enrichedSessions.find((s: any) => s.id === sessionId);
                const subGroups = (ssgData || [])
                  .filter((s: any) => s.session_id === sessionId && s.module_sub_groups?.group_id === groupId)
                  .map((s: any) => ({
                    ...s.module_sub_groups,
                    files: sgFilesData.filter((f: any) => f.sub_group_id === s.module_sub_groups?.id),
                  }));
                modulesMap.set(mapKey, {
                  id: mapKey,
                  name: item.module_groups.name,
                  subjectName: item.module_groups.module_subjects?.name || 'Unknown',
                  sessionTitle: session?.title || 'Session',
                  sessionDate: session?.start_time,
                  className: session?.classes?.name || 'Class',
                  files: groupFiles,
                  subGroups,
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
        const online_present = rawAttendance.filter((a: any) => a.status === 'online_present').length;
        const absent = rawAttendance.filter((a: any) => a.status === 'absent').length;
        const late = rawAttendance.filter((a: any) => a.status === 'late').length;
        const total = rawAttendance.length;
        setAttendanceStats({
          present,
          online_present,
          absent,
          late,
          total,
          percentage: total > 0 ? Math.round(((present + online_present) / total) * 100) : 0,
        });

        const monthMap: Record<string, { present: number; online_present: number; absent: number; late: number; total: number }> = {};
        rawAttendance.forEach((a: any) => {
          const monthKey = new Date(a.date).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
          if (!monthMap[monthKey]) monthMap[monthKey] = { present: 0, online_present: 0, absent: 0, late: 0, total: 0 };
          monthMap[monthKey].total++;
          if (a.status === 'present') monthMap[monthKey].present++;
          else if (a.status === 'online_present') monthMap[monthKey].online_present++;
          else if (a.status === 'absent') monthMap[monthKey].absent++;
          else if (a.status === 'late') monthMap[monthKey].late++;
        });
        setAttendanceData(
          Object.entries(monthMap).map(([month, data]) => ({
            month,
            present: data.present,
            online_present: data.online_present,
            absent: data.absent,
            late: data.late,
            percentage: data.total > 0 ? Math.round(((data.present + data.online_present) / data.total) * 100) : 0,
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
    setSessionDetailsLoading(true);
    setSessionDetailsError(null);
    setSessionModules([]);
    setSessionModuleFiles({});
    setSessionSubGroups({});
    setSessionSubGroupFiles({});

    try {
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
      })).filter(Boolean).sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0)) || [];
      setSessionModules(mods);

      // Fetch sub-groups assigned to this session
      const { data: ssgData, error: ssgError } = await supabase
        .from('session_module_sub_groups')
        .select(`
          module_sub_group_id,
          module_sub_groups (
            id,
            group_id,
            name,
            description,
            sort_order
          )
        `)
        .eq('session_id', session.id);

      if (ssgError) throw ssgError;

      const subGroupsMap: Record<string, any[]> = {};
      const allSubGroupIds: string[] = [];
      (ssgData || []).forEach((item: any) => {
        const sg = item.module_sub_groups;
        if (!sg) return;
        if (!subGroupsMap[sg.group_id]) subGroupsMap[sg.group_id] = [];
        subGroupsMap[sg.group_id].push(sg);
        allSubGroupIds.push(sg.id);
      });
      Object.keys(subGroupsMap).forEach((groupId) => {
        subGroupsMap[groupId] = subGroupsMap[groupId].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      });
      setSessionSubGroups(subGroupsMap);

      // Fetch files for groups (direct) and sub-groups
      const groupIds = mods.map((m: any) => m.id).filter(Boolean);
      const filesMap: Record<string, any[]> = {};
      const sgFilesMap: Record<string, any[]> = {};

      if (groupIds.length > 0) {
        const { data: filesData, error: groupFilesError } = await supabase
          .from('module_files')
          .select('*')
          .in('group_id', groupIds)
          .is('sub_group_id', null)
          .order('sort_order', { ascending: true });

        if (groupFilesError) throw groupFilesError;

        (filesData || []).forEach((f: any) => {
          if (!filesMap[f.group_id]) filesMap[f.group_id] = [];
          filesMap[f.group_id].push(f);
        });
      }
      setSessionModuleFiles(filesMap);

      if (allSubGroupIds.length > 0) {
        const { data: sgFilesData, error: subGroupFilesError } = await supabase
          .from('module_files')
          .select('*')
          .in('sub_group_id', allSubGroupIds)
          .order('sort_order', { ascending: true });

        if (subGroupFilesError) throw subGroupFilesError;

        (sgFilesData || []).forEach((f: any) => {
          if (!sgFilesMap[f.sub_group_id]) sgFilesMap[f.sub_group_id] = [];
          sgFilesMap[f.sub_group_id].push(f);
        });
      }
      setSessionSubGroupFiles(sgFilesMap);
    } catch (err) {
      console.error('Error fetching session details:', err);
      setSessionDetailsError('Could not load module details for this class. Please try again.');
      setSessionModules([]);
      setSessionModuleFiles({});
      setSessionSubGroups({});
      setSessionSubGroupFiles({});
    } finally {
      setSessionDetailsLoading(false);
    }
  };

  const ATTENDANCE_COLORS = ['#10b981', '#ef4444', '#f59e0b'];

  const handleJoinMeeting = async (session: any) => {
    // Open the meeting link first
    if (session.meet_link) {
      window.open(session.meet_link, '_blank', 'noopener,noreferrer');
    }

    // Auto-mark online attendance
    if (!user?.id || !organizationId) return;
    try {
      const today = new Date();
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const classId = session.classes?.id || session.class_id || null;

      // Check if attendance already marked for this class today
      let matchQuery = supabase
        .from('attendance')
        .select('id, status')
        .eq('student_id', user.id)
        .eq('date', dateStr)
        .eq('organization_id', organizationId)
        .or('session.is.null,session.eq.full');
      if (classId) matchQuery = matchQuery.eq('class_id', classId);

      const { data: existing } = await matchQuery.maybeSingle();

      if (existing) {
        // Only upgrade to online_present if not already physically present
        if (existing.status !== 'present') {
          await supabase
            .from('attendance')
            .update({ status: 'online_present', attendance_source: 'meet_join', marked_at: new Date().toISOString() })
            .eq('id', existing.id);
        }
      } else {
        await supabase.from('attendance').insert({
          organization_id: organizationId,
          student_id: user.id,
          date: dateStr,
          status: 'online_present',
          attendance_source: 'meet_join',
          class_id: classId,
          marked_at: new Date().toISOString(),
          marked_by: user.id,
          ...(profile?.branch_id ? { branch_id: profile.branch_id } : {}),
        } as any);
      }

      toast({
        title: 'Attendance marked',
        description: 'Your online attendance has been recorded.',
      });
    } catch (err) {
      console.error('Failed to mark online attendance:', err);
    }
  };

  const pieData = [
    { name: 'Present', value: attendanceStats.present, color: '#10b981' },
    { name: 'Online Present', value: attendanceStats.online_present, color: '#8b5cf6' },
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

      {/* Your Info */}
      {(batchInfo || courseInfo) && (
        <div className="flex flex-wrap gap-3">
          {batchInfo && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted/60 border text-sm">
              <Users className="w-4 h-4 text-primary" />
              <span className="text-muted-foreground">Batch:</span>
              <span className="font-medium">{batchInfo.name}</span>
            </div>
          )}
          {courseInfo && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted/60 border text-sm">
              <BookOpen className="w-4 h-4 text-emerald-600" />
              <span className="text-muted-foreground">Course:</span>
              <span className="font-medium">{courseInfo.name}</span>
            </div>
          )}
        </div>
      )}

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
                  <h4 className="font-semibold text-foreground">{session.classes?.name || session.title || 'Session'}</h4>
                  <p className="text-sm text-muted-foreground mt-0.5">{[session.classes?.subject, session.facultyName !== 'TBD' ? session.facultyName : null].filter(Boolean).join(' • ') || session.facultyName}</p>
                  {(() => {
                    const mods = assignedModules.filter((m: any) => m.id.startsWith(session.id + ':'));
                    if (mods.length === 0) return null;
                    return (
                      <div className="mt-1.5 flex flex-col gap-1">
                        {mods.map((m: any) => (
                          <div key={m.id} className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-primary font-medium">{m.subjectName}</span>
                              <span className="text-xs text-muted-foreground">›</span>
                              <span className="text-xs font-semibold">{m.name}</span>
                            </div>
                            {(m.subGroups || []).map((sg: any) => (
                              <div key={sg.id} className="flex items-center gap-1 text-xs text-muted-foreground pl-3">
                                <span>›</span><span>{sg.name}</span>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
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
                    <Button variant="outline" size="sm" onClick={() => handleJoinMeeting(session)}>
                      <Video className="w-4 h-4 mr-1" />
                      Join
                    </Button>
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
                  <h4 className="font-semibold text-foreground text-sm">{session.classes?.name || session.title || 'Session'}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">{[session.classes?.subject, session.facultyName !== 'TBD' ? session.facultyName : null].filter(Boolean).join(' • ') || session.facultyName}</p>
                  {(() => {
                    const mods = assignedModules.filter((m: any) => m.id.startsWith(session.id + ':'));
                    if (mods.length === 0) return null;
                    return (
                      <div className="mt-1 flex flex-col gap-1">
                        {mods.map((m: any) => (
                          <div key={m.id} className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-primary font-medium">{m.subjectName}</span>
                              <span className="text-xs text-muted-foreground">›</span>
                              <span className="text-xs font-semibold">{m.name}</span>
                            </div>
                            {(m.subGroups || []).map((sg: any) => (
                              <div key={sg.id} className="flex items-center gap-1 text-xs text-muted-foreground pl-3">
                                <span>›</span><span>{sg.name}</span>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
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
                  <Bar dataKey="online_present" name="Online Present" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
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
                {mod.subGroups && mod.subGroups.length > 0 && (
                  <div className="space-y-2 pl-4 border-l-2 border-violet-300/40 mt-2">
                    {mod.subGroups.map((sg: any) => (
                      <div key={sg.id} className="rounded-lg border bg-background/50 p-2 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-3.5 h-3.5 text-primary" />
                          <span className="text-sm font-medium">{sg.name}</span>
                        </div>
                        {sg.files && sg.files.length > 0 && (
                          <div className="space-y-1 pl-5">
                            {sg.files.map((file: any) => (
                              <div key={file.id} className="flex items-center justify-between p-1 rounded hover:bg-muted/40">
                                <div className="flex items-center gap-2">
                                  <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                                  <span className="text-xs">{file.title}</span>
                                </div>
                                <a href={file.file_url} target="_blank" rel="noopener noreferrer">
                                  <Button variant="ghost" size="sm" className="h-7 px-2">
                                    <Download className="w-3 h-3" />
                                  </Button>
                                </a>
                              </div>
                            ))}
                          </div>
                        )}
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
                <div className="mt-1">
                  <Button size="sm" onClick={() => handleJoinMeeting(selectedSession)}>
                    <Video className="w-4 h-4 mr-2" />
                    Join Meeting
                  </Button>
                </div>
              )}
            </div>

            {sessionDetailsLoading && (
              <div className="flex flex-col items-center justify-center py-6">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-3" />
                <p className="text-sm text-muted-foreground text-center">Loading modules...</p>
              </div>
            )}

            {!sessionDetailsLoading && sessionDetailsError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                {sessionDetailsError}
              </div>
            )}

            {!sessionDetailsLoading && !sessionDetailsError && sessionModules.length > 0 && (
              <>
                <h4 className="font-semibold text-foreground mt-4">Uploaded Documents</h4>
                {sessionModules.map((mod: any) => {
                  const directFiles = sessionModuleFiles[mod.id] || [];
                  const subGroups = sessionSubGroups[mod.id] || [];
                  const totalSubGroupFiles = subGroups.reduce((sum: number, sg: any) => sum + ((sessionSubGroupFiles[sg.id] || []).length), 0);
                  const totalFiles = directFiles.length + totalSubGroupFiles;
                  return (
                    <div key={mod.id} className="p-3 rounded-lg bg-muted/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Module: {mod.name}</p>
                          <p className="text-xs text-muted-foreground">{mod.subjectName}</p>
                        </div>
                        <Badge variant="outline">{totalFiles} document{totalFiles !== 1 ? 's' : ''}</Badge>
                      </div>
                      {/* Direct group files */}
                      {directFiles.length > 0 && (
                        <div className="space-y-1 pl-3 border-l-2 border-primary/20">
                          <p className="text-xs font-medium text-muted-foreground">Submodule: Direct Module Files</p>
                          {directFiles.map((file: any) => (
                            <div key={file.id} className="flex items-center justify-between p-1.5 rounded hover:bg-muted/50">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-sm truncate">{file.title}</p>
                                  {file.file_size && (
                                    <p className="text-xs text-muted-foreground">
                                      {file.file_type?.toUpperCase()} • {(file.file_size / 1024).toFixed(1)} KB
                                    </p>
                                  )}
                                </div>
                              </div>
                              <a href={file.file_url} target="_blank" rel="noopener noreferrer" download>
                                <Button variant="ghost" size="sm" className="gap-1 h-7 px-2">
                                  <Download className="w-3.5 h-3.5" />
                                  Download
                                </Button>
                              </a>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Sub-groups with their files */}
                      {subGroups.length > 0 && (
                        <div className="space-y-2 pl-3 border-l-2 border-violet-300/40">
                          {subGroups.map((sg: any) => {
                            const sgFiles = sessionSubGroupFiles[sg.id] || [];
                            return (
                              <div key={sg.id} className="rounded-lg border bg-background/50 p-2 space-y-1.5">
                                <div className="flex items-center gap-2">
                                  <BookOpen className="w-3.5 h-3.5 text-primary" />
                                  <span className="text-sm font-medium">{sg.name}</span>
                                  {sgFiles.length > 0 && (
                                    <span className="text-[10px] text-muted-foreground border rounded px-1">
                                      {sgFiles.length} file{sgFiles.length !== 1 ? 's' : ''}
                                    </span>
                                  )}
                                </div>
                                {sgFiles.length === 0 && (
                                  <p className="text-xs text-muted-foreground pl-5">No documents uploaded for this submodule.</p>
                                )}
                                {sg.description && (
                                  <p className="text-xs text-muted-foreground pl-5">{sg.description}</p>
                                )}
                                {sgFiles.length > 0 && (
                                  <div className="space-y-1 pl-5">
                                    {sgFiles.map((file: any) => (
                                      <div key={file.id} className="flex items-center justify-between p-1.5 rounded hover:bg-muted/50">
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                          <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                                          <div className="min-w-0">
                                            <p className="text-sm truncate">{file.title}</p>
                                            {file.file_size && (
                                              <p className="text-xs text-muted-foreground">
                                                {file.file_type?.toUpperCase()} • {(file.file_size / 1024).toFixed(1)} KB
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                        <a href={file.file_url} target="_blank" rel="noopener noreferrer" download>
                                          <Button variant="ghost" size="sm" className="gap-1 h-7 px-2">
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
                          })}
                        </div>
                      )}

                      {directFiles.length === 0 && subGroups.length === 0 && (
                        <p className="text-xs text-muted-foreground">No uploaded documents in this module.</p>
                      )}
                    </div>
                  );
                })}
              </>
            )}

            {!sessionDetailsLoading && !sessionDetailsError && sessionModules.length === 0 && (
              <div className="flex flex-col items-center justify-center py-6">
                <BookOpen className="w-8 h-8 text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground text-center">No modules assigned to this class yet.</p>
              </div>
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
  const { branchVersion } = useBranch();
  const [todaySessions, setTodaySessions] = useState<any[]>([]);
  const [upcomingSessions, setUpcomingSessions] = useState<any[]>([]);
  const [assignedModules, setAssignedModules] = useState<any[]>([]);
  const [attendanceStats, setAttendanceStats] = useState<any>({
    totalClasses: 0,
    totalSessions: 0,
    avgAttendance: 0,
    totalTeachingHours: 0,
    upcomingClassesCount: 0,
  });
  const [facultyAttendancePieData, setFacultyAttendancePieData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<any | null>(null);
  const [sessionModules, setSessionModules] = useState<any[]>([]);
  const [sessionCompletions, setSessionCompletions] = useState<Record<string, boolean>>({});
  const [sessionBatchIds, setSessionBatchIds] = useState<string[]>([]);
  const [markingComplete, setMarkingComplete] = useState<string | null>(null);
  const [sessionModuleFiles, setSessionModuleFiles] = useState<Record<string, any[]>>({});
  const [sessionSubGroups, setSessionSubGroups] = useState<Record<string, any[]>>({});
  const [sessionSubGroupFiles, setSessionSubGroupFiles] = useState<Record<string, any[]>>({});

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

      // Batch all queries in parallel - filtered to faculty's own branch
      const facultyBranchId = profile?.branch_id;

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
      if (facultyBranchId) classesQuery = classesQuery.eq('branch_id', facultyBranchId);

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
      if (facultyBranchId) allSessionsQuery = allSessionsQuery.eq('branch_id', facultyBranchId);

      let classCountQuery = supabase
          .from('classes')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', organizationId)
          .eq('faculty_id', user?.id)
          .eq('is_active', true);
      if (facultyBranchId) classCountQuery = classCountQuery.eq('branch_id', facultyBranchId);

      let sessionCountQuery = supabase
          .from('sessions')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', organizationId)
          .eq('faculty_id', user?.id);
      if (facultyBranchId) sessionCountQuery = sessionCountQuery.eq('branch_id', facultyBranchId);

      let teachingHoursQuery = supabase
          .from('sessions')
          .select('start_time, end_time')
          .eq('organization_id', organizationId)
          .eq('faculty_id', user?.id);
      if (facultyBranchId) teachingHoursQuery = teachingHoursQuery.eq('branch_id', facultyBranchId);

      const [
        { data: classesData },
        { data: allSessionsData },
        { count: classCount },
        { count: sessionCount },
        { data: teachingSessionsData },
      ] = await Promise.all([
        classesQuery.order('name', { ascending: true }),
        allSessionsQuery.order('start_time', { ascending: true }),
        classCountQuery,
        sessionCountQuery,
        teachingHoursQuery,
      ]);

      // Filter sessions for faculty
      const facultySessions = (allSessionsData || []).filter((session: any) =>
        session.faculty_id === user?.id || session.classes?.faculty_id === user?.id
      );

      // Attach batch names to each session via class -> batches mapping.
      let sessionsWithBatchNames = facultySessions;
      const facultyClassIds = Array.from(
        new Set(
          facultySessions
            .map((session: any) => session.classes?.id)
            .filter(Boolean)
        )
      );
      if (facultyClassIds.length > 0) {
        const { data: classBatchRows } = await supabase
          .from('class_batches')
          .select('class_id, batches(id, name)')
          .in('class_id', facultyClassIds as string[]);

        const batchNamesByClassId: Record<string, string[]> = {};
        (classBatchRows || []).forEach((row: any) => {
          const classId = row.class_id as string;
          const batchName = row.batches?.name as string | undefined;
          if (!classId || !batchName) return;
          if (!batchNamesByClassId[classId]) batchNamesByClassId[classId] = [];
          if (!batchNamesByClassId[classId].includes(batchName)) {
            batchNamesByClassId[classId].push(batchName);
          }
        });

        sessionsWithBatchNames = facultySessions.map((session: any) => {
          const classId = session.classes?.id as string | undefined;
          const batchNames = classId ? (batchNamesByClassId[classId] || []) : [];
          return {
            ...session,
            batchNames,
            batchDisplay: batchNames.length > 0 ? batchNames.join(', ') : 'No batch assigned',
          };
        });
      }

      // Split into today and upcoming
      const todayFiltered = sessionsWithBatchNames.filter((s: any) => {
        const sessionDate = new Date(s.start_time);
        return sessionDate >= startOfDay && sessionDate <= endOfDay;
      });
      setTodaySessions(todayFiltered);

      const allUpcoming = sessionsWithBatchNames.filter((s: any) => {
        const sessionDate = new Date(s.start_time);
        return sessionDate >= tomorrow;
      });
      setUpcomingSessions(allUpcoming.slice(0, 5));

      // Calculate total teaching hours
      let totalTeachingMinutes = 0;
      (teachingSessionsData || []).forEach((s: any) => {
        if (s.start_time && s.end_time) {
          totalTeachingMinutes += (new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / 60000;
        } else {
          totalTeachingMinutes += 60; // fallback: 1 hr per session
        }
      });
      const totalTeachingHours = Math.round(totalTeachingMinutes / 60);

      // Calculate attendance stats
      let avgAttendance = 0;
      let attPresent = 0, attAbsent = 0, attLate = 0;
      if (classesData && classesData.length > 0) {
        const { data: attendanceData } = await supabase
          .from('attendance')
          .select('status, class_id')
          .eq('organization_id', organizationId)
          .in('class_id', classesData.map((c: any) => c.id));

        if (attendanceData && attendanceData.length > 0) {
          attPresent = attendanceData.filter((a: any) => a.status === 'present').length;
          attAbsent = attendanceData.filter((a: any) => a.status === 'absent').length;
          attLate = attendanceData.filter((a: any) => a.status === 'late').length;
          avgAttendance = Math.round((attPresent / attendanceData.length) * 100);
        }
      }

      setFacultyAttendancePieData([
        { name: 'Present', value: attPresent, color: '#10b981' },
        { name: 'Absent', value: attAbsent, color: '#ef4444' },
        { name: 'Late', value: attLate, color: '#f59e0b' },
      ].filter((d) => d.value > 0));

      setAttendanceStats({
        totalClasses: classCount || 0,
        totalSessions: sessionCount || 0,
        avgAttendance,
        totalTeachingHours,
        upcomingClassesCount: allUpcoming.length,
      });

      // Fetch assigned modules for the faculty's classes
      const upcomingFiltered = allUpcoming.slice(0, 5);
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

      // Fetch sub-groups ONLY for these sessions (via session_module_sub_groups)
      const { data: ssgData } = await supabase
        .from('session_module_sub_groups')
        .select('session_id, module_sub_group_id, module_sub_groups (id, name, description, sort_order, group_id)')
        .in('session_id', sessionIds);

      // Map: groupId+sessionId -> assigned sub-group IDs for that session
      const sessionSubGroupMap = new Map<string, string[]>(); // key: `${sessionId}:${groupId}`
      const allAssignedSubGroupIds: string[] = [];
      (ssgData || []).forEach((item: any) => {
        const sg = item.module_sub_groups;
        if (!sg) return;
        allAssignedSubGroupIds.push(sg.id);
      });

      // Fetch files for module groups (top-level only)
      const { data: filesData, error: filesError } = await supabase
        .from('module_files')
        .select('*')
        .in('group_id', groupIds)
        .is('sub_group_id', null)
        .order('sort_order', { ascending: true });

      if (filesError) throw filesError;

      // Fetch files for assigned sub-groups
      let subGroupFilesData: any[] = [];
      if (allAssignedSubGroupIds.length > 0) {
        const { data: sgFiles } = await supabase
          .from('module_files')
          .select('*')
          .in('sub_group_id', allAssignedSubGroupIds)
          .order('sort_order', { ascending: true });
        subGroupFilesData = sgFiles || [];
      }

      // Build the modules with files and only session-assigned sub-groups
      const modulesMap = new Map<string, any>();

      (smgData || []).forEach((item: any) => {
        if (!item.module_groups) return;
        const groupId = item.module_groups.id;
        const sessionId = item.session_id;
        const mapKey = `${sessionId}:${groupId}`;
        if (!modulesMap.has(mapKey)) {
          const groupFiles = (filesData || []).filter((f: any) => f.group_id === groupId);
          // Only include sub-groups assigned to THIS specific session
          const subGroups = (ssgData || [])
            .filter((s: any) => s.session_id === sessionId && s.module_sub_groups?.group_id === groupId)
            .map((s: any) => ({
              ...s.module_sub_groups,
              files: subGroupFilesData.filter((f: any) => f.sub_group_id === s.module_sub_groups?.id),
            }));
          const session = allSessions.find((s: any) => s.id === sessionId);
          const className = session?.classes?.name || 'Class';
          const sessionTitle = session?.title || 'Session';
          modulesMap.set(mapKey, {
            id: mapKey,
            groupId,
            name: item.module_groups.name,
            subjectName: item.module_groups.module_subjects?.name || 'Unknown',
            sessionTitle,
            sessionDate: session?.start_time,
            className,
            files: groupFiles,
            subGroups,
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
    setSessionSubGroups({});
    setSessionSubGroupFiles({});
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

      // Fetch sub-groups assigned to this session
      const { data: ssgData } = await supabase
        .from('session_module_sub_groups')
        .select(`
          module_sub_group_id,
          module_sub_groups (
            id,
            group_id,
            name,
            description,
            sort_order
          )
        `)
        .eq('session_id', session.id);

      const subGroupsMap: Record<string, any[]> = {};
      const allSubGroupIds: string[] = [];
      (ssgData || []).forEach((item: any) => {
        const sg = item.module_sub_groups;
        if (!sg) return;
        if (!subGroupsMap[sg.group_id]) subGroupsMap[sg.group_id] = [];
        subGroupsMap[sg.group_id].push(sg);
        allSubGroupIds.push(sg.id);
      });
      setSessionSubGroups(subGroupsMap);

      // Fetch files for groups (direct) and sub-groups
      const groupIds = mods.map((m: any) => m.id).filter(Boolean);
      const filesMap: Record<string, any[]> = {};
      const sgFilesMap: Record<string, any[]> = {};

      if (groupIds.length > 0) {
        const { data: filesData } = await supabase
          .from('module_files')
          .select('*')
          .in('group_id', groupIds)
          .is('sub_group_id', null)
          .order('sort_order', { ascending: true });

        (filesData || []).forEach((f: any) => {
          if (!filesMap[f.group_id]) filesMap[f.group_id] = [];
          filesMap[f.group_id].push(f);
        });
      }
      setSessionModuleFiles(filesMap);

      if (allSubGroupIds.length > 0) {
        const { data: sgFilesData } = await supabase
          .from('module_files')
          .select('*')
          .in('sub_group_id', allSubGroupIds)
          .order('sort_order', { ascending: true });

        (sgFilesData || []).forEach((f: any) => {
          if (!sgFilesMap[f.sub_group_id]) sgFilesMap[f.sub_group_id] = [];
          sgFilesMap[f.sub_group_id].push(f);
        });
      }
      setSessionSubGroupFiles(sgFilesMap);

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
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

        <Card className="border shadow-card hover:shadow-soft transition-all hover:-translate-y-1 bg-gradient-to-br from-blue-500/10 to-cyan-500/10">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg">
                <Clock className="w-6 h-6 text-white" />
              </div>
              <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-300/30">Total</Badge>
            </div>
            <div className="mt-4">
              <p className="text-3xl font-bold text-foreground">{attendanceStats.totalTeachingHours}</p>
              <p className="text-sm text-muted-foreground mt-1">Teaching Hours</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-card hover:shadow-soft transition-all hover:-translate-y-1 bg-gradient-to-br from-violet-500/10 to-purple-500/10">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center shadow-lg">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <Badge variant="outline" className="bg-violet-500/10 text-violet-600 border-violet-300/30">Next 7d</Badge>
            </div>
            <div className="mt-4">
              <p className="text-3xl font-bold text-foreground">{attendanceStats.upcomingClassesCount}</p>
              <p className="text-sm text-muted-foreground mt-1">Upcoming Classes</p>
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
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <Layers className="w-3 h-3" />
                        Batch: {session.batchDisplay || 'No batch assigned'}
                      </p>
                      {/* <p className="text-sm text-muted-foreground">{session.title}</p> */}
                    </div>
                  </div>
                  {(() => {
                    const mods = assignedModules.filter((m: any) => m.id.startsWith(session.id + ':'));
                    if (mods.length === 0) return null;
                    return (
                      <div className="mb-3 space-y-1">
                        {mods.map((m: any) => (
                          <div key={m.id} className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1">
                              <Badge variant="secondary" className="text-xs h-5 px-1.5">{m.subjectName}</Badge>
                              <span className="text-muted-foreground text-xs">›</span>
                              <span className="text-xs font-semibold">{m.name}</span>
                            </div>
                            {(m.subGroups || []).map((sg: any) => (
                              <div key={sg.id} className="flex items-center gap-1 text-xs text-muted-foreground pl-3">
                                <span>›</span><span>{sg.name}</span>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
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
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge variant="secondary" className="text-xs">{mod.subjectName}</Badge>
                        <span className="text-muted-foreground text-xs">›</span>
                        <h3 className="font-semibold text-foreground">{mod.name}</h3>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap mt-1">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <BookOpen className="w-3 h-3" />{mod.className}
                        </span>
                        {mod.sessionTitle !== mod.className && (
                          <span className="text-xs text-muted-foreground">&middot; {mod.sessionTitle}</span>
                        )}
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

                  {/* Top-level module files */}
                  {mod.files && mod.files.length > 0 && (
                    <div className="space-y-2 mt-3 pt-3 border-t">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Module Files</p>
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
                          <a href={file.file_url} target="_blank" rel="noopener noreferrer" download>
                            <Button size="sm" variant="outline" className="gap-1.5 flex-shrink-0">
                              <Download className="w-3.5 h-3.5" />Download
                            </Button>
                          </a>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Sub-groups */}
                  {mod.subGroups && mod.subGroups.length > 0 && (
                    <div className="mt-3 pt-3 border-t space-y-3">
                      {mod.subGroups.map((sg: any) => (
                        <div key={sg.id} className="rounded-lg border border-dashed bg-muted/10 p-3">
                          <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />
                            {sg.name}
                          </p>
                          {sg.files && sg.files.length > 0 ? (
                            <div className="space-y-1.5">
                              {sg.files.map((file: any) => (
                                <div key={file.id} className="flex items-center justify-between p-2 rounded-lg bg-background/60 hover:bg-muted/40 transition-colors">
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                                    <div className="min-w-0">
                                      <p className="text-xs font-medium truncate">{file.title}</p>
                                      {file.file_size && (
                                        <p className="text-[10px] text-muted-foreground">
                                          {(file.file_size / 1024).toFixed(0)} KB
                                          {file.file_type && ` · ${file.file_type}`}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  <a href={file.file_url} target="_blank" rel="noopener noreferrer" download>
                                    <Button size="sm" variant="ghost" className="gap-1 flex-shrink-0 h-7 px-2 text-xs">
                                      <Download className="w-3 h-3" />Download
                                    </Button>
                                  </a>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground italic">No files in this sub-module yet.</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Empty state when no files at all */}
                  {(!mod.files || mod.files.length === 0) && (!mod.subGroups || mod.subGroups.length === 0) && (
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
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <Layers className="w-3 h-3" />
                        Batch: {session.batchDisplay || 'No batch assigned'}
                      </p>
                      {(() => {
                        const mods = assignedModules.filter((m: any) => m.id.startsWith(session.id + ':'));
                        if (mods.length === 0) return <p className="text-sm text-muted-foreground">{session.title}</p>;
                        return (
                          <div className="mt-1 flex flex-col gap-1">
                            {mods.map((m: any) => (
                              <div key={m.id} className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-1">
                                  <Badge variant="secondary" className="text-xs h-5 px-1.5">{m.subjectName}</Badge>
                                  <span className="text-muted-foreground text-xs">›</span>
                                  <span className="text-xs font-semibold">{m.name}</span>
                                </div>
                                {(m.subGroups || []).map((sg: any) => (
                                  <div key={sg.id} className="flex items-center gap-1 text-xs text-muted-foreground pl-3">
                                    <span>›</span><span>{sg.name}</span>
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        );
                      })()}
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

      {/* Attendance Breakdown */}
      {facultyAttendancePieData.length > 0 && (
        <Card className="border shadow-card">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                <PieChart className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Attendance Breakdown</CardTitle>
                <CardDescription>Overall attendance across your classes</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row items-center gap-6">
            <div className="w-full sm:w-2/3">
              <ResponsiveContainer width="100%" height={220}>
                <RechartsPieChart>
                  <Pie
                    data={facultyAttendancePieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {facultyAttendancePieData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col gap-3 min-w-[160px]">
              {facultyAttendancePieData.map((entry: any) => (
                <div key={entry.name} className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                  <span className="text-sm text-muted-foreground">{entry.name}:</span>
                  <span className="text-sm font-semibold">{entry.value}</span>
                </div>
              ))}
              <div className="mt-2 border-t pt-2">
                <p className="text-2xl font-bold text-primary">{attendanceStats.avgAttendance}%</p>
                <p className="text-xs text-muted-foreground">Avg Attendance</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedSession && (
        <Dialog open={!!selectedSession} onOpenChange={() => setSelectedSession(null)}>
          <DialogContent className="w-[calc(100vw-1rem)] max-w-2xl max-h-[85vh] overflow-y-auto p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle>{selectedSession.classes?.name}</DialogTitle>
              {/* <DialogDescription>{selectedSession.title}</DialogDescription> */}
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Batch</p>
                  <p className="font-medium mt-1 break-words">{selectedSession.batchDisplay || 'No batch assigned'}</p>
                </div>
              </div>

              {selectedSession.meet_link && (
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <span className="text-sm font-medium text-primary">Google Meet Link</span>
                  <a href={selectedSession.meet_link} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" className="w-full sm:w-auto">Join Meeting</Button>
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
                      const directFiles = sessionModuleFiles[mod.id] || [];
                      const subGroups = sessionSubGroups[mod.id] || [];
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
                              <Badge variant="secondary" className="text-xs">
                                Pending
                              </Badge>
                            )}
                          </div>
                          {/* Direct group files */}
                          {directFiles.length > 0 && (
                            <div className="mt-2 pt-2 border-t space-y-1.5">
                              {directFiles.map((file: any) => (
                                <div key={file.id} className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors">
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                                    <div className="min-w-0">
                                      <p className="text-sm truncate">{file.title}</p>
                                      {file.file_size && (
                                        <p className="text-xs text-muted-foreground">
                                          {file.file_type?.toUpperCase()} • {(file.file_size / 1024).toFixed(1)} KB
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  <a href={file.file_url} target="_blank" rel="noopener noreferrer" download>
                                    <Button size="sm" variant="ghost" className="gap-1 h-7 px-2 shrink-0">
                                      <Download className="w-3.5 h-3.5" />
                                      <span className="hidden sm:inline">Download</span>
                                    </Button>
                                  </a>
                                </div>
                              ))}
                            </div>
                          )}
                          {/* Sub-groups with their files */}
                          {subGroups.length > 0 && (
                            <div className="mt-2 pt-2 border-t space-y-2">
                              {subGroups.map((sg: any) => {
                                const sgFiles = sessionSubGroupFiles[sg.id] || [];
                                return (
                                  <div key={sg.id} className="rounded-lg border bg-muted/20 p-2 space-y-1.5">
                                    <div className="flex items-center gap-2">
                                      <BookOpen className="w-3.5 h-3.5 text-primary" />
                                      <span className="text-sm font-medium">{sg.name}</span>
                                      {sgFiles.length > 0 && (
                                        <span className="text-[10px] text-muted-foreground border rounded px-1">
                                          {sgFiles.length} file{sgFiles.length !== 1 ? 's' : ''}
                                        </span>
                                      )}
                                    </div>
                                    {sg.description && (
                                      <p className="text-xs text-muted-foreground pl-5">{sg.description}</p>
                                    )}
                                    {sgFiles.length > 0 && (
                                      <div className="space-y-1 pl-5">
                                        {sgFiles.map((file: any) => (
                                          <div key={file.id} className="flex items-center justify-between gap-2 p-1.5 rounded hover:bg-muted/50">
                                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                              <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                                              <div className="min-w-0">
                                                <p className="text-sm truncate">{file.title}</p>
                                                {file.file_size && (
                                                  <p className="text-xs text-muted-foreground">
                                                    {file.file_type?.toUpperCase()} • {(file.file_size / 1024).toFixed(1)} KB
                                                  </p>
                                                )}
                                              </div>
                                            </div>
                                            <a href={file.file_url} target="_blank" rel="noopener noreferrer" download>
                                              <Button size="sm" variant="ghost" className="gap-1 h-7 px-2 shrink-0">
                                                <Download className="w-3.5 h-3.5" />
                                                <span className="hidden sm:inline">Download</span>
                                              </Button>
                                            </a>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
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

// Schedule Coordinator Dashboard
function ScheduleCoordinatorDashboard() {
  const { user, profile } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalClassesToday: 0,
    totalStudents: 0,
    overallAttendancePct: 0,
    activeBatches: 0,
  });
  const [todaySchedule, setTodaySchedule] = useState<any[]>([]);
  const [upcomingSchedule, setUpcomingSchedule] = useState<any[]>([]);
  const [scheduleModules, setScheduleModules] = useState<any[]>([]);
  const [attendanceOverview, setAttendanceOverview] = useState({ present: 0, absent: 0, late: 0 });
  const [batchSummary, setBatchSummary] = useState<any[]>([]);

  const organizationId = user?.organizationId || profile?.organization_id;
  const branchId = !isAdmin ? (profile?.branch_id || null) : null;

  useEffect(() => {
    if (organizationId) {
      fetchData();
    }
  }, [organizationId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      const endOfNextWeek = new Date();
      endOfNextWeek.setDate(endOfNextWeek.getDate() + 7);
      const todayStr = startOfDay.toISOString().split('T')[0];

      let studentsQ = supabase
        .from('profiles').select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('role', 'student');
      if (branchId) studentsQ = studentsQ.eq('branch_id', branchId);

      let batchesQ = supabase
        .from('batches').select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('is_active', true);
      if (branchId) batchesQ = batchesQ.eq('branch_id', branchId);

      let todayScheduleQ = supabase
        .from('sessions')
        .select('id, title, start_time, end_time, meet_link, branch_id, class_id, classes(id, name, subject, room_number, faculty_id, branch_id)')
        .eq('organization_id', organizationId)
        .gte('start_time', startOfDay.toISOString())
        .lte('start_time', endOfDay.toISOString())
        .order('start_time', { ascending: true });

      let upcomingQ = supabase
        .from('sessions')
        .select('id, title, start_time, end_time, branch_id, class_id, classes(id, name, subject, room_number, faculty_id, branch_id)')
        .eq('organization_id', organizationId)
        .gt('start_time', endOfDay.toISOString())
        .lte('start_time', endOfNextWeek.toISOString())
        .order('start_time', { ascending: true })
        .limit(20);

      let weekSessionsQ = supabase
        .from('sessions')
        .select('id, class_id, branch_id, classes(branch_id)')
        .eq('organization_id', organizationId)
        .gte('start_time', startOfWeek.toISOString())
        .lte('start_time', endOfNextWeek.toISOString());

      const [
        { count: studentCount },
        { count: batchCount },
        { data: todaySessionsData },
        { data: upcomingData },
        { data: weekSessionsData },
      ] = await Promise.all([
        studentsQ,
        batchesQ,
        todayScheduleQ,
        upcomingQ,
        weekSessionsQ,
      ]);

      let branchClassIds = new Set<string>();
      if (branchId) {
        const { data: branchBatches } = await supabase
          .from('batches')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('branch_id', branchId);

        const branchBatchIds = (branchBatches || []).map((b: any) => b.id).filter(Boolean);
        if (branchBatchIds.length > 0) {
          const { data: classBatchRows } = await supabase
            .from('class_batches')
            .select('class_id')
            .in('batch_id', branchBatchIds);
          branchClassIds = new Set((classBatchRows || []).map((row: any) => row.class_id).filter(Boolean));
        }
      }

      const filterByBranch = (sessionList: any[]) => {
        if (!branchId) return sessionList;
        const strictMatches = (sessionList || []).filter((session: any) => {
          const classBranchId = session.classes?.branch_id;
          const sessionBranchId = session.branch_id;
          const hasScopedBatchClass = session.class_id ? branchClassIds.has(session.class_id) : false;
          return classBranchId === branchId || sessionBranchId === branchId || hasScopedBatchClass;
        });

        // Keep schedules visible if branch linkage fields are incomplete.
        if (strictMatches.length === 0) {
          return sessionList || [];
        }

        return strictMatches;
      };

      const filteredTodaySessions = filterByBranch(todaySessionsData || []);
      const filteredUpcomingSessions = filterByBranch(upcomingData || []);
      const filteredWeekSessions = filterByBranch(weekSessionsData || []);

      // Helper to enrich sessions with faculty names
      const enrichWithFaculty = async (sessions: any[]) => {
        const facultyIds = [...new Set(sessions.map((s: any) => s.classes?.faculty_id).filter(Boolean))];
        const facultyMap: Record<string, string> = {};
        if (facultyIds.length > 0) {
          const { data: fps } = await supabase
            .from('profiles').select('id, full_name, short_name')
            .in('id', facultyIds as string[]);
          (fps || []).forEach((fp: any) => { facultyMap[fp.id] = fp.short_name || fp.full_name; });
        }
        return sessions.map((s: any) => ({
          ...s,
          facultyName: s.classes?.faculty_id ? (facultyMap[s.classes.faculty_id] || 'Unknown') : 'TBD',
        }));
      };

      setTodaySchedule(await enrichWithFaculty(filteredTodaySessions));
      setUpcomingSchedule(await enrichWithFaculty(filteredUpcomingSessions));

      // Fetch module groups for all schedule sessions
      const allSchedSessionIds = [
        ...filteredTodaySessions.map((s: any) => s.id),
        ...filteredUpcomingSessions.map((s: any) => s.id),
      ].filter(Boolean);

      if (allSchedSessionIds.length > 0) {
        const { data: smgData } = await supabase
          .from('session_module_groups')
          .select(`session_id, module_group_id, module_groups (id, name, module_subjects (id, name))`)
          .in('session_id', allSchedSessionIds);

        const { data: ssgData } = await supabase
          .from('session_module_sub_groups')
          .select('session_id, module_sub_group_id, module_sub_groups (id, name, group_id)')
          .in('session_id', allSchedSessionIds);

        const modulesMap = new Map<string, any>();
        (smgData || []).forEach((item: any) => {
          if (!item.module_groups) return;
          const groupId = item.module_groups.id;
          const sessionId = item.session_id;
          const mapKey = `${sessionId}:${groupId}`;
          if (!modulesMap.has(mapKey)) {
            const subGroups = (ssgData || [])
              .filter((s: any) => s.session_id === sessionId && s.module_sub_groups?.group_id === groupId)
              .map((s: any) => ({ id: s.module_sub_groups.id, name: s.module_sub_groups.name }));
            modulesMap.set(mapKey, {
              id: mapKey,
              name: item.module_groups.name,
              subjectName: item.module_groups.module_subjects?.name || 'Unknown',
              subGroups,
            });
          }
        });
        setScheduleModules(Array.from(modulesMap.values()));
      }

      // Attendance overview for today
      const todayClassIds = [...new Set(filteredTodaySessions.map((s: any) => s.class_id).filter(Boolean))];
      let attData: any[] = [];
      if (todayClassIds.length > 0) {
        const { data: todayAttData } = await supabase
          .from('attendance')
          .select('status, class_id')
          .eq('organization_id', organizationId)
          .eq('date', todayStr)
          .in('class_id', todayClassIds as string[]);
        attData = todayAttData || [];
      }
      const present = attData.filter((a: any) => a.status === 'present').length;
      const absent = attData.filter((a: any) => a.status === 'absent').length;
      const late = attData.filter((a: any) => a.status === 'late').length;
      const total = attData.length;
      setAttendanceOverview({ present, absent, late });
      const overallAttPct = total > 0 ? Math.round((present / total) * 100) : 0;

      // Batch-wise session summary for the week
      if (filteredWeekSessions && filteredWeekSessions.length > 0) {
        const classIds = [...new Set((filteredWeekSessions || []).map((s: any) => s.class_id).filter(Boolean))];
        if (classIds.length > 0) {
          const { data: cbData } = await supabase
            .from('class_batches')
            .select('class_id, batch_id, batches(id, name)')
            .in('class_id', classIds as string[]);
          const batchMap: Record<string, { name: string; count: number }> = {};
          (cbData || []).forEach((cb: any) => {
            const bId = cb.batch_id;
            const bName = cb.batches?.name || 'Unknown';
            if (!batchMap[bId]) batchMap[bId] = { name: bName, count: 0 };
            const cnt = (filteredWeekSessions || []).filter((s: any) => s.class_id === cb.class_id).length;
            batchMap[bId].count += cnt;
          });
          setBatchSummary(
            Object.entries(batchMap)
              .map(([id, d]) => ({ id, ...d }))
              .sort((a, b) => b.count - a.count)
          );
        }
      }

      setStats({
        totalClassesToday: filteredTodaySessions.length,
        totalStudents: studentCount || 0,
        overallAttendancePct: overallAttPct,
        activeBatches: batchCount || 0,
      });
    } catch (err) {
      console.error('Error fetching schedule coordinator data:', err);
    } finally {
      setLoading(false);
    }
  };

  const attPieData = [
    { name: 'Present', value: attendanceOverview.present, color: '#10b981' },
    { name: 'Absent', value: attendanceOverview.absent, color: '#ef4444' },
    { name: 'Late', value: attendanceOverview.late, color: '#f59e0b' },
  ].filter((d) => d.value > 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
            Schedule Coordinator 📅
          </h1>
          <p className="text-muted-foreground mt-1">Branch scheduling overview and attendance reports</p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm">
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
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">Today</Badge>
            </div>
            <div className="mt-4">
              <p className="text-3xl font-bold text-foreground">{stats.totalClassesToday}</p>
              <p className="text-sm text-muted-foreground mt-1">Classes Today</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-card hover:shadow-soft transition-all hover:-translate-y-1 bg-gradient-to-br from-emerald-500/10 to-green-500/10">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center shadow-lg">
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

        <Card className="border shadow-card hover:shadow-soft transition-all hover:-translate-y-1 bg-gradient-to-br from-amber-500/10 to-orange-500/10">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">Today</Badge>
            </div>
            <div className="mt-4">
              <p className="text-3xl font-bold text-foreground">{stats.overallAttendancePct}%</p>
              <p className="text-sm text-muted-foreground mt-1">Overall Attendance</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-card hover:shadow-soft transition-all hover:-translate-y-1 bg-gradient-to-br from-violet-500/10 to-purple-500/10">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center shadow-lg">
                <Layers className="w-6 h-6 text-white" />
              </div>
              <Badge variant="outline" className="bg-violet-500/10 text-violet-600 border-violet-300/30">Active</Badge>
            </div>
            <div className="mt-4">
              <p className="text-3xl font-bold text-foreground">{stats.activeBatches}</p>
              <p className="text-sm text-muted-foreground mt-1">Active Batches</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Today's Schedule */}
      <Card className="border shadow-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Today's Schedule</CardTitle>
              <CardDescription>
                {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' })}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {todaySchedule.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p>No sessions scheduled for today</p>
            </div>
          ) : (
            todaySchedule.map((session: any) => (
              <div key={session.id} className="flex items-center gap-4 p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
                <div className="flex-1">
                  <h4 className="font-semibold text-foreground">{session.classes?.name || session.title || 'Session'}</h4>
                  <p className="text-sm text-muted-foreground mt-0.5">{session.classes?.subject} • {session.facultyName}</p>
                  {(() => {
                    const mods = scheduleModules.filter((m: any) => m.id.startsWith(session.id + ':'));
                    if (mods.length === 0) return null;
                    return (
                      <div className="mt-1.5 flex flex-col gap-1">
                        {mods.map((m: any) => (
                          <div key={m.id} className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-primary font-medium">{m.subjectName}</span>
                              <span className="text-xs text-muted-foreground">›</span>
                              <span className="text-xs font-semibold">{m.name}</span>
                            </div>
                            {(m.subGroups || []).map((sg: any) => (
                              <div key={sg.id} className="flex items-center gap-1 text-xs text-muted-foreground pl-3">
                                <span>›</span><span>{sg.name}</span>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
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
                {session.meet_link && (
                  <a href={session.meet_link} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm">
                      <Video className="w-4 h-4 mr-1" />
                      Meet
                    </Button>
                  </a>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Student Attendance Overview */}
      <Card className="border shadow-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <CardTitle className="text-lg">Student Attendance Overview</CardTitle>
              <CardDescription>Today's attendance summary across all classes</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {attPieData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ClipboardCheck className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p>No attendance records for today yet</p>
            </div>
          ) : (
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="w-full md:w-1/2">
                <ResponsiveContainer width="100%" height={220}>
                  <RechartsPieChart>
                    <Pie data={attPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                      {attPieData.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-col gap-3 min-w-[180px]">
                <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-emerald-500/10">
                  <span className="text-sm font-medium text-emerald-700">Present</span>
                  <span className="text-lg font-bold text-emerald-700">{attendanceOverview.present}</span>
                </div>
                <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-red-500/10">
                  <span className="text-sm font-medium text-red-700">Absent</span>
                  <span className="text-lg font-bold text-red-700">{attendanceOverview.absent}</span>
                </div>
                <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-amber-500/10">
                  <span className="text-sm font-medium text-amber-700">Late</span>
                  <span className="text-lg font-bold text-amber-700">{attendanceOverview.late}</span>
                </div>
                <div className="p-3 rounded-lg bg-primary/10 text-center">
                  <p className="text-2xl font-bold text-primary">{stats.overallAttendancePct}%</p>
                  <p className="text-xs text-muted-foreground">Today's Rate</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upcoming Schedule */}
      {upcomingSchedule.length > 0 && (
        <Card className="border shadow-card">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Upcoming Schedule</CardTitle>
                <CardDescription>Next 7 days of sessions</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingSchedule.map((session: any) => (
              <div key={session.id} className="flex items-center gap-4 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
                <div className="flex-1">
                  <h4 className="font-semibold text-foreground text-sm">{session.classes?.name || session.title || 'Session'}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">{session.classes?.subject} • {session.facultyName}</p>
                  {(() => {
                    const mods = scheduleModules.filter((m: any) => m.id.startsWith(session.id + ':'));
                    if (mods.length === 0) return null;
                    return (
                      <div className="mt-1 flex flex-col gap-1">
                        {mods.map((m: any) => (
                          <div key={m.id} className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-primary font-medium">{m.subjectName}</span>
                              <span className="text-xs text-muted-foreground">›</span>
                              <span className="text-xs font-semibold">{m.name}</span>
                            </div>
                            {(m.subGroups || []).map((sg: any) => (
                              <div key={sg.id} className="flex items-center gap-1 text-xs text-muted-foreground pl-3">
                                <span>›</span><span>{sg.name}</span>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(session.start_time).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' })}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(session.start_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {session.classes?.room_number && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {session.classes.room_number}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Batch-wise Class Summary */}
      {batchSummary.length > 0 && (
        <Card className="border shadow-card">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Batch-wise Class Summary</CardTitle>
                <CardDescription>Sessions per batch for the current week</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {batchSummary.map((batch: any) => (
              <div key={batch.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Layers className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="font-medium text-sm">{batch.name}</span>
                </div>
                <Badge variant="secondary" className="text-sm">{batch.count} session{batch.count !== 1 ? 's' : ''}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
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

// Sales Staff Dashboard
function SalesStaffDashboard() {
  const { user, profile } = useAuth();
  const { currentBranchId, branchVersion } = useBranch();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalAdmissions: 0,
    pendingFees: 0,
    totalCollections: 0,
    newLeads: 0,
    convertedLeads: 0,
  });
  const [recentLeads, setRecentLeads] = useState<any[]>([]);

  const organizationId = user?.organizationId || profile?.organization_id;

  useEffect(() => {
    if (organizationId) fetchData();
  }, [organizationId, currentBranchId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const branchFilter = currentBranchId;
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      let studentsQuery = supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('role', 'student');
      if (branchFilter) studentsQuery = studentsQuery.eq('branch_id', branchFilter);

      let paymentsQuery = supabase
        .from('payments')
        .select('amount, amount_paid, status')
        .eq('organization_id', organizationId);
      if (branchFilter) paymentsQuery = paymentsQuery.eq('branch_id', branchFilter);

      let leadsQuery = supabase
        .from('crm_leads')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .gte('created_at', weekAgo.toISOString());
      if (branchFilter) leadsQuery = leadsQuery.eq('branch_id', branchFilter);

      let convertedQuery = supabase
        .from('crm_leads')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('status', 'converted');
      if (branchFilter) convertedQuery = convertedQuery.eq('branch_id', branchFilter);

      let recentLeadsQuery = supabase
        .from('crm_leads')
        .select('id, name, status, created_at')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(8);
      if (branchFilter) recentLeadsQuery = recentLeadsQuery.eq('branch_id', branchFilter);

      const [
        { count: studentCount },
        { data: paymentsData },
        { count: leadsCount },
        { count: convertedCount },
        { data: leadsData },
      ] = await Promise.all([
        studentsQuery,
        paymentsQuery,
        leadsQuery,
        convertedQuery,
        recentLeadsQuery,
      ]);

      let totalCollections = 0;
      let pendingFees = 0;
      (paymentsData || []).forEach((p: any) => {
        totalCollections += p.amount_paid || 0;
        pendingFees += (p.amount || 0) - (p.amount_paid || 0);
      });

      setStats({
        totalAdmissions: studentCount || 0,
        pendingFees: Math.max(0, pendingFees),
        totalCollections,
        newLeads: leadsCount || 0,
        convertedLeads: convertedCount || 0,
      });
      setRecentLeads(leadsData || []);
    } catch (error) {
      console.error('Error fetching sales data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-primary/10 text-primary';
      case 'contacted': return 'bg-blue-500/10 text-blue-500';
      case 'interested': return 'bg-amber-500/10 text-amber-500';
      case 'converted': return 'bg-green-500/10 text-green-500';
      case 'lost': return 'bg-red-500/10 text-red-500';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">Sales Dashboard</h1>
          <p className="text-muted-foreground mt-1">Admissions, fees & lead tracking</p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm">
          <Activity className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="border shadow-card bg-gradient-to-br from-indigo-500/10 to-purple-500/10">
          <CardContent className="p-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg mb-4">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <p className="text-3xl font-bold">{stats.totalAdmissions}</p>
            <p className="text-sm text-muted-foreground">Total Admissions</p>
          </CardContent>
        </Card>
        <Card className="border shadow-card bg-gradient-to-br from-amber-500/10 to-orange-500/10">
          <CardContent className="p-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg mb-4">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
            <p className="text-3xl font-bold">{formatCurrency(stats.pendingFees)}</p>
            <p className="text-sm text-muted-foreground">Pending Fees</p>
          </CardContent>
        </Card>
        <Card className="border shadow-card bg-gradient-to-br from-emerald-500/10 to-green-500/10">
          <CardContent className="p-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center shadow-lg mb-4">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
            <p className="text-3xl font-bold">{formatCurrency(stats.totalCollections)}</p>
            <p className="text-sm text-muted-foreground">Total Collections</p>
          </CardContent>
        </Card>
        <Card className="border shadow-card bg-gradient-to-br from-cyan-500/10 to-blue-500/10">
          <CardContent className="p-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shadow-lg mb-4">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <p className="text-3xl font-bold">{stats.newLeads}</p>
            <p className="text-sm text-muted-foreground">New Leads (Week)</p>
          </CardContent>
        </Card>
        <Card className="border shadow-card bg-gradient-to-br from-green-500/10 to-teal-500/10">
          <CardContent className="p-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center shadow-lg mb-4">
              <UserCheck className="w-6 h-6 text-white" />
            </div>
            <p className="text-3xl font-bold">{stats.convertedLeads}</p>
            <p className="text-sm text-muted-foreground">Converted Leads</p>
          </CardContent>
        </Card>
      </div>

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
                      <p className="text-xs text-muted-foreground">{new Date(lead.created_at).toLocaleDateString()}</p>
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
    </div>
  );
}

// Front Office Dashboard
function FrontOfficeDashboard() {
  const { user, profile } = useAuth();
  const { currentBranchId, branchVersion } = useBranch();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalStudents: 0,
    newRegistrations: 0,
    pendingVerifications: 0,
  });

  const organizationId = user?.organizationId || profile?.organization_id;

  useEffect(() => {
    if (organizationId) fetchData();
  }, [organizationId, currentBranchId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const branchFilter = currentBranchId;

      let studentsQuery = supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('role', 'student');
      if (branchFilter) studentsQuery = studentsQuery.eq('branch_id', branchFilter);

      let recentStudentsQuery = supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('role', 'student')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
      if (branchFilter) recentStudentsQuery = recentStudentsQuery.eq('branch_id', branchFilter);

      let pendingQuery = supabase
        .from('student_registrations')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .in('status', ['pending', 'link_sent', 'submitted']);
      if (branchFilter) pendingQuery = pendingQuery.eq('branch_id', branchFilter);

      const [
        { count: studentCount },
        { count: newCount },
        { count: pendingCount },
      ] = await Promise.all([studentsQuery, recentStudentsQuery, pendingQuery]);

      setStats({
        totalStudents: studentCount || 0,
        newRegistrations: newCount || 0,
        pendingVerifications: pendingCount || 0,
      });
    } catch (error) {
      console.error('Error fetching front office data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">Front Office Dashboard</h1>
          <p className="text-muted-foreground mt-1">Student registrations & admissions overview</p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm">
          <Activity className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border shadow-card bg-gradient-to-br from-indigo-500/10 to-purple-500/10">
          <CardContent className="p-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg mb-4">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <p className="text-3xl font-bold">{stats.totalStudents}</p>
            <p className="text-sm text-muted-foreground">Total Students</p>
          </CardContent>
        </Card>
        <Card className="border shadow-card bg-gradient-to-br from-emerald-500/10 to-green-500/10">
          <CardContent className="p-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center shadow-lg mb-4">
              <UserCheck className="w-6 h-6 text-white" />
            </div>
            <p className="text-3xl font-bold">{stats.newRegistrations}</p>
            <p className="text-sm text-muted-foreground">New This Week</p>
          </CardContent>
        </Card>
        <Card className="border shadow-card bg-gradient-to-br from-amber-500/10 to-orange-500/10">
          <CardContent className="p-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg mb-4">
              <Clock className="w-6 h-6 text-white" />
            </div>
            <p className="text-3xl font-bold">{stats.pendingVerifications}</p>
            <p className="text-sm text-muted-foreground">Pending Verifications</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

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
  }, [organizationId, user?.id, currentBranchId]);

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
      setPaymentData([]);
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
  if (user?.role === 'schedule_coordinator') return <ScheduleCoordinatorDashboard />;
  if (user?.role === 'sales_staff') return <SalesStaffDashboard />;
  if (user?.role === 'front_office') return <FrontOfficeDashboard />;
  return <AdminDashboard />;
}
