import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertCircle, ArrowRightLeft, Coins } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import type { Tables } from "@/integrations/supabase/types";

type Token = Tables<"tokens">;
type AmmPool = Tables<"amm_pools"> & { token?: Token };

interface UserProfile {
  mmc_balance: number;
  has_exchanged_equity: boolean;
}

export function AMM() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [pools, setPools] = useState<AmmPool[]>([]);
  const [selectedPool, setSelectedPool] = useState<AmmPool | null>(null);
  const [userHolding, setUserHolding] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // Form states
  const [buyAmount, setBuyAmount] = useState<number>(0);
  const [sellAmount, setSellAmount] = useState<number>(0);

  useEffect(() => {
    if (user?.id) {
      loadData();
    }
  }, [user]);

  useEffect(() => {
    if (selectedPool && user?.id) {
      loadUserHolding();
    }
  }, [selectedPool, user]);

  const loadData = async () => {
    setLoading(true);
    
    // Load user profile
    const { data: profileData } = await supabase
      .from("profiles")
      .select("mmc_balance, has_exchanged_equity")
      .eq("id", user!.id)
      .single();

    if (profileData) {
      setProfile({
        mmc_balance: profileData.mmc_balance || 0,
        has_exchanged_equity: profileData.has_exchanged_equity || false,
      });
    }

    // Load pools with token info
    const { data: poolsData } = await supabase
      .from("amm_pools")
      .select(`
        *,
        token:tokens(*)
      `);

    if (poolsData && poolsData.length > 0) {
      setPools(poolsData);
      if (!selectedPool) {
        setSelectedPool(poolsData[0]);
      }
    }

    setLoading(false);
  };

  const loadUserHolding = async () => {
    if (!selectedPool || !user?.id) return;

    const { data } = await supabase
      .from("holdings")
      .select("amount")
      .eq("user_id", user.id)
      .eq("token_id", selectedPool.token_id)
      .single();

    setUserHolding(data?.amount || 0);
  };

  const handleBuy = async () => {
    if (!selectedPool || !buyAmount || buyAmount <= 0) return;

    const { data, error } = await supabase.rpc("buy_from_amm", {
      p_token_id: selectedPool.token_id,
      p_mmc_amount: buyAmount,
    });

    if (error) {
      toast({
        title: t("common.error"),
        description: t("amm.error_generic"),
        variant: "destructive",
      });
      return;
    }

    const result = data as { success: boolean; error?: string; tokens_received?: number };

    if (!result.success) {
      toast({
        title: t("common.error"),
        description: result.error || t("amm.error_generic"),
        variant: "destructive",
      });
      return;
    }

    toast({
      title: t("common.success"),
      description: t("amm.success_buy", {
        amount: result.tokens_received?.toFixed(4),
        ticker: selectedPool.token?.ticker,
      }),
    });

    setBuyAmount(0);
    loadData();
    loadUserHolding();
  };

  const handleSell = async () => {
    if (!selectedPool || !sellAmount || sellAmount <= 0) return;

    const { data, error } = await supabase.rpc("sell_to_amm", {
      p_token_id: selectedPool.token_id,
      p_token_amount: sellAmount,
    });

    if (error) {
      toast({
        title: t("common.error"),
        description: t("amm.error_generic"),
        variant: "destructive",
      });
      return;
    }

    const result = data as { success: boolean; error?: string; mmc_received?: number };

    if (!result.success) {
      toast({
        title: t("common.error"),
        description: result.error || t("amm.error_generic"),
        variant: "destructive",
      });
      return;
    }

    toast({
      title: t("common.success"),
      description: t("amm.success_sell", {
        amount: sellAmount.toFixed(4),
        ticker: selectedPool.token?.ticker,
      }),
    });

    setSellAmount(0);
    loadData();
    loadUserHolding();
  };

  // Calculate estimated output for buy
  const estimatedTokensOut = () => {
    if (!selectedPool || !buyAmount || buyAmount <= 0) return 0;
    const k = selectedPool.mmc_reserve * selectedPool.token_reserve;
    const newMmcReserve = selectedPool.mmc_reserve + buyAmount;
    const newTokenReserve = k / newMmcReserve;
    return selectedPool.token_reserve - newTokenReserve;
  };

  // Calculate estimated output for sell
  const estimatedMmcOut = () => {
    if (!selectedPool || !sellAmount || sellAmount <= 0) return 0;
    const k = selectedPool.mmc_reserve * selectedPool.token_reserve;
    const newTokenReserve = selectedPool.token_reserve + sellAmount;
    const newMmcReserve = k / newTokenReserve;
    return selectedPool.mmc_reserve - newMmcReserve;
  };

  const currentPrice = () => {
    if (!selectedPool || selectedPool.token_reserve <= 0) return 0;
    return selectedPool.mmc_reserve / selectedPool.token_reserve;
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        {t("common.loading")}
      </div>
    );
  }

  // Not eligible - show message
  if (!profile?.has_exchanged_equity) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-lg mx-auto mt-12"
      >
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t("amm.not_eligible_title")}</AlertTitle>
          <AlertDescription className="mt-2">
            {t("amm.not_eligible_desc")}
          </AlertDescription>
        </Alert>
        <Button className="mt-4 w-full" variant="outline">
          {t("amm.go_to_game_room")}
        </Button>
      </motion.div>
    );
  }

  // No pools available
  if (pools.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        {t("amm.no_pools")}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-display">{t("amm.title")}</h2>
          <p className="text-muted-foreground text-sm">{t("amm.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-lg border border-primary/20">
          <Coins className="w-5 h-5 text-primary" />
          <div>
            <div className="text-xs text-muted-foreground">{t("amm.your_mmc_balance")}</div>
            <div className="font-mono font-bold text-primary">
              {profile?.mmc_balance.toFixed(2)} MMC
            </div>
          </div>
        </div>
      </div>

      {/* Pool Selector */}
      <div className="flex items-center gap-3 overflow-x-auto pb-3">
        {pools.map((pool) => (
          <button
            key={pool.id}
            onClick={() => setSelectedPool(pool)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all whitespace-nowrap ${
              selectedPool?.id === pool.id
                ? "bg-primary text-primary-foreground border-primary shadow-md"
                : "bg-card hover:bg-muted border-transparent"
            }`}
          >
            <Avatar className="w-5 h-5">
              <AvatarImage src={pool.token?.image_url || ""} className="object-cover" />
              <AvatarFallback className="text-[10px] bg-muted text-muted-foreground">
                {pool.token?.ticker?.substring(0, 2)}
              </AvatarFallback>
            </Avatar>
            <span className="font-bold font-display">{pool.token?.ticker}</span>
          </button>
        ))}
      </div>

      {selectedPool && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Pool Info */}
          <div className="lg:col-span-8 space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-4">
                  <Avatar className="w-16 h-16 border-2 border-border">
                    <AvatarImage src={selectedPool.token?.image_url || ""} className="object-cover" />
                    <AvatarFallback className="text-2xl bg-primary/10 text-primary font-bold">
                      {selectedPool.token?.ticker?.substring(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-2xl">
                      {selectedPool.token?.ticker}/MMC
                    </CardTitle>
                    <CardDescription>{selectedPool.token?.name}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 rounded-lg bg-muted/30 border border-border">
                    <div className="text-xs text-muted-foreground uppercase tracking-wider">
                      {t("amm.current_price")}
                    </div>
                    <div className="font-bold mt-1 font-mono text-foreground">
                      {currentPrice().toFixed(4)} MMC
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30 border border-border">
                    <div className="text-xs text-muted-foreground uppercase tracking-wider">
                      {t("amm.mmc_reserve")}
                    </div>
                    <div className="font-bold mt-1 font-mono text-foreground">
                      {selectedPool.mmc_reserve.toLocaleString()}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30 border border-border">
                    <div className="text-xs text-muted-foreground uppercase tracking-wider">
                      {t("amm.token_reserve")}
                    </div>
                    <div className="font-bold mt-1 font-mono text-foreground">
                      {selectedPool.token_reserve.toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* User holding */}
                <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="text-xs text-muted-foreground">
                    {t("amm.your_token_balance", { ticker: selectedPool.token?.ticker })}
                  </div>
                  <div className="font-bold font-mono text-primary">
                    {userHolding.toFixed(4)} {selectedPool.token?.ticker}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Trading Panel */}
          <div className="lg:col-span-4">
            <Tabs defaultValue="buy" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-muted">
                <TabsTrigger value="buy">{t("amm.buy_title", { ticker: selectedPool.token?.ticker })}</TabsTrigger>
                <TabsTrigger value="sell">{t("amm.sell_title", { ticker: selectedPool.token?.ticker })}</TabsTrigger>
              </TabsList>

              <TabsContent value="buy" className="space-y-3 mt-3">
                <Card className="border-primary/20">
                  <CardContent className="pt-4 space-y-3">
                    <div>
                      <Label className="text-xs">{t("amm.mmc_to_spend")}</Label>
                      <Input
                        type="number"
                        value={buyAmount || ""}
                        onChange={(e) => setBuyAmount(Number(e.target.value))}
                        placeholder="0.00"
                        className="mt-1 bg-background/50 h-9"
                      />
                    </div>

                    {buyAmount > 0 && (
                      <div className="p-2 bg-muted/30 rounded-lg border border-border/50 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t("amm.you_receive")}:</span>
                          <span className="font-mono text-primary">
                            ~{estimatedTokensOut().toFixed(4)} {selectedPool.token?.ticker}
                          </span>
                        </div>
                        <div className="flex justify-between mt-1">
                          <span className="text-muted-foreground">{t("amm.price_per_token")}:</span>
                          <span className="font-mono">
                            {(buyAmount / estimatedTokensOut()).toFixed(4)} MMC
                          </span>
                        </div>
                      </div>
                    )}

                    <Button
                      onClick={handleBuy}
                      className="w-full bg-primary hover:bg-primary/90 h-9"
                      disabled={!buyAmount || buyAmount <= 0 || buyAmount > (profile?.mmc_balance || 0)}
                    >
                      <ArrowRightLeft className="w-4 h-4 mr-2" />
                      {t("amm.buy_button")}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="sell" className="space-y-3 mt-3">
                <Card className="border-orange-500/20">
                  <CardContent className="pt-4 space-y-3">
                    <div>
                      <Label className="text-xs">{t("amm.tokens_to_sell")}</Label>
                      <Input
                        type="number"
                        value={sellAmount || ""}
                        onChange={(e) => setSellAmount(Number(e.target.value))}
                        placeholder="0.00"
                        className="mt-1 bg-background/50 h-9"
                      />
                    </div>

                    {sellAmount > 0 && (
                      <div className="p-2 bg-muted/30 rounded-lg border border-border/50 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t("amm.you_receive")}:</span>
                          <span className="font-mono text-primary">
                            ~{estimatedMmcOut().toFixed(4)} MMC
                          </span>
                        </div>
                        <div className="flex justify-between mt-1">
                          <span className="text-muted-foreground">{t("amm.price_per_token")}:</span>
                          <span className="font-mono">
                            {(estimatedMmcOut() / sellAmount).toFixed(4)} MMC
                          </span>
                        </div>
                      </div>
                    )}

                    <Button
                      onClick={handleSell}
                      className="w-full bg-orange-500 hover:bg-orange-600 h-9"
                      disabled={!sellAmount || sellAmount <= 0 || sellAmount > userHolding}
                    >
                      <ArrowRightLeft className="w-4 h-4 mr-2" />
                      {t("amm.sell_button")}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      )}
    </motion.div>
  );
}