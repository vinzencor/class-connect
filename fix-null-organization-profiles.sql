-- =====================================================
-- FIX NULL ORGANIZATION PROFILES
-- This script identifies and fixes all profiles with NULL organization_id
-- =====================================================

-- Step 1: Identify the problem
-- Show all profiles with NULL organization_id
SELECT 
  p.id,
  p.email,
  p.full_name,
  p.role,
  p.organization_id,
  p.created_at,
  CASE 
    WHEN p.organization_id IS NULL THEN '❌ BROKEN - NO ORG'
    ELSE '✅ OK'
  END as status
FROM profiles p
WHERE p.organization_id IS NULL
ORDER BY p.created_at DESC;

-- Step 2: Find matching organizations for each broken profile
-- This helps us understand what organizations exist
SELECT 
  p.id as profile_id,
  p.email as profile_email,
  p.full_name,
  p.role,
  o.id as org_id,
  o.name as org_name,
  o.email as org_email,
  CASE 
    WHEN p.email = o.email THEN '✅ EXACT EMAIL MATCH'
    WHEN SPLIT_PART(p.email, '@', 2) = SPLIT_PART(o.email, '@', 2) THEN '⚠️ DOMAIN MATCH'
    ELSE '❓ NO MATCH'
  END as match_type
FROM profiles p
CROSS JOIN organizations o
WHERE p.organization_id IS NULL
ORDER BY 
  CASE 
    WHEN p.email = o.email THEN 1
    WHEN SPLIT_PART(p.email, '@', 2) = SPLIT_PART(o.email, '@', 2) THEN 2
    ELSE 3
  END,
  p.created_at DESC;

-- Step 3: AUTO-FIX for ADMIN users
-- Link admin users to organizations with matching email
UPDATE profiles p
SET organization_id = o.id
FROM organizations o
WHERE p.organization_id IS NULL
  AND p.role = 'admin'
  AND p.email = o.email;

-- Step 4: AUTO-FIX for FACULTY/STUDENT users
-- Link faculty/student users to organizations with matching email domain
UPDATE profiles p
SET organization_id = o.id
FROM organizations o
WHERE p.organization_id IS NULL
  AND p.role IN ('faculty', 'student')
  AND SPLIT_PART(p.email, '@', 2) = SPLIT_PART(o.email, '@', 2);

-- Step 5: Create organizations for admin users who still don't have one
-- This handles admin users who signed up but their organization wasn't created
INSERT INTO organizations (name, email, is_active)
SELECT 
  CONCAT(p.full_name, '''s Organization') as name,
  p.email,
  true as is_active
FROM profiles p
WHERE p.organization_id IS NULL
  AND p.role = 'admin'
  AND NOT EXISTS (
    SELECT 1 FROM organizations o WHERE o.email = p.email
  );

-- Step 6: Link those admin users to their newly created organizations
UPDATE profiles p
SET organization_id = o.id
FROM organizations o
WHERE p.organization_id IS NULL
  AND p.role = 'admin'
  AND p.email = o.email;

-- Step 7: Last resort - link remaining users to first active organization
-- This is for faculty/student users who can't be matched by domain
UPDATE profiles p
SET organization_id = (
  SELECT id FROM organizations WHERE is_active = true ORDER BY created_at ASC LIMIT 1
)
WHERE p.organization_id IS NULL
  AND p.role IN ('faculty', 'student')
  AND EXISTS (SELECT 1 FROM organizations WHERE is_active = true);

-- Step 8: Verify the fix
-- Show all profiles and their organization status
SELECT 
  p.id,
  p.email,
  p.full_name,
  p.role,
  p.organization_id,
  o.name as organization_name,
  CASE 
    WHEN p.organization_id IS NULL THEN '❌ STILL BROKEN'
    ELSE '✅ FIXED'
  END as status
FROM profiles p
LEFT JOIN organizations o ON p.organization_id = o.id
ORDER BY 
  CASE WHEN p.organization_id IS NULL THEN 0 ELSE 1 END,
  p.created_at DESC;

-- Step 9: Count summary
SELECT 
  COUNT(*) FILTER (WHERE organization_id IS NULL) as broken_profiles,
  COUNT(*) FILTER (WHERE organization_id IS NOT NULL) as fixed_profiles,
  COUNT(*) as total_profiles
FROM profiles;

