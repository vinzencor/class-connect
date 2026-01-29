import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Search,
  Upload,
  FileText,
  Download,
  Eye,
  FolderOpen,
  Calendar,
  Clock,
  Filter,
} from 'lucide-react';
import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const mockModules = [
  {
    id: '1',
    title: 'Advanced Calculus - Chapter 1',
    subject: 'Mathematics',
    faculty: 'Dr. Sarah Johnson',
    uploadedAt: '2024-01-15',
    status: 'converted',
    originalFile: 'calculus-ch1.pptx',
    pdfFile: 'calculus-ch1.pdf',
    size: '2.4 MB',
  },
  {
    id: '2',
    title: 'Mechanics Fundamentals',
    subject: 'Physics',
    faculty: 'Prof. Michael Chen',
    uploadedAt: '2024-01-14',
    status: 'converted',
    originalFile: 'mechanics.pptx',
    pdfFile: 'mechanics.pdf',
    size: '3.1 MB',
  },
  {
    id: '3',
    title: 'Organic Chemistry Basics',
    subject: 'Chemistry',
    faculty: 'Dr. Emily Davis',
    uploadedAt: '2024-01-13',
    status: 'processing',
    originalFile: 'organic-chem.pptx',
    pdfFile: null,
    size: '4.2 MB',
  },
  {
    id: '4',
    title: 'Cell Biology Introduction',
    subject: 'Biology',
    faculty: 'Prof. James Wilson',
    uploadedAt: '2024-01-12',
    status: 'converted',
    originalFile: 'cell-bio.pptx',
    pdfFile: 'cell-bio.pdf',
    size: '2.8 MB',
  },
  {
    id: '5',
    title: 'English Grammar Rules',
    subject: 'English',
    faculty: 'Ms. Anna Brown',
    uploadedAt: '2024-01-11',
    status: 'converted',
    originalFile: 'grammar.pptx',
    pdfFile: 'grammar.pdf',
    size: '1.5 MB',
  },
];

const subjectColors: Record<string, string> = {
  Mathematics: 'bg-primary/10 text-primary border-primary/20',
  Physics: 'bg-accent/10 text-accent border-accent/20',
  Chemistry: 'bg-warning/10 text-warning border-warning/20',
  Biology: 'bg-success/10 text-success border-success/20',
  English: 'bg-destructive/10 text-destructive border-destructive/20',
};

export default function ModulesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('all');

  const filteredModules = mockModules.filter((module) => {
    const matchesSearch = module.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSubject = subjectFilter === 'all' || module.subject === subjectFilter;
    return matchesSearch && matchesSubject;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
            Study Modules
          </h1>
          <p className="text-muted-foreground mt-1">
            Upload PPT files and convert to PDF for students
          </p>
        </div>
        <Button className="bg-primary text-primary-foreground">
          <Upload className="w-4 h-4 mr-2" />
          Upload Module
        </Button>
      </div>

      {/* Upload Area */}
      <Card className="border-2 border-dashed shadow-card">
        <CardContent className="p-8">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <Upload className="w-8 h-8 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">
              Drag and drop your PPT files here
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Or click to browse. Files will be auto-converted to PDF.
            </p>
            <Button variant="outline">
              <FolderOpen className="w-4 h-4 mr-2" />
              Browse Files
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card className="border shadow-card">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search modules..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={subjectFilter} onValueChange={setSubjectFilter}>
              <SelectTrigger className="w-40">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Subject" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subjects</SelectItem>
                <SelectItem value="Mathematics">Mathematics</SelectItem>
                <SelectItem value="Physics">Physics</SelectItem>
                <SelectItem value="Chemistry">Chemistry</SelectItem>
                <SelectItem value="Biology">Biology</SelectItem>
                <SelectItem value="English">English</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Modules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredModules.map((module, index) => (
          <Card
            key={module.id}
            className="border shadow-card hover:shadow-soft transition-shadow animate-fade-in"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground truncate">{module.title}</h3>
                  <p className="text-sm text-muted-foreground">{module.faculty}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-4">
                <Badge variant="outline" className={subjectColors[module.subject] || ''}>
                  {module.subject}
                </Badge>
                <Badge
                  variant="outline"
                  className={
                    module.status === 'converted'
                      ? 'bg-success/10 text-success border-success/20'
                      : 'bg-warning/10 text-warning border-warning/20 animate-pulse-soft'
                  }
                >
                  {module.status === 'converted' ? 'PDF Ready' : 'Converting...'}
                </Badge>
              </div>

              <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {module.uploadedAt}
                </span>
                <span>{module.size}</span>
              </div>

              <div className="flex gap-2 mt-4 pt-4 border-t">
                {module.status === 'converted' ? (
                  <>
                    <Button variant="outline" size="sm" className="flex-1">
                      <Eye className="w-4 h-4 mr-2" />
                      Preview
                    </Button>
                    <Button size="sm" className="flex-1 bg-primary text-primary-foreground">
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  </>
                ) : (
                  <Button variant="outline" size="sm" className="flex-1" disabled>
                    <Clock className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
