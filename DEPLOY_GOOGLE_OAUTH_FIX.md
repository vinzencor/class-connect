# 🚀 Quick Deploy Guide - Google OAuth Fix

## ⚡ 3-Minute Fix

### **What was fixed:**
- ✅ Google Calendar connection 401 error
- ✅ "Auth session missing!" error
- ✅ Google Meet link creation

---

## 📋 Deployment Steps

### **Option 1: Deploy via Supabase CLI (Recommended)**

```bash
# 1. Navigate to your project
cd class-connect

# 2. Login to Supabase (if not already logged in)
npx supabase login

# 3. Link to your project (if not already linked)
npx supabase link --project-ref jdbxqjanhjifafjukdzd

# 4. Deploy the fixed Edge Functions
npx supabase functions deploy google-oauth-callback
npx supabase functions deploy create-google-meet

# 5. Verify deployment
npx supabase functions list
```

**Expected Output:**
```
✓ Deployed function google-oauth-callback
✓ Deployed function create-google-meet
```

---

### **Option 2: Deploy via Supabase Dashboard**

1. **Go to:** [Supabase Dashboard](https://supabase.com/dashboard/project/jdbxqjanhjifafjukdzd)
2. **Navigate to:** Edge Functions
3. **For each function:**
   - Click on `google-oauth-callback`
   - Click "Deploy new version"
   - Copy the contents of `supabase/functions/google-oauth-callback/index.ts`
   - Paste and deploy
   - Repeat for `create-google-meet`

---

## ✅ Verify the Fix

### **Test 1: Connect Google Calendar**

1. Open your app: `http://localhost:8080` (or your production URL)
2. Login as admin
3. Go to **Settings** → **Google Calendar Integration**
4. Click **"Connect Google Calendar"**
5. Authorize with Google
6. **Expected:** ✅ "Google Calendar connected successfully!"

### **Test 2: Create Google Meet Link**

1. Go to **Create Session** page
2. Create a new session
3. **Expected:** ✅ Real Google Meet link is generated
4. **Format:** `https://meet.google.com/xxx-xxxx-xxx`

### **Test 3: Check Console**

1. Open **Developer Tools** (F12) → **Console**
2. Connect Google Calendar
3. **Expected:** ✅ No 401 errors
4. **Expected:** ✅ No "Auth session missing!" errors

---

## 🔍 Troubleshooting

### **Issue: "Command not found: supabase"**

**Solution:**
```bash
npm install -g supabase
```

### **Issue: "Project not linked"**

**Solution:**
```bash
npx supabase link --project-ref jdbxqjanhjifafjukdzd
```

### **Issue: "Unauthorized" when deploying**

**Solution:**
```bash
npx supabase login
```

### **Issue: Still getting 401 errors after deployment**

**Checklist:**
- [ ] Edge Functions deployed successfully
- [ ] Environment variables set in Supabase Dashboard:
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Browser cache cleared (Ctrl+Shift+Delete)
- [ ] Logged out and logged back in

---

## 📊 Environment Variables

Make sure these are set in **Supabase Dashboard** → **Edge Functions** → **Settings**:

```env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
SUPABASE_URL=https://jdbxqjanhjifafjukdzd.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

---

## 🎯 What Changed

### **File 1: `google-oauth-callback/index.ts`**

**Before:**
```typescript
const supabase = createClient(url, anonKey, {
  global: { headers: { Authorization: authHeader } }
})
const { data: { user } } = await supabase.auth.getUser()
```

**After:**
```typescript
const token = authHeader.replace('Bearer ', '')
const supabaseAdmin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})
const { data: { user } } = await supabaseAdmin.auth.getUser(token)
```

### **File 2: `create-google-meet/index.ts`**

**Same change as above.**

**Key Fix:** Using **service role key** instead of anon key to validate JWTs.

---

## ✅ Success Criteria

After deployment, you should be able to:

- [x] Connect Google Calendar without 401 errors
- [x] Create Google Meet links automatically
- [x] See calendar events in Google Calendar
- [x] Attendees receive calendar invites
- [x] Meet links are accessible

---

## 📞 Need Help?

If you encounter issues:

1. **Check Edge Function Logs:**
   - Supabase Dashboard → Edge Functions → Logs

2. **Check Browser Console:**
   - F12 → Console tab

3. **Verify Environment Variables:**
   - Supabase Dashboard → Edge Functions → Settings

---

## 🎉 Done!

**Status:** ✅ Ready to Deploy  
**Time Required:** 3 minutes  
**Breaking Changes:** None  
**Rollback:** Not needed (backward compatible)

---

**Deploy now and test!** 🚀

