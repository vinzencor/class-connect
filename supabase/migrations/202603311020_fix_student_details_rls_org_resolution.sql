-- Fix student_details RLS for branch-scoped staff (e.g., sales_staff)
-- Some users may have profiles.organization_id = NULL.
-- Resolve current user's org using COALESCE(profile.org_id, user_branch_preferences.org_id).

-- Backfill profile organization_id from user branch preferences for existing users.
UPDATE profiles p
SET organization_id = ubp.organization_id
FROM user_branch_preferences ubp
WHERE p.id = ubp.user_id
  AND p.organization_id IS NULL
  AND ubp.organization_id IS NOT NULL;

DROP POLICY IF EXISTS "Users can view student details in their org" ON student_details;
DROP POLICY IF EXISTS "Users can insert student details in their org" ON student_details;
DROP POLICY IF EXISTS "Users can update student details in their org" ON student_details;
DROP POLICY IF EXISTS "Users can delete student details in their org" ON student_details;

CREATE POLICY "Users can view student details in their org"
  ON student_details FOR SELECT
  TO authenticated
  USING (
    organization_id = (
      SELECT COALESCE(p.organization_id, ubp.organization_id)
      FROM profiles p
      LEFT JOIN user_branch_preferences ubp ON ubp.user_id = p.id
      WHERE p.id = auth.uid()
    )
  );

CREATE POLICY "Users can insert student details in their org"
  ON student_details FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = (
      SELECT COALESCE(p.organization_id, ubp.organization_id)
      FROM profiles p
      LEFT JOIN user_branch_preferences ubp ON ubp.user_id = p.id
      WHERE p.id = auth.uid()
    )
  );

CREATE POLICY "Users can update student details in their org"
  ON student_details FOR UPDATE
  TO authenticated
  USING (
    organization_id = (
      SELECT COALESCE(p.organization_id, ubp.organization_id)
      FROM profiles p
      LEFT JOIN user_branch_preferences ubp ON ubp.user_id = p.id
      WHERE p.id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id = (
      SELECT COALESCE(p.organization_id, ubp.organization_id)
      FROM profiles p
      LEFT JOIN user_branch_preferences ubp ON ubp.user_id = p.id
      WHERE p.id = auth.uid()
    )
  );

CREATE POLICY "Users can delete student details in their org"
  ON student_details FOR DELETE
  TO authenticated
  USING (
    organization_id = (
      SELECT COALESCE(p.organization_id, ubp.organization_id)
      FROM profiles p
      LEFT JOIN user_branch_preferences ubp ON ubp.user_id = p.id
      WHERE p.id = auth.uid()
    )
  );
