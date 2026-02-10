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
      clinic_packages: {
        Row: {
          clinic_id: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          price: number
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
          price?: number
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
          price?: number
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
      clinics: {
        Row: {
          absence_payment_type: string | null
          address: string | null
          created_at: string
          id: string
          is_archived: boolean | null
          letterhead: string | null
          name: string
          notes: string | null
          payment_amount: number | null
          payment_type: string | null
          pays_on_absence: boolean
          schedule_by_day: Json | null
          schedule_time: string | null
          stamp: string | null
          type: string
          updated_at: string
          user_id: string
          weekdays: string[] | null
        }
        Insert: {
          absence_payment_type?: string | null
          address?: string | null
          created_at?: string
          id?: string
          is_archived?: boolean | null
          letterhead?: string | null
          name: string
          notes?: string | null
          payment_amount?: number | null
          payment_type?: string | null
          pays_on_absence?: boolean
          schedule_by_day?: Json | null
          schedule_time?: string | null
          stamp?: string | null
          type?: string
          updated_at?: string
          user_id: string
          weekdays?: string[] | null
        }
        Update: {
          absence_payment_type?: string | null
          address?: string | null
          created_at?: string
          id?: string
          is_archived?: boolean | null
          letterhead?: string | null
          name?: string
          notes?: string | null
          payment_amount?: number | null
          payment_type?: string | null
          pays_on_absence?: boolean
          schedule_by_day?: Json | null
          schedule_time?: string | null
          stamp?: string | null
          type?: string
          updated_at?: string
          user_id?: string
          weekdays?: string[] | null
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
          signature: string | null
          stamp_id: string | null
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
          signature?: string | null
          stamp_id?: string | null
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
          signature?: string | null
          stamp_id?: string | null
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
        ]
      }
      patients: {
        Row: {
          birthdate: string
          clinic_id: string
          clinical_area: string | null
          contract_start_date: string | null
          created_at: string
          diagnosis: string | null
          id: string
          name: string
          observations: string | null
          package_id: string | null
          payment_type: string | null
          payment_value: number | null
          phone: string | null
          professionals: string | null
          responsible_email: string | null
          responsible_name: string | null
          schedule_by_day: Json | null
          schedule_time: string | null
          updated_at: string
          user_id: string
          weekdays: string[] | null
        }
        Insert: {
          birthdate: string
          clinic_id: string
          clinical_area?: string | null
          contract_start_date?: string | null
          created_at?: string
          diagnosis?: string | null
          id?: string
          name: string
          observations?: string | null
          package_id?: string | null
          payment_type?: string | null
          payment_value?: number | null
          phone?: string | null
          professionals?: string | null
          responsible_email?: string | null
          responsible_name?: string | null
          schedule_by_day?: Json | null
          schedule_time?: string | null
          updated_at?: string
          user_id: string
          weekdays?: string[] | null
        }
        Update: {
          birthdate?: string
          clinic_id?: string
          clinical_area?: string | null
          contract_start_date?: string | null
          created_at?: string
          diagnosis?: string | null
          id?: string
          name?: string
          observations?: string | null
          package_id?: string | null
          payment_type?: string | null
          payment_value?: number | null
          phone?: string | null
          professionals?: string | null
          responsible_email?: string | null
          responsible_name?: string | null
          schedule_by_day?: Json | null
          schedule_time?: string | null
          updated_at?: string
          user_id?: string
          weekdays?: string[] | null
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
      private_appointments: {
        Row: {
          client_email: string | null
          client_name: string
          client_phone: string | null
          created_at: string
          date: string
          id: string
          notes: string | null
          paid: boolean | null
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
          created_at?: string
          date: string
          id?: string
          notes?: string | null
          paid?: boolean | null
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
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          paid?: boolean | null
          price?: number
          service_id?: string | null
          status?: string
          time?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
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
          created_at: string
          email: string | null
          id: string
          name: string | null
          phone: string | null
          professional_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          phone?: string | null
          professional_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          phone?: string | null
          professional_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      tasks: {
        Row: {
          completed: boolean
          created_at: string
          id: string
          patient_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          id?: string
          patient_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          id?: string
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
