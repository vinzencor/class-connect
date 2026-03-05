import { supabase } from '@/lib/supabase';

export interface Reference {
  id: string;
  organization_id: string;
  name: string;
  created_at: string;
}

export const referenceService = {
  async getReferences(organizationId: string): Promise<Reference[]> {
    if (!organizationId) throw new Error('Organization ID is required');

    const { data, error } = await supabase
      .from('references_list')
      .select('*')
      .eq('organization_id', organizationId)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching references:', error);
      throw error;
    }

    return data || [];
  },

  async addReference(organizationId: string, name: string): Promise<Reference> {
    if (!organizationId) throw new Error('Organization ID is required');

    const { data, error } = await supabase
      .from('references_list')
      .insert([
        {
          organization_id: organizationId,
          name: name.trim(),
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Error creating reference:', error);
      throw error;
    }

    return data;
  },

  async updateReference(id: string, name: string): Promise<Reference> {
    const { data, error } = await supabase
      .from('references_list')
      .update({ name: name.trim() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating reference:', error);
      throw error;
    }

    return data;
  },

  async deleteReference(id: string): Promise<void> {
    const { error } = await supabase
      .from('references_list')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting reference:', error);
      throw error;
    }
  },
};
