-- =====================================================
-- FIX: Create Missing Profiles for Existing Users
-- Run this in Supabase SQL Editor
-- =====================================================

-- Step 1: Check if there are users without profiles
SELECT
  u.id,
  u.email,
  u.raw_user_meta_data->>'full_name' as full_name,
  u.raw_user_meta_data->>'role' as role,
  u.created_at,
  p.id as profile_exists
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE p.id IS NULL
ORDER BY u.created_at DESC;

-- Step 2: Create profiles for users that don't have one
-- This runs as the database owner, bypassing RLS
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

-- Step 3: Verify all users now have profiles
SELECT
  COUNT(*) as total_users,
  COUNT(p.id) as users_with_profiles,
  COUNT(*) - COUNT(p.id) as missing_profiles
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id;

-- Step 4: Show all users and their profiles
SELECT
  u.id,
  u.email,
  p.full_name,
  p.role,
  p.organization_id,
  u.created_at
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
ORDER BY u.created_at DESC;

