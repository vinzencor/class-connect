import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';

type Lead = Tables<'crm_leads'>;
type Profile = Tables<'profiles'>;

export const crmService = {
  async getLeads(organizationId: string) {
    const { data, error } = await supabase
      .from('crm_leads')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

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
};
