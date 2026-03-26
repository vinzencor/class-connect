export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      admission_sources: {
        Row: {
          id: string
          organization_id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          created_at?: string
        }
      }
      organizations: {
        Row: {
          id: string
          name: string
          email: string | null
          phone: string | null
          address: string | null
          website: string | null
          logo_url: string | null
          subscription_plan: 'free' | 'basic' | 'pro' | 'enterprise'
          is_active: boolean
          tax_percentage: number
          hours_per_session: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          email?: string | null
          phone?: string | null
          address?: string | null
          website?: string | null
          logo_url?: string | null
          subscription_plan?: 'free' | 'basic' | 'pro' | 'enterprise'
          is_active?: boolean
          tax_percentage?: number
          hours_per_session?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          email?: string | null
          phone?: string | null
          address?: string | null
          website?: string | null
          logo_url?: string | null
          subscription_plan?: 'free' | 'basic' | 'pro' | 'enterprise'
          is_active?: boolean
          tax_percentage?: number
          hours_per_session?: number
          created_at?: string
          updated_at?: string
        }
      }
      branches: {
        Row: {
          id: string
          organization_id: string
          name: string
          code: string
          address: string | null
          city: string | null
          state: string | null
          pincode: string | null
          phone: string | null
          email: string | null
          logo_url: string | null
          is_main_branch: boolean
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          code: string
          address?: string | null
          city?: string | null
          state?: string | null
          pincode?: string | null
          phone?: string | null
          email?: string | null
          logo_url?: string | null
          is_main_branch?: boolean
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          code?: string
          address?: string | null
          city?: string | null
          state?: string | null
          pincode?: string | null
          phone?: string | null
          email?: string | null
          logo_url?: string | null
          is_main_branch?: boolean
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      user_branch_preferences: {
        Row: {
          id: string
          user_id: string
          organization_id: string
          current_branch_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          organization_id: string
          current_branch_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          organization_id?: string
          current_branch_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          organization_id: string | null
          branch_id: string | null
          email: string
          full_name: string
          short_name: string | null
          role: 'admin' | 'faculty' | 'student'
          role_id: string | null
          avatar_url: string | null
          phone: string | null
          nfc_id: string | null
          designation_id: string | null
          is_active: boolean
          metadata: Json
          created_at: string
          updated_at: string
      
        Insert: {
          id: string
          organization_id?: string | null
          branch_id?: string | null
          email: string
          full_name: string
          short_name?: string | null
          role: 'admin' | 'faculty' | 'student'
          role_id?: string | null
          avatar_url?: string | null
          phone?: string | null
          nfc_id?: string | null
          designation_id?: string | null
          is_active?: boolean
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string | null
          branch_id?: string | null
          email?: string
          full_name?: string
          short_name?: string | null
          role?: 'admin' | 'faculty' | 'student'
          role_id?: string | null
          avatar_url?: string | null
          phone?: string | null
          nfc_id?: string | null
          designation_id?: string | null
          is_active?: boolean
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      classes: {
        Row: {
          id: string
          organization_id: string
          branch_id: string | null
          name: string
          subject: string
          description: string | null
          faculty_id: string | null
          schedule_day: string | null
          schedule_time: string | null
          duration_minutes: number
          room_number: string | null
          meet_link: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          branch_id?: string | null
          name: string
          subject: string
          description?: string | null
          faculty_id?: string | null
          schedule_day?: string | null
          schedule_time?: string | null
          duration_minutes?: number
          room_number?: string | null
          meet_link?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          branch_id?: string | null
          name?: string
          subject?: string
          description?: string | null
          faculty_id?: string | null
          schedule_day?: string | null
          schedule_time?: string | null
          duration_minutes?: number
          room_number?: string | null
          meet_link?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      batches: {
        Row: {
          id: string
          organization_id: string
          branch_id: string | null
          name: string
          description: string | null
          module_subject_id: string | null
          validity_start: string | null
          validity_end: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          branch_id?: string | null
          name: string
          description?: string | null
          module_subject_id?: string | null
          validity_start?: string | null
          validity_end?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          branch_id?: string | null
          name?: string
          description?: string | null
          module_subject_id?: string | null
          validity_start?: string | null
          validity_end?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      class_batches: {
        Row: {
          id: string
          class_id: string
          batch_id: string
          created_at: string
        }
        Insert: {
          id?: string
          class_id: string
          batch_id: string
          created_at?: string
        }
        Update: {
          id?: string
          class_id?: string
          batch_id?: string
          created_at?: string
        }
      }
      class_enrollments: {
        Row: {
          id: string
          class_id: string
          student_id: string
          enrolled_at: string
        }
        Insert: {
          id?: string
          class_id: string
          student_id: string
          enrolled_at?: string
        }
        Update: {
          id?: string
          class_id?: string
          student_id?: string
          enrolled_at?: string
        }
      }
      attendance: {
        Row: {
          id: string
          organization_id: string
          branch_id: string | null
          class_id: string
          student_id: string
          date: string
          status: 'present' | 'absent' | 'late' | 'holiday' | 'half_day' | 'online_present'
          attendance_source: 'manual' | 'meet_join' | 'essl'
          marked_at: string
          marked_by: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          branch_id?: string | null
          class_id: string
          student_id: string
          date?: string
          status: 'present' | 'absent' | 'late' | 'holiday' | 'half_day' | 'online_present'
          attendance_source?: 'manual' | 'meet_join' | 'essl'
          marked_at?: string
          marked_by?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          branch_id?: string | null
          class_id?: string
          student_id?: string
          date?: string
          status?: 'present' | 'absent' | 'late' | 'holiday' | 'half_day' | 'online_present'
          attendance_source?: 'manual' | 'meet_join' | 'essl'
          marked_at?: string
          marked_by?: string | null
          notes?: string | null
          created_at?: string
        }
      }
      modules: {
        Row: {
          id: string
          organization_id: string
          class_id: string | null
          title: string
          subject: string
          file_url: string | null
          file_type: string | null
          uploaded_by: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          class_id?: string | null
          title: string
          subject: string
          file_url?: string | null
          file_type?: string | null
          uploaded_by?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          class_id?: string | null
          title?: string
          subject?: string
          file_url?: string | null
          file_type?: string | null
          uploaded_by?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      module_subjects: {
        Row: {
          id: string
          organization_id: string
          name: string
          description: string | null
          sort_order: number
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          description?: string | null
          sort_order?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          description?: string | null
          sort_order?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      module_groups: {
        Row: {
          id: string
          subject_id: string
          organization_id: string
          name: string
          description: string | null
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          subject_id: string
          organization_id: string
          name: string
          description?: string | null
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          subject_id?: string
          organization_id?: string
          name?: string
          description?: string | null
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
      }
      module_files: {
        Row: {
          id: string
          group_id: string
          organization_id: string
          title: string
          file_url: string
          file_type: string | null
          file_size: number | null
          sort_order: number
          uploaded_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          group_id: string
          organization_id: string
          title: string
          file_url: string
          file_type?: string | null
          file_size?: number | null
          sort_order?: number
          uploaded_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          group_id?: string
          organization_id?: string
          title?: string
          file_url?: string
          file_type?: string | null
          file_size?: number | null
          sort_order?: number
          uploaded_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      roles: {
        Row: {
          id: string
          organization_id: string
          name: string
          description: string | null
          is_system: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          description?: string | null
          is_system?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          description?: string | null
          is_system?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      role_permissions: {
        Row: {
          id: string
          role_id: string
          feature_key: string
          created_at: string
        }
        Insert: {
          id?: string
          role_id: string
          feature_key: string
          created_at?: string
        }
        Update: {
          id?: string
          role_id?: string
          feature_key?: string
          created_at?: string
        }
      }
      crm_leads: {
        Row: {
          id: string
          organization_id: string
          branch_id: string | null
          name: string
          email: string | null
          phone: string
          status: 'new' | 'contacted' | 'interested' | 'follow_up' | 'converted' | 'lost'
          source: string | null
          notes: string | null
          assigned_to: string | null
          converted_to_student_id: string | null
          course: string | null
          next_follow_up: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          branch_id?: string | null
          name: string
          email?: string | null
          phone: string
          status?: 'new' | 'contacted' | 'interested' | 'follow_up' | 'converted' | 'lost'
          source?: string | null
          notes?: string | null
          assigned_to?: string | null
          converted_to_student_id?: string | null
          course?: string | null
          next_follow_up?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          branch_id?: string | null
          name?: string
          email?: string | null
          phone?: string
          status?: 'new' | 'contacted' | 'interested' | 'follow_up' | 'converted' | 'lost'
          source?: string | null
          notes?: string | null
          assigned_to?: string | null
          converted_to_student_id?: string | null
          course?: string | null
          next_follow_up?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      student_registrations: {
        Row: {
          id: string
          organization_id: string
          branch_id: string | null
          lead_id: string
          token: string
          status: 'pending' | 'link_sent' | 'submitted' | 'verified' | 'rejected'
          course_id: string | null
          batch_id: string | null
          course_fee: number | null
          discount_amount: number | null
          tax_inclusive: boolean | null
          fee_actual: number | null
          tax_percentage: number | null
          tax_amount: number | null
          total_amount: number | null
          payment_type: string | null
          payment_method: string | null
          advance_payment: number | null
          balance_amount: number | null
          full_name: string | null
          address: string | null
          city: string | null
          state: string | null
          pincode: string | null
          date_of_birth: string | null
          gender: string | null
          email: string | null
          mobile_no: string | null
          whatsapp_no: string | null
          landline_no: string | null
          aadhaar_number: string | null
          qualification: string | null
          graduation_year: string | null
          graduation_college: string | null
          registration_date: string | null
          remarks: string | null
          admission_source: string | null
          reference: string | null
          photo_url: string | null
          father_name: string | null
          mother_name: string | null
          parent_email: string | null
          parent_mobile: string | null
          student_profile_id: string | null
          verified_by: string | null
          verified_at: string | null
          rejection_reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          branch_id?: string | null
          lead_id: string
          token?: string
          status?: 'pending' | 'link_sent' | 'submitted' | 'verified' | 'rejected'
          course_id?: string | null
          batch_id?: string | null
          course_fee?: number | null
          discount_amount?: number | null
          tax_inclusive?: boolean | null
          fee_actual?: number | null
          tax_percentage?: number | null
          tax_amount?: number | null
          total_amount?: number | null
          payment_type?: string | null
          payment_method?: string | null
          advance_payment?: number | null
          balance_amount?: number | null
          full_name?: string | null
          address?: string | null
          city?: string | null
          state?: string | null
          pincode?: string | null
          date_of_birth?: string | null
          gender?: string | null
          email?: string | null
          mobile_no?: string | null
          whatsapp_no?: string | null
          landline_no?: string | null
          aadhaar_number?: string | null
          qualification?: string | null
          graduation_year?: string | null
          graduation_college?: string | null
          registration_date?: string | null
          remarks?: string | null
          admission_source?: string | null
          reference?: string | null
          photo_url?: string | null
          father_name?: string | null
          mother_name?: string | null
          parent_email?: string | null
          parent_mobile?: string | null
          student_profile_id?: string | null
          verified_by?: string | null
          verified_at?: string | null
          rejection_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          branch_id?: string | null
          lead_id?: string
          token?: string
          status?: 'pending' | 'link_sent' | 'submitted' | 'verified' | 'rejected'
          course_id?: string | null
          batch_id?: string | null
          course_fee?: number | null
          discount_amount?: number | null
          tax_inclusive?: boolean | null
          fee_actual?: number | null
          tax_percentage?: number | null
          tax_amount?: number | null
          total_amount?: number | null
          payment_type?: string | null
          payment_method?: string | null
          advance_payment?: number | null
          balance_amount?: number | null
          full_name?: string | null
          address?: string | null
          city?: string | null
          state?: string | null
          pincode?: string | null
          date_of_birth?: string | null
          gender?: string | null
          email?: string | null
          mobile_no?: string | null
          whatsapp_no?: string | null
          landline_no?: string | null
          aadhaar_number?: string | null
          qualification?: string | null
          graduation_year?: string | null
          graduation_college?: string | null
          registration_date?: string | null
          remarks?: string | null
          admission_source?: string | null
          reference?: string | null
          photo_url?: string | null
          father_name?: string | null
          mother_name?: string | null
          parent_email?: string | null
          parent_mobile?: string | null
          student_profile_id?: string | null
          verified_by?: string | null
          verified_at?: string | null
          rejection_reason?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      payments: {
        Row: {
          id: string
          organization_id: string
          branch_id: string | null
          student_id: string
          amount: number
          amount_paid: number
          status: 'pending' | 'partial' | 'completed' | 'overdue'
          due_date: string | null
          payment_method: string | null
          transaction_id: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          branch_id?: string | null
          student_id: string
          amount: number
          amount_paid?: number
          status?: 'pending' | 'partial' | 'completed' | 'overdue'
          due_date?: string | null
          payment_method?: string | null
          transaction_id?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          branch_id?: string | null
          student_id?: string
          amount?: number
          amount_paid?: number
          status?: 'pending' | 'partial' | 'completed' | 'overdue'
          due_date?: string | null
          payment_method?: string | null
          transaction_id?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      leave_requests: {
        Row: {
          id: string
          organization_id: string
          student_id: string
          reason: string
          status: 'pending' | 'approved' | 'rejected'
          requested_date: string | null
          approved_by: string | null
          approved_date: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          student_id: string
          reason: string
          status?: 'pending' | 'approved' | 'rejected'
          requested_date?: string | null
          approved_by?: string | null
          approved_date?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          student_id?: string
          reason?: string
          status?: 'pending' | 'approved' | 'rejected'
          requested_date?: string | null
          approved_by?: string | null
          approved_date?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      id_card_templates: {
        Row: {
          id: string
          organization_id: string
          name: string
          template_data: Json
          is_default: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          template_data: Json
          is_default?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          template_data?: Json
          is_default?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      id_cards: {
        Row: {
          id: string
          organization_id: string
          user_id: string
          template_id: string | null
          nfc_id: string
          card_number: string
          issued_date: string
          expiry_date: string | null
          status: 'active' | 'inactive' | 'expired' | 'revoked'
          card_image_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          user_id: string
          template_id?: string | null
          nfc_id: string
          card_number: string
          issued_date?: string
          expiry_date?: string | null
          status?: 'active' | 'inactive' | 'expired' | 'revoked'
          card_image_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          user_id?: string
          template_id?: string | null
          nfc_id?: string
          card_number?: string
          issued_date?: string
          expiry_date?: string | null
          status?: 'active' | 'inactive' | 'expired' | 'revoked'
          card_image_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      faculty_subjects: {
        Row: {
          id: string
          faculty_id: string
          subject_id: string
          organization_id: string
          created_at: string
        }
        Insert: {
          id?: string
          faculty_id: string
          subject_id: string
          organization_id: string
          created_at?: string
        }
        Update: {
          id?: string
          faculty_id?: string
          subject_id?: string
          organization_id?: string
          created_at?: string
        }
      }
      module_group_faculty: {
        Row: {
          id: string
          group_id: string | null
          sub_group_id: string | null
          faculty_id: string
          organization_id: string
          created_at: string
        }
        Insert: {
          id?: string
          group_id?: string | null
          sub_group_id?: string | null
          faculty_id: string
          organization_id: string
          created_at?: string
        }
        Update: {
          id?: string
          group_id?: string | null
          sub_group_id?: string | null
          faculty_id?: string
          organization_id?: string
          created_at?: string
        }
      }
      student_details: {
        Row: {
          id: string
          profile_id: string
          organization_id: string
          sales_staff_id: string | null
          photo_url: string | null
          address: string | null
          city: string
          state: string
          pincode: string
          date_of_birth: string
          gender: string
          mobile: string
          whatsapp: string | null
          landline: string | null
          aadhaar: string | null
          qualification: string
          graduation_year: string | null
          graduation_college: string | null
          admission_source: string | null
          reference: string | null
          remarks: string | null
          father_name: string | null
          mother_name: string | null
          parent_email: string | null
          parent_mobile: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          organization_id: string
          sales_staff_id?: string | null
          photo_url?: string | null
          address?: string | null
          city: string
          state: string
          pincode: string
          date_of_birth: string
          gender: string
          mobile: string
          whatsapp?: string | null
          landline?: string | null
          aadhaar?: string | null
          qualification: string
          graduation_year?: string | null
          graduation_college?: string | null
          admission_source?: string | null
          reference?: string | null
          remarks?: string | null
          father_name?: string | null
          mother_name?: string | null
          parent_email?: string | null
          parent_mobile: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          organization_id?: string
          sales_staff_id?: string | null
          photo_url?: string | null
          address?: string | null
          city?: string
          state?: string
          pincode?: string
          date_of_birth?: string
          gender?: string
          mobile?: string
          whatsapp?: string | null
          landline?: string | null
          aadhaar?: string | null
          qualification?: string
          graduation_year?: string | null
          graduation_college?: string | null
          admission_source?: string | null
          reference?: string | null
          remarks?: string | null
          father_name?: string | null
          mother_name?: string | null
          parent_email?: string | null
          parent_mobile?: string
          created_at?: string
          updated_at?: string
        }
      }
      session_module_groups: {
        Row: {
          id: string
          session_id: string
          module_group_id: string
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          module_group_id: string
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          module_group_id?: string
          created_at?: string
        }
      }
      module_completion: {
        Row: {
          id: string
          module_group_id: string
          batch_id: string
          organization_id: string
          completed_by: string
          session_id: string | null
          completed_at: string
        }
        Insert: {
          id?: string
          module_group_id: string
          batch_id: string
          organization_id: string
          completed_by: string
          session_id?: string | null
          completed_at?: string
        }
        Update: {
          id?: string
          module_group_id?: string
          batch_id?: string
          organization_id?: string
          completed_by?: string
          session_id?: string | null
          completed_at?: string
        }
      }
      time_slots: {
        Row: {
          id: string
          organization_id: string
          name: string
          start_time: string
          end_time: string
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          start_time: string
          end_time: string
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          start_time?: string
          end_time?: string
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
      }
      faculty_availability: {
        Row: {
          id: string
          organization_id: string
          branch_id: string | null
          faculty_id: string
          day_of_week: number
          time_slot_id: string
          is_available: boolean
          week_start_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          branch_id?: string | null
          faculty_id: string
          day_of_week: number
          time_slot_id: string
          is_available?: boolean
          week_start_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          branch_id?: string | null
          faculty_id?: string
          day_of_week?: number
          time_slot_id?: string
          is_available?: boolean
          week_start_date?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// Helper types
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type Enums<T extends keyof Database['public']['Enums']> =
  Database['public']['Enums'][T]
