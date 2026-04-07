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
import { referenceService, Reference } from '@/services/referenceService';
import { reportService, StudentDetailRow } from '@/services/reportService';

interface StudentData {
    id: string;
    full_name: string;
    email: string;
    phone: string;
    admission_source: string;
    reference: string;
    sales_staff_id: string | null;
    sales_staff_name: string;
    blood_group: string;
    created_at: string;
    combo_name: string | null;
    combo_names: string[];
    combo_courses: string[];
    combo_details: string[];
    standalone_course_names: string[];
    course_names: string[];
    course_name: string | null;
    batch_name: string | null;
    batch_names: string[];
    total_fee: number;
    amount_paid: number;
    balance: number;
}

const getComboLabel = (student: StudentData) => {
    const comboNames = (student.combo_names || []).filter(Boolean);
    if (comboNames.length > 0) {
        return comboNames.join(', ');
    }
    return student.combo_name || '—';
};

const getCourseLabel = (student: StudentData) => {
    const standaloneCourses = (student.standalone_course_names || []).filter(Boolean);
    const comboCourses = (student.combo_courses || []).filter(Boolean);
    const allCourses = (student.course_names || []).filter(Boolean);
    const labels = [...new Set([...comboCourses, ...standaloneCourses])];

    if (labels.length > 0) {
        return labels.join(', ');
    }

    if (allCourses.length > 0) {
        return allCourses.join(', ');
    }

    return student.course_name || '—';
};

export function AdmissionReport() {
    const { user } = useAuth();
    const [sources, setSources] = useState<AdmissionSource[]>([]);
    const [references, setReferences] = useState<Reference[]>([]);
    const [students, setStudents] = useState<StudentData[]>([]);
    const [selectedSource, setSelectedSource] = useState('all');
    const [selectedReference, setSelectedReference] = useState('all');
    const [selectedSalesStaff, setSelectedSalesStaff] = useState('all');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            if (!user?.organizationId) return;
            setIsLoading(true);
            try {
                const [sourcesRes, referencesRes, studentsRes] = await Promise.all([
                    admissionSourceService.getSources(user.organizationId).catch(() => []),
                    referenceService.getReferences(user.organizationId).catch(() => []),
                    // Fetch students with all details including fees, course, and batch
                    reportService.getStudentDetails(user.organizationId, null).catch(() => [])
                ]);

                setSources(sourcesRes);
                setReferences(referencesRes);

                if (studentsRes && Array.isArray(studentsRes)) {
                    const uniqueSalesStaffIds = Array.from(new Set(
                        studentsRes
                            .map((p: StudentDetailRow) => p.sales_staff_id)
                            .filter((id): id is string => Boolean(id))
                    ));

                    let salesStaffNameMap = new Map<string, string>();
                    if (uniqueSalesStaffIds.length > 0) {
                        const { data: staffRows } = await supabase
                            .from('profiles')
                            .select('id, full_name')
                            .in('id', uniqueSalesStaffIds);

                        salesStaffNameMap = new Map(
                            (staffRows || []).map((row: any) => [row.id, row.full_name || 'Unknown'])
                        );
                    }

                    const formatted: StudentData[] = studentsRes.map((p: StudentDetailRow) => ({
                        id: p.id,
                        full_name: p.full_name,
                        email: p.email || '',
                        phone: p.phone || '',
                        created_at: p.admission_date,
                        admission_source: p.admission_source || 'Unknown',
                        reference: p.reference || '—',
                        sales_staff_id: p.sales_staff_id || null,
                        sales_staff_name: p.sales_staff_id
                            ? (salesStaffNameMap.get(p.sales_staff_id) || p.sales_staff_name || 'Unknown')
                            : '—',
                        blood_group: p.blood_group || '',
                        combo_name: p.combo_name || null,
                        combo_names: p.combo_names || [],
                        combo_courses: p.combo_courses || [],
                        combo_details: p.combo_details || [],
                        standalone_course_names: p.standalone_course_names || [],
                        course_names: p.course_names || [],
                        course_name: p.course_name,
                        batch_name: p.batch_name,
                        batch_names: p.batch_names || [],
                        total_fee: p.total_fee || 0,
                        amount_paid: p.amount_paid || 0,
                        balance: p.balance || 0,
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
        let filtered = students;
        if (selectedSource === 'unknown') {
            filtered = filtered.filter(s => !s.admission_source || s.admission_source === 'Unknown');
        } else if (selectedSource !== 'all') {
            filtered = filtered.filter(s => s.admission_source === selectedSource);
        }

        if (selectedReference === 'none') {
            filtered = filtered.filter(s => !s.reference || s.reference === '—');
        } else if (selectedReference !== 'all') {
            filtered = filtered.filter(s => s.reference === selectedReference);
        }

        if (selectedSalesStaff === 'none') {
            filtered = filtered.filter(s => !s.sales_staff_id || s.sales_staff_name === '—');
        } else if (selectedSalesStaff !== 'all') {
            filtered = filtered.filter(s => s.sales_staff_id === selectedSalesStaff);
        }

        return filtered;
    }, [students, selectedSource, selectedReference, selectedSalesStaff]);

    const salesStaffOptions = useMemo(() => {
        const staffMap = new Map<string, string>();
        students.forEach((s) => {
            if (s.sales_staff_id) {
                staffMap.set(s.sales_staff_id, s.sales_staff_name || 'Unknown');
            }
        });

        return Array.from(staffMap.entries())
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [students]);

    const exportCSV = () => {
        const headers = ['Date Added', 'Student Name', 'Contact', 'Combo', 'Courses', 'Batches', 'Total Fee', 'Fee Paid', 'Balance Amount', 'Admission Source', 'Reference', 'Sales Staff'];
        const rows = filteredStudents.map(s => [
            new Date(s.created_at).toLocaleDateString(),
            `"${s.full_name}"`,
            s.phone || '—',
            `"${getComboLabel(s)}"`,
            `"${getCourseLabel(s)}"`,
            `"${(s.batch_names.length > 0 ? s.batch_names : (s.batch_name ? [s.batch_name] : ['—'])).join(', ')}"`,
            s.total_fee.toString(),
            s.amount_paid.toString(),
            s.balance.toString(),
            `"${s.admission_source || 'Unknown'}"`,
            `"${s.reference || '—'}"`,
            `"${s.sales_staff_name || '—'}"`
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
              <th>Date Added</th>
              <th>Student Name</th>
              <th>Contact</th>
              <th>Combo</th>
              <th>Courses</th>
              <th>Batches</th>
              <th>Total Fee</th>
              <th>Fee Paid</th>
              <th>Balance</th>
              <th>Source</th>
              <th>Reference</th>
                            <th>Sales Staff</th>
            </tr>
          </thead>
          <tbody>
            ${filteredStudents.map(s => `
              <tr>
                <td>${new Date(s.created_at).toLocaleDateString()}</td>
                <td>${s.full_name}</td>
                <td>${s.phone || '—'}</td>
                <td>${getComboLabel(s)}</td>
                <td>${getCourseLabel(s)}</td>
                <td>${(s.batch_names.length > 0 ? s.batch_names : (s.batch_name ? [s.batch_name] : ['—'])).join(', ')}</td>
                <td>${s.total_fee}</td>
                <td>${s.amount_paid}</td>
                <td>${s.balance}</td>
                <td>${s.admission_source}</td>
                <td>${s.reference}</td>
                                <td>${s.sales_staff_name || '—'}</td>
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
                            <Select value={selectedReference} onValueChange={setSelectedReference}>
                                <SelectTrigger className="w-[180px]">
                                    <Filter className="w-4 h-4 mr-2" />
                                    <SelectValue placeholder="All References" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All References</SelectItem>
                                    {references.map(r => (
                                        <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>
                                    ))}
                                    <SelectItem value="none">No Reference</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={selectedSalesStaff} onValueChange={setSelectedSalesStaff}>
                                <SelectTrigger className="w-[200px]">
                                    <Filter className="w-4 h-4 mr-2" />
                                    <SelectValue placeholder="All Sales Staff" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Sales Staff</SelectItem>
                                    {salesStaffOptions.map((staff) => (
                                        <SelectItem key={staff.id} value={staff.id}>{staff.name}</SelectItem>
                                    ))}
                                    <SelectItem value="none">Unassigned</SelectItem>
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
                                    <TableHead>Date Added</TableHead>
                                    <TableHead>Student Name</TableHead>
                                    <TableHead>Contact</TableHead>
                                    <TableHead>Combo</TableHead>
                                    <TableHead>Courses</TableHead>
                                    <TableHead>Batches</TableHead>
                                    <TableHead className="text-right">Total Fee</TableHead>
                                    <TableHead className="text-right">Fee Paid</TableHead>
                                    <TableHead className="text-right">Balance</TableHead>
                                    <TableHead>Sales Staff</TableHead>
                                    <TableHead>Reference</TableHead>
                                    <TableHead>Source</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredStudents.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={12} className="h-32 text-center text-muted-foreground">
                                            No students found for this source.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredStudents.map((s) => (
                                        <TableRow key={s.id}>
                                            <TableCell className="text-muted-foreground text-sm">
                                                {new Date(s.created_at).toLocaleDateString()}
                                            </TableCell>
                                            <TableCell className="font-medium">{s.full_name}</TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    {s.phone && <span className="text-sm">{s.phone}</span>}
                                                    {s.email && <span className="text-xs text-muted-foreground">{s.email}</span>}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-sm">{getComboLabel(s)}</TableCell>
                                            <TableCell className="text-sm">{getCourseLabel(s)}</TableCell>
                                            <TableCell className="text-sm">{(s.batch_names.length > 0 ? s.batch_names : (s.batch_name ? [s.batch_name] : ['—'])).join(', ')}</TableCell>
                                            <TableCell className="text-right font-medium text-sm">₹{s.total_fee.toLocaleString('en-IN')}</TableCell>
                                            <TableCell className="text-right font-medium text-sm text-emerald-600">₹{s.amount_paid.toLocaleString('en-IN')}</TableCell>
                                            <TableCell className="text-right font-medium text-sm text-orange-600">₹{s.balance.toLocaleString('en-IN')}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline">{s.sales_staff_name || '—'}</Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="secondary">{s.reference}</Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline">{s.admission_source}</Badge>
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
