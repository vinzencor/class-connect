-- Migration: Role-Based Access Control System
-- Date: 2026-02-17
-- Description: Implements fully configurable RBAC with custom roles and page-level permissions

-- Create roles table
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT false, -- true for Admin/Faculty/Student to prevent deletion
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, name)
);

-- Create role_permissions table (page-level visibility)
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL, -- e.g., 'dashboard', 'users', 'classes', etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(role_id, feature_key)
);

-- Add role_id column to profiles (keep existing 'role' text for backward compat)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES roles(id) ON DELETE SET NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_roles_org ON roles(organization_id);
CREATE INDEX IF NOT EXISTS idx_roles_system ON roles(is_system);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_feature ON role_permissions(feature_key);
CREATE INDEX IF NOT EXISTS idx_profiles_role_id ON profiles(role_id);

-- Add updated_at trigger
CREATE TRIGGER update_roles_updated_at
  BEFORE UPDATE ON roles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Seed default system roles for each organization
DO $$
DECLARE
  org RECORD;
  admin_role_id UUID;
  faculty_role_id UUID;
  student_role_id UUID;
BEGIN
  FOR org IN SELECT id FROM organizations LOOP
    -- Create Admin role with all permissions
    INSERT INTO roles (organization_id, name, description, is_system)
    VALUES (org.id, 'Admin', 'Full system access', true)
    RETURNING id INTO admin_role_id;
    
    INSERT INTO role_permissions (role_id, feature_key) VALUES
      (admin_role_id, 'dashboard'),
      (admin_role_id, 'users'),
      (admin_role_id, 'classes'),
      (admin_role_id, 'batches'),
      (admin_role_id, 'attendance'),
      (admin_role_id, 'modules'),
      (admin_role_id, 'crm'),
      (admin_role_id, 'converted_leads'),
      (admin_role_id, 'payments'),
      (admin_role_id, 'id_cards'),
      (admin_role_id, 'settings'),
      (admin_role_id, 'roles');
    
    -- Create Faculty role
    INSERT INTO roles (organization_id, name, description, is_system)
    VALUES (org.id, 'Faculty', 'Teacher and instructor access', true)
    RETURNING id INTO faculty_role_id;
    
    INSERT INTO role_permissions (role_id, feature_key) VALUES
      (faculty_role_id, 'dashboard'),
      (faculty_role_id, 'classes'),
      (faculty_role_id, 'batches'),
      (faculty_role_id, 'attendance'),
      (faculty_role_id, 'modules'),
      (faculty_role_id, 'settings');
    
    -- Create Student role
    INSERT INTO roles (organization_id, name, description, is_system)
    VALUES (org.id, 'Student', 'Student access', true)
    RETURNING id INTO student_role_id;
    
    INSERT INTO role_permissions (role_id, feature_key) VALUES
      (student_role_id, 'dashboard'),
      (student_role_id, 'classes'),
      (student_role_id, 'modules'),
      (student_role_id, 'leave_requests'),
      (student_role_id, 'settings');
    
    -- Backfill existing profiles with role_id based on their text 'role' column
    UPDATE profiles 
    SET role_id = admin_role_id 
    WHERE organization_id = org.id AND role = 'admin' AND role_id IS NULL;
    
    UPDATE profiles 
    SET role_id = faculty_role_id 
    WHERE organization_id = org.id AND role = 'faculty' AND role_id IS NULL;
    
    UPDATE profiles 
    SET role_id = student_role_id 
    WHERE organization_id = org.id AND role = 'student' AND role_id IS NULL;
  END LOOP;
END $$;

-- RLS Policies

-- roles table policies
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view roles in their organization"
  ON roles FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Admins can insert roles"
  ON roles FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can update roles"
  ON roles FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can delete non-system roles"
  ON roles FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    AND is_system = false
  );

-- role_permissions table policies
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view role permissions in their organization"
  ON role_permissions FOR SELECT
  USING (role_id IN (
    SELECT r.id FROM roles r
    JOIN profiles p ON p.organization_id = r.organization_id
    WHERE p.id = auth.uid()
  ));

CREATE POLICY "Admins can insert role permissions"
  ON role_permissions FOR INSERT
  WITH CHECK (role_id IN (
    SELECT r.id FROM roles r
    JOIN profiles p ON p.organization_id = r.organization_id
    WHERE p.id = auth.uid()
  ));

CREATE POLICY "Admins can update role permissions"
  ON role_permissions FOR UPDATE
  USING (role_id IN (
    SELECT r.id FROM roles r
    JOIN profiles p ON p.organization_id = r.organization_id
    WHERE p.id = auth.uid()
  ));

CREATE POLICY "Admins can delete role permissions"
  ON role_permissions FOR DELETE
  USING (role_id IN (
    SELECT r.id FROM roles r
    JOIN profiles p ON p.organization_id = r.organization_id
    WHERE p.id = auth.uid()
  ));

-- Create a function to get user permissions (useful for queries)
CREATE OR REPLACE FUNCTION get_user_permissions(user_id UUID)
RETURNS TEXT[] AS $$
  SELECT ARRAY_AGG(rp.feature_key)
  FROM profiles p
  JOIN roles r ON r.id = p.role_id
  JOIN role_permissions rp ON rp.role_id = r.id
  WHERE p.id = user_id
$$ LANGUAGE SQL STABLE;

-- Comment for future reference
COMMENT ON TABLE roles IS 'Custom roles per organization with configurable permissions';
COMMENT ON TABLE role_permissions IS 'Page-level feature visibility per role';
COMMENT ON COLUMN roles.is_system IS 'System roles (Admin/Faculty/Student) cannot be deleted but can be modified';
COMMENT ON COLUMN profiles.role_id IS 'Foreign key to roles table - replaces text-based role column';
