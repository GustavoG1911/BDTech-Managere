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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      calendar_events: {
        Row: {
          created_at: string | null
          event_date: string
          id: string
          is_sandbox: boolean | null
          meeting_link: string | null
          operation: string | null
          status: string | null
          title: string
        }
        Insert: {
          created_at?: string | null
          event_date: string
          id?: string
          is_sandbox?: boolean | null
          meeting_link?: string | null
          operation?: string | null
          status?: string | null
          title: string
        }
        Update: {
          created_at?: string | null
          event_date?: string
          id?: string
          is_sandbox?: boolean | null
          meeting_link?: string | null
          operation?: string | null
          status?: string | null
          title?: string
        }
        Relationships: []
      }
      deals: {
        Row: {
          actual_payment_date: string | null
          client_name: string
          client_payment_date: string | null
          closing_date: string
          commission_amount_snapshot: number | null
          commission_rate_snapshot: number | null
          created_at: string
          expected_commission_date: string | null
          expected_payment_date: string | null
          first_payment_date: string | null
          id: string
          implantacao_payment_date: string | null
          implantation_payment_date: string | null
          implantation_value: number
          installment_count: number
          installment_dates: Json | null
          is_commission_liberated: boolean | null
          is_commission_received_by_company: boolean | null
          is_implantacao_paid: boolean | null
          is_implantacao_paid_by_client: boolean | null
          is_installment: boolean
          is_mensalidade_paid: boolean | null
          is_mensalidade_paid_by_client: boolean | null
          is_paid_by_client: boolean | null
          is_paid_to_user: boolean | null
          is_test_data: boolean | null
          is_user_confirmed_payment: boolean | null
          mensalidade_payment_date: string | null
          monthly_value: number
          operation: string
          payment_status: string
          updated_at: string
          user_confirmed_receipt: boolean | null
          user_id: string | null
        }
        Insert: {
          actual_payment_date?: string | null
          client_name: string
          client_payment_date?: string | null
          closing_date?: string
          commission_amount_snapshot?: number | null
          commission_rate_snapshot?: number | null
          created_at?: string
          expected_commission_date?: string | null
          expected_payment_date?: string | null
          first_payment_date?: string | null
          id?: string
          implantacao_payment_date?: string | null
          implantation_payment_date?: string | null
          implantation_value?: number
          installment_count?: number
          installment_dates?: Json | null
          is_commission_liberated?: boolean | null
          is_commission_received_by_company?: boolean | null
          is_implantacao_paid?: boolean | null
          is_implantacao_paid_by_client?: boolean | null
          is_installment?: boolean
          is_mensalidade_paid?: boolean | null
          is_mensalidade_paid_by_client?: boolean | null
          is_paid_by_client?: boolean | null
          is_paid_to_user?: boolean | null
          is_test_data?: boolean | null
          is_user_confirmed_payment?: boolean | null
          mensalidade_payment_date?: string | null
          monthly_value?: number
          operation?: string
          payment_status?: string
          updated_at?: string
          user_confirmed_receipt?: boolean | null
          user_id?: string | null
        }
        Update: {
          actual_payment_date?: string | null
          client_name?: string
          client_payment_date?: string | null
          closing_date?: string
          commission_amount_snapshot?: number | null
          commission_rate_snapshot?: number | null
          created_at?: string
          expected_commission_date?: string | null
          expected_payment_date?: string | null
          first_payment_date?: string | null
          id?: string
          implantacao_payment_date?: string | null
          implantation_payment_date?: string | null
          implantation_value?: number
          installment_count?: number
          installment_dates?: Json | null
          is_commission_liberated?: boolean | null
          is_commission_received_by_company?: boolean | null
          is_implantacao_paid?: boolean | null
          is_implantacao_paid_by_client?: boolean | null
          is_installment?: boolean
          is_mensalidade_paid?: boolean | null
          is_mensalidade_paid_by_client?: boolean | null
          is_paid_by_client?: boolean | null
          is_paid_to_user?: boolean | null
          is_test_data?: boolean | null
          is_user_confirmed_payment?: boolean | null
          mensalidade_payment_date?: string | null
          monthly_value?: number
          operation?: string
          payment_status?: string
          updated_at?: string
          user_confirmed_receipt?: boolean | null
          user_id?: string | null
        }
        Relationships: []
      }
      global_parameters: {
        Row: {
          acelerador_piso: number | null
          acelerador_teto: number | null
          base_implantacao: number | null
          id: string
          meta_apresentacoes_bluepex: number | null
          meta_apresentacoes_opus: number | null
          super_meta_bluepex: number | null
          super_meta_opus: number | null
          updated_at: string | null
        }
        Insert: {
          acelerador_piso?: number | null
          acelerador_teto?: number | null
          base_implantacao?: number | null
          id?: string
          meta_apresentacoes_bluepex?: number | null
          meta_apresentacoes_opus?: number | null
          super_meta_bluepex?: number | null
          super_meta_opus?: number | null
          updated_at?: string | null
        }
        Update: {
          acelerador_piso?: number | null
          acelerador_teto?: number | null
          base_implantacao?: number | null
          id?: string
          meta_apresentacoes_bluepex?: number | null
          meta_apresentacoes_opus?: number | null
          super_meta_bluepex?: number | null
          super_meta_opus?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      kanban_columns: {
        Row: {
          created_at: string | null
          id: string
          position: number
          title: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          position: number
          title: string
        }
        Update: {
          created_at?: string | null
          id?: string
          position?: number
          title?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          column_id: string | null
          company_name: string
          contact_name: string | null
          created_at: string | null
          id: string
          is_sandbox: boolean | null
          notes: string | null
          sdr_id: string | null
          updated_at: string | null
        }
        Insert: {
          column_id?: string | null
          company_name: string
          contact_name?: string | null
          created_at?: string | null
          id?: string
          is_sandbox?: boolean | null
          notes?: string | null
          sdr_id?: string | null
          updated_at?: string | null
        }
        Update: {
          column_id?: string | null
          company_name?: string
          contact_name?: string | null
          created_at?: string | null
          id?: string
          is_sandbox?: boolean | null
          notes?: string | null
          sdr_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "kanban_columns"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          deal_id: string | null
          id: string
          is_read: boolean | null
          is_test_data: boolean
          message: string
          title: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          deal_id?: string | null
          id?: string
          is_read?: boolean | null
          is_test_data?: boolean
          message: string
          title: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          deal_id?: string | null
          id?: string
          is_read?: boolean | null
          is_test_data?: boolean
          message?: string
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      presentations: {
        Row: {
          count: number | null
          date: string | null
          id: string
          is_test_data: boolean | null
          operation: string
          user_id: string | null
        }
        Insert: {
          count?: number | null
          date?: string | null
          id?: string
          is_test_data?: boolean | null
          operation: string
          user_id?: string | null
        }
        Update: {
          count?: number | null
          date?: string | null
          id?: string
          is_test_data?: boolean | null
          operation?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          commission_percent: number | null
          created_at: string
          display_name: string | null
          fixed_salary: number | null
          full_name: string | null
          id: string
          is_sandbox: boolean | null
          is_test_data: boolean | null
          job_title: string | null
          position: string | null
          role: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          commission_percent?: number | null
          created_at?: string
          display_name?: string | null
          fixed_salary?: number | null
          full_name?: string | null
          id?: string
          is_sandbox?: boolean | null
          is_test_data?: boolean | null
          job_title?: string | null
          position?: string | null
          role?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          commission_percent?: number | null
          created_at?: string
          display_name?: string | null
          fixed_salary?: number | null
          full_name?: string | null
          id?: string
          is_sandbox?: boolean | null
          is_test_data?: boolean | null
          job_title?: string | null
          position?: string | null
          role?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      salary_payments: {
        Row: {
          amount: number
          created_at: string | null
          expected_payment_date: string
          id: string
          is_paid_by_gestor: boolean | null
          payment_date: string | null
          reference_month: string
          user_confirmed_receipt: boolean | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          expected_payment_date: string
          id?: string
          is_paid_by_gestor?: boolean | null
          payment_date?: string | null
          reference_month: string
          user_confirmed_receipt?: boolean | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          expected_payment_date?: string
          id?: string
          is_paid_by_gestor?: boolean | null
          payment_date?: string | null
          reference_month?: string
          user_confirmed_receipt?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_commission_date: {
        Args: { payment_date: string }
        Returns: string
      }
      get_user_role: { Args: { user_id_param: string }; Returns: string }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_gestor: { Args: { _user_id: string }; Returns: boolean }
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
