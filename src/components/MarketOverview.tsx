import { useState, useEffect } from "react";
import { DataService, Token } from "@/lib/dataService";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Users, Coins, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function MarketOverview() {
  const { language, t } = useLanguage();
  const [tokens, setTokens] = useState<Token[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [stats, setStats] = useState({ users: 0, tokens: 0, marketCap: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMarketData();
  }, []);

  const loadMarketData = async () => {
    try {
      const allTokens = await DataService.getAllTokens();
      setTokens(allTokens);
      
      const uniqueUsers = new Set(allTokens.map(t => t.issuer_id)).size;
      const totalMarketCap = allTokens.reduce((sum, t) => sum + t.market_cap, 0);
      
      setStats({
        users: uniqueUsers,
        tokens: allTokens.length,
        marketCap: totalMarketCap
      });
    } catch (error) {
      console.error("Failed to load market data", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTokens = tokens.filter(token =>
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
          <CardHeader>
            <CardTitle className="text-2xl font-bold">{t("market.title")}</CardTitle>
            <CardDescription>{t("landing.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
                className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg"
              >
                <Users className="w-8 h-8 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">{t("landing.stats.users")}</p>
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
                  <p className="text-sm text-muted-foreground">{t("landing.stats.tokens")}</p>
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
                  <p className="text-sm text-muted-foreground">{t("landing.stats.market_cap")}</p>
                  <p className="text-2xl font-bold">${stats.marketCap.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
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
               <div className="text-center py-12 text-muted-foreground">{t("common.loading")}</div>
            ) : filteredTokens.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12 text-muted-foreground"
              >
                {t("market.no_tokens")}
              </motion.div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTokens.map((token, index) => (
                  <motion.div
                    key={token.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    whileHover={{ scale: 1.02, y: -5 }}
                    className="group"
                  >
                    <Card key={token.id} className="overflow-hidden hover:shadow-lg transition-shadow border-border/50 bg-card">
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-3">
                            <Avatar className="w-12 h-12 border-2 border-background shadow-sm">
                              <AvatarImage src={token.image_url || ""} className="object-cover" />
                              <AvatarFallback className="text-lg bg-primary/10 text-primary font-bold">
                                {token.ticker.substring(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <CardTitle className="text-xl font-display">{token.ticker}</CardTitle>
                              <div className="text-sm text-muted-foreground">{token.name}</div>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">{t("issue.net_worth")}</span>
                            <span className="font-semibold">${token.net_worth.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">{t("market.price")}</span>
                            <span className="font-semibold text-primary">${token.current_price.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">{t("issue.total_supply")}</span>
                            <span className="font-semibold">{token.total_supply.toLocaleString()}</span>
                          </div>
                        </div>
                        <Button className="w-full" variant="default">
                          {t("trading.tabs.buy")}
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}