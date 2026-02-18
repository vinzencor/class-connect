# 🚀 Deployment Guide: Email Confirmation with Auto-Confirm for Admin-Created Users

## Overview

This solution allows you to:
- ✅ **Keep email confirmation ENABLED** for regular user signups
- ✅ **Auto-confirm admin-created users** (students/faculty created by admins)
- ✅ **Maintain security** by using Supabase Edge Functions with service role key

## Architecture

```
Admin Creates Student
       ↓
Frontend calls adminUserService.createUser()
       ↓
Edge Function: create-student
       ↓
Uses Service Role Key to call auth.admin.createUser()
       ↓
User created with email_confirm: true
       ↓
Database trigger creates profile
       ↓
✅ Student can log in immediately
```

## Prerequisites

1. **Supabase CLI** installed
2. **Service Role Key** from Supabase Dashboard
3. **Admin access** to your Supabase project

## Step 1: Install Supabase CLI

If you don't have it installed:

```bash
# Using npm
npm install -g supabase

# Or using scoop (Windows)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

Verify installation:
```bash
supabase --version
```

## Step 2: Get Your Service Role Key

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: **ecraftzteammates@gmail.com's Project**
3. Navigate to **Settings → API**
4. Find **Service Role Key** (secret key)
5. **Copy it** (keep it secure - never commit to git!)

## Step 3: Link Your Project

In your terminal, navigate to the project directory:

```bash
cd d:\Ecraftz\TeamMates\class-connect
```

Link to your Supabase project:

```bash
supabase link --project-ref jdbxqjanhjifafjukdzd
```

You'll be prompted to enter your database password.

## Step 4: Deploy the Edge Function

Deploy the `create-student` Edge Function:

```bash
supabase functions deploy create-student
```

## Step 5: Set Environment Variables

Set the service role key as a secret (this is secure and won't be exposed):

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

Replace `your_service_role_key_here` with the actual service role key you copied in Step 2.

## Step 6: Verify Deployment

Check that the function is deployed:

```bash
supabase functions list
```

You should see `create-student` in the list.

## Step 7: Test the Function

1. **Keep email confirmation ENABLED** in Supabase Dashboard:
   - Go to Authentication → Settings
   - Ensure "Enable email confirmations" is **ON**

2. **Test student registration**:
   - Go to your app → Converted Leads
   - Click "Verify" on a submitted registration
   - Should succeed without errors!

## How It Works

### Frontend Code (`registrationService.ts`)

```typescript
// Uses adminUserService to create user
const result = await adminUserService.createUser({
  email: registration.email!,
  password: tempPassword,
  full_name: registration.full_name || '',
  role: 'student',
  organization_id: registration.organization_id,
  metadata: userMetadata,
});
```

### Admin User Service (`adminUserService.ts`)

```typescript
// Calls Edge Function with auth token
const { data: result } = await supabase.functions.invoke('create-student', {
  body: data,
  headers: {
    Authorization: `Bearer ${session.access_token}`,
  },
});
```

### Edge Function (`supabase/functions/create-student/index.ts`)

```typescript
// Uses service role key to create user with auto-confirmation
const { data: newUser } = await supabaseAdmin.auth.admin.createUser({
  email,
  password,
  email_confirm: true, // 🔑 This auto-confirms the email!
  user_metadata: { full_name, role, organization_id }
});
```

## Security Features

✅ **Service Role Key** is stored securely in Supabase (not in your code)  
✅ **Admin verification** - Edge Function checks if caller is an admin  
✅ **Organization scoping** - Users are created within the admin's organization  
✅ **CORS protection** - Only your domain can call the function  

## Troubleshooting

### Issue: "Edge Function not found"

**Solution**: Make sure you deployed the function:
```bash
supabase functions deploy create-student
```

### Issue: "Unauthorized" error

**Solution**: Check that:
1. You're logged in as an admin
2. Your session is valid
3. The service role key is set correctly

### Issue: "Profile not created"

**Solution**: Check the database trigger:
```sql
SELECT * FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created';
```

### Issue: Function deployment fails

**Solution**: 
1. Make sure you're linked to the correct project
2. Check your internet connection
3. Verify you have the correct permissions

## Verification Checklist

After deployment, verify:

- ✅ Edge Function is deployed (`supabase functions list`)
- ✅ Service role key is set (`supabase secrets list`)
- ✅ Email confirmation is ENABLED in Supabase Dashboard
- ✅ Can verify student registrations without errors
- ✅ Students are created with confirmed emails
- ✅ Profiles are created automatically
- ✅ Students can log in immediately

## Rollback Plan

If something goes wrong, you can rollback:

```bash
# Delete the Edge Function
supabase functions delete create-student

# The code will automatically fall back to regular signUp
# (but will require email confirmation)
```

## Next Steps

1. **Deploy the Edge Function** following the steps above
2. **Test thoroughly** with a few registrations
3. **Monitor logs** in Supabase Dashboard → Edge Functions → Logs
4. **Update other user creation flows** (faculty creation, etc.) to use the same service

## Additional Resources

- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Supabase Auth Admin API](https://supabase.com/docs/reference/javascript/auth-admin-createuser)
- [Supabase CLI Reference](https://supabase.com/docs/reference/cli/introduction)

