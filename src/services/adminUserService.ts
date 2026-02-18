/**
 * Admin User Service
 * Uses Supabase Edge Function to create users with auto-confirmation
 * This allows email confirmation to remain enabled while admin-created users are auto-confirmed
 */

import { supabase } from '../lib/supabase';

export const adminUserService = {
  /**
   * Create a new user using Edge Function (auto-confirms email)
   * This is the preferred method when email confirmation is enabled
   */
  async createUserWithAutoConfirm(data: {
    email: string;
    password: string;
    full_name: string;
    role: 'student' | 'faculty';
    organization_id?: string;
    metadata?: Record<string, any>;
  }) {
    try {
      // Get current session token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No active session. Please log in again.');
      }

      // Call Edge Function
      const { data: result, error } = await supabase.functions.invoke('create-student', {
        body: data,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error('Edge function error:', error);
        throw error;
      }

      if (!result.success) {
        throw new Error(result.error || 'Failed to create user');
      }

      return result;
    } catch (error) {
      console.error('Error in createUserWithAutoConfirm:', error);
      throw error;
    }
  },

  /**
   * Fallback: Create user with regular signUp (requires email confirmation)
   * Only use this if Edge Function is not available
   */
  async createUserFallback(data: {
    email: string;
    password: string;
    full_name: string;
    role: 'student' | 'faculty';
    organization_id: string;
    metadata?: Record<string, any>;
  }) {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          full_name: data.full_name,
          role: data.role,
          organization_id: data.organization_id,
          ...data.metadata,
        },
      },
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('Failed to create user');

    return {
      success: true,
      user: authData.user,
      requiresEmailConfirmation: true,
    };
  },

  /**
   * Smart create user - tries Edge Function first, falls back to regular signUp
   */
  async createUser(data: {
    email: string;
    password: string;
    full_name: string;
    role: 'student' | 'faculty';
    organization_id: string;
    metadata?: Record<string, any>;
  }) {
    try {
      // Try Edge Function first (auto-confirms email)
      console.log('Attempting to create user with Edge Function (auto-confirm)...');
      const result = await this.createUserWithAutoConfirm(data);
      console.log('✅ User created with auto-confirmation');
      return result;
    } catch (edgeFunctionError) {
      console.warn('Edge Function failed, falling back to regular signUp:', edgeFunctionError);
      
      // Fallback to regular signUp
      console.log('Using fallback method (requires email confirmation)...');
      const result = await this.createUserFallback(data);
      
      if (result.requiresEmailConfirmation) {
        console.warn('⚠️ User created but requires email confirmation');
        console.warn('The user will need to confirm their email before they can log in');
      }
      
      return result;
    }
  },
};

