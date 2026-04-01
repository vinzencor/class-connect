-- Fix student_registrations RLS for branch-scoped users and stale client org payloads.
-- This mirrors the crm_leads fix pattern.

-- Backfill profile organization_id from user_branch_preferences where missing.
UPDATE profiles p
SET organization_id = ubp.organization_id
FROM user_branch_preferences ubp
WHERE p.id = ubp.user_id
  AND p.organization_id IS NULL
  AND ubp.organization_id IS NOT NULL;

ALTER TABLE public.student_registrations ENABLE ROW LEVEL SECURITY;

-- Remove all legacy/conflicting policies on student_registrations.
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'student_registrations'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.student_registrations', pol.policyname);
  END LOOP;
END
$$;

CREATE POLICY "Users can view student_registrations in their org"
  ON public.student_registrations FOR SELECT
  TO authenticated
  USING (
    organization_id = (
      SELECT COALESCE(p.organization_id, ubp.organization_id)
      FROM public.profiles p
      LEFT JOIN public.user_branch_preferences ubp ON ubp.user_id = p.id
      WHERE p.id = auth.uid()
    )
  );

CREATE POLICY "Users can insert student_registrations in their org"
  ON public.student_registrations FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = (
      SELECT COALESCE(p.organization_id, ubp.organization_id)
      FROM public.profiles p
      LEFT JOIN public.user_branch_preferences ubp ON ubp.user_id = p.id
      WHERE p.id = auth.uid()
    )
  );

CREATE POLICY "Users can update student_registrations in their org"
  ON public.student_registrations FOR UPDATE
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

-- Keep public token-based access intact for registration form.
CREATE POLICY "Anonymous can view registration by token"
  ON public.student_registrations FOR SELECT
  TO anon
  USING (true);

CREATE OR REPLACE FUNCTION public.set_student_registration_org_from_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  SELECT COALESCE(p.organization_id, ubp.organization_id)
  INTO v_org_id
  FROM profiles p
  LEFT JOIN user_branch_preferences ubp ON ubp.user_id = p.id
  WHERE p.id = auth.uid()
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Unable to resolve organization for current user';
  END IF;

  NEW.organization_id := v_org_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_student_registration_org_from_auth ON public.student_registrations;
CREATE TRIGGER trg_set_student_registration_org_from_auth
BEFORE INSERT ON public.student_registrations
FOR EACH ROW
EXECUTE FUNCTION public.set_student_registration_org_from_auth();
