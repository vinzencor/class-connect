-- Add sales staff ownership to student details for CRM conversion attribution

ALTER TABLE student_details
  ADD COLUMN IF NOT EXISTS sales_staff_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_student_details_sales_staff_id ON student_details(sales_staff_id);
