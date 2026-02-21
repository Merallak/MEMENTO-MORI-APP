import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { GameService, type CoinflipGame } from "@/services/gameService";
import { LogOut, RotateCcw, Trophy, Coins, Check, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";

// Extendemos el tipo localmente ya que database.types.ts está desactualizado
type ExtendedCoinflipGame = CoinflipGame & {
  next_bet_amount?: number | null;
  next_bet_proposer_id?: string | null;
  host?: { full_name?: string | null; email?: string | null } | null;
  guest?: { full_name?: string | null; email?: string | null } | null;
};

interface ActiveCoinflipGameProps {
  game: ExtendedCoinflipGame;
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

  const [game, setGame] = useState<ExtendedCoinflipGame>(initialGame);
  const [loading, setLoading] = useState(false);
  const [mmcBalance, setMmcBalance] = useState<number | null>(null);
  
  // Estados de Apuestas
  const [betAmount, setBetAmount] = useState<string>("");
  const [isProposing, setIsProposing] = useState(false);
  
  const [leaveOpen, setLeaveOpen] = useState(false);
  
  // Animación local
  const [flipping, setFlipping] = useState(false);

  const gameRef = useRef(game);
  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  // Subscription and Polling
  useEffect(() => {
    const channel = GameService.subscribeToCoinflipGame(initialGame.id, (updatedGame) => {
      setGame((prev) => ({ ...prev, ...updatedGame })); 
      
      // Detener animación si llega resultado
      if (updatedGame.status === "finished" && updatedGame.result) {
        setFlipping(false);
      }
      if (updatedGame.status === "cancelled") onGameEnd();
    });

    const interval = setInterval(async () => {
      const { data } = await GameService.getCoinflipGame(initialGame.id);
      if (data) setGame(data as ExtendedCoinflipGame);
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
  }, [user?.id, game.status, game.bet_amount]); 

  const isHost = user?.id === game.host_id;
  const currentBet = game.bet_amount ?? 0;
  
  // Lógica de Negociación de Apuestas
  const hasProposedBet = game.next_bet_amount != null && game.next_bet_amount > 0;
  const iAmProposer = game.next_bet_proposer_id === user?.id;
  const waitingForAccept = hasProposedBet && iAmProposer;
  const waitingForMeToAccept = hasProposedBet && !iAmProposer;

  const handleProposeBet = async () => {
    const amount = parseInt(betAmount);
    if (isNaN(amount) || amount <= 0) return;
    if (mmcBalance !== null && amount > mmcBalance) {
      toast({
        title: t("common.error"),
        description: t("game_room.errors.insufficient_mmc"),
        variant: "destructive",
      });
      return;
    }

    setIsProposing(true);
    const { success, error } = await GameService.proposeNewCoinflipBet(game.id, amount);
    setIsProposing(false);

    if (success) {
      setBetAmount("");
      toast({ title: t("common.success"), description: t("game_room.active_game.bet_proposed") });
    } else {
      toast({ title: t("common.error"), description: error, variant: "destructive" });
    }
  };

  const handleAcceptBet = async () => {
    if (!game.next_bet_amount) return;
    if (mmcBalance !== null && game.next_bet_amount > mmcBalance) {
       toast({
        title: t("common.error"),
        description: t("game_room.errors.insufficient_mmc"),
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    const { success, error } = await GameService.acceptNewCoinflipBet(game.id);
    setLoading(false);

    if (success) {
      toast({ title: t("common.success"), description: t("game_room.active_game.bet_accepted") });
    } else {
      toast({ title: t("common.error"), description: error, variant: "destructive" });
    }
  };

  const handleChoice = async (choice: "heads" | "tails") => {
    if (!user) return;
    
    if (hasProposedBet) {
        toast({
            title: t("common.error"),
            description: t("game_room.active_game.bet_pending_error"),
            variant: "destructive"
        });
        return;
    }

    setLoading(true);

    const { success, error } = await GameService.submitCoinflipChoice(game.id, choice);
    
    setLoading(false);

    if (!success) {
      setFlipping(false);
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

    const iWon = game.winner_id === user?.id;
    const resultText = iWon ? t("game_room.results.winner") : t("game_room.results.loser");
    const resultColor = iWon ? "text-green-500" : "text-red-500";
    const isHeads = game.result === "heads";

    return (
      <div className="mt-6 rounded-xl border border-stone-200 dark:border-stone-800 p-6 text-center space-y-4 bg-stone-50/50 dark:bg-stone-900/50">
        <Trophy className={cn("w-12 h-12 mx-auto", iWon ? "text-yellow-500" : "text-stone-400")} />
        
        <div className="space-y-1">
          <div className="text-sm text-muted-foreground uppercase tracking-wider">{t("game_room.result_label")}</div>
          <div className="text-3xl font-bold uppercase">
            {isHeads ? t("game_room.coinflip.heads") : t("game_room.coinflip.tails")}
          </div>
        </div>

        <div className={cn("text-2xl font-bold", resultColor)}>{resultText}</div>
        
        {iWon && (
          <div className="text-muted-foreground font-medium">
            {t("game_room.results.prize")}: <span className="text-yellow-500">{currentBet} {t("mmc.short")}</span>
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
  const actualMyChoice = myChoice; 
  const waitingForOpponent = actualMyChoice && !game.result && game.status === "active";

  const renderBetting = () => {
      if (game.status !== 'waiting' && game.status !== 'active') return null;
      if (waitingForOpponent || game.result) return null; 

      return (
        <div className="bg-stone-50 dark:bg-stone-900/50 p-4 rounded-lg border border-dashed border-stone-200 dark:border-stone-800 mb-6">
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Coins className="w-4 h-4 text-yellow-500" />
                {t("game_room.game_info.bet")}
            </h4>
            
            {waitingForMeToAccept ? (
                 <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-400 bg-yellow-500/10 p-2 rounded">
                         <AlertTriangle className="w-4 h-4" />
                         <span>{t("game_room.active_game.opponent_proposed", { amount: game.next_bet_amount || 0 })}</span>
                    </div>
                    <div className="flex gap-2">
                         <Button onClick={handleAcceptBet} disabled={loading} className="w-full bg-green-600 hover:bg-green-700 text-white">
                             <Check className="w-4 h-4 mr-2" />
                             {t("common.accept")}
                         </Button>
                    </div>
                 </div>
            ) : waitingForAccept ? (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground p-2 bg-stone-100 dark:bg-stone-800 rounded animate-pulse">
                    <Coins className="w-4 h-4" />
                    {t("game_room.active_game.waiting_confirm")} ({game.next_bet_amount} {t("mmc.short")})
                </div>
            ) : (
                <div className="space-y-2">
                    <div className="flex gap-2">
                        <Input 
                            type="number" 
                            placeholder={t("game_room.active_game.counter_placeholder")}
                            value={betAmount} 
                            onChange={(e) => setBetAmount(e.target.value)}
                            className="bg-background"
                        />
                        <Button 
                            variant="secondary" 
                            onClick={handleProposeBet}
                            disabled={isProposing || !betAmount}
                        >
                            {isProposing ? t("common.loading") : t("game_room.active_game.propose")}
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {t("game_room.active_game.bet_help")}
                    </p>
                </div>
            )}
        </div>
      )
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <Card className="border-2 shadow-lg transition-all duration-300">
        <CardHeader className="text-center pb-2">
          <Badge variant={game.status === "active" ? "default" : "secondary"} className="mx-auto mb-2">
            {t(`game_room.game_status.${game.status}` as any)}
          </Badge>

          <CardTitle className="text-4xl font-serif flex justify-center items-center gap-2">
            {currentBet} <span className="text-lg font-sans font-normal text-muted-foreground">{t("mmc.short")}</span>
          </CardTitle>
          
          <p className="text-sm text-muted-foreground">
              {isHost ? `${t("common.you")} vs ${t("game_room.guest")}` : `${t("game_room.host")} vs ${t("common.you")}`}
          </p>

          <div className="text-sm font-medium pt-2 text-stone-500">
            {t("game_room.mmc_balance")}:{" "}
            <span className="text-foreground">
              {mmcBalance == null ? "—" : `${mmcBalance.toLocaleString()} ${t("mmc.short")}`}
            </span>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
            
            {renderBetting()}

            <div className="flex justify-center py-6">
                 <motion.div 
                    className={cn(
                        "w-32 h-32 rounded-full border-4 border-yellow-500 bg-gradient-to-br from-yellow-300 to-yellow-600 shadow-xl flex items-center justify-center relative",
                    )}
                    animate={flipping || (!game.result && game.status === 'active' && !actualMyChoice) ? { rotateY: 360 } : { rotateY: 0 }}
                    transition={flipping ? { duration: 0.5, repeat: Infinity, ease: "linear" } : { duration: 0.5 }}
                >
                     {game.result ? (
                         <span className="text-5xl font-black text-white drop-shadow-md">
                             {game.result === 'heads' ? "H" : "T"}
                         </span>
                     ) : (
                        <Coins className="w-16 h-16 text-white" />
                     )}
                </motion.div>
            </div>
            
            <div className="text-center text-sm font-medium h-6 text-yellow-600">
               {flipping ? t("game_room.coinflip.flipping") : ""}
            </div>

            {game.status === "active" && !game.result && (
                <div className="space-y-4">
                    {waitingForOpponent ? (
                        <div className="text-center p-6 bg-stone-100 dark:bg-stone-900 rounded-lg animate-pulse border-2 border-dashed">
                            <p className="font-medium">{t("game_room.waiting_opponent")}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                {actualMyChoice === 'heads' ? t("game_room.coinflip.heads") : t("game_room.coinflip.tails")} {t("game_room.selected").toLowerCase()}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                             <div className="text-center text-muted-foreground text-sm font-medium uppercase tracking-widest">
                                {t("game_room.coinflip.select_side")}
                             </div>
                             
                             <div className="grid grid-cols-2 gap-4">
                                <Button 
                                    size="lg" 
                                    className="h-28 text-2xl font-bold border-2 border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 hover:border-yellow-500 transition-all text-stone-800 dark:text-stone-200" 
                                    variant="outline"
                                    onClick={() => handleChoice("heads")}
                                    disabled={loading || waitingForAccept || waitingForMeToAccept}
                                >
                                    <div className="flex flex-col items-center gap-2">
                                        <span>{t("game_room.coinflip.heads").toUpperCase()}</span>
                                        {actualMyChoice === 'heads' && <Check className="w-6 h-6 text-green-500" />}
                                    </div>
                                </Button>
                                <Button 
                                    size="lg" 
                                    className="h-28 text-2xl font-bold border-2 border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 hover:border-yellow-500 transition-all text-stone-800 dark:text-stone-200" 
                                    variant="outline"
                                    onClick={() => handleChoice("tails")}
                                    disabled={loading || waitingForAccept || waitingForMeToAccept}
                                >
                                    <div className="flex flex-col items-center gap-2">
                                        <span>{t("game_room.coinflip.tails").toUpperCase()}</span>
                                        {actualMyChoice === 'tails' && <Check className="w-6 h-6 text-green-500" />}
                                    </div>
                                </Button>
                             </div>
                             
                             {(waitingForAccept || waitingForMeToAccept) && (
                                 <p className="text-center text-xs text-red-500 font-medium">
                                     {t("game_room.active_game.bet_pending_error")}
                                 </p>
                             )}
                        </div>
                    )}
                </div>
            )}

            {renderResult()}

            {game.status !== 'finished' && (
                <div className="flex justify-center pt-4">
                    <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
                    <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-red-500" disabled={loading}>
                        <LogOut className="w-4 h-4 mr-2" />
                        {t("game_room.actions.leave_game")}
                        </Button>
                    </DialogTrigger>

                    <DialogContent>
                        <DialogHeader>
                        <DialogTitle>{t("game_room.actions.leave_confirm_title")}</DialogTitle>
                        <DialogDescription>{t("game_room.actions.leave_confirm_desc")}</DialogDescription>
                        </DialogHeader>

                        <DialogFooter>
                        <Button variant="outline" onClick={() => setLeaveOpen(false)} disabled={loading}>
                            {t("common.cancel")}
                        </Button>
                        <Button onClick={handleForfeit} disabled={loading} variant="destructive">
                            {loading ? t("common.loading") : t("common.confirm")}
                        </Button>
                        </DialogFooter>
                    </DialogContent>
                    </Dialog>
                </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}