import { supabase } from '@/lib/supabase';

export interface Designation {
    id: string;
    organization_id: string;
    name: string;
    created_at: string;
}

export const designationService = {
    async getDesignations(organizationId: string): Promise<Designation[]> {
        if (!organizationId) throw new Error('Organization ID is required');

        const { data, error } = await supabase
            .from('designations')
            .select('*')
            .eq('organization_id', organizationId)
            .order('name', { ascending: true });

        if (error) {
            console.error('Error fetching designations:', error);
            throw error;
        }

        return data || [];
    },

    async addDesignation(organizationId: string, name: string): Promise<Designation> {
        if (!organizationId) throw new Error('Organization ID is required');

        const { data, error } = await supabase
            .from('designations')
            .insert([
                {
                    organization_id: organizationId,
                    name: name.trim()
                }
            ])
            .select()
            .single();

        if (error) {
            console.error('Error creating designation:', error);
            throw error;
        }

        return data;
    },

    async updateDesignation(id: string, name: string): Promise<Designation> {
        const { data, error } = await supabase
            .from('designations')
            .update({ name: name.trim() })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating designation:', error);
            throw error;
        }

        return data;
    },

    async deleteDesignation(id: string): Promise<void> {
        const { error } = await supabase
            .from('designations')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting designation:', error);
            throw error;
        }
    }
};

