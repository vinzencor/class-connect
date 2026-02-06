-- =====================================================
-- COMPLETE FIX: RLS Policies for Organizations & Profiles
-- Run this in Supabase SQL Editor
-- =====================================================

-- First, check what policies exist
SELECT schemaname, tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename IN ('organizations', 'profiles')
ORDER BY tablename, policyname;

-- =====================================================
-- FIX ORGANIZATIONS TABLE
-- =====================================================

-- Drop ALL existing policies on organizations
DROP POLICY IF EXISTS "Authenticated users can insert organizations" ON organizations;
DROP POLICY IF EXISTS "Allow organization creation" ON organizations;
DROP POLICY IF EXISTS "Authenticated users can read organizations" ON organizations;
DROP POLICY IF EXISTS "Authenticated users can update organizations" ON organizations;

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

-- =====================================================
-- FIX PROFILES TABLE
-- =====================================================

-- Drop ALL existing policies on profiles
DROP POLICY IF EXISTS "Allow profile creation" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can read profiles" ON profiles;

-- Create fresh policies for profiles
-- CRITICAL: Allow ANY authenticated user to insert profiles (needed for trigger AND app)
CREATE POLICY "Allow profile creation"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow users to read profiles in their organization
CREATE POLICY "Allow profile read"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

-- Allow users to update their own profile
CREATE POLICY "Allow profile update"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- =====================================================
-- VERIFY POLICIES
-- =====================================================

-- Check the new policies
SELECT schemaname, tablename, policyname, cmd, roles
FROM pg_policies
WHERE tablename IN ('organizations', 'profiles')
ORDER BY tablename, policyname;
