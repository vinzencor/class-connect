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
    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async createBatch(
    organizationId: string,
    name: string,
    description?: string,
    branchId?: string | null,
    moduleSubjectId?: string | null,
    validityStart?: string | null,
    validityEnd?: string | null
  ) {
    const { data, error } = await supabase
      .from('batches')
      .insert({
        organization_id: organizationId,
        name,
        description: description ?? null,
        branch_id: branchId ?? null,
        module_subject_id: moduleSubjectId ?? null,
        validity_start: validityStart ?? null,
        validity_end: validityEnd ?? null,
        is_active: true,
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
