-- =====================================================
-- COMPLETE FIX: Run this ENTIRE script in Supabase SQL Editor
-- This will fix all RLS issues and create missing profiles
-- =====================================================

-- =====================================================
-- STEP 1: Fix RLS Policies
-- =====================================================

-- Drop ALL existing policies on organizations
DROP POLICY IF EXISTS "Authenticated users can insert organizations" ON organizations;
DROP POLICY IF EXISTS "Allow organization creation" ON organizations;
DROP POLICY IF EXISTS "Authenticated users can read organizations" ON organizations;
DROP POLICY IF EXISTS "Authenticated users can update organizations" ON organizations;

-- Drop ALL existing policies on profiles
DROP POLICY IF EXISTS "Allow profile creation" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can read profiles" ON profiles;

-- Create fresh policies for organizations
CREATE POLICY "Allow organization creation"
  ON organizations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow organization read"
  ON organizations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow organization update"
  ON organizations FOR UPDATE
  TO authenticated
  USING (true);

-- Create fresh policies for profiles
-- CRITICAL: Allow ANY authenticated user to insert profiles
CREATE POLICY "Allow profile creation"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow profile read"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow profile update"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- =====================================================
-- STEP 2: Create Missing Profiles
-- =====================================================

-- Create profiles for any users that don't have one
INSERT INTO public.profiles (id, email, full_name, role, organization_id)
SELECT 
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', 'User') as full_name,
  COALESCE(u.raw_user_meta_data->>'role', 'student') as role,
  (u.raw_user_meta_data->>'organization_id')::UUID as organization_id
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- STEP 3: Verify Everything
-- =====================================================

-- Check policies
SELECT 
  tablename, 
  policyname, 
  cmd as operation,
  roles
FROM pg_policies 
WHERE tablename IN ('organizations', 'profiles')
ORDER BY tablename, policyname;

-- Check users and profiles
SELECT 
  COUNT(DISTINCT u.id) as total_users,
  COUNT(DISTINCT p.id) as users_with_profiles,
  COUNT(DISTINCT u.id) - COUNT(DISTINCT p.id) as missing_profiles
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id;

-- Show all users with their profile status
SELECT 
  u.id,
  u.email,
  p.full_name,
  p.role,
  p.organization_id,
  CASE WHEN p.id IS NULL THEN '❌ NO PROFILE' ELSE '✅ HAS PROFILE' END as status
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
ORDER BY u.created_at DESC;

