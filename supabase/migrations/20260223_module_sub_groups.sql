-- ============================================================
-- Migration: Module sub-groups (3rd level hierarchy)
-- Subject → Group → Sub-Group → Files
-- ============================================================

-- 1. Create module_sub_groups table
CREATE TABLE IF NOT EXISTS module_sub_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES module_groups(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique name per group
CREATE UNIQUE INDEX IF NOT EXISTS unique_sub_group_name_per_group
  ON module_sub_groups (group_id, name);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_module_sub_groups_group
  ON module_sub_groups (group_id);

CREATE INDEX IF NOT EXISTS idx_module_sub_groups_org
  ON module_sub_groups (organization_id);

-- 2. Add sub_group_id to module_files (files can belong to group OR sub-group)
ALTER TABLE module_files ADD COLUMN IF NOT EXISTS sub_group_id UUID REFERENCES module_sub_groups(id) ON DELETE CASCADE;

-- Make group_id nullable (files can belong to sub_group instead)
ALTER TABLE module_files ALTER COLUMN group_id DROP NOT NULL;

-- Add check constraint: file must belong to either group or sub-group
ALTER TABLE module_files ADD CONSTRAINT chk_file_belongs_to_group_or_subgroup
  CHECK (group_id IS NOT NULL OR sub_group_id IS NOT NULL);

-- Index for sub_group files
CREATE INDEX IF NOT EXISTS idx_module_files_sub_group
  ON module_files (sub_group_id);

-- 3. Enable RLS on module_sub_groups
ALTER TABLE module_sub_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view sub_groups in their org"
  ON module_sub_groups FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert sub_groups in their org"
  ON module_sub_groups FOR INSERT
  WITH CHECK (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update sub_groups in their org"
  ON module_sub_groups FOR UPDATE
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete sub_groups in their org"
  ON module_sub_groups FOR DELETE
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- 4. Auto-update trigger
CREATE OR REPLACE FUNCTION update_module_sub_groups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_module_sub_groups_updated_at ON module_sub_groups;
CREATE TRIGGER trg_update_module_sub_groups_updated_at
  BEFORE UPDATE ON module_sub_groups
  FOR EACH ROW
  EXECUTE FUNCTION update_module_sub_groups_updated_at();
