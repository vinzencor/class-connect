-- Add 'online_present' as a valid attendance status
-- This status is automatically set when a student joins a class via the Meet link

-- 1. Drop the old CHECK constraint on status
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_status_check;

-- 2. Add new CHECK constraint including 'online_present'
ALTER TABLE attendance
  ADD CONSTRAINT attendance_status_check
  CHECK (status IN ('present', 'absent', 'late', 'holiday', 'half_day', 'online_present'));

-- 3. Add comment
COMMENT ON COLUMN attendance.status IS
  'Attendance status: present, absent, late, holiday, half_day, or online_present (auto-marked when student joins via Meet link)';