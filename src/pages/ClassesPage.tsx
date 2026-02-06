import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
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
} from 'lucide-react';
import { ClassDetailsModal } from '@/components/ClassDetailsModal';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

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

export default function ClassesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [view, setView] = useState<'week' | 'list'>('week');
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<ClassSession | null>(null);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    if (user?.organizationId) {
      fetchSessions();
    }
  }, [user?.organizationId, selectedDate]);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      // Fetch sessions within the current week range or broadly
      // For simplicity, we can fetch all future/recent sessions or filter by the current view's week
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
        .eq('organization_id', user?.organizationId)
        .gte('start_time', currentWeekStart.toISOString())
        .lte('start_time', currentWeekEnd.toISOString());

      if (error) throw error;

      // Transform data to match expectations (handling potential nulls)
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

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() + (direction === 'next' ? 7 : -7));
    setSelectedDate(newDate);
  };

  const getClassesForDay = (dayName: string) => {
    return sessions.filter(s => getDayName(s.start_time) === dayName);
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

      {/* Week Navigation */}
      <Card className="border shadow-card">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => navigateWeek('prev')}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-primary" />
              <span className="font-semibold text-foreground">
                {weekDates[0].toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} -{' '}
                {weekDates[6].toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
            <Button variant="ghost" size="icon" onClick={() => navigateWeek('next')}>
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {view === 'week' ? (
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
      <ClassDetailsModal
        session={selectedSession}
        isOpen={!!selectedSession}
        onClose={() => setSelectedSession(null)}
        onSessionUpdated={(updatedSession) => {
          setSessions((prev) => prev.map((s) => (s.id === updatedSession.id ? updatedSession : s)));
          setSelectedSession(updatedSession);
        }}
      />
    </div >
  );
}
