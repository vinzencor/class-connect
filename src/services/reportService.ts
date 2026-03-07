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
  student_phone: string | null;
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
  student_phone: string | null;
  total_amount: number;
  amount_paid: number;
  balance: number;
  status: 'pending' | 'partial' | 'completed' | 'overdue';
  payment_method: string | null;
  notes: string | null;
  created_at: string;
  branch_id: string | null;
  branch_name: string | null;
}

export interface StudentFeeStatement {
  student_id: string;
  student_name: string;
  student_phone: string | null;
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

export interface StudentDetailRow {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  gender: string | null;
  date_of_birth: string | null;
  course_name: string | null;
  batch_name: string | null;
  admission_date: string;
  admission_source: string | null;
  reference: string | null;
  payment_method: string | null;
  branch_name: string | null;
  branch_id: string | null;
}

export interface CourseRegistrationRow {
  id: string;
  enrollment_number: string;
  student_id: string;
  student_name: string;
  student_phone: string | null;
  course_name: string;
  batch_name: string | null;
  total_fee: number;
  discount_amount: number;
  final_amount: number;
  amount_paid: number;
  balance: number;
  status: string;
  enrollment_date: string;
  branch_name: string | null;
  branch_id: string | null;
}

export interface BatchWiseStudentRow {
  batch_id: string;
  batch_name: string;
  course_name: string | null;
  student_count: number;
  students: Array<{ id: string; name: string; phone: string | null; email: string | null }>;
}

export interface FeePaidRow {
  id: string;
  student_id: string;
  student_name: string;
  student_phone: string | null;
  course_name: string | null;
  total_fee: number;
  amount_paid: number;
  payment_method: string | null;
  paid_date: string;
  branch_name: string | null;
  branch_id: string | null;
  batch_name: string | null;
}

export interface FeePendingRow {
  id: string;
  student_id: string;
  student_name: string;
  student_phone: string | null;
  course_name: string | null;
  total_fee: number;
  amount_paid: number;
  balance: number;
  due_date: string | null;
  days_overdue: number;
  status: string;
  branch_name: string | null;
  branch_id: string | null;
  batch_name: string | null;
}

export interface FeeSummaryRow {
  course_name: string;
  total_students: number;
  total_fee: number;
  total_collected: number;
  total_pending: number;
  collection_percentage: number;
}

export interface CashBookRow {
  id: string;
  date: string;
  description: string;
  category: string;
  type: 'income' | 'expense';
  credit: number;
  debit: number;
  running_balance: number;
}

export interface BankBookRow {
  id: string;
  date: string;
  description: string;
  category: string;
  mode: string;
  type: 'income' | 'expense';
  credit: number;
  debit: number;
  running_balance: number;
}

export interface CollectionReportRow {
  id: string;
  date: string;
  student_id: string;
  student_name: string;
  student_phone: string | null;
  course_name: string;
  amount: number;
  mode: string;
  collected_by: string;
  branch_name: string | null;
  branch_id: string | null;
  batch_name: string | null;
}

export interface FacultyTimeReportRow {
  faculty_id: string;
  faculty_name: string;
  total_sessions: number;
  total_hours: number;
  avg_session_hours: number;
  classes: string[];
}

export interface FacultySessionDetailRow {
  session_id: string;
  session_name: string;
  class_name: string;
  batch_names: string[];
  date: string;
  start_time: string;
  end_time: string;
  duration_hours: number;
  course_name: string | null;
  module_name: string | null;
  sub_module_names: string[];
}

export interface FacultyIndividualReportRow {
  faculty_id: string;
  faculty_name: string;
  total_sessions: number;
  total_hours: number;
  classes: string[];
  sessions: FacultySessionDetailRow[];
}

export interface BatchProgressReportRow {
  batch_id: string;
  batch_name: string;
  course_name: string | null;
  total_modules: number;
  completed_modules: number;
  pending_modules: number;
  total_chapters: number;
  completed_chapters: number;
  pending_chapters: number;
  completion_percentage: number;
  completed_module_names: string[];
  pending_module_names: string[];
  completed_chapter_names: string[];
  pending_chapter_names: string[];
}

const startOfDayTs = (date: string) => `${date}T00:00:00`;

const exclusiveEndOfDayTs = (date: string) => {
  const [year, month, day] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(year, month - 1, day));
  dt.setUTCDate(dt.getUTCDate() + 1);
  const nextDate = dt.toISOString().slice(0, 10);
  return `${nextDate}T00:00:00`;
};

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
        student:profiles!attendance_student_id_fkey(id, full_name, role, phone),
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
      student_phone: record.student?.phone || null,
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
        notes,
        created_at,
        updated_at,
        branch_id,
        student:profiles!payments_student_id_fkey(id, full_name, phone),
        branch:branches(id, name)
      `)
      .eq('organization_id', organizationId)
      .order('updated_at', { ascending: false });

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    if (startDate) {
      query = query.gte('updated_at', startOfDayTs(startDate));
    }
    if (endDate) {
      query = query.lt('updated_at', exclusiveEndOfDayTs(endDate));
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map((record: any) => ({
      id: record.id,
      student_id: record.student_id,
      student_name: record.student?.full_name || 'Unknown',
      student_phone: record.student?.phone || null,
      total_amount: record.amount,
      amount_paid: record.amount_paid,
      balance: record.amount - record.amount_paid,
      status: record.status,
      payment_method: record.payment_method,
      notes: record.notes || null,
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
      .select('id, amount, amount_paid, created_at, payment_method, student_name, course_name, total_fee, notes, student:profiles!payments_student_id_fkey(id, full_name, phone)')
      .eq('organization_id', organizationId)
      .eq('student_id', studentId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const records = paymentRecords || [];
    if (records.length === 0) {
      return {
        student_id: studentId,
        student_name: 'Unknown',
        student_phone: null,
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
    const studentPhone = records[0]?.student?.phone || null;
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
      student_phone: studentPhone,
      total_fee: totalFee,
      total_paid: totalPaid,
      balance_pending: totalFee - totalPaid,
      course_name: courseName,
      payments: paymentHistory,
    };
  },

  async getFacultyTimeReport(
    organizationId: string,
    branchId: string | null,
    startDate?: string,
    endDate?: string,
    hoursPerSession: number = 3
  ): Promise<FacultyTimeReportRow[]> {
    let query = supabase
      .from('sessions')
      .select(`
        id,
        start_time,
        end_time,
        faculty_id,
        classes(id, name, branch_id),
        profiles:faculty_id(full_name)
      `)
      .eq('organization_id', organizationId)
      .not('faculty_id', 'is', null)
      .order('start_time', { ascending: false });

    if (startDate) query = query.gte('start_time', startOfDayTs(startDate));
    if (endDate) query = query.lt('start_time', exclusiveEndOfDayTs(endDate));

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data || []).filter((session: any) => {
      if (!branchId) return true;
      const classObj = Array.isArray(session.classes) ? session.classes[0] : session.classes;
      return classObj?.branch_id === branchId;
    });

    const facultyMap: Record<string, { faculty_name: string; total_sessions: number; total_hours: number; classes: Set<string> }> = {};

    rows.forEach((session: any) => {
      const facultyId = session.faculty_id;
      if (!facultyId) return;

      const profileObj = Array.isArray(session.profiles) ? session.profiles[0] : session.profiles;
      const classObj = Array.isArray(session.classes) ? session.classes[0] : session.classes;
      const facultyName = profileObj?.full_name || 'Unknown';

      // Use the configured hours_per_session instead of timestamp diff
      const durationHours = hoursPerSession;

      if (!facultyMap[facultyId]) {
        facultyMap[facultyId] = {
          faculty_name: facultyName,
          total_sessions: 0,
          total_hours: 0,
          classes: new Set<string>(),
        };
      }

      facultyMap[facultyId].total_sessions += 1;
      facultyMap[facultyId].total_hours += durationHours;
      if (classObj?.name) {
        facultyMap[facultyId].classes.add(classObj.name);
      }
    });

    return Object.entries(facultyMap)
      .map(([faculty_id, value]) => ({
        faculty_id,
        faculty_name: value.faculty_name,
        total_sessions: value.total_sessions,
        total_hours: Number(value.total_hours.toFixed(2)),
        avg_session_hours: value.total_sessions > 0 ? Number((value.total_hours / value.total_sessions).toFixed(2)) : 0,
        classes: Array.from(value.classes).sort(),
      }))
      .sort((a, b) => b.total_hours - a.total_hours);
  },

  async getFacultyIndividualReport(
    organizationId: string,
    branchId: string | null,
    startDate?: string,
    endDate?: string
  ): Promise<FacultyIndividualReportRow[]> {
    let query = supabase
      .from('sessions')
      .select(`
        id,
        title,
        start_time,
        end_time,
        faculty_id,
        class_id,
        classes(id, name, branch_id),
        profiles:faculty_id(full_name)
      `)
      .eq('organization_id', organizationId)
      .not('faculty_id', 'is', null)
      .order('start_time', { ascending: false });

    if (startDate) query = query.gte('start_time', startOfDayTs(startDate));
    if (endDate) query = query.lt('start_time', exclusiveEndOfDayTs(endDate));

    const { data: sessionRows, error: sessionError } = await query;
    if (sessionError) throw sessionError;

    const filteredSessions = (sessionRows || []).filter((session: any) => {
      if (!branchId) return true;
      const classObj = Array.isArray(session.classes) ? session.classes[0] : session.classes;
      return classObj?.branch_id === branchId;
    });

    if (filteredSessions.length === 0) return [];

    const sessionIds = filteredSessions.map((session: any) => session.id);
    const classIds = Array.from(new Set(filteredSessions.map((session: any) => session.class_id).filter(Boolean))) as string[];

    const { data: sessionModules } = await supabase
      .from('session_module_groups')
      .select(`
        session_id,
        module_groups (
          id,
          name,
          module_subjects (
            name
          )
        )
      `)
      .in('session_id', sessionIds);

    const { data: sessionSubModules } = await supabase
      .from('session_module_sub_groups')
      .select(`
        session_id,
        module_sub_groups (
          id,
          name
        )
      `)
      .in('session_id', sessionIds);

    let batchNameByClassId: Record<string, string[]> = {};
    if (classIds.length > 0) {
      const { data: classBatchRows } = await supabase
        .from('class_batches')
        .select(`
          class_id,
          batches (
            id,
            name
          )
        `)
        .in('class_id', classIds);

      (classBatchRows || []).forEach((row: any) => {
        const classId = row.class_id as string;
        const batchName = row.batches?.name as string | undefined;
        if (!classId || !batchName) return;
        if (!batchNameByClassId[classId]) batchNameByClassId[classId] = [];
        if (!batchNameByClassId[classId].includes(batchName)) {
          batchNameByClassId[classId].push(batchName);
        }
      });

      Object.keys(batchNameByClassId).forEach((classId) => {
        batchNameByClassId[classId] = batchNameByClassId[classId].sort();
      });
    }

    const moduleBySessionId = new Map<string, { courseName: string | null; moduleNames: string[] }>();
    (sessionModules || []).forEach((row: any) => {
      const sessionId = row.session_id as string;
      const moduleGroupName = row.module_groups?.name as string | undefined;
      const courseName = row.module_groups?.module_subjects?.name as string | undefined;
      if (!sessionId) return;
      if (!moduleBySessionId.has(sessionId)) {
        moduleBySessionId.set(sessionId, { courseName: courseName || null, moduleNames: [] });
      }
      const item = moduleBySessionId.get(sessionId)!;
      if (courseName && !item.courseName) item.courseName = courseName;
      if (moduleGroupName && !item.moduleNames.includes(moduleGroupName)) {
        item.moduleNames.push(moduleGroupName);
      }
    });

    const subModuleBySessionId = new Map<string, string[]>();
    (sessionSubModules || []).forEach((row: any) => {
      const sessionId = row.session_id as string;
      const subModuleName = row.module_sub_groups?.name as string | undefined;
      if (!sessionId || !subModuleName) return;
      if (!subModuleBySessionId.has(sessionId)) {
        subModuleBySessionId.set(sessionId, []);
      }
      const list = subModuleBySessionId.get(sessionId)!;
      if (!list.includes(subModuleName)) list.push(subModuleName);
    });

    const facultyMap: Record<string, FacultyIndividualReportRow> = {};

    filteredSessions.forEach((session: any) => {
      const facultyId = session.faculty_id as string;
      if (!facultyId) return;

      const profileObj = Array.isArray(session.profiles) ? session.profiles[0] : session.profiles;
      const classObj = Array.isArray(session.classes) ? session.classes[0] : session.classes;
      const className = classObj?.name || 'Unknown Class';
      const facultyName = profileObj?.full_name || 'Unknown Faculty';

      const start = new Date(session.start_time);
      const end = new Date(session.end_time);
      const durationMs = end.getTime() - start.getTime();
      const durationHours = durationMs > 0 ? Number((durationMs / (1000 * 60 * 60)).toFixed(2)) : 0;

      const moduleInfo = moduleBySessionId.get(session.id);
      const subModules = (subModuleBySessionId.get(session.id) || []).sort();

      if (!facultyMap[facultyId]) {
        facultyMap[facultyId] = {
          faculty_id: facultyId,
          faculty_name: facultyName,
          total_sessions: 0,
          total_hours: 0,
          classes: [],
          sessions: [],
        };
      }

      const facultyRow = facultyMap[facultyId];
      facultyRow.total_sessions += 1;
      facultyRow.total_hours += durationHours;
      if (!facultyRow.classes.includes(className)) {
        facultyRow.classes.push(className);
      }

      facultyRow.sessions.push({
        session_id: session.id,
        session_name: session.title || 'Class Session',
        class_name: className,
        batch_names: batchNameByClassId[session.class_id] || [],
        date: session.start_time,
        start_time: session.start_time,
        end_time: session.end_time,
        duration_hours: durationHours,
        course_name: moduleInfo?.courseName || null,
        module_name: moduleInfo?.moduleNames?.[0] || null,
        sub_module_names: subModules,
      });
    });

    return Object.values(facultyMap)
      .map((faculty) => ({
        ...faculty,
        total_hours: Number(faculty.total_hours.toFixed(2)),
        classes: [...faculty.classes].sort(),
        sessions: faculty.sessions.sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()),
      }))
      .sort((a, b) => b.total_hours - a.total_hours);
  },

  async getBatchProgressReport(
    organizationId: string,
    branchId: string | null
  ): Promise<BatchProgressReportRow[]> {
    let batchQuery = supabase
      .from('batches')
      .select('id, name, module_subject_id, module_subjects:module_subject_id(name)')
      .eq('organization_id', organizationId)
      .order('name', { ascending: true });

    if (branchId) {
      batchQuery = (batchQuery as any).eq('branch_id', branchId);
    }

    const { data: batches, error: batchError } = await batchQuery;
    if (batchError) throw batchError;

    if (!batches || batches.length === 0) return [];

    const subjectIds = Array.from(new Set(batches.map((batch: any) => batch.module_subject_id).filter(Boolean))) as string[];
    const batchIds = batches.map((batch: any) => batch.id);

    const { data: moduleGroups, error: groupError } = await supabase
      .from('module_groups')
      .select('id, name, subject_id, sort_order')
      .in('subject_id', subjectIds)
      .order('sort_order', { ascending: true });
    if (groupError) throw groupError;

    const moduleGroupIds = (moduleGroups || []).map((group: any) => group.id);

    const { data: moduleSubGroups, error: subGroupError } = await supabase
      .from('module_sub_groups')
      .select('id, name, group_id, sort_order')
      .in('group_id', moduleGroupIds)
      .order('sort_order', { ascending: true });
    if (subGroupError) throw subGroupError;

    const { data: completionRows, error: completionError } = await supabase
      .from('module_completion')
      .select('batch_id, module_group_id')
      .eq('organization_id', organizationId)
      .in('batch_id', batchIds);
    if (completionError) throw completionError;

    const modulesBySubject: Record<string, Array<{ id: string; name: string }>> = {};
    (moduleGroups || []).forEach((group: any) => {
      if (!modulesBySubject[group.subject_id]) {
        modulesBySubject[group.subject_id] = [];
      }
      modulesBySubject[group.subject_id].push({ id: group.id, name: group.name });
    });

    const subGroupsByGroup: Record<string, Array<{ id: string; name: string }>> = {};
    (moduleSubGroups || []).forEach((subGroup: any) => {
      if (!subGroupsByGroup[subGroup.group_id]) {
        subGroupsByGroup[subGroup.group_id] = [];
      }
      subGroupsByGroup[subGroup.group_id].push({ id: subGroup.id, name: subGroup.name });
    });

    const completedByBatch: Record<string, Set<string>> = {};
    (completionRows || []).forEach((row: any) => {
      if (!completedByBatch[row.batch_id]) {
        completedByBatch[row.batch_id] = new Set<string>();
      }
      completedByBatch[row.batch_id].add(row.module_group_id);
    });

    const completedSubGroupByBatch: Record<string, Set<string>> = {};
    const scheduledGroupByBatch: Record<string, Set<string>> = {};

    const { data: classBatchRows, error: classBatchError } = await supabase
      .from('class_batches')
      .select('class_id, batch_id')
      .in('batch_id', batchIds);
    if (classBatchError) throw classBatchError;

    const classToBatchMap: Record<string, string[]> = {};
    (classBatchRows || []).forEach((row: any) => {
      if (!classToBatchMap[row.class_id]) {
        classToBatchMap[row.class_id] = [];
      }
      if (!classToBatchMap[row.class_id].includes(row.batch_id)) {
        classToBatchMap[row.class_id].push(row.batch_id);
      }
    });

    const classIds = Object.keys(classToBatchMap);
    if (classIds.length > 0) {
      const nowIso = new Date().toISOString();
      let sessionsQuery = supabase
        .from('sessions')
        .select('id, class_id, end_time, branch_id')
        .eq('organization_id', organizationId)
        .in('class_id', classIds)
        .lte('end_time', nowIso);

      if (branchId) {
        sessionsQuery = sessionsQuery.eq('branch_id', branchId);
      }

      const { data: completedSessions, error: completedSessionsError } = await sessionsQuery;
      if (completedSessionsError) throw completedSessionsError;

      const sessionIds = (completedSessions || []).map((session: any) => session.id);

      if (sessionIds.length > 0) {
        const { data: sessionGroupRows, error: sessionGroupError } = await supabase
          .from('session_module_groups')
          .select('session_id, module_group_id')
          .in('session_id', sessionIds);
        if (sessionGroupError) throw sessionGroupError;

        const { data: sessionSubGroupRows, error: sessionSubGroupError } = await supabase
          .from('session_module_sub_groups')
          .select('session_id, module_sub_group_id')
          .in('session_id', sessionIds);
        if (sessionSubGroupError) throw sessionSubGroupError;

        const groupIdsBySession: Record<string, string[]> = {};
        (sessionGroupRows || []).forEach((row: any) => {
          if (!groupIdsBySession[row.session_id]) groupIdsBySession[row.session_id] = [];
          if (!groupIdsBySession[row.session_id].includes(row.module_group_id)) {
            groupIdsBySession[row.session_id].push(row.module_group_id);
          }
        });

        const subGroupIdsBySession: Record<string, string[]> = {};
        (sessionSubGroupRows || []).forEach((row: any) => {
          if (!subGroupIdsBySession[row.session_id]) subGroupIdsBySession[row.session_id] = [];
          if (!subGroupIdsBySession[row.session_id].includes(row.module_sub_group_id)) {
            subGroupIdsBySession[row.session_id].push(row.module_sub_group_id);
          }
        });

        (completedSessions || []).forEach((session: any) => {
          const linkedBatchIds = classToBatchMap[session.class_id] || [];
          const groupIds = groupIdsBySession[session.id] || [];
          const subGroupIds = subGroupIdsBySession[session.id] || [];

          linkedBatchIds.forEach((batchId) => {
            if (!scheduledGroupByBatch[batchId]) scheduledGroupByBatch[batchId] = new Set<string>();
            if (!completedSubGroupByBatch[batchId]) completedSubGroupByBatch[batchId] = new Set<string>();

            groupIds.forEach((groupId) => scheduledGroupByBatch[batchId].add(groupId));
            subGroupIds.forEach((subGroupId) => completedSubGroupByBatch[batchId].add(subGroupId));
          });
        });
      }
    }

    return batches.map((batch: any) => {
      const assignedModules = modulesBySubject[batch.module_subject_id] || [];
      const completedSet = completedByBatch[batch.id] || new Set<string>();
      const autoCompletedSubGroups = completedSubGroupByBatch[batch.id] || new Set<string>();
      const autoScheduledGroups = scheduledGroupByBatch[batch.id] || new Set<string>();

      const assignedSubGroups = assignedModules.flatMap((module) => subGroupsByGroup[module.id] || []);
      const completedSubGroups = assignedSubGroups.filter((subGroup) => autoCompletedSubGroups.has(subGroup.id));
      const pendingSubGroups = assignedSubGroups.filter((subGroup) => !autoCompletedSubGroups.has(subGroup.id));

      const completedModules = assignedModules.filter((module) => {
        if (completedSet.has(module.id)) return true;
        const moduleSubGroups = subGroupsByGroup[module.id] || [];
        if (moduleSubGroups.length > 0) {
          return moduleSubGroups.every((subGroup) => autoCompletedSubGroups.has(subGroup.id));
        }
        return autoScheduledGroups.has(module.id);
      });
      const pendingModules = assignedModules.filter((module) => !completedModules.some((completed) => completed.id === module.id));

      const totalModules = assignedModules.length;
      const completedCount = completedModules.length;
      const pendingCount = pendingModules.length;
      const totalChapters = assignedSubGroups.length;
      const completedChapters = completedSubGroups.length;
      const pendingChapters = pendingSubGroups.length;
      const completionPercentage = totalChapters > 0
        ? Math.round((completedChapters / totalChapters) * 100)
        : totalModules > 0
          ? Math.round((completedCount / totalModules) * 100)
          : 0;

      return {
        batch_id: batch.id,
        batch_name: batch.name,
        course_name: batch.module_subjects?.name || null,
        total_modules: totalModules,
        completed_modules: completedCount,
        pending_modules: pendingCount,
        total_chapters: totalChapters,
        completed_chapters: completedChapters,
        pending_chapters: pendingChapters,
        completion_percentage: completionPercentage,
        completed_module_names: completedModules.map((module) => module.name),
        pending_module_names: pendingModules.map((module) => module.name),
        completed_chapter_names: completedSubGroups.map((subGroup) => subGroup.name),
        pending_chapter_names: pendingSubGroups.map((subGroup) => subGroup.name),
      };
    });
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

      if (startDate) feeQuery = feeQuery.gte('created_at', startOfDayTs(startDate));
      if (endDate) feeQuery = feeQuery.lt('created_at', exclusiveEndOfDayTs(endDate));

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
  async getStudents(organizationId: string, branchId: string | null): Promise<Array<{ id: string; name: string; batch_id?: string; batch_name?: string }>> {
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

    const students = (data || []).map((s: any) => ({ id: s.id, name: s.full_name }));
    if (students.length === 0) return students;

    const batchByStudent = await this._getBatchNamesByStudentIds(students.map(s => s.id), organizationId);
    const batchIdMap = await this._getBatchIdsByStudentIds(students.map(s => s.id), organizationId);

    return students.map(s => ({
      ...s,
      batch_id: batchIdMap[s.id],
      batch_name: batchByStudent[s.id],
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
    if (startDate) query = query.gte('date', startOfDayTs(startDate));
    if (endDate) query = query.lt('date', exclusiveEndOfDayTs(endDate));
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
    if (startDate) paymentsQuery = paymentsQuery.gte('created_at', startOfDayTs(startDate));
    if (endDate) paymentsQuery = paymentsQuery.lt('created_at', exclusiveEndOfDayTs(endDate));

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
    if (startDate) leadsQuery = leadsQuery.gte('created_at', startOfDayTs(startDate));
    if (endDate) leadsQuery = leadsQuery.lt('created_at', exclusiveEndOfDayTs(endDate));

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
    if (startDate) transactionsQuery = transactionsQuery.gte('date', startOfDayTs(startDate));
    if (endDate) transactionsQuery = transactionsQuery.lt('date', exclusiveEndOfDayTs(endDate));

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

  async getStudentDetails(
    organizationId: string,
    branchId: string | null
  ): Promise<StudentDetailRow[]> {
    let query = supabase
      .from('profiles')
      .select(`
        id, full_name, email, phone, branch_id, created_at,
        student_details:student_details!student_details_profile_id_fkey(gender, date_of_birth, admission_source, reference),
        branch:branches(name)
      `)
      .eq('organization_id', organizationId)
      .eq('role', 'student')
      .order('full_name');

    if (branchId) query = query.eq('branch_id', branchId);

    const { data, error } = await query;
    if (error) throw error;

    const studentIds = (data || []).map((p: any) => p.id);
    let enrollmentMap: Record<string, any> = {};
    let paymentMethodMap: Record<string, string | null> = {};
    const batchNameByStudent = await this._getBatchNamesByStudentIds(studentIds, organizationId);
    if (studentIds.length > 0) {
      const { data: enrollments } = await supabase
        .from('student_enrollments')
        .select('student_id, course_name')
        .in('student_id', studentIds)
        .eq('status', 'active')
        .order('enrollment_date', { ascending: false });
      (enrollments || []).forEach((e: any) => {
        if (!enrollmentMap[e.student_id]) enrollmentMap[e.student_id] = e;
      });

      const { data: payments } = await supabase
        .from('payments')
        .select('student_id, payment_method, updated_at, created_at')
        .in('student_id', studentIds)
        .order('updated_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      (payments || []).forEach((payment: any) => {
        if (!paymentMethodMap[payment.student_id]) {
          paymentMethodMap[payment.student_id] = payment.payment_method || null;
        }
      });
    }

    return (data || []).map((p: any) => {
      const detail = Array.isArray(p.student_details) ? p.student_details[0] : p.student_details;
      const enrollment = enrollmentMap[p.id];
      return {
        id: p.id,
        full_name: p.full_name || 'Unknown',
        email: p.email || '',
        phone: p.phone || null,
        gender: detail?.gender || null,
        date_of_birth: detail?.date_of_birth || null,
        course_name: enrollment?.course_name || null,
        batch_name: batchNameByStudent[p.id] || null,
        admission_date: p.created_at,
        admission_source: detail?.admission_source || null,
        reference: detail?.reference || null,
        payment_method: paymentMethodMap[p.id] || null,
        branch_name: Array.isArray(p.branch) ? p.branch[0]?.name : p.branch?.name || null,
        branch_id: p.branch_id,
      };
    });
  },

  async getCourseRegistrations(
    organizationId: string,
    branchId: string | null,
    startDate?: string,
    endDate?: string
  ): Promise<CourseRegistrationRow[]> {
    let query = supabase
      .from('student_enrollments')
      .select(`
        id, enrollment_number, student_id, course_id,
        enrollment_date, status, branch_id, payment_id,
        student:profiles!student_enrollments_student_id_fkey(id, full_name, phone),
        course:module_subjects!student_enrollments_course_id_fkey(name),
        payment:payments!student_enrollments_payment_id_fkey(total_fee, discount_amount, amount, amount_paid),
        branch:branches(name)
      `)
      .eq('organization_id', organizationId)
      .order('enrollment_date', { ascending: false });

    if (branchId) query = query.eq('branch_id', branchId);
    if (startDate) query = query.gte('enrollment_date', startDate);
    if (endDate) query = query.lte('enrollment_date', endDate);

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map((e: any) => {
      const totalFee = Number(e.payment?.total_fee || 0);
      const discount = Number(e.payment?.discount_amount || 0);
      const fa = Number(e.payment?.amount || totalFee - discount);
      const paid = Number(e.payment?.amount_paid || 0);
      return {
        id: e.id,
        enrollment_number: e.enrollment_number || 'N/A',
        student_id: e.student_id,
        student_name: e.student?.full_name || 'Unknown',
        student_phone: e.student?.phone || null,
        course_name: e.course?.name || 'Unknown',
        batch_name: null,
        total_fee: totalFee,
        discount_amount: discount,
        final_amount: fa,
        amount_paid: paid,
        balance: fa - paid,
        status: e.status || 'active',
        enrollment_date: e.enrollment_date,
        branch_name: e.branch?.name || null,
        branch_id: e.branch_id,
      };
    });
  },

  async getBatchWiseStudents(
    organizationId: string,
    branchId: string | null
  ): Promise<BatchWiseStudentRow[]> {
    let batchQuery = supabase
      .from('batches')
      .select('id, name, module_subject_id, module_subjects:module_subject_id(name)')
      .eq('organization_id', organizationId)
      .order('name');

    if (branchId) batchQuery = (batchQuery as any).eq('branch_id', branchId);

    const { data: batches, error: batchError } = await batchQuery;
    if (batchError) throw batchError;

    let studentsQuery = supabase
      .from('profiles')
      .select('id, full_name, phone, email, metadata')
      .eq('organization_id', organizationId)
      .eq('role', 'student');

    if (branchId) studentsQuery = studentsQuery.eq('branch_id', branchId);

    const { data: students } = await studentsQuery;

    const batchStudentMap: Record<string, any[]> = {};
    (students || []).forEach((s: any) => {
      const meta = typeof s.metadata === 'string' ? (() => { try { return JSON.parse(s.metadata); } catch { return null; } })() : s.metadata;
      const batchId = meta?.batch_id || meta?.batch || meta?.batchId;
      if (!batchId) return;
      const key = String(batchId);
      if (!batchStudentMap[key]) batchStudentMap[key] = [];
      batchStudentMap[key].push({
        id: s.id,
        name: s.full_name || 'Unknown',
        phone: s.phone || null,
        email: s.email || null,
      });
    });

    return (batches || []).map((b: any) => ({
      batch_id: b.id,
      batch_name: b.name,
      course_name: b.module_subjects?.name || null,
      student_count: (batchStudentMap[b.id] || []).length,
      students: batchStudentMap[b.id] || [],
    }));
  },

  async getFeePaidStudents(
    organizationId: string,
    branchId: string | null,
    startDate?: string,
    endDate?: string,
    batchId?: string
  ): Promise<FeePaidRow[]> {
    let batchStudentIds: string[] | null = null;
    if (batchId) {
      batchStudentIds = await this._getStudentIdsByBatch(batchId, organizationId);
      if (batchStudentIds.length === 0) return [];
    }

    let query = supabase
      .from('payments')
      .select(`
        id, student_id, amount, amount_paid, payment_method, created_at, updated_at,
        branch_id, student_name, course_name,
        student:profiles!payments_student_id_fkey(id, full_name, phone),
        branch:branches(name)
      `)
      .eq('organization_id', organizationId)
      .eq('status', 'completed')
      .order('updated_at', { ascending: false });

    if (branchId) query = query.eq('branch_id', branchId);
    if (startDate) query = query.gte('updated_at', startOfDayTs(startDate));
    if (endDate) query = query.lt('updated_at', exclusiveEndOfDayTs(endDate));
    if (batchStudentIds) query = query.in('student_id', batchStudentIds);

    const { data, error } = await query;
    if (error) throw error;

    const studentIds = [...new Set((data || []).map((r: any) => r.student_id).filter(Boolean))] as string[];
    const batchNameByStudent = await this._getBatchNamesByStudentIds(studentIds, organizationId);

    return (data || []).map((r: any) => ({
      id: r.id,
      student_id: r.student_id,
      student_name: r.student_name || r.student?.full_name || 'Unknown',
      student_phone: r.student?.phone || null,
      course_name: r.course_name || null,
      total_fee: Number(r.amount || 0),
      amount_paid: Number(r.amount_paid || 0),
      payment_method: r.payment_method || null,
      paid_date: r.updated_at || r.created_at,
      branch_name: r.branch?.name || null,
      branch_id: r.branch_id,
      batch_name: batchNameByStudent[r.student_id] || null,
    }));
  },

  async getFeePendingStudents(
    organizationId: string,
    branchId: string | null,
    batchId?: string
  ): Promise<FeePendingRow[]> {
    let batchStudentIds: string[] | null = null;
    if (batchId) {
      batchStudentIds = await this._getStudentIdsByBatch(batchId, organizationId);
      if (batchStudentIds.length === 0) return [];
    }

    let query = supabase
      .from('payments')
      .select(`
        id, student_id, amount, amount_paid, status, due_date, created_at,
        branch_id, student_name, course_name,
        student:profiles!payments_student_id_fkey(id, full_name, phone),
        branch:branches(name)
      `)
      .eq('organization_id', organizationId)
      .in('status', ['pending', 'partial', 'overdue'])
      .order('due_date', { ascending: true });

    if (branchId) query = query.eq('branch_id', branchId);
    if (batchStudentIds) query = query.in('student_id', batchStudentIds);

    const { data, error } = await query;
    if (error) throw error;

    const studentIds = [...new Set((data || []).map((r: any) => r.student_id).filter(Boolean))] as string[];
    const batchNameByStudent = await this._getBatchNamesByStudentIds(studentIds, organizationId);

    const today = new Date();
    return (data || []).map((r: any) => {
      const dueDate = r.due_date ? new Date(r.due_date) : null;
      const daysOverdue =
        dueDate && dueDate < today
          ? Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
          : 0;
      return {
        id: r.id,
        student_id: r.student_id,
        student_name: r.student_name || r.student?.full_name || 'Unknown',
        student_phone: r.student?.phone || null,
        course_name: r.course_name || null,
        total_fee: Number(r.amount || 0),
        amount_paid: Number(r.amount_paid || 0),
        balance: Number(r.amount || 0) - Number(r.amount_paid || 0),
        due_date: r.due_date || null,
        days_overdue: daysOverdue,
        status: r.status,
        branch_name: r.branch?.name || null,
        branch_id: r.branch_id,
        batch_name: batchNameByStudent[r.student_id] || null,
      };
    });
  },

  async getFeeSummary(
    organizationId: string,
    branchId: string | null,
    batchId?: string
  ): Promise<FeeSummaryRow[]> {
    let batchStudentIds: string[] | null = null;
    if (batchId) {
      batchStudentIds = await this._getStudentIdsByBatch(batchId, organizationId);
      if (batchStudentIds.length === 0) return [];
    }

    const assignedCourseName = batchId
      ? await this._getBatchAssignedCourseName(batchId, organizationId)
      : null;

    let query = supabase
      .from('payments')
      .select('student_id, amount, amount_paid, course_name, branch_id')
      .eq('organization_id', organizationId);

    if (branchId) query = query.eq('branch_id', branchId);
    if (batchStudentIds) query = query.in('student_id', batchStudentIds);

    const { data, error } = await query;
    if (error) throw error;

    const courseMap: Record<string, { students: Set<string>; total_fee: number; total_collected: number }> = {};
    (data || []).forEach((r: any) => {
      const course = assignedCourseName || r.course_name || 'Unknown Course';
      if (!courseMap[course]) courseMap[course] = { students: new Set(), total_fee: 0, total_collected: 0 };
      if (r.student_id) courseMap[course].students.add(r.student_id);
      courseMap[course].total_fee += Number(r.amount || 0);
      courseMap[course].total_collected += Number(r.amount_paid || 0);
    });

    return Object.entries(courseMap)
      .map(([course_name, d]) => ({
        course_name,
        total_students: d.students.size,
        total_fee: d.total_fee,
        total_collected: d.total_collected,
        total_pending: d.total_fee - d.total_collected,
        collection_percentage: d.total_fee > 0 ? Math.round((d.total_collected / d.total_fee) * 100) : 0,
      }))
      .sort((a, b) => b.total_fee - a.total_fee);
  },

  async getCashBook(
    organizationId: string,
    branchId: string | null,
    startDate?: string,
    endDate?: string
  ): Promise<CashBookRow[]> {
    let query = supabase
      .from('transactions')
      .select('id, date, type, description, amount, mode, category, branch_id')
      .eq('organization_id', organizationId)
      .ilike('mode', 'cash')
      .order('date', { ascending: true });

    if (branchId) query = query.eq('branch_id', branchId);
    if (startDate) query = query.gte('date', startOfDayTs(startDate));
    if (endDate) query = query.lt('date', exclusiveEndOfDayTs(endDate));

    const { data, error } = await query;
    if (error) throw error;

    let balance = 0;
    return (data || []).map((r: any) => {
      const amount = Number(r.amount || 0);
      if (r.type === 'income') balance += amount;
      else balance -= amount;
      return {
        id: r.id,
        date: r.date,
        description: r.description || '',
        category: r.category || 'N/A',
        type: r.type,
        credit: r.type === 'income' ? amount : 0,
        debit: r.type === 'expense' ? amount : 0,
        running_balance: balance,
      };
    });
  },

  async getBankBook(
    organizationId: string,
    branchId: string | null,
    startDate?: string,
    endDate?: string
  ): Promise<BankBookRow[]> {
    let query = supabase
      .from('transactions')
      .select('id, date, type, description, amount, mode, category, branch_id')
      .eq('organization_id', organizationId)
      .not('mode', 'ilike', 'cash')
      .order('date', { ascending: true });

    if (branchId) query = query.eq('branch_id', branchId);
    if (startDate) query = query.gte('date', startOfDayTs(startDate));
    if (endDate) query = query.lt('date', exclusiveEndOfDayTs(endDate));

    const { data, error } = await query;
    if (error) throw error;

    let balance = 0;
    return (data || []).map((r: any) => {
      const amount = Number(r.amount || 0);
      if (r.type === 'income') balance += amount;
      else balance -= amount;
      return {
        id: r.id,
        date: r.date,
        description: r.description || '',
        category: r.category || 'N/A',
        mode: r.mode || 'N/A',
        type: r.type,
        credit: r.type === 'income' ? amount : 0,
        debit: r.type === 'expense' ? amount : 0,
        running_balance: balance,
      };
    });
  },

  async getCollectionReport(
    organizationId: string,
    branchId: string | null,
    startDate?: string,
    endDate?: string,
    batchId?: string
  ): Promise<CollectionReportRow[]> {
    let batchStudentIds: string[] | null = null;
    if (batchId) {
      batchStudentIds = await this._getStudentIdsByBatch(batchId, organizationId);
      if (batchStudentIds.length === 0) return [];
    }

    let paymentsQuery = supabase
      .from('payments')
      .select(`
        id, student_id, course_name, branch_id,
        student:profiles!payments_student_id_fkey(full_name, phone),
        branch:branches(name)
      `)
      .eq('organization_id', organizationId);

    if (branchId) paymentsQuery = paymentsQuery.eq('branch_id', branchId);
    if (batchStudentIds) paymentsQuery = paymentsQuery.in('student_id', batchStudentIds);

    const { data: paymentsData, error: paymentsError } = await paymentsQuery;
    if (paymentsError) throw paymentsError;

    const paymentIds = (paymentsData || []).map((p: any) => p.id);
    if (paymentIds.length === 0) return [];

    const paymentMap: Record<string, any> = {};
    (paymentsData || []).forEach((p: any) => { paymentMap[p.id] = p; });

    let fpQuery = supabase
      .from('fee_payments')
      .select('id, date, amount, mode, payment_id')
      .in('payment_id', paymentIds)
      .order('date', { ascending: false });

    if (startDate) fpQuery = fpQuery.gte('date', startDate);
    if (endDate) fpQuery = fpQuery.lt('date', exclusiveEndOfDayTs(endDate));

    const { data: fpData, error: fpError } = await fpQuery;
    if (fpError) throw fpError;

    const studentIds = [...new Set((paymentsData || []).map((p: any) => p.student_id).filter(Boolean))] as string[];
    const batchNameByStudent = await this._getBatchNamesByStudentIds(studentIds, organizationId);

    return (fpData || []).map((fp: any) => {
      const payment = paymentMap[fp.payment_id];
      return {
        id: fp.id,
        date: fp.date || '',
        student_id: payment?.student_id || '',
        student_name: payment?.student?.full_name || 'Unknown',
        student_phone: payment?.student?.phone || null,
        course_name: payment?.course_name || 'N/A',
        amount: Number(fp.amount || 0),
        mode: fp.mode || 'N/A',
        collected_by: 'N/A',
        branch_name: payment?.branch?.name || null,
        branch_id: payment?.branch_id || null,
        batch_name: batchNameByStudent[payment?.student_id] || null,
      };
    });
  },

  /** Private helper: returns student_id -> first batch_name mapping */
  async _getBatchNamesByStudentIds(studentIds: string[], organizationId: string): Promise<Record<string, string>> {
    if (studentIds.length === 0) return {};
    const batchIdByStudent = await this._getBatchIdsByStudentIds(studentIds, organizationId);
    const batchIds = [...new Set(Object.values(batchIdByStudent).filter(Boolean))] as string[];
    if (batchIds.length === 0) return {};
    const { data: batchRows } = await supabase.from('batches').select('id, name').in('id', batchIds);
    const batchIdToName: Record<string, string> = {};
    (batchRows || []).forEach((b: any) => { batchIdToName[b.id] = b.name; });
    const result: Record<string, string> = {};
    Object.entries(batchIdByStudent).forEach(([studentId, batchId]) => {
      if (studentId && batchId && !result[studentId]) {
        result[studentId] = batchIdToName[batchId] || '';
      }
    });
    return result;
  },

  /** Private helper: returns student_id -> first batch_id mapping */
  async _getBatchIdsByStudentIds(studentIds: string[], organizationId: string): Promise<Record<string, string>> {
    if (studentIds.length === 0) return {};
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, metadata')
      .eq('organization_id', organizationId)
      .eq('role', 'student')
      .in('id', studentIds);
    const result: Record<string, string> = {};
    (profiles || []).forEach((p: any) => {
      const meta = typeof p.metadata === 'string' ? (() => { try { return JSON.parse(p.metadata); } catch { return null; } })() : p.metadata;
      const batchId = meta?.batch_id || meta?.batch || meta?.batchId;
      if (p.id && batchId && !result[p.id]) result[p.id] = String(batchId);
    });
    return result;
  },

  /** Private helper: returns student IDs that belong to a batch via profiles.metadata */
  async _getStudentIdsByBatch(batchId: string, organizationId: string): Promise<string[]> {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, metadata')
      .eq('organization_id', organizationId)
      .eq('role', 'student');

    return (profiles || [])
      .filter((p: any) => {
        const meta = typeof p.metadata === 'string' ? (() => { try { return JSON.parse(p.metadata); } catch { return null; } })() : p.metadata;
        const b = meta?.batch_id || meta?.batch || meta?.batchId;
        return b && String(b) === String(batchId);
      })
      .map((p: any) => p.id)
      .filter(Boolean);
  },

  /** Private helper: returns assigned module/course name for a batch */
  async _getBatchAssignedCourseName(batchId: string, organizationId: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('batches')
      .select('module_subjects:module_subject_id(name)')
      .eq('organization_id', organizationId)
      .eq('id', batchId)
      .single();

    if (error) return null;

    const moduleSubject = Array.isArray((data as any)?.module_subjects)
      ? (data as any).module_subjects[0]
      : (data as any)?.module_subjects;

    return moduleSubject?.name || null;
  },
};
