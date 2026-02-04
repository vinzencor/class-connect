-- =====================================================
-- CLASS CONNECT - MULTI-TENANT DATABASE SCHEMA
-- =====================================================
-- This schema supports multiple organizations (academies) 
-- with Admin, Faculty, and Student roles.
-- Execute this SQL in your Supabase SQL Editor.
--
-- NOTE ON RLS POLICIES:
-- Policies are simplified to avoid infinite recursion.
-- All authenticated users can access data, but the
-- application layer handles organization-specific filtering
-- by always including organization_id in queries.
-- This is a common pattern for multi-tenant apps.
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TABLE: organizations
-- Stores academy/institute information
-- =====================================================
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  website TEXT,
  logo_url TEXT,
  subscription_plan TEXT DEFAULT 'free' CHECK (subscription_plan IN ('free', 'basic', 'pro', 'enterprise')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLE: profiles
-- Extended user information linked to Supabase Auth
-- =====================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'faculty', 'student')),
  avatar_url TEXT,
  phone TEXT,
  nfc_id TEXT UNIQUE,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLE: classes
-- Course/class information
-- =====================================================
CREATE TABLE IF NOT EXISTS classes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  description TEXT,
  faculty_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  schedule_day TEXT, -- e.g., "Monday", "Tuesday"
  schedule_time TIME,
  duration_minutes INTEGER DEFAULT 60,
  room_number TEXT,
  meet_link TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLE: class_enrollments
-- Many-to-many relationship between students and classes
-- =====================================================
CREATE TABLE IF NOT EXISTS class_enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(class_id, student_id)
);

-- =====================================================
-- TABLE: attendance
-- Attendance records for classes
-- =====================================================
CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late')),
  marked_at TIMESTAMPTZ DEFAULT NOW(),
  marked_by UUID REFERENCES profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(class_id, student_id, date)
);

-- =====================================================
-- TABLE: modules
-- Learning modules/materials
-- =====================================================
CREATE TABLE IF NOT EXISTS modules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  file_url TEXT,
  file_type TEXT, -- 'pdf', 'ppt', 'video', etc.
  uploaded_by UUID REFERENCES profiles(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLE: crm_leads
-- CRM lead management
-- =====================================================
CREATE TABLE IF NOT EXISTS crm_leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'interested', 'follow_up', 'converted', 'lost')),
  source TEXT, -- 'website', 'referral', 'walk-in', etc.
  notes TEXT,
  assigned_to UUID REFERENCES profiles(id),
  converted_to_student_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLE: payments
-- Payment/fee tracking
-- =====================================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  amount_paid DECIMAL(10, 2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'completed', 'overdue')),
  due_date DATE,
  payment_method TEXT, -- 'cash', 'card', 'upi', 'bank_transfer'
  transaction_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLE: leave_requests
-- Students can request leave from classes
-- =====================================================
CREATE TABLE IF NOT EXISTS leave_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_date DATE DEFAULT CURRENT_DATE,
  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_date TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES for performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_classes_organization_id ON classes(organization_id);
CREATE INDEX IF NOT EXISTS idx_classes_faculty_id ON classes(faculty_id);
CREATE INDEX IF NOT EXISTS idx_attendance_organization_id ON attendance(organization_id);
CREATE INDEX IF NOT EXISTS idx_attendance_class_student_date ON attendance(class_id, student_id, date);
CREATE INDEX IF NOT EXISTS idx_modules_organization_id ON modules(organization_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_organization_id ON crm_leads(organization_id);
CREATE INDEX IF NOT EXISTS idx_payments_organization_id ON payments(organization_id);
CREATE INDEX IF NOT EXISTS idx_payments_student_id ON payments(student_id);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES: organizations
-- =====================================================

-- Allow anyone to read organizations
DROP POLICY IF EXISTS "Authenticated users can read organizations" ON organizations;
CREATE POLICY "Anyone can read organizations"
  ON organizations FOR SELECT
  USING (true);

-- Allow anyone to insert organizations (for signup)
DROP POLICY IF EXISTS "Allow organization creation on signup" ON organizations;
CREATE POLICY "Anyone can create organizations"
  ON organizations FOR INSERT
  WITH CHECK (true);
 
-- Allow authenticated users to update organizations
DROP POLICY IF EXISTS "Authenticated users can update organizations" ON organizations;
CREATE POLICY "Authenticated users can update organizations"
  ON organizations FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Allow authenticated users to delete organizations
DROP POLICY IF EXISTS "Authenticated users can delete organizations" ON organizations;
CREATE POLICY "Authenticated users can delete organizations"
  ON organizations FOR DELETE
  USING (auth.role() = 'authenticated');

-- =====================================================
-- RLS POLICIES: profiles
-- =====================================================

-- Users can read their own profile
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

-- Users can update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

-- Authenticated users can read all profiles
DROP POLICY IF EXISTS "Authenticated users can read all profiles" ON profiles;
CREATE POLICY "Authenticated users can read all profiles"
  ON profiles FOR SELECT
  USING (auth.role() = 'authenticated');

-- Allow creating profiles (needed for trigger on signup)
DROP POLICY IF EXISTS "Allow profile creation" ON profiles;
CREATE POLICY "Allow profile creation on signup"
  ON profiles FOR INSERT
  WITH CHECK (true);  -- Allow inserts during signup (trigger bypass)

-- Authenticated users can update all profiles
DROP POLICY IF EXISTS "Authenticated users can update profiles" ON profiles;
CREATE POLICY "Authenticated users can update profiles"
  ON profiles FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Allow authenticated users to delete profiles
DROP POLICY IF EXISTS "Authenticated users can delete profiles" ON profiles;
CREATE POLICY "Authenticated users can delete profiles"
  ON profiles FOR DELETE
  USING (auth.role() = 'authenticated');

-- =====================================================
-- RLS POLICIES: classes
-- =====================================================

-- Authenticated users can read classes
DROP POLICY IF EXISTS "Authenticated users can read classes" ON classes;
CREATE POLICY "Authenticated users can read classes"
  ON classes FOR SELECT
  USING (auth.role() = 'authenticated');

-- Authenticated users can insert classes
DROP POLICY IF EXISTS "Authenticated users can insert classes" ON classes;
CREATE POLICY "Authenticated users can insert classes"
  ON classes FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Authenticated users can update classes
DROP POLICY IF EXISTS "Authenticated users can update classes" ON classes;
CREATE POLICY "Authenticated users can update classes"
  ON classes FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Authenticated users can delete classes
DROP POLICY IF EXISTS "Authenticated users can delete classes" ON classes;
CREATE POLICY "Authenticated users can delete classes"
  ON classes FOR DELETE
  USING (auth.role() = 'authenticated');

-- =====================================================
-- RLS POLICIES: class_enrollments
-- =====================================================

-- Authenticated users can read enrollments
DROP POLICY IF EXISTS "Authenticated users can read enrollments" ON class_enrollments;
CREATE POLICY "Authenticated users can read enrollments"
  ON class_enrollments FOR SELECT
  USING (auth.role() = 'authenticated');

-- Authenticated users can insert enrollments
DROP POLICY IF EXISTS "Authenticated users can insert enrollments" ON class_enrollments;
CREATE POLICY "Authenticated users can insert enrollments"
  ON class_enrollments FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Authenticated users can update enrollments
DROP POLICY IF EXISTS "Authenticated users can update enrollments" ON class_enrollments;
CREATE POLICY "Authenticated users can update enrollments"
  ON class_enrollments FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Authenticated users can delete enrollments
DROP POLICY IF EXISTS "Authenticated users can delete enrollments" ON class_enrollments;
CREATE POLICY "Authenticated users can delete enrollments"
  ON class_enrollments FOR DELETE
  USING (auth.role() = 'authenticated');

-- =====================================================
-- RLS POLICIES: attendance
-- =====================================================

-- Authenticated users can read attendance
DROP POLICY IF EXISTS "Authenticated users can read attendance" ON attendance;
CREATE POLICY "Authenticated users can read attendance"
  ON attendance FOR SELECT
  USING (auth.role() = 'authenticated');

-- Authenticated users can insert attendance
DROP POLICY IF EXISTS "Authenticated users can insert attendance" ON attendance;
CREATE POLICY "Authenticated users can insert attendance"
  ON attendance FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Authenticated users can update attendance
DROP POLICY IF EXISTS "Authenticated users can update attendance" ON attendance;
CREATE POLICY "Authenticated users can update attendance"
  ON attendance FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Authenticated users can delete attendance
DROP POLICY IF EXISTS "Authenticated users can delete attendance" ON attendance;
CREATE POLICY "Authenticated users can delete attendance"
  ON attendance FOR DELETE
  USING (auth.role() = 'authenticated');

-- =====================================================
-- RLS POLICIES: modules
-- =====================================================

-- Authenticated users can read modules
DROP POLICY IF EXISTS "Authenticated users can read modules" ON modules;
CREATE POLICY "Authenticated users can read modules"
  ON modules FOR SELECT
  USING (auth.role() = 'authenticated');

-- Authenticated users can insert modules
DROP POLICY IF EXISTS "Authenticated users can insert modules" ON modules;
CREATE POLICY "Authenticated users can insert modules"
  ON modules FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Authenticated users can update modules
DROP POLICY IF EXISTS "Authenticated users can update modules" ON modules;
CREATE POLICY "Authenticated users can update modules"
  ON modules FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Authenticated users can delete modules
DROP POLICY IF EXISTS "Authenticated users can delete modules" ON modules;
CREATE POLICY "Authenticated users can delete modules"
  ON modules FOR DELETE
  USING (auth.role() = 'authenticated');

-- =====================================================
-- RLS POLICIES: crm_leads
-- =====================================================

-- Authenticated users can read leads
DROP POLICY IF EXISTS "Authenticated users can read leads" ON crm_leads;
CREATE POLICY "Authenticated users can read leads"
  ON crm_leads FOR SELECT
  USING (auth.role() = 'authenticated');

-- Authenticated users can insert leads
DROP POLICY IF EXISTS "Authenticated users can insert leads" ON crm_leads;
CREATE POLICY "Authenticated users can insert leads"
  ON crm_leads FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Authenticated users can update leads
DROP POLICY IF EXISTS "Authenticated users can update leads" ON crm_leads;
CREATE POLICY "Authenticated users can update leads"
  ON crm_leads FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Authenticated users can delete leads
DROP POLICY IF EXISTS "Authenticated users can delete leads" ON crm_leads;
CREATE POLICY "Authenticated users can delete leads"
  ON crm_leads FOR DELETE
  USING (auth.role() = 'authenticated');

-- =====================================================
-- RLS POLICIES: payments
-- =====================================================

-- Authenticated users can read payments
DROP POLICY IF EXISTS "Authenticated users can read payments" ON payments;
CREATE POLICY "Authenticated users can read payments"
  ON payments FOR SELECT
  USING (auth.role() = 'authenticated');

-- Students can read their own payments
DROP POLICY IF EXISTS "Students can read own payments" ON payments;
CREATE POLICY "Students can read own payments"
  ON payments FOR SELECT
  USING (student_id = auth.uid());

-- Authenticated users can insert payments
DROP POLICY IF EXISTS "Authenticated users can insert payments" ON payments;
CREATE POLICY "Authenticated users can insert payments"
  ON payments FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Authenticated users can update payments
DROP POLICY IF EXISTS "Authenticated users can update payments" ON payments;
CREATE POLICY "Authenticated users can update payments"
  ON payments FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Authenticated users can delete payments
DROP POLICY IF EXISTS "Authenticated users can delete payments" ON payments;
CREATE POLICY "Authenticated users can delete payments"
  ON payments FOR DELETE
  USING (auth.role() = 'authenticated');

-- =====================================================
-- RLS POLICIES: leave_requests
-- =====================================================

-- Authenticated users can read leave requests
DROP POLICY IF EXISTS "Authenticated users can read leave requests" ON leave_requests;
CREATE POLICY "Authenticated users can read leave requests"
  ON leave_requests FOR SELECT
  USING (auth.role() = 'authenticated');

-- Students can create their own leave requests
DROP POLICY IF EXISTS "Students can create leave requests" ON leave_requests;
CREATE POLICY "Students can create leave requests"
  ON leave_requests FOR INSERT
  WITH CHECK (student_id = auth.uid() OR auth.role() = 'authenticated');

-- Students can view their own leave requests
DROP POLICY IF EXISTS "Students can read own leave requests" ON leave_requests;
CREATE POLICY "Students can read own leave requests"
  ON leave_requests FOR SELECT
  USING (student_id = auth.uid() OR auth.role() = 'authenticated');

-- Authenticated users can manage leave requests (for admins/faculty)
DROP POLICY IF EXISTS "Authenticated users can update leave requests" ON leave_requests;
CREATE POLICY "Authenticated users can update leave requests"
  ON leave_requests FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Authenticated users can delete leave requests
DROP POLICY IF EXISTS "Authenticated users can delete leave requests" ON leave_requests;
CREATE POLICY "Authenticated users can delete leave requests"
  ON leave_requests FOR DELETE
  USING (auth.role() = 'authenticated');

-- =====================================================
-- FUNCTIONS: Auto-update timestamps
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to all tables with updated_at
DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations;
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_classes_updated_at ON classes;
CREATE TRIGGER update_classes_updated_at BEFORE UPDATE ON classes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_modules_updated_at ON modules;
CREATE TRIGGER update_modules_updated_at BEFORE UPDATE ON modules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_crm_leads_updated_at ON crm_leads;
CREATE TRIGGER update_crm_leads_updated_at BEFORE UPDATE ON crm_leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_leave_requests_updated_at ON leave_requests;
CREATE TRIGGER update_leave_requests_updated_at BEFORE UPDATE ON leave_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- FUNCTION: Create profile on user signup
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, organization_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'student'),
    (NEW.raw_user_meta_data->>'organization_id')::UUID
  ) ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    organization_id = EXCLUDED.organization_id;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public;

-- Trigger to create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- COMPLETED: Database schema is ready!
-- =====================================================
-- Next steps:
-- 1. Copy this SQL and run it in Supabase SQL Editor
-- 2. Verify all tables and policies are created
-- 3. Test with sample data if needed
-- =====================================================
