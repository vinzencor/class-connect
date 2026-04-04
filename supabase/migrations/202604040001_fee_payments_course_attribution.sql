ALTER TABLE fee_payments
  ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES module_subjects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_fee_payments_course_id ON fee_payments(course_id);