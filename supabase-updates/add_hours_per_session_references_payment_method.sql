-- Migration: Add hours_per_session to organizations, create references table, add payment_method to student_registrations
-- Date: 2026-03-05

-- 1. Add hours_per_session to organizations table (default 3 hours)
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS hours_per_session numeric DEFAULT 3 NOT NULL;

-- 2. Create references table for managing reference dropdown options
CREATE TABLE IF NOT EXISTS references_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_references_list_org_id ON references_list(organization_id);

-- Enable RLS
ALTER TABLE references_list ENABLE ROW LEVEL SECURITY;

-- RLS Policies for references_list (same pattern as admission_sources)
CREATE POLICY "Users can view references in their organization"
  ON references_list
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert references"
  ON references_list
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can update references"
  ON references_list
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can delete references"
  ON references_list
  FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- 3. Add payment_method to student_registrations
ALTER TABLE student_registrations ADD COLUMN IF NOT EXISTS payment_method TEXT;
