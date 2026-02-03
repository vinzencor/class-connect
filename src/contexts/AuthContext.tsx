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
      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', supabaseUser.id)
        .maybeSingle(); // Use maybeSingle() instead of single() to handle 0 rows gracefully

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
          throw createError;
        }

        if (!newProfile) throw new Error('Failed to create profile');
        setProfile(newProfile as Profile);

        let orgData = null;
        // Fetch organization if exists
        if (newProfile.organization_id) {
          const { data: fetchedOrgData, error: orgError } = await supabase
            .from('organizations')
            .select('*')
            .eq('id', newProfile.organization_id)
            .maybeSingle();

          if (!orgError && fetchedOrgData) {
            orgData = fetchedOrgData;
            setOrganization(fetchedOrgData as Organization);
          }
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
        if (profileError) throw profileError;
        setProfile(profileData as Profile);

        // Fetch organization if exists
        if (profileData.organization_id) {
          const { data: orgData, error: orgError } = await supabase
            .from('organizations')
            .select('*')
            .eq('id', profileData.organization_id)
            .maybeSingle();

          if (!orgError && orgData) {
            setOrganization(orgData as Organization);
          }
        }

        // Set user object
        setUser({
          id: supabaseUser.id,
          email: supabaseUser.email!,
          name: profileData.full_name,
          role: profileData.role as 'admin' | 'faculty' | 'student',
          avatar: profileData.avatar_url || undefined,
          organizationId: profileData.organization_id || undefined,
          organizationName: organization?.name || undefined,
          phone: profileData.phone || undefined,
          nfcId: profileData.nfc_id || undefined,
        });
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      throw error; // Re-throw to handle in login/signup
    }
  };

  // Initialize auth state
  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchUserData(session.user);
      }
      setIsLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchUserData(session.user);
      } else {
        setUser(null);
        setProfile(null);
        setOrganization(null);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    if (data.user) {
      await fetchUserData(data.user);
    }
  };

  const signup = async (email: string, password: string, fullName: string, organizationName: string) => {
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

    if (error) throw error;
    if (!data.user) throw new Error('Signup failed');

    // Now that user is authenticated, create the organization
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

    if (orgError) throw orgError;
    if (!orgData) throw new Error('Failed to create organization');

    // Update the profile with organization_id
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ organization_id: (orgData as any).id } as any)
      .eq('id', data.user.id);

    if (profileError) throw profileError;

    // Fetch complete user data
    await fetchUserData(data.user);
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
