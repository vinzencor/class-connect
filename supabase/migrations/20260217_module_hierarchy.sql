-- Migration: Hierarchical Module System
-- Date: 2026-02-17
-- Description: Creates a 3-tier module hierarchy: Subjects -> Module Groups -> Files

-- Create module_subjects table (top-level containers)
CREATE TABLE IF NOT EXISTS module_subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, name)
);

-- Create module_groups table (folders within subjects e.g., Module 1, Module 2)
CREATE TABLE IF NOT EXISTS module_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id UUID NOT NULL REFERENCES module_subjects(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(subject_id, name)
);

-- Create module_files table (actual uploaded files)
CREATE TABLE IF NOT EXISTS module_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES module_groups(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_module_subjects_org ON module_subjects(organization_id);
CREATE INDEX IF NOT EXISTS idx_module_subjects_sort ON module_subjects(organization_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_module_groups_subject ON module_groups(subject_id);
CREATE INDEX IF NOT EXISTS idx_module_groups_org ON module_groups(organization_id);
CREATE INDEX IF NOT EXISTS idx_module_groups_sort ON module_groups(subject_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_module_files_group ON module_files(group_id);
CREATE INDEX IF NOT EXISTS idx_module_files_org ON module_files(organization_id);
CREATE INDEX IF NOT EXISTS idx_module_files_sort ON module_files(group_id, sort_order);

-- Add updated_at triggers
CREATE TRIGGER update_module_subjects_updated_at
  BEFORE UPDATE ON module_subjects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_module_groups_updated_at
  BEFORE UPDATE ON module_groups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_module_files_updated_at
  BEFORE UPDATE ON module_files
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies: Organization-scoped access

-- module_subjects policies
ALTER TABLE module_subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view module subjects in their organization"
  ON module_subjects FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Admins can insert module subjects"
  ON module_subjects FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can update module subjects"
  ON module_subjects FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can delete module subjects"
  ON module_subjects FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- module_groups policies
ALTER TABLE module_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view module groups in their organization"
  ON module_groups FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Admins can insert module groups"
  ON module_groups FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can update module groups"
  ON module_groups FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can delete module groups"
  ON module_groups FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- module_files policies
ALTER TABLE module_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view module files in their organization"
  ON module_files FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Admins can insert module files"
  ON module_files FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can update module files"
  ON module_files FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can delete module files"
  ON module_files FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Migration note: The existing 'modules' table is kept for backward compatibility.
-- Application code should transition to use the new hierarchical tables.
-- A future migration can migrate data from 'modules' to the new structure.
