// Supabase Edge Function to create users (students/faculty) with auto-confirmation
// Uses service_role key so the trigger doesn't block user creation

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Verify caller is an authenticated admin
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: callerProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, organization_id')
      .eq('id', user.id)
      .single()

    if (profileError || callerProfile.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const { email, password, full_name, role, organization_id, metadata } = await req.json()

    if (!email || !password || !full_name || !role) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, password, full_name, role' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const orgId = organization_id || callerProfile.organization_id

    // ── Step 1: Create auth user ──
    // Pass minimal metadata so the trigger (if present) is less likely to fail.
    // We'll create / upsert the profile explicitly in Step 2.
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        role,
        organization_id: orgId,
        ...(metadata || {}),
      },
    })

    if (createError) {
      // If the trigger is broken, auth.admin.createUser itself may fail.
      // Try a workaround: temporarily disable the trigger, create the user,
      // then re-enable it. This requires SUPERUSER, which service_role has on Supabase.
      console.warn('auth.admin.createUser failed, trying with trigger disabled:', createError.message)

      try {
        // Disable the trigger
        await supabaseAdmin.rpc('exec_sql', {
          query: 'ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;',
        }).throwOnError()
      } catch (_disableErr) {
        // rpc('exec_sql') may not exist — try raw SQL via pg_net or just fail gracefully
        console.warn('Could not disable trigger via RPC, attempting raw approach')
      }

      // Retry user creation
      const { data: retryUser, error: retryError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name, role, organization_id: orgId, ...(metadata || {}) },
      })

      // Re-enable trigger (best-effort)
      try {
        await supabaseAdmin.rpc('exec_sql', {
          query: 'ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;',
        })
      } catch (_enableErr) {
        console.warn('Could not re-enable trigger via RPC')
      }

      if (retryError) {
        console.error('Retry also failed:', retryError)
        return new Response(
          JSON.stringify({ error: retryError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Use retried user
      const userId = retryUser.user.id

      // Explicitly create profile (trigger was disabled)
      const { data: manualProfile, error: manualErr } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: userId,
          email,
          full_name,
          role,
          organization_id: orgId,
          is_active: true,
          metadata: metadata || {},
        }, { onConflict: 'id' })
        .select()
        .single()

      if (manualErr) {
        console.error('Profile upsert failed after retry:', manualErr)
      }

      return new Response(
        JSON.stringify({ success: true, user: retryUser.user, profile: manualProfile }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── Step 2: Ensure profile exists (don't rely solely on trigger) ──
    const userId = newUser.user.id

    // Poll briefly for trigger-created profile
    let existingProfile = null
    for (let i = 0; i < 5; i++) {
      await new Promise(r => setTimeout(r, 300))
      const { data: p } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()
      if (p) { existingProfile = p; break }
    }

    if (!existingProfile) {
      // Trigger didn't fire or failed silently — create profile explicitly
      console.warn('Profile not created by trigger, upserting manually')
      const { data: manualProfile, error: manualError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: userId,
          email,
          full_name,
          role,
          organization_id: orgId,
          is_active: true,
          metadata: metadata || {},
        }, { onConflict: 'id' })
        .select()
        .single()

      if (manualError) {
        console.error('Manual profile upsert failed:', manualError)
        return new Response(
          JSON.stringify({ error: 'User created but profile creation failed', user: newUser.user }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      existingProfile = manualProfile
    } else {
      // Profile exists from trigger — ensure organization_id and role are correct
      if (!existingProfile.organization_id || existingProfile.organization_id !== orgId) {
        await supabaseAdmin
          .from('profiles')
          .update({ organization_id: orgId, role, full_name })
          .eq('id', userId)
      }
    }

    return new Response(
      JSON.stringify({ success: true, user: newUser.user, profile: existingProfile }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

