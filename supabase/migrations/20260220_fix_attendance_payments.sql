-- =====================================================
-- FIX: Make attendance.class_id nullable for daily attendance,
-- update unique constraints, and fix RLS policies
-- Date: 2026-02-20
-- =====================================================

-- Make class_id nullable (daily attendance doesn't require a class)
ALTER TABLE attendance ALTER COLUMN class_id DROP NOT NULL;

-- Drop old unique constraint that requires class_id
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_class_id_student_id_date_key;

-- Create new unique index that handles null class_id
CREATE UNIQUE INDEX IF NOT EXISTS attendance_student_date_class_key
  ON attendance (student_id, date, COALESCE(class_id, '00000000-0000-0000-0000-000000000000'));

-- Partial unique index to prevent duplicate login attendance (class_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS attendance_login_unique
  ON attendance (student_id, date, organization_id) WHERE class_id IS NULL;

-- Add branch_id to payments if not exists (should already exist but safe)
ALTER TABLE payments ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

-- =====================================================
-- Fix RLS policies: Use org-level check for INSERT/UPDATE/DELETE
-- so any user in the org can write attendance regardless of branch.
-- SELECT still allows viewing own-branch or null-branch records.
-- =====================================================

-- ---------- ATTENDANCE ----------
DROP POLICY IF EXISTS "Users can insert attendance in their current branch" ON attendance;
CREATE POLICY "Users can insert attendance in their org" ON attendance
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can view attendance in their current branch" ON attendance;
CREATE POLICY "Users can view attendance in their org" ON attendance
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update attendance in their current branch" ON attendance;
CREATE POLICY "Users can update attendance in their org" ON attendance
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete attendance in their current branch" ON attendance;
CREATE POLICY "Users can delete attendance in their org" ON attendance
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ---------- PAYMENTS ----------
DROP POLICY IF EXISTS "Users can insert payments in their current branch" ON payments;
DROP POLICY IF EXISTS "Users can insert payments in their org" ON payments;
CREATE POLICY "Users can insert payments in their org" ON payments
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can view payments in their current branch" ON payments;
DROP POLICY IF EXISTS "Users can view payments in their org" ON payments;
CREATE POLICY "Users can view payments in their org" ON payments
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update payments in their current branch" ON payments;
DROP POLICY IF EXISTS "Users can update payments in their org" ON payments;
CREATE POLICY "Users can update payments in their org" ON payments
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete payments in their current branch" ON payments;
DROP POLICY IF EXISTS "Users can delete payments in their org" ON payments;
CREATE POLICY "Users can delete payments in their org" ON payments
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ---------- CLASSES ----------
DROP POLICY IF EXISTS "Users can insert classes in their current branch" ON classes;
DROP POLICY IF EXISTS "Users can insert classes in their org" ON classes;
CREATE POLICY "Users can insert classes in their org" ON classes
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update classes in their current branch" ON classes;
DROP POLICY IF EXISTS "Users can update classes in their org" ON classes;
CREATE POLICY "Users can update classes in their org" ON classes
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ---------- BATCHES ----------
DROP POLICY IF EXISTS "Users can insert batches in their current branch" ON batches;
DROP POLICY IF EXISTS "Users can insert batches in their org" ON batches;
CREATE POLICY "Users can insert batches in their org" ON batches
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update batches in their current branch" ON batches;
DROP POLICY IF EXISTS "Users can update batches in their org" ON batches;
CREATE POLICY "Users can update batches in their org" ON batches
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ---------- CRM LEADS ----------
DROP POLICY IF EXISTS "Users can insert crm_leads in their current branch" ON crm_leads;
DROP POLICY IF EXISTS "Users can insert crm_leads in their org" ON crm_leads;
CREATE POLICY "Users can insert crm_leads in their org" ON crm_leads
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update crm_leads in their current branch" ON crm_leads;
DROP POLICY IF EXISTS "Users can update crm_leads in their org" ON crm_leads;
CREATE POLICY "Users can update crm_leads in their org" ON crm_leads
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ---------- STUDENT REGISTRATIONS ----------
DROP POLICY IF EXISTS "Users can insert student_registrations in their current branch" ON student_registrations;
DROP POLICY IF EXISTS "Users can insert student_registrations in their org" ON student_registrations;
CREATE POLICY "Users can insert student_registrations in their org" ON student_registrations
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update student_registrations in their current branch" ON student_registrations;
DROP POLICY IF EXISTS "Users can update student_registrations in their org" ON student_registrations;
CREATE POLICY "Users can update student_registrations in their org" ON student_registrations
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );
