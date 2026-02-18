-- Migration: Session Module Groups & Module Completion Tracking
-- Date: 2026-02-17
-- Description: Links sessions to hierarchical module_groups (instead of legacy modules table)
--              and tracks which modules are completed per batch

-- New join table: sessions <-> module_groups (hierarchical)
CREATE TABLE IF NOT EXISTS session_module_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  module_group_id UUID NOT NULL REFERENCES module_groups(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, module_group_id)
);

-- Module completion tracking per batch
CREATE TABLE IF NOT EXISTS module_completion (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  module_group_id UUID NOT NULL REFERENCES module_groups(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  completed_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(module_group_id, batch_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_session_module_groups_session ON session_module_groups(session_id);
CREATE INDEX IF NOT EXISTS idx_session_module_groups_group ON session_module_groups(module_group_id);
CREATE INDEX IF NOT EXISTS idx_module_completion_group ON module_completion(module_group_id);
CREATE INDEX IF NOT EXISTS idx_module_completion_batch ON module_completion(batch_id);
CREATE INDEX IF NOT EXISTS idx_module_completion_org ON module_completion(organization_id);

-- RLS for session_module_groups
ALTER TABLE session_module_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view session module groups"
  ON session_module_groups FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert session module groups"
  ON session_module_groups FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can delete session module groups"
  ON session_module_groups FOR DELETE
  TO authenticated
  USING (true);

-- RLS for module_completion
ALTER TABLE module_completion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view module completions in their org"
  ON module_completion FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert module completions in their org"
  ON module_completion FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete module completions in their org"
  ON module_completion FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );
