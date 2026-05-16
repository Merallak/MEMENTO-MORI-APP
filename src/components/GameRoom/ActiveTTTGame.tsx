import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { DataService } from "@/lib/dataService";
import { GameService, type TTTGame } from "@/services/gameService";
import { Info, Loader2, LogOut, RotateCcw, Trophy } from "lucide-react";
import { TurnDecider } from "./TurnDecider";

interface ActiveTTTGameProps {
  game: TTTGame & {
    host?: { full_name?: string | null; email?: string | null } | null;
    guest?: { full_name?: string | null; email?: string | null } | null;
  };
  onGameEnd: () => void;
  onBackToLobby?: () => void;
  onLeaveGame?: () => void;
}

// Función auxiliar segura para obtener el caracter
function getCell(board: string, idx: number) {
  const safeBoard = (board || "").padEnd(9, "_");
  const ch = safeBoard[idx];
  return ch === "X" || ch === "O" ? ch : "_";
}

export function ActiveTTTGame({ game: initialGame, onGameEnd, onBackToLobby, onLeaveGame }: ActiveTTTGameProps) {
  const { user } = useAuth();
  const { t } = useLanguage();

  const [game, setGame] = useState<TTTGame>(initialGame);
  const [loading, setLoading] = useState(false);
  const [mmcBalance, setMmcBalance] = useState<number | null>(null);
  const [tokenImages, setTokenImages] = useState<{ host: string | null; guest: string | null }>({ host: null, guest: null });
  const [selectedCell, setSelectedCell] = useState<number | null>(null);

  // Betting states
  const [newBet, setNewBet] = useState<number | "">("");
  const [counterBet, setCounterBet] = useState<number | "">("");
  const [isBetSubmitting, setIsBetSubmitting] = useState(false);

  const [leaveOpen, setLeaveOpen] = useState(false);
  const [showTurnDecider, setShowTurnDecider] = useState(false);
  const [turnDeciderWinner, setTurnDeciderWinner] = useState<string>("");
  const prevRoundRef = useRef<number>(initialGame.round_number);

  const gameRef = useRef(game);
  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  // Subscription and Polling
  useEffect(() => {
    const channel = GameService.subscribeToTTTGame(initialGame.id, (updatedGame) => {
      setGame(updatedGame);
      if (updatedGame.status === "cancelled") onGameEnd();
    });

    const interval = setInterval(async () => {
      const { data } = await GameService.getTTTGame(initialGame.id);
      if (data) setGame(data);
    }, 3000);

    return () => {
      GameService.unsubscribeFromGame(channel);
      clearInterval(interval);
    };
  }, [initialGame.id, onGameEnd]);

  // Balance Management
  useEffect(() => {
    if (!user?.id) return;
    const shouldUpdate = game.status === "active" || game.status === "finished";
    if (!shouldUpdate) return;

    let cancelled = false;
    (async () => {
      const bal = await GameService.getMmcBalance(user.id);
      if (!cancelled) setMmcBalance(bal);
    })();

    return () => { cancelled = true; };
  }, [user?.id, game.status]);

  // Fetch token images
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
    return () => { cancelled = true; };
  }, [game.host_id, game.guest_id]);

  const isHost = user?.id === game.host_id;
  const isGuest = user?.id === game.guest_id;

  // Turn Decider
  useEffect(() => {
    if (
      game.round_number > prevRoundRef.current &&
      game.status === "active" &&
      game.turn_player_id
    ) {
      const hostName = initialGame.host?.full_name || t("game_room.anonymous");
      const guestName = initialGame.guest?.full_name || t("game_room.anonymous");

      const winnerName =
        game.turn_player_id === game.host_id
          ? (isHost ? t("game_room.results.you") : hostName)
          : (isGuest ? t("game_room.results.you") : guestName);

      setTurnDeciderWinner(winnerName);
      setShowTurnDecider(true);
      prevRoundRef.current = game.round_number;
    }
  }, [game.round_number, game.status, game.turn_player_id, isHost, isGuest, t, initialGame.host, initialGame.guest, game.host_id]);

  const mySymbol = isHost ? game.host_symbol : isGuest ? game.guest_symbol : null;
  const isMyTurn = !!user?.id && game.turn_player_id === user.id;

  const getSymbolImage = (symbol: "X" | "O") => 
    symbol === game.host_symbol ? tokenImages.host : tokenImages.guest;

  const betNotSet = game.bet_amount == null || game.bet_amount === 0;
  const betDisplay = betNotSet ? "—" : game.bet_amount;

  const hasPendingBetProposal = game.next_bet_amount != null && game.next_bet_proposer_id != null;
  const iProposedBet = hasPendingBetProposal && game.next_bet_proposer_id === user?.id;

  const board = game.board ?? "_________";
  const boardEmpty = board === "_________";

  const canNegotiateBetNow =
    (isHost || isGuest) &&
    game.status === "active" &&
    betNotSet &&
    !!game.host_id &&
    !!game.guest_id &&
    boardEmpty;

  const handleCellClick = async (cellIdx: number) => {
    if (!user) return;
    if (!isMyTurn) return;
    if (betNotSet) return;

    const cellContent = getCell(board, cellIdx);
    const myPiecesCount = board.split("").filter((c) => c === mySymbol).length;

    // FASE 1: Colocación (menos de 3 fichas)
    if (myPiecesCount < 3) {
      if (cellContent !== "_") return;
      setLoading(true);
      const { success, error } = await GameService.submitTTTMove(game.id, cellIdx);
      setLoading(false);
      if (!success) {
        toast({ title: t("common.error"), description: error || t("game_room.errors.move_failed"), variant: "destructive" });
      }
      return;
    }

    // FASE 2: Movimiento (ya tiene 3 fichas)
    if (cellContent === mySymbol) {
      // Seleccionar o deseleccionar ficha propia para mover
      setSelectedCell(selectedCell === cellIdx ? null : cellIdx);
      return;
    }

    if (selectedCell !== null && cellContent === "_") {
      // Ejecutar movimiento de la ficha seleccionada a la casilla vacía
      setLoading(true);
      const { success, error } = await GameService.submitTTTMove(game.id, cellIdx, selectedCell);
      setLoading(false);

      if (success) {
        setSelectedCell(null);
      } else {
        toast({ title: t("common.error"), description: error || t("game_room.errors.move_failed"), variant: "destructive" });
      }
    }
  };


  const handleRestart = async () => {
    setLoading(true);
    const { success, error } = await GameService.restartTTTGame(game.id);
    setLoading(false);

    if (!success) {
      toast({ title: t("common.error"), description: error, variant: "destructive" });
      return;
    }
    toast({ title: t("game_room.results.new_round"), description: t("game_room.results.continue_playing") });
    
    const { data } = await GameService.getTTTGame(game.id);
    if (data) setGame(data);
  };

  const handleForfeit = async () => {
    setLoading(true);
    const result = await GameService.forfeitTTTGame(game.id);
    setLoading(false);

    if (result.success) onGameEnd();
    else toast({ title: t("common.error"), description: result.error, variant: "destructive" });
  };

  const handleLeaveConfirmed = async () => {
    setLeaveOpen(false);
    await handleForfeit();
  };

  const handleProposeNewBet = async (betOverride?: number) => {
    if (!user) return;
    if (betOverride === undefined && (newBet === "" || Number(newBet) <= 0)) return;

    setIsBetSubmitting(true);
    const betValue = betOverride ?? Number(newBet);
    const { success, error } = await GameService.proposeNewTTTBet(game.id, betValue);
    setIsBetSubmitting(false);

    if (!success) {
      toast({
        title: t("common.error"),
        description: error || t("game_room.active_game.failed_to_propose_bet"),
        variant: "destructive",
      });
      return;
    }
    toast({ title: t("common.success"), description: t("game_room.active_game.bet_proposed") });
  };

  const handleAcceptNewBet = async () => {
    if (!user) return;
    setIsBetSubmitting(true);
    const { success, error } = await GameService.acceptNewTTTBet(game.id);
    setIsBetSubmitting(false);

    if (!success) {
      toast({
        title: t("common.error"),
        description: error || t("game_room.active_game.failed_to_accept_bet"),
        variant: "destructive",
      });
      return;
    }
    toast({ title: t("common.success"), description: t("game_room.active_game.bet_accepted") });
    setNewBet("");
  };

  const renderResult = () => {
    if (game.status !== "finished") return null;

    const hostName = initialGame.host?.full_name || t("game_room.anonymous");
    const guestName = initialGame.guest?.full_name || t("game_room.anonymous");

    const isDraw = !game.winner_id;
    let winnerName = "";

    if (isDraw) {
      winnerName = t("game_room.draw");
    } else if (game.winner_id === game.host_id) {
       winnerName = isHost ? t("game_room.results.you") : hostName;
    } else if (game.winner_id === game.guest_id) {
       winnerName = isGuest ? t("game_room.results.you") : guestName;
    }

    return (
      <div className="mt-6 rounded-xl border border-stone-200 dark:border-stone-800 p-6 text-center space-y-3">
        <Trophy className="w-12 h-12 mx-auto text-yellow-500" />
        <div className="text-2xl font-bold">{isDraw ? t("game_room.draw") : t("game_room.results.winner")}</div>
        <div className="text-xl font-semibold">{winnerName}</div>
        <div className="text-muted-foreground">
          {t("game_room.results.prize")}: {betDisplay} {t("mmc.short")}
        </div>

        <div className="space-y-2 pt-2">
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

  const displayBoard = (game.board ?? "").padEnd(9, "_");
  const myPiecesCount = displayBoard.split("").filter((c) => c === mySymbol).length;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {showTurnDecider && (
        <TurnDecider
          winnerName={turnDeciderWinner}
          onComplete={() => setShowTurnDecider(false)}
        />
      )}

      <Card className="border-2 shadow-lg">
        <CardHeader className="text-center">
          <Badge variant={game.status === "active" ? "default" : "secondary"} className="mx-auto">
            {t(`game_room.game_status.${game.status}` as any)}
          </Badge>

          <CardTitle className="text-3xl font-serif">
            {betDisplay} {t("mmc.short")}
          </CardTitle>

          <CardDescription>
            {mySymbol 
              ? ((isHost && tokenImages.host) || (isGuest && tokenImages.guest) 
                  ? null // Si hay imagen, el avatar habla por sí mismo
                  : t("game_room.ttt.you_are", { symbol: mySymbol }))
              : t("game_room.waiting_opponent")}
          </CardDescription>

          <div className="text-sm text-muted-foreground">
            {t("game_room.mmc_balance")}:{" "}
            <span className="font-medium text-foreground">
              {mmcBalance == null ? "—" : `${mmcBalance.toLocaleString()} ${t("mmc.short")}`}
            </span>
          </div>

          {(game.status === "active" || game.status === "playing") && !!mySymbol && (
            <div className="text-lg font-bold mt-2 animate-pulse text-primary">
              {isMyTurn ? t("game_room.ttt.your_turn") : t("game_room.ttt.opponent_turn")}
              {isMyTurn && myPiecesCount === 3 && (
                <p className="text-xs font-medium text-muted-foreground animate-none mt-1">
                  {t("game_room.ttt.move_prompt")}
                </p>
              )}
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-6">
          {game.status === "waiting" ? (
            <div className="text-center py-10 space-y-3">
              <Loader2 className="w-10 h-10 mx-auto animate-spin text-primary" />
              <div className="text-muted-foreground">{t("game_room.waiting_opponent")}</div>
            </div>
          ) : (
            <>
              {canNegotiateBetNow && (
                <div className="rounded-xl border border-stone-200 dark:border-stone-800 p-4 space-y-3 bg-stone-50 dark:bg-stone-900/50">
                  <div className="text-sm font-medium">{t("game_room.active_game.bet_amount_mmc")}</div>

                  {!hasPendingBetProposal ? (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        value={newBet}
                        onChange={(e) => setNewBet(e.target.value === "" ? "" : Number(e.target.value))}
                        className="w-28 bg-background"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleProposeNewBet()}
                        disabled={isBetSubmitting || newBet === "" || Number(newBet) <= 0}
                      >
                        {isBetSubmitting ? t("common.loading") : t("game_room.active_game.propose_button")}
                      </Button>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-amber-500/60 bg-amber-500/10 p-3 text-sm space-y-2">
                      {iProposedBet ? (
                        <p className="text-amber-600 dark:text-amber-400">
                          {t("game_room.bet_change.pending_for_other", { amount: game.next_bet_amount })}
                        </p>
                      ) : (
                        <>
                          <p className="text-amber-600 dark:text-amber-400">
                            {t("game_room.bet_change.pending_for_you", { amount: game.next_bet_amount })}
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button size="sm" onClick={handleAcceptNewBet} disabled={isBetSubmitting}>
                              {isBetSubmitting ? t("common.loading") : t("game_room.active_game.accept_button")}
                            </Button>

                            <span className="text-muted-foreground text-xs">{t("common.or")}</span>

                            <Input
                              type="number"
                              min={1}
                              placeholder={t("game_room.active_game.counter_placeholder")}
                              value={counterBet}
                              onChange={(e) => setCounterBet(e.target.value === "" ? "" : Number(e.target.value))}
                              className="w-24 bg-background"
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                if (counterBet !== "" && counterBet > 0) {
                                  handleProposeNewBet(counterBet as number);
                                  setCounterBet("");
                                }
                              }}
                              disabled={isBetSubmitting || counterBet === "" || Number(counterBet) <= 0}
                            >
                              {t("game_room.active_game.counter_button")}
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5" />
                    {t("game_room.active_game.bet_help")}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 p-2 bg-stone-100 dark:bg-stone-800 rounded-xl">
                {Array.from({ length: 9 }).map((_, idx) => {
                  const cell = getCell(displayBoard, idx);
                  const isActive = game.status === "active" || game.status === "playing";
                  const disabled =
                    loading ||
                    !isActive ||
                    betNotSet ||
                    !isMyTurn ||
                    !(isHost || isGuest);
                  
                  // En fase de movimiento, las casillas ocupadas por el jugador NO están deshabilitadas (para que pueda seleccionarlas)
                  const isInteractive = !disabled && (cell === "_" || cell === mySymbol);

                  const symbol = cell as "X" | "O" | "_";
                  const tokenImg = symbol !== "_" ? getSymbolImage(symbol) : null;
                  const isSelected = selectedCell === idx;

                  return (
                    <button
                      key={idx}
                      type="button"
                      aria-label={t("game_room.ttt.cell_aria", { index: idx + 1 })}
                      disabled={!isInteractive}
                      onClick={() => void handleCellClick(idx)}
                      className={cn(
                        "aspect-square rounded-lg border-2 text-5xl font-bold shadow-sm",
                        "flex items-center justify-center relative overflow-hidden",
                        "transition-all duration-200",
                        cell === "_" 
                            ? (!isInteractive ? "bg-stone-200 dark:bg-stone-900 border-stone-300 dark:border-stone-800" : "bg-white dark:bg-stone-950 border-stone-200 dark:border-stone-700 hover:bg-stone-50")
                            : "bg-white dark:bg-stone-950 border-primary/50",
                        isSelected && "ring-4 ring-primary ring-offset-2 animate-pulse z-10"
                      )}
                    >
                      {cell === "_" ? null : (
                        tokenImg ? (
                          <img 
                            src={tokenImg} 
                            alt={cell}
                            className="w-full h-full object-cover animate-in zoom-in duration-300"
                          />
                        ) : (
                          <span className="animate-in zoom-in duration-300 text-foreground">{cell}</span>
                        )
                      )}
                    </button>
                  );
                })}
              </div>

              {renderResult()}
            </>
          )}

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
                <Button onClick={handleLeaveConfirmed} disabled={loading} variant="destructive">
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