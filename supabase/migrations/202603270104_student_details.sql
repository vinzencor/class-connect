-- Migration: Student Details
-- Date: 2026-02-17
-- Description: Stores extended student registration details (1:1 with profiles)

CREATE TABLE IF NOT EXISTS student_details (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Photo
  photo_url TEXT,

  -- Personal Details
  address TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  pincode TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  gender TEXT NOT NULL,

  -- Contact
  mobile TEXT NOT NULL,
  whatsapp TEXT,
  landline TEXT,

  -- Identity
  aadhaar TEXT,

  -- Education
  qualification TEXT NOT NULL,
  graduation_year TEXT,
  graduation_college TEXT,
  admission_source TEXT,
  remarks TEXT,

  -- Parent Details
  father_name TEXT,
  mother_name TEXT,
  parent_email TEXT,
  parent_mobile TEXT NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_student_details_profile ON student_details(profile_id);
CREATE INDEX IF NOT EXISTS idx_student_details_org ON student_details(organization_id);

-- Auto-update updated_at
CREATE TRIGGER update_student_details_updated_at
  BEFORE UPDATE ON student_details
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE student_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view student details in their org"
  ON student_details FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert student details in their org"
  ON student_details FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update student details in their org"
  ON student_details FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete student details in their org"
  ON student_details FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );
