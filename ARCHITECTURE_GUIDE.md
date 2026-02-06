# 🗺️ Application Architecture & Feature Map

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    ClassConnect App                      │
│                   (React + Vite)                         │
└─────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
    ┌───▼────┐         ┌────▼─────┐       ┌───▼────┐
    │ Auth   │         │Contexts  │       │Services│
    │ Context│         │(Auth)    │       │(API)   │
    └────────┘         └──────────┘       └────────┘
        │                                      │
        └──────────────────┬───────────────────┘
                           │
                    ┌──────▼──────┐
                    │  Supabase   │
                    │ (Database)  │
                    │ (Auth)      │
                    └─────────────┘
```

---

## Data Flow: Creating a User

```
Admin User Interface (UsersPage)
         │
         ▼
    Form Submission
         │
         ▼
    handleCreateUser()
         │
         ▼
    userService.createUser()
         │
         ▼
    Supabase Auth.signUp()
         │
         ▼
    profiles table INSERT
         │
         ▼
    Success Toast Notification
         │
         ▼
    fetchUsers() refreshes list
         │
         ▼
    New User appears in table
```

---

## Role-Based Access Control Flow

```
User Login
    │
    ▼
AuthContext reads user.role
    │
    ├─── "admin"   ──────┬─────────────────────────┐
    │                    │                         │
    ├─── "faculty" ──────┼─────────────────────────┤
    │                    │                         │
    └─── "student" ──────┴─────────────────────────┘
                         │
                         ▼
            DashboardLayout.navigation
            filters by role
                         │
                    ┌────┴────┐
                    │          │
                ┌───▼──┐   ┌──▼───┐
                │Admin │   │Other │
                │Menu  │   │Users │
                │(9)   │   │(4-5) │
                └──────┘   └──────┘
                    │
                    ▼
            Dashboard Component
            renders role view
                    │
            ┌───────┼────────┐
            │       │        │
        ┌───▼──┐┌──▼───┐┌──▼───┐
        │Admin │Faculty│Student│
        │View  │ View  │ View  │
        └──────┘└───────┘└──────┘
```

---

## User Journey Maps

### 👤 Student Journey

```
LOGIN
  │
  ▼
STUDENT DASHBOARD
├─ Today's Classes
├─ Attendance Report
└─ Leave Request Button
  │
  ├─────────────────┬──────────────────┬─────────────────┐
  │                 │                  │                 │
  ▼                 ▼                  ▼                 ▼
CLASSES         MODULES          LEAVE REQUEST     SETTINGS
(View)          (Download)        (Submit)          (Password)
  │                 │                  │                 │
  └─────────────────┼──────────────────┼─────────────────┘
                    │
                    ▼
            DASHBOARD (updated)
```

### 👨‍🏫 Faculty Journey

```
LOGIN
  │
  ▼
FACULTY DASHBOARD
├─ Assigned Classes (Grid)
├─ Class Details Modal
└─ Module Downloads
  │
  ├─────────────────┬──────────────────┬─────────────────┐
  │                 │                  │                 │
  ▼                 ▼                  ▼                 ▼
CLASSES        MODULES         ATTENDANCE        SETTINGS
(My Classes)   (Upload)        (View/Mark)       (Password)
  │                                     │
  └─────────────────┬────────────────────┘
                    │
                    ▼
            [Future: Approval Queue]
```

### 👨‍💼 Admin Journey

```
LOGIN
  │
  ▼
ADMIN DASHBOARD (Full Stats)
├─ Total Students
├─ Active Faculty
├─ Attendance Rate
└─ New Leads
  │
  ├──────────┬──────────┬──────────┬──────────┬──────────┐
  │          │          │          │          │          │
  ▼          ▼          ▼          ▼          ▼          ▼
USERS      CLASSES   ATTENDANCE  MODULES    CRM     PAYMENTS
(CRUD)     (CRUD)    (View/Mark) (Manage) (Manage) (View)
  │          │          │          │        │         │
  └──────────┴──────────┴──────────┴────────┴─────────┘
                        │
                    SETTINGS
                   (Password)
```

---

## Database Schema Relationships

```
┌──────────────────┐
│  organizations   │ (Institute/Academy)
│                  │
│ id (PK)          │
│ name             │
│ subscription     │
│ is_active        │
└────────┬─────────┘
         │
    ┌────┴────────────────────────────┐
    │                                 │
    ▼                                 ▼
┌──────────────┐            ┌─────────────────────┐
│   profiles   │            │   leave_requests    │
│ (Users)      │            │                     │
├──────────────┤            ├─────────────────────┤
│ id (FK)      │──1:M──────>│ student_id (FK)     │
│ org_id (FK)  │            │ status              │
│ role         │            │ reason              │
│ full_name    │            │ requested_date      │
│ email        │            │ approved_by         │
│ is_active    │            │ created_at          │
│ nfc_id       │            └─────────────────────┘
└──────┬───────┘
       │
   ┌───┴────────────────────────────┐
   │                                │
   ▼                                ▼
┌───────────┐              ┌──────────────┐
│ classes   │              │  attendance  │
├───────────┤              ├──────────────┤
│ id        │──1:M────────>│ class_id(FK) │
│ faculty_id│──────┐       │ student_id   │
│ org_id    │      │       │ date         │
│ schedule  │      │       │ status       │
└───────────┘      │       └──────────────┘
                   │
                   └──FK────>│profiles│
```

---

## Component Hierarchy

```
App
│
├─ BrowserRouter
│  │
│  ├─ Routes
│  │  ├─ /login
│  │  │  └─ Login Page
│  │  │
│  │  └─ /dashboard
│  │     ├─ ProtectedRoute
│  │     │  └─ DashboardLayout
│  │     │     ├─ Sidebar
│  │     │     │  ├─ Navigation (role-filtered)
│  │     │     │  └─ User Menu
│  │     │     │
│  │     │     ├─ Header
│  │     │     │  ├─ Search
│  │     │     │  └─ Notifications
│  │     │     │
│  │     │     └─ Main Content (Outlet)
│  │     │        ├─ Dashboard
│  │     │        ├─ UsersPage
│  │     │        ├─ ClassesPage
│  │     │        ├─ AttendancePage
│  │     │        ├─ ModulesPage
│  │     │        ├─ LeaveRequestPage
│  │     │        ├─ CRMPage
│  │     │        ├─ PaymentsPage
│  │     │        └─ SettingsPage
│  │     │
│  │     └─ Modals/Dialogs
│  │        ├─ Add User Dialog
│  │        ├─ Class Details Modal
│  │        └─ Leave Request Modal
│  │
│  └─ ProtectedRoute checks auth
│
└─ Providers
   ├─ AuthProvider (user context)
   ├─ QueryClientProvider (React Query)
   └─ TooltipProvider (UI)
```

---

## Feature Dependency Graph

```
User Management System
│
├─ Authentication ◄─── Supabase Auth
│  │
│  └─ Sessions, Password Reset
│
├─ User CRUD Operations
│  │
│  ├─ Create User
│  │  └─ Requires: Email, Password, Role
│  │
│  ├─ Read Users
│  │  └─ Filtered by Organization & is_active
│  │
│  ├─ Update User
│  │  └─ Profile updates, password change
│  │
│  └─ Deactivate User (Soft Delete)
│     └─ Sets is_active = false
│
├─ Role-Based Access
│  │
│  ├─ Navigation Filtering
│  │  └─ Based on user.role
│  │
│  ├─ Dashboard Views
│  │  ├─ Student Dashboard
│  │  ├─ Faculty Dashboard
│  │  └─ Admin Dashboard
│  │
│  └─ Feature Access
│     └─ Leave Requests, CRM, Payments, etc.
│
└─ Leave Request System
   │
   ├─ Submit Request (Students)
   ├─ View History
   ├─ Approve/Reject (Admin/Faculty)
   └─ Status Tracking
```

---

## API/Service Layer

```
Frontend Components
        │
    ┌───┴────────────────┬──────────────────┬──────────────┐
    │                    │                  │              │
    ▼                    ▼                  ▼              ▼
userService     leaveRequestService    useAuth         useToast
    │                    │                  │              │
├─getUsers()     ├─createLeaveRequest() │ login()      notify()
├─createUser()   ├─getStudentRequests() │ logout()      
├─updateUser()   ├─approveRequest()     │ signup()      
├─deactivateUser()  └─rejectRequest()     └─updateProfile()
├─searchUsers()
└─assignNFC()

        │                    │                  │              │
        └────────────────────┼──────────────────┴──────────────┘
                             │
                      ┌──────▼──────┐
                      │  Supabase   │
                      │   Client    │
                      └─────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
   Database            Authentication         Storage
(PostgreSQL)          (JWT + MFA)         (File uploads)
```

---

## State Management Flow

```
Global State
│
├─ AuthContext
│  ├─ user {id, email, name, role, orgId}
│  ├─ profile {full_name, email, role, is_active}
│  ├─ organization {name, id, subscription}
│  └─ isAuthenticated, isLoading
│
Local State (Component Level)
│
├─ UsersPage
│  ├─ users[] (fetched from DB)
│  ├─ searchQuery
│  ├─ roleFilter
│  ├─ isLoading
│  └─ isCreating
│
├─ LeaveRequestPage
│  ├─ leaveRequests[]
│  ├─ isLoading
│  └─ isSubmitting
│
└─ SettingsPage
   ├─ passwordData {current, new, confirm}
   └─ isChangingPassword
```

---

## Authentication & Authorization Flow

```
User navigates to /dashboard
        │
        ▼
ProtectedRoute checks auth
        │
    ┌───┴────────┐
    │            │
 YES │            │ NO
    │            │
    ▼            ▼
Dashboard    Redirect
Layout       /login
    │
    ▼
DashboardLayout
    │
    ├─ Filters Navigation by role
    │
    └─ Renders Role-Specific Component
        │
        ├─ Student? ──> StudentDashboard
        ├─ Faculty? ──> FacultyDashboard
        └─ Admin?   ──> AdminDashboard
```

---

## Performance Optimizations

```
Implemented:
✅ Component lazy loading (Outlet routing)
✅ Conditional rendering (avoid rendering hidden components)
✅ Memoization for icons and utilities
✅ Debounced search (ready for implementation)
✅ Database indexing on organization_id, role
✅ Pagination ready in service layer

Future:
⏳ React Query for caching
⏳ Virtual scrolling for large lists
⏳ Image optimization
⏳ Code splitting
⏳ Service worker caching
```

---

## Error Handling Strategy

```
User Action
    │
    ▼
Try-Catch Block
    │
    ├─ Success
    │  └─ Show success toast
    │
    └─ Error
       ├─ Log to console
       ├─ Show error toast
       └─ (Optionally) Error boundary
```

---

## Security Layers

```
┌─────────────────────────────────────────┐
│         Frontend Security               │
├─────────────────────────────────────────┤
│ • Protected Routes (ProtectedRoute)     │
│ • Role-based UI rendering               │
│ • Form validation                       │
│ • HTTPS/TLS                            │
└─────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────┐
│      Supabase Auth Security             │
├─────────────────────────────────────────┤
│ • Email/Password authentication         │
│ • JWT token validation                  │
│ • Session management                    │
│ • Password hashing (bcrypt)             │
└─────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────┐
│    Database Security (RLS Policies)     │
├─────────────────────────────────────────┤
│ • Row-level security                    │
│ • Organization isolation                │
│ • User-level access control             │
│ • Data encryption at rest               │
└─────────────────────────────────────────┘
```

---

## Deployment Checklist

```
Before Production:
☐ Run all tests
☐ Check console for errors
☐ Test all user roles
☐ Verify database schema
☐ Check RLS policies
☐ Test error scenarios
☐ Verify notifications work
☐ Check responsive design
☐ Test authentication flow
☐ Verify data isolation
☐ Check performance
☐ Security audit
```

---

This architecture is scalable, maintainable, and follows React/TypeScript best practices.
