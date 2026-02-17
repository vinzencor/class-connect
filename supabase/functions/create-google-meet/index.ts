// Supabase Edge Function: Create a Google Calendar event with Google Meet link
// Uses the org admin's stored refresh token to generate real Meet links

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<{ access_token: string; expires_in: number }> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  const data = await response.json()

  if (data.error) {
    throw new Error(`Google token refresh failed: ${data.error_description || data.error}`)
  }

  return { access_token: data.access_token, expires_in: data.expires_in }
}

async function createCalendarEvent(
  accessToken: string,
  params: {
    summary: string
    description?: string
    startTime: string
    endTime: string
    timeZone: string
    attendees: { email: string }[]
  }
): Promise<{ meetLink: string; eventId: string }> {
  const requestId = crypto.randomUUID()

  const eventBody: Record<string, unknown> = {
    summary: params.summary,
    description: params.description || `Class session: ${params.summary}`,
    start: {
      dateTime: params.startTime,
      timeZone: params.timeZone,
    },
    end: {
      dateTime: params.endTime,
      timeZone: params.timeZone,
    },
    conferenceData: {
      createRequest: {
        requestId,
        conferenceSolutionKey: {
          type: 'hangoutsMeet',
        },
      },
    },
  }

  // Add attendees if provided
  if (params.attendees && params.attendees.length > 0) {
    eventBody.attendees = params.attendees
  }

  const response = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventBody),
    }
  )

  const data = await response.json()

  if (data.error) {
    throw new Error(`Google Calendar API error: ${data.error.message || JSON.stringify(data.error)}`)
  }

  const meetLink = data.hangoutLink || data.conferenceData?.entryPoints?.find(
    (ep: { entryPointType: string; uri: string }) => ep.entryPointType === 'video'
  )?.uri || ''

  return {
    meetLink,
    eventId: data.id,
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify the caller is authenticated
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error('No Authorization header provided')
      return new Response(
        JSON.stringify({ error: 'No Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')

    // Use service role client to verify the JWT token
    // Service role is needed to validate user JWTs
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Verify the JWT token by passing it directly to getUser()
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) {
      console.error('Auth error:', authError?.message || 'Invalid JWT')
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: authError?.message || 'Invalid JWT' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get caller's organization
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, organization_id')
      .eq('id', user.id)
      .single()

    if (profileError || !profile.organization_id) {
      return new Response(
        JSON.stringify({ error: 'User profile or organization not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request
    const {
      title,
      description,
      start_time,
      end_time,
      time_zone = 'Asia/Kolkata',
      attendees = [],
      session_id,
    } = await req.json()

    if (!title || !start_time || !end_time) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: title, start_time, end_time' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get the org's Google OAuth token
    const { data: oauthToken, error: oauthError } = await supabaseAdmin
      .from('google_oauth_tokens')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .single()

    if (oauthError || !oauthToken) {
      return new Response(
        JSON.stringify({ error: 'Google Calendar not connected. Please connect Google Calendar in Settings.' }),
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

    // Get a fresh access token using the refresh token
    let accessToken = oauthToken.access_token
    const tokenExpiry = new Date(oauthToken.token_expires_at)
    const now = new Date()

    // If the token is expired or about to expire (within 5 minutes), refresh it
    if (!accessToken || tokenExpiry.getTime() - now.getTime() < 5 * 60 * 1000) {
      const refreshed = await refreshAccessToken(
        oauthToken.refresh_token,
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET
      )
      accessToken = refreshed.access_token

      // Update the stored access token
      await supabaseAdmin
        .from('google_oauth_tokens')
        .update({
          access_token: accessToken,
          token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        })
        .eq('organization_id', profile.organization_id)
    }

    // Create the Google Calendar event with Meet link
    const result = await createCalendarEvent(accessToken, {
      summary: title,
      description,
      startTime: start_time,
      endTime: end_time,
      timeZone: time_zone,
      attendees,
    })

    // If session_id provided, update the session with the Meet link and event ID
    if (session_id) {
      await supabaseAdmin
        .from('sessions')
        .update({
          meet_link: result.meetLink,
          google_calendar_event_id: result.eventId,
        })
        .eq('id', session_id)
    }

    return new Response(
      JSON.stringify({
        success: true,
        meet_link: result.meetLink,
        event_id: result.eventId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error creating Google Meet:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
