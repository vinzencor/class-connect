-- Add batches table and RLS policies

CREATE TABLE IF NOT EXISTS batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_batches_organization_id ON batches(organization_id);

ALTER TABLE batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read batches" ON batches;
CREATE POLICY "Authenticated users can read batches"
  ON batches FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can insert batches" ON batches;
CREATE POLICY "Authenticated users can insert batches"
  ON batches FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can update batches" ON batches;
CREATE POLICY "Authenticated users can update batches"
  ON batches FOR UPDATE
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can delete batches" ON batches;
CREATE POLICY "Authenticated users can delete batches"
  ON batches FOR DELETE
  USING (auth.role() = 'authenticated');

DROP TRIGGER IF EXISTS update_batches_updated_at ON batches;
CREATE TRIGGER update_batches_updated_at BEFORE UPDATE ON batches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
