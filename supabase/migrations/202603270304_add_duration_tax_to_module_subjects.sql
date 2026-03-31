-- =====================================================
-- Add Course Details to module_subjects
-- Date: 2026-03-27
-- Description: Add duration, tax_type, and tax_amount columns
--              for course pricing and billing features.
-- =====================================================

-- Add duration column
ALTER TABLE module_subjects ADD COLUMN IF NOT EXISTS duration TEXT;

-- Add tax columns
ALTER TABLE module_subjects ADD COLUMN IF NOT EXISTS tax_type TEXT DEFAULT 'none';
ALTER TABLE module_subjects ADD COLUMN IF NOT EXISTS tax_amount NUMERIC DEFAULT 0;

-- Add indexes for commonly filtered fields
CREATE INDEX IF NOT EXISTS idx_module_subjects_duration ON module_subjects(duration);
CREATE INDEX IF NOT EXISTS idx_module_subjects_tax_type ON module_subjects(tax_type);
