-- Migration: Clean up duplicate Google OAuth token rows and enforce branch-aware uniqueness
-- Date: 2026-04-04

WITH ranked_tokens AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY organization_id, branch_id
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS row_num
  FROM google_oauth_tokens
),
duplicate_tokens AS (
  SELECT id
  FROM ranked_tokens
  WHERE row_num > 1
)
DELETE FROM google_oauth_tokens
WHERE id IN (SELECT id FROM duplicate_tokens);

DROP INDEX IF EXISTS google_oauth_tokens_org_branch_unique;

CREATE UNIQUE INDEX IF NOT EXISTS google_oauth_tokens_org_null_branch_unique
  ON google_oauth_tokens (organization_id)
  WHERE branch_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS google_oauth_tokens_org_branch_unique
  ON google_oauth_tokens (organization_id, branch_id)
  WHERE branch_id IS NOT NULL;