# 🔧 Fix: Organization ID Becomes NULL on Page Navigation

## ❌ Problem Description

**Critical Issue:** When navigating between pages (e.g., from Dashboard to Users page), the `organizationId` becomes NULL, causing the error:

```
⚠️ Debug Info:
User ID: 3432c8e6-ab23-442e-a3ba-e91730991832
Organization ID: NULL - This is the issue!
```

This prevents users from seeing their data and requires a page refresh to restore the organization ID.

## 🔍 Root Cause Analysis

The issue was in `src/contexts/AuthContext.tsx` in the `fetchUserData` function. There were **THREE fallback locations** where the code would set user data **without the organizationId** when errors occurred:

1. **Timeout Fallback (Line 69-81)**: When profile fetch timed out
2. **Profile Error Fallback (Line 160-170)**: When profile query returned an error
3. **General Error Fallback (Line 209-219)**: When any exception occurred

Additionally, the **TOKEN_REFRESHED** event handler would trigger `fetchUserData` in the background, and if it encountered any errors, it would overwrite the existing user state with incomplete data (missing organizationId).

### Why This Happened

When navigating between pages or when Supabase refreshes the auth token:
1. The `fetchUserData` function is called
2. If there's any network delay or temporary error fetching the profile
3. The fallback code would set user data from `auth.user_metadata`
4. **BUT** `auth.user_metadata` doesn't contain `organization_id` (it's in the profiles table)
5. This overwrites the existing user state, **losing the organizationId**

## ✅ Solution Implemented

### 1. **Preserve Existing User State on Errors**

Modified all three fallback locations to check if we already have complete user data before overwriting:

```typescript
// BEFORE (BAD - loses organizationId)
setUser({
  id: supabaseUser.id,
  email: supabaseUser.email!,
  name: supabaseUser.user_metadata?.full_name || 'User',
  role: (supabaseUser.user_metadata?.role as 'admin' | 'faculty' | 'student') || 'student',
});

// AFTER (GOOD - preserves organizationId)
if (user && user.id === supabaseUser.id && user.organizationId) {
  console.log('✅ Keeping existing user data with organizationId:', user.organizationId);
  return; // Keep existing state
}

// Only set minimal user data if we don't have any user data yet
console.warn('⚠️ No existing user data, setting minimal user from auth metadata');
setUser({
  id: supabaseUser.id,
  email: supabaseUser.email!,
  name: supabaseUser.user_metadata?.full_name || 'User',
  role: (supabaseUser.user_metadata?.role as 'admin' | 'faculty' | 'student') || 'student',
});
```

### 2. **Added `refreshUserData` Function**

Added a new function to the AuthContext that can be called manually to refresh user data:

```typescript
const refreshUserData = async () => {
  console.log('🔄 Manually refreshing user data...');
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();
  if (supabaseUser) {
    await fetchUserData(supabaseUser);
  } else {
    throw new Error('No authenticated user found');
  }
};
```

### 3. **Updated UsersPage to Auto-Refresh**

Modified `UsersPage.tsx` to automatically attempt to refresh user data if organizationId is missing:

```typescript
useEffect(() => {
  const initializePage = async () => {
    // If no organization ID, try to refresh user data first
    if (!user?.organizationId) {
      console.log('⚠️ No organization ID found, attempting to refresh user data...');
      try {
        await refreshUserData();
      } catch (error) {
        console.error('Failed to refresh user data:', error);
      }
    }
    
    // Now fetch users if we have organization ID
    if (user?.organizationId) {
      fetchUsers();
    }
  };
  
  initializePage();
}, [user?.organizationId]);
```

## 📝 Files Modified

1. **`src/contexts/AuthContext.tsx`**
   - Fixed timeout fallback (lines 69-89)
   - Fixed profile error fallback (lines 166-186)
   - Fixed general error fallback (lines 225-243)
   - Fixed SIGNED_IN error fallback (lines 321-346)
   - Added `refreshUserData` function
   - Exported `refreshUserData` in context

2. **`src/pages/UsersPage.tsx`**
   - Added auto-refresh logic when organizationId is missing
   - Improved error handling

## 🧪 Testing Instructions

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Login to your account**

3. **Navigate between pages:**
   - Go to Dashboard
   - Go to Users page
   - Go to Classes page
   - Go back to Users page
   - Repeat several times

4. **Verify:**
   - ✅ Organization ID should remain visible in all pages
   - ✅ No "NULL" organization ID errors
   - ✅ Data loads correctly on all pages
   - ✅ No need to refresh the page manually

5. **Check browser console:**
   - Look for logs like: `✅ Keeping existing user data with organizationId: <uuid>`
   - Should NOT see: `⚠️ Using fallback user data from auth metadata` repeatedly

## 🎯 Expected Behavior

- **Before Fix:** Organization ID becomes NULL when navigating between pages, requiring manual page refresh
- **After Fix:** Organization ID persists across all page navigations, no manual refresh needed

## 🔒 Additional Benefits

1. **Better Error Resilience:** Temporary network issues won't lose user state
2. **Smoother UX:** No loading interruptions when navigating
3. **Token Refresh Safety:** Auth token refreshes won't corrupt user state
4. **Manual Refresh Option:** Pages can call `refreshUserData()` if needed

## 📊 Impact

- **Severity:** CRITICAL (blocks core functionality)
- **User Impact:** HIGH (affects all users on every page navigation)
- **Fix Complexity:** MEDIUM (required understanding of React state management and Supabase auth flow)
- **Risk:** LOW (changes are defensive and preserve existing behavior)

