/**
 * Features Registry
 * Single source of truth for all application features/pages.
 * Used by both the sidebar navigation and role management UI.
 */

import {
  LayoutDashboard,
  Users,
  Calendar,
  Layers,
  ClipboardCheck,
  BookOpen,
  GraduationCap,
  FileText,
  UserPlus,
  UserCheck,
  CreditCard,
  IdCard,
  Settings,
  Shield,
  BarChart3,
  Building2,
  CalendarCheck,
  type LucideIcon,
} from 'lucide-react';

export interface Feature {
  key: string;
  label: string;
  description: string;
  icon: LucideIcon;
  href: string;
  category: 'core' | 'academic' | 'management' | 'administration';
}

export const FEATURES: Feature[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    description: 'Overview and analytics',
    icon: LayoutDashboard,
    href: '/dashboard',
    category: 'core',
  },
  {
    key: 'users',
    label: 'Users',
    description: 'Manage faculty and students',
    icon: Users,
    href: '/dashboard/users',
    category: 'administration',
  },
  {
    key: 'classes',
    label: 'Classes',
    description: 'Course management',
    icon: Calendar,
    href: '/dashboard/classes',
    category: 'academic',
  },
  {
    key: 'batches',
    label: 'Batches',
    description: 'Student group management',
    icon: Layers,
    href: '/dashboard/batches',
    category: 'academic',
  },
  {
    key: 'attendance',
    label: 'Attendance',
    description: 'Track student attendance',
    icon: ClipboardCheck,
    href: '/dashboard/attendance',
    category: 'academic',
  },
  {
    key: 'courses',
    label: 'Courses',
    description: 'Course management and pricing',
    icon: GraduationCap,
    href: '/dashboard/courses',
    category: 'academic',
  },
  {
    key: 'modules',
    label: 'Modules / Course Plan', 
    description: 'Study materials and resources',
    icon: BookOpen,
    href: '/dashboard/modules',
    category: 'academic',
  },
  {
    key: 'faculty_availability',
    label: 'Faculty Availability',
    description: 'Manage faculty schedule availability',
    icon: CalendarCheck,
    href: '/dashboard/faculty-availability',
    category: 'academic',
  },
  {
    key: 'leave_requests',
    label: 'Leave Request',
    description: 'Student leave management',
    icon: FileText,
    href: '/dashboard/leave-requests',
    category: 'management',
  },
  {
    key: 'crm',
    label: 'CRM',
    description: 'Lead and inquiry management',
    icon: UserPlus,
    href: '/dashboard/crm',
    category: 'management',
  },
  {
    key: 'converted_leads',
    label: 'Converted Leads',
    description: 'Student registration pipeline',
    icon: UserCheck,
    href: '/dashboard/converted-leads',
    category: 'management',
  },
  {
    key: 'admissions',
    label: 'Admissions',
    description: 'Student admissions and course enrollment',
    icon: GraduationCap,
    href: '/dashboard/admissions',
    category: 'management',
  },
  {
    key: 'payments',
    label: 'Accounts & Payments',
    description: 'Fee tracking and billing',
    icon: CreditCard,
    href: '/dashboard/payments',
    category: 'administration',
  },
  {
    key: 'id_cards',
    label: 'ID Cards',
    description: 'Student and staff ID cards',
    icon: IdCard,
    href: '/dashboard/id-cards',
    category: 'administration',
  },
  {
    key: 'roles',
    label: 'Roles',
    description: 'Role and permission management',
    icon: Shield,
    href: '/dashboard/roles',
    category: 'administration',
  },
  {
    key: 'reports',
    label: 'Reports',
    description: 'Sales, teacher and attendance reports',
    icon: BarChart3,
    href: '/dashboard/reports',
    category: 'administration',
  },
  {
    key: 'branches',
    label: 'Branches',
    description: 'Multi-branch management',
    icon: Building2,
    href: '/dashboard/branches',
    category: 'administration',
  },
  {
    key: 'settings',
    label: 'Settings',
    description: 'Profile and organization settings',
    icon: Settings,
    href: '/dashboard/settings',
    category: 'core',
  },
];

/**
 * Get feature by key
 */
export function getFeature(key: string): Feature | undefined {
  return FEATURES.find((f) => f.key === key);
}

/**
 * Get features by keys
 */
export function getFeatures(keys: string[]): Feature[] {
  return FEATURES.filter((f) => keys.includes(f.key));
}

/**
 * Get all feature keys
 */
export function getAllFeatureKeys(): string[] {
  return FEATURES.map((f) => f.key);
}

/**
 * Get features grouped by category
 */
export function getFeaturesByCategory(): Record<string, Feature[]> {
  return FEATURES.reduce((acc, feature) => {
    if (!acc[feature.category]) {
      acc[feature.category] = [];
    }
    acc[feature.category].push(feature);
    return acc;
  }, {} as Record<string, Feature[]>);
}

/**
 * Mandatory features that all roles must have
 */
export const MANDATORY_FEATURES = ['dashboard', 'settings'];

/**
 * Category labels for UI
 */
export const CATEGORY_LABELS: Record<string, string> = {
  core: 'Core',
  academic: 'Academic',
  management: 'Management',
  administration: 'Administration',
};

/**
 * Predefined roles — the ONLY roles allowed in the system.
 * No custom role creation is permitted beyond these.
 */
export interface PredefinedRole {
  name: string;
  textRole: string; // maps to profiles.role text column
  description: string;
  defaultPermissions: string[];
}

export const PREDEFINED_ROLES: PredefinedRole[] = [
  {
    name: 'Admin',
    textRole: 'admin',
    description: 'Full access to all features and settings',
    defaultPermissions: [
      'dashboard', 'users', 'classes', 'batches', 'attendance', 'courses', 'modules',
      'faculty_availability', 'leave_requests', 'crm', 'converted_leads', 'admissions',
      'payments', 'id_cards', 'roles', 'reports', 'branches', 'settings',
    ],
  },
  {
    name: 'Sales Staff',
    textRole: 'sales_staff',
    description: 'Student admissions, fee collection, and CRM management',
    defaultPermissions: [
      'dashboard', 'users', 'batches', 'courses', 'payments', 'crm',
      'converted_leads', 'admissions', 'reports', 'settings',
    ],
  },
  {
    name: 'Faculty',
    textRole: 'faculty',
    description: 'Class management, attendance, and teaching materials',
    defaultPermissions: [
      'dashboard', 'classes', 'attendance', 'leave_requests', 'settings',
      'faculty_availability', 'modules',
    ],
  },
  {
    name: 'Student',
    textRole: 'student',
    description: 'Access to classes, modules, and personal settings',
    defaultPermissions: ['dashboard', 'classes', 'modules', 'leave_requests', 'settings'],
  },
  {
    name: 'Schedule Coordinator',
    textRole: 'schedule_coordinator',
    description: 'Class scheduling, batch management, and faculty availability',
    defaultPermissions: [
      'dashboard', 'classes', 'batches', 'attendance', 'faculty_availability',
      'leave_requests', 'courses', 'modules', 'reports', 'settings',
    ],
  },
  {
    name: 'Batch Coordinator',
    textRole: 'batch_coordinator',
    description: 'View classes, mark student attendance, and track batch reports',
    defaultPermissions: [
      'dashboard', 'classes', 'attendance', 'reports', 'settings',
    ],
  },
  {
    name: 'Front Office',
    textRole: 'front_office',
    description: 'Student registration and admissions management',
    defaultPermissions: [
      'dashboard', 'users', 'admissions', 'converted_leads', 'settings',
    ],
  },
  {
    name: 'Head',
    textRole: 'head',
    description: 'Senior management with broad access',
    defaultPermissions: [
      'dashboard', 'users', 'classes', 'batches', 'attendance', 'courses', 'modules',
      'faculty_availability', 'leave_requests', 'crm', 'converted_leads', 'admissions',
      'payments', 'id_cards', 'reports', 'branches', 'settings',
    ],
  },
  {
    name: 'Staff',
    textRole: 'staff',
    description: 'General staff with operational access',
    defaultPermissions: [
      'dashboard', 'users', 'classes', 'batches', 'attendance', 'courses', 'modules',
      'faculty_availability', 'leave_requests', 'crm', 'converted_leads', 'admissions',
      'payments', 'id_cards', 'reports', 'settings',
    ],
  },
];

/**
 * Get predefined role by textRole key
 */
export function getPredefinedRole(textRole: string): PredefinedRole | undefined {
  return PREDEFINED_ROLES.find((r) => r.textRole === textRole);
}

/**
 * Get all predefined role text keys
 */
export function getPredefinedRoleKeys(): string[] {
  return PREDEFINED_ROLES.map((r) => r.textRole);
}

/**
 * Report tabs allowed per role. Roles not listed here see ALL tabs (admin).
 */
export const REPORT_TABS_BY_ROLE: Record<string, string[]> = {
  sales_staff: [
    'student-details', 'course-registrations', 'batch-wise',
    'fees', 'fee-paid', 'fee-pending', 'fee-summary', 'collection-report',
    'admissions', 'sales-staff',
  ],
  faculty: [
    'faculty-time', 'faculty-individual',
  ],
  schedule_coordinator: [
    'faculty-time', 'faculty-individual',
    'batch-wise', 'batch-progress', 'individual-batch-class', 'batch-monthly-faculty', 'classroom-wise-schedule',
  ],
  batch_coordinator: [
    'attendance', 'batch-progress', 'classroom-wise-schedule',
  ],
  front_office: [
    'student-details', 'admissions', 'course-registrations',
  ],
  head: [], // empty = all tabs (handled in code)
  staff: [], // empty = all tabs
};
