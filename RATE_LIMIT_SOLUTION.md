# 🚨 Rate Limit Error - Solutions

## The Problem
Supabase has rate limits on `auth.signUp()`:
- **Free tier**: 4 signups per hour per IP address
- You've exceeded this limit

## ✅ Solution 1: Wait 1 Hour (Easiest)
Simply wait 1 hour and the rate limit will reset automatically.

## ✅ Solution 2: Create Users via Supabase Dashboard (Recommended)

### Steps:
1. Go to: https://supabase.com/dashboard/project/ajxdxzoncpfmfphtwgmg/auth/users
2. Click **"Add user"** button (top right)
3. Fill in:
   - **Email**: student@example.com
   - **Password**: ChangeMe123!
   - **Auto Confirm User**: ✅ Check this box
4. Click **"Create user"**
5. After user is created, run this SQL to assign them to your organization:

```sql
-- Get your organization ID first
SELECT id, name FROM organizations ORDER BY created_at DESC LIMIT 1;

-- Update the new user's profile (replace the email and org ID)
UPDATE profiles
SET 
  organization_id = 'YOUR_ORG_ID_HERE',
  role = 'student',
  full_name = 'Student Name'
WHERE email = 'student@example.com';
```

## ✅ Solution 3: Bulk Create Users via SQL (For Multiple Users)

Run this in Supabase SQL Editor to create multiple users at once:

```sql
-- This creates users directly in the profiles table
-- They will need to sign up with these emails to activate their accounts

INSERT INTO profiles (id, email, full_name, role, organization_id)
VALUES
  (gen_random_uuid(), 'student1@example.com', 'Student One', 'student', 'YOUR_ORG_ID'),
  (gen_random_uuid(), 'student2@example.com', 'Student Two', 'student', 'YOUR_ORG_ID'),
  (gen_random_uuid(), 'faculty1@example.com', 'Faculty One', 'faculty', 'YOUR_ORG_ID')
ON CONFLICT (email) DO NOTHING;
```

**Note**: Replace `YOUR_ORG_ID` with your actual organization ID from the first query.

## ✅ Solution 4: Disable Email Confirmation (Development Only)

For development, you can disable email confirmation:

1. Go to: https://supabase.com/dashboard/project/ajxdxzoncpfmfphtwgmg/auth/settings
2. Scroll to **"Email Auth"**
3. **Uncheck** "Enable email confirmations"
4. Click **Save**

⚠️ **Warning**: Only do this in development! Re-enable for production.

## 📊 Check Current Rate Limit Status

Supabase doesn't provide a way to check your current rate limit status, but you can:
- Wait 1 hour from your last signup attempt
- Use the dashboard method instead (no rate limits)

## 🎯 Best Practice for Production

For production apps, you should:
1. Use **Supabase Admin API** with `service_role` key (server-side only)
2. Send **invitation emails** with magic links
3. Use **OAuth providers** (Google, GitHub, etc.)
4. Implement **email verification** properly

## Current App Behavior

The app now shows a better error message:
> "Too many signup attempts. Please wait 1 hour before creating more users, or use the Supabase Dashboard to create users directly."

This guides users to use the dashboard method instead.

