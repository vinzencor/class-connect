import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  CreditCard,
  GraduationCap,
  Users,
  Shield,
  Filter,
  Loader2,
  Camera,
  BookOpen,
  IndianRupee,
  Percent,
  CalendarDays,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useBranch } from '@/contexts/BranchContext';
import { userService } from '@/services/userService';
import { batchService } from '@/services/batchService';
import * as facultySubjectService from '@/services/facultySubjectService';
import * as studentDetailService from '@/services/studentDetailService';
import * as courseServiceModule from '@/services/courseService';
import { useToast } from '@/hooks/use-toast';
import { Tables } from '@/types/database';
import { supabase } from '@/lib/supabase';

const PAYMENT_STORAGE_KEY = 'teammates_transactions';
const STUDENT_FEES_KEY = 'teammates_student_fees';

const getRoleIcon = (role: string) => {
  switch (role) {
    case 'admin': return Shield;
    case 'faculty': return Users;
    case 'student': return GraduationCap;
    default: return Users;
  }
};

const getRoleBadgeColor = (role: string) => {
  switch (role) {
    case 'admin': return 'bg-destructive/10 text-destructive border-destructive/20';
    case 'faculty': return 'bg-primary/10 text-primary border-primary/20';
    case 'student': return 'bg-accent/10 text-accent border-accent/20';
    default: return 'bg-muted text-muted-foreground';
  }
};

type Profile = Tables<'profiles'>;
type Batch = Tables<'batches'>;

interface Role {
  id: string;
  name: string;
  is_system: boolean;
}

interface Subject {
  id: string;
  name: string;
}

const emptyStudentData = {
  address: '',
  city: '',
  state: '',
  pincode: '',
  dateOfBirth: '',
  gender: '',
  mobile: '',
  whatsapp: '',
  landline: '',
  aadhaar: '',
  qualification: '',
  graduationYear: '',
  graduationCollege: '',
  admissionSource: '',
  remarks: '',
  fatherName: '',
  motherName: '',
  parentEmail: '',
  parentMobile: '',
};

export default function UsersPage() {
  const { user, refreshUserData } = useAuth();
  const { currentBranchId, branchVersion } = useBranch();
  const { toast } = useToast();
  const [users, setUsers] = useState<Profile[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [courses, setCourses] = useState<courseServiceModule.Course[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isBatchesLoading, setIsBatchesLoading] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const editPhotoInputRef = useRef<HTMLInputElement>(null);

  // Add form state
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    role: 'student',
    roleId: '',
    batchId: '',
    password: '',
    subjectIds: [] as string[],
    courseId: '',
    discountType: 'percentage' as 'percentage' | 'fixed',
    discountValue: '',
    initialPayment: '',
    dueDate: '',
    ...emptyStudentData,
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Edit form state
  const [editFormData, setEditFormData] = useState({
    fullName: '',
    role: 'student',
    roleId: '',
    batchId: '',
    isActive: true,
    subjectIds: [] as string[],
    ...emptyStudentData,
  });
  const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState<string | null>(null);

  const selectedRoleName = roles.find(r => r.id === formData.roleId)?.name?.toLowerCase() || '';
  const editSelectedRoleName = roles.find(r => r.id === editFormData.roleId)?.name?.toLowerCase() || '';

  // Fetch roles + subjects + courses
  useEffect(() => {
    const fetchRolesSubjectsCourses = async () => {
      if (!user?.organizationId) return;
      try {
        const [rolesRes, subjectsRes, coursesData] = await Promise.all([
          supabase
            .from('roles')
            .select('id, name, is_system')
            .eq('organization_id', user.organizationId)
            .order('is_system', { ascending: false })
            .order('name', { ascending: true }),
          supabase
            .from('module_subjects')
            .select('id, name')
            .eq('organization_id', user.organizationId)
            .order('name', { ascending: true }),
          courseServiceModule.getCourses(user.organizationId),
        ]);
        if (rolesRes.error) throw rolesRes.error;
        if (subjectsRes.error) throw subjectsRes.error;
        setRoles(rolesRes.data || []);
        setSubjects(subjectsRes.data || []);
        setCourses(coursesData);
      } catch (error) {
        console.error('Error fetching roles/subjects/courses:', error);
      }
    };
    fetchRolesSubjectsCourses();
  }, [user?.organizationId]);

  // Fetch users
  useEffect(() => {
    const initializePage = async () => {
      if (!user?.organizationId) {
        try { await refreshUserData(); } catch (error) { console.error('Failed to refresh:', error); }
      }
      if (user?.organizationId) {
        await Promise.all([fetchUsers(), fetchBatches()]);
      }
    };
    initializePage();
  }, [user?.organizationId]);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      if (!user?.organizationId) throw new Error('No organization ID');
      const data = await userService.getUsers(user.organizationId);
      const activeUsers = (data || []).filter(u => u.is_active);
      setUsers(activeUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to fetch users', variant: 'destructive' });
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBatches = async () => {
    try {
      if (!user?.organizationId) return;
      setIsBatchesLoading(true);
      const data = await batchService.getBatches(user.organizationId, currentBranchId);
      setBatches(data || []);
    } catch (error) {
      console.error('Error fetching batches:', error);
      setBatches([]);
    } finally {
      setIsBatchesLoading(false);
    }
  };

  // Photo handling
  const handlePhotoSelect = (file: File, isEdit: boolean) => {
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Error', description: 'Photo must be less than 5MB', variant: 'destructive' });
      return;
    }
    const url = URL.createObjectURL(file);
    if (isEdit) {
      setEditPhotoFile(file);
      setEditPhotoPreview(url);
    } else {
      setPhotoFile(file);
      setPhotoPreview(url);
    }
  };

  // Student field validation
  const validateStudentFields = (data: typeof emptyStudentData): string | null => {
    if (!data.city.trim()) return 'City is required';
    if (!data.state.trim()) return 'State is required';
    if (!data.pincode.trim()) return 'Pincode is required';
    if (!data.dateOfBirth) return 'Date of Birth is required';
    if (!data.gender) return 'Gender is required';
    if (!data.mobile.trim()) return 'Mobile number is required';
    if (!data.qualification.trim()) return 'Qualification is required';
    if (!data.parentMobile.trim()) return 'Parent mobile number is required';
    return null;
  };

  // Create user
  const handleCreateUser = async () => {
    try {
      if (!formData.fullName || !formData.email || !formData.password) {
        toast({ title: 'Error', description: 'Name, Email and Password are required', variant: 'destructive' });
        return;
      }
      if (!formData.roleId) {
        toast({ title: 'Error', description: 'Please select a role', variant: 'destructive' });
        return;
      }
      if (selectedRoleName === 'student') {
        if (!formData.batchId) {
          toast({ title: 'Error', description: 'Please select a batch for the student', variant: 'destructive' });
          return;
        }
        const err = validateStudentFields(formData);
        if (err) { toast({ title: 'Error', description: err, variant: 'destructive' }); return; }
      }
      if (selectedRoleName === 'faculty' && formData.subjectIds.length === 0) {
        toast({ title: 'Error', description: 'Select at least one subject for the faculty', variant: 'destructive' });
        return;
      }

      setIsCreating(true);
      if (!user?.organizationId) throw new Error('No organization ID available');

      const result = await userService.createUser(
        user.organizationId,
        formData.email,
        formData.fullName,
        formData.role as 'faculty' | 'student',
        formData.password,
        selectedRoleName === 'student' ? formData.batchId : undefined
      );

      const newUserId = result.user?.id;

      // Set role_id on profile
      if (newUserId && formData.roleId) {
        await supabase.from('profiles').update({ role_id: formData.roleId } as any).eq('id', newUserId);
      }

      // Faculty: save subjects
      if (newUserId && selectedRoleName === 'faculty' && formData.subjectIds.length > 0) {
        await facultySubjectService.setFacultySubjects(newUserId, user.organizationId, formData.subjectIds);
      }

      // Student: save details + photo
      if (newUserId && selectedRoleName === 'student') {
        // Ensure the profile exists before inserting student_details (FK dependency)
        let profileReady = false;
        for (let i = 0; i < 10; i++) {
          const { data: p } = await supabase.from('profiles').select('id').eq('id', newUserId).maybeSingle();
          if (p) { profileReady = true; break; }
          await new Promise(r => setTimeout(r, 500));
        }
        if (!profileReady) {
          throw new Error('User profile was not created in time. Please try again.');
        }

        await studentDetailService.createStudentDetail(newUserId, user.organizationId, {
          address: formData.address || undefined,
          city: formData.city,
          state: formData.state,
          pincode: formData.pincode,
          date_of_birth: formData.dateOfBirth,
          gender: formData.gender,
          mobile: formData.mobile,
          whatsapp: formData.whatsapp || undefined,
          landline: formData.landline || undefined,
          aadhaar: formData.aadhaar || undefined,
          qualification: formData.qualification,
          graduation_year: formData.graduationYear || undefined,
          graduation_college: formData.graduationCollege || undefined,
          admission_source: formData.admissionSource || undefined,
          remarks: formData.remarks || undefined,
          father_name: formData.fatherName || undefined,
          mother_name: formData.motherName || undefined,
          parent_email: formData.parentEmail || undefined,
          parent_mobile: formData.parentMobile,
        });
        if (photoFile) {
          await studentDetailService.uploadStudentPhoto(user.organizationId, newUserId, photoFile);
        }
      }

      // Auto-create fee record if a course with price is selected
      if (newUserId && selectedRoleName === 'student' && formData.courseId) {
        const selectedCourse = courses.find(c => c.id === formData.courseId);
        if (selectedCourse && selectedCourse.price > 0) {
          const courseFee = selectedCourse.price;
          const discountVal = parseFloat(formData.discountValue) || 0;
          const discountAmount = formData.discountType === 'percentage'
            ? (courseFee * Math.min(discountVal, 100)) / 100
            : Math.min(discountVal, courseFee);
          const finalAmount = Math.max(courseFee - discountAmount, 0);
          const initialPay = Math.min(parseFloat(formData.initialPayment) || 0, finalAmount);

          // Supabase payment
          try {
            await supabase.from('payments').insert({
              organization_id: user.organizationId,
              student_id: newUserId,
              amount: finalAmount,
              amount_paid: initialPay,
              status: initialPay >= finalAmount ? 'paid' : initialPay > 0 ? 'partial' : 'pending',
              notes: `Course: ${selectedCourse.name}${discountAmount > 0 ? ` | Discount: ₹${discountAmount.toFixed(0)}` : ''}`,
            });
          } catch (payErr) {
            console.error('Supabase payment error:', payErr);
          }

          // StudentFee record in localStorage (for PaymentsPage Student Fees tab)
          try {
            const fees = JSON.parse(localStorage.getItem(STUDENT_FEES_KEY) || '[]');
            const payments: { id: string; amount: number; date: string; mode: string }[] = [];
            if (initialPay > 0) {
              payments.push({
                id: crypto.randomUUID(),
                amount: initialPay,
                date: new Date().toISOString().split('T')[0],
                mode: 'UPI',
              });
            }
            fees.push({
              id: crypto.randomUUID(),
              studentName: formData.fullName,
              courseName: selectedCourse.name,
              totalFee: courseFee,
              discountAmount,
              finalAmount,
              dueDate: formData.dueDate || '',
              payments,
              status: initialPay >= finalAmount ? 'paid' : initialPay > 0 ? 'partial' : 'pending',
              createdAt: new Date().toISOString(),
            });
            localStorage.setItem(STUDENT_FEES_KEY, JSON.stringify(fees));
          } catch (lsErr) {
            console.error('localStorage fee error:', lsErr);
          }

          // Also add initial payment as income transaction if paid
          if (initialPay > 0) {
            try {
              const txns = JSON.parse(localStorage.getItem(PAYMENT_STORAGE_KEY) || '[]');
              txns.push({
                id: crypto.randomUUID(),
                type: 'income',
                description: `Initial Payment: ${selectedCourse.name} — ${formData.fullName}`,
                amount: initialPay,
                category: 'Course Fee',
                date: new Date().toISOString().split('T')[0],
                mode: 'UPI',
                recurrence: 'none',
                paused: false,
              });
              localStorage.setItem(PAYMENT_STORAGE_KEY, JSON.stringify(txns));
            } catch (lsErr) {
              console.error('localStorage txn error:', lsErr);
            }
          }
        }
      }

      toast({ title: 'Success', description: `User ${formData.fullName} created successfully` });
      setFormData({ fullName: '', email: '', role: 'student', roleId: '', batchId: '', password: '', subjectIds: [], courseId: '', discountType: 'percentage', discountValue: '', initialPayment: '', dueDate: '', ...emptyStudentData });
      setPhotoFile(null);
      setPhotoPreview(null);
      setIsAddDialogOpen(false);
      await fetchUsers();
    } catch (error) {
      console.error('Error creating user:', error);
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to create user', variant: 'destructive' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    try {
      await userService.deactivateUser(userId);
      toast({ title: 'Success', description: `${userName} has been deactivated` });
      await fetchUsers();
    } catch (error) {
      console.error('Error deactivating user:', error);
      toast({ title: 'Error', description: 'Failed to deactivate user', variant: 'destructive' });
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch = u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) || u.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const stats = {
    total: users.length,
    students: users.filter(u => u.role === 'student').length,
    faculty: users.filter(u => u.role === 'faculty').length,
    admins: users.filter(u => u.role === 'admin').length,
  };

  // Metadata helpers
  const normalizeBatchValue = (rawValue: unknown) => {
    if (rawValue === null || rawValue === undefined) return undefined;
    if (typeof rawValue === 'string' || typeof rawValue === 'number') {
      const value = String(rawValue).trim();
      return value.length > 0 ? value : undefined;
    }
    if (typeof rawValue === 'object') {
      const candidate = rawValue as any;
      const nestedValue = candidate.id ?? candidate.batch_id ?? candidate.name ?? candidate.batch;
      if (nestedValue === null || nestedValue === undefined) return undefined;
      return String(nestedValue).trim() || undefined;
    }
    return undefined;
  };

  const parseMetadataObject = (metadata: Profile['metadata']) => {
    if (metadata === null || metadata === undefined) return undefined;
    if (typeof metadata === 'string') {
      const trimmed = metadata.trim();
      if (!trimmed || !trimmed.startsWith('{')) return undefined;
      try {
        const parsed = JSON.parse(trimmed);
        return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed : undefined;
      } catch { return undefined; }
    }
    if (typeof metadata === 'object' && !Array.isArray(metadata)) return metadata as Record<string, unknown>;
    return undefined;
  };

  const getBatchIdFromMetadata = (metadata: Profile['metadata']) => {
    if (metadata === null || metadata === undefined) return undefined;
    if (typeof metadata === 'string' || typeof metadata === 'number') {
      const parsedObject = parseMetadataObject(metadata);
      if (parsedObject) {
        const rawValue = (parsedObject as any).batch_id ?? (parsedObject as any).batch ?? (parsedObject as any).batchId;
        return normalizeBatchValue(rawValue);
      }
      return normalizeBatchValue(metadata);
    }
    if (typeof metadata !== 'object' || Array.isArray(metadata)) return undefined;
    const rawValue = (metadata as any).batch_id ?? (metadata as any).batch ?? (metadata as any).batchId;
    return normalizeBatchValue(rawValue);
  };

  const resolveBatchName = (metadata: Profile['metadata']) => {
    const batchValue = getBatchIdFromMetadata(metadata);
    if (!batchValue) return '-';
    const directMatch = batches.find((batch) => batch.id === batchValue);
    if (directMatch) return directMatch.name;
    const nameMatch = batches.find((batch) => batch.name.trim().toLowerCase() === batchValue.toLowerCase());
    return nameMatch?.name || batchValue;
  };

  // Edit dialog
  const openEditDialog = async (profile: Profile) => {
    setSelectedUser(profile);
    const roleName = profile.role || 'student';
    setEditFormData({
      fullName: profile.full_name || '',
      role: roleName,
      roleId: profile.role_id || '',
      batchId: getBatchIdFromMetadata(profile.metadata) || '',
      isActive: Boolean(profile.is_active),
      subjectIds: [],
      ...emptyStudentData,
    });
    setEditPhotoFile(null);
    setEditPhotoPreview(null);
    setIsEditDialogOpen(true);

    if (roleName === 'faculty') {
      try {
        const subs = await facultySubjectService.getFacultySubjects(profile.id);
        setEditFormData(prev => ({ ...prev, subjectIds: subs }));
      } catch (e) { console.error('Error loading faculty subjects:', e); }
    }

    if (roleName === 'student') {
      try {
        const detail = await studentDetailService.getStudentDetail(profile.id);
        if (detail) {
          setEditFormData(prev => ({
            ...prev,
            address: detail.address || '',
            city: detail.city || '',
            state: detail.state || '',
            pincode: detail.pincode || '',
            dateOfBirth: detail.date_of_birth || '',
            gender: detail.gender || '',
            mobile: detail.mobile || '',
            whatsapp: detail.whatsapp || '',
            landline: detail.landline || '',
            aadhaar: detail.aadhaar || '',
            qualification: detail.qualification || '',
            graduationYear: detail.graduation_year || '',
            graduationCollege: detail.graduation_college || '',
            admissionSource: detail.admission_source || '',
            remarks: detail.remarks || '',
            fatherName: detail.father_name || '',
            motherName: detail.mother_name || '',
            parentEmail: detail.parent_email || '',
            parentMobile: detail.parent_mobile || '',
          }));
          if (detail.photo_url) setEditPhotoPreview(detail.photo_url);
        }
      } catch (e) { console.error('Error loading student details:', e); }
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;
    if (!editFormData.fullName.trim()) {
      toast({ title: 'Error', description: 'Full name is required', variant: 'destructive' });
      return;
    }
    if (editSelectedRoleName === 'student') {
      if (!editFormData.batchId) {
        toast({ title: 'Error', description: 'Please select a batch', variant: 'destructive' });
        return;
      }
      const err = validateStudentFields(editFormData);
      if (err) { toast({ title: 'Error', description: err, variant: 'destructive' }); return; }
    }

    try {
      setIsUpdating(true);
      const existingMetadata = parseMetadataObject(selectedUser.metadata) || {};
      const nextMetadata = { ...existingMetadata } as Record<string, unknown>;
      if (editSelectedRoleName === 'student') {
        nextMetadata.batch_id = editFormData.batchId;
      } else if ('batch_id' in nextMetadata) {
        delete nextMetadata.batch_id;
      }

      const updated = await userService.updateUser(selectedUser.id, {
        full_name: editFormData.fullName.trim(),
        role: editFormData.role as 'admin' | 'faculty' | 'student',
        role_id: editFormData.roleId,
        is_active: editFormData.isActive,
        metadata: nextMetadata,
      } as any);

      // Faculty: update subjects
      if (editSelectedRoleName === 'faculty' && user?.organizationId) {
        await facultySubjectService.setFacultySubjects(selectedUser.id, user.organizationId, editFormData.subjectIds);
      }

      // Student: update details + photo
      if (editSelectedRoleName === 'student' && user?.organizationId) {
        const detailData = {
          address: editFormData.address || undefined,
          city: editFormData.city,
          state: editFormData.state,
          pincode: editFormData.pincode,
          date_of_birth: editFormData.dateOfBirth,
          gender: editFormData.gender,
          mobile: editFormData.mobile,
          whatsapp: editFormData.whatsapp || undefined,
          landline: editFormData.landline || undefined,
          aadhaar: editFormData.aadhaar || undefined,
          qualification: editFormData.qualification,
          graduation_year: editFormData.graduationYear || undefined,
          graduation_college: editFormData.graduationCollege || undefined,
          admission_source: editFormData.admissionSource || undefined,
          remarks: editFormData.remarks || undefined,
          father_name: editFormData.fatherName || undefined,
          mother_name: editFormData.motherName || undefined,
          parent_email: editFormData.parentEmail || undefined,
          parent_mobile: editFormData.parentMobile,
        };

        const existing = await studentDetailService.getStudentDetail(selectedUser.id);
        if (existing) {
          await studentDetailService.updateStudentDetail(selectedUser.id, detailData);
        } else {
          await studentDetailService.createStudentDetail(selectedUser.id, user.organizationId, detailData as any);
        }

        if (editPhotoFile) {
          await studentDetailService.uploadStudentPhoto(user.organizationId, selectedUser.id, editPhotoFile);
        }
      }

      setUsers(current => current.map(u => u.id === selectedUser.id ? updated : u));
      toast({ title: 'Success', description: 'User updated successfully' });
      setIsEditDialogOpen(false);
      setSelectedUser(null);
    } catch (error) {
      console.error('Error updating user:', error);
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to update user', variant: 'destructive' });
    } finally {
      setIsUpdating(false);
    }
  };

  // Photo Upload UI component
  const PhotoUploadArea = ({ preview, inputRef, isEdit }: {
    preview: string | null;
    inputRef: React.RefObject<HTMLInputElement>;
    isEdit: boolean;
  }) => (
    <div className="flex flex-col items-center gap-2">
      <div
        className="relative w-24 h-24 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors overflow-hidden bg-muted/20"
        onClick={() => inputRef.current?.click()}
      >
        {preview ? (
          <img src={preview} alt="Photo" className="w-full h-full object-cover" />
        ) : (
          <Camera className="w-8 h-8 text-muted-foreground/50" />
        )}
      </div>
      <button
        type="button"
        className="text-xs text-primary hover:underline"
        onClick={() => inputRef.current?.click()}
      >
        {preview ? 'Change photo' : 'Upload photo (max 5MB)'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handlePhotoSelect(file, isEdit);
        }}
      />
    </div>
  );

  // Subject Picker component
  const SubjectPicker = ({ selected, onToggle }: {
    selected: string[];
    onToggle: (id: string) => void;
  }) => (
    <div className="space-y-2">
      <Label>Subjects <span className="text-destructive">*</span></Label>
      <p className="text-xs text-muted-foreground">Select subjects this faculty can teach</p>
      <div className="border rounded-lg max-h-[160px] overflow-y-auto">
        {subjects.length === 0 ? (
          <div className="p-3 text-sm text-muted-foreground text-center">No subjects found. Create subjects in Modules first.</div>
        ) : (
          <div className="divide-y">
            {subjects.map(subject => (
              <div key={subject.id} className="flex items-center space-x-3 p-3 hover:bg-muted/50 transition-colors">
                <Checkbox
                  id={`subject-${subject.id}`}
                  checked={selected.includes(subject.id)}
                  onCheckedChange={() => onToggle(subject.id)}
                />
                <Label htmlFor={`subject-${subject.id}`} className="flex-1 cursor-pointer font-normal flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  {subject.name}
                </Label>
              </div>
            ))}
          </div>
        )}
      </div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map(id => {
            const s = subjects.find(x => x.id === id);
            return s ? <Badge key={id} variant="secondary" className="text-xs">{s.name}</Badge> : null;
          })}
        </div>
      )}
    </div>
  );

  // Student Form Fields component
  const StudentFormFields = ({ data, onChange }: {
    data: typeof emptyStudentData;
    onChange: (field: string, value: string) => void;
  }) => (
    <div className="space-y-6">
      {/* Personal Details */}
      <div>
        <h4 className="text-sm font-semibold text-foreground mb-3 border-b pb-1">Personal Details</h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">Address</Label>
            <Textarea placeholder="Enter address" value={data.address} onChange={(e) => onChange('address', e.target.value)} className="text-sm min-h-[60px]" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">City <span className="text-destructive">*</span></Label>
            <Input placeholder="City" value={data.city} onChange={(e) => onChange('city', e.target.value)} className="text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">State <span className="text-destructive">*</span></Label>
            <Input placeholder="State" value={data.state} onChange={(e) => onChange('state', e.target.value)} className="text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Pincode <span className="text-destructive">*</span></Label>
            <Input placeholder="Pincode" value={data.pincode} onChange={(e) => onChange('pincode', e.target.value)} className="text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Date of Birth <span className="text-destructive">*</span></Label>
            <Input type="date" value={data.dateOfBirth} onChange={(e) => onChange('dateOfBirth', e.target.value)} className="text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Gender <span className="text-destructive">*</span></Label>
            <Select value={data.gender} onValueChange={(v) => onChange('gender', v)}>
              <SelectTrigger className="text-sm"><SelectValue placeholder="Select gender" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Contact Details */}
      <div>
        <h4 className="text-sm font-semibold text-foreground mb-3 border-b pb-1">Contact Details</h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Mobile No. <span className="text-destructive">*</span></Label>
            <Input placeholder="+91..." value={data.mobile} onChange={(e) => onChange('mobile', e.target.value)} className="text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">WhatsApp No.</Label>
            <Input placeholder="+91..." value={data.whatsapp} onChange={(e) => onChange('whatsapp', e.target.value)} className="text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Landline No.</Label>
            <Input placeholder="Landline" value={data.landline} onChange={(e) => onChange('landline', e.target.value)} className="text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Aadhaar Number</Label>
            <Input placeholder="XXXX XXXX XXXX" value={data.aadhaar} onChange={(e) => onChange('aadhaar', e.target.value)} className="text-sm" />
          </div>
        </div>
      </div>

      {/* Education Details */}
      <div>
        <h4 className="text-sm font-semibold text-foreground mb-3 border-b pb-1">Education Details</h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Qualification <span className="text-destructive">*</span></Label>
            <Input placeholder="e.g., 12th Pass" value={data.qualification} onChange={(e) => onChange('qualification', e.target.value)} className="text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Graduation Year</Label>
            <Input placeholder="YYYY" value={data.graduationYear} onChange={(e) => onChange('graduationYear', e.target.value)} className="text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Graduation College</Label>
            <Input placeholder="College name" value={data.graduationCollege} onChange={(e) => onChange('graduationCollege', e.target.value)} className="text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Admission Source</Label>
            <Input placeholder="e.g., Website, Referral" value={data.admissionSource} onChange={(e) => onChange('admissionSource', e.target.value)} className="text-sm" />
          </div>
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">Remarks</Label>
            <Textarea placeholder="Any additional info" value={data.remarks} onChange={(e) => onChange('remarks', e.target.value)} className="text-sm min-h-[50px]" />
          </div>
        </div>
      </div>

      {/* Parent Details */}
      <div>
        <h4 className="text-sm font-semibold text-foreground mb-3 border-b pb-1">Parent Details</h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Father Name</Label>
            <Input placeholder="Father's name" value={data.fatherName} onChange={(e) => onChange('fatherName', e.target.value)} className="text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Mother Name</Label>
            <Input placeholder="Mother's name" value={data.motherName} onChange={(e) => onChange('motherName', e.target.value)} className="text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Parent Email</Label>
            <Input type="email" placeholder="parent@example.com" value={data.parentEmail} onChange={(e) => onChange('parentEmail', e.target.value)} className="text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Parent Mobile <span className="text-destructive">*</span></Label>
            <Input placeholder="+91..." value={data.parentMobile} onChange={(e) => onChange('parentMobile', e.target.value)} className="text-sm" />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Debug Panel */}
      {!user?.organizationId && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-lg">
          <p className="font-semibold">Warning: No Organization ID detected</p>
          <p className="text-sm mt-1">User ID: {user?.id || 'Not found'}</p>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">User Management</h1>
          <p className="text-muted-foreground mt-1">Manage students, faculty, and administrators</p>
        </div>

        {/* ========== ADD USER DIALOG ========== */}
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
          setIsAddDialogOpen(open);
          if (!open) {
            setFormData({ fullName: '', email: '', role: 'student', roleId: '', batchId: '', password: '', subjectIds: [], courseId: '', discountType: 'percentage', discountValue: '', initialPayment: '', dueDate: '', ...emptyStudentData });
            setPhotoFile(null);
            setPhotoPreview(null);
          }
        }}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground"><Plus className="w-4 h-4 mr-2" />Add User</Button>
          </DialogTrigger>
          <DialogContent className={selectedRoleName === 'student' ? 'max-w-2xl max-h-[90vh]' : 'max-w-md'}>
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>Create a new user account.</DialogDescription>
            </DialogHeader>
            <ScrollArea className={selectedRoleName === 'student' ? 'max-h-[70vh] pr-4' : ''}>
              <div className="space-y-4 mt-4">
                {/* Photo upload for student */}
                {selectedRoleName === 'student' && (
                  <PhotoUploadArea preview={photoPreview} inputRef={photoInputRef as React.RefObject<HTMLInputElement>} isEdit={false} />
                )}

                {/* Common fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Full Name <span className="text-destructive">*</span></Label>
                    <Input placeholder="Enter full name" value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Email <span className="text-destructive">*</span></Label>
                    <Input type="email" placeholder="Enter email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Password <span className="text-destructive">*</span></Label>
                    <Input type="password" placeholder="Temporary password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Role <span className="text-destructive">*</span></Label>
                    <Select
                      value={formData.roleId}
                      onValueChange={(value) => {
                        const r = roles.find(x => x.id === value);
                        setFormData(cur => ({
                          ...cur,
                          roleId: value,
                          role: r?.name.toLowerCase() || '',
                          batchId: r?.name.toLowerCase() === 'student' ? cur.batchId : '',
                          subjectIds: r?.name.toLowerCase() === 'faculty' ? cur.subjectIds : [],
                        }));
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                      <SelectContent>
                        {roles.length === 0 ? (
                          <SelectItem value="loading" disabled>Loading roles...</SelectItem>
                        ) : roles.map(role => (
                          <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Student: Batch */}
                {selectedRoleName === 'student' && (
                  <div className="space-y-2">
                    <Label>Batch <span className="text-destructive">*</span></Label>
                    <Select value={formData.batchId} onValueChange={(v) => setFormData({ ...formData, batchId: v })}>
                      <SelectTrigger><SelectValue placeholder="Select batch" /></SelectTrigger>
                      <SelectContent>
                        {isBatchesLoading ? (
                          <SelectItem value="loading" disabled>Loading...</SelectItem>
                        ) : batches.length === 0 ? (
                          <SelectItem value="none" disabled>No batches found</SelectItem>
                        ) : batches.map(batch => (
                          <SelectItem key={batch.id} value={batch.id}>{batch.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Student: Course & Discount */}
                {selectedRoleName === 'student' && (
                  <>
                    <div className="space-y-2">
                      <Label>Course</Label>
                      <Select value={formData.courseId} onValueChange={(v) => {
                        setFormData(prev => ({ ...prev, courseId: v, discountValue: '' }));
                      }}>
                        <SelectTrigger><SelectValue placeholder="Select course (optional)" /></SelectTrigger>
                        <SelectContent>
                          {courses.length === 0 ? (
                            <SelectItem value="none" disabled>No courses found</SelectItem>
                          ) : courses.map(c => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name} {c.price > 0 ? `— ₹${c.price.toLocaleString('en-IN')}` : '(Free)'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {formData.courseId && (() => {
                      const selectedCourse = courses.find(c => c.id === formData.courseId);
                      if (!selectedCourse || selectedCourse.price <= 0) return null;
                      const courseFee = selectedCourse.price;
                      const discountVal = parseFloat(formData.discountValue) || 0;
                      const discountAmount = formData.discountType === 'percentage'
                        ? (courseFee * Math.min(discountVal, 100)) / 100
                        : Math.min(discountVal, courseFee);
                      const finalAmount = Math.max(courseFee - discountAmount, 0);
                      return (
                        <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Course Fee</span>
                            <span className="font-medium">₹{courseFee.toLocaleString('en-IN')}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <Label className="text-xs">Discount Type</Label>
                              <Select value={formData.discountType} onValueChange={(v: 'percentage' | 'fixed') => setFormData(prev => ({ ...prev, discountType: v as 'percentage' | 'fixed' }))}>
                                <SelectTrigger className="h-9">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="percentage"><span className="flex items-center gap-1"><Percent className="w-3 h-3" /> Percentage</span></SelectItem>
                                  <SelectItem value="fixed"><span className="flex items-center gap-1"><IndianRupee className="w-3 h-3" /> Fixed Amount</span></SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Discount Value</Label>
                              <Input
                                type="number"
                                min="0"
                                max={formData.discountType === 'percentage' ? 100 : courseFee}
                                value={formData.discountValue}
                                onChange={(e) => setFormData(prev => ({ ...prev, discountValue: e.target.value }))}
                                placeholder={formData.discountType === 'percentage' ? '0%' : '₹0'}
                                className="h-9"
                              />
                            </div>
                          </div>
                          {discountAmount > 0 && (
                            <div className="flex items-center justify-between text-sm text-emerald-600">
                              <span>Discount</span>
                              <span>-₹{discountAmount.toFixed(0)}</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between border-t pt-2">
                            <span className="font-semibold">Final Amount</span>
                            <span className="text-lg font-bold text-primary">₹{finalAmount.toLocaleString('en-IN')}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 border-t pt-2">
                            <div className="space-y-1">
                              <Label className="text-xs">Initial Payment (₹)</Label>
                              <Input
                                type="number"
                                min="0"
                                max={finalAmount}
                                value={formData.initialPayment}
                                onChange={(e) => setFormData(prev => ({ ...prev, initialPayment: e.target.value }))}
                                placeholder="0 (full later)"
                                className="h-9"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs flex items-center gap-1"><CalendarDays className="w-3 h-3" /> Due Date</Label>
                              <Input
                                type="date"
                                value={formData.dueDate}
                                onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                                className="h-9"
                              />
                            </div>
                          </div>
                          {(() => {
                            const ip = parseFloat(formData.initialPayment) || 0;
                            const remaining = finalAmount - ip;
                            if (ip > 0 && remaining > 0) {
                              return (
                                <div className="flex items-center justify-between text-xs text-amber-600">
                                  <span>Remaining after initial payment</span>
                                  <span className="font-semibold">₹{remaining.toLocaleString('en-IN')}</span>
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      );
                    })()}
                  </>
                )}

                {/* Faculty: Subjects */}
                {selectedRoleName === 'faculty' && (
                  <SubjectPicker
                    selected={formData.subjectIds}
                    onToggle={(id) => setFormData(prev => ({
                      ...prev,
                      subjectIds: prev.subjectIds.includes(id)
                        ? prev.subjectIds.filter(x => x !== id)
                        : [...prev.subjectIds, id],
                    }))}
                  />
                )}

                {/* Student: Full Registration Form */}
                {selectedRoleName === 'student' && (
                  <StudentFormFields data={formData} onChange={(field, value) => setFormData(prev => ({ ...prev, [field]: value }))} />
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <Button variant="outline" className="flex-1" onClick={() => setIsAddDialogOpen(false)} disabled={isCreating}>Cancel</Button>
                  <Button className="flex-1 bg-primary text-primary-foreground" onClick={handleCreateUser} disabled={isCreating}>
                    {isCreating ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating...</>) : 'Create User'}
                  </Button>
                </div>
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>

        {/* ========== EDIT USER DIALOG ========== */}
        <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) { setSelectedUser(null); setEditPhotoFile(null); setEditPhotoPreview(null); }
        }}>
          <DialogContent className={editSelectedRoleName === 'student' ? 'max-w-2xl max-h-[90vh]' : 'max-w-md'}>
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>Update user details.</DialogDescription>
            </DialogHeader>
            <ScrollArea className={editSelectedRoleName === 'student' ? 'max-h-[70vh] pr-4' : ''}>
              <div className="space-y-4 mt-4">
                {/* Photo for student */}
                {editSelectedRoleName === 'student' && (
                  <PhotoUploadArea preview={editPhotoPreview} inputRef={editPhotoInputRef as React.RefObject<HTMLInputElement>} isEdit={true} />
                )}

                <div className="space-y-2">
                  <Label>Full Name <span className="text-destructive">*</span></Label>
                  <Input placeholder="Enter full name" value={editFormData.fullName} onChange={(e) => setEditFormData({ ...editFormData, fullName: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select
                    value={editFormData.roleId}
                    onValueChange={(value) => {
                      const r = roles.find(x => x.id === value);
                      setEditFormData(cur => ({
                        ...cur,
                        roleId: value,
                        role: r?.name.toLowerCase() || '',
                        batchId: r?.name.toLowerCase() === 'student' ? cur.batchId : '',
                        subjectIds: r?.name.toLowerCase() === 'faculty' ? cur.subjectIds : [],
                      }));
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                    <SelectContent>
                      {roles.length === 0 ? (
                        <SelectItem value="loading" disabled>Loading...</SelectItem>
                      ) : roles.map(role => (
                        <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Student: Batch */}
                {editSelectedRoleName === 'student' && (
                  <div className="space-y-2">
                    <Label>Batch <span className="text-destructive">*</span></Label>
                    <Select value={editFormData.batchId} onValueChange={(v) => setEditFormData({ ...editFormData, batchId: v })}>
                      <SelectTrigger><SelectValue placeholder="Select batch" /></SelectTrigger>
                      <SelectContent>
                        {batches.length === 0 ? (
                          <SelectItem value="none" disabled>No batches</SelectItem>
                        ) : batches.map(batch => (
                          <SelectItem key={batch.id} value={batch.id}>{batch.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Faculty: Subjects */}
                {editSelectedRoleName === 'faculty' && (
                  <SubjectPicker
                    selected={editFormData.subjectIds}
                    onToggle={(id) => setEditFormData(prev => ({
                      ...prev,
                      subjectIds: prev.subjectIds.includes(id)
                        ? prev.subjectIds.filter(x => x !== id)
                        : [...prev.subjectIds, id],
                    }))}
                  />
                )}

                {/* Student: Full Registration Form */}
                {editSelectedRoleName === 'student' && (
                  <StudentFormFields data={editFormData} onChange={(field, value) => setEditFormData(prev => ({ ...prev, [field]: value }))} />
                )}

                {/* Status */}
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={editFormData.isActive ? 'active' : 'inactive'} onValueChange={(v) => setEditFormData(prev => ({ ...prev, isActive: v === 'active' }))}>
                    <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button variant="outline" className="flex-1" onClick={() => setIsEditDialogOpen(false)} disabled={isUpdating}>Cancel</Button>
                  <Button className="flex-1 bg-primary text-primary-foreground" onClick={handleUpdateUser} disabled={isUpdating}>
                    {isUpdating ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>) : 'Save Changes'}
                  </Button>
                </div>
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Users', value: stats.total, icon: Users, color: 'bg-primary/10 text-primary' },
          { label: 'Students', value: stats.students, icon: GraduationCap, color: 'bg-accent/10 text-accent' },
          { label: 'Faculty', value: stats.faculty, icon: Users, color: 'bg-success/10 text-success' },
          { label: 'Admins', value: stats.admins, icon: Shield, color: 'bg-warning/10 text-warning' },
        ].map((stat) => (
          <Card key={stat.label} className="border shadow-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg ${stat.color} flex items-center justify-center`}>
                  <stat.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Users Table */}
      <Card className="border shadow-card">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search users..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-40">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="student">Students</SelectItem>
                <SelectItem value="faculty">Faculty</SelectItem>
                <SelectItem value="admin">Admins</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="hidden md:table-cell">Batch</TableHead>
                  <TableHead className="hidden lg:table-cell">NFC ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />Loading users...
                    </TableCell>
                  </TableRow>
                ) : filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No users found</TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((userItem, index) => {
                    const RoleIcon = getRoleIcon(userItem.role);
                    return (
                      <TableRow key={userItem.id} className="animate-fade-in" style={{ animationDelay: `${index * 50}ms` }}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="w-9 h-9">
                              {userItem.avatar_url && <AvatarImage src={userItem.avatar_url} />}
                              <AvatarFallback className="bg-primary/10 text-primary text-sm">
                                {userItem.full_name?.charAt(0) || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-foreground">{userItem.full_name}</p>
                              <p className="text-sm text-muted-foreground">{userItem.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getRoleBadgeColor(userItem.role)}>
                            <RoleIcon className="w-3 h-3 mr-1" />
                            {userItem.role.charAt(0).toUpperCase() + userItem.role.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          {resolveBatchName(userItem.metadata)}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <code className="text-xs bg-muted px-2 py-1 rounded">{userItem.nfc_id || '-'}</code>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={userItem.is_active ? 'bg-success/10 text-success border-success/20' : 'bg-muted text-muted-foreground'}>
                            {userItem.is_active ? 'active' : 'inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditDialog(userItem)}>
                                <Edit className="w-4 h-4 mr-2" />Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <CreditCard className="w-4 h-4 mr-2" />Generate ID Card
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteUser(userItem.id, userItem.full_name || 'User')}>
                                <Trash2 className="w-4 h-4 mr-2" />Deactivate
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
