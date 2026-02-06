import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Search,
  Upload,
  FileText,
  Download,
  Eye,
  Filter,
  Trash2,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Module {
  id: string;
  title: string;
  subject: string;
  faculty_id: string;
  file_url: string;
  file_type: string;
  created_at: string;
  organization_id: string;
}

const subjectColors: Record<string, string> = {
  Mathematics: 'bg-primary/10 text-primary border-primary/20',
  Physics: 'bg-accent/10 text-accent border-accent/20',
  Chemistry: 'bg-warning/10 text-warning border-warning/20',
  Biology: 'bg-success/10 text-success border-success/20',
  English: 'bg-destructive/10 text-destructive border-destructive/20',
};

export default function ModulesPage() {
  const { user } = useAuth();
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (user?.organizationId) {
      fetchModules();
    }
  }, [user?.organizationId]);

  const fetchModules = async () => {
    try {
      const { data, error } = await supabase
        .from('modules')
        .select('*')
        .eq('organization_id', user?.organizationId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setModules(data || []);
    } catch (error) {
      console.error('Error fetching modules:', error);
      toast.error('Failed to load modules');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user?.organizationId) return;

    setUploading(true);
    try {
      // 1. Upload file to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${user.organizationId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('modules')
        .upload(filePath, file);

      if (uploadError) {
        if (uploadError.message.includes('Bucket not found') || (uploadError as any).statusCode === '404') {
          throw new Error("Storage bucket 'modules' not found. Please create a public bucket named 'modules' in your Supabase dashboard.");
        }
        throw uploadError;
      }

      // 2. Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('modules')
        .getPublicUrl(filePath);

      // 3. Create database record
      const { error: dbError } = await supabase
        .from('modules')
        .insert({
          organization_id: user.organizationId,
          title: file.name.replace(`.${fileExt}`, ''),
          subject: 'General', // Default, ideally user selects this
          file_url: publicUrl,
          file_type: fileExt,
          uploaded_by: user.id
        });

      if (dbError) throw dbError;

      toast.success('Module uploaded successfully');
      fetchModules();
    } catch (error: any) {
      console.error('Error uploading module:', error);
      toast.error(error.message || 'Failed to upload module');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this module?')) return;

    try {
      const { error } = await supabase
        .from('modules')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setModules(modules.filter(m => m.id !== id));
      toast.success('Module deleted');
    } catch (error) {
      console.error('Error deleting module:', error);
      toast.error('Failed to delete module');
    }
  };


  const filteredModules = modules.filter((module) => {
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
            Upload course materials and share with students
          </p>
        </div>
        <div className="relative">
          <input
            type="file"
            id="file-upload"
            className="hidden"
            onChange={handleFileUpload}
            disabled={uploading}
          />
          <Button
            className="bg-primary text-primary-foreground"
            disabled={uploading}
            onClick={() => document.getElementById('file-upload')?.click()}
          >
            <Upload className="w-4 h-4 mr-2" />
            {uploading ? 'Uploading...' : 'Upload Module'}
          </Button>
        </div>
      </div>

      {/* Upload Area - simplified reuse of logic */}
      <Card className="border-2 border-dashed shadow-card cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => document.getElementById('file-upload')?.click()}
      >
        <CardContent className="p-8">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <Upload className="w-8 h-8 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">
              Drag and drop your files here
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Or click to browse. Supported formats: PDF, PPT, DOCX
            </p>
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
      {loading ? (
        <div className="text-center py-10">Loading modules...</div>
      ) : filteredModules.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">No modules found</div>
      ) : (
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
                    <p className="text-sm text-muted-foreground">
                      {(new Date(module.created_at)).toLocaleDateString()}
                    </p>
                  </div>
                  {user?.role !== 'student' && (
                    <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => handleDelete(module.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-4">
                  <Badge variant="outline" className={subjectColors[module.subject] || ''}>
                    {module.subject}
                  </Badge>
                  <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                    {module.file_type?.toUpperCase() || 'FILE'}
                  </Badge>
                </div>

                <div className="flex gap-2 mt-4 pt-4 border-t">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => window.open(module.file_url, '_blank')}>
                    <Eye className="w-4 h-4 mr-2" />
                    View
                  </Button>
                  <Button size="sm" className="flex-1 bg-primary text-primary-foreground" onClick={() => {
                    const link = document.createElement('a');
                    link.href = module.file_url;
                    link.download = module.title;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}>
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
