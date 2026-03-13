-- Fix Row-Level Security for ID Card Templates and ID Cards
-- This allows any authorized staff/admin to manage templates and cards

-- 1. Fix Templates Policy
DROP POLICY IF EXISTS "Admins can manage templates" ON id_card_templates;

CREATE POLICY "Admins can manage templates" ON id_card_templates
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'superadmin', 'school_admin', 'franchise', 'staff')
      AND organization_id = id_card_templates.organization_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'superadmin', 'school_admin', 'franchise', 'staff')
      AND organization_id = id_card_templates.organization_id
    )
  );

-- 2. Fix ID Cards Policy
DROP POLICY IF EXISTS "Admins can manage cards" ON id_cards;

CREATE POLICY "Admins can manage cards" ON id_cards
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'superadmin', 'school_admin', 'franchise', 'staff')
      AND organization_id = id_cards.organization_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'superadmin', 'school_admin', 'franchise', 'staff')
      AND organization_id = id_cards.organization_id
    )
  );
