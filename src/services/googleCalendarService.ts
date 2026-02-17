import { supabase } from '@/lib/supabase';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const REDIRECT_URI = `${window.location.origin}/auth/google/callback`;

// Scopes required: calendar events (includes Meet link creation)
const SCOPES = 'https://www.googleapis.com/auth/calendar.events';

/**
 * Build the Google OAuth consent URL and redirect the user to it
 */
export function redirectToGoogleOAuth() {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent', // Always ask for consent to guarantee refresh_token
  });

  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Exchange the authorization code for tokens by calling the Edge Function
 */
export async function exchangeGoogleCode(code: string): Promise<{ success: boolean; connected_email?: string; error?: string }> {
  // Refresh the session to ensure we have a valid token
  const { data: sessionData, error: sessionError } = await supabase.auth.refreshSession();
  const accessToken = sessionData?.session?.access_token;

  if (sessionError || !accessToken) {
    console.error('Session refresh failed:', sessionError);
    return { success: false, error: 'Authentication failed. Please log out and log in again.' };
  }

  console.log('Calling google-oauth-callback with token length:', accessToken?.length);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  const response = await fetch(`${supabaseUrl}/functions/v1/google-oauth-callback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      code,
      redirect_uri: REDIRECT_URI,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    return { success: false, error: data.error || 'Failed to connect Google Calendar' };
  }

  return { success: true, connected_email: data.connected_email };
}

/**
 * Check if the organization has Google Calendar connected
 */
export async function getGoogleConnectionStatus(organizationId: string): Promise<{
  connected: boolean;
  connected_email?: string;
}> {
  const { data, error } = await supabase
    .from('google_oauth_tokens')
    .select('connected_email')
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (error || !data) {
    return { connected: false };
  }

  return { connected: true, connected_email: data.connected_email };
}

/**
 * Disconnect Google Calendar by deleting the token row
 */
export async function disconnectGoogle(organizationId: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('google_oauth_tokens')
    .delete()
    .eq('organization_id', organizationId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Create a Google Meet link by calling the Edge Function.
 * Returns the meet_link and event_id, or null if Google is not connected.
 */
export async function createGoogleMeetLink(params: {
  title: string;
  description?: string;
  start_time: string; // ISO 8601
  end_time: string;   // ISO 8601
  time_zone?: string;
  attendees?: { email: string }[];
  session_id?: string;
}): Promise<{ meet_link: string; event_id: string } | null> {
  // Refresh the session to ensure we have a valid token
  const { data: sessionData, error: sessionError } = await supabase.auth.refreshSession();
  const accessToken = sessionData?.session?.access_token;

  if (sessionError || !accessToken) {
    console.error('Session refresh failed:', sessionError);
    return null;
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/create-google-meet`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        title: params.title,
        description: params.description,
        start_time: params.start_time,
        end_time: params.end_time,
        time_zone: params.time_zone || 'Asia/Kolkata',
        attendees: params.attendees || [],
        session_id: params.session_id,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Google Meet creation failed:', data.error);
      return null;
    }

    return {
      meet_link: data.meet_link,
      event_id: data.event_id,
    };
  } catch (error) {
    console.error('Error creating Google Meet link:', error);
    return null;
  }
}
