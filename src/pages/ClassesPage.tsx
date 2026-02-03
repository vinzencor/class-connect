import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Calendar,
  Clock,
  Video,
  Users,
  BookOpen,
  MapPin,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const mockClasses = [
  {
    id: '1',
    subject: 'Advanced Mathematics',
    faculty: 'Dr. Sarah Johnson',
    time: '09:00 - 10:30',
    batch: 'Batch A',
    room: 'Room 101',
    day: 'Monday',
    meetLink: 'https://meet.google.com/abc-123',
    color: 'bg-primary',
  },
  {
    id: '2',
    subject: 'Physics Lab',
    faculty: 'Prof. Michael Chen',
    time: '11:00 - 12:30',
    batch: 'Batch B',
    room: 'Lab 2',
    day: 'Monday',
    meetLink: 'https://meet.google.com/def-456',
    color: 'bg-accent',
  },
  // yter
  {
    id: '3',
    subject: 'Chemistry',
    faculty: 'Dr. Emily Davis',
    time: '14:00 - 15:30',
    batch: 'Batch A',
    room: 'Room 203',
    day: 'Monday',
    meetLink: 'https://meet.google.com/ghi-789',
    color: 'bg-success',
  },
  {
    id: '4',
    subject: 'Biology',
    faculty: 'Prof. James Wilson',
    time: '09:00 - 10:30',
    batch: 'Batch B',
    room: 'Room 105',
    day: 'Tuesday',
    meetLink: 'https://meet.google.com/jkl-012',
    color: 'bg-warning',
  },
  {
    id: '5',
    subject: 'English Literature',
    faculty: 'Ms. Anna Brown',
    time: '11:00 - 12:30',
    batch: 'Batch A',
    room: 'Room 102',
    day: 'Tuesday',
    meetLink: 'https://meet.google.com/mno-345',
    color: 'bg-destructive',
  },
];

const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const timeSlots = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

export default function ClassesPage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [view, setView] = useState<'week' | 'list'>('week');

  const currentWeekStart = new Date(selectedDate);
  currentWeekStart.setDate(selectedDate.getDate() - selectedDate.getDay() + 1);

  const weekDates = weekDays.map((_, i) => {
    const date = new Date(currentWeekStart);
    date.setDate(currentWeekStart.getDate() + i);
    return date;
  });

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() + (direction === 'next' ? 7 : -7));
    setSelectedDate(newDate);
  };

  const getClassesForDay = (day: string) => {
    return mockClasses.filter((cls) => cls.day === day);
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
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-primary-foreground">
                <Plus className="w-4 h-4 mr-2" />
                Add Class
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Schedule New Class</DialogTitle>
                <DialogDescription>
                  Create a new class session with Google Meet integration.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Subject</Label>
                  <Input placeholder="e.g., Advanced Mathematics" />
                </div>
                <div className="space-y-2">
                  <Label>Faculty</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select faculty" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sarah">Dr. Sarah Johnson</SelectItem>
                      <SelectItem value="michael">Prof. Michael Chen</SelectItem>
                      <SelectItem value="emily">Dr. Emily Davis</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input type="date" />
                  </div>
                  <div className="space-y-2">
                    <Label>Batch</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="batch-a">Batch A</SelectItem>
                        <SelectItem value="batch-b">Batch B</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Start Time</Label>
                    <Input type="time" />
                  </div>
                  <div className="space-y-2">
                    <Label>End Time</Label>
                    <Input type="time" />
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                  <Video className="w-4 h-4 text-primary" />
                  <span className="text-sm text-muted-foreground">
                    Google Meet link will be auto-generated
                  </span>
                </div>
                <div className="flex gap-3 pt-4">
                  <Button variant="outline" className="flex-1" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button className="flex-1 bg-primary text-primary-foreground" onClick={() => setIsAddDialogOpen(false)}>
                    Create Class
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
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
              <Calendar className="w-5 h-5 text-primary" />
              <span className="font-semibold text-foreground">
                {weekDates[0].toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} -{' '}
                {weekDates[5].toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
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
        <div className="grid grid-cols-1 lg:grid-cols-6 gap-4">
          {weekDays.map((day, dayIndex) => (
            <Card key={day} className="border shadow-card">
              <CardHeader className="pb-2">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">{day}</p>
                  <p className="text-lg font-bold text-foreground">
                    {weekDates[dayIndex].getDate()}
                  </p>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {getClassesForDay(day).length > 0 ? (
                  getClassesForDay(day).map((cls) => (
                    <div
                      key={cls.id}
                      className={`p-3 rounded-lg ${cls.color}/10 border border-${cls.color}/20 cursor-pointer hover:shadow-soft transition-shadow`}
                    >
                      <p className="font-semibold text-sm text-foreground truncate">
                        {cls.subject}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        <Clock className="w-3 h-3 inline mr-1" />
                        {cls.time}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <Users className="w-3 h-3 inline mr-1" />
                        {cls.batch}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-muted-foreground text-sm">
                    No classes
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        /* List View */
        <Card className="border shadow-card">
          <CardContent className="p-0">
            <div className="divide-y">
              {mockClasses.map((cls, index) => (
                <div
                  key={cls.id}
                  className="p-4 hover:bg-muted/50 transition-colors animate-fade-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-1 h-16 rounded-full ${cls.color}`} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground">{cls.subject}</h3>
                        <Badge variant="outline">{cls.batch}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {cls.faculty}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {cls.day}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {cls.time}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {cls.room}
                        </span>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      <Video className="w-4 h-4 mr-2" />
                      Join Meet
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
