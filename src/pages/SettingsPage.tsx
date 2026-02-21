import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Building2,
  Bell,
  Shield,
  Palette,
  Database,
  Key,
  Mail,
  Globe,
  Smartphone,
  Loader2,
  RefreshCw,
  Plus,
  Pencil,
  Trash2,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import type { Tables } from '@/types/database';
import {
  redirectToGoogleOAuth,
  getGoogleConnectionStatus,
  disconnectGoogle,
} from '@/services/googleCalendarService';
import { branchService, Branch } from '@/services/branchService';
import { useBranch } from '@/contexts/BranchContext';
import { toast as sonnerToast } from 'sonner';

export default function SettingsPage() {
  const { user, organization, refreshUserData } = useAuth();
  const { currentBranchId, currentBranch, branchVersion } = useBranch();
  const { toast } = useToast();
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSavingOrg, setIsSavingOrg] = useState(false);
  const [taxPercentage, setTaxPercentage] = useState<number>(18);
  const [orgData, setOrgData] = useState({
    name: '',
    email: '',
    phone: '',
    website: '',
    address: '',
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Google Calendar integration state
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Branch management state
  const [branches, setBranches] = useState<Branch[]>([]);
  const [showBranchDialog, setShowBranchDialog] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [branchFormData, setBranchFormData] = useState({
    name: '',
    code: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    phone: '',
    email: '',
    is_main_branch: false,
  });

  // Load Google Calendar connection status
  useEffect(() => {
    const loadGoogleStatus = async () => {
      if (!user?.organizationId) return;
      try {
        const status = await getGoogleConnectionStatus(user.organizationId);
        setGoogleConnected(status.connected);
        setGoogleEmail(status.connected_email || null);
      } catch (err) {
        console.error('Failed to load Google status:', err);
      }
    };
    loadGoogleStatus();
  }, [user?.organizationId]);

  const handleConnectGoogle = () => {
    redirectToGoogleOAuth();
  };

  const handleDisconnectGoogle = async () => {
    if (!user?.organizationId) return;
    setIsGoogleLoading(true);
    try {
      const result = await disconnectGoogle(user.organizationId);
      if (result.success) {
        setGoogleConnected(false);
        setGoogleEmail(null);
        toast({
          title: 'Disconnected',
          description: 'Google Calendar has been disconnected',
        });
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to disconnect',
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Disconnect error:', err);
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // Load branches
  useEffect(() => {
    if (user?.organizationId && user?.role === 'admin') {
      loadBranches();
    }
  }, [user?.organizationId, user?.role]);

  const loadBranches = async () => {
    if (!user?.organizationId) return;
    try {
      const data = await branchService.getBranches(user.organizationId);
      setBranches(data);
    } catch (error: any) {
      console.error('Failed to load branches:', error);
    }
  };

  const handleCreateBranch = () => {
    setEditingBranch(null);
    setBranchFormData({
      name: '',
      code: '',
      address: '',
      city: '',
      state: '',
      pincode: '',
      phone: '',
      email: '',
      is_main_branch: false,
    });
    setShowBranchDialog(true);
  };

  const handleEditBranch = (branch: Branch) => {
    setEditingBranch(branch);
    setBranchFormData({
      name: branch.name,
      code: branch.code,
      address: branch.address || '',
      city: branch.city || '',
      state: branch.state || '',
      pincode: branch.pincode || '',
      phone: branch.phone || '',
      email: branch.email || '',
      is_main_branch: branch.is_main_branch,
    });
    setShowBranchDialog(true);
  };

  const handleSaveBranch = async () => {
    if (!user?.organizationId) return;

    try {
      if (editingBranch) {
        await branchService.updateBranch(editingBranch.id, branchFormData);
        sonnerToast.success('Branch updated successfully');
      } else {
        await branchService.createBranch(user.organizationId, branchFormData);
        sonnerToast.success('Branch created successfully');
      }
      setShowBranchDialog(false);
      loadBranches();
    } catch (error: any) {
      sonnerToast.error(error.message || 'Failed to save branch');
    }
  };

  const handleDeleteBranch = async (branchId: string) => {
    if (!confirm('Are you sure you want to delete this branch?')) return;

    try {
      await branchService.deleteBranch(branchId);
      sonnerToast.success('Branch deleted successfully');
      loadBranches();
    } catch (error: any) {
      sonnerToast.error(error.message || 'Failed to delete branch');
    }
  };

  // Load organization data
  useEffect(() => {
    const loadOrganization = async () => {
      if (!user?.organizationId) return;
      try {
        // If a specific branch is selected, also load branch data into the form
        if (currentBranchId && currentBranch) {
          setOrgData({
            name: currentBranch.name || '',
            email: currentBranch.email || '',
            phone: currentBranch.phone || '',
            website: '',
            address: currentBranch.address || '',
          });
        }

        const { data, error } = await supabase
          .from('organizations')
          .select('*')
          .eq('id', user.organizationId)
          .single();

        if (error) throw error;
        if (data) {
          const org = data as Tables<'organizations'>;
          setTaxPercentage(org.tax_percentage || 18);

          // Only load org data into form if no specific branch selected
          if (!currentBranchId) {
            setOrgData({
              name: org.name || '',
              email: org.email || '',
              phone: org.phone || '',
              website: org.website || '',
              address: org.address || '',
            });
          }
        }
      } catch (err) {
        console.error('Failed to load organization:', err);
      }
    };

    loadOrganization();
  }, [user?.organizationId, branchVersion, currentBranchId]);

  const handleSaveOrganization = async () => {
    if (!user?.organizationId) {
      toast({
        title: 'Error',
        description: 'No organization found',
        variant: 'destructive',
      });
      return;
    }

    setIsSavingOrg(true);
    try {
      // If a specific branch is selected, save to branch instead of org
      if (currentBranchId) {
        const { error } = await supabase
          .from('branches')
          .update({
            name: orgData.name,
            email: orgData.email,
            phone: orgData.phone,
            address: orgData.address,
          })
          .eq('id', currentBranchId);

        if (error) throw error;

        // Also update org-level tax if changed
        await supabase
          .from('organizations')
          .update({ tax_percentage: taxPercentage })
          .eq('id', user.organizationId);

        toast({
          title: 'Success',
          description: 'Branch settings updated successfully',
        });
      } else {
        const { error } = await supabase
          .from('organizations')
          .update({
            tax_percentage: taxPercentage,
            name: orgData.name,
            email: orgData.email,
            phone: orgData.phone,
            website: orgData.website,
            address: orgData.address,
          })
          .eq('id', user.organizationId);

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Organization settings updated successfully',
        });
      }

      // Refresh user data to update organization name in UI
      await refreshUserData();
    } catch (err) {
      console.error('Failed to save organization:', err);
      toast({
        title: 'Error',
        description: 'Failed to save organization settings',
        variant: 'destructive',
      });
    } finally {
      setIsSavingOrg(false);
    }
  };

  const handleChangePassword = async () => {
    try {
      // Validate inputs
      if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
        toast({
          title: 'Error',
          description: 'Please fill in all password fields',
          variant: 'destructive',
        });
        return;
      }

      if (passwordData.newPassword !== passwordData.confirmPassword) {
        toast({
          title: 'Error',
          description: 'New passwords do not match',
          variant: 'destructive',
        });
        return;
      }

      if (passwordData.newPassword.length < 6) {
        toast({
          title: 'Error',
          description: 'New password must be at least 6 characters long',
          variant: 'destructive',
        });
        return;
      }

      setIsChangingPassword(true);

      // Update password
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword,
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Password updated successfully',
      });

      // Reset form
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (error) {
      console.error('Error changing password:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to change password',
        variant: 'destructive',
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleRefreshData = async () => {
    try {
      setIsRefreshing(true);
      await refreshUserData();
      toast({
        title: 'Success',
        description: 'User data refreshed successfully',
      });
    } catch (error) {
      console.error('Error refreshing data:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to refresh data',
        variant: 'destructive',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
          Settings
        </h1>
        <p className="text-muted-foreground mt-1">
          {currentBranchId
            ? `Managing settings for branch: ${currentBranch?.name || 'Selected Branch'}`
            : 'Manage your institute settings and preferences'}
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="general">General</TabsTrigger>
          {user?.role === 'admin' && <TabsTrigger value="branches">Branches</TabsTrigger>}
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          {/* Debug Info - Organization Status */}
          {!user?.organizationId && (
            <Card className="border border-destructive/50 bg-destructive/5 shadow-card">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                    <Database className="w-5 h-5 text-destructive" />
                  </div>
                  <div>
                    <CardTitle className="text-lg text-destructive">Organization Not Linked</CardTitle>
                    <CardDescription>Your profile is not linked to an organization</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    <strong>User ID:</strong> {user?.id}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <strong>Email:</strong> {user?.email}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <strong>Role:</strong> {user?.role}
                  </p>
                  <p className="text-sm text-destructive font-medium">
                    <strong>Organization ID:</strong> NULL (This is the issue!)
                  </p>
                </div>
                <Separator />
                <div className="space-y-2">
                  <p className="text-sm font-medium">Solution:</p>
                  <p className="text-sm text-muted-foreground">
                    Click the button below to refresh your data. The system will automatically link your profile to an organization.
                  </p>
                  <Button
                    onClick={handleRefreshData}
                    disabled={isRefreshing}
                    className="bg-primary text-primary-foreground"
                  >
                    {isRefreshing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Refreshing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Refresh & Fix Organization Link
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Institute Information */}
          <Card className="border shadow-card">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">
                    {currentBranchId ? 'Branch Information' : 'Institute Information'}
                  </CardTitle>
                  <CardDescription>
                    {currentBranchId
                      ? `Settings for ${currentBranch?.name || 'selected branch'}`
                      : 'Basic details about your institute'}
                  </CardDescription>
                </div>
                {currentBranchId && (
                  <Badge variant="secondary" className="ml-auto">
                    Branch: {currentBranch?.name}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Institute Name</Label>
                  <Input
                    value={orgData.name}
                    onChange={(e) => setOrgData({ ...orgData, name: e.target.value })}
                    placeholder="Enter institute name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Contact Email</Label>
                  <Input
                    type="email"
                    value={orgData.email}
                    onChange={(e) => setOrgData({ ...orgData, email: e.target.value })}
                    placeholder="contact@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone Number</Label>
                  <Input
                    type="tel"
                    value={orgData.phone}
                    onChange={(e) => setOrgData({ ...orgData, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Website</Label>
                  <Input
                    type="url"
                    value={orgData.website}
                    onChange={(e) => setOrgData({ ...orgData, website: e.target.value })}
                    placeholder="https://example.com"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input
                  value={orgData.address}
                  onChange={(e) => setOrgData({ ...orgData, address: e.target.value })}
                  placeholder="Enter full address"
                />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="tax-percentage">Default Tax Percentage (%) *</Label>
                <Input
                  id="tax-percentage"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={taxPercentage}
                  onChange={(e) => setTaxPercentage(parseFloat(e.target.value) || 0)}
                  placeholder="18.00"
                />
                <p className="text-xs text-muted-foreground">
                  This tax rate will be used for student registration fee calculations (e.g., GST 18%)
                </p>
              </div>
              <Button
                className="bg-primary text-primary-foreground"
                onClick={handleSaveOrganization}
                disabled={isSavingOrg}
              >
                {isSavingOrg ? 'Saving...' : 'Save Changes'}
              </Button>
            </CardContent>
          </Card>

          {/* Appearance */}
          <Card className="border shadow-card">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Palette className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <CardTitle className="text-lg">Appearance</CardTitle>
                  <CardDescription>Customize the look and feel</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Logo</p>
                  <p className="text-sm text-muted-foreground">Upload your institute logo</p>
                </div>
                <Button variant="outline">Upload</Button>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Primary Color</p>
                  <p className="text-sm text-muted-foreground">Main brand color used throughout</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary" />
                  <Input type="text" defaultValue="#0ea5e9" className="w-28" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* BRANCHES TAB - Admin Only */}
        {user?.role === 'admin' && (
          <TabsContent value="branches" className="space-y-6">
            <Card className="border shadow-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle>Branch Management</CardTitle>
                      <CardDescription>Manage multiple branches for your academy</CardDescription>
                    </div>
                  </div>
                  <Button onClick={handleCreateBranch}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Branch
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Branch Name</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {branches.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                            No branches found. Click "Add Branch" to create your first branch.
                          </TableCell>
                        </TableRow>
                      )}
                      {branches.map((branch) => (
                        <TableRow key={branch.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {branch.name}
                              {branch.is_main_branch && (
                                <Badge variant="default" className="text-xs">Main</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{branch.code}</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {branch.city && branch.state ? `${branch.city}, ${branch.state}` : 'N/A'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {branch.phone || branch.email || 'N/A'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={branch.is_active ? 'default' : 'secondary'}>
                              {branch.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditBranch(branch)}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteBranch(branch.id)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="notifications" className="space-y-6">
          <Card className="border shadow-card">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                  <Bell className="w-5 h-5 text-warning" />
                </div>
                <div>
                  <CardTitle className="text-lg">Notification Preferences</CardTitle>
                  <CardDescription>Control how you receive notifications</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {[
                { title: 'Email Notifications', description: 'Receive updates via email', icon: Mail },
                { title: 'Push Notifications', description: 'Browser and mobile push alerts', icon: Smartphone },
                { title: 'Class Reminders', description: 'Reminders before scheduled classes', icon: Bell },
                { title: 'New Lead Alerts', description: 'Get notified when new leads arrive', icon: Globe },
              ].map((item) => (
                <div key={item.title} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <item.icon className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-foreground">{item.title}</p>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                  <Switch defaultChecked />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="space-y-6">
          <Card className="border shadow-card">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                  <Database className="w-5 h-5 text-success" />
                </div>
                <div>
                  <CardTitle className="text-lg">Connected Services</CardTitle>
                  <CardDescription>Manage your third-party integrations</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Google Calendar & Meet Integration */}
              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div className="flex-1">
                  <p className="font-medium text-foreground">Google Calendar & Meet</p>
                  <p className="text-sm text-muted-foreground">
                    {googleConnected
                      ? `Connected as ${googleEmail || 'Google Account'} — Meet links will be auto-generated when creating sessions`
                      : 'Connect to auto-generate Google Meet links when creating class sessions'}
                  </p>
                </div>
                {user?.role === 'admin' ? (
                  <Button
                    variant={googleConnected ? 'outline' : 'default'}
                    size="sm"
                    onClick={googleConnected ? handleDisconnectGoogle : handleConnectGoogle}
                    disabled={isGoogleLoading}
                  >
                    {isGoogleLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : googleConnected ? (
                      'Disconnect'
                    ) : (
                      'Connect Google Calendar'
                    )}
                  </Button>
                ) : (
                  <span className={`text-xs font-medium px-2 py-1 rounded ${googleConnected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {googleConnected ? 'Connected' : 'Not connected'}
                  </span>
                )}
              </div>

              {/* Other integrations (static placeholders) */}
              {[
                { name: 'WhatsApp Business', description: 'Send notifications via WhatsApp', connected: false },
                { name: 'Payment Gateway', description: 'Accept online payments', connected: false },
              ].map((integration) => (
                <div key={integration.name} className="flex items-center justify-between p-4 rounded-lg border">
                  <div>
                    <p className="font-medium text-foreground">{integration.name}</p>
                    <p className="text-sm text-muted-foreground">{integration.description}</p>
                  </div>
                  <Button variant={integration.connected ? 'outline' : 'default'} size="sm">
                    {integration.connected ? 'Disconnect' : 'Connect'}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card className="border shadow-card">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <CardTitle className="text-lg">Security Settings</CardTitle>
                  <CardDescription>Manage your account security</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Current Password</Label>
                <Input
                  type="password"
                  placeholder="Enter current password"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  disabled={isChangingPassword}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>New Password</Label>
                  <Input
                    type="password"
                    placeholder="Enter new password"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    disabled={isChangingPassword}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Confirm Password</Label>
                  <Input
                    type="password"
                    placeholder="Confirm new password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    disabled={isChangingPassword}
                  />
                </div>
              </div>
              <Button
                className="bg-primary text-primary-foreground"
                onClick={handleChangePassword}
                disabled={isChangingPassword}
              >
                {isChangingPassword ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update Password'
                )}
              </Button>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Key className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-foreground">Two-Factor Authentication</p>
                    <p className="text-sm text-muted-foreground">Add an extra layer of security</p>
                  </div>
                </div>
                <Switch />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Branch Create/Edit Dialog */}
      <Dialog open={showBranchDialog} onOpenChange={setShowBranchDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingBranch ? 'Edit Branch' : 'Create New Branch'}</DialogTitle>
            <DialogDescription>
              {editingBranch ? 'Update branch information' : 'Add a new branch to your academy'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Branch Name *</Label>
                <Input
                  placeholder="e.g., Main Campus, Downtown Branch"
                  value={branchFormData.name}
                  onChange={(e) => setBranchFormData({ ...branchFormData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Branch Code *</Label>
                <Input
                  placeholder="e.g., MC, DT"
                  value={branchFormData.code}
                  onChange={(e) => setBranchFormData({ ...branchFormData, code: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Address</Label>
              <Input
                placeholder="Street address"
                value={branchFormData.address}
                onChange={(e) => setBranchFormData({ ...branchFormData, address: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>City</Label>
                <Input
                  placeholder="City"
                  value={branchFormData.city}
                  onChange={(e) => setBranchFormData({ ...branchFormData, city: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <Input
                  placeholder="State"
                  value={branchFormData.state}
                  onChange={(e) => setBranchFormData({ ...branchFormData, state: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Pincode</Label>
                <Input
                  placeholder="Pincode"
                  value={branchFormData.pincode}
                  onChange={(e) => setBranchFormData({ ...branchFormData, pincode: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  type="tel"
                  placeholder="Contact number"
                  value={branchFormData.phone}
                  onChange={(e) => setBranchFormData({ ...branchFormData, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="branch@example.com"
                  value={branchFormData.email}
                  onChange={(e) => setBranchFormData({ ...branchFormData, email: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2 p-4 bg-muted/50 rounded-lg">
              <Switch
                id="main-branch"
                checked={branchFormData.is_main_branch}
                onCheckedChange={(checked) => setBranchFormData({ ...branchFormData, is_main_branch: checked })}
              />
              <Label htmlFor="main-branch" className="cursor-pointer">
                Set as Main Branch (can view consolidated reports from all branches)
              </Label>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowBranchDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveBranch} disabled={!branchFormData.name || !branchFormData.code}>
                {editingBranch ? 'Update Branch' : 'Create Branch'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
