import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { DataService } from "@/lib/dataService";
import { GameService, type CoinflipGame } from "@/services/gameService";
import { Loader2, LogOut, RotateCcw, Trophy, Coins } from "lucide-react";

interface ActiveCoinflipGameProps {
  game: CoinflipGame;
  onGameEnd: () => void;
  onBackToLobby?: () => void;
  onLeaveGame?: () => void;
}

export function ActiveCoinflipGame({
  game: initialGame,
  onGameEnd,
  onBackToLobby,
  onLeaveGame,
}: ActiveCoinflipGameProps) {
  const { user } = useAuth();
  const { t } = useLanguage();

  const [game, setGame] = useState<CoinflipGame>(initialGame);
  const [loading, setLoading] = useState(false);
  const [mmcBalance, setMmcBalance] = useState<number | null>(null);
  
  // @ts-ignore - unused but kept for structure consistency with other games
  const [tokenImages, setTokenImages] = useState<{ host: string | null; guest: string | null }>({
    host: null,
    guest: null,
  });

  const [leaveOpen, setLeaveOpen] = useState(false);
  const [flipping, setFlipping] = useState(false);

  const gameRef = useRef(game);
  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  // Subscription and Polling
  useEffect(() => {
    const channel = GameService.subscribeToCoinflipGame(initialGame.id, (updatedGame) => {
      setGame(updatedGame);
      if (updatedGame.status === "finished" && updatedGame.result) {
        setFlipping(false);
      }
      if (updatedGame.status === "cancelled") onGameEnd();
    });

    const interval = setInterval(async () => {
      const { data } = await GameService.getCoinflipGame(initialGame.id);
      if (data) setGame(data);
    }, 3000);

    return () => {
      GameService.unsubscribeFromGame(channel);
      clearInterval(interval);
    };
  }, [initialGame.id, onGameEnd]);

  // Balance Fetching
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const bal = await GameService.getMmcBalance(user.id);
      if (!cancelled) setMmcBalance(bal);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, game.status]); // Refetch on status change (payout)

  // Token Images
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [hostToken, guestToken] = await Promise.all([
        game.host_id ? DataService.getUserIssuedToken(game.host_id) : null,
        game.guest_id ? DataService.getUserIssuedToken(game.guest_id) : null,
      ]);
      if (!cancelled) {
        setTokenImages({
          host: hostToken?.image_url || null,
          guest: guestToken?.image_url || null,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [game.host_id, game.guest_id]);

  const isHost = user?.id === game.host_id;
  const betDisplay = game.bet_amount == null ? "—" : game.bet_amount;

  const handleChoice = async (choice: "heads" | "tails") => {
    if (!user) return;
    setLoading(true);

    const { success, error } = await GameService.submitCoinflipChoice(game.id, choice);
    
    setLoading(false);

    if (!success) {
      toast({
        title: t("common.error"),
        description: error || t("game_room.errors.move_failed"),
        variant: "destructive",
      });
      return;
    }

    toast({
      title: t("common.success"),
      description: t("game_room.active_game.move_submitted"),
    });

    // If playing against house (future feature), start flip animation locally
    // For now, assume PVP logic mainly
    if (game.mode === "house") {
      setFlipping(true);
    }
  };

  const handleRestart = async () => {
    setLoading(true);
    const { success, error } = await GameService.restartCoinflipGame(game.id);
    setLoading(false);

    if (!success) {
      toast({ title: t("common.error"), description: error, variant: "destructive" });
      return;
    }
    
    toast({
        title: t("game_room.results.new_round"),
        description: t("game_room.results.continue_playing") 
    });
  };

  const handleForfeit = async () => {
    setLoading(true);
    const result = await GameService.forfeitCoinflipGame(game.id);
    setLoading(false);

    if (result.success) onGameEnd();
    else
      toast({ title: t("common.error"), description: result.error, variant: "destructive" });
  };

  const renderResult = () => {
    if (game.status !== "finished") return null;

    // Logic for winner display
    const iWon = game.winner_id === user?.id;
    const resultText = iWon ? t("game_room.results.winner") : t("game_room.results.loser");
    const resultColor = iWon ? "text-green-500" : "text-red-500";
    
    // Result Coin Display
    const isHeads = game.result === "heads";

    return (
      <div className="mt-6 rounded-xl border border-stone-200 dark:border-stone-800 p-6 text-center space-y-4">
        <Trophy className={cn("w-12 h-12 mx-auto", iWon ? "text-yellow-500" : "text-stone-400")} />
        
        <div className="space-y-1">
          <div className="text-sm text-muted-foreground uppercase tracking-wider">{t("game_room.result_label")}</div>
          <div className="text-3xl font-bold uppercase">
            {isHeads ? t("game_room.coinflip.heads") : t("game_room.coinflip.tails")}
          </div>
        </div>

        <div className={cn("text-2xl font-bold", resultColor)}>{resultText}</div>
        
        {iWon && (
          <div className="text-muted-foreground">
            {t("game_room.results.prize")}: {betDisplay} {t("mmc.short")}
          </div>
        )}

        <div className="space-y-2 pt-4">
          <Button onClick={handleRestart} disabled={loading} className="w-full">
            <RotateCcw className="w-4 h-4 mr-2" />
            {loading ? t("common.loading") : t("game_room.results.continue_playing")}
          </Button>

          <div className="flex gap-2">
             <Button variant="outline" className="flex-1" onClick={onBackToLobby ?? onLeaveGame ?? onGameEnd}>
              <LogOut className="w-4 h-4 mr-2" />
              {t("game_room.actions.leave_game")}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const myChoice = isHost ? game.host_choice : game.guest_choice;
  const waitingForOpponent = myChoice && game.status === "active";

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <Card className="border-2">
        <CardHeader className="text-center">
          <Badge variant={game.status === "active" ? "default" : "secondary"} className="mx-auto">
            {t(`game_room.game_status.${game.status}` as any)}
          </Badge>

          <CardTitle className="text-3xl font-serif">
            {betDisplay} {t("mmc.short")}
          </CardTitle>

          <div className="text-sm text-muted-foreground">
            {t("game_room.mmc_balance")}:{" "}
            <span className="font-medium text-foreground">
              {mmcBalance == null ? "—" : `${mmcBalance.toLocaleString()} ${t("mmc.short")}`}
            </span>
          </div>
        </CardHeader>

        <CardContent className="space-y-8">
            {/* Coin Animation Area */}
            <div className="flex justify-center py-8">
                <div className={cn(
                    "w-32 h-32 rounded-full border-4 border-yellow-500 bg-yellow-100 dark:bg-yellow-900/20 flex items-center justify-center relative",
                    (flipping || (game.status === 'active' && !myChoice)) ? "animate-pulse" : ""
                )}>
                     {game.result ? (
                         <span className="text-4xl font-bold text-yellow-700 dark:text-yellow-500 uppercase">
                             {game.result === 'heads' ? "H" : "T"}
                         </span>
                     ) : (
                        <Coins className="w-16 h-16 text-yellow-500" />
                     )}
                </div>
            </div>
            
            <div className="text-center text-sm font-medium">
               {flipping ? t("game_room.coinflip.flipping") : ""}
            </div>

            {/* Game Controls */}
            {game.status === "active" && (
                <div className="space-y-4">
                    {waitingForOpponent ? (
                        <div className="text-center p-4 bg-stone-100 dark:bg-stone-900 rounded-lg animate-pulse">
                            {t("game_room.waiting_opponent")}
                        </div>
                    ) : (
                        <div className="space-y-2">
                             <div className="text-center text-muted-foreground text-sm">
                                {t("game_room.coinflip.select_side")}
                             </div>
                             <div className="grid grid-cols-2 gap-4">
                                <Button 
                                    size="lg" 
                                    className="h-24 text-xl font-bold border-2 border-stone-200" 
                                    variant="outline"
                                    onClick={() => handleChoice("heads")}
                                    disabled={loading}
                                >
                                    {t("game_room.coinflip.heads").toUpperCase()}
                                </Button>
                                <Button 
                                    size="lg" 
                                    className="h-24 text-xl font-bold border-2 border-stone-200" 
                                    variant="outline"
                                    onClick={() => handleChoice("tails")}
                                    disabled={loading}
                                >
                                    {t("game_room.coinflip.tails").toUpperCase()}
                                </Button>
                             </div>
                        </div>
                    )}
                </div>
            )}

            {renderResult()}

            {/* Leave Dialog */}
            <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
            <div className="flex justify-center pt-2">
              <DialogTrigger asChild>
                <Button variant="ghost" disabled={loading}>
                  <LogOut className="w-4 h-4 mr-2" />
                  {t("game_room.actions.leave_game")}
                </Button>
              </DialogTrigger>
            </div>

            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("game_room.actions.leave_confirm_title")}</DialogTitle>
                <DialogDescription>{t("game_room.actions.leave_confirm_desc")}</DialogDescription>
              </DialogHeader>

              <DialogFooter>
                <Button variant="outline" onClick={() => setLeaveOpen(false)} disabled={loading}>
                  {t("common.cancel")}
                </Button>
                <Button onClick={handleForfeit} disabled={loading}>
                  {loading ? t("common.loading") : t("common.confirm")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

        </CardContent>
      </Card>
    </div>
  );
}