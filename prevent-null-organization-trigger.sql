-- =====================================================
-- PREVENT NULL ORGANIZATION TRIGGER
-- This trigger helps prevent and auto-fix NULL organization_id issues
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
  -- Only process if organization_id is NULL
  IF NEW.organization_id IS NULL THEN
    
    -- Strategy 1: For ADMIN users, try to find or create organization
    IF NEW.role = 'admin' THEN
      RAISE NOTICE 'Admin user without organization detected: %', NEW.email;
      
      -- Try to find existing organization with same email
      SELECT id INTO matching_org_id
      FROM organizations
      WHERE email = NEW.email
      LIMIT 1;
      
      IF matching_org_id IS NOT NULL THEN
        -- Found matching organization
        RAISE NOTICE 'Found matching organization for admin: %', matching_org_id;
        NEW.organization_id := matching_org_id;
      ELSE
        -- Create new organization for admin
        RAISE NOTICE 'Creating new organization for admin: %', NEW.email;
        INSERT INTO organizations (name, email, is_active)
        VALUES (CONCAT(NEW.full_name, '''s Organization'), NEW.email, true)
        RETURNING id INTO matching_org_id;
        
        NEW.organization_id := matching_org_id;
        RAISE NOTICE 'Created organization: %', matching_org_id;
      END IF;
      
    -- Strategy 2: For FACULTY/STUDENT users, try to find organization by domain
    ELSIF NEW.role IN ('faculty', 'student') THEN
      RAISE NOTICE 'Faculty/Student user without organization detected: %', NEW.email;
      
      -- Try to find organization by email domain
      SELECT o.id INTO matching_org_id
      FROM organizations o
      WHERE SPLIT_PART(o.email, '@', 2) = SPLIT_PART(NEW.email, '@', 2)
        AND o.is_active = true
      LIMIT 1;
      
      IF matching_org_id IS NOT NULL THEN
        RAISE NOTICE 'Found organization by domain match: %', matching_org_id;
        NEW.organization_id := matching_org_id;
      ELSE
        -- Last resort: Use first active organization
        SELECT id INTO first_org_id
        FROM organizations
        WHERE is_active = true
        ORDER BY created_at ASC
        LIMIT 1;
        
        IF first_org_id IS NOT NULL THEN
          RAISE NOTICE 'Using first active organization: %', first_org_id;
          NEW.organization_id := first_org_id;
        ELSE
          RAISE WARNING 'No organizations found in database for user: %', NEW.email;
        END IF;
      END IF;
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger that runs BEFORE INSERT OR UPDATE
CREATE TRIGGER prevent_null_organization_trigger
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_null_organization();

-- Test the trigger
-- You can uncomment these to test:
-- INSERT INTO profiles (id, email, full_name, role)
-- VALUES (gen_random_uuid(), 'test@example.com', 'Test User', 'admin');
-- 
-- SELECT id, email, full_name, role, organization_id FROM profiles WHERE email = 'test@example.com';

COMMENT ON FUNCTION prevent_null_organization() IS 
'Automatically assigns organization_id to profiles when NULL. 
For admins: finds matching org by email or creates new one.
For faculty/students: finds org by email domain or uses first active org.';

COMMENT ON TRIGGER prevent_null_organization_trigger ON profiles IS
'Prevents NULL organization_id by auto-assigning organizations to new profiles.';

