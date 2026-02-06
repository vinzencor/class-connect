# Quick Start Guide - Role-Based User Management

## 🚀 Setup Instructions

### 1. Execute Database Schema
Copy the entire contents of `supabase-schema.sql` and run it in your Supabase SQL Editor:
- Creates `leave_requests` table
- Adds RLS policies
- Sets up auto-timestamp triggers

### 2. Test the Implementation

#### Create Test Admin User
1. Go to login page
2. Sign up with organization name "Test Institute"
3. You'll be assigned admin role
4. Login to dashboard

#### Create Test Student
1. As admin, go to Users page
2. Click "Add User"
3. Fill:
   - Name: "Rahul Student"
   - Email: "student@test.com"
   - Password: "password123"
   - Role: Student
   - Batch: Batch A
4. Click "Create User"

#### Create Test Faculty
1. Click "Add User" again
2. Fill:
   - Name: "Dr. Teacher"
   - Email: "teacher@test.com"
   - Password: "password123"
   - Role: Faculty
   - (No batch needed)
3. Click "Create User"

### 3. Test Role-Specific Features

#### As Student
1. Logout and login as student@test.com / password123
2. Dashboard shows:
   - Today's classes (mock data)
   - Your attendance report
   - Leave request button
3. Click "Leave Requests" in sidebar
4. Submit a leave request with reason
5. Go to Settings > Security and change password

#### As Faculty
1. Logout and login as teacher@test.com / password123
2. Dashboard shows:
   - Your assigned classes (mock data)
   - Click "View Details" to see class modules
   - Can download modules
3. Navigation shows only relevant pages
4. No access to Users, CRM, Payments

#### As Admin
1. Logout and login as original admin account
2. Full access to all pages
3. Can manage users (create, deactivate)
4. Can view CRM, Payments, Attendance

---

## 📋 Feature Checklist

### ✅ Completed
- [x] Real users fetched from Supabase
- [x] Create new users with password
- [x] Role-based navigation (sidebar filters by role)
- [x] Student dashboard (classes, attendance, leave request)
- [x] Faculty dashboard (assigned classes with details)
- [x] Admin dashboard (statistics and management)
- [x] Password change in settings
- [x] Leave request system (submit, view history)
- [x] Soft delete users (deactivate instead of delete)
- [x] Organization-based data filtering

### 🔄 In Progress
- [ ] Batch management system
- [ ] Real class data integration
- [ ] Attendance marking with NFC
- [ ] Module upload and download
- [ ] Leave request approval workflow

---

## 🔑 Key APIs

### User Service
```typescript
import { userService } from '@/services/userService';

// Fetch all users
const users = await userService.getUsers(organizationId);

// Create user
await userService.createUser(orgId, email, name, role, password);

// Soft delete user
await userService.deactivateUser(userId);

// Search users
const results = await userService.searchUsers(orgId, searchQuery);
```

### Leave Request Service
```typescript
import { leaveRequestService } from '@/services/leaveRequestService';

// Get student's requests
const requests = await leaveRequestService.getStudentLeaveRequests(studentId);

// Submit request
await leaveRequestService.createLeaveRequest(orgId, studentId, reason);

// Approve/Reject (admin)
await leaveRequestService.approveLeaveRequest(requestId, adminId);
await leaveRequestService.rejectLeaveRequest(requestId, notes);
```

---

## 🎨 UI Components Used

- **Card** - Container for sections
- **Button** - Actions and navigation
- **Dialog** - Modals for forms
- **Badge** - Status indicators (pending, approved, active, etc)
- **Table** - Data display
- **Avatar** - User profiles
- **Tabs** - Settings organization
- **Select** - Role/batch selection
- **Input** - Text fields
- **Toast** - Notifications

---

## 📊 Database Schema

### Key Tables
- `organizations` - Academy/institute info
- `profiles` - User profiles with roles
- `leave_requests` - NEW: Leave request tracking
- `classes` - Classes and sections
- `attendance` - Attendance records
- `modules` - Learning materials

### Column: `is_active`
Used for soft deletes. Instead of deleting, set `is_active = false`

```typescript
// Soft delete example
await supabase
  .from('profiles')
  .update({ is_active: false })
  .eq('id', userId);

// Filter active users
.eq('is_active', true)
```

---

## 🔐 Role Permissions

### Student
- View dashboard (attendance, classes)
- Request leave
- View own profile
- Change password

### Faculty
- View dashboard (assigned classes)
- View modules for their classes
- (Eventually) Mark attendance
- Change password

### Admin
- Everything
- Manage users (create, deactivate, reactivate)
- Manage classes
- View CRM and payments
- Change password

---

## 🐛 Common Issues & Solutions

### Issue: "User not in organization"
**Solution:** Ensure user was created with correct organization_id. All queries filter by organization_id.

### Issue: "Leave request not found"
**Solution:** Make sure the leave_requests table exists in your Supabase. Run the schema SQL.

### Issue: "Type 'leave_requests' not found"
**Solution:** The database.ts types are already updated. No need to regenerate.

### Issue: "Cannot create user"
**Solution:** Ensure email is unique and password is provided. Check organization_id is valid.

---

## 📱 Navigation Menu

The sidebar automatically filters based on user role:

**Admin Menu:**
- Dashboard
- Users
- Classes
- Attendance
- Modules
- CRM
- Payments
- Settings

**Faculty Menu:**
- Dashboard
- Classes
- Modules
- Settings

**Student Menu:**
- Dashboard
- Classes
- Modules
- Leave Requests
- Settings

---

## 🚀 Next Steps

1. **Test all features** with different user roles
2. **Connect real data** to remaining pages (Classes, Attendance, Modules, CRM)
3. **Add batch management** system
4. **Implement NFC attendance** marking
5. **Set up email notifications** for leave requests
6. **Create admin approval workflow** for leave requests

---

## 📞 Support

For issues or questions:
1. Check error messages in browser console
2. Review IMPLEMENTATION_SUMMARY_PHASE1.md for detailed info
3. Check database.ts for type definitions
4. Review relevant service file for API details

---

## ✨ Features Ready to Use

1. ✅ Create users (admin only)
2. ✅ View users by role
3. ✅ Search users
4. ✅ Deactivate users
5. ✅ Change own password
6. ✅ Submit leave requests (student only)
7. ✅ View leave request history
8. ✅ Role-specific dashboards
9. ✅ Role-specific navigation
10. ✅ Organization data isolation

Enjoy! 🎉
