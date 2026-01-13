import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GameService, type RPSGameWithHost, type TTTGameWithHost } from "@/services/gameService";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Plus, RefreshCcw, Coins, DollarSign, Swords, Percent, AlertTriangle, Users, Copy, Check } from "lucide-react";

interface GameLobbyProps {
  onGameJoined: () => void;
}

export function GameLobby({ onGameJoined }: GameLobbyProps) {
  const { user } = useAuth();
  const { t } = useLanguage();

  const [selectedGame, setSelectedGame] = useState<"rps" | "ttt">("rps");
  const [games, setGames] = useState<Array<RPSGameWithHost | TTTGameWithHost>>([]);
  const [loading, setLoading] = useState(false);
  const [mmcBalance, setMmcBalance] = useState(0);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  const [isConvertOpen, setIsConvertOpen] = useState(false);
  const [convertAmount, setConvertAmount] = useState<string>("10");
  const [convertLoading, setConvertLoading] = useState(false);

  const [hasExchanged, setHasExchanged] = useState(false);
  const [exchangeLoading, setExchangeLoading] = useState(false);

  // Private Game State
  const [isPrivateGameOpen, setIsPrivateGameOpen] = useState(false);
  const [isJoinCodeOpen, setIsJoinCodeOpen] = useState(false);
  const [privateGameCode, setPrivateGameCode] = useState<string>("");
  const [joinCode, setJoinCode] = useState<string>("");
  const [codeCopied, setCodeCopied] = useState(false);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);

    const balance = await GameService.getMmcBalance(user.id);
    setMmcBalance(balance);

    const exchanged = await GameService.hasExchangedEquity(user.id);
    setHasExchanged(exchanged);

    const availableGames =
      selectedGame === "rps" ? await GameService.getAvailableGames() : await GameService.getAvailableTTTGames();

    setGames(availableGames);
    setLoading(false);
  };

  useEffect(() => {
    void loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, selectedGame]);

  const handleCreateGame = async () => {
    if (!user) return;

    setCreateLoading(true);

    const existing =
      selectedGame === "rps"
        ? await GameService.getUserActiveGame(user.id)
        : await GameService.getUserActiveTTTGame(user.id);

    if (existing) {
      setIsCreateOpen(false);
      onGameJoined();
      setCreateLoading(false);
      return;
    }

    const { success, error } =
      selectedGame === "rps" ? await GameService.createGame(0) : await GameService.createTTTGame(0);

    if (success) {
      setIsCreateOpen(false);
      toast({
        title: t("game_room.create_game_modal.created_title"),
        description: t("game_room.create_game_modal.created_desc"),
      });
      onGameJoined();
    } else {
      toast({
        title: t("common.error"),
        description: error || t("game_room.errors.create_failed"),
        variant: "destructive",
      });
    }

    setCreateLoading(false);
  };

  const handleCreatePrivateGame = async () => {
    if (!user) return;
    setCreateLoading(true);

    const existing =
      selectedGame === "rps"
        ? await GameService.getUserActiveGame(user.id)
        : await GameService.getUserActiveTTTGame(user.id);

    if (existing) {
      const existingCode = (existing as any).game_code as string | null | undefined;
      if (existingCode) setPrivateGameCode(existingCode);

      toast({
        title: t("game_room.private.created_title"),
        description: t("game_room.private.share_code") + (existingCode ? ` ${existingCode}` : ""),
      });

      setCreateLoading(false);
      onGameJoined();
      return;
    }

    const { success, gameCode, error } =
      selectedGame === "rps"
        ? await GameService.createPrivateGame(0)
        : await GameService.createPrivateTTTGame(0);

    if (success && gameCode) {
      setPrivateGameCode(gameCode);
      toast({
        title: t("game_room.private.created_title"),
        description: t("game_room.private.share_code") + ` ${gameCode}`,
      });
    } else {
      toast({
        title: t("common.error"),
        description: error || t("game_room.errors.create_failed"),
        variant: "destructive",
      });
    }

    setCreateLoading(false);
  };

  const handleJoinByCode = async () => {
    if (!joinCode.trim()) return;

    setCreateLoading(true);

    const { success, error } =
      selectedGame === "rps"
        ? await GameService.joinGameByCode(joinCode.trim())
        : await GameService.joinTTTGameByCode(joinCode.trim());

    if (success) {
      setIsJoinCodeOpen(false);
      setJoinCode("");
      toast({
        title: t("game_room.join_success_title"),
        description: t("game_room.join_success_desc"),
      });
      onGameJoined();
    } else {
      toast({
        title: t("common.error"),
        description: error || t("game_room.errors.join_failed"),
        variant: "destructive",
      });
    }

    setCreateLoading(false);
  };

  const copyGameCode = () => {
    navigator.clipboard.writeText(privateGameCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
    toast({
      title: t("game_room.lobby_ui.copied_title"),
      description: t("game_room.lobby_ui.copied_desc"),
    });
  };

  const handleJoinGame = async (gameId: string, gameBet: number, isHost: boolean) => {
    if (gameBet > mmcBalance) {
      toast({
        title: t("common.error"),
        description: t("game_room.errors.insufficient_mmc"),
        variant: "destructive",
      });
      return;
    }

    if (isHost) {
      onGameJoined();
      return;
    }

    if (user) {
      const { data } =
        selectedGame === "rps" ? await GameService.getGame(gameId) : await GameService.getTTTGame(gameId);
      if (data && data.host_id === user.id) {
        onGameJoined();
        return;
      }
    }

    setLoading(true);

    const { success, error } =
      selectedGame === "rps" ? await GameService.joinGame(gameId) : await GameService.joinTTTGame(gameId);

    if (success) {
      toast({
        title: t("game_room.join_success_title"),
        description: t("game_room.join_success_desc"),
      });
      onGameJoined();
    } else {
      toast({
        title: t("common.error"),
        description: error || t("game_room.errors.join_failed"),
        variant: "destructive",
      });
    }

    setLoading(false);
  };

  const handleConvert = async () => {
    if (!user) return;
    const amount = parseFloat(convertAmount);
    if (isNaN(amount) || amount <= 0) return;

    setConvertLoading(true);
    const { success, error } = await GameService.convertUsdToMmc(user.id, amount);

    if (success) {
      toast({ title: t("common.success"), description: t("mmc.conversion_success") });
      setIsConvertOpen(false);
      void loadData();
    } else {
      toast({
        title: t("common.error"),
        description: error || t("mmc.conversion_failed"),
        variant: "destructive",
      });
    }

    setConvertLoading(false);
  };

  const handleEquityExchange = async () => {
    if (!user) return;

    setExchangeLoading(true);
    const { success, error } = await GameService.exchangeEquityForMmc(user.id);

    if (success) {
      toast({
        title: t("game_room.equity_exchange.success"),
        description: t("game_room.equity_exchange.added_desc"),
      });
      void loadData();
    } else {
      toast({
        title: t("common.error"),
        description: error || t("game_room.errors.insufficient_mmc"),
        variant: "destructive",
      });
    }

    setExchangeLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-gradient-to-br from-stone-900 to-stone-800 text-white border-0">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-stone-400 text-sm font-medium mb-1">{t("game_room.mmc_balance")}</p>
              <div className="text-3xl font-bold flex items-center gap-2">
                <Coins className="text-yellow-500" />
                {mmcBalance.toLocaleString()}
              </div>
            </div>
            <Button
              variant="outline"
              className="text-stone-900 border-white/20 hover:bg-white/10 hover:text-white"
              onClick={() => setIsConvertOpen(true)}
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              {t("mmc.deposit")}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-dashed border-2 p-6 bg-stone-50/50 dark:bg-stone-900/50">
          <Tabs defaultValue="public" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="public">
                <Swords className="w-4 h-4 mr-2" />
                {t("game_room.lobby_ui.quick_match")}
              </TabsTrigger>
              <TabsTrigger value="private">
                <Users className="w-4 h-4 mr-2" />
                {t("game_room.lobby_ui.play_with_friends")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="public" className="space-y-3">
              <p className="text-sm text-muted-foreground text-center">{t("game_room.quick_match_description")}</p>

              <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogTrigger asChild>
                  <Button size="lg" className="w-full gap-2">
                    <Plus className="w-5 h-5" />
                    {t("game_room.create_game")}
                  </Button>
                </DialogTrigger>

                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("game_room.create_game_modal.title")}</DialogTitle>
                    <DialogDescription>{t("game_room.create_game_modal.created_desc")}</DialogDescription>
                  </DialogHeader>

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                      {t("common.cancel")}
                    </Button>
                    <Button onClick={handleCreateGame} disabled={createLoading}>
                      {createLoading ? t("common.loading") : t("game_room.create_game_modal.create_button")}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </TabsContent>

            <TabsContent value="private" className="space-y-3">
              <p className="text-sm text-muted-foreground text-center">{t("game_room.private.description")}</p>
              <div className="grid grid-cols-2 gap-2">
                <Dialog
                  open={isPrivateGameOpen}
                  onOpenChange={(open) => {
                    setIsPrivateGameOpen(open);
                    if (!open) {
                      setPrivateGameCode("");
                      setCodeCopied(false);
                    }
                  }}
                >
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full">
                      <Plus className="w-4 h-4 mr-2" />
                      {t("game_room.lobby_ui.create")}
                    </Button>
                  </DialogTrigger>

                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{t("game_room.private.title")}</DialogTitle>
                      <DialogDescription>{t("game_room.private.subtitle")}</DialogDescription>
                    </DialogHeader>

                    {!privateGameCode ? (
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsPrivateGameOpen(false)}>
                          {t("common.cancel")}
                        </Button>
                        <Button onClick={handleCreatePrivateGame} disabled={createLoading}>
                          {createLoading ? t("common.loading") : t("game_room.lobby_ui.create_private_game")}
                        </Button>
                      </DialogFooter>
                    ) : (
                      <div className="py-6 space-y-4">
                        <div className="text-center space-y-2">
                          <p className="text-sm text-muted-foreground">{t("game_room.private.share_with_friend")}</p>
                          <div className="flex items-center justify-center gap-2">
                            <code className="text-3xl font-bold tracking-widest bg-stone-100 dark:bg-stone-900 px-6 py-3 rounded-lg">
                              {privateGameCode}
                            </code>
                            <Button size="icon" variant="outline" onClick={copyGameCode}>
                              {codeCopied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                            </Button>
                          </div>
                        </div>

                        <Button
                          onClick={() => {
                            setIsPrivateGameOpen(false);
                            onGameJoined();
                          }}
                          className="w-full"
                        >
                          {t("game_room.private.waiting_opponent")}
                        </Button>
                      </div>
                    )}
                  </DialogContent>
                </Dialog>

                <Dialog open={isJoinCodeOpen} onOpenChange={setIsJoinCodeOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full">
                      <Users className="w-4 h-4 mr-2" />
                      {t("game_room.lobby_ui.join")}
                    </Button>
                  </DialogTrigger>

                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{t("game_room.private.join_title")}</DialogTitle>
                      <DialogDescription>{t("game_room.private.join_subtitle")}</DialogDescription>
                    </DialogHeader>

                    <div className="py-4 space-y-4">
                      <Input
                        placeholder={t("game_room.private.code_placeholder")}
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                        maxLength={6}
                        className="text-center text-2xl font-bold tracking-widest"
                      />
                    </div>

                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsJoinCodeOpen(false)}>
                        {t("common.cancel")}
                      </Button>
                      <Button onClick={handleJoinByCode} disabled={createLoading || joinCode.length !== 6}>
                        {createLoading ? t("common.loading") : t("game_room.game_info.join")}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </TabsContent>
          </Tabs>
        </Card>
      </div>

      {/* Equity Exchange Offer */}
      <Card className="bg-gradient-to-r from-indigo-900 to-purple-900 text-white border-0 overflow-hidden relative">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Percent className="w-32 h-32" />
        </div>
        <CardContent className="p-6 relative z-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Percent className="w-5 h-5 text-purple-300" />
                {t("game_room.equity_exchange.title")}
              </h3>
              <p className="text-purple-100 max-w-lg">{t("game_room.equity_exchange.description")}</p>

              {hasExchanged ? (
                <div className="flex items-center gap-2 text-xs text-green-300 bg-green-500/10 px-3 py-1 rounded-full w-fit border border-green-500/20">
                  <AlertTriangle className="w-3 h-3" />
                  {t("game_room.equity_exchange.already_used_label")}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-yellow-300 bg-yellow-500/10 px-3 py-1 rounded-full w-fit border border-yellow-500/20">
                  <AlertTriangle className="w-3 h-3" />
                  {t("game_room.equity_exchange.warning")}
                </div>
              )}
            </div>

            <Button
              onClick={handleEquityExchange}
              disabled={exchangeLoading || hasExchanged}
              className="bg-white text-purple-900 hover:bg-purple-50 font-bold shadow-lg min-w-[200px] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {hasExchanged
                ? t("game_room.equity_exchange.already_used_button")
                : exchangeLoading
                  ? t("common.loading")
                  : t("game_room.equity_exchange.button")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Game List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold font-serif">{t("game_room.lobby_title")}</h2>

          <div className="flex items-center gap-2">
            <Select value={selectedGame} onValueChange={(v) => setSelectedGame(v as "rps" | "ttt")}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder={t("game_room.game_selector.label")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rps">{t("game_room.game_selector.rps")}</SelectItem>
                <SelectItem value="ttt">{t("game_room.game_selector.ttt")}</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="ghost" size="sm" onClick={loadData} disabled={loading}>
              <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {games.length === 0 ? (
          <div className="text-center py-12 bg-stone-50 dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800">
            <Swords className="w-12 h-12 text-stone-300 mx-auto mb-3" />
            <p className="text-muted-foreground">{t("game_room.no_games")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {games.map((game) => {
              const isHost = user?.id === game.host_id;
              const bet = typeof game.bet_amount === "number" ? game.bet_amount : 0;
              const disableJoin = bet > mmcBalance;

              const betBadge =
                typeof game.bet_amount === "number"
                  ? `${game.bet_amount} ${t("mmc.short")}`
                  : t("common.not_available");

              return (
                <Card key={game.id} className="hover:border-primary/50 transition-colors">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <Badge variant="outline">{t("game_room.game_info.host")}</Badge>
                      <Badge className="bg-primary text-primary-foreground">{betBadge}</Badge>
                    </div>
                    <CardTitle className="mt-2 truncate">{game.host?.full_name || t("game_room.anonymous")}</CardTitle>
                  </CardHeader>

                  <CardContent className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">{t("game_room.game_info.bet")}</span>
                      <span className="text-sm font-medium">
                        {typeof game.bet_amount === "number" ? game.bet_amount : t("common.not_available")}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">{t("game_room.game_info.status")}</span>
                      <Badge variant={game.status === "active" ? "secondary" : "default"}>
                        {t(`game_room.game_status.${game.status}` as any)}
                      </Badge>
                    </div>
                  </CardContent>

                  <CardFooter className="pt-2">
                    <Button onClick={() => handleJoinGame(game.id, bet, !!isHost)} disabled={disableJoin} className="w-full">
                      {t("game_room.game_info.join")}
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Convert Dialog */}
      <Dialog open={isConvertOpen} onOpenChange={setIsConvertOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("mmc.convert_to_mmc")}</DialogTitle>
            <DialogDescription>{t("mmc.exchange_rate")}</DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("mmc.amount_usd")}</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input type="number" className="pl-9" value={convertAmount} onChange={(e) => setConvertAmount(e.target.value)} />
              </div>
            </div>

            <div className="p-3 bg-stone-100 dark:bg-stone-900 rounded-lg flex justify-between items-center">
              <span className="text-sm font-medium">{t("mmc.amount_mmc")}:</span>
              <span className="text-xl font-bold text-primary">
                {(parseFloat(convertAmount || "0") * 100).toLocaleString()} {t("mmc.short")}
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={handleConvert} disabled={convertLoading}>
              {convertLoading ? t("common.loading") : t("mmc.convert_button")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}