-- =====================================================
-- FIX: Assign Organization to User
-- User ID: 3432c8e6-ab23-442e-a3ba-e91730991832
-- =====================================================

-- Step 1: Check current user status
SELECT 
  p.id,
  p.email,
  p.full_name,
  p.role,
  p.organization_id,
  o.name as org_name
FROM profiles p
LEFT JOIN organizations o ON p.organization_id = o.id
WHERE p.id = '3432c8e6-ab23-442e-a3ba-e91730991832';

-- Step 2: Check if there are any organizations
SELECT 
  id,
  name,
  email,
  created_at
FROM organizations
ORDER BY created_at DESC;

-- Step 3: Option A - Create a new organization for this user
INSERT INTO organizations (name, email)
VALUES ('My Organization', (SELECT email FROM profiles WHERE id = '3432c8e6-ab23-442e-a3ba-e91730991832'))
RETURNING id, name, email;

-- Step 4: Update the user's profile with the new organization
-- Replace <ORG_ID> with the ID from Step 3
UPDATE profiles
SET 
  organization_id = (SELECT id FROM organizations ORDER BY created_at DESC LIMIT 1),
  role = 'admin'
WHERE id = '3432c8e6-ab23-442e-a3ba-e91730991832';

-- Step 5: Verify the fix
SELECT 
  p.id,
  p.email,
  p.full_name,
  p.role,
  p.organization_id,
  o.name as org_name,
  CASE 
    WHEN p.organization_id IS NULL THEN '❌ NO ORG'
    ELSE '✅ HAS ORG'
  END as status
FROM profiles p
LEFT JOIN organizations o ON p.organization_id = o.id
WHERE p.id = '3432c8e6-ab23-442e-a3ba-e91730991832';

