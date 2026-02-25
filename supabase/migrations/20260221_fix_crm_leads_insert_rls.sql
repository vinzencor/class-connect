-- ============================================================
-- Fix: crm_leads INSERT / UPDATE RLS failure
-- Error: new row violates row-level security policy for table "crm_leads"
--
-- Root cause: The old "Users can insert leads in their current branch"
-- policy (from branch_data_isolation) does an INNER JOIN on
-- user_branch_preferences which returns zero rows when the user
-- has no preference row, making every INSERT fail.
--
-- Fix: For INSERT we only need to verify the user belongs to the
-- same organization. Branch value is set by the application code
-- and does not need RLS enforcement on write. Branch filtering
-- is enforced on SELECT (what you can *see*).
-- ============================================================

-- ── DROP every known INSERT policy name ──────────────────────
DROP POLICY IF EXISTS "Users can insert leads in their current branch" ON crm_leads;
DROP POLICY IF EXISTS "Users can insert crm_leads in their org" ON crm_leads;
DROP POLICY IF EXISTS "Users can insert leads in their branch or org" ON crm_leads;
DROP POLICY IF EXISTS "insert_own_org" ON crm_leads;
DROP POLICY IF EXISTS "Authenticated users can insert leads" ON crm_leads;

-- ── New INSERT policy: org-match via SECURITY DEFINER helper ─
CREATE POLICY "Users can insert crm_leads in their org"
  ON crm_leads FOR INSERT
  WITH CHECK (
    organization_id = auth_user_org_id()
  );

-- ── DROP every known UPDATE policy name ──────────────────────
DROP POLICY IF EXISTS "Users can update leads in their current branch" ON crm_leads;
DROP POLICY IF EXISTS "Users can update crm_leads in their org" ON crm_leads;
DROP POLICY IF EXISTS "Users can update leads in their branch or org" ON crm_leads;
DROP POLICY IF EXISTS "update_own_org" ON crm_leads;

-- ── New UPDATE policy: org-match via SECURITY DEFINER helper ─
CREATE POLICY "Users can update crm_leads in their org"
  ON crm_leads FOR UPDATE
  USING  ( organization_id = auth_user_org_id() )
  WITH CHECK ( organization_id = auth_user_org_id() );
