# 🧪 Testing Guide: Organization ID Persistence Fix

## 🎯 What Was Fixed

Fixed the critical issue where **Organization ID becomes NULL** when navigating between pages, causing data to not load and requiring manual page refresh.

## 📋 Pre-Testing Checklist

Before testing, ensure:
- ✅ All changes have been saved
- ✅ Development server is running (`npm run dev`)
- ✅ You're logged in with a user that has an organization assigned
- ✅ Browser console is open (F12) to see debug logs

## 🧪 Test Scenarios

### Test 1: Basic Page Navigation
**Purpose:** Verify organization ID persists when navigating between pages

**Steps:**
1. Login to your account
2. Open browser console (F12)
3. Navigate to **Dashboard** page
4. Check console for: `User organization ID: <uuid>` (should NOT be null)
5. Navigate to **Users** page
6. Check console for: `User organization ID: <uuid>` (should be the SAME uuid)
7. Navigate to **Classes** page
8. Check console again
9. Navigate back to **Users** page
10. Repeat steps 5-9 several times

**Expected Result:**
- ✅ Organization ID should remain the same across all pages
- ✅ No "NULL" organization ID errors
- ✅ No debug warning panel showing "Organization ID: NULL"
- ✅ Data loads correctly on all pages
- ✅ Console shows: `✅ Keeping existing user data with organizationId: <uuid>`

**Failure Indicators:**
- ❌ Organization ID becomes NULL
- ❌ Debug panel shows "Organization ID: NULL - This is the issue!"
- ❌ Users page shows "No users returned from service"
- ❌ Need to refresh page to see data

### Test 2: Token Refresh Simulation
**Purpose:** Verify organization ID persists during auth token refresh

**Steps:**
1. Login to your account
2. Stay on the **Users** page
3. Wait for 5-10 minutes (Supabase refreshes tokens periodically)
4. Watch the console for: `🔄 Token refreshed - silently updating user data in background...`
5. After token refresh, verify organization ID is still present
6. Navigate to another page and back

**Expected Result:**
- ✅ Organization ID persists after token refresh
- ✅ No data loss or page reload required
- ✅ Console shows: `✅ Keeping existing user data with organizationId: <uuid>`

### Test 3: Network Error Resilience
**Purpose:** Verify organization ID persists even with network issues

**Steps:**
1. Login to your account
2. Open browser DevTools (F12) → Network tab
3. Set network throttling to "Slow 3G" or "Offline"
4. Navigate between pages
5. Restore network to "No throttling"
6. Verify organization ID is still present

**Expected Result:**
- ✅ Organization ID persists even with network errors
- ✅ Console shows: `✅ Keeping existing user data with organizationId: <uuid>`
- ✅ No data corruption

### Test 4: Create New User
**Purpose:** Verify the fix doesn't break user creation

**Steps:**
1. Login as Admin
2. Go to **Users** page
3. Click "Add User" button
4. Fill in user details:
   - Full Name: Test User
   - Email: test@example.com
   - Role: Student
   - Password: Test123!
5. Click "Create User"
6. Verify user appears in the list
7. Navigate to another page and back
8. Verify the new user is still visible

**Expected Result:**
- ✅ User created successfully
- ✅ User appears in the list
- ✅ Organization ID persists after navigation
- ✅ New user is visible after navigation

### Test 5: Fresh Login
**Purpose:** Verify the fix works on fresh login

**Steps:**
1. Logout completely
2. Clear browser cache (Ctrl+Shift+Delete)
3. Login again
4. Navigate to **Users** page
5. Check organization ID in console
6. Navigate to other pages

**Expected Result:**
- ✅ Organization ID loads correctly on first login
- ✅ Organization ID persists across all pages
- ✅ No errors in console

## 🔍 What to Look For in Console

### ✅ Good Signs (Fix Working)
```
📥 Fetching user data for: <user-id>
✅ Profile data fetched: {organization_id: "<org-id>", ...}
✅ Keeping existing user data with organizationId: <org-id>
User organization ID: <org-id>
```

### ❌ Bad Signs (Fix Not Working)
```
⚠️ Profile fetch timed out
⚠️ Using fallback user data from auth metadata
User organization ID: undefined
Organization ID: NULL - This is the issue!
```

## 📊 Success Criteria

The fix is successful if:
- ✅ Organization ID **never** becomes NULL during normal navigation
- ✅ Users page loads data without requiring page refresh
- ✅ Console shows "Keeping existing user data" messages
- ✅ No debug warning panel appears
- ✅ All CRUD operations work correctly
- ✅ Token refresh doesn't corrupt user state

## 🐛 If Issues Persist

If you still see organization ID becoming NULL:

1. **Check Supabase Connection:**
   - Verify `.env.local` has correct Supabase URL and key
   - Check Supabase dashboard for any service issues

2. **Check Database:**
   - Open Supabase dashboard → Table Editor
   - Check `profiles` table
   - Verify your user has `organization_id` set (not NULL)

3. **Check RLS Policies:**
   - Ensure Row Level Security policies allow reading profiles
   - Run this SQL in Supabase SQL Editor:
   ```sql
   SELECT * FROM profiles WHERE id = auth.uid();
   ```
   - Should return your profile with organization_id

4. **Clear All State:**
   - Logout
   - Clear browser cache completely
   - Clear localStorage (F12 → Application → Local Storage → Clear)
   - Login again

## 📝 Report Issues

If the fix doesn't work, please provide:
1. Screenshot of browser console showing the error
2. Screenshot of the debug panel (if visible)
3. Steps to reproduce the issue
4. Browser and version
5. Any error messages from console

