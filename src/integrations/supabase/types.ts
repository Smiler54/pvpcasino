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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          admin_user_id: string
          created_at: string
          details: Json | null
          id: string
          ip_address: unknown | null
          target_user_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          admin_user_id: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: unknown | null
          target_user_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          admin_user_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: unknown | null
          target_user_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          user_id: string
          username: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          user_id: string
          username: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      coinflip_games: {
        Row: {
          bet_amount: number
          client_seed: string | null
          completed_at: string | null
          created_at: string
          hmac_result: string | null
          id: string
          player1_choice: string | null
          player1_id: string
          player1_username: string
          player2_choice: string | null
          player2_id: string | null
          player2_username: string | null
          result: string | null
          server_seed: string | null
          server_seed_hash: string | null
          status: string
          updated_at: string
          winner_id: string | null
        }
        Insert: {
          bet_amount?: number
          client_seed?: string | null
          completed_at?: string | null
          created_at?: string
          hmac_result?: string | null
          id?: string
          player1_choice?: string | null
          player1_id: string
          player1_username: string
          player2_choice?: string | null
          player2_id?: string | null
          player2_username?: string | null
          result?: string | null
          server_seed?: string | null
          server_seed_hash?: string | null
          status?: string
          updated_at?: string
          winner_id?: string | null
        }
        Update: {
          bet_amount?: number
          client_seed?: string | null
          completed_at?: string | null
          created_at?: string
          hmac_result?: string | null
          id?: string
          player1_choice?: string | null
          player1_id?: string
          player1_username?: string
          player2_choice?: string | null
          player2_id?: string | null
          player2_username?: string | null
          result?: string | null
          server_seed?: string | null
          server_seed_hash?: string | null
          status?: string
          updated_at?: string
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coinflip_games_player1_id_fkey"
            columns: ["player1_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "coinflip_games_player2_id_fkey"
            columns: ["player2_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "coinflip_games_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      jackpot_games: {
        Row: {
          client_seed: string | null
          completed_at: string | null
          countdown_seconds: number | null
          created_at: string
          hmac_result: string | null
          id: string
          server_seed: string | null
          server_seed_hash: string | null
          status: string
          ticket_price: number
          timer_end_at: string | null
          timer_start_at: string | null
          total_pool: number
          winner_id: string | null
          winner_name: string | null
        }
        Insert: {
          client_seed?: string | null
          completed_at?: string | null
          countdown_seconds?: number | null
          created_at?: string
          hmac_result?: string | null
          id?: string
          server_seed?: string | null
          server_seed_hash?: string | null
          status?: string
          ticket_price?: number
          timer_end_at?: string | null
          timer_start_at?: string | null
          total_pool?: number
          winner_id?: string | null
          winner_name?: string | null
        }
        Update: {
          client_seed?: string | null
          completed_at?: string | null
          countdown_seconds?: number | null
          created_at?: string
          hmac_result?: string | null
          id?: string
          server_seed?: string | null
          server_seed_hash?: string | null
          status?: string
          ticket_price?: number
          timer_end_at?: string | null
          timer_start_at?: string | null
          total_pool?: number
          winner_id?: string | null
          winner_name?: string | null
        }
        Relationships: []
      }
      jackpot_tickets: {
        Row: {
          amount_paid: number
          created_at: string
          game_id: string
          id: string
          tickets_bought: number
          user_id: string
          username: string
        }
        Insert: {
          amount_paid: number
          created_at?: string
          game_id: string
          id?: string
          tickets_bought?: number
          user_id: string
          username: string
        }
        Update: {
          amount_paid?: number
          created_at?: string
          game_id?: string
          id?: string
          tickets_bought?: number
          user_id?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "jackpot_tickets_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "jackpot_games"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          balance: number | null
          created_at: string
          experience: number
          id: string
          level: number
          stripe_account_id: string | null
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          balance?: number | null
          created_at?: string
          experience?: number
          id?: string
          level?: number
          stripe_account_id?: string | null
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          balance?: number | null
          created_at?: string
          experience?: number
          id?: string
          level?: number
          stripe_account_id?: string | null
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          stripe_session_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          stripe_session_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          stripe_session_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      withdrawals: {
        Row: {
          admin_notes: string | null
          amount: number
          created_at: string
          id: string
          processed_at: string | null
          requested_at: string
          status: string
          stripe_transfer_id: string | null
          updated_at: string
          user_id: string
          withdrawal_method: string
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          created_at?: string
          id?: string
          processed_at?: string | null
          requested_at?: string
          status?: string
          stripe_transfer_id?: string | null
          updated_at?: string
          user_id: string
          withdrawal_method?: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          created_at?: string
          id?: string
          processed_at?: string | null
          requested_at?: string
          status?: string
          stripe_transfer_id?: string | null
          updated_at?: string
          user_id?: string
          withdrawal_method?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_get_pending_withdrawals: {
        Args: Record<PropertyKey, never>
        Returns: {
          amount: number
          id: string
          requested_at: string
          status: string
          user_id: string
          username: string
          withdrawal_method: string
        }[]
      }
      admin_get_user_summary: {
        Args: { p_user_id: string }
        Returns: {
          account_status: string
          balance_tier: string
          last_active: string
          level: number
          user_id: string
          username: string
        }[]
      }
      audit_security_policies: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      bootstrap_admin_from_email: {
        Args: { p_email: string }
        Returns: Json
      }
      bootstrap_first_admin: {
        Args: { p_user_email: string }
        Returns: Json
      }
      buy_jackpot_tickets: {
        Args: {
          p_game_id: string
          p_ticket_price: number
          p_tickets: number
          p_user_id: string
          p_username: string
        }
        Returns: Json
      }
      calculate_level: {
        Args: { exp: number }
        Returns: number
      }
      check_and_draw_expired_jackpots: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      check_enhanced_withdrawal_limits: {
        Args: { p_amount: number; p_user_id: string }
        Returns: Json
      }
      check_withdrawal_rate_limit: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      claim_level_rewards: {
        Args: { p_user_id: string }
        Returns: Json
      }
      cleanup_old_data: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_stale_coinflip_games: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      draw_jackpot_winner: {
        Args: { p_game_id: string }
        Returns: Json
      }
      exp_for_next_level: {
        Args: { current_exp: number }
        Returns: number
      }
      generate_coinflip_provably_fair: {
        Args: { p_game_id: string }
        Returns: Json
      }
      generate_jackpot_provably_fair: {
        Args: { p_game_id: string }
        Returns: Json
      }
      get_game_provably_fair_data: {
        Args: { p_game_id: string; p_game_type: string }
        Returns: Json
      }
      get_jackpot_aggregate_data: {
        Args: { p_game_id: string }
        Returns: Json
      }
      get_jackpot_players_for_wheel: {
        Args: { p_game_id: string }
        Returns: {
          percentage: number
          tickets_bought: number
          total_value: number
          username: string
        }[]
      }
      get_jackpot_public_stats: {
        Args: Record<PropertyKey, never>
        Returns: {
          created_at: string
          game_status: string
          id: string
          status: string
          ticket_price: number
          timer_end_at: string
          total_pool: number
        }[]
      }
      get_jackpot_stats_secure: {
        Args: { p_game_id?: string }
        Returns: {
          created_at: string
          game_status: string
          id: string
          status: string
          ticket_price: number
          timer_end_at: string
          total_pool: number
        }[]
      }
      get_masked_user_profile: {
        Args: { p_user_id: string }
        Returns: {
          created_at: string
          has_stripe_account: boolean
          level: number
          masked_balance: string
          user_id: string
          username: string
        }[]
      }
      get_match_result_safe: {
        Args: { p_match_id: string }
        Returns: {
          amount: number
          completed_at: string
          id: string
          result_side: string
          status: string
          winner_id: string
        }[]
      }
      get_my_bank_status: {
        Args: Record<PropertyKey, never>
        Returns: {
          balance: number
          has_stripe_account: boolean
        }[]
      }
      get_my_complete_profile: {
        Args: Record<PropertyKey, never>
        Returns: {
          balance: number
          created_at: string
          experience: number
          level: number
          updated_at: string
          user_id: string
          username: string
        }[]
      }
      get_my_match_verification: {
        Args: { p_match_id: string }
        Returns: {
          amount: number
          client_seed: string
          completed_at: string
          id: string
          result_side: string
          salt: string
          server_seed: string
        }[]
      }
      get_my_transactions: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          amount: number
          created_at: string
          description: string
          id: string
          type: string
        }[]
      }
      get_my_withdrawals: {
        Args: Record<PropertyKey, never>
        Returns: {
          amount: number
          id: string
          processed_at: string
          requested_at: string
          status: string
          withdrawal_method: string
        }[]
      }
      get_public_game_offers: {
        Args: Record<PropertyKey, never>
        Returns: {
          amount: number
          created_at: string
          id: string
          maker_name: string
          side: string
        }[]
      }
      get_public_jackpot_history: {
        Args: { p_limit?: number }
        Returns: {
          completed_at: string
          id: string
          total_players: number
          total_pool: number
          winner_name: string
        }[]
      }
      get_public_jackpot_stats: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          player_count: number
          status: string
          ticket_price: number
          timer_end_at: string
          total_pool: number
        }[]
      }
      get_public_recent_matches: {
        Args: { p_limit?: number }
        Returns: {
          amount: number
          completed_at: string
          id: string
          maker_name: string
          result_side: string
          taker_name: string
          winner_name: string
        }[]
      }
      get_public_recent_matches_safe: {
        Args: { p_limit?: number }
        Returns: {
          amount: number
          completed_at: string
          id: string
          result_side: string
        }[]
      }
      get_safe_public_profile: {
        Args: { p_user_id: string }
        Returns: {
          created_at: string
          level: number
          user_id: string
          username: string
        }[]
      }
      get_security_alerts: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_security_status: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_user_jackpot_tickets: {
        Args: { p_game_id: string; p_user_id: string }
        Returns: {
          amount_paid: number
          created_at: string
          tickets_bought: number
        }[]
      }
      get_user_jackpot_tickets_secure: {
        Args: { p_game_id: string }
        Returns: {
          amount_paid: number
          created_at: string
          tickets_bought: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_authenticated_user: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      log_auth_event: {
        Args: { p_details?: Json; p_event_type: string; p_user_id?: string }
        Returns: undefined
      }
      log_profile_access: {
        Args: { p_access_type: string; p_target_user_id: string }
        Returns: undefined
      }
      log_profile_access_attempt: {
        Args: {
          p_access_type: string
          p_success?: boolean
          p_target_user_id: string
        }
        Returns: undefined
      }
      log_security_event: {
        Args: {
          p_details?: Json
          p_event_type: string
          p_severity?: string
          p_user_id: string
        }
        Returns: undefined
      }
      make_user_admin: {
        Args: { p_user_id: string }
        Returns: Json
      }
      notify_jackpot_event: {
        Args: { p_channel: string; p_payload: string }
        Returns: undefined
      }
      request_withdrawal: {
        Args: {
          p_amount: number
          p_details: Json
          p_method: string
          p_user_id: string
        }
        Returns: Json
      }
      sanitize_text_input: {
        Args: { input_text: string }
        Returns: string
      }
      start_jackpot_countdown: {
        Args: { p_countdown_seconds?: number; p_game_id: string }
        Returns: Json
      }
      update_balance_safe: {
        Args: { p_amount: number; p_operation?: string; p_user_id: string }
        Returns: undefined
      }
      update_user_balance: {
        Args: {
          p_amount: number
          p_description: string
          p_transaction_type: string
          p_user_id: string
        }
        Returns: undefined
      }
      validate_financial_access: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      validate_security_settings: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      verify_coinflip_fairness: {
        Args: {
          p_client_seed: string
          p_game_id: string
          p_nonce: number
          p_server_seed: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
