import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { Download, Users, FileText, Loader2, Filter } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { admissionSourceService, AdmissionSource } from '@/services/admissionSourceService';

interface StudentData {
    id: string;
    full_name: string;
    email: string;
    phone: string;
    admission_source: string;
    created_at: string;
}

export function AdmissionReport() {
    const { user } = useAuth();
    const [sources, setSources] = useState<AdmissionSource[]>([]);
    const [students, setStudents] = useState<StudentData[]>([]);
    const [selectedSource, setSelectedSource] = useState('all');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            if (!user?.organizationId) return;
            setIsLoading(true);
            try {
                const [sourcesRes, studentsRes] = await Promise.all([
                    admissionSourceService.getSources(user.organizationId).catch(() => []),
                    // Fetch students and their admission source
                    supabase
                        .from('profiles')
                        .select(`
              id, full_name, email, phone, created_at,
              student_details!inner(admission_source)
            `)
                        .eq('organization_id', user.organizationId)
                        .eq('role', 'student')
                ]);

                setSources(sourcesRes);

                if (!studentsRes.error && studentsRes.data) {
                    const formatted: StudentData[] = studentsRes.data.map((p: any) => ({
                        id: p.id,
                        full_name: p.full_name,
                        email: p.email || '',
                        phone: p.phone || '',
                        created_at: p.created_at,
                        admission_source: p.student_details?.admission_source || 'Unknown'
                    }));
                    setStudents(formatted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
                }
            } catch (err) {
                console.error('Error fetching admission report data:', err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [user?.organizationId]);

    const filteredStudents = useMemo(() => {
        if (selectedSource === 'all') return students;
        if (selectedSource === 'unknown') return students.filter(s => !s.admission_source || s.admission_source === 'Unknown');
        return students.filter(s => s.admission_source === selectedSource);
    }, [students, selectedSource]);

    const exportCSV = () => {
        const headers = ['Name', 'Email', 'Phone', 'Admission Source', 'Date Added'];
        const rows = filteredStudents.map(s => [
            `"${s.full_name}"`,
            s.email,
            s.phone,
            `"${s.admission_source}"`,
            new Date(s.created_at).toLocaleDateString()
        ]);
        const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `admission_report_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const exportPDF = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Admission Source Report</title>
        <style>
          body { font-family: sans-serif; padding: 20px; color: #333; }
          h1 { color: #1e1b4b; border-bottom: 2px solid #6366f1; padding-bottom: 10px; }
          .stats { display: flex; gap: 20px; margin: 20px 0; }
          .stat-box { background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; flex: 1; }
          .stat-value { font-size: 24px; font-weight: bold; color: #6366f1; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e2e8f0; }
          th { background: #f1f5f9; color: #475569; }
        </style>
      </head>
      <body>
        <h1>Admission Source Report</h1>
        <div class="stats">
          <div class="stat-box">
            <div>Total Students</div>
            <div class="stat-value">${filteredStudents.length}</div>
            <div>${selectedSource === 'all' ? 'All Sources' : 'Source: ' + selectedSource}</div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Source</th>
              <th>Date Added</th>
            </tr>
          </thead>
          <tbody>
            ${filteredStudents.map(s => `
              <tr>
                <td>${s.full_name}</td>
                <td>${s.phone}</td>
                <td>${s.admission_source}</td>
                <td>${new Date(s.created_at).toLocaleDateString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;
        printWindow.document.write(html);
        printWindow.document.close();
        setTimeout(() => printWindow.print(), 500);
    };

    if (isLoading) {
        return (
            <Card className="border shadow-card h-64 flex items-center justify-center">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <p>Loading report data...</p>
                </div>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border shadow-card">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Total Students</p>
                                <p className="text-2xl font-bold text-primary">{filteredStudents.length}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {selectedSource === 'all' ? 'Across all sources' : `From ${selectedSource}`}
                                </p>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                                <Users className="w-6 h-6 text-primary" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="border shadow-card">
                <CardHeader className="pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <CardTitle className="text-lg">Students by Source</CardTitle>
                            <CardDescription>View and download students acquired from specific channels</CardDescription>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Select value={selectedSource} onValueChange={setSelectedSource}>
                                <SelectTrigger className="w-[180px]">
                                    <Filter className="w-4 h-4 mr-2" />
                                    <SelectValue placeholder="All Sources" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Sources</SelectItem>
                                    {sources.map(s => (
                                        <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                                    ))}
                                    <SelectItem value="unknown">Unknown</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button variant="outline" size="sm" onClick={exportCSV}>
                                <Download className="w-4 h-4 mr-2" />
                                CSV
                            </Button>
                            <Button variant="outline" size="sm" onClick={exportPDF}>
                                <FileText className="w-4 h-4 mr-2" />
                                PDF
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-lg border overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead>Student Name</TableHead>
                                    <TableHead>Contact</TableHead>
                                    <TableHead>Admission Source</TableHead>
                                    <TableHead>Date Added</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredStudents.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                                            No students found for this source.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredStudents.map((s) => (
                                        <TableRow key={s.id}>
                                            <TableCell className="font-medium">{s.full_name}</TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    {s.phone && <span className="text-sm">{s.phone}</span>}
                                                    {s.email && <span className="text-xs text-muted-foreground">{s.email}</span>}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline">{s.admission_source}</Badge>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm">
                                                {new Date(s.created_at).toLocaleDateString()}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
