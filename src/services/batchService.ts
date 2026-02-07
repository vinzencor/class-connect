import { supabase } from '@/lib/supabase';
import { Tables } from '@/types/database';

type Batch = Tables<'batches'>;

export const batchService = {
  async getBatches(organizationId: string) {
    const { data, error } = await supabase
      .from('batches')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async createBatch(organizationId: string, name: string, description?: string) {
    const { data, error } = await supabase
      .from('batches')
      .insert({
        organization_id: organizationId,
        name,
        description: description ?? null,
      })
      .select()
      .single();

    if (error) throw error;
    return data as Batch;
  },

  async updateBatch(batchId: string, updates: Partial<Batch>) {
    const { data, error } = await supabase
      .from('batches')
      .update(updates as any)
      .eq('id', batchId)
      .select()
      .single();

    if (error) throw error;
    return data as Batch;
  },

  async deleteBatch(batchId: string) {
    const { error } = await supabase
      .from('batches')
      .delete()
      .eq('id', batchId);

    if (error) throw error;
    return true;
  },
};
