import { Fragment, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Search,
  GraduationCap,
  Users,
  BookOpen,
  Plus,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Hash,
  Calendar,
  CheckCircle,
  IndianRupee,
  TrendingDown,
  AlertCircle,
  MessageCircle,
  Download,
  Trash2,
  Pencil,
  Save,
  X,
  Upload,
  User,
  Phone,
  MapPin,
  Mail,
  FileText,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useBranch } from '@/contexts/BranchContext';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import * as admissionService from '@/services/admissionService';
import * as studentDetailService from '@/services/studentDetailService';
import * as courseService from '@/services/courseService';
import { sendFeeReceipt, sendFeeReminder } from '@/services/whatsappService';
import { admissionSourceService, type AdmissionSource } from '@/services/admissionSourceService';
import { referenceService, type Reference } from '@/services/referenceService';
import { PAYMENT_METHODS } from '@/constants/paymentMethods';
import type { StudentAdmission, StudentEnrollment } from '@/services/admissionService';
import type { StudentDetail } from '@/services/studentDetailService';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// ── Detail display helper ──
function DetailField({ label, value, mono, wide }: { label: string; value: string; mono?: boolean; wide?: boolean }) {
  return (
    <div className={wide ? 'sm:col-span-2 lg:col-span-3' : ''}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm font-medium text-foreground ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}

type PayDialogCourseOption = {
  id: string;
  name: string;
  label: string;
  remaining: number;
};

type AdmissionCourseOption = {
  id: string;
  name: string;
  fee: number;
  tax_type?: string;
  tax_amount?: number;
};

const statusStyles: Record<string, string> = {
  active:    'bg-emerald-500/10 text-emerald-700 border-emerald-500/30',
  completed: 'bg-blue-500/10 text-blue-700 border-blue-500/30',
  dropped:   'bg-rose-500/10 text-rose-700 border-rose-500/30',
  on_hold:   'bg-amber-500/10 text-amber-700 border-amber-500/30',
};

const payStatusStyles: Record<string, string> = {
  completed: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30',
  partial:   'bg-amber-500/10 text-amber-700 border-amber-500/30',
  pending:   'bg-rose-500/10 text-rose-700 border-rose-500/30',
};

function fmt(n: number) {
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;
}

function gstLabel(taxType: string | undefined): string {
  if (!taxType || taxType === 'none') return '';
  if (taxType.startsWith('gst_')) return `GST ${taxType.replace('gst_', '')}%`;
  return taxType.toUpperCase();
}

function normalizeComboKey(value: string | null | undefined): string {
  return String(value || '').trim().toLowerCase();
}

const sanitizeDownloadFileName = (value: string) =>
  value.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim();

const isMissingFeePaymentsCourseIdColumn = (error: any) => {
  const message = String(error?.message || error?.details || error?.hint || '');
  return /course_id/i.test(message) && /(fee_payments|column)/i.test(message);
};

async function fetchFeePaymentsByPaymentIds(paymentIds: string[]) {
  if (paymentIds.length === 0) return [] as any[];

  const withCourseId = await supabase
    .from('fee_payments')
    .select('amount, date, mode, payment_id, course_id')
    .in('payment_id', paymentIds)
    .order('date', { ascending: true });

  if (!withCourseId.error) {
    return withCourseId.data || [];
  }

  if (!isMissingFeePaymentsCourseIdColumn(withCourseId.error)) {
    throw withCourseId.error;
  }

  const fallback = await supabase
    .from('fee_payments')
    .select('amount, date, mode, payment_id')
    .in('payment_id', paymentIds)
    .order('date', { ascending: true });

  if (fallback.error) {
    throw fallback.error;
  }

  return (fallback.data || []).map((row: any) => ({ ...row, course_id: null }));
}

async function fetchFeePaymentsForDocument(paymentId: string) {
  if (!paymentId) return [] as any[];

  const withCourseId = await supabase
    .from('fee_payments')
    .select('id, amount, date, mode, course_id')
    .eq('payment_id', paymentId)
    .order('date', { ascending: true });

  if (!withCourseId.error) {
    return withCourseId.data || [];
  }

  if (!isMissingFeePaymentsCourseIdColumn(withCourseId.error)) {
    throw withCourseId.error;
  }

  const fallback = await supabase
    .from('fee_payments')
    .select('id, amount, date, mode')
    .eq('payment_id', paymentId)
    .order('date', { ascending: true });

  if (fallback.error) {
    throw fallback.error;
  }

  return (fallback.data || []).map((row: any) => ({ ...row, course_id: null }));
}

async function insertFeePaymentWithFallback(payload: {
  payment_id: string;
  organization_id: string;
  course_id?: string | null;
  amount: number;
  date: string;
  mode: string;
  notes?: string | null;
  sales_staff_id?: string | null;
}) {
  const withCourseId = await supabase.from('fee_payments').insert(payload as any);
  if (!withCourseId.error) {
    return withCourseId;
  }

  if (!isMissingFeePaymentsCourseIdColumn(withCourseId.error)) {
    return withCourseId;
  }

  const { course_id, ...fallbackPayload } = payload;
  return supabase.from('fee_payments').insert(fallbackPayload as any);
}

async function waitForDocumentImages(doc: Document): Promise<void> {
  const images = Array.from(doc.images || []);
  if (images.length === 0) return;

  await Promise.all(images.map((img) => new Promise<void>((resolve) => {
    if (img.complete) {
      resolve();
      return;
    }

    img.onload = () => resolve();
    img.onerror = () => resolve();
  })));
}

async function downloadHtmlAsPdf(html: string, fileName: string): Promise<void> {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '-10000px';
  iframe.style.top = '0';
  iframe.style.width = '1200px';
  iframe.style.height = '1600px';
  iframe.style.border = '0';

  document.body.appendChild(iframe);

  try {
    const doc = iframe.contentDocument;
    if (!doc) throw new Error('Could not create download document.');

    doc.open();
    doc.write(html);
    doc.close();

    await new Promise((resolve) => window.setTimeout(resolve, 150));
    await waitForDocumentImages(doc);

    const target = doc.body;
    const canvas = await html2canvas(target, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      width: Math.max(target.scrollWidth, target.offsetWidth),
      height: Math.max(target.scrollHeight, target.offsetHeight),
      windowWidth: Math.max(target.scrollWidth, target.offsetWidth),
      windowHeight: Math.max(target.scrollHeight, target.offsetHeight),
    });

    const pdf = new jsPDF({
      orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
      unit: 'px',
      format: [canvas.width, canvas.height],
    });

    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, canvas.width, canvas.height);
    pdf.save(sanitizeDownloadFileName(fileName));
  } finally {
    document.body.removeChild(iframe);
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export default function AdmissionsPage() {
  const { user } = useAuth();
  const { currentBranchId, branchVersion } = useBranch();

  const [students, setStudents]           = useState<StudentAdmission[]>([]);
  const [studentContacts, setStudentContacts] = useState<Record<string, { mobile: string; parentMobile: string }>>({});
  const [loading, setLoading]             = useState(true);
  const [searchQuery, setSearchQuery]     = useState('');
  const [expanded, setExpanded]           = useState<Set<string>>(new Set());
  const [courses, setCourses]             = useState<AdmissionCourseOption[]>([]);
  const [batches, setBatches]             = useState<{ id: string; name: string; module_subject_id?: string | null }[]>([]);
  const [courseCombos, setCourseCombos]   = useState<courseService.CourseCombo[]>([]);

  // ── Enroll Dialog ──
  const [enrollDialog, setEnrollDialog] = useState({
    open: false,
    studentId: '',
    studentName: '',
    parentComboId: '',
    parentComboName: '',
    courseId: '',
    batchId: '',
    courseBatchIds: [] as string[],
    comboBatchIds: [] as string[],
    currentBatchIds: [] as string[],
    totalFee: '',
    discount: '',
    initialPayment: '',
    dueDate: '',
    payMode: 'Cash',
    emiMonths: '6',
    processingCharge: '',
  });

  // ── Pay Dialog (record a payment for an existing enrollment) ──
  const [payDialog, setPayDialog] = useState({
    open: false,
    enrollmentId: '',
    paymentId: '',
    comboName: '',
    courseName: '',
    studentName: '',
    studentPhone: '',
    isComboPayment: false,
    courseOptions: [] as PayDialogCourseOption[],
    selectedCourseId: '',
    remaining: 0,
    amount: '',
    payMode: 'Cash',
    date: new Date().toISOString().split('T')[0],
    collectedById: '',
  });
  const [editEnrollmentDialog, setEditEnrollmentDialog] = useState({
    open: false,
    enrollmentId: '',
    studentId: '',
    studentName: '',
    courseId: '',
    courseName: '',
    comboName: '',
    batchIds: [] as string[],
    scopeBatchIds: [] as string[],
    availableBatches: [] as { id: string; name: string }[],
  });
  const [deleteEnrollmentDialog, setDeleteEnrollmentDialog] = useState({
    open: false,
    enrollmentId: '',
    studentId: '',
    studentName: '',
    courseName: '',
    comboName: '',
  });
  const [savingEnrollmentEdit, setSavingEnrollmentEdit] = useState(false);
  const [deletingEnrollment, setDeletingEnrollment] = useState(false);
  const [salesStaffOptions, setSalesStaffOptions] = useState<Array<{ id: string; name: string }>>([]);

  // ── Student Details (lazy-loaded on expand) ──
  const [studentDetails, setStudentDetails] = useState<Record<string, StudentDetail | null>>({});
  const [detailsLoading, setDetailsLoading] = useState<Set<string>>(new Set());
  const [editingStudent, setEditingStudent] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, any>>({});
  const [savingDetail, setSavingDetail] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState<string | null>(null);
  const [admissionSources, setAdmissionSources] = useState<AdmissionSource[]>([]);
  const [references, setReferences] = useState<Reference[]>([]);
  const [newReferenceName, setNewReferenceName] = useState('');
  const [showAddReferenceInput, setShowAddReferenceInput] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Organization info for reports
  const [orgInfo, setOrgInfo] = useState<{ name: string; address: string; phone: string; email: string; logoDataUrl: string | null }>({
    name: '', address: '', phone: '', email: '', logoDataUrl: null,
  });

  const mapComboCourseToOption = (course: courseService.Course): AdmissionCourseOption => ({
    id: course.id,
    name: course.name,
    fee: course.price ?? 0,
    tax_type: course.tax_type ?? 'none',
    tax_amount: course.tax_amount ?? 0,
  });

  const getCourseOptionById = (courseId: string) => {
    if (!courseId) return null;

    const directCourse = courses.find((item) => item.id === courseId);
    if (directCourse) return directCourse;

    for (const combo of courseCombos) {
      const comboCourse = combo.courses.find((item) => item.id === courseId);
      if (comboCourse) {
        return mapComboCourseToOption(comboCourse);
      }
    }

    return null;
  };

  const getCourseCombo = (comboId: string | null | undefined, comboName?: string | null) => {
    if (comboId) {
      const byId = courseCombos.find((item) => item.id === comboId) || null;
      if (byId) return byId;
    }

    const normalizedName = normalizeComboKey(comboName);
    if (!normalizedName) return null;

    return courseCombos.find((item) => normalizeComboKey(item.name) === normalizedName) || null;
  };

  const getSelectedCourseOrCombo = (rawSelection: string) => {
    if (!rawSelection) {
      return { mode: 'none' as const, course: null, combo: null };
    }

    if (rawSelection.startsWith('combo:')) {
      const comboId = rawSelection.slice(6);
      const combo = courseCombos.find((item) => item.id === comboId) || null;
      return { mode: 'combo' as const, course: null, combo };
    }

    const course = getCourseOptionById(rawSelection);
    return { mode: 'course' as const, course, combo: null };
  };

  const getComboMappedBatches = (combo: courseService.CourseCombo) => {
    if (combo.batches && combo.batches.length > 0) {
      const explicitIds = new Set(combo.batches.map((batch) => batch.id));
      return batches.filter((batch) => explicitIds.has(batch.id));
    }

    const comboCourseIds = new Set(combo.courses.map((course) => course.id));
    return batches.filter((batch) => batch.module_subject_id && comboCourseIds.has(batch.module_subject_id));
  };

  const getCourseBatches = (courseId: string) => {
    if (!courseId) return [] as typeof batches;
    return batches.filter((batch) => batch.module_subject_id === courseId);
  };

  const getEnrollmentGroups = (enrollments: StudentEnrollment[]) => {
    const standalone: StudentEnrollment[] = [];
    const comboGroups = new Map<string, {
      comboId: string | null;
      comboName: string;
      parent: StudentEnrollment | null;
      children: StudentEnrollment[];
    }>();

    enrollments.forEach((enrollment) => {
      if (!enrollment.combo_id && !enrollment.combo_name) {
        standalone.push(enrollment);
        return;
      }

      const key = enrollment.combo_id || `combo:${(enrollment.combo_name || enrollment.course_name).toLowerCase()}`;
      const existing = comboGroups.get(key) || {
        comboId: enrollment.combo_id || null,
        comboName: enrollment.combo_name || enrollment.course_name || 'Combo',
        parent: null,
        children: [],
      };

      if (enrollment.is_combo_placeholder || !enrollment.course_id) {
        existing.parent = enrollment;
      } else {
        existing.children.push(enrollment);
      }

      comboGroups.set(key, existing);
    });

    return {
      standalone,
      comboGroups: Array.from(comboGroups.values()),
    };
  };

  const summarizeComboEnrollment = (group: {
    comboId: string | null;
    comboName: string;
    parent: StudentEnrollment | null;
    children: StudentEnrollment[];
  }): StudentEnrollment => {
    if (group.parent) return group.parent;

    const totalFee = group.children.reduce((sum, item) => sum + Number(item.total_fee || item.course_fee || 0), 0);
    const discountAmount = group.children.reduce((sum, item) => sum + Number(item.discount_amount || 0), 0);
    const finalAmount = group.children.reduce((sum, item) => sum + Number(item.final_amount || item.total_fee || item.course_fee || 0), 0);
    const amountPaid = group.children.reduce((sum, item) => sum + Number(item.amount_paid || 0), 0);
    const remaining = Math.max(Number((finalAmount - amountPaid).toFixed(2)), 0);
    const dueDate = group.children.find((item) => item.due_date)?.due_date || null;

    return {
      id: `combo_summary_${group.comboId || group.comboName}`,
      organization_id: group.children[0]?.organization_id || user?.organizationId || '',
      branch_id: group.children[0]?.branch_id || null,
      student_id: group.children[0]?.student_id || '',
      course_id: '',
      enrollment_number: '—',
      enrollment_date: group.children[0]?.enrollment_date || '',
      status: 'active',
      payment_id: group.children[0]?.payment_id || null,
      created_at: group.children[0]?.created_at || new Date().toISOString(),
      course_name: group.comboName,
      combo_id: group.comboId,
      combo_name: group.comboName,
      course_fee: totalFee,
      total_fee: totalFee,
      discount_amount: discountAmount,
      final_amount: finalAmount,
      amount_paid: amountPaid,
      remaining,
      payment_status: remaining <= 0 ? 'completed' : amountPaid > 0 ? 'partial' : 'pending',
      due_date: dueDate,
      is_combo_placeholder: true,
    };
  };

  const getAvailableCoursesForStudent = (enrollments: StudentEnrollment[]) => {
    const assignedCourseIds = new Set(enrollments.map((item) => item.course_id).filter(Boolean));
    return courses.filter((course) => !assignedCourseIds.has(course.id));
  };

  const getEnrollmentDisplayName = (enrollment: StudentEnrollment, comboChildren: StudentEnrollment[] = []) => {
    if (enrollment.is_combo_placeholder || !enrollment.course_id) {
      const childNames = comboChildren.map((item) => item.course_name).filter(Boolean);
      return childNames.length > 0
        ? `${enrollment.combo_name || enrollment.course_name} - ${childNames.join(', ')}`
        : (enrollment.combo_name || enrollment.course_name);
    }

    return enrollment.combo_name ? `${enrollment.combo_name} - ${enrollment.course_name}` : enrollment.course_name;
  };

  const buildEnrollDialogState = (
    student: StudentAdmission,
    comboSummary?: StudentEnrollment | null,
  ) => ({
    open: true,
    studentId: student.id,
    studentName: student.full_name,
    parentComboId: comboSummary?.combo_id || '',
    parentComboName: comboSummary?.combo_name || comboSummary?.course_name || '',
    courseId: '',
    batchId: '',
    courseBatchIds: [],
    comboBatchIds: [],
    currentBatchIds: student.batch_ids || [],
    totalFee: '',
    discount: '',
    initialPayment: '',
    dueDate: '',
    payMode: 'Cash',
    emiMonths: '6',
    processingCharge: '',
  });

  // ─────────────────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!user?.organizationId) return;
    setLoading(true);
    try {
      const [studentsData, coursesData, batchesRes, combosData] = await Promise.all([
        admissionService.fetchAllStudents(user.organizationId, currentBranchId),
        admissionService.fetchCourses(user.organizationId, currentBranchId),
        supabase
          .from('batches')
          .select('id, name, module_subject_id')
          .eq('organization_id', user.organizationId)
          .order('name'),
        courseService.getCourseCombos(user.organizationId, currentBranchId).catch(() => []),
      ]);
      setStudents(studentsData);
      setCourses(coursesData);
      setBatches((batchesRes.data || []).map((b: any) => ({ id: b.id, name: b.name, module_subject_id: b.module_subject_id })));
      setCourseCombos(combosData || []);

      const studentIds = studentsData.map((s) => s.id);
      if (studentIds.length > 0) {
        const { data: detailsData } = await supabase
          .from('student_details')
          .select('student_id, mobile, parent_mobile')
          .in('student_id', studentIds);

        const contactMap: Record<string, { mobile: string; parentMobile: string }> = {};
        (detailsData || []).forEach((d: any) => {
          contactMap[d.student_id] = {
            mobile: d.mobile || '',
            parentMobile: d.parent_mobile || '',
          };
        });
        setStudentContacts(contactMap);
      } else {
        setStudentContacts({});
      }
    } catch (err) {
      console.error('Error loading admissions:', err);
      toast.error('Failed to load admissions data');
    } finally {
      setLoading(false);
    }
  }, [user?.organizationId, currentBranchId]);

  useEffect(() => { loadData(); }, [loadData, branchVersion]);

  // ── Load admission sources ──
  useEffect(() => {
    if (!user?.organizationId) return;
    admissionSourceService.getSources(user.organizationId).then(setAdmissionSources).catch(console.error);
    referenceService.getReferences(user.organizationId).then(setReferences).catch(console.error);
  }, [user?.organizationId]);

  useEffect(() => {
    const loadSalesStaff = async () => {
      if (!user?.organizationId) return;
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('organization_id', user.organizationId)
        .eq('role', 'sales_staff')
        .order('full_name');

      if (error) {
        console.error('Failed to load sales staff list:', error);
        return;
      }

      setSalesStaffOptions((data || []).map((row: any) => ({
        id: row.id,
        name: row.full_name || 'Unknown',
      })));
    };

    loadSalesStaff();
  }, [user?.organizationId]);

  const handleAddReference = async () => {
    if (!user?.organizationId || !newReferenceName.trim()) return;
    try {
      const created = await referenceService.addReference(user.organizationId, newReferenceName.trim());
      setReferences((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setEditForm((p: any) => ({ ...p, reference: created.name }));
      setNewReferenceName('');
      setShowAddReferenceInput(false);
      toast.success('Reference added successfully');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to add reference');
    }
  };

  // ── Load org info for reports ──
  useEffect(() => {
    async function loadOrg() {
      if (!user?.organizationId) return;
      const { data: org } = await supabase.from('organizations').select('name, address, phone, email, logo_url').eq('id', user.organizationId).single();
      if (!org) return;
      let logoUrl = org.logo_url || null;
      if (currentBranchId) {
        const { data: branch } = await supabase.from('branches').select('logo_url').eq('id', currentBranchId).single();
        if (branch?.logo_url) logoUrl = branch.logo_url;
      }
      let logoDataUrl: string | null = null;
      if (logoUrl) {
        try {
          const resp = await fetch(logoUrl);
          const blob = await resp.blob();
          logoDataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
        } catch { /* ignore */ }
      }
      setOrgInfo({ name: org.name || '', address: org.address || '', phone: org.phone || '', email: org.email || '', logoDataUrl });
    }
    loadOrg();
  }, [user?.organizationId, currentBranchId]);

  // ── Fetch student details on expand ──
  const fetchStudentDetails = useCallback(async (studentId: string) => {
    if (studentDetails[studentId] !== undefined) return; // already fetched (or null = no record)
    setDetailsLoading((prev) => new Set(prev).add(studentId));
    try {
      const detail = await studentDetailService.getStudentDetail(studentId);
      setStudentDetails((prev) => ({ ...prev, [studentId]: detail }));
    } catch (err) {
      console.error('Failed to load student details:', err);
      setStudentDetails((prev) => ({ ...prev, [studentId]: null }));
    } finally {
      setDetailsLoading((prev) => { const n = new Set(prev); n.delete(studentId); return n; });
    }
  }, [studentDetails]);

  // ── Start editing student details ──
  const startEditing = (student: StudentAdmission, detail: StudentDetail | null) => {
    setEditingStudent(student.id);
    setEditForm({
      full_name: student.full_name || '',
      email: student.email || '',
      phone: student.phone || '',
      address: detail?.address || '',
      city: detail?.city || '',
      state: detail?.state || '',
      pincode: detail?.pincode || '',
      date_of_birth: detail?.date_of_birth || '',
      gender: detail?.gender || '',
      mobile: detail?.mobile || '',
      whatsapp: detail?.whatsapp || '',
      landline: detail?.landline || '',
      aadhaar: detail?.aadhaar || '',
      qualification: detail?.qualification || '',
      graduation_year: detail?.graduation_year || '',
      graduation_college: detail?.graduation_college || '',
      admission_source: detail?.admission_source || '',
      reference: detail?.reference || '',
      remarks: detail?.remarks || '',
      father_name: detail?.father_name || '',
      mother_name: detail?.mother_name || '',
      parent_email: detail?.parent_email || '',
      parent_mobile: detail?.parent_mobile || '',
    });
  };

  const cancelEditing = () => {
    setEditingStudent(null);
    setEditForm({});
  };

  const saveStudentDetails = async (studentId: string) => {
    if (!user?.organizationId) return;
    setSavingDetail(true);
    try {
      // Update profile fields (name, email, phone)
      await supabase.from('profiles').update({
        full_name: editForm.full_name,
        phone: editForm.phone,
      } as any).eq('id', studentId);

      // Prepare detail fields
      const detailFields = {
        address: editForm.address,
        city: editForm.city,
        state: editForm.state,
        pincode: editForm.pincode,
        date_of_birth: editForm.date_of_birth,
        gender: editForm.gender,
        mobile: editForm.mobile,
        whatsapp: editForm.whatsapp,
        landline: editForm.landline,
        aadhaar: editForm.aadhaar,
        qualification: editForm.qualification,
        graduation_year: editForm.graduation_year,
        graduation_college: editForm.graduation_college,
        admission_source: editForm.admission_source,
        reference: editForm.reference,
        remarks: editForm.remarks,
        father_name: editForm.father_name,
        mother_name: editForm.mother_name,
        parent_email: editForm.parent_email,
        parent_mobile: editForm.parent_mobile,
      };

      if (studentDetails[studentId]) {
        // Update existing detail
        await studentDetailService.updateStudentDetail(studentId, detailFields);
      } else {
        // Create new detail record
        await studentDetailService.createStudentDetail(studentId, user.organizationId, detailFields as any);
      }

      // Refresh data
      const detail = await studentDetailService.getStudentDetail(studentId);
      setStudentDetails((prev) => ({ ...prev, [studentId]: detail }));
      setEditingStudent(null);
      setEditForm({});
      loadData(); // refresh profile fields too
      toast.success('Student details saved');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save details');
    } finally {
      setSavingDetail(false);
    }
  };

  // ── Photo upload ──
  const handlePhotoUpload = async (studentId: string, file: File) => {
    if (!user?.organizationId) return;
    setUploadingPhoto(studentId);
    try {
      const publicUrl = await studentDetailService.uploadStudentPhoto(user.organizationId, studentId, file);
      // Update local state
      setStudentDetails((prev) => ({
        ...prev,
        [studentId]: prev[studentId] ? { ...prev[studentId]!, photo_url: publicUrl } : null,
      }));
      loadData(); // refresh avatar_url
      toast.success('Photo uploaded');
    } catch (err: any) {
      toast.error(err.message || 'Photo upload failed');
    } finally {
      setUploadingPhoto(null);
    }
  };

  // ── Photo download ──
  const handlePhotoDownload = async (photoUrl: string, studentName: string) => {
    try {
      const response = await fetch(photoUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext = photoUrl.split('.').pop()?.split('?')[0] || 'jpg';
      a.download = `${studentName.replace(/\s+/g, '_')}_photo.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('Failed to download photo');
    }
  };

  // ── Generate comprehensive student report ──
  const generateStudentReport = async (student: StudentAdmission) => {
    const detail = studentDetails[student.id] || null;
    const groupedEnrollments = getEnrollmentGroups(student.enrollments || []);
    const summarizedEnrollments = [
      ...groupedEnrollments.comboGroups.map((group) => summarizeComboEnrollment(group)),
      ...groupedEnrollments.standalone,
    ];
    // Fetch attendance summary
    let attendanceSummary = { total: 0, present: 0, absent: 0, late: 0 };
    try {
      const { data: attData } = await supabase
        .from('attendance')
        .select('status')
        .eq('student_id', student.id)
        .eq('organization_id', student.organization_id);
      if (attData) {
        attendanceSummary.total = attData.length;
        attendanceSummary.present = attData.filter((a: any) => a.status === 'present').length;
        attendanceSummary.absent = attData.filter((a: any) => a.status === 'absent').length;
        attendanceSummary.late = attData.filter((a: any) => a.status === 'late').length;
      }
    } catch { /* ignore */ }

    // Fetch payment history
    let paymentHistory: { date: string; amount: number; mode: string; course: string }[] = [];
    try {
      const paymentIds = summarizedEnrollments.map(e => e.payment_id).filter(Boolean);
      if (paymentIds.length > 0) {
        const feePayments = await fetchFeePaymentsByPaymentIds(paymentIds);
        if (feePayments) {
          const pidToCourse: Record<string, string> = {};
          const courseIdToCourse: Record<string, string> = {};
          groupedEnrollments.comboGroups.forEach((group) => {
            const comboSummary = summarizeComboEnrollment(group);
            if (comboSummary.payment_id) {
              pidToCourse[comboSummary.payment_id] = getEnrollmentDisplayName(comboSummary, group.children);
            }
            group.children.forEach((enrollment) => {
              if (enrollment.course_id) {
                courseIdToCourse[enrollment.course_id] = getEnrollmentDisplayName(enrollment);
              }
            });
          });
          groupedEnrollments.standalone.forEach((enrollment) => {
            if (enrollment.payment_id) pidToCourse[enrollment.payment_id] = getEnrollmentDisplayName(enrollment);
            if (enrollment.course_id) courseIdToCourse[enrollment.course_id] = getEnrollmentDisplayName(enrollment);
          });
          paymentHistory = feePayments.map((fp: any) => ({
            date: fp.date,
            amount: fp.amount,
            mode: fp.mode || 'N/A',
            course: (fp.course_id ? courseIdToCourse[fp.course_id] : null) || pidToCourse[fp.payment_id] || 'Unknown',
          }));
        }
      }
    } catch { /* ignore */ }

    const totalFee = summarizedEnrollments.reduce((s, e) => s + (e.final_amount || e.total_fee || 0), 0);
    const totalPaid = summarizedEnrollments.reduce((s, e) => s + (e.amount_paid || 0), 0);
    const totalDue = summarizedEnrollments.reduce((s, e) => s + (e.remaining || 0), 0);
    const attPct = attendanceSummary.total > 0 ? Math.round((attendanceSummary.present / attendanceSummary.total) * 100) : 0;
    const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Student Report - ${student.full_name}</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; color: #222; background: #fff; font-size: 13px; }
      .header { display: flex; align-items: center; border-bottom: 2px solid #333; padding-bottom: 16px; margin-bottom: 20px; }
      .header img { max-height: 60px; max-width: 80px; object-fit: contain; margin-right: 16px; }
      .header .org-info { flex: 1; }
      .header .org-info h2 { font-size: 18px; text-transform: uppercase; }
      .header .org-info p { font-size: 11px; color: #555; }
      .report-title { text-align: center; font-size: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 20px; background: #f5f5f5; padding: 8px; border: 1px solid #ddd; }
      .section { margin-bottom: 18px; }
      .section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; border-bottom: 1px solid #999; padding-bottom: 4px; margin-bottom: 10px; color: #333; }
      .info-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px 20px; }
      .info-grid .item { }
      .info-grid .item .label { font-size: 10px; text-transform: uppercase; color: #888; }
      .info-grid .item .value { font-size: 13px; font-weight: 600; }
      table { width: 100%; border-collapse: collapse; margin-top: 6px; }
      th { background: #333; color: #fff; padding: 6px 10px; text-align: left; font-size: 11px; text-transform: uppercase; }
      td { padding: 6px 10px; border-bottom: 1px solid #ddd; font-size: 12px; }
      tr:nth-child(even) { background: #f9f9f9; }
      .summary-row { display: flex; gap: 16px; margin-top: 8px; }
      .summary-box { flex: 1; border: 1px solid #ddd; padding: 10px; text-align: center; }
      .summary-box .s-label { font-size: 10px; text-transform: uppercase; color: #888; }
      .summary-box .s-value { font-size: 18px; font-weight: 700; }
      .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #999; border-top: 1px solid #ddd; padding-top: 10px; }
      @media print { body { padding: 15px; } }
    </style></head><body>
    <div class="header">
      ${orgInfo.logoDataUrl ? `<img src="${orgInfo.logoDataUrl}" alt="Logo" />` : ''}
      <div class="org-info">
        <h2>${orgInfo.name}</h2>
        ${orgInfo.address ? `<p>${orgInfo.address}</p>` : ''}
        ${orgInfo.phone ? `<p>Phone: ${orgInfo.phone}</p>` : ''}
        ${orgInfo.email ? `<p>Email: ${orgInfo.email}</p>` : ''}
      </div>
      <div style="text-align:right;font-size:11px;color:#666;">
        <p>Date: ${today}</p>
      </div>
    </div>
    <div class="report-title">Student Report</div>

    <div class="section">
      <div class="section-title">Student Information</div>
      <div class="info-grid">
        <div class="item"><div class="label">Name</div><div class="value">${student.full_name}</div></div>
        <div class="item"><div class="label">Student ID</div><div class="value">${student.student_number || '—'}</div></div>
        <div class="item"><div class="label">Email</div><div class="value">${student.email || '—'}</div></div>
        <div class="item"><div class="label">Phone</div><div class="value">${student.phone || '—'}</div></div>
        <div class="item"><div class="label">Batch</div><div class="value">${student.batch_name || '—'}</div></div>
        <div class="item"><div class="label">Registered</div><div class="value">${new Date(student.created_at).toLocaleDateString('en-IN')}</div></div>
        ${detail ? `
        <div class="item"><div class="label">Address</div><div class="value">${detail.address || '—'}</div></div>
        <div class="item"><div class="label">Father</div><div class="value">${detail.father_name || '—'}</div></div>
        <div class="item"><div class="label">Mother</div><div class="value">${detail.mother_name || '—'}</div></div>
        <div class="item"><div class="label">Reference</div><div class="value">${detail.reference || '—'}</div></div>
        ` : ''}
      </div>
    </div>

    <div class="section">
      <div class="section-title">Financial Summary</div>
      <div class="summary-row">
        <div class="summary-box"><div class="s-label">Total Fee</div><div class="s-value">${fmt(totalFee)}</div></div>
        <div class="summary-box"><div class="s-label">Total Paid</div><div class="s-value" style="color:#059669;">${fmt(totalPaid)}</div></div>
        <div class="summary-box"><div class="s-label">Outstanding</div><div class="s-value" style="color:${totalDue > 0 ? '#dc2626' : '#059669'};">${fmt(totalDue)}</div></div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Course Enrollments</div>
      <table>
        <thead><tr><th>Course</th><th>Enrollment #</th><th>Date</th><th>Status</th><th>Base Fee</th><th>GST</th><th>Total Fee</th><th>Discount</th><th>Paid</th><th>Due</th><th>Due Date</th></tr></thead>
        <tbody>
          ${[
            ...groupedEnrollments.comboGroups.flatMap((group) => {
              const comboSummary = summarizeComboEnrollment(group);
              const comboRow = `<tr>
                <td>${getEnrollmentDisplayName(comboSummary, group.children)}</td>
                <td>${comboSummary.enrollment_number}</td>
                <td>${comboSummary.enrollment_date ? new Date(comboSummary.enrollment_date).toLocaleDateString('en-IN') : '—'}</td>
                <td>${(comboSummary.status || '').charAt(0).toUpperCase() + (comboSummary.status || '').slice(1)}</td>
                <td>—</td>
                <td style="color:#7c3aed;">Combo</td>
                <td>${fmt(comboSummary.final_amount || comboSummary.total_fee || 0)}</td>
                <td>${(comboSummary.discount_amount ?? 0) > 0 ? fmt(comboSummary.discount_amount!) : '—'}</td>
                <td>${fmt(comboSummary.amount_paid || 0)}</td>
                <td>${fmt(comboSummary.remaining || 0)}</td>
                <td>${comboSummary.due_date ? new Date(comboSummary.due_date).toLocaleDateString('en-IN') : '—'}</td>
              </tr>`;

              const childRows = group.children.map((e) => {
                const c = courses.find((course) => course.id === e.course_id);
                const taxAmt = c?.tax_amount ?? 0;
                const taxLbl = taxAmt > 0 ? gstLabel(c?.tax_type) : '—';
                const baseFee = c?.fee ?? (e.final_amount || 0);
                return `<tr>
                  <td style="padding-left:18px;">↳ ${getEnrollmentDisplayName(e)}</td>
                  <td>${e.enrollment_number}</td>
                  <td>${e.enrollment_date ? new Date(e.enrollment_date).toLocaleDateString('en-IN') : '—'}</td>
                  <td>${(e.status || '').charAt(0).toUpperCase() + (e.status || '').slice(1)}</td>
                  <td>${taxAmt > 0 ? fmt(baseFee) : '—'}</td>
                  <td style="color:#d97706;">${taxAmt > 0 ? `${taxLbl} / ${fmt(taxAmt)}` : '—'}</td>
                  <td>${fmt(e.final_amount || 0)}</td>
                  <td>${(e.discount_amount ?? 0) > 0 ? fmt(e.discount_amount!) : '—'}</td>
                  <td>${fmt(e.amount_paid || 0)}</td>
                  <td>${fmt(e.remaining || 0)}</td>
                  <td>${e.due_date ? new Date(e.due_date).toLocaleDateString('en-IN') : '—'}</td>
                </tr>`;
              });

              return [comboRow, ...childRows];
            }),
            ...groupedEnrollments.standalone.map((e) => {
              const c = courses.find((course) => course.id === e.course_id);
              const taxAmt = c?.tax_amount ?? 0;
              const taxLbl = taxAmt > 0 ? gstLabel(c?.tax_type) : '—';
              const baseFee = c?.fee ?? (e.final_amount || 0);
              return `<tr>
                <td>${getEnrollmentDisplayName(e)}</td>
                <td>${e.enrollment_number}</td>
                <td>${e.enrollment_date ? new Date(e.enrollment_date).toLocaleDateString('en-IN') : '—'}</td>
                <td>${(e.status || '').charAt(0).toUpperCase() + (e.status || '').slice(1)}</td>
                <td>${taxAmt > 0 ? fmt(baseFee) : '—'}</td>
                <td style="color:#d97706;">${taxAmt > 0 ? `${taxLbl} / ${fmt(taxAmt)}` : '—'}</td>
                <td>${fmt(e.final_amount || 0)}</td>
                <td>${(e.discount_amount ?? 0) > 0 ? fmt(e.discount_amount!) : '—'}</td>
                <td>${fmt(e.amount_paid || 0)}</td>
                <td>${fmt(e.remaining || 0)}</td>
                <td>${e.due_date ? new Date(e.due_date).toLocaleDateString('en-IN') : '—'}</td>
              </tr>`;
            }),
          ].join('')}
        </tbody>
      </table>
    </div>

    ${paymentHistory.length > 0 ? `
    <div class="section">
      <div class="section-title">Payment History</div>
      <table>
        <thead><tr><th>Date</th><th>Course</th><th>Amount</th><th>Mode</th></tr></thead>
        <tbody>
          ${paymentHistory.map(p => `<tr>
            <td>${new Date(p.date).toLocaleDateString('en-IN')}</td>
            <td>${p.course}</td>
            <td>${fmt(p.amount)}</td>
            <td>${p.mode}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>` : ''}

    <div class="section">
      <div class="section-title">Attendance Summary</div>
      <div class="summary-row">
        <div class="summary-box"><div class="s-label">Total Classes</div><div class="s-value">${attendanceSummary.total}</div></div>
        <div class="summary-box"><div class="s-label">Present</div><div class="s-value" style="color:#059669;">${attendanceSummary.present}</div></div>
        <div class="summary-box"><div class="s-label">Absent</div><div class="s-value" style="color:#dc2626;">${attendanceSummary.absent}</div></div>
        <div class="summary-box"><div class="s-label">Late</div><div class="s-value" style="color:#d97706;">${attendanceSummary.late}</div></div>
        <div class="summary-box"><div class="s-label">Attendance %</div><div class="s-value">${attPct}%</div></div>
      </div>
    </div>

    <div class="footer">
      <p>This is a computer-generated report. Generated on ${today}.</p>
    </div>
    </body></html>`;

    const win = window.open('', '_blank', 'width=900,height=700');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 500);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────

  const filteredStudents = useMemo(
    () => {
      const q = searchQuery.toLowerCase();
      return students.filter((s) => {
        const contacts = studentContacts[s.id];
        return (
          s.full_name?.toLowerCase().includes(q) ||
          s.email?.toLowerCase().includes(q) ||
          (s.student_number || '').toLowerCase().includes(q) ||
          (s.phone || '').includes(searchQuery) ||
          (contacts?.mobile || '').includes(searchQuery) ||
          (contacts?.parentMobile || '').includes(searchQuery)
        );
      });
    },
    [students, searchQuery, studentContacts]
  );

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(id)) {
        n.delete(id);
        if (editingStudent === id) cancelEditing();
      } else {
        n.add(id);
        fetchStudentDetails(id);
      }
      return n;
    });
  };

  // ── Open enroll dialog, pre-fill fee from selected course ──
  const openEnrollDialog = (student: StudentAdmission, comboSummary?: StudentEnrollment | null) => {
    setEnrollDialog(buildEnrollDialogState(student, comboSummary));
  };

  const handleCourseChange = (courseId: string) => {
    if (enrollDialog.parentComboId) {
      const course = getCourseOptionById(courseId);
      const fee = course?.fee ?? 0;
      const taxAmount = course?.tax_amount ?? 0;
      const totalWithGst = fee + taxAmount;
      const courseBatches = getCourseBatches(courseId);
      const selectedCourseBatchIds = (enrollDialog.currentBatchIds || []).filter((value) => courseBatches.some((batch) => batch.id === value));

      setEnrollDialog((prev) => ({
        ...prev,
        courseId,
        batchId: selectedCourseBatchIds[0] || '',
        courseBatchIds: selectedCourseBatchIds,
        comboBatchIds: [],
        totalFee: prev.totalFee || (totalWithGst > 0 ? String(totalWithGst) : prev.totalFee),
      }));
      return;
    }

    const selection = getSelectedCourseOrCombo(courseId);

    if (selection.mode === 'combo' && selection.combo) {
      const comboBatches = getComboMappedBatches(selection.combo);
      const currentComboBatchIds = (enrollDialog.currentBatchIds || []).filter((batchId) => comboBatches.some((batch) => batch.id === batchId));
      setEnrollDialog((prev) => ({
        ...prev,
        courseId,
        batchId: '',
        courseBatchIds: [],
        comboBatchIds: currentComboBatchIds,
        totalFee: selection.combo!.price > 0 ? String(selection.combo!.price) : prev.totalFee,
      }));
      return;
    }

    const course = selection.course;
    const fee = course?.fee ?? 0;
    const taxAmount = course?.tax_amount ?? 0;
    const totalWithGst = fee + taxAmount;
    setEnrollDialog((prev) => ({
      ...prev,
      courseId,
      batchId: '',
      courseBatchIds: [],
      comboBatchIds: [],
      totalFee: totalWithGst > 0 ? String(totalWithGst) : prev.totalFee,
    }));
  };

  const handleEnroll = async () => {
    const {
      studentId,
      studentName,
      parentComboId,
      parentComboName,
      courseId,
      batchId,
      courseBatchIds,
      comboBatchIds,
      totalFee,
      discount,
      initialPayment,
      dueDate,
      payMode,
      emiMonths,
      processingCharge,
    } = enrollDialog;
    if (!user?.organizationId || !studentId || !courseId || !totalFee) {
      toast.error('Please fill course and fee amount');
      return;
    }
    try {
      const selection = getSelectedCourseOrCombo(courseId);
      const totalFeeNum = parseFloat(totalFee) || 0;
      const discountNum = parseFloat(discount) || 0;
      if (discountNum < 0) {
        toast.error('Discount cannot be negative');
        return;
      }
      if (discountNum > totalFeeNum) {
        toast.error('Discount cannot exceed the total fee');
        return;
      }
      const baseAmount = Math.max(totalFeeNum - discountNum, 0);
      const processingChargeNum = payMode === 'Bajaj EMI' ? Math.max(parseFloat(processingCharge) || 0, 0) : 0;
      const payableAmount = baseAmount + processingChargeNum;
      const emiMonthsNum = Math.max(parseInt(emiMonths || '1', 10) || 1, 1);
      const computedFirstEmiAmount = payMode === 'Bajaj EMI'
        ? Number((payableAmount / emiMonthsNum).toFixed(2))
        : 0;
      const initialPaymentValue = payMode === 'Bajaj EMI'
        ? computedFirstEmiAmount
        : parseFloat(initialPayment) || 0;
      if (payMode !== 'Bajaj EMI' && initialPaymentValue > payableAmount) {
        toast.error('Initial payment cannot exceed the final amount');
        return;
      }

      if (selection.mode === 'combo' && !selection.combo) {
        toast.error('Selected combo could not be loaded');
        return;
      }

      if (parentComboId && !selection.course) {
        toast.error('Please select a course to add under this combo');
        return;
      }

      if (parentComboId) {
        const availableCourseBatches = getCourseBatches(courseId);
        if (availableCourseBatches.length > 0 && courseBatchIds.length === 0) {
          toast.error('Please select at least one batch for this course');
          return;
        }
      }

      await admissionService.addCourseEnrollment(
        user.organizationId,
        studentId,
        studentName,
        {
          courseId: parentComboId
            ? courseId
            : selection.mode === 'course'
              ? courseId
              : selection.combo!.courses[0]?.id || '',
          comboId: parentComboId || (selection.mode === 'combo' ? selection.combo!.id : null),
          comboName: parentComboId ? parentComboName : (selection.mode === 'combo' ? selection.combo!.name : null),
          courseIds: parentComboId
            ? [courseId]
            : selection.mode === 'combo'
              ? selection.combo!.courses.map((course) => course.id)
              : undefined,
          totalFee: totalFeeNum,
          discountAmount: discountNum,
          initialPayment: initialPaymentValue,
          dueDate: dueDate || null,
          paymentMode: payMode,
          emiMonths: payMode === 'Bajaj EMI' ? emiMonthsNum : undefined,
          processingCharge: processingChargeNum,
          batchId: parentComboId ? null : (selection.mode === 'course' ? batchId || null : null),
          batchIds: parentComboId
            ? courseBatchIds
            : (selection.mode === 'combo' ? comboBatchIds : undefined),
          batchScopeIds: parentComboId
            ? getCourseBatches(courseId).map((batch) => batch.id)
            : (selection.mode === 'combo'
              ? getComboMappedBatches(selection.combo!).map((batch) => batch.id)
              : (selection.mode === 'course' ? getCourseBatches(courseId).map((batch) => batch.id) : undefined)),
          collectedById: user.id,
        },
        currentBranchId
      );
      toast.success(parentComboId ? 'Course added under combo successfully' : (selection.mode === 'combo' ? 'Combo updated successfully' : 'Student enrolled successfully'));
      setEnrollDialog((p) => ({ ...p, open: false }));
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Enrollment failed');
    }
  };

  // ── Open pay dialog ──
  const openPayDialog = async (enrollment: StudentEnrollment, student: StudentAdmission, comboChildren: StudentEnrollment[] = [], preferredCourseId = '') => {
    try {
      let paymentId = enrollment.payment_id || '';

      if (!paymentId && user?.organizationId) {
        const finalAmount = Number(enrollment.final_amount || enrollment.total_fee || enrollment.course_fee || 0);
        const amountPaid = Number(enrollment.amount_paid || 0);
        const status = amountPaid >= finalAmount ? 'completed' : amountPaid > 0 ? 'partial' : 'pending';

        const { data: paymentData, error: paymentError } = await supabase
          .from('payments')
          .insert({
            organization_id: user.organizationId,
            branch_id: currentBranchId || null,
            student_id: student.id,
            student_name: student.full_name,
            course_name: enrollment.course_name,
            total_fee: Number(enrollment.total_fee || enrollment.course_fee || finalAmount),
            discount_amount: Number(enrollment.discount_amount || 0),
            amount: finalAmount,
            amount_paid: amountPaid,
            due_date: enrollment.due_date || null,
            status,
            enrollment_id: enrollment.id,
            payment_method: 'Cash',
            notes: `Auto-linked payment for enrollment ${enrollment.enrollment_number}`,
          } as any)
          .select('id')
          .single();

        if (paymentError) throw paymentError;
        paymentId = paymentData.id;

        const { error: linkError } = await supabase
          .from('student_enrollments')
          .update({ payment_id: paymentId } as any)
          .eq('id', enrollment.id);
        if (linkError) throw linkError;

        setStudents((prev) =>
          prev.map((item) =>
            item.id !== student.id
              ? item
              : {
                  ...item,
                  enrollments: (item.enrollments || []).map((en) =>
                    en.id === enrollment.id ? { ...en, payment_id: paymentId } : en
                  ),
                }
          )
        );
      }

      const isComboPayment = Boolean(enrollment.is_combo_placeholder || !enrollment.course_id);
      const rawCourseOptions = isComboPayment
        ? comboChildren
            .filter((item) => item.course_id)
            .map((item) => ({
              id: item.course_id,
              name: item.course_name,
              label: getEnrollmentDisplayName(item),
              remaining: Number(item.remaining || 0),
            }))
        : [];
      const courseOptions = rawCourseOptions.filter((option, index, all) => all.findIndex((item) => item.id === option.id) === index);
      const payableCourseOptions = courseOptions.filter((option) => option.remaining > 0);
      const effectiveCourseOptions = payableCourseOptions.length > 0 ? payableCourseOptions : courseOptions;
      const preferredCourseOption = preferredCourseId
        ? effectiveCourseOptions.find((option) => option.id === preferredCourseId) || null
        : null;
      const defaultCourseOption = preferredCourseOption || (effectiveCourseOptions.length === 1 ? effectiveCourseOptions[0] : null);

      setPayDialog({
        open: true,
        enrollmentId: enrollment.id,
        paymentId,
        comboName: enrollment.combo_name || enrollment.course_name,
        courseName: getEnrollmentDisplayName(enrollment, comboChildren),
        studentName: student.full_name,
        studentPhone: student.phone || '',
        isComboPayment,
        courseOptions: effectiveCourseOptions,
        selectedCourseId: defaultCourseOption?.id || '',
        remaining: defaultCourseOption?.remaining ?? (enrollment.remaining ?? 0),
        amount: '',
        payMode: 'Cash',
        date: new Date().toISOString().split('T')[0],
        collectedById: user?.id || '',
      });
    } catch (err: any) {
      console.error('Failed to prepare payment dialog:', err);
      toast.error(err?.message || 'Failed to open payment dialog');
    }
  };

  const handleRecordPayment = async () => {
    const { paymentId, amount, payMode, date, studentName, courseName, remaining, collectedById, selectedCourseId, courseOptions, isComboPayment } = payDialog;
    const selectedCourseOption = courseOptions.find((option) => option.id === selectedCourseId) || null;
    const targetCourseName = selectedCourseOption?.label || courseName;
    const remainingAmount = selectedCourseOption?.remaining ?? remaining;
    const amtNum = parseFloat(amount) || 0;
    if (!paymentId || amtNum <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    if (isComboPayment && courseOptions.length > 0 && !selectedCourseId) {
      toast.error('Please choose the course you are collecting payment for');
      return;
    }
    if (amtNum > remainingAmount) {
      toast.error(`Amount exceeds remaining balance of ${fmt(remainingAmount)}`);
      return;
    }
    try {
      // Insert fee_payment
      const { error: fpErr } = await insertFeePaymentWithFallback({
        payment_id: paymentId,
        organization_id: user?.organizationId,
        course_id: selectedCourseId || null,
        amount: amtNum,
        date,
        mode: payMode,
        notes: selectedCourseOption ? `Allocated to ${targetCourseName}` : null,
        sales_staff_id: collectedById || user?.id || null,
      });
      if (fpErr) throw fpErr;

      // Re-fetch the real sum of fee_payments for this payment to avoid stale state
      const { data: fpRows } = await supabase
        .from('fee_payments')
        .select('amount')
        .eq('payment_id', paymentId);
      const newPaid = (fpRows || []).reduce((s: number, r: any) => s + Number(r.amount), 0);

      // Fetch current final amount from payments table
      const { data: payRow } = await supabase
        .from('payments')
        .select('amount')
        .eq('id', paymentId)
        .single();
      const finalAmt = payRow ? Number(payRow.amount) : remaining + amtNum;
      const newStatus = newPaid >= finalAmt ? 'completed' : 'partial';

      await supabase.from('payments')
        .update({ amount_paid: newPaid, status: newStatus })
        .eq('id', paymentId);

      // Also record as income transaction
      await supabase.from('transactions').insert({
        organization_id: user?.organizationId,
        branch_id: currentBranchId || null,
        type: 'income',
        description: `Fee Payment: ${targetCourseName} — ${studentName}`,
        amount: amtNum,
        category: 'Course Fee',
        date: new Date(date).toISOString(),
        mode: payMode,
        recurrence: 'one-time',
        paused: false,
        created_by: user?.id || null,
        sales_staff_id: collectedById || user?.id || null,
      });

      const remainingAfterPayment = selectedCourseOption
        ? Math.max(remainingAmount - amtNum, 0)
        : Math.max(finalAmt - newPaid, 0);

      if (payDialog.studentPhone) {
        try {
          await sendFeeReceipt({
            to: payDialog.studentPhone,
            studentName,
            courseName: targetCourseName,
            paidAmount: amtNum,
            paymentDate: date,
            remainingAmount: remainingAfterPayment,
          });
          toast.success('Payment recorded and receipt sent on WhatsApp');
        } catch (waErr: any) {
          console.error('WhatsApp fee receipt failed:', waErr);
          toast.success('Payment recorded');
          toast.error('WhatsApp receipt failed');
        }
      } else {
        toast.success('Payment recorded');
      }

      setPayDialog((p) => ({ ...p, open: false }));
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to record payment');
    }
  };

  const enrollBaseAmount = Math.max((parseFloat(enrollDialog.totalFee) || 0) - (parseFloat(enrollDialog.discount) || 0), 0);
  const enrollProcessingCharge = enrollDialog.payMode === 'Bajaj EMI'
    ? Math.max(parseFloat(enrollDialog.processingCharge) || 0, 0)
    : 0;
  const enrollPayableAmount = enrollBaseAmount + enrollProcessingCharge;
  const enrollEmiMonths = Math.max(parseInt(enrollDialog.emiMonths || '1', 10) || 1, 1);
  const enrollFirstEmiAmount = enrollDialog.payMode === 'Bajaj EMI'
    ? Number((enrollPayableAmount / enrollEmiMonths).toFixed(2))
    : 0;
  const selectedEnrollOffering = enrollDialog.parentComboId
    ? { mode: 'course' as const, course: getCourseOptionById(enrollDialog.courseId), combo: null }
    : getSelectedCourseOrCombo(enrollDialog.courseId);
  const selectedEnrollStudent = useMemo(
    () => students.find((student) => student.id === enrollDialog.studentId) || null,
    [students, enrollDialog.studentId]
  );
  const selectedEnrollCourseBatches = useMemo(() => {
    if (!enrollDialog.courseId) return [] as typeof batches;

    if (enrollDialog.parentComboId) {
      return getCourseBatches(enrollDialog.courseId);
    }

    return selectedEnrollOffering.mode === 'course' && selectedEnrollOffering.course
      ? getCourseBatches(selectedEnrollOffering.course.id)
      : [];
  }, [enrollDialog.courseId, enrollDialog.parentComboId, selectedEnrollOffering, batches]);
  const selectedEnrollAvailableCourses = useMemo(
    () => getAvailableCoursesForStudent(selectedEnrollStudent?.enrollments || []),
    [selectedEnrollStudent, courses]
  );
  const selectedPayCourseOption = useMemo(
    () => payDialog.courseOptions.find((option) => option.id === payDialog.selectedCourseId) || null,
    [payDialog.courseOptions, payDialog.selectedCourseId]
  );
  const enrollCourse = selectedEnrollOffering.course;
  const enrollCourseTaxType = selectedEnrollOffering.mode === 'combo' ? 'none' : (enrollCourse?.tax_type || 'none');
  const enrollCourseTaxAmount = selectedEnrollOffering.mode === 'combo' ? 0 : (enrollCourse?.tax_amount ?? 0);
  const enrollCourseBasePrice = selectedEnrollOffering.mode === 'combo'
    ? (selectedEnrollOffering.combo?.price || 0)
    : (enrollCourse?.fee ?? 0);

  const handleSendFeeReminder = async (student: StudentAdmission, enroll: StudentEnrollment) => {
    try {
      if (!student.phone) {
        toast.error('Student phone number is missing');
        return;
      }

      await sendFeeReminder({
        to: student.phone,
        studentName: student.full_name,
        courseName: enroll.course_name,
        dueAmount: enroll.remaining ?? 0,
        dueDate: enroll.due_date ?? null,
      });

      toast.success('WhatsApp fee reminder sent');
    } catch (err: any) {
      toast.error(err.message || 'Failed to send WhatsApp reminder');
    }
  };

  const handleStatusChange = async (enrollmentId: string, status: string) => {
    try {
      await admissionService.updateEnrollmentStatus(enrollmentId, status as any);
      toast.success('Status updated');
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status');
    }
  };

  const openEditEnrollmentDialog = (student: StudentAdmission, enrollment: StudentEnrollment) => {
    if (!enrollment.course_id) return;

    const availableCourseBatches = getCourseBatches(enrollment.course_id).map((batch) => ({
      id: batch.id,
      name: batch.name,
    }));
    const selectedBatchIds = (student.batch_ids || []).filter((batchId) =>
      availableCourseBatches.some((batch) => batch.id === batchId)
    );

    setEditEnrollmentDialog({
      open: true,
      enrollmentId: enrollment.id,
      studentId: student.id,
      studentName: student.full_name,
      courseId: enrollment.course_id,
      courseName: enrollment.course_name,
      comboName: enrollment.combo_name || '',
      batchIds: selectedBatchIds,
      scopeBatchIds: availableCourseBatches.map((batch) => batch.id),
      availableBatches: availableCourseBatches,
    });
  };

  const handleSaveEnrollmentEdit = async () => {
    if (!user?.organizationId || !editEnrollmentDialog.studentId) return;

    if (editEnrollmentDialog.availableBatches.length > 0 && editEnrollmentDialog.batchIds.length === 0) {
      toast.error('Please select at least one batch for this course');
      return;
    }

    setSavingEnrollmentEdit(true);
    try {
      await admissionService.updateEnrollmentBatches(
        user.organizationId,
        editEnrollmentDialog.studentId,
        editEnrollmentDialog.batchIds,
        editEnrollmentDialog.scopeBatchIds
      );
      toast.success('Enrollment batches updated');
      setEditEnrollmentDialog((prev) => ({ ...prev, open: false }));
      loadData();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update enrollment');
    } finally {
      setSavingEnrollmentEdit(false);
    }
  };

  const openDeleteEnrollmentDialog = (student: StudentAdmission, enrollment: StudentEnrollment) => {
    setDeleteEnrollmentDialog({
      open: true,
      enrollmentId: enrollment.id,
      studentId: student.id,
      studentName: student.full_name,
      courseName: enrollment.course_name,
      comboName: enrollment.combo_name || '',
    });
  };

  const handleDeleteEnrollment = async () => {
    if (!user?.organizationId || !deleteEnrollmentDialog.studentId || !deleteEnrollmentDialog.enrollmentId) return;

    setDeletingEnrollment(true);
    try {
      await admissionService.deleteEnrollment(
        user.organizationId,
        deleteEnrollmentDialog.studentId,
        deleteEnrollmentDialog.enrollmentId
      );
      toast.success('Enrollment deleted');
      setDeleteEnrollmentDialog((prev) => ({ ...prev, open: false }));
      loadData();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete enrollment');
    } finally {
      setDeletingEnrollment(false);
    }
  };

  const loadFeeDocumentData = async (summary: StudentEnrollment, student: StudentAdmission, comboChildren: StudentEnrollment[] = []) => {
    const courseLabel = getEnrollmentDisplayName(summary, comboChildren);
    const courseLabelById: Record<string, string> = {};
    comboChildren.forEach((item) => {
      if (item.course_id) {
        courseLabelById[item.course_id] = getEnrollmentDisplayName(item);
      }
    });
    if (summary.course_id) {
      courseLabelById[summary.course_id] = getEnrollmentDisplayName(summary, comboChildren);
    }
    const paymentId = summary.payment_id;
    const paymentRows = paymentId
      ? await fetchFeePaymentsForDocument(paymentId)
      : [] as any[];

    const payments = (paymentRows || []).map((row: any) => ({
      id: row.id,
      amount: Number(row.amount || 0),
      date: row.date,
      mode: row.mode || 'N/A',
      courseId: row.course_id || null,
      courseLabel: row.course_id ? (courseLabelById[row.course_id] || courseLabel) : courseLabel,
    }));

    return {
      id: summary.id,
      studentName: student.full_name,
      studentNumber: student.student_number || '—',
      courseLabel,
      batchName: student.batch_name || '—',
      totalFee: Number(summary.total_fee || summary.course_fee || 0),
      discountAmount: Number(summary.discount_amount || 0),
      finalAmount: Number(summary.final_amount || summary.total_fee || summary.course_fee || 0),
      amountPaid: Number(summary.amount_paid || 0),
      remaining: Number(summary.remaining || 0),
      dueDate: summary.due_date || null,
      payments,
    };
  };

  const downloadInvoiceForEnrollment = async (summary: StudentEnrollment, student: StudentAdmission, comboChildren: StudentEnrollment[] = []) => {
    try {
      const fee = await loadFeeDocumentData(summary, student, comboChildren);
      const invoiceNo = `IN-${String(fee.id).replace(/[^A-Za-z0-9]/g, '').slice(-8).toUpperCase() || 'NA'}`;
      const generatedDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invoice - ${fee.studentName}</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: Arial, sans-serif; padding: 28px; color: #222; background: #fff; }
        .header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #333; padding-bottom:16px; margin-bottom:20px; }
        .header img { max-width:120px; max-height:80px; object-fit:contain; }
        .org { text-align:right; line-height:1.4; }
        .title { text-align:center; font-size:20px; font-weight:700; margin-bottom:16px; letter-spacing:1px; }
        .meta { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:18px; }
        .box { border:1px solid #ddd; padding:12px; border-radius:6px; }
        table { width:100%; border-collapse:collapse; margin-top:8px; }
        th, td { border:1px solid #ddd; padding:10px; font-size:12px; }
        th { background:#f4f4f5; text-align:left; }
        td.right { text-align:right; }
        .footer { margin-top:20px; display:flex; justify-content:space-between; font-size:11px; color:#555; }
      </style></head><body>
      <div class="header">
        <div>${orgInfo.logoDataUrl ? `<img src="${orgInfo.logoDataUrl}" alt="Logo" />` : ''}</div>
        <div class="org">
          <div style="font-size:18px;font-weight:700;">${orgInfo.name || 'Organization'}</div>
          ${orgInfo.address ? `<div>${orgInfo.address}</div>` : ''}
          ${orgInfo.phone ? `<div>${orgInfo.phone}</div>` : ''}
          ${orgInfo.email ? `<div>${orgInfo.email}</div>` : ''}
        </div>
      </div>
      <div class="title">INVOICE</div>
      <div class="meta">
        <div class="box">
          <div><strong>Invoice No:</strong> ${invoiceNo}</div>
          <div><strong>Date:</strong> ${generatedDate}</div>
          <div><strong>Student:</strong> ${fee.studentName}</div>
          <div><strong>Student ID:</strong> ${fee.studentNumber}</div>
        </div>
        <div class="box">
          <div><strong>Program:</strong> ${fee.courseLabel}</div>
          <div><strong>Batch:</strong> ${fee.batchName}</div>
          <div><strong>Due Date:</strong> ${fee.dueDate ? new Date(fee.dueDate).toLocaleDateString('en-IN') : '—'}</div>
        </div>
      </div>
      <table>
        <thead><tr><th>Description</th><th class="right">Amount</th></tr></thead>
        <tbody>
          <tr><td>Fee for ${fee.courseLabel}</td><td class="right">${fmt(fee.totalFee)}</td></tr>
          <tr><td>Discount</td><td class="right">${fee.discountAmount > 0 ? `-${fmt(fee.discountAmount)}` : '—'}</td></tr>
          <tr><td><strong>Final Amount</strong></td><td class="right"><strong>${fmt(fee.finalAmount)}</strong></td></tr>
          <tr><td>Amount Paid</td><td class="right">${fmt(fee.amountPaid)}</td></tr>
          <tr><td><strong>Balance Due</strong></td><td class="right"><strong>${fmt(fee.remaining)}</strong></td></tr>
        </tbody>
      </table>
      ${fee.payments.length > 0 ? `<table><thead><tr><th>#</th><th>Date</th><th>Mode</th><th class="right">Amount Paid</th></tr></thead><tbody>${fee.payments.map((payment, index) => `<tr><td>${index + 1}</td><td>${new Date(payment.date).toLocaleDateString('en-IN')}</td><td>${payment.mode}</td><td class="right">${fmt(payment.amount)}</td></tr>`).join('')}</tbody></table>` : ''}
      <div class="footer"><span>This is a system-generated invoice.</span><span>Authorised Signatory</span></div>
      </body></html>`;

      await downloadHtmlAsPdf(html, `${invoiceNo}-${fee.studentName}-invoice.pdf`);
    } catch (error) {
      console.error('Failed to download invoice:', error);
      toast.error('Failed to download invoice');
    }
  };

  const downloadReceiptForEnrollment = async (summary: StudentEnrollment, student: StudentAdmission, comboChildren: StudentEnrollment[] = []) => {
    try {
      const fee = await loadFeeDocumentData(summary, student, comboChildren);
      const latestPayment = fee.payments[fee.payments.length - 1];
      if (!latestPayment) {
        toast.error('No payment recorded yet for this item');
        return;
      }

      const receiptNo = `RE-${String(latestPayment.id).replace(/[^A-Za-z0-9]/g, '').slice(-8).toUpperCase() || 'NA'}`;
      const invoiceNo = `IN-${String(fee.id).replace(/[^A-Za-z0-9]/g, '').slice(-8).toUpperCase() || 'NA'}`;
      const paidBefore = fee.payments.slice(0, -1).reduce((sum, payment) => sum + payment.amount, 0);
      const paidAfter = paidBefore + latestPayment.amount;
      const remaining = Math.max(fee.finalAmount - paidAfter, 0);
      const receiptCourseLabel = latestPayment.courseLabel || fee.courseLabel;

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Receipt - ${fee.studentName}</title>
      <style>
        * { box-sizing:border-box; }
        body { font-family: Arial, sans-serif; padding: 28px; color:#222; background:#fff; }
        .header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #333; padding-bottom:16px; margin-bottom:20px; }
        .header img { max-width:120px; max-height:80px; object-fit:contain; }
        .org { text-align:right; line-height:1.4; }
        .title { text-align:center; font-size:20px; font-weight:700; margin-bottom:16px; letter-spacing:1px; }
        .meta { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:18px; }
        .box { border:1px solid #ddd; padding:12px; border-radius:6px; }
        table { width:100%; border-collapse:collapse; margin-top:8px; }
        th, td { border:1px solid #ddd; padding:10px; font-size:12px; }
        th { background:#f4f4f5; text-align:left; }
        td.right { text-align:right; }
      </style></head><body>
      <div class="header">
        <div>${orgInfo.logoDataUrl ? `<img src="${orgInfo.logoDataUrl}" alt="Logo" />` : ''}</div>
        <div class="org">
          <div style="font-size:18px;font-weight:700;">${orgInfo.name || 'Organization'}</div>
          ${orgInfo.address ? `<div>${orgInfo.address}</div>` : ''}
          ${orgInfo.phone ? `<div>${orgInfo.phone}</div>` : ''}
          ${orgInfo.email ? `<div>${orgInfo.email}</div>` : ''}
        </div>
      </div>
      <div class="title">RECEIPT</div>
      <div class="meta">
        <div class="box">
          <div><strong>Receipt No:</strong> ${receiptNo}</div>
          <div><strong>Invoice No:</strong> ${invoiceNo}</div>
          <div><strong>Date:</strong> ${new Date(latestPayment.date).toLocaleDateString('en-IN')}</div>
          <div><strong>Student:</strong> ${fee.studentName}</div>
        </div>
        <div class="box">
          <div><strong>Program:</strong> ${receiptCourseLabel}</div>
          <div><strong>Batch:</strong> ${fee.batchName}</div>
          <div><strong>Mode:</strong> ${latestPayment.mode}</div>
        </div>
      </div>
      <table>
        <thead><tr><th>Description</th><th class="right">Amount</th></tr></thead>
        <tbody>
          <tr><td>Payment received for ${receiptCourseLabel}</td><td class="right">${fmt(latestPayment.amount)}</td></tr>
          <tr><td>Total Paid Till Date</td><td class="right">${fmt(paidAfter)}</td></tr>
          <tr><td><strong>Balance Due</strong></td><td class="right"><strong>${fmt(remaining)}</strong></td></tr>
        </tbody>
      </table>
      </body></html>`;

      await downloadHtmlAsPdf(html, `${receiptNo}-${fee.studentName}-receipt.pdf`);
    } catch (error) {
      console.error('Failed to download receipt:', error);
      toast.error('Failed to download receipt');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Stats
  // ─────────────────────────────────────────────────────────────────────────

  const totalStudents     = students.length;
  const totalEnrollments  = students.reduce((sum, student) => {
    const grouped = getEnrollmentGroups(student.enrollments || []);
    return sum + grouped.standalone.length + grouped.comboGroups.reduce((groupSum, group) => groupSum + group.children.length, 0);
  }, 0);
  const activeEnrollments = students.reduce((s, x) => s + (x.enrollments?.filter((e) => e.status === 'active').length || 0), 0);
  const totalOutstanding  = students.reduce((sum, student) => {
    const grouped = getEnrollmentGroups(student.enrollments || []);
    const summaries = [
      ...grouped.comboGroups.map((group) => summarizeComboEnrollment(group)),
      ...grouped.standalone,
    ];
    return sum + summaries.reduce((inner, enrollment) => inner + (enrollment.remaining || 0), 0);
  }, 0);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
          Admission Management
        </h1>
        <p className="text-muted-foreground mt-1">
          Track enrolled students, course registrations, and fee balances
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: <Users className="w-5 h-5 text-blue-600" />, label: 'Total Students',     value: totalStudents,    color: 'bg-blue-500/10' },
          { icon: <BookOpen className="w-5 h-5 text-violet-600" />, label: 'Total Enrollments', value: totalEnrollments, color: 'bg-violet-500/10' },
          { icon: <CheckCircle className="w-5 h-5 text-emerald-600" />, label: 'Active Courses',    value: activeEnrollments, color: 'bg-emerald-500/10' },
          { icon: <TrendingDown className="w-5 h-5 text-amber-600" />, label: 'Outstanding Fees',   value: fmt(totalOutstanding), color: 'bg-amber-500/10' },
        ].map((stat) => (
          <Card key={stat.label} className="border shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold text-foreground mt-0.5">{stat.value}</p>
                </div>
                <div className={`w-10 h-10 rounded-xl ${stat.color} flex items-center justify-center`}>
                  {stat.icon}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search students, mobile, parent mobile..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Student List */}
      {loading ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground">Loading…</div>
      ) : filteredStudents.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
          <GraduationCap className="w-12 h-12 opacity-30" />
          <p>No students found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredStudents.map((student) => {
            const isExpanded = expanded.has(student.id);
            const studentEnrollmentGroups = getEnrollmentGroups(student.enrollments || []);
            const studentEnrollmentSummaries = [
              ...studentEnrollmentGroups.comboGroups.map((group) => summarizeComboEnrollment(group)),
              ...studentEnrollmentGroups.standalone,
            ];
            const availableAdditionalCourses = getAvailableCoursesForStudent(student.enrollments || []);
            const assignableComboGroup = studentEnrollmentGroups.comboGroups.length > 0 && availableAdditionalCourses.length > 0
              ? studentEnrollmentGroups.comboGroups[0]
              : null;
            const assignableComboSummary = assignableComboGroup
              ? summarizeComboEnrollment(assignableComboGroup)
              : null;
            const isComboStudent = studentEnrollmentGroups.comboGroups.length > 0;
            const totalPaid = studentEnrollmentSummaries.reduce((sum, enrollment) => sum + (enrollment.amount_paid || 0), 0);
            const totalRem  = studentEnrollmentSummaries.reduce((sum, enrollment) => sum + (enrollment.remaining || 0), 0);

            return (
              <Card key={student.id} className="border shadow-sm overflow-hidden">
                {/* Student Header Row */}
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/40 transition-colors"
                  onClick={() => toggleExpand(student.id)}
                >
                  <button className="text-muted-foreground shrink-0">
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>

                  {/* Avatar */}
                  {student.avatar_url ? (
                    <img
                      src={student.avatar_url}
                      alt={student.full_name}
                      className="w-9 h-9 rounded-full object-cover shrink-0 border"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 font-semibold text-primary text-sm">
                      {(student.full_name || '?').charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground">{student.full_name}</span>
                      {student.student_number && (
                        <Badge variant="outline" className="text-xs font-mono text-violet-700 border-violet-300 bg-violet-50">
                          <Hash className="w-3 h-3 mr-1" />{student.student_number}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{student.email}</p>
                  </div>

                  {/* Summary */}
                  <div className="hidden sm:flex items-center gap-6 text-sm shrink-0">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Batch</p>
                      <p className="font-semibold text-indigo-600">{student.batch_name || '—'}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Registered</p>
                      <p className="font-semibold text-slate-700">
                        {new Date(student.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Courses</p>
                      <p className="font-semibold">{studentEnrollmentGroups.standalone.length + studentEnrollmentGroups.comboGroups.reduce((sum, group) => sum + group.children.length, 0)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Paid</p>
                      <p className="font-semibold text-emerald-600">{fmt(totalPaid)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Outstanding</p>
                      <p className={`font-semibold ${totalRem > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{fmt(totalRem)}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs h-8"
                      onClick={(e) => { e.stopPropagation(); openEnrollDialog(student); }}
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Course
                    </Button>
                    {isComboStudent && assignableComboSummary && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs h-8"
                        onClick={(e) => { e.stopPropagation(); openEnrollDialog(student, assignableComboSummary); }}
                      >
                        <Plus className="w-3.5 h-3.5" /> Assign Course
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1.5 text-xs h-8"
                      onClick={(e) => { e.stopPropagation(); generateStudentReport(student); }}
                    >
                      <FileText className="w-3.5 h-3.5" /> Report
                    </Button>
                  </div>

                  {/* Mobile add button */}
                  <div className="sm:hidden flex gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 text-xs h-8"
                      onClick={(e) => { e.stopPropagation(); openEnrollDialog(student); }}
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                    {isComboStudent && assignableComboSummary && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 text-xs h-8"
                        onClick={(e) => { e.stopPropagation(); openEnrollDialog(student, assignableComboSummary); }}
                      >
                        <BookOpen className="w-3 h-3" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1 text-xs h-8"
                      onClick={(e) => { e.stopPropagation(); generateStudentReport(student); }}
                    >
                      <FileText className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                {/* Expanded Detail with Tabs */}
                {isExpanded && (
                  <div className="border-t bg-muted/20">
                    <Tabs defaultValue="profile" className="w-full">
                      <div className="px-4 pt-3">
                        <TabsList>
                          <TabsTrigger value="profile" className="gap-1.5">
                            <User className="w-3.5 h-3.5" /> Profile
                          </TabsTrigger>
                          <TabsTrigger value="enrollments" className="gap-1.5">
                            <BookOpen className="w-3.5 h-3.5" /> Enrollments
                          </TabsTrigger>
                        </TabsList>
                      </div>

                      {/* ── Profile Tab ── */}
                      <TabsContent value="profile" className="px-4 pb-4 mt-0">
                        {detailsLoading.has(student.id) ? (
                          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                            Loading student details…
                          </div>
                        ) : (() => {
                          const detail = studentDetails[student.id];
                          const isEditing = editingStudent === student.id;
                          const photoUrl = detail?.photo_url || student.avatar_url;

                          return (
                            <div className="space-y-4 pt-3">
                              {/* Action buttons */}
                              <div className="flex justify-end gap-2">
                                {isEditing ? (
                                  <>
                                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={cancelEditing}>
                                      <X className="w-3.5 h-3.5" /> Cancel
                                    </Button>
                                    <Button
                                      size="sm"
                                      className="h-8 text-xs gap-1"
                                      onClick={() => saveStudentDetails(student.id)}
                                      disabled={savingDetail}
                                    >
                                      <Save className="w-3.5 h-3.5" /> {savingDetail ? 'Saving…' : 'Save'}
                                    </Button>
                                  </>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 text-xs gap-1"
                                    onClick={() => startEditing(student, detail)}
                                  >
                                    <Pencil className="w-3.5 h-3.5" /> Edit Details
                                  </Button>
                                )}
                              </div>

                              {/* Photo + Basic Info Row */}
                              <div className="flex flex-col sm:flex-row gap-6">
                                {/* Photo Section */}
                                <div className="flex flex-col items-center gap-3 shrink-0">
                                  <div className="relative group">
                                    {photoUrl ? (
                                      <img
                                        src={photoUrl}
                                        alt={student.full_name}
                                        className="w-28 h-28 rounded-xl object-cover border shadow-sm"
                                      />
                                    ) : (
                                      <div className="w-28 h-28 rounded-xl bg-primary/10 flex items-center justify-center border">
                                        <User className="w-12 h-12 text-primary/40" />
                                      </div>
                                    )}
                                    {isEditing && (
                                      <button
                                        className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                        onClick={() => {
                                          photoInputRef.current?.setAttribute('data-student-id', student.id);
                                          photoInputRef.current?.click();
                                        }}
                                      >
                                        <Upload className="w-6 h-6 text-white" />
                                      </button>
                                    )}
                                    {uploadingPhoto === student.id && (
                                      <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center">
                                        <span className="text-white text-xs animate-pulse">Uploading…</span>
                                      </div>
                                    )}
                                  </div>
                                  {photoUrl && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-xs gap-1"
                                      onClick={() => handlePhotoDownload(photoUrl, student.full_name)}
                                    >
                                      <Download className="w-3 h-3" /> Download Photo
                                    </Button>
                                  )}
                                  {isEditing && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-xs gap-1"
                                      onClick={() => {
                                        photoInputRef.current?.setAttribute('data-student-id', student.id);
                                        photoInputRef.current?.click();
                                      }}
                                    >
                                      <Upload className="w-3 h-3" /> Upload Photo
                                    </Button>
                                  )}
                                </div>

                                {/* Basic Profile Fields */}
                                <div className="flex-1 space-y-4">
                                  {/* Personal Information */}
                                  <div>
                                    <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
                                      <User className="w-4 h-4 text-blue-600" /> Personal Information
                                    </h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                      {isEditing ? (
                                        <>
                                          <div className="space-y-1">
                                            <Label className="text-xs">Full Name *</Label>
                                            <Input className="h-8 text-sm" value={editForm.full_name || ''} onChange={(e) => setEditForm((p: any) => ({ ...p, full_name: e.target.value }))} />
                                          </div>
                                          <div className="space-y-1">
                                            <Label className="text-xs">Email</Label>
                                            <Input className="h-8 text-sm" value={editForm.email || ''} disabled />
                                          </div>
                                          <div className="space-y-1">
                                            <Label className="text-xs">Gender *</Label>
                                            <Select value={editForm.gender || ''} onValueChange={(v) => setEditForm((p: any) => ({ ...p, gender: v }))}>
                                              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select…" /></SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="male">Male</SelectItem>
                                                <SelectItem value="female">Female</SelectItem>
                                                <SelectItem value="other">Other</SelectItem>
                                              </SelectContent>
                                            </Select>
                                          </div>
                                          <div className="space-y-1">
                                            <Label className="text-xs">Date of Birth *</Label>
                                            <Input className="h-8 text-sm" type="date" value={editForm.date_of_birth || ''} onChange={(e) => setEditForm((p: any) => ({ ...p, date_of_birth: e.target.value }))} />
                                          </div>
                                          <div className="space-y-1">
                                            <Label className="text-xs">Aadhaar No.</Label>
                                            <Input className="h-8 text-sm" value={editForm.aadhaar || ''} onChange={(e) => setEditForm((p: any) => ({ ...p, aadhaar: e.target.value }))} />
                                          </div>
                                          <div className="space-y-1">
                                            <Label className="text-xs">Student No.</Label>
                                            <Input className="h-8 text-sm font-mono" value={student.student_number || '—'} disabled />
                                          </div>
                                        </>
                                      ) : (
                                        <>
                                          <DetailField label="Full Name" value={student.full_name} />
                                          <DetailField label="Email" value={student.email} />
                                          <DetailField label="Gender" value={detail?.gender ? detail.gender.charAt(0).toUpperCase() + detail.gender.slice(1) : '—'} />
                                          <DetailField label="Date of Birth" value={detail?.date_of_birth ? new Date(detail.date_of_birth).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'} />
                                          <DetailField label="Aadhaar No." value={detail?.aadhaar || '—'} />
                                          <DetailField label="Student No." value={student.student_number || '—'} mono />
                                          <DetailField label="Registration Date" value={new Date(student.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} />
                                        </>
                                      )}
                                    </div>
                                  </div>

                                  {/* Contact Information */}
                                  <div>
                                    <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
                                      <Phone className="w-4 h-4 text-green-600" /> Contact Information
                                    </h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                      {isEditing ? (
                                        <>
                                          <div className="space-y-1">
                                            <Label className="text-xs">Phone</Label>
                                            <Input className="h-8 text-sm" value={editForm.phone || ''} onChange={(e) => setEditForm((p: any) => ({ ...p, phone: e.target.value }))} />
                                          </div>
                                          <div className="space-y-1">
                                            <Label className="text-xs">Mobile *</Label>
                                            <Input className="h-8 text-sm" value={editForm.mobile || ''} onChange={(e) => setEditForm((p: any) => ({ ...p, mobile: e.target.value }))} />
                                          </div>
                                          <div className="space-y-1">
                                            <Label className="text-xs">WhatsApp</Label>
                                            <Input className="h-8 text-sm" value={editForm.whatsapp || ''} onChange={(e) => setEditForm((p: any) => ({ ...p, whatsapp: e.target.value }))} />
                                          </div>
                                          <div className="space-y-1">
                                            <Label className="text-xs">Landline</Label>
                                            <Input className="h-8 text-sm" value={editForm.landline || ''} onChange={(e) => setEditForm((p: any) => ({ ...p, landline: e.target.value }))} />
                                          </div>
                                        </>
                                      ) : (
                                        <>
                                          <DetailField label="Phone" value={student.phone || '—'} />
                                          <DetailField label="Mobile" value={detail?.mobile || '—'} />
                                          <DetailField label="WhatsApp" value={detail?.whatsapp || '—'} />
                                          <DetailField label="Landline" value={detail?.landline || '—'} />
                                        </>
                                      )}
                                    </div>
                                  </div>

                                  {/* Address */}
                                  <div>
                                    <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
                                      <MapPin className="w-4 h-4 text-red-500" /> Address
                                    </h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                      {isEditing ? (
                                        <>
                                          <div className="space-y-1 sm:col-span-2 lg:col-span-3">
                                            <Label className="text-xs">Address</Label>
                                            <Textarea className="text-sm min-h-[60px]" value={editForm.address || ''} onChange={(e) => setEditForm((p: any) => ({ ...p, address: e.target.value }))} />
                                          </div>
                                          <div className="space-y-1">
                                            <Label className="text-xs">City *</Label>
                                            <Input className="h-8 text-sm" value={editForm.city || ''} onChange={(e) => setEditForm((p: any) => ({ ...p, city: e.target.value }))} />
                                          </div>
                                          <div className="space-y-1">
                                            <Label className="text-xs">State *</Label>
                                            <Input className="h-8 text-sm" value={editForm.state || ''} onChange={(e) => setEditForm((p: any) => ({ ...p, state: e.target.value }))} />
                                          </div>
                                          <div className="space-y-1">
                                            <Label className="text-xs">Pincode *</Label>
                                            <Input className="h-8 text-sm" value={editForm.pincode || ''} onChange={(e) => setEditForm((p: any) => ({ ...p, pincode: e.target.value }))} />
                                          </div>
                                        </>
                                      ) : (
                                        <>
                                          <DetailField label="Address" value={detail?.address || '—'} wide />
                                          <DetailField label="City" value={detail?.city || '—'} />
                                          <DetailField label="State" value={detail?.state || '—'} />
                                          <DetailField label="Pincode" value={detail?.pincode || '—'} />
                                        </>
                                      )}
                                    </div>
                                  </div>

                                  {/* Education */}
                                  <div>
                                    <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
                                      <GraduationCap className="w-4 h-4 text-violet-600" /> Education
                                    </h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                      {isEditing ? (
                                        <>
                                          <div className="space-y-1">
                                            <Label className="text-xs">Qualification *</Label>
                                            <Input className="h-8 text-sm" value={editForm.qualification || ''} onChange={(e) => setEditForm((p: any) => ({ ...p, qualification: e.target.value }))} />
                                          </div>
                                          <div className="space-y-1">
                                            <Label className="text-xs">Graduation Year</Label>
                                            <Input className="h-8 text-sm" value={editForm.graduation_year || ''} onChange={(e) => setEditForm((p: any) => ({ ...p, graduation_year: e.target.value }))} />
                                          </div>
                                          <div className="space-y-1">
                                            <Label className="text-xs">Graduation College</Label>
                                            <Input className="h-8 text-sm" value={editForm.graduation_college || ''} onChange={(e) => setEditForm((p: any) => ({ ...p, graduation_college: e.target.value }))} />
                                          </div>
                                          <div className="space-y-1">
                                            <Label className="text-xs">Admission Source</Label>
                                            <Select value={editForm.admission_source || ''} onValueChange={(v) => setEditForm((p: any) => ({ ...p, admission_source: v }))}>
                                              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select…" /></SelectTrigger>
                                              <SelectContent>
                                                {admissionSources.map((s) => (
                                                  <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                                                ))}
                                                {admissionSources.length === 0 && (
                                                  <SelectItem value="__none__" disabled>No sources available</SelectItem>
                                                )}
                                              </SelectContent>
                                            </Select>
                                          </div>
                                          <div className="space-y-1">
                                            <Label className="text-xs">Reference</Label>
                                            <Select
                                              value={editForm.reference || 'none'}
                                              onValueChange={(value) => {
                                                if (value === 'add-new-reference') {
                                                  setShowAddReferenceInput(true);
                                                  return;
                                                }
                                                setEditForm((p: any) => ({ ...p, reference: value === 'none' ? '' : value }));
                                                setShowAddReferenceInput(false);
                                              }}
                                            >
                                              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select reference" /></SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="none">No Reference</SelectItem>
                                                {references.map((r) => (
                                                  <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>
                                                ))}
                                                <SelectItem value="add-new-reference">+ Add New Reference</SelectItem>
                                              </SelectContent>
                                            </Select>
                                            {showAddReferenceInput && (
                                              <div className="flex gap-2 mt-2">
                                                <Input
                                                  className="h-8 text-sm"
                                                  value={newReferenceName}
                                                  onChange={(e) => setNewReferenceName(e.target.value)}
                                                  placeholder="Enter new reference"
                                                />
                                                <Button type="button" variant="outline" size="sm" onClick={handleAddReference}>Add</Button>
                                              </div>
                                            )}
                                          </div>
                                        </>
                                      ) : (
                                        <>
                                          <DetailField label="Qualification" value={detail?.qualification || '—'} />
                                          <DetailField label="Graduation Year" value={detail?.graduation_year || '—'} />
                                          <DetailField label="Graduation College" value={detail?.graduation_college || '—'} />
                                          <DetailField label="Admission Source" value={detail?.admission_source || '—'} />
                                          <DetailField label="Reference" value={detail?.reference || '—'} />
                                        </>
                                      )}
                                    </div>
                                  </div>

                                  {/* Parent / Guardian */}
                                  <div>
                                    <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
                                      <Users className="w-4 h-4 text-orange-600" /> Parent / Guardian
                                    </h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                      {isEditing ? (
                                        <>
                                          <div className="space-y-1">
                                            <Label className="text-xs">Father's Name</Label>
                                            <Input className="h-8 text-sm" value={editForm.father_name || ''} onChange={(e) => setEditForm((p: any) => ({ ...p, father_name: e.target.value }))} />
                                          </div>
                                          <div className="space-y-1">
                                            <Label className="text-xs">Mother's Name</Label>
                                            <Input className="h-8 text-sm" value={editForm.mother_name || ''} onChange={(e) => setEditForm((p: any) => ({ ...p, mother_name: e.target.value }))} />
                                          </div>
                                          <div className="space-y-1">
                                            <Label className="text-xs">Parent Mobile *</Label>
                                            <Input className="h-8 text-sm" value={editForm.parent_mobile || ''} onChange={(e) => setEditForm((p: any) => ({ ...p, parent_mobile: e.target.value }))} />
                                          </div>
                                          <div className="space-y-1">
                                            <Label className="text-xs">Parent Email</Label>
                                            <Input className="h-8 text-sm" value={editForm.parent_email || ''} onChange={(e) => setEditForm((p: any) => ({ ...p, parent_email: e.target.value }))} />
                                          </div>
                                        </>
                                      ) : (
                                        <>
                                          <DetailField label="Father's Name" value={detail?.father_name || '—'} />
                                          <DetailField label="Mother's Name" value={detail?.mother_name || '—'} />
                                          <DetailField label="Parent Mobile" value={detail?.parent_mobile || '—'} />
                                          <DetailField label="Parent Email" value={detail?.parent_email || '—'} />
                                        </>
                                      )}
                                    </div>
                                  </div>

                                  {/* Remarks */}
                                  <div>
                                    <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
                                      <FileText className="w-4 h-4 text-gray-500" /> Remarks
                                    </h4>
                                    {isEditing ? (
                                      <Textarea
                                        className="text-sm min-h-[60px]"
                                        placeholder="Any notes or remarks…"
                                        value={editForm.remarks || ''}
                                        onChange={(e) => setEditForm((p: any) => ({ ...p, remarks: e.target.value }))}
                                      />
                                    ) : (
                                      <p className="text-sm text-muted-foreground">{detail?.remarks || '—'}</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </TabsContent>

                      {/* ── Enrollments Tab ── */}
                      <TabsContent value="enrollments" className="mt-0">
                        {(!student.enrollments || student.enrollments.length === 0) ? (
                          <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                            <AlertCircle className="w-4 h-4" />
                            No course enrollments yet. Click <strong className="text-foreground">Add Course</strong> to enroll.
                          </div>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/30">
                                <TableHead>Enrollment ID</TableHead>
                                <TableHead>Course</TableHead>
                                <TableHead className="text-right">Total Fee</TableHead>
                                <TableHead className="text-right">Discount</TableHead>
                                <TableHead className="text-right">Paid</TableHead>
                                <TableHead className="text-right">Remaining</TableHead>
                                <TableHead>Due Date</TableHead>
                                <TableHead>Payment</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {(() => {
                                const groupedEnrollments = getEnrollmentGroups(student.enrollments || []);
                                return (
                                  <>
                                    {groupedEnrollments.comboGroups.map((group) => {
                                      const comboSummary = summarizeComboEnrollment(group);
                                      const missingCourses = getAvailableCoursesForStudent(student.enrollments || []);

                                      return (
                                        <Fragment key={`combo-group-${group.comboId || group.comboName}`}>
                                          <TableRow key={`combo-${group.comboId || group.comboName}`} className="bg-violet-50/50">
                                            <TableCell>
                                              <Badge variant="outline" className="font-mono text-[10px] bg-violet-500/10 text-violet-700 border-violet-300">
                                                COMBO
                                              </Badge>
                                            </TableCell>
                                            <TableCell className="font-medium">
                                              <div className="flex flex-col gap-1">
                                                <span>{group.comboName}</span>
                                                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                                  <span>{group.children.length} course{group.children.length === 1 ? '' : 's'} assigned</span>
                                                  {missingCourses.length > 0 && <span>{missingCourses.length} more course{missingCourses.length === 1 ? '' : 's'} available</span>}
                                                  {group.children.length === 0 && <span>No courses assigned yet</span>}
                                                </div>
                                              </div>
                                            </TableCell>
                                            <TableCell className="text-right">{fmt(comboSummary.total_fee ?? comboSummary.course_fee)}</TableCell>
                                            <TableCell className="text-right text-emerald-600">
                                              {(comboSummary.discount_amount ?? 0) > 0 ? `-${fmt(comboSummary.discount_amount!)}` : '—'}
                                            </TableCell>
                                            <TableCell className="text-right font-semibold text-emerald-600">{fmt(comboSummary.amount_paid ?? 0)}</TableCell>
                                            <TableCell className={`text-right font-semibold ${(comboSummary.remaining ?? 0) > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{fmt(comboSummary.remaining ?? 0)}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                              {comboSummary.due_date ? (
                                                <span className="flex items-center gap-1">
                                                  <Calendar className="w-3 h-3" />
                                                  {new Date(comboSummary.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                                                </span>
                                              ) : '—'}
                                            </TableCell>
                                            <TableCell>
                                              <Badge variant="outline" className={`text-xs capitalize ${payStatusStyles[comboSummary.payment_status || 'pending'] || payStatusStyles.pending}`}>
                                                {comboSummary.payment_status === 'completed' ? 'Paid' : comboSummary.payment_status === 'partial' ? 'Partial' : 'Pending'}
                                              </Badge>
                                            </TableCell>
                                            <TableCell>
                                              <Badge variant="outline" className="text-xs bg-violet-500/10 text-violet-700 border-violet-300">
                                                Combo Group
                                              </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                              <div className="flex justify-end gap-2">
                                                <Button
                                                  size="sm"
                                                  variant="outline"
                                                  className="h-7 text-xs gap-1"
                                                  onClick={() => openEnrollDialog(student, comboSummary)}
                                                >
                                                  <Plus className="w-3 h-3" /> Assign Course
                                                </Button>
                                                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => { void downloadInvoiceForEnrollment(comboSummary, student, group.children); }}>
                                                  <FileText className="w-3 h-3" /> Invoice
                                                </Button>
                                                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => { void downloadReceiptForEnrollment(comboSummary, student, group.children); }}>
                                                  <Download className="w-3 h-3" /> Receipt
                                                </Button>
                                                {(comboSummary.remaining ?? 0) > 0 && student.phone && (
                                                  <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-7 text-xs gap-1"
                                                    onClick={() => handleSendFeeReminder(student, comboSummary)}
                                                  >
                                                    <MessageCircle className="w-3 h-3" /> Remind
                                                  </Button>
                                                )}
                                                {(comboSummary.remaining ?? 0) > 0 && (
                                                  <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-7 text-xs gap-1 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                                                    onClick={() => { void openPayDialog(comboSummary, student, group.children); }}
                                                  >
                                                    <IndianRupee className="w-3 h-3" /> Pay
                                                  </Button>
                                                )}
                                              </div>
                                            </TableCell>
                                          </TableRow>

                                          {group.children.length === 0 ? (
                                            <TableRow key={`combo-empty-${group.comboId || group.comboName}`}>
                                              <TableCell />
                                              <TableCell colSpan={9} className="text-sm text-muted-foreground py-3">
                                                No courses are attached to this combo yet. Use Assign Course to add them under this combo.
                                              </TableCell>
                                            </TableRow>
                                          ) : group.children.map((enroll) => (
                                            <TableRow key={enroll.id}>
                                              <TableCell>
                                                <span className="font-mono text-xs text-indigo-600 font-semibold">
                                                  {enroll.enrollment_number}
                                                </span>
                                              </TableCell>
                                              <TableCell className="font-medium">
                                                <div className="flex items-center gap-2">
                                                  <span className="text-muted-foreground">↳</span>
                                                  <span>{enroll.course_name}</span>
                                                </div>
                                              </TableCell>
                                              <TableCell className="text-right">
                                                {fmt(enroll.total_fee ?? enroll.course_fee)}
                                                {(() => {
                                                  const c = courses.find((course) => course.id === enroll.course_id);
                                                  if (c && (c.tax_amount ?? 0) > 0) {
                                                    return <div className="text-xs text-amber-600 font-normal">+{gstLabel(c.tax_type)} ₹{(c.tax_amount!).toLocaleString('en-IN')}</div>;
                                                  }
                                                  return null;
                                                })()}
                                              </TableCell>
                                              <TableCell className="text-right text-emerald-600">
                                                {(enroll.discount_amount ?? 0) > 0 ? `-${fmt(enroll.discount_amount!)}` : '—'}
                                              </TableCell>
                                              <TableCell className="text-right font-semibold text-emerald-600">{fmt(enroll.amount_paid ?? 0)}</TableCell>
                                              <TableCell className={`text-right font-semibold ${(enroll.remaining ?? 0) > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{fmt(enroll.remaining ?? 0)}</TableCell>
                                              <TableCell className="text-sm text-muted-foreground">
                                                {enroll.due_date ? (
                                                  <span className="flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" />
                                                    {new Date(enroll.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                                                  </span>
                                                ) : '—'}
                                              </TableCell>
                                              <TableCell>
                                                <Badge variant="outline" className={`text-xs capitalize ${payStatusStyles[enroll.payment_status || 'pending'] || payStatusStyles.pending}`}>
                                                  {enroll.payment_status === 'completed' ? 'Paid' : enroll.payment_status === 'partial' ? 'Partial' : 'Pending'}
                                                </Badge>
                                              </TableCell>
                                              <TableCell>
                                                <Select value={enroll.status} onValueChange={(v) => handleStatusChange(enroll.id, v)}>
                                                  <SelectTrigger className={`h-7 text-xs w-28 border ${statusStyles[enroll.status] || ''}`}>
                                                    <SelectValue />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                    <SelectItem value="active">Active</SelectItem>
                                                    <SelectItem value="completed">Completed</SelectItem>
                                                    <SelectItem value="on_hold">On Hold</SelectItem>
                                                    <SelectItem value="dropped">Dropped</SelectItem>
                                                  </SelectContent>
                                                </Select>
                                              </TableCell>
                                              <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                  {/* <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-7 text-xs gap-1"
                                                    onClick={() => openEditEnrollmentDialog(student, enroll)}
                                                  >
                                                    <Pencil className="w-3 h-3" /> Edit
                                                  </Button> */}
                                                  <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-7 text-xs gap-1 text-rose-700 border-rose-300 hover:bg-rose-50"
                                                    onClick={() => openDeleteEnrollmentDialog(student, enroll)}
                                                  >
                                                    <Trash2 className="w-3 h-3" /> Delete
                                                  </Button>
                                                  {(enroll.remaining ?? 0) > 0 && student.phone && (
                                                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handleSendFeeReminder(student, enroll)}>
                                                      <MessageCircle className="w-3 h-3" /> Remind
                                                    </Button>
                                                  )}
                                                  {(enroll.remaining ?? 0) > 0 && (
                                                    <Button
                                                      size="sm"
                                                      variant="outline"
                                                      className="h-7 text-xs gap-1 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                                                      onClick={() => { void openPayDialog(comboSummary, student, group.children, enroll.course_id); }}
                                                    >
                                                      <IndianRupee className="w-3 h-3" /> Pay
                                                    </Button>
                                                  )}
                                                </div>
                                              </TableCell>
                                            </TableRow>
                                          ))}
                                        </Fragment>
                                      );
                                    })}

                                    {groupedEnrollments.standalone.map((enroll) => (
                                      <TableRow key={enroll.id}>
                                        <TableCell>
                                          <span className="font-mono text-xs text-indigo-600 font-semibold">
                                            {enroll.enrollment_number}
                                          </span>
                                        </TableCell>
                                        <TableCell className="font-medium">
                                          <div className="flex flex-col gap-1">
                                            <span>{enroll.course_name}</span>
                                            {enroll.combo_name && (
                                              <Badge variant="outline" className="w-fit text-[10px] bg-violet-500/10 text-violet-700 border-violet-300">
                                                Combo: {enroll.combo_name}
                                              </Badge>
                                            )}
                                          </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                          {fmt(enroll.total_fee ?? enroll.course_fee)}
                                          {(() => {
                                            const c = courses.find((course) => course.id === enroll.course_id);
                                            if (c && (c.tax_amount ?? 0) > 0) {
                                              return <div className="text-xs text-amber-600 font-normal">+{gstLabel(c.tax_type)} ₹{(c.tax_amount!).toLocaleString('en-IN')}</div>;
                                            }
                                            return null;
                                          })()}
                                        </TableCell>
                                        <TableCell className="text-right text-emerald-600">
                                          {(enroll.discount_amount ?? 0) > 0 ? `-${fmt(enroll.discount_amount!)}` : '—'}
                                        </TableCell>
                                        <TableCell className="text-right font-semibold text-emerald-600">{fmt(enroll.amount_paid ?? 0)}</TableCell>
                                        <TableCell className={`text-right font-semibold ${(enroll.remaining ?? 0) > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{fmt(enroll.remaining ?? 0)}</TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                          {enroll.due_date ? (
                                            <span className="flex items-center gap-1">
                                              <Calendar className="w-3 h-3" />
                                              {new Date(enroll.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                                            </span>
                                          ) : '—'}
                                        </TableCell>
                                        <TableCell>
                                          <Badge variant="outline" className={`text-xs capitalize ${payStatusStyles[enroll.payment_status || 'pending'] || payStatusStyles.pending}`}>
                                            {enroll.payment_status === 'completed' ? 'Paid' : enroll.payment_status === 'partial' ? 'Partial' : 'Pending'}
                                          </Badge>
                                        </TableCell>
                                        <TableCell>
                                          <Select value={enroll.status} onValueChange={(v) => handleStatusChange(enroll.id, v)}>
                                            <SelectTrigger className={`h-7 text-xs w-28 border ${statusStyles[enroll.status] || ''}`}>
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="active">Active</SelectItem>
                                              <SelectItem value="completed">Completed</SelectItem>
                                              <SelectItem value="on_hold">On Hold</SelectItem>
                                              <SelectItem value="dropped">Dropped</SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </TableCell>
                                        <TableCell className="text-right">
                                          <div className="flex justify-end gap-2">
                                            {/* <Button
                                              size="sm"
                                              variant="outline"
                                              className="h-7 text-xs gap-1"
                                              onClick={() => openEditEnrollmentDialog(student, enroll)}
                                            >
                                              <Pencil className="w-3 h-3" /> Edit
                                            </Button> */}
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="h-7 text-xs gap-1 text-rose-700 border-rose-300 hover:bg-rose-50"
                                              onClick={() => openDeleteEnrollmentDialog(student, enroll)}
                                            >
                                              <Trash2 className="w-3 h-3" /> Delete
                                            </Button>
                                            {(enroll.remaining ?? 0) > 0 && student.phone && (
                                              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handleSendFeeReminder(student, enroll)}>
                                                <MessageCircle className="w-3 h-3" /> Remind
                                              </Button>
                                            )}
                                            {(enroll.remaining ?? 0) > 0 && (
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-7 text-xs gap-1 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                                                onClick={() => { void openPayDialog(enroll, student); }}
                                              >
                                                <IndianRupee className="w-3 h-3" /> Pay
                                              </Button>
                                            )}
                                          </div>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </>
                                );
                              })()}
                            </TableBody>
                          </Table>
                        )}
                      </TabsContent>
                    </Tabs>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Enroll Dialog ── */}
      <Dialog open={enrollDialog.open} onOpenChange={(o) => setEnrollDialog((p) => ({ ...p, open: o }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              {enrollDialog.parentComboId ? 'Assign Course to Combo' : 'Add Course'} — <span className="text-primary">{enrollDialog.studentName}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Course */}
            <div className="space-y-1.5">
              <Label>Course *</Label>
              <Select value={enrollDialog.courseId} onValueChange={handleCourseChange}>
                <SelectTrigger>
                  <SelectValue placeholder={enrollDialog.parentComboId ? 'Select course to add…' : 'Select course…'} />
                </SelectTrigger>
                <SelectContent>
                  {selectedEnrollAvailableCourses.length === 0 ? (
                    <SelectItem value="__none__" disabled>
                      No courses available
                    </SelectItem>
                  ) : (
                    <>
                      {(enrollDialog.parentComboId ? selectedEnrollAvailableCourses : selectedEnrollAvailableCourses).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}{c.fee > 0 ? ` — ₹${(c.fee + (c.tax_amount ?? 0)).toLocaleString('en-IN')}` : ''}
                          {(c.tax_amount ?? 0) > 0 ? ` (${gstLabel(c.tax_type)} incl.)` : ''}
                        </SelectItem>
                      ))}
                      {!enrollDialog.parentComboId && courseCombos.map((combo) => (
                        <SelectItem key={combo.id} value={`combo:${combo.id}`}>
                          {`Combo: ${combo.name}${combo.price > 0 ? ` — ₹${combo.price.toLocaleString('en-IN')}` : ''}`}
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Batch */}
            {enrollDialog.courseId && (() => {
              if (!enrollDialog.parentComboId) {
                const selection = getSelectedCourseOrCombo(enrollDialog.courseId);
                if (selection.mode === 'combo' && selection.combo) {
                  const comboBatches = getComboMappedBatches(selection.combo);
                  return (
                    <div className="space-y-1.5">
                      <Label>Combo Batches</Label>
                      <div className="rounded-md border p-3 space-y-2 bg-muted/20">
                        <p className="text-xs text-muted-foreground">
                          Choose the combo batches to grant now. Leave this empty if you want to assign batches later.
                        </p>
                        {comboBatches.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No batches are mapped to this combo yet.</p>
                        ) : (
                          <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                            {comboBatches.map((batch) => (
                              <label key={batch.id} className="flex items-center gap-2 text-sm cursor-pointer">
                                <Checkbox
                                  checked={enrollDialog.comboBatchIds.includes(batch.id)}
                                  onCheckedChange={(checked) => setEnrollDialog((prev) => ({
                                    ...prev,
                                    comboBatchIds: checked
                                      ? Array.from(new Set([...prev.comboBatchIds, batch.id]))
                                      : prev.comboBatchIds.filter((value) => value !== batch.id),
                                  }))}
                                />
                                <span>{batch.name}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }
              }

              return selectedEnrollCourseBatches.length > 0 ? (
                <div className="space-y-1.5">
                  <Label>{enrollDialog.parentComboId ? 'Course Batches' : 'Batch'}</Label>
                  {enrollDialog.parentComboId ? (
                    <div className="rounded-md border p-3 space-y-2 bg-muted/20">
                      <p className="text-xs text-muted-foreground">
                        Choose the batches this student should access for the selected course.
                      </p>
                      <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                        {selectedEnrollCourseBatches.map((b) => (
                          <label key={b.id} className="flex items-center gap-2 text-sm cursor-pointer">
                            <Checkbox
                              checked={enrollDialog.courseBatchIds.includes(b.id)}
                              onCheckedChange={(checked) => setEnrollDialog((prev) => {
                                const nextCourseBatchIds = checked
                                  ? Array.from(new Set([...prev.courseBatchIds, b.id]))
                                  : prev.courseBatchIds.filter((value) => value !== b.id);

                                return {
                                  ...prev,
                                  courseBatchIds: nextCourseBatchIds,
                                  batchId: nextCourseBatchIds[0] || '',
                                };
                              })}
                            />
                            <span>{b.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <Select value={enrollDialog.batchId} onValueChange={(v) => setEnrollDialog((p) => ({ ...p, batchId: v }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select batch…" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedEnrollCourseBatches.map((b) => (
                          <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              ) : null;
            })()}

            {/* Fee row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Total Fee (₹) *</Label>
                <Input
                  type="number"
                  placeholder="e.g. 25000"
                  value={enrollDialog.totalFee}
                  onChange={(e) => setEnrollDialog((p) => ({ ...p, totalFee: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Discount (₹)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={enrollDialog.discount}
                  onChange={(e) => setEnrollDialog((p) => ({ ...p, discount: e.target.value }))}
                />
              </div>
            </div>

            {/* GST info box */}
            {enrollDialog.courseId && enrollCourseTaxAmount > 0 && (
              <div className="text-xs rounded-md border border-amber-200 bg-amber-50 p-2.5 space-y-1">
                <div className="flex justify-between text-muted-foreground">
                  <span>Base Price</span>
                  <span>{fmt(enrollCourseBasePrice)}</span>
                </div>
                <div className="flex justify-between text-amber-700 font-medium">
                  <span>{gstLabel(enrollCourseTaxType)}</span>
                  <span>+ {fmt(enrollCourseTaxAmount)}</span>
                </div>
                <div className="flex justify-between font-semibold border-t border-amber-200 pt-1 text-foreground">
                  <span>Total (incl. GST)</span>
                  <span>{fmt(enrollCourseBasePrice + enrollCourseTaxAmount)}</span>
                </div>
              </div>
            )}

            {/* Amount due preview */}
            {enrollDialog.totalFee && (
              <p className="text-sm text-muted-foreground">
                Final amount:{' '}
                <span className="font-semibold text-foreground">
                  {fmt(enrollPayableAmount)}
                </span>
                {enrollCourseTaxAmount > 0 && (
                  <span className="ml-2 text-xs text-amber-600">({gstLabel(enrollCourseTaxType)} incl.)</span>
                )}
              </p>
            )}

            {/* Initial payment */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Initial Payment (₹)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={enrollDialog.payMode === 'Bajaj EMI' ? String(enrollFirstEmiAmount) : enrollDialog.initialPayment}
                  onChange={(e) => setEnrollDialog((p) => ({ ...p, initialPayment: e.target.value }))}
                  disabled={enrollDialog.payMode === 'Bajaj EMI'}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Payment Mode</Label>
                <Select
                  value={enrollDialog.payMode}
                  onValueChange={(v) => setEnrollDialog((p) => ({ ...p, payMode: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {enrollDialog.payMode === 'Bajaj EMI' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>EMI Months</Label>
                  <Select
                    value={enrollDialog.emiMonths}
                    onValueChange={(v) => setEnrollDialog((p) => ({ ...p, emiMonths: v }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[3, 6, 9, 12, 18, 24].map((months) => (
                        <SelectItem key={months} value={String(months)}>{months} months</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Processing Charge (₹)</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={enrollDialog.processingCharge}
                    onChange={(e) => setEnrollDialog((p) => ({ ...p, processingCharge: e.target.value }))}
                  />
                </div>
                <div className="col-span-2 text-xs text-muted-foreground">
                  First EMI Amount: ₹{enrollFirstEmiAmount.toFixed(2)} ({enrollPayableAmount.toFixed(2)} / {enrollEmiMonths})
                </div>
              </div>
            )}

            {/* Due date */}
            <div className="space-y-1.5">
              <Label>Due Date</Label>
              <Input
                type="date"
                value={enrollDialog.dueDate}
                onChange={(e) => setEnrollDialog((p) => ({ ...p, dueDate: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEnrollDialog((p) => ({ ...p, open: false }))}>
              Cancel
            </Button>
            <Button
              onClick={handleEnroll}
              disabled={!enrollDialog.courseId || !enrollDialog.totalFee}
            >
              <GraduationCap className="w-4 h-4 mr-2" /> {enrollDialog.parentComboId ? 'Assign Course' : 'Enroll Student'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editEnrollmentDialog.open} onOpenChange={(open) => setEditEnrollmentDialog((prev) => ({ ...prev, open }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-primary" />
              Edit Enrollment
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
              <p><span className="text-muted-foreground">Student:</span> <span className="font-medium">{editEnrollmentDialog.studentName}</span></p>
              <p><span className="text-muted-foreground">Course:</span> <span className="font-medium">{editEnrollmentDialog.courseName}</span></p>
              {editEnrollmentDialog.comboName && (
                <p><span className="text-muted-foreground">Combo:</span> <span className="font-medium">{editEnrollmentDialog.comboName}</span></p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Course Batches</Label>
              <div className="rounded-md border p-3 space-y-2 bg-muted/20">
                <p className="text-xs text-muted-foreground">
                  Update the batches this student should access for this course.
                </p>
                {editEnrollmentDialog.availableBatches.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No batches are mapped to this course yet.</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {editEnrollmentDialog.availableBatches.map((batch) => (
                      <label key={batch.id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={editEnrollmentDialog.batchIds.includes(batch.id)}
                          onCheckedChange={(checked) => setEditEnrollmentDialog((prev) => ({
                            ...prev,
                            batchIds: checked
                              ? Array.from(new Set([...prev.batchIds, batch.id]))
                              : prev.batchIds.filter((value) => value !== batch.id),
                          }))}
                        />
                        <span>{batch.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditEnrollmentDialog((prev) => ({ ...prev, open: false }))}>
              Cancel
            </Button>
            <Button onClick={handleSaveEnrollmentEdit} disabled={savingEnrollmentEdit}>
              <Save className="w-4 h-4 mr-2" /> {savingEnrollmentEdit ? 'Saving…' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteEnrollmentDialog.open} onOpenChange={(open) => setDeleteEnrollmentDialog((prev) => ({ ...prev, open }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-700">
              <Trash2 className="w-5 h-5" />
              Delete Enrollment
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-sm">
            <div className="rounded-md border border-rose-200 bg-rose-50 p-3 space-y-1">
              <p><span className="text-muted-foreground">Student:</span> <span className="font-medium text-foreground">{deleteEnrollmentDialog.studentName}</span></p>
              <p><span className="text-muted-foreground">Course:</span> <span className="font-medium text-foreground">{deleteEnrollmentDialog.courseName}</span></p>
              {deleteEnrollmentDialog.comboName && (
                <p><span className="text-muted-foreground">Combo:</span> <span className="font-medium text-foreground">{deleteEnrollmentDialog.comboName}</span></p>
              )}
            </div>
            <p className="text-muted-foreground">
              This removes the selected enrollment and its course batch access for the student. If payments were already allocated directly to this course, deletion will be blocked.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteEnrollmentDialog((prev) => ({ ...prev, open: false }))}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteEnrollment} disabled={deletingEnrollment}>
              <Trash2 className="w-4 h-4 mr-2" /> {deletingEnrollment ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Record Payment Dialog ── */}
      <Dialog open={payDialog.open} onOpenChange={(o) => setPayDialog((p) => ({ ...p, open: o }))}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-600" />
              Record Payment
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
              <p><span className="text-muted-foreground">Student:</span> <span className="font-medium">{payDialog.studentName}</span></p>
              <p><span className="text-muted-foreground">Program:</span> <span className="font-medium">{payDialog.courseName}</span></p>
              {payDialog.courseOptions.length > 0 && (
                <p><span className="text-muted-foreground">Paying For:</span> <span className="font-medium">{selectedPayCourseOption?.label || 'Select a course below'}</span></p>
              )}
              <p><span className="text-muted-foreground">Remaining:</span> <span className="font-semibold text-amber-600">{fmt(selectedPayCourseOption?.remaining ?? payDialog.remaining)}</span></p>
            </div>

            {payDialog.courseOptions.length > 0 && (
              <div className="space-y-1.5">
                <Label>Allocate Payment To</Label>
                <Select
                  value={payDialog.selectedCourseId}
                  onValueChange={(value) => setPayDialog((prev) => {
                    const nextOption = prev.courseOptions.find((option) => option.id === value) || null;
                    const nextRemaining = nextOption?.remaining ?? prev.remaining;
                    return {
                      ...prev,
                      selectedCourseId: value,
                      remaining: nextRemaining,
                      amount: prev.amount && Number(prev.amount) > nextRemaining ? '' : prev.amount,
                    };
                  })}
                >
                  <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                  <SelectContent>
                    {payDialog.courseOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label} — {fmt(option.remaining)} due
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Amount (₹) *</Label>
              <Input
                type="number"
                placeholder={`Max ${fmt(selectedPayCourseOption?.remaining ?? payDialog.remaining)}`}
                value={payDialog.amount}
                onChange={(e) => setPayDialog((p) => ({ ...p, amount: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={payDialog.date}
                  onChange={(e) => setPayDialog((p) => ({ ...p, date: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Mode</Label>
                <Select
                  value={payDialog.payMode}
                  onValueChange={(v) => setPayDialog((p) => ({ ...p, payMode: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Collected By (Sales Staff)</Label>
              <Select
                value={payDialog.collectedById || user?.id || ''}
                onValueChange={(v) => setPayDialog((p) => ({ ...p, collectedById: v }))}
              >
                <SelectTrigger><SelectValue placeholder="Select sales staff" /></SelectTrigger>
                <SelectContent>
                  {salesStaffOptions.map((staff) => (
                    <SelectItem key={staff.id} value={staff.id}>{staff.name}</SelectItem>
                  ))}
                  {user?.id && !salesStaffOptions.some((staff) => staff.id === user.id) && (
                    <SelectItem value={user.id}>Current User</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialog((p) => ({ ...p, open: false }))}>
              Cancel
            </Button>
            <Button
              onClick={handleRecordPayment}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={!payDialog.amount}
            >
              <IndianRupee className="w-4 h-4 mr-1" /> Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hidden file input for photo uploads */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          const studentId = photoInputRef.current?.getAttribute('data-student-id');
          if (file && studentId) {
            handlePhotoUpload(studentId, file);
          }
          e.target.value = '';
        }}
      />
    </div>
  );
}
