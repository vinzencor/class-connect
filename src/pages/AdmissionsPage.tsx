import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { sendFeeReceipt, sendFeeReminder } from '@/services/whatsappService';
import { admissionSourceService, type AdmissionSource } from '@/services/admissionSourceService';
import { referenceService, type Reference } from '@/services/referenceService';
import { PAYMENT_METHODS } from '@/constants/paymentMethods';
import type { StudentAdmission, StudentEnrollment } from '@/services/admissionService';
import type { StudentDetail } from '@/services/studentDetailService';

// ── Detail display helper ──
function DetailField({ label, value, mono, wide }: { label: string; value: string; mono?: boolean; wide?: boolean }) {
  return (
    <div className={wide ? 'sm:col-span-2 lg:col-span-3' : ''}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm font-medium text-foreground ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}

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

// ─────────────────────────────────────────────────────────────────────────────

export default function AdmissionsPage() {
  const { user } = useAuth();
  const { currentBranchId, branchVersion } = useBranch();

  const [students, setStudents]           = useState<StudentAdmission[]>([]);
  const [studentContacts, setStudentContacts] = useState<Record<string, { mobile: string; parentMobile: string }>>({});
  const [loading, setLoading]             = useState(true);
  const [searchQuery, setSearchQuery]     = useState('');
  const [expanded, setExpanded]           = useState<Set<string>>(new Set());
  const [courses, setCourses]             = useState<{ id: string; name: string; fee: number; tax_type?: string; tax_amount?: number }[]>([]);
  const [batches, setBatches]             = useState<{ id: string; name: string; module_subject_id?: string | null }[]>([]);

  // ── Enroll Dialog ──
  const [enrollDialog, setEnrollDialog] = useState({
    open: false,
    studentId: '',
    studentName: '',
    courseId: '',
    batchId: '',
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
    courseName: '',
    studentName: '',
    studentPhone: '',
    remaining: 0,
    amount: '',
    payMode: 'Cash',
    date: new Date().toISOString().split('T')[0],
    collectedById: '',
  });
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

  // ─────────────────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!user?.organizationId) return;
    setLoading(true);
    try {
      const [studentsData, coursesData, batchesRes] = await Promise.all([
        admissionService.fetchAllStudents(user.organizationId, currentBranchId),
        admissionService.fetchCourses(user.organizationId, currentBranchId),
        supabase
          .from('batches')
          .select('id, name, module_subject_id')
          .eq('organization_id', user.organizationId)
          .order('name'),
      ]);
      setStudents(studentsData);
      setCourses(coursesData);
      setBatches((batchesRes.data || []).map((b: any) => ({ id: b.id, name: b.name, module_subject_id: b.module_subject_id })));

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
      const paymentIds = (student.enrollments || []).map(e => e.payment_id).filter(Boolean);
      if (paymentIds.length > 0) {
        const { data: feePayments } = await supabase
          .from('fee_payments')
          .select('amount, date, mode, payment_id')
          .in('payment_id', paymentIds)
          .order('date', { ascending: true });
        if (feePayments) {
          const pidToCourse: Record<string, string> = {};
          (student.enrollments || []).forEach(e => { if (e.payment_id) pidToCourse[e.payment_id] = e.course_name; });
          paymentHistory = feePayments.map((fp: any) => ({
            date: fp.date,
            amount: fp.amount,
            mode: fp.mode || 'N/A',
            course: pidToCourse[fp.payment_id] || 'Unknown',
          }));
        }
      }
    } catch { /* ignore */ }

    const enrollments = student.enrollments || [];
    const totalFee = enrollments.reduce((s, e) => s + (e.final_amount || 0), 0);
    const totalPaid = enrollments.reduce((s, e) => s + (e.amount_paid || 0), 0);
    const totalDue = enrollments.reduce((s, e) => s + (e.remaining || 0), 0);
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
          ${enrollments.map(e => {
            const c = courses.find(c => c.id === e.course_id);
            const taxAmt = c?.tax_amount ?? 0;
            const taxLbl = taxAmt > 0 ? gstLabel(c?.tax_type) : '—';
            const baseFee = c?.fee ?? (e.final_amount || 0);
            return `<tr>
              <td>${e.course_name}</td>
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
          }).join('')}
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
  const openEnrollDialog = (student: StudentAdmission) => {
    setEnrollDialog({
      open: true,
      studentId: student.id,
      studentName: student.full_name,
      courseId: '',
      batchId: '',
      totalFee: '',
      discount: '',
      initialPayment: '',
      dueDate: '',
      payMode: 'Cash',
      emiMonths: '6',
      processingCharge: '',
    });
  };

  const handleCourseChange = (courseId: string) => {
    const course = courses.find((c) => c.id === courseId);
    const fee = course?.fee ?? 0;
    const taxAmount = course?.tax_amount ?? 0;
    const totalWithGst = fee + taxAmount;
    setEnrollDialog((prev) => ({
      ...prev,
      courseId,
      batchId: '',
      totalFee: totalWithGst > 0 ? String(totalWithGst) : prev.totalFee,
    }));
  };

  const handleEnroll = async () => {
    const { studentId, studentName, courseId, batchId, totalFee, discount, initialPayment, dueDate, payMode, emiMonths, processingCharge } = enrollDialog;
    if (!user?.organizationId || !studentId || !courseId || !totalFee) {
      toast.error('Please fill course and fee amount');
      return;
    }
    try {
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

      await admissionService.addCourseEnrollment(
        user.organizationId,
        studentId,
        studentName,
        {
          courseId,
          totalFee: totalFeeNum,
          discountAmount: discountNum,
          initialPayment: initialPaymentValue,
          dueDate: dueDate || null,
          paymentMode: payMode,
          emiMonths: payMode === 'Bajaj EMI' ? emiMonthsNum : undefined,
          processingCharge: processingChargeNum,
          batchId: batchId || null,
          collectedById: user.id,
        },
        currentBranchId
      );
      toast.success('Student enrolled successfully');
      setEnrollDialog((p) => ({ ...p, open: false }));
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Enrollment failed');
    }
  };

  // ── Open pay dialog ──
  const openPayDialog = async (enrollment: StudentEnrollment, student: StudentAdmission) => {
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

      setPayDialog({
        open: true,
        enrollmentId: enrollment.id,
        paymentId,
        courseName: enrollment.course_name,
        studentName: student.full_name,
        studentPhone: student.phone || '',
        remaining: enrollment.remaining ?? 0,
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
    const { paymentId, amount, payMode, date, studentName, courseName, remaining, collectedById } = payDialog;
    const amtNum = parseFloat(amount) || 0;
    if (!paymentId || amtNum <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    if (amtNum > remaining) {
      toast.error(`Amount exceeds remaining balance of ${fmt(remaining)}`);
      return;
    }
    try {
      // Insert fee_payment
      const { error: fpErr } = await supabase.from('fee_payments').insert({
        payment_id: paymentId,
        organization_id: user?.organizationId,
        amount: amtNum,
        date,
        mode: payMode,
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
        description: `Fee Payment: ${courseName} — ${studentName}`,
        amount: amtNum,
        category: 'Course Fee',
        date: new Date(date).toISOString(),
        mode: payMode,
        recurrence: 'one-time',
        paused: false,
        created_by: user?.id || null,
        sales_staff_id: collectedById || user?.id || null,
      });

      const remainingAfterPayment = Math.max(finalAmt - newPaid, 0);

      if (payDialog.studentPhone) {
        try {
          await sendFeeReceipt({
            to: payDialog.studentPhone,
            studentName,
            courseName,
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
  const enrollCourse = courses.find((c) => c.id === enrollDialog.courseId);
  const enrollCourseTaxType = enrollCourse?.tax_type || 'none';
  const enrollCourseTaxAmount = enrollCourse?.tax_amount ?? 0;
  const enrollCourseBasePrice = enrollCourse?.fee ?? 0;

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

  // ─────────────────────────────────────────────────────────────────────────
  // Stats
  // ─────────────────────────────────────────────────────────────────────────

  const totalStudents     = students.length;
  const totalEnrollments  = students.reduce((s, x) => s + (x.enrollments?.length || 0), 0);
  const activeEnrollments = students.reduce((s, x) => s + (x.enrollments?.filter((e) => e.status === 'active').length || 0), 0);
  const totalOutstanding  = students.reduce(
    (s, x) => s + (x.enrollments?.reduce((a, e) => a + (e.remaining || 0), 0) || 0),
    0
  );

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
            const totalPaid = (student.enrollments || []).reduce((s, e) => s + (e.amount_paid || 0), 0);
            const totalRem  = (student.enrollments || []).reduce((s, e) => s + (e.remaining || 0), 0);

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
                      <p className="font-semibold">{student.enrollments?.length || 0}</p>
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
                              {student.enrollments!.map((enroll) => (
                                <TableRow key={enroll.id}>
                                  <TableCell>
                                    <span className="font-mono text-xs text-indigo-600 font-semibold">
                                      {enroll.enrollment_number}
                                    </span>
                                  </TableCell>
                                  <TableCell className="font-medium">{enroll.course_name}</TableCell>
                                  <TableCell className="text-right">
                                    {fmt(enroll.total_fee ?? enroll.course_fee)}
                                    {(() => {
                                      const c = courses.find((c) => c.id === enroll.course_id);
                                      if (c && (c.tax_amount ?? 0) > 0) {
                                        return <div className="text-xs text-amber-600 font-normal">+{gstLabel(c.tax_type)} ₹{(c.tax_amount!).toLocaleString('en-IN')}</div>;
                                      }
                                      return null;
                                    })()}
                                  </TableCell>
                                  <TableCell className="text-right text-emerald-600">
                                    {(enroll.discount_amount ?? 0) > 0 ? `-${fmt(enroll.discount_amount!)}` : '—'}
                                  </TableCell>
                                  <TableCell className="text-right font-semibold text-emerald-600">
                                    {fmt(enroll.amount_paid ?? 0)}
                                  </TableCell>
                                  <TableCell className={`text-right font-semibold ${(enroll.remaining ?? 0) > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                    {fmt(enroll.remaining ?? 0)}
                                  </TableCell>
                                  <TableCell className="text-sm text-muted-foreground">
                                    {enroll.due_date ? (
                                      <span className="flex items-center gap-1">
                                        <Calendar className="w-3 h-3" />
                                        {new Date(enroll.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                                      </span>
                                    ) : '—'}
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      variant="outline"
                                      className={`text-xs capitalize ${payStatusStyles[enroll.payment_status || 'pending'] || payStatusStyles.pending}`}
                                    >
                                      {enroll.payment_status === 'completed' ? 'Paid' : enroll.payment_status === 'partial' ? 'Partial' : 'Pending'}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <Select
                                      value={enroll.status}
                                      onValueChange={(v) => handleStatusChange(enroll.id, v)}
                                    >
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
                                      {(enroll.remaining ?? 0) > 0 && student.phone && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-7 text-xs gap-1"
                                          onClick={() => handleSendFeeReminder(student, enroll)}
                                        >
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
              Add Course — <span className="text-primary">{enrollDialog.studentName}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Course */}
            <div className="space-y-1.5">
              <Label>Course *</Label>
              <Select value={enrollDialog.courseId} onValueChange={handleCourseChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select course…" />
                </SelectTrigger>
                <SelectContent>
                  {courses.length === 0 ? (
                    <SelectItem value="__none__" disabled>No courses available</SelectItem>
                  ) : (
                    courses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}{c.fee > 0 ? ` — ₹${(c.fee + (c.tax_amount ?? 0)).toLocaleString('en-IN')}` : ''}
                        {(c.tax_amount ?? 0) > 0 ? ` (${gstLabel(c.tax_type)} incl.)` : ''}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Batch */}
            {enrollDialog.courseId && (() => {
              const filteredBatches = batches.filter((b) => b.module_subject_id === enrollDialog.courseId);
              return filteredBatches.length > 0 ? (
                <div className="space-y-1.5">
                  <Label>Batch</Label>
                  <Select value={enrollDialog.batchId} onValueChange={(v) => setEnrollDialog((p) => ({ ...p, batchId: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select batch…" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredBatches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
              <GraduationCap className="w-4 h-4 mr-2" /> Enroll Student
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
              <p><span className="text-muted-foreground">Course:</span> <span className="font-medium">{payDialog.courseName}</span></p>
              <p><span className="text-muted-foreground">Remaining:</span> <span className="font-semibold text-amber-600">{fmt(payDialog.remaining)}</span></p>
            </div>

            <div className="space-y-1.5">
              <Label>Amount (₹) *</Label>
              <Input
                type="number"
                placeholder={`Max ${fmt(payDialog.remaining)}`}
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
