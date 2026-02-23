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
  role: string | null;
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
  course_name: string;
  payments: Array<{
    id: string;
    date: string;
    amount: number;
    payment_method: string | null;
    running_balance: number;
    description: string;
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

export interface TransactionReportRow {
  id: string;
  date: string;
  type: 'income' | 'expense';
  description: string;
  amount: number;
  mode: string;
  category: string;
  created_by_name: string;
  branch_name: string | null;
}

export interface SalesStaffReportRow {
  sales_staff_id: string;
  sales_staff_name: string;
  total_students: number;
  total_fee: number;
  total_collected: number;
  total_pending: number;
  leads_assigned: number;
  leads_converted: number;
  conversion_rate: number;
  transactions_count: number;
  transaction_income: number;
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
        student:profiles!attendance_student_id_fkey(id, full_name, role),
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
      class_name: record.class?.name || 'Login Attendance',
      status: record.status,
      role: record.student?.role || null,
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
   * Fetches all individual installment payments from fee_payments table
   */
  async getStudentFeeStatement(
    organizationId: string,
    studentId: string
  ): Promise<StudentFeeStatement> {
    // 1. Get all payment (fee) records for this student
    const { data: paymentRecords, error } = await supabase
      .from('payments')
      .select('id, amount, amount_paid, created_at, payment_method, student_name, course_name, total_fee, notes, student:profiles!payments_student_id_fkey(id, full_name)')
      .eq('organization_id', organizationId)
      .eq('student_id', studentId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const records = paymentRecords || [];
    if (records.length === 0) {
      return {
        student_id: studentId,
        student_name: 'Unknown',
        total_fee: 0,
        total_paid: 0,
        balance_pending: 0,
        course_name: 'N/A',
        payments: [],
      };
    }

    // Compute totals from all fee records
    const totalFee = records.reduce((sum: number, p: any) => sum + Number(p.total_fee || p.amount || 0), 0);
    const totalPaid = records.reduce((sum: number, p: any) => sum + Number(p.amount_paid || 0), 0);
    const studentName = records[0]?.student_name || records[0]?.student?.full_name || 'Unknown';
    const courseName = records[0]?.course_name || (records[0]?.notes ? records[0].notes.replace(/^Course:\s*/, '').split('|')[0].trim() : 'N/A');

    // 2. Get all individual installment payments from fee_payments table
    const paymentIds = records.map((r: any) => r.id);
    const { data: feePayments, error: fpError } = await supabase
      .from('fee_payments')
      .select('*')
      .in('payment_id', paymentIds)
      .order('date', { ascending: true });

    if (fpError) {
      console.error('fee_payments query error:', fpError);
    }

    const allPayments = feePayments || [];

    // 3. Build payment history with running balance (bank statement style)
    // If fee_payments has records, use those. Otherwise fallback to payment records.
    let paymentHistory: StudentFeeStatement['payments'] = [];

    if (allPayments.length > 0) {
      // Use actual installment records
      let runningPaid = 0;
      paymentHistory = allPayments.map((fp: any, idx: number) => {
        const amount = Number(fp.amount || 0);
        runningPaid += amount;
        return {
          id: fp.id,
          date: fp.date || fp.created_at,
          amount,
          payment_method: fp.mode || 'N/A',
          running_balance: totalFee - runningPaid,
          description: `Installment #${idx + 1}`,
        };
      });
    } else {
      // Fallback: use payment records directly (for older data without fee_payments)
      let runningPaid = 0;
      paymentHistory = records
        .filter((p: any) => Number(p.amount_paid) > 0)
        .map((p: any, idx: number) => {
          const amount = Number(p.amount_paid);
          runningPaid += amount;
          return {
            id: p.id,
            date: p.created_at,
            amount,
            payment_method: p.payment_method || 'N/A',
            running_balance: totalFee - runningPaid,
            description: `Payment #${idx + 1}`,
          };
        });
    }

    return {
      student_id: studentId,
      student_name: studentName,
      total_fee: totalFee,
      total_paid: totalPaid,
      balance_pending: totalFee - totalPaid,
      course_name: courseName,
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

  /**
   * Get transaction report filtered by date range, payment mode, and branch
   */
  async getTransactionReport(
    organizationId: string,
    branchId: string | null,
    startDate?: string,
    endDate?: string,
    mode?: string
  ): Promise<TransactionReportRow[]> {
    let query = supabase
      .from('transactions')
      .select(`
        id,
        date,
        type,
        description,
        amount,
        mode,
        category,
        created_by,
        branch_id,
        creator:profiles!transactions_created_by_fkey(full_name),
        branch:branches(name)
      `)
      .eq('organization_id', organizationId)
      .order('date', { ascending: false });

    if (branchId) query = query.eq('branch_id', branchId);
    if (startDate) query = query.gte('date', startDate);
    if (endDate) query = query.lte('date', endDate);
    if (mode && mode !== 'all') query = query.eq('mode', mode);

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map((row: any) => ({
      id: row.id,
      date: row.date,
      type: row.type,
      description: row.description || '',
      amount: Number(row.amount || 0),
      mode: row.mode || 'N/A',
      category: row.category || 'N/A',
      created_by_name: row.creator?.full_name || 'Unknown',
      branch_name: row.branch?.name || null,
    }));
  },

  /**
   * Get sales staff performance report
   */
  async getSalesStaffReport(
    organizationId: string,
    branchId: string | null,
    startDate?: string,
    endDate?: string
  ): Promise<SalesStaffReportRow[]> {
    const { data: staffRows, error: staffError } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('organization_id', organizationId)
      .eq('role', 'sales_staff')
      .eq('is_active', true);

    if (staffError) throw staffError;

    const staffMap: Record<string, SalesStaffReportRow> = {};
    const studentSetMap: Record<string, Set<string>> = {};

    (staffRows || []).forEach((staff: any) => {
      staffMap[staff.id] = {
        sales_staff_id: staff.id,
        sales_staff_name: staff.full_name || 'Unknown',
        total_students: 0,
        total_fee: 0,
        total_collected: 0,
        total_pending: 0,
        leads_assigned: 0,
        leads_converted: 0,
        conversion_rate: 0,
        transactions_count: 0,
        transaction_income: 0,
      };
      studentSetMap[staff.id] = new Set<string>();
    });

    // Payments contribution
    let paymentsQuery = supabase
      .from('payments')
      .select(`
        sales_staff_id,
        amount,
        amount_paid,
        student_id,
        created_at,
        branch_id,
        sales_staff:profiles!payments_sales_staff_id_fkey(id, full_name)
      `)
      .eq('organization_id', organizationId)
      .not('sales_staff_id', 'is', null);

    if (branchId) paymentsQuery = paymentsQuery.eq('branch_id', branchId);
    if (startDate) paymentsQuery = paymentsQuery.gte('created_at', startDate);
    if (endDate) paymentsQuery = paymentsQuery.lte('created_at', endDate);

    const { data: paymentRows, error: paymentError } = await paymentsQuery;
    if (paymentError) throw paymentError;

    (paymentRows || []).forEach((row: any) => {
      const staffId = row.sales_staff_id;
      if (!staffId) return;

      if (!staffMap[staffId]) {
        staffMap[staffId] = {
          sales_staff_id: staffId,
          sales_staff_name: row.sales_staff?.full_name || 'Unknown',
          total_students: 0,
          total_fee: 0,
          total_collected: 0,
          total_pending: 0,
          leads_assigned: 0,
          leads_converted: 0,
          conversion_rate: 0,
          transactions_count: 0,
          transaction_income: 0,
        };
        studentSetMap[staffId] = new Set<string>();
      }

      if (row.student_id) studentSetMap[staffId].add(row.student_id);
      staffMap[staffId].total_fee += Number(row.amount || 0);
      staffMap[staffId].total_collected += Number(row.amount_paid || 0);
      staffMap[staffId].total_pending += Number(row.amount || 0) - Number(row.amount_paid || 0);
    });

    // Leads contribution
    let leadsQuery = supabase
      .from('crm_leads')
      .select('assigned_to, status, created_at, branch_id')
      .eq('organization_id', organizationId)
      .not('assigned_to', 'is', null);

    if (branchId) leadsQuery = leadsQuery.eq('branch_id', branchId);
    if (startDate) leadsQuery = leadsQuery.gte('created_at', startDate);
    if (endDate) leadsQuery = leadsQuery.lte('created_at', endDate);

    const { data: leadRows, error: leadError } = await leadsQuery;
    if (leadError) throw leadError;

    (leadRows || []).forEach((row: any) => {
      const staffId = row.assigned_to;
      if (!staffId || !staffMap[staffId]) return;
      staffMap[staffId].leads_assigned += 1;
      if (row.status === 'converted') {
        staffMap[staffId].leads_converted += 1;
      }
    });

    // Transactions contribution
    let transactionsQuery = supabase
      .from('transactions')
      .select('sales_staff_id, created_by, amount, type, date, branch_id')
      .eq('organization_id', organizationId);

    if (branchId) transactionsQuery = transactionsQuery.eq('branch_id', branchId);
    if (startDate) transactionsQuery = transactionsQuery.gte('date', startDate);
    if (endDate) transactionsQuery = transactionsQuery.lte('date', endDate);

    const { data: transactionRows, error: transactionError } = await transactionsQuery;
    if (transactionError) throw transactionError;

    (transactionRows || []).forEach((row: any) => {
      const staffId = row.sales_staff_id || row.created_by;
      if (!staffId || !staffMap[staffId]) return;
      staffMap[staffId].transactions_count += 1;
      if (row.type === 'income') {
        staffMap[staffId].transaction_income += Number(row.amount || 0);
      }
    });

    const rows = Object.values(staffMap).map((row) => {
      const uniqueStudents = studentSetMap[row.sales_staff_id];
      row.total_students = uniqueStudents ? uniqueStudents.size : 0;
      row.conversion_rate = row.leads_assigned > 0
        ? Math.round((row.leads_converted / row.leads_assigned) * 100)
        : 0;
      return row;
    });

    return rows.sort((a, b) => b.total_collected - a.total_collected);
  },
};
