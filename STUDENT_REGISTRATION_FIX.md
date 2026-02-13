# Student Registration Profile Creation Fix

## Problem Description

When verifying student registrations and creating auth users, the profile creation was failing with this error:

```
Manual profile creation failed: {
  code: "23503",
  details: "Key is not present in table 'users'.",
  message: "insert or update on table 'profiles' violates foreign key constraint 'profiles_id_fkey'"
}
```

### Error Flow

1. Admin verifies a student registration
2. System calls `supabase.auth.signUp()` to create auth user
3. Auth user is created with ID: `8ae383cb-924b-4c35-9a05-7097b3942300`
4. Database trigger `handle_new_user()` should create profile automatically
5. **Trigger fails** - profile not created after 10 retries (5 seconds)
6. System attempts manual profile creation
7. **Manual creation fails** with foreign key constraint error
8. Error: User not found in `auth.users` table

## Root Cause

The issue occurs because **Email Confirmation is ENABLED** in Supabase Authentication settings.

When email confirmation is enabled:
- `supabase.auth.signUp()` creates a user in `auth.users` table
- BUT the user is in **"unconfirmed" state**
- The user ID exists but is not fully accessible
- Database triggers may not fire for unconfirmed users
- Foreign key constraints fail because the user is not "confirmed"

## Solution

### Option 1: Disable Email Confirmation (Recommended for Admin-Created Users)

1. **Go to Supabase Dashboard**
2. Navigate to **Authentication → Settings**
3. Find **"Enable email confirmations"**
4. **DISABLE** this setting

This allows admin-created users to be immediately active without email confirmation.

### Option 2: Use Auto-Confirm for Specific Signups

If you want to keep email confirmation for regular signups but auto-confirm admin-created users, modify the signup call:

```typescript
const { data: authData, error: authError } = await supabase.auth.signUp({
  email: registration.email!,
  password: tempPassword,
  options: {
    data: userMetadata,
    emailRedirectTo: `${window.location.origin}/login`,
  },
});
```

### Option 3: Manually Confirm Users in Dashboard

After each failed registration:
1. Go to Supabase Dashboard → Authentication → Users
2. Find the user by email
3. Click on the user
4. Click "Confirm email"
5. The profile will then be created

## Changes Made

### File: `src/services/registrationService.ts`

**Improved Error Handling:**
- Added better logging to diagnose the issue
- Added specific error message for foreign key constraint (code 23503)
- Added instructions in error message for fixing the issue
- Added additional 2-second wait before manual profile creation
- Added handling for duplicate key errors (23505)

**Better User Feedback:**
```typescript
if (manualProfileError.code === '23503') {
  throw new Error(
    '❌ User creation failed: Email confirmation is required.\n\n' +
    '📋 To fix this:\n' +
    '1. Go to Supabase Dashboard\n' +
    '2. Navigate to Authentication → Settings\n' +
    '3. Disable "Enable email confirmations"\n' +
    '4. Try again'
  );
}
```

## Testing Steps

After disabling email confirmation:

1. **Create a test registration**
   - Go to CRM → Leads
   - Create a new lead
   - Convert to registration

2. **Submit the registration form**
   - Fill out the student registration form
   - Submit it

3. **Verify the registration**
   - Go to Converted Leads page
   - Click "Verify" on the submitted registration
   - Should succeed without errors

4. **Check the results**
   - User should be created in Authentication
   - Profile should be created in profiles table
   - Student should be enrolled in the course
   - Payment record should be created

## Verification Checklist

After the fix, verify:

- ✅ Auth user is created in `auth.users` table
- ✅ Profile is created in `profiles` table (either by trigger or manually)
- ✅ Profile has correct `organization_id`
- ✅ Profile has correct `role` = 'student'
- ✅ Student is enrolled in the course (`class_enrollments`)
- ✅ Payment record is created (`payments`)
- ✅ Registration status is updated to 'verified'
- ✅ CRM lead status is updated to 'converted'
- ✅ Password reset email is sent to student

## Alternative: Use Service Role Key

For production environments, consider using the Supabase Service Role Key to create users with admin privileges:

```typescript
// Create a separate Supabase client with service role key
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Service role key
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Use admin client to create users
const { data, error } = await supabaseAdmin.auth.admin.createUser({
  email: registration.email!,
  password: tempPassword,
  email_confirm: true, // Auto-confirm email
  user_metadata: userMetadata,
});
```

**Note:** Service role key should NEVER be exposed in client-side code. Use it only in server-side functions or Edge Functions.

## Prevention

To prevent this issue in the future:

1. **Document the requirement** - Email confirmation must be disabled for admin-created users
2. **Add environment check** - Detect if email confirmation is enabled and show warning
3. **Use service role key** - For production, use server-side user creation with service role key
4. **Add better error messages** - Guide admins to fix the issue when it occurs

## Related Files

- `src/services/registrationService.ts` - Student registration and verification
- `src/pages/ConvertedLeadsPage.tsx` - UI for verifying registrations
- `supabase-schema.sql` - Database schema and triggers

