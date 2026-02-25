/**
 * Module Service
 * Handles hierarchical module operations: Subjects -> Groups -> Files
 */

import { supabase } from '@/lib/supabase';

export interface ModuleSubject {
  id: string;
  organization_id: string;
  branch_id?: string | null;
  name: string;
  description: string | null;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  groups?: ModuleGroup[];
}

export interface ModuleGroup {
  id: string;
  subject_id: string;
  organization_id: string;
  branch_id?: string | null;
  name: string;
  description: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  files?: ModuleFile[];
  sub_groups?: ModuleSubGroup[];
}

export interface ModuleSubGroup {
  id: string;
  group_id: string;
  organization_id: string;
  branch_id?: string | null;
  name: string;
  description: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  files?: ModuleFile[];
}

export interface ModuleFile {
  id: string;
  group_id: string | null;
  sub_group_id?: string | null;
  organization_id: string;
  branch_id?: string | null;
  title: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  sort_order: number;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Helper to add branch_id filter to a query if branchId is provided
 */
function addBranchFilter(query: any, branchId?: string | null) {
  if (branchId) {
    return query.eq('branch_id', branchId);
  }
  return query;
}

/**
 * Fetch all subjects with nested groups and files
 */
export async function fetchSubjects(organizationId: string, branchId?: string | null): Promise<ModuleSubject[]> {
  let subjectsQuery = supabase
    .from('module_subjects')
    .select('*')
    .eq('organization_id', organizationId);
  subjectsQuery = addBranchFilter(subjectsQuery, branchId);

  const { data: subjects, error: subjectsError } = await subjectsQuery.order('sort_order', { ascending: true });

  if (subjectsError) throw subjectsError;
  if (!subjects) return [];

  // Fetch all groups for these subjects
  let groupsQuery = supabase
    .from('module_groups')
    .select('*')
    .eq('organization_id', organizationId);
  groupsQuery = addBranchFilter(groupsQuery, branchId);

  const { data: groups, error: groupsError } = await groupsQuery.order('sort_order', { ascending: true });

  if (groupsError) throw groupsError;

  // Fetch all files for these groups
  let filesQuery = supabase
    .from('module_files')
    .select('*')
    .eq('organization_id', organizationId);
  filesQuery = addBranchFilter(filesQuery, branchId);

  const { data: files, error: filesError } = await filesQuery.order('sort_order', { ascending: true });

  if (filesError) throw filesError;

  // Fetch all sub-groups
  let subGroupsQuery = supabase
    .from('module_sub_groups')
    .select('*')
    .eq('organization_id', organizationId);
  subGroupsQuery = addBranchFilter(subGroupsQuery, branchId);

  const { data: subGroups, error: subGroupsError } = await subGroupsQuery.order('sort_order', { ascending: true });

  if (subGroupsError) throw subGroupsError;

  // Build nested structure: attach files to sub-groups and groups
  const subGroupsWithFiles = (subGroups || []).map((sg) => ({
    ...sg,
    files: (files || []).filter((file) => file.sub_group_id === sg.id),
  }));

  const groupsWithContent = (groups || []).map((group) => ({
    ...group,
    files: (files || []).filter((file) => file.group_id === group.id && !file.sub_group_id),
    sub_groups: subGroupsWithFiles.filter((sg) => sg.group_id === group.id),
  }));

  return subjects.map((subject) => ({
    ...subject,
    groups: groupsWithContent.filter((group) => group.subject_id === subject.id),
  }));
}

/**
 * Create a new subject
 */
export async function createSubject(
  organizationId: string,
  name: string,
  description: string | null,
  createdBy: string,
  branchId?: string | null
): Promise<ModuleSubject> {
  // Get max sort_order
  const { data: maxData } = await supabase
    .from('module_subjects')
    .select('sort_order')
    .eq('organization_id', organizationId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextSortOrder = (maxData?.sort_order ?? -1) + 1;

  const insertData: any = {
    organization_id: organizationId,
    name,
    description,
    sort_order: nextSortOrder,
    created_by: createdBy,
  };
  if (branchId) {
    insertData.branch_id = branchId;
  }

  const { data, error } = await supabase
    .from('module_subjects')
    .insert(insertData)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update a subject
 */
export async function updateSubject(
  id: string,
  name: string,
  description: string | null
): Promise<void> {
  const { error } = await supabase
    .from('module_subjects')
    .update({ name, description })
    .eq('id', id);

  if (error) throw error;
}

/**
 * Delete a subject (cascades to groups and files)
 */
export async function deleteSubject(id: string): Promise<void> {
  const { error } = await supabase.from('module_subjects').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Create a new module group
 */
export async function createGroup(
  subjectId: string,
  organizationId: string,
  name: string,
  description: string | null,
  branchId?: string | null
): Promise<ModuleGroup> {
  // Get max sort_order for this subject
  const { data: maxData } = await supabase
    .from('module_groups')
    .select('sort_order')
    .eq('subject_id', subjectId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .single();

  const nextSortOrder = (maxData?.sort_order ?? -1) + 1;

  const insertData: any = {
    subject_id: subjectId,
    organization_id: organizationId,
    name,
    description,
    sort_order: nextSortOrder,
  };
  if (branchId) {
    insertData.branch_id = branchId;
  }

  const { data, error } = await supabase
    .from('module_groups')
    .insert(insertData)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update a group
 */
export async function updateGroup(
  id: string,
  name: string,
  description: string | null
): Promise<void> {
  const { error } = await supabase
    .from('module_groups')
    .update({ name, description })
    .eq('id', id);

  if (error) throw error;
}

/**
 * Delete a group (cascades to files)
 */
export async function deleteGroup(id: string): Promise<void> {
  const { error } = await supabase.from('module_groups').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Upload a file to a module group or sub-group
 */
export async function uploadFile(
  groupId: string,
  organizationId: string,
  file: File,
  uploadedBy: string,
  subGroupId?: string | null
): Promise<ModuleFile> {
  // 1. Upload to Supabase Storage
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
  const filePath = `${organizationId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('modules')
    .upload(filePath, file);

  if (uploadError) {
    if (
      uploadError.message.includes('Bucket not found') ||
      (uploadError as any).statusCode === '404'
    ) {
      throw new Error(
        "Storage bucket 'modules' not found. Please create a public bucket named 'modules' in your Supabase dashboard."
      );
    }
    throw uploadError;
  }

  // 2. Get public URL
  const {
    data: { publicUrl },
  } = supabase.storage.from('modules').getPublicUrl(filePath);

  // 3. Get max sort_order for this group/sub-group
  let sortQuery = supabase
    .from('module_files')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .single();
  
  if (subGroupId) {
    sortQuery = supabase
      .from('module_files')
      .select('sort_order')
      .eq('sub_group_id', subGroupId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .single();
  } else {
    sortQuery = supabase
      .from('module_files')
      .select('sort_order')
      .eq('group_id', groupId)
      .is('sub_group_id', null)
      .order('sort_order', { ascending: false })
      .limit(1)
      .single();
  }

  const { data: maxData } = await sortQuery;

  const nextSortOrder = (maxData?.sort_order ?? -1) + 1;

  // 4. Create database record
  const insertData: any = {
    group_id: subGroupId ? null : groupId,
    sub_group_id: subGroupId || null,
    organization_id: organizationId,
    title: file.name.replace(`.${fileExt}`, ''),
    file_url: publicUrl,
    file_type: fileExt,
    file_size: file.size,
    sort_order: nextSortOrder,
    uploaded_by: uploadedBy,
  };

  const { data, error: dbError } = await supabase
    .from('module_files')
    .insert(insertData)
    .select()
    .single();

  if (dbError) throw dbError;
  return data;
}

/**
 * Delete a file (and remove from storage)
 */
export async function deleteFile(id: string, fileUrl: string): Promise<void> {
  // Extract storage path from URL
  const urlParts = fileUrl.split('/modules/');
  if (urlParts.length > 1) {
    const storagePath = urlParts[1];
    await supabase.storage.from('modules').remove([storagePath]);
  }

  const { error } = await supabase.from('module_files').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Reorder groups within a subject
 */
export async function reorderGroups(
  subjectId: string,
  orderedIds: string[]
): Promise<void> {
  const updates = orderedIds.map((id, index) => ({
    id,
    sort_order: index,
  }));

  for (const update of updates) {
    await supabase
      .from('module_groups')
      .update({ sort_order: update.sort_order })
      .eq('id', update.id)
      .eq('subject_id', subjectId);
  }
}

/**
 * Reorder files within a group
 */
export async function reorderFiles(
  groupId: string,
  orderedIds: string[]
): Promise<void> {
  const updates = orderedIds.map((id, index) => ({
    id,
    sort_order: index,
  }));

  for (const update of updates) {
    await supabase
      .from('module_files')
      .update({ sort_order: update.sort_order })
      .eq('id', update.id)
      .eq('group_id', groupId);
  }
}

/**
 * Move a file to a different group
 */
export async function moveFile(
  fileId: string,
  targetGroupId: string,
  newSortOrder: number
): Promise<void> {
  const { error } = await supabase
    .from('module_files')
    .update({
      group_id: targetGroupId,
      sub_group_id: null,
      sort_order: newSortOrder,
    })
    .eq('id', fileId);

  if (error) throw error;
}

/**
 * Move a file to a sub-group
 */
export async function moveFileToSubGroup(
  fileId: string,
  targetSubGroupId: string,
  newSortOrder: number
): Promise<void> {
  const { error } = await supabase
    .from('module_files')
    .update({
      group_id: null,
      sub_group_id: targetSubGroupId,
      sort_order: newSortOrder,
    })
    .eq('id', fileId);

  if (error) throw error;
}

// ─── Sub-Group CRUD ──────────────────────────────────────

/**
 * Create a new sub-group within a group
 */
export async function createSubGroup(
  groupId: string,
  organizationId: string,
  name: string,
  description: string | null,
  branchId?: string | null
): Promise<ModuleSubGroup> {
  const { data: maxData } = await supabase
    .from('module_sub_groups')
    .select('sort_order')
    .eq('group_id', groupId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextSortOrder = (maxData?.sort_order ?? -1) + 1;

  const insertData: any = {
    group_id: groupId,
    organization_id: organizationId,
    name,
    description,
    sort_order: nextSortOrder,
  };
  if (branchId) insertData.branch_id = branchId;

  const { data, error } = await supabase
    .from('module_sub_groups')
    .insert(insertData)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update a sub-group
 */
export async function updateSubGroup(
  id: string,
  name: string,
  description: string | null
): Promise<void> {
  const { error } = await supabase
    .from('module_sub_groups')
    .update({ name, description })
    .eq('id', id);

  if (error) throw error;
}

/**
 * Delete a sub-group (cascades to its files)
 */
export async function deleteSubGroup(id: string): Promise<void> {
  // First delete files that belong to this sub-group
  await supabase.from('module_files').delete().eq('sub_group_id', id);
  const { error } = await supabase.from('module_sub_groups').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Reorder sub-groups within a group
 */
export async function reorderSubGroups(
  groupId: string,
  orderedIds: string[]
): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    await supabase
      .from('module_sub_groups')
      .update({ sort_order: i })
      .eq('id', orderedIds[i])
      .eq('group_id', groupId);
  }
}
