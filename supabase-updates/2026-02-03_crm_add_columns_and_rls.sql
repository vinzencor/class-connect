-- Migration: Add course and next_follow_up to crm_leads, create indexes and RLS policies
-- Run this in Supabase SQL editor (or psql) as a DB admin

-- 1) Add new columns (if not already present)
ALTER TABLE public.crm_leads
  ADD COLUMN IF NOT EXISTS course text,
  ADD COLUMN IF NOT EXISTS next_follow_up date;

-- 2) Add an index on organization_id for performance
CREATE INDEX IF NOT EXISTS idx_crm_leads_organization_id ON public.crm_leads (organization_id);

-- 3) Enable Row Level Security (idempotent)
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;

-- 4) Create/replace policies to ensure users can only access leads in their organization
--    Policies use the authenticated user's profile (profiles.id = auth.uid()) to check organization membership

DROP POLICY IF EXISTS select_own_org ON public.crm_leads;
CREATE POLICY select_own_org ON public.crm_leads FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.organization_id = crm_leads.organization_id
    )
  );

DROP POLICY IF EXISTS insert_own_org ON public.crm_leads;
CREATE POLICY insert_own_org ON public.crm_leads FOR INSERT
  WITH CHECK (
    (SELECT organization_id FROM public.profiles WHERE id = auth.uid()) = organization_id
  );

DROP POLICY IF EXISTS update_own_org ON public.crm_leads;
CREATE POLICY update_own_org ON public.crm_leads FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.organization_id = crm_leads.organization_id
    )
  )
  WITH CHECK (
    (SELECT organization_id FROM public.profiles WHERE id = auth.uid()) = organization_id
  );

DROP POLICY IF EXISTS delete_admin ON public.crm_leads;
CREATE POLICY delete_admin ON public.crm_leads FOR DELETE
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- 5) Ensure existing rows have default status and set a default for new rows
UPDATE public.crm_leads SET status = 'new' WHERE status IS NULL;
ALTER TABLE public.crm_leads ALTER COLUMN status SET DEFAULT 'new';

-- End of migration
