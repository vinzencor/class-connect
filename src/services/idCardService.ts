import { supabase } from '@/lib/supabase';
import { Tables, Json } from '@/types/database';

type IdCardTemplate = Tables<'id_card_templates'>;
type IdCard = Tables<'id_cards'>;
type Profile = Tables<'profiles'>;

// Template data structure for the visual designer
export interface TemplateDesignData {
    cardType?: 'staff' | 'student';
    backgroundColor: string;
    textColor: string;
    accentColor: string;
    showLogo: boolean;
    logoPosition: { x: number; y: number };
    showPhoto: boolean;
    photoPosition: { x: number; y: number };
    showQRCode: boolean;
    qrPosition: { x: number; y: number };
    showNFCId: boolean;
    showDesignation: boolean;
    fields: {
        name: { visible: boolean; x: number; y: number; fontSize: number };
        role: { visible: boolean; x: number; y: number; fontSize: number };
        cardNumber: { visible: boolean; x: number; y: number; fontSize: number };
        organization: { visible: boolean; x: number; y: number; fontSize: number };
        validUntil: { visible: boolean; x: number; y: number; fontSize: number };
    };
}

const sanitizeNineDigitId = (value: string | null | undefined): string | null => {
    if (!value) return null;
    const digits = value.replace(/\D/g, '');
    return /^\d{9}$/.test(digits) ? digits : null;
};

// Generate a unique NFC ID (9 digits)
export const generateNFCId = (): string => {
    return String(Math.floor(100000000 + Math.random() * 900000000));
};

// Generate a card number (e.g., ORG-2024-00001)
export const generateCardNumber = (orgPrefix: string, sequence: number): string => {
    const year = new Date().getFullYear();
    const paddedSeq = String(sequence).padStart(5, '0');
    return `${orgPrefix}-${year}-${paddedSeq}`;
};

export const idCardService = {
    async getAvailableNfcId(candidateNfcId: string | null): Promise<string | null> {
        const sanitized = sanitizeNineDigitId(candidateNfcId);
        if (!sanitized) {
            return null;
        }

        const { data: existing, error } = await supabase
            .from('id_cards')
            .select('id')
            .eq('nfc_id', sanitized)
            .maybeSingle();

        if (error) throw error;

        // Keep NFC only if it's not already used in any existing card row.
        return existing ? null : sanitized;
    },

    // ==================== TEMPLATE OPERATIONS ====================

    /**
     * Get all templates for an organization
     */
    async getTemplates(organizationId: string): Promise<IdCardTemplate[]> {
        if (!organizationId?.trim()) {
            return [];
        }
        const { data, error } = await supabase
            .from('id_card_templates')
            .select('*')
            .eq('organization_id', organizationId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    },

    /**
     * Get a single template by ID
     */
    async getTemplate(templateId: string): Promise<IdCardTemplate | null> {
        const { data, error } = await supabase
            .from('id_card_templates')
            .select('*')
            .eq('id', templateId)
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Create a new ID card template
     */
    async createTemplate(
        organizationId: string,
        name: string,
        templateData: TemplateDesignData,
        createdBy: string,
        isDefault: boolean = false
    ): Promise<IdCardTemplate> {
        // If this is set as default, unset any existing default
        if (isDefault) {
            await supabase
                .from('id_card_templates')
                .update({ is_default: false } as any)
                .eq('organization_id', organizationId);
        }

        const { data, error } = await supabase
            .from('id_card_templates')
            .insert({
                organization_id: organizationId,
                name,
                template_data: templateData as unknown as Json,
                is_default: isDefault,
                created_by: createdBy,
            } as any)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Update a template
     */
    async updateTemplate(
        templateId: string,
        updates: { name?: string; template_data?: TemplateDesignData; is_default?: boolean }
    ): Promise<IdCardTemplate> {
        const { data, error } = await supabase
            .from('id_card_templates')
            .update(updates as any)
            .eq('id', templateId)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Delete a template
     */
    async deleteTemplate(templateId: string): Promise<void> {
        const { error } = await supabase
            .from('id_card_templates')
            .delete()
            .eq('id', templateId);

        if (error) throw error;
    },

    // ==================== ID CARD OPERATIONS ====================

    /**
     * Get all ID cards for an organization with optional filters
     */
    async getIdCards(
        organizationId: string,
        filters?: { role?: 'admin' | 'faculty' | 'student'; status?: string; search?: string; branchId?: string }
    ): Promise<(IdCard & { user: Profile })[]> {
        if (!organizationId?.trim()) {
            return [];
        }
        let query = supabase
            .from('id_cards')
            .select(`
        *,
        user:profiles!id_cards_user_id_fkey(*)
      `)
            .eq('organization_id', organizationId);

        if (filters?.status) {
            query = query.eq('status', filters.status);
        }

        if (filters?.branchId) {
            query = query.eq('branch_id', filters.branchId);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) throw error;

        let result = data || [];

        // For users without avatar_url, try to get photo + student data from student_details
        const allUserIds = result.map((card: any) => card.user_id);

        if (allUserIds.length > 0) {
            const { data: studentDetails } = await supabase
                .from('student_details')
                .select('profile_id, photo_url, blood_group, date_of_birth, father_name, mobile')
                .in('profile_id', allUserIds);

            if (studentDetails && studentDetails.length > 0) {
                const sdMap = new Map(studentDetails.map((sd: any) => [sd.profile_id, sd]));
                result = result.map((card: any) => {
                    const sd = sdMap.get(card.user_id);
                    const userData = Array.isArray(card.user) ? card.user[0] : card.user;
                    
                    if (userData && !userData.avatar_url && sd?.photo_url) {
                        userData.avatar_url = sd.photo_url;
                    }
                    
                    if (userData) {
                        card.user = userData;
                    }

                    // Attach student data for student card rendering
                    if (sd) {
                        card._studentData = {
                            bloodGroup: sd.blood_group || null,
                            dateOfBirth: sd.date_of_birth || null,
                            fatherName: sd.father_name || null,
                            mobile: sd.mobile || null,
                        };
                    }
                    return card;
                });
            }
        }

        // Filter by role (client-side since it's a joined field)
        if (filters?.role) {
            result = result.filter((card: any) => {
                const userData = Array.isArray(card.user) ? card.user[0] : card.user;
                return userData?.role === filters.role;
            });
        }

        // Safety filter by user's branch to avoid showing stale cross-branch records.
        if (filters?.branchId) {
            result = result.filter((card: any) => {
                const userData = Array.isArray(card.user) ? card.user[0] : card.user;
                return userData?.branch_id === filters.branchId || card.branch_id === filters.branchId;
            });
        }

        // Filter by search (client-side)
        if (filters?.search) {
            const searchLower = filters.search.toLowerCase();
            result = result.filter(
                (card: any) => {
                    const userData = Array.isArray(card.user) ? card.user[0] : card.user;
                    return userData?.full_name?.toLowerCase().includes(searchLower) ||
                        card.card_number?.toLowerCase().includes(searchLower) ||
                        card.nfc_id?.toLowerCase().includes(searchLower);
                }
            );
        }

        return result as (IdCard & { user: Profile })[];
    },

    /**
     * Get a single ID card by ID
     */
    async getIdCard(cardId: string): Promise<(IdCard & { user: Profile }) | null> {
        const { data, error } = await supabase
            .from('id_cards')
            .select(`
        *,
        user:profiles!id_cards_user_id_fkey(*)
      `)
            .eq('id', cardId)
            .single();

        if (error) throw error;
        return data as (IdCard & { user: Profile });
    },

    /**
     * Check if a user already has an active ID card
     */
    async getUserActiveCard(userId: string): Promise<IdCard | null> {
        const { data, error } = await supabase
            .from('id_cards')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'active')
            .maybeSingle();

        if (error) throw error;
        return data;
    },

    /**
     * Generate a single ID card for a user
     */
    async generateIdCard(
        organizationId: string,
        userId: string,
        templateId: string | null,
        expiryDate?: string,
        branchId?: string | null
    ): Promise<IdCard> {
        // Validate inputs
        if (!organizationId?.trim()) {
            throw new Error('Organization ID is required');
        }
        if (!userId?.trim()) {
            throw new Error('User ID is required');
        }

        // Get the count of existing cards for card number generation
        const { count } = await supabase
            .from('id_cards')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', organizationId);

        const cardNumber = generateCardNumber('CC', (count || 0) + 1);

        // Calculate expiry date (default: 1 year from now)
        const defaultExpiry = new Date();
        defaultExpiry.setFullYear(defaultExpiry.getFullYear() + 1);

        // If no branchId provided, get the user's branch_id from their profile
        let resolvedBranchId = branchId;
        let resolvedNfcId: string | null = null;
        if (!resolvedBranchId) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('branch_id, nfc_id')
                .eq('id', userId)
                .single();
            resolvedBranchId = profile?.branch_id || null;
            resolvedNfcId = sanitizeNineDigitId(profile?.nfc_id);
        } else {
            const { data: profile } = await supabase
                .from('profiles')
                .select('nfc_id')
                .eq('id', userId)
                .single();
            resolvedNfcId = sanitizeNineDigitId(profile?.nfc_id);
        }

        const nfcId = await this.getAvailableNfcId(resolvedNfcId);

        const { data, error } = await supabase
            .from('id_cards')
            .insert({
                organization_id: organizationId,
                user_id: userId,
                template_id: templateId || null,
                nfc_id: nfcId,
                card_number: cardNumber,
                expiry_date: expiryDate || defaultExpiry.toISOString().split('T')[0],
                status: 'active',
                branch_id: resolvedBranchId || null,
            } as any)
            .select()
            .single();

        if (error) {
            if ((error as any)?.code === '23505' && String((error as any)?.message || '').includes('id_cards_nfc_id_key')) {
                throw new Error('RFID/NFC ID is already assigned to another card. Please clear duplicate NFC in profile or assign a new card ID.');
            }
            throw error;
        }

        return data;
    },

    /**
     * Bulk generate ID cards for multiple users
     */
    async bulkGenerateIdCards(
        organizationId: string,
        userIds: string[],
        templateId: string | null,
        expiryDate?: string,
        branchId?: string | null
    ): Promise<{ success: IdCard[]; failed: { userId: string; error: string }[] }> {
        const success: IdCard[] = [];
        const failed: { userId: string; error: string }[] = [];

        for (const userId of userIds) {
            try {
                // Check if user already has an active card
                const existingCard = await this.getUserActiveCard(userId);
                if (existingCard) {
                    failed.push({ userId, error: 'User already has an active ID card' });
                    continue;
                }

                const card = await this.generateIdCard(organizationId, userId, templateId, expiryDate, branchId);
                success.push(card);
            } catch (error: any) {
                failed.push({ userId, error: error.message || 'Unknown error' });
            }
        }

        return { success, failed };
    },

    /**
     * Revoke an ID card
     */
    async revokeIdCard(cardId: string): Promise<IdCard> {
        const { data, error } = await supabase
            .from('id_cards')
            .update({ status: 'revoked' } as any)
            .eq('id', cardId)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Delete an ID card permanently
     */
    async deleteIdCard(cardId: string): Promise<void> {
        const { error } = await supabase
            .from('id_cards')
            .delete()
            .eq('id', cardId);

        if (error) throw error;
    },

    /**
     * Reactivate a revoked ID card
     */
    async reactivateIdCard(cardId: string): Promise<IdCard> {
        const { data, error } = await supabase
            .from('id_cards')
            .update({ status: 'active' } as any)
            .eq('id', cardId)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Update NFC ID after writing to a physical RFID card
     */
    async updateCardNfcId(cardId: string, userId: string, nfcId: string): Promise<void> {
        const { error: cardError } = await supabase
            .from('id_cards')
            .update({ nfc_id: nfcId } as any)
            .eq('id', cardId);

        if (cardError) throw cardError;

        const { error: profileError } = await supabase
            .from('profiles')
            .update({ nfc_id: nfcId } as any)
            .eq('id', userId);

        if (profileError) throw profileError;
    },

    /**
     * Update card image URL after generation
     */
    async updateCardImage(cardId: string, imageUrl: string): Promise<IdCard> {
        const { data, error } = await supabase
            .from('id_cards')
            .update({ card_image_url: imageUrl } as any)
            .eq('id', cardId)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Get users without ID cards (for generation)
     */
    async getUsersWithoutCards(
        organizationId: string,
        role?: 'admin' | 'faculty' | 'student',
        branchId?: string | null
    ): Promise<Profile[]> {
        if (!organizationId?.trim()) {
            return [];
        }

        // Get all users in the organization (include student_details for photo fallback + student card data)
        let query = supabase
            .from('profiles')
            .select('*, student_details:student_details!student_details_profile_id_fkey(photo_url, blood_group, date_of_birth, father_name, mobile)')
            .eq('organization_id', organizationId)
            .or('is_active.eq.true,is_active.is.null');

        if (role) {
            query = query.eq('role', role);
        }
        if (branchId) {
            query = query.eq('branch_id', branchId);
        }

        const { data: users, error: usersError } = await query;
        if (usersError) throw usersError;

        // Get all users with active cards
        const { data: cardsData, error: cardsError } = await supabase
            .from('id_cards')
            .select('user_id')
            .eq('organization_id', organizationId)
            .eq('status', 'active');

        if (cardsError) throw cardsError;

        const usersWithCards = new Set((cardsData || []).map((c) => c.user_id));

        // Filter out users who already have cards, and set avatar_url + student data from student_details
        return (users || [])
            .filter((user) => !usersWithCards.has(user.id))
            .map((user: any) => {
                const sd = Array.isArray(user.student_details)
                    ? user.student_details[0]
                    : user.student_details;
                if (!user.avatar_url && sd?.photo_url) {
                    user.avatar_url = sd.photo_url;
                }
                // Flatten student detail fields for card rendering
                user._studentData = sd ? {
                    bloodGroup: sd.blood_group || null,
                    dateOfBirth: sd.date_of_birth || null,
                    fatherName: sd.father_name || null,
                    mobile: sd.mobile || null,
                } : null;
                return user;
            });
    },
};

// Default template design (portrait layout: 240 x 360)
export const defaultTemplateDesign: TemplateDesignData = {
    backgroundColor: '#ffffff',
    textColor: '#1a1a1a',
    accentColor: '#4F7F8C',
    showLogo: true,
    logoPosition: { x: 20, y: 10 },
    showPhoto: true,
    photoPosition: { x: 57, y: 48 },
    showQRCode: false,
    qrPosition: { x: 82, y: 270 },
    showNFCId: false,
    showDesignation: true,
    fields: {
        name: { visible: true, x: 102, y: 182, fontSize: 15 },
        role: { visible: true, x: 72, y: 196, fontSize: 10 },
        cardNumber: { visible: true, x: 102, y: 224, fontSize: 11 },
        organization: { visible: true, x: 102, y: 28, fontSize: 13 },
        validUntil: { visible: true, x: 102, y: 310, fontSize: 9 },
    },
};
