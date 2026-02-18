/**
 * Faculty Subject Service
 * Manages the mapping between faculty members and subjects they can teach
 */

import { supabase } from '@/lib/supabase';

export interface FacultySubjectMapping {
  id: string;
  faculty_id: string;
  subject_id: string;
  organization_id: string;
  created_at: string;
}

/**
 * Get all subject IDs for a faculty member
 */
export async function getFacultySubjects(facultyId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('faculty_subjects')
    .select('subject_id')
    .eq('faculty_id', facultyId);

  if (error) throw error;
  return (data || []).map((row) => row.subject_id);
}

/**
 * Set subjects for a faculty member (replaces existing)
 */
export async function setFacultySubjects(
  facultyId: string,
  organizationId: string,
  subjectIds: string[]
): Promise<void> {
  // Delete existing mappings
  const { error: deleteError } = await supabase
    .from('faculty_subjects')
    .delete()
    .eq('faculty_id', facultyId);

  if (deleteError) throw deleteError;

  // Insert new mappings
  if (subjectIds.length > 0) {
    const rows = subjectIds.map((subjectId) => ({
      faculty_id: facultyId,
      subject_id: subjectId,
      organization_id: organizationId,
    }));

    const { error: insertError } = await supabase
      .from('faculty_subjects')
      .insert(rows);

    if (insertError) throw insertError;
  }
}

/**
 * Get all faculty members who teach a specific subject
 */
export async function getFacultyBySubject(
  organizationId: string,
  subjectId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from('faculty_subjects')
    .select('faculty_id')
    .eq('organization_id', organizationId)
    .eq('subject_id', subjectId);

  if (error) throw error;
  return (data || []).map((row) => row.faculty_id);
}

/**
 * Get faculty-subject mapping for entire organization
 * Returns a map: facultyId -> subjectId[]
 */
export async function getOrgFacultySubjects(
  organizationId: string
): Promise<Record<string, string[]>> {
  const { data, error } = await supabase
    .from('faculty_subjects')
    .select('faculty_id, subject_id')
    .eq('organization_id', organizationId);

  if (error) throw error;

  const map: Record<string, string[]> = {};
  for (const row of data || []) {
    if (!map[row.faculty_id]) {
      map[row.faculty_id] = [];
    }
    map[row.faculty_id].push(row.subject_id);
  }
  return map;
}
