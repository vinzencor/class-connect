import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Search,
  Plus,
  Phone,
  Mail,
  MessageSquare,
  Calendar,
  ArrowRight,
  MoreHorizontal,
  Filter,
  TrendingUp,
  Users,
  UserPlus,
  CheckCircle,
  XCircle,
} from 'lucide-react';

const mockLeads = [
  {
    id: '1',
    name: 'Rahul Sharma',
    phone: '+91 98765 43210',
    email: 'rahul.sharma@gmail.com',
    course: 'NEET Coaching',
    source: 'Walk-in',
    stage: 'Interested',
    assignedTo: 'Admin',
    nextFollowup: '2024-01-20',
    notes: 'Very keen on joining. Parents want to visit.',
    createdAt: '2024-01-15',
  },
  {
    id: '2',
    name: 'Priya Patel',
    phone: '+91 87654 32109',
    email: 'priya.p@gmail.com',
    course: 'JEE Advanced',
    source: 'Phone Call',
    stage: 'New Lead',
    assignedTo: 'Counselor 1',
    nextFollowup: '2024-01-18',
    notes: 'First enquiry, needs batch information.',
    createdAt: '2024-01-16',
  },
  {
    id: '3',
    name: 'Amit Kumar',
    phone: '+91 76543 21098',
    email: 'amit.k@gmail.com',
    course: 'Foundation',
    source: 'WhatsApp',
    stage: 'Follow-up',
    assignedTo: 'Admin',
    nextFollowup: '2024-01-19',
    notes: 'Needs fee breakup and schedule.',
    createdAt: '2024-01-14',
  },
  {
    id: '4',
    name: 'Sneha Gupta',
    phone: '+91 65432 10987',
    email: 'sneha.g@gmail.com',
    course: 'NEET Coaching',
    source: 'Campaign',
    stage: 'Converted',
    assignedTo: 'Counselor 2',
    nextFollowup: null,
    notes: 'Admission completed. Batch A assigned.',
    createdAt: '2024-01-10',
  },
  {
    id: '5',
    name: 'Vikash Singh',
    phone: '+91 54321 09876',
    email: 'vikash.s@gmail.com',
    course: 'JEE Mains',
    source: 'Walk-in',
    stage: 'Not Interested',
    assignedTo: 'Admin',
    nextFollowup: null,
    notes: 'Chose another institute due to location.',
    createdAt: '2024-01-12',
  },
];

const stages = [
  { value: 'New Lead', color: 'bg-primary/10 text-primary border-primary/20', icon: UserPlus },
  { value: 'Contacted', color: 'bg-accent/10 text-accent border-accent/20', icon: Phone },
  { value: 'Interested', color: 'bg-warning/10 text-warning border-warning/20', icon: TrendingUp },
  { value: 'Follow-up', color: 'bg-secondary text-secondary-foreground border-secondary', icon: Calendar },
  { value: 'Converted', color: 'bg-success/10 text-success border-success/20', icon: CheckCircle },
  { value: 'Not Interested', color: 'bg-destructive/10 text-destructive border-destructive/20', icon: XCircle },
];

const getStageStyle = (stage: string) => {
  return stages.find((s) => s.value === stage) || stages[0];
};

export default function CRMPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'pipeline' | 'list'>('pipeline');

  const filteredLeads = mockLeads.filter((lead) => {
    const matchesSearch =
      lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStage = stageFilter === 'all' || lead.stage === stageFilter;
    return matchesSearch && matchesStage;
  });

  const pipelineStages = ['New Lead', 'Contacted', 'Interested', 'Follow-up', 'Converted'];

  const stats = {
    total: mockLeads.length,
    new: mockLeads.filter((l) => l.stage === 'New Lead').length,
    converted: mockLeads.filter((l) => l.stage === 'Converted').length,
    conversionRate: Math.round(
      (mockLeads.filter((l) => l.stage === 'Converted').length / mockLeads.length) * 100
    ),
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
            CRM & Admissions
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage leads, enquiries, and conversions
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground">
              <Plus className="w-4 h-4 mr-2" />
              Add Lead
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Lead</DialogTitle>
              <DialogDescription>
                Capture enquiry details for follow-up.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input placeholder="Enter full name" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input type="tel" placeholder="+91..." />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" placeholder="email@..." />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Course Interest</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="neet">NEET Coaching</SelectItem>
                      <SelectItem value="jee-mains">JEE Mains</SelectItem>
                      <SelectItem value="jee-advanced">JEE Advanced</SelectItem>
                      <SelectItem value="foundation">Foundation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Source</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="walkin">Walk-in</SelectItem>
                      <SelectItem value="phone">Phone Call</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="campaign">Campaign</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea placeholder="Add any additional notes..." />
              </div>
              <div className="flex gap-3 pt-4">
                <Button variant="outline" className="flex-1" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button className="flex-1 bg-primary text-primary-foreground" onClick={() => setIsAddDialogOpen(false)}>
                  Add Lead
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Leads</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.new}</p>
                <p className="text-xs text-muted-foreground">New This Week</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.converted}</p>
                <p className="text-xs text-muted-foreground">Converted</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.conversionRate}%</p>
                <p className="text-xs text-muted-foreground">Conversion Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border shadow-card">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search leads..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Select value={stageFilter} onValueChange={setStageFilter}>
                <SelectTrigger className="w-40">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Stage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stages</SelectItem>
                  {stages.map((stage) => (
                    <SelectItem key={stage.value} value={stage.value}>
                      {stage.value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex rounded-lg border overflow-hidden">
                <Button
                  variant={viewMode === 'pipeline' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('pipeline')}
                  className={viewMode === 'pipeline' ? 'bg-primary text-primary-foreground' : ''}
                >
                  Pipeline
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className={viewMode === 'list' ? 'bg-primary text-primary-foreground' : ''}
                >
                  List
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {viewMode === 'pipeline' ? (
        /* Pipeline View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {pipelineStages.map((stage) => {
            const stageStyle = getStageStyle(stage);
            const stageLeads = filteredLeads.filter((l) => l.stage === stage);
            return (
              <Card key={stage} className="border shadow-card">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className={stageStyle.color}>
                      {stage}
                    </Badge>
                    <span className="text-sm font-medium text-muted-foreground">
                      {stageLeads.length}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {stageLeads.length > 0 ? (
                    stageLeads.map((lead) => (
                      <div
                        key={lead.id}
                        className="p-3 rounded-lg border bg-card hover:shadow-soft transition-shadow cursor-pointer"
                      >
                        <div className="flex items-start gap-2">
                          <Avatar className="w-8 h-8">
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">
                              {lead.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-foreground truncate">
                              {lead.name}
                            </p>
                            <p className="text-xs text-muted-foreground">{lead.course}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          <Phone className="w-3 h-3" />
                          <span className="truncate">{lead.phone}</span>
                        </div>
                        {lead.nextFollowup && (
                          <div className="flex items-center gap-2 mt-1 text-xs text-warning">
                            <Calendar className="w-3 h-3" />
                            <span>Follow-up: {lead.nextFollowup}</span>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6 text-muted-foreground text-sm">
                      No leads
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        /* List View */
        <Card className="border shadow-card">
          <CardContent className="p-0">
            <div className="divide-y">
              {filteredLeads.map((lead, index) => {
                const stageStyle = getStageStyle(lead.stage);
                return (
                  <div
                    key={lead.id}
                    className="p-4 hover:bg-muted/50 transition-colors animate-fade-in"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex items-center gap-4">
                      <Avatar className="w-10 h-10">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {lead.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-foreground">{lead.name}</h3>
                          <Badge variant="outline" className={stageStyle.color}>
                            {lead.stage}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-4 mt-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5" />
                            {lead.phone}
                          </span>
                          <span className="flex items-center gap-1">
                            <Mail className="w-3.5 h-3.5" />
                            {lead.email}
                          </span>
                          <span>{lead.course}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon">
                          <Phone className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon">
                          <MessageSquare className="w-4 h-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>View Details</DropdownMenuItem>
                            <DropdownMenuItem>Add Follow-up</DropdownMenuItem>
                            <DropdownMenuItem>Move Stage</DropdownMenuItem>
                            <DropdownMenuItem>Convert to Student</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
