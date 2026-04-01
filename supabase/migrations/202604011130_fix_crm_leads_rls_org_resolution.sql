-- Fix crm_leads RLS org resolution for branch-scoped users
-- Some users may have profiles.organization_id = NULL while org is present in user_branch_preferences.

-- Backfill profile organization_id from user_branch_preferences where missing.
UPDATE profiles p
SET organization_id = ubp.organization_id
FROM user_branch_preferences ubp
WHERE p.id = ubp.user_id
  AND p.organization_id IS NULL
  AND ubp.organization_id IS NOT NULL;

-- Drop any existing INSERT/UPDATE policies to prevent hidden legacy conflicts.
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'crm_leads'
      AND cmd IN ('INSERT', 'UPDATE')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.crm_leads', pol.policyname);
  END LOOP;
END
$$;

CREATE POLICY "Users can insert crm_leads in their org"
  ON crm_leads FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = (
      SELECT COALESCE(p.organization_id, ubp.organization_id)
      FROM profiles p
      LEFT JOIN user_branch_preferences ubp ON ubp.user_id = p.id
      WHERE p.id = auth.uid()
    )
  );

CREATE POLICY "Users can update crm_leads in their org"
  ON crm_leads FOR UPDATE
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
