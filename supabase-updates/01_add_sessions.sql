-- =====================================================
-- MIGRATION: 01_add_sessions.sql
-- Adds support for specific class sessions and linking modules
-- =====================================================

-- =====================================================
-- TABLE: sessions
-- specific occurrences of classes
-- =====================================================
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  faculty_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  meet_link TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLE: session_modules
-- link modules to specific sessions
-- =====================================================
CREATE TABLE IF NOT EXISTS session_modules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, module_id)
);

-- =====================================================
-- RLS POLICIES: sessions
-- =====================================================

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read sessions
CREATE POLICY "Authenticated users can read sessions"
  ON sessions FOR SELECT
  USING (auth.role() = 'authenticated');

-- Authenticated users can insert sessions
CREATE POLICY "Authenticated users can insert sessions"
  ON sessions FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Authenticated users can update sessions
CREATE POLICY "Authenticated users can update sessions"
  ON sessions FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Authenticated users can delete sessions
CREATE POLICY "Authenticated users can delete sessions"
  ON sessions FOR DELETE
  USING (auth.role() = 'authenticated');

-- =====================================================
-- RLS POLICIES: session_modules
-- =====================================================

ALTER TABLE session_modules ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read session_modules
CREATE POLICY "Authenticated users can read session_modules"
  ON session_modules FOR SELECT
  USING (auth.role() = 'authenticated');

-- Authenticated users can insert session_modules
CREATE POLICY "Authenticated users can insert session_modules"
  ON session_modules FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Authenticated users can update session_modules
CREATE POLICY "Authenticated users can update session_modules"
  ON session_modules FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Authenticated users can delete session_modules
CREATE POLICY "Authenticated users can delete session_modules"
  ON session_modules FOR DELETE
  USING (auth.role() = 'authenticated');

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_sessions_organization_id ON sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_sessions_faculty_id ON sessions(faculty_id);
CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON sessions(start_time);
