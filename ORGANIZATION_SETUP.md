# Organization Setup & User Management Guide

## 🔴 Issue: Organization ID is NULL

If you see "Loading users..." stuck or the debug panel showing `Organization ID: NULL`, follow these steps:

---

## ✅ Step 1: Create an Organization First

Before creating any users, you need to create an organization:

```sql
INSERT INTO organizations (id, name, email, phone, is_active)
VALUES (
  uuid_generate_v4(),
  'My Academy',
  'academy@example.com',
  '+1234567890',
  true
);
```

**Copy the generated `id` - you'll need it for the next steps.**

---

## ✅ Step 2: Create an Admin User with Organization

You can create an admin user manually in Supabase:

1. Go to **Supabase Dashboard** → **Authentication** → **Users**
2. Click **Add User**
3. Enter:
   - Email: `admin@example.com`
   - Password: `AdminPassword123!`
4. Click **Create User**
5. Now update the `profiles` table manually:

```sql
UPDATE profiles
SET 
  organization_id = 'PASTE_YOUR_ORG_ID_HERE',
  role = 'admin',
  full_name = 'Admin User',
  is_active = true
WHERE email = 'admin@example.com';
```

---

## ✅ Step 3: Login and Create More Users

Now that you have:
1. An organization
2. An admin user assigned to that organization

You can:

1. **Login** as the admin
2. **Go to Users page** in the dashboard
3. **Click "Add User"** to create students/faculty
4. These new users will automatically be assigned to the organization

---

## 🔄 How It Works

### When Creating a User via the UI:

```
1. Admin fills form: Name, Email, Password, Role
2. System sends to Supabase Auth with metadata:
   {
     full_name: "Student Name",
     role: "student",
     organization_id: "admin's-org-id"
   }
3. Database trigger (handle_new_user) automatically creates profile with org_id
4. New user can login with their credentials
5. On first login, they see only their organization's data
```

### Organization Isolation:

- **Admin A** can only see users in **Organization A**
- **Admin B** can only see users in **Organization B**
- **Students** can only see their own organization's classes

---

## 📊 Current Flow

```
┌─────────────────────────────────┐
│  1. Admin Signs Up              │
│  - Creates account              │
│  - Create Organization          │
│  - Gets admin role              │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│  2. Admin Logs In               │
│  - Gets organization_id         │
│  - See Users Management Page    │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│  3. Admin Creates Students      │
│  - Student auto-assigned to org │
│  - Receives login credentials   │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│  4. Student Logs In             │
│  - Only sees their organization │
│  - Can see their classes        │
│  - Can submit leave requests    │
└─────────────────────────────────┘
```

---

## 🐛 Debugging

### Check Debug Panel on Users Page

At the top of the Users page, you'll see:
```
User ID: abc123...
Organization ID: xyz789... (or NULL if not set)
```

### Check Browser Console

Open DevTools (F12) → Console to see:
```
User organization ID: xyz789
Fetching users...
Fetched users: [...]
```

### Check Database Directly

Run in Supabase SQL Editor:

```sql
-- Check your user's profile
SELECT id, email, full_name, role, organization_id 
FROM profiles 
WHERE email = 'your-email@example.com';

-- Check your organization
SELECT id, name 
FROM organizations 
WHERE id = 'your-org-id';

-- Check all users in your organization
SELECT id, email, full_name, role, is_active 
FROM profiles 
WHERE organization_id = 'your-org-id';
```

---

## ✨ Best Practices

1. **Always create organization first** before creating admin
2. **Use the UI** to create new users (not manual SQL)
3. **Share unique credentials** with each new user
4. **Users should change password** on first login
5. **Deactivate instead of delete** users (soft delete)

---

## 🚀 Quick Setup Checklist

- [ ] Create organization in Supabase
- [ ] Create admin user and assign to organization
- [ ] Login as admin
- [ ] Create student/faculty users via UI
- [ ] Login as new user to verify organization isolation
- [ ] Check Users page shows all users
- [ ] Test leave request feature

---

## ❓ FAQ

**Q: Why is organization_id NULL?**
A: The user was created without organization_id in metadata. Fix: Manually update the profile with the organization_id.

**Q: Can I change a user's organization?**
A: Yes, run:
```sql
UPDATE profiles 
SET organization_id = 'new-org-id' 
WHERE id = 'user-id';
```

**Q: What happens when a user logs in from different organization?**
A: They won't be able to see data. Each query filters by their organization_id from the profiles table.

**Q: Can I merge two organizations?**
A: Not recommended. Instead, deactivate users and create them in the correct org.

---

## 📞 Support

If users still show "Loading users..." after following these steps:

1. Check browser console for errors (F12)
2. Check Supabase logs for database errors
3. Verify organization_id is not NULL in profiles table
4. Make sure RLS policies are enabled

For production, consider:
- Email invitations instead of manual password sharing
- OAuth integration
- Admin API for bulk user creation
