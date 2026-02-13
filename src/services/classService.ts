import { supabase } from '@/lib/supabase';
import { Tables } from '@/types/database';

type Class = Tables<'classes'>;
type ClassBatch = Tables<'class_batches'>;
type Batch = Tables<'batches'>;

export interface ClassWithBatches extends Class {
  batches?: Batch[];
  faculty?: {
    full_name: string;
  };
}

export interface CreateClassData {
  name: string;
  subject: string;
  description?: string;
  faculty_id?: string;
  schedule_day?: string;
  schedule_time?: string;
  duration_minutes?: number;
  room_number?: string;
  meet_link?: string;
  is_active?: boolean;
}

export const classService = {
  /**
   * Get all classes with their assigned batches
   */
  async getClasses(organizationId: string): Promise<ClassWithBatches[]> {
    const { data: classes, error: classesError } = await supabase
      .from('classes')
      .select(`
        *,
        faculty:profiles!classes_faculty_id_fkey(full_name)
      `)
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (classesError) throw classesError;

    // Fetch batch assignments for all classes
    const classIds = classes?.map((c) => c.id) || [];
    if (classIds.length === 0) return [];

    const { data: classBatches, error: batchesError } = await supabase
      .from('class_batches')
      .select(`
        class_id,
        batches (*)
      `)
      .in('class_id', classIds);

    if (batchesError) throw batchesError;

    // Map batches to classes
    const classesWithBatches: ClassWithBatches[] = classes.map((cls) => ({
      ...cls,
      batches: classBatches
        ?.filter((cb: any) => cb.class_id === cls.id)
        .map((cb: any) => cb.batches)
        .filter(Boolean) || [],
    }));

    return classesWithBatches;
  },

  /**
   * Create a new class with batch assignments
   */
  async createClass(
    organizationId: string,
    classData: CreateClassData,
    batchIds: string[] = []
  ): Promise<ClassWithBatches> {
    // Insert the class - convert empty strings to null for nullable fields
    const { data: newClass, error: classError } = await supabase
      .from('classes')
      .insert({
        organization_id: organizationId,
        name: classData.name,
        subject: classData.subject,
        description: classData.description || null,
        faculty_id: classData.faculty_id || null,
        schedule_day: classData.schedule_day || null,
        schedule_time: classData.schedule_time || null,
        duration_minutes: classData.duration_minutes ?? 60,
        room_number: classData.room_number || null,
        meet_link: classData.meet_link || null,
        is_active: classData.is_active ?? true,
      })
      .select()
      .single();

    if (classError) throw classError;

    // Insert batch assignments if any
    if (batchIds.length > 0) {
      const batchAssignments = batchIds.map((batchId) => ({
        class_id: newClass.id,
        batch_id: batchId,
      }));

      const { error: batchError } = await supabase
        .from('class_batches')
        .insert(batchAssignments);

      if (batchError) throw batchError;
    }

    // Fetch the created class with batches
    const { data: classWithBatches, error: fetchError } = await supabase
      .from('classes')
      .select(`
        *,
        faculty:profiles!classes_faculty_id_fkey(full_name)
      `)
      .eq('id', newClass.id)
      .single();

    if (fetchError) throw fetchError;

    // Fetch batch assignments
    const { data: classBatches } = await supabase
      .from('class_batches')
      .select(`
        class_id,
        batches (*)
      `)
      .eq('class_id', newClass.id);

    const result: ClassWithBatches = {
      ...classWithBatches,
      batches: classBatches?.map((cb: any) => cb.batches).filter(Boolean) || [],
    };

    return result;
  },

  /**
   * Update a class and its batch assignments
   */
  async updateClass(
    classId: string,
    updates: Partial<CreateClassData>,
    batchIds?: string[]
  ): Promise<Class> {
    // Update the class - convert empty strings to null for nullable fields
    const { data: updatedClass, error: updateError } = await supabase
      .from('classes')
      .update({
        ...(updates.name && { name: updates.name }),
        ...(updates.subject && { subject: updates.subject }),
        ...(updates.description !== undefined && { description: updates.description || null }),
        ...(updates.faculty_id !== undefined && { faculty_id: updates.faculty_id || null }),
        ...(updates.schedule_day !== undefined && { schedule_day: updates.schedule_day || null }),
        ...(updates.schedule_time !== undefined && { schedule_time: updates.schedule_time || null }),
        ...(updates.duration_minutes !== undefined && { duration_minutes: updates.duration_minutes }),
        ...(updates.room_number !== undefined && { room_number: updates.room_number || null }),
        ...(updates.meet_link !== undefined && { meet_link: updates.meet_link || null }),
        ...(updates.is_active !== undefined && { is_active: updates.is_active }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', classId)
      .select()
      .single();

    if (updateError) throw updateError;

    // Update batch assignments if provided
    if (batchIds !== undefined) {
      // Delete existing batch assignments
      const { error: deleteError } = await supabase
        .from('class_batches')
        .delete()
        .eq('class_id', classId);

      if (deleteError) throw deleteError;

      // Insert new batch assignments
      if (batchIds.length > 0) {
        const batchAssignments = batchIds.map((batchId) => ({
          class_id: classId,
          batch_id: batchId,
        }));

        const { error: insertError } = await supabase
          .from('class_batches')
          .insert(batchAssignments);

        if (insertError) throw insertError;
      }
    }

    return updatedClass;
  },

  /**
   * Delete a class (will cascade to sessions, enrollments, and batch assignments)
   */
  async deleteClass(classId: string): Promise<void> {
    const { error } = await supabase
      .from('classes')
      .delete()
      .eq('id', classId);

    if (error) throw error;
  },

  /**
   * Get batch assignments for a specific class
   */
  async getClassBatches(classId: string): Promise<Batch[]> {
    const { data, error } = await supabase
      .from('class_batches')
      .select('batches (*)')
      .eq('class_id', classId);

    if (error) throw error;
    return (data?.map((cb: any) => cb.batches).filter(Boolean) || []) as Batch[];
  },

  /**
   * Get all classes assigned to a specific batch
   */
  async getClassesForBatch(batchId: string): Promise<Class[]> {
    const { data, error } = await supabase
      .from('class_batches')
      .select('classes (*)')
      .eq('batch_id', batchId);

    if (error) throw error;
    return (data?.map((cb: any) => cb.classes).filter(Boolean) || []) as Class[];
  },

  /**
   * Assign batches to a class
   */
  async assignBatchesToClass(classId: string, batchIds: string[]): Promise<void> {
    if (batchIds.length === 0) return;

    const batchAssignments = batchIds.map((batchId) => ({
      class_id: classId,
      batch_id: batchId,
    }));

    const { error } = await supabase
      .from('class_batches')
      .upsert(batchAssignments, { onConflict: 'class_id,batch_id' });

    if (error) throw error;
  },

  /**
   * Remove batch assignment from a class
   */
  async removeBatchFromClass(classId: string, batchId: string): Promise<void> {
    const { error } = await supabase
      .from('class_batches')
      .delete()
      .eq('class_id', classId)
      .eq('batch_id', batchId);

    if (error) throw error;
  },
};
