-- ============================================================
-- Migration: Add explicit price for course combos
-- ============================================================

ALTER TABLE course_combos
  ADD COLUMN IF NOT EXISTS price NUMERIC(12,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_course_combos_price
  ON course_combos (price);
