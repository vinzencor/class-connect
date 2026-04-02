-- Add gst_number column to organizations and branches tables
-- Run this in Supabase SQL Editor

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS gst_number TEXT;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS gst_number TEXT;

COMMENT ON COLUMN organizations.gst_number IS 'GST registration number for the organization (e.g., 29ABCDE1234F1Z5)';
COMMENT ON COLUMN branches.gst_number IS 'GST registration number specific to this branch, if different from org-level';
