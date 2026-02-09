-- ID Card Generator Module Migration
-- Run this in your Supabase SQL Editor

-- =====================================================
-- ID Card Templates Table
-- =====================================================
CREATE TABLE IF NOT EXISTS id_card_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  template_data JSONB NOT NULL DEFAULT '{}',
  is_default BOOLEAN DEFAULT false,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries by organization
CREATE INDEX IF NOT EXISTS idx_id_card_templates_org ON id_card_templates(organization_id);

-- =====================================================
-- ID Cards Table
-- =====================================================
CREATE TABLE IF NOT EXISTS id_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  template_id UUID REFERENCES id_card_templates(id) ON DELETE SET NULL,
  nfc_id TEXT UNIQUE NOT NULL,
  card_number TEXT NOT NULL,
  issued_date DATE DEFAULT CURRENT_DATE,
  expiry_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'expired', 'revoked')),
  card_image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_id_cards_org ON id_cards(organization_id);
CREATE INDEX IF NOT EXISTS idx_id_cards_user ON id_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_id_cards_status ON id_cards(status);
CREATE INDEX IF NOT EXISTS idx_id_cards_nfc ON id_cards(nfc_id);

-- =====================================================
-- Row Level Security (RLS) Policies
-- =====================================================

-- Enable RLS on both tables
ALTER TABLE id_card_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE id_cards ENABLE ROW LEVEL SECURITY;

-- Templates: Users can view templates from their organization
CREATE POLICY "Users can view org templates" ON id_card_templates
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Templates: Admins can manage templates
CREATE POLICY "Admins can manage templates" ON id_card_templates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'admin' 
      AND organization_id = id_card_templates.organization_id
    )
  );

-- ID Cards: Users can view their own cards
CREATE POLICY "Users can view own cards" ON id_cards
  FOR SELECT USING (user_id = auth.uid());

-- ID Cards: Admins can view all cards in their organization
CREATE POLICY "Admins can view org cards" ON id_cards
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'admin' 
      AND organization_id = id_cards.organization_id
    )
  );

-- ID Cards: Admins can manage cards
CREATE POLICY "Admins can manage cards" ON id_cards
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'admin' 
      AND organization_id = id_cards.organization_id
    )
  );

-- =====================================================
-- Trigger for updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_id_card_templates_updated_at
  BEFORE UPDATE ON id_card_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_id_cards_updated_at
  BEFORE UPDATE ON id_cards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Storage Bucket for ID Card Images (run separately if needed)
-- =====================================================
-- INSERT INTO storage.buckets (id, name, public) 
-- VALUES ('id-cards', 'id-cards', true)
-- ON CONFLICT (id) DO NOTHING;
