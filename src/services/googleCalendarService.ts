import { supabase } from '@/lib/supabase';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const REDIRECT_URI = `${window.location.origin}/auth/google/callback`;

// Scopes required: calendar events (includes Meet link creation)
const SCOPES = 'https://www.googleapis.com/auth/calendar.events';

/**
 * Build the Google OAuth consent URL and redirect the user to it
 */
export function redirectToGoogleOAuth(branchId?: string | null) {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent', // Always ask for consent to guarantee refresh_token
  });

  if (branchId) {
    params.set('state', branchId);
  }

  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Exchange the authorization code for tokens by calling the Edge Function
 */
export async function exchangeGoogleCode(code: string, branchId?: string | null): Promise<{ success: boolean; connected_email?: string; error?: string }> {
  // After the Google OAuth redirect, our session may be stale/expired.
  // Force a full session refresh to get a brand-new JWT.
  let accessToken: string | undefined;

  try {
    // First try refreshSession() which explicitly requests new tokens
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
    accessToken = refreshData?.session?.access_token;

    if (refreshError || !accessToken) {
      console.warn('refreshSession failed, trying getSession:', refreshError?.message);
      // Fallback: getSession may have a cached valid token
      const { data: sessionData } = await supabase.auth.getSession();
      accessToken = sessionData?.session?.access_token;
    }
  } catch (err) {
    console.error('Session retrieval error:', err);
  }

  if (!accessToken) {
    console.error('No valid session token available');
    return { success: false, error: 'Authentication expired. Please log out, log back in, and try connecting Google again.' };
  }

  console.log('Calling google-oauth-callback with token length:', accessToken.length);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  // Use the anon key as the Authorization header so the Supabase gateway
  // doesn't reject the request with "Invalid JWT". Pass the real user token
  // inside the body so the edge function can verify the caller.
  const response = await fetch(`${supabaseUrl}/functions/v1/google-oauth-callback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${anonKey}`,
      apikey: anonKey,
    },
    body: JSON.stringify({
      code,
      redirect_uri: REDIRECT_URI,
      user_access_token: accessToken,
      branch_id: branchId || null,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    // If JWT is still invalid, provide a clear user message
    if (response.status === 401) {
      return { success: false, error: 'Session expired. Please log out, log back in, and try connecting Google again.' };
    }
    return { success: false, error: data.error || 'Failed to connect Google Calendar' };
  }

  return { success: true, connected_email: data.connected_email };
}

/**
 * Check if the organization has Google Calendar connected
 */
export async function getGoogleConnectionStatus(organizationId: string, branchId?: string | null): Promise<{
  connected: boolean;
  connected_email?: string;
}> {
  let query = supabase
    .from('google_oauth_tokens')
    .select('connected_email')
    .eq('organization_id', organizationId);

  if (branchId) {
    query = query.eq('branch_id', branchId);
  } else {
    query = query.is('branch_id', null);
  }

  const { data, error } = await query.maybeSingle();

  if (error || !data) {
    return { connected: false };
  }

  return { connected: true, connected_email: data.connected_email };
}

/**
 * Disconnect Google Calendar by deleting the token row
 */
export async function disconnectGoogle(organizationId: string, branchId?: string | null): Promise<{ success: boolean; error?: string }> {
  let query = supabase
    .from('google_oauth_tokens')
    .delete()
    .eq('organization_id', organizationId);

  if (branchId) {
    query = query.eq('branch_id', branchId);
  } else {
    query = query.is('branch_id', null);
  }

  const { error } = await query;

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
  branch_id?: string | null;
}): Promise<{ meet_link: string; event_id: string } | null> {
  // Refresh the session to ensure we have a valid token
  const { data: sessionData, error: sessionError } = await supabase.auth.refreshSession();
  const accessToken = sessionData?.session?.access_token;

  if (sessionError || !accessToken) {
    console.error('Session refresh failed:', sessionError);
    return null;
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  try {
    // Use the anon key as the Authorization header so the Supabase gateway
    // doesn't reject the request with "Invalid JWT". Pass the real user token
    // inside the body so the edge function can verify the caller.
    const response = await fetch(`${supabaseUrl}/functions/v1/create-google-meet`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anonKey}`,
        apikey: anonKey,
      },
      body: JSON.stringify({
        title: params.title,
        description: params.description,
        start_time: params.start_time,
        end_time: params.end_time,
        time_zone: params.time_zone || 'Asia/Kolkata',
        attendees: params.attendees || [],
        session_id: params.session_id,
        branch_id: params.branch_id || null,
        user_access_token: accessToken,
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
