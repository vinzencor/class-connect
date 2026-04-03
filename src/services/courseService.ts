import { supabase } from '@/lib/supabase';

export interface Course {
    id: string;
    organization_id: string;
    name: string;
    description: string | null;
    price: number;
    duration: string | null;
    tax_type: string | null;
    tax_amount: number;
    sort_order: number;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export interface ComboBatch {
    id: string;
    name: string;
    module_subject_id: string | null;
}

export interface CourseCombo {
    id: string;
    organization_id: string;
    branch_id: string | null;
    name: string;
    description: string | null;
    price: number;
    is_active: boolean;
    created_by: string | null;
    created_at: string;
    updated_at: string;
    courses: Course[];
    batches: ComboBatch[];
}

/**
 * Fetch all courses (module_subjects) with prices
 */
export async function getCourses(organizationId: string, branchId?: string | null): Promise<Course[]> {
    let query = supabase
        .from('module_subjects')
        .select('*')
        .eq('organization_id', organizationId);

    if (branchId) {
        query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query.order('name', { ascending: true });

    if (error) throw error;
    return (data || []).map((d: any) => ({
        ...d,
        price: d.price ?? 0,
        duration: d.duration ?? null,
        tax_type: d.tax_type ?? 'none',
        tax_amount: d.tax_amount ?? 0,
    }));
}

/**
 * Create a new course (also appears in Modules as a subject)
 */
export async function createCourse(
    organizationId: string,
    name: string,
    description: string | null,
    price: number,
    createdBy: string,
    branchId?: string | null,
    duration?: string | null,
    taxType?: string | null,
    taxAmount?: number
): Promise<Course> {
    // Get max sort_order
    const { data: maxData } = await supabase
        .from('module_subjects')
        .select('sort_order')
        .eq('organization_id', organizationId)
        .order('sort_order', { ascending: false })
        .limit(1)
        .maybeSingle();

    const nextSortOrder = (maxData?.sort_order ?? -1) + 1;

    const insertData: any = {
        organization_id: organizationId,
        name,
        description,
        price,
        sort_order: nextSortOrder,
        created_by: createdBy,
        duration: duration ?? null,
        tax_type: taxType ?? 'none',
        tax_amount: taxAmount ?? 0,
    };
    if (branchId) {
        insertData.branch_id = branchId;
    }

    const { data, error } = await supabase
        .from('module_subjects')
        .insert(insertData)
        .select()
        .single();

    if (error) throw error;
    return { ...data, price: data.price ?? 0, duration: data.duration ?? null, tax_type: data.tax_type ?? 'none', tax_amount: data.tax_amount ?? 0 };
}

/**
 * Update course price
 */
export async function updateCoursePrice(
    courseId: string,
    price: number
): Promise<void> {
    const { error } = await supabase
        .from('module_subjects')
        .update({ price, updated_at: new Date().toISOString() })
        .eq('id', courseId);

    if (error) throw error;
}

/**
 * Update course details (name, description, price)
 */
export async function updateCourse(
    courseId: string,
    updates: { name?: string; description?: string | null; price?: number; duration?: string | null; tax_type?: string | null; tax_amount?: number }
): Promise<void> {
    const { error } = await supabase
        .from('module_subjects')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', courseId);

    if (error) throw error;
}

/**
 * Delete a course (also removes from Modules)
 */
export async function deleteCourse(courseId: string): Promise<void> {
    const { error } = await supabase
        .from('module_subjects')
        .delete()
        .eq('id', courseId);

    if (error) throw error;
}

export async function getCourseCombos(organizationId: string, branchId?: string | null): Promise<CourseCombo[]> {
    let comboQuery = supabase
        .from('course_combos')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('name', { ascending: true });

    if (branchId) {
        comboQuery = comboQuery.eq('branch_id', branchId);
    }

    const { data: combos, error: comboError } = await comboQuery;
    if (comboError) throw comboError;
    if (!combos || combos.length === 0) return [];

    const comboIds = combos.map((combo: any) => combo.id);
    const { data: comboItems, error: itemError } = await supabase
        .from('course_combo_items')
        .select('combo_id, course_id, sort_order, course:module_subjects(*)')
        .in('combo_id', comboIds)
        .order('sort_order', { ascending: true });

    if (itemError) throw itemError;

    const coursesByCombo: Record<string, Course[]> = {};
    (comboItems || []).forEach((item: any) => {
        const comboId = item.combo_id as string | undefined;
        if (!comboId) return;

        const rawCourse = Array.isArray(item.course) ? item.course[0] : item.course;
        if (!rawCourse) return;

        const mapped: Course = {
            ...rawCourse,
            price: rawCourse.price ?? 0,
            duration: rawCourse.duration ?? null,
            tax_type: rawCourse.tax_type ?? 'none',
            tax_amount: rawCourse.tax_amount ?? 0,
        };

        if (!coursesByCombo[comboId]) coursesByCombo[comboId] = [];
        coursesByCombo[comboId].push(mapped);
    });

    // Fetch explicitly assigned batches for each combo
    const { data: comboBatchItems, error: batchItemError } = await supabase
        .from('course_combo_batches')
        .select('combo_id, batch_id, sort_order, batch:batches(id, name, module_subject_id)')
        .in('combo_id', comboIds)
        .order('sort_order', { ascending: true });

    if (batchItemError) throw batchItemError;

    const batchesByCombo: Record<string, ComboBatch[]> = {};
    (comboBatchItems || []).forEach((item: any) => {
        const comboId = item.combo_id as string | undefined;
        if (!comboId) return;
        const rawBatch = Array.isArray(item.batch) ? item.batch[0] : item.batch;
        if (!rawBatch) return;
        if (!batchesByCombo[comboId]) batchesByCombo[comboId] = [];
        batchesByCombo[comboId].push({ id: rawBatch.id, name: rawBatch.name, module_subject_id: rawBatch.module_subject_id ?? null });
    });

    return combos.map((combo: any) => ({
        ...combo,
        price: combo.price ?? 0,
        courses: coursesByCombo[combo.id] || [],
        batches: batchesByCombo[combo.id] || [],
    }));
}

export async function createCourseCombo(
    organizationId: string,
    name: string,
    description: string | null,
    price: number,
    courseIds: string[],
    createdBy: string,
    branchId?: string | null,
    batchIds?: string[],
): Promise<void> {
    const { data: combo, error: comboError } = await supabase
        .from('course_combos')
        .insert({
            organization_id: organizationId,
            branch_id: branchId || null,
            name,
            description,
            price,
            is_active: true,
            created_by: createdBy,
        } as any)
        .select('id')
        .single();

    if (comboError) throw comboError;

    if (courseIds.length > 0) {
        const items = courseIds.map((courseId, index) => ({
            combo_id: combo.id,
            course_id: courseId,
            sort_order: index,
        }));

        const { error: itemsError } = await supabase.from('course_combo_items').insert(items as any);
        if (itemsError) throw itemsError;
    }

    if (batchIds && batchIds.length > 0) {
        const batchItems = batchIds.map((batchId, index) => ({
            combo_id: combo.id,
            batch_id: batchId,
            sort_order: index,
        }));
        const { error: batchItemsError } = await supabase.from('course_combo_batches').insert(batchItems as any);
        if (batchItemsError) throw batchItemsError;
    }
}

export async function updateCourseCombo(
    comboId: string,
    updates: { name?: string; description?: string | null; price?: number; is_active?: boolean },
    courseIds: string[],
    batchIds?: string[],
): Promise<void> {
    const { error: comboError } = await supabase
        .from('course_combos')
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
        .eq('id', comboId);

    if (comboError) throw comboError;

    const { error: deleteError } = await supabase
        .from('course_combo_items')
        .delete()
        .eq('combo_id', comboId);

    if (deleteError) throw deleteError;

    if (courseIds.length > 0) {
        const items = courseIds.map((courseId, index) => ({
            combo_id: comboId,
            course_id: courseId,
            sort_order: index,
        }));
        const { error: insertError } = await supabase.from('course_combo_items').insert(items as any);
        if (insertError) throw insertError;
    }

    // Re-sync batches
    const { error: deleteBatchError } = await supabase
        .from('course_combo_batches')
        .delete()
        .eq('combo_id', comboId);
    if (deleteBatchError) throw deleteBatchError;

    if (batchIds && batchIds.length > 0) {
        const batchItems = batchIds.map((batchId, index) => ({
            combo_id: comboId,
            batch_id: batchId,
            sort_order: index,
        }));
        const { error: insertBatchError } = await supabase.from('course_combo_batches').insert(batchItems as any);
        if (insertBatchError) throw insertBatchError;
    }
}

export async function deleteCourseCombo(comboId: string): Promise<void> {
    const { error } = await supabase
        .from('course_combos')
        .update({ is_active: false, updated_at: new Date().toISOString() } as any)
        .eq('id', comboId);

    if (error) throw error;
}
