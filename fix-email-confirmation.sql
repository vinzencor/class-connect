-- =====================================================
-- Fix Email Confirmation Issue for Student Registration
-- =====================================================
-- This script helps diagnose and fix the email confirmation issue
-- that prevents student profiles from being created

-- =====================================================
-- STEP 1: Check Current Auth Configuration
-- =====================================================
-- Note: This query won't work in SQL Editor as auth.config is not accessible
-- You need to check this in Supabase Dashboard → Authentication → Settings
-- Look for "Enable email confirmations" setting

-- =====================================================
-- STEP 2: Check for Unconfirmed Users
-- =====================================================
-- Find users who were created but not confirmed
SELECT 
  id,
  email,
  created_at,
  confirmed_at,
  email_confirmed_at,
  CASE 
    WHEN confirmed_at IS NULL THEN 'UNCONFIRMED'
    ELSE 'CONFIRMED'
  END as status
FROM auth.users
WHERE confirmed_at IS NULL
ORDER BY created_at DESC
LIMIT 20;

-- =====================================================
-- STEP 3: Check for Users Without Profiles
-- =====================================================
-- Find auth users that don't have corresponding profiles
SELECT 
  u.id,
  u.email,
  u.created_at,
  u.confirmed_at,
  p.id as profile_id,
  CASE 
    WHEN p.id IS NULL THEN 'MISSING PROFILE'
    ELSE 'HAS PROFILE'
  END as profile_status
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE p.id IS NULL
ORDER BY u.created_at DESC;

-- =====================================================
-- STEP 4: Manually Confirm Unconfirmed Users
-- =====================================================
-- WARNING: Only run this if you want to confirm ALL unconfirmed users
-- This will allow the trigger to create their profiles

-- Uncomment to execute:
-- UPDATE auth.users
-- SET 
--   confirmed_at = NOW(),
--   email_confirmed_at = NOW()
-- WHERE confirmed_at IS NULL;

-- =====================================================
-- STEP 5: Manually Create Missing Profiles
-- =====================================================
-- For users that exist in auth.users but don't have profiles
-- This will create profiles for them

-- First, check what would be created:
SELECT 
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', 'User') as full_name,
  COALESCE(u.raw_user_meta_data->>'role', 'student') as role,
  (u.raw_user_meta_data->>'organization_id')::UUID as organization_id
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE p.id IS NULL
  AND u.confirmed_at IS NOT NULL; -- Only for confirmed users

-- Uncomment to execute:
-- INSERT INTO public.profiles (id, email, full_name, role, organization_id)
-- SELECT 
--   u.id,
--   u.email,
--   COALESCE(u.raw_user_meta_data->>'full_name', 'User') as full_name,
--   COALESCE(u.raw_user_meta_data->>'role', 'student') as role,
--   (u.raw_user_meta_data->>'organization_id')::UUID as organization_id
-- FROM auth.users u
-- LEFT JOIN public.profiles p ON u.id = p.id
-- WHERE p.id IS NULL
--   AND u.confirmed_at IS NOT NULL
-- ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- STEP 6: Verify the Trigger is Working
-- =====================================================
-- Check if the trigger exists and is enabled
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement,
  action_timing
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- Check the trigger function
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines
WHERE routine_name = 'handle_new_user';

-- =====================================================
-- STEP 7: Test the Trigger Function Manually
-- =====================================================
-- You can test if the trigger function works by calling it manually
-- (This is just for testing, don't use in production)

-- Example: Create a test user and see if profile is created
-- DO $$
-- DECLARE
--   test_user_id UUID;
-- BEGIN
--   -- This would need to be done through Supabase Auth API
--   -- Just showing the concept
--   RAISE NOTICE 'Test trigger function';
-- END $$;

-- =====================================================
-- STEP 8: Check RLS Policies on Profiles Table
-- =====================================================
-- Verify that RLS policies allow profile creation
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'profiles'
  AND cmd = 'INSERT'
ORDER BY policyname;

-- =====================================================
-- INSTRUCTIONS FOR FIXING IN SUPABASE DASHBOARD
-- =====================================================
/*
To fix the email confirmation issue:

1. Go to Supabase Dashboard
2. Click on your project
3. Navigate to Authentication → Settings
4. Scroll down to "Email Auth"
5. Find "Enable email confirmations"
6. TOGGLE IT OFF (disable it)
7. Click "Save"

This will allow users created via signUp() to be immediately active
without requiring email confirmation.

Alternative: If you want to keep email confirmation for regular users
but auto-confirm admin-created users, you need to use the Service Role Key
and the admin.createUser() method instead of signUp().
*/

-- =====================================================
-- VERIFICATION QUERY
-- =====================================================
-- After fixing, run this to verify everything is working:
SELECT 
  'Total Users' as metric,
  COUNT(*) as count
FROM auth.users
UNION ALL
SELECT 
  'Confirmed Users' as metric,
  COUNT(*) as count
FROM auth.users
WHERE confirmed_at IS NOT NULL
UNION ALL
SELECT 
  'Unconfirmed Users' as metric,
  COUNT(*) as count
FROM auth.users
WHERE confirmed_at IS NULL
UNION ALL
SELECT 
  'Total Profiles' as metric,
  COUNT(*) as count
FROM public.profiles
UNION ALL
SELECT 
  'Users Without Profiles' as metric,
  COUNT(*) as count
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE p.id IS NULL;

