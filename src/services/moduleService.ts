/**
 * Module Service
 * Handles hierarchical module operations: Subjects -> Groups -> Files
 */

import { supabase } from '@/lib/supabase';

export interface ModuleSubject {
  id: string;
  organization_id: string;
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
  name: string;
  description: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  files?: ModuleFile[];
}

export interface ModuleFile {
  id: string;
  group_id: string;
  organization_id: string;
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
 * Fetch all subjects with nested groups and files
 */
export async function fetchSubjects(organizationId: string): Promise<ModuleSubject[]> {
  const { data: subjects, error: subjectsError } = await supabase
    .from('module_subjects')
    .select('*')
    .eq('organization_id', organizationId)
    .order('sort_order', { ascending: true });

  if (subjectsError) throw subjectsError;
  if (!subjects) return [];

  // Fetch all groups for these subjects
  const { data: groups, error: groupsError } = await supabase
    .from('module_groups')
    .select('*')
    .eq('organization_id', organizationId)
    .order('sort_order', { ascending: true });

  if (groupsError) throw groupsError;

  // Fetch all files for these groups
  const { data: files, error: filesError } = await supabase
    .from('module_files')
    .select('*')
    .eq('organization_id', organizationId)
    .order('sort_order', { ascending: true });

  if (filesError) throw filesError;

  // Build nested structure
  const groupsWithFiles = (groups || []).map((group) => ({
    ...group,
    files: (files || []).filter((file) => file.group_id === group.id),
  }));

  return subjects.map((subject) => ({
    ...subject,
    groups: groupsWithFiles.filter((group) => group.subject_id === subject.id),
  }));
}

/**
 * Create a new subject
 */
export async function createSubject(
  organizationId: string,
  name: string,
  description: string | null,
  createdBy: string
): Promise<ModuleSubject> {
  // Get max sort_order
  const { data: maxData } = await supabase
    .from('module_subjects')
    .select('sort_order')
    .eq('organization_id', organizationId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .single();

  const nextSortOrder = (maxData?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from('module_subjects')
    .insert({
      organization_id: organizationId,
      name,
      description,
      sort_order: nextSortOrder,
      created_by: createdBy,
    })
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
  description: string | null
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

  const { data, error } = await supabase
    .from('module_groups')
    .insert({
      subject_id: subjectId,
      organization_id: organizationId,
      name,
      description,
      sort_order: nextSortOrder,
    })
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
 * Upload a file to a module group
 */
export async function uploadFile(
  groupId: string,
  organizationId: string,
  file: File,
  uploadedBy: string
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

  // 3. Get max sort_order for this group
  const { data: maxData } = await supabase
    .from('module_files')
    .select('sort_order')
    .eq('group_id', groupId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .single();

  const nextSortOrder = (maxData?.sort_order ?? -1) + 1;

  // 4. Create database record
  const { data, error: dbError } = await supabase
    .from('module_files')
    .insert({
      group_id: groupId,
      organization_id: organizationId,
      title: file.name.replace(`.${fileExt}`, ''),
      file_url: publicUrl,
      file_type: fileExt,
      file_size: file.size,
      sort_order: nextSortOrder,
      uploaded_by: uploadedBy,
    })
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
      sort_order: newSortOrder,
    })
    .eq('id', fileId);

  if (error) throw error;
}
