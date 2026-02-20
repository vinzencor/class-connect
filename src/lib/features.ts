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
    label: 'Modules',
    description: 'Study materials and resources',
    icon: BookOpen,
    href: '/dashboard/modules',
    category: 'academic',
  },
  {
    key: 'leave_requests',
    label: 'Leave Requests',
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
    key: 'payments',
    label: 'Payments',
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
