-- Fix: handle_new_user trigger function
-- The previous version may crash on INSERT (e.g., invalid organization_id UUID cast)
-- which rolls back the entire auth.users INSERT, preventing user creation.
--
-- This version:
-- 1. Uses a robust EXCEPTION handler so auth.users INSERT never fails
-- 2. Uses ON CONFLICT to handle re-runs gracefully
-- 3. Casts organization_id safely (NULL on failure instead of crash)
-- 4. Logs warnings instead of crashing

-- Drop and recreate the trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  _org_id UUID;
BEGIN
  -- Safely cast organization_id (returns NULL if invalid, won't crash)
  BEGIN
    _org_id := (NEW.raw_user_meta_data->>'organization_id')::UUID;
  EXCEPTION WHEN OTHERS THEN
    _org_id := NULL;
  END;

  INSERT INTO public.profiles (
    id, email, full_name, role, organization_id, is_active, metadata, created_at, updated_at
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'student'),
    _org_id,
    true,
    COALESCE(
      (NEW.raw_user_meta_data - 'full_name' - 'role' - 'organization_id'),
      '{}'::jsonb
    ),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email       = EXCLUDED.email,
    full_name   = EXCLUDED.full_name,
    role        = EXCLUDED.role,
    organization_id = COALESCE(EXCLUDED.organization_id, profiles.organization_id),
    updated_at  = NOW();

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- NEVER let the trigger crash — that would roll back the auth.users INSERT
  RAISE WARNING 'handle_new_user trigger error for user %: % (SQLSTATE %)', NEW.id, SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
