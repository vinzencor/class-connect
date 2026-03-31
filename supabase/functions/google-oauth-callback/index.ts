// Supabase Edge Function: Exchange Google OAuth authorization code for tokens
// and store the refresh_token for the organization

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
    // Use service role client to verify the JWT token
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Parse request body first — the user token may be inside
    const { code, redirect_uri, user_access_token, branch_id } = await req.json()

    // Accept the user JWT from the body (preferred) or the Authorization header (fallback)
    let token = user_access_token || ''
    if (!token) {
      const authHeader = req.headers.get('Authorization')
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.replace('Bearer ', '')
      }
    }

    if (!token) {
      console.error('No user token provided')
      return new Response(
        JSON.stringify({ error: 'No authentication token provided. Send user_access_token in the body or Authorization header.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Received JWT token length:', token.length)

    // Verify the JWT token by passing it directly to getUser()
    // The service-role getUser() call validates the token against the auth server
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) {
      console.error('Auth verification failed:', authError?.message || 'No user returned', 'Status:', authError?.status)
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: authError?.message || 'Invalid or expired JWT. Please log out and log back in.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Authenticated user:', user.id, 'email:', user.email)

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, organization_id, branch_id')
      .eq('id', user.id)
      .single()

    if (profileError || profile.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!code) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')
    const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return new Response(
        JSON.stringify({ error: 'Google OAuth not configured on the server' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Exchange authorization code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirect_uri || 'http://localhost:8080/auth/google/callback',
        grant_type: 'authorization_code',
      }),
    })

    const tokenData = await tokenResponse.json()

    if (tokenData.error) {
      console.error('Google token exchange failed:', tokenData)
      return new Response(
        JSON.stringify({ error: `Google OAuth error: ${tokenData.error_description || tokenData.error}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { access_token, refresh_token, expires_in } = tokenData

    if (!refresh_token) {
      return new Response(
        JSON.stringify({ error: 'No refresh token received. Please revoke access at https://myaccount.google.com/permissions and try again with prompt=consent.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch the user's Google email
    let connectedEmail = ''
    try {
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${access_token}` },
      })
      const userInfo = await userInfoResponse.json()
      connectedEmail = userInfo.email || ''
    } catch (e) {
      console.error('Failed to fetch Google user info:', e)
    }

    // Calculate token expiry
    const tokenExpiresAt = new Date(Date.now() + (expires_in || 3600) * 1000).toISOString()

    const normalizedBranchId = branch_id || profile.branch_id || null

    // Upsert the token for this organization
    const { error: upsertError } = await supabaseAdmin
      .from('google_oauth_tokens')
      .upsert(
        {
          organization_id: profile.organization_id,
          branch_id: normalizedBranchId,
          access_token,
          refresh_token,
          token_expires_at: tokenExpiresAt,
          connected_by: user.id,
          connected_email: connectedEmail,
        },
        { onConflict: 'organization_id,branch_id' }
      )

    if (upsertError) {
      console.error('Failed to store tokens:', upsertError)
      return new Response(
        JSON.stringify({ error: 'Failed to store Google tokens' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        connected_email: connectedEmail,
        message: 'Google Calendar connected successfully',
      }),
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
