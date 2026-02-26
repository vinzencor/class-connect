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
