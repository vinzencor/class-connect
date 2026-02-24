-- Add short_name column to profiles for faculty display names
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS short_name TEXT;

-- Add a comment for documentation
COMMENT ON COLUMN profiles.short_name IS 'Optional short/display name for faculty shown in schedules, sessions, etc.';
