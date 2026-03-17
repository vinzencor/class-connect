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
      .select('role, organization_id, branch_id')
      .eq('id', user.id)
      .single()

    if (profileError || !['admin', 'sales_staff'].includes(callerProfile.role)) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin or Sales Staff access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const { email, password, full_name, role, organization_id, metadata, branch_id, role_id } = await req.json()

    if (!email || !password || !full_name || !role) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, password, full_name, role' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const orgId = organization_id || callerProfile.organization_id

    // Resolve branch_id: use provided, or caller's branch_id, or look up main branch
    let resolvedBranchId = branch_id || callerProfile.branch_id
    if (!resolvedBranchId) {
      const { data: mainBranch } = await supabaseAdmin
        .from('branches')
        .select('id')
        .eq('organization_id', orgId)
        .eq('is_main_branch', true)
        .maybeSingle()
      resolvedBranchId = mainBranch?.id || null
    }

    // ── Step 1: Create auth user ──
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        role,
        role_id,
        organization_id: orgId,
        ...(metadata || {}),
      },
    })

    if (createError) {
      console.warn('auth.admin.createUser failed, trying with trigger disabled:', createError.message)

      try {
        await supabaseAdmin.rpc('exec_sql', {
          query: 'ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;',
        }).throwOnError()
      } catch (_disableErr) {
        console.warn('Could not disable trigger via RPC')
      }

      // Retry user creation
      const { data: retryUser, error: retryError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name, role, role_id, organization_id: orgId, ...(metadata || {}) },
      })

      // Re-enable trigger
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

      // Explicitly create profile
      const { data: manualProfile, error: manualErr } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: retryUser.user.id,
          email,
          full_name,
          role,
          role_id,
          organization_id: orgId,
          branch_id: resolvedBranchId,
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

    // ── Step 2: Ensure profile exists ──
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
      console.warn('Profile not created by trigger, upserting manually')
      const { data: manualProfile, error: manualError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: userId,
          email,
          full_name,
          role,
          role_id,
          organization_id: orgId,
          branch_id: resolvedBranchId,
          is_active: true,
          metadata: metadata || {},
        }, { onConflict: 'id' })
        .select()
        .single()

      if (manualError) {
        console.error('Manual profile upsert failed:', manualError)
        return new Response(
          JSON.stringify({ error: 'User created but profile creation failed: ' + manualError.message, user: newUser.user }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      existingProfile = manualProfile
    } else {
      // Profile exists — ensure all fields are correct
      await supabaseAdmin
        .from('profiles')
        .update({ 
          organization_id: orgId, 
          role, 
          role_id,
          full_name, 
          ...(resolvedBranchId && !existingProfile.branch_id ? { branch_id: resolvedBranchId } : {}) 
        })
        .eq('id', userId)
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

