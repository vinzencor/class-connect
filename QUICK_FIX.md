# 🚨 QUICK FIX: Failed to Fetch Error

## The Problem
You're getting `TypeError: Failed to fetch` when signing up.

## The Solution (Do These 3 Steps)

### ✅ Step 1: Stop Your Dev Server
In your terminal where the dev server is running:
- Press **Ctrl+C** to stop it

### ✅ Step 2: Get Your Real Supabase URL

1. Open https://supabase.com/dashboard
2. Click on your project
3. Go to **Settings** (gear icon on left)
4. Click **API** 
5. Look for **Project URL** under "Configuration"
6. It should look like: `https://xxxxx.supabase.co`

**Copy that exact URL!**

### ✅ Step 3: Update .env.local

1. Open the file: `.env.local` in your project root
2. Replace the VITE_SUPABASE_URL line with your real URL from Step 2
3. Save the file

It should look like this:
```
VITE_SUPABASE_URL=https://YOUR-ACTUAL-PROJECT-ID.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### ✅ Step 4: Restart Dev Server

In your terminal:
```bash
npm run dev
```

### ✅ Step 5: Test Again

1. Open http://localhost:5173
2. You should see a **Connection Test** panel in the bottom-right corner
3. It should show "✅ Connected" if working
4. Try signing up again!

## 🔍 Visual Check

When you reload the page, look at the bottom-right corner. You'll see a diagnostic panel showing:
- Your Supabase URL
- Connection status
- Error details (if any)

This will help us identify the exact issue!

## 💡 Common Issues

### Issue: "NOT SET" in diagnostic panel
**Fix:** Environment variables not loaded
- Make sure `.env.local` is in the project root (not in src/)
- Restart the dev server completely
- Clear cache: Delete `node_modules/.vite` folder

### Issue: "Connection failed: FetchError"
**Fix:** Wrong URL
- Double-check URL from Supabase dashboard
- Make sure it ends with `.supabase.co`
- No trailing slash

### Issue: "Invalid API key"
**Fix:** Wrong anon key
- Copy the **anon public** key from Supabase → Settings → API
- Paste it in `.env.local` as `VITE_SUPABASE_ANON_KEY`

## 📞 Screenshot What You See

After restarting, take a screenshot of:
1. The diagnostic panel (bottom-right)
2. Browser console (F12)

This will help debug if still not working!
