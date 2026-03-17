-- FIX: Remove legacy role constraint and update profile trigger
-- This script allows custom roles like 'front_office' to be saved in the profiles table.

-- 1. Drop the legacy check constraint on the role column
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'profiles_role_check'
    ) THEN
        ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_check;
    END IF;
END $$;

-- 2. Update the handle_new_user trigger function to be more robust
-- and handle profiles correctly regardless of whether the metadata is present or not.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_role TEXT;
  new_org_id UUID;
  new_role_id UUID;
BEGIN
  -- Extract values from user_metadata
  new_role := COALESCE(NEW.raw_user_meta_data->>'role', 'student');
  new_org_id := (NEW.raw_user_meta_data->>'organization_id')::UUID;
  new_role_id := (NEW.raw_user_meta_data->>'role_id')::UUID;

  INSERT INTO public.profiles (id, email, full_name, role, organization_id, role_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    new_role,
    new_org_id,
    new_role_id
  ) ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    organization_id = EXCLUDED.organization_id,
    role_id = EXCLUDED.role_id,
    updated_at = NOW();
    
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Fallback if organization_id is missing or invalid
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    'student'
  ) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public;

-- 3. Verify the change by checking if the constraint is gone
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.profiles'::regclass AND conname = 'profiles_role_check';
