-- Reset crm_leads RLS policies to remove hidden legacy/conflicting policies.
-- Some older migrations may leave FOR ALL / restrictive policies that still block inserts.

ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'crm_leads'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.crm_leads', pol.policyname);
  END LOOP;
END
$$;

CREATE POLICY "Users can view crm_leads in their org"
  ON public.crm_leads FOR SELECT
  TO authenticated
  USING (
    organization_id = (
      SELECT COALESCE(p.organization_id, ubp.organization_id)
      FROM public.profiles p
      LEFT JOIN public.user_branch_preferences ubp ON ubp.user_id = p.id
      WHERE p.id = auth.uid()
    )
  );

CREATE POLICY "Users can insert crm_leads in their org"
  ON public.crm_leads FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = (
      SELECT COALESCE(p.organization_id, ubp.organization_id)
      FROM public.profiles p
      LEFT JOIN public.user_branch_preferences ubp ON ubp.user_id = p.id
      WHERE p.id = auth.uid()
    )
  );

CREATE POLICY "Users can update crm_leads in their org"
  ON public.crm_leads FOR UPDATE
  TO authenticated
  USING (
    organization_id = (
      SELECT COALESCE(p.organization_id, ubp.organization_id)
      FROM public.profiles p
      LEFT JOIN public.user_branch_preferences ubp ON ubp.user_id = p.id
      WHERE p.id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id = (
      SELECT COALESCE(p.organization_id, ubp.organization_id)
      FROM public.profiles p
      LEFT JOIN public.user_branch_preferences ubp ON ubp.user_id = p.id
      WHERE p.id = auth.uid()
    )
  );

CREATE POLICY "Admins can delete crm_leads in their org"
  ON public.crm_leads FOR DELETE
  TO authenticated
  USING (
    organization_id = (
      SELECT COALESCE(p.organization_id, ubp.organization_id)
      FROM public.profiles p
      LEFT JOIN public.user_branch_preferences ubp ON ubp.user_id = p.id
      WHERE p.id = auth.uid()
    )
    AND (
      SELECT p.role
      FROM public.profiles p
      WHERE p.id = auth.uid()
    ) = 'admin'
  );
