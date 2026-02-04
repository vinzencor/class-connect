import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { Tables } from '../types/database';

type Profile = Tables<'profiles'>;
type Organization = Tables<'organizations'>;

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'faculty' | 'student';
  avatar?: string;
  organizationId?: string;
  organizationName?: string;
  phone?: string;
  nfcId?: string;
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
        console.warn('⚠️ This might be an RLS policy issue. Setting user from auth metadata...');

        // Set user immediately from auth metadata
        setUser({
          id: supabaseUser.id,
          email: supabaseUser.email!,
          name: supabaseUser.user_metadata?.full_name || 'User',
          role: (supabaseUser.user_metadata?.role as 'admin' | 'faculty' | 'student') || 'student',
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
          setUser({
            id: supabaseUser.id,
            email: supabaseUser.email!,
            name: supabaseUser.user_metadata?.full_name || 'User',
            role: (supabaseUser.user_metadata?.role as 'admin' | 'faculty' | 'student') || 'student',
          });
          return;
        }

        if (!newProfile) {
          console.error('Failed to create profile - setting basic user data');
          // Still set user data from auth metadata
          setUser({
            id: supabaseUser.id,
            email: supabaseUser.email!,
            name: supabaseUser.user_metadata?.full_name || 'User',
            role: (supabaseUser.user_metadata?.role as 'admin' | 'faculty' | 'student') || 'student',
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
          console.warn('No organization_id in new profile');
        }

        // Set user object
        setUser({
          id: supabaseUser.id,
          email: supabaseUser.email!,
          name: newProfile.full_name,
          role: newProfile.role as 'admin' | 'faculty' | 'student',
          avatar: newProfile.avatar_url || undefined,
          organizationId: newProfile.organization_id || undefined,
          organizationName: orgData?.name || undefined,
          phone: newProfile.phone || undefined,
          nfcId: newProfile.nfc_id || undefined,
        });
      } else {
        // Profile exists
        if (profileError) {
          console.error('Profile error:', profileError);
          // Don't throw - just set basic user data from auth
          setUser({
            id: supabaseUser.id,
            email: supabaseUser.email!,
            name: supabaseUser.user_metadata?.full_name || 'User',
            role: (supabaseUser.user_metadata?.role as 'admin' | 'faculty' | 'student') || 'student',
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
          console.warn('No organization_id in profile');
        }

        // Set user object
        setUser({
          id: supabaseUser.id,
          email: supabaseUser.email!,
          name: profileData.full_name,
          role: profileData.role as 'admin' | 'faculty' | 'student',
          avatar: profileData.avatar_url || undefined,
          organizationId: profileData.organization_id || undefined,
          organizationName: orgData?.name || undefined,
          phone: profileData.phone || undefined,
          nfcId: profileData.nfc_id || undefined,
        });
      }
    } catch (error: any) {
      console.error('❌ Error fetching user data:', error);
      console.warn('⚠️ Using fallback user data from auth metadata');
      // Don't throw - set minimal user data to keep session alive
      setUser({
        id: supabaseUser.id,
        email: supabaseUser.email!,
        name: supabaseUser.user_metadata?.full_name || 'User',
        role: (supabaseUser.user_metadata?.role as 'admin' | 'faculty' | 'student') || 'student',
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
        } catch (error) {
          console.error('Error fetching user data on sign in:', error);
          // Set minimal user data even on error
          if (mounted) {
            setUser({
              id: session.user.id,
              email: session.user.email!,
              name: session.user.user_metadata?.full_name || 'User',
              role: (session.user.user_metadata?.role as 'admin' | 'faculty' | 'student') || 'student',
            });
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
        console.log('🔄 Token refreshed - silently updating user data in background...');
        // Don't await - let it run in background to avoid blocking UI
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
    try {
      console.log('📝 Starting signup process for:', email);
      setIsLoading(true);

      // First, sign up the user WITHOUT organization (to get authenticated)
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
        throw error;
      }

      if (!data.user) {
        throw new Error('Signup failed - no user returned');
      }

      console.log('✅ User created:', data.user.id);

      // Now create the organization
      console.log('🏢 Creating organization:', organizationName);
      const { data: orgData, error: orgError } = await supabase
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
        throw orgError;
      }

      if (!orgData) {
        throw new Error('Failed to create organization');
      }

      console.log('✅ Organization created:', (orgData as any).id);

      // Wait a moment for database operations
      await new Promise(resolve => setTimeout(resolve, 500));

      // Update the profile with organization_id
      console.log('🔄 Updating profile with organization_id');
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ organization_id: (orgData as any).id } as any)
        .eq('id', data.user.id);

      if (profileError) {
        console.error('❌ Profile update error:', profileError);
        throw profileError;
      }

      console.log('✅ Profile updated successfully');

      // Fetch complete user data
      await fetchUserData(data.user);
      setIsLoading(false);
      console.log('✅ Signup completed successfully');
    } catch (error) {
      console.error('❌ Signup error:', error);
      setIsLoading(false);
      throw error;
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
