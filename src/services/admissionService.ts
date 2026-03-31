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
  course_fee: number;
  // Payment summary (computed from payment records)
  total_fee?: number;
  discount_amount?: number;
  final_amount?: number;
  amount_paid?: number;
  remaining?: number;
  payment_status?: string;
  due_date?: string | null;
}

export interface EnrollmentInput {
  courseId: string;
  totalFee: number;
  discountAmount?: number;
  initialPayment?: number;
  dueDate?: string | null;
  paymentMode?: string;
  emiMonths?: number;
  processingCharge?: number;
  batchId?: string | null;
  collectedById?: string | null;
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
    if (!metadata) return null;
    let meta = metadata;
    if (typeof meta === 'string') {
      try { meta = JSON.parse(meta); } catch { return null; }
    }
    if (typeof meta !== 'object' || Array.isArray(meta)) return null;
    const batchId = meta.batch_id ?? meta.batch ?? meta.batchId;
    if (!batchId) return null;
    const id = String(batchId).trim();
    if (batchMap[id]) return batchMap[id];
    // Try name match
    const nameMatch = (batchesData || []).find((b: any) => b.name.trim().toLowerCase() === id.toLowerCase());
    return nameMatch?.name || id;
  };

  const studentIds = students.map((s) => s.id);

  // ── 1. Fetch structured enrollments (new flow via Admissions page) ──
  const { data: enrollments } = await supabase
    .from('student_enrollments')
    .select('*')
    .eq('organization_id', organizationId)
    .in('student_id', studentIds)
    .order('created_at', { ascending: true });

  // ── 2. Fetch ALL payments for these students (new + legacy from Users page) ──
  let payQuery = supabase
    .from('payments')
    .select('id, student_id, course_name, total_fee, discount_amount, amount, amount_paid, due_date, status, enrollment_id, created_at')
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
  if (allPaymentIds.length > 0) {
    const { data: fpData } = await supabase
      .from('fee_payments')
      .select('payment_id, amount')
      .in('payment_id', allPaymentIds);
    (fpData || []).forEach((fp: any) => {
      feePayMap[fp.payment_id] = (feePayMap[fp.payment_id] || 0) + Number(fp.amount);
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

  // ── Helper: build a StudentEnrollment from an enrollment row ──
  const buildFromEnrollment = (e: any): StudentEnrollment => {
    const course = courseMap[e.course_id] || { name: 'Unknown Course', price: 0 };
    const payRec = e.payment_id ? paymentMap[e.payment_id] : null;
    const amountPaid = e.payment_id ? (feePayMap[e.payment_id] || 0) : 0;
    const finalAmount = payRec ? Number(payRec.amount) : course.price;
    return {
      ...e,
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
      course_fee: totalFee,
      total_fee: totalFee,
      discount_amount: Number(p.discount_amount || 0),
      final_amount: finalAmount,
      amount_paid: amountPaid,
      remaining: Math.max(finalAmount - amountPaid, 0),
      payment_status: p.status || (amountPaid > 0 ? 'partial' : 'pending'),
      due_date: p.due_date || null,
    };
  };

  return students.map((student) => {
    // Structured enrollments for this student
    const structured = (enrollments || [])
      .filter((e) => e.student_id === student.id)
      .map(buildFromEnrollment);

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
        // Skip if the same course is already covered by a structured enrollment
        !enrolledCourseNames.has((p.course_name || '').toLowerCase().trim()) &&
        !(p.course_id && enrolledCourseIds.has(p.course_id))
      )
      .map(buildFromPayment);

    return { ...student, batch_name: resolveBatchName((student as any).metadata), enrollments: [...structured, ...legacy] };
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
    totalFee,
    discountAmount = 0,
    initialPayment = 0,
    dueDate,
    paymentMode = 'Cash',
    emiMonths,
    processingCharge = 0,
    batchId,
    collectedById,
  } = input;

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
  if (batchId) {
    try {
      // Get current metadata and merge batch_id
      const { data: profileData } = await supabase
        .from('profiles')
        .select('metadata')
        .eq('id', studentId)
        .single();
      let existingMeta: Record<string, unknown> = {};
      if (profileData?.metadata) {
        if (typeof profileData.metadata === 'string') {
          try { existingMeta = JSON.parse(profileData.metadata); } catch { /* ignore */ }
        } else if (typeof profileData.metadata === 'object' && !Array.isArray(profileData.metadata)) {
          existingMeta = profileData.metadata as Record<string, unknown>;
        }
      }
      await supabase
        .from('profiles')
        .update({ metadata: { ...existingMeta, batch_id: batchId } } as any)
        .eq('id', studentId);

      // Also enroll student in batch classes
      const { data: batchClasses } = await supabase
        .from('class_batches')
        .select('class_id')
        .eq('batch_id', batchId);
      if (batchClasses && batchClasses.length > 0) {
        await supabase
          .from('class_enrollments')
          .upsert(
            batchClasses.map((bc: any) => ({ class_id: bc.class_id, student_id: studentId })),
            { onConflict: 'class_id,student_id' }
          );
      }
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
