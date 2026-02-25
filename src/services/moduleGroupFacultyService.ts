/**
 * Module Group Faculty Service
 * Manages the mapping between faculty members and module groups/sub-groups.
 * Used to filter faculty when scheduling sessions for specific modules.
 */

import { supabase } from '@/lib/supabase';

export interface ModuleGroupFaculty {
  id: string;
  group_id: string | null;
  sub_group_id: string | null;
  faculty_id: string;
  organization_id: string;
  created_at: string;
}

/**
 * Get all faculty IDs assigned to a specific module group
 */
export async function getGroupFaculty(groupId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('module_group_faculty')
    .select('faculty_id')
    .eq('group_id', groupId);

  if (error) throw error;
  return (data || []).map((row) => row.faculty_id);
}

/**
 * Get all faculty IDs assigned to a specific sub-group
 */
export async function getSubGroupFaculty(subGroupId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('module_group_faculty')
    .select('faculty_id')
    .eq('sub_group_id', subGroupId);

  if (error) throw error;
  return (data || []).map((row) => row.faculty_id);
}

/**
 * Set faculty for a module group (replaces existing assignments)
 */
export async function setGroupFaculty(
  groupId: string,
  organizationId: string,
  facultyIds: string[]
): Promise<void> {
  // Delete existing assignments for this group
  const { error: deleteError } = await supabase
    .from('module_group_faculty')
    .delete()
    .eq('group_id', groupId);

  if (deleteError) throw deleteError;

  // Insert new assignments
  if (facultyIds.length > 0) {
    const rows = facultyIds.map((facultyId) => ({
      group_id: groupId,
      sub_group_id: null,
      faculty_id: facultyId,
      organization_id: organizationId,
    }));

    const { error: insertError } = await supabase
      .from('module_group_faculty')
      .insert(rows);

    if (insertError) throw insertError;
  }
}

/**
 * Set faculty for a sub-group (replaces existing assignments)
 */
export async function setSubGroupFaculty(
  subGroupId: string,
  organizationId: string,
  facultyIds: string[]
): Promise<void> {
  // Delete existing assignments for this sub-group
  const { error: deleteError } = await supabase
    .from('module_group_faculty')
    .delete()
    .eq('sub_group_id', subGroupId);

  if (deleteError) throw deleteError;

  // Insert new assignments
  if (facultyIds.length > 0) {
    const rows = facultyIds.map((facultyId) => ({
      group_id: null,
      sub_group_id: subGroupId,
      faculty_id: facultyId,
      organization_id: organizationId,
    }));

    const { error: insertError } = await supabase
      .from('module_group_faculty')
      .insert(rows);

    if (insertError) throw insertError;
  }
}

/**
 * Get faculty IDs for multiple module groups (used in session creation).
 * Returns a union of all faculty assigned to these groups AND their sub-groups.
 */
export async function getFacultyForModuleGroups(
  groupIds: string[]
): Promise<string[]> {
  if (groupIds.length === 0) return [];

  // Get faculty assigned directly to these groups
  const { data: groupData, error: groupError } = await supabase
    .from('module_group_faculty')
    .select('faculty_id')
    .in('group_id', groupIds);

  if (groupError) throw groupError;

  // Get sub-groups under the selected groups
  const { data: subGroups, error: sgError } = await supabase
    .from('module_sub_groups')
    .select('id')
    .in('group_id', groupIds);

  if (sgError) throw sgError;

  const subGroupIds = (subGroups || []).map((sg) => sg.id);

  let subGroupFacultyIds: string[] = [];
  if (subGroupIds.length > 0) {
    const { data: sgData, error: sgfError } = await supabase
      .from('module_group_faculty')
      .select('faculty_id')
      .in('sub_group_id', subGroupIds);

    if (sgfError) throw sgfError;
    subGroupFacultyIds = (sgData || []).map((row) => row.faculty_id);
  }

  // Combine and deduplicate
  const allFacultyIds = [
    ...(groupData || []).map((row) => row.faculty_id),
    ...subGroupFacultyIds,
  ];
  return [...new Set(allFacultyIds)];
}

/**
 * Get all module-group-faculty mappings for an organization.
 * Returns maps: groupId -> facultyId[], subGroupId -> facultyId[]
 */
export async function getOrgModuleGroupFaculty(
  organizationId: string
): Promise<{
  groupFacultyMap: Record<string, string[]>;
  subGroupFacultyMap: Record<string, string[]>;
}> {
  const { data, error } = await supabase
    .from('module_group_faculty')
    .select('group_id, sub_group_id, faculty_id')
    .eq('organization_id', organizationId);

  if (error) throw error;

  const groupFacultyMap: Record<string, string[]> = {};
  const subGroupFacultyMap: Record<string, string[]> = {};

  for (const row of data || []) {
    if (row.group_id) {
      if (!groupFacultyMap[row.group_id]) {
        groupFacultyMap[row.group_id] = [];
      }
      groupFacultyMap[row.group_id].push(row.faculty_id);
    }
    if (row.sub_group_id) {
      if (!subGroupFacultyMap[row.sub_group_id]) {
        subGroupFacultyMap[row.sub_group_id] = [];
      }
      subGroupFacultyMap[row.sub_group_id].push(row.faculty_id);
    }
  }

  return { groupFacultyMap, subGroupFacultyMap };
}

/**
 * Get all module group IDs assigned to a faculty member.
 * Used when editing a faculty profile to show which groups they're assigned to.
 */
export async function getGroupsForFaculty(facultyId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('module_group_faculty')
    .select('group_id')
    .eq('faculty_id', facultyId)
    .not('group_id', 'is', null);

  if (error) throw error;
  return (data || []).map((row) => row.group_id).filter(Boolean) as string[];
}

/**
 * Set module group assignments for a faculty member (replaces existing group-level assignments).
 * Used when creating/editing a faculty member from UsersPage.
 */
export async function setGroupFacultyForFaculty(
  facultyId: string,
  organizationId: string,
  groupIds: string[]
): Promise<void> {
  // Delete existing group-level assignments for this faculty
  const { error: deleteError } = await supabase
    .from('module_group_faculty')
    .delete()
    .eq('faculty_id', facultyId)
    .not('group_id', 'is', null);

  if (deleteError) throw deleteError;

  // Insert new group assignments
  if (groupIds.length > 0) {
    const rows = groupIds.map((groupId) => ({
      group_id: groupId,
      sub_group_id: null,
      faculty_id: facultyId,
      organization_id: organizationId,
    }));

    const { error: insertError } = await supabase
      .from('module_group_faculty')
      .insert(rows);

    if (insertError) throw insertError;
  }
}
