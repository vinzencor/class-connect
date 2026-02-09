import React, { useState, useEffect } from 'react';
import { Tables } from '@/types/database';
import { idCardService, TemplateDesignData, defaultTemplateDesign } from '@/services/idCardService';
import { IDCardPreview } from './IDCardPreview';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Palette, Layout, Eye } from 'lucide-react';

type Profile = Tables<'profiles'>;

interface IDCardDesignerProps {
    organizationId: string;
    organizationName: string;
    createdBy: string;
    template?: Tables<'id_card_templates'>;
    onSave?: () => void;
    onCancel?: () => void;
}

export function IDCardDesigner({
    organizationId,
    organizationName,
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

    // Sample user for preview
    const sampleUser: Profile = {
        id: 'sample',
        organization_id: organizationId,
        email: 'john.doe@example.com',
        full_name: 'John Doe',
        role: 'student',
        avatar_url: null,
        phone: null,
        nfc_id: 'NFC-SAMPLE-1234',
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

            if (template) {
                await idCardService.updateTemplate(template.id, {
                    name: templateName,
                    template_data: design,
                    is_default: isDefault,
                });
                toast({ title: 'Template updated successfully' });
            } else {
                await idCardService.createTemplate(
                    organizationId,
                    templateName,
                    design,
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
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="colors">
                            <Palette className="w-4 h-4 mr-2" />
                            Colors
                        </TabsTrigger>
                        <TabsTrigger value="layout">
                            <Layout className="w-4 h-4 mr-2" />
                            Layout
                        </TabsTrigger>
                        <TabsTrigger value="fields">
                            <Eye className="w-4 h-4 mr-2" />
                            Fields
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
                                    <Label>Show QR Code</Label>
                                    <Switch
                                        checked={design.showQRCode}
                                        onCheckedChange={(checked) => updateDesign({ showQRCode: checked })}
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

                    <TabsContent value="fields" className="mt-4">
                        <Card>
                            <CardContent className="pt-4 space-y-4">
                                {Object.entries(design.fields).map(([key, field]) => (
                                    <div key={key} className="flex items-center justify-between">
                                        <Label className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</Label>
                                        <Switch
                                            checked={field.visible}
                                            onCheckedChange={(checked) =>
                                                updateDesign({
                                                    fields: {
                                                        ...design.fields,
                                                        [key]: { ...field, visible: checked },
                                                    },
                                                })
                                            }
                                        />
                                    </div>
                                ))}
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
                <div className="p-6 bg-muted/30 rounded-2xl">
                    <IDCardPreview
                        user={sampleUser}
                        card={sampleCard}
                        template={design}
                        organizationName={organizationName}
                        scale={1.2}
                    />
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                    Actual size: 3.375" × 2.125" (85.6mm × 54mm)
                </p>
            </div>
        </div>
    );
}
