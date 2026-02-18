import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

export default function SettingsPage() {
  const { user, organization, refreshUserData } = useAuth();
  const { toast } = useToast();
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSavingOrg, setIsSavingOrg] = useState(false);
  const [taxPercentage, setTaxPercentage] = useState<number>(18);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Google Calendar integration state
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

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

  // Load organization data
  useEffect(() => {
    const loadOrganization = async () => {
      if (!user?.organizationId) return;
      try {
        const { data, error } = await supabase
          .from('organizations')
          .select('tax_percentage')
          .eq('id', user.organizationId)
          .single();

        if (error) throw error;
        if (data) {
          const org = data as Tables<'organizations'>;
          setTaxPercentage(org.tax_percentage || 18);
        }
      } catch (err) {
        console.error('Failed to load organization:', err);
      }
    };

    loadOrganization();
  }, [user?.organizationId]);

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
      const { error } = await supabase
        .from('organizations')
        .update({ tax_percentage: taxPercentage })
        .eq('id', user.organizationId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Organization settings updated successfully',
      });
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
          Manage your institute settings and preferences
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="general">General</TabsTrigger>
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
                  <CardTitle className="text-lg">Institute Information</CardTitle>
                  <CardDescription>Basic details about your institute</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Institute Name</Label>
                  <Input defaultValue="Teammates Academy" />
                </div>
                <div className="space-y-2">
                  <Label>Contact Email</Label>
                  <Input type="email" defaultValue="contact@teammates.edu" />
                </div>
                <div className="space-y-2">
                  <Label>Phone Number</Label>
                  <Input type="tel" defaultValue="+91 98765 43210" />
                </div>
                <div className="space-y-2">
                  <Label>Website</Label>
                  <Input type="url" defaultValue="https://teammates.edu" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input defaultValue="123 Education Street, Knowledge Park, Mumbai 400001" />
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
    </div>
  );
}
