import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Trash2, Plus, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { admissionSourceService, AdmissionSource } from '@/services/admissionSourceService';

interface AdmissionSourceManagerProps {
    organizationId: string;
    sources: AdmissionSource[];
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onSourcesChange: (sources: AdmissionSource[]) => void;
}

export function AdmissionSourceManager({ organizationId, sources, isOpen, onOpenChange, onSourcesChange }: AdmissionSourceManagerProps) {
    const [newSourceName, setNewSourceName] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const { toast } = useToast();

    const handleAdd = async () => {
        if (!newSourceName.trim()) return;
        try {
            setIsProcessing(true);
            const newSource = await admissionSourceService.addSource(organizationId, newSourceName);
            onSourcesChange([...sources, newSource].sort((a, b) => a.name.localeCompare(b.name)));
            setNewSourceName('');
            toast({ title: 'Success', description: 'Admission source added' });
        } catch (error: any) {
            toast({ title: 'Error', description: error.message || 'Failed to add source', variant: 'destructive' });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!window.confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) return;
        try {
            setIsProcessing(true);
            await admissionSourceService.deleteSource(id);
            onSourcesChange(sources.filter(s => s.id !== id));
            toast({ title: 'Success', description: 'Admission source deleted' });
        } catch (error: any) {
            toast({ title: 'Error', description: error.message || 'Failed to delete source', variant: 'destructive' });
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Manage Admission Sources</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-2">
                    <div className="flex items-center gap-2">
                        <Input
                            placeholder="E.g. Facebook, Referral, Walk-in"
                            value={newSourceName}
                            onChange={(e) => setNewSourceName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                        />
                        <Button onClick={handleAdd} disabled={isProcessing || !newSourceName.trim()}>
                            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                            <span className="sr-only">Add</span>
                        </Button>
                    </div>

                    <div className="border rounded-md divide-y max-h-[300px] overflow-y-auto">
                        {sources.length === 0 ? (
                            <div className="p-4 text-center text-sm text-muted-foreground">No sources configured yet.</div>
                        ) : (
                            sources.map(source => (
                                <div key={source.id} className="flex flex-row items-center justify-between p-3 px-4">
                                    <span className="text-sm font-medium">{source.name}</span>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(source.id, source.name)} disabled={isProcessing}>
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
