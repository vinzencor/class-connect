import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertCircle, CheckCircle, XCircle, RefreshCw, Database } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Tables } from '@/types/database';

type Profile = Tables<'profiles'>;
type Batch = Tables<'batches'>;

interface DiagnosticResult {
  student: Profile;
  batchId?: string;
  batchName?: string;
  legacyBatch?: string;
  camelCaseBatchId?: string;
  status: 'valid' | 'invalid' | 'missing' | 'legacy';
  message: string;
}

export default function BatchDiagnostics() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [students, setStudents] = useState<Profile[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([]);

  const runDiagnostics = async () => {
    if (!user?.organizationId) return;

    try {
      setIsLoading(true);

      // Fetch students
      const { data: studentsData, error: studentsError } = await supabase
        .from('profiles')
        .select('*')
        .eq('organization_id', user.organizationId)
        .eq('role', 'student')
        .order('full_name');

      if (studentsError) throw studentsError;

      // Fetch batches
      const { data: batchesData, error: batchesError } = await supabase
        .from('batches')
        .select('*')
        .eq('organization_id', user.organizationId);

      if (batchesError) throw batchesError;

      setStudents(studentsData || []);
      setBatches(batchesData || []);

      // Run diagnostics
      const results: DiagnosticResult[] = (studentsData || []).map((student) => {
        const metadata = student.metadata as any;
        const batchId = metadata?.batch_id;
        const legacyBatch = metadata?.batch;
        const camelCaseBatchId = metadata?.batchId;

        // Find matching batch
        const batch = (batchesData || []).find((b) => b.id === batchId);

        if (!batchId && !legacyBatch && !camelCaseBatchId) {
          return {
            student,
            status: 'missing',
            message: 'No batch assignment found',
          };
        }

        if (camelCaseBatchId && !batchId) {
          return {
            student,
            camelCaseBatchId,
            status: 'legacy',
            message: 'Using camelCase "batchId" - should be "batch_id"',
          };
        }

        if (legacyBatch && !batchId) {
          const legacyMatch = (batchesData || []).find(
            (b) => b.name.toLowerCase() === legacyBatch.toLowerCase()
          );
          return {
            student,
            legacyBatch,
            batchName: legacyMatch?.name,
            status: 'legacy',
            message: `Using legacy "batch" name format: "${legacyBatch}"`,
          };
        }

        if (batchId && !batch) {
          return {
            student,
            batchId,
            status: 'invalid',
            message: `Invalid batch ID: ${batchId} (batch not found)`,
          };
        }

        return {
          student,
          batchId,
          batchName: batch?.name,
          status: 'valid',
          message: `Correctly assigned to "${batch?.name}"`,
        };
      });

      setDiagnostics(results);
    } catch (error) {
      console.error('Error running diagnostics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    runDiagnostics();
  }, [user?.organizationId]);

  const stats = {
    total: diagnostics.length,
    valid: diagnostics.filter((d) => d.status === 'valid').length,
    missing: diagnostics.filter((d) => d.status === 'missing').length,
    invalid: diagnostics.filter((d) => d.status === 'invalid').length,
    legacy: diagnostics.filter((d) => d.status === 'legacy').length,
  };

  const getStatusIcon = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'valid':
        return <CheckCircle className="w-4 h-4 text-success" />;
      case 'missing':
        return <XCircle className="w-4 h-4 text-muted-foreground" />;
      case 'invalid':
        return <AlertCircle className="w-4 h-4 text-destructive" />;
      case 'legacy':
        return <AlertCircle className="w-4 h-4 text-warning" />;
    }
  };

  const getStatusBadge = (status: DiagnosticResult['status']) => {
    const variants = {
      valid: 'bg-success/10 text-success border-success/20',
      missing: 'bg-muted text-muted-foreground',
      invalid: 'bg-destructive/10 text-destructive border-destructive/20',
      legacy: 'bg-warning/10 text-warning border-warning/20',
    };

    return (
      <Badge variant="outline" className={variants[status]}>
        {status}
      </Badge>
    );
  };

  return (
    <Card className="border shadow-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Database className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Batch Assignment Diagnostics</CardTitle>
              <CardDescription>Verify batch assignments for all students</CardDescription>
            </div>
          </div>
          <Button onClick={runDiagnostics} disabled={isLoading} variant="outline" size="sm">
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total Students</p>
          </div>
          <div className="bg-success/10 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-success">{stats.valid}</p>
            <p className="text-xs text-muted-foreground">Valid</p>
          </div>
          <div className="bg-muted rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-muted-foreground">{stats.missing}</p>
            <p className="text-xs text-muted-foreground">Missing</p>
          </div>
          <div className="bg-destructive/10 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-destructive">{stats.invalid}</p>
            <p className="text-xs text-muted-foreground">Invalid</p>
          </div>
          <div className="bg-warning/10 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-warning">{stats.legacy}</p>
            <p className="text-xs text-muted-foreground">Legacy Format</p>
          </div>
        </div>

        {/* Alerts */}
        {stats.missing > 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Students Without Batch Assignment</AlertTitle>
            <AlertDescription>
              {stats.missing} student(s) have no batch assigned. Go to the Batches page to assign them.
            </AlertDescription>
          </Alert>
        )}

        {stats.legacy > 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Legacy Format Detected</AlertTitle>
            <AlertDescription>
              {stats.legacy} student(s) use old batch format. Run the migration script to normalize.
            </AlertDescription>
          </Alert>
        )}

        {stats.invalid > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Invalid Batch References</AlertTitle>
            <AlertDescription>
              {stats.invalid} student(s) reference non-existent batches. Please reassign them.
            </AlertDescription>
          </Alert>
        )}

        {/* Diagnostics Table */}
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Student</TableHead>
                <TableHead>Batch Assignment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Message</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {diagnostics.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    {isLoading ? 'Loading...' : 'No students found'}
                  </TableCell>
                </TableRow>
              ) : (
                diagnostics.map((result) => (
                  <TableRow key={result.student.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-foreground">{result.student.full_name}</p>
                        <p className="text-xs text-muted-foreground">{result.student.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {result.batchName ? (
                        <div>
                          <p className="font-medium">{result.batchName}</p>
                          <p className="text-xs text-muted-foreground font-mono">{result.batchId}</p>
                        </div>
                      ) : result.legacyBatch ? (
                        <p className="text-sm text-warning">{result.legacyBatch} (legacy)</p>
                      ) : result.camelCaseBatchId ? (
                        <p className="text-sm text-warning font-mono">{result.camelCaseBatchId}</p>
                      ) : (
                        <p className="text-muted-foreground">-</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(result.status)}
                        {getStatusBadge(result.status)}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {result.message}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Available Batches */}
        <div className="border-t pt-4">
          <p className="text-sm font-medium text-foreground mb-2">Available Batches:</p>
          <div className="flex flex-wrap gap-2">
            {batches.length === 0 ? (
              <p className="text-sm text-muted-foreground">No batches found</p>
            ) : (
              batches.map((batch) => (
                <Badge key={batch.id} variant="outline" className="font-mono text-xs">
                  {batch.name} ({batch.id})
                </Badge>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

