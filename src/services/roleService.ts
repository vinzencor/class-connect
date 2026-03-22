/**
 * Role Service
 * Handles role and permission management operations
 */

import { supabase } from '@/lib/supabase';
import { PREDEFINED_ROLES } from '@/lib/features';

export interface Role {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  created_at: string;
  updated_at: string;
  permissions?: string[]; // feature keys
}

export interface RolePermission {
  id: string;
  role_id: string;
  feature_key: string;
  created_at: string;
}

/**
 * Fetch all roles for an organization with their permissions
 */
export async function fetchRoles(organizationId: string): Promise<Role[]> {
  const { data: roles, error: rolesError } = await supabase
    .from('roles')
    .select('*')
    .eq('organization_id', organizationId)
    .order('is_system', { ascending: false })
    .order('name', { ascending: true });

  if (rolesError) throw rolesError;
  if (!roles) return [];

  // Fetch permissions for all roles
  const roleIds = roles.map((r) => r.id);
  const { data: permissions, error: permsError } = await supabase
    .from('role_permissions')
    .select('*')
    .in('role_id', roleIds);

  if (permsError) throw permsError;

  // Build roles with permissions
  return roles.map((role) => ({
    ...role,
    permissions: (permissions || [])
      .filter((p) => p.role_id === role.id)
      .map((p) => p.feature_key),
  }));
}

/**
 * Fetch a single role with permissions
 */
export async function fetchRole(roleId: string): Promise<Role | null> {
  const { data: role, error: roleError } = await supabase
    .from('roles')
    .select('*')
    .eq('id', roleId)
    .single();

  if (roleError) {
    if (roleError.code === 'PGRST116') return null; // Not found
    throw roleError;
  }

  const { data: permissions, error: permsError } = await supabase
    .from('role_permissions')
    .select('feature_key')
    .eq('role_id', roleId);

  if (permsError) throw permsError;

  return {
    ...role,
    permissions: (permissions || []).map((p) => p.feature_key),
  };
}

/**
 * Fetch permissions for a specific role
 */
export async function fetchRolePermissions(roleId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('role_permissions')
    .select('feature_key')
    .eq('role_id', roleId);

  if (error) throw error;
  return (data || []).map((p) => p.feature_key);
}

/**
 * Create a new role with permissions
 */
export async function createRole(
  organizationId: string,
  name: string,
  description: string | null,
  featureKeys: string[]
): Promise<Role> {
  // Create role
  const { data: role, error: roleError } = await supabase
    .from('roles')
    .insert({
      organization_id: organizationId,
      name,
      description,
      is_system: false,
    })
    .select()
    .single();

  if (roleError) {
    if (roleError.code === '23505' || roleError.message?.includes('roles_organization_id_name_key')) {
      throw new Error(`A role with the name "${name}" already exists.`);
    }
    throw roleError;
  }

  // Insert permissions
  if (featureKeys.length > 0) {
    const permissionInserts = featureKeys.map((key) => ({
      role_id: role.id,
      feature_key: key,
    }));

    const { error: permsError } = await supabase
      .from('role_permissions')
      .insert(permissionInserts);

    if (permsError) throw permsError;
  }

  return {
    ...role,
    permissions: featureKeys,
  };
}

/**
 * Update a role (name, description, and permissions)
 */
export async function updateRole(
  roleId: string,
  name: string,
  description: string | null,
  featureKeys: string[]
): Promise<void> {
  // Update role metadata
  const { error: roleError } = await supabase
    .from('roles')
    .update({ name, description })
    .eq('id', roleId);

  if (roleError) {
    if (roleError.code === '23505' || roleError.message?.includes('roles_organization_id_name_key')) {
      throw new Error(`A role with the name "${name}" already exists.`);
    }
    throw roleError;
  }

  // Delete existing permissions
  await supabase.from('role_permissions').delete().eq('role_id', roleId);

  // Insert new permissions
  if (featureKeys.length > 0) {
    const permissionInserts = featureKeys.map((key) => ({
      role_id: roleId,
      feature_key: key,
    }));

    const { error: permsError } = await supabase
      .from('role_permissions')
      .insert(permissionInserts);

    if (permsError) throw permsError;
  }
}

/**
 * Delete a role (only non-system roles)
 */
export async function deleteRole(roleId: string): Promise<void> {
  // Check if it's a system role
  const { data: role, error: checkError } = await supabase
    .from('roles')
    .select('is_system')
    .eq('id', roleId)
    .single();

  if (checkError) throw checkError;

  if (role.is_system) {
    throw new Error('System roles cannot be deleted');
  }

  // Delete role (permissions cascade automatically)
  const { error } = await supabase.from('roles').delete().eq('id', roleId);
  if (error) throw error;
}

/**
 * Check if a user has a specific permission
 */
export async function userHasPermission(
  userId: string,
  featureKey: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc('get_user_permissions', {
    user_id: userId,
  });

  if (error) throw error;
  return (data || []).includes(featureKey);
}

/**
 * Get all permissions for a user
 */
export async function getUserPermissions(userId: string): Promise<string[]> {
  const { data, error } = await supabase.rpc('get_user_permissions', {
    user_id: userId,
  });

  if (error) {
    console.error('Error fetching user permissions:', error);
    return [];
  }
  return data || [];
}

/**
 * Seed predefined roles for an organization.
 * Creates any missing predefined roles and updates permissions for existing ones.
 */
export async function seedPredefinedRoles(organizationId: string): Promise<void> {
  // Fetch existing roles for the org
  const { data: existingRoles, error: fetchErr } = await supabase
    .from('roles')
    .select('id, name')
    .eq('organization_id', organizationId);

  if (fetchErr) throw fetchErr;

  const existingNames = new Set((existingRoles || []).map((r) => r.name));

  for (const preset of PREDEFINED_ROLES) {
    if (existingNames.has(preset.name)) continue; // already exists

    try {
      await createRole(
        organizationId,
        preset.name,
        preset.description,
        preset.defaultPermissions
      );
    } catch (err: any) {
      // Ignore duplicate name errors (race condition)
      if (!err.message?.includes('already exists')) {
        console.error(`Error seeding role "${preset.name}":`, err);
      }
    }
  }
}
