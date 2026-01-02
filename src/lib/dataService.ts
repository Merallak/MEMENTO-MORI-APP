import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

// Type aliases for convenience
export type Token = Tables<"tokens">;
export type Order = Tables<"orders">;
export type Trade = Tables<"trades">; // Added Trade type
export type Holding = Tables<"holdings"> & {
  tokens?: {
    ticker: string;
    name: string;
    current_price: number;
    image_url: string | null;
  } | null;
};

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  usd_balance: number;
}

// Helper to get current user
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export class DataService {
  private static readonly GOLDEN_RATIO = 1.618033988749895;

  // ========== USERS & BALANCE ==========
  static async getUsers(): Promise<User[]> {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, created_at, usd_balance");
    
    if (error) {
      console.error("Error fetching users:", error);
      return [];
    }
    
    return (data || []).map(p => ({
      id: p.id,
      name: p.full_name || "Anonymous",
      email: p.email || "",
      createdAt: p.created_at || new Date().toISOString(),
      usd_balance: Number(p.usd_balance || 0)
    }));
  }

  static async getUserBalance(userId: string): Promise<number> {
    const { data, error } = await supabase
      .from("profiles")
      .select("usd_balance")
      .eq("id", userId)
      .single();
    
    if (error) {
      console.error("Error fetching user balance:", error);
      return 0;
    }
    
    return Number(data.usd_balance || 0);
  }

  static async depositUsd(userId: string, amount: number): Promise<boolean> {
    const currentBalance = await this.getUserBalance(userId);
    const newBalance = currentBalance + amount;
    
    const { error } = await supabase
      .from("profiles")
      .update({ usd_balance: newBalance })
      .eq("id", userId);
      
    if (error) {
      console.error("Error depositing USD:", error);
      return false;
    }
    return true;
  }

  // ========== TOKENS ==========
  static async getAllTokens(): Promise<Token[]> {
    const { data, error } = await supabase
      .from("tokens")
      .select(`
        *,
        profiles!tokens_issuer_id_fkey (
          full_name,
          email
        )
      `)
      .order("created_at", { ascending: false });
    
    if (error) {
      console.error("Error fetching tokens:", error);
      return [];
    }
    
    return data || [];
  }

  static async getUserIssuedToken(userId: string): Promise<Token | null> {
    const { data, error } = await supabase
      .from("tokens")
      .select("*")
      .eq("issuer_id", userId)
      .single();
    
    if (error) {
      if (error.code === "PGRST116") return null; // No rows found
      console.error("Error fetching user token:", error);
      return null;
    }
    
    return data;
  }

  static async hasUserIssuedToken(userId: string): Promise<boolean> {
    const token = await this.getUserIssuedToken(userId);
    return token !== null;
  }

  static async createToken(tokenData: {
    ticker: string;
    name: string;
    description?: string;
    image_url?: string;
    net_worth: number;
    total_supply: number;
    current_price: number;
    issuer_id: string;
  }): Promise<Token | null> {
    const marketCap = tokenData.total_supply * tokenData.current_price;
    
    const { data: token, error } = await supabase
      .from("tokens")
      .insert({
        ticker: tokenData.ticker,
        name: tokenData.name,
        description: tokenData.description || "",
        image_url: tokenData.image_url || "",
        net_worth: tokenData.net_worth,
        total_supply: tokenData.total_supply,
        current_price: tokenData.current_price,
        market_cap: marketCap,
        issuer_id: tokenData.issuer_id
      })
      .select()
      .single();
    
    if (error) {
      console.error("Error creating token:", error);
      return null;
    }
    
    // Seed initial price history
    await this.seedInitialPriceHistory(token.id, token.current_price, token.total_supply);
    
    // Assign initial supply to creator
    await this.updateHoldings(token.issuer_id, token.id, token.total_supply, token.current_price);
    
    // Create golden ratio order book
    await this.createGoldenRatioOrderBook(token);
    
    return token;
  }

  static async updateToken(
    tokenId: string,
    userId: string,
    updates: {
      name?: string;
      description?: string;
      image_url?: string;
      net_worth?: number;
    }
  ): Promise<Token | null> {
    // Security: Verify ownership
    const { data: token, error: fetchError } = await supabase
      .from("tokens")
      .select("*")
      .eq("id", tokenId)
      .eq("issuer_id", userId)
      .single();
    
    if (fetchError || !token) {
      console.error("Token not found or user is not the issuer:", fetchError);
      return null;
    }

    // Only allow updating safe fields (NOT ticker, supply, or price)
    const allowedUpdates: any = {};
    if (updates.name !== undefined) allowedUpdates.name = updates.name;
    if (updates.description !== undefined) allowedUpdates.description = updates.description;
    if (updates.image_url !== undefined) allowedUpdates.image_url = updates.image_url;
    if (updates.net_worth !== undefined) allowedUpdates.net_worth = updates.net_worth;

    const { data: updatedToken, error: updateError } = await supabase
      .from("tokens")
      .update(allowedUpdates)
      .eq("id", tokenId)
      .select()
      .single();
    
    if (updateError) {
      console.error("Error updating token:", updateError);
      return null;
    }
    
    return updatedToken;
  }

  private static async createGoldenRatioOrderBook(token: Token): Promise<void> {
    const basePrice = token.current_price;
    const totalSupply = token.total_supply;
    
    const availableForOrders = Math.floor(totalSupply * 0.8);
    const numberOfTiers = 8;
    let remainingTokens = availableForOrders;
    
    const orders: Array<{
      token_id: string;
      user_id: string;
      type: "buy" | "sell";
      amount: number;
      price: number;
      status: "open" | "filled" | "cancelled";
    }> = [];
    
    for (let i = 0; i < numberOfTiers && remainingTokens > 0; i++) {
      const tierPrice = basePrice * Math.pow(this.GOLDEN_RATIO, i);
      const tierPercentage = 1 / Math.pow(this.GOLDEN_RATIO, i);
      const tierAmount = Math.floor(availableForOrders * tierPercentage * 0.15);
      
      const actualAmount = Math.min(tierAmount, remainingTokens);
      
      if (actualAmount > 0) {
        orders.push({
          token_id: token.id,
          user_id: token.issuer_id,
          type: "sell",
          amount: actualAmount,
          price: parseFloat(tierPrice.toFixed(4)),
          status: "open"
        });
        remainingTokens -= actualAmount;
      }
    }
    
    if (orders.length > 0) {
      await supabase.from("orders").insert(orders);
    }
  }

  // ========== PRICE HISTORY ==========
  
  /**
   * Record a trade in the history
   */
  private static async logTrade(data: {
    buyer_id?: string;
    seller_id?: string;
    token_id: string;
    amount: number;
    price: number;
    type: "BUY" | "SELL" | "SWAP";
  }): Promise<void> {
    const { error } = await supabase.from("trades").insert({
      buyer_id: data.buyer_id,
      seller_id: data.seller_id,
      token_id: data.token_id,
      amount: data.amount,
      price_per_token: data.price,
      total_value: data.amount * data.price,
      type: data.type
    });

    if (error) {
      console.error("Error logging trade:", error);
    }
  }

  /**
   * Get recent trades for a token or globally
   */
  static async getRecentTrades(tokenId?: string, limit = 20): Promise<Trade[]> {
    let query = supabase
      .from("trades")
      .select(`
        *,
        buyer:profiles!trades_buyer_id_fkey(full_name),
        seller:profiles!trades_seller_id_fkey(full_name),
        token:tokens!trades_token_id_fkey(ticker)
      `)
      .order("executed_at", { ascending: false })
      .limit(limit);

    if (tokenId) {
      query = query.eq("token_id", tokenId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching trades:", error);
      return [];
    }

    return data || [];
  }

  /**
   * Record a price snapshot for a token
   * Should be called whenever token price changes (trades, market updates)
   */
  static async recordPriceSnapshot(tokenId: string, price: number, marketCap: number): Promise<boolean> {
    const { error } = await supabase
      .from("price_history")
      .insert({
        token_id: tokenId,
        price: price,
        market_cap: marketCap
      });
    
    if (error) {
      console.error("Error recording price snapshot:", error);
      return false;
    }
    
    return true;
  }

  /**
   * Get price history for a token (for charting)
   * @param tokenId - Token ID
   * @param days - Number of days of history (default: 30)
   * @returns Array of price points with timestamps
   */
  static async getPriceHistory(tokenId: string, days: number = 30): Promise<Array<{ timestamp: string; price: number; market_cap: number }>> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const { data, error } = await supabase
      .from("price_history")
      .select("timestamp, price, market_cap")
      .eq("token_id", tokenId)
      .gte("timestamp", startDate.toISOString())
      .order("timestamp", { ascending: true });
    
    if (error) {
      console.error("Error fetching price history:", error);
      return [];
    }
    
    return data || [];
  }

  /**
   * Update token price and record the change in history
   * Use this instead of direct token updates to maintain price tracking
   */
  static async updateTokenPrice(tokenId: string, newPrice: number): Promise<boolean> {
    // Get current token data
    const { data: token, error: fetchError } = await supabase
      .from("tokens")
      .select("total_supply")
      .eq("id", tokenId)
      .single();
    
    if (fetchError || !token) {
      console.error("Error fetching token for price update:", fetchError);
      return false;
    }
    
    const newMarketCap = token.total_supply * newPrice;
    
    // Update token price
    const { error: updateError } = await supabase
      .from("tokens")
      .update({ 
        current_price: newPrice,
        market_cap: newMarketCap
      })
      .eq("id", tokenId);
    
    if (updateError) {
      console.error("Error updating token price:", updateError);
      return false;
    }
    
    // Record in history
    await this.recordPriceSnapshot(tokenId, newPrice, newMarketCap);
    
    return true;
  }

  /**
   * Seed initial price history for a token (for newly created tokens)
   * Creates a baseline snapshot at token creation
   */
  static async seedInitialPriceHistory(tokenId: string, initialPrice: number, totalSupply: number): Promise<void> {
    const marketCap = initialPrice * totalSupply;
    await this.recordPriceSnapshot(tokenId, initialPrice, marketCap);
  }

  // ========== ORDERS & SWAPS ==========
  static async getAllOrders(): Promise<Order[]> {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (error) {
      console.error("Error fetching orders:", error);
      return [];
    }
    
    return data || [];
  }

  static async getActiveOrdersForToken(tokenId: string): Promise<Order[]> {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("token_id", tokenId)
      .eq("status", "open")
      .is("payment_token_id", null) // ONLY USD ORDERS
      .order("price", { ascending: true });
    
    if (error) {
      console.error("Error fetching active orders:", error);
      return [];
    }
    
    return data || [];
  }

  static async getSwapOffersForToken(tokenId: string): Promise<(Order & { payment_token?: Token })[]> {
    const { data, error } = await supabase
      .from("orders")
      .select(`
        *,
        payment_token:tokens!orders_payment_token_id_fkey(*)
      `)
      .eq("token_id", tokenId)
      .eq("status", "open")
      .not("payment_token_id", "is", null) // ONLY SWAP ORDERS
      .order("created_at", { ascending: false });
    
    if (error) {
      console.error("Error fetching swap offers:", error);
      return [];
    }
    
    return data || [];
  }

  static async createOrder(orderData: {
    token_id: string;
    user_id: string;
    type: "buy" | "sell";
    amount: number;
    price: number;
    payment_token_id?: string;
  }): Promise<Order | null> {
    
    // Determinar si esta orden es un swap (requiere payment_token_id) o una orden en USD
    const isSwapOrder = typeof orderData.payment_token_id === "string" && orderData.payment_token_id.length > 0;

    if (isSwapOrder) {
      // Blindaje: si por alguna razon payment_token_id viene vacio, no insertamos la orden
      if (!orderData.payment_token_id) {
        console.error("Swap order missing payment_token_id", orderData);
        return null;
      }
    } else {
      // Orden USD normal: mantenemos el comportamiento actual (payment_token_id = null)
      // No hacemos nada especial aqui; la orden se tratara como USD-only en el resto del sistema.
    }
    
    const { data, error } = await supabase
      .from("orders")
      .insert({
        token_id: orderData.token_id,
        user_id: orderData.user_id,
        type: orderData.type,
        amount: orderData.amount,
        price: orderData.price,
        status: "open",
        payment_token_id: isSwapOrder ? orderData.payment_token_id : null
      })
      .select()
      .single();
    
    if (error) {
      console.error("Error creating order:", error);
      return null;
    }
    
    return data;
  }

  static async executeSwap(orderId: string, takerId: string): Promise<{ success: boolean; error?: string }> {
    // Call the secure RPC function in the database
    const { data, error } = await supabase.rpc('execute_swap_transaction', {
      p_order_id: orderId,
      p_taker_id: takerId
    });

    if (error) {
      console.error("Error executing swap transaction:", error);
      return { success: false, error: error.message };
    }

    if (!data) {
       return { success: false, error: "Transaction failed to complete" };
    }

    return { success: true };
  }

  static async cancelOrder(orderId: string, userId: string): Promise<boolean> {
    const { error } = await supabase
      .from("orders")
      .update({ status: 'cancelled' })
      .eq("id", orderId)
      .eq("user_id", userId) // Security: Ensure ownership
      .eq("status", "open"); // Only open orders

    if (error) {
      console.error("Error cancelling order:", error);
      return false;
    }

    return true;
  }

  // ========== VALIDATION HELPERS ==========
  static async validateBuyOrder(userId: string, amount: number, price: number): Promise<{ valid: boolean; message: string }> {
    const totalCost = amount * price;
    const userBalance = await this.getUserBalance(userId);
    
    if (userBalance < totalCost) {
      return {
        valid: false,
        message: `Insufficient USD balance. Need $${totalCost.toFixed(2)}, have $${userBalance.toFixed(2)}`
      };
    }
    
    return { valid: true, message: "" };
  }

  static async validateSellOrder(userId: string, tokenId: string, amount: number): Promise<{ valid: boolean; message: string }> {
    const holding = await this.getUserHolding(userId, tokenId);
    
    if (!holding || holding.amount < amount) {
      return {
        valid: false,
        message: `Insufficient token balance. You have ${holding?.amount || 0} tokens`
      };
    }
    
    return { valid: true, message: "" };
  }

  static async validateSwapOffer(
    userId: string,
    paymentTokenId: string,
    amountToGive: number
  ): Promise<{ valid: boolean; message: string }> {
    const holding = await this.getUserHolding(userId, paymentTokenId);
    
    if (!holding) {
      return {
        valid: false,
        message: "You do not hold this token to use it for swaps."
      };
    }

    const epsilon = 0.000001;

    if (holding.amount + epsilon < amountToGive) {
      return {
        valid: false,
        message: `Insufficient token balance. You have ${holding.amount}, trying to pay ${amountToGive}`
      };
    }
    
    return { valid: true, message: "" };
  }

  static async executeBuyOrder(userId: string, tokenId: string, amount: number, price: number): Promise<boolean> {
    // Deduct USD from buyer
    const totalCost = amount * price;
    const currentBalance = await this.getUserBalance(userId);
    const newBalance = currentBalance - totalCost;
    
    const { error: balanceError } = await supabase
      .from("profiles")
      .update({ usd_balance: newBalance })
      .eq("id", userId);
    
    if (balanceError) {
      console.error("Error updating balance:", balanceError);
      return false;
    }
    
    // Add tokens to buyer's holdings
    await this.updateHoldings(userId, tokenId, amount, price);
    
    // Record price change in history
    await this.updateTokenPrice(tokenId, price);
    
    // Log the trade
    await this.logTrade({
      buyer_id: userId,
      token_id: tokenId,
      amount: amount,
      price: price,
      type: "BUY"
    });
    
    return true;
  }

  static async executeSellOrder(userId: string, tokenId: string, amount: number, price: number): Promise<boolean> {
    // Add USD to seller
    const totalEarnings = amount * price;
    const currentBalance = await this.getUserBalance(userId);
    const newBalance = currentBalance + totalEarnings;
    
    const { error: balanceError } = await supabase
      .from("profiles")
      .update({ usd_balance: newBalance })
      .eq("id", userId);
    
    if (balanceError) {
      console.error("Error updating balance:", balanceError);
      return false;
    }
    
    // Remove tokens from seller's holdings
    await this.updateHoldings(userId, tokenId, -amount, price);
    
    // Record price change in history
    await this.updateTokenPrice(tokenId, price);

    // Log the trade
    await this.logTrade({
      seller_id: userId,
      token_id: tokenId,
      amount: amount,
      price: price,
      type: "SELL"
    });
    
    return true;
  }

  // ========== HOLDINGS ==========
  static async getUserHoldings(userId: string): Promise<Holding[]> {
    const { data, error } = await supabase
      .from("holdings")
      .select(`
        *,
        tokens (
          ticker,
          name,
          current_price,
          image_url
        )
      `)
      .eq("user_id", userId)
      .gt("amount", 0);
    
    if (error) {
      console.error("Error fetching holdings:", error);
      return [];
    }
    
    return data || [];
  }

  static async getUserHolding(userId: string, tokenId: string): Promise<Holding | null> {
      const { data } = await supabase
        .from("holdings")
        .select("*")
        .eq("user_id", userId)
        .eq("token_id", tokenId)
        .single();
      return data;
  }

  private static async updateHoldings(
    userId: string,
    tokenId: string,
    amountChange: number,
    price: number // USD Price at transaction time (0 for swaps if not tracking cost basis)
  ): Promise<void> {
    const { data: existing } = await supabase
      .from("holdings")
      .select("*")
      .eq("user_id", userId)
      .eq("token_id", tokenId)
      .maybeSingle(); // Safe for null
    
    if (existing) {
      const newAmount = existing.amount + amountChange;
      
      let newAvgPrice = existing.avg_buy_price;
      // Simple Average Cost Basis logic
      if (amountChange > 0 && price > 0) {
        const totalCost = (existing.amount * existing.avg_buy_price) + (amountChange * price);
        newAvgPrice = totalCost / newAmount;
      }
      
      if (newAmount <= 0.000001) { // Floating point safety
        await supabase
          .from("holdings")
          .delete()
          .eq("id", existing.id);
      } else {
        await supabase
          .from("holdings")
          .update({
            amount: newAmount,
            avg_buy_price: newAvgPrice
          })
          .eq("id", existing.id);
      }
    } else if (amountChange > 0) {
      await supabase
        .from("holdings")
        .insert({
          user_id: userId,
          token_id: tokenId,
          amount: amountChange,
          avg_buy_price: price
        });
    }
  }

  // ========== METRICS ==========
  static async getPlatformMetrics() {
    const { data, error } = await supabase.rpc('get_platform_metrics');
    
    if (error) {
      // Return fallback if RPC fails
      return {
        users: 0,
        tokens: 0,
        marketCap: 0
      };
    }
    
    const metrics = data as { users: number; tokens: number; marketCap: number } | null;
    
    return {
      users: metrics?.users || 0,
      tokens: metrics?.tokens || 0,
      marketCap: metrics?.marketCap || 0
    };
  }

  // ========== ACCOUNT DELETION ==========
  static async canDeleteAccount(userId: string): Promise<{ canDelete: boolean; reason?: string; tokensInCirculation?: number }> {
    // Check if user has issued a token
    const token = await this.getUserIssuedToken(userId);
    
    if (!token) {
      return { canDelete: true }; // No token issued, can delete
    }
    
    // Check if user owns 100% of their token supply
    const holding = await this.getUserHolding(userId, token.id);
    
    if (!holding || holding.amount < token.total_supply) {
      const ownedPercentage = holding ? ((holding.amount / token.total_supply) * 100).toFixed(2) : "0";
      return {
        canDelete: false,
        reason: `You only own ${ownedPercentage}% of your token supply. You must own 100% to delete your account.`
      };
    }
    
    return { canDelete: true };
  }

  static async deleteAccount(userId: string): Promise<void> {
    try {
      // First verify they can delete
      const { canDelete } = await this.canDeleteAccount(userId);
      if (!canDelete) {
        console.error("User cannot delete account - conditions not met");
        return;
      }

      // Get user's token if exists
      const token = await this.getUserIssuedToken(userId);
      
      // Delete in correct order for referential integrity:
      // 1. Delete all orders related to the token
      if (token) {
        await supabase.from("orders").delete().eq("token_id", token.id);
        await supabase.from("orders").delete().eq("user_id", userId);
      }
      
      // 2. Delete all holdings
      await supabase.from("holdings").delete().eq("user_id", userId);
      
      // 3. Delete the token
      if (token) {
        await supabase.from("tokens").delete().eq("id", token.id);
      }
      
      // 4. Delete the profile (this will cascade to auth.users due to trigger)
      const { error } = await supabase.from("profiles").delete().eq("id", userId);
      
      if (error) {
        console.error("Error deleting profile:", error);
        return;
      }
      
      // 5. Sign out the user
      await supabase.auth.signOut();
      
      return;
    } catch (error) {
      console.error("Error during account deletion:", error);
      return;
    }
  }

  // ========== PAYMENTS & TRANSFERS ==========
  static async transferTokens(
    fromUserId: string,
    toUserId: string,
    tokenTicker: string,
    amount: number
  ): Promise<void> {
    // 1. Get Token ID from Ticker
    const { data: token, error: tokenError } = await supabase
      .from("tokens")
      .select("id")
      .eq("ticker", tokenTicker)
      .single();
      
    if (tokenError || !token) throw new Error("Token not found");
    
    // 2. Verify Sender Balance
    const { data: senderHolding, error: senderError } = await supabase
      .from("holdings")
      .select("*")
      .eq("user_id", fromUserId)
      .eq("token_id", token.id)
      .single();
      
    if (senderError || !senderHolding || senderHolding.amount < amount) {
      throw new Error("Insufficient balance");
    }
    
    // 3. Update Sender (Deduct)
    const newSenderAmount = senderHolding.amount - amount;
    if (newSenderAmount <= 0.000001) {
       await supabase.from("holdings").delete().eq("id", senderHolding.id);
    } else {
       await supabase.from("holdings").update({ amount: newSenderAmount }).eq("id", senderHolding.id);
    }
    
    // 4. Update Recipient (Add)
    const { data: recipientHolding } = await supabase
      .from("holdings")
      .select("*")
      .eq("user_id", toUserId)
      .eq("token_id", token.id)
      .maybeSingle();
      
    if (recipientHolding) {
      await supabase
        .from("holdings")
        .update({ amount: recipientHolding.amount + amount })
        .eq("id", recipientHolding.id);
    } else {
      await supabase
        .from("holdings")
        .insert({
          user_id: toUserId,
          token_id: token.id,
          amount: amount,
          avg_buy_price: 0 // Gift/Payment has 0 cost basis for now
        });
    }
  }

  // ========== INITIALIZATION ==========
  static async initializeDemoData(): Promise<void> {
    // Only verify if we have tokens
    const { count } = await supabase.from("tokens").select("*", { count: 'exact', head: true });
    if (count && count > 0) return;
    
    console.log("Initializing demo data in Supabase...");
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    // Create demo tokens... (Logic similar to before)
    // For brevity in this update, we assume user can create tokens via UI
  }
}

// Export helper functions
export const getStoredUsers = () => DataService.getUsers();
export const getStoredTokens = () => DataService.getAllTokens();
export const getStoredOrders = () => DataService.getAllOrders();
export const getUserHoldings = (userId: string) => DataService.getUserHoldings(userId);