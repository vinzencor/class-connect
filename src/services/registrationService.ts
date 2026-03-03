import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';
import { adminUserService } from './adminUserService';

type StudentRegistration = Tables<'student_registrations'>;
type Lead = Tables<'crm_leads'>;
type Organization = Tables<'organizations'>;

export const registrationService = {
  /**
   * Create a new registration record when a lead is converted
   */
  async createRegistration(data: {
    organizationId: string;
    leadId: string;
    courseId: string;
    batchId: string;
    courseFee: number;
    discountAmount: number;
    taxInclusive: boolean;
    taxPercentage: number;
    paymentType: 'full' | 'emi' | 'installment';
    advancePayment: number;
  }) {
    // Calculate fee breakdown
    const { courseFee, discountAmount, taxInclusive, taxPercentage, advancePayment } = data;

    let feeActual = courseFee - discountAmount;
    let taxAmount = 0;
    let totalAmount = 0;

    if (taxInclusive) {
      // If tax is inclusive, extract tax from the fee_actual
      totalAmount = feeActual;
      taxAmount = (feeActual * taxPercentage) / (100 + taxPercentage);
      feeActual = feeActual - taxAmount;
    } else {
      // If tax is not inclusive, add tax on top
      taxAmount = (feeActual * taxPercentage) / 100;
      totalAmount = feeActual + taxAmount;
    }

    const balanceAmount = totalAmount - advancePayment;

    const registration: Partial<StudentRegistration> = {
      organization_id: data.organizationId,
      lead_id: data.leadId,
      status: 'pending',
      course_id: data.courseId,
      batch_id: data.batchId,
      course_fee: courseFee,
      discount_amount: discountAmount,
      tax_inclusive: taxInclusive,
      fee_actual: feeActual,
      tax_percentage: taxPercentage,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      payment_type: data.paymentType,
      advance_payment: advancePayment,
      balance_amount: balanceAmount,
    };

    const { data: created, error } = await supabase
      .from('student_registrations')
      .insert(registration)
      .select('*, crm_leads(*)')
      .single();

    if (error) throw error;
    return created;
  },

  /**
   * Get all registrations for an organization
   */
  async getRegistrations(organizationId: string, branchId?: string | null) {
    let query = supabase
      .from('student_registrations')
      .select(`
        *,
        crm_leads(*),
        classes:course_id(id, name, subject),
        batches:batch_id(id, name),
        student_profile:student_profile_id(id, full_name, email, student_number),
        verified_by_profile:verified_by(id, full_name)
      `)
      .eq('organization_id', organizationId);

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  /**
   * Get a registration by token (public access for student form)
   */
  async getRegistrationByToken(token: string) {
    const { data, error } = await supabase
      .from('student_registrations')
      .select(`
        *,
        crm_leads(*),
        classes:course_id(id, name, subject),
        batches:batch_id(id, name),
        organizations(id, name, logo_url)
      `)
      .eq('token', token)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  /**
   * Submit the student registration form (public, by token)
   */
  async submitRegistration(token: string, formData: {
    full_name: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    date_of_birth: string;
    gender: 'male' | 'female' | 'other';
    email: string;
    mobile_no: string;
    whatsapp_no?: string;
    landline_no?: string;
    aadhaar_number?: string;
    qualification: string;
    graduation_year?: string;
    graduation_college?: string;
    registration_date: string;
    remarks?: string;
    admission_source?: string;
    reference?: string;
    photo_url?: string;
    father_name?: string;
    mother_name?: string;
    parent_email?: string;
    parent_mobile?: string;
  }) {
    const { data, error } = await supabase
      .from('student_registrations')
      .update({
        ...formData,
        status: 'submitted',
      })
      .eq('token', token)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Upload student photo to Supabase Storage
   */
  async uploadPhoto(file: File, token: string): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const fileName = `registrations/${token}/${Date.now()}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from('student-photos')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('student-photos')
      .getPublicUrl(data.path);

    return publicUrl;
  },

  /**
   * Verify and convert a registration to a student profile
   */
  async verifyRegistration(registrationId: string, verifiedBy: string) {
    // First, get the registration with all details
    const { data: registration, error: fetchError } = await supabase
      .from('student_registrations')
      .select(`
        *,
        crm_leads(*),
        classes:course_id(id, name),
        batches:batch_id(id, name)
      `)
      .eq('id', registrationId)
      .single();

    if (fetchError) throw fetchError;
    if (!registration) throw new Error('Registration not found');
    if (registration.status !== 'submitted') {
      throw new Error('Registration must be in submitted status to verify');
    }

    // Generate a random temporary password
    const tempPassword = `Temp${Math.random().toString(36).slice(-8)}!`;

    // Prepare user metadata
    const userMetadata: Record<string, any> = {};
    if (registration.batch_id) {
      userMetadata.batch_id = registration.batch_id;
    }

    console.log('Creating student auth user with auto-confirmation:', {
      email: registration.email,
      full_name: registration.full_name,
      organization_id: registration.organization_id
    });

    // Use admin user service to create user with auto-confirmation
    // This keeps email confirmation enabled but auto-confirms admin-created users
    let authData: any;
    try {
      const result = await adminUserService.createUser({
        email: registration.email!,
        password: tempPassword,
        full_name: registration.full_name || '',
        role: 'student',
        organization_id: registration.organization_id,
        metadata: userMetadata,
      });

      authData = { user: result.user };
      console.log('✅ Student auth user created with auto-confirmation:', result.user.id);
    } catch (adminError: any) {
      console.error('Admin user creation error:', adminError);
      if (adminError.message?.includes('rate limit')) {
        throw new Error('Too many signup attempts. Please wait before verifying more registrations.');
      }
      if (adminError.message?.includes('already registered')) {
        throw new Error('This email is already registered. Please use a different email.');
      }
      throw new Error(`Failed to create user: ${adminError.message}`);
    }

    if (!authData.user) throw new Error('Failed to create user account');

    console.log('Auth user object:', authData.user);

    // Wait for the database trigger to create the profile with retry logic
    let profileExists = false;
    let retries = 0;
    const maxRetries = 10; // 10 attempts = 5 seconds max wait

    while (!profileExists && retries < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, 500));

      const { data: checkProfile, error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', authData.user.id)
        .maybeSingle();

      if (checkProfile) {
        profileExists = true;
        console.log('Profile confirmed in database');
      } else if (checkError) {
        console.error('Error checking profile:', checkError);
      } else {
        retries++;
        console.log(`Profile not found yet, retry ${retries}/${maxRetries}`);
      }
    }

    if (!profileExists) {
      // Trigger didn't work, need to handle this carefully
      console.log('⚠️ Profile trigger failed after 10 retries');
      console.log('This usually means:');
      console.log('1. Email confirmation is ENABLED in Supabase Auth settings');
      console.log('2. The database trigger is not working');
      console.log('3. RLS policies are blocking the insert');

      // Wait a bit more for potential async operations
      console.log('Waiting additional 2 seconds...');
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Final check for profile
      const { data: finalCheck, error: finalCheckError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', authData.user.id)
        .maybeSingle();

      if (finalCheck) {
        console.log('✅ Profile appeared after additional wait');
        profileExists = true;
      } else {
        console.log('❌ Profile still not found, attempting manual creation');
        console.log('Final check error:', finalCheckError);

        // Try manual profile creation
        const { data: manualProfile, error: manualProfileError } = await supabase
          .from('profiles')
          .insert({
            id: authData.user.id,
            organization_id: registration.organization_id,
            branch_id: registration.branch_id || null,
            email: registration.email!,
            full_name: registration.full_name || '',
            role: 'student',
            phone: registration.mobile_no || null,
            avatar_url: registration.photo_url || null,
            is_active: true,
            metadata: {
              batch_id: registration.batch_id,
              address: registration.address,
              city: registration.city,
              state: registration.state,
              pincode: registration.pincode,
              date_of_birth: registration.date_of_birth,
              gender: registration.gender,
              whatsapp_no: registration.whatsapp_no,
              landline_no: registration.landline_no,
              aadhaar_number: registration.aadhaar_number,
              qualification: registration.qualification,
              graduation_year: registration.graduation_year,
              graduation_college: registration.graduation_college,
              father_name: registration.father_name,
              mother_name: registration.mother_name,
              parent_email: registration.parent_email,
              parent_mobile: registration.parent_mobile,
            },
          })
          .select()
          .single();

        if (manualProfileError) {
          console.error('❌ Manual profile creation failed:', manualProfileError);

          // Check if it's a foreign key constraint error (23503)
          if (manualProfileError.code === '23503') {
            console.error('🔴 Foreign key constraint violation - user not in auth.users table');
            console.error('This means the auth user was NOT actually created or confirmed');
            console.error('');
            console.error('SOLUTION:');
            console.error('Go to Supabase Dashboard → Authentication → Settings');
            console.error('Find "Enable email confirmations" and DISABLE it');
            console.error('This will allow users to be created without email confirmation');

            throw new Error(
              '❌ User creation failed: Email confirmation is required.\n\n' +
              '📋 To fix this:\n' +
              '1. Go to Supabase Dashboard\n' +
              '2. Navigate to Authentication → Settings\n' +
              '3. Disable "Enable email confirmations"\n' +
              '4. Try again\n\n' +
              'OR manually confirm the user email in Supabase Dashboard.'
            );
          }

          // Check if it's a duplicate key error
          if (manualProfileError.code === '23505') {
            console.log('Profile already exists (duplicate key), fetching it...');
            const { data: existingProfile } = await supabase
              .from('profiles')
              .select('id')
              .eq('id', authData.user.id)
              .single();

            if (existingProfile) {
              console.log('✅ Profile found after duplicate error');
              profileExists = true;
            }
          } else {
            throw new Error(`Failed to create user profile: ${manualProfileError.message}`);
          }
        } else {
          console.log('✅ Profile created manually:', manualProfile);
          profileExists = true;
        }
      }
    } else {
      // Profile exists from trigger, update it with additional details
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: registration.full_name || '',
          phone: registration.mobile_no || null,
          avatar_url: registration.photo_url || null,
          metadata: {
            batch_id: registration.batch_id,
            address: registration.address,
            city: registration.city,
            state: registration.state,
            pincode: registration.pincode,
            date_of_birth: registration.date_of_birth,
            gender: registration.gender,
            whatsapp_no: registration.whatsapp_no,
            landline_no: registration.landline_no,
            aadhaar_number: registration.aadhaar_number,
            qualification: registration.qualification,
            graduation_year: registration.graduation_year,
            graduation_college: registration.graduation_college,
            father_name: registration.father_name,
            mother_name: registration.mother_name,
            parent_email: registration.parent_email,
            parent_mobile: registration.parent_mobile,
          },
        })
        .eq('id', authData.user.id);

      if (profileError) {
        console.error('Profile update error:', profileError);
      }
    }

    // Create payment record
    if (registration.total_amount && registration.total_amount > 0) {
      const courseFee = registration.course_fee || registration.total_amount + (registration.discount_amount || 0);
      const discountAmount = registration.discount_amount || 0;
      const advancePayment = registration.advance_payment || 0;

      const { data: paymentData, error: paymentError } = await supabase
        .from('payments')
        .insert({
          organization_id: registration.organization_id,
          branch_id: registration.branch_id || null,
          student_id: authData.user.id,
          student_name: registration.full_name || 'Student',
          course_name: registration.classes?.name || 'N/A',
          total_fee: courseFee,
          discount_amount: discountAmount,
          amount: registration.total_amount,
          amount_paid: advancePayment,
          status: (registration.balance_amount || 0) <= 0 ? 'completed' :
            advancePayment > 0 ? 'partial' : 'pending',
          payment_method: registration.payment_type || null,
          notes: `Course: ${registration.classes?.name || 'N/A'}${discountAmount > 0 ? ` | Discount: ₹${discountAmount}` : ''}`,
        } as any)
        .select('id')
        .single();

      if (paymentError) {
        console.error('Payment creation error:', paymentError);
      }

      // Record advance payment as fee_payment installment
      if (advancePayment > 0 && paymentData?.id) {
        const { error: fpError } = await supabase.from('fee_payments').insert({
          payment_id: paymentData.id,
          organization_id: registration.organization_id,
          amount: advancePayment,
          date: new Date().toISOString().split('T')[0],
          mode: registration.payment_type || 'UPI',
        });
        if (fpError) console.error('fee_payments insert error:', fpError);
      }

      // Also add advance payment as income transaction
      if (advancePayment > 0) {
        const { error: txnError } = await supabase.from('transactions').insert({
          organization_id: registration.organization_id,
          branch_id: registration.branch_id || null,
          type: 'income',
          description: `Registration Fee: ${registration.classes?.name || 'N/A'} — ${registration.full_name || 'Student'}`,
          amount: advancePayment,
          category: 'Course Fee',
          date: new Date().toISOString(),
          mode: registration.payment_type || 'UPI',
          recurrence: 'one-time',
          paused: false,
          created_by: authData.user.id,
        });
        if (txnError) console.error('transactions insert error:', txnError);
      }
    }

    // Enroll student in the course
    if (registration.course_id) {
      const { error: enrollError } = await supabase
        .from('class_enrollments')
        .insert({
          class_id: registration.course_id,
          student_id: authData.user.id,
        });

      if (enrollError && !enrollError.message?.includes('duplicate')) {
        console.error('Enrollment error:', enrollError);
      }
    }

    // Update the registration record
    const { error: regUpdateError } = await supabase
      .from('student_registrations')
      .update({
        status: 'verified',
        student_profile_id: authData.user.id,
        verified_by: verifiedBy,
        verified_at: new Date().toISOString(),
      })
      .eq('id', registrationId);

    if (regUpdateError) throw regUpdateError;

    // Update the CRM lead
    const { error: leadUpdateError } = await supabase
      .from('crm_leads')
      .update({
        status: 'converted',
        converted_to_student_id: authData.user.id,
      })
      .eq('id', registration.lead_id);

    if (leadUpdateError) {
      console.error('Lead update error:', leadUpdateError);
    }

    // Send password reset email to the student
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      registration.email!,
      {
        redirectTo: `${window.location.origin}/reset-password`,
      }
    );

    if (resetError) {
      console.error('Password reset email error:', resetError);
      // Don't throw here - the account is created, just log the error
    }

    return {
      success: true,
      studentId: authData.user.id,
      message: 'Student account created successfully. Password setup email sent.',
    };
  },

  /**
   * Reject a registration
   */
  async rejectRegistration(registrationId: string, reason: string, rejectedBy: string) {
    const { data, error } = await supabase
      .from('student_registrations')
      .update({
        status: 'rejected',
        rejection_reason: reason,
        verified_by: rejectedBy,
        verified_at: new Date().toISOString(),
      })
      .eq('id', registrationId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Update registration status to 'link_sent'
   */
  async markLinkSent(registrationId: string) {
    const { data, error } = await supabase
      .from('student_registrations')
      .update({ status: 'link_sent' })
      .eq('id', registrationId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Get organization's tax percentage
   */
  async getOrganizationTax(organizationId: string): Promise<number> {
    const { data, error } = await supabase
      .from('organizations')
      .select('tax_percentage')
      .eq('id', organizationId)
      .single();

    if (error) throw error;
    return (data as Organization).tax_percentage || 18;
  },

  /**
   * Generate registration link for a token
   */
  getRegistrationLink(token: string): string {
    return `${window.location.origin}/register/${token}`;
  },

  /**
   * Generate mailto link for sending registration email
   */
  getRegistrationEmailLink(email: string, token: string, leadName: string, orgName: string): string {
    const registrationLink = this.getRegistrationLink(token);
    const subject = encodeURIComponent(`Student Registration - ${orgName}`);
    const body = encodeURIComponent(
      `Dear ${leadName},\n\n` +
      `Thank you for your interest in joining ${orgName}!\n\n` +
      `Please complete your student registration by clicking the link below:\n\n` +
      `${registrationLink}\n\n` +
      `This link is unique to you and should not be shared with others.\n\n` +
      `If you have any questions, please contact us.\n\n` +
      `Best regards,\n${orgName} Team`
    );
    return `mailto:${email}?subject=${subject}&body=${body}`;
  },

  /**
   * Get registration stats for an organization
   */
  async getRegistrationStats(organizationId: string) {
    const { data, error } = await supabase
      .from('student_registrations')
      .select('status')
      .eq('organization_id', organizationId);

    if (error) throw error;

    const stats = {
      total: data.length,
      pending: data.filter((r) => r.status === 'pending').length,
      link_sent: data.filter((r) => r.status === 'link_sent').length,
      submitted: data.filter((r) => r.status === 'submitted').length,
      verified: data.filter((r) => r.status === 'verified').length,
      rejected: data.filter((r) => r.status === 'rejected').length,
    };

    return stats;
  },
};
