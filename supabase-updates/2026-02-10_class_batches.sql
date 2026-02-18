-- Migration: Add class_batches junction table for many-to-many relationship
-- Date: 2026-02-10
-- Description: Allows classes to be assigned to multiple batches

-- Create class_batches junction table
CREATE TABLE IF NOT EXISTS class_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(class_id, batch_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_class_batches_class_id ON class_batches(class_id);
CREATE INDEX IF NOT EXISTS idx_class_batches_batch_id ON class_batches(batch_id);

-- Enable Row Level Security
ALTER TABLE class_batches ENABLE ROW LEVEL SECURITY;

-- Create policies for class_batches
-- Allow authenticated users to read class_batches
CREATE POLICY "Allow authenticated users to read class_batches"
    ON class_batches FOR SELECT
    TO authenticated
    USING (true);

-- Allow authenticated users to insert class_batches
CREATE POLICY "Allow authenticated users to insert class_batches"
    ON class_batches FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Allow authenticated users to update class_batches
CREATE POLICY "Allow authenticated users to update class_batches"
    ON class_batches FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Allow authenticated users to delete class_batches
CREATE POLICY "Allow authenticated users to delete class_batches"
    ON class_batches FOR DELETE
    TO authenticated
    USING (true);

-- Add comment to table
COMMENT ON TABLE class_batches IS 'Junction table linking classes to batches (many-to-many)';
