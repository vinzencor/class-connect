-- Fix: Profiles Table Foreign Key Constraint
-- This script fixes the foreign key constraint issue where profiles table
-- references 'users' table instead of 'auth.users'

-- Step 1: Check current constraint (for diagnostic purposes)
-- Run this to see what the current constraint looks like:
-- SELECT conname, conrelid::regclass, confrelid::regclass, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conname = 'profiles_id_fkey';

-- Step 2: Drop the incorrect foreign key constraint if it exists
ALTER TABLE IF EXISTS profiles
DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- Step 3: Add the correct foreign key constraint referencing auth.users
ALTER TABLE profiles
ADD CONSTRAINT profiles_id_fkey 
FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 4: Verify the constraint is correct
-- You can run this to verify:
-- SELECT conname, conrelid::regclass, confrelid::regclass, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conname = 'profiles_id_fkey';

-- Step 5: Create or replace the trigger function to auto-create profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, organization_id, email, full_name, role, is_active, created_at, updated_at)
  VALUES (
    NEW.id,
    NULL, -- organization_id will be set later
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'student'),
    true,
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 6: Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Step 7: Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Note: After running this script, the foreign key constraint will be correct
-- and the trigger will automatically create profile records when new auth users are created.
