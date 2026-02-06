-- =====================================================
-- QUICK FIX: Create Organization and Assign to User
-- Run this ENTIRE script in Supabase SQL Editor
-- =====================================================

-- Create organization and assign to user in one go
DO $$
DECLARE
  new_org_id UUID;
  user_email TEXT;
BEGIN
  -- Get user email
  SELECT email INTO user_email 
  FROM profiles 
  WHERE id = '3432c8e6-ab23-442e-a3ba-e91730991832';
  
  -- Create organization
  INSERT INTO organizations (name, email)
  VALUES ('My Academy', user_email)
  RETURNING id INTO new_org_id;
  
  -- Update user profile
  UPDATE profiles
  SET 
    organization_id = new_org_id,
    role = 'admin'
  WHERE id = '3432c8e6-ab23-442e-a3ba-e91730991832';
  
  -- Show result
  RAISE NOTICE 'Organization created with ID: %', new_org_id;
END $$;

-- Verify the fix
SELECT 
  p.id,
  p.email,
  p.full_name,
  p.role,
  p.organization_id,
  o.name as organization_name,
  CASE 
    WHEN p.organization_id IS NULL THEN '❌ NO ORG - STILL BROKEN'
    ELSE '✅ HAS ORG - FIXED!'
  END as status
FROM profiles p
LEFT JOIN organizations o ON p.organization_id = o.id
WHERE p.id = '3432c8e6-ab23-442e-a3ba-e91730991832';

