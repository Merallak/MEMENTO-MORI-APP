 
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
      holdings: {
        Row: {
          amount: number
          avg_buy_price: number
          id: string
          token_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount?: number
          avg_buy_price?: number
          id?: string
          token_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          avg_buy_price?: number
          id?: string
          token_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "holdings_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holdings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          payment_token_id: string | null
          price: number
          status: string
          token_id: string
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          payment_token_id?: string | null
          price: number
          status?: string
          token_id: string
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          payment_token_id?: string | null
          price?: number
          status?: string
          token_id?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_payment_token_id_fkey"
            columns: ["payment_token_id"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      price_history: {
        Row: {
          id: string
          market_cap: number
          price: number
          timestamp: string
          token_id: string
          volume_24h: number | null
        }
        Insert: {
          id?: string
          market_cap: number
          price: number
          timestamp?: string
          token_id: string
          volume_24h?: number | null
        }
        Update: {
          id?: string
          market_cap?: number
          price?: number
          timestamp?: string
          token_id?: string
          volume_24h?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "price_history_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          has_exchanged_equity: boolean | null
          id: string
          mmc_balance: number | null
          updated_at: string | null
          usd_balance: number
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          has_exchanged_equity?: boolean | null
          id: string
          mmc_balance?: number | null
          updated_at?: string | null
          usd_balance?: number
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          has_exchanged_equity?: boolean | null
          id?: string
          mmc_balance?: number | null
          updated_at?: string | null
          usd_balance?: number
        }
        Relationships: []
      }
      rps_games: {
        Row: {
          bet_amount: number
          created_at: string | null
          expires_at: string | null
          game_code: string | null
          guest_id: string | null
          guest_move: string | null
          host_id: string
          host_move: string | null
          id: string
          is_private: boolean | null
          status: string
          winner_id: string | null
        }
        Insert: {
          bet_amount: number
          created_at?: string | null
          expires_at?: string | null
          game_code?: string | null
          guest_id?: string | null
          guest_move?: string | null
          host_id: string
          host_move?: string | null
          id?: string
          is_private?: boolean | null
          status?: string
          winner_id?: string | null
        }
        Update: {
          bet_amount?: number
          created_at?: string | null
          expires_at?: string | null
          game_code?: string | null
          guest_id?: string | null
          guest_move?: string | null
          host_id?: string
          host_move?: string | null
          id?: string
          is_private?: boolean | null
          status?: string
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rps_games_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rps_games_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rps_games_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ttt_games: {
        Row: {
          bet_amount: number | null
          board: string
          created_at: string | null
          expires_at: string | null
          game_code: string | null
          guest_id: string | null
          guest_symbol: string | null
          host_id: string
          host_symbol: string | null
          id: string
          is_private: boolean | null
          next_bet_amount: number | null
          next_bet_proposer_id: string | null
          round_number: number
          status: string
          turn_player_id: string | null
          winner_id: string | null
        }
        Insert: {
          bet_amount?: number | null
          board?: string
          created_at?: string | null
          expires_at?: string | null
          game_code?: string | null
          guest_id?: string | null
          guest_symbol?: string | null
          host_id: string
          host_symbol?: string | null
          id?: string
          is_private?: boolean | null
          next_bet_amount?: number | null
          next_bet_proposer_id?: string | null
          round_number?: number
          status?: string
          turn_player_id?: string | null
          winner_id?: string | null
        }
        Update: {
          bet_amount?: number | null
          board?: string
          created_at?: string | null
          expires_at?: string | null
          game_code?: string | null
          guest_id?: string | null
          guest_symbol?: string | null
          host_id?: string
          host_symbol?: string | null
          id?: string
          is_private?: boolean | null
          next_bet_amount?: number | null
          next_bet_proposer_id?: string | null
          round_number?: number
          status?: string
          turn_player_id?: string | null
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ttt_games_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ttt_games_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ttt_games_turn_player_id_fkey"
            columns: ["turn_player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ttt_games_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tokens: {
        Row: {
          created_at: string | null
          current_price: number
          description: string | null
          id: string
          image_url: string | null
          issuer_id: string
          market_cap: number
          name: string
          net_worth: number
          ticker: string
          total_supply: number
        }
        Insert: {
          created_at?: string | null
          current_price?: number
          description?: string | null
          id?: string
          image_url?: string | null
          issuer_id: string
          market_cap?: number
          name: string
          net_worth?: number
          ticker: string
          total_supply?: number
        }
        Update: {
          created_at?: string | null
          current_price?: number
          description?: string | null
          id?: string
          image_url?: string | null
          issuer_id?: string
          market_cap?: number
          name?: string
          net_worth?: number
          ticker?: string
          total_supply?: number
        }
        Relationships: [
          {
            foreignKeyName: "tokens_issuer_id_fkey"
            columns: ["issuer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trades: {
        Row: {
          amount: number
          buyer_id: string | null
          executed_at: string | null
          id: string
          price_per_token: number
          seller_id: string | null
          token_id: string
          total_value: number
          type: string
        }
        Insert: {
          amount: number
          buyer_id?: string | null
          executed_at?: string | null
          id?: string
          price_per_token: number
          seller_id?: string | null
          token_id: string
          total_value: number
          type: string
        }
        Update: {
          amount?: number
          buyer_id?: string | null
          executed_at?: string | null
          id?: string
          price_per_token?: number
          seller_id?: string | null
          token_id?: string
          total_value?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "trades_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      convert_usd_to_mmc: {
        Args: { p_usd_amount: number; p_user_id: string }
        Returns: Json
      }
      create_private_rps_game: { Args: { p_bet_amount: number }; Returns: Json }
      create_rps_game: { Args: { p_bet_amount: number }; Returns: string }
      exchange_equity_for_mmc: { Args: { p_user_id: string }; Returns: Json }
      execute_swap_transaction: {
        Args: { p_order_id: string; p_taker_id: string }
        Returns: boolean
      }
      get_platform_metrics: { Args: never; Returns: Json }
      join_rps_game: { Args: { p_game_id: string }; Returns: undefined }
      join_rps_game_by_code: { Args: { p_game_code: string }; Returns: Json }
      resolve_rps_game: { Args: { p_game_id: string }; Returns: undefined }
      restart_rps_game: {
        Args: { p_game_id: string }
        Returns: {
          error: string
          success: boolean
        }[]
      }
      submit_rps_move: {
        Args: { p_game_id: string; p_move: string }
        Returns: undefined
      }      
      accept_new_ttt_bet: {
        Args: { p_game_id: string }
        Returns: {
          error: string
          success: boolean
        }[]
      }
      create_private_ttt_game: { Args: { p_bet_amount: number }; Returns: Json }
      create_ttt_game: { Args: { p_bet_amount: number }; Returns: string }
      join_ttt_game: { Args: { p_game_id: string }; Returns: undefined }
      join_ttt_game_by_code: { Args: { p_game_code: string }; Returns: Json }
      propose_new_ttt_bet: {
        Args: { p_game_id: string; p_new_bet: number }
        Returns: {
          error: string
          success: boolean
        }[]
      }
      resolve_ttt_game: { Args: { p_game_id: string }; Returns: undefined }
      restart_ttt_game: { Args: { p_game_id: string }; Returns: undefined }
      submit_ttt_move: {
        Args: { p_game_id: string; p_cell: number }
        Returns: undefined
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
