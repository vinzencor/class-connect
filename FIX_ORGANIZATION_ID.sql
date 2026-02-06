-- =====================================================
-- FIX NULL ORGANIZATION_ID ISSUE
-- =====================================================
-- Run this SQL in Supabase if you see:
-- "Organization ID: NULL - This is the issue!"
-- =====================================================

-- Step 1: Create an organization if you don't have one
-- Copy the returned ID
INSERT INTO organizations (name, email) 
VALUES ('My Academy', 'admin@academy.com') 
RETURNING id, name;

-- =====================================================
-- Step 2: Update your profile with the organization_id
-- =====================================================
-- Replace 'YOUR_EMAIL' with your actual email
-- Replace 'ORG_ID_FROM_STEP_1' with the ID from Step 1
UPDATE profiles 
SET organization_id = 'ORG_ID_FROM_STEP_1'
WHERE email = 'YOUR_EMAIL';

-- =====================================================
-- Step 3: Verify it worked
-- =====================================================
SELECT id, email, organization_id, full_name, role 
FROM profiles 
WHERE email = 'YOUR_EMAIL';

-- Expected result: organization_id should now show a UUID, not NULL

-- =====================================================
-- Step 4: Refresh your browser and login again
-- =====================================================
-- The debug panel should now show your organization_id!
-- You can now create users and they'll be auto-assigned!
