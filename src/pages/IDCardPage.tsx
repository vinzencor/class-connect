import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useBranch } from '@/contexts/BranchContext';
import { idCardService, defaultTemplateDesign, TemplateDesignData } from '@/services/idCardService';
import { batchService } from '@/services/batchService';
import { Tables } from '@/types/database';
import { IDCardDesigner, IDCardList, IDCardPreview, StudentIDCardPreview, BulkUploadDialog } from '@/components/id-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
    Loader2,
    CreditCard,
    Plus,
    Trash2,
    Palette,
    ChevronsUpDown,
    Users,
    Search,
    Upload,
    RotateCcw,
    Edit,
    Star,
} from 'lucide-react';
import { designationService, type Designation } from '@/services/designationService';

type Profile = Tables<'profiles'>;
type IdCardTemplate = Tables<'id_card_templates'>;
type Batch = Tables<'batches'>;

export default function IDCardPage() {
    const { user, profile, organization } = useAuth();
    const { currentBranchId } = useBranch();
    const { toast } = useToast();
    const isAdminUser = user?.role === 'admin' || user?.role === 'super_admin';
    const effectiveBranchId = isAdminUser
        ? (currentBranchId || null)
        : (currentBranchId || profile?.branch_id || user?.branchId || null);

    // State
    const [activeTab, setActiveTab] = useState('templates');
    const [loading, setLoading] = useState(true);
    const [templates, setTemplates] = useState<IdCardTemplate[]>([]);
    const [usersWithoutCards, setUsersWithoutCards] = useState<Profile[]>([]);
    const [batches, setBatches] = useState<Batch[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState<IdCardTemplate | null>(null);
    const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
    const [generating, setGenerating] = useState(false);
    const [showDesigner, setShowDesigner] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<IdCardTemplate | undefined>();
    const [showBulkUpload, setShowBulkUpload] = useState(false);
    const [roleFilter, setRoleFilter] = useState<string>('all');
    const [batchFilter, setBatchFilter] = useState<string>('all');
    const [deleteConfirm, setDeleteConfirm] = useState<IdCardTemplate | null>(null);
    const [previewSide, setPreviewSide] = useState<'front' | 'back'>('front');

    const [designations, setDesignations] = useState<Designation[]>([]);

    const organizationId = user?.organizationId || '';
    const organizationName = organization?.name || 'Organization';
    const organizationLogo = organization?.logo_url || '';
    const organizationWebsite = organization?.website || '';

    // Fetch data
    const fetchData = async () => {
        if (!organizationId || organizationId.trim() === '') {
            setLoading(false);
            return;
        }
        try {
            setLoading(true);
            const [templatesData, usersData, designationsData] = await Promise.all([
                idCardService.getTemplates(organizationId),
                idCardService.getUsersWithoutCards(
                    organizationId,
                    roleFilter !== 'all' ? (roleFilter as 'admin' | 'faculty' | 'student') : undefined,
                    effectiveBranchId
                ),
                designationService.getDesignations(organizationId),
            ]);
            setTemplates(templatesData);
            setDesignations(designationsData);

            // Apply batch filter if selected
            let filteredUsers = usersData;
            if (batchFilter !== 'all') {
                filteredUsers = usersData.filter((user) => {
                    const metadata = user.metadata as any;
                    return metadata?.batch_id === batchFilter;
                });
            }

            setUsersWithoutCards(filteredUsers);
        } catch (error: any) {
            toast({
                title: 'Error loading data',
                description: error.message,
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (organizationId && organizationId.trim() !== '') {
            fetchData();
            // Clear selected users when filters change
            setSelectedUsers(new Set());
        } else {
            setLoading(false);
        }
    }, [organizationId, roleFilter, batchFilter, effectiveBranchId]);

    // Fetch batches on mount / branch change
    useEffect(() => {
        const fetchBatches = async () => {
            if (organizationId && organizationId.trim() !== '') {
                try {
                    const batchesData = await batchService.getBatches(organizationId, effectiveBranchId);
                    setBatches(batchesData);
                } catch (error: any) {
                    console.error('Error loading batches:', error);
                }
            }
        };
        fetchBatches();
    }, [organizationId, effectiveBranchId]);

    // Handle template creation
    const handleNewTemplate = () => {
        setEditingTemplate(undefined);
        setShowDesigner(true);
    };

    const handleEditTemplate = (template: IdCardTemplate) => {
        setEditingTemplate(template);
        setShowDesigner(true);
    };

    const handleDeleteTemplate = async () => {
        if (!deleteConfirm) return;
        try {
            await idCardService.deleteTemplate(deleteConfirm.id);
            toast({ title: 'Template deleted' });
            setDeleteConfirm(null);
            fetchData();
        } catch (error: any) {
            toast({
                title: 'Error deleting template',
                description: error.message,
                variant: 'destructive',
            });
        }
    };

    // Handle card generation
    const handleSelectUser = (userId: string) => {
        const newSet = new Set(selectedUsers);
        if (newSet.has(userId)) {
            newSet.delete(userId);
        } else {
            newSet.add(userId);
        }
        setSelectedUsers(newSet);
    };

    const handleSelectAll = () => {
        if (selectedUsers.size === usersWithoutCards.length) {
            setSelectedUsers(new Set());
        } else {
            setSelectedUsers(new Set(usersWithoutCards.map((u) => u.id)));
        }
    };

    const handleGenerateCards = async () => {
        if (!organizationId || organizationId.trim() === '') {
            toast({ title: 'Organization not found', description: 'Please refresh the page or log in again.', variant: 'destructive' });
            return;
        }
        if (selectedUsers.size === 0) {
            toast({ title: 'Please select users', variant: 'destructive' });
            return;
        }

        try {
            setGenerating(true);
            const result = await idCardService.bulkGenerateIdCards(
                organizationId,
                Array.from(selectedUsers),
                selectedTemplate?.id || null,
                undefined,
                effectiveBranchId || null
            );

            toast({
                title: 'ID cards generated',
                description: `${result.success.length} cards created successfully. ${result.failed.length} failed.`,
            });

            setSelectedUsers(new Set());
            fetchData();
            setActiveTab('manage');
        } catch (error: any) {
            toast({
                title: 'Error generating cards',
                description: error.message,
                variant: 'destructive',
            });
        } finally {
            setGenerating(false);
        }
    };

    if (loading && templates.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">ID Card Generator</h1>
                    <p className="text-muted-foreground">
                        Design, generate, and manage ID cards for your organization
                    </p>
                </div>
            </div>

            {/* Main Content */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-4 lg:w-[500px]">
                    <TabsTrigger value="templates">
                        <Palette className="w-4 h-4 mr-2" />
                        Templates
                    </TabsTrigger>
                    <TabsTrigger value="generate">
                        <CreditCard className="w-4 h-4 mr-2" />
                        Generate
                    </TabsTrigger>
                    <TabsTrigger value="manage">
                        <Users className="w-4 h-4 mr-2" />
                        Manage
                    </TabsTrigger>
                    <TabsTrigger value="bulk">
                        <Upload className="w-4 h-4 mr-2" />
                        Bulk
                    </TabsTrigger>
                </TabsList>

                {/* Templates Tab */}
                <TabsContent value="templates" className="mt-6">
                    {showDesigner ? (
                        <Card>
                            <CardHeader>
                                <CardTitle>
                                    {editingTemplate ? 'Edit Template' : 'Create New Template'}
                                </CardTitle>
                                <CardDescription>
                                    Design your ID card template with custom colors and layout
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <IDCardDesigner
                                    organizationId={organizationId}
                                    organizationName={organizationName}
                                    organizationLogo={organizationLogo}
                                    organizationWebsite={organizationWebsite}
                                    createdBy={user?.id || ''}
                                    template={editingTemplate}
                                    onSave={() => {
                                        setShowDesigner(false);
                                        fetchData();
                                    }}
                                    onCancel={() => setShowDesigner(false)}
                                />
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex justify-end">
                                <Button onClick={handleNewTemplate}>
                                    <Plus className="w-4 h-4 mr-2" />
                                    New Template
                                </Button>
                            </div>

                            {templates.length === 0 ? (
                                <Card className="p-8 text-center">
                                    <Palette className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                                    <h3 className="text-lg font-semibold mb-2">No templates yet</h3>
                                    <p className="text-muted-foreground mb-4">
                                        Create your first ID card template to get started
                                    </p>
                                    <Button onClick={handleNewTemplate}>
                                        <Plus className="w-4 h-4 mr-2" />
                                        Create Template
                                    </Button>
                                </Card>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {templates.map((template) => {
                                        const design = (template.template_data as unknown as TemplateDesignData) || defaultTemplateDesign;
                                        return (
                                            <Card key={template.id} className="overflow-hidden">
                                                <div
                                                    className="h-32 flex items-center justify-center"
                                                    style={{ backgroundColor: design.backgroundColor }}
                                                >
                                                    <div className="text-center" style={{ color: design.textColor }}>
                                                        <p className="font-bold">{organizationName}</p>
                                                        
                                                    </div>
                                                </div>
                                                <CardContent className="p-4">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <h3 className="font-semibold">{template.name}</h3>
                                                        {template.is_default && (
                                                            <Badge variant="secondary">
                                                                <Star className="w-3 h-3 mr-1" />
                                                                Default
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-muted-foreground mb-4">
                                                        Created {new Date(template.created_at).toLocaleDateString()}
                                                    </p>
                                                    <div className="flex gap-2">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="flex-1"
                                                            onClick={() => handleEditTemplate(template)}
                                                        >
                                                            <Edit className="w-3 h-3 mr-1" />
                                                            Edit
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="text-destructive"
                                                            onClick={() => setDeleteConfirm(template)}
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </Button>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </TabsContent>

                {/* Generate Tab */}
                <TabsContent value="generate" className="mt-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* User Selection */}
                        <div className="lg:col-span-2 space-y-4">
                            <Card>
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <CardTitle>Select Batch & Users</CardTitle>
                                            <CardDescription>
                                                First select a batch, then choose users to generate ID cards for
                                            </CardDescription>
                                        </div>
                                        <div className="flex gap-2">
                                            <Select value={roleFilter} onValueChange={setRoleFilter}>
                                                <SelectTrigger className="w-[140px]">
                                                    <SelectValue placeholder="Filter role" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">All Roles</SelectItem>
                                                    <SelectItem value="student">Students</SelectItem>
                                                    <SelectItem value="faculty">Faculty</SelectItem>
                                                    <SelectItem value="admin">Admins</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {/* Batch Selection Dropdown */}
                                    <div>
                                        <label className="text-sm font-medium mb-2 block">
                                            Select Batch
                                        </label>
                                        <Select value={batchFilter} onValueChange={setBatchFilter}>
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="Choose a batch or view all" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Users (Admins, Faculty & Students)</SelectItem>
                                                {batches.map((batch) => (
                                                    <SelectItem key={batch.id} value={batch.id}>
                                                        {batch.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Show users list */}
                                    {usersWithoutCards.length === 0 ? (
                                        <div className="text-center py-8">
                                            <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                                            <p className="text-muted-foreground">
                                                {batchFilter === 'all' ? 'No users found' : 'All students in this batch already have ID cards'}
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-3 p-2 bg-muted rounded-lg">
                                                <Checkbox
                                                    checked={selectedUsers.size === usersWithoutCards.length}
                                                    onCheckedChange={handleSelectAll}
                                                />
                                                <span className="text-sm font-medium">
                                                    Select All ({usersWithoutCards.length} users)
                                                </span>
                                            </div>
                                            <div className="max-h-[400px] overflow-y-auto space-y-1">
                                                {usersWithoutCards.map((u) => (
                                                    <div
                                                        key={u.id}
                                                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted cursor-pointer"
                                                        onClick={() => handleSelectUser(u.id)}
                                                    >
                                                        <Checkbox
                                                            checked={selectedUsers.has(u.id)}
                                                            onCheckedChange={() => handleSelectUser(u.id)}
                                                        />
                                                        <div className="flex-1">
                                                            <p className="font-medium">{u.full_name}</p>
                                                            <p className="text-sm text-muted-foreground">{u.email}</p>
                                                        </div>
                                                        <Badge variant="outline" className="capitalize">
                                                            {u.role}
                                                        </Badge>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        {/* Settings & Preview */}
                        <div className="space-y-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Card Settings</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div>
                                        <label className="text-sm font-medium mb-2 block">
                                            Template
                                        </label>
                                        <Select
                                            value={selectedTemplate?.id || 'default'}
                                            onValueChange={(id) => {
                                                if (id === 'default') {
                                                    setSelectedTemplate(null);
                                                } else {
                                                    setSelectedTemplate(templates.find((t) => t.id === id) || null);
                                                }
                                            }}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select template" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="default">Default Template</SelectItem>
                                                {templates.map((t) => (
                                                    <SelectItem key={t.id} value={t.id}>
                                                        {t.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <Button
                                        className="w-full"
                                        disabled={selectedUsers.size === 0 || generating}
                                        onClick={handleGenerateCards}
                                    >
                                        {generating ? (
                                            <>
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                Generating...
                                            </>
                                        ) : (
                                            <>
                                                <CreditCard className="w-4 h-4 mr-2" />
                                                Generate {selectedUsers.size} Cards
                                            </>
                                        )}
                                    </Button>
                                </CardContent>
                            </Card>

                            {/* Preview */}
                            {selectedUsers.size > 0 && (
                                <Card>
                                    <CardHeader className="flex flex-row items-center justify-between">
                                        <CardTitle className="text-sm">Preview</CardTitle>
                                        <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => setPreviewSide(s => s === 'front' ? 'back' : 'front')}>
                                            <RotateCcw className="w-3 h-3" />
                                            {previewSide === 'front' ? 'Back' : 'Front'}
                                        </Button>
                                    </CardHeader>
                                    <CardContent className="flex justify-center">
                                        {(() => {
                                            const previewUser = usersWithoutCards.find((u) => selectedUsers.has(u.id)) || usersWithoutCards[0];
                                            const templateDesign = selectedTemplate
                                                ? (selectedTemplate.template_data as unknown as TemplateDesignData)
                                                : defaultTemplateDesign;
                                            const designationName = (() => {
                                                const did = previewUser?.designation_id;
                                                return did ? designations.find(d => d.id === did)?.name || '-' : '-';
                                            })();

                                            if (previewUser?.role === 'student') {
                                                const sd = (previewUser as any)._studentData;
                                                const batchId = ((previewUser.metadata as any)?.batch_id) || '';
                                                const batchName = batchId ? batches.find(b => b.id === batchId)?.name || '' : '';
                                                return (
                                                    <StudentIDCardPreview
                                                        user={previewUser}
                                                        template={templateDesign}
                                                        organizationName={organizationName}
                                                        organizationLogo={organizationLogo}
                                                        organizationWebsite={organizationWebsite}
                                                        studentData={{
                                                            bloodGroup: sd?.bloodGroup,
                                                            dateOfBirth: sd?.dateOfBirth,
                                                            fatherName: sd?.fatherName,
                                                            mobile: sd?.mobile,
                                                            batchName,
                                                        }}
                                                        scale={0.9}
                                                        side={previewSide}
                                                    />
                                                );
                                            }

                                            return (
                                                <IDCardPreview
                                                    user={previewUser}
                                                    template={templateDesign}
                                                    organizationName={organizationName}
                                                    organizationLogo={organizationLogo}
                                                    organizationWebsite={organizationWebsite}
                                                    designationName={designationName}
                                                    scale={0.9}
                                                    side={previewSide}
                                                />
                                            );
                                        })()}
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </div>
                </TabsContent>

                {/* Manage Tab */}
                <TabsContent value="manage" className="mt-6">
                    <IDCardList
                        organizationId={organizationId}
                        branchId={effectiveBranchId}
                        organizationName={organizationName}
                        organizationLogo={organizationLogo}
                        organizationWebsite={organizationWebsite}
                        onRefresh={fetchData}
                    />
                </TabsContent>

                {/* Bulk Upload Tab */}
                <TabsContent value="bulk" className="mt-6">
                    <Card className="p-8 text-center">
                        <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-2">Bulk Upload Students</h3>
                        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                            Upload a CSV file with student details to quickly generate ID cards for multiple students at once.
                        </p>
                        <Button onClick={() => setShowBulkUpload(true)}>
                            <Upload className="w-4 h-4 mr-2" />
                            Upload CSV File
                        </Button>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Bulk Upload Dialog */}
            <BulkUploadDialog
                open={showBulkUpload}
                onOpenChange={setShowBulkUpload}
                organizationId={organizationId}
                templateId={selectedTemplate?.id || null}
                onComplete={fetchData}
            />

            {/* Delete Confirmation Dialog */}
            <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Template</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete "{deleteConfirm?.name}"? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleDeleteTemplate}>
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >
    );
}
