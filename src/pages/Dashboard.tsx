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
  const { user, profile } = useAuth();
  const [todaySessions, setTodaySessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<any | null>(null);
  const [sessionModules, setSessionModules] = useState<any[]>([]);

  const organizationId = user?.organizationId || profile?.organization_id;

  useEffect(() => {
    if (user?.id && organizationId) {
      fetchTodaySessions();
    }
  }, [user?.id, organizationId]);

  const fetchTodaySessions = async () => {
    setLoading(true);
    try {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

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
            name,
            subject,
            room_number,
            faculty_id
          )
        `)
        .eq('organization_id', organizationId)
        .gte('start_time', startOfDay.toISOString())
        .lte('start_time', endOfDay.toISOString())
        .order('start_time', { ascending: true });

      if (error) throw error;

      const filtered = (data || []).filter((session: any) =>
        session.faculty_id === user?.id || session.classes?.faculty_id === user?.id
      );

      setTodaySessions(filtered);
    } catch (error) {
      console.error('Error fetching sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (session: any) => {
    setSelectedSession(session);
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
    }
  }, [organizationId]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch students count
      const { count: studentCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('role', 'student');

      // Fetch faculty count
      const { count: facultyCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('role', 'faculty');

      // Fetch today's sessions count
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      const { count: todaySessionCount } = await supabase
        .from('sessions')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .gte('start_time', startOfDay.toISOString())
        .lte('start_time', endOfDay.toISOString());

      // Fetch new leads this week
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const { count: leadsCount } = await supabase
        .from('crm_leads')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .gte('created_at', weekAgo.toISOString());

      setStats({
        totalStudents: studentCount || 0,
        totalFaculty: facultyCount || 0,
        todaySessions: todaySessionCount || 0,
        newLeads: leadsCount || 0,
      });

      // Fetch payment data for pie chart
      const { data: paymentsData } = await supabase
        .from('payments')
        .select('amount, amount_paid, status')
        .eq('organization_id', organizationId);

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

      // Fetch session trend (last 7 days)
      const last7Days = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);

        const { count } = await supabase
          .from('sessions')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', organizationId)
          .gte('start_time', date.toISOString())
          .lt('start_time', nextDay.toISOString());

        last7Days.push({
          day: date.toLocaleDateString('en-US', { weekday: 'short' }),
          sessions: count || 0,
        });
      }
      setSessionTrend(last7Days);

      // Fetch recent leads
      const { data: leadsData } = await supabase
        .from('crm_leads')
        .select('id, name, status, created_at')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(5);

      setRecentLeads(leadsData || []);

      // Fetch upcoming sessions
      const { data: sessionsData } = await supabase
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
