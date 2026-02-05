-- =====================================================
-- FIX: Repair Missing Organization ID
-- Run this script in your Supabase SQL Editor
-- =====================================================

-- 1. Create a dummy organization if one doesn't exist
INSERT INTO organizations (name, email)
VALUES ('My Academy', 'admin@example.com')
ON CONFLICT DO NOTHING;

-- 2. Get the Organization ID (Copy this ID)
SELECT id, name FROM organizations LIMIT 1;

-- 3. Update the specific user profile (Replace UUID-GOES-HERE with the ID from step 2)
-- Replace 'USER_ID_GOES_HERE' with your actual User ID: 3432c8e6-ab23-442e-a3ba-e91730991832
UPDATE profiles
SET organization_id = (SELECT id FROM organizations LIMIT 1)
WHERE id = '3432c8e6-ab23-442e-a3ba-e91730991832'; 
-- OR WHERE email = 'your-email@example.com';

-- 4. Verify the fix
SELECT * FROM profiles WHERE id = '3432c8e6-ab23-442e-a3ba-e91730991832';
