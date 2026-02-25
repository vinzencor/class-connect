-- ============================================================
-- Migration: Module group faculty assignments
-- Maps faculty members to module groups and sub-groups
-- Allows filtering faculty by selected modules during scheduling
-- ============================================================

-- 1. Create module_group_faculty junction table
CREATE TABLE IF NOT EXISTS module_group_faculty (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID REFERENCES module_groups(id) ON DELETE CASCADE,
  sub_group_id UUID REFERENCES module_sub_groups(id) ON DELETE CASCADE,
  faculty_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Must belong to either a group or sub-group
  CONSTRAINT chk_mgf_group_or_subgroup
    CHECK (group_id IS NOT NULL OR sub_group_id IS NOT NULL)
);

-- Unique constraints: one faculty per group, one faculty per sub-group
CREATE UNIQUE INDEX IF NOT EXISTS unique_group_faculty
  ON module_group_faculty (group_id, faculty_id)
  WHERE group_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS unique_sub_group_faculty
  ON module_group_faculty (sub_group_id, faculty_id)
  WHERE sub_group_id IS NOT NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_mgf_group ON module_group_faculty (group_id);
CREATE INDEX IF NOT EXISTS idx_mgf_sub_group ON module_group_faculty (sub_group_id);
CREATE INDEX IF NOT EXISTS idx_mgf_faculty ON module_group_faculty (faculty_id);
CREATE INDEX IF NOT EXISTS idx_mgf_org ON module_group_faculty (organization_id);

-- 2. Enable RLS
ALTER TABLE module_group_faculty ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view module faculty in their org"
  ON module_group_faculty FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can insert module faculty"
  ON module_group_faculty FOR INSERT
  WITH CHECK (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can update module faculty"
  ON module_group_faculty FOR UPDATE
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can delete module faculty"
  ON module_group_faculty FOR DELETE
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));
