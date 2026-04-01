-- ============================================================
-- Migration: Combo courses and student combo assignments
-- ============================================================

CREATE TABLE IF NOT EXISTS course_combos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, name)
);

CREATE TABLE IF NOT EXISTS course_combo_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  combo_id UUID NOT NULL REFERENCES course_combos(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES module_subjects(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (combo_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_course_combo_items_combo_id
  ON course_combo_items (combo_id);

CREATE INDEX IF NOT EXISTS idx_course_combo_items_course_id
  ON course_combo_items (course_id);

CREATE TABLE IF NOT EXISTS student_combo_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  combo_id UUID NOT NULL REFERENCES course_combos(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  UNIQUE (student_id, combo_id)
);

CREATE INDEX IF NOT EXISTS idx_student_combo_assignments_student
  ON student_combo_assignments (student_id);

CREATE INDEX IF NOT EXISTS idx_student_combo_assignments_combo
  ON student_combo_assignments (combo_id);

ALTER TABLE student_enrollments
  ADD COLUMN IF NOT EXISTS combo_id UUID REFERENCES course_combos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_student_enrollments_combo
  ON student_enrollments (combo_id);

ALTER TABLE course_combos ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_combo_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_combo_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view course combos in their org"
  ON course_combos FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert course combos in their org"
  ON course_combos FOR INSERT
  WITH CHECK (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update course combos in their org"
  ON course_combos FOR UPDATE
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete course combos in their org"
  ON course_combos FOR DELETE
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can view combo items in their org"
  ON course_combo_items FOR SELECT
  USING (combo_id IN (
    SELECT id FROM course_combos
    WHERE organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  ));

CREATE POLICY "Users can insert combo items in their org"
  ON course_combo_items FOR INSERT
  WITH CHECK (combo_id IN (
    SELECT id FROM course_combos
    WHERE organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  ));

CREATE POLICY "Users can update combo items in their org"
  ON course_combo_items FOR UPDATE
  USING (combo_id IN (
    SELECT id FROM course_combos
    WHERE organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  ));

CREATE POLICY "Users can delete combo items in their org"
  ON course_combo_items FOR DELETE
  USING (combo_id IN (
    SELECT id FROM course_combos
    WHERE organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  ));

CREATE POLICY "Users can view student combo assignments in their org"
  ON student_combo_assignments FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert student combo assignments in their org"
  ON student_combo_assignments FOR INSERT
  WITH CHECK (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update student combo assignments in their org"
  ON student_combo_assignments FOR UPDATE
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete student combo assignments in their org"
  ON student_combo_assignments FOR DELETE
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE OR REPLACE FUNCTION update_course_combos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_course_combos_updated_at ON course_combos;
CREATE TRIGGER trg_update_course_combos_updated_at
  BEFORE UPDATE ON course_combos
  FOR EACH ROW
  EXECUTE FUNCTION update_course_combos_updated_at();
