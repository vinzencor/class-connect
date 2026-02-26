-- ============================================================
-- Migration: session_module_sub_groups
-- Track which sub-groups (chapters) are assigned to each session
-- ============================================================

CREATE TABLE IF NOT EXISTS session_module_sub_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  module_sub_group_id UUID NOT NULL REFERENCES module_sub_groups(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prevent duplicate assignments
CREATE UNIQUE INDEX IF NOT EXISTS unique_session_sub_group
  ON session_module_sub_groups (session_id, module_sub_group_id);

-- Indexes for lookups
CREATE INDEX IF NOT EXISTS idx_session_module_sub_groups_session
  ON session_module_sub_groups (session_id);

CREATE INDEX IF NOT EXISTS idx_session_module_sub_groups_sub_group
  ON session_module_sub_groups (module_sub_group_id);

-- Enable RLS
ALTER TABLE session_module_sub_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view session sub_groups in their org"
  ON session_module_sub_groups FOR SELECT
  USING (session_id IN (
    SELECT id FROM sessions WHERE organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  ));

CREATE POLICY "Users can insert session sub_groups in their org"
  ON session_module_sub_groups FOR INSERT
  WITH CHECK (session_id IN (
    SELECT id FROM sessions WHERE organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  ));

CREATE POLICY "Users can delete session sub_groups in their org"
  ON session_module_sub_groups FOR DELETE
  USING (session_id IN (
    SELECT id FROM sessions WHERE organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  ));
