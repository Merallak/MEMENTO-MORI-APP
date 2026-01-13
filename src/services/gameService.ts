import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type RPSGame = Tables<"rps_games">;
export type TTTGame = Tables<"ttt_games">;
export type TTTCell = number;

export interface TTTGameWithHost extends TTTGame {
  host?: {
    full_name?: string | null;
    email?: string | null;
  } | null;
}
export type GameMove = "rock" | "paper" | "scissors";
export type GameStatus = "waiting" | "active" | "playing" | "finished" | "cancelled";

type GameRpcFn =
  | "convert_usd_to_mmc"
  | "create_private_rps_game"
  | "create_rps_game"
  | "exchange_equity_for_mmc"
  | "execute_swap_transaction"
  | "get_platform_metrics"
  | "join_rps_game"
  | "join_rps_game_by_code"
  | "resolve_rps_game"
  | "restart_rps_game"
  | "submit_rps_move"
  | "propose_new_bet"
  | "accept_new_bet";

export interface RPSGameWithHost extends RPSGame {
  host?: {
    full_name?: string | null;
    email?: string | null;
  } | null;
}

export class GameService {
  /**
   * Convert USD to MMC (Memento Mori Coins)
   * Exchange rate: 1 USD = 100 MMC
   */
  static async convertUsdToMmc(userId: string, usdAmount: number): Promise<{ success: boolean; error?: string }> {
    const mmcAmount = usdAmount * 100;
    
    const { error } = await supabase.rpc("convert_usd_to_mmc", {
      p_user_id: userId,
      p_usd_amount: usdAmount
    });

    if (error) {
      console.error("Error converting USD to MMC:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  }

  /**
   * Exchange 1% of user's personal token supply for 1,000,000 MMC
   */
  static async exchangeEquityForMmc(userId: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase.rpc("exchange_equity_for_mmc", {
      p_user_id: userId
    });

    if (error) {
      console.error("Error exchanging equity for MMC:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  }

  /**
   * Get user's MMC balance
   */
  static async getMmcBalance(userId: string): Promise<number> {
    const { data, error } = await supabase
      .from("profiles")
      .select("mmc_balance")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("Error fetching MMC balance:", error);
      return 0;
    }

    return data?.mmc_balance || 0;
  }

  /**
   * Check if user has already exchanged equity for MMC
   */
  static async hasExchangedEquity(userId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from("profiles")
      .select("has_exchanged_equity")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("Error checking equity exchange status:", error);
      return false;
    }

    return data?.has_exchanged_equity || false;
  }

  /**
   * Create a new RPS game
   */
  static async createGame(betAmount: number): Promise<{ success: boolean; gameId?: string; error?: string }> {
    const { data, error } = await supabase.rpc("create_rps_game", {
      p_bet_amount: betAmount
    });

    if (error) {
      console.error("Error creating game:", error);
      return { success: false, error: error.message };
    }

    // La función puede devolver directamente uuid o un objeto; normalizamos a string
    const gameId = typeof data === "string" ? data : (data as unknown as { game_id?: string })?.game_id;

    return { success: true, gameId };
  }

  /**
   * Create a private game with shareable code
   */
  static async createPrivateGame(betAmount: number): Promise<{ success: boolean; gameId?: string; gameCode?: string; error?: string }> {
    const { data, error } = await supabase.rpc("create_private_rps_game", {
      p_bet_amount: betAmount
    });

    if (error) {
      console.error("Error creating private game:", error);
      return { success: false, error: error.message };
    }

    const result = data as { success: boolean; game_id?: string; game_code?: string; error?: string } | null;

    if (!result || !result.success) {
      return { success: false, error: result?.error || "Unknown error creating private game" };
    }

    return { success: true, gameId: result.game_id, gameCode: result.game_code };
  }

  /**
   * Join a private game using code
   */
  static async joinGameByCode(gameCode: string): Promise<{ success: boolean; gameId?: string; error?: string }> {
    const { data, error } = await supabase.rpc("join_rps_game_by_code", {
      p_game_code: gameCode.toUpperCase()
    });

    if (error) {
      console.error("Error joining game by code:", error);
      return { success: false, error: error.message };
    }

    const result = data as { success: boolean; game_id?: string; error?: string };
    
    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true, gameId: result.game_id };
  }

  /**
   * Join an existing game
   */
  static async joinGame(gameId: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase.rpc("join_rps_game", {
      p_game_id: gameId
    });

    if (error) {
      console.error("Error joining game:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  }

  /**
   * Submit player's move (rock/paper/scissors)
   */
  static async submitMove(gameId: string, move: GameMove): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase.rpc("submit_rps_move", {
      p_game_id: gameId,
      p_move: move
    });

    if (error) {
      console.error("Error submitting move:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  }

  /**
   * Get all available games (status = 'waiting')
   */
  static async getAvailableGames(): Promise<RPSGameWithHost[]> {
    const { data, error } = await supabase
      .from("rps_games")
      .select(`
        *,
        host:profiles!rps_games_host_id_fkey(full_name, email)
      `)
      .eq("status", "waiting")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching available games:", error);
      return [];
    }

    return (data || []) as RPSGameWithHost[];
  }

  /**
   * Get user's active game
   */
  static async getUserActiveGame(userId: string): Promise<RPSGame | null> {
    const { data, error } = await supabase
      .from("rps_games")
      .select(`
        *,
        host:profiles!rps_games_host_id_fkey(full_name, email),
        guest:profiles!rps_games_guest_id_fkey(full_name, email)
      `)
      .or(`host_id.eq.${userId},guest_id.eq.${userId}`)
      .in("status", ["waiting", "active", "playing"])
      .maybeSingle();

    if (error) {
      const code = (error as { code?: string }).code;
      if (code === "PGRST116") {
        // No active game
        return null;
      }
      console.error("Error fetching active game:", error);
      return null;
    }

    if (!data) {
      return null;
    }

    // Capa extra de seguridad: si el registro carece de identificadores básicos,
    // lo ignoramos para no atrapar al usuario en un estado inconsistente.
    const candidate = data as RPSGame;
    if (!candidate.host_id && !candidate.guest_id) {
      console.warn("Ignoring inconsistent game record for user", userId, candidate);
      return null;
    }

    return candidate;
  }

  /**
   * Cancel a game (only if waiting for opponent)
   */
  static async cancelGame(gameId: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
      .from("rps_games")
      .update({ status: "cancelled" })
      .eq("id", gameId)
      .eq("status", "waiting");

    if (error) {
      console.error("Error cancelling game:", error);
      return { success: false, error: error.message };
    }

    // Refund will be handled by database trigger
    return { success: true };
  }

  /**
   * Get a specific game by ID
   */
  static async getGame(gameId: string): Promise<{ data: RPSGame | null; error: any }> {
    const { data, error } = await supabase
      .from("rps_games")
      .select("*")
      .eq("id", gameId)
      .single();
      
    return { data, error };
  }

  /**
   * Subscribe to game updates (realtime)
   */
  static subscribeToGame(gameId: string, callback: (game: RPSGame) => void) {
    const channel = supabase
      .channel(`game:${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rps_games",
          filter: `id=eq.${gameId}`
        },
        (payload) => {
          callback(payload.new as RPSGame);
        }
      )
      .subscribe();

    return channel;
  }

  /**
   * Unsubscribe from game updates
   */
  static unsubscribeFromGame(channel: ReturnType<typeof supabase.channel>) {
    supabase.removeChannel(channel);
  }

  /**
   * Restart a finished game with same configuration
   */
  static async restartGame(gameId: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase.rpc("restart_rps_game", {
      p_game_id: gameId
    });

    if (error) {
      console.error("Error restarting game:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  }

  /**
   * Handle a player leaving the game.
   *
   * Business rule:
   * - If players have not comprometido/aceptado la apuesta de la ronda actual,
   *   leaving should simply close the game room without deciding a winner.
   * - Any rounds already played (ganadas/perdidas) siguen igual.
   *
   * For now, we implement the neutral behaviour by marking the game as
   * 'cancelled'. The caller (frontend) already reacts to this status by
   * closing the active game view.
   */
  static async forfeitGame(gameId: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
      .from("rps_games")
      .update({ status: "cancelled" })
      .eq("id", gameId);

    if (error) {
      console.error("Error cancelling game on forfeit:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  }

  /**
   * Propose a new bet amount for the next round.
   * Can only be called when the game is finished.
   */
  static async proposeNewBet(gameId: string, newBet: number): Promise<{ success: boolean; error?: string }> {
    const { data, error } = await supabase.rpc("propose_new_bet" as any, {
      p_game_id: gameId,
      p_new_bet: newBet
    });

    if (error) {
      console.error("Error proposing new bet:", error);
      return { success: false, error: error.message };
    }

    const arr = (data ?? []) as { success: boolean; error?: string }[];
    const first = arr[0] ?? { success: true };
    if (!first.success) {
      return { success: false, error: first.error };
    }

    return { success: true };
  }

  /**
   * Accept a pending new bet amount.
   * Only the non-proposer player can accept.
   */
  static async acceptNewBet(gameId: string): Promise<{ success: boolean; error?: string }> {
    const { data, error } = await supabase.rpc("accept_new_bet" as any, {
      p_game_id: gameId
    });

    if (error) {
      console.error("Error accepting new bet:", error);
      return { success: false, error: error.message };
    }

    const arr = (data ?? []) as { success: boolean; error?: string }[];
    const first = arr[0] ?? { success: true };
    if (!first.success) {
      return { success: false, error: first.error };
    }

    return { success: true };
  }
  
  // --------------------
  // Tic Tac Toe (TTT)
  // --------------------

  static async createTTTGame(betAmount: number): Promise<{ success: boolean; gameId?: string; error?: string }> {
    const { data, error } = await supabase.rpc("create_ttt_game", { p_bet_amount: betAmount });
    if (error) return { success: false, error: error.message };

    const gameId = typeof data === "string" ? data : (data as unknown as { game_id?: string })?.game_id;
    return { success: true, gameId };
  }

  static async createPrivateTTTGame(betAmount: number): Promise<{ success: boolean; gameId?: string; gameCode?: string; error?: string }> {
    const { data, error } = await supabase.rpc("create_private_ttt_game", { p_bet_amount: betAmount });
    if (error) return { success: false, error: error.message };

    const result = data as { success: boolean; game_id?: string; game_code?: string; error?: string } | null;
    if (!result || !result.success) return { success: false, error: result?.error || "Unknown error creating private game" };

    return { success: true, gameId: result.game_id, gameCode: result.game_code };
  }

  static async joinTTTGameByCode(gameCode: string): Promise<{ success: boolean; gameId?: string; error?: string }> {
    const { data, error } = await supabase.rpc("join_ttt_game_by_code", { p_game_code: gameCode.toUpperCase() });
    if (error) return { success: false, error: error.message };

    const result = data as { success: boolean; game_id?: string; error?: string };
    if (!result.success) return { success: false, error: result.error };

    return { success: true, gameId: result.game_id };
  }

  static async joinTTTGame(gameId: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase.rpc("join_ttt_game", { p_game_id: gameId });
    if (error) return { success: false, error: error.message };
    return { success: true };
  }

  static async submitTTTMove(gameId: string, cell: TTTCell): Promise<{ success: boolean; error?: string }> {
    // backend valida 0..8, igual validamos aquí por seguridad
    if (!Number.isInteger(cell) || cell < 0 || cell > 8) {
      return { success: false, error: "Invalid cell" };
    }

    const { error } = await supabase.rpc("submit_ttt_move", { p_game_id: gameId, p_cell: cell });
    if (error) return { success: false, error: error.message };
    return { success: true };
  }

  static async getAvailableTTTGames(): Promise<TTTGameWithHost[]> {
    const { data, error } = await supabase
      .from("ttt_games")
      .select(`*, host:profiles!ttt_games_host_id_fkey(full_name, email)`)
      .eq("status", "waiting")
      .order("created_at", { ascending: false });

    if (error) return [];
    return (data || []) as TTTGameWithHost[];
  }

  static async getUserActiveTTTGame(userId: string): Promise<TTTGame | null> {
    const { data, error } = await supabase
      .from("ttt_games")
      .select(
        `
        *,
        host:profiles!ttt_games_host_id_fkey(full_name, email),
        guest:profiles!ttt_games_guest_id_fkey(full_name, email)
      `
      )
      .or(`host_id.eq.${userId},guest_id.eq.${userId}`)
      .in("status", ["waiting", "active", "playing"])
      .maybeSingle();

    if (error) {
      const code = (error as { code?: string }).code;
      if (code === "PGRST116") return null;
      return null;
    }

    return (data as TTTGame) || null;
  }

  static async getTTTGame(gameId: string): Promise<{ data: TTTGame | null; error: any }> {
    const { data, error } = await supabase.from("ttt_games").select("*").eq("id", gameId).single();
    return { data, error };
  }

  static subscribeToTTTGame(gameId: string, callback: (game: TTTGame) => void) {
    const channel = supabase
      .channel(`ttt_game:${gameId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ttt_games", filter: `id=eq.${gameId}` },
        (payload) => callback(payload.new as TTTGame)
      )
      .subscribe();
    return channel;
  }

  static async restartTTTGame(gameId: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase.rpc("restart_ttt_game", { p_game_id: gameId });
    if (error) return { success: false, error: error.message };
    return { success: true };
  }

  static async forfeitTTTGame(gameId: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase.from("ttt_games").update({ status: "cancelled" }).eq("id", gameId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  }

  static async proposeNewTTTBet(gameId: string, newBet: number): Promise<{ success: boolean; error?: string }> {
    const { data, error } = await supabase.rpc("propose_new_ttt_bet" as any, { p_game_id: gameId, p_new_bet: newBet });
    if (error) return { success: false, error: error.message };

    const arr = (data ?? []) as { success: boolean; error?: string }[];
    const first = arr[0] ?? { success: true };
    if (!first.success) return { success: false, error: first.error };
    return { success: true };
  }

  static async acceptNewTTTBet(gameId: string): Promise<{ success: boolean; error?: string }> {
    const { data, error } = await supabase.rpc("accept_new_ttt_bet" as any, { p_game_id: gameId });
    if (error) return { success: false, error: error.message };

    const arr = (data ?? []) as { success: boolean; error?: string }[];
    const first = arr[0] ?? { success: true };
    if (!first.success) return { success: false, error: first.error };
    return { success: true };
  }
}