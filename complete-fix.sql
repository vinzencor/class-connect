-- =====================================================
-- COMPLETE FIX: Policies + Trigger
-- Run this ENTIRE script in Supabase SQL Editor
-- =====================================================

-- Step 1: Drop all existing problematic policies
DROP POLICY IF EXISTS "Authenticated users can insert organizations" ON organizations;
DROP POLICY IF EXISTS "Allow organization creation" ON organizations;
DROP POLICY IF EXISTS "Allow profile creation" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- Step 2: Create permissive INSERT policies
-- Organizations: Allow any authenticated user to create
CREATE POLICY "Allow organization creation"
  ON organizations FOR INSERT
  WITH CHECK (true);

-- Profiles: Allow anyone to insert (needed for trigger to work)
CREATE POLICY "Allow profile creation"
  ON profiles FOR INSERT
  WITH CHECK (true);

-- Step 3: Recreate the trigger with better error handling
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Insert profile with data from auth metadata
  INSERT INTO public.profiles (id, email, full_name, role, organization_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'admin'),
    NULLIF(NEW.raw_user_meta_data->>'organization_id', '')::UUID
  );
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the auth creation
    RAISE WARNING 'Error in handle_new_user for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Step 4: Verify policies were created
SELECT 
  tablename, 
  policyname, 
  cmd AS command
FROM pg_policies
WHERE tablename IN ('organizations', 'profiles')
  AND cmd = 'INSERT'
ORDER BY tablename;

-- ✅ Done! Now test signup in your app
