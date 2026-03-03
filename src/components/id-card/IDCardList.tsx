import React, { useState, useEffect, useMemo } from 'react';
import { Tables } from '@/types/database';
import { idCardService, TemplateDesignData, defaultTemplateDesign } from '@/services/idCardService';
import html2canvas from 'html2canvas';
import { IDCardPreview } from './IDCardPreview';
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
    XCircle,
    RefreshCw,
    CheckCircle2,
    Clock,
    Trash2,
} from 'lucide-react';

type Profile = Tables<'profiles'>;
type IdCard = Tables<'id_cards'>;

interface IDCardListProps {
    organizationId: string;
    organizationName: string;
    onRefresh?: () => void;
}

export function IDCardList({ organizationId, organizationName, onRefresh }: IDCardListProps) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [cards, setCards] = useState<(IdCard & { user: Profile })[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [templates, setTemplates] = useState<Tables<'id_card_templates'>[]>([]);

    const fetchCards = async () => {
        if (!organizationId || organizationId.trim() === '') {
            setLoading(false);
            return;
        }
        try {
            setLoading(true);
            const [cardsData, templatesData] = await Promise.all([
                idCardService.getIdCards(organizationId, {
                    role: roleFilter !== 'all' ? (roleFilter as 'admin' | 'faculty' | 'student') : undefined,
                    status: statusFilter !== 'all' ? statusFilter : undefined,
                    search: search || undefined,
                }),
                idCardService.getTemplates(organizationId),
            ]);
            setCards(cardsData);
            setTemplates(templatesData);
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
    }, [organizationId, roleFilter, statusFilter]);

    // Debounced search
    useEffect(() => {
        if (!organizationId || organizationId.trim() === '') return;
        const timeout = setTimeout(() => {
            fetchCards();
        }, 300);
        return () => clearTimeout(timeout);
    }, [search]);

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

                            {/* Card Preview */}
                            <div className="flex justify-center">
                                <IDCardPreview
                                    id={`id-card-${card.id}`}
                                    user={card.user}
                                    card={card}
                                    template={getTemplateDesign(card.template_id)}
                                    organizationName={organizationName}
                                    scale={0.8}
                                />
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
