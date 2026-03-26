import React, { useState, useEffect, useMemo } from 'react';
import { Tables } from '@/types/database';
import { idCardService, TemplateDesignData, defaultTemplateDesign } from '@/services/idCardService';
import { designationService, type Designation } from '@/services/designationService';
import { batchService } from '@/services/batchService';
import html2canvas from 'html2canvas';
import { IDCardPreview } from './IDCardPreview';
import { StudentIDCardPreview } from './StudentIDCardPreview';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import {
    Loader2,
    Search,
    MoreVertical,
    Download,
    Nfc,
    XCircle,
    RefreshCw,
    CheckCircle2,
    Clock,
    Trash2,
    RotateCcw,
} from 'lucide-react';

type Profile = Tables<'profiles'>;
type IdCard = Tables<'id_cards'>;
type Batch = Tables<'batches'>;

interface IDCardListProps {
    organizationId: string;
    branchId?: string | null;
    organizationName: string;
    organizationLogo?: string;
    organizationWebsite?: string;
    onRefresh?: () => void;
}

export function IDCardList({ organizationId, branchId, organizationName, organizationLogo, organizationWebsite, onRefresh }: IDCardListProps) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [cards, setCards] = useState<(IdCard & { user: Profile })[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [templates, setTemplates] = useState<Tables<'id_card_templates'>[]>([]);
    const [designations, setDesignations] = useState<Designation[]>([]);
    const [batches, setBatches] = useState<Batch[]>([]);
    const [cardSides, setCardSides] = useState<Record<string, 'front' | 'back'>>({});

    const fetchCards = async () => {
        if (!organizationId || organizationId.trim() === '') {
            setLoading(false);
            return;
        }
        try {
            setLoading(true);
            const [cardsData, templatesData, designationsData, batchesData] = await Promise.all([
                idCardService.getIdCards(organizationId, {
                    role: roleFilter !== 'all' ? (roleFilter as 'admin' | 'faculty' | 'student') : undefined,
                    status: statusFilter !== 'all' ? statusFilter : undefined,
                    search: search || undefined,
                    branchId: branchId || undefined,
                }),
                idCardService.getTemplates(organizationId),
                designationService.getDesignations(organizationId),
                batchService.getBatches(organizationId, branchId),
            ]);
            setCards(cardsData);
            setTemplates(templatesData);
            setDesignations(designationsData);
            setBatches(batchesData);
        } catch (error: any) {
            toast({
                title: 'Error fetching ID cards',
                description: error.message,
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (organizationId && organizationId.trim() !== '') {
            fetchCards();
        } else {
            setLoading(false);
        }
    }, [organizationId, roleFilter, statusFilter, branchId]);

    // Debounced search
    useEffect(() => {
        if (!organizationId || organizationId.trim() === '') return;
        const timeout = setTimeout(() => {
            fetchCards();
        }, 300);
        return () => clearTimeout(timeout);
    }, [search, branchId]);

    const handleSelectAll = () => {
        if (selectedIds.size === cards.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(cards.map((c) => c.id)));
        }
    };

    const handleSelect = (id: string) => {
        const newIds = new Set(selectedIds);
        if (newIds.has(id)) {
            newIds.delete(id);
        } else {
            newIds.add(id);
        }
        setSelectedIds(newIds);
    };

    const handleRevoke = async (cardId: string) => {
        try {
            await idCardService.revokeIdCard(cardId);
            toast({ title: 'ID card revoked' });
            fetchCards();
        } catch (error: any) {
            toast({
                title: 'Error revoking card',
                description: error.message,
                variant: 'destructive',
            });
        }
    };

    const handleReactivate = async (cardId: string) => {
        try {
            await idCardService.reactivateIdCard(cardId);
            toast({ title: 'ID card reactivated' });
            fetchCards();
        } catch (error: any) {
            toast({
                title: 'Error reactivating card',
                description: error.message,
                variant: 'destructive',
            });
        }
    };

    const handleDelete = async (cardId: string) => {
        try {
            await idCardService.deleteIdCard(cardId);
            toast({ title: 'ID card deleted' });
            fetchCards();
            onRefresh?.();
        } catch (error: any) {
            toast({
                title: 'Error deleting card',
                description: error.message,
                variant: 'destructive',
            });
        }
    };

    const handleDownload = async (card: IdCard & { user: Profile }) => {
        const elementId = `id-card-${card.id}`;
        const element = document.getElementById(elementId);

        if (!element) {
            toast({ title: 'Download failed', description: 'Could not find the ID card to capture.', variant: 'destructive' });
            return;
        }

        try {
            toast({ title: 'Download initiated', description: `Generating high-quality image for ${card.user.full_name}...` });

            const canvas = await html2canvas(element, {
                scale: 4,
                useCORS: true,
                backgroundColor: null,
                logging: false
            });

            const dataUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = `ID-Card-${card.user.full_name.replace(/\s+/g, '-')}.png`;
            link.href = dataUrl;
            link.click();

            toast({ title: 'Download complete', description: `Successfully downloaded card for ${card.user.full_name}` });
        } catch (error) {
            console.error('Download error:', error);
            toast({ title: 'Download failed', description: 'There was an error generating the ID card image.', variant: 'destructive' });
        }
    };

    const normalizeToNineDigitId = (value: string | null | undefined): string | null => {
        if (!value) return null;
        const digits = value.replace(/\D/g, '');
        if (digits.length < 9) return null;
        if (digits.length === 9) return digits;
        // Some readers return 10+ digits; keep the right-most 9 digits used by the app.
        return digits.slice(-9);
    };

    const sanitizeNineDigitId = (value: string | null | undefined): string | null => {
        const normalized = normalizeToNineDigitId(value);
        return normalized && /^\d{9}$/.test(normalized) ? normalized : null;
    };

    const extractNineDigitId = (value: string | null | undefined): string | null => {
        return normalizeToNineDigitId(value);
    };

    const extractRawDigits = (value: string | null | undefined): string => {
        if (!value) return '';
        return value.replace(/\D/g, '');
    };

    const writeRfidViaSerial = async (payload: string, preferredPort?: any): Promise<string> => {
        const serialApi = (navigator as Navigator & { serial?: any }).serial;
        if (!serialApi) {
            throw new Error('Web Serial is not available in this browser. Please use Chrome/Edge over HTTPS.');
        }

        const openCandidatePort = async (candidatePort: any): Promise<{ port: any; wasAlreadyOpen: boolean; openedNow: boolean; error?: string } | null> => {
            const wasAlreadyOpen = !!(candidatePort.readable || candidatePort.writable);
            if (wasAlreadyOpen) {
                return { port: candidatePort, wasAlreadyOpen: true, openedNow: false };
            }

            const baudRates = [9600, 115200];
            let lastError = '';
            for (const baudRate of baudRates) {
                try {
                    await candidatePort.open({ baudRate, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none' });
                    return { port: candidatePort, wasAlreadyOpen: false, openedNow: true };
                } catch (error: any) {
                    lastError = error?.message || String(error);
                    await new Promise((resolve) => setTimeout(resolve, 120));
                }
            }

            return { port: candidatePort, wasAlreadyOpen: false, openedNow: false, error: lastError || 'Unknown open error' };
        };

        const grantedPorts = typeof serialApi.getPorts === 'function' ? await serialApi.getPorts() : [];
        let openedPort: any = null;
        let wasAlreadyOpen = false;
        let openedNow = false;
        const openErrors: string[] = [];

        const candidatePorts = preferredPort ? [preferredPort, ...grantedPorts.filter((p: any) => p !== preferredPort)] : grantedPorts;

        for (const candidatePort of candidatePorts) {
            const openResult = await openCandidatePort(candidatePort);
            if (openResult?.openedNow || openResult?.wasAlreadyOpen) {
                openedPort = openResult.port;
                wasAlreadyOpen = openResult.wasAlreadyOpen;
                openedNow = openResult.openedNow;
                break;
            }
            if (openResult?.error) {
                openErrors.push(openResult.error);
            }
        }

        if (!openedPort && !preferredPort) {
            try {
                const requestedPort = await serialApi.requestPort();
                const openResult = await openCandidatePort(requestedPort);
                if (openResult?.openedNow || openResult?.wasAlreadyOpen) {
                    openedPort = openResult.port;
                    wasAlreadyOpen = openResult.wasAlreadyOpen;
                    openedNow = openResult.openedNow;
                } else if (openResult?.error) {
                    openErrors.push(openResult.error);
                }
            } catch (requestError: any) {
                openErrors.push(requestError?.message || 'Port selection was cancelled.');
            }
        }

        if (!openedPort) {
            const reason = openErrors.filter(Boolean).slice(-2).join(' | ');
            throw new Error(
                `Failed to open serial port. ${reason ? `Reason: ${reason}. ` : ''}Close other apps using the RFID device, reconnect the reader, and try again.`
            );
        }

        try {
            const writer = openedPort.writable?.getWriter();
            if (!writer) {
                throw new Error('RFID writer port is not writable.');
            }

            await writer.write(new TextEncoder().encode(`${payload}\n`));
            writer.releaseLock();

            if (!openedPort.readable) {
                return '';
            }

            const reader = openedPort.readable.getReader();
            const decoder = new TextDecoder();
            const startedAt = Date.now();
            const timeoutMs = 6000;
            let collected = '';

            try {
                while (Date.now() - startedAt < timeoutMs) {
                    const chunkResult = await Promise.race([
                        reader.read(),
                        new Promise<null>((resolve) => setTimeout(() => resolve(null), 600)),
                    ]);

                    if (!chunkResult) {
                        continue;
                    }

                    if (!('value' in chunkResult)) {
                        continue;
                    }

                    if (chunkResult.done) {
                        break;
                    }

                    const chunkText = chunkResult.value ? decoder.decode(chunkResult.value, { stream: true }) : '';
                    if (!chunkText) {
                        continue;
                    }

                    collected += chunkText;
                    const maybeId = extractNineDigitId(collected);
                    if (maybeId) {
                        return maybeId;
                    }
                }
            } finally {
                reader.releaseLock();
            }

            return collected.trim();
        } finally {
            if (openedNow && !wasAlreadyOpen && (openedPort.readable || openedPort.writable)) {
                try {
                    await openedPort.close();
                } catch {
                    // Ignore close failures from transient disconnect/driver state.
                }
            }
        }
    };

    const handleWriteCard = async (card: IdCard & { user: Profile }) => {
        try {
            const serialApi = (navigator as Navigator & { serial?: any }).serial;
            let preferredPort: any = null;
            if (serialApi) {
                const grantedPorts = typeof serialApi.getPorts === 'function' ? await serialApi.getPorts() : [];
                if (grantedPorts.length === 0) {
                    // Must be requested directly in the click gesture path.
                    preferredPort = await serialApi.requestPort();
                }
            }

            const targetNfcId =
                sanitizeNineDigitId(card.user?.nfc_id) ||
                sanitizeNineDigitId(card.nfc_id);

            if (!targetNfcId) {
                throw new Error('RFID/NFC ID is missing for this user. Set an exact 9-digit RFID in Users page first.');
            }

            toast({
                title: 'Write card started',
                description: `Place the card on the device. Writing NFC ID ${targetNfcId} for ${card.user.full_name}...`,
            });

            // Device expects a 9-digit payload that should be written to the NFC card.
            const payload = targetNfcId;

            const writerResponse = await writeRfidViaSerial(payload, preferredPort);
            const responseNfcId = extractNineDigitId(writerResponse);
            const rawReaderValue = extractRawDigits(writerResponse);
            if (!responseNfcId) {
                throw new Error(`Writer did not return card data for verification${rawReaderValue ? ` (raw: ${rawReaderValue})` : ''}. Card was not updated.`);
            }

            if (responseNfcId !== targetNfcId) {
                throw new Error(
                    `Card verification failed. Reader returned ${rawReaderValue || responseNfcId}, expected ${targetNfcId}. This card/reader appears read-only or not using write mode.`
                );
            }

            const savedNfcId = targetNfcId;
            await idCardService.updateCardNfcId(card.id, card.user.id, savedNfcId);

            toast({
                title: 'Card written successfully',
                description: `Exact user RFID/NFC ID ${savedNfcId} written and saved.`,
            });
            fetchCards();
        } catch (error: any) {
            console.error('RFID write error:', error);

            toast({
                title: 'Write card failed',
                description: error.message || 'Could not write/read RFID card automatically. Place card firmly and try again.',
                variant: 'destructive',
            });
        }
    };

    const handleBulkDownload = async () => {
        const selectedCards = cards.filter((c) => selectedIds.has(c.id));
        if (selectedCards.length === 0) return;

        toast({
            title: 'Bulk download initiated',
            description: `Processing ${selectedCards.length} cards. This may take a moment.`,
        });

        let successCount = 0;
        let failCount = 0;

        for (const card of selectedCards) {
            try {
                const elementId = `id-card-${card.id}`;
                const element = document.getElementById(elementId);
                if (element) {
                    const canvas = await html2canvas(element, { scale: 4, useCORS: true, backgroundColor: null, logging: false });
                    const dataUrl = canvas.toDataURL('image/png');
                    const link = document.createElement('a');
                    link.download = `ID-Card-${card.user.full_name.replace(/\s+/g, '-')}.png`;
                    link.href = dataUrl;
                    link.click();
                    successCount++;
                    await new Promise(resolve => setTimeout(resolve, 300));
                } else {
                    failCount++;
                }
            } catch (error) {
                console.error('Error downloading card for', card.user.full_name, error);
                failCount++;
            }
        }

        toast({
            title: 'Bulk download complete',
            description: `Successfully downloaded ${successCount} cards. ${failCount > 0 ? `Failed: ${failCount}` : ''}`,
            variant: failCount > 0 ? 'destructive' : 'default',
        });
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'active':
                return (
                    <Badge variant="default" className="bg-green-600">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Active
                    </Badge>
                );
            case 'revoked':
                return (
                    <Badge variant="destructive">
                        <XCircle className="w-3 h-3 mr-1" />
                        Revoked
                    </Badge>
                );
            case 'expired':
                return (
                    <Badge variant="secondary">
                        <Clock className="w-3 h-3 mr-1" />
                        Expired
                    </Badge>
                );
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    const getRoleBadge = (role: string) => {
        const colors: Record<string, string> = {
            admin: 'bg-purple-600',
            faculty: 'bg-blue-600',
            student: 'bg-indigo-600',
        };
        return (
            <Badge className={colors[role] || 'bg-gray-600'}>
                {role.charAt(0).toUpperCase() + role.slice(1)}
            </Badge>
        );
    };

    const getTemplateDesign = (templateId: string | null): TemplateDesignData => {
        if (!templateId) return defaultTemplateDesign;
        const template = templates.find((t) => t.id === templateId);
        return (template?.template_data as unknown as TemplateDesignData) || defaultTemplateDesign;
    };

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-4 items-center">
                <div className="flex-1 min-w-[200px]">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by name, card number, or NFC ID..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                </div>

                <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Role" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Roles</SelectItem>
                        <SelectItem value="student">Students</SelectItem>
                        <SelectItem value="faculty">Faculty</SelectItem>
                        <SelectItem value="admin">Admins</SelectItem>
                    </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="revoked">Revoked</SelectItem>
                        <SelectItem value="expired">Expired</SelectItem>
                    </SelectContent>
                </Select>

                <Button variant="outline" size="icon" onClick={fetchCards}>
                    <RefreshCw className="w-4 h-4" />
                </Button>
            </div>

            {/* Bulk Actions */}
            {selectedIds.size > 0 && (
                <div className="flex items-center gap-4 p-3 bg-muted rounded-lg">
                    <span className="text-sm font-medium">{selectedIds.size} selected</span>
                    <Button size="sm" variant="outline" onClick={handleBulkDownload}>
                        <Download className="w-4 h-4 mr-2" />
                        Download Selected
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                        Clear Selection
                    </Button>
                </div>
            )}

            {/* Cards Grid */}
            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
            ) : cards.length === 0 ? (
                <div className="text-center py-16">
                    <p className="text-muted-foreground">No ID cards found</p>
                    <p className="text-sm text-muted-foreground mt-1">
                        Generate ID cards from the "Generate" tab
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {cards.map((card) => (
                        <div
                            key={card.id}
                            className="bg-card rounded-xl border p-4 space-y-4 hover:shadow-lg transition-shadow"
                        >
                            {/* Header with checkbox and actions */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Checkbox
                                        checked={selectedIds.has(card.id)}
                                        onCheckedChange={() => handleSelect(card.id)}
                                    />
                                    <div>
                                        <p className="font-medium">{card.user?.full_name || 'Unknown'}</p>
                                        <p className="text-sm text-muted-foreground">{card.card_number}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => setCardSides(prev => ({ ...prev, [card.id]: prev[card.id] === 'back' ? 'front' : 'back' }))}
                                        title={cardSides[card.id] === 'back' ? 'Show front' : 'Show back'}
                                    >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                    </Button>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon">
                                            <MoreVertical className="w-4 h-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => handleDownload(card)}>
                                            <Download className="w-4 h-4 mr-2" />
                                            Download
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleWriteCard(card)}>
                                            <Nfc className="w-4 h-4 mr-2" />
                                            Write Card
                                        </DropdownMenuItem>
                                        {card.status === 'active' ? (
                                            <DropdownMenuItem
                                                onClick={() => handleRevoke(card.id)}
                                                className="text-destructive"
                                            >
                                                <XCircle className="w-4 h-4 mr-2" />
                                                Revoke
                                            </DropdownMenuItem>
                                        ) : (
                                            <DropdownMenuItem onClick={() => handleReactivate(card.id)}>
                                                <RefreshCw className="w-4 h-4 mr-2" />
                                                Reactivate
                                            </DropdownMenuItem>
                                        )}
                                        <DropdownMenuItem
                                            onClick={() => handleDelete(card.id)}
                                            className="text-destructive"
                                        >
                                            <Trash2 className="w-4 h-4 mr-2" />
                                            Delete
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>

                            {/* Card Preview */}
                            <div className="flex justify-center">
                                {card.user?.role === 'student' ? (
                                    <StudentIDCardPreview
                                        id={`id-card-${card.id}`}
                                        user={card.user}
                                        card={card}
                                        template={getTemplateDesign(card.template_id)}
                                        organizationName={organizationName}
                                        organizationLogo={organizationLogo}
                                        organizationWebsite={organizationWebsite}
                                        studentData={(() => {
                                            const sd = (card as any)._studentData;
                                            const batchId = ((card.user?.metadata as any)?.batch_id) || '';
                                            const batchName = batchId ? batches.find(b => b.id === batchId)?.name || '' : '';
                                            return {
                                                bloodGroup: sd?.bloodGroup,
                                                dateOfBirth: sd?.dateOfBirth,
                                                fatherName: sd?.fatherName,
                                                mobile: sd?.mobile,
                                                batchName,
                                            };
                                        })()}
                                        scale={0.8}
                                        side={cardSides[card.id] || 'front'}
                                    />
                                ) : (
                                    <IDCardPreview
                                        id={`id-card-${card.id}`}
                                        user={card.user}
                                        card={card}
                                        template={getTemplateDesign(card.template_id)}
                                        organizationName={organizationName}
                                        organizationLogo={organizationLogo}
                                        organizationWebsite={organizationWebsite}
                                        designationName={card.user?.designation_id ? designations.find(d => d.id === card.user.designation_id)?.name || '-' : '-'}
                                        scale={0.8}
                                        side={cardSides[card.id] || 'front'}
                                    />
                                )}
                            </div>

                            {/* Card Info */}
                            <div className="flex items-center justify-between">
                                <div className="flex gap-2">
                                    {getRoleBadge(card.user?.role || 'student')}
                                    {getStatusBadge(card.status)}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Expires: {card.expiry_date ? new Date(card.expiry_date).toLocaleDateString() : 'N/A'}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
