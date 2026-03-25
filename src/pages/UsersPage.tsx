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
  Settings,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useBranch } from '@/contexts/BranchContext';
import { userService } from '@/services/userService';
import { batchService } from '@/services/batchService';
import * as facultySubjectService from '@/services/facultySubjectService';
import * as moduleGroupFacultyService from '@/services/moduleGroupFacultyService';
import * as studentDetailService from '@/services/studentDetailService';
import * as courseServiceModule from '@/services/courseService';
import { sendRegistrationMessage } from '@/services/whatsappService';
import { admissionSourceService, type AdmissionSource } from '@/services/admissionSourceService';
import { referenceService, type Reference } from '@/services/referenceService';
import { designationService, type Designation } from '@/services/designationService';
import { PAYMENT_METHODS } from '@/constants/paymentMethods';
import { STATE_CITY_MAP, STATE_OPTIONS } from '@/constants/locationData';
import { useToast } from '@/hooks/use-toast';
import { Tables } from '@/types/database';
import { supabase } from '@/lib/supabase';

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

const formatRegistrationDate = (dateValue?: string | null) => {
  if (!dateValue) return '—';
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
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

interface ModuleGroupItem {
  id: string;
  name: string;
  subject_id: string;
  subject_name: string;
}

const emptyStudentData = {
  address: '',
  city: '',
  state: '',
  pincode: '',
  dateOfBirth: '',
  gender: '',
  bloodGroup: '',
  mobile: '',
  whatsapp: '',
  landline: '',
  aadhaar: '',
  qualification: '',
  graduationYear: '',
  graduationCollege: '',
  admissionSource: '',
  reference: '',
  remarks: '',
  fatherName: '',
  motherName: '',
  parentEmail: '',
  parentMobile: '',
};

// ── Extracted components (outside main component to avoid remount on every keystroke) ──

function StudentFormFields({
  data,
  onChange,
  admissionSources,
  references,
  onOpenAdmissionSourceManager,
  onOpenReferenceManager,
}: {
  data: typeof emptyStudentData;
  onChange: (field: string, value: string) => void;
  admissionSources: AdmissionSource[];
  references: Reference[];
  onOpenAdmissionSourceManager: () => void;
  onOpenReferenceManager: () => void;
}) {
  const [newCityName, setNewCityName] = useState('');
  const [customCitiesByState, setCustomCitiesByState] = useState<Record<string, string[]>>({});
  const [removedCitiesByState, setRemovedCitiesByState] = useState<Record<string, string[]>>({});

  const baseCities = data.state ? STATE_CITY_MAP[data.state] || [] : [];
  const customCities = data.state ? customCitiesByState[data.state] || [] : [];
  const removedCities = data.state ? removedCitiesByState[data.state] || [] : [];
  const cityOptions = Array.from(new Set([...baseCities, ...customCities]))
    .filter((city) => !removedCities.includes(city))
    .sort((a, b) => a.localeCompare(b));

  const handleAddCity = () => {
    if (!data.state || !newCityName.trim()) return;
    const cityName = newCityName.trim();
    setCustomCitiesByState((prev) => ({
      ...prev,
      [data.state]: Array.from(new Set([...(prev[data.state] || []), cityName])),
    }));
    setRemovedCitiesByState((prev) => ({
      ...prev,
      [data.state]: (prev[data.state] || []).filter((city) => city !== cityName),
    }));
    onChange('city', cityName);
    setNewCityName('');
  };

  const handleDeleteSelectedCity = () => {
    if (!data.state || !data.city) return;
    const selectedCity = data.city;
    setRemovedCitiesByState((prev) => ({
      ...prev,
      [data.state]: Array.from(new Set([...(prev[data.state] || []), selectedCity])),
    }));
    setCustomCitiesByState((prev) => ({
      ...prev,
      [data.state]: (prev[data.state] || []).filter((city) => city !== selectedCity),
    }));
    onChange('city', '');
  };

  return (
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
            <Label className="text-xs">State <span className="text-destructive">*</span></Label>
            <Select
              value={data.state || ''}
              onValueChange={(value) => {
                onChange('state', value);
                if (!STATE_CITY_MAP[value]?.includes(data.city) && !(customCitiesByState[value] || []).includes(data.city)) {
                  onChange('city', '');
                }
              }}
            >
              <SelectTrigger className="text-sm"><SelectValue placeholder="Select state" /></SelectTrigger>
              <SelectContent>
                {STATE_OPTIONS.map((stateName) => (
                  <SelectItem key={stateName} value={stateName}>{stateName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">City <span className="text-destructive">*</span></Label>
            <Select value={data.city || ''} onValueChange={(value) => onChange('city', value)} disabled={!data.state}>
              <SelectTrigger className="text-sm"><SelectValue placeholder={data.state ? 'Select city' : 'Select state first'} /></SelectTrigger>
              <SelectContent>
                {cityOptions.map((cityName) => (
                  <SelectItem key={cityName} value={cityName}>{cityName}</SelectItem>
                ))}
                {cityOptions.length === 0 && <SelectItem value="__none__" disabled>No cities available</SelectItem>}
              </SelectContent>
            </Select>
            {data.state && (
              <div className="flex items-center gap-1 mt-1">
                <Input
                  placeholder="Add city..."
                  value={newCityName}
                  onChange={(e) => setNewCityName(e.target.value)}
                  className="text-xs h-7 flex-1"
                />
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs px-2" disabled={!newCityName.trim()} onClick={handleAddCity}>
                  Add
                </Button>
              </div>
            )}
            {data.state && data.city && (
              <Button type="button" variant="ghost" size="sm" className="h-6 text-xs text-destructive px-1" onClick={handleDeleteSelectedCity}>
                Delete "{data.city}"
              </Button>
            )}
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
          <div className="space-y-1">
            <Label className="text-xs">Blood Group</Label>
            <Select value={data.bloodGroup || ''} onValueChange={(v) => onChange('bloodGroup', v)}>
              <SelectTrigger className="text-sm"><SelectValue placeholder="Select blood group" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="A+">A+</SelectItem>
                <SelectItem value="A-">A-</SelectItem>
                <SelectItem value="B+">B+</SelectItem>
                <SelectItem value="B-">B-</SelectItem>
                <SelectItem value="O+">O+</SelectItem>
                <SelectItem value="O-">O-</SelectItem>
                <SelectItem value="AB+">AB+</SelectItem>
                <SelectItem value="AB-">AB-</SelectItem>
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
            <Select value={data.admissionSource || ''} onValueChange={(v) => onChange('admissionSource', v)}>
              <SelectTrigger className="text-sm"><SelectValue placeholder="Select source" /></SelectTrigger>
              <SelectContent>
                {admissionSources.map(s => (
                  <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                ))}
                {admissionSources.length === 0 && (
                  <SelectItem value="__none__" disabled>No sources found</SelectItem>
                )}
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs mt-1" onClick={onOpenAdmissionSourceManager}>
              Manage Sources
            </Button>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Academic Counselor/Reference <span className="text-destructive">*</span></Label>
            <Select value={data.reference || ''} onValueChange={(value) => onChange('reference', value)}>
              <SelectTrigger className="text-sm"><SelectValue placeholder="Select reference" /></SelectTrigger>
              <SelectContent>
                {references.map((reference) => (
                  <SelectItem key={reference.id} value={reference.name}>{reference.name}</SelectItem>
                ))}
                {references.length === 0 && <SelectItem value="__none__" disabled>No references found</SelectItem>}
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs mt-1" onClick={onOpenReferenceManager}>
              Manage References
            </Button>
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
}

function SubjectPickerComponent({ selected, onToggle, subjects }: {
  selected: string[];
  onToggle: (id: string) => void;
  subjects: Subject[];
}) {
  return (
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
}

function ModuleGroupPickerComponent({ selected, onToggle, moduleGroups }: {
  selected: string[];
  onToggle: (id: string) => void;
  moduleGroups: ModuleGroupItem[];
}) {
  // Group module groups by subject
  const groupedBySubject = moduleGroups.reduce<Record<string, ModuleGroupItem[]>>((acc, mg) => {
    if (!acc[mg.subject_name]) acc[mg.subject_name] = [];
    acc[mg.subject_name].push(mg);
    return acc;
  }, {});

  return (
    <div className="space-y-2">
      <Label>Modules <span className="text-destructive">*</span></Label>
      <p className="text-xs text-muted-foreground">Select modules this faculty can teach (e.g., QA, RA, English, GK)</p>
      <div className="border rounded-lg max-h-[200px] overflow-y-auto">
        {moduleGroups.length === 0 ? (
          <div className="p-3 text-sm text-muted-foreground text-center">No modules found. Create modules in Study Modules first.</div>
        ) : (
          <div>
            {Object.entries(groupedBySubject).map(([subjectName, groups]) => (
              <div key={subjectName}>
                <div className="px-3 py-1.5 bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b">
                  {subjectName}
                </div>
                <div className="divide-y">
                  {groups.map(mg => (
                    <div key={mg.id} className="flex items-center space-x-3 px-3 py-2 hover:bg-muted/50 transition-colors">
                      <Checkbox
                        id={`mg-${mg.id}`}
                        checked={selected.includes(mg.id)}
                        onCheckedChange={() => onToggle(mg.id)}
                      />
                      <Label htmlFor={`mg-${mg.id}`} className="flex-1 cursor-pointer font-normal flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-primary" />
                        {mg.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map(id => {
            const mg = moduleGroups.find(x => x.id === id);
            return mg ? <Badge key={id} variant="secondary" className="text-xs">{mg.name}</Badge> : null;
          })}
        </div>
      )}
    </div>
  );
}

function PhotoUploadAreaComponent({ preview, inputRef, onPhotoSelect }: {
  preview: string | null;
  inputRef: React.RefObject<HTMLInputElement>;
  onPhotoSelect: (file: File) => void;
}) {
  return (
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
          if (file) onPhotoSelect(file);
        }}
      />
    </div>
  );
}

export default function UsersPage() {
  const { user, refreshUserData } = useAuth();
  const { currentBranchId, branchVersion, isLoading: isBranchLoading } = useBranch();
  const { toast } = useToast();
  const [users, setUsers] = useState<Profile[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [moduleGroups, setModuleGroups] = useState<ModuleGroupItem[]>([]);
  const [courses, setCourses] = useState<courseServiceModule.Course[]>([]);
  const [salesStaffUsers, setSalesStaffUsers] = useState<{id: string; full_name: string}[]>([]);
  const [admissionSources, setAdmissionSources] = useState<AdmissionSource[]>([]);
  const [references, setReferences] = useState<Reference[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [isSourceManagerOpen, setIsSourceManagerOpen] = useState(false);
  const [isReferenceManagerOpen, setIsReferenceManagerOpen] = useState(false);
  const [isDesignationManagerOpen, setIsDesignationManagerOpen] = useState(false);
  const [newAdmissionSourceName, setNewAdmissionSourceName] = useState('');
  const [newReferenceName, setNewReferenceName] = useState('');
  const [newDesignationName, setNewDesignationName] = useState('');
  const [isAddingSource, setIsAddingSource] = useState(false);
  const [isAddingReference, setIsAddingReference] = useState(false);
  const [isAddingDesignation, setIsAddingDesignation] = useState(false);
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
    shortName: '',
    email: '',
    role: 'student',
    roleId: '',
    batchId: '',
    password: '',
    designationId: '',
    subjectIds: [] as string[],
    moduleGroupIds: [] as string[],
    courseId: '',
    salesStaffId: '',
    discountType: 'percentage' as 'percentage' | 'fixed',
    discountValue: '',
    initialPayment: '',
    paymentMethod: 'Cash',
    emiMonths: '6',
    processingCharge: '',
    dueDate: '',
    ...emptyStudentData,
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Edit form state
  const [editFormData, setEditFormData] = useState({
    fullName: '',
    shortName: '',
    nfcId: '',
    role: 'student',
    roleId: '',
    batchId: '',
    designationId: '',
    isActive: true,
    subjectIds: [] as string[],
    moduleGroupIds: [] as string[],
    ...emptyStudentData,
  });
  const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState<string | null>(null);

  const selectedRoleName = roles.find(r => r.id === formData.roleId)?.name?.toLowerCase().replace(/\s+/g, '_') || '';
  const editSelectedRoleName = roles.find(r => r.id === editFormData.roleId)?.name?.toLowerCase().replace(/\s+/g, '_') || '';
  const isSalesStaff = user?.role === 'sales_staff';
  const isAdminUser = user?.role === 'admin' || user?.role === 'super_admin';
  const effectiveBranchId = !isAdminUser
    ? (currentBranchId || user?.branchId || null)
    : currentBranchId;

  const isBatchAllowedForCurrentBranch = (batchId: string) => {
    if (!batchId || !effectiveBranchId) return true;
    const selectedBatch = batches.find((batch) => batch.id === batchId);
    return !!selectedBatch && selectedBatch.branch_id === effectiveBranchId;
  };

  // Filter roles for sales staff — they can only create students
  const availableRoles = isSalesStaff
    ? roles.filter(r => r.name.toLowerCase() === 'student')
    : roles;

  // Auto-select student role for sales_staff users
  useEffect(() => {
    if (isSalesStaff && roles.length > 0 && !formData.roleId) {
      const studentRole = roles.find(r => r.name.toLowerCase() === 'student');
      if (studentRole) {
        setFormData(prev => ({ ...prev, roleId: studentRole.id, role: 'student' }));
      }
    }
  }, [isSalesStaff, roles, formData.roleId]);

  // Fetch roles + subjects + module groups + courses
  useEffect(() => {
    const fetchRolesSubjectsCourses = async () => {
      if (!user?.organizationId) return;
      try {
        const [rolesRes, subjectsRes, moduleGroupsRes, coursesData] = await Promise.all([
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
          supabase
            .from('module_groups')
            .select('id, name, subject_id, module_subjects!inner(name)')
            .eq('organization_id', user.organizationId)
            .order('sort_order', { ascending: true }),
          courseServiceModule.getCourses(user.organizationId),
        ]);
        if (rolesRes.error) throw rolesRes.error;
        if (subjectsRes.error) throw subjectsRes.error;
        setRoles(rolesRes.data || []);
        setSubjects(subjectsRes.data || []);
        setCourses(coursesData);

        // Map module groups with subject names
        if (!moduleGroupsRes.error && moduleGroupsRes.data) {
          const mapped: ModuleGroupItem[] = moduleGroupsRes.data.map((mg: any) => ({
            id: mg.id,
            name: mg.name,
            subject_id: mg.subject_id,
            subject_name: mg.module_subjects?.name || 'Unknown',
          }));
          setModuleGroups(mapped);
        }

        // Load sales staff users for dropdown (admin only)
        if (user?.role === 'admin') {
          const { data: ssData } = await supabase
            .from('profiles')
            .select('id, full_name')
            .eq('organization_id', user.organizationId!)
            .eq('role', 'sales_staff')
            .eq('is_active', true)
            .order('full_name');
          setSalesStaffUsers(ssData || []);
        }

        // Load admission sources + designations
        try {
          const [sources, refs, desigs] = await Promise.all([
            admissionSourceService.getSources(user.organizationId),
            referenceService.getReferences(user.organizationId),
            designationService.getDesignations(user.organizationId),
          ]);
          setAdmissionSources(sources);
          setReferences(refs);
          setDesignations(desigs);
        } catch (e) {
          console.error('Error loading admission sources/references/designations:', e);
        }
      } catch (error) {
        console.error('Error fetching roles/subjects/courses:', error);
      }
    };
    fetchRolesSubjectsCourses();
  }, [user?.organizationId]);

  // Fetch users
  useEffect(() => {
    const initializePage = async () => {
      if (isBranchLoading) return;
      if (!user?.organizationId) {
        try { await refreshUserData(); } catch (error) { console.error('Failed to refresh:', error); }
      }
      if (user?.organizationId) {
        await Promise.all([fetchUsers(), fetchBatches()]);
      }
    };
    initializePage();
  }, [user?.organizationId, effectiveBranchId, branchVersion, isBranchLoading]);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      if (!user?.organizationId) throw new Error('No organization ID');
      const data = await userService.getUsers(user.organizationId, effectiveBranchId);
      let activeUsers = (data || []).filter(u => u.is_active);
      // Sales staff can only see students
      if (isSalesStaff) {
        activeUsers = activeUsers.filter(u => u.role === 'student');
      }
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
      const data = await batchService.getBatches(user.organizationId, effectiveBranchId);
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
        if (!isBatchAllowedForCurrentBranch(formData.batchId)) {
          toast({ title: 'Error', description: 'Selected batch does not belong to the current branch', variant: 'destructive' });
          return;
        }
        const err = validateStudentFields(formData);
        if (err) { toast({ title: 'Error', description: err, variant: 'destructive' }); return; }
      }
      if (selectedRoleName === 'faculty' && formData.moduleGroupIds.length === 0) {
        toast({ title: 'Error', description: 'Select at least one module for the faculty', variant: 'destructive' });
        return;
      }

      setIsCreating(true);
      if (!user?.organizationId) throw new Error('No organization ID available');

      const normalizedRole = (formData.role || '').toLowerCase().replace(/\s+/g, '_') as 'faculty' | 'student' | 'sales_staff';

      const result = await userService.createUser(
        user.organizationId,
        formData.email,
        formData.fullName,
        normalizedRole,
        formData.password,
        selectedRoleName === 'student' ? formData.batchId : undefined,
        effectiveBranchId,
        formData.roleId
      );

      const newUserId = result.user?.id;

      if (newUserId) {
        const profileUpdate: Record<string, any> = {};
        if (effectiveBranchId) profileUpdate.branch_id = effectiveBranchId;
        if (formData.roleId) profileUpdate.role_id = formData.roleId;
        if (formData.shortName?.trim()) profileUpdate.short_name = formData.shortName.trim();
        if (formData.designationId) profileUpdate.designation_id = formData.designationId;
        if (Object.keys(profileUpdate).length > 0) {
          // Wait for the profile trigger to complete before performing profile updates or inserting related records
          let profileReady = false;
          let profileErrorLog = null;
          for (let i = 0; i < 15; i++) {
            const { data: p, error: pError } = await supabase.from('profiles').select('id').eq('id', newUserId).maybeSingle();
            if (p) {
              profileReady = true;
              break;
            } else if (pError) {
              profileErrorLog = pError;
            }
            await new Promise(r => setTimeout(r, 600)); // sleep 600ms
          }

          if (!profileReady) {
            console.error('Profile creation timeout or error:', profileErrorLog);
            throw new Error('User account created but profile setup failed or timed out. Please try editing the user to assign modules.');
          }

          await supabase.from('profiles').update(profileUpdate as any).eq('id', newUserId);
        }
      }

      // Faculty: save subjects + module group assignments
      if (newUserId && selectedRoleName === 'faculty' && formData.subjectIds.length > 0) {
        await facultySubjectService.setFacultySubjects(newUserId, user.organizationId, formData.subjectIds);
      }
      if (newUserId && selectedRoleName === 'faculty' && formData.moduleGroupIds.length > 0) {
        await moduleGroupFacultyService.setGroupFacultyForFaculty(
          newUserId,
          user.organizationId,
          formData.moduleGroupIds
        );
      }

      // Student: save details + photo
      if (newUserId && selectedRoleName === 'student') {
        // (Profile already waited for above)

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
          reference: formData.reference || undefined,
          remarks: formData.remarks || undefined,
          blood_group: formData.bloodGroup || undefined,
          father_name: formData.fatherName || undefined,
          mother_name: formData.motherName || undefined,
          parent_email: formData.parentEmail || undefined,
          parent_mobile: formData.parentMobile,
          sales_staff_id: formData.salesStaffId || (isSalesStaff ? user.id : null) || undefined,
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
          const processingCharge = formData.paymentMethod === 'Bajaj EMI' ? Math.max(parseFloat(formData.processingCharge) || 0, 0) : 0;
          const payableAmount = finalAmount + processingCharge;
          const emiMonths = Math.max(parseInt(formData.emiMonths || '1', 10) || 1, 1);
          const computedFirstEmiAmount = formData.paymentMethod === 'Bajaj EMI' ? Number((payableAmount / emiMonths).toFixed(2)) : 0;
          const initialPay = formData.paymentMethod === 'Bajaj EMI'
            ? computedFirstEmiAmount
            : Math.min(parseFloat(formData.initialPayment) || 0, payableAmount);

          // Supabase payment
          let paymentRecordId: string | null = null;
          try {
            const { data: paymentData } = await supabase.from('payments').insert({
              organization_id: user.organizationId,
              branch_id: currentBranchId || undefined,
              student_id: newUserId,
              student_name: formData.fullName,
              course_name: selectedCourse.name,
              total_fee: courseFee,
              discount_amount: discountAmount,
              amount: payableAmount,
              amount_paid: initialPay,
              due_date: formData.dueDate || null,
              status: initialPay >= payableAmount ? 'completed' : initialPay > 0 ? 'partial' : 'pending',
              notes: `Course: ${selectedCourse.name}${discountAmount > 0 ? ` | Discount: ₹${discountAmount.toFixed(0)}` : ''}${processingCharge > 0 ? ` | Processing: ₹${processingCharge.toFixed(0)}` : ''}${formData.paymentMethod === 'Bajaj EMI' ? ` | EMI: ${emiMonths} months | First EMI: ₹${computedFirstEmiAmount.toFixed(2)}` : ''}`,
              payment_method: formData.paymentMethod || 'Cash',
              sales_staff_id: formData.salesStaffId || (isSalesStaff ? user.id : null),
            } as any).select('id').single();
            paymentRecordId = paymentData?.id || null;
          } catch (payErr) {
            console.error('Supabase payment error:', payErr);
          }

          // Record initial payment as fee_payment installment
          if (initialPay > 0 && paymentRecordId) {
            try {
              await supabase.from('fee_payments').insert({
                payment_id: paymentRecordId,
                organization_id: user.organizationId,
                amount: initialPay,
                date: new Date().toISOString().split('T')[0],
                mode: formData.paymentMethod || 'Cash',
                sales_staff_id: formData.salesStaffId || (isSalesStaff ? user.id : null),
              });
            } catch (fpErr) {
              console.error('fee_payments insert error:', fpErr);
            }
          }

          // Also add initial payment as income transaction in Supabase
          if (initialPay > 0) {
            try {
              await supabase.from('transactions').insert({
                organization_id: user.organizationId,
                branch_id: currentBranchId || null,
                type: 'income',
                description: `Initial Payment: ${selectedCourse.name} — ${formData.fullName}`,
                amount: initialPay,
                category: 'Course Fee',
                date: new Date().toISOString(),
                mode: formData.paymentMethod || 'Cash',
                recurrence: 'one-time',
                paused: false,
                created_by: user.id,
                sales_staff_id: formData.salesStaffId || (isSalesStaff ? user.id : null),
              });
            } catch (txnErr) {
              console.error('transactions insert error:', txnErr);
            }
          }
        }
      }

      // Send WhatsApp registration message for students
      if (newUserId && selectedRoleName === 'student' && formData.mobile) {
        const selectedCourse = formData.courseId ? courses.find(c => c.id === formData.courseId) : null;
        try {
          await sendRegistrationMessage({
            to: formData.whatsapp || formData.mobile,
            studentName: formData.fullName,
            email: formData.email,
            password: formData.password,
            courseName: selectedCourse?.name,
            organizationName: user.organizationName,
          });
        } catch (waErr) {
          console.error('WhatsApp registration message failed:', waErr);
          // Don't block user creation on WhatsApp failure
        }
      }

      const esslStatus = (result as any)?.essl;
      const studentCode = (result as any)?.profile?.student_number || esslStatus?.employeeCode;

      toast({
        title: esslStatus && !esslStatus.synced && !esslStatus.skipped ? 'Created with warning' : 'Success',
        description: esslStatus?.synced
          ? `User ${formData.fullName} created and synced to ESSL${studentCode ? ` with code ${studentCode}` : ''}${esslStatus.cardNumber ? ` and card ${esslStatus.cardNumber}` : ''}.`
          : esslStatus && !esslStatus.skipped
            ? `User ${formData.fullName} was created, but ESSL sync failed: ${esslStatus.error || 'Unknown error'}`
            : `User ${formData.fullName} created successfully${studentCode ? ` with code ${studentCode}` : ''}${esslStatus?.cardNumber ? ` and card ${esslStatus.cardNumber}` : ''}.`,
      });
      setFormData({ fullName: '', shortName: '', email: '', role: 'student', roleId: '', batchId: '', password: '', designationId: '', subjectIds: [], moduleGroupIds: [], courseId: '', salesStaffId: '', discountType: 'percentage', discountValue: '', initialPayment: '', paymentMethod: 'Cash', emiMonths: '6', processingCharge: '', dueDate: '', ...emptyStudentData });
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

  const handleAddAdmissionSource = async (name: string) => {
    if (!user?.organizationId) return;
    try {
      if (!name.trim()) return;
      setIsAddingSource(true);
      await admissionSourceService.addSource(user.organizationId, name);
      const sources = await admissionSourceService.getSources(user.organizationId);
      setAdmissionSources(sources);
      setNewAdmissionSourceName('');
    } catch (e) {
      console.error('Error adding admission source:', e);
      toast({ title: 'Error', description: 'Failed to add source', variant: 'destructive' });
    } finally {
      setIsAddingSource(false);
    }
  };

  const handleDeleteAdmissionSource = async (id: string) => {
    if (!user?.organizationId) return;
    try {
      const sourceToDelete = admissionSources.find((source) => source.id === id);
      await admissionSourceService.deleteSource(id);
      const sources = await admissionSourceService.getSources(user.organizationId);
      setAdmissionSources(sources);
      if (sourceToDelete?.name) {
        setFormData((prev) => ({
          ...prev,
          admissionSource: prev.admissionSource === sourceToDelete.name ? '' : prev.admissionSource,
        }));
        setEditFormData((prev) => ({
          ...prev,
          admissionSource: prev.admissionSource === sourceToDelete.name ? '' : prev.admissionSource,
        }));
      }
    } catch (e) {
      console.error('Error deleting admission source:', e);
      toast({ title: 'Error', description: 'Failed to delete source', variant: 'destructive' });
    }
  };

  const handleAddReference = async (name: string) => {
    if (!user?.organizationId) return;
    try {
      if (!name.trim()) return;
      setIsAddingReference(true);
      await referenceService.addReference(user.organizationId, name);
      const refs = await referenceService.getReferences(user.organizationId);
      setReferences(refs);
      setNewReferenceName('');
    } catch (e) {
      console.error('Error adding reference:', e);
      toast({ title: 'Error', description: 'Failed to add reference', variant: 'destructive' });
    } finally {
      setIsAddingReference(false);
    }
  };

  const handleDeleteReference = async (id: string) => {
    if (!user?.organizationId) return;
    try {
      const referenceToDelete = references.find((reference) => reference.id === id);
      await referenceService.deleteReference(id);
      const refs = await referenceService.getReferences(user.organizationId);
      setReferences(refs);
      if (referenceToDelete?.name) {
        setFormData((prev) => ({
          ...prev,
          reference: prev.reference === referenceToDelete.name ? '' : prev.reference,
        }));
        setEditFormData((prev) => ({
          ...prev,
          reference: prev.reference === referenceToDelete.name ? '' : prev.reference,
        }));
      }
    } catch (e) {
      console.error('Error deleting reference:', e);
      toast({ title: 'Error', description: 'Failed to delete reference', variant: 'destructive' });
    }
  };

  const handleAddDesignation = async (name: string) => {
    if (!user?.organizationId) return;
    try {
      if (!name.trim()) return;
      setIsAddingDesignation(true);
      await designationService.addDesignation(user.organizationId, name);
      const desigs = await designationService.getDesignations(user.organizationId);
      setDesignations(desigs);
      setNewDesignationName('');
    } catch (e) {
      console.error('Error adding designation:', e);
      toast({ title: 'Error', description: 'Failed to add designation', variant: 'destructive' });
    } finally {
      setIsAddingDesignation(false);
    }
  };

  const handleDeleteDesignation = async (id: string) => {
    if (!user?.organizationId) return;
    try {
      const designationToDelete = designations.find((d) => d.id === id);
      await designationService.deleteDesignation(id);
      const desigs = await designationService.getDesignations(user.organizationId);
      setDesignations(desigs);
      if (designationToDelete) {
        setFormData((prev) => ({
          ...prev,
          designationId: prev.designationId === designationToDelete.id ? '' : prev.designationId,
        }));
        setEditFormData((prev) => ({
          ...prev,
          designationId: prev.designationId === designationToDelete.id ? '' : prev.designationId,
        }));
      }
    } catch (e) {
      console.error('Error deleting designation:', e);
      toast({ title: 'Error', description: 'Failed to delete designation', variant: 'destructive' });
    }
  };

  const resolveDesignationName = (designationId: string | null | undefined) => {
    if (!designationId) return '-';
    const d = designations.find(d => d.id === designationId);
    return d?.name || '-';
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
    // Derive roleId: use profile.role_id if available, otherwise match by name
    const resolvedRoleId = profile.role_id
      || roles.find(r => r.name.toLowerCase() === roleName.toLowerCase())?.id
      || '';
    setEditFormData({
      fullName: profile.full_name || '',
      shortName: (profile as any).short_name || '',
      nfcId: profile.nfc_id || '',
      role: roleName,
      roleId: resolvedRoleId,
      batchId: getBatchIdFromMetadata(profile.metadata) || '',
      designationId: (profile as any).designation_id || '',
      isActive: Boolean(profile.is_active),
      subjectIds: [],
      moduleGroupIds: [],
      ...emptyStudentData,
    });
    setEditPhotoFile(null);
    // Load existing avatar_url as photo preview for all roles
    setEditPhotoPreview(profile.avatar_url || null);
    setIsEditDialogOpen(true);

    if (roleName === 'faculty') {
      try {
        const subs = await facultySubjectService.getFacultySubjects(profile.id);
        const mgIds = await moduleGroupFacultyService.getGroupsForFaculty(profile.id);
        setEditFormData(prev => ({ ...prev, subjectIds: subs, moduleGroupIds: mgIds }));
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
            bloodGroup: detail.blood_group || '',
            mobile: detail.mobile || '',
            whatsapp: detail.whatsapp || '',
            landline: detail.landline || '',
            aadhaar: detail.aadhaar || '',
            qualification: detail.qualification || '',
            graduationYear: detail.graduation_year || '',
            graduationCollege: detail.graduation_college || '',
            admissionSource: detail.admission_source || '',
            reference: detail.reference || '',
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
      if (!isBatchAllowedForCurrentBranch(editFormData.batchId)) {
        toast({ title: 'Error', description: 'Selected batch does not belong to the current branch', variant: 'destructive' });
        return;
      }
      const err = validateStudentFields(editFormData);
      if (err) { toast({ title: 'Error', description: err, variant: 'destructive' }); return; }
    }
    if (editFormData.nfcId && !/^\d{9}$/.test(editFormData.nfcId.trim())) {
      toast({ title: 'Error', description: 'RFID / NFC Card ID must be exactly 9 digits', variant: 'destructive' });
      return;
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
        short_name: editFormData.shortName?.trim() || null,
        nfc_id: editFormData.nfcId?.trim() || null,
        role: editFormData.role as 'admin' | 'faculty' | 'student',
        role_id: editFormData.roleId,
        designation_id: editFormData.designationId || null,
        is_active: editFormData.isActive,
        metadata: nextMetadata,
      } as any);

      // Faculty: update subjects + module group assignments
      if (editSelectedRoleName === 'faculty' && user?.organizationId) {
        await facultySubjectService.setFacultySubjects(selectedUser.id, user.organizationId, editFormData.subjectIds);
        await moduleGroupFacultyService.setGroupFacultyForFaculty(
          selectedUser.id,
          user.organizationId,
          editFormData.moduleGroupIds
        );
      }

      // Upload photo for non-student roles
      if (editSelectedRoleName !== 'student' && editPhotoFile && user?.organizationId) {
        await studentDetailService.uploadStudentPhoto(user.organizationId, selectedUser.id, editPhotoFile);
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
          reference: editFormData.reference || undefined,
          remarks: editFormData.remarks || undefined,
          blood_group: editFormData.bloodGroup || undefined,
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
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
            {isSalesStaff ? 'Student Management' : 'User Management'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isSalesStaff ? 'Manage and register students' : 'Manage students, faculty, and administrators'}
          </p>
        </div>

        {/* ========== ADD USER DIALOG ========== */}
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
          setIsAddDialogOpen(open);
          if (!open) {
            setFormData({ fullName: '', shortName: '', email: '', role: 'student', roleId: '', batchId: '', password: '', designationId: '', subjectIds: [], moduleGroupIds: [], courseId: '', salesStaffId: '', discountType: 'percentage', discountValue: '', initialPayment: '', paymentMethod: 'Cash', emiMonths: '6', processingCharge: '', dueDate: '', ...emptyStudentData });
            setPhotoFile(null);
            setPhotoPreview(null);
          }
        }}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground"><Plus className="w-4 h-4 mr-2" />Add User</Button>
          </DialogTrigger>
          <DialogContent className={selectedRoleName === 'student' ? 'w-screen h-screen max-w-none max-h-none left-0 top-0 translate-x-0 translate-y-0 rounded-none border-0 p-0 gap-0 sm:rounded-none' : 'max-w-md'}>
            <DialogHeader className={selectedRoleName === 'student' ? 'px-6 pt-6 pb-4 border-b' : ''}>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>Create a new user account.</DialogDescription>
            </DialogHeader>
            <ScrollArea className={selectedRoleName === 'student' ? 'h-[calc(100vh-112px)] px-6 pb-6' : ''}>
              <div className="space-y-4 mt-4">
                {/* Photo upload for student */}
                {selectedRoleName === 'student' && (
                  <PhotoUploadAreaComponent preview={photoPreview} inputRef={photoInputRef as React.RefObject<HTMLInputElement>} onPhotoSelect={(file) => handlePhotoSelect(file, false)} />
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

                {/* Short Name for faculty */}
                {selectedRoleName === 'faculty' && (
                  <div className="space-y-2">
                    <Label>Short Name</Label>
                    <Input placeholder="e.g., Prof. Kumar" value={formData.shortName} onChange={(e) => setFormData({ ...formData, shortName: e.target.value })} />
                    <p className="text-xs text-muted-foreground">Displayed in schedules and sessions instead of full name</p>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Password <span className="text-destructive">*</span></Label>
                    <Input type="password" placeholder={selectedRoleName === 'student' ? 'Auto-set to mobile number' : 'Temporary password'} value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} />
                    {selectedRoleName === 'student' && <p className="text-xs text-muted-foreground">Auto-filled with student's mobile number</p>}
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
                          role: r?.name.toLowerCase().replace(/\s+/g, '_') || '',
                          batchId: r?.name.toLowerCase() === 'student' ? cur.batchId : '',
                          subjectIds: r?.name.toLowerCase() === 'faculty' ? cur.subjectIds : [],
                        }));
                      }}
                      disabled={isSalesStaff}
                    >
                      <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                      <SelectContent>
                        {availableRoles.length === 0 ? (
                          <SelectItem value="loading" disabled>Loading roles...</SelectItem>
                        ) : availableRoles.map(role => (
                          <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Designation dropdown for all roles */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Designation</Label>
                    <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setIsDesignationManagerOpen(true)}>
                      <Settings className="w-3 h-3 mr-1" /> Manage
                    </Button>
                  </div>
                  <Select value={formData.designationId} onValueChange={(v) => setFormData({ ...formData, designationId: v })}>
                    <SelectTrigger><SelectValue placeholder="Select designation" /></SelectTrigger>
                    <SelectContent>
                      {designations.length === 0 ? (
                        <SelectItem value="none" disabled>No designations — click Manage to add</SelectItem>
                      ) : designations.map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Student: Course first, then Batch filtered by course */}
                {selectedRoleName === 'student' && (
                  <>
                    <div className="space-y-2">
                      <Label>Course <span className="text-destructive">*</span></Label>
                      <Select value={formData.courseId} onValueChange={(v) => {
                        setFormData(prev => ({ ...prev, courseId: v, batchId: '', discountValue: '' }));
                      }}>
                        <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
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

                    <div className="space-y-2">
                      <Label>Batch <span className="text-destructive">*</span></Label>
                      <Select value={formData.batchId} onValueChange={(v) => setFormData({ ...formData, batchId: v })} disabled={!formData.courseId}>
                        <SelectTrigger><SelectValue placeholder={formData.courseId ? "Select batch" : "Select a course first"} /></SelectTrigger>
                        <SelectContent>
                          {isBatchesLoading ? (
                            <SelectItem value="loading" disabled>Loading...</SelectItem>
                          ) : (() => {
                            const filteredBatches = formData.courseId
                              ? batches.filter(b => b.module_subject_id === formData.courseId)
                              : batches;
                            return filteredBatches.length === 0 ? (
                              <SelectItem value="none" disabled>No batches found for this course</SelectItem>
                            ) : filteredBatches.map(batch => (
                              <SelectItem key={batch.id} value={batch.id}>{batch.name}</SelectItem>
                            ));
                          })()}
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
                      const processingCharge = formData.paymentMethod === 'Bajaj EMI' ? Math.max(parseFloat(formData.processingCharge) || 0, 0) : 0;
                      const payableAmount = finalAmount + processingCharge;
                      const emiMonths = Math.max(parseInt(formData.emiMonths || '1', 10) || 1, 1);
                      const computedFirstEmiAmount = formData.paymentMethod === 'Bajaj EMI' ? Number((payableAmount / emiMonths).toFixed(2)) : 0;
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
                            <span className="text-lg font-bold text-primary">₹{payableAmount.toLocaleString('en-IN')}</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 border-t pt-2">
                            <div className="space-y-1">
                              <Label className="text-xs">Initial Payment (₹)</Label>
                              <Input
                                type="number"
                                min="0"
                                max={payableAmount}
                                value={formData.paymentMethod === 'Bajaj EMI' ? computedFirstEmiAmount.toString() : formData.initialPayment}
                                onChange={(e) => setFormData(prev => ({ ...prev, initialPayment: e.target.value }))}
                                placeholder={formData.paymentMethod === 'Bajaj EMI' ? 'Auto EMI amount' : '0 (full later)'}
                                disabled={formData.paymentMethod === 'Bajaj EMI'}
                                className="h-9"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Payment Method</Label>
                              <Select
                                value={formData.paymentMethod}
                                onValueChange={(value) => setFormData(prev => ({
                                  ...prev,
                                  paymentMethod: value,
                                  initialPayment: value === 'Bajaj EMI' ? prev.initialPayment : prev.initialPayment,
                                }))}
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue placeholder="Select method" />
                                </SelectTrigger>
                                <SelectContent>
                                  {PAYMENT_METHODS.map((method) => (
                                    <SelectItem key={method} value={method}>{method}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            {formData.paymentMethod === 'Bajaj EMI' && (
                              <>
                                <div className="space-y-1">
                                  <Label className="text-xs">EMI Months</Label>
                                  <Select value={formData.emiMonths} onValueChange={(value) => setFormData(prev => ({ ...prev, emiMonths: value }))}>
                                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      {[3, 6, 9, 12, 18, 24].map((months) => (
                                        <SelectItem key={months} value={String(months)}>{months} months</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Processing Charge (₹)</Label>
                                  <Input
                                    type="number"
                                    min="0"
                                    value={formData.processingCharge}
                                    onChange={(e) => setFormData(prev => ({ ...prev, processingCharge: e.target.value }))}
                                    placeholder="0"
                                    className="h-9"
                                  />
                                </div>
                                <div className="sm:col-span-3 text-xs text-muted-foreground">
                                  First EMI Amount: ₹{computedFirstEmiAmount.toFixed(2)} ({payableAmount.toFixed(2)} / {emiMonths})
                                </div>
                              </>
                            )}
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
                            const ip = formData.paymentMethod === 'Bajaj EMI'
                              ? computedFirstEmiAmount
                              : parseFloat(formData.initialPayment) || 0;
                            const remaining = payableAmount - ip;
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

                {/* Sales Staff Dropdown (admin only, for student creation) */}
                {selectedRoleName === 'student' && user?.role === 'admin' && salesStaffUsers.length > 0 && (
                  <div className="space-y-2">
                    <Label>Sales Staff</Label>
                    <Select value={formData.salesStaffId || "__none__"} onValueChange={(v) => setFormData(prev => ({ ...prev, salesStaffId: v === "__none__" ? "" : v }))}>
                      <SelectTrigger><SelectValue placeholder="Assign sales staff (optional)" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {salesStaffUsers.map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Link this student to a sales staff member for reporting</p>
                  </div>
                )}

                {/* Faculty: Modules */}
                {selectedRoleName === 'faculty' && (
                  <ModuleGroupPickerComponent
                    selected={formData.moduleGroupIds}
                    moduleGroups={moduleGroups}
                    onToggle={(id) => setFormData(prev => ({
                      ...prev,
                      moduleGroupIds: prev.moduleGroupIds.includes(id)
                        ? prev.moduleGroupIds.filter(x => x !== id)
                        : [...prev.moduleGroupIds, id],
                    }))}
                  />
                )}

                {/* Student: Full Registration Form */}
                {selectedRoleName === 'student' && (
                  <StudentFormFields
                    data={formData}
                    onChange={(field, value) => {
                      setFormData(prev => {
                        const updated = { ...prev, [field]: value };
                        // Auto-set password to mobile number for students
                        if (field === 'mobile' && value.trim()) {
                          updated.password = value.trim();
                        }
                        return updated;
                      });
                    }}
                    admissionSources={admissionSources}
                    references={references}
                    onOpenAdmissionSourceManager={() => setIsSourceManagerOpen(true)}
                    onOpenReferenceManager={() => setIsReferenceManagerOpen(true)}
                  />
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
          <DialogContent className={editSelectedRoleName === 'student' ? 'w-screen h-screen max-w-none max-h-none left-0 top-0 translate-x-0 translate-y-0 rounded-none border-0 p-0 gap-0 sm:rounded-none' : 'max-w-md max-h-[90vh]'}>
            <DialogHeader className={editSelectedRoleName === 'student' ? 'px-6 pt-6 pb-4 border-b' : ''}>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>Update user details.</DialogDescription>
            </DialogHeader>
            <ScrollArea className={editSelectedRoleName === 'student' ? 'h-[calc(100vh-112px)] px-6 pb-6' : 'max-h-[calc(90vh-120px)] overflow-y-auto'}>
              <div className="space-y-4 mt-4">
                {/* Photo upload for all roles */}
                <PhotoUploadAreaComponent preview={editPhotoPreview} inputRef={editPhotoInputRef as React.RefObject<HTMLInputElement>} onPhotoSelect={(file) => handlePhotoSelect(file, true)} />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Full Name <span className="text-destructive">*</span></Label>
                    <Input placeholder="Enter full name" value={editFormData.fullName} onChange={(e) => setEditFormData({ ...editFormData, fullName: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>RFID / NFC Card ID</Label>
                    <Input
                      placeholder="Enter 9-digit RFID / NFC card number"
                      value={editFormData.nfcId}
                      inputMode="numeric"
                      maxLength={9}
                      onChange={(e) => setEditFormData({ ...editFormData, nfcId: e.target.value.replace(/\D/g, '').slice(0, 9) })}
                    />
                  </div>
                </div>

                {/* Short Name for faculty */}
                {editSelectedRoleName === 'faculty' && (
                  <div className="space-y-2">
                    <Label>Short Name</Label>
                    <Input placeholder="e.g., Prof. Kumar" value={editFormData.shortName} onChange={(e) => setEditFormData({ ...editFormData, shortName: e.target.value })} />
                    <p className="text-xs text-muted-foreground">Displayed in schedules and sessions instead of full name</p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select
                    value={editFormData.roleId}
                    onValueChange={(value) => {
                      const r = roles.find(x => x.id === value);
                      setEditFormData(cur => ({
                        ...cur,
                        roleId: value,
                        role: r?.name.toLowerCase().replace(/\s+/g, '_') || '',
                        batchId: r?.name.toLowerCase() === 'student' ? cur.batchId : '',
                        subjectIds: r?.name.toLowerCase() === 'faculty' ? cur.subjectIds : [],
                      }));
                    }}
                    disabled={isSalesStaff}
                  >
                    <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                    <SelectContent>
                      {availableRoles.length === 0 ? (
                        <SelectItem value="loading" disabled>Loading...</SelectItem>
                      ) : availableRoles.map(role => (
                        <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Designation dropdown for all roles */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Designation</Label>
                    <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setIsDesignationManagerOpen(true)}>
                      <Settings className="w-3 h-3 mr-1" /> Manage
                    </Button>
                  </div>
                  <Select value={editFormData.designationId} onValueChange={(v) => setEditFormData({ ...editFormData, designationId: v })}>
                    <SelectTrigger><SelectValue placeholder="Select designation" /></SelectTrigger>
                    <SelectContent>
                      {designations.length === 0 ? (
                        <SelectItem value="none" disabled>No designations — click Manage to add</SelectItem>
                      ) : designations.map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
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

                {/* Faculty: Modules */}
                {editSelectedRoleName === 'faculty' && (
                  <ModuleGroupPickerComponent
                    selected={editFormData.moduleGroupIds}
                    moduleGroups={moduleGroups}
                    onToggle={(id) => setEditFormData(prev => ({
                      ...prev,
                      moduleGroupIds: prev.moduleGroupIds.includes(id)
                        ? prev.moduleGroupIds.filter(x => x !== id)
                        : [...prev.moduleGroupIds, id],
                    }))}
                  />
                )}

                {/* Student: Full Registration Form */}
                {editSelectedRoleName === 'student' && (
                  <StudentFormFields
                    data={editFormData}
                    onChange={(field, value) => setEditFormData(prev => ({ ...prev, [field]: value }))}
                    admissionSources={admissionSources}
                    references={references}
                    onOpenAdmissionSourceManager={() => setIsSourceManagerOpen(true)}
                    onOpenReferenceManager={() => setIsReferenceManagerOpen(true)}
                  />
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

        <Dialog open={isSourceManagerOpen} onOpenChange={setIsSourceManagerOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Manage Admission Sources</DialogTitle>
              <DialogDescription>Add or delete admission sources</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="New admission source"
                  value={newAdmissionSourceName}
                  onChange={(e) => setNewAdmissionSourceName(e.target.value)}
                />
                <Button
                  type="button"
                  onClick={() => handleAddAdmissionSource(newAdmissionSourceName)}
                  disabled={!newAdmissionSourceName.trim() || isAddingSource}
                >
                  {isAddingSource ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                </Button>
              </div>
              <div className="border rounded-md max-h-64 overflow-y-auto">
                {admissionSources.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground text-center">No admission sources found</div>
                ) : (
                  <div className="divide-y">
                    {admissionSources.map((source) => (
                      <div key={source.id} className="flex items-center justify-between p-3">
                        <span className="text-sm">{source.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => handleDeleteAdmissionSource(source.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isReferenceManagerOpen} onOpenChange={setIsReferenceManagerOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Manage References</DialogTitle>
              <DialogDescription>Add or delete references</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="New reference"
                  value={newReferenceName}
                  onChange={(e) => setNewReferenceName(e.target.value)}
                />
                <Button
                  type="button"
                  onClick={() => handleAddReference(newReferenceName)}
                  disabled={!newReferenceName.trim() || isAddingReference}
                >
                  {isAddingReference ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                </Button>
              </div>
              <div className="border rounded-md max-h-64 overflow-y-auto">
                {references.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground text-center">No references found</div>
                ) : (
                  <div className="divide-y">
                    {references.map((reference) => (
                      <div key={reference.id} className="flex items-center justify-between p-3">
                        <span className="text-sm">{reference.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => handleDeleteReference(reference.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isDesignationManagerOpen} onOpenChange={setIsDesignationManagerOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Manage Designations</DialogTitle>
              <DialogDescription>Add or delete designations for all users</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="New designation"
                  value={newDesignationName}
                  onChange={(e) => setNewDesignationName(e.target.value)}
                />
                <Button
                  type="button"
                  onClick={() => handleAddDesignation(newDesignationName)}
                  disabled={!newDesignationName.trim() || isAddingDesignation}
                >
                  {isAddingDesignation ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                </Button>
              </div>
              <div className="border rounded-md max-h-64 overflow-y-auto">
                {designations.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground text-center">No designations found</div>
                ) : (
                  <div className="divide-y">
                    {designations.map((designation) => (
                      <div key={designation.id} className="flex items-center justify-between p-3">
                        <span className="text-sm">{designation.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => handleDeleteDesignation(designation.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
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
            {!isSalesStaff && (
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-40">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {roles.map((r) => {
                    const normalized = r.name.toLowerCase().replace(/\s+/g, '_');
                    return (
                      <SelectItem key={r.id} value={normalized}>
                        {r.name.charAt(0).toUpperCase() + r.name.slice(1)}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>User</TableHead>
                  <TableHead>ID / Emp Code</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="hidden md:table-cell">Designation</TableHead>
                  <TableHead className="hidden md:table-cell">Batch</TableHead>
                  <TableHead className="hidden md:table-cell">Blood Group</TableHead>
                  <TableHead className="hidden lg:table-cell">Registration Date</TableHead>
                  <TableHead className="hidden lg:table-cell">NFC ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />Loading users...
                    </TableCell>
                  </TableRow>
                ) : filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">No users found</TableCell>
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
                          {(() => {
                            const raw = (userItem as any).student_number ||
                              (userItem.metadata as any)?.essl_employee_code;
                            const code = raw && typeof raw !== 'object' ? String(raw) : null;
                            return code ? (
                              <Badge variant="outline" className="font-mono bg-violet-500/10 text-violet-600 border-violet-500/20">
                                {code}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getRoleBadgeColor(userItem.role)}>
                            <RoleIcon className="w-3 h-3 mr-1" />
                            {userItem.role.charAt(0).toUpperCase() + userItem.role.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          {resolveDesignationName((userItem as any).designation_id)}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          {resolveBatchName(userItem.metadata)}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          {(userItem as any).blood_group || '—'}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                          {formatRegistrationDate(userItem.created_at)}
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
                              {isAdminUser && (
                                <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteUser(userItem.id, userItem.full_name || 'User')}>
                                  <Trash2 className="w-4 h-4 mr-2" />Deactivate
                                </DropdownMenuItem>
                              )}
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
