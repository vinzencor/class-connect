/**
 * Admission Service
 * Handles student admissions, multi-course enrollments, student ID generation
 * and per-enrollment payment tracking.
 */

import { supabase } from '@/lib/supabase';

export interface StudentAdmission {
  id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  role: string;
  student_number?: string | null;
  organization_id: string;
  branch_id?: string | null;
  avatar_url?: string | null;
  batch_name?: string | null;
  batch_ids?: string[];
  created_at: string;
  enrollments?: StudentEnrollment[];
}

export interface StudentEnrollment {
  id: string;
  organization_id: string;
  branch_id?: string | null;
  student_id: string;
  course_id: string;
  enrollment_number: string;
  enrollment_date: string;
  status: 'active' | 'completed' | 'dropped' | 'on_hold';
  payment_id?: string | null;
  created_at: string;
  course_name: string;
  combo_id?: string | null;
  combo_name?: string | null;
  course_fee: number;
  // Payment summary (computed from payment records)
  total_fee?: number;
  discount_amount?: number;
  final_amount?: number;
  amount_paid?: number;
  remaining?: number;
  payment_status?: string;
  due_date?: string | null;
  is_combo_placeholder?: boolean;
}

type ComboPaymentAllocation = {
  totalFee: number;
  discountAmount: number;
  finalAmount: number;
  unattributedPaidShare: number;
};

export interface EnrollmentInput {
  courseId: string;
  comboId?: string | null;
  comboName?: string | null;
  courseIds?: string[];
  totalFee: number;
  discountAmount?: number;
  initialPayment?: number;
  dueDate?: string | null;
  paymentMode?: string;
  emiMonths?: number;
  processingCharge?: number;
  batchId?: string | null;
  batchIds?: string[];
  batchScopeIds?: string[];
  collectedById?: string | null;
}

type FeePaymentSummary = {
  payment_id: string;
  amount: number;
  course_id?: string | null;
};

function isMissingFeePaymentCourseId(error: any): boolean {
  const message = String(error?.message || error?.details || error?.hint || '');
  return /course_id/i.test(message) && /(fee_payments|column)/i.test(message);
}

async function fetchFeePaymentSummaries(paymentIds: string[]): Promise<FeePaymentSummary[]> {
  if (paymentIds.length === 0) return [];

  const withCourseId = await supabase
    .from('fee_payments')
    .select('payment_id, amount, course_id')
    .in('payment_id', paymentIds);

  if (!withCourseId.error) {
    return (withCourseId.data || []) as FeePaymentSummary[];
  }

  if (!isMissingFeePaymentCourseId(withCourseId.error)) {
    throw withCourseId.error;
  }

  const fallback = await supabase
    .from('fee_payments')
    .select('payment_id, amount')
    .in('payment_id', paymentIds);

  if (fallback.error) throw fallback.error;

  return (fallback.data || []).map((row: any) => ({
    payment_id: row.payment_id,
    amount: Number(row.amount || 0),
    course_id: null,
  }));
}

function parseMetadataObject(metadata: any): Record<string, unknown> {
  if (!metadata) return {};
  if (typeof metadata === 'string') {
    try {
      const parsed = JSON.parse(metadata);
      return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : {};
    } catch {
      return {};
    }
  }
  if (typeof metadata === 'object' && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>;
  }
  return {};
}

function extractBatchIds(metadata: any): string[] {
  const parsed = parseMetadataObject(metadata);
  const rawBatchIds = Array.isArray((parsed as any).batch_ids)
    ? (parsed as any).batch_ids
    : [(parsed as any).batch_id || (parsed as any).batch || (parsed as any).batchId].filter(Boolean);

  return Array.from(new Set(rawBatchIds.map((value: any) => String(value).trim()).filter(Boolean)));
}

function normalizeLabel(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase();
}

function extractComboNameFromPayment(payment: any): string {
  const notes = String(payment?.notes || '');
  const comboFromNotes = notes.match(/Combo:\s*([^|]+)/i)?.[1]?.trim();
  return comboFromNotes || String(payment?.course_name || '').trim();
}

function buildEqualComboAllocation(payment: any, courseCount: number): ComboPaymentAllocation {
  const safeCourseCount = Math.max(courseCount, 1);
  return {
    totalFee: Number((Number(payment?.total_fee || payment?.amount || 0) / safeCourseCount).toFixed(2)),
    discountAmount: Number((Number(payment?.discount_amount || 0) / safeCourseCount).toFixed(2)),
    finalAmount: Number((Number(payment?.amount || 0) / safeCourseCount).toFixed(2)),
    unattributedPaidShare: 0,
  };
}

function buildComboDisplayLabel(comboName: string | null | undefined, courseNames: string[]): string {
  const cleanComboName = (comboName || 'Combo').trim() || 'Combo';
  const uniqueCourseNames = Array.from(new Set(courseNames.map((value) => String(value || '').trim()).filter(Boolean)));
  if (uniqueCourseNames.length === 0) {
    return `Combo: ${cleanComboName}`;
  }
  return `Combo: ${cleanComboName} - Modules: ${uniqueCourseNames.join(', ')}`;
}

export async function assignStudentBatches(
  organizationId: string,
  studentId: string,
  selectedBatchIds: string[],
  scopeBatchIds?: string[]
): Promise<string[]> {
  const normalizedSelectedBatchIds = Array.from(new Set(selectedBatchIds.map((value) => String(value).trim()).filter(Boolean)));
  const normalizedScopeBatchIds = Array.from(new Set((scopeBatchIds || normalizedSelectedBatchIds).map((value) => String(value).trim()).filter(Boolean)));

  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('metadata')
    .eq('id', studentId)
    .eq('organization_id', organizationId)
    .single();

  if (profileError) throw profileError;

  const currentMeta = parseMetadataObject(profileData?.metadata);
  const currentBatchIds = extractBatchIds(profileData?.metadata);
  const preservedBatchIds = currentBatchIds.filter((batchId) => !normalizedScopeBatchIds.includes(batchId));
  const nextBatchIds = Array.from(new Set([...preservedBatchIds, ...normalizedSelectedBatchIds]));

  const nextMetadata: Record<string, unknown> = {
    ...currentMeta,
    batch_id: nextBatchIds[0] || null,
    batch_ids: nextBatchIds,
  };

  await supabase
    .from('profiles')
    .update({ metadata: nextMetadata } as any)
    .eq('id', studentId)
    .eq('organization_id', organizationId);

  const allRelevantBatchIds = Array.from(new Set([...currentBatchIds, ...nextBatchIds]));
  if (allRelevantBatchIds.length === 0) {
    return nextBatchIds;
  }

  const { data: classBatchRows, error: classBatchError } = await supabase
    .from('class_batches')
    .select('class_id, batch_id')
    .in('batch_id', allRelevantBatchIds);

  if (classBatchError) throw classBatchError;

  const previousClassIds = new Set(
    (classBatchRows || [])
      .filter((row: any) => currentBatchIds.includes(row.batch_id))
      .map((row: any) => row.class_id)
      .filter(Boolean)
  );
  const nextClassIds = new Set(
    (classBatchRows || [])
      .filter((row: any) => nextBatchIds.includes(row.batch_id))
      .map((row: any) => row.class_id)
      .filter(Boolean)
  );

  const classIdsToInsert = Array.from(nextClassIds);
  const classIdsToDelete = Array.from(previousClassIds).filter((classId) => !nextClassIds.has(classId));

  if (classIdsToInsert.length > 0) {
    await supabase
      .from('class_enrollments')
      .upsert(
        classIdsToInsert.map((classId) => ({ class_id: classId, student_id: studentId })) as any,
        { onConflict: 'class_id,student_id' }
      );
  }

  if (classIdsToDelete.length > 0) {
    await supabase
      .from('class_enrollments')
      .delete()
      .eq('student_id', studentId)
      .in('class_id', classIdsToDelete);
  }

  return nextBatchIds;
}

// ─────────────────────────────────────────────────────────────────────────────
// Counter generation (via Supabase atomic updates using RPC or counter columns)
// ─────────────────────────────────────────────────────────────────────────────

export async function generateStudentNumber(organizationId: string): Promise<string> {
  const { data: org } = await supabase
    .from('organizations')
    .select('name, next_student_number')
    .eq('id', organizationId)
    .single();

  const prefix = (org?.name || 'ORG').replace(/[^A-Za-z]/g, '').substring(0, 3).toUpperCase() || 'STU';
  const nextNum = org?.next_student_number ?? 1;
  const studentNumber = `${prefix}-${String(nextNum).padStart(4, '0')}`;

  await supabase
    .from('organizations')
    .update({ next_student_number: nextNum + 1 })
    .eq('id', organizationId);

  return studentNumber;
}

export async function generateEnrollmentNumber(organizationId: string): Promise<string> {
  const { data: org } = await supabase
    .from('organizations')
    .select('next_enrollment_number')
    .eq('id', organizationId)
    .single();

  const nextNum = org?.next_enrollment_number ?? 1;
  const enrollmentNumber = `ENR-${String(nextNum).padStart(4, '0')}`;

  await supabase
    .from('organizations')
    .update({ next_enrollment_number: nextNum + 1 })
    .eq('id', organizationId);

  return enrollmentNumber;
}

/**
 * Assign a student number if not already assigned (idempotent)
 */
export async function assignStudentNumber(
  profileId: string,
  organizationId: string
): Promise<string> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('student_number')
    .eq('id', profileId)
    .single();

  if (profile?.student_number) return profile.student_number;

  const studentNumber = await generateStudentNumber(organizationId);

  await supabase
    .from('profiles')
    .update({ student_number: studentNumber })
    .eq('id', profileId);

  return studentNumber;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetch all students with their enrollments and payment summaries
// Handles BOTH the new student_enrollments flow AND legacy payments-only flow
// (students added via the Users page only get a payments row, no enrollment row)
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchAllStudents(
  organizationId: string,
  branchId?: string | null
): Promise<StudentAdmission[]> {
  let query = supabase
    .from('profiles')
    .select('id, full_name, email, phone, role, student_number, organization_id, branch_id, avatar_url, metadata, created_at')
    .eq('organization_id', organizationId)
    .eq('role', 'student')
    .order('created_at', { ascending: false });

  if (branchId) query = query.eq('branch_id', branchId);

  const { data: students, error } = await query;
  if (error) throw error;
  if (!students || students.length === 0) return [];

  // ── 0. Fetch batches to resolve batch names from profile metadata ──
  const { data: batchesData } = await supabase
    .from('batches')
    .select('id, name')
    .eq('organization_id', organizationId);
  const batchMap: Record<string, string> = {};
  (batchesData || []).forEach((b: any) => { batchMap[b.id] = b.name; });

  const resolveBatchName = (metadata: any): string | null => {
    const batchIds = extractBatchIds(metadata);
    if (batchIds.length === 0) return null;

    const batchNames = batchIds.map((batchId) => {
      if (batchMap[batchId]) return batchMap[batchId];
      const nameMatch = (batchesData || []).find((b: any) => b.name.trim().toLowerCase() === batchId.toLowerCase());
      return nameMatch?.name || batchId;
    });

    return batchNames.join(', ');
  };

  const studentIds = students.map((s) => s.id);

  // ── 1. Fetch structured enrollments (new flow via Admissions page) ──
  const { data: enrollments } = await supabase
    .from('student_enrollments')
    .select('*')
    .eq('organization_id', organizationId)
    .in('student_id', studentIds)
    .order('created_at', { ascending: true });

  const { data: comboAssignments } = await supabase
    .from('student_combo_assignments')
    .select('student_id, combo_id')
    .eq('organization_id', organizationId)
    .in('student_id', studentIds);

  const comboIds = [...new Set([
    ...(enrollments || []).map((e: any) => e.combo_id).filter(Boolean),
    ...(comboAssignments || []).map((row: any) => row.combo_id).filter(Boolean),
  ])] as string[];
  const comboNameById: Record<string, string> = {};
  const comboCourseIdsById: Record<string, string[]> = {};
  if (comboIds.length > 0) {
    const { data: comboRows } = await supabase
      .from('course_combos')
      .select('id, name')
      .in('id', comboIds);
    (comboRows || []).forEach((row: any) => {
      comboNameById[row.id] = row.name;
    });

    const { data: comboItemRows } = await supabase
      .from('course_combo_items')
      .select('combo_id, course_id')
      .in('combo_id', comboIds);
    (comboItemRows || []).forEach((row: any) => {
      if (!row.combo_id || !row.course_id) return;
      if (!comboCourseIdsById[row.combo_id]) comboCourseIdsById[row.combo_id] = [];
      comboCourseIdsById[row.combo_id].push(row.course_id);
    });
  }

  // ── 2. Fetch ALL payments for these students (new + legacy from Users page) ──
  let payQuery = supabase
    .from('payments')
    .select('id, student_id, course_name, total_fee, discount_amount, amount, amount_paid, due_date, status, enrollment_id, created_at, notes')
    .eq('organization_id', organizationId)
    .in('student_id', studentIds)
    .order('created_at', { ascending: true });
  if (branchId) payQuery = payQuery.eq('branch_id', branchId);
  const { data: allPayments } = await payQuery;

  // Build payment lookup keyed by payment id
  const paymentMap: Record<string, any> = {};
  (allPayments || []).forEach((p: any) => { paymentMap[p.id] = p; });

  // Set of payment_ids already owned by an enrollment row
  const enrolledPaymentIds = new Set(
    (enrollments || []).map((e) => e.payment_id).filter(Boolean)
  );

  // ── 3. Fetch fee_payments for ALL payments to get real amount paid ──
  const allPaymentIds = (allPayments || []).map((p: any) => p.id);
  const feePayMap: Record<string, number> = {};
  const feePayAttributedMap: Record<string, number> = {};
  const feePayByCourseMap: Record<string, Record<string, number>> = {};
  if (allPaymentIds.length > 0) {
    const fpData = await fetchFeePaymentSummaries(allPaymentIds);
    (fpData || []).forEach((fp: FeePaymentSummary) => {
      const amount = Number(fp.amount || 0);
      feePayMap[fp.payment_id] = (feePayMap[fp.payment_id] || 0) + amount;
      if (fp.course_id) {
        if (!feePayByCourseMap[fp.payment_id]) feePayByCourseMap[fp.payment_id] = {};
        feePayByCourseMap[fp.payment_id][fp.course_id] = (feePayByCourseMap[fp.payment_id][fp.course_id] || 0) + amount;
        feePayAttributedMap[fp.payment_id] = (feePayAttributedMap[fp.payment_id] || 0) + amount;
      }
    });
  }

  // ── 4. Course name map from module_subjects ──
  const courseIds = [...new Set((enrollments || []).map((e) => e.course_id).filter(Boolean))];
  const courseMap: Record<string, { name: string; price: number }> = {};
  if (courseIds.length > 0) {
    const { data: subjects } = await supabase
      .from('module_subjects')
      .select('id, name, price')
      .in('id', courseIds);
    (subjects || []).forEach((s: any) => {
      courseMap[s.id] = { name: s.name, price: s.price ?? 0 };
    });
  }

  const comboEnrollmentsByKey: Record<string, any[]> = {};
  (enrollments || []).forEach((enrollment: any) => {
    if (!enrollment.combo_id) return;
    const key = `${enrollment.student_id}__${enrollment.combo_id}`;
    if (!comboEnrollmentsByKey[key]) comboEnrollmentsByKey[key] = [];
    comboEnrollmentsByKey[key].push(enrollment);
  });

  const comboPaymentByKey: Record<string, any> = {};
  (allPayments || []).forEach((payment: any) => {
    const normalizedPaymentComboName = normalizeLabel(extractComboNameFromPayment(payment));
    if (!normalizedPaymentComboName) return;
    Object.entries(comboNameById).forEach(([comboId, comboName]) => {
      const normalizedComboName = normalizeLabel(comboName);
      if (!normalizedComboName) return;
      const isMatch = normalizedComboName === normalizedPaymentComboName
        || normalizedPaymentComboName.includes(normalizedComboName)
        || normalizedComboName.includes(normalizedPaymentComboName);
      if (!isMatch) return;
      const key = `${payment.student_id}__${comboId}`;
      if (!comboPaymentByKey[key]) {
        comboPaymentByKey[key] = payment;
      }
    });
  });

  const comboAssignmentsByStudent: Record<string, string[]> = {};
  (comboAssignments || []).forEach((assignment: any) => {
    if (!assignment.student_id || !assignment.combo_id) return;
    if (!comboAssignmentsByStudent[assignment.student_id]) comboAssignmentsByStudent[assignment.student_id] = [];
    comboAssignmentsByStudent[assignment.student_id].push(assignment.combo_id);
  });

  // ── Helper: build a StudentEnrollment from an enrollment row ──
  const buildFromEnrollment = (e: any): StudentEnrollment => {
    const course = courseMap[e.course_id] || { name: 'Unknown Course', price: 0 };
    const payRec = e.payment_id ? paymentMap[e.payment_id] : null;

    if (e.combo_id) {
      const key = `${e.student_id}__${e.combo_id}`;
      const comboPayment = comboPaymentByKey[key] || payRec;
      const group = comboEnrollmentsByKey[key] || [e];
      if (comboPayment) {
        const comboAmountPaid = Number(feePayMap[comboPayment.id] || 0);
        const attributedAmountPaid = Number(feePayByCourseMap[comboPayment.id]?.[e.course_id] || 0);
        const attributedTotalPaid = Number(feePayAttributedMap[comboPayment.id] || 0);
        const unattributedAmountPaid = Math.max(comboAmountPaid - attributedTotalPaid, 0);
        const equalShareCount = Math.max(group.length, 1);
        const allocation = buildEqualComboAllocation(comboPayment, equalShareCount);
        const amountPaid = Number((attributedAmountPaid + (unattributedAmountPaid / equalShareCount)).toFixed(2));
        const finalAmount = Number(allocation.finalAmount || 0);
        const remaining = Math.max(Number((finalAmount - amountPaid).toFixed(2)), 0);

        return {
          ...e,
          combo_id: e.combo_id || null,
          combo_name: e.combo_id ? (comboNameById[e.combo_id] || null) : null,
          payment_id: comboPayment.id,
          course_name: course.name,
          course_fee: allocation.totalFee,
          total_fee: allocation.totalFee,
          discount_amount: allocation.discountAmount,
          final_amount: allocation.finalAmount,
          amount_paid: amountPaid,
          remaining,
          payment_status: remaining <= 0 ? 'completed' : amountPaid > 0 ? 'partial' : 'pending',
          due_date: comboPayment.due_date || null,
        };
      }
    }

    const amountPaid = e.payment_id ? (feePayMap[e.payment_id] || 0) : 0;
    const finalAmount = payRec ? Number(payRec.amount) : course.price;
    return {
      ...e,
      combo_id: e.combo_id || null,
      combo_name: e.combo_id ? (comboNameById[e.combo_id] || null) : null,
      course_name: payRec?.course_name || course.name,
      course_fee: course.price,
      total_fee: payRec ? Number(payRec.total_fee || payRec.amount) : course.price,
      discount_amount: payRec ? Number(payRec.discount_amount || 0) : 0,
      final_amount: finalAmount,
      amount_paid: amountPaid,
      remaining: Math.max(finalAmount - amountPaid, 0),
      payment_status: payRec?.status || (amountPaid > 0 ? 'partial' : 'pending'),
      due_date: payRec?.due_date || null,
    };
  };

  // ── Helper: build a synthetic StudentEnrollment from a legacy payments row ──
  const buildFromPayment = (p: any): StudentEnrollment => {
    const amountPaid = feePayMap[p.id] || 0;
    const finalAmount = Number(p.amount || 0);
    const totalFee = Number(p.total_fee || p.amount || 0);
    const matchedComboId = Object.entries(comboNameById).find(([, comboName]) =>
      normalizeLabel(comboName) === normalizeLabel(extractComboNameFromPayment(p))
      || normalizeLabel(extractComboNameFromPayment(p)).includes(normalizeLabel(comboName))
    )?.[0] || null;
    return {
      id: `pay_${p.id}`,           // synthetic id so React keys work
      organization_id: organizationId,
      branch_id: null,
      student_id: p.student_id,
      course_id: '',
      enrollment_number: '—',      // no enrollment number for legacy rows
      enrollment_date: p.created_at?.split('T')[0] || '',
      status: 'active' as const,
      payment_id: p.id,
      created_at: p.created_at,
      course_name: p.course_name || 'Unknown Course',
      combo_id: matchedComboId,
      combo_name: matchedComboId ? (comboNameById[matchedComboId] || p.course_name || 'Combo') : null,
      course_fee: totalFee,
      total_fee: totalFee,
      discount_amount: Number(p.discount_amount || 0),
      final_amount: finalAmount,
      amount_paid: amountPaid,
      remaining: Math.max(finalAmount - amountPaid, 0),
      payment_status: p.status || (amountPaid > 0 ? 'partial' : 'pending'),
      due_date: p.due_date || null,
      is_combo_placeholder: Boolean(matchedComboId),
    };
  };

  const buildComboPlaceholder = (studentId: string, comboId: string): StudentEnrollment => {
    const key = `${studentId}__${comboId}`;
    const payment = comboPaymentByKey[key];
    const amountPaid = payment ? Number(feePayMap[payment.id] || 0) : 0;
    const finalAmount = payment ? Number(payment.amount || 0) : 0;
    const totalFee = payment ? Number(payment.total_fee || payment.amount || 0) : 0;

    return {
      id: `combo_${studentId}_${comboId}`,
      organization_id: organizationId,
      branch_id: branchId || null,
      student_id: studentId,
      course_id: '',
      enrollment_number: '—',
      enrollment_date: payment?.created_at?.split('T')[0] || '',
      status: 'active',
      payment_id: payment?.id || null,
      created_at: payment?.created_at || new Date().toISOString(),
      course_name: comboNameById[comboId] || 'Combo',
      combo_id: comboId,
      combo_name: comboNameById[comboId] || 'Combo',
      course_fee: totalFee,
      total_fee: totalFee,
      discount_amount: Number(payment?.discount_amount || 0),
      final_amount: finalAmount,
      amount_paid: amountPaid,
      remaining: Math.max(finalAmount - amountPaid, 0),
      payment_status: payment?.status || (amountPaid > 0 ? 'partial' : 'pending'),
      due_date: payment?.due_date || null,
      is_combo_placeholder: true,
    };
  };

  return students.map((student) => {
    // Structured enrollments for this student
    const structured = (enrollments || [])
      .filter((e) => e.student_id === student.id)
      .map(buildFromEnrollment);

    const studentComboIds = Array.from(new Set(comboAssignmentsByStudent[student.id] || []));
    const comboNamesForStudent = new Set(
      studentComboIds
        .map((comboId) => comboNameById[comboId])
        .filter(Boolean)
        .map((name: string) => name.toLowerCase().trim())
    );

    // Build set of course names already covered by structured enrollments
    // to prevent duplicate entries from legacy payments for the same course
    const enrolledCourseNames = new Set(
      structured.map((e) => e.course_name?.toLowerCase().trim()).filter(Boolean)
    );
    const enrolledCourseIds = new Set(
      (enrollments || []).filter((e) => e.student_id === student.id).map((e) => e.course_id).filter(Boolean)
    );

    // Legacy payments (payments table rows with no enrollment row covering them)
    const legacy = (allPayments || [])
      .filter((p: any) =>
        p.student_id === student.id &&
        !enrolledPaymentIds.has(p.id) &&
        !p.enrollment_id &&           // not already linked to an enrollment
        // Skip synthetic combo payment rows if the student already has combo-linked structured enrollments
        !comboNamesForStudent.has((p.course_name || '').toLowerCase().trim()) &&
        // Skip if the same course is already covered by a structured enrollment
        !enrolledCourseNames.has((p.course_name || '').toLowerCase().trim()) &&
        !(p.course_id && enrolledCourseIds.has(p.course_id))
      )
      .map(buildFromPayment);

    const comboPlaceholders = studentComboIds
      .filter((comboId) => !legacy.some((row) => row.combo_id === comboId))
      .map((comboId) => buildComboPlaceholder(student.id, comboId));

    return {
      ...student,
      batch_ids: extractBatchIds((student as any).metadata),
      batch_name: resolveBatchName((student as any).metadata),
      enrollments: [...structured, ...comboPlaceholders, ...legacy],
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Enroll a student in a course AND create the fee payment record
// ─────────────────────────────────────────────────────────────────────────────

export async function addCourseEnrollment(
  organizationId: string,
  studentId: string,
  studentName: string,
  input: EnrollmentInput,
  branchId?: string | null
): Promise<StudentEnrollment> {
  const {
    courseId,
    comboId,
    comboName,
    courseIds = [],
    totalFee,
    discountAmount = 0,
    initialPayment = 0,
    dueDate,
    paymentMode = 'Cash',
    emiMonths,
    processingCharge = 0,
    batchId,
    batchIds = [],
    batchScopeIds = [],
    collectedById,
  } = input;

  if (comboId) {
    const normalizedCourseIds = Array.from(new Set([
      ...courseIds.map((value) => String(value).trim()).filter(Boolean),
      ...(courseId ? [String(courseId).trim()] : []),
    ].filter(Boolean)));
    if (normalizedCourseIds.length === 0) {
      throw new Error('Combo has no courses to enroll');
    }

    const { data: existingComboEnrollments, error: existingComboError } = await supabase
      .from('student_enrollments')
      .select('id, course_id, enrollment_number, enrollment_date, status, payment_id, created_at, combo_id')
      .eq('student_id', studentId)
      .eq('organization_id', organizationId)
      .eq('combo_id', comboId);

    if (existingComboError) throw existingComboError;

    const existingCourseIds = new Set((existingComboEnrollments || []).map((row: any) => row.course_id).filter(Boolean));
    const missingCourseIds = normalizedCourseIds.filter((value) => !existingCourseIds.has(value));

    let insertedEnrollments: any[] = [];
    for (const comboCourseId of missingCourseIds) {
      const enrollmentNumber = await generateEnrollmentNumber(organizationId);
      const enrollInsert: any = {
        organization_id: organizationId,
        branch_id: branchId || null,
        student_id: studentId,
        course_id: comboCourseId,
        combo_id: comboId,
        enrollment_number: enrollmentNumber,
        enrollment_date: new Date().toISOString().split('T')[0],
        status: 'active',
      };

      const { data: enrollData, error: enrollError } = await supabase
        .from('student_enrollments')
        .insert(enrollInsert)
        .select()
        .single();

      if (enrollError) throw enrollError;
      insertedEnrollments.push(enrollData);
    }

    await supabase
      .from('student_combo_assignments')
      .upsert({
        organization_id: organizationId,
        branch_id: branchId || null,
        student_id: studentId,
        combo_id: comboId,
        assigned_by: collectedById || null,
      } as any, { onConflict: 'student_id,combo_id' });

    let paymentId: string | null = null;
    const { data: comboCourses } = await supabase
      .from('module_subjects')
      .select('id, name, price')
      .in('id', normalizedCourseIds);
    const comboCourseNames = (comboCourses || []).map((course: any) => course.name).filter(Boolean);
    const comboDisplayLabel = buildComboDisplayLabel(comboName || 'Combo', comboCourseNames);

    const { data: existingComboPayment } = await supabase
      .from('payments')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('student_id', studentId)
      .eq('course_name', comboName || 'Combo')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    paymentId = existingComboPayment?.id || null;

    const baseAmount = Math.max(totalFee - discountAmount, 0);
    const normalizedProcessingCharge = Math.max(processingCharge || 0, 0);
    const finalAmount = baseAmount + normalizedProcessingCharge;
    const initPay = Math.min(initialPayment, finalAmount);

    if (!paymentId) {
      const { data: paymentData, error: payError } = await supabase
        .from('payments')
        .insert({
          organization_id: organizationId,
          branch_id: branchId || null,
          student_id: studentId,
          student_name: studentName,
          course_name: comboName || 'Combo',
          total_fee: totalFee,
          discount_amount: discountAmount,
          amount: finalAmount,
          amount_paid: initPay,
          due_date: dueDate || null,
          status: initPay >= finalAmount ? 'completed' : initPay > 0 ? 'partial' : 'pending',
          payment_method: paymentMode,
          notes: `Combo: ${comboName || 'Combo'}${normalizedProcessingCharge > 0 ? ` | Processing: ₹${normalizedProcessingCharge.toFixed(2)}` : ''}${paymentMode === 'Bajaj EMI' && emiMonths ? ` | EMI: ${emiMonths} months | First EMI: ₹${initPay.toFixed(2)}` : ''}`,
        } as any)
        .select('id')
        .single();

      if (payError) throw payError;
      paymentId = paymentData.id;

      if (initPay > 0) {
        await supabase.from('fee_payments').insert({
          payment_id: paymentId,
          organization_id: organizationId,
          amount: initPay,
          date: new Date().toISOString().split('T')[0],
          mode: paymentMode,
          sales_staff_id: collectedById || null,
        });

        await supabase.from('transactions').insert({
          organization_id: organizationId,
          branch_id: branchId || null,
          type: 'income',
          description: `Enrollment Payment: ${comboDisplayLabel} — ${studentName}`,
          amount: initPay,
          category: 'Course Fee',
          date: new Date().toISOString(),
          mode: paymentMode,
          recurrence: 'one-time',
          paused: false,
          created_by: collectedById || null,
          sales_staff_id: collectedById || null,
        });
      }
    }

    if (batchScopeIds.length > 0 || batchIds.length > 0) {
      await assignStudentBatches(organizationId, studentId, batchIds, batchScopeIds);
    }

    const representativeEnrollment = insertedEnrollments[0] || (existingComboEnrollments || [])[0];
    if (!representativeEnrollment) {
      throw new Error('Combo enrollment could not be created');
    }

    const firstCourse = (comboCourses || [])[0] as any;

    return {
      ...representativeEnrollment,
      payment_id: paymentId,
      course_name: comboName || 'Combo',
      combo_id: comboId,
      combo_name: comboName || 'Combo',
      course_fee: Number(firstCourse?.price || 0),
      total_fee: totalFee,
      discount_amount: discountAmount,
      final_amount: finalAmount,
      amount_paid: existingComboPayment ? undefined : initPay,
      remaining: existingComboPayment ? undefined : Math.max(finalAmount - initPay, 0),
      payment_status: existingComboPayment ? undefined : (initPay >= finalAmount ? 'completed' : initPay > 0 ? 'partial' : 'pending'),
      due_date: dueDate || null,
    };
  }

  // Guard: already enrolled in this course?
  const { data: existing } = await supabase
    .from('student_enrollments')
    .select('id')
    .eq('student_id', studentId)
    .eq('course_id', courseId)
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (existing) throw new Error('Student is already enrolled in this course');

  const baseAmount = Math.max(totalFee - discountAmount, 0);
  const normalizedProcessingCharge = Math.max(processingCharge || 0, 0);
  const finalAmount = baseAmount + normalizedProcessingCharge;
  const initPay = Math.min(initialPayment, finalAmount);

  // Get course name
  const { data: courseData } = await supabase
    .from('module_subjects')
    .select('name, price')
    .eq('id', courseId)
    .single();
  const courseName = courseData?.name || 'Unknown Course';

  const enrollmentNumber = await generateEnrollmentNumber(organizationId);

  // 1. Create the enrollment record first (without payment_id)
  const enrollInsert: any = {
    organization_id: organizationId,
    student_id: studentId,
    course_id: courseId,
    enrollment_number: enrollmentNumber,
    enrollment_date: new Date().toISOString().split('T')[0],
    status: 'active',
  };
  if (branchId) enrollInsert.branch_id = branchId;

  const { data: enrollData, error: enrollError } = await supabase
    .from('student_enrollments')
    .insert(enrollInsert)
    .select()
    .single();

  if (enrollError) throw enrollError;

  // 2. Create the payment (fee) record linked to this enrollment
  const { data: paymentData, error: payError } = await supabase
    .from('payments')
    .insert({
      organization_id: organizationId,
      branch_id: branchId || null,
      student_id: studentId,
      student_name: studentName,
      course_name: courseName,
      total_fee: totalFee,
      discount_amount: discountAmount,
      amount: finalAmount,
      amount_paid: initPay,
      due_date: dueDate || null,
      status: initPay >= finalAmount ? 'completed' : initPay > 0 ? 'partial' : 'pending',
      enrollment_id: enrollData.id,
      payment_method: paymentMode,
      notes: `Course: ${courseName} | Enrollment: ${enrollmentNumber}${normalizedProcessingCharge > 0 ? ` | Processing: ₹${normalizedProcessingCharge.toFixed(2)}` : ''}${paymentMode === 'Bajaj EMI' && emiMonths ? ` | EMI: ${emiMonths} months | First EMI: ₹${initPay.toFixed(2)}` : ''}`,
    } as any)
    .select('id')
    .single();

  if (payError) throw payError;

  // 3. Link payment back to enrollment
  await supabase
    .from('student_enrollments')
    .update({ payment_id: paymentData.id })
    .eq('id', enrollData.id);

  // 4. Record initial payment as fee_payment installment if any
  if (initPay > 0) {
    await supabase.from('fee_payments').insert({
      payment_id: paymentData.id,
      organization_id: organizationId,
      amount: initPay,
      date: new Date().toISOString().split('T')[0],
      mode: paymentMode,
      sales_staff_id: collectedById || null,
    });

    // Also add income transaction
    await supabase.from('transactions').insert({
      organization_id: organizationId,
      branch_id: branchId || null,
      type: 'income',
      description: `Enrollment Payment: ${courseName} — ${studentName}`,
      amount: initPay,
      category: 'Course Fee',
      date: new Date().toISOString(),
      mode: paymentMode,
      recurrence: 'one-time',
      paused: false,
      created_by: collectedById || null,
      sales_staff_id: collectedById || null,
    });
  }

  // 5. Assign student to selected batch (update profile metadata + class_enrollments)
  if (batchId || batchScopeIds.length > 0) {
    try {
      await assignStudentBatches(
        organizationId,
        studentId,
        batchId ? [batchId] : [],
        batchScopeIds.length > 0 ? batchScopeIds : (batchId ? [batchId] : [])
      );
    } catch (batchErr) {
      console.error('Failed to assign student to batch:', batchErr);
    }
  }

  return {
    ...enrollData,
    payment_id: paymentData.id,
    course_name: courseName,
    course_fee: courseData?.price ?? totalFee,
    total_fee: totalFee,
    discount_amount: discountAmount,
    final_amount: finalAmount,
    amount_paid: initPay,
    remaining: Math.max(finalAmount - initPay, 0),
    payment_status: initPay >= finalAmount ? 'completed' : initPay > 0 ? 'partial' : 'pending',
    due_date: dueDate || null,
  };
}

/**
 * Update enrollment status
 */
export async function updateEnrollmentStatus(
  enrollmentId: string,
  status: 'active' | 'completed' | 'dropped' | 'on_hold'
): Promise<void> {
  const { error } = await supabase
    .from('student_enrollments')
    .update({ status })
    .eq('id', enrollmentId);
  if (error) throw error;
}

export async function updateEnrollmentBatches(
  organizationId: string,
  studentId: string,
  selectedBatchIds: string[],
  scopeBatchIds: string[]
): Promise<string[]> {
  const normalizedScopeBatchIds = Array.from(new Set(scopeBatchIds.map((value) => String(value).trim()).filter(Boolean)));
  const normalizedSelectedBatchIds = Array.from(new Set(selectedBatchIds.map((value) => String(value).trim()).filter(Boolean)));

  if (normalizedScopeBatchIds.length === 0) {
    return [];
  }

  return assignStudentBatches(organizationId, studentId, normalizedSelectedBatchIds, normalizedScopeBatchIds);
}

export async function deleteEnrollment(
  organizationId: string,
  studentId: string,
  enrollmentId: string
): Promise<void> {
  const { data: enrollment, error: enrollmentError } = await supabase
    .from('student_enrollments')
    .select('id, student_id, course_id, combo_id, payment_id')
    .eq('organization_id', organizationId)
    .eq('student_id', studentId)
    .eq('id', enrollmentId)
    .single();

  if (enrollmentError) throw enrollmentError;

  let effectivePaymentId = enrollment.payment_id || null;
  let paymentAmountPaid = 0;

  if (effectivePaymentId) {
    const { data: paymentRow } = await supabase
      .from('payments')
      .select('amount_paid')
      .eq('organization_id', organizationId)
      .eq('id', effectivePaymentId)
      .maybeSingle();
    paymentAmountPaid = Number(paymentRow?.amount_paid || 0);
  } else if (enrollment.combo_id) {
    const { data: comboRow } = await supabase
      .from('course_combos')
      .select('name')
      .eq('id', enrollment.combo_id)
      .maybeSingle();

    if (comboRow?.name) {
      const { data: paymentRow } = await supabase
        .from('payments')
        .select('id, amount_paid')
        .eq('organization_id', organizationId)
        .eq('student_id', studentId)
        .eq('course_name', comboRow.name)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      effectivePaymentId = paymentRow?.id || null;
      paymentAmountPaid = Number(paymentRow?.amount_paid || 0);
    }
  }

  if (effectivePaymentId) {
    const feePayments = await fetchFeePaymentSummaries([effectivePaymentId]);
    if (enrollment.combo_id) {
      const hasAllocatedCoursePayments = feePayments.some((payment) =>
        payment.course_id && payment.course_id === enrollment.course_id && Number(payment.amount || 0) > 0
      );
      if (hasAllocatedCoursePayments) {
        throw new Error('Cannot delete this combo course because payments are already allocated to this module.');
      }
    } else if (paymentAmountPaid > 0 || feePayments.some((payment) => Number(payment.amount || 0) > 0)) {
      throw new Error('Cannot delete this enrollment after payments have been recorded.');
    }
  }

  if (enrollment.course_id) {
    const { data: scopedBatchRows, error: scopedBatchError } = await supabase
      .from('batches')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('module_subject_id', enrollment.course_id);

    if (scopedBatchError) throw scopedBatchError;

    const scopeBatchIds = Array.from(new Set((scopedBatchRows || []).map((row: any) => row.id).filter(Boolean)));
    if (scopeBatchIds.length > 0) {
      const { data: profileRow, error: profileError } = await supabase
        .from('profiles')
        .select('metadata')
        .eq('organization_id', organizationId)
        .eq('id', studentId)
        .single();

      if (profileError) throw profileError;

      const currentBatchIds = extractBatchIds(profileRow?.metadata);
      const nextBatchIds = currentBatchIds.filter((batchId) => !scopeBatchIds.includes(batchId));
      await assignStudentBatches(organizationId, studentId, nextBatchIds, scopeBatchIds);
    }
  }

  const { error: deleteEnrollmentError } = await supabase
    .from('student_enrollments')
    .delete()
    .eq('organization_id', organizationId)
    .eq('student_id', studentId)
    .eq('id', enrollmentId);

  if (deleteEnrollmentError) throw deleteEnrollmentError;

  if (!enrollment.combo_id && effectivePaymentId) {
    const { error: deletePaymentError } = await supabase
      .from('payments')
      .delete()
      .eq('organization_id', organizationId)
      .eq('id', effectivePaymentId);

    if (deletePaymentError) throw deletePaymentError;
  }
}

/**
 * Fetch available courses (from module_subjects)
 */
export async function fetchCourses(
  organizationId: string,
  branchId?: string | null
): Promise<{ id: string; name: string; fee: number; tax_type?: string; tax_amount?: number }[]> {
  let query = supabase
    .from('module_subjects')
    .select('id, name, price, tax_type, tax_amount')
    .eq('organization_id', organizationId)
    .order('name');

  if (branchId) query = query.eq('branch_id', branchId);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((c: any) => ({
    id: c.id,
    name: c.name,
    fee: c.price ?? 0,
    tax_type: c.tax_type || 'none',
    tax_amount: c.tax_amount ?? 0,
  }));
}
