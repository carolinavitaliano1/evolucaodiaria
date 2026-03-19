export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          clinic_id: string
          created_at: string
          date: string
          id: string
          notes: string | null
          patient_id: string
          time: string
          updated_at: string
          user_id: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          date: string
          id?: string
          notes?: string | null
          patient_id: string
          time: string
          updated_at?: string
          user_id: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          patient_id?: string
          time?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      attachments: {
        Row: {
          created_at: string
          file_path: string
          file_size: number | null
          file_type: string
          id: string
          name: string
          parent_id: string
          parent_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_path: string
          file_size?: number | null
          file_type: string
          id?: string
          name: string
          parent_id: string
          parent_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_path?: string
          file_size?: number | null
          file_type?: string
          id?: string
          name?: string
          parent_id?: string
          parent_type?: string
          user_id?: string
        }
        Relationships: []
      }
      clinic_notes: {
        Row: {
          category: string
          clinic_id: string
          created_at: string
          id: string
          text: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          clinic_id: string
          created_at?: string
          id?: string
          text?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          clinic_id?: string
          created_at?: string
          id?: string
          text?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_notes_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_packages: {
        Row: {
          clinic_id: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          package_type: string
          price: number
          session_limit: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          package_type?: string
          price?: number
          session_limit?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          package_type?: string
          price?: number
          session_limit?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_packages_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_payment_records: {
        Row: {
          amount: number
          clinic_id: string
          created_at: string
          id: string
          month: number
          notes: string | null
          paid: boolean
          payment_date: string | null
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          amount?: number
          clinic_id: string
          created_at?: string
          id?: string
          month: number
          notes?: string | null
          paid?: boolean
          payment_date?: string | null
          updated_at?: string
          user_id: string
          year: number
        }
        Update: {
          amount?: number
          clinic_id?: string
          created_at?: string
          id?: string
          month?: number
          notes?: string | null
          paid?: boolean
          payment_date?: string | null
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "clinic_payment_records_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinics: {
        Row: {
          absence_payment_type: string | null
          address: string | null
          cnpj: string | null
          created_at: string
          discount_percentage: number | null
          email: string | null
          id: string
          is_archived: boolean | null
          letterhead: string | null
          name: string
          notes: string | null
          organization_id: string | null
          payment_amount: number | null
          payment_bank_details: string | null
          payment_pix_key: string | null
          payment_pix_name: string | null
          payment_type: string | null
          pays_on_absence: boolean
          phone: string | null
          schedule_by_day: Json | null
          schedule_time: string | null
          services_description: string | null
          show_payment_in_portal: boolean
          stamp: string | null
          type: string
          updated_at: string
          user_id: string
          weekdays: string[] | null
        }
        Insert: {
          absence_payment_type?: string | null
          address?: string | null
          cnpj?: string | null
          created_at?: string
          discount_percentage?: number | null
          email?: string | null
          id?: string
          is_archived?: boolean | null
          letterhead?: string | null
          name: string
          notes?: string | null
          organization_id?: string | null
          payment_amount?: number | null
          payment_bank_details?: string | null
          payment_pix_key?: string | null
          payment_pix_name?: string | null
          payment_type?: string | null
          pays_on_absence?: boolean
          phone?: string | null
          schedule_by_day?: Json | null
          schedule_time?: string | null
          services_description?: string | null
          show_payment_in_portal?: boolean
          stamp?: string | null
          type?: string
          updated_at?: string
          user_id: string
          weekdays?: string[] | null
        }
        Update: {
          absence_payment_type?: string | null
          address?: string | null
          cnpj?: string | null
          created_at?: string
          discount_percentage?: number | null
          email?: string | null
          id?: string
          is_archived?: boolean | null
          letterhead?: string | null
          name?: string
          notes?: string | null
          organization_id?: string | null
          payment_amount?: number | null
          payment_bank_details?: string | null
          payment_pix_key?: string | null
          payment_pix_name?: string | null
          payment_type?: string | null
          pays_on_absence?: boolean
          phone?: string | null
          schedule_by_day?: Json | null
          schedule_time?: string | null
          services_description?: string | null
          show_payment_in_portal?: boolean
          stamp?: string | null
          type?: string
          updated_at?: string
          user_id?: string
          weekdays?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "clinics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_templates: {
        Row: {
          body_html: string
          created_at: string
          id: string
          is_default: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body_html?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body_html?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      custom_moods: {
        Row: {
          created_at: string
          emoji: string
          id: string
          label: string
          score: number
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          label: string
          score?: number
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          label?: string
          score?: number
          user_id?: string
        }
        Relationships: []
      }
      custom_service_types: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          all_day: boolean | null
          color: string | null
          completed: boolean | null
          created_at: string
          date: string
          description: string | null
          end_time: string | null
          id: string
          reminder_minutes: number | null
          time: string | null
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          all_day?: boolean | null
          color?: string | null
          completed?: boolean | null
          created_at?: string
          date: string
          description?: string | null
          end_time?: string | null
          id?: string
          reminder_minutes?: number | null
          time?: string | null
          title: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          all_day?: boolean | null
          color?: string | null
          completed?: boolean | null
          created_at?: string
          date?: string
          description?: string | null
          end_time?: string | null
          id?: string
          reminder_minutes?: number | null
          time?: string | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      evolution_feedbacks: {
        Row: {
          content: string
          created_at: string
          evolution_ids: string[]
          id: string
          is_bulk: boolean
          patient_id: string
          photo_urls: Json
          sent_to_portal: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          evolution_ids?: string[]
          id?: string
          is_bulk?: boolean
          patient_id: string
          photo_urls?: Json
          sent_to_portal?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          evolution_ids?: string[]
          id?: string
          is_bulk?: boolean
          patient_id?: string
          photo_urls?: Json
          sent_to_portal?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evolution_feedbacks_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      evolution_templates: {
        Row: {
          clinic_id: string
          created_at: string
          description: string | null
          fields: Json
          id: string
          is_active: boolean | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          description?: string | null
          fields?: Json
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          description?: string | null
          fields?: Json
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evolution_templates_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      evolutions: {
        Row: {
          attendance_status: string
          clinic_id: string
          confirmed_attendance: boolean | null
          created_at: string
          date: string
          id: string
          mood: string | null
          patient_id: string
          portal_visible: boolean
          signature: string | null
          stamp_id: string | null
          template_data: Json | null
          template_id: string | null
          text: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attendance_status?: string
          clinic_id: string
          confirmed_attendance?: boolean | null
          created_at?: string
          date: string
          id?: string
          mood?: string | null
          patient_id: string
          portal_visible?: boolean
          signature?: string | null
          stamp_id?: string | null
          template_data?: Json | null
          template_id?: string | null
          text?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attendance_status?: string
          clinic_id?: string
          confirmed_attendance?: boolean | null
          created_at?: string
          date?: string
          id?: string
          mood?: string | null
          patient_id?: string
          portal_visible?: boolean
          signature?: string | null
          stamp_id?: string | null
          template_data?: Json | null
          template_id?: string | null
          text?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evolutions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evolutions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evolutions_stamp_id_fkey"
            columns: ["stamp_id"]
            isOneToOne: false
            referencedRelation: "stamps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evolutions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "evolution_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_comments: {
        Row: {
          author_name: string
          author_type: string
          content: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          author_name?: string
          author_type?: string
          content: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          author_name?: string
          author_type?: string
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_posts: {
        Row: {
          content: string
          created_at: string
          id: string
          link_description: string | null
          link_image: string | null
          link_title: string | null
          link_url: string | null
          media_type: string | null
          media_url: string | null
          patient_id: string
          therapist_id: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          link_description?: string | null
          link_image?: string | null
          link_title?: string | null
          link_url?: string | null
          media_type?: string | null
          media_url?: string | null
          patient_id: string
          therapist_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          link_description?: string | null
          link_image?: string | null
          link_title?: string | null
          link_url?: string | null
          media_type?: string | null
          media_url?: string | null
          patient_id?: string
          therapist_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_posts_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_reactions: {
        Row: {
          created_at: string
          id: string
          post_id: string
          reaction_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          reaction_type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          reaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      google_calendar_tokens: {
        Row: {
          access_token: string
          created_at: string | null
          expires_at: string
          id: string
          refresh_token: string | null
          scope: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string | null
          expires_at: string
          id?: string
          refresh_token?: string | null
          scope?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          refresh_token?: string | null
          scope?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      intake_custom_questions: {
        Row: {
          created_at: string
          field_type: string
          id: string
          is_active: boolean
          options: Json | null
          question: string
          required: boolean
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          field_type?: string
          id?: string
          is_active?: boolean
          options?: Json | null
          question: string
          required?: boolean
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          field_type?: string
          id?: string
          is_active?: boolean
          options?: Json | null
          question?: string
          required?: boolean
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      internal_notifications: {
        Row: {
          created_at: string
          created_by_user_id: string
          date_ref: string | null
          id: string
          message: string
          patient_name: string | null
          read: boolean
          recipient_user_id: string
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          created_by_user_id: string
          date_ref?: string | null
          id?: string
          message: string
          patient_name?: string | null
          read?: boolean
          recipient_user_id: string
          title: string
          type?: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string
          date_ref?: string | null
          id?: string
          message?: string
          patient_name?: string | null
          read?: boolean
          recipient_user_id?: string
          title?: string
          type?: string
        }
        Relationships: []
      }
      message_templates: {
        Row: {
          category: string
          content: string
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notice_reads: {
        Row: {
          id: string
          notice_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          id?: string
          notice_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          id?: string
          notice_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notice_reads_notice_id_fkey"
            columns: ["notice_id"]
            isOneToOne: false
            referencedRelation: "notices"
            referencedColumns: ["id"]
          },
        ]
      }
      notices: {
        Row: {
          color: string | null
          content: string | null
          created_at: string
          id: string
          image_url: string | null
          link_label: string | null
          link_url: string | null
          pinned: boolean | null
          title: string
          type: string
          updated_at: string
          user_id: string
          video_url: string | null
        }
        Insert: {
          color?: string | null
          content?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          link_label?: string | null
          link_url?: string | null
          pinned?: boolean | null
          title: string
          type?: string
          updated_at?: string
          user_id: string
          video_url?: string | null
        }
        Update: {
          color?: string | null
          content?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          link_label?: string | null
          link_url?: string | null
          pinned?: boolean | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
          video_url?: string | null
        }
        Relationships: []
      }
      organization_members: {
        Row: {
          created_at: string
          email: string
          id: string
          invited_by: string
          joined_at: string | null
          organization_id: string
          permissions: Json | null
          remuneration_type: string | null
          remuneration_value: number | null
          role: string
          role_label: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          invited_by: string
          joined_at?: string | null
          organization_id: string
          permissions?: Json | null
          remuneration_type?: string | null
          remuneration_value?: number | null
          role?: string
          role_label?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          invited_by?: string
          joined_at?: string | null
          organization_id?: string
          permissions?: Json | null
          remuneration_type?: string | null
          remuneration_value?: number | null
          role?: string
          role_label?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      patient_contracts: {
        Row: {
          contract_template_id: string | null
          created_at: string
          id: string
          patient_id: string
          signature_data: string | null
          signed_at: string | null
          status: string
          template_html: string
          therapist_signature_data: string | null
          therapist_signed_at: string | null
          therapist_user_id: string
          updated_at: string
        }
        Insert: {
          contract_template_id?: string | null
          created_at?: string
          id?: string
          patient_id: string
          signature_data?: string | null
          signed_at?: string | null
          status?: string
          template_html?: string
          therapist_signature_data?: string | null
          therapist_signed_at?: string | null
          therapist_user_id: string
          updated_at?: string
        }
        Update: {
          contract_template_id?: string | null
          created_at?: string
          id?: string
          patient_id?: string
          signature_data?: string | null
          signed_at?: string | null
          status?: string
          template_html?: string
          therapist_signature_data?: string | null
          therapist_signed_at?: string | null
          therapist_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_contracts_contract_template_id_fkey"
            columns: ["contract_template_id"]
            isOneToOne: false
            referencedRelation: "contract_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_intake_forms: {
        Row: {
          address: string | null
          birthdate: string | null
          cpf: string | null
          created_at: string
          custom_answers: Json | null
          email: string | null
          emergency_contact: string | null
          emergency_contact_address: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relation: string | null
          financial_responsible_address: string | null
          financial_responsible_cpf: string | null
          financial_responsible_email: string | null
          financial_responsible_name: string | null
          financial_responsible_phone: string | null
          financial_responsible_relation: string | null
          full_name: string | null
          gender: string | null
          health_info: string | null
          how_found: string | null
          id: string
          needs_review: boolean
          observations: string | null
          patient_id: string
          payment_due_day: number | null
          phone: string | null
          responsible_cpf: string | null
          responsible_name: string | null
          responsible_phone: string | null
          review_history: Json
          review_status: string | null
          reviewed_at: string | null
          submitted_at: string | null
          therapist_user_id: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          birthdate?: string | null
          cpf?: string | null
          created_at?: string
          custom_answers?: Json | null
          email?: string | null
          emergency_contact?: string | null
          emergency_contact_address?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relation?: string | null
          financial_responsible_address?: string | null
          financial_responsible_cpf?: string | null
          financial_responsible_email?: string | null
          financial_responsible_name?: string | null
          financial_responsible_phone?: string | null
          financial_responsible_relation?: string | null
          full_name?: string | null
          gender?: string | null
          health_info?: string | null
          how_found?: string | null
          id?: string
          needs_review?: boolean
          observations?: string | null
          patient_id: string
          payment_due_day?: number | null
          phone?: string | null
          responsible_cpf?: string | null
          responsible_name?: string | null
          responsible_phone?: string | null
          review_history?: Json
          review_status?: string | null
          reviewed_at?: string | null
          submitted_at?: string | null
          therapist_user_id: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          birthdate?: string | null
          cpf?: string | null
          created_at?: string
          custom_answers?: Json | null
          email?: string | null
          emergency_contact?: string | null
          emergency_contact_address?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relation?: string | null
          financial_responsible_address?: string | null
          financial_responsible_cpf?: string | null
          financial_responsible_email?: string | null
          financial_responsible_name?: string | null
          financial_responsible_phone?: string | null
          financial_responsible_relation?: string | null
          full_name?: string | null
          gender?: string | null
          health_info?: string | null
          how_found?: string | null
          id?: string
          needs_review?: boolean
          observations?: string | null
          patient_id?: string
          payment_due_day?: number | null
          phone?: string | null
          responsible_cpf?: string | null
          responsible_name?: string | null
          responsible_phone?: string | null
          review_history?: Json
          review_status?: string | null
          reviewed_at?: string | null
          submitted_at?: string | null
          therapist_user_id?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      patient_payment_records: {
        Row: {
          amount: number
          clinic_id: string
          created_at: string
          id: string
          month: number
          notes: string | null
          paid: boolean
          patient_id: string
          payment_date: string | null
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          amount?: number
          clinic_id: string
          created_at?: string
          id?: string
          month: number
          notes?: string | null
          paid?: boolean
          patient_id: string
          payment_date?: string | null
          updated_at?: string
          user_id: string
          year: number
        }
        Update: {
          amount?: number
          clinic_id?: string
          created_at?: string
          id?: string
          month?: number
          notes?: string | null
          paid?: boolean
          patient_id?: string
          payment_date?: string | null
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "patient_payment_records_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_payment_records_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_portal_accounts: {
        Row: {
          access_label: string | null
          access_type: string
          created_at: string
          id: string
          invite_expires_at: string | null
          invite_sent_at: string | null
          invite_token: string | null
          patient_email: string
          patient_id: string
          permissions: Json
          specific_details: Json | null
          status: string
          therapist_user_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          access_label?: string | null
          access_type?: string
          created_at?: string
          id?: string
          invite_expires_at?: string | null
          invite_sent_at?: string | null
          invite_token?: string | null
          patient_email: string
          patient_id: string
          permissions?: Json
          specific_details?: Json | null
          status?: string
          therapist_user_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          access_label?: string | null
          access_type?: string
          created_at?: string
          id?: string
          invite_expires_at?: string | null
          invite_sent_at?: string | null
          invite_token?: string | null
          patient_email?: string
          patient_id?: string
          permissions?: Json
          specific_details?: Json | null
          status?: string
          therapist_user_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      patients: {
        Row: {
          avatar_url: string | null
          birthdate: string
          clinic_id: string
          clinical_area: string | null
          contract_start_date: string | null
          cpf: string | null
          created_at: string
          diagnosis: string | null
          email: string | null
          financial_responsible_cpf: string | null
          financial_responsible_name: string | null
          financial_responsible_whatsapp: string | null
          id: string
          intake_token: string | null
          is_archived: boolean | null
          name: string
          observations: string | null
          package_id: string | null
          payment_due_day: number | null
          payment_info: string | null
          payment_type: string | null
          payment_value: number | null
          phone: string | null
          professionals: string | null
          responsible_cpf: string | null
          responsible_email: string | null
          responsible_is_financial: boolean | null
          responsible_name: string | null
          responsible_whatsapp: string | null
          schedule_by_day: Json | null
          schedule_time: string | null
          show_payment_in_portal: boolean
          status: string
          updated_at: string
          user_id: string
          weekdays: string[] | null
          whatsapp: string | null
        }
        Insert: {
          avatar_url?: string | null
          birthdate: string
          clinic_id: string
          clinical_area?: string | null
          contract_start_date?: string | null
          cpf?: string | null
          created_at?: string
          diagnosis?: string | null
          email?: string | null
          financial_responsible_cpf?: string | null
          financial_responsible_name?: string | null
          financial_responsible_whatsapp?: string | null
          id?: string
          intake_token?: string | null
          is_archived?: boolean | null
          name: string
          observations?: string | null
          package_id?: string | null
          payment_due_day?: number | null
          payment_info?: string | null
          payment_type?: string | null
          payment_value?: number | null
          phone?: string | null
          professionals?: string | null
          responsible_cpf?: string | null
          responsible_email?: string | null
          responsible_is_financial?: boolean | null
          responsible_name?: string | null
          responsible_whatsapp?: string | null
          schedule_by_day?: Json | null
          schedule_time?: string | null
          show_payment_in_portal?: boolean
          status?: string
          updated_at?: string
          user_id: string
          weekdays?: string[] | null
          whatsapp?: string | null
        }
        Update: {
          avatar_url?: string | null
          birthdate?: string
          clinic_id?: string
          clinical_area?: string | null
          contract_start_date?: string | null
          cpf?: string | null
          created_at?: string
          diagnosis?: string | null
          email?: string | null
          financial_responsible_cpf?: string | null
          financial_responsible_name?: string | null
          financial_responsible_whatsapp?: string | null
          id?: string
          intake_token?: string | null
          is_archived?: boolean | null
          name?: string
          observations?: string | null
          package_id?: string | null
          payment_due_day?: number | null
          payment_info?: string | null
          payment_type?: string | null
          payment_value?: number | null
          phone?: string | null
          professionals?: string | null
          responsible_cpf?: string | null
          responsible_email?: string | null
          responsible_is_financial?: boolean | null
          responsible_name?: string | null
          responsible_whatsapp?: string | null
          schedule_by_day?: Json | null
          schedule_time?: string | null
          show_payment_in_portal?: boolean
          status?: string
          updated_at?: string
          user_id?: string
          weekdays?: string[] | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patients_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "clinic_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_documents: {
        Row: {
          created_at: string
          description: string | null
          file_path: string
          file_size: number | null
          file_type: string
          id: string
          name: string
          patient_id: string
          portal_account_id: string
          therapist_user_id: string
          updated_at: string
          uploaded_by_type: string
          uploaded_by_user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_path: string
          file_size?: number | null
          file_type?: string
          id?: string
          name: string
          patient_id: string
          portal_account_id: string
          therapist_user_id: string
          updated_at?: string
          uploaded_by_type?: string
          uploaded_by_user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          file_path?: string
          file_size?: number | null
          file_type?: string
          id?: string
          name?: string
          patient_id?: string
          portal_account_id?: string
          therapist_user_id?: string
          updated_at?: string
          uploaded_by_type?: string
          uploaded_by_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_documents_portal_account_id_fkey"
            columns: ["portal_account_id"]
            isOneToOne: false
            referencedRelation: "patient_portal_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_messages: {
        Row: {
          appointment_date: string | null
          appointment_time: string | null
          content: string
          created_at: string
          id: string
          message_type: string
          patient_id: string
          read_by_patient: boolean
          read_by_therapist: boolean
          sender_type: string
          therapist_user_id: string
        }
        Insert: {
          appointment_date?: string | null
          appointment_time?: string | null
          content?: string
          created_at?: string
          id?: string
          message_type?: string
          patient_id: string
          read_by_patient?: boolean
          read_by_therapist?: boolean
          sender_type?: string
          therapist_user_id: string
        }
        Update: {
          appointment_date?: string | null
          appointment_time?: string | null
          content?: string
          created_at?: string
          id?: string
          message_type?: string
          patient_id?: string
          read_by_patient?: boolean
          read_by_therapist?: boolean
          sender_type?: string
          therapist_user_id?: string
        }
        Relationships: []
      }
      portal_notices: {
        Row: {
          content: string | null
          created_at: string
          id: string
          patient_id: string
          read_by_patient: boolean
          therapist_user_id: string
          title: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          patient_id: string
          read_by_patient?: boolean
          therapist_user_id: string
          title: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          patient_id?: string
          read_by_patient?: boolean
          therapist_user_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      private_appointments: {
        Row: {
          client_email: string | null
          client_name: string
          client_phone: string | null
          clinic_id: string | null
          created_at: string
          date: string
          id: string
          notes: string | null
          paid: boolean | null
          payment_date: string | null
          price: number
          service_id: string | null
          status: string
          time: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_email?: string | null
          client_name: string
          client_phone?: string | null
          clinic_id?: string | null
          created_at?: string
          date: string
          id?: string
          notes?: string | null
          paid?: boolean | null
          payment_date?: string | null
          price?: number
          service_id?: string | null
          status?: string
          time: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_email?: string | null
          client_name?: string
          client_phone?: string | null
          clinic_id?: string | null
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          paid?: boolean | null
          payment_date?: string | null
          price?: number
          service_id?: string | null
          status?: string
          time?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "private_appointments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "private_appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          cbo: string | null
          cpf: string | null
          created_at: string
          email: string | null
          id: string
          is_support_admin: boolean
          name: string | null
          phone: string | null
          professional_id: string | null
          trial_until: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          cbo?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_support_admin?: boolean
          name?: string | null
          phone?: string | null
          professional_id?: string | null
          trial_until?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          cbo?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_support_admin?: boolean
          name?: string | null
          phone?: string | null
          professional_id?: string | null
          trial_until?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_tokens: {
        Row: {
          created_at: string
          id: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform?: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_reports: {
        Row: {
          clinic_id: string | null
          content: string
          created_at: string
          id: string
          mode: string
          patient_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          clinic_id?: string | null
          content?: string
          created_at?: string
          id?: string
          mode?: string
          patient_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          clinic_id?: string | null
          content?: string
          created_at?: string
          id?: string
          mode?: string
          patient_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_reports_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_reports_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          created_at: string
          description: string | null
          duration_minutes: number | null
          id: string
          is_active: boolean | null
          name: string
          price: number
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          price?: number
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          price?: number
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      stamps: {
        Row: {
          cbo: string | null
          clinical_area: string
          created_at: string
          id: string
          is_default: boolean | null
          name: string
          signature_image: string | null
          stamp_image: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cbo?: string | null
          clinical_area: string
          created_at?: string
          id?: string
          is_default?: boolean | null
          name: string
          signature_image?: string | null
          stamp_image?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cbo?: string | null
          clinical_area?: string
          created_at?: string
          id?: string
          is_default?: boolean | null
          name?: string
          signature_image?: string | null
          stamp_image?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_chat_sessions: {
        Row: {
          closed_at: string
          closed_by: string
          id: string
          message_count: number
          user_id: string
        }
        Insert: {
          closed_at?: string
          closed_by?: string
          id?: string
          message_count?: number
          user_id: string
        }
        Update: {
          closed_at?: string
          closed_by?: string
          id?: string
          message_count?: number
          user_id?: string
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          admin_id: string | null
          created_at: string
          id: string
          is_admin_reply: boolean
          message: string
          user_id: string
        }
        Insert: {
          admin_id?: string | null
          created_at?: string
          id?: string
          is_admin_reply?: boolean
          message: string
          user_id: string
        }
        Update: {
          admin_id?: string | null
          created_at?: string
          id?: string
          is_admin_reply?: boolean
          message?: string
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          completed: boolean
          created_at: string
          id: string
          notes: string | null
          patient_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          id?: string
          notes?: string | null
          patient_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          id?: string
          notes?: string | null
          patient_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      team_attendance: {
        Row: {
          attachment_name: string | null
          attachment_url: string | null
          created_at: string
          created_by: string
          date: string
          id: string
          justification: string | null
          member_id: string
          organization_id: string
          status: string
          updated_at: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_url?: string | null
          created_at?: string
          created_by: string
          date: string
          id?: string
          justification?: string | null
          member_id: string
          organization_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          attachment_name?: string | null
          attachment_url?: string | null
          created_at?: string
          created_by?: string
          date?: string
          id?: string
          justification?: string | null
          member_id?: string
          organization_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_attendance_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_attendance_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      therapist_patient_assignments: {
        Row: {
          created_at: string
          id: string
          member_id: string
          organization_id: string
          patient_id: string
          schedule_time: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_id: string
          organization_id: string
          patient_id: string
          schedule_time?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          member_id?: string
          organization_id?: string
          patient_id?: string
          schedule_time?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "therapist_patient_assignments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_patient_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_patient_assignments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_org_role: {
        Args: { _org_id: string; _user_id: string }
        Returns: string
      }
      is_clinic_org_member: {
        Args: { _clinic_id: string; _user_id: string }
        Returns: boolean
      }
      is_clinic_org_owner: {
        Args: { _clinic_id: string; _user_id: string }
        Returns: boolean
      }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_org_owner: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_portal_patient: {
        Args: { _patient_id: string; _user_id: string }
        Returns: boolean
      }
      is_support_admin: { Args: { _user_id: string }; Returns: boolean }
      is_therapist_assigned_to_patient: {
        Args: { _patient_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
