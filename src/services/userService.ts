import { supabase } from '@/lib/supabase';
import { Tables } from '@/types/database';

type Profile = Tables<'profiles'>;

/**
 * User Service - Handles user management operations
 * These functions should be called by Admins to manage faculty and students
 */

export const userService = {
  /**
   * Get all users in the organization
   */
  async getUsers(organizationId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
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
   * Create a new user (Admin only)
   * Note: This requires service_role key for production
   * For now, you'll need to use Supabase Auth Admin API
   */
  async createUser(
    organizationId: string,
    email: string,
    fullName: string,
    role: 'faculty' | 'student',
    password: string = 'ChangeMe123!' // Default temporary password
  ) {
    // This is a simplified version. In production, use Supabase Admin API
    // or send invitation emails with magic links
    
    console.log('Creating user:', { organizationId, email, fullName, role });
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: role,
          organization_id: organizationId,
        },
      },
    });

    if (error) {
      console.error('Auth signup error:', error);
      throw error;
    }
    
    console.log('User created successfully:', data);
    
    // The trigger (handle_new_user) should create the profile automatically
    // Wait a moment for the trigger to execute
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return data;
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
