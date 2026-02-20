import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';
import { registrationService } from './registrationService';

type Lead = Tables<'crm_leads'>;
type Profile = Tables<'profiles'>;

export const crmService = {
  async getLeads(organizationId: string, branchId?: string | null) {
    let query = supabase
      .from('crm_leads')
      .select('*')
      .eq('organization_id', organizationId);

    // Filter by branch if a specific branch is selected
    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    return data as Lead[];
  },

  async createLead(lead: Partial<Lead>) {
    const { data, error } = await supabase
      .from('crm_leads')
      .insert(lead)
      .select()
      .single();

    if (error) throw error;
    return data as Lead;
  },

  async updateLead(id: string, updates: Partial<Lead>) {
    const { data, error } = await supabase
      .from('crm_leads')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Lead;
  },

  async getAssignableProfiles(organizationId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id,full_name,role')
      .eq('organization_id', organizationId)
      .in('role', ['admin', 'faculty']);

    if (error) throw error;
    return data as Profile[];
  },

  async getCurrentOrganizationId() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .maybeSingle();

    if (error) throw error;
    const row = data as { organization_id?: string | null } | null;
    return row?.organization_id || null;
  },

  /**
   * Convert a lead to a student by creating a registration record
   */
  async convertLead(
    leadId: string,
    registrationData: {
      organizationId: string;
      courseId: string;
      batchId: string;
      courseFee: number;
      discountAmount: number;
      taxInclusive: boolean;
      taxPercentage: number;
      paymentType: 'full' | 'emi' | 'installment';
      advancePayment: number;
    }
  ) {
    // Create the registration record
    const registration = await registrationService.createRegistration({
      ...registrationData,
      leadId,
    });

    // Update lead status to converted (will be fully updated when admin verifies)
    await this.updateLead(leadId, { status: 'converted' });

    return registration;
  },

  /**
   * Get courses (classes) for an organization
   */
  async getCourses(organizationId: string, branchId?: string | null) {
    let query = supabase
      .from('classes')
      .select('id, name, subject')
      .eq('organization_id', organizationId)
      .eq('is_active', true);

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query.order('name');

    if (error) throw error;
    return data;
  },

  /**
   * Get batches for an organization
   */
  async getBatches(organizationId: string, branchId?: string | null) {
    let query = supabase
      .from('batches')
      .select('id, name, description')
      .eq('organization_id', organizationId);

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query.order('name');

    if (error) throw error;
    return data;
  },
};
