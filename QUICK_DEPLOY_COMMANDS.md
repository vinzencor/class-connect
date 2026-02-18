# ⚡ Quick Deploy Commands

## Prerequisites
```bash
# Install Supabase CLI (if not installed)
npm install -g supabase
```

## Deploy in 5 Steps

### 1. Navigate to project
```bash
cd d:\Ecraftz\TeamMates\class-connect
```

### 2. Link to Supabase project
```bash
supabase link --project-ref jdbxqjanhjifafjukdzd
```

### 3. Deploy Edge Function
```bash
supabase functions deploy create-student
```

### 4. Set Service Role Key
```bash
# Get your service role key from: https://supabase.com/dashboard/project/jdbxqjanhjifafjukdzd/settings/api
# Then run:
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### 5. Verify
```bash
supabase functions list
supabase secrets list
```

## That's it! 🎉

Now test by verifying a student registration in your app.

## Useful Commands

```bash
# View function logs
supabase functions logs create-student

# Delete function (if needed)
supabase functions delete create-student

# List all functions
supabase functions list

# List all secrets
supabase secrets list

# Unset a secret
supabase secrets unset SUPABASE_SERVICE_ROLE_KEY
```

## Where to Get Service Role Key

1. Go to: https://supabase.com/dashboard/project/jdbxqjanhjifafjukdzd/settings/api
2. Scroll to "Project API keys"
3. Copy the **service_role** key (not the anon key!)
4. ⚠️ Keep it secret - never commit to git!

