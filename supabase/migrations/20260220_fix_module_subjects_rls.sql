-- =====================================================
-- FIX: Add branch_id to module tables + Update RLS policies
-- Date: 2026-02-20
-- Description: The module_subjects, module_groups, module_files tables
--              were missed in the multi-branch migration. This adds
--              branch_id column and updates RLS policies to match
--              the branch-aware pattern used by other tables.
-- =====================================================

-- =====================================================
-- 1. Add branch_id column to module tables
-- =====================================================
ALTER TABLE module_subjects ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_module_subjects_branch ON module_subjects(branch_id);

ALTER TABLE module_groups ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_module_groups_branch ON module_groups(branch_id);

ALTER TABLE module_files ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_module_files_branch ON module_files(branch_id);

-- =====================================================
-- 2. Add price column to module_subjects (for courses)
-- =====================================================
ALTER TABLE module_subjects ADD COLUMN IF NOT EXISTS price NUMERIC DEFAULT 0;

-- =====================================================
-- 2b. Fix unique constraint to include branch_id
--     Same course name is allowed in different branches
-- =====================================================
ALTER TABLE module_subjects DROP CONSTRAINT IF EXISTS module_subjects_organization_id_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS module_subjects_org_branch_name_key
  ON module_subjects (organization_id, COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'), name);

-- =====================================================
-- 3. Drop old RLS policies on module tables
-- =====================================================

-- module_subjects
DROP POLICY IF EXISTS "Users can view module subjects in their organization" ON module_subjects;
DROP POLICY IF EXISTS "Admins can insert module subjects" ON module_subjects;
DROP POLICY IF EXISTS "Admins can update module subjects" ON module_subjects;
DROP POLICY IF EXISTS "Admins can delete module subjects" ON module_subjects;

-- module_groups
DROP POLICY IF EXISTS "Users can view module groups in their organization" ON module_groups;
DROP POLICY IF EXISTS "Admins can insert module groups" ON module_groups;
DROP POLICY IF EXISTS "Admins can update module groups" ON module_groups;
DROP POLICY IF EXISTS "Admins can delete module groups" ON module_groups;

-- module_files
DROP POLICY IF EXISTS "Users can view module files in their organization" ON module_files;
DROP POLICY IF EXISTS "Admins can insert module files" ON module_files;
DROP POLICY IF EXISTS "Admins can update module files" ON module_files;
DROP POLICY IF EXISTS "Admins can delete module files" ON module_files;

-- =====================================================
-- 4. New RLS Policies for module_subjects (branch-aware)
-- =====================================================

-- SELECT: Users can see subjects in their org.
-- If they have a current_branch_id set, only show that branch's subjects.
-- If no current_branch_id (main branch user), show all.
CREATE POLICY "Users can view module subjects"
  ON module_subjects FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    AND (
      -- If branch_id is NULL (org-wide subject), always show
      branch_id IS NULL
      OR
      -- If user has a current_branch_id set, show matching branch data
      branch_id IN (
        SELECT current_branch_id
        FROM user_branch_preferences
        WHERE user_id = auth.uid() AND current_branch_id IS NOT NULL
      )
      OR
      -- If user has no current_branch_id AND is from main branch, show all
      (
        NOT EXISTS (
          SELECT 1 FROM user_branch_preferences
          WHERE user_id = auth.uid() AND current_branch_id IS NOT NULL
        )
        AND is_user_from_main_branch(auth.uid())
      )
    )
  );

-- INSERT: Users can insert subjects in their org
CREATE POLICY "Users can insert module subjects"
  ON module_subjects FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid()
    )
  );

-- UPDATE: Users can update subjects in their org
CREATE POLICY "Users can update module subjects"
  ON module_subjects FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- DELETE: Users can delete subjects in their org
CREATE POLICY "Users can delete module subjects"
  ON module_subjects FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- =====================================================
-- 5. New RLS Policies for module_groups (branch-aware)
-- =====================================================

CREATE POLICY "Users can view module groups"
  ON module_groups FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    AND (
      branch_id IS NULL
      OR
      branch_id IN (
        SELECT current_branch_id
        FROM user_branch_preferences
        WHERE user_id = auth.uid() AND current_branch_id IS NOT NULL
      )
      OR
      (
        NOT EXISTS (
          SELECT 1 FROM user_branch_preferences
          WHERE user_id = auth.uid() AND current_branch_id IS NOT NULL
        )
        AND is_user_from_main_branch(auth.uid())
      )
    )
  );

CREATE POLICY "Users can insert module groups"
  ON module_groups FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update module groups"
  ON module_groups FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete module groups"
  ON module_groups FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- =====================================================
-- 6. New RLS Policies for module_files (branch-aware)
-- =====================================================

CREATE POLICY "Users can view module files"
  ON module_files FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    AND (
      branch_id IS NULL
      OR
      branch_id IN (
        SELECT current_branch_id
        FROM user_branch_preferences
        WHERE user_id = auth.uid() AND current_branch_id IS NOT NULL
      )
      OR
      (
        NOT EXISTS (
          SELECT 1 FROM user_branch_preferences
          WHERE user_id = auth.uid() AND current_branch_id IS NOT NULL
        )
        AND is_user_from_main_branch(auth.uid())
      )
    )
  );

CREATE POLICY "Users can insert module files"
  ON module_files FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update module files"
  ON module_files FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete module files"
  ON module_files FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );
