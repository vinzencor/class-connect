-- =====================================================
-- Add transactions table (Income & Expenses tracking)
-- Add fee_payments table (installment payment history)
-- Enhance payments table with course info
-- Date: 2026-02-20
-- =====================================================

-- ── 1. Transactions table ──────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  description TEXT NOT NULL,
  amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'Other',
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  mode TEXT NOT NULL DEFAULT 'Cash',
  recurrence TEXT NOT NULL DEFAULT 'one-time' CHECK (recurrence IN ('one-time', 'monthly')),
  paused BOOLEAN NOT NULL DEFAULT false,
  parent_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_org ON transactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_transactions_branch ON transactions(branch_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);

-- RLS for transactions
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view transactions in their org" ON transactions;
CREATE POLICY "Users can view transactions in their org" ON transactions
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert transactions in their org" ON transactions;
CREATE POLICY "Users can insert transactions in their org" ON transactions
  FOR INSERT WITH CHECK (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can update transactions in their org" ON transactions;
CREATE POLICY "Users can update transactions in their org" ON transactions
  FOR UPDATE USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete transactions in their org" ON transactions;
CREATE POLICY "Users can delete transactions in their org" ON transactions
  FOR DELETE USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

-- ── 2. Fee payments table (installments) ───────────────────
CREATE TABLE IF NOT EXISTS fee_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  mode TEXT NOT NULL DEFAULT 'Cash',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fee_payments_payment ON fee_payments(payment_id);
CREATE INDEX IF NOT EXISTS idx_fee_payments_org ON fee_payments(organization_id);

-- RLS for fee_payments
ALTER TABLE fee_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view fee_payments in their org" ON fee_payments;
CREATE POLICY "Users can view fee_payments in their org" ON fee_payments
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert fee_payments in their org" ON fee_payments;
CREATE POLICY "Users can insert fee_payments in their org" ON fee_payments
  FOR INSERT WITH CHECK (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can update fee_payments in their org" ON fee_payments;
CREATE POLICY "Users can update fee_payments in their org" ON fee_payments
  FOR UPDATE USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete fee_payments in their org" ON fee_payments;
CREATE POLICY "Users can delete fee_payments in their org" ON fee_payments
  FOR DELETE USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

-- ── 3. Enhance payments table with course info ─────────────
ALTER TABLE payments ADD COLUMN IF NOT EXISTS course_name TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS total_fee DECIMAL(12, 2);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(12, 2) DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS student_name TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS installment_count INTEGER DEFAULT 0;

-- Make student_id nullable (some payments may not be tied to a student profile)
ALTER TABLE payments ALTER COLUMN student_id DROP NOT NULL;

-- ── 4. Backfill student_name from profiles for existing records ──
UPDATE payments p
SET student_name = pr.full_name
FROM profiles pr
WHERE p.student_id = pr.id
  AND p.student_name IS NULL;

-- Backfill course_name from notes for existing records
UPDATE payments
SET course_name = TRIM(SPLIT_PART(REPLACE(notes, 'Course: ', ''), '|', 1))
WHERE course_name IS NULL
  AND notes IS NOT NULL
  AND notes LIKE 'Course:%';

-- Backfill total_fee from amount where missing
UPDATE payments
SET total_fee = amount
WHERE total_fee IS NULL;
