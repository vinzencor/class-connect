/**
 * Roles Management Page
 * Shows predefined roles only — no custom role creation.
 * Admin can edit module access per role for their organization.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Shield, Edit2, AlertCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import * as roleService from '@/services/roleService';
import type { Role } from '@/services/roleService';
import {
  FEATURES,
  MANDATORY_FEATURES,
  PREDEFINED_ROLES,
  getFeaturesByCategory,
  CATEGORY_LABELS,
} from '@/lib/features';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function RolesPage() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  const [roleDialog, setRoleDialog] = useState<{
    open: boolean;
    roleId?: string;
    name: string;
    description: string;
    permissions: string[];
  }>({
    open: false,
    name: '',
    description: '',
    permissions: [...MANDATORY_FEATURES],
  });

  useEffect(() => {
    if (user?.organizationId) {
      initRoles();
    }
  }, [user?.organizationId]);

  const initRoles = async () => {
    if (!user?.organizationId) return;
    try {
      // Seed predefined roles (creates missing ones)
      await roleService.seedPredefinedRoles(user.organizationId);
      // Fetch all roles
      const data = await roleService.fetchRoles(user.organizationId);
      // Filter to only predefined role names
      const predefinedNames = new Set(PREDEFINED_ROLES.map((r) => r.name));
      setRoles(data.filter((r) => predefinedNames.has(r.name)));
    } catch (error) {
      console.error('Error fetching roles:', error);
      toast.error('Failed to load roles');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRole = async () => {
    if (!roleDialog.roleId || !roleDialog.name.trim()) return;
    try {
      await roleService.updateRole(
        roleDialog.roleId,
        roleDialog.name.trim(),
        roleDialog.description.trim() || null,
        roleDialog.permissions
      );
      toast.success('Role permissions updated');
      setRoleDialog({ open: false, name: '', description: '', permissions: [...MANDATORY_FEATURES] });
      initRoles();
    } catch (error: any) {
      console.error('Error updating role:', error);
      toast.error(error.message || 'Failed to update role');
    }
  };

  const togglePermission = (featureKey: string) => {
    if (MANDATORY_FEATURES.includes(featureKey)) return;
    setRoleDialog((prev) => {
      const permissions = prev.permissions.includes(featureKey)
        ? prev.permissions.filter((p) => p !== featureKey)
        : [...prev.permissions, featureKey];
      return { ...prev, permissions };
    });
  };

  const featuresByCategory = getFeaturesByCategory();

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
            Roles & Permissions
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage module access for predefined roles
          </p>
        </div>
      </div>

      {/* Info Alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          The system uses {PREDEFINED_ROLES.length} predefined roles. You can customize which
          modules each role has access to by clicking Edit. Dashboard and Settings are mandatory for all roles.
        </AlertDescription>
      </Alert>

      {/* Roles Grid */}
      {loading ? (
        <div className="text-center py-10">Loading roles...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {roles.map((role) => (
            <Card key={role.id} className="hover:shadow-soft transition-shadow">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-primary" />
                    <CardTitle className="text-lg">{role.name}</CardTitle>
                  </div>
                  <Badge variant="outline" className="bg-primary/10">
                    Predefined
                  </Badge>
                </div>
                {role.description && (
                  <p className="text-sm text-muted-foreground mt-2">{role.description}</p>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Permissions Summary */}
                <div>
                  <p className="text-sm font-medium mb-2">
                    Modules ({role.permissions?.length || 0})
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {(role.permissions || []).slice(0, 5).map((perm) => {
                      const feature = FEATURES.find((f) => f.key === perm);
                      return (
                        <Badge key={perm} variant="secondary" className="text-xs">
                          {feature?.label || perm}
                        </Badge>
                      );
                    })}
                    {(role.permissions?.length || 0) > 5 && (
                      <Badge variant="secondary" className="text-xs">
                        +{(role.permissions?.length || 0) - 5} more
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() =>
                      setRoleDialog({
                        open: true,
                        roleId: role.id,
                        name: role.name,
                        description: role.description || '',
                        permissions: role.permissions || [...MANDATORY_FEATURES],
                      })
                    }
                  >
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit Modules
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Role Dialog */}
      <Dialog
        open={roleDialog.open}
        onOpenChange={(open) => !open && setRoleDialog({ ...roleDialog, open: false })}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Role — {roleDialog.name}</DialogTitle>
            <DialogDescription>
              Select which modules users with <strong>{roleDialog.name}</strong> role can access.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Permissions */}
            <div>
              <Label className="text-base mb-3 block">Module Access Permissions</Label>
              <p className="text-sm text-muted-foreground mb-4">
                Dashboard and Settings are mandatory for all roles.
              </p>

              {Object.entries(featuresByCategory).map(([category, features]) => (
                <div key={category} className="mb-6">
                  <h4 className="font-medium text-sm mb-3 text-foreground">
                    {CATEGORY_LABELS[category] || category}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {features.map((feature) => {
                      const isChecked = roleDialog.permissions.includes(feature.key);
                      const isMandatory = MANDATORY_FEATURES.includes(feature.key);
                      const Icon = feature.icon;

                      return (
                        <div
                          key={feature.key}
                          className="flex items-start space-x-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                        >
                          <Checkbox
                            id={`perm-${feature.key}`}
                            checked={isChecked}
                            onCheckedChange={() => togglePermission(feature.key)}
                            disabled={isMandatory}
                          />
                          <div className="flex-1">
                            <label
                              htmlFor={`perm-${feature.key}`}
                              className="text-sm font-medium leading-none cursor-pointer flex items-center gap-2"
                            >
                              <Icon className="w-4 h-4 text-muted-foreground" />
                              {feature.label}
                              {isMandatory && (
                                <Badge variant="secondary" className="text-xs py-0">
                                  Required
                                </Badge>
                              )}
                            </label>
                            <p className="text-xs text-muted-foreground mt-1">
                              {feature.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRoleDialog({ ...roleDialog, open: false })}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdateRole}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
