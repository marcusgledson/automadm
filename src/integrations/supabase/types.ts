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
      app_settings: {
        Row: {
          created_at: string
          enabled_modules: string[]
          id: string
          logo_url: string | null
          onboarding_done: boolean
          org_name: string | null
          owner_id: string
          palette: string
          theme_style: string
          updated_at: string
          usage_mode: Database["public"]["Enums"]["app_usage_mode"]
        }
        Insert: {
          created_at?: string
          enabled_modules?: string[]
          id?: string
          logo_url?: string | null
          onboarding_done?: boolean
          org_name?: string | null
          owner_id: string
          palette?: string
          theme_style?: string
          updated_at?: string
          usage_mode?: Database["public"]["Enums"]["app_usage_mode"]
        }
        Update: {
          created_at?: string
          enabled_modules?: string[]
          id?: string
          logo_url?: string | null
          onboarding_done?: boolean
          org_name?: string | null
          owner_id?: string
          palette?: string
          theme_style?: string
          updated_at?: string
          usage_mode?: Database["public"]["Enums"]["app_usage_mode"]
        }
        Relationships: []
      }
      bank_statements: {
        Row: {
          agencia: string
          banco: string | null
          categoria: string | null
          codigo_operacao: string | null
          conta: string
          created_at: string
          data: string | null
          data_raw: string | null
          descricao: string | null
          documento: string | null
          file_name: string | null
          fitid: string
          id: string
          lancamento: string | null
          raw: Json
          tipo: string | null
          tipo_lancamento: string | null
          updated_at: string
          user_id: string
          valor: number
        }
        Insert: {
          agencia?: string
          banco?: string | null
          categoria?: string | null
          codigo_operacao?: string | null
          conta?: string
          created_at?: string
          data?: string | null
          data_raw?: string | null
          descricao?: string | null
          documento?: string | null
          file_name?: string | null
          fitid: string
          id?: string
          lancamento?: string | null
          raw?: Json
          tipo?: string | null
          tipo_lancamento?: string | null
          updated_at?: string
          user_id: string
          valor?: number
        }
        Update: {
          agencia?: string
          banco?: string | null
          categoria?: string | null
          codigo_operacao?: string | null
          conta?: string
          created_at?: string
          data?: string | null
          data_raw?: string | null
          descricao?: string | null
          documento?: string | null
          file_name?: string | null
          fitid?: string
          id?: string
          lancamento?: string | null
          raw?: Json
          tipo?: string | null
          tipo_lancamento?: string | null
          updated_at?: string
          user_id?: string
          valor?: number
        }
        Relationships: []
      }
      budget_goals: {
        Row: {
          alerta_percentual: number
          created_at: string
          escopo: string
          id: string
          meta_economia: number
          notificar: boolean
          observacoes: string | null
          prazo: string | null
          referencia: string | null
          status: Database["public"]["Enums"]["goal_status"]
          titulo: string
          updated_at: string
          user_id: string
          valor_orcado: number
        }
        Insert: {
          alerta_percentual?: number
          created_at?: string
          escopo?: string
          id?: string
          meta_economia?: number
          notificar?: boolean
          observacoes?: string | null
          prazo?: string | null
          referencia?: string | null
          status?: Database["public"]["Enums"]["goal_status"]
          titulo: string
          updated_at?: string
          user_id: string
          valor_orcado?: number
        }
        Update: {
          alerta_percentual?: number
          created_at?: string
          escopo?: string
          id?: string
          meta_economia?: number
          notificar?: boolean
          observacoes?: string | null
          prazo?: string | null
          referencia?: string | null
          status?: Database["public"]["Enums"]["goal_status"]
          titulo?: string
          updated_at?: string
          user_id?: string
          valor_orcado?: number
        }
        Relationships: []
      }
      consumption_bills: {
        Row: {
          codigo_instalacao: string
          consumo: number | null
          cpf_cnpj: string | null
          created_at: string
          data_vencimento: string
          endereco: string | null
          file_name: string | null
          fornecedor: string | null
          historico: Json | null
          id: string
          impostos: Json | null
          itens: Json | null
          mes_referencia: string | null
          raw_data: Json | null
          source: Database["public"]["Enums"]["bill_source"]
          tipo_conta: Database["public"]["Enums"]["bill_type"]
          titular: string | null
          unidade_consumo: string | null
          updated_at: string
          user_id: string
          valor_total: number | null
        }
        Insert: {
          codigo_instalacao: string
          consumo?: number | null
          cpf_cnpj?: string | null
          created_at?: string
          data_vencimento: string
          endereco?: string | null
          file_name?: string | null
          fornecedor?: string | null
          historico?: Json | null
          id?: string
          impostos?: Json | null
          itens?: Json | null
          mes_referencia?: string | null
          raw_data?: Json | null
          source?: Database["public"]["Enums"]["bill_source"]
          tipo_conta?: Database["public"]["Enums"]["bill_type"]
          titular?: string | null
          unidade_consumo?: string | null
          updated_at?: string
          user_id: string
          valor_total?: number | null
        }
        Update: {
          codigo_instalacao?: string
          consumo?: number | null
          cpf_cnpj?: string | null
          created_at?: string
          data_vencimento?: string
          endereco?: string | null
          file_name?: string | null
          fornecedor?: string | null
          historico?: Json | null
          id?: string
          impostos?: Json | null
          itens?: Json | null
          mes_referencia?: string | null
          raw_data?: Json | null
          source?: Database["public"]["Enums"]["bill_source"]
          tipo_conta?: Database["public"]["Enums"]["bill_type"]
          titular?: string | null
          unidade_consumo?: string | null
          updated_at?: string
          user_id?: string
          valor_total?: number | null
        }
        Relationships: []
      }
      corporate_requests: {
        Row: {
          created_at: string
          demanda: string
          dev_notificado: boolean
          email: string
          empresa: string | null
          id: string
          modulos_desejados: string[]
          nome_solicitante: string
          phone_area_code: string | null
          phone_country_code: string | null
          phone_is_whatsapp: boolean
          phone_number: string | null
          status: Database["public"]["Enums"]["request_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          demanda: string
          dev_notificado?: boolean
          email: string
          empresa?: string | null
          id?: string
          modulos_desejados?: string[]
          nome_solicitante: string
          phone_area_code?: string | null
          phone_country_code?: string | null
          phone_is_whatsapp?: boolean
          phone_number?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          demanda?: string
          dev_notificado?: boolean
          email?: string
          empresa?: string | null
          id?: string
          modulos_desejados?: string[]
          nome_solicitante?: string
          phone_area_code?: string | null
          phone_country_code?: string | null
          phone_is_whatsapp?: boolean
          phone_number?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      drive_links: {
        Row: {
          created_at: string
          id: string
          label: string | null
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          categoria: string | null
          created_at: string
          data_pagamento: string | null
          data_vencimento: string | null
          detalhes: string | null
          id: string
          numero_documento: string | null
          origem: string
          raw: Json
          source_ref: string | null
          tipo_lancamento: string
          updated_at: string
          user_id: string
          valor: number
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          detalhes?: string | null
          id?: string
          numero_documento?: string | null
          origem?: string
          raw?: Json
          source_ref?: string | null
          tipo_lancamento?: string
          updated_at?: string
          user_id: string
          valor?: number
        }
        Update: {
          categoria?: string | null
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          detalhes?: string | null
          id?: string
          numero_documento?: string | null
          origem?: string
          raw?: Json
          source_ref?: string | null
          tipo_lancamento?: string
          updated_at?: string
          user_id?: string
          valor?: number
        }
        Relationships: []
      }
      investments: {
        Row: {
          ativo: string
          created_at: string
          data_aplicacao: string
          data_carencia: string | null
          data_vencimento: string | null
          explicacao: Json
          file_name: string | null
          id: string
          indexador: string | null
          instituicao: string
          iof: number | null
          ir: number | null
          liquidez: string | null
          observacoes: string | null
          percentual_indexador: number | null
          preco_unitario: number | null
          quantidade: number | null
          raw: Json
          rendimento: number | null
          rentabilidade_periodo: number | null
          source: Database["public"]["Enums"]["investment_source"]
          taxa_contratada: string | null
          tipo_investimento: string
          updated_at: string
          user_id: string
          valor_aplicado: number | null
          valor_bruto: number | null
          valor_liquido: number | null
        }
        Insert: {
          ativo: string
          created_at?: string
          data_aplicacao: string
          data_carencia?: string | null
          data_vencimento?: string | null
          explicacao?: Json
          file_name?: string | null
          id?: string
          indexador?: string | null
          instituicao?: string
          iof?: number | null
          ir?: number | null
          liquidez?: string | null
          observacoes?: string | null
          percentual_indexador?: number | null
          preco_unitario?: number | null
          quantidade?: number | null
          raw?: Json
          rendimento?: number | null
          rentabilidade_periodo?: number | null
          source?: Database["public"]["Enums"]["investment_source"]
          taxa_contratada?: string | null
          tipo_investimento?: string
          updated_at?: string
          user_id: string
          valor_aplicado?: number | null
          valor_bruto?: number | null
          valor_liquido?: number | null
        }
        Update: {
          ativo?: string
          created_at?: string
          data_aplicacao?: string
          data_carencia?: string | null
          data_vencimento?: string | null
          explicacao?: Json
          file_name?: string | null
          id?: string
          indexador?: string | null
          instituicao?: string
          iof?: number | null
          ir?: number | null
          liquidez?: string | null
          observacoes?: string | null
          percentual_indexador?: number | null
          preco_unitario?: number | null
          quantidade?: number | null
          raw?: Json
          rendimento?: number | null
          rentabilidade_periodo?: number | null
          source?: Database["public"]["Enums"]["investment_source"]
          taxa_contratada?: string | null
          tipo_investimento?: string
          updated_at?: string
          user_id?: string
          valor_aplicado?: number | null
          valor_bruto?: number | null
          valor_liquido?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          allowed_modules: string[]
          avatar_url: string | null
          created_at: string
          display_name: string | null
          full_name: string | null
          gender: Database["public"]["Enums"]["user_gender"] | null
          id: string
          must_change_password: boolean
          org_owner_id: string | null
          phone_area_code: string | null
          phone_country_code: string | null
          phone_is_whatsapp: boolean
          phone_number: string | null
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          allowed_modules?: string[]
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          full_name?: string | null
          gender?: Database["public"]["Enums"]["user_gender"] | null
          id?: string
          must_change_password?: boolean
          org_owner_id?: string | null
          phone_area_code?: string | null
          phone_country_code?: string | null
          phone_is_whatsapp?: boolean
          phone_number?: string | null
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          allowed_modules?: string[]
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          full_name?: string | null
          gender?: Database["public"]["Enums"]["user_gender"] | null
          id?: string
          must_change_password?: boolean
          org_owner_id?: string | null
          phone_area_code?: string | null
          phone_country_code?: string | null
          phone_is_whatsapp?: boolean
          phone_number?: string | null
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      report_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          formato: string
          id: string
          justificativa: string | null
          modulo: string
          org_owner_id: string
          requester_id: string
          status: Database["public"]["Enums"]["request_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          formato?: string
          id?: string
          justificativa?: string | null
          modulo: string
          org_owner_id: string
          requester_id: string
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          formato?: string
          id?: string
          justificativa?: string | null
          modulo?: string
          org_owner_id?: string
          requester_id?: string
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
        }
        Relationships: []
      }
      sms_bank_configs: {
        Row: {
          agencia: string | null
          amount_regex: string | null
          bank_name: string
          conta: string | null
          created_at: string
          credit_keywords: string[]
          debit_keywords: string[]
          id: string
          is_active: boolean
          is_preset: boolean
          senders: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          agencia?: string | null
          amount_regex?: string | null
          bank_name: string
          conta?: string | null
          created_at?: string
          credit_keywords?: string[]
          debit_keywords?: string[]
          id?: string
          is_active?: boolean
          is_preset?: boolean
          senders?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          agencia?: string | null
          amount_regex?: string | null
          bank_name?: string
          conta?: string | null
          created_at?: string
          credit_keywords?: string[]
          debit_keywords?: string[]
          id?: string
          is_active?: boolean
          is_preset?: boolean
          senders?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sms_review_queue: {
        Row: {
          agencia: string | null
          amount: number | null
          bank_config_id: string | null
          bank_name: string | null
          conta: string | null
          created_at: string
          descricao: string | null
          id: string
          kind: Database["public"]["Enums"]["sms_txn_kind"]
          raw_message: string
          received_at: string | null
          sender: string | null
          status: Database["public"]["Enums"]["sms_review_status"]
          target_ref: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          agencia?: string | null
          amount?: number | null
          bank_config_id?: string | null
          bank_name?: string | null
          conta?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["sms_txn_kind"]
          raw_message: string
          received_at?: string | null
          sender?: string | null
          status?: Database["public"]["Enums"]["sms_review_status"]
          target_ref?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          agencia?: string | null
          amount?: number | null
          bank_config_id?: string | null
          bank_name?: string | null
          conta?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["sms_txn_kind"]
          raw_message?: string
          received_at?: string | null
          sender?: string | null
          status?: Database["public"]["Enums"]["sms_review_status"]
          target_ref?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_review_queue_bank_config_id_fkey"
            columns: ["bank_config_id"]
            isOneToOne: false
            referencedRelation: "sms_bank_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          org_owner_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_owner_id: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_owner_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_app_owner: { Args: { _user_id: string }; Returns: boolean }
      is_master: { Args: { _user_id: string }; Returns: boolean }
      org_owner_of: { Args: { _user_id: string }; Returns: string }
    }
    Enums: {
      app_role: "master" | "operador" | "colaborador" | "leitor"
      app_usage_mode: "pessoal" | "coparticipativo" | "corporativo"
      bill_source: "drive" | "upload" | "manual"
      bill_type:
        | "energia"
        | "internet"
        | "agua"
        | "iptu"
        | "ipva"
        | "taxa"
        | "gas"
        | "telefone"
        | "outro"
      goal_status: "ativa" | "concluida" | "arquivada"
      investment_source: "upload" | "manual" | "drive"
      request_status: "pendente" | "aprovada" | "recusada"
      sms_review_status: "pending" | "approved" | "rejected"
      sms_txn_kind: "debit" | "credit" | "unknown"
      user_gender: "masculino" | "feminino" | "nao_informar"
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
    Enums: {
      app_role: ["master", "operador", "colaborador", "leitor"],
      app_usage_mode: ["pessoal", "coparticipativo", "corporativo"],
      bill_source: ["drive", "upload", "manual"],
      bill_type: [
        "energia",
        "internet",
        "agua",
        "iptu",
        "ipva",
        "taxa",
        "gas",
        "telefone",
        "outro",
      ],
      goal_status: ["ativa", "concluida", "arquivada"],
      investment_source: ["upload", "manual", "drive"],
      request_status: ["pendente", "aprovada", "recusada"],
      sms_review_status: ["pending", "approved", "rejected"],
      sms_txn_kind: ["debit", "credit", "unknown"],
      user_gender: ["masculino", "feminino", "nao_informar"],
    },
  },
} as const
