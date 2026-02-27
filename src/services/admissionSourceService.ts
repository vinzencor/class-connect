import { supabase } from '@/lib/supabase';

export interface AdmissionSource {
    id: string;
    organization_id: string;
    name: string;
    created_at: string;
}

export const admissionSourceService = {
    async getSources(organizationId: string): Promise<AdmissionSource[]> {
        if (!organizationId) throw new Error('Organization ID is required');

        const { data, error } = await supabase
            .from('admission_sources')
            .select('*')
            .eq('organization_id', organizationId)
            .order('name', { ascending: true });

        if (error) {
            console.error('Error fetching admission sources:', error);
            throw error;
        }

        return data || [];
    },

    async addSource(organizationId: string, name: string): Promise<AdmissionSource> {
        if (!organizationId) throw new Error('Organization ID is required');

        const { data, error } = await supabase
            .from('admission_sources')
            .insert([
                {
                    organization_id: organizationId,
                    name: name.trim()
                }
            ])
            .select()
            .single();

        if (error) {
            console.error('Error creating admission source:', error);
            throw error;
        }

        return data;
    },

    async updateSource(id: string, name: string): Promise<AdmissionSource> {
        const { data, error } = await supabase
            .from('admission_sources')
            .update({ name: name.trim() })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating admission source:', error);
            throw error;
        }

        return data;
    },

    async deleteSource(id: string): Promise<void> {
        const { error } = await supabase
            .from('admission_sources')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting admission source:', error);
            throw error;
        }
    }
};
