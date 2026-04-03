import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { Tables } from '../types/database';

type Profile = Tables<'profiles'>;
type Organization = Tables<'organizations'>;

export interface User {
  id: string;
  email: string;
  name: string;
  role: string; // Changed from union type to string for flexibility
  roleId?: string;
  roleName?: string;
  permissions?: string[]; // Feature keys user can access
  avatar?: string;
  organizationId?: string;
  organizationName?: string;
  phone?: string;
  nfcId?: string;
  branchId?: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  organization: Organization | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, fullName: string, organizationName: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  refreshUserData: () => Promise<void>;
  hasPermission: (featureKey: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Ref to always hold the latest user data (avoids stale closures)
  const userRef = useRef<User | null>(null);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const getFallbackPermissionsForRole = (role: string): string[] => {
    const fallbackPermissions: Record<string, string[]> = {
      admin: ['dashboard', 'users', 'classes', 'batches', 'attendance', 'courses', 'modules', 'crm', 'converted_leads', 'admissions', 'payments', 'id_cards', 'settings', 'roles', 'reports', 'faculty_availability', 'branches', 'leave_requests'],
      super_admin: ['dashboard', 'users', 'classes', 'batches', 'attendance', 'courses', 'modules', 'crm', 'converted_leads', 'admissions', 'payments', 'id_cards', 'settings', 'roles', 'reports', 'faculty_availability', 'branches', 'leave_requests'],
      schedule_coordinator: ['dashboard', 'classes', 'batches', 'attendance', 'faculty_availability', 'leave_requests', 'courses', 'modules', 'reports', 'settings'],
      batch_coordinator: ['dashboard', 'classes', 'attendance', 'reports', 'settings'],
      faculty: ['dashboard', 'classes', 'attendance', 'leave_requests', 'settings', 'faculty_availability', 'modules'],
      student: ['dashboard', 'classes', 'modules', 'leave_requests', 'settings'],
      sales_staff: ['dashboard', 'users', 'batches', 'courses', 'payments', 'crm', 'converted_leads', 'admissions', 'reports', 'settings'],
      front_office: ['dashboard', 'users', 'admissions', 'converted_leads', 'settings'],
      head: ['dashboard', 'users', 'classes', 'batches', 'attendance', 'courses', 'modules', 'faculty_availability', 'leave_requests', 'crm', 'converted_leads', 'admissions', 'payments', 'id_cards', 'reports', 'branches', 'settings'],
      staff: ['dashboard', 'users', 'classes', 'batches', 'attendance', 'courses', 'modules', 'faculty_availability', 'leave_requests', 'crm', 'converted_leads', 'admissions', 'payments', 'id_cards', 'reports', 'settings'],
    };

    return fallbackPermissions[role] || fallbackPermissions.student;
  };

  const getMandatoryPermissions = (): string[] => ['dashboard', 'settings'];

  // Helper function to fetch user permissions from role
  const fetchUserPermissions = async (profileData: Profile): Promise<{ permissions: string[]; roleName: string; roleId: string | null }> => {
    try {
      // If role_id exists, fetch permissions from role_permissions table
      if (profileData.role_id) {
        const { data: roleData, error: roleError } = await supabase
          .from('roles')
          .select(`
            id,
            name,
            role_permissions (feature_key)
          `)
          .eq('id', profileData.role_id)
          .maybeSingle();

        if (!roleError && roleData) {
          const permissions = (roleData.role_permissions as any[])?.map((p: any) => p.feature_key) || [];

          // Always keep a minimal baseline, but do not override admin-disabled role permissions.
          const mandatoryPermissions = getMandatoryPermissions();
          mandatoryPermissions.forEach((key) => {
            if (!permissions.includes(key)) permissions.push(key);
          });

          return {
            permissions,
            roleName: roleData.name,
            roleId: roleData.id,
          };
        }

        // role_id exists but role/permissions could not be loaded: fail closed to minimal access.
        console.warn('⚠️ role_id exists but role permissions could not be loaded; applying minimal permissions only');
        return {
          permissions: getMandatoryPermissions(),
          roleName: profileData.role.charAt(0).toUpperCase() + profileData.role.slice(1),
          roleId: profileData.role_id,
        };
      }

      // Fallback: No role_id or error fetching role, return default based on text role
      console.warn('⚠️ No role_id or error fetching role, using fallback permissions for role:', profileData.role);

      // Default permissions based on legacy text role
      return {
        permissions: getFallbackPermissionsForRole(profileData.role),
        roleName: profileData.role.charAt(0).toUpperCase() + profileData.role.slice(1),
        roleId: null,
      };
    } catch (error) {
      console.error('Error fetching user permissions:', error);
      // Return minimal permissions on error
      return {
        permissions: ['dashboard', 'settings'],
        roleName: 'User',
        roleId: null,
      };
    }
  };

  // Check if user has a specific permission
  const hasPermission = (featureKey: string): boolean => {
    return user?.permissions?.includes(featureKey) || false;
  };

  // Auto-mark attendance for ALL org members when anyone logs in
  const markLoginAttendance = async (profileData: { id: string; organization_id: string | null; branch_id: string | null; full_name: string }) => {
    if (!profileData.organization_id) {
      console.warn('⚠️ Cannot mark login attendance - missing organization');
      return;
    }
    try {
      const today = new Date().toISOString().split('T')[0];
      console.log('📋 Marking login attendance for ALL org members on', today);

      // 1. Get all profiles in the organization
      const { data: allMembers, error: membersErr } = await supabase
        .from('profiles')
        .select('id, full_name, branch_id')
        .eq('organization_id', profileData.organization_id);

      if (membersErr || !allMembers || allMembers.length === 0) {
        console.warn('⚠️ No members found in org');
        return;
      }

      // 2. Get existing attendance for today (login type = class_id IS NULL)
      const { data: existingRows } = await supabase
        .from('attendance')
        .select('student_id')
        .eq('organization_id', profileData.organization_id)
        .eq('date', today)
        .is('class_id', null);

      const alreadyMarked = new Set((existingRows || []).map((r: any) => r.student_id));

      // 3. Build insert rows for members not yet marked
      const now = new Date().toISOString();
      const newRows = allMembers
        .filter(m => !alreadyMarked.has(m.id) && m.branch_id)
        .map(m => ({
          organization_id: profileData.organization_id!,
          student_id: m.id,
          date: today,
          status: 'present' as const,
          marked_at: now,
          marked_by: profileData.id,
          branch_id: m.branch_id!,
          notes: 'Auto-marked on login',
        }));

      if (newRows.length === 0) {
        console.log('✅ Login attendance already marked for all members today');
        return;
      }

      // 4. Bulk insert
      const { error } = await supabase.from('attendance').insert(newRows as any);

      if (error) {
        console.error('❌ Failed to mark login attendance:', error);
      } else {
        console.log(`✅ Login attendance marked for ${newRows.length} members`);
      }
    } catch (err) {
      console.error('❌ Error marking login attendance:', err);
    }
  };

  // Fetch user profile and organization
  const fetchUserData = async (supabaseUser: SupabaseUser) => {
    try {
      console.log('📥 Fetching user data for:', supabaseUser.id);
      console.log('User metadata:', supabaseUser.user_metadata);

      // Fetch profile with timeout
      console.log('🔍 Querying profiles table...');

      let profileData = null;
      let profileError = null;

      try {
        const result = await Promise.race([
          supabase
            .from('profiles')
            .select('*')
            .eq('id', supabaseUser.id)
            .maybeSingle(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Profile fetch timeout after 5s')), 5000)
          )
        ]);

        profileData = (result as any).data;
        profileError = (result as any).error;
        console.log('✅ Profile data fetched:', profileData);
        console.log('Profile error:', profileError);
      } catch (timeoutError: any) {
        console.warn('⚠️ Profile fetch timed out:', timeoutError.message);
        console.warn('⚠️ This might be an RLS policy issue.');

        // CRITICAL: Don't overwrite existing user data if we already have it
        // This prevents losing organizationId on page navigation/token refresh
        if (userRef.current && userRef.current.id === supabaseUser.id && userRef.current.organizationId) {
          console.log('✅ Keeping existing user data with organizationId:', userRef.current.organizationId);
          return; // Keep existing state
        }

        // Only set minimal user data if we don't have any user data yet
        console.warn('⚠️ No existing user data, setting minimal user from auth metadata');
        const fallbackRole = (supabaseUser.user_metadata?.role || 'student') as string;
        const fallbackPermissions = getFallbackPermissionsForRole(fallbackRole);

        setUser({
          id: supabaseUser.id,
          email: supabaseUser.email!,
          name: supabaseUser.user_metadata?.full_name || 'User',
          role: fallbackRole,
          permissions: fallbackPermissions,
        });
        return;
      }

      // If profile doesn't exist, create it from user metadata
      if (!profileData) {
        console.log('Profile not found, creating from user metadata...');
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            id: supabaseUser.id,
            email: supabaseUser.email!,
            full_name: supabaseUser.user_metadata?.full_name || 'User',
            role: supabaseUser.user_metadata?.role || 'student',
            organization_id: supabaseUser.user_metadata?.organization_id || null,
          } as any)
          .select()
          .single();

        if (createError) {
          console.error('Error creating profile:', createError);
          // Don't throw - just set basic user data from auth
          const fallbackRole = (supabaseUser.user_metadata?.role || 'student') as string;
          const fallbackPermissions = getFallbackPermissionsForRole(fallbackRole);

          setUser({
            id: supabaseUser.id,
            email: supabaseUser.email!,
            name: supabaseUser.user_metadata?.full_name || 'User',
            role: fallbackRole,
            permissions: fallbackPermissions,
          });
          return;
        }

        if (!newProfile) {
          console.error('Failed to create profile - setting basic user data');
          // Still set user data from auth metadata
          const fallbackRole = (supabaseUser.user_metadata?.role || 'student') as string;
          const fallbackPermissions = getFallbackPermissionsForRole(fallbackRole);

          setUser({
            id: supabaseUser.id,
            email: supabaseUser.email!,
            name: supabaseUser.user_metadata?.full_name || 'User',
            role: fallbackRole,
            permissions: fallbackPermissions,
          });
          return;
        }

        console.log('New profile created:', newProfile);
        setProfile(newProfile as Profile);

        let orgData = null;
        // Fetch organization if exists
        if (newProfile.organization_id) {
          console.log('Fetching organization:', newProfile.organization_id);
          const { data: fetchedOrgData, error: orgError } = await supabase
            .from('organizations')
            .select('*')
            .eq('id', newProfile.organization_id)
            .maybeSingle();

          if (!orgError && fetchedOrgData) {
            orgData = fetchedOrgData;
            setOrganization(fetchedOrgData as Organization);
            console.log('Organization found:', fetchedOrgData);
          } else {
            console.warn('Organization not found or error:', orgError);
          }
        } else {
          console.warn('⚠️ No organization_id in new profile');

          // AUTO-FIX: Handle missing organization for all user types
          console.log('🔧 Auto-fixing user without organization...');
          console.log('User role:', newProfile.role);

          try {
            // Strategy depends on user role
            if (newProfile.role === 'admin') {
              // ADMIN: Try to find existing org by email, or create new one
              console.log('🔧 Fixing admin user - looking for existing organization...');

              const { data: existingOrg, error: findOrgError } = await supabase
                .from('organizations')
                .select('*')
                .eq('email', newProfile.email)
                .maybeSingle();

              if (!findOrgError && existingOrg) {
                console.log('✅ Found existing organization:', existingOrg.name);
                orgData = existingOrg;

                // Link profile to this organization
                const { error: updateError } = await supabase
                  .from('profiles')
                  .update({ organization_id: existingOrg.id } as any)
                  .eq('id', newProfile.id);

                if (updateError) {
                  console.error('❌ Error linking profile to organization:', updateError);
                } else {
                  console.log('✅ Profile linked to existing organization');
                  newProfile.organization_id = existingOrg.id;
                  setOrganization(existingOrg as Organization);
                }
              } else {
                // No existing organization found, create a new one
                console.log('📝 Creating new organization for admin user...');
                const { data: newOrg, error: createOrgError } = await supabase
                  .from('organizations')
                  .insert({
                    name: `${newProfile.full_name}'s Organization`,
                    email: newProfile.email,
                  } as any)
                  .select()
                  .single();

                if (createOrgError) {
                  console.error('❌ Error creating organization:', createOrgError);
                } else if (newOrg) {
                  console.log('✅ New organization created:', newOrg.name);
                  orgData = newOrg;

                  // Link profile to this new organization
                  const { error: updateError } = await supabase
                    .from('profiles')
                    .update({ organization_id: newOrg.id } as any)
                    .eq('id', newProfile.id);

                  if (updateError) {
                    console.error('❌ Error linking profile to new organization:', updateError);
                  } else {
                    console.log('✅ Profile linked to new organization');
                    newProfile.organization_id = newOrg.id;
                    setOrganization(newOrg as Organization);
                  }
                }
              }
            } else {
              // FACULTY/STUDENT: Try to find ANY organization (they should have been invited)
              console.log('🔧 Fixing faculty/student user - looking for any organization...');

              // First, try to find organization by email domain match
              const emailDomain = newProfile.email.split('@')[1];
              const { data: orgsByDomain, error: domainError } = await supabase
                .from('organizations')
                .select('*')
                .ilike('email', `%@${emailDomain}`)
                .limit(1);

              if (!domainError && orgsByDomain && orgsByDomain.length > 0) {
                console.log('✅ Found organization by email domain:', orgsByDomain[0].name);
                orgData = orgsByDomain[0];

                const { error: updateError } = await supabase
                  .from('profiles')
                  .update({ organization_id: orgsByDomain[0].id } as any)
                  .eq('id', newProfile.id);

                if (!updateError) {
                  console.log('✅ Profile linked to organization by domain');
                  newProfile.organization_id = orgsByDomain[0].id;
                  setOrganization(orgsByDomain[0] as Organization);
                }
              } else {
                // Last resort: Find the first active organization
                console.log('⚠️ No organization found by domain, trying first active org...');
                const { data: firstOrg, error: firstOrgError } = await supabase
                  .from('organizations')
                  .select('*')
                  .eq('is_active', true)
                  .limit(1)
                  .maybeSingle();

                if (!firstOrgError && firstOrg) {
                  console.log('✅ Linked to first active organization:', firstOrg.name);
                  orgData = firstOrg;

                  const { error: updateError } = await supabase
                    .from('profiles')
                    .update({ organization_id: firstOrg.id } as any)
                    .eq('id', newProfile.id);

                  if (!updateError) {
                    console.log('✅ Profile linked to first active organization');
                    newProfile.organization_id = firstOrg.id;
                    setOrganization(firstOrg as Organization);
                  }
                } else {
                  console.error('❌ No organizations found in database - user cannot be linked');
                }
              }
            }
          } catch (autoFixError) {
            console.error('❌ Error during auto-fix:', autoFixError);
          }
        }

        // Fetch permissions for the new profile
        const { permissions, roleName, roleId } = await fetchUserPermissions(newProfile);

        // Set user object
        setUser({
          id: supabaseUser.id,
          email: supabaseUser.email!,
          name: newProfile.full_name,
          role: newProfile.role,
          roleId: roleId || undefined,
          roleName: roleName,
          permissions: permissions,
          avatar: newProfile.avatar_url || undefined,
          organizationId: newProfile.organization_id || undefined,
          organizationName: orgData?.name || undefined,
          phone: newProfile.phone || undefined,
          nfcId: newProfile.nfc_id || undefined,
          branchId: newProfile.branch_id || undefined,
        });

        // Auto-mark login attendance
        markLoginAttendance(newProfile);
      } else {
        // Profile exists
        if (profileError) {
          console.error('Profile error:', profileError);

          // CRITICAL: Don't overwrite existing user data if we already have it
          if (userRef.current && userRef.current.id === supabaseUser.id && userRef.current.organizationId) {
            console.log('✅ Keeping existing user data with organizationId:', userRef.current.organizationId);
            return; // Keep existing state
          }

          // Only set minimal user data if we don't have any user data yet
          console.warn('⚠️ No existing user data, setting minimal user from auth metadata');
          const fallbackRole = (supabaseUser.user_metadata?.role || 'student') as string;
          const fallbackPermissions = getFallbackPermissionsForRole(fallbackRole);

          setUser({
            id: supabaseUser.id,
            email: supabaseUser.email!,
            name: supabaseUser.user_metadata?.full_name || 'User',
            role: fallbackRole,
            permissions: fallbackPermissions,
          });
          return;
        }

        console.log('Existing profile found:', profileData);
        setProfile(profileData as Profile);

        let orgData = null;
        // Fetch organization if exists
        if (profileData.organization_id) {
          console.log('Fetching organization:', profileData.organization_id);
          const { data: fetchedOrgData, error: orgError } = await supabase
            .from('organizations')
            .select('*')
            .eq('id', profileData.organization_id)
            .maybeSingle();

          if (!orgError && fetchedOrgData) {
            orgData = fetchedOrgData;
            setOrganization(orgData as Organization);
            console.log('Organization found:', orgData);
          } else {
            console.warn('Organization not found or error:', orgError);
          }
        } else {
          console.warn('⚠️ No organization_id in profile');

          // AUTO-FIX: Handle missing organization for all user types
          console.log('🔧 Auto-fixing user without organization...');
          console.log('User role:', profileData.role);

          try {
            // Strategy depends on user role
            if (profileData.role === 'admin') {
              // ADMIN: Try to find existing org by email, or create new one
              console.log('🔧 Fixing admin user - looking for existing organization...');

              const { data: existingOrg, error: findOrgError } = await supabase
                .from('organizations')
                .select('*')
                .eq('email', profileData.email)
                .maybeSingle();

              if (!findOrgError && existingOrg) {
                console.log('✅ Found existing organization:', existingOrg.name);
                orgData = existingOrg;

                // Link profile to this organization
                const { error: updateError } = await supabase
                  .from('profiles')
                  .update({ organization_id: existingOrg.id } as any)
                  .eq('id', profileData.id);

                if (updateError) {
                  console.error('❌ Error linking profile to organization:', updateError);
                } else {
                  console.log('✅ Profile linked to existing organization');
                  profileData.organization_id = existingOrg.id;
                  setOrganization(existingOrg as Organization);
                }
              } else {
                // No existing organization found, create a new one
                console.log('📝 Creating new organization for admin user...');
                const { data: newOrg, error: createOrgError } = await supabase
                  .from('organizations')
                  .insert({
                    name: `${profileData.full_name}'s Organization`,
                    email: profileData.email,
                  } as any)
                  .select()
                  .single();

                if (createOrgError) {
                  console.error('❌ Error creating organization:', createOrgError);
                } else if (newOrg) {
                  console.log('✅ New organization created:', newOrg.name);
                  orgData = newOrg;

                  // Link profile to this new organization
                  const { error: updateError } = await supabase
                    .from('profiles')
                    .update({ organization_id: newOrg.id } as any)
                    .eq('id', profileData.id);

                  if (updateError) {
                    console.error('❌ Error linking profile to new organization:', updateError);
                  } else {
                    console.log('✅ Profile linked to new organization');
                    profileData.organization_id = newOrg.id;
                    setOrganization(newOrg as Organization);
                  }
                }
              }
            } else {
              // FACULTY/STUDENT: Try to find ANY organization (they should have been invited)
              console.log('🔧 Fixing faculty/student user - looking for any organization...');

              // First, try to find organization by email domain match
              const emailDomain = profileData.email.split('@')[1];
              const { data: orgsByDomain, error: domainError } = await supabase
                .from('organizations')
                .select('*')
                .ilike('email', `%@${emailDomain}`)
                .limit(1);

              if (!domainError && orgsByDomain && orgsByDomain.length > 0) {
                console.log('✅ Found organization by email domain:', orgsByDomain[0].name);
                orgData = orgsByDomain[0];

                const { error: updateError } = await supabase
                  .from('profiles')
                  .update({ organization_id: orgsByDomain[0].id } as any)
                  .eq('id', profileData.id);

                if (!updateError) {
                  console.log('✅ Profile linked to organization by domain');
                  profileData.organization_id = orgsByDomain[0].id;
                  setOrganization(orgsByDomain[0] as Organization);
                }
              } else {
                // Last resort: Find the first active organization
                console.log('⚠️ No organization found by domain, trying first active org...');
                const { data: firstOrg, error: firstOrgError } = await supabase
                  .from('organizations')
                  .select('*')
                  .eq('is_active', true)
                  .limit(1)
                  .maybeSingle();

                if (!firstOrgError && firstOrg) {
                  console.log('✅ Linked to first active organization:', firstOrg.name);
                  orgData = firstOrg;

                  const { error: updateError } = await supabase
                    .from('profiles')
                    .update({ organization_id: firstOrg.id } as any)
                    .eq('id', profileData.id);

                  if (!updateError) {
                    console.log('✅ Profile linked to first active organization');
                    profileData.organization_id = firstOrg.id;
                    setOrganization(firstOrg as Organization);
                  }
                } else {
                  console.error('❌ No organizations found in database - user cannot be linked');
                }
              }
            }
          } catch (autoFixError) {
            console.error('❌ Error during auto-fix:', autoFixError);
          }
        }

        // Fetch permissions for the existing profile
        const { permissions, roleName, roleId } = await fetchUserPermissions(profileData);

        // Set user object
        setUser({
          id: supabaseUser.id,
          email: supabaseUser.email!,
          name: profileData.full_name,
          role: profileData.role,
          roleId: roleId || undefined,
          roleName: roleName,
          permissions: permissions,
          avatar: profileData.avatar_url || undefined,
          organizationId: profileData.organization_id || undefined,
          organizationName: orgData?.name || undefined,
          phone: profileData.phone || undefined,
          nfcId: profileData.nfc_id || undefined,
          branchId: profileData.branch_id || undefined,
        });

        // Auto-mark login attendance
        markLoginAttendance(profileData);
      }
    } catch (error: any) {
      console.error('❌ Error fetching user data:', error);

      // CRITICAL: Don't overwrite existing user data if we already have it
      if (user && user.id === supabaseUser.id && user.organizationId) {
        console.log('✅ Keeping existing user data with organizationId:', user.organizationId);
        return; // Keep existing state
      }

      // Only set minimal user data if we don't have any user data yet
      console.warn('⚠️ Using fallback user data from auth metadata');
      const fallbackRole = (supabaseUser.user_metadata?.role || 'student') as string;
      const fallbackPermissions = getFallbackPermissionsForRole(fallbackRole);

      setUser({
        id: supabaseUser.id,
        email: supabaseUser.email!,
        name: supabaseUser.user_metadata?.full_name || 'User',
        role: fallbackRole,
        permissions: fallbackPermissions,
      });
    }
  };

  // Initialize auth state
  useEffect(() => {
    let mounted = true;
    let initializationComplete = false;

    // Safety timeout - ensure loading state doesn't get stuck
    const loadingTimeout = setTimeout(() => {
      if (mounted && isLoading) {
        console.warn('⚠️ Loading timeout reached (5s), forcing loading to false');
        setIsLoading(false);
      }
    }, 5000); // 5 second timeout

    // Check active session
    const initializeAuth = async () => {
      try {
        console.log('🔄 Initializing auth...');
        // First check for a local session (faster)
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          console.log('No local session found');
          if (mounted) setIsLoading(false);
          initializationComplete = true;
          return;
        }

        // Use getUser() to validate the session with the server
        const { data: { user: authUser }, error } = await supabase.auth.getUser();

        if (error) {
          console.error('Error getting user:', error);
          if (mounted) setIsLoading(false);
          initializationComplete = true;
          return;
        }

        if (authUser && mounted) {
          console.log('User found from getUser(), fetching data...', authUser.id);
          await fetchUserData(authUser);
          if (mounted) {
            console.log('✅ Initial auth complete, setting isLoading to false');
            setIsLoading(false);
          }
        } else {
          console.log('No active user found');
          if (mounted) setIsLoading(false);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        if (mounted) setIsLoading(false);
      } finally {
        // Mark initialization as complete
        initializationComplete = true;
        console.log('✅ Initialization complete');
      }
    };

    initializeAuth();

    // Listen for auth changes (sign in, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔔 Auth state changed:', event, 'Session exists:', !!session, 'Init complete:', initializationComplete);

      // Skip INITIAL_SESSION event - we handle it in initializeAuth
      if (event === 'INITIAL_SESSION') {
        console.log('⏭️ Skipping INITIAL_SESSION event (handled by initializeAuth)');
        return;
      }

      // Skip SIGNED_IN during initialization - initializeAuth handles it
      if (event === 'SIGNED_IN' && !initializationComplete) {
        console.log('⏭️ Skipping SIGNED_IN during initialization (handled by initializeAuth)');
        return;
      }

      if (event === 'SIGNED_IN' && session?.user && mounted) {
        console.log('✅ User signed in (post-init), fetching data...');
        try {
          await fetchUserData(session.user);

          // Teacher attendance is now recorded inside fetchUserData()
        } catch (error) {
          console.error('Error fetching user data on sign in:', error);
          // CRITICAL: Don't overwrite existing user data if we already have it
          if (mounted && (!userRef.current || !userRef.current.organizationId)) {
            // Only set minimal user data if we don't have complete data yet
            console.warn('⚠️ Setting minimal user data from auth metadata');
            setUser({
              id: session.user.id,
              email: session.user.email!,
              name: session.user.user_metadata?.full_name || 'User',
              role: (session.user.user_metadata?.role as 'admin' | 'faculty' | 'student') || 'student',
            });
          } else if (userRef.current && userRef.current.organizationId) {
            console.log('✅ Keeping existing user data with organizationId:', userRef.current.organizationId);
          }
        } finally {
          if (mounted) {
            console.log('✅ Setting isLoading to false after sign in');
            setIsLoading(false);
          }
        }
      } else if (event === 'SIGNED_OUT' && mounted) {
        console.log('👋 User signed out');
        setUser(null);
        setProfile(null);
        setOrganization(null);
        if (mounted) setIsLoading(false);
      } else if (event === 'TOKEN_REFRESHED' && session?.user && mounted) {
        console.log('🔄 Token refreshed - checking if user data needs update...');
        // If we already have complete user data, skip re-fetching
        if (userRef.current && userRef.current.organizationId) {
          console.log('✅ Token refreshed - user data already complete, skipping re-fetch');
          return;
        }
        // Only re-fetch if user data is incomplete
        console.log('🔄 Token refreshed - user data incomplete, re-fetching...');
        fetchUserData(session.user).catch(err => {
          console.error('Error refreshing user data:', err);
        });
        // Don't set loading state for token refresh
      } else if (event === 'USER_UPDATED' && session?.user && mounted) {
        console.log('🔄 User updated, refreshing data...');
        try {
          await fetchUserData(session.user);
        } catch (error) {
          console.error('Error fetching user data on update:', error);
        }
      } else if (!session && mounted) {
        console.log('❌ No session, clearing user data');
        setUser(null);
        setProfile(null);
        setOrganization(null);
        if (mounted) setIsLoading(false);
      }
    });

    return () => {
      mounted = false;
      clearTimeout(loadingTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    try {
      console.log('🔐 Login attempt for:', email);
      setIsLoading(true); // Set loading state

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('❌ Login error:', error);
        throw error;
      }

      console.log('✅ Login successful, user data will be fetched by onAuthStateChange');
      // Don't manually fetch user data here - let onAuthStateChange handle it
      // This prevents race conditions and duplicate fetches
    } catch (error) {
      console.error('❌ Login failed:', error);
      setIsLoading(false);
      throw error;
    }
  };

  const signup = async (email: string, password: string, fullName: string, organizationName: string) => {
    let userId: string | null = null;
    let orgId: string | null = null;

    try {
      console.log('📝 Starting signup process for:', email);
      setIsLoading(true);

      // Step 1: Create the user account
      console.log('👤 Step 1: Creating user account...');
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: 'admin', // First user is always admin
            organization_name: organizationName, // Store temporarily
          },
        },
      });

      if (error) {
        console.error('❌ Signup auth error:', error);
        throw new Error(`Failed to create account: ${error.message}`);
      }

      if (!data.user) {
        throw new Error('Signup failed - no user returned from authentication');
      }

      userId = data.user.id;
      console.log('✅ User account created:', userId);

      // Step 2: Wait for profile to be created by trigger
      console.log('⏳ Step 2: Waiting for profile creation...');
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify profile exists
      let profileExists = false;
      let retries = 0;
      const maxRetries = 5;

      while (!profileExists && retries < maxRetries) {
        const { data: profileCheck, error: profileCheckError } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', userId)
          .maybeSingle();

        if (!profileCheckError && profileCheck) {
          profileExists = true;
          console.log('✅ Profile exists');
        } else {
          retries++;
          console.log(`⏳ Profile not found yet, retry ${retries}/${maxRetries}...`);
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      if (!profileExists) {
        throw new Error('Profile was not created by database trigger. Please contact support.');
      }

      // Step 3: Create the organization
      console.log('🏢 Step 3: Creating organization:', organizationName);

      // First check if organization already exists with this email
      const { data: existingOrg, error: existingOrgError } = await supabase
        .from('organizations')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      let orgData;
      if (!existingOrgError && existingOrg) {
        console.log('✅ Organization already exists, using existing:', existingOrg.id);
        orgData = existingOrg;
      } else {
        // Create new organization
        const { data: newOrgData, error: orgError } = await supabase
          .from('organizations')
          .insert([
            {
              name: organizationName,
              email: email,
            } as any,
          ])
          .select()
          .single();

        if (orgError) {
          console.error('❌ Organization creation error:', orgError);
          throw new Error(`Failed to create organization: ${orgError.message}`);
        }

        if (!newOrgData) {
          throw new Error('Failed to create organization - no data returned');
        }

        orgData = newOrgData;
        console.log('✅ Organization created:', (orgData as any).id);
      }

      orgId = (orgData as any).id;

      // Step 4: Link profile to organization with retry logic
      console.log('🔗 Step 4: Linking profile to organization...');
      let linkSuccess = false;
      retries = 0;

      while (!linkSuccess && retries < maxRetries) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ organization_id: orgId } as any)
          .eq('id', userId);

        if (!profileError) {
          linkSuccess = true;
          console.log('✅ Profile linked to organization');
        } else {
          retries++;
          console.error(`❌ Profile link attempt ${retries}/${maxRetries} failed:`, profileError);
          if (retries < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 500));
          } else {
            throw new Error(`Failed to link profile to organization: ${profileError.message}`);
          }
        }
      }

      // Step 5: Verify the link was successful
      console.log('✅ Step 5: Verifying organization link...');
      const { data: verifyProfile, error: verifyError } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', userId)
        .maybeSingle();

      if (verifyError || !verifyProfile || !verifyProfile.organization_id) {
        console.error('❌ Verification failed:', verifyError);
        throw new Error('Organization link verification failed. Please try logging in again.');
      }

      console.log('✅ Organization link verified:', verifyProfile.organization_id);

      // Step 6: Fetch complete user data
      console.log('📥 Step 6: Fetching complete user data...');
      await fetchUserData(data.user);

      setIsLoading(false);
      console.log('✅ Signup completed successfully!');
      console.log('   User ID:', userId);
      console.log('   Organization ID:', orgId);
    } catch (error: any) {
      console.error('❌ Signup error:', error);

      // Provide helpful error message
      let errorMessage = 'Signup failed. ';
      if (error.message) {
        errorMessage += error.message;
      } else {
        errorMessage += 'Please try again or contact support.';
      }

      // If we created a user but failed to link organization, provide recovery instructions
      if (userId && !orgId) {
        errorMessage += ' Your account was created but organization setup failed. Please try logging in - the system will automatically fix this.';
      }

      setIsLoading(false);
      throw new Error(errorMessage);
    }
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUser(null);
    setProfile(null);
    setOrganization(null);
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) throw new Error('No user logged in');

    const { error } = await supabase
      .from('profiles')
      .update(updates as any)
      .eq('id', user.id);

    if (error) throw error;

    // Refetch user data
    const { data: { user: supabaseUser } } = await supabase.auth.getUser();
    if (supabaseUser) {
      await fetchUserData(supabaseUser);
    }
  };

  const refreshUserData = async () => {
    console.log('🔄 Manually refreshing user data...');
    const { data: { user: supabaseUser } } = await supabase.auth.getUser();
    if (supabaseUser) {
      await fetchUserData(supabaseUser);
    } else {
      throw new Error('No authenticated user found');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        organization,
        isAuthenticated: !!user,
        isLoading,
        login,
        signup,
        logout,
        updateProfile,
        refreshUserData,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
