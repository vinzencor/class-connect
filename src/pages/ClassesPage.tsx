import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import {
  Calendar as CalendarIcon,
  Clock,
  Video,
  Users,
  ChevronLeft,
  ChevronRight,
  X,
  MapPin,
  BookOpen,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { ClassDetailsModal } from '@/components/ClassDetailsModal';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { classService, ClassWithBatches, CreateClassData } from '@/services/classService';
import { batchService } from '@/services/batchService';
import { useBranch } from '@/contexts/BranchContext';
import { Tables } from '@/types/database';

type Batch = Tables<'batches'>;
type Profile = Tables<'profiles'>;

interface ClassSession {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  meet_link: string;
  module_main_name?: string | null;
  module_group_name?: string | null;
  module_sub_group_names?: string[];
  faculty_id?: string | null;
  classes: {
    id: string;
    name: string;
    subject: string;
    room_number?: string;
    faculty_id?: string | null;
  };
  profiles: {
    full_name: string;
    short_name?: string | null;
  };
}

const getSessionDisplayLines = (session: ClassSession): string[] => {
  const room = session.classes?.room_number || session.classes?.name || 'Room';
  const moduleMain = session.module_main_name?.trim() || 'Module';
  const moduleGroup = session.module_group_name?.trim() || '';
  const subGroups = session.module_sub_group_names || [];
  const faculty = session.profiles?.short_name || session.profiles?.full_name || 'Unassigned';
  const className = session.title?.trim() || session.classes?.name || 'Class';
  
  let moduleStr = moduleGroup ? `${moduleMain} : ${moduleGroup}` : moduleMain;
  if (subGroups.length > 0) {
    moduleStr += ` (${subGroups.join(', ')})`;
  }

  return [
    className,
    moduleStr,
    faculty
  ];
};

// Helper to get day name
const getDayName = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long' });
};

// Helper for formatted time
const formatTime = (dateStr: string) => {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const weekDaysShort = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Map colors based on subject (simple hash or mapping)
const getSubjectColor = (subject: string) => {
  const colors = [
    'bg-primary',
    'bg-accent',
    'bg-success',
    'bg-warning',
    'bg-destructive',
    'bg-indigo-500',
    'bg-pink-500'
  ];
  let hash = 0;
  for (let i = 0; i < subject.length; i++) {
    hash = subject.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

const getSubjectColorClass = (subject: string) => {
  const colors = [
    'border-primary/30 bg-primary/10',
    'border-accent/30 bg-accent/10',
    'border-green-500/30 bg-green-500/10',
    'border-amber-500/30 bg-amber-500/10',
    'border-red-500/30 bg-red-500/10',
    'border-indigo-500/30 bg-indigo-500/10',
    'border-pink-500/30 bg-pink-500/10'
  ];
  let hash = 0;
  for (let i = 0; i < subject.length; i++) {
    hash = subject.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

export default function ClassesPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { currentBranchId, branchVersion, branches, isLoading: branchLoading } = useBranch();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const scopedBranchId = isAdmin ? currentBranchId : (profile?.branch_id || user?.branchId || null);
  // When in "All Branches" view, default to main branch for creating new items
  const effectiveBranchId = scopedBranchId || branches[0]?.id || null;
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [view, setView] = useState<'week' | 'list' | 'month'>('week');
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [monthSessions, setMonthSessions] = useState<ClassSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<ClassSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDayDate, setSelectedDayDate] = useState<Date | null>(null);
  const [dayDetailsOpen, setDayDetailsOpen] = useState(false);

  // Class management state
  const [showClassManagement, setShowClassManagement] = useState(false);
  const [classes, setClasses] = useState<ClassWithBatches[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [faculty, setFaculty] = useState<Profile[]>([]);
  const [facultyScheduledHours, setFacultyScheduledHours] = useState<Record<string, number>>({});
  const [classDialogOpen, setClassDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassWithBatches | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingClass, setDeletingClass] = useState<ClassWithBatches | null>(null);
  const [classFormData, setClassFormData] = useState<CreateClassData & { batchIds: string[] }>({
    name: '',
    subject: '',
    description: '',
    faculty_id: '',
    schedule_day: '',
    schedule_time: '',
    duration_minutes: 60,
    room_number: '',
    meet_link: '',
    is_active: true,
    batchIds: [],
  });

  const organizationId = user?.organizationId || profile?.organization_id;

  // Calculate week start (Monday)
  const currentWeekStart = new Date(selectedDate);
  const day = currentWeekStart.getDay();
  const diff = currentWeekStart.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  currentWeekStart.setDate(diff);
  currentWeekStart.setHours(0, 0, 0, 0);

  const currentWeekEnd = new Date(currentWeekStart);
  currentWeekEnd.setDate(currentWeekStart.getDate() + 6);
  currentWeekEnd.setHours(23, 59, 59, 999);

  const weekDates = weekDays.map((_, i) => {
    const date = new Date(currentWeekStart);
    date.setDate(currentWeekStart.getDate() + i);
    return date;
  });

  // Calculate month start and end
  const currentMonthStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  const currentMonthEnd = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
  currentMonthEnd.setHours(23, 59, 59, 999);

  // Generate calendar days for month view
  const getMonthCalendarDays = () => {
    const days: (Date | null)[] = [];
    const firstDay = new Date(currentMonthStart);
    const lastDay = new Date(currentMonthEnd);

    // Get the day of week for the first day (0 = Sunday, so we adjust for Monday start)
    let startDay = firstDay.getDay();
    startDay = startDay === 0 ? 6 : startDay - 1; // Convert to Monday = 0

    // Add empty slots for days before the month starts
    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }

    // Add all days of the month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), d));
    }

    // Add empty slots to complete the last week
    const remainder = days.length % 7;
    if (remainder > 0) {
      for (let i = 0; i < 7 - remainder; i++) {
        days.push(null);
      }
    }

    return days;
  };

  useEffect(() => {
    if (organizationId && !branchLoading) {
      if (view === 'month') {
        fetchMonthSessions();
      } else {
        fetchSessions();
      }
    }
  }, [organizationId, selectedDate, view, branchVersion, scopedBranchId, branchLoading]);

  // Fetch classes, batches, and faculty for class management
  useEffect(() => {
    if (organizationId && !branchLoading) {
      fetchClassManagementData();
    }
  }, [organizationId, branchVersion, scopedBranchId, branchLoading]);

  const getBranchScopedClassIds = async (): Promise<Set<string>> => {
    if (!scopedBranchId) return new Set<string>();

    const { data: branchBatches, error: branchBatchesError } = await supabase
      .from('batches')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('branch_id', scopedBranchId);

    if (branchBatchesError) {
      console.error('Error fetching branch batches:', branchBatchesError);
      return new Set<string>();
    }

    const batchIds = (branchBatches || []).map((b: any) => b.id).filter(Boolean);
    if (!batchIds.length) return new Set<string>();

    const { data, error } = await supabase
      .from('class_batches')
      .select('class_id')
      .in('batch_id', batchIds);

    if (error) {
      console.error('Error fetching branch-scoped class IDs:', error);
      return new Set<string>();
    }

    return new Set((data || []).map((item: any) => item.class_id).filter(Boolean));
  };

  const buildTemplateScheduleFromClasses = async (rangeStart: Date, rangeEnd: Date): Promise<ClassSession[]> => {
    const allClasses = await classService.getClasses(organizationId, null);
    const branchScopedClassIds = await getBranchScopedClassIds();

    const filteredClasses = scopedBranchId
      ? allClasses.filter((cls) => {
        const hasMatchingClassBranch = cls.branch_id === scopedBranchId;
        const hasMatchingBatchBranch = (cls.batches || []).some((batch: any) => batch?.branch_id === scopedBranchId);
        const hasMatchingBatchClassLink = branchScopedClassIds.has(cls.id);
        return hasMatchingClassBranch || hasMatchingBatchBranch || hasMatchingBatchClassLink;
      })
      : allClasses;

    const dayIndexByName: Record<string, number> = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
    };

    const templates: ClassSession[] = [];
    const start = new Date(rangeStart);
    const end = new Date(rangeEnd);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    filteredClasses.forEach((cls: any) => {
      const scheduleDay = (cls.schedule_day || '').toString().trim().toLowerCase();
      const scheduleTime = (cls.schedule_time || '').toString().trim();
      if (!scheduleDay || !scheduleTime) return;

      const targetDayIndex = dayIndexByName[scheduleDay];
      if (targetDayIndex === undefined) return;

      const [hourStr, minuteStr] = scheduleTime.split(':');
      const hour = Number(hourStr || 0);
      const minute = Number(minuteStr || 0);
      const duration = Number(cls.duration_minutes || 60);

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        if (d.getDay() !== targetDayIndex) continue;

        const startAt = new Date(d);
        startAt.setHours(hour, minute, 0, 0);
        const endAt = new Date(startAt);
        endAt.setMinutes(endAt.getMinutes() + duration);

        templates.push({
          id: `template-${cls.id}-${startAt.toISOString().slice(0, 10)}`,
          title: cls.subject || cls.name,
          start_time: startAt.toISOString(),
          end_time: endAt.toISOString(),
          meet_link: cls.meet_link || '',
          faculty_id: cls.faculty_id || null,
          classes: {
            id: cls.id,
            name: cls.name,
            subject: cls.subject || 'General',
            room_number: cls.room_number || cls.name,
            faculty_id: cls.faculty_id || null,
          },
          profiles: {
            full_name: cls.faculty?.full_name || 'Unknown Faculty',
            short_name: cls.faculty?.short_name || null,
          },
        });
      }
    });

    return templates.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  };

  const fetchClassManagementData = async () => {
    try {
      const [allClassesData, batchesData, facultyData, sessionsData, orgData] = await Promise.all([
        classService.getClasses(organizationId, null),
        batchService.getBatches(organizationId, scopedBranchId),
        (() => {
          let q = supabase
            .from('profiles')
            .select('*')
            .eq('organization_id', organizationId)
            .eq('role', 'faculty')
            .eq('is_active', true);
          if (scopedBranchId) q = q.eq('branch_id', scopedBranchId);
          return q;
        })(),
        supabase
          .from('sessions')
          .select('class_id, faculty_id, branch_id, classes(id, branch_id)')
          .eq('organization_id', organizationId)
          .not('faculty_id', 'is', null),
        supabase
          .from('organizations')
          .select('hours_per_session')
          .eq('id', organizationId)
          .single(),
      ]);

      const branchClassIds = new Set<string>();
      (sessionsData.data || []).forEach((session: any) => {
        const classObj = Array.isArray(session.classes) ? session.classes[0] : session.classes;
        const classBranchId = classObj?.branch_id;
        const sessionBranchId = session.branch_id;
        if (!scopedBranchId || classBranchId === scopedBranchId || sessionBranchId === scopedBranchId) {
          if (session.class_id) branchClassIds.add(session.class_id);
        }
      });

      const classesData = scopedBranchId
        ? allClassesData.filter((cls) => {
          const hasMatchingClassBranch = cls.branch_id === scopedBranchId;
          const hasMatchingBatchBranch = (cls.batches || []).some((batch: any) => batch?.branch_id === scopedBranchId);
          const hasMatchingSessionBranch = branchClassIds.has(cls.id);
          return hasMatchingClassBranch || hasMatchingBatchBranch || hasMatchingSessionBranch;
        })
        : allClassesData;

      const isStrictFaculty = user?.role === 'faculty' && (!user?.roleName || user?.roleName.toLowerCase() === 'faculty');

      const finalClassesData =
        !isStrictFaculty && scopedBranchId && classesData.length === 0
          ? allClassesData
          : classesData;

      setClasses(finalClassesData);
      setBatches(batchesData);
      setFaculty(facultyData.data || []);

      const hoursPerSession = Number((orgData.data as any)?.hours_per_session || 3);
      const sessionCounts: Record<string, number> = {};
      (sessionsData.data || []).forEach((session: any) => {
        const classObj = Array.isArray(session.classes) ? session.classes[0] : session.classes;
        if (scopedBranchId) {
          const classBranchId = classObj?.branch_id;
          const sessionBranchId = session.branch_id;
          if (classBranchId !== scopedBranchId && sessionBranchId !== scopedBranchId) return;
        }
        const facultyId = session.faculty_id;
        if (!facultyId) return;
        sessionCounts[facultyId] = (sessionCounts[facultyId] || 0) + 1;
      });

      const computedHours: Record<string, number> = {};
      Object.entries(sessionCounts).forEach(([facultyId, totalSessions]) => {
        computedHours[facultyId] = Number((totalSessions * hoursPerSession).toFixed(2));
      });
      setFacultyScheduledHours(computedHours);
    } catch (error) {
      console.error('Error fetching class management data:', error);
      toast.error('Failed to load class management data');
    }
  };

  const enrichSessionsWithModuleMainName = async (sessionList: ClassSession[]): Promise<ClassSession[]> => {
    if (!sessionList.length) return sessionList;

    try {
      const sessionIds = sessionList.map((session) => session.id);
      
      const [groupsResult, subGroupsResult] = await Promise.all([
        supabase
          .from('session_module_groups')
          .select(`
            session_id,
            module_groups (
              name,
              module_subjects (
                name
              )
            )
          `)
          .in('session_id', sessionIds),
        supabase
          .from('session_module_sub_groups')
          .select(`
            session_id,
            module_sub_groups (
              name
            )
          `)
          .in('session_id', sessionIds)
      ]);

      if (groupsResult.error) throw groupsResult.error;
      if (subGroupsResult.error) throw subGroupsResult.error;

      const moduleNameBySessionId = new Map<string, { mainName: string; groupName: string }>();
      (groupsResult.data || []).forEach((item: any) => {
        const sessionId = item.session_id as string;
        const moduleMainName = item.module_groups?.module_subjects?.name as string | undefined;
        const moduleGroupName = item.module_groups?.name as string | undefined;
        if (sessionId && !moduleNameBySessionId.has(sessionId)) {
          moduleNameBySessionId.set(sessionId, {
            mainName: moduleMainName || '',
            groupName: moduleGroupName || '',
          });
        }
      });

      const subGroupsBySessionId = new Map<string, string[]>();
      (subGroupsResult.data || []).forEach((item: any) => {
        const sessionId = item.session_id as string;
        const subGroupName = item.module_sub_groups?.name as string | undefined;
        if (sessionId && subGroupName) {
          if (!subGroupsBySessionId.has(sessionId)) {
            subGroupsBySessionId.set(sessionId, []);
          }
          subGroupsBySessionId.get(sessionId)?.push(subGroupName);
        }
      });

      return sessionList.map((session) => {
        const moduleInfo = moduleNameBySessionId.get(session.id);
        const subGroupNames = subGroupsBySessionId.get(session.id) || [];
        return {
          ...session,
          module_main_name: moduleInfo?.mainName || null,
          module_group_name: moduleInfo?.groupName || null,
          module_sub_group_names: subGroupNames,
        };
      });
    } catch (error) {
      console.error('Error fetching session module info:', error);
      return sessionList;
    }
  };

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const branchScopedClassIds = await getBranchScopedClassIds();

      let sessionsQuery = supabase
        .from('sessions')
        .select(`
          id,
          title,
          start_time,
          end_time,
          meet_link,
          branch_id,
          faculty_id,
          class_id,
          classes (
            id,
            name,
            subject,
            room_number,
            faculty_id,
            branch_id
          ),
          profiles:faculty_id (
            full_name,
            short_name
          )
        `)
        .eq('organization_id', organizationId)
        .gte('start_time', currentWeekStart.toISOString())
        .lte('start_time', currentWeekEnd.toISOString());
      const { data, error } = await sessionsQuery;

      if (error) throw error;

      const formattedData = (data || []).map((item: any) => ({
        ...item,
        classes: item.classes || { id: '', name: 'Unknown Class', subject: 'General' },
        profiles: item.profiles || { full_name: 'Unknown Faculty' }
      }));

      const branchFilteredData = scopedBranchId
        ? formattedData.filter((item) => {
          const classBranchId = item.classes?.branch_id;
          const sessionBranchId = item.branch_id;
          const hasScopedBatchClass = item.class_id ? branchScopedClassIds.has(item.class_id) : false;
          return classBranchId === scopedBranchId || sessionBranchId === scopedBranchId || hasScopedBatchClass;
        })
        : formattedData;

      const isStrictFaculty = user?.role === 'faculty' && (!user?.roleName || user?.roleName.toLowerCase() === 'faculty');

      const scopedOrFallbackData =
        !isStrictFaculty && scopedBranchId && branchFilteredData.length === 0
          ? formattedData
          : branchFilteredData;

      const filteredData = isStrictFaculty
        ? scopedOrFallbackData.filter((item) => item.faculty_id === user?.id || item.classes?.faculty_id === user?.id)
        : scopedOrFallbackData;

      if (!isStrictFaculty && filteredData.length === 0) {
        const templateSessions = await buildTemplateScheduleFromClasses(currentWeekStart, currentWeekEnd);
        setSessions(templateSessions);
        return;
      }

      const sessionsWithModuleMainName = await enrichSessionsWithModuleMainName(filteredData);
      setSessions(sessionsWithModuleMainName);
    } catch (error) {
      console.error('Error fetching sessions:', error);
      toast.error('Failed to load class schedule');
    } finally {
      setLoading(false);
    }
  };

  const fetchMonthSessions = async () => {
    setLoading(true);
    try {
      const branchScopedClassIds = await getBranchScopedClassIds();

      let monthQuery = supabase
        .from('sessions')
        .select(`
          id,
          title,
          start_time,
          end_time,
          meet_link,
          branch_id,
          faculty_id,
          class_id,
          classes (
            id,
            name,
            subject,
            room_number,
            faculty_id,
            branch_id
          ),
          profiles:faculty_id (
            full_name,
            short_name
          )
        `)
        .eq('organization_id', organizationId)
        .gte('start_time', currentMonthStart.toISOString())
        .lte('start_time', currentMonthEnd.toISOString())
        .order('start_time', { ascending: true });
      const { data, error } = await monthQuery;

      if (error) throw error;

      const formattedData = (data || []).map((item: any) => ({
        ...item,
        classes: item.classes || { id: '', name: 'Unknown Class', subject: 'General' },
        profiles: item.profiles || { full_name: 'Unknown Faculty' }
      }));

      const branchFilteredData = scopedBranchId
        ? formattedData.filter((item) => {
          const classBranchId = item.classes?.branch_id;
          const sessionBranchId = item.branch_id;
          const hasScopedBatchClass = item.class_id ? branchScopedClassIds.has(item.class_id) : false;
          return classBranchId === scopedBranchId || sessionBranchId === scopedBranchId || hasScopedBatchClass;
        })
        : formattedData;

      const isStrictFaculty = user?.role === 'faculty' && (!user?.roleName || user?.roleName.toLowerCase() === 'faculty');

      const scopedOrFallbackData =
        !isStrictFaculty && scopedBranchId && branchFilteredData.length === 0
          ? formattedData
          : branchFilteredData;

      const filteredData = isStrictFaculty
        ? scopedOrFallbackData.filter((item) => item.faculty_id === user?.id || item.classes?.faculty_id === user?.id)
        : scopedOrFallbackData;

      if (!isStrictFaculty && filteredData.length === 0) {
        const templateSessions = await buildTemplateScheduleFromClasses(currentMonthStart, currentMonthEnd);
        setMonthSessions(templateSessions);
        return;
      }

      const sessionsWithModuleMainName = await enrichSessionsWithModuleMainName(filteredData);
      setMonthSessions(sessionsWithModuleMainName);
    } catch (error) {
      console.error('Error fetching month sessions:', error);
      toast.error('Failed to load monthly schedule');
    } finally {
      setLoading(false);
    }
  };

  // Class management handlers
  const handleOpenClassDialog = (cls?: ClassWithBatches) => {
    if (cls) {
      setEditingClass(cls);
      setClassFormData({
        name: cls.name,
        subject: cls.subject,
        description: cls.description || '',
        faculty_id: cls.faculty_id || '',
        schedule_day: cls.schedule_day || '',
        schedule_time: cls.schedule_time || '',
        duration_minutes: cls.duration_minutes,
        room_number: cls.room_number || '',
        meet_link: cls.meet_link || '',
        is_active: cls.is_active,
        batchIds: cls.batches?.map(b => b.id) || [],
      });
    } else {
      setEditingClass(null);
      setClassFormData({
        name: '',
        subject: '',
        description: '',
        faculty_id: '',
        schedule_day: '',
        schedule_time: '',
        duration_minutes: 60,
        room_number: '',
        meet_link: '',
        is_active: true,
        batchIds: [],
      });
    }
    setClassDialogOpen(true);
  };

  const handleSaveClass = async () => {
    try {
      if (!classFormData.name) {
        toast.error('Name is required');
        return;
      }

      const { batchIds, ...classData } = classFormData;

      if (editingClass) {
        await classService.updateClass(editingClass.id, classData, batchIds);
        toast.success('Class updated successfully');
      } else {
        await classService.createClass(organizationId, classData, batchIds, effectiveBranchId);
        toast.success('Class created successfully');
      }

      setClassDialogOpen(false);
      await fetchClassManagementData();
    } catch (error) {
      console.error('Error saving class:', error);
      toast.error('Failed to save class');
    }
  };

  const handleDeleteClass = async () => {
    if (!deletingClass) return;

    try {
      await classService.deleteClass(deletingClass.id);
      toast.success('Class deleted successfully');
      setDeleteConfirmOpen(false);
      setDeletingClass(null);
      await fetchClassManagementData();
    } catch (error) {
      console.error('Error deleting class:', error);
      toast.error('Failed to delete class');
    }
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() + (direction === 'next' ? 7 : -7));
    setSelectedDate(newDate);
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(selectedDate.getMonth() + (direction === 'next' ? 1 : -1));
    setSelectedDate(newDate);
  };

  const getClassesForDay = (dayName: string) => {
    return sessions.filter(s => getDayName(s.start_time) === dayName);
  };

  const getClassesForDate = (date: Date) => {
    return monthSessions.filter(s => {
      const sessionDate = new Date(s.start_time);
      return sessionDate.getFullYear() === date.getFullYear() &&
        sessionDate.getMonth() === date.getMonth() &&
        sessionDate.getDate() === date.getDate();
    });
  };

  const handleDayClick = (date: Date) => {
    setSelectedDayDate(date);
    setDayDetailsOpen(true);
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate();
  };

  const getDayClasses = () => {
    if (!selectedDayDate) return [];
    return getClassesForDate(selectedDayDate);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
            Class Schedule
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage and view all scheduled classes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border overflow-hidden">
            <Button
              variant={view === 'week' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setView('week')}
              className={view === 'week' ? 'bg-primary text-primary-foreground' : ''}
            >
              Week
            </Button>
            <Button
              variant={view === 'month' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setView('month')}
              className={view === 'month' ? 'bg-primary text-primary-foreground' : ''}
            >
              Month
            </Button>
            <Button
              variant={view === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setView('list')}
              className={view === 'list' ? 'bg-primary text-primary-foreground' : ''}
            >
              List
            </Button>
          </div>
          {user?.role !== 'student' && (
            <Button
              className="bg-primary text-primary-foreground"
              onClick={() => navigate('/dashboard/create-session')}
            >
              <CalendarIcon className="w-4 h-4 mr-2" />
              Schedule Class
            </Button>
          )}
        </div>
      </div>

      {/* Class Management Section */}
      {user?.role !== 'student' && (
        <Card className="border shadow-card">
          <CardHeader className="cursor-pointer" onClick={() => setShowClassManagement(!showClassManagement)}>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  Manage Class Room
                  {showClassManagement ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </CardTitle>
                <CardDescription>Create, edit, and delete class room with batch assignments</CardDescription>
              </div>
              {showClassManagement && (
                <Button onClick={(e) => { e.stopPropagation(); handleOpenClassDialog(); }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Class
                </Button>
              )}
            </div>
          </CardHeader>
          {showClassManagement && (
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        No classes found. Create your first class to get started.
                      </TableCell>
                    </TableRow>
                  ) : (
                    classes.map((cls) => (
                      <TableRow key={cls.id}>
                        <TableCell className="font-medium">{cls.name}</TableCell>
                        <TableCell>
                          <Badge variant={cls.is_active ? 'default' : 'secondary'}>
                            {cls.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenClassDialog(cls)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setDeletingClass(cls);
                                setDeleteConfirmOpen(true);
                              }}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          )}
        </Card>
      )}

      {/* Navigation */}
      <Card className="border shadow-card">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => view === 'month' ? navigateMonth('prev') : navigateWeek('prev')}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-primary" />
              {view === 'month' ? (
                <span className="font-semibold text-foreground">
                  {selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </span>
              ) : (
                <span className="font-semibold text-foreground">
                  {weekDates[0].toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} -{' '}
                  {weekDates[6].toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </span>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={() => view === 'month' ? navigateMonth('next') : navigateWeek('next')}>
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {view === 'month' ? (
        /* Month View */
        loading ? (
          <Card className="border shadow-card">
            <CardContent className="p-8 text-center text-muted-foreground">Loading schedule...</CardContent>
          </Card>
        ) : (
          <Card className="border shadow-card">
            <CardContent className="p-4">
              {/* Days header */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {weekDaysShort.map((day) => (
                  <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                    {day}
                  </div>
                ))}
              </div>
              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1">
                {getMonthCalendarDays().map((date, index) => {
                  if (!date) {
                    return <div key={`empty-${index}`} className="min-h-[100px] bg-muted/20 rounded-lg" />;
                  }

                  const dayClasses = getClassesForDate(date);
                  const today = isToday(date);

                  return (
                    <div
                      key={date.toISOString()}
                      className={`min-h-[100px] p-2 rounded-lg border cursor-pointer transition-all hover:shadow-md hover:border-primary/50 ${today ? 'bg-primary/5 border-primary/30' : 'bg-card hover:bg-muted/30'
                        }`}
                      onClick={() => handleDayClick(date)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-sm font-semibold ${today ? 'text-primary' : 'text-foreground'}`}>
                          {date.getDate()}
                        </span>
                        {dayClasses.length > 0 && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {dayClasses.length}
                          </Badge>
                        )}
                      </div>
                      <div className="space-y-1">
                        {dayClasses.slice(0, 3).map((cls) => {
                          const displayLines = getSessionDisplayLines(cls).slice(0, 3);
                          return (
                            <div
                              key={cls.id}
                              className={`text-[10px] px-1.5 py-1 rounded border leading-tight ${getSubjectColorClass(cls.classes.subject)}`}
                              title={displayLines.join(' • ')}
                            >
                              {displayLines.map((line, idx) => (
                                <p key={`${cls.id}-month-line-${idx}`} className="truncate">
                                  {line}
                                </p>
                              ))}
                            </div>
                          );
                        })}
                        {dayClasses.length > 3 && (
                          <div className="text-[10px] text-muted-foreground text-center">
                            +{dayClasses.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )
      ) : view === 'week' ? (
        /* Week View */
        loading ? (
          <Card className="border shadow-card">
            <CardContent className="p-8 text-center text-muted-foreground">Loading schedule...</CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-7 gap-4">
            {weekDays.map((day, dayIndex) => (
              <Card key={day} className="border shadow-card min-h-[200px]">
                <CardHeader className="pb-2 p-3">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">{day.slice(0, 3)}</p>
                    <p className={`text-lg font-bold ${weekDates[dayIndex].toDateString() === new Date().toDateString()
                      ? 'text-primary'
                      : 'text-foreground'
                      }`}>
                      {weekDates[dayIndex].getDate()}
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 p-2">
                  {getClassesForDay(day).length > 0 ? (
                    getClassesForDay(day).map((cls) => {
                      const color = getSubjectColor(cls.classes.subject);
                      const displayLines = getSessionDisplayLines(cls).slice(0, 3);
                      return (
                        <div
                          key={cls.id}
                          className={`p-2 rounded-md ${color}/10 border border-${color}/20 cursor-pointer hover:shadow-sm transition-shadow`}
                          onClick={() => setSelectedSession(cls)}
                        >
                          {displayLines.map((line, idx) => (
                            <p
                              key={`${cls.id}-week-line-${idx}`}
                              className={idx === 0 ? 'font-semibold text-xs text-foreground truncate' : 'text-[10px] text-muted-foreground truncate'}
                              title={line}
                            >
                              {line}
                            </p>
                          ))}
                          <p className="text-[10px] text-muted-foreground mt-1">
                            <Clock className="w-3 h-3 inline mr-1" />
                            {formatTime(cls.start_time)}
                          </p>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-2 text-muted-foreground text-xs">
                      -
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )
      ) : (
        /* List View */
        <Card className="border shadow-card">
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">Loading sessions...</div>
            ) : sessions.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No classes scheduled for this week.</div>
            ) : (
              <div className="divide-y">
                {sessions.map((cls, index) => {
                  const color = getSubjectColor(cls.classes.subject);
                  const displayLines = getSessionDisplayLines(cls).slice(0, 3);
                  return (
                    <div
                      key={cls.id}
                      className="p-4 hover:bg-muted/50 transition-colors animate-fade-in"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-1 h-16 rounded-full ${color}`} />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-foreground">{displayLines[0]}</h3>
                            <Badge variant="outline">{displayLines[1] || cls.classes.name}</Badge>
                          </div>
                          {displayLines[2] && <p className="text-xs text-muted-foreground mt-1">{displayLines[2]}</p>}
                          <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Users className="w-4 h-4" />
                              {cls.profiles.short_name || cls.profiles.full_name}
                            </span>
                            <span className="flex items-center gap-1">
                              <CalendarIcon className="w-4 h-4" />
                              {new Date(cls.start_time).toDateString()}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {formatTime(cls.start_time)} - {formatTime(cls.end_time)}
                            </span>
                          </div>
                        </div>
                        {cls.meet_link && (
                          <Button variant="outline" size="sm" onClick={() => window.open(cls.meet_link, '_blank')}>
                            <Video className="w-4 h-4 mr-2" />
                            Join
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Day Details Modal */}
      <Dialog open={dayDetailsOpen} onOpenChange={setDayDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-primary" />
              {selectedDayDate?.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric'
              })}
            </DialogTitle>
            <DialogDescription>
              {getDayClasses().length} class{getDayClasses().length !== 1 ? 'es' : ''} scheduled
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 pr-4">
              {getDayClasses().length === 0 ? (
                <div className="text-center py-10 text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
                  <CalendarIcon className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p>No classes scheduled for this day</p>
                </div>
              ) : (
                getDayClasses().map((cls) => (
                  <Card key={cls.id} className="border shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      {(() => {
                        const displayLines = getSessionDisplayLines(cls).slice(0, 3);

                        return (
                          <>
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="font-semibold text-foreground text-lg">{cls.classes.name}</h3>
                        <Badge variant="outline" className={getSubjectColorClass(cls.classes.subject)}>
                          {cls.classes.subject}
                        </Badge>
                      </div>

                      <div className="space-y-3 mb-4">
                        <div className="p-3 rounded-lg bg-muted/50">
                          <p className="text-xs text-muted-foreground">Class Room Name</p>
                          <p className="font-medium mt-1 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {cls.classes.room_number || cls.classes.name}
                          </p>
                        </div>

                        <div className="p-3 rounded-lg bg-muted/50">
                          <p className="text-xs text-muted-foreground">Topic Name</p>
                          <div className="mt-1 space-y-0.5">
                            {displayLines.map((line, idx) => (
                              <p key={`${cls.id}-topic-line-${idx}`} className={idx === 0 ? 'font-semibold' : 'font-medium'}>
                                {line}
                              </p>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 rounded-lg bg-muted/50">
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Users className="w-3 h-3" /> Faculty
                            </p>
                            <p className="font-medium mt-1">{cls.profiles.short_name || cls.profiles.full_name}</p>
                          </div>
                          <div className="p-3 rounded-lg bg-muted/50">
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" /> Time
                            </p>
                            <p className="font-medium mt-1">
                              {formatTime(cls.start_time)} - {formatTime(cls.end_time)}
                            </p>
                          </div>
                        </div>

                        <div className="p-3 rounded-lg bg-muted/50">
                          <p className="text-xs text-muted-foreground">Google Meet Link</p>
                          <p className="font-medium mt-1 text-sm break-all text-foreground/90">
                            {cls.meet_link || 'Not added'}
                          </p>
                        </div>
                      </div>
                          </>
                        );
                      })()}

                      <div className="flex gap-2">
                        {cls.meet_link && (
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={() => window.open(cls.meet_link, '_blank')}
                          >
                            <Video className="w-4 h-4 mr-2" />
                            Join Meeting
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setDayDetailsOpen(false);
                            setSelectedSession(cls);
                          }}
                        >
                          <BookOpen className="w-4 h-4 mr-2" />
                          View Details
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <ClassDetailsModal
        session={selectedSession}
        isOpen={!!selectedSession}
        onClose={() => setSelectedSession(null)}
        onSessionUpdated={(updatedSession) => {
          setSessions((prev) => prev.map((s) => (s.id === updatedSession.id ? updatedSession : s)));
          setMonthSessions((prev) => prev.map((s) => (s.id === updatedSession.id ? updatedSession : s)));
          setSelectedSession(updatedSession);
        }}
        onSessionDeleted={(sessionId) => {
          setSessions((prev) => prev.filter((s) => s.id !== sessionId));
          setMonthSessions((prev) => prev.filter((s) => s.id !== sessionId));
          setSelectedSession(null);
        }}
      />

      {/* Class Create/Edit Dialog */}
      <Dialog open={classDialogOpen} onOpenChange={setClassDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingClass ? 'Edit Class' : 'Create New Class'}</DialogTitle>
            <DialogDescription>
              {editingClass ? 'Update class details and batch assignments' : 'Fill in the details to create a new class'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Class Room Name *</Label>
              <Input
                id="name"
                value={classFormData.name}
                onChange={(e) => setClassFormData({ ...classFormData, name: e.target.value })}
                placeholder="e.g., LH1 Savithri"
              />
            </div>

          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setClassDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveClass}>
              {editingClass ? 'Update Class' : 'Create Class'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Class</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deletingClass?.name}"? This will also delete all associated sessions and enrollments. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteClass}>
              Delete Class
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div >
  );
}
