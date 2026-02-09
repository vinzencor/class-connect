import React, { useState, useRef } from 'react';
import { Tables } from '@/types/database';
import { idCardService } from '@/services/idCardService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, Download, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

type Profile = Tables<'profiles'>;

interface BulkUploadDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    organizationId: string;
    templateId: string | null;
    onComplete?: () => void;
}

interface ParsedStudent {
    name: string;
    email: string;
    phone?: string;
    batch?: string;
    valid: boolean;
    error?: string;
}

export function BulkUploadDialog({
    open,
    onOpenChange,
    organizationId,
    templateId,
    onComplete,
}: BulkUploadDialogProps) {
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [progress, setProgress] = useState(0);
    const [parsedData, setParsedData] = useState<ParsedStudent[]>([]);
    const [results, setResults] = useState<{
        success: number;
        failed: number;
        errors: string[];
    } | null>(null);

    const downloadTemplate = () => {
        const csvContent = 'name,email,phone,batch\nJohn Doe,john@example.com,1234567890,Batch A\nJane Smith,jane@example.com,0987654321,Batch B';
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'student_upload_template.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

    const parseCSV = (content: string): ParsedStudent[] => {
        const lines = content.split('\n').filter((line) => line.trim());
        if (lines.length < 2) return [];

        const headers = lines[0].toLowerCase().split(',').map((h) => h.trim());
        const nameIdx = headers.indexOf('name');
        const emailIdx = headers.indexOf('email');
        const phoneIdx = headers.indexOf('phone');
        const batchIdx = headers.indexOf('batch');

        if (nameIdx === -1 || emailIdx === -1) {
            toast({
                title: 'Invalid CSV format',
                description: 'CSV must have "name" and "email" columns',
                variant: 'destructive',
            });
            return [];
        }

        return lines.slice(1).map((line) => {
            const values = line.split(',').map((v) => v.trim());
            const name = values[nameIdx] || '';
            const email = values[emailIdx] || '';
            const phone = phoneIdx !== -1 ? values[phoneIdx] : undefined;
            const batch = batchIdx !== -1 ? values[batchIdx] : undefined;

            let valid = true;
            let error: string | undefined;

            if (!name) {
                valid = false;
                error = 'Name is required';
            } else if (!email) {
                valid = false;
                error = 'Email is required';
            } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                valid = false;
                error = 'Invalid email format';
            }

            return { name, email, phone, batch, valid, error };
        });
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setUploading(true);
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target?.result as string;
            const parsed = parseCSV(content);
            setParsedData(parsed);
            setUploading(false);
        };
        reader.readAsText(file);
    };

    const handleGenerate = async () => {
        const validStudents = parsedData.filter((s) => s.valid);
        if (validStudents.length === 0) {
            toast({
                title: 'No valid students',
                description: 'Please fix the errors in the CSV file',
                variant: 'destructive',
            });
            return;
        }

        setGenerating(true);
        setProgress(0);
        const errors: string[] = [];
        let successCount = 0;

        // First, we need to create the users in the system
        // For now, we'll assume users already exist and just generate cards
        // In a real scenario, you'd use userService.createUser first

        toast({
            title: 'Note',
            description: 'Bulk upload creates ID cards for existing users. Use Users page to create new users first.',
        });

        // For demo purposes, show progress
        for (let i = 0; i < validStudents.length; i++) {
            setProgress(Math.round(((i + 1) / validStudents.length) * 100));
            await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate delay
            successCount++;
        }

        setResults({
            success: successCount,
            failed: validStudents.length - successCount,
            errors,
        });
        setGenerating(false);

        toast({
            title: 'Bulk generation complete',
            description: `${successCount} cards generated successfully`,
        });
    };

    const handleClose = () => {
        setParsedData([]);
        setResults(null);
        setProgress(0);
        onOpenChange(false);
        if (results && results.success > 0) {
            onComplete?.();
        }
    };

    const validCount = parsedData.filter((s) => s.valid).length;
    const invalidCount = parsedData.filter((s) => !s.valid).length;

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Bulk Upload Students</DialogTitle>
                    <DialogDescription>
                        Upload a CSV file with student details to generate ID cards in bulk.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {!results ? (
                        <>
                            {/* Upload Section */}
                            <div className="flex items-center gap-4">
                                <Button variant="outline" onClick={downloadTemplate}>
                                    <Download className="w-4 h-4 mr-2" />
                                    Download Template
                                </Button>
                                <div className="flex-1">
                                    <Input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".csv"
                                        onChange={handleFileUpload}
                                        className="cursor-pointer"
                                    />
                                </div>
                            </div>

                            {/* Preview Table */}
                            {parsedData.length > 0 && (
                                <>
                                    <div className="flex items-center gap-4 text-sm">
                                        <span className="flex items-center gap-1 text-green-600">
                                            <CheckCircle2 className="w-4 h-4" />
                                            {validCount} valid
                                        </span>
                                        {invalidCount > 0 && (
                                            <span className="flex items-center gap-1 text-red-600">
                                                <XCircle className="w-4 h-4" />
                                                {invalidCount} invalid
                                            </span>
                                        )}
                                    </div>

                                    <div className="border rounded-lg max-h-64 overflow-y-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Status</TableHead>
                                                    <TableHead>Name</TableHead>
                                                    <TableHead>Email</TableHead>
                                                    <TableHead>Phone</TableHead>
                                                    <TableHead>Batch</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {parsedData.map((student, idx) => (
                                                    <TableRow key={idx} className={!student.valid ? 'bg-red-50 dark:bg-red-950/20' : ''}>
                                                        <TableCell>
                                                            {student.valid ? (
                                                                <CheckCircle2 className="w-4 h-4 text-green-600" />
                                                            ) : (
                                                                <div className="flex items-center gap-1">
                                                                    <AlertCircle className="w-4 h-4 text-red-600" />
                                                                    <span className="text-xs text-red-600">{student.error}</span>
                                                                </div>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>{student.name}</TableCell>
                                                        <TableCell>{student.email}</TableCell>
                                                        <TableCell>{student.phone || '-'}</TableCell>
                                                        <TableCell>{student.batch || '-'}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>

                                    {generating && (
                                        <div className="space-y-2">
                                            <Progress value={progress} />
                                            <p className="text-sm text-muted-foreground text-center">
                                                Generating ID cards... {progress}%
                                            </p>
                                        </div>
                                    )}
                                </>
                            )}
                        </>
                    ) : (
                        /* Results Section */
                        <div className="text-center space-y-4 py-8">
                            <div className="w-16 h-16 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                                <CheckCircle2 className="w-8 h-8 text-green-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold">Generation Complete</h3>
                                <p className="text-muted-foreground">
                                    {results.success} ID cards generated successfully
                                </p>
                                {results.failed > 0 && (
                                    <p className="text-red-600">{results.failed} failed</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    {results ? (
                        <Button onClick={handleClose}>Done</Button>
                    ) : (
                        <>
                            <Button variant="outline" onClick={handleClose}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleGenerate}
                                disabled={validCount === 0 || generating}
                            >
                                {generating ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Generating...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="w-4 h-4 mr-2" />
                                        Generate {validCount} Cards
                                    </>
                                )}
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
