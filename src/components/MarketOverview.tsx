import { useState, useEffect } from "react";
import { DataService, Token } from "@/lib/dataService";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Users, Coins, TrendingUp } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription as DialogDesc,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type TokenWithProfile = Token & {
  profiles?: { full_name: string | null; email: string | null } | null;
};

export function MarketOverview() {
  const { t } = useLanguage();
  const [tokens, setTokens] = useState<TokenWithProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [stats, setStats] = useState({ users: 0, tokens: 0, marketCap: 0 });
  const [loading, setLoading] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedToken, setSelectedToken] = useState<TokenWithProfile | null>(
    null
  );

  useEffect(() => {
    loadMarketData();
  }, []);

  const loadMarketData = async () => {
    try {
      const allTokens = await DataService.getAllTokens();
      setTokens(allTokens);

      const uniqueUsers = new Set(allTokens.map((tok) => tok.issuer_id)).size;
      const totalMarketCap = allTokens.reduce(
        (sum, tok) => sum + tok.market_cap,
        0
      );

      setStats({
        users: uniqueUsers,
        tokens: allTokens.length,
        marketCap: totalMarketCap,
      });
    } catch (error) {
      console.error("Failed to load market data", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTokens = tokens.filter(
    (token) =>
      token.ticker.toLowerCase().includes(searchQuery.toLowerCase()) ||
      token.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="border-border/50 bg-card shadow-lg">
          <CardHeader className="!p-3">
            <CardTitle className="text-2xl font-bold">
              {t("market.title")}
            </CardTitle>
            <CardDescription>{t("landing.description")}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 !p-3 !pt-0">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
                className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg"
              >
                <Users className="w-8 h-8 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t("landing.stats.users")}
                  </p>
                  <p className="text-2xl font-bold">{stats.users}</p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg"
              >
                <Coins className="w-8 h-8 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t("landing.stats.tokens")}
                  </p>
                  <p className="text-2xl font-bold">{stats.tokens}</p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 }}
                className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg"
              >
                <TrendingUp className="w-8 h-8 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t("landing.stats.market_cap")}
                  </p>
                  <p className="text-2xl font-bold">
                    $
                    {stats.marketCap.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}
                  </p>
                </div>
              </motion.div>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                type="text"
                placeholder={t("market.search")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-background"
              />
            </div>

            {loading ? (
              <div className="text-center py-12 text-muted-foreground">
                {t("common.loading")}
              </div>
            ) : filteredTokens.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12 text-muted-foreground"
              >
                {t("market.no_tokens")}
              </motion.div>
            ) : (
              <div className="grid gap-1 justify-center [grid-template-columns:repeat(auto-fit,minmax(260px,260px))]">
                {filteredTokens.map((token, index) => (
                  <motion.div
                    key={token.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    whileHover={{ scale: 1.02, y: -5 }}
                    className="group"
                  >
                    <Card className="overflow-hidden hover:shadow-lg transition-shadow border-border/50 bg-card aspect-square w-full flex flex-col justify-center">
                      <CardHeader className="pb-2 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="flex flex-col items-center gap-2">
                            <Avatar className="w-20 h-20 border-2 border-background shadow-sm">
                              <AvatarImage
                                src={token.image_url || ""}
                                className="object-cover"
                              />
                              <AvatarFallback className="text-lg bg-primary/10 text-primary font-bold">
                                {token.ticker.substring(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <CardTitle className="text-xl font-display text-center">
                                {token.ticker}
                              </CardTitle>
                              <div className="text-sm text-muted-foreground text-center">
                                {token.name}
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-3 flex justify-center">
                        <Button
                          className="mx-auto w-fit h-auto px-3 py-1.5 text-xs"
                          variant="default"
                          onClick={() => {
                            setSelectedToken(token);
                            setDetailsOpen(true);
                          }}
                        >
                          {t("market.view_details")}
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}

            <Dialog
              open={detailsOpen}
              onOpenChange={(open) => {
                setDetailsOpen(open);
                if (!open) setSelectedToken(null);
              }}
            >
              <DialogContent className="sm:max-w-xl">
                {selectedToken ? (
                  <>
                    <DialogHeader>
                      <div className="flex items-center gap-4">
                        <Avatar className="w-20 h-20 border-2 border-background shadow-sm">
                          <AvatarImage
                            src={selectedToken.image_url || ""}
                            className="object-cover"
                          />
                          <AvatarFallback className="text-2xl bg-primary/10 text-primary font-bold">
                            {selectedToken.ticker.substring(0, 2)}
                          </AvatarFallback>
                        </Avatar>

                        <div className="min-w-0">
                          <DialogTitle className="truncate">
                            {selectedToken.ticker} — {selectedToken.name}
                          </DialogTitle>
                          <DialogDesc>
                            {t("market.issued_by")}:{" "}
                            {selectedToken.profiles?.full_name ||
                              selectedToken.profiles?.email ||
                              t("common.not_available")}
                          </DialogDesc>
                        </div>
                      </div>
                    </DialogHeader>

                    <div className="mt-4 space-y-3 text-sm">
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">{t("issue.net_worth")}</span>
                        <span className="font-semibold">
                          ${selectedToken.net_worth.toLocaleString()}
                        </span>
                      </div>

                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">{t("market.price")}</span>
                        <span className="font-semibold text-primary">
                          ${selectedToken.current_price.toFixed(2)}
                        </span>
                      </div>

                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">{t("issue.total_supply")}</span>
                        <span className="font-semibold">
                          {selectedToken.total_supply.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </>
                ) : null}
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}