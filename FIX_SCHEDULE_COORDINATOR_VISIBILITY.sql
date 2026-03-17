-- =====================================================
-- FIX: Schedule Coordinator cannot see scheduled classes
-- Date: 2026-03-17
-- =====================================================
-- What this does:
-- 1) Ensures the target profile has organization + branch.
-- 2) Cleans duplicate branch preference rows that can cause API issues.
-- 3) Adds org-scoped RLS policies for classes/sessions/batches/class_batches
--    so schedule_coordinator can read/write within the same organization.

BEGIN;

-- -----------------------------------------------------
-- 0) Set target user/org from your error log
-- -----------------------------------------------------
-- user_id: 074b2d13-01f5-496f-ae08-652109bd467b
-- org_id : 6dc83f37-cb8e-4f38-9437-992e36542212

-- -----------------------------------------------------
-- 1) Ensure profile is linked to org and branch
-- -----------------------------------------------------
UPDATE public.profiles p
SET
  organization_id = '6dc83f37-cb8e-4f38-9437-992e36542212'::uuid,
  role = COALESCE(NULLIF(p.role, ''), 'schedule_coordinator'),
  branch_id = COALESCE(
    p.branch_id,
    (
      SELECT b.id
      FROM public.branches b
      WHERE b.organization_id = '6dc83f37-cb8e-4f38-9437-992e36542212'::uuid
      ORDER BY b.is_main_branch DESC, b.created_at ASC
      LIMIT 1
    )
  ),
  updated_at = now()
WHERE p.id = '074b2d13-01f5-496f-ae08-652109bd467b'::uuid;

-- -----------------------------------------------------
-- 2) Remove duplicate user_branch_preferences rows
-- -----------------------------------------------------
DELETE FROM public.user_branch_preferences ubp
WHERE ubp.id IN (
  SELECT id
  FROM (
    SELECT id,
           row_number() OVER (
             PARTITION BY user_id, organization_id
             ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
           ) AS rn
    FROM public.user_branch_preferences
  ) x
  WHERE x.rn > 1
);

-- Keep one row per (user_id, organization_id)
CREATE UNIQUE INDEX IF NOT EXISTS user_branch_preferences_user_org_uidx
ON public.user_branch_preferences (user_id, organization_id);

-- -----------------------------------------------------
-- 3) Org-scoped policies for classes/sessions/batches
-- -----------------------------------------------------
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view classes in their org" ON public.classes;
CREATE POLICY "Users can view classes in their org"
ON public.classes FOR SELECT
USING (
  organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Users can insert classes in their org" ON public.classes;
CREATE POLICY "Users can insert classes in their org"
ON public.classes FOR INSERT
WITH CHECK (
  organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Users can update classes in their org" ON public.classes;
CREATE POLICY "Users can update classes in their org"
ON public.classes FOR UPDATE
USING (
  organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
)
WITH CHECK (
  organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Users can delete classes in their org" ON public.classes;
CREATE POLICY "Users can delete classes in their org"
ON public.classes FOR DELETE
USING (
  organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Users can view sessions in their org" ON public.sessions;
CREATE POLICY "Users can view sessions in their org"
ON public.sessions FOR SELECT
USING (
  organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Users can insert sessions in their org" ON public.sessions;
CREATE POLICY "Users can insert sessions in their org"
ON public.sessions FOR INSERT
WITH CHECK (
  organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Users can update sessions in their org" ON public.sessions;
CREATE POLICY "Users can update sessions in their org"
ON public.sessions FOR UPDATE
USING (
  organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
)
WITH CHECK (
  organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Users can delete sessions in their org" ON public.sessions;
CREATE POLICY "Users can delete sessions in their org"
ON public.sessions FOR DELETE
USING (
  organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Users can view batches in their org" ON public.batches;
CREATE POLICY "Users can view batches in their org"
ON public.batches FOR SELECT
USING (
  organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Users can view class_batches in their org" ON public.class_batches;
CREATE POLICY "Users can view class_batches in their org"
ON public.class_batches FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.classes c
    WHERE c.id = class_batches.class_id
      AND c.organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  )
);

-- -----------------------------------------------------
-- 4) Verify target user profile and session visibility
-- -----------------------------------------------------
SELECT id, email, role, organization_id, branch_id
FROM public.profiles
WHERE id = '074b2d13-01f5-496f-ae08-652109bd467b'::uuid;

SELECT count(*) AS session_count_for_org
FROM public.sessions
WHERE organization_id = '6dc83f37-cb8e-4f38-9437-992e36542212'::uuid;

COMMIT;
