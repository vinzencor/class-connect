# 🧪 Testing Guide for Organization Fix

## Quick Test (5 minutes)

### 1. Apply the Database Fix

Open Supabase SQL Editor and run:
```sql
-- Copy and paste the entire contents of: APPLY_FIX_NOW.sql
```

You should see:
```
✅ FIX APPLIED SUCCESSFULLY!
broken_profiles: 0
fixed_profiles: [your count]
total_profiles: [your count]
```

### 2. Verify in Database

Run this query:
```sql
SELECT id, email, full_name, role, organization_id 
FROM profiles 
WHERE organization_id IS NULL;
```

**Expected Result:** 0 rows (no broken profiles)

### 3. Test Existing User Login

1. Open your app in browser
2. Open Developer Tools (F12) → Console
3. Login with your existing account
4. Look for these console messages:

**✅ Good signs:**
```
📥 Fetching user data for: [user-id]
✅ Profile data fetched: [profile-data]
Fetching organization: [org-id]
✅ Organization found: [org-data]
```

**❌ Bad signs (should NOT see):**
```
⚠️ No organization_id in profile
🔧 Auto-fixing user without organization...
```

### 4. Test Navigation

1. Navigate to Dashboard
2. Navigate to Users page
3. Navigate to Settings
4. Navigate back to Dashboard

**Check:** Organization ID should NEVER become NULL during navigation.

### 5. Test New User Signup (Optional)

1. Logout
2. Click "Sign Up"
3. Create a new account
4. Watch console logs

**Expected logs:**
```
📝 Starting signup process for: [email]
👤 Step 1: Creating user account...
✅ User account created: [user-id]
⏳ Step 2: Waiting for profile creation...
✅ Profile exists
🏢 Step 3: Creating organization: [org-name]
✅ Organization created: [org-id]
🔗 Step 4: Linking profile to organization...
✅ Profile linked to organization
✅ Step 5: Verifying organization link...
✅ Organization link verified: [org-id]
✅ Signup completed successfully!
```

## Detailed Test (15 minutes)

### Test 1: Database Trigger

Create a test profile without organization:
```sql
-- This should automatically get an organization assigned by the trigger
INSERT INTO profiles (id, email, full_name, role)
VALUES (gen_random_uuid(), 'test-trigger@example.com', 'Test User', 'admin')
RETURNING id, email, organization_id;
```

**Expected:** organization_id should NOT be NULL

Cleanup:
```sql
DELETE FROM profiles WHERE email = 'test-trigger@example.com';
```

### Test 2: Auto-Fix for Different Roles

Test with admin:
```sql
-- Create admin without org
INSERT INTO profiles (id, email, full_name, role, organization_id)
VALUES (gen_random_uuid(), 'admin-test@example.com', 'Admin Test', 'admin', NULL);

-- Check if trigger fixed it
SELECT email, role, organization_id FROM profiles WHERE email = 'admin-test@example.com';

-- Cleanup
DELETE FROM profiles WHERE email = 'admin-test@example.com';
```

### Test 3: Frontend Auto-Fix

1. Manually set organization_id to NULL in database:
```sql
UPDATE profiles 
SET organization_id = NULL 
WHERE email = 'your-email@example.com';
```

2. Refresh the page in browser
3. Check console logs - should see auto-fix messages
4. Verify organization_id is restored

### Test 4: Signup Flow

1. Create new account with unique email
2. Verify organization is created
3. Verify profile is linked
4. Check database:
```sql
SELECT p.email, p.role, p.organization_id, o.name as org_name
FROM profiles p
LEFT JOIN organizations o ON p.organization_id = o.id
WHERE p.email = 'your-new-email@example.com';
```

## Success Criteria

✅ **All tests pass if:**
- No profiles have NULL organization_id
- Database trigger prevents NULL organization_id
- Frontend auto-fix works on login
- Signup creates and links organization
- Navigation doesn't lose organization_id
- Console shows no error messages

## Common Issues

### Issue: Trigger not working
```sql
-- Check if trigger exists
SELECT * FROM pg_trigger WHERE tgname = 'prevent_null_organization_trigger';

-- If not found, re-run APPLY_FIX_NOW.sql
```

### Issue: Auto-fix not running
- Clear browser cache
- Hard refresh (Ctrl+Shift+R)
- Check console for errors

### Issue: Still seeing NULL organization_id
```sql
-- Re-run the fix
-- Copy and paste: APPLY_FIX_NOW.sql
```

## Monitoring in Production

After deploying, monitor these:

1. **Database query:**
```sql
-- Run daily to check for broken profiles
SELECT COUNT(*) FROM profiles WHERE organization_id IS NULL;
```

2. **Browser console:**
- Look for auto-fix messages
- Check for error messages

3. **User reports:**
- Monitor for "Organization Not Linked" errors
- Check support tickets

## Rollback (If Needed)

If something goes wrong:

```sql
-- Remove the trigger
DROP TRIGGER IF EXISTS prevent_null_organization_trigger ON profiles;
DROP FUNCTION IF EXISTS prevent_null_organization();

-- Restore from backup
-- (Use Supabase Dashboard → Database → Backups)
```

---

**Need Help?**
- Check console logs for detailed error messages
- Review FIX_ORGANIZATION_NULL_ISSUE.md for full documentation
- Contact support with user ID and console logs

