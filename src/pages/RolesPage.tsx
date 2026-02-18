/**
 * Roles Management Page
 * Allows admins to create custom roles and configure page-level permissions
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
import { Textarea } from '@/components/ui/textarea';
import { Shield, Plus, Edit2, Trash2, AlertCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import * as roleService from '@/services/roleService';
import type { Role } from '@/services/roleService';
import {
  FEATURES,
  MANDATORY_FEATURES,
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
    mode: 'create' | 'edit';
    roleId?: string;
    name: string;
    description: string;
    permissions: string[];
  }>({
    open: false,
    mode: 'create',
    name: '',
    description: '',
    permissions: [...MANDATORY_FEATURES],
  });

  useEffect(() => {
    if (user?.organizationId) {
      loadRoles();
    }
  }, [user?.organizationId]);

  const loadRoles = async () => {
    if (!user?.organizationId) return;
    try {
      const data = await roleService.fetchRoles(user.organizationId);
      setRoles(data);
    } catch (error) {
      console.error('Error fetching roles:', error);
      toast.error('Failed to load roles');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRole = async () => {
    if (!user?.organizationId || !roleDialog.name.trim()) return;
    try {
      await roleService.createRole(
        user.organizationId,
        roleDialog.name.trim(),
        roleDialog.description.trim() || null,
        roleDialog.permissions
      );
      toast.success('Role created successfully');
      setRoleDialog({
        open: false,
        mode: 'create',
        name: '',
        description: '',
        permissions: [...MANDATORY_FEATURES],
      });
      loadRoles();
    } catch (error: any) {
      console.error('Error creating role:', error);
      toast.error(error.message || 'Failed to create role');
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
      toast.success('Role updated successfully');
      setRoleDialog({
        open: false,
        mode: 'create',
        name: '',
        description: '',
        permissions: [...MANDATORY_FEATURES],
      });
      loadRoles();
    } catch (error: any) {
      console.error('Error updating role:', error);
      toast.error(error.message || 'Failed to update role');
    }
  };

  const handleDeleteRole = async (roleId: string, isSystem: boolean) => {
    if (isSystem) {
      toast.error('System roles cannot be deleted');
      return;
    }
    if (!confirm('Are you sure you want to delete this role?')) return;

    try {
      await roleService.deleteRole(roleId);
      toast.success('Role deleted successfully');
      loadRoles();
    } catch (error: any) {
      console.error('Error deleting role:', error);
      toast.error(error.message || 'Failed to delete role');
    }
  };

  const togglePermission = (featureKey: string) => {
    // Mandatory features cannot be unchecked
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
            Configure custom roles with specific page access
          </p>
        </div>
        <Button
          onClick={() =>
            setRoleDialog({
              open: true,
              mode: 'create',
              name: '',
              description: '',
              permissions: [...MANDATORY_FEATURES],
            })
          }
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Role
        </Button>
      </div>

      {/* Info Alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          System roles (Admin, Faculty, Student) are protected from deletion but their
          permissions can be customized. Dashboard and Settings access is mandatory for all roles.
        </AlertDescription>
      </Alert>

      {/* Roles Grid */}
      {loading ? (
        <div className="text-center py-10">Loading roles...</div>
      ) : roles.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground mb-4">No roles found.</p>
            <Button
              onClick={() =>
                setRoleDialog({
                  open: true,
                  mode: 'create',
                  name: '',
                  description: '',
                  permissions: [...MANDATORY_FEATURES],
                })
              }
            >
              <Plus className="w-4 h-4 mr-2" />
              Create First Role
            </Button>
          </CardContent>
        </Card>
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
                  {role.is_system && (
                    <Badge variant="outline" className="bg-primary/10">
                      System
                    </Badge>
                  )}
                </div>
                {role.description && (
                  <p className="text-sm text-muted-foreground mt-2">{role.description}</p>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Permissions Summary */}
                <div>
                  <p className="text-sm font-medium mb-2">
                    Permissions ({role.permissions?.length || 0})
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
                        mode: 'edit',
                        roleId: role.id,
                        name: role.name,
                        description: role.description || '',
                        permissions: role.permissions || [...MANDATORY_FEATURES],
                      })
                    }
                  >
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                  {!role.is_system && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-destructive hover:text-destructive"
                      onClick={() => handleDeleteRole(role.id, role.is_system)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Role Dialog */}
      <Dialog
        open={roleDialog.open}
        onOpenChange={(open) => !open && setRoleDialog({ ...roleDialog, open: false })}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {roleDialog.mode === 'create' ? 'Create Role' : 'Edit Role'}
            </DialogTitle>
            <DialogDescription>
              {roleDialog.mode === 'create'
                ? 'Define a new role and select which pages it can access.'
                : 'Update the role details and permissions.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Name */}
            <div>
              <Label htmlFor="role-name">Name *</Label>
              <Input
                id="role-name"
                value={roleDialog.name}
                onChange={(e) => setRoleDialog({ ...roleDialog, name: e.target.value })}
                placeholder="e.g., Accountant, Receptionist"
              />
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="role-description">Description</Label>
              <Textarea
                id="role-description"
                value={roleDialog.description}
                onChange={(e) =>
                  setRoleDialog({ ...roleDialog, description: e.target.value })
                }
                placeholder="Optional description of this role"
                rows={2}
              />
            </div>

            {/* Permissions */}
            <div>
              <Label className="text-base mb-3 block">Page Access Permissions</Label>
              <p className="text-sm text-muted-foreground mb-4">
                Select which pages users with this role can access. Dashboard and Settings are
                mandatory.
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
            <Button
              onClick={roleDialog.mode === 'create' ? handleCreateRole : handleUpdateRole}
              disabled={!roleDialog.name.trim()}
            >
              {roleDialog.mode === 'create' ? 'Create Role' : 'Update Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
