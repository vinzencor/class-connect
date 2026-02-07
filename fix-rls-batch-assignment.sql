-- =====================================================
-- FIX: RLS Policy for Batch Assignment
-- =====================================================
-- Problem: Admins cannot update other users' profiles (including batch assignments)
-- because the UPDATE policy only allows users to update their own profile
--
-- Solution: Add a policy that allows admins to update profiles in their organization

-- =====================================================
-- STEP 1: Check Current UPDATE Policies
-- =====================================================
SELECT 
  policyname, 
  cmd, 
  qual, 
  with_check 
FROM pg_policies 
WHERE tablename = 'profiles' AND cmd = 'UPDATE';

-- =====================================================
-- STEP 2: Add Admin Update Policy
-- =====================================================
-- This allows admins to update any profile in their organization

DROP POLICY IF EXISTS "Admins can update profiles in their organization" ON profiles;

CREATE POLICY "Admins can update profiles in their organization"
ON profiles
FOR UPDATE
TO authenticated
USING (
  -- Allow if the current user is an admin in the same organization
  EXISTS (
    SELECT 1 
    FROM profiles admin_profile
    WHERE admin_profile.id = auth.uid()
      AND admin_profile.role = 'admin'
      AND admin_profile.organization_id = profiles.organization_id
  )
)
WITH CHECK (
  -- Same check for the updated data
  EXISTS (
    SELECT 1 
    FROM profiles admin_profile
    WHERE admin_profile.id = auth.uid()
      AND admin_profile.role = 'admin'
      AND admin_profile.organization_id = profiles.organization_id
  )
);

-- =====================================================
-- STEP 3: Verify the Policy Was Created
-- =====================================================
SELECT 
  policyname, 
  cmd, 
  qual, 
  with_check 
FROM pg_policies 
WHERE tablename = 'profiles' AND cmd = 'UPDATE'
ORDER BY policyname;

-- =====================================================
-- STEP 4: Test the Fix (Optional)
-- =====================================================
-- After running the policy, you should be able to update student profiles
-- Try this query to verify (replace with actual IDs):

-- UPDATE profiles
-- SET metadata = '{"batch_id": "d1480322-70f9-41cd-9b71-81a2827412a1"}'::jsonb
-- WHERE id = '5a1e8ffb-f11b-43d8-b654-ddf44df544ae';

-- If this works, the policy is correct!

-- =====================================================
-- ALTERNATIVE: More Permissive Policy (Use with Caution)
-- =====================================================
-- If you want to allow faculty to also update student profiles:

-- DROP POLICY IF EXISTS "Admins and faculty can update profiles in their organization" ON profiles;
-- 
-- CREATE POLICY "Admins and faculty can update profiles in their organization"
-- ON profiles
-- FOR UPDATE
-- TO authenticated
-- USING (
--   EXISTS (
--     SELECT 1 
--     FROM profiles user_profile
--     WHERE user_profile.id = auth.uid()
--       AND user_profile.role IN ('admin', 'faculty')
--       AND user_profile.organization_id = profiles.organization_id
--   )
-- )
-- WITH CHECK (
--   EXISTS (
--     SELECT 1 
--     FROM profiles user_profile
--     WHERE user_profile.id = auth.uid()
--       AND user_profile.role IN ('admin', 'faculty')
--       AND user_profile.organization_id = profiles.organization_id
--   )
-- );

-- =====================================================
-- NOTES
-- =====================================================
-- 1. The policy uses USING clause to check if the current user can read/select the row
-- 2. The WITH CHECK clause validates the updated data
-- 3. Both clauses check that:
--    - The current user (auth.uid()) is an admin
--    - The admin is in the same organization as the profile being updated
-- 4. This ensures admins can only update profiles in their own organization
-- 5. Students can still update their own profiles via the existing "Users can update own profile" policy

