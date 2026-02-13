# Quick Fix Deployment Guide

## Problem
- Auth users are created but profiles are NOT created
- FK constraint error: "Key is not present in table 'users'"
- Edge Function falling back to regular signUp (requires email confirmation)

## Solution: Fix FK Constraint & Deploy Edge Function

---

## Step 1: Fix the Foreign Key Constraint (CRITICAL - Do this first!)

1. **Open Supabase Dashboard**: https://supabase.com/dashboard
2. **Navigate to**: Your Project → SQL Editor
3. **Copy & Run** the entire contents of `fix-profiles-fk-constraint.sql`
4. **Verify success**: Should see "Success. No rows returned"

This fixes:
- ✅ Corrects FK constraint to reference `auth.users` instead of `public.users`
- ✅ Creates/updates the `handle_new_user()` trigger function
- ✅ Sets up trigger to auto-create profiles

---

## Step 2: Deploy the Edge Function

### Option A: Using Supabase CLI (Recommended)

```powershell
# 1. Make sure you're in the project directory
cd D:\Ecraftz\TeamMates\class-connect

# 2. Login to Supabase (if not already)
supabase login

# 3. Link to your project (if not already linked)
supabase link --project-ref YOUR_PROJECT_REF

# 4. Deploy the Edge Function
supabase functions deploy create-student

# 5. Verify deployment
supabase functions list
```

### Option B: Manual Deployment via Dashboard

1. **Go to**: Supabase Dashboard → Edge Functions
2. **Click**: "New function"
3. **Name**: `create-student`
4. **Paste** the code from `supabase/functions/create-student/index.ts`
5. **Click**: "Deploy"

---

## Step 3: Verify Everything Works

### Test 1: Check FK Constraint

Run this in SQL Editor:
```sql
SELECT conname, conrelid::regclass, confrelid::regclass, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname = 'profiles_id_fkey';
```

**Expected Result**: Should show `auth.users` in the `confrelid` column

### Test 2: Check Trigger

Run this in SQL Editor:
```sql
SELECT trigger_name, event_object_table, action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';
```

**Expected Result**: Should show the trigger exists on `auth.users` table

### Test 3: Test Student Creation

1. Go to your app → Converted Leads page
2. Click "Review" on a submitted registration
3. Click "Verify & Create Account"
4. **Expected**:
   - ✅ "Student auth user created with auto-confirmation"
   - ✅ Profile created (no retries or minimal retries)
   - ✅ No FK constraint errors
   - ✅ Success message

---

## Step 4: Check Auth Settings (Optional)

If you want to keep email confirmation disabled:

1. **Go to**: Supabase Dashboard → Authentication → Settings
2. **Find**: "Enable email confirmations"
3. **Toggle**: OFF
4. **Save**

> **Note**: With the Edge Function + FK fix, this is optional. The Edge Function auto-confirms emails regardless of this setting.

---

## Troubleshooting

### If Edge Function deployment fails:

```powershell
# Check Supabase CLI version
supabase --version

# Update if needed
scoop update supabase

# Try deploying with verbose logging
supabase functions deploy create-student --debug
```

### If you see "Edge Function not found":

The Edge Function might not be deployed. Use Option A or B above to deploy it.

### If FK constraint error persists:

1. Verify the SQL fix was run successfully
2. Check the constraint with Test 1 above
3. If still wrong, try running the fix SQL again

---

## What Happens After Fix?

1. ✅ **Edge Function**: Admin creates student → Edge Function called → User created with `email_confirm: true` → Profile created automatically
2. ✅ **No FK Errors**: Profile FK correctly references `auth.users`
3. ✅ **No Manual Creation Needed**: Trigger works properly
4. ✅ **No Email Confirmation**: Students can log in immediately

---

## Quick Checklist

- [ ] Run `fix-profiles-fk-constraint.sql` in Supabase SQL Editor
- [ ] Deploy Edge Function: `supabase functions deploy create-student`
- [ ] Test student verification in Converted Leads page
- [ ] Verify no FK constraint errors in console
- [ ] Verify profile created automatically (no retries)

---

## Need Help?

If you encounter issues:
1. Check browser console for specific error messages
2. Check Supabase logs: Dashboard → Logs
3. Run the verification tests above
4. Check Edge Function logs: Dashboard → Edge Functions → create-student → Logs
