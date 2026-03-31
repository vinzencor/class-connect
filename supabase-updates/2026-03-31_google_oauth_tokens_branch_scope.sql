-- Migration: Scope Google OAuth tokens per branch (with org-level fallback)
-- Date: 2026-03-31

ALTER TABLE google_oauth_tokens
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE CASCADE;

-- Remove old one-token-per-org uniqueness if present.
ALTER TABLE google_oauth_tokens
  DROP CONSTRAINT IF EXISTS google_oauth_tokens_organization_id_key;

-- Enforce one token row per organization + branch (or org-level with NULL branch).
CREATE UNIQUE INDEX IF NOT EXISTS google_oauth_tokens_org_branch_unique
  ON google_oauth_tokens (organization_id, branch_id);
