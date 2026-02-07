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
          created_at?: string
          updated_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          organization_id: string | null
          email: string
          full_name: string
          role: 'admin' | 'faculty' | 'student'
          avatar_url: string | null
          phone: string | null
          nfc_id: string | null
          is_active: boolean
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          organization_id?: string | null
          email: string
          full_name: string
          role: 'admin' | 'faculty' | 'student'
          avatar_url?: string | null
          phone?: string | null
          nfc_id?: string | null
          is_active?: boolean
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string | null
          email?: string
          full_name?: string
          role?: 'admin' | 'faculty' | 'student'
          avatar_url?: string | null
          phone?: string | null
          nfc_id?: string | null
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
          name: string
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          description?: string | null
          created_at?: string
          updated_at?: string
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
          class_id: string
          student_id: string
          date: string
          status: 'present' | 'absent' | 'late'
          marked_at: string
          marked_by: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          class_id: string
          student_id: string
          date?: string
          status: 'present' | 'absent' | 'late'
          marked_at?: string
          marked_by?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          class_id?: string
          student_id?: string
          date?: string
          status?: 'present' | 'absent' | 'late'
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
      crm_leads: {
        Row: {
          id: string
          organization_id: string
          name: string
          email: string | null
          phone: string
          status: 'new' | 'contacted' | 'interested' | 'follow_up' | 'converted' | 'lost'
          source: string | null
          notes: string | null
          assigned_to: string | null
          converted_to_student_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          email?: string | null
          phone: string
          status?: 'new' | 'contacted' | 'interested' | 'follow_up' | 'converted' | 'lost'
          source?: string | null
          notes?: string | null
          assigned_to?: string | null
          converted_to_student_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          email?: string | null
          phone?: string
          status?: 'new' | 'contacted' | 'interested' | 'follow_up' | 'converted' | 'lost'
          source?: string | null
          notes?: string | null
          assigned_to?: string | null
          converted_to_student_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      payments: {
        Row: {
          id: string
          organization_id: string
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
