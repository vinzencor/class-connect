# Quick Start Guide

## 🚀 Get Started in 3 Steps

### Step 1: Run the Database Schema

1. Go to https://supabase.com/dashboard
2. Select your project: **jdbxqjanhjiafafjukdzd**
3. Click **SQL Editor** in the left sidebar
4. Click **New query**
5. Copy ALL content from `supabase-schema.sql`
6. Paste it into the SQL editor
7. Click **Run** (or press Ctrl+Enter)

You should see: ✅ Success. No rows returned

### Step 2: Verify Setup

**Check Tables Created:**
1. Go to **Table Editor** in Supabase dashboard
2. You should see these tables:
   - organizations
   - profiles  
   - classes
   - class_enrollments
   - attendance
   - modules
   - crm_leads
   - payments

**Check Auth Trigger:**
1. Go to **Database** → **Triggers**
2. You should see: `on_auth_user_created`

### Step 3: Start Your App

```bash
# Install dependencies (if not done)
npm install

# Start development server
npm run dev
```

Your app will open at: http://localhost:5173

## 🎯 Test the Multi-Tenant System

### Create First Organization (Admin)

1. Open http://localhost:5173/login
2. Click **Sign Up** tab
3. Fill in:
   - **Organization Name**: "Test Academy"
   - **Full Name**: "Admin User"
   - **Email**: "admin@testacademy.com"
   - **Password**: "test123"
4. Click **Create Account**
5. ✅ You should be logged in automatically!

### Verify in Supabase

1. **Check Organizations:**
   - Go to Supabase → Table Editor → `organizations`
   - You should see "Test Academy"

2. **Check Profiles:**
   - Go to Table Editor → `profiles`
   - You should see your admin profile with role='admin'

3. **Check Auth:**
   - Go to Authentication → Users
   - You should see admin@testacademy.com

### Test Login

1. Logout (if logged in)
2. Click **Sign In** tab
3. Enter:
   - **Email**: admin@testacademy.com
   - **Password**: test123
4. Click **Sign in**
5. ✅ Should redirect to dashboard!

## 🔐 Test Multi-Tenant Isolation

### Create Second Organization

1. Logout
2. Sign up again with different org:
   - **Organization Name**: "Second Academy"
   - **Full Name**: "Second Admin"
   - **Email**: "admin@second.com"
   - **Password**: "test123"
3. ✅ New organization created!

### Verify Data Isolation

1. In Supabase Table Editor → `organizations`
2. You should see BOTH organizations
3. Each has different ID
4. Each admin belongs to their respective organization
5. **RLS ensures:** Each admin can only see their own organization's data!

## ✅ What's Working Now

- ✅ User signup with organization creation
- ✅ Admin user creation
- ✅ Email/password authentication
- ✅ Session management
- ✅ Protected routes
- ✅ Multi-tenant data isolation
- ✅ Role-based access control foundation

## 🔄 Next: Add Faculty & Students

Once your admin account is working, the next step is to implement user management in UsersPage.tsx to allow admins to add faculty and students.

See `src/services/userService.ts` for ready-to-use functions like:
- `userService.createUser()` - Add new faculty/student
- `userService.getUsers()` - List all users in organization
- `userService.updateUser()` - Update user info

## 🐛 Troubleshooting

### "Missing Supabase environment variables"
- Make sure `.env.local` exists in project root
- Restart dev server after creating `.env.local`

### "Invalid login credentials"
- Make sure you signed up first
- Check email is correct
- Password must be at least 6 characters

### "Failed to create organization"
- Check SQL schema ran successfully
- Verify `organizations` table exists
- Check browser console for error details

### "Profile not found"
- Check `handle_new_user()` trigger is created
- Verify `profiles` table exists
- Check browser console for errors

## 📊 Database Access

Your Supabase project:
- **Project URL**: https://jdbxqjanhjiafafjukdzd.supabase.co
- **Dashboard**: https://supabase.com/dashboard/project/jdbxqjanhjiafafjukdzd

## 🎓 Understanding the Flow

1. **User signs up** → Creates auth user in `auth.users`
2. **Trigger fires** → `handle_new_user()` creates profile in `profiles`
3. **User logs in** → Session created, profile fetched
4. **Data access** → RLS policies filter by organization_id
5. **Multi-tenant** → Each org sees only their data

## 🚀 You're Ready!

Everything is set up. Now test the signup and login, then proceed to implement the actual features like user management, classes, attendance, etc.

Happy coding! 🎉
