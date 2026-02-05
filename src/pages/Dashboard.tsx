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
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
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

// Admin Mock Data (kept for Admin view)
const adminStats = [
  {
    title: 'Total Students',
    value: '1,247',
    change: '+12%',
    changeType: 'positive',
    icon: GraduationCap,
  },
  {
    title: 'Active Faculty',
    value: '48',
    change: '+3',
    changeType: 'positive',
    icon: Users,
  },
  {
    title: 'Today\'s Attendance',
    value: '92%',
    change: '+5%',
    changeType: 'positive',
    icon: UserCheck,
  },
  {
    title: 'New Leads (CRM)',
    value: '23',
    change: 'This week',
    changeType: 'neutral',
    icon: TrendingUp,
  },
];

const upcomingClasses = [
  {
    id: 1,
    subject: 'Advanced Mathematics',
    faculty: 'Dr. Sarah Johnson',
    time: '09:00 AM - 10:30 AM',
    batch: 'Batch A',
    status: 'live',
    meetLink: '#',
  },
  {
    id: 2,
    subject: 'Physics Lab',
    faculty: 'Prof. Michael Chen',
    time: '11:00 AM - 12:30 PM',
    batch: 'Batch B',
    status: 'upcoming',
    meetLink: '#',
  },
];

const recentLeads = [
  { id: 1, name: 'Rahul Sharma', course: 'NEET Coaching', stage: 'Interested', time: '2h ago' },
  { id: 2, name: 'Priya Patel', course: 'JEE Advanced', stage: 'New Lead', time: '4h ago' },
  { id: 3, name: 'Amit Kumar', course: 'Foundation', stage: 'Follow-up', time: '5h ago' },
  { id: 4, name: 'Sneha Gupta', course: 'NEET Coaching', stage: 'Converted', time: '1d ago' },
];

const studentAttendance = [
  { date: '2024-01-01', status: 'present', subject: 'Advanced Mathematics' },
  { date: '2024-01-02', status: 'present', subject: 'Physics Lab' },
];

const getStageColor = (stage: string) => {
  switch (stage) {
    case 'New Lead':
      return 'bg-primary/10 text-primary border-primary/20';
    case 'Interested':
      return 'bg-accent/10 text-accent border-accent/20';
    case 'Follow-up':
      return 'bg-warning/10 text-warning border-warning/20';
    case 'Converted':
      return 'bg-success/10 text-success border-success/20';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

const getAttendanceColor = (status: string) => {
  return status === 'present'
    ? 'bg-success/10 text-success border-success/20'
    : 'bg-destructive/10 text-destructive border-destructive/20';
};

// Student Dashboard
function StudentDashboard() {
  const { toast } = useToast();
  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false);
  const [leaveReason, setLeaveReason] = useState('');

  const handleLeaveRequest = () => {
    if (!leaveReason.trim()) {
      toast({
        title: 'Error',
        description: 'Please provide a reason for leave',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Success',
      description: 'Leave request submitted for approval',
    });

    setLeaveReason('');
    setIsLeaveDialogOpen(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* (Student Dashboard Content - Kept minimal for brevity but preserved structure) */}
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
      {/* ... keeping previous static student content for now as task focus is Faculty ... */}
      <Card className="border shadow-card">
        <CardHeader>
          <CardTitle>Today's Classes</CardTitle>
          <CardDescription>Your scheduled classes for today</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {upcomingClasses.slice(0, 2).map((cls) => (
            <div key={cls.id} className="flex items-center gap-4 p-4 rounded-xl bg-muted/50">
              <div className="flex-1">
                <h4 className="font-semibold text-foreground">{cls.subject}</h4>
                <p className="text-sm text-muted-foreground mt-1">{cls.faculty}</p>
                <div className="flex items-center gap-4 mt-2 text-sm">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="w-3.5 h-3.5" />
                    {cls.time}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// Faculty Dashboard
function FacultyDashboard() {
  const { user } = useAuth();
  const [todaySessions, setTodaySessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<any | null>(null);
  const [sessionModules, setSessionModules] = useState<any[]>([]);

  useEffect(() => {
    if (user?.id) {
      fetchTodaySessions();
    }
  }, [user?.id]);

  const fetchTodaySessions = async () => {
    try {
      // Get today's start and end timestamps
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      // Fetch sessions linked to classes
      const { data, error } = await supabase
        .from('sessions')
        .select(`
          id,
          title,
          start_time,
          end_time,
          meet_link,
          classes (
            name,
            subject,
            room_number
          )
        `)
        .eq('faculty_id', user?.id)
        .gte('start_time', startOfDay.toISOString())
        .lte('start_time', endOfDay.toISOString())
        .order('start_time', { ascending: true });

      if (error) throw error;
      setTodaySessions(data || []);
    } catch (error) {
      console.error('Error fetching sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (session: any) => {
    setSelectedSession(session);
    // Fetch modules for this session
    try {
      const { data, error } = await supabase
        .from('session_modules')
        .select(`
                module_id,
                modules (
                    id,
                    title,
                    file_url,
                    file_type
                )
            `)
        .eq('session_id', session.id);

      if (error) throw error;

      // Flatten structure
      const mods = data?.map((item: any) => item.modules) || [];
      setSessionModules(mods);

    } catch (err) {
      console.error("Error fetching session modules", err);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
            Faculty Dashboard 👨‍🏫
          </h1>
          <p className="text-muted-foreground mt-1">
            Your assigned classes for today
          </p>
        </div>
      </div>

      {/* Assigned Classes */}
      {loading ? (
        <div className="text-center py-10">Loading schedule...</div>
      ) : todaySessions.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
          No classes scheduled for today.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {todaySessions.map((session) => (
            <Card key={session.id} className="border shadow-card hover:shadow-soft transition-shadow cursor-pointer">
              <CardHeader>
                <CardTitle>{session.classes?.name || 'Class'}</CardTitle>
                <CardDescription>{session.title}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span>Topic: {session.classes?.subject}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span>
                      {new Date(session.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -
                      {new Date(session.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {session.meet_link && (
                    <div className="flex items-center gap-2">
                      <Video className="w-4 h-4 text-primary" />
                      <a href={session.meet_link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                        Join Google Meet
                      </a>
                    </div>
                  )}
                </div>
                <Button
                  className="w-full"
                  onClick={() => handleViewDetails(session)}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  View Details & Modules
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Class Details Modal */}
      {selectedSession && (
        <Dialog open={!!selectedSession} onOpenChange={() => setSelectedSession(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedSession.classes?.name}</DialogTitle>
              <DialogDescription>{selectedSession.title}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Time</p>
                  <p className="font-medium mt-1">
                    {new Date(selectedSession.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Subject</p>
                  <p className="font-medium mt-1">{selectedSession.classes?.subject}</p>
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
                <p className="font-medium mb-3">Attached Modules ({sessionModules.length})</p>
                <div className="space-y-2">
                  {sessionModules.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No modules attached.</p>
                  ) : (
                    sessionModules.map((mod, i) => (
                      <div
                        key={mod.id || i}
                        className="flex items-center justify-between p-3 rounded-lg border"
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">{mod.title}</span>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => window.open(mod.file_url, '_blank')}>
                          <Download className="w-4 h-4 mr-2" />
                          View/Download
                        </Button>
                      </div>
                    ))
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
// Admin Dashboard (original) - keeping minimal mock data for now
function AdminDashboard() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
            Admin Dashboard 🎯
          </h1>
          <p className="text-muted-foreground mt-1">
            Overview of the institute.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {adminStats.map((stat, index) => (
          <Card key={stat.title} className="border shadow-card hover:shadow-soft transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <stat.icon className="w-6 h-6 text-primary" />
                </div>
                <Badge variant="outline" className={stat.changeType === 'positive' ? 'bg-success/10 text-success' : 'bg-muted'}>{stat.change}</Badge>
              </div>
              <div className="mt-4">
                <p className="text-3xl font-bold text-foreground">{stat.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{stat.title}</p>
              </div>
            </CardContent>
          </Card>
        ))}
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
