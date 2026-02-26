import { supabase } from '@/lib/supabase';
import { Tables } from '@/types/database';

type Batch = Tables<'batches'>;

export const batchService = {
  async getBatches(organizationId: string, branchId?: string | null) {
    let query = supabase
      .from('batches')
      .select('*')
      .eq('organization_id', organizationId);

    // Filter by branch if a specific branch is selected
    // Also include items with no branch (created before branch filtering)
    if (branchId) {
      query = query.or(`branch_id.eq.${branchId},branch_id.is.null`);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async createBatch(organizationId: string, name: string, description?: string, branchId?: string | null, moduleSubjectId?: string | null) {
    const { data, error } = await supabase
      .from('batches')
      .insert({
        organization_id: organizationId,
        name,
        description: description ?? null,
        branch_id: branchId ?? null,
        module_subject_id: moduleSubjectId ?? null,
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
