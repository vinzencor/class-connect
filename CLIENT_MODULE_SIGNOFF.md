# Class Connect – Module & Submodule Sign-Off Document

**Document Type:** Software Module Scope Confirmation  
**Prepared For:** Client Sign-Off  
**Product:** Class Connect (Teammates)  
**Version Date:** 03-Mar-2026

---

## 1) Purpose

This document lists all functional modules and submodules currently available in the software for scope confirmation and formal sign-off.

---

## 2) Module Inventory (Module → Submodules)

### Module 1: Authentication & Access
- User Login (Sign In)
- User Signup (Sign Up)
- Password Reset
- Protected Route Access Control
- Google OAuth Callback
- Token-based Student Registration Link

### Module 2: Dashboard
- Admin Dashboard
- Faculty Dashboard
- Student Dashboard
- Role-based Dashboard Views
- Summary KPIs and Quick Overview Widgets

### Module 3: User Management
- User List (Faculty/Student/Admin/Sales Staff)
- Add User
- Edit User
- Delete User
- Role Assignment
- Faculty Module Assignment
- User Status and Profile Management

### Module 4: Batches Management
- Batch Creation
- Batch Update
- Batch Deletion
- Batch-to-Course Linking
- Branch-wise Batch Visibility

### Module 5: Classes & Session Scheduling
- Class Listing
- Create Session (Dedicated screen)
- Faculty Allocation
- Date/Time Session Planning
- Batch Assignment in Session
- Module/Submodule Mapping to Session

### Module 6: Attendance Management
- Attendance Capture
- Attendance Status Tracking
- Student/Batches Attendance View
- Attendance Reporting Feed

### Module 7: Courses Management
- Course List
- Course Creation
- Course Update
- Course Pricing Configuration
- Course Deletion

### Module 8: Study Modules / Course Plan
- Subject Management
- Module Group Management
- Submodule Management
- File Uploads for Modules
- File Deletion
- Drag-and-Drop Ordering (Modules/Files)
- Branch-aware Module Visibility

### Module 9: Faculty Availability
- Faculty Availability Setup
- Availability View/Update
- Availability-based Scheduling Support

### Module 10: Leave Requests
- Pending Leave Requests
- Approved Leave Requests
- Rejected Leave Requests
- All Leave Requests
- Approve/Reject Actions
- Student and Batch Context in Requests

### Module 11: CRM (Lead Management)
- Lead/Inquiry Capture
- Lead Tracking
- CRM Pipeline View
- Lead-to-Conversion Flow Trigger

### Module 12: Converted Leads
- Converted Lead Listing
- Converted Student View
- Pipeline Continuation for Admissions

### Module 13: Admissions
- Student Admission Process
- Admission Data Capture
- Course Enrollment Workflow
- Sales Staff Role Access (where permitted)

### Module 14: Accounts & Payments

#### 14.1 Income & Expenses
- Income Entry
- Expense Entry
- Transaction Listing
- Export Transactions
- Financial Summary Cards (Income/Expense/Net)

#### 14.2 Student Fees
- Student Fee Records
- Payment Status Tracking
- Pending Fee Monitoring
- Fee Collection Operations

### Module 15: ID Card Management
- Student/Staff ID Card Generation
- ID Card Listing
- ID Card Printing/Export Support

### Module 16: Roles & Permissions
- Role Creation
- Role Update
- Role Deletion
- Permission Mapping by Feature
- Mandatory Feature Enforcement (Dashboard/Settings)

### Module 17: Reports & Analytics

#### 17.1 Core Reports
- Attendance Report
- Fee Collection Report
- Branch Summary Report
- Transactions Report
- Sales Staff Report
- Admissions Report

#### 17.2 Extended Reports
- Student Details Report
- Course Registrations Report
- Batch Wise Students Report
- Fee Paid Report
- Fee Pending Report
- Fee Summary Report
- Cash Book Report
- Bank Book Report
- Day Book Report
- Expense Report
- Income Report
- Student Statement Report
- Collection Report

### Module 18: Branch Management
- Branch Creation
- Branch Update
- Branch Selection/Switching
- Multi-branch Data Isolation Controls

### Module 19: Settings

#### 19.1 General Settings
- Organization Profile Details
- Basic Institute Settings

#### 19.2 Branch Settings
- Branch-level Configuration (Admin)

#### 19.3 Notification Settings
- Notification Preferences

#### 19.4 Integrations
- Integration Configuration (e.g., Google-related setup)

#### 19.5 Security
- Password & Security Controls
- Account Security Preferences

### Module 20: System / Utility
- Not Found (404) Route Handling
- Navigation and Sidebar Feature Mapping
- Permission-based Menu Visibility

---

## 3) Route Coverage (Reference)

Primary routes included in current scope:
- `/login`, `/reset-password`, `/register/:token`, `/auth/google/callback`
- `/dashboard` and all feature routes under dashboard:
  - `users`, `batches`, `classes`, `attendance`, `courses`, `modules`, `faculty-availability`, `leave-requests`, `crm`, `converted-leads`, `admissions`, `payments`, `id-cards`, `roles`, `reports`, `branches`, `settings`, `create-session`

---

## 4) Sign-Off Statement

We confirm that the above module and submodule list represents the current functional scope delivered/present in the software build for client review.

---

## 5) Approval & Signature

### Client Approval
- **Client Name:** _______________________________
- **Company Name:** ______________________________
- **Designation:** ________________________________
- **Signature:** _________________________________
- **Date:** ______________________________________

### Vendor / Implementation Team Approval
- **Representative Name:** ________________________
- **Company Name:** ______________________________
- **Designation:** ________________________________
- **Signature:** _________________________________
- **Date:** ______________________________________

---

## 6) Notes

- This sign-off is based on the currently available modules in the application codebase as of the date above.
- Future enhancements, custom modules, or integrations can be added through a separate change request and approval cycle.
