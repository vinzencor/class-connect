-- =====================================================
-- Faculty Leave Management
-- Date: 2026-03-27
-- Description: Table for tracking faculty leaves/unavailability
--              Allows scheduling system to exclude unavailable faculty
-- =====================================================

CREATE TABLE IF NOT EXISTS faculty_leaves (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  faculty_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT check_dates CHECK (end_date >= start_date),
  UNIQUE(organization_id, faculty_id, start_date, end_date)
);

-- Indexes for quick lookups
CREATE INDEX IF NOT EXISTS idx_faculty_leaves_org ON faculty_leaves(organization_id);
CREATE INDEX IF NOT EXISTS idx_faculty_leaves_faculty ON faculty_leaves(faculty_id);
CREATE INDEX IF NOT EXISTS idx_faculty_leaves_dates ON faculty_leaves(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_faculty_leaves_branch ON faculty_leaves(branch_id);
CREATE INDEX IF NOT EXISTS idx_faculty_leaves_status ON faculty_leaves(status);

-- =====================================================
-- RLS Policies for faculty_leaves
-- =====================================================

ALTER TABLE faculty_leaves ENABLE ROW LEVEL SECURITY;

-- Users can view leaves from their organization
CREATE POLICY "Users can view faculty leaves in their organization"
  ON faculty_leaves FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));

-- Admins can manage leaves
CREATE POLICY "Admins can manage faculty leaves"
  ON faculty_leaves FOR ALL
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'schedule_coordinator') OR
    faculty_id = auth.uid()
  )
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'schedule_coordinator') OR
    faculty_id = auth.uid()
  );

-- Faculty can view and create their own leaves
CREATE POLICY "Faculty can manage own leaves"
  ON faculty_leaves FOR ALL
  USING (faculty_id = auth.uid())
  WITH CHECK (faculty_id = auth.uid());
