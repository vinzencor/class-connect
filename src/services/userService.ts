import { supabase } from '@/lib/supabase';
import { Tables } from '@/types/database';

type Profile = Tables<'profiles'>;

const sanitizeNineDigitCardNumber = (value?: string | null) => {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  return /^\d{9}$/.test(digits) ? digits : null;
};

/**
 * User Service - Handles user management operations
 * These functions should be called by Admins to manage faculty and students
 */

export const userService = {
  /**
   * Get all users in the organization
   */
  async getUsers(organizationId: string, branchId?: string | null) {
    let query = supabase
      .from('profiles')
      .select('*, student_details:student_details!student_details_profile_id_fkey(blood_group, mobile)')
      .eq('organization_id', organizationId);

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((user: any) => {
      const sd = Array.isArray(user.student_details)
        ? user.student_details[0]
        : user.student_details;
      return {
        ...user,
        blood_group: sd?.blood_group || null,
        mobile: sd?.mobile || null,
        student_details: undefined,
      };
    });
  },

  /**
   * Get users by role
   */
  async getUsersByRole(organizationId: string, role: 'admin' | 'faculty' | 'student') {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('role', role)
      .order('full_name', { ascending: true });

    if (error) throw error;
    return data;
  },

  /**
   * Get a single user by ID
   */
  async getUser(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Update user profile
   */
  async updateUser(userId: string, updates: Partial<Profile>) {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates as any)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Update another user's auth password (admin only)
   */
  async updateUserPassword(userId: string, password: string) {
    await supabase.auth.refreshSession();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error('You must be logged in to change a user password.');
    }

    const edgeFnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-user-password`;
    const response = await fetch(edgeFnUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ user_id: userId, password }),
    });

    const rawBody = await response.text();
    let result: { success?: boolean; error?: string; message?: string } | null = null;

    try {
      result = rawBody ? JSON.parse(rawBody) : null;
    } catch {
      result = { error: rawBody || `HTTP ${response.status}` };
    }

    if (!response.ok || !result?.success) {
      throw new Error(result?.error || result?.message || 'Failed to update user password');
    }

    return result;
  },

  /**
   * Create a new user (Admin only)
   * Note: This requires service_role key for production
   * For now, you'll need to use Supabase Auth Admin API
   */
  async createUser(
    organizationId: string,
    email: string,
    fullName: string,
    role: 'faculty' | 'student' | 'sales_staff',
    password: string = 'ChangeMe123!', // Default temporary password
    batchId?: string,
    branchId?: string | null,
    roleId?: string,
    nfcId?: string
  ) {
    console.log('Creating user:', { organizationId, email, fullName, role, roleId, nfcId });
    const sanitizedNfcId = sanitizeNineDigitCardNumber(nfcId);

    // ── Strategy 1: Edge Function (uses service_role → auth.admin.createUser) ──
    try {
      await supabase.auth.refreshSession();
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        const edgeFnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-student`;
        const metadata: Record<string, string> = {};
        if (batchId && role === 'student') metadata.batch_id = batchId;

        const requestBody: Record<string, unknown> = {
          email,
          password,
          full_name: fullName,
          role,
          organization_id: organizationId,
          metadata,
          branch_id: branchId || undefined,
          role_id: roleId,
        };
        if (sanitizedNfcId) {
          requestBody.nfc_id = sanitizedNfcId;
        }

        const res = await fetch(edgeFnUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify(requestBody),
        });

        const rawBody = await res.text();
        let result: any = null;
        try {
          result = rawBody ? JSON.parse(rawBody) : null;
        } catch {
          result = { error: rawBody || `HTTP ${res.status}` };
        }
        if (res.ok && result.success && result.user?.id) {
          console.log('User created via edge function:', result.user.id);

          // Ensure profile has batch metadata and optional exact 9-digit RFID.
          const profilePatch: Record<string, unknown> = {};
          if (sanitizedNfcId) {
            profilePatch.nfc_id = sanitizedNfcId;
          }
          if (batchId && role === 'student') {
            profilePatch.metadata = { batch_id: batchId };
          }

          if (Object.keys(profilePatch).length > 0) {
            await supabase
              .from('profiles')
              .update(profilePatch as any)
              .eq('id', result.user.id);
          }

          result.profile = { ...(result.profile || {}), id: result.user.id, nfc_id: sanitizedNfcId || null };

          return result as any;
        }

        // Edge function returned an error — throw with clear message
        const edgeError =
          result?.error ||
          result?.message ||
          result?.details ||
          (result?.code ? `${result.code}${result?.hint ? `: ${result.hint}` : ''}` : '') ||
          rawBody ||
          `HTTP ${res.status}`;
        console.error('Edge function error:', edgeError);

        // If it's a duplicate user error, throw immediately (no point falling back)
        if (edgeError.includes('already') || edgeError.includes('duplicate') || edgeError.includes('exists')) {
          throw new Error(`A user with email "${email}" already exists. Please use a different email.`);
        }

        // For other edge function errors, throw — signUp fallback has the same trigger issue
        throw new Error(`Failed to create user: ${edgeError}`);
      }
    } catch (edgeErr) {
      // Re-throw if it's one of our own errors (not a network/fetch error)
      if (edgeErr instanceof Error && !edgeErr.message.includes('fetch') && !edgeErr.message.includes('network')) {
        throw edgeErr;
      }
      console.warn('Edge function call failed (network), falling back to signUp:', edgeErr);
    }

    // ── Strategy 2: Fallback — client signUp ──
    const userMetadata: Record<string, string> = {
      full_name: fullName,
      role,
      organization_id: organizationId,
    };
    if (batchId && role === 'student') {
      userMetadata.batch_id = batchId;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: userMetadata },
    });

    if (error) {
      console.error('Auth signup error:', error);
      if (error.message?.includes('rate limit')) {
        throw new Error('Too many signup attempts. Please wait 1 hour before creating more users, or use the Supabase Dashboard to create users directly.');
      }
      if (error.message?.includes('already') || error.message?.includes('duplicate')) {
        throw new Error(`A user with email "${email}" already exists.`);
      }
      if (error.message?.includes('Database error')) {
        throw new Error('Database error while creating user. The database trigger may need to be fixed. Please run the trigger fix SQL in Supabase SQL Editor.');
      }
      throw error;
    }

    console.log('User created via signUp:', data);

    // Wait for trigger to create profile
    if (data.user?.id) {
      const maxAttempts = 15;
      const delay = 500;
      let profileExists = false;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        await new Promise(resolve => setTimeout(resolve, delay));
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', data.user.id)
          .maybeSingle();
        if (profile) {
          profileExists = true;
          console.log(`Profile found after attempt ${attempt}`);
          break;
        }
        console.log(`Waiting for profile... attempt ${attempt}/${maxAttempts}`);
      }
      if (!profileExists) {
        console.warn('Profile was not created by trigger — inserting manually');
        const { error: manualErr } = await supabase.from('profiles').upsert({
          id: data.user.id,
          email,
          full_name: fullName,
          role,
          organization_id: organizationId,
          branch_id: branchId || null,
          nfc_id: sanitizedNfcId || null,
          is_active: true,
        } as any, { onConflict: 'id' });
        if (manualErr) {
          console.error('Manual profile insert also failed:', manualErr);
          throw new Error('Failed to create user profile. Please try again.');
        }
      }
    }

    if (data.user?.id) {
      const profileUpdates: Record<string, unknown> = {};
      if (batchId && role === 'student') {
        profileUpdates.metadata = { batch_id: batchId };
      }
      if (sanitizedNfcId) {
        profileUpdates.nfc_id = sanitizedNfcId;
      }

      if (Object.keys(profileUpdates).length > 0) {
        const { error: profileError } = await supabase
        .from('profiles')
        .update(profileUpdates as any)
        .eq('id', data.user.id);
        if (profileError) throw profileError;
      }
    }

    return {
      ...data,
      profile: data.user?.id ? { id: data.user.id, nfc_id: sanitizedNfcId || null } : null,
      essl: {
        synced: false,
        skipped: true,
        cardNumber: sanitizedNfcId || null,
        message: 'User created through fallback signup. ESSL sync was not attempted.',
      },
    } as any;
  },

  /**
   * Deactivate user (soft delete)
   */
  async deactivateUser(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .update({ is_active: false } as any)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Reactivate user
   */
  async reactivateUser(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .update({ is_active: true } as any)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Delete user (hard delete - use with caution)
   */
  async deleteUser(userId: string) {
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (error) throw error;
    return true;
  },

  /**
   * Search users by name or email
   */
  async searchUsers(organizationId: string, query: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('organization_id', organizationId)
      .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
      .order('full_name', { ascending: true });

    if (error) throw error;
    return data;
  },

  /**
   * Assign NFC card to user
   */
  async assignNFC(userId: string, nfcId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .update({ nfc_id: nfcId } as any)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};

/**
 * Example usage in a component:
 * 
 * import { userService } from '@/services/userService';
 * import { useAuth } from '@/contexts/AuthContext';
 * 
 * function UsersPage() {
 *   const { user } = useAuth();
 *   const [users, setUsers] = useState([]);
 * 
 *   useEffect(() => {
 *     if (user?.organizationId) {
 *       userService.getUsers(user.organizationId)
 *         .then(setUsers)
 *         .catch(console.error);
 *     }
 *   }, [user?.organizationId]);
 * 
 *   return <div>...</div>;
 * }
 */
