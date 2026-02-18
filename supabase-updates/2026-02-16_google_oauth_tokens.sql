-- Migration: Add Google OAuth tokens table for Google Calendar/Meet integration
-- Date: 2026-02-16

-- Table to store the org admin's Google OAuth refresh token
CREATE TABLE IF NOT EXISTS google_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  access_token TEXT,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ,
  connected_by UUID REFERENCES profiles(id),
  connected_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id)
);

-- Add google_calendar_event_id to sessions table for tracking calendar events
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS google_calendar_event_id TEXT;

-- RLS policies for google_oauth_tokens
ALTER TABLE google_oauth_tokens ENABLE ROW LEVEL SECURITY;

-- Only admins of the same organization can view their org's token
CREATE POLICY "Admins can view own org google tokens" ON google_oauth_tokens
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Only admins can insert tokens for their org
CREATE POLICY "Admins can insert own org google tokens" ON google_oauth_tokens
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Only admins can update their org's tokens
CREATE POLICY "Admins can update own org google tokens" ON google_oauth_tokens
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Only admins can delete (disconnect) their org's tokens
CREATE POLICY "Admins can delete own org google tokens" ON google_oauth_tokens
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Anyone authenticated in the org can check if Google is connected (read-only, no secrets)
CREATE POLICY "Org members can check google connection status" ON google_oauth_tokens
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid()
    )
  );

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_google_oauth_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER google_oauth_tokens_updated_at
  BEFORE UPDATE ON google_oauth_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_google_oauth_tokens_updated_at();
