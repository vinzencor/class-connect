import { supabase } from '@/lib/supabase';
import { Database } from '@/types/database';

type AttendanceRow = Database['public']['Tables']['attendance']['Row'];
type PaymentRow = Database['public']['Tables']['payments']['Row'];
type StudentRegistrationRow = Database['public']['Tables']['student_registrations']['Row'];
type ProfileRow = Database['public']['Tables']['profiles']['Row'];

export interface AttendanceReportData {
  id: string;
  date: string;
  student_name: string;
  student_id: string;
  class_name: string;
  status: 'present' | 'absent' | 'late';
  branch_id: string | null;
  branch_name: string | null;
}

export interface StudentAttendanceSummary {
  student_id: string;
  student_name: string;
  total_classes: number;
  present: number;
  absent: number;
  late: number;
  attendance_percentage: number;
}

export interface FeeCollectionReport {
  id: string;
  student_id: string;
  student_name: string;
  total_amount: number;
  amount_paid: number;
  balance: number;
  status: 'pending' | 'partial' | 'completed' | 'overdue';
  payment_method: string | null;
  created_at: string;
  branch_id: string | null;
  branch_name: string | null;
}

export interface StudentFeeStatement {
  student_id: string;
  student_name: string;
  total_fee: number;
  total_paid: number;
  balance_pending: number;
  payments: Array<{
    id: string;
    date: string;
    amount: number;
    payment_method: string | null;
    running_balance: number;
  }>;
}

export interface BranchWiseSummary {
  branch_id: string | null;
  branch_name: string | null;
  total_students: number;
  total_fee_collected: number;
  total_pending: number;
  attendance_percentage: number;
}

export const reportService = {
  /**
   * Get attendance report with branch and date filters
   */
  async getAttendanceReport(
    organizationId: string,
    branchId: string | null,
    startDate?: string,
    endDate?: string
  ): Promise<AttendanceReportData[]> {
    let query = supabase
      .from('attendance')
      .select(`
        id,
        date,
        status,
        branch_id,
        student:profiles!attendance_student_id_fkey(id, full_name),
        class:classes!attendance_class_id_fkey(id, name),
        branch:branches(id, name)
      `)
      .eq('organization_id', organizationId)
      .order('date', { ascending: false });

    // Branch filter
    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    // Date range filter
    if (startDate) {
      query = query.gte('date', startDate);
    }
    if (endDate) {
      query = query.lte('date', endDate);
    }

    const { data, error } = await query;

    if (error) throw error;

    return (data || []).map((record: any) => ({
      id: record.id,
      date: record.date,
      student_id: record.student?.id || '',
      student_name: record.student?.full_name || 'Unknown',
      class_name: record.class?.name || 'Unknown',
      status: record.status,
      branch_id: record.branch_id,
      branch_name: record.branch?.name || null,
    }));
  },

  /**
   * Get individual student attendance summary
   */
  async getStudentAttendanceSummary(
    organizationId: string,
    studentId: string,
    branchId: string | null,
    startDate?: string,
    endDate?: string
  ): Promise<StudentAttendanceSummary> {
    let query = supabase
      .from('attendance')
      .select('id, status, student:profiles!attendance_student_id_fkey(id, full_name)')
      .eq('organization_id', organizationId)
      .eq('student_id', studentId);

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }
    if (startDate) {
      query = query.gte('date', startDate);
    }
    if (endDate) {
      query = query.lte('date', endDate);
    }

    const { data, error } = await query;
    if (error) throw error;

    const records = data || [];
    const present = records.filter(r => r.status === 'present').length;
    const absent = records.filter(r => r.status === 'absent').length;
    const late = records.filter(r => r.status === 'late').length;
    const total = records.length;

    return {
      student_id: studentId,
      student_name: records[0]?.student?.full_name || 'Unknown',
      total_classes: total,
      present,
      absent,
      late,
      attendance_percentage: total > 0 ? Math.round((present / total) * 100) : 0,
    };
  },

  /**
   * Get fee collection report with branch and date filters
   */
  async getFeeCollectionReport(
    organizationId: string,
    branchId: string | null,
    startDate?: string,
    endDate?: string
  ): Promise<FeeCollectionReport[]> {
    let query = supabase
      .from('payments')
      .select(`
        id,
        student_id,
        amount,
        amount_paid,
        status,
        payment_method,
        created_at,
        branch_id,
        student:profiles!payments_student_id_fkey(id, full_name),
        branch:branches(id, name)
      `)
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map((record: any) => ({
      id: record.id,
      student_id: record.student_id,
      student_name: record.student?.full_name || 'Unknown',
      total_amount: record.amount,
      amount_paid: record.amount_paid,
      balance: record.amount - record.amount_paid,
      status: record.status,
      payment_method: record.payment_method,
      created_at: record.created_at,
      branch_id: record.branch_id,
      branch_name: record.branch?.name || null,
    }));
  },

  /**
   * Get individual student fee statement (bank statement format)
   */
  async getStudentFeeStatement(
    organizationId: string,
    studentId: string
  ): Promise<StudentFeeStatement> {
    const { data, error } = await supabase
      .from('payments')
      .select('id, amount, amount_paid, created_at, payment_method, student:profiles!payments_student_id_fkey(id, full_name)')
      .eq('organization_id', organizationId)
      .eq('student_id', studentId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const payments = data || [];
    const totalFee = payments.reduce((sum, p) => sum + p.amount, 0);
    const totalPaid = payments.reduce((sum, p) => sum + p.amount_paid, 0);

    // Create running balance like bank statement
    let runningBalance = 0;
    const paymentHistory = payments.map(p => {
      runningBalance += p.amount_paid;
      return {
        id: p.id,
        date: p.created_at,
        amount: p.amount_paid,
        payment_method: p.payment_method,
        running_balance: runningBalance,
      };
    });

    return {
      student_id: studentId,
      student_name: payments[0]?.student?.full_name || 'Unknown',
      total_fee: totalFee,
      total_paid: totalPaid,
      balance_pending: totalFee - totalPaid,
      payments: paymentHistory,
    };
  },

  /**
   * Get branch-wise summary for consolidated reports
   */
  async getBranchWiseSummary(
    organizationId: string,
    startDate?: string,
    endDate?: string
  ): Promise<BranchWiseSummary[]> {
    // Get all branches
    const { data: branches, error: branchError } = await supabase
      .from('branches')
      .select('id, name')
      .eq('organization_id', organizationId)
      .eq('is_active', true);

    if (branchError) throw branchError;

    const summaries: BranchWiseSummary[] = [];

    for (const branch of branches || []) {
      // Get fee data for this branch
      let feeQuery = supabase
        .from('payments')
        .select('amount, amount_paid, student_id')
        .eq('organization_id', organizationId)
        .eq('branch_id', branch.id);

      if (startDate) feeQuery = feeQuery.gte('created_at', startDate);
      if (endDate) feeQuery = feeQuery.lte('created_at', endDate);

      const { data: feeData } = await feeQuery;

      // Get attendance data for this branch
      let attendanceQuery = supabase
        .from('attendance')
        .select('status')
        .eq('organization_id', organizationId)
        .eq('branch_id', branch.id);

      if (startDate) attendanceQuery = attendanceQuery.gte('date', startDate);
      if (endDate) attendanceQuery = attendanceQuery.lte('date', endDate);

      const { data: attendanceData } = await attendanceQuery;

      const totalFeeCollected = (feeData || []).reduce((sum, p) => sum + p.amount_paid, 0);
      const totalPending = (feeData || []).reduce((sum, p) => sum + (p.amount - p.amount_paid), 0);
      const uniqueStudents = new Set((feeData || []).map(p => p.student_id)).size;

      const presentCount = (attendanceData || []).filter(a => a.status === 'present').length;
      const totalAttendance = (attendanceData || []).length;
      const attendancePercentage = totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : 0;

      summaries.push({
        branch_id: branch.id,
        branch_name: branch.name,
        total_students: uniqueStudents,
        total_fee_collected: totalFeeCollected,
        total_pending: totalPending,
        attendance_percentage: attendancePercentage,
      });
    }

    return summaries;
  },

  /**
   * Get all students for a dropdown filter
   */
  async getStudents(organizationId: string, branchId: string | null): Promise<Array<{ id: string; name: string }>> {
    let query = supabase
      .from('profiles')
      .select('id, full_name')
      .eq('organization_id', organizationId)
      .eq('role', 'student')
      .order('full_name');

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map((student: any) => ({
      id: student.id,
      name: student.full_name,
    }));
  },
};
