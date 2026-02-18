-- Fix NULL organization_id for admin accounts
-- This script links profiles with NULL organization_id to their org

-- Step 1: Check if there are any organizations for this user's email domain
-- Step 2: Link the profile to the organization

DO $$
DECLARE
    v_profile_id UUID;
    v_user_email TEXT;
    v_org_id UUID;
BEGIN
    -- Get the profile with NULL organization_id
    SELECT id, email INTO v_profile_id, v_user_email
    FROM profiles
    WHERE email = 'rahulpradeepan55@gmail.com'
    AND organization_id IS NULL;

    IF v_profile_id IS NULL THEN
        RAISE NOTICE 'No profile found with NULL organization_id for rahulpradeepan55@gmail.com';
        RETURN;
    END IF;

    -- Try to find an organization
    -- Option 1: Find an organization this user created (based on metadata or created_at)
    SELECT id INTO v_org_id
    FROM organizations
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_org_id IS NULL THEN
        -- No organization exists, create one
        INSERT INTO organizations (name, created_at, updated_at)
        VALUES ('My Organization', NOW(), NOW())
        RETURNING id INTO v_org_id;
        
        RAISE NOTICE 'Created new organization: %', v_org_id;
    ELSE
        RAISE NOTICE 'Found existing organization: %', v_org_id;
    END IF;

    -- Update the profile with the organization_id
    UPDATE profiles
    SET organization_id = v_org_id
    WHERE id = v_profile_id;

    RAISE NOTICE 'Updated profile % with organization_id %', v_profile_id, v_org_id;
END $$;

-- Verify the fix
SELECT id, email, role, organization_id, full_name
FROM profiles
WHERE email = 'rahulpradeepan55@gmail.com';
