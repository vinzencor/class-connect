-- Migration: 02_fix_modules_rls.sql
-- Fixes RLS policies for modules table and storage

-- =====================================================
-- TABLE: modules
-- =====================================================

-- Enable RLS
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;

-- Policy: Select - Authenticated users can view modules
DROP POLICY IF EXISTS "Authenticated users can select modules" ON public.modules;
CREATE POLICY "Authenticated users can select modules"
  ON public.modules FOR SELECT
  USING (auth.role() = 'authenticated');

-- Policy: Insert - Authenticated users can upload modules to their organization
DROP POLICY IF EXISTS "Authenticated users can insert modules" ON public.modules;
CREATE POLICY "Authenticated users can insert modules"
  ON public.modules FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND
    (SELECT organization_id FROM public.profiles WHERE id = auth.uid()) = organization_id
  );

-- Policy: Delete - Only faculty and admins can delete modules
DROP POLICY IF EXISTS "Faculty/Admin can delete modules" ON public.modules;
CREATE POLICY "Faculty/Admin can delete modules"
  ON public.modules FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() 
      AND (role = 'faculty' OR role = 'admin')
    )
  );

-- =====================================================
-- STORAGE: modules bucket
-- =====================================================

-- Ensure the bucket exists (this might need to be done in UI, but we can try inserting if not exists via API usually, purely SQL for storage buckets is specific to supabase extensions)
-- For now, we assume the bucket 'modules' exists or the user has to create it. We focus on policies.

-- Policy: Select - Authenticated users can view/download files
DROP POLICY IF EXISTS "Authenticated users can select objects" ON storage.objects;
CREATE POLICY "Authenticated users can select objects"
  ON storage.objects FOR SELECT
  USING ( bucket_id = 'modules' AND auth.role() = 'authenticated' );

-- Policy: Insert - Authenticated users can upload files
-- Note: We check if the user belongs to the folder path {org_id}/{filename} 
-- But simpler is just to allow authenticated uploads to 'modules' bucket
DROP POLICY IF EXISTS "Authenticated users can upload objects" ON storage.objects;
CREATE POLICY "Authenticated users can upload objects"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'modules' AND 
    auth.role() = 'authenticated'
  );

-- Policy: Delete - Users can delete their own files or admins
DROP POLICY IF EXISTS "Users can delete own objects" ON storage.objects;
CREATE POLICY "Users can delete own objects"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'modules' AND 
    (auth.uid() = owner OR 
     EXISTS (
       SELECT 1 FROM public.profiles 
       WHERE id = auth.uid() AND role = 'admin'
     ))
  );
