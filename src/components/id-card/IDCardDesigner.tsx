import React, { useState, useEffect } from 'react';
import { Tables } from '@/types/database';
import { idCardService, TemplateDesignData, defaultTemplateDesign } from '@/services/idCardService';
import { IDCardPreview } from './IDCardPreview';
import { StudentIDCardPreview } from './StudentIDCardPreview';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Palette, Layout, RotateCcw, Users, GraduationCap } from 'lucide-react';

type Profile = Tables<'profiles'>;

interface IDCardDesignerProps {
    organizationId: string;
    organizationName: string;
    organizationLogo?: string;
    organizationWebsite?: string;
    organizationAddress?: string;
    organizationPhone?: string;
    createdBy: string;
    template?: Tables<'id_card_templates'>;
    onSave?: () => void;
    onCancel?: () => void;
}

export function IDCardDesigner({
    organizationId,
    organizationName,
    organizationLogo,
    organizationWebsite,
    organizationAddress,
    organizationPhone,
    createdBy,
    template,
    onSave,
    onCancel,
}: IDCardDesignerProps) {
    const { toast } = useToast();
    const [saving, setSaving] = useState(false);
    const [templateName, setTemplateName] = useState(template?.name || 'New Template');
    const [isDefault, setIsDefault] = useState(template?.is_default || false);
    const [design, setDesign] = useState<TemplateDesignData>(
        (template?.template_data as unknown as TemplateDesignData) || defaultTemplateDesign
    );
    const [previewCardType, setPreviewCardType] = useState<'staff' | 'student'>(
        ((template?.template_data as unknown as TemplateDesignData)?.cardType) || 'staff'
    );
    const [previewSide, setPreviewSide] = useState<'front' | 'back'>('front');

    // Sample user for preview
    const sampleUser: Profile = {
        id: 'sample',
        organization_id: organizationId,
        branch_id: null,
        email: 'john.doe@example.com',
        full_name: 'John Doe',
        short_name: null,
        role: 'student',
        role_id: null,
        avatar_url: null,
        phone: null,
        nfc_id: 'NFC-SAMPLE-1234',
        designation_id: null,
        is_active: true,
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };

    const sampleCard = {
        id: 'sample',
        organization_id: organizationId,
        user_id: 'sample',
        template_id: null,
        nfc_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        card_number: 'CC-2026-00001',
        issued_date: new Date().toISOString(),
        expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'active' as const,
        card_image_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };

    const updateDesign = (updates: Partial<TemplateDesignData>) => {
        setDesign((prev) => ({ ...prev, ...updates }));
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            const finalDesign = { ...design, cardType: previewCardType };

            if (template) {
                await idCardService.updateTemplate(template.id, {
                    name: templateName,
                    template_data: finalDesign,
                    is_default: isDefault,
                });
                toast({ title: 'Template updated successfully' });
            } else {
                await idCardService.createTemplate(
                    organizationId,
                    templateName,
                    finalDesign,
                    createdBy,
                    isDefault
                );
                toast({ title: 'Template created successfully' });
            }

            onSave?.();
        } catch (error: any) {
            toast({
                title: 'Error saving template',
                description: error.message,
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Designer Controls */}
            <div className="space-y-4">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg">Template Settings</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Template Name</Label>
                            <Input
                                value={templateName}
                                onChange={(e) => setTemplateName(e.target.value)}
                                placeholder="Enter template name"
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <Label>Set as Default</Label>
                            <Switch checked={isDefault} onCheckedChange={setIsDefault} />
                        </div>
                    </CardContent>
                </Card>

                <Tabs defaultValue="colors" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="colors">
                            <Palette className="w-4 h-4 mr-2" />
                            Colors
                        </TabsTrigger>
                        <TabsTrigger value="layout">
                            <Layout className="w-4 h-4 mr-2" />
                            Layout
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="colors" className="mt-4">
                        <Card>
                            <CardContent className="pt-4 space-y-4">
                                <div className="space-y-2">
                                    <Label>Background Color</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            type="color"
                                            value={design.backgroundColor}
                                            onChange={(e) => updateDesign({ backgroundColor: e.target.value })}
                                            className="w-12 h-10 p-1 cursor-pointer"
                                        />
                                        <Input
                                            value={design.backgroundColor}
                                            onChange={(e) => updateDesign({ backgroundColor: e.target.value })}
                                            placeholder="#000000"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Text Color</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            type="color"
                                            value={design.textColor}
                                            onChange={(e) => updateDesign({ textColor: e.target.value })}
                                            className="w-12 h-10 p-1 cursor-pointer"
                                        />
                                        <Input
                                            value={design.textColor}
                                            onChange={(e) => updateDesign({ textColor: e.target.value })}
                                            placeholder="#ffffff"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Accent Color</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            type="color"
                                            value={design.accentColor}
                                            onChange={(e) => updateDesign({ accentColor: e.target.value })}
                                            className="w-12 h-10 p-1 cursor-pointer"
                                        />
                                        <Input
                                            value={design.accentColor}
                                            onChange={(e) => updateDesign({ accentColor: e.target.value })}
                                            placeholder="#4f46e5"
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="layout" className="mt-4">
                        <Card>
                            <CardContent className="pt-4 space-y-4">
                                <div className="flex items-center justify-between">
                                    <Label>Show Logo</Label>
                                    <Switch
                                        checked={design.showLogo}
                                        onCheckedChange={(checked) => updateDesign({ showLogo: checked })}
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <Label>Show Photo</Label>
                                    <Switch
                                        checked={design.showPhoto}
                                        onCheckedChange={(checked) => updateDesign({ showPhoto: checked })}
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <Label>Show Designation</Label>
                                    <Switch
                                        checked={design.showDesignation ?? true}
                                        onCheckedChange={(checked) => updateDesign({ showDesignation: checked })}
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <Label>Show NFC Indicator</Label>
                                    <Switch
                                        checked={design.showNFCId}
                                        onCheckedChange={(checked) => updateDesign({ showNFCId: checked })}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>

                <div className="flex gap-3">
                    <Button variant="outline" onClick={onCancel} className="flex-1">
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={saving} className="flex-1">
                        {saving ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4 mr-2" />
                                Save Template
                            </>
                        )}
                    </Button>
                </div>
            </div>

            {/* Live Preview */}
            <div className="flex flex-col items-center justify-start pt-4">
                <h3 className="text-lg font-semibold mb-4 text-muted-foreground">Live Preview</h3>

                {/* Card type + flip toggle */}
                <div className="flex items-center gap-2 mb-4">
                    {!template && (
                        <>
                            <Button
                                variant={previewCardType === 'staff' ? 'default' : 'outline'}
                                size="sm"
                                className="h-8 gap-1.5 text-xs"
                                onClick={() => { setPreviewCardType('staff'); setPreviewSide('front'); }}
                            >
                                <Users className="w-3.5 h-3.5" />
                                Staff
                            </Button>
                            <Button
                                variant={previewCardType === 'student' ? 'default' : 'outline'}
                                size="sm"
                                className="h-8 gap-1.5 text-xs"
                                onClick={() => { setPreviewCardType('student'); setPreviewSide('front'); }}
                            >
                                <GraduationCap className="w-3.5 h-3.5" />
                                Student
                            </Button>
                            <div className="w-px h-4 bg-border mx-1" />
                        </>
                    )}
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1 text-xs"
                        onClick={() => setPreviewSide(s => s === 'front' ? 'back' : 'front')}
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                        {previewSide === 'front' ? 'Back' : 'Front'}
                    </Button>
                </div>

                <div className="p-6 bg-muted/30 rounded-2xl">
                    {previewCardType === 'student' ? (
                        <StudentIDCardPreview
                            user={{ ...sampleUser, role: 'student', full_name: 'Jane Student' }}
                            card={sampleCard}
                            template={design}
                            organizationName={organizationName}
                            organizationLogo={organizationLogo}
                            organizationWebsite={organizationWebsite}
                            organizationAddress={organizationAddress}
                            organizationPhone={organizationPhone}
                            studentData={{
                                bloodGroup: 'B+',
                                dateOfBirth: '2000-05-15',
                                batchName: 'Batch 2026',
                                courseName: 'Bank PO',
                                fatherName: 'Rajesh Kumar',
                                mobile: '9876543210',
                            }}
                            scale={1.1}
                            side={previewSide}
                        />
                    ) : (
                        <IDCardPreview
                            user={sampleUser}
                            card={sampleCard}
                            template={design}
                            organizationName={organizationName}
                            organizationLogo={organizationLogo}
                            organizationWebsite={organizationWebsite}
                            organizationAddress={organizationAddress}
                            organizationPhone={organizationPhone}
                            designationName={(design.showDesignation ?? true) ? 'Sample Designation' : undefined}
                            roleName="Faculty"
                            bloodGroup="B+"
                            scale={1.2}
                            side={previewSide}
                        />
                    )}
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                    {previewCardType === 'student' ? 'Student ID Card Template' : 'Staff ID Card Template'}
                    {' · '}
                    {previewSide === 'front' ? 'Front Side' : 'Back Side'}
                </p>
            </div>
        </div>
    );
}
