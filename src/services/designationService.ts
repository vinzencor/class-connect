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
            .select();

        if (error) {
            console.error('Error creating designation:', error);
            throw error;
        }

        if (!data || data.length === 0) {
            // Insert succeeded but read-back was blocked by RLS — fetch it directly
            const { data: fetched, error: fetchError } = await supabase
                .from('designations')
                .select('*')
                .eq('organization_id', organizationId)
                .eq('name', name.trim())
                .limit(1)
                .single();

            if (fetchError) {
                console.error('Error fetching newly created designation:', fetchError);
                throw fetchError;
            }
            return fetched;
        }

        return data[0];
    },

    async updateDesignation(id: string, name: string): Promise<Designation> {
        const { data, error } = await supabase
            .from('designations')
            .update({ name: name.trim() })
            .eq('id', id)
            .select();

        if (error) {
            console.error('Error updating designation:', error);
            throw error;
        }

        if (!data || data.length === 0) {
            const { data: fetched, error: fetchError } = await supabase
                .from('designations')
                .select('*')
                .eq('id', id)
                .single();

            if (fetchError) throw fetchError;
            return fetched;
        }

        return data[0];
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

