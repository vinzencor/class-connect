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
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

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
  {
    id: 3,
    subject: 'English Literature',
    faculty: 'Ms. Emily Davis',
    time: '02:00 PM - 03:30 PM',
    batch: 'Batch A',
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
  { date: '2024-01-03', status: 'absent', subject: 'English Literature' },
  { date: '2024-01-04', status: 'present', subject: 'Advanced Mathematics' },
  { date: '2024-01-05', status: 'present', subject: 'Physics Lab' },
];

const facultyClasses = [
  {
    id: 1,
    subject: 'Advanced Mathematics',
    batch: 'Batch A',
    schedule: 'Mon, Wed, Fri 09:00 AM',
    students: 35,
    modules: 5,
  },
  {
    id: 2,
    subject: 'Physics Lab',
    batch: 'Batch B',
    schedule: 'Tue, Thu 11:00 AM',
    students: 28,
    modules: 3,
  },
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

      {/* Today's Classes */}
      <Card className="border shadow-card">
        <CardHeader>
          <CardTitle>Today's Classes</CardTitle>
          <CardDescription>Your scheduled classes for today</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {upcomingClasses.slice(0, 2).map((cls) => (
            <div
              key={cls.id}
              className="flex items-center gap-4 p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
            >
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
              {cls.status === 'live' && (
                <Button className="bg-primary text-primary-foreground">
                  <Video className="w-4 h-4 mr-2" />
                  Join Now
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Attendance Report */}
      <Card className="border shadow-card">
        <CardHeader>
          <CardTitle>Attendance Report</CardTitle>
          <CardDescription>Your attendance status up to date</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {studentAttendance.map((record) => (
              <div
                key={record.date}
                className="flex items-center justify-between p-3 rounded-lg border"
              >
                <div>
                  <p className="font-medium text-sm">{record.subject}</p>
                  <p className="text-xs text-muted-foreground">{record.date}</p>
                </div>
                <Badge variant="outline" className={getAttendanceColor(record.status)}>
                  {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                </Badge>
              </div>
            ))}
          </div>
          <div className="mt-4 p-3 rounded-lg bg-primary/10">
            <p className="text-sm">
              <span className="font-medium">Overall Attendance:</span> 90%
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Leave Request */}
      <Card className="border shadow-card">
        <CardHeader>
          <CardTitle>Leave Request</CardTitle>
          <CardDescription>Request leave from classes</CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog open={isLeaveDialogOpen} onOpenChange={setIsLeaveDialogOpen}>
            <Button
              onClick={() => setIsLeaveDialogOpen(true)}
              className="w-full bg-primary text-primary-foreground"
            >
              <Send className="w-4 h-4 mr-2" />
              Request Leave
            </Button>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Submit Leave Request</DialogTitle>
                <DialogDescription>
                  Request leave from your classes. Your request will be reviewed by faculty.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Reason for Leave</label>
                  <textarea
                    className="w-full p-2 rounded-lg border bg-background text-foreground"
                    rows={4}
                    placeholder="Enter your reason for leave..."
                    value={leaveReason}
                    onChange={(e) => setLeaveReason(e.target.value)}
                  />
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setIsLeaveDialogOpen(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleLeaveRequest}
                    className="flex-1 bg-primary text-primary-foreground"
                  >
                    Submit Request
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}

// Faculty Dashboard
function FacultyDashboard() {
  const [selectedClass, setSelectedClass] = useState<(typeof facultyClasses)[0] | null>(null);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
            Faculty Dashboard 👨‍🏫
          </h1>
          <p className="text-muted-foreground mt-1">
            Your assigned classes and modules
          </p>
        </div>
      </div>

      {/* Assigned Classes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {facultyClasses.map((cls) => (
          <Card key={cls.id} className="border shadow-card hover:shadow-soft transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle>{cls.subject}</CardTitle>
              <CardDescription>{cls.batch}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span>{cls.schedule}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span>{cls.students} Students</span>
                </div>
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-muted-foreground" />
                  <span>{cls.modules} Modules</span>
                </div>
              </div>
              <Button
                className="w-full"
                onClick={() => setSelectedClass(cls)}
              >
                <FileText className="w-4 h-4 mr-2" />
                View Details
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Class Details Modal */}
      {selectedClass && (
        <Dialog open={!!selectedClass} onOpenChange={() => setSelectedClass(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedClass.subject}</DialogTitle>
              <DialogDescription>{selectedClass.batch}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Schedule</p>
                  <p className="font-medium mt-1">{selectedClass.schedule}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Students Enrolled</p>
                  <p className="font-medium mt-1">{selectedClass.students}</p>
                </div>
              </div>
              <div>
                <p className="font-medium mb-3">Available Modules ({selectedClass.modules})</p>
                <div className="space-y-2">
                  {Array(selectedClass.modules)
                    .fill(0)
                    .map((_, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-3 rounded-lg border"
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">Module {i + 1}</span>
                        </div>
                        <Button size="sm" variant="outline">
                          <Download className="w-4 h-4 mr-2" />
                          Download
                        </Button>
                      </div>
                    ))}
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setSelectedClass(null)}
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
// Admin Dashboard (original)
function AdminDashboard() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
            Admin Dashboard 🎯
          </h1>
          <p className="text-muted-foreground mt-1">
            Here's what's happening at your institute today.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Calendar className="w-4 h-4 mr-2" />
            Today
          </Button>
          <Button size="sm" className="bg-primary text-primary-foreground">
            <Clock className="w-4 h-4 mr-2" />
            Schedule Class
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {adminStats.map((stat, index) => (
          <Card
            key={stat.title}
            className="border shadow-card hover:shadow-soft transition-shadow animate-fade-in"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <stat.icon className="w-6 h-6 text-primary" />
                </div>
                <Badge
                  variant="outline"
                  className={
                    stat.changeType === 'positive'
                      ? 'bg-success/10 text-success border-success/20'
                      : 'bg-muted text-muted-foreground'
                  }
                >
                  {stat.change}
                </Badge>
              </div>
              <div className="mt-4">
                <p className="text-3xl font-bold text-foreground">{stat.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{stat.title}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Classes */}
        <Card className="lg:col-span-2 border shadow-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="font-display">Today's Schedule</CardTitle>
              <CardDescription>Classes scheduled for today</CardDescription>
            </div>
            <Button variant="ghost" size="sm">
              View All
              <ArrowUpRight className="w-4 h-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {upcomingClasses.map((cls, index) => (
                <div
                  key={cls.id}
                  className="flex items-center gap-4 p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors animate-fade-in"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-foreground truncate">{cls.subject}</h4>
                      {cls.status === 'live' && (
                        <Badge className="bg-destructive text-destructive-foreground animate-pulse-soft">
                          LIVE
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{cls.faculty}</p>
                    <div className="flex items-center gap-4 mt-2 text-sm">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="w-3.5 h-3.5" />
                        {cls.time}
                      </span>
                      <Badge variant="outline">{cls.batch}</Badge>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={cls.status === 'live' ? 'default' : 'outline'}
                    className={cls.status === 'live' ? 'bg-primary text-primary-foreground' : ''}
                  >
                    <Video className="w-4 h-4 mr-2" />
                    {cls.status === 'live' ? 'Join Now' : 'View'}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent CRM Leads */}
        <Card className="border shadow-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="font-display">Recent Leads</CardTitle>
              <CardDescription>Latest enquiries</CardDescription>
            </div>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentLeads.map((lead, index) => (
                <div
                  key={lead.id}
                  className="flex items-center gap-3 animate-fade-in"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {lead.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground text-sm truncate">{lead.name}</p>
                    <p className="text-xs text-muted-foreground">{lead.course}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className={getStageColor(lead.stage)}>
                      {lead.stage}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">{lead.time}</p>
                  </div>
                </div>
              ))}
            </div>
            <Button variant="outline" className="w-full mt-4">
              View All Leads
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="border shadow-card">
        <CardHeader>
          <CardTitle className="font-display">Quick Actions</CardTitle>
          <CardDescription>Common tasks you can perform</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Add Student', icon: GraduationCap, color: 'bg-primary/10 text-primary' },
              { label: 'Schedule Class', icon: Calendar, color: 'bg-accent/10 text-accent' },
              { label: 'Mark Attendance', icon: UserCheck, color: 'bg-success/10 text-success' },
              { label: 'New Lead', icon: TrendingUp, color: 'bg-warning/10 text-warning' },
            ].map((action) => (
              <button
                key={action.label}
                className="flex flex-col items-center gap-3 p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-muted/50 transition-all group"
              >
                <div
                  className={`w-12 h-12 rounded-xl ${action.color} flex items-center justify-center group-hover:scale-110 transition-transform`}
                >
                  <action.icon className="w-6 h-6" />
                </div>
                <span className="text-sm font-medium text-foreground">{action.label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();

  // Render role-specific dashboard
  if (user?.role === 'student') {
    return <StudentDashboard />;
  }

  if (user?.role === 'faculty') {
    return <FacultyDashboard />;
  }

  // Default to admin dashboard
  return <AdminDashboard />;
}
