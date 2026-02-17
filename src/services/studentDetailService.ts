/**
 * Student Detail Service
 * Manages extended student registration data and photo uploads
 */

import { supabase } from '@/lib/supabase';

export interface StudentDetail {
  id: string;
  profile_id: string;
  organization_id: string;
  photo_url: string | null;
  address: string | null;
  city: string;
  state: string;
  pincode: string;
  date_of_birth: string;
  gender: string;
  mobile: string;
  whatsapp: string | null;
  landline: string | null;
  aadhaar: string | null;
  qualification: string;
  graduation_year: string | null;
  graduation_college: string | null;
  admission_source: string | null;
  remarks: string | null;
  father_name: string | null;
  mother_name: string | null;
  parent_email: string | null;
  parent_mobile: string;
  created_at: string;
  updated_at: string;
}

export interface StudentDetailInput {
  address?: string;
  city: string;
  state: string;
  pincode: string;
  date_of_birth: string;
  gender: string;
  mobile: string;
  whatsapp?: string;
  landline?: string;
  aadhaar?: string;
  qualification: string;
  graduation_year?: string;
  graduation_college?: string;
  admission_source?: string;
  remarks?: string;
  father_name?: string;
  mother_name?: string;
  parent_email?: string;
  parent_mobile: string;
}

/**
 * Create student detail record
 */
export async function createStudentDetail(
  profileId: string,
  organizationId: string,
  data: StudentDetailInput
): Promise<StudentDetail> {
  const { data: result, error } = await supabase
    .from('student_details')
    .insert({
      profile_id: profileId,
      organization_id: organizationId,
      ...data,
    })
    .select()
    .single();

  if (error) throw error;
  return result;
}

/**
 * Get student detail by profile ID
 */
export async function getStudentDetail(profileId: string): Promise<StudentDetail | null> {
  const { data, error } = await supabase
    .from('student_details')
    .select('*')
    .eq('profile_id', profileId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Update student detail
 */
export async function updateStudentDetail(
  profileId: string,
  data: Partial<StudentDetailInput>
): Promise<StudentDetail> {
  const { data: result, error } = await supabase
    .from('student_details')
    .update(data)
    .eq('profile_id', profileId)
    .select()
    .single();

  if (error) throw error;
  return result;
}

/**
 * Upload student photo to Supabase Storage and update records
 */
export async function uploadStudentPhoto(
  organizationId: string,
  profileId: string,
  file: File
): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg';
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  const filePath = `${organizationId}/${profileId}_${timestamp}_${randomStr}.${ext}`;

  // Upload to storage
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
    });

  if (uploadError) throw uploadError;

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('avatars')
    .getPublicUrl(filePath);

  const publicUrl = urlData.publicUrl;

  // Update profiles.avatar_url
  await supabase
    .from('profiles')
    .update({ avatar_url: publicUrl } as any)
    .eq('id', profileId);

  // Update student_details.photo_url
  await supabase
    .from('student_details')
    .update({ photo_url: publicUrl })
    .eq('profile_id', profileId);

  return publicUrl;
}
