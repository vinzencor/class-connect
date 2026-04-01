-- Ensure crm_leads inserts always use the authenticated user's organization.
-- This prevents client-side org mismatches from tripping INSERT RLS.

CREATE OR REPLACE FUNCTION public.set_crm_lead_org_from_auth()
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

DROP TRIGGER IF EXISTS trg_set_crm_lead_org_from_auth ON public.crm_leads;
CREATE TRIGGER trg_set_crm_lead_org_from_auth
BEFORE INSERT ON public.crm_leads
FOR EACH ROW
EXECUTE FUNCTION public.set_crm_lead_org_from_auth();
