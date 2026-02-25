-- ============================================================
-- Migration: Add session-based attendance & expanded statuses
-- ============================================================

-- 1. Add session column to attendance table
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS session TEXT DEFAULT NULL;

-- 2. Drop old unique constraint and create new one that includes session
-- Drop old partial index for login attendance
DROP INDEX IF EXISTS unique_daily_login_attendance;

-- Drop old unique constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'unique_student_date_class' 
    AND conrelid = 'attendance'::regclass
  ) THEN
    ALTER TABLE attendance DROP CONSTRAINT unique_student_date_class;
  END IF;
END $$;

-- Create new unique constraint including session
CREATE UNIQUE INDEX IF NOT EXISTS unique_attendance_student_date_session
  ON attendance (student_id, date, organization_id, COALESCE(session, 'full'), COALESCE(class_id, '00000000-0000-0000-0000-000000000000'));

-- 3. Add comment for documentation
COMMENT ON COLUMN attendance.session IS 'Session for multi-session attendance: morning, evening, night, or NULL for full-day';
