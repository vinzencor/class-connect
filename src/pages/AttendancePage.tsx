import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
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
import {
  Search,
  Calendar,
  UserCheck,
  UserX,
  Clock,
  Smartphone,
  Filter,
  Download,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

const mockAttendance = [
  { id: '1', name: 'Rahul Sharma', batch: 'Batch A', present: 45, total: 50, lastScan: '09:02 AM', status: 'present' },
  { id: '2', name: 'Priya Patel', batch: 'Batch A', present: 48, total: 50, lastScan: '09:05 AM', status: 'present' },
  { id: '3', name: 'Amit Kumar', batch: 'Batch B', present: 42, total: 50, lastScan: '-', status: 'absent' },
  { id: '4', name: 'Sneha Gupta', batch: 'Batch B', present: 38, total: 50, lastScan: '09:15 AM', status: 'late' },
  { id: '5', name: 'Vikash Singh', batch: 'Batch A', present: 50, total: 50, lastScan: '08:58 AM', status: 'present' },
  { id: '6', name: 'Meera Joshi', batch: 'Batch B', present: 35, total: 50, lastScan: '-', status: 'absent' },
  { id: '7', name: 'Arjun Reddy', batch: 'Batch A', present: 47, total: 50, lastScan: '09:01 AM', status: 'present' },
];

const getAttendancePercentage = (present: number, total: number) => {
  return Math.round((present / total) * 100);
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'present':
      return 'bg-success/10 text-success border-success/20';
    case 'absent':
      return 'bg-destructive/10 text-destructive border-destructive/20';
    case 'late':
      return 'bg-warning/10 text-warning border-warning/20';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

const getPercentageColor = (percentage: number) => {
  if (percentage >= 90) return 'text-success';
  if (percentage >= 75) return 'text-primary';
  if (percentage >= 60) return 'text-warning';
  return 'text-destructive';
};

export default function AttendancePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [batchFilter, setBatchFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('today');

  const filteredAttendance = mockAttendance.filter((record) => {
    const matchesSearch = record.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesBatch = batchFilter === 'all' || record.batch === batchFilter;
    return matchesSearch && matchesBatch;
  });

  const stats = {
    totalPresent: mockAttendance.filter((r) => r.status === 'present').length,
    totalAbsent: mockAttendance.filter((r) => r.status === 'absent').length,
    totalLate: mockAttendance.filter((r) => r.status === 'late').length,
    avgAttendance: Math.round(
      mockAttendance.reduce((acc, r) => acc + getAttendancePercentage(r.present, r.total), 0) /
        mockAttendance.length
    ),
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
            Attendance Tracking
          </h1>
          <p className="text-muted-foreground mt-1">
            NFC-based automated attendance system
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button className="bg-primary text-primary-foreground">
            <Smartphone className="w-4 h-4 mr-2" />
            NFC Scanner
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Present Today</p>
                <p className="text-3xl font-bold text-success">{stats.totalPresent}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
                <UserCheck className="w-6 h-6 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Absent Today</p>
                <p className="text-3xl font-bold text-destructive">{stats.totalAbsent}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center">
                <UserX className="w-6 h-6 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Late Arrivals</p>
                <p className="text-3xl font-bold text-warning">{stats.totalLate}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center">
                <Clock className="w-6 h-6 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Attendance</p>
                <p className="text-3xl font-bold text-primary">{stats.avgAttendance}%</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* NFC Scanner Status */}
      <Card className="border shadow-card bg-gradient-to-r from-primary/5 to-accent/5">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center animate-pulse-soft">
              <Smartphone className="w-6 h-6 text-primary-foreground" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">NFC Scanner Active</p>
              <p className="text-sm text-muted-foreground">
                Ready to scan student ID cards at the entrance
              </p>
            </div>
            <Badge className="bg-success/10 text-success border-success/20">
              <span className="w-2 h-2 rounded-full bg-success mr-2 animate-pulse" />
              Online
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Filters & Table */}
      <Card className="border shadow-card">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search students..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Select value={batchFilter} onValueChange={setBatchFilter}>
                <SelectTrigger className="w-36">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Batch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Batches</SelectItem>
                  <SelectItem value="Batch A">Batch A</SelectItem>
                  <SelectItem value="Batch B">Batch B</SelectItem>
                </SelectContent>
              </Select>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-36">
                  <Calendar className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Date" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Student</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Today's Status</TableHead>
                  <TableHead className="hidden md:table-cell">Last Scan</TableHead>
                  <TableHead>Overall %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAttendance.map((record, index) => {
                  const percentage = getAttendancePercentage(record.present, record.total);
                  return (
                    <TableRow
                      key={record.id}
                      className="animate-fade-in"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="w-9 h-9">
                            <AvatarFallback className="bg-primary/10 text-primary text-sm">
                              {record.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-foreground">{record.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{record.batch}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getStatusBadge(record.status)}>
                          {record.status === 'present' && <UserCheck className="w-3 h-3 mr-1" />}
                          {record.status === 'absent' && <UserX className="w-3 h-3 mr-1" />}
                          {record.status === 'late' && <Clock className="w-3 h-3 mr-1" />}
                          {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {record.lastScan}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Progress value={percentage} className="w-20 h-2" />
                          <span className={`text-sm font-medium ${getPercentageColor(percentage)}`}>
                            {percentage}%
                          </span>
                          {percentage >= 75 ? (
                            <TrendingUp className="w-4 h-4 text-success" />
                          ) : (
                            <TrendingDown className="w-4 h-4 text-destructive" />
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
