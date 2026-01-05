import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowRight, TrendingUp, TrendingDown } from "lucide-react";
import { DataService, type Token, type Order, type Holding } from "@/lib/dataService";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";
import { TransactionHistory } from "./TransactionHistory";

// Simple Price Chart Component with REAL DATA from Supabase
function PriceChart({
  currentPrice,
  ticker,
  tokenId,
}: {
  currentPrice: number;
  ticker: string;
  tokenId: string;
}) {
  const { t } = useLanguage();
  const [chartData, setChartData] = useState<Array<{ timestamp: string; price: number }>>(
    []
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPriceHistory = async () => {
      setLoading(true);
      const history = await DataService.getPriceHistory(tokenId, 30);

      if (history.length > 0) {
        // Use real data from Supabase
        setChartData(history.map((h) => ({ timestamp: h.timestamp, price: h.price })));
      } else {
        // Fallback: If no history exists yet (brand new token), show only current price
        setChartData([{ timestamp: new Date().toISOString(), price: currentPrice }]);
      }
      setLoading(false);
    };

    loadPriceHistory();
  }, [tokenId, currentPrice]);

  if (loading) {
    return (
      <div className="relative w-full h-[220px] bg-muted/20 rounded-lg p-4 border border-border/50 flex items-center justify-center">
        <div className="text-sm text-muted-foreground">
          {t("trading.chart.loading_history")}
        </div>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="relative w-full h-[220px] bg-muted/20 rounded-lg p-4 border border-border/50 flex items-center justify-center">
        <div className="text-sm text-muted-foreground">
          {t("trading.chart.no_history")}
        </div>
      </div>
    );
  }

  const maxPrice = Math.max(...chartData.map((d) => d.price));
  const minPrice = Math.min(...chartData.map((d) => d.price));
  const priceRange = maxPrice - minPrice || 0.0001; // Prevent division by zero

  const svgHeight = 200;
  const svgWidth = 500;

  // Convert REAL data to SVG path
  const pathData = chartData
    .map((point, i) => {
      const x = (i / Math.max(chartData.length - 1, 1)) * svgWidth;
      const y = svgHeight - ((point.price - minPrice) / priceRange) * svgHeight;
      return `${i === 0 ? "M" : "L"} ${x},${y}`;
    })
    .join(" ");

  const isPositive =
    chartData.length > 1
      ? chartData[chartData.length - 1].price > chartData[0].price
      : true;

  const percentChange =
    chartData.length > 1
      ? ((chartData[chartData.length - 1].price - chartData[0].price) /
          chartData[0].price) *
        100
      : 0;

  return (
    <div className="relative w-full h-[220px] bg-muted/20 rounded-lg p-4 border border-border/50">
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className="text-sm text-muted-foreground">
            {t("trading.chart.pair_usd", { ticker })}
          </div>
          <div className="text-2xl font-bold font-mono">
            ${currentPrice.toFixed(4)}
          </div>
        </div>
        <div
          className={`flex items-center gap-1 px-2 py-1 rounded-md ${
            isPositive
              ? "bg-emerald-500/10 text-emerald-500"
              : "bg-red-500/10 text-red-500"
          }`}
        >
          {isPositive ? (
            <TrendingUp className="w-4 h-4" />
          ) : (
            <TrendingDown className="w-4 h-4" />
          )}
          <span className="text-sm font-mono font-bold">
            {percentChange > 0 ? "+" : ""}
            {percentChange.toFixed(2)}%
          </span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full h-[140px]"
        preserveAspectRatio="none"
      >
        {/* Grid lines */}
        <line
          x1="0"
          y1={svgHeight * 0.25}
          x2={svgWidth}
          y2={svgHeight * 0.25}
          stroke="currentColor"
          strokeWidth="0.5"
          className="text-border opacity-30"
        />
        <line
          x1="0"
          y1={svgHeight * 0.5}
          x2={svgWidth}
          y2={svgHeight * 0.5}
          stroke="currentColor"
          strokeWidth="0.5"
          className="text-border opacity-30"
        />
        <line
          x1="0"
          y1={svgHeight * 0.75}
          x2={svgWidth}
          y2={svgHeight * 0.75}
          stroke="currentColor"
          strokeWidth="0.5"
          className="text-border opacity-30"
        />

        {/* Gradient fill */}
        <defs>
          <linearGradient
            id={`priceGradient-${tokenId}`}
            x1="0%"
            y1="0%"
            x2="0%"
            y2="100%"
          >
            <stop
              offset="0%"
              stopColor={isPositive ? "#10b981" : "#ef4444"}
              stopOpacity="0.3"
            />
            <stop
              offset="100%"
              stopColor={isPositive ? "#10b981" : "#ef4444"}
              stopOpacity="0"
            />
          </linearGradient>
        </defs>

        {/* Area under curve */}
        <motion.path
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          d={`${pathData} L ${svgWidth},${svgHeight} L 0,${svgHeight} Z`}
          fill={`url(#priceGradient-${tokenId})`}
        />

        {/* Price line */}
        <motion.path
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          d={pathData}
          fill="none"
          stroke={isPositive ? "#10b981" : "#ef4444"}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

export function Trading() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();

  const [tokens, setTokens] = useState<Token[]>([]);
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [holdings, setHoldings] = useState<Holding[]>([]);

  // Order Book State
  const [orders, setOrders] = useState<Order[]>([]);
  const [swapOffers, setSwapOffers] = useState<(Order & { payment_token?: Token })[]>(
    []
  );

  // Form States - USD Trading
  const [buyAmount, setBuyAmount] = useState<number>(0);
  const [buyPrice, setBuyPrice] = useState<number>(0);
  const [sellAmount, setSellAmount] = useState<number>(0);
  const [sellPrice, setSellPrice] = useState<number>(0);

  // Swap Form States
  const [receiveAmount, setReceiveAmount] = useState<number>(0);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [paymentTokenId, setPaymentTokenId] = useState<string>("");

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (selectedToken) {
      loadOrderBook(selectedToken.id);
      setBuyPrice(selectedToken.current_price);
      setSellPrice(selectedToken.current_price);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedToken]);

  const loadData = async () => {
    const allTokens = await DataService.getAllTokens();
    setTokens(allTokens);

    if (allTokens.length > 0 && !selectedToken) {
      setSelectedToken(allTokens[0]);
    }

    if (user?.id) {
      const myHoldings = await DataService.getUserHoldings(user.id);
      setHoldings(myHoldings);
      if (myHoldings.length > 0) {
        setPaymentTokenId(myHoldings[0].token_id);
      }
    }
  };

  const loadOrderBook = async (tokenId: string) => {
    const activeOrders = await DataService.getActiveOrdersForToken(tokenId);
    setOrders(activeOrders);

    const swaps = await DataService.getSwapOffersForToken(tokenId);
    setSwapOffers(swaps);
  };

  const handleOrder = async (type: "buy" | "sell") => {
    if (!selectedToken || !user) return;

    const amount = type === "buy" ? buyAmount : sellAmount;
    const price = type === "buy" ? buyPrice : sellPrice;

    if (!amount || !price) {
      toast({
        title: t("common.error"),
        description: t("common.required"),
        variant: "destructive",
      });
      return;
    }

    const numAmount = Number(amount);
    const numPrice = Number(price);

    if (type === "buy") {
      const validation = await DataService.validateBuyOrder(user.id, numAmount, numPrice);
      if (!validation.valid) {
        toast({
          title: t("common.error"),
          description: validation.message,
          variant: "destructive",
        });
        return;
      }
    } else {
      const validation = await DataService.validateSellOrder(
        user.id,
        selectedToken.id,
        numAmount
      );
      if (!validation.valid) {
        toast({
          title: t("common.error"),
          description: validation.message,
          variant: "destructive",
        });
        return;
      }
    }

    let success = false;
    if (type === "buy") {
      success = await DataService.executeBuyOrder(
        user.id,
        selectedToken.id,
        numAmount,
        numPrice
      );
    } else {
      success = await DataService.executeSellOrder(
        user.id,
        selectedToken.id,
        numAmount,
        numPrice
      );
    }

    if (success) {
      toast({
        title: t("common.success"),
        description: type === "buy" ? t("trading.success.buy") : t("trading.success.sell"),
      });

      setBuyAmount(0);
      setBuyPrice(selectedToken.current_price);
      setSellAmount(0);
      setSellPrice(selectedToken.current_price);

      loadOrderBook(selectedToken.id);
      loadData();
    } else {
      toast({
        title: t("common.error"),
        description: t("trading.errors.transaction_failed"),
        variant: "destructive",
      });
    }
  };

  const handleSwapOffer = async () => {
    if (!selectedToken || !user || !paymentTokenId) return;

    if (!receiveAmount || !payAmount) {
      toast({
        title: t("common.error"),
        description: t("common.required"),
        variant: "destructive",
      });
      return;
    }

    const amountToBuy = Number(receiveAmount);
    const amountToPay = Number(payAmount);

    const validation = await DataService.validateSwapOffer(user.id, paymentTokenId, amountToPay);
    if (!validation.valid) {
      toast({
        title: t("common.error"),
        description: validation.message,
        variant: "destructive",
      });
      return;
    }

    // price debe ser receiveAmount / payAmount
    const impliedPrice = amountToBuy / amountToPay;

    const order = await DataService.createOrder({
      token_id: paymentTokenId, // Token que DOY (Y)
      user_id: user.id,
      type: "buy",
      amount: amountToPay, // Cantidad que DOY (Y_amount)
      price: impliedPrice, // receiveAmount / payAmount
      payment_token_id: selectedToken.id, // Token que QUIERO (X)
    });

    if (order) {
      toast({
        title: t("common.success"),
        description: t("trading.swap.offer_created"),
      });

      setReceiveAmount(0);
      setPayAmount(0);

      loadOrderBook(selectedToken.id);
    } else {
      toast({
        title: t("common.error"),
        description: t("trading.swap.offer_create_failed"),
        variant: "destructive",
      });
    }
  };

  const handleAcceptSwap = async (offerId: string) => {
    if (!user || !selectedToken) return;

    const result = await DataService.executeSwap(offerId, user.id);

    if (result.success) {
      toast({
        title: t("common.success"),
        description: t("trading.swap.success_msg"),
      });
      loadOrderBook(selectedToken.id);
      loadData();
    } else {
      toast({
        title: t("common.error"),
        description: result.error || t("trading.swap.failed"),
        variant: "destructive",
      });
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!user) return;

    const success = await DataService.cancelOrder(orderId, user.id);

    if (success) {
      toast({
        title: t("common.success"),
        description: t("trading.order.cancel_success"),
      });
      if (selectedToken) loadOrderBook(selectedToken.id);
    } else {
      toast({
        title: t("common.error"),
        description: t("trading.order.cancel_failed"),
        variant: "destructive",
      });
    }
  };

  if (!selectedToken) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        {t("trading.loading_market")}
      </div>
    );
  }

  const myPaymentHoldings = holdings;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-4"
    >
      {/* Token Selector Bar */}
      <div className="flex items-center gap-3 overflow-x-auto pb-3 scrollbar-thin scrollbar-thumb-secondary">
        {tokens.map((token) => (
          <button
            key={token.id}
            onClick={() => setSelectedToken(token)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all whitespace-nowrap ${
              selectedToken.id === token.id
                ? "bg-primary text-primary-foreground border-primary shadow-md"
                : "bg-card hover:bg-muted border-transparent"
            }`}
          >
            <Avatar className="w-5 h-5">
              <AvatarImage src={token.image_url || ""} className="object-cover" />
              <AvatarFallback className="text-[10px] bg-muted text-muted-foreground">
                {token.ticker.substring(0, 2)}
              </AvatarFallback>
            </Avatar>
            <span className="font-bold font-display">{token.ticker}</span>
            <span className="text-xs opacity-70 font-mono">${token.current_price}</span>
          </button>
        ))}
      </div>

      {/* Main Trading Layout - 3 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* LEFT COLUMN: Token Info + Chart (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          {/* Token Header Card */}
          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-4">
                  <Avatar className="w-16 h-16 border-2 border-border">
                    <AvatarImage
                      src={selectedToken.image_url || ""}
                      className="object-cover"
                    />
                    <AvatarFallback className="text-2xl bg-primary/10 text-primary font-bold">
                      {selectedToken.ticker.substring(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-3xl font-display font-bold text-foreground">
                        {selectedToken.ticker}
                      </span>
                      <span className="text-lg text-muted-foreground font-sans">
                        {selectedToken.name}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {selectedToken.description}
                    </p>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-lg bg-muted/30 border border-border">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">
                    {t("market.market_cap")}
                  </div>
                  <div className="font-bold mt-1 font-mono text-foreground">
                    ${selectedToken.market_cap.toLocaleString()}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-muted/30 border border-border">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">
                    {t("market.total_supply")}
                  </div>
                  <div className="font-bold mt-1 font-mono text-foreground">
                    {selectedToken.total_supply.toLocaleString()}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-muted/30 border border-border">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">
                    {t("portfolio.balance")}
                  </div>
                  <div className="font-bold mt-1 font-mono text-foreground">
                    {holdings.find((h) => h.token_id === selectedToken.id)?.amount.toFixed(2) ||
                      "0.00"}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Price Chart */}
          <PriceChart
            currentPrice={selectedToken.current_price}
            ticker={selectedToken.ticker}
            tokenId={selectedToken.id}
          />
        </div>

        {/* RIGHT COLUMN: Trading Panel + Order Book (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Trading Panel */}
          <Tabs defaultValue="usd" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-muted">
              <TabsTrigger value="usd">{t("trading.tabs.usd")}</TabsTrigger>
              <TabsTrigger value="swap">{t("trading.tabs.swap")}</TabsTrigger>
            </TabsList>

            <TabsContent value="usd" className="space-y-3 mt-3">
              {/* Buy Panel */}
              <Card className="border-primary/20">
                <CardHeader className="pb-3">
                  <div className="text-base font-display text-primary font-bold">
                    {t("trading.buy_title", { ticker: selectedToken.ticker })}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-foreground text-xs">{t("trading.amount")}</Label>
                    <Input
                      type="number"
                      value={buyAmount || ""}
                      onChange={(e) => setBuyAmount(Number(e.target.value))}
                      placeholder={t("trading.placeholders.amount")}
                      className="mt-1 bg-background/50 h-9"
                    />
                  </div>
                  <div>
                    <Label className="text-foreground text-xs">{t("trading.price_usd")}</Label>
                    <Input
                      type="number"
                      value={buyPrice}
                      onChange={(e) => setBuyPrice(Number(e.target.value))}
                      placeholder={t("trading.placeholders.price")}
                      className="mt-1 bg-background/50 h-9"
                    />
                  </div>
                  <Button
                    onClick={() => handleOrder("buy")}
                    className="w-full bg-primary hover:bg-primary/90 h-9"
                  >
                    {t("trading.place_buy_order")}
                  </Button>
                </CardContent>
              </Card>

              {/* Sell Panel */}
              <Card className="border-orange-500/20">
                <CardHeader className="pb-3">
                  <div className="text-base font-display text-orange-500 font-bold">
                    {t("trading.sell_title", { ticker: selectedToken.ticker })}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-foreground text-xs">{t("trading.amount")}</Label>
                    <Input
                      type="number"
                      value={sellAmount || ""}
                      onChange={(e) => setSellAmount(Number(e.target.value))}
                      placeholder={t("trading.placeholders.amount")}
                      className="mt-1 bg-background/50 h-9"
                    />
                  </div>
                  <div>
                    <Label className="text-foreground text-xs">{t("trading.price_usd")}</Label>
                    <Input
                      type="number"
                      value={sellPrice}
                      onChange={(e) => setSellPrice(Number(e.target.value))}
                      placeholder={t("trading.placeholders.price")}
                      className="mt-1 bg-background/50 h-9"
                    />
                  </div>
                  <Button
                    onClick={() => handleOrder("sell")}
                    className="w-full bg-orange-500 hover:bg-orange-600 h-9"
                  >
                    {t("trading.place_sell_order")}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="swap" className="space-y-3 mt-3">
              <Card className="border-primary/20">
                <CardHeader className="pb-3">
                  <div className="text-base font-display text-primary font-bold">
                    {t("trading.swap.title")}
                  </div>
                  <CardDescription className="text-xs text-muted-foreground">
                    {t("trading.swap.subtitle", { ticker: selectedToken.ticker })}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-primary font-bold text-xs">
                      {t("trading.swap.want_receive")}
                    </Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        type="number"
                        value={receiveAmount || ""}
                        onChange={(e) => setReceiveAmount(Number(e.target.value))}
                        placeholder={t("trading.placeholders.amount")}
                        className="bg-background/50 h-9"
                      />
                      <div className="px-3 py-2 bg-primary/10 border border-primary/20 rounded-md flex items-center">
                        <span className="font-mono font-bold text-primary text-xs">
                          {selectedToken.ticker}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label className="text-foreground text-xs">
                      {t("trading.swap.pay_with")}
                    </Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        type="number"
                        value={payAmount || ""}
                        onChange={(e) => setPayAmount(Number(e.target.value))}
                        placeholder={t("trading.placeholders.amount")}
                        className="bg-background/50 h-9"
                      />

                      <Select value={paymentTokenId} onValueChange={setPaymentTokenId}>
                        <SelectTrigger className="w-[140px] h-9">
                          <SelectValue placeholder={t("trading.swap.token_placeholder")} />
                        </SelectTrigger>
                        <SelectContent>
                          {myPaymentHoldings.length === 0 && (
                            <SelectItem value="none" disabled>
                              {t("trading.swap.no_tokens")}
                            </SelectItem>
                          )}
                          {myPaymentHoldings.map((holding) => (
                            <SelectItem key={holding.token_id} value={holding.token_id}>
                              {holding.tokens?.ticker} ({holding.amount})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {receiveAmount > 0 && payAmount > 0 && (
                    <div className="p-2 bg-muted/30 rounded-lg border border-border/50 text-xs">
                      <span className="text-muted-foreground">
                        {t("trading.swap.exchange_rate")}:
                      </span>
                      <span className="ml-2 font-mono text-primary">
                        1 {selectedToken.ticker} ≈ {(payAmount / receiveAmount).toFixed(4)}{" "}
                        {myPaymentHoldings.find((h) => h.token_id === paymentTokenId)?.tokens
                          ?.ticker}
                      </span>
                    </div>
                  )}

                  <Button
                    onClick={handleSwapOffer}
                    className="w-full bg-primary hover:bg-primary/90 h-9"
                  >
                    {t("trading.swap.post_offer")}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Market Activity Panel - Tabs for Orders & Trades */}
          <div className="space-y-4">
            <Tabs defaultValue="orderbook" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-muted h-10">
                <TabsTrigger value="orderbook" className="text-xs">
                  {t("trading.order_book.title")}
                </TabsTrigger>
                <TabsTrigger value="history" className="text-xs">
                  {t("trading.history.title")}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="orderbook" className="mt-2">
                <Card className="border-border/50">
                  <CardContent className="p-0">
                    <div className="max-h-[300px] overflow-y-auto pt-2 px-2 pb-2">
                      <div className="grid grid-cols-3 text-[10px] text-muted-foreground px-2 mb-2 font-mono uppercase">
                        <div>{t("trading.order_book.amount")}</div>
                        <div className="text-center">{t("trading.order_book.price")}</div>
                        <div className="text-right">{t("trading.order_book.total")}</div>
                      </div>

                      <div className="space-y-1">
                        {orders.length === 0 ? (
                          <p className="text-center text-muted-foreground text-xs py-8">
                            {t("trading.no_active_orders")}
                          </p>
                        ) : (
                          orders.slice(0, 15).map((order) => (
                            <div
                              key={order.id}
                              className="grid grid-cols-3 items-center p-2 rounded hover:bg-muted/50 transition-colors text-xs"
                            >
                              <div className="flex items-center gap-1">
                                <span
                                  className={`w-1 h-8 rounded-sm ${
                                    order.type === "buy"
                                      ? "bg-green-500/50"
                                      : "bg-red-500/50"
                                  }`}
                                ></span>
                                <span className="font-mono">
                                  {order.amount.toLocaleString()}
                                </span>
                              </div>

                              <div className="text-center font-bold">
                                ${order.price.toFixed(2)}
                              </div>

                              <div className="text-right flex items-center justify-end gap-2">
                                <span className="text-muted-foreground opacity-50">
                                  $
                                  {(order.amount * order.price).toLocaleString(undefined, {
                                    maximumFractionDigits: 0,
                                  })}
                                </span>

                                {/* Action Buttons */}
                                {order.user_id === user?.id ? (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => handleCancelOrder(order.id)}
                                    className="h-5 w-5 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                    title={t("trading.swap.cancel")}
                                  >
                                    <span className="sr-only">{t("trading.swap.cancel")}</span>
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      className="w-3 h-3"
                                    >
                                      <path d="M18 6 6 18" />
                                      <path d="m6 6 18 18" />
                                    </svg>
                                  </Button>
                                ) : (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-5 w-5 rounded-full hover:bg-primary/20 hover:text-primary"
                                  >
                                    <TrendingUp className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="history" className="mt-2">
                <Card className="border-border/50">
                  <CardContent className="p-0">
                    <TransactionHistory tokenId={selectedToken.id} />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Swap Offers */}
          {swapOffers.length > 0 && (
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <div className="text-sm font-display font-bold">
                  {t("trading.swap.active_offers")}
                </div>
              </CardHeader>

              <CardContent className="max-h-[300px] overflow-y-auto">
                <div className="space-y-2">
                  {swapOffers.slice(0, 5).map((offer) => (
                    <div
                      key={offer.id}
                      className="p-2 bg-muted/30 rounded-lg border border-border/50 text-xs"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="text-muted-foreground">
                            {t("trading.swap.receives")}:
                          </span>
                          <div className="font-mono text-sm text-primary">
                            {offer.amount} {selectedToken.ticker}
                          </div>
                        </div>

                        <ArrowRight className="w-4 h-4 text-muted-foreground" />

                        <div>
                          <span className="text-muted-foreground">
                            {t("trading.swap.pays")}:
                          </span>
                          <div className="font-mono text-sm">
                            {offer.amount} {offer.payment_token?.ticker}
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 mt-2">
                        {offer.user_id !== user?.id ? (
                          <Button
                            onClick={() => handleAcceptSwap(offer.id)}
                            variant="outline"
                            className="w-full h-7 text-xs flex-1"
                          >
                            {t("trading.swap.accept")}
                          </Button>
                        ) : (
                          <Button
                            onClick={() => handleCancelOrder(offer.id)}
                            variant="destructive"
                            className="w-full h-7 text-xs flex-1 opacity-80 hover:opacity-100"
                          >
                            {t("trading.swap.cancel")}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </motion.div>
  );
}