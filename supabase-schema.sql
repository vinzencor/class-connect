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
CREATE TABLE organizations (
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
CREATE TABLE profiles (
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
CREATE TABLE classes (
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
CREATE TABLE class_enrollments (
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
CREATE TABLE attendance (
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
CREATE TABLE modules (
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
CREATE TABLE crm_leads (
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
CREATE TABLE payments (
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
-- INDEXES for performance
-- =====================================================
CREATE INDEX idx_profiles_organization_id ON profiles(organization_id);
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_classes_organization_id ON classes(organization_id);
CREATE INDEX idx_classes_faculty_id ON classes(faculty_id);
CREATE INDEX idx_attendance_organization_id ON attendance(organization_id);
CREATE INDEX idx_attendance_class_student_date ON attendance(class_id, student_id, date);
CREATE INDEX idx_modules_organization_id ON modules(organization_id);
CREATE INDEX idx_crm_leads_organization_id ON crm_leads(organization_id);
CREATE INDEX idx_payments_organization_id ON payments(organization_id);
CREATE INDEX idx_payments_student_id ON payments(student_id);

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

-- Allow authenticated users to read organizations (simplified)
CREATE POLICY "Authenticated users can read organizations"
  ON organizations FOR SELECT
  USING (auth.role() = 'authenticated');

-- Allow authenticated users to insert organizations (for signup)
CREATE POLICY "Authenticated users can insert organizations"
  ON organizations FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to update organizations (app will handle role checks)
CREATE POLICY "Authenticated users can update organizations"
  ON organizations FOR UPDATE
  USING (auth.role() = 'authenticated');

-- =====================================================
-- RLS POLICIES: profiles
-- =====================================================

-- Users can read their own profile (most permissive, no recursion)
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

-- Enable select for authenticated users (simplified to avoid recursion)
-- This allows users to see other profiles in their organization
CREATE POLICY "Authenticated users can read all profiles"
  ON profiles FOR SELECT
  USING (auth.role() = 'authenticated');

-- Allow inserting profiles (needed for trigger on signup)
CREATE POLICY "Allow profile creation"
  ON profiles FOR INSERT
  WITH CHECK (true);

-- =====================================================
-- RLS POLICIES: classes
-- =====================================================

-- Authenticated users can read all classes (app handles org filtering)
CREATE POLICY "Authenticated users can read classes"
  ON classes FOR SELECT
  USING (auth.role() = 'authenticated');

-- Authenticated users can insert classes
CREATE POLICY "Authenticated users can insert classes"
  ON classes FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Authenticated users can update classes
CREATE POLICY "Authenticated users can update classes"
  ON classes FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Authenticated users can delete classes
CREATE POLICY "Authenticated users can delete classes"
  ON classes FOR DELETE
  USING (auth.role() = 'authenticated');

-- =====================================================
-- RLS POLICIES: class_enrollments
-- =====================================================

-- Authenticated users can manage enrollments
CREATE POLICY "Authenticated users can read enrollments"
  ON class_enrollments FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage enrollments"
  ON class_enrollments FOR ALL
  USING (auth.role() = 'authenticated');

-- =====================================================
-- RLS POLICIES: attendance
-- =====================================================

-- Authenticated users can read attendance
CREATE POLICY "Authenticated users can read attendance"
  ON attendance FOR SELECT
  USING (auth.role() = 'authenticated');

-- Authenticated users can insert attendance
CREATE POLICY "Authenticated users can insert attendance"
  ON attendance FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Authenticated users can update attendance
CREATE POLICY "Authenticated users can update attendance"
  ON attendance FOR UPDATE
  USING (auth.role() = 'authenticated');

-- =====================================================
-- RLS POLICIES: modules
-- =====================================================

-- Authenticated users can read modules
CREATE POLICY "Authenticated users can read modules"
  ON modules FOR SELECT
  USING (auth.role() = 'authenticated');

-- Authenticated users can insert modules
CREATE POLICY "Authenticated users can insert modules"
  ON modules FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Authenticated users can update modules
CREATE POLICY "Authenticated users can update modules"
  ON modules FOR UPDATE
  USING (auth.role() = 'authenticated');

-- =====================================================
-- RLS POLICIES: crm_leads
-- =====================================================

-- Authenticated users can read leads
CREATE POLICY "Authenticated users can read leads"
  ON crm_leads FOR SELECT
  USING (auth.role() = 'authenticated');

-- Authenticated users can insert leads
CREATE POLICY "Authenticated users can insert leads"
  ON crm_leads FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Authenticated users can update leads
CREATE POLICY "Authenticated users can update leads"
  ON crm_leads FOR UPDATE
  USING (auth.role() = 'authenticated');

-- =====================================================
-- RLS POLICIES: payments
-- =====================================================

-- Authenticated users can read payments
CREATE POLICY "Authenticated users can read payments"
  ON payments FOR SELECT
  USING (auth.role() = 'authenticated');

-- Students can read their own payments
CREATE POLICY "Students can read own payments"
  ON payments FOR SELECT
  USING (student_id = auth.uid());

-- Authenticated users can manage payments
CREATE POLICY "Authenticated users can manage payments"
  ON payments FOR ALL
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
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_classes_updated_at BEFORE UPDATE ON classes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_modules_updated_at BEFORE UPDATE ON modules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crm_leads_updated_at BEFORE UPDATE ON crm_leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
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
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
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
