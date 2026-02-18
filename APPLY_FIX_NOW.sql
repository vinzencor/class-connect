-- =====================================================
-- ONE-SHOT FIX FOR ORGANIZATION NULL ISSUE
-- Run this entire script in Supabase SQL Editor
-- =====================================================

-- =====================================================
-- PART 1: CREATE PREVENTION TRIGGER
-- =====================================================

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS prevent_null_organization_trigger ON profiles;
DROP FUNCTION IF EXISTS prevent_null_organization();

-- Create function to handle NULL organization_id
CREATE OR REPLACE FUNCTION prevent_null_organization()
RETURNS TRIGGER AS $$
DECLARE
  matching_org_id UUID;
  first_org_id UUID;
BEGIN
  IF NEW.organization_id IS NULL THEN
    IF NEW.role = 'admin' THEN
      SELECT id INTO matching_org_id FROM organizations WHERE email = NEW.email LIMIT 1;
      IF matching_org_id IS NOT NULL THEN
        NEW.organization_id := matching_org_id;
      ELSE
        INSERT INTO organizations (name, email, is_active)
        VALUES (CONCAT(NEW.full_name, '''s Organization'), NEW.email, true)
        RETURNING id INTO matching_org_id;
        NEW.organization_id := matching_org_id;
      END IF;
    ELSIF NEW.role IN ('faculty', 'student') THEN
      SELECT o.id INTO matching_org_id FROM organizations o
      WHERE SPLIT_PART(o.email, '@', 2) = SPLIT_PART(NEW.email, '@', 2) AND o.is_active = true LIMIT 1;
      IF matching_org_id IS NOT NULL THEN
        NEW.organization_id := matching_org_id;
      ELSE
        SELECT id INTO first_org_id FROM organizations WHERE is_active = true ORDER BY created_at ASC LIMIT 1;
        IF first_org_id IS NOT NULL THEN
          NEW.organization_id := first_org_id;
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_null_organization_trigger
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_null_organization();

-- =====================================================
-- PART 2: FIX EXISTING BROKEN PROFILES
-- =====================================================

-- Fix admin users - link to organizations with matching email
UPDATE profiles p
SET organization_id = o.id
FROM organizations o
WHERE p.organization_id IS NULL
  AND p.role = 'admin'
  AND p.email = o.email;

-- Fix faculty/student users - link by email domain
UPDATE profiles p
SET organization_id = o.id
FROM organizations o
WHERE p.organization_id IS NULL
  AND p.role IN ('faculty', 'student')
  AND SPLIT_PART(p.email, '@', 2) = SPLIT_PART(o.email, '@', 2);

-- Create organizations for admin users who still don't have one
INSERT INTO organizations (name, email, is_active)
SELECT 
  CONCAT(p.full_name, '''s Organization') as name,
  p.email,
  true as is_active
FROM profiles p
WHERE p.organization_id IS NULL
  AND p.role = 'admin'
  AND NOT EXISTS (SELECT 1 FROM organizations o WHERE o.email = p.email);

-- Link those admin users to their newly created organizations
UPDATE profiles p
SET organization_id = o.id
FROM organizations o
WHERE p.organization_id IS NULL
  AND p.role = 'admin'
  AND p.email = o.email;

-- Last resort - link remaining users to first active organization
UPDATE profiles p
SET organization_id = (SELECT id FROM organizations WHERE is_active = true ORDER BY created_at ASC LIMIT 1)
WHERE p.organization_id IS NULL
  AND p.role IN ('faculty', 'student')
  AND EXISTS (SELECT 1 FROM organizations WHERE is_active = true);

-- =====================================================
-- PART 3: VERIFICATION
-- =====================================================

-- Show results
SELECT 
  '✅ FIX APPLIED SUCCESSFULLY!' as status,
  COUNT(*) FILTER (WHERE organization_id IS NULL) as broken_profiles,
  COUNT(*) FILTER (WHERE organization_id IS NOT NULL) as fixed_profiles,
  COUNT(*) as total_profiles
FROM profiles;

-- Show any remaining broken profiles (should be 0)
SELECT 
  id,
  email,
  full_name,
  role,
  organization_id,
  CASE 
    WHEN organization_id IS NULL THEN '❌ STILL BROKEN - CONTACT SUPPORT'
    ELSE '✅ FIXED'
  END as status
FROM profiles
ORDER BY 
  CASE WHEN organization_id IS NULL THEN 0 ELSE 1 END,
  created_at DESC;

-- Show trigger status
SELECT 
  '✅ TRIGGER INSTALLED' as trigger_status,
  tgname as trigger_name,
  tgenabled as enabled
FROM pg_trigger 
WHERE tgname = 'prevent_null_organization_trigger';

