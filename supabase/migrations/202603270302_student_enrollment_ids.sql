-- ============================================================
-- Migration: Student Number & Course Enrollment tracking
-- ============================================================

-- 1. Add student_number to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS student_number TEXT;

-- Unique per organization
CREATE UNIQUE INDEX IF NOT EXISTS unique_student_number_per_org
  ON profiles (organization_id, student_number)
  WHERE student_number IS NOT NULL;

-- 2. Add counters to organizations table
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS next_student_number INTEGER DEFAULT 1;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS next_enrollment_number INTEGER DEFAULT 1;

-- 3. Create student_enrollments table for multi-course tracking
CREATE TABLE IF NOT EXISTS student_enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES module_subjects(id) ON DELETE CASCADE,
  enrollment_number TEXT NOT NULL,
  enrollment_date DATE DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'dropped')),
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique enrollment number per org
CREATE UNIQUE INDEX IF NOT EXISTS unique_enrollment_number_per_org
  ON student_enrollments (organization_id, enrollment_number);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_student_enrollments_student
  ON student_enrollments (student_id);

CREATE INDEX IF NOT EXISTS idx_student_enrollments_course
  ON student_enrollments (course_id);

CREATE INDEX IF NOT EXISTS idx_student_enrollments_org
  ON student_enrollments (organization_id);

-- 4. Add enrollment_id to payments for linking
ALTER TABLE payments ADD COLUMN IF NOT EXISTS enrollment_id UUID REFERENCES student_enrollments(id) ON DELETE SET NULL;

-- 5. Enable RLS on student_enrollments
ALTER TABLE student_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view enrollments in their org"
  ON student_enrollments FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert enrollments in their org"
  ON student_enrollments FOR INSERT
  WITH CHECK (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update enrollments in their org"
  ON student_enrollments FOR UPDATE
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete enrollments in their org"
  ON student_enrollments FOR DELETE
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- 6. Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_student_enrollments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_student_enrollments_updated_at ON student_enrollments;
CREATE TRIGGER trg_update_student_enrollments_updated_at
  BEFORE UPDATE ON student_enrollments
  FOR EACH ROW
  EXECUTE FUNCTION update_student_enrollments_updated_at();
