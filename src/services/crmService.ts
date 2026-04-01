import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';
import { registrationService } from './registrationService';

type Lead = Tables<'crm_leads'>;
type Profile = Tables<'profiles'>;

export const crmService = {
  async getLeads(organizationId: string, branchId?: string | null) {
    let query = supabase
      .from('crm_leads')
      .select('*')
      .eq('organization_id', organizationId);

    // Filter by branch if a specific branch is selected
    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    return data as Lead[];
  },

  async createLead(lead: Partial<Lead>) {
    const { data, error } = await supabase
      .from('crm_leads')
      .insert(lead)
      .select()
      .single();

    if (error) throw error;
    return data as Lead;
  },

  async updateLead(id: string, updates: Partial<Lead>) {
    const { data, error } = await supabase
      .from('crm_leads')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Lead;
  },

  async getAssignableProfiles(organizationId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id,full_name,role')
      .eq('organization_id', organizationId)
      .eq('role', 'sales_staff' as any)
      .eq('is_active', true as any);

    if (error) throw error;
    return data as Profile[];
  },

  async getCourseInterests(organizationId: string, branchId?: string | null) {
    let query = supabase
      .from('module_subjects')
      .select('id, name')
      .eq('organization_id', organizationId);

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query.order('name', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async getCurrentOrganizationId() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .maybeSingle();

    if (error) throw error;
    const row = data as { organization_id?: string | null } | null;
    if (row?.organization_id) return row.organization_id;

    const { data: preference, error: preferenceError } = await supabase
      .from('user_branch_preferences')
      .select('organization_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (preferenceError) throw preferenceError;
    const preferenceRow = preference as { organization_id?: string | null } | null;
    return preferenceRow?.organization_id || null;
  },

  /**
   * Convert a lead to a student by creating a registration record
   */
  async convertLead(
    leadId: string,
    registrationData: {
      organizationId: string;
      courseId: string;
      batchId: string;
      courseFee: number;
      discountAmount: number;
      taxInclusive: boolean;
      taxPercentage: number;
      paymentType: 'full' | 'emi' | 'installment';
      advancePayment: number;
    }
  ) {
    // Create the registration record
    const registration = await registrationService.createRegistration({
      ...registrationData,
      leadId,
    });

    // Update lead status to converted (will be fully updated when admin verifies)
    await this.updateLead(leadId, { status: 'converted' });

    return registration;
  },

  /**
   * Get courses (classes) for an organization
   */
  async getCourses(organizationId: string, branchId?: string | null) {
    let classesQuery = supabase
      .from('classes')
      .select('id, name, subject')
      .eq('organization_id', organizationId)
      .eq('is_active', true);

    if (branchId) {
      classesQuery = classesQuery.eq('branch_id', branchId);
    }

    let moduleSubjectsQuery = supabase
      .from('module_subjects')
      .select('id, name, duration, price, tax_type, tax_amount')
      .eq('organization_id', organizationId);

    if (branchId) {
      moduleSubjectsQuery = moduleSubjectsQuery.or(`branch_id.is.null,branch_id.eq.${branchId}`);
    }

    const [{ data: classesData, error: classesError }, { data: subjectsData, error: subjectsError }] = await Promise.all([
      classesQuery.order('name'),
      moduleSubjectsQuery.order('name'),
    ]);

    if (classesError) throw classesError;
    if (subjectsError) throw subjectsError;

    const normalizeText = (value: string | null | undefined) =>
      String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();

    const subjectsByName = new Map(
      (subjectsData || []).map((subject) => [normalizeText(subject.name), subject])
    );
    const subjectsById = new Map(
      (subjectsData || []).map((subject) => [subject.id, subject])
    );

    return (classesData || []).map((course) => {
      const normalizedSubject = normalizeText(course.subject);
      const normalizedCourseName = normalizeText(course.name);
      const subjectMatch = subjectsById.get(normalizedSubject)
        || subjectsById.get(normalizedCourseName)
        || subjectsByName.get(normalizedSubject)
        || subjectsByName.get(normalizedCourseName)
        || (subjectsData || []).find((subject) => {
          const normalizedName = normalizeText(subject.name);
          return (
            (normalizedSubject.length > 0 && (normalizedName.includes(normalizedSubject) || normalizedSubject.includes(normalizedName)))
            || (normalizedCourseName.length > 0 && (normalizedName.includes(normalizedCourseName) || normalizedCourseName.includes(normalizedName)))
          );
        })
        || null;
      return {
        ...course,
        course_name: subjectMatch?.name || course.name,
        module_subject_id: subjectMatch?.id || null,
        duration: subjectMatch?.duration || null,
        price: Number(subjectMatch?.price || 0),
        tax_type: subjectMatch?.tax_type || 'none',
        tax_amount: Number(subjectMatch?.tax_amount || 0),
      };
    });
  },

  /**
   * Get batches for an organization
   */
  async getBatches(organizationId: string, branchId?: string | null) {
    let query = supabase
      .from('batches')
      .select('id, name, description, module_subject_id')
      .eq('organization_id', organizationId);

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query.order('name');

    if (error) throw error;
    return data;
  },
};
