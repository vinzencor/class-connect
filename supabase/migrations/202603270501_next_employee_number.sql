-- Add sequential employee number counter to organizations (starts at 101)
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS next_employee_number INTEGER DEFAULT 101;
