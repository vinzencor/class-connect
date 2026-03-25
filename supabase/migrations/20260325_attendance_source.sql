-- Add attendance_source to track how attendance was marked
-- manual: marked in attendance module
-- meet_join: auto-marked when student clicks Join button
-- essl: marked via ESSL sync

ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS attendance_source TEXT;

UPDATE attendance
SET attendance_source = 'manual'
WHERE attendance_source IS NULL;

ALTER TABLE attendance
  ALTER COLUMN attendance_source SET DEFAULT 'manual',
  ALTER COLUMN attendance_source SET NOT NULL;

ALTER TABLE attendance
  DROP CONSTRAINT IF EXISTS attendance_source_check;

ALTER TABLE attendance
  ADD CONSTRAINT attendance_source_check
  CHECK (attendance_source IN ('manual', 'meet_join', 'essl'));

COMMENT ON COLUMN attendance.attendance_source IS
  'Source of attendance mark: manual, meet_join, essl';
