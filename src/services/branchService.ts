import { supabase } from '@/lib/supabase';
import { Tables } from '@/types/database';

export type Branch = Tables<'branches'>;
export type UserBranchPreference = Tables<'user_branch_preferences'>;

export interface CreateBranchData {
  name: string;
  code: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  phone?: string;
  email?: string;
  is_main_branch?: boolean;
}

export const branchService = {
  /**
   * Get all branches for an organization
   */
  async getBranches(organizationId: string): Promise<Branch[]> {
    const { data, error } = await supabase
      .from('branches')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('is_main_branch', { ascending: false })
      .order('name');

    if (error) throw error;
    return data || [];
  },

  /**
   * Get a single branch by ID
   */
  async getBranch(branchId: string): Promise<Branch | null> {
    const { data, error } = await supabase
      .from('branches')
      .select('*')
      .eq('id', branchId)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Get the main branch for an organization
   */
  async getMainBranch(organizationId: string): Promise<Branch | null> {
    const { data, error } = await supabase
      .from('branches')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_main_branch', true)
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
    return data;
  },

  /**
   * Create a new branch
   */
  async createBranch(organizationId: string, branchData: CreateBranchData): Promise<Branch> {
    // If this is marked as main branch, unset any existing main branch
    if (branchData.is_main_branch) {
      await supabase
        .from('branches')
        .update({ is_main_branch: false })
        .eq('organization_id', organizationId)
        .eq('is_main_branch', true);
    }

    const { data, error } = await supabase
      .from('branches')
      .insert({
        organization_id: organizationId,
        ...branchData,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Update a branch
   */
  async updateBranch(branchId: string, updates: Partial<CreateBranchData>): Promise<Branch> {
    // If setting as main branch, unset any existing main branch
    if (updates.is_main_branch) {
      const branch = await this.getBranch(branchId);
      if (branch) {
        await supabase
          .from('branches')
          .update({ is_main_branch: false })
          .eq('organization_id', branch.organization_id)
          .eq('is_main_branch', true)
          .neq('id', branchId);
      }
    }

    const { data, error } = await supabase
      .from('branches')
      .update(updates)
      .eq('id', branchId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Delete (deactivate) a branch
   */
  async deleteBranch(branchId: string): Promise<void> {
    const { error } = await supabase
      .from('branches')
      .update({ is_active: false })
      .eq('id', branchId);

    if (error) throw error;
  },

  /**
   * Get user's current branch preference
   */
  async getUserCurrentBranch(userId: string, organizationId: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('user_branch_preferences')
      .select('current_branch_id, updated_at')
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (error) {
      console.warn('Failed to fetch user branch preference, defaulting to null:', error);
      return null;
    }

    return data?.[0]?.current_branch_id || null;
  },

  /**
   * Set user's current branch
   */
  async setUserCurrentBranch(userId: string, organizationId: string, branchId: string | null): Promise<void> {
    const { error } = await supabase
      .from('user_branch_preferences')
      .upsert({
        user_id: userId,
        organization_id: organizationId,
        current_branch_id: branchId,
      }, {
        onConflict: 'user_id,organization_id',
        ignoreDuplicates: false,
      });

    if (error) throw error;
  },
};

