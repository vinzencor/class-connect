# 🔧 Troubleshooting "Failed to fetch" Error

## ❌ Error: `TypeError: Failed to fetch`

This error occurs when the app cannot connect to Supabase. Here's how to fix it:

## ✅ Solution Steps

### 1. Verify Supabase Project URL (MOST COMMON ISSUE)

Your `.env.local` currently has:
```
VITE_SUPABASE_URL=https://jdbxqjanhjiafafjukdzd.supabase.co
```

**ACTION REQUIRED**: Verify this is your actual project URL:

1. Go to https://supabase.com/dashboard
2. Select your project
3. Click **Settings** (gear icon) → **API**
4. Copy the **Project URL** under "Project Configuration"
5. Compare with your `.env.local` file

**Common URL formats:**
- ✅ `https://yourproject.supabase.co`
- ❌ NOT `https://supabase.co/yourproject`
- ❌ NOT `https://app.supabase.com/...`

### 2. Restart Dev Server (REQUIRED!)

After creating/modifying `.env.local`, you **MUST** restart:

**In your terminal:**
1. Press `Ctrl+C` to stop the current server
2. Run `npm run dev` again
3. Open http://localhost:5173

### 3. Check Environment Variables Loading

Add this temporary diagnostic to verify env vars are loaded:

**Open browser console (F12)** and check if variables are defined:
```javascript
console.log('VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL);
console.log('VITE_SUPABASE_ANON_KEY:', import.meta.env.VITE_SUPABASE_ANON_KEY);
```

Both should show values, not `undefined`.

### 4. Verify Supabase Project is Active

1. Go to https://supabase.com/dashboard
2. Check your project status
3. Make sure it's **active** (not paused)
4. Some free-tier projects pause after inactivity

## 🔍 Get Correct Credentials

### Where to Find Your Supabase Credentials:

1. Go to: https://supabase.com/dashboard
2. Select your project
3. Click **Settings** → **API**
4. You'll see:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon public** key (starts with `eyJhbGci...`)

### Update .env.local with Correct Values:

```bash
# .env.local
VITE_SUPABASE_URL=<YOUR_PROJECT_URL_HERE>
VITE_SUPABASE_ANON_KEY=<YOUR_ANON_KEY_HERE>
```

## 🔄 Full Reset Steps

If still not working, try this complete reset:

```bash
# 1. Stop dev server (Ctrl+C)

# 2. Clear Vite cache
rm -rf node_modules/.vite

# 3. Restart
npm run dev
```

## 🌐 Network Issues

### Check if Supabase is accessible:

Open browser and visit:
```
https://jdbxqjanhjiafafjukdzd.supabase.co
```

You should see a JSON response like:
```json
{"message":"The server is running"}
```

If you get an error or can't load the page:
- ❌ The URL is wrong
- ❌ Your Supabase project doesn't exist
- ❌ Network/firewall blocking access

## ✅ Verification Checklist

- [ ] Verified Project URL from Supabase dashboard
- [ ] Updated `.env.local` with correct URL
- [ ] Restarted dev server completely
- [ ] Cleared browser cache (Ctrl+Shift+R)
- [ ] Checked browser console for env vars
- [ ] Verified Supabase project is active
- [ ] Tested URL in browser directly

## 📞 Still Not Working?

### Create a test file to verify connection:

Create `src/test-supabase.ts`:
```typescript
import { supabase } from './lib/supabase';

// Test connection
supabase.from('organizations').select('count').then(
  (result) => console.log('✅ Connected!', result),
  (error) => console.error('❌ Connection failed:', error)
);
```

## 🎯 Most Likely Solution

**95% of the time**, this error is fixed by:

1. **Getting the correct Project URL** from Supabase dashboard
2. **Restarting the dev server** after updating `.env.local`

Try those two steps first!
