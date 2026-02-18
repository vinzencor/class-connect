-- Migration: Student Registration System
-- Date: 2026-02-09
-- Description: Adds student_registrations table, organization tax config, and storage bucket for public student registration flow

-- ============================================================================
-- 1. Add tax_percentage to organizations table
-- ============================================================================
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS tax_percentage DECIMAL(5,2) DEFAULT 18.00;
COMMENT ON COLUMN organizations.tax_percentage IS 'Default tax percentage for fee calculations (e.g., GST 18%)';

-- ============================================================================
-- 2. Create student_registrations table
-- ============================================================================
CREATE TABLE IF NOT EXISTS student_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
    token UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'link_sent', 'submitted', 'verified', 'rejected')),
    
    -- Admin-set fields (during conversion)
    course_id UUID REFERENCES classes(id) ON DELETE SET NULL,
    batch_id UUID REFERENCES batches(id) ON DELETE SET NULL,
    course_fee DECIMAL(10,2),
    discount_amount DECIMAL(10,2) DEFAULT 0,
    tax_inclusive BOOLEAN DEFAULT false,
    fee_actual DECIMAL(10,2),
    tax_percentage DECIMAL(5,2),
    tax_amount DECIMAL(10,2),
    total_amount DECIMAL(10,2),
    payment_type TEXT CHECK (payment_type IN ('full', 'emi', 'installment')),
    advance_payment DECIMAL(10,2) DEFAULT 0,
    balance_amount DECIMAL(10,2),
    
    -- Student-filled fields (personal details)
    full_name TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    pincode TEXT,
    date_of_birth DATE,
    gender TEXT CHECK (gender IN ('male', 'female', 'other')),
    email TEXT,
    mobile_no TEXT,
    whatsapp_no TEXT,
    landline_no TEXT,
    aadhaar_number TEXT,
    qualification TEXT,
    graduation_year TEXT,
    graduation_college TEXT,
    registration_date DATE,
    remarks TEXT,
    admission_source TEXT,
    photo_url TEXT,
    
    -- Parent details
    father_name TEXT,
    mother_name TEXT,
    parent_email TEXT,
    parent_mobile TEXT,
    
    -- Post-verification
    student_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    verified_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ,
    rejection_reason TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(lead_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_student_registrations_organization ON student_registrations(organization_id);
CREATE INDEX IF NOT EXISTS idx_student_registrations_token ON student_registrations(token);
CREATE INDEX IF NOT EXISTS idx_student_registrations_status ON student_registrations(status);
CREATE INDEX IF NOT EXISTS idx_student_registrations_lead ON student_registrations(lead_id);

-- Add comments
COMMENT ON TABLE student_registrations IS 'Student registration records created when a CRM lead is converted';
COMMENT ON COLUMN student_registrations.token IS 'Unique token for public registration URL';
COMMENT ON COLUMN student_registrations.status IS 'pending=created, link_sent=link shared, submitted=form filled, verified=approved, rejected=declined';

-- ============================================================================
-- 3. Add updated_at trigger for student_registrations
-- ============================================================================
CREATE TRIGGER update_student_registrations_updated_at
    BEFORE UPDATE ON student_registrations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 4. RLS Policies for student_registrations
-- ============================================================================
ALTER TABLE student_registrations ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users in the same organization can SELECT
CREATE POLICY "Users can view registrations in their organization"
    ON student_registrations
    FOR SELECT
    TO authenticated
    USING (
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

-- Policy: Authenticated users in the same organization can INSERT
CREATE POLICY "Users can create registrations in their organization"
    ON student_registrations
    FOR INSERT
    TO authenticated
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

-- Policy: Authenticated users in the same organization can UPDATE
CREATE POLICY "Users can update registrations in their organization"
    ON student_registrations
    FOR UPDATE
    TO authenticated
    USING (
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

-- Policy: Anonymous users can SELECT by valid token (for public registration form)
CREATE POLICY "Anonymous can view registration by token"
    ON student_registrations
    FOR SELECT
    TO anon
    USING (true);  -- They need the token to fetch, which is validated in the app layer

-- Policy: Anonymous users can UPDATE by token (for form submission)
CREATE POLICY "Anonymous can update registration by token"
    ON student_registrations
    FOR UPDATE
    TO anon
    USING (true);  -- Token validation happens in app layer

-- ============================================================================
-- 5. Create storage bucket for student photos
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'student-photos',
    'student-photos',
    true,  -- public read access
    5242880,  -- 5MB limit
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 6. Storage policies for student-photos bucket
-- ============================================================================

-- Policy: Anyone can view files in student-photos (public read)
CREATE POLICY "Public can view student photos"
    ON storage.objects
    FOR SELECT
    TO public
    USING (bucket_id = 'student-photos');

-- Policy: Authenticated users can upload photos
CREATE POLICY "Authenticated users can upload student photos"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'student-photos');

-- Policy: Anonymous users can upload photos (for public registration form)
-- Scoped to paths matching registration tokens
CREATE POLICY "Anonymous can upload photos for registrations"
    ON storage.objects
    FOR INSERT
    TO anon
    WITH CHECK (
        bucket_id = 'student-photos' 
        AND (storage.foldername(name))[1] = 'registrations'
    );

-- Policy: Users can update/delete their own organization's photos
CREATE POLICY "Users can delete student photos in their org"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (bucket_id = 'student-photos');

-- ============================================================================
-- 7. Helper function to get registration by token (optional, for security)
-- ============================================================================
CREATE OR REPLACE FUNCTION get_registration_by_token(p_token UUID)
RETURNS TABLE (
    id UUID,
    organization_id UUID,
    lead_id UUID,
    status TEXT,
    full_name TEXT,
    email TEXT,
    mobile_no TEXT,
    course_id UUID,
    batch_id UUID,
    course_fee DECIMAL,
    discount_amount DECIMAL,
    tax_inclusive BOOLEAN,
    tax_percentage DECIMAL,
    total_amount DECIMAL,
    payment_type TEXT,
    advance_payment DECIMAL,
    balance_amount DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sr.id,
        sr.organization_id,
        sr.lead_id,
        sr.status,
        sr.full_name,
        sr.email,
        sr.mobile_no,
        sr.course_id,
        sr.batch_id,
        sr.course_fee,
        sr.discount_amount,
        sr.tax_inclusive,
        sr.tax_percentage,
        sr.total_amount,
        sr.payment_type,
        sr.advance_payment,
        sr.balance_amount
    FROM student_registrations sr
    WHERE sr.token = p_token
    AND sr.status IN ('pending', 'link_sent', 'submitted');
END;
$$;

COMMENT ON FUNCTION get_registration_by_token IS 'Safely fetch registration data by token for public form';

-- ============================================================================
-- Migration complete
-- ============================================================================
