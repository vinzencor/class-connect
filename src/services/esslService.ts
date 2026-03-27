import { supabase } from '@/lib/supabase';

export interface EsslAttendancePreviewItem {
  personName: string;
  employeeCode: string;
  cardNumber: string;
  timestamp: string;
  matched: boolean;
}

export interface EsslAttendanceSyncResult {
  success: boolean;
  resultMessage: string;
  totalLogs: number;
  matchedLogs: number;
  syncedRecords: number;
  unmatchedLogs: number;
  preview: EsslAttendancePreviewItem[];
}

export interface EsslUserCardSyncResult {
  success: boolean;
  resultMessage: string;
  employeeCode: string;
  cardNumber: string;
  fullName: string;
}

export async function syncEsslAttendance(fromDate: string, toDate: string): Promise<EsslAttendanceSyncResult> {
  await supabase.auth.refreshSession();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('You must be signed in to sync ESSL attendance.');
  }

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/essl-sync-attendance`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ fromDate, toDate }),
  });

  const rawBody = await response.text();
  let parsed: any = null;

  try {
    parsed = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    parsed = { error: rawBody || `HTTP ${response.status}` };
  }

  if (!response.ok || !parsed?.success) {
    throw new Error(parsed?.error || parsed?.message || `ESSL sync failed with HTTP ${response.status}`);
  }

  return parsed as EsslAttendanceSyncResult;
}

export async function syncEsslUserCard(userId: string, nfcId: string): Promise<EsslUserCardSyncResult> {
  await supabase.auth.refreshSession();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('You must be signed in to sync ESSL user card.');
  }

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/essl-sync-user-card`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ userId, nfcId }),
  });

  const rawBody = await response.text();
  let parsed: any = null;

  try {
    parsed = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    parsed = { error: rawBody || `HTTP ${response.status}` };
  }

  if (!response.ok || !parsed?.success) {
    throw new Error(parsed?.error || parsed?.message || `ESSL user card sync failed with HTTP ${response.status}`);
  }

  return parsed as EsslUserCardSyncResult;
}