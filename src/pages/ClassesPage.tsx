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
import { Tables } from '@/types/database';

type Batch = Tables<'batches'>;
type Profile = Tables<'profiles'>;

interface ClassSession {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  meet_link: string;
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
  };
}

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
    if (organizationId) {
      if (view === 'month') {
        fetchMonthSessions();
      } else {
        fetchSessions();
      }
    }
  }, [organizationId, selectedDate, view]);

  // Fetch classes, batches, and faculty for class management
  useEffect(() => {
    if (organizationId) {
      fetchClassManagementData();
    }
  }, [organizationId]);

  const fetchClassManagementData = async () => {
    try {
      const [classesData, batchesData, facultyData] = await Promise.all([
        classService.getClasses(organizationId),
        batchService.getBatches(organizationId),
        supabase
          .from('profiles')
          .select('*')
          .eq('organization_id', organizationId)
          .eq('role', 'faculty')
          .eq('is_active', true)
      ]);

      setClasses(classesData);
      setBatches(batchesData);
      setFaculty(facultyData.data || []);
    } catch (error) {
      console.error('Error fetching class management data:', error);
      toast.error('Failed to load class management data');
    }
  };

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
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
          ),
          profiles:faculty_id (
            full_name
          )
        `)
        .eq('organization_id', organizationId)
        .gte('start_time', currentWeekStart.toISOString())
        .lte('start_time', currentWeekEnd.toISOString());

      if (error) throw error;

      const formattedData = (data || []).map((item: any) => ({
        ...item,
        classes: item.classes || { id: '', name: 'Unknown Class', subject: 'General' },
        profiles: item.profiles || { full_name: 'Unknown Faculty' }
      }));

      const filteredData = user?.role === 'faculty'
        ? formattedData.filter((item) => item.faculty_id === user?.id || item.classes?.faculty_id === user?.id)
        : formattedData;

      setSessions(filteredData);
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
      const { data, error } = await supabase
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
          ),
          profiles:faculty_id (
            full_name
          )
        `)
        .eq('organization_id', organizationId)
        .gte('start_time', currentMonthStart.toISOString())
        .lte('start_time', currentMonthEnd.toISOString())
        .order('start_time', { ascending: true });

      if (error) throw error;

      const formattedData = (data || []).map((item: any) => ({
        ...item,
        classes: item.classes || { id: '', name: 'Unknown Class', subject: 'General' },
        profiles: item.profiles || { full_name: 'Unknown Faculty' }
      }));

      const filteredData = user?.role === 'faculty'
        ? formattedData.filter((item) => item.faculty_id === user?.id || item.classes?.faculty_id === user?.id)
        : formattedData;

      setMonthSessions(filteredData);
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
      if (!classFormData.name || !classFormData.subject) {
        toast.error('Name and subject are required');
        return;
      }

      const { batchIds, ...classData } = classFormData;

      if (editingClass) {
        await classService.updateClass(editingClass.id, classData, batchIds);
        toast.success('Class updated successfully');
      } else {
        await classService.createClass(organizationId, classData, batchIds);
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
                  Manage Classes
                  {showClassManagement ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </CardTitle>
                <CardDescription>Create, edit, and delete classes with batch assignments</CardDescription>
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
                    <TableHead>Subject</TableHead>
                    <TableHead>Faculty</TableHead>
                    <TableHead>Batches</TableHead>
                    <TableHead>Schedule</TableHead>
                    <TableHead>Room</TableHead>
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
                        <TableCell>{cls.subject}</TableCell>
                        <TableCell>
                          {cls.faculty?.full_name || 'Unassigned'}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {cls.batches && cls.batches.length > 0 ? (
                              cls.batches.map((batch) => (
                                <Badge key={batch.id} variant="secondary" className="text-xs">
                                  {batch.name}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-muted-foreground text-xs">No batches</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {cls.schedule_day && cls.schedule_time
                            ? `${cls.schedule_day} ${cls.schedule_time}`
                            : '-'}
                        </TableCell>
                        <TableCell>{cls.room_number || '-'}</TableCell>
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
                        {dayClasses.slice(0, 3).map((cls) => (
                          <div
                            key={cls.id}
                            className={`text-[10px] px-1.5 py-0.5 rounded truncate border ${getSubjectColorClass(cls.classes.subject)}`}
                            title={cls.classes.name}
                          >
                            {cls.classes.subject}
                          </div>
                        ))}
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
                      return (
                        <div
                          key={cls.id}
                          className={`p-2 rounded-md ${color}/10 border border-${color}/20 cursor-pointer hover:shadow-sm transition-shadow`}
                          onClick={() => setSelectedSession(cls)}
                        >
                          <p className="font-semibold text-xs text-foreground truncate" title={cls.title}>
                            {cls.classes.subject}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {cls.classes.name}
                          </p>
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
                            <h3 className="font-semibold text-foreground">{cls.title}</h3>
                            <Badge variant="outline">{cls.classes.name}</Badge>
                          </div>
                          <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Users className="w-4 h-4" />
                              {cls.profiles.full_name}
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
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-foreground text-lg">{cls.classes.name}</h3>
                          <p className="text-sm text-muted-foreground">{cls.title}</p>
                        </div>
                        <Badge variant="outline" className={getSubjectColorClass(cls.classes.subject)}>
                          {cls.classes.subject}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="p-3 rounded-lg bg-muted/50">
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Time
                          </p>
                          <p className="font-medium mt-1">
                            {formatTime(cls.start_time)} - {formatTime(cls.end_time)}
                          </p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/50">
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Users className="w-3 h-3" /> Faculty
                          </p>
                          <p className="font-medium mt-1">{cls.profiles.full_name}</p>
                        </div>
                      </div>

                      {cls.classes.room_number && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                          <MapPin className="w-4 h-4" />
                          <span>Room {cls.classes.room_number}</span>
                        </div>
                      )}

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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Class Name *</Label>
                <Input
                  id="name"
                  value={classFormData.name}
                  onChange={(e) => setClassFormData({ ...classFormData, name: e.target.value })}
                  placeholder="e.g., Mathematics 101"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subject">Subject *</Label>
                <Input
                  id="subject"
                  value={classFormData.subject}
                  onChange={(e) => setClassFormData({ ...classFormData, subject: e.target.value })}
                  placeholder="e.g., Mathematics"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={classFormData.description}
                onChange={(e) => setClassFormData({ ...classFormData, description: e.target.value })}
                placeholder="Brief description of the class"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="faculty">Faculty</Label>
                <Select
                  value={classFormData.faculty_id}
                  onValueChange={(value) => setClassFormData({ ...classFormData, faculty_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select faculty" />
                  </SelectTrigger>
                  <SelectContent>
                    {faculty.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="batches">Batches</Label>
                <Select
                  value={classFormData.batchIds[0] || ''}
                  onValueChange={(value) => {
                    const currentBatches = classFormData.batchIds;
                    if (currentBatches.includes(value)) {
                      setClassFormData({
                        ...classFormData,
                        batchIds: currentBatches.filter((id) => id !== value),
                      });
                    } else {
                      setClassFormData({
                        ...classFormData,
                        batchIds: [...currentBatches, value],
                      });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select batches" />
                  </SelectTrigger>
                  <SelectContent>
                    {batches.map((batch) => (
                      <SelectItem key={batch.id} value={batch.id}>
                        {batch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex flex-wrap gap-1 mt-2">
                  {classFormData.batchIds.map((batchId) => {
                    const batch = batches.find((b) => b.id === batchId);
                    return batch ? (
                      <Badge key={batchId} variant="secondary" className="text-xs">
                        {batch.name}
                        <X
                          className="w-3 h-3 ml-1 cursor-pointer"
                          onClick={() =>
                            setClassFormData({
                              ...classFormData,
                              batchIds: classFormData.batchIds.filter((id) => id !== batchId),
                            })
                          }
                        />
                      </Badge>
                    ) : null;
                  })}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="schedule_day">Schedule Day</Label>
                <Select
                  value={classFormData.schedule_day}
                  onValueChange={(value) => setClassFormData({ ...classFormData, schedule_day: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select day" />
                  </SelectTrigger>
                  <SelectContent>
                    {weekDays.map((day) => (
                      <SelectItem key={day} value={day}>
                        {day}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="schedule_time">Schedule Time</Label>
                <Input
                  id="schedule_time"
                  type="time"
                  value={classFormData.schedule_time}
                  onChange={(e) => setClassFormData({ ...classFormData, schedule_time: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="duration">Duration (minutes)</Label>
                <Input
                  id="duration"
                  type="number"
                  value={classFormData.duration_minutes}
                  onChange={(e) =>
                    setClassFormData({ ...classFormData, duration_minutes: parseInt(e.target.value) || 60 })
                  }
                  min={15}
                  step={15}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="room">Room Number</Label>
                <Input
                  id="room"
                  value={classFormData.room_number}
                  onChange={(e) => setClassFormData({ ...classFormData, room_number: e.target.value })}
                  placeholder="e.g., Room 101"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="meet_link">Meet Link</Label>
                <Input
                  id="meet_link"
                  value={classFormData.meet_link}
                  onChange={(e) => setClassFormData({ ...classFormData, meet_link: e.target.value })}
                  placeholder="https://meet.google.com/..."
                />
              </div>
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
