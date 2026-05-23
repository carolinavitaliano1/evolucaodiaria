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
          convenio: string | null
          created_at: string
          date: string
          end_time: string | null
          id: string
          is_recurring: boolean
          notes: string | null
          package_id: string | null
          patient_id: string
          procedure_id: string | null
          room: string | null
          status: string
          therapist_user_id: string | null
          time: string
          updated_at: string
          user_id: string
        }
        Insert: {
          clinic_id: string
          convenio?: string | null
          created_at?: string
          date: string
          end_time?: string | null
          id?: string
          is_recurring?: boolean
          notes?: string | null
          package_id?: string | null
          patient_id: string
          procedure_id?: string | null
          room?: string | null
          status?: string
          therapist_user_id?: string | null
          time: string
          updated_at?: string
          user_id: string
        }
        Update: {
          clinic_id?: string
          convenio?: string | null
          created_at?: string
          date?: string
          end_time?: string | null
          id?: string
          is_recurring?: boolean
          notes?: string | null
          package_id?: string | null
          patient_id?: string
          procedure_id?: string | null
          room?: string | null
          status?: string
          therapist_user_id?: string | null
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
            foreignKeyName: "appointments_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "clinic_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_procedure_id_fkey"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "procedures"
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
      attendance_confirmations: {
        Row: {
          clinic_id: string
          confirmed_at: string
          confirmed_by_user_id: string
          date: string
          id: string
          patient_id: string
        }
        Insert: {
          clinic_id: string
          confirmed_at?: string
          confirmed_by_user_id: string
          date: string
          id?: string
          patient_id: string
        }
        Update: {
          clinic_id?: string
          confirmed_at?: string
          confirmed_by_user_id?: string
          date?: string
          id?: string
          patient_id?: string
        }
        Relationships: []
      }
      calendar_blocks: {
        Row: {
          block_type: string
          clinic_id: string | null
          created_at: string
          description: string
          end_date: string
          id: string
          start_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          block_type?: string
          clinic_id?: string | null
          created_at?: string
          description?: string
          end_date: string
          id?: string
          start_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          block_type?: string
          clinic_id?: string | null
          created_at?: string
          description?: string
          end_date?: string
          id?: string
          start_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_blocks_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_notes: {
        Row: {
          category: string
          clinic_id: string
          created_at: string
          group_id: string | null
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
          group_id?: string | null
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
          group_id?: string | null
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
          {
            foreignKeyName: "clinic_notes_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "therapeutic_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_packages: {
        Row: {
          account_name: string | null
          clinic_id: string
          commission_payment_method: string
          commission_per_professional: boolean
          commission_type: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          lancamento_tipo: string
          name: string
          package_type: string
          price: number
          session_limit: number | null
          updated_at: string | null
          user_id: string
          valor_total: number | null
        }
        Insert: {
          account_name?: string | null
          clinic_id: string
          commission_payment_method?: string
          commission_per_professional?: boolean
          commission_type?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          lancamento_tipo?: string
          name: string
          package_type?: string
          price?: number
          session_limit?: number | null
          updated_at?: string | null
          user_id: string
          valor_total?: number | null
        }
        Update: {
          account_name?: string | null
          clinic_id?: string
          commission_payment_method?: string
          commission_per_professional?: boolean
          commission_type?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          lancamento_tipo?: string
          name?: string
          package_type?: string
          price?: number
          session_limit?: number | null
          updated_at?: string | null
          user_id?: string
          valor_total?: number | null
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
          absence_charge_amount: number | null
          absence_charge_mode: string
          absence_payment_type: string | null
          address: string | null
          cnpj: string | null
          created_at: string
          discount_percentage: number | null
          document_footer_text: string | null
          document_header_text: string | null
          document_logo_url: string | null
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
          absence_charge_amount?: number | null
          absence_charge_mode?: string
          absence_payment_type?: string | null
          address?: string | null
          cnpj?: string | null
          created_at?: string
          discount_percentage?: number | null
          document_footer_text?: string | null
          document_header_text?: string | null
          document_logo_url?: string | null
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
          absence_charge_amount?: number | null
          absence_charge_mode?: string
          absence_payment_type?: string | null
          address?: string | null
          cnpj?: string | null
          created_at?: string
          discount_percentage?: number | null
          document_footer_text?: string | null
          document_header_text?: string | null
          document_logo_url?: string | null
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
      doc_ia_templates: {
        Row: {
          created_at: string
          default_title: string | null
          example_text: string
          id: string
          instructions: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_title?: string | null
          example_text?: string
          id?: string
          instructions?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_title?: string | null
          example_text?: string
          id?: string
          instructions?: string
          name?: string
          updated_at?: string
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
          group_id: string | null
          id: string
          mood: string | null
          patient_id: string
          portal_visible: boolean
          schedule_slot_id: string | null
          session_time: string | null
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
          group_id?: string | null
          id?: string
          mood?: string | null
          patient_id: string
          portal_visible?: boolean
          schedule_slot_id?: string | null
          session_time?: string | null
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
          group_id?: string | null
          id?: string
          mood?: string | null
          patient_id?: string
          portal_visible?: boolean
          schedule_slot_id?: string | null
          session_time?: string | null
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
            foreignKeyName: "evolutions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "therapeutic_groups"
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
          group_id: string | null
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
          group_id?: string | null
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
          group_id?: string | null
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
            foreignKeyName: "feed_posts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "therapeutic_groups"
            referencedColumns: ["id"]
          },
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
      fiscal_certificate_secrets: {
        Row: {
          certificate_password: string
          created_at: string
          fiscal_config_id: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          certificate_password: string
          created_at?: string
          fiscal_config_id: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          certificate_password?: string
          created_at?: string
          fiscal_config_id?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_certificate_secrets_fiscal_config_id_fkey"
            columns: ["fiscal_config_id"]
            isOneToOne: false
            referencedRelation: "fiscal_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_configs: {
        Row: {
          aliquota_iss: number | null
          ativo: boolean
          certificado_path: string | null
          clinic_id: string | null
          cnpj: string
          codigo_municipio_ibge: string | null
          codigo_servico_municipal: string | null
          created_at: string
          endereco_bairro: string | null
          endereco_cep: string | null
          endereco_cidade: string | null
          endereco_complemento: string | null
          endereco_numero: string | null
          endereco_rua: string | null
          endereco_uf: string | null
          id: string
          inscricao_estadual: string | null
          inscricao_municipal: string | null
          item_lista_servico: string | null
          nome_fantasia: string | null
          razao_social: string
          regime_tributario: string
          updated_at: string
          user_id: string
        }
        Insert: {
          aliquota_iss?: number | null
          ativo?: boolean
          certificado_path?: string | null
          clinic_id?: string | null
          cnpj: string
          codigo_municipio_ibge?: string | null
          codigo_servico_municipal?: string | null
          created_at?: string
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_cidade?: string | null
          endereco_complemento?: string | null
          endereco_numero?: string | null
          endereco_rua?: string | null
          endereco_uf?: string | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          item_lista_servico?: string | null
          nome_fantasia?: string | null
          razao_social: string
          regime_tributario?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          aliquota_iss?: number | null
          ativo?: boolean
          certificado_path?: string | null
          clinic_id?: string | null
          cnpj?: string
          codigo_municipio_ibge?: string | null
          codigo_servico_municipal?: string | null
          created_at?: string
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_cidade?: string | null
          endereco_complemento?: string | null
          endereco_numero?: string | null
          endereco_rua?: string | null
          endereco_uf?: string | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          item_lista_servico?: string | null
          nome_fantasia?: string | null
          razao_social?: string
          regime_tributario?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      fiscal_invoice_counters: {
        Row: {
          count: number
          month: number
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          count?: number
          month: number
          updated_at?: string
          user_id: string
          year: number
        }
        Update: {
          count?: number
          month?: number
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      fiscal_invoices: {
        Row: {
          amount: number
          cancel_reason: string | null
          cancelled_at: string | null
          clinic_id: string | null
          created_at: string
          error_message: string | null
          external_reference: string
          focus_nfe_ref: string | null
          id: string
          invoice_number: string | null
          invoice_series: string | null
          iss_aliquota: number | null
          iss_amount: number | null
          issued_at: string | null
          patient_id: string | null
          payment_record_id: string | null
          pdf_url: string | null
          private_appointment_id: string | null
          provider: string
          raw_response: Json | null
          recipient_address: string | null
          recipient_cpf_cnpj: string | null
          recipient_email: string | null
          recipient_name: string | null
          service_description: string | null
          status: string
          updated_at: string
          user_id: string
          verification_code: string | null
          xml_url: string | null
        }
        Insert: {
          amount?: number
          cancel_reason?: string | null
          cancelled_at?: string | null
          clinic_id?: string | null
          created_at?: string
          error_message?: string | null
          external_reference: string
          focus_nfe_ref?: string | null
          id?: string
          invoice_number?: string | null
          invoice_series?: string | null
          iss_aliquota?: number | null
          iss_amount?: number | null
          issued_at?: string | null
          patient_id?: string | null
          payment_record_id?: string | null
          pdf_url?: string | null
          private_appointment_id?: string | null
          provider?: string
          raw_response?: Json | null
          recipient_address?: string | null
          recipient_cpf_cnpj?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          service_description?: string | null
          status?: string
          updated_at?: string
          user_id: string
          verification_code?: string | null
          xml_url?: string | null
        }
        Update: {
          amount?: number
          cancel_reason?: string | null
          cancelled_at?: string | null
          clinic_id?: string | null
          created_at?: string
          error_message?: string | null
          external_reference?: string
          focus_nfe_ref?: string | null
          id?: string
          invoice_number?: string | null
          invoice_series?: string | null
          iss_aliquota?: number | null
          iss_amount?: number | null
          issued_at?: string | null
          patient_id?: string | null
          payment_record_id?: string | null
          pdf_url?: string | null
          private_appointment_id?: string | null
          provider?: string
          raw_response?: Json | null
          recipient_address?: string | null
          recipient_cpf_cnpj?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          service_description?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          verification_code?: string | null
          xml_url?: string | null
        }
        Relationships: []
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
      health_plans: {
        Row: {
          ans_registry: string | null
          clinic_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          passthrough_value: number
          phone: string | null
          reimbursement_type: string | null
          reimbursement_value: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ans_registry?: string | null
          clinic_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          passthrough_value?: number
          phone?: string | null
          reimbursement_type?: string | null
          reimbursement_value?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ans_registry?: string | null
          clinic_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          passthrough_value?: number
          phone?: string | null
          reimbursement_type?: string | null
          reimbursement_value?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      in_person_recordings: {
        Row: {
          clinic_id: string | null
          created_at: string
          duration_seconds: number | null
          file_size_bytes: number | null
          id: string
          mime_type: string | null
          patient_id: string
          source: string
          storage_path: string
          therapist_user_id: string
          title: string | null
          transcription_error: string | null
          transcription_speakers: Json | null
          transcription_status: string
          transcription_text: string | null
          updated_at: string
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          file_size_bytes?: number | null
          id?: string
          mime_type?: string | null
          patient_id: string
          source?: string
          storage_path: string
          therapist_user_id: string
          title?: string | null
          transcription_error?: string | null
          transcription_speakers?: Json | null
          transcription_status?: string
          transcription_text?: string | null
          updated_at?: string
        }
        Update: {
          clinic_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          file_size_bytes?: number | null
          id?: string
          mime_type?: string | null
          patient_id?: string
          source?: string
          storage_path?: string
          therapist_user_id?: string
          title?: string | null
          transcription_error?: string | null
          transcription_speakers?: Json | null
          transcription_status?: string
          transcription_text?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "in_person_recordings_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
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
      member_remuneration_plans: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          member_id: string
          name: string
          package_id: string | null
          remuneration_type: string
          remuneration_value: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          member_id: string
          name?: string
          package_id?: string | null
          remuneration_type?: string
          remuneration_value?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          member_id?: string
          name?: string
          package_id?: string | null
          remuneration_type?: string
          remuneration_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_remuneration_plans_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_remuneration_plans_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "clinic_packages"
            referencedColumns: ["id"]
          },
        ]
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
      module_orientacoes: {
        Row: {
          audience: string
          content: string
          created_at: string
          id: string
          kind: string
          patient_id: string
          titulo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          audience: string
          content?: string
          created_at?: string
          id?: string
          kind: string
          patient_id: string
          titulo?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          audience?: string
          content?: string
          created_at?: string
          id?: string
          kind?: string
          patient_id?: string
          titulo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      module_subscriptions: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          module_id: string
          started_at: string
          status: string
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          module_id: string
          started_at?: string
          status?: string
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          module_id?: string
          started_at?: string
          status?: string
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
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
          schedule_by_day: Json | null
          status: string
          updated_at: string
          user_id: string | null
          weekdays: string[] | null
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
          schedule_by_day?: Json | null
          status?: string
          updated_at?: string
          user_id?: string | null
          weekdays?: string[] | null
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
          schedule_by_day?: Json | null
          status?: string
          updated_at?: string
          user_id?: string | null
          weekdays?: string[] | null
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
          applications_link_enabled: boolean
          created_at: string
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          applications_link_enabled?: boolean
          created_at?: string
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          applications_link_enabled?: boolean
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      package_commissions: {
        Row: {
          commission_type: string
          commission_value: number
          created_at: string
          id: string
          member_id: string
          package_id: string
          updated_at: string
        }
        Insert: {
          commission_type?: string
          commission_value?: number
          created_at?: string
          id?: string
          member_id: string
          package_id: string
          updated_at?: string
        }
        Update: {
          commission_type?: string
          commission_value?: number
          created_at?: string
          id?: string
          member_id?: string
          package_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "package_commissions_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "clinic_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_contracts: {
        Row: {
          agreed_terms: boolean
          contract_template_id: string | null
          created_at: string
          id: string
          patient_id: string
          signature_data: string | null
          signed_at: string | null
          signer_city: string | null
          signer_cpf: string | null
          signer_name: string | null
          status: string
          template_html: string
          therapist_signature_data: string | null
          therapist_signed_at: string | null
          therapist_user_id: string
          updated_at: string
        }
        Insert: {
          agreed_terms?: boolean
          contract_template_id?: string | null
          created_at?: string
          id?: string
          patient_id: string
          signature_data?: string | null
          signed_at?: string | null
          signer_city?: string | null
          signer_cpf?: string | null
          signer_name?: string | null
          status?: string
          template_html?: string
          therapist_signature_data?: string | null
          therapist_signed_at?: string | null
          therapist_user_id: string
          updated_at?: string
        }
        Update: {
          agreed_terms?: boolean
          contract_template_id?: string | null
          created_at?: string
          id?: string
          patient_id?: string
          signature_data?: string | null
          signed_at?: string | null
          signer_city?: string | null
          signer_cpf?: string | null
          signer_name?: string | null
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
      patient_documents: {
        Row: {
          clinic_id: string
          content: string
          created_at: string
          doc_type: string
          file_path: string | null
          file_url: string | null
          id: string
          patient_id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          clinic_id: string
          content?: string
          created_at?: string
          doc_type?: string
          file_path?: string | null
          file_url?: string | null
          id?: string
          patient_id: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          clinic_id?: string
          content?: string
          created_at?: string
          doc_type?: string
          file_path?: string | null
          file_url?: string | null
          id?: string
          patient_id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      patient_package_renewals: {
        Row: {
          created_at: string
          cycle_started_at: string | null
          decided_by: string | null
          decision: string
          id: string
          notes: string | null
          package_id: string | null
          patient_id: string
          session_limit: number | null
          sessions_used_in_cycle: number | null
        }
        Insert: {
          created_at?: string
          cycle_started_at?: string | null
          decided_by?: string | null
          decision: string
          id?: string
          notes?: string | null
          package_id?: string | null
          patient_id: string
          session_limit?: number | null
          sessions_used_in_cycle?: number | null
        }
        Update: {
          created_at?: string
          cycle_started_at?: string | null
          decided_by?: string | null
          decision?: string
          id?: string
          notes?: string | null
          package_id?: string | null
          patient_id?: string
          session_limit?: number | null
          sessions_used_in_cycle?: number | null
        }
        Relationships: []
      }
      patient_packages: {
        Row: {
          created_at: string
          created_by: string
          id: string
          member_id: string | null
          notes: string | null
          organization_id: string | null
          package_id: string
          patient_id: string
          therapist_user_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          member_id?: string | null
          notes?: string | null
          organization_id?: string | null
          package_id: string
          patient_id: string
          therapist_user_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          member_id?: string | null
          notes?: string | null
          organization_id?: string | null
          package_id?: string
          patient_id?: string
          therapist_user_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_packages_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_packages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_packages_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "clinic_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_packages_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_payment_records: {
        Row: {
          amount: number
          clinic_id: string
          created_at: string
          due_date: string | null
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
          due_date?: string | null
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
          due_date?: string | null
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
      patient_questionnaires: {
        Row: {
          answers: Json | null
          created_at: string
          fields: Json
          id: string
          patient_id: string
          portal_account_id: string | null
          status: string
          submitted_at: string | null
          template_id: string | null
          therapist_user_id: string
          title: string
          updated_at: string
        }
        Insert: {
          answers?: Json | null
          created_at?: string
          fields?: Json
          id?: string
          patient_id: string
          portal_account_id?: string | null
          status?: string
          submitted_at?: string | null
          template_id?: string | null
          therapist_user_id: string
          title: string
          updated_at?: string
        }
        Update: {
          answers?: Json | null
          created_at?: string
          fields?: Json
          id?: string
          patient_id?: string
          portal_account_id?: string | null
          status?: string
          submitted_at?: string | null
          template_id?: string | null
          therapist_user_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_questionnaires_portal_account_id_fkey"
            columns: ["portal_account_id"]
            isOneToOne: false
            referencedRelation: "patient_portal_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_questionnaires_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "questionnaire_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_schedule_slots: {
        Row: {
          clinic_id: string
          created_at: string
          created_by: string
          end_time: string
          id: string
          member_id: string
          notes: string | null
          organization_id: string | null
          package_link_id: string | null
          patient_id: string
          remuneration_plan_id: string | null
          start_time: string
          updated_at: string
          weekday: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          created_by: string
          end_time: string
          id?: string
          member_id: string
          notes?: string | null
          organization_id?: string | null
          package_link_id?: string | null
          patient_id: string
          remuneration_plan_id?: string | null
          start_time: string
          updated_at?: string
          weekday: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          created_by?: string
          end_time?: string
          id?: string
          member_id?: string
          notes?: string | null
          organization_id?: string | null
          package_link_id?: string | null
          patient_id?: string
          remuneration_plan_id?: string | null
          start_time?: string
          updated_at?: string
          weekday?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_schedule_slots_remuneration_plan_id_fkey"
            columns: ["remuneration_plan_id"]
            isOneToOne: false
            referencedRelation: "member_remuneration_plans"
            referencedColumns: ["id"]
          },
        ]
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
          departure_date: string | null
          departure_reason: string | null
          diagnosis: string | null
          email: string | null
          financial_responsible_cpf: string | null
          financial_responsible_name: string | null
          financial_responsible_whatsapp: string | null
          guardian_email: string | null
          guardian_kinship: string | null
          guardian_name: string | null
          guardian_phone: string | null
          health_plan_authorization_expires_at: string | null
          health_plan_authorized_sessions: number | null
          health_plan_card_number: string | null
          health_plan_id: string | null
          id: string
          intake_token: string | null
          is_archived: boolean | null
          is_minor: boolean
          is_virtual: boolean
          name: string
          observations: string | null
          package_assigned_at: string | null
          package_decision_at: string | null
          package_id: string | null
          package_renewal_decision: string | null
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
          session_link: string | null
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
          departure_date?: string | null
          departure_reason?: string | null
          diagnosis?: string | null
          email?: string | null
          financial_responsible_cpf?: string | null
          financial_responsible_name?: string | null
          financial_responsible_whatsapp?: string | null
          guardian_email?: string | null
          guardian_kinship?: string | null
          guardian_name?: string | null
          guardian_phone?: string | null
          health_plan_authorization_expires_at?: string | null
          health_plan_authorized_sessions?: number | null
          health_plan_card_number?: string | null
          health_plan_id?: string | null
          id?: string
          intake_token?: string | null
          is_archived?: boolean | null
          is_minor?: boolean
          is_virtual?: boolean
          name: string
          observations?: string | null
          package_assigned_at?: string | null
          package_decision_at?: string | null
          package_id?: string | null
          package_renewal_decision?: string | null
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
          session_link?: string | null
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
          departure_date?: string | null
          departure_reason?: string | null
          diagnosis?: string | null
          email?: string | null
          financial_responsible_cpf?: string | null
          financial_responsible_name?: string | null
          financial_responsible_whatsapp?: string | null
          guardian_email?: string | null
          guardian_kinship?: string | null
          guardian_name?: string | null
          guardian_phone?: string | null
          health_plan_authorization_expires_at?: string | null
          health_plan_authorized_sessions?: number | null
          health_plan_card_number?: string | null
          health_plan_id?: string | null
          id?: string
          intake_token?: string | null
          is_archived?: boolean | null
          is_minor?: boolean
          is_virtual?: boolean
          name?: string
          observations?: string | null
          package_assigned_at?: string | null
          package_decision_at?: string | null
          package_id?: string | null
          package_renewal_decision?: string | null
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
          session_link?: string | null
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
            foreignKeyName: "patients_health_plan_id_fkey"
            columns: ["health_plan_id"]
            isOneToOne: false
            referencedRelation: "health_plans"
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
      pending_trials: {
        Row: {
          created_at: string
          email: string
          id: string
          note: string | null
          trial_until: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          note?: string | null
          trial_until: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          note?: string | null
          trial_until?: string
        }
        Relationships: []
      }
      portal_activities: {
        Row: {
          attachments: Json
          created_at: string
          due_date: string | null
          id: string
          items: Json
          patient_id: string
          portal_account_id: string | null
          status: string
          therapist_user_id: string
          title: string
          updated_at: string
        }
        Insert: {
          attachments?: Json
          created_at?: string
          due_date?: string | null
          id?: string
          items?: Json
          patient_id: string
          portal_account_id?: string | null
          status?: string
          therapist_user_id: string
          title?: string
          updated_at?: string
        }
        Update: {
          attachments?: Json
          created_at?: string
          due_date?: string | null
          id?: string
          items?: Json
          patient_id?: string
          portal_account_id?: string | null
          status?: string
          therapist_user_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_activities_portal_account_id_fkey"
            columns: ["portal_account_id"]
            isOneToOne: false
            referencedRelation: "patient_portal_accounts"
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
          therapist_reviewed: boolean
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
          therapist_reviewed?: boolean
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
          therapist_reviewed?: boolean
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
          portal_account_id: string | null
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
          portal_account_id?: string | null
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
          portal_account_id?: string | null
          read_by_patient?: boolean
          read_by_therapist?: boolean
          sender_type?: string
          therapist_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_messages_portal_account_id_fkey"
            columns: ["portal_account_id"]
            isOneToOne: false
            referencedRelation: "patient_portal_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_notices: {
        Row: {
          content: string | null
          created_at: string
          id: string
          patient_id: string
          portal_account_id: string | null
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
          portal_account_id?: string | null
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
          portal_account_id?: string | null
          read_by_patient?: boolean
          therapist_user_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_notices_portal_account_id_fkey"
            columns: ["portal_account_id"]
            isOneToOne: false
            referencedRelation: "patient_portal_accounts"
            referencedColumns: ["id"]
          },
        ]
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
          patient_id: string | null
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
          patient_id?: string | null
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
          patient_id?: string | null
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
            foreignKeyName: "private_appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
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
      procedure_commissions: {
        Row: {
          commission_type: string
          commission_value: number
          created_at: string
          id: string
          member_id: string
          procedure_id: string
          updated_at: string
        }
        Insert: {
          commission_type?: string
          commission_value?: number
          created_at?: string
          id?: string
          member_id: string
          procedure_id: string
          updated_at?: string
        }
        Update: {
          commission_type?: string
          commission_value?: number
          created_at?: string
          id?: string
          member_id?: string
          procedure_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "procedure_commissions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedure_commissions_procedure_id_fkey"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "procedures"
            referencedColumns: ["id"]
          },
        ]
      }
      procedures: {
        Row: {
          allow_value_change: boolean
          apply_to_all_professionals: boolean
          clinic_id: string
          commission_type: string
          commission_value: number
          created_at: string
          health_plans: Json
          id: string
          name: string
          tuss_code: string | null
          updated_at: string
          user_id: string
          value: number
        }
        Insert: {
          allow_value_change?: boolean
          apply_to_all_professionals?: boolean
          clinic_id: string
          commission_type?: string
          commission_value?: number
          created_at?: string
          health_plans?: Json
          id?: string
          name: string
          tuss_code?: string | null
          updated_at?: string
          user_id: string
          value?: number
        }
        Update: {
          allow_value_change?: boolean
          apply_to_all_professionals?: boolean
          clinic_id?: string
          commission_type?: string
          commission_value?: number
          created_at?: string
          health_plans?: Json
          id?: string
          name?: string
          tuss_code?: string | null
          updated_at?: string
          user_id?: string
          value?: number
        }
        Relationships: []
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
      psico_anamnese: {
        Row: {
          created_at: string
          escolar: Json
          familiar: Json
          id: string
          patient_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          escolar?: Json
          familiar?: Json
          id?: string
          patient_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          escolar?: Json
          familiar?: Json
          id?: string
          patient_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      psico_avaliacao_tipos: {
        Row: {
          categoria: string | null
          created_at: string
          descricao: string | null
          id: string
          metricas_padrao: string[] | null
          nome: string
          therapist_id: string
          updated_at: string
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          metricas_padrao?: string[] | null
          nome: string
          therapist_id: string
          updated_at?: string
        }
        Update: {
          categoria?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          metricas_padrao?: string[] | null
          nome?: string
          therapist_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      psico_avaliacoes: {
        Row: {
          arquivo_nome: string | null
          arquivo_url: string | null
          atencao: number | null
          created_at: string
          data_avaliacao: string
          escrita: number | null
          id: string
          instrumento: string | null
          leitura: number | null
          linguagem: number | null
          matematica: number | null
          memoria: number | null
          metricas: Json | null
          observacoes: string | null
          patient_id: string
          status: string
          testes_aplicados: string[] | null
          therapist_id: string
          tipo: string
          titulo: string | null
          updated_at: string
        }
        Insert: {
          arquivo_nome?: string | null
          arquivo_url?: string | null
          atencao?: number | null
          created_at?: string
          data_avaliacao?: string
          escrita?: number | null
          id?: string
          instrumento?: string | null
          leitura?: number | null
          linguagem?: number | null
          matematica?: number | null
          memoria?: number | null
          metricas?: Json | null
          observacoes?: string | null
          patient_id: string
          status?: string
          testes_aplicados?: string[] | null
          therapist_id: string
          tipo: string
          titulo?: string | null
          updated_at?: string
        }
        Update: {
          arquivo_nome?: string | null
          arquivo_url?: string | null
          atencao?: number | null
          created_at?: string
          data_avaliacao?: string
          escrita?: number | null
          id?: string
          instrumento?: string | null
          leitura?: number | null
          linguagem?: number | null
          matematica?: number | null
          memoria?: number | null
          metricas?: Json | null
          observacoes?: string | null
          patient_id?: string
          status?: string
          testes_aplicados?: string[] | null
          therapist_id?: string
          tipo?: string
          titulo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "psico_avaliacoes_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      psico_evolucoes: {
        Row: {
          atividades: string[] | null
          created_at: string
          data_sessao: string
          descricao: string
          desempenho: string | null
          duracao_min: number | null
          humor: string | null
          id: string
          patient_id: string
          pdi_id: string | null
          tarefas_casa: string | null
          therapist_id: string
        }
        Insert: {
          atividades?: string[] | null
          created_at?: string
          data_sessao?: string
          descricao: string
          desempenho?: string | null
          duracao_min?: number | null
          humor?: string | null
          id?: string
          patient_id: string
          pdi_id?: string | null
          tarefas_casa?: string | null
          therapist_id: string
        }
        Update: {
          atividades?: string[] | null
          created_at?: string
          data_sessao?: string
          descricao?: string
          desempenho?: string | null
          duracao_min?: number | null
          humor?: string | null
          id?: string
          patient_id?: string
          pdi_id?: string | null
          tarefas_casa?: string | null
          therapist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "psico_evolucoes_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "psico_evolucoes_pdi_id_fkey"
            columns: ["pdi_id"]
            isOneToOne: false
            referencedRelation: "psico_pdi"
            referencedColumns: ["id"]
          },
        ]
      }
      psico_pdi: {
        Row: {
          avaliacao_id: string | null
          created_at: string
          id: string
          objetivos: Json
          observacoes: string | null
          patient_id: string
          periodo_fim: string | null
          periodo_inicio: string
          status: string
          therapist_id: string
          titulo: string
          updated_at: string
        }
        Insert: {
          avaliacao_id?: string | null
          created_at?: string
          id?: string
          objetivos?: Json
          observacoes?: string | null
          patient_id: string
          periodo_fim?: string | null
          periodo_inicio?: string
          status?: string
          therapist_id: string
          titulo: string
          updated_at?: string
        }
        Update: {
          avaliacao_id?: string | null
          created_at?: string
          id?: string
          objetivos?: Json
          observacoes?: string | null
          patient_id?: string
          periodo_fim?: string | null
          periodo_inicio?: string
          status?: string
          therapist_id?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "psico_pdi_avaliacao_id_fkey"
            columns: ["avaliacao_id"]
            isOneToOne: false
            referencedRelation: "psico_avaliacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "psico_pdi_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      psico_registros: {
        Row: {
          arquivo_nome: string | null
          arquivo_url: string | null
          codigo: string | null
          created_at: string
          data_registro: string
          descricao: string | null
          id: string
          patient_id: string
          therapist_id: string
          tipo: string
          updated_at: string
        }
        Insert: {
          arquivo_nome?: string | null
          arquivo_url?: string | null
          codigo?: string | null
          created_at?: string
          data_registro?: string
          descricao?: string | null
          id?: string
          patient_id: string
          therapist_id: string
          tipo: string
          updated_at?: string
        }
        Update: {
          arquivo_nome?: string | null
          arquivo_url?: string | null
          codigo?: string | null
          created_at?: string
          data_registro?: string
          descricao?: string | null
          id?: string
          patient_id?: string
          therapist_id?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      psico_relatorios: {
        Row: {
          conteudo: string
          created_at: string
          enviado_em: string | null
          id: string
          patient_id: string
          pdf_url: string | null
          therapist_id: string
          tipo: string
          titulo: string | null
        }
        Insert: {
          conteudo: string
          created_at?: string
          enviado_em?: string | null
          id?: string
          patient_id: string
          pdf_url?: string | null
          therapist_id: string
          tipo: string
          titulo?: string | null
        }
        Update: {
          conteudo?: string
          created_at?: string
          enviado_em?: string | null
          id?: string
          patient_id?: string
          pdf_url?: string | null
          therapist_id?: string
          tipo?: string
          titulo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "psico_relatorios_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      psico_reunioes: {
        Row: {
          created_at: string
          data_hora: string
          duracao_min: number | null
          id: string
          local_ou_link: string | null
          modalidade: string
          notas: string | null
          participantes: string[] | null
          patient_id: string
          pauta: string | null
          status: string
          therapist_id: string
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_hora: string
          duracao_min?: number | null
          id?: string
          local_ou_link?: string | null
          modalidade?: string
          notas?: string | null
          participantes?: string[] | null
          patient_id: string
          pauta?: string | null
          status?: string
          therapist_id: string
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_hora?: string
          duracao_min?: number | null
          id?: string
          local_ou_link?: string | null
          modalidade?: string
          notas?: string | null
          participantes?: string[] | null
          patient_id?: string
          pauta?: string | null
          status?: string
          therapist_id?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      psicom_anamnese: {
        Row: {
          created_at: string
          familiar: Json
          id: string
          motor: Json
          patient_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          familiar?: Json
          id?: string
          motor?: Json
          patient_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          familiar?: Json
          id?: string
          motor?: Json
          patient_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      psicom_avaliacao_tipos: {
        Row: {
          categoria: string | null
          created_at: string
          descricao: string | null
          id: string
          metricas_padrao: string[] | null
          nome: string
          therapist_id: string
          updated_at: string
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          metricas_padrao?: string[] | null
          nome: string
          therapist_id: string
          updated_at?: string
        }
        Update: {
          categoria?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          metricas_padrao?: string[] | null
          nome?: string
          therapist_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      psicom_avaliacoes: {
        Row: {
          arquivo_nome: string | null
          arquivo_url: string | null
          coord_fina: number | null
          coord_global: number | null
          created_at: string
          data_avaliacao: string
          equilibrio: number | null
          esquema_corporal: number | null
          id: string
          instrumento: string | null
          lateralidade: number | null
          metricas: Json | null
          observacoes: string | null
          org_espacial: number | null
          org_temporal: number | null
          patient_id: string
          status: string
          testes_aplicados: string[] | null
          therapist_id: string
          tipo: string
          titulo: string | null
          updated_at: string
        }
        Insert: {
          arquivo_nome?: string | null
          arquivo_url?: string | null
          coord_fina?: number | null
          coord_global?: number | null
          created_at?: string
          data_avaliacao?: string
          equilibrio?: number | null
          esquema_corporal?: number | null
          id?: string
          instrumento?: string | null
          lateralidade?: number | null
          metricas?: Json | null
          observacoes?: string | null
          org_espacial?: number | null
          org_temporal?: number | null
          patient_id: string
          status?: string
          testes_aplicados?: string[] | null
          therapist_id: string
          tipo: string
          titulo?: string | null
          updated_at?: string
        }
        Update: {
          arquivo_nome?: string | null
          arquivo_url?: string | null
          coord_fina?: number | null
          coord_global?: number | null
          created_at?: string
          data_avaliacao?: string
          equilibrio?: number | null
          esquema_corporal?: number | null
          id?: string
          instrumento?: string | null
          lateralidade?: number | null
          metricas?: Json | null
          observacoes?: string | null
          org_espacial?: number | null
          org_temporal?: number | null
          patient_id?: string
          status?: string
          testes_aplicados?: string[] | null
          therapist_id?: string
          tipo?: string
          titulo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "psicom_avaliacoes_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      psicom_pdi: {
        Row: {
          avaliacao_id: string | null
          created_at: string
          id: string
          objetivos: Json
          observacoes: string | null
          patient_id: string
          periodo_fim: string | null
          periodo_inicio: string
          status: string
          therapist_id: string
          titulo: string
          updated_at: string
        }
        Insert: {
          avaliacao_id?: string | null
          created_at?: string
          id?: string
          objetivos?: Json
          observacoes?: string | null
          patient_id: string
          periodo_fim?: string | null
          periodo_inicio?: string
          status?: string
          therapist_id: string
          titulo: string
          updated_at?: string
        }
        Update: {
          avaliacao_id?: string | null
          created_at?: string
          id?: string
          objetivos?: Json
          observacoes?: string | null
          patient_id?: string
          periodo_fim?: string | null
          periodo_inicio?: string
          status?: string
          therapist_id?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "psicom_pdi_avaliacao_id_fkey"
            columns: ["avaliacao_id"]
            isOneToOne: false
            referencedRelation: "psicom_avaliacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "psicom_pdi_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      psicom_registros: {
        Row: {
          arquivo_nome: string | null
          arquivo_url: string | null
          codigo: string | null
          created_at: string
          data_registro: string
          descricao: string | null
          id: string
          patient_id: string
          therapist_id: string
          tipo: string
          updated_at: string
        }
        Insert: {
          arquivo_nome?: string | null
          arquivo_url?: string | null
          codigo?: string | null
          created_at?: string
          data_registro?: string
          descricao?: string | null
          id?: string
          patient_id: string
          therapist_id: string
          tipo: string
          updated_at?: string
        }
        Update: {
          arquivo_nome?: string | null
          arquivo_url?: string | null
          codigo?: string | null
          created_at?: string
          data_registro?: string
          descricao?: string | null
          id?: string
          patient_id?: string
          therapist_id?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      psicom_relatorios: {
        Row: {
          conteudo: string
          created_at: string
          enviado_em: string | null
          id: string
          patient_id: string
          pdf_url: string | null
          therapist_id: string
          tipo: string
          titulo: string | null
        }
        Insert: {
          conteudo: string
          created_at?: string
          enviado_em?: string | null
          id?: string
          patient_id: string
          pdf_url?: string | null
          therapist_id: string
          tipo: string
          titulo?: string | null
        }
        Update: {
          conteudo?: string
          created_at?: string
          enviado_em?: string | null
          id?: string
          patient_id?: string
          pdf_url?: string | null
          therapist_id?: string
          tipo?: string
          titulo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "psicom_relatorios_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      psicom_reunioes: {
        Row: {
          created_at: string
          data_hora: string
          duracao_min: number | null
          id: string
          local_ou_link: string | null
          modalidade: string
          notas: string | null
          participantes: string[] | null
          patient_id: string
          pauta: string | null
          status: string
          therapist_id: string
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_hora: string
          duracao_min?: number | null
          id?: string
          local_ou_link?: string | null
          modalidade?: string
          notas?: string | null
          participantes?: string[] | null
          patient_id: string
          pauta?: string | null
          status?: string
          therapist_id: string
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_hora?: string
          duracao_min?: number | null
          id?: string
          local_ou_link?: string | null
          modalidade?: string
          notas?: string | null
          participantes?: string[] | null
          patient_id?: string
          pauta?: string | null
          status?: string
          therapist_id?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      psicomotor_milestone_tracking: {
        Row: {
          assessed_at: string | null
          created_at: string
          id: string
          milestone_key: string
          notes: string | null
          patient_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assessed_at?: string | null
          created_at?: string
          id?: string
          milestone_key: string
          notes?: string | null
          patient_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assessed_at?: string | null
          created_at?: string
          id?: string
          milestone_key?: string
          notes?: string | null
          patient_id?: string
          status?: string
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
      questionnaire_templates: {
        Row: {
          created_at: string
          description: string | null
          fields: Json
          id: string
          is_active: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          fields?: Json
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          fields?: Json
          id?: string
          is_active?: boolean
          name?: string
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
      session_plans: {
        Row: {
          activities: string | null
          clinic_id: string
          created_at: string
          external_links: Json | null
          id: string
          objectives: string | null
          patient_id: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activities?: string | null
          clinic_id: string
          created_at?: string
          external_links?: Json | null
          id?: string
          objectives?: string | null
          patient_id: string
          status?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          activities?: string | null
          clinic_id?: string
          created_at?: string
          external_links?: Json | null
          id?: string
          objectives?: string | null
          patient_id?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_plans_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_plans_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
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
          assigned_by_user_id: string | null
          assigned_to_user_id: string | null
          clinic_id: string | null
          completed: boolean
          created_at: string
          due_date: string | null
          group_id: string | null
          id: string
          notes: string | null
          patient_id: string | null
          priority: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_by_user_id?: string | null
          assigned_to_user_id?: string | null
          clinic_id?: string | null
          completed?: boolean
          created_at?: string
          due_date?: string | null
          group_id?: string | null
          id?: string
          notes?: string | null
          patient_id?: string | null
          priority?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_by_user_id?: string | null
          assigned_to_user_id?: string | null
          clinic_id?: string | null
          completed?: boolean
          created_at?: string
          due_date?: string | null
          group_id?: string | null
          id?: string
          notes?: string | null
          patient_id?: string | null
          priority?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "therapeutic_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      team_applications: {
        Row: {
          allow_email_campaigns: boolean
          allow_system_emails: boolean
          bank_account: string | null
          bank_agency: string | null
          bank_name: string | null
          birthdate: string | null
          cellphone: string | null
          cep: string | null
          city: string | null
          complement: string | null
          country: string | null
          cpf: string | null
          created_at: string
          district: string | null
          email: string
          id: string
          is_social_name: boolean
          marital_status: string | null
          message: string | null
          name: string
          number: string | null
          organization_id: string
          person_type: string
          phone_landline: string | null
          pix_key: string | null
          pix_type: string | null
          pref_email: boolean
          pref_sms: boolean
          pref_whatsapp: boolean
          profession: string | null
          professional_areas: Json
          professional_id: string | null
          reviewed_at: string | null
          reviewed_by_user_id: string | null
          rg: string | null
          role: string | null
          sex: string | null
          specialties: string[] | null
          specialty: string | null
          state: string | null
          status: string
          street: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          allow_email_campaigns?: boolean
          allow_system_emails?: boolean
          bank_account?: string | null
          bank_agency?: string | null
          bank_name?: string | null
          birthdate?: string | null
          cellphone?: string | null
          cep?: string | null
          city?: string | null
          complement?: string | null
          country?: string | null
          cpf?: string | null
          created_at?: string
          district?: string | null
          email: string
          id?: string
          is_social_name?: boolean
          marital_status?: string | null
          message?: string | null
          name: string
          number?: string | null
          organization_id: string
          person_type?: string
          phone_landline?: string | null
          pix_key?: string | null
          pix_type?: string | null
          pref_email?: boolean
          pref_sms?: boolean
          pref_whatsapp?: boolean
          profession?: string | null
          professional_areas?: Json
          professional_id?: string | null
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          rg?: string | null
          role?: string | null
          sex?: string | null
          specialties?: string[] | null
          specialty?: string | null
          state?: string | null
          status?: string
          street?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          allow_email_campaigns?: boolean
          allow_system_emails?: boolean
          bank_account?: string | null
          bank_agency?: string | null
          bank_name?: string | null
          birthdate?: string | null
          cellphone?: string | null
          cep?: string | null
          city?: string | null
          complement?: string | null
          country?: string | null
          cpf?: string | null
          created_at?: string
          district?: string | null
          email?: string
          id?: string
          is_social_name?: boolean
          marital_status?: string | null
          message?: string | null
          name?: string
          number?: string | null
          organization_id?: string
          person_type?: string
          phone_landline?: string | null
          pix_key?: string | null
          pix_type?: string | null
          pref_email?: boolean
          pref_sms?: boolean
          pref_whatsapp?: boolean
          profession?: string | null
          professional_areas?: Json
          professional_id?: string | null
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          rg?: string | null
          role?: string | null
          sex?: string | null
          specialties?: string[] | null
          specialty?: string | null
          state?: string | null
          status?: string
          street?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_applications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      team_commission_payments: {
        Row: {
          clinic_id: string
          created_at: string
          id: string
          individual_payments: Json
          member_id: string
          month: number
          notes: string | null
          organization_id: string
          paid_amount: number
          paid_at: string | null
          paid_by_user_id: string | null
          status: string
          total_due: number
          updated_at: string
          year: number
        }
        Insert: {
          clinic_id: string
          created_at?: string
          id?: string
          individual_payments?: Json
          member_id: string
          month: number
          notes?: string | null
          organization_id: string
          paid_amount?: number
          paid_at?: string | null
          paid_by_user_id?: string | null
          status?: string
          total_due?: number
          updated_at?: string
          year: number
        }
        Update: {
          clinic_id?: string
          created_at?: string
          id?: string
          individual_payments?: Json
          member_id?: string
          month?: number
          notes?: string | null
          organization_id?: string
          paid_amount?: number
          paid_at?: string | null
          paid_by_user_id?: string | null
          status?: string
          total_due?: number
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      therapeutic_group_members: {
        Row: {
          group_id: string
          id: string
          is_paying: boolean
          joined_at: string
          member_payment_value: number | null
          patient_id: string
          status: string
        }
        Insert: {
          group_id: string
          id?: string
          is_paying?: boolean
          joined_at?: string
          member_payment_value?: number | null
          patient_id: string
          status?: string
        }
        Update: {
          group_id?: string
          id?: string
          is_paying?: boolean
          joined_at?: string
          member_payment_value?: number | null
          patient_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "therapeutic_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "therapeutic_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      therapeutic_groups: {
        Row: {
          assessment_method: string | null
          clinic_id: string
          communication_patterns: string | null
          confidentiality_agreement: string | null
          conflict_areas: string | null
          created_at: string
          custom_sections: Json | null
          default_price: number | null
          description: string | null
          duration_minutes: number | null
          entry_criteria: string | null
          exclusion_criteria: string | null
          facilitation_notes: string | null
          facilitation_style: string | null
          financial_enabled: boolean
          follow_up_plan: string | null
          general_notes: string | null
          group_rules: string | null
          id: string
          is_archived: boolean
          materials: string | null
          max_participants: number | null
          meeting_format: string | null
          meeting_frequency: string | null
          name: string
          next_topics: string | null
          objectives: string | null
          open_to_new: boolean
          package_id: string | null
          payment_type: string | null
          session_link: string | null
          shared_goals: string | null
          supervision_notes: string | null
          support_reason: string | null
          support_resources: string | null
          therapeutic_focus: string | null
          updated_at: string
          user_id: string
          waitlist_policy: string | null
        }
        Insert: {
          assessment_method?: string | null
          clinic_id: string
          communication_patterns?: string | null
          confidentiality_agreement?: string | null
          conflict_areas?: string | null
          created_at?: string
          custom_sections?: Json | null
          default_price?: number | null
          description?: string | null
          duration_minutes?: number | null
          entry_criteria?: string | null
          exclusion_criteria?: string | null
          facilitation_notes?: string | null
          facilitation_style?: string | null
          financial_enabled?: boolean
          follow_up_plan?: string | null
          general_notes?: string | null
          group_rules?: string | null
          id?: string
          is_archived?: boolean
          materials?: string | null
          max_participants?: number | null
          meeting_format?: string | null
          meeting_frequency?: string | null
          name: string
          next_topics?: string | null
          objectives?: string | null
          open_to_new?: boolean
          package_id?: string | null
          payment_type?: string | null
          session_link?: string | null
          shared_goals?: string | null
          supervision_notes?: string | null
          support_reason?: string | null
          support_resources?: string | null
          therapeutic_focus?: string | null
          updated_at?: string
          user_id: string
          waitlist_policy?: string | null
        }
        Update: {
          assessment_method?: string | null
          clinic_id?: string
          communication_patterns?: string | null
          confidentiality_agreement?: string | null
          conflict_areas?: string | null
          created_at?: string
          custom_sections?: Json | null
          default_price?: number | null
          description?: string | null
          duration_minutes?: number | null
          entry_criteria?: string | null
          exclusion_criteria?: string | null
          facilitation_notes?: string | null
          facilitation_style?: string | null
          financial_enabled?: boolean
          follow_up_plan?: string | null
          general_notes?: string | null
          group_rules?: string | null
          id?: string
          is_archived?: boolean
          materials?: string | null
          max_participants?: number | null
          meeting_format?: string | null
          meeting_frequency?: string | null
          name?: string
          next_topics?: string | null
          objectives?: string | null
          open_to_new?: boolean
          package_id?: string | null
          payment_type?: string | null
          session_link?: string | null
          shared_goals?: string | null
          supervision_notes?: string | null
          support_reason?: string | null
          support_resources?: string | null
          therapeutic_focus?: string | null
          updated_at?: string
          user_id?: string
          waitlist_policy?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "therapeutic_groups_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapeutic_groups_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "clinic_packages"
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
          remuneration_plan_id: string | null
          schedule_time: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_id: string
          organization_id: string
          patient_id: string
          remuneration_plan_id?: string | null
          schedule_time?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          member_id?: string
          organization_id?: string
          patient_id?: string
          remuneration_plan_id?: string | null
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
          {
            foreignKeyName: "therapist_patient_assignments_remuneration_plan_id_fkey"
            columns: ["remuneration_plan_id"]
            isOneToOne: false
            referencedRelation: "member_remuneration_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      therapy_sessions: {
        Row: {
          action_plans: string
          ai_evolution: string | null
          ai_individual_evolutions: Json | null
          clinic_id: string
          created_at: string
          duration_seconds: number
          finished_at: string | null
          general_comments: string
          group_id: string | null
          id: string
          mood_score: number | null
          negative_feelings: string[]
          next_session_notes: string
          notes_text: string
          participants_data: Json | null
          patient_id: string
          payment_pending: boolean
          plan_id: string | null
          positive_feelings: string[]
          price: number
          started_at: string | null
          status: string
          suicidal_thoughts: boolean
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_plans?: string
          ai_evolution?: string | null
          ai_individual_evolutions?: Json | null
          clinic_id: string
          created_at?: string
          duration_seconds?: number
          finished_at?: string | null
          general_comments?: string
          group_id?: string | null
          id?: string
          mood_score?: number | null
          negative_feelings?: string[]
          next_session_notes?: string
          notes_text?: string
          participants_data?: Json | null
          patient_id: string
          payment_pending?: boolean
          plan_id?: string | null
          positive_feelings?: string[]
          price?: number
          started_at?: string | null
          status?: string
          suicidal_thoughts?: boolean
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_plans?: string
          ai_evolution?: string | null
          ai_individual_evolutions?: Json | null
          clinic_id?: string
          created_at?: string
          duration_seconds?: number
          finished_at?: string | null
          general_comments?: string
          group_id?: string | null
          id?: string
          mood_score?: number | null
          negative_feelings?: string[]
          next_session_notes?: string
          notes_text?: string
          participants_data?: Json | null
          patient_id?: string
          payment_pending?: boolean
          plan_id?: string | null
          positive_feelings?: string[]
          price?: number
          started_at?: string | null
          status?: string
          suicidal_thoughts?: boolean
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "therapy_sessions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_sessions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "therapeutic_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_sessions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_sessions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "session_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      video_recordings: {
        Row: {
          created_at: string
          daily_recording_id: string | null
          duration_seconds: number | null
          error_message: string | null
          file_size_bytes: number | null
          id: string
          status: string
          updated_at: string
          video_session_id: string
        }
        Insert: {
          created_at?: string
          daily_recording_id?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          file_size_bytes?: number | null
          id?: string
          status?: string
          updated_at?: string
          video_session_id: string
        }
        Update: {
          created_at?: string
          daily_recording_id?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          file_size_bytes?: number | null
          id?: string
          status?: string
          updated_at?: string
          video_session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_recordings_video_session_id_fkey"
            columns: ["video_session_id"]
            isOneToOne: false
            referencedRelation: "video_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      video_sessions: {
        Row: {
          appointment_id: string | null
          clinic_id: string | null
          created_at: string
          daily_room_name: string
          daily_room_url: string
          duration_seconds: number | null
          ended_at: string | null
          estimated_cost_cents: number | null
          id: string
          link_sent_at: string | null
          link_sent_channel: string | null
          max_participants: number | null
          notes: string | null
          patient_access_token: string
          patient_consented_at: string | null
          patient_id: string
          recording_enabled: boolean
          recording_layout: string
          room_expires_at: string | null
          scheduled_for: string | null
          started_at: string | null
          status: string
          therapist_user_id: string
          therapy_session_id: string | null
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          clinic_id?: string | null
          created_at?: string
          daily_room_name: string
          daily_room_url: string
          duration_seconds?: number | null
          ended_at?: string | null
          estimated_cost_cents?: number | null
          id?: string
          link_sent_at?: string | null
          link_sent_channel?: string | null
          max_participants?: number | null
          notes?: string | null
          patient_access_token: string
          patient_consented_at?: string | null
          patient_id: string
          recording_enabled?: boolean
          recording_layout?: string
          room_expires_at?: string | null
          scheduled_for?: string | null
          started_at?: string | null
          status?: string
          therapist_user_id: string
          therapy_session_id?: string | null
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          clinic_id?: string | null
          created_at?: string
          daily_room_name?: string
          daily_room_url?: string
          duration_seconds?: number | null
          ended_at?: string | null
          estimated_cost_cents?: number | null
          id?: string
          link_sent_at?: string | null
          link_sent_channel?: string | null
          max_participants?: number | null
          notes?: string | null
          patient_access_token?: string
          patient_consented_at?: string | null
          patient_id?: string
          recording_enabled?: boolean
          recording_layout?: string
          room_expires_at?: string | null
          scheduled_for?: string | null
          started_at?: string | null
          status?: string
          therapist_user_id?: string
          therapy_session_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_sessions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_sessions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_sessions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_sessions_therapy_session_id_fkey"
            columns: ["therapy_session_id"]
            isOneToOne: false
            referencedRelation: "therapy_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      video_transcriptions: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          language: string | null
          provider: string | null
          recording_id: string
          speakers_json: Json | null
          status: string
          text: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          language?: string | null
          provider?: string | null
          recording_id: string
          speakers_json?: Json | null
          status?: string
          text?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          language?: string | null
          provider?: string | null
          recording_id?: string
          speakers_json?: Json | null
          status?: string
          text?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_transcriptions_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "video_recordings"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist_entries: {
        Row: {
          address: string | null
          birthdate: string | null
          clinic_id: string
          created_at: string
          email: string | null
          first_name: string
          gender: string | null
          id: string
          last_name: string | null
          notes: string | null
          phone: string | null
          preferred_days: string[] | null
          preferred_time: string | null
          reason: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          birthdate?: string | null
          clinic_id: string
          created_at?: string
          email?: string | null
          first_name: string
          gender?: string | null
          id?: string
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          preferred_days?: string[] | null
          preferred_time?: string | null
          reason?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          birthdate?: string | null
          clinic_id?: string
          created_at?: string
          email?: string | null
          first_name?: string
          gender?: string | null
          id?: string
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          preferred_days?: string[] | null
          preferred_time?: string | null
          reason?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_entries_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      video_usage_monthly: {
        Row: {
          clinic_id: string | null
          month: string | null
          sessions_count: number | null
          therapist_user_id: string | null
          total_cost_cents: number | null
          total_minutes: number | null
          total_seconds: number | null
        }
        Relationships: [
          {
            foreignKeyName: "video_sessions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      get_clinic_for_enrollment: {
        Args: { _clinic_id: string }
        Returns: {
          address: string
          id: string
          name: string
        }[]
      }
      get_organization_for_application: {
        Args: { _org_id: string }
        Returns: {
          applications_link_enabled: boolean
          id: string
          name: string
        }[]
      }
      get_patient_by_intake_token: {
        Args: { _token: string }
        Returns: {
          id: string
          name: string
          status: string
        }[]
      }
      get_patient_monthly_revenue: {
        Args: { _month: number; _patient_id: string; _year: number }
        Returns: number
      }
      get_user_org_role: {
        Args: { _org_id: string; _user_id: string }
        Returns: string
      }
      get_video_session_for_patient: {
        Args: { _token: string }
        Returns: {
          daily_room_name: string
          daily_room_url: string
          id: string
          patient_consented_at: string
          patient_name: string
          recording_enabled: boolean
          status: string
          therapist_name: string
        }[]
      }
      has_module_access: { Args: { _module_id: string }; Returns: boolean }
      is_app_owner: { Args: { _user_id: string }; Returns: boolean }
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
      is_portal_account_owner: {
        Args: { _account_id: string; _user_id: string }
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
      record_video_consent: { Args: { _token: string }; Returns: boolean }
      submit_patient_intake: {
        Args: { _data: Json; _token: string }
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
