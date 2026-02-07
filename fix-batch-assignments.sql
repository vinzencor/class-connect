-- =====================================================
-- Batch Assignment Normalization Script
-- =====================================================
-- This script helps normalize batch assignments in the profiles.metadata field
-- Run this in Supabase SQL Editor if you need to bulk-update batch assignments

-- =====================================================
-- STEP 1: View Current Batch Assignments
-- =====================================================
-- Check all students and their current batch assignments
SELECT 
  p.id,
  p.full_name,
  p.email,
  p.metadata,
  p.metadata->>'batch_id' as batch_id_uuid,
  p.metadata->>'batch' as batch_name_legacy,
  p.metadata->>'batchId' as batch_id_camelcase
FROM profiles p
WHERE p.role = 'student'
ORDER BY p.full_name;

-- =====================================================
-- STEP 2: View Batches
-- =====================================================
-- List all available batches
SELECT 
  id,
  name,
  description,
  organization_id,
  created_at
FROM batches
ORDER BY created_at DESC;

-- =====================================================
-- STEP 3: Assign Students to a Specific Batch (Example)
-- =====================================================
-- Replace the UUIDs below with actual values from your database

-- Example: Assign "meenaakshyyy" to "BATCH A"
-- UPDATE profiles
-- SET metadata = jsonb_set(
--   COALESCE(metadata, '{}'::jsonb),
--   '{batch_id}',
--   '"d1480322-70f9-41cd-9b71-81a2827412a1"'::jsonb
-- )
-- WHERE id = '5a1e8ffb-f11b-43d8-b654-ddf44df544ae';

-- Example: Assign "NEWWWWWW" to "BATCH A"
-- UPDATE profiles
-- SET metadata = jsonb_set(
--   COALESCE(metadata, '{}'::jsonb),
--   '{batch_id}',
--   '"d1480322-70f9-41cd-9b71-81a2827412a1"'::jsonb
-- )
-- WHERE id = '36316cfa-8b2c-4d2c-b96d-b574a8d5f16f';

-- =====================================================
-- STEP 4: Normalize Legacy Batch Assignments
-- =====================================================
-- This converts old format {"batch": "name"} to new format {"batch_id": "uuid"}
-- Only run this if you have legacy data with batch names instead of IDs

-- First, check if there are any legacy assignments
SELECT 
  p.id,
  p.full_name,
  p.metadata->>'batch' as legacy_batch_name,
  b.id as batch_uuid,
  b.name as batch_name
FROM profiles p
LEFT JOIN batches b ON LOWER(TRIM(b.name)) = LOWER(TRIM(p.metadata->>'batch'))
WHERE p.role = 'student' 
  AND p.metadata->>'batch' IS NOT NULL
  AND p.metadata->>'batch_id' IS NULL;

-- Then, migrate them (uncomment to run)
-- UPDATE profiles p
-- SET metadata = jsonb_set(
--   metadata - 'batch',  -- Remove old 'batch' key
--   '{batch_id}',
--   to_jsonb(b.id::text)
-- )
-- FROM batches b
-- WHERE p.role = 'student'
--   AND p.metadata->>'batch' IS NOT NULL
--   AND p.metadata->>'batch_id' IS NULL
--   AND LOWER(TRIM(b.name)) = LOWER(TRIM(p.metadata->>'batch'))
--   AND p.organization_id = b.organization_id;

-- =====================================================
-- STEP 5: Fix camelCase 'batchId' to 'batch_id'
-- =====================================================
-- This converts {"batchId": "uuid"} to {"batch_id": "uuid"}

-- First, check if there are any camelCase assignments
SELECT 
  id,
  full_name,
  metadata->>'batchId' as camelcase_batch_id
FROM profiles
WHERE role = 'student' 
  AND metadata->>'batchId' IS NOT NULL
  AND metadata->>'batch_id' IS NULL;

-- Then, migrate them (uncomment to run)
-- UPDATE profiles
-- SET metadata = jsonb_set(
--   metadata - 'batchId',  -- Remove old 'batchId' key
--   '{batch_id}',
--   metadata->'batchId'
-- )
-- WHERE role = 'student'
--   AND metadata->>'batchId' IS NOT NULL
--   AND metadata->>'batch_id' IS NULL;

-- =====================================================
-- STEP 6: Verify All Batch Assignments
-- =====================================================
-- Check that all students have valid batch assignments
SELECT 
  p.id,
  p.full_name,
  p.email,
  p.metadata->>'batch_id' as batch_id,
  b.name as batch_name,
  CASE 
    WHEN p.metadata->>'batch_id' IS NULL THEN '❌ No batch assigned'
    WHEN b.id IS NULL THEN '⚠️ Invalid batch ID'
    ELSE '✅ Valid assignment'
  END as status
FROM profiles p
LEFT JOIN batches b ON b.id = (p.metadata->>'batch_id')::uuid
WHERE p.role = 'student'
ORDER BY status, p.full_name;

-- =====================================================
-- STEP 7: Count Students per Batch
-- =====================================================
-- See how many students are in each batch
SELECT 
  b.id,
  b.name,
  COUNT(p.id) as student_count
FROM batches b
LEFT JOIN profiles p ON p.metadata->>'batch_id' = b.id::text AND p.role = 'student'
GROUP BY b.id, b.name
ORDER BY b.name;

