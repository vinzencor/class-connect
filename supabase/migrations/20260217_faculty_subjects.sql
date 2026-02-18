-- Migration: Faculty Subject Mapping
-- Date: 2026-02-17
-- Description: Links faculty members to subjects they can teach (many-to-many)

CREATE TABLE IF NOT EXISTS faculty_subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  faculty_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES module_subjects(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(faculty_id, subject_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_faculty_subjects_faculty ON faculty_subjects(faculty_id);
CREATE INDEX IF NOT EXISTS idx_faculty_subjects_subject ON faculty_subjects(subject_id);
CREATE INDEX IF NOT EXISTS idx_faculty_subjects_org ON faculty_subjects(organization_id);

-- RLS
ALTER TABLE faculty_subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view faculty subjects in their org"
  ON faculty_subjects FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can manage faculty subjects in their org"
  ON faculty_subjects FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update faculty subjects in their org"
  ON faculty_subjects FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete faculty subjects in their org"
  ON faculty_subjects FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );
