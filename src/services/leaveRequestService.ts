import { supabase } from '@/lib/supabase';
import { Tables } from '@/types/database';

type LeaveRequest = Tables<'leave_requests'>;

/**
 * Leave Request Service - Handles leave request operations
 */

export const leaveRequestService = {
  /**
   * Get all leave requests for an organization
   */
  async getLeaveRequests(organizationId: string) {
    const { data, error } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  /**
   * Get leave requests by student
   */
  async getStudentLeaveRequests(studentId: string) {
    const { data, error } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  /**
   * Get pending leave requests for approval
   */
  async getPendingLeaveRequests(organizationId: string) {
    const { data, error } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  /**
   * Create a new leave request
   */
  async createLeaveRequest(
    organizationId: string,
    studentId: string,
    reason: string
  ) {
    const { data, error } = await supabase
      .from('leave_requests')
      .insert({
        organization_id: organizationId,
        student_id: studentId,
        reason,
        status: 'pending',
        requested_date: new Date().toISOString().split('T')[0],
      } as any)
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  /**
   * Approve a leave request
   */
  async approveLeaveRequest(requestId: string, approvedBy: string) {
    const { data, error } = await supabase
      .from('leave_requests')
      .update({
        status: 'approved',
        approved_by: approvedBy,
        approved_date: new Date().toISOString(),
      } as any)
      .eq('id', requestId)
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  /**
   * Reject a leave request
   */
  async rejectLeaveRequest(requestId: string, notes?: string) {
    const { data, error } = await supabase
      .from('leave_requests')
      .update({
        status: 'rejected',
        notes,
      } as any)
      .eq('id', requestId)
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  /**
   * Delete a leave request
   */
  async deleteLeaveRequest(requestId: string) {
    const { error } = await supabase
      .from('leave_requests')
      .delete()
      .eq('id', requestId);

    if (error) throw error;
    return true;
  },
};
