import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { GameService, type TTTGame } from "@/services/gameService";
import { Loader2, LogOut, RotateCcw, Trophy } from "lucide-react";

interface ActiveTTTGameProps {
  game: TTTGame & {
    host?: { full_name: string; email: string };
    guest?: { full_name: string; email: string };
  };
  onGameEnd: () => void;
  onBackToLobby?: () => void;
  onLeaveGame?: () => void;
}

function getCell(board: string, idx: number) {
  const ch = board?.[idx] ?? "_";
  return ch === "X" || ch === "O" ? ch : "_";
}

export function ActiveTTTGame({ game: initialGame, onGameEnd, onBackToLobby, onLeaveGame }: ActiveTTTGameProps) {
  const { user } = useAuth();
  const { t } = useLanguage();

  const [game, setGame] = useState<TTTGame>(initialGame);
  const [loading, setLoading] = useState(false);
  const [mmcBalance, setMmcBalance] = useState<number | null>(null);

  const [newBet, setNewBet] = useState<number | "">("");
  const [isBetSubmitting, setIsBetSubmitting] = useState(false);

  const [leaveOpen, setLeaveOpen] = useState(false);

  const gameRef = useRef(game);
  useEffect(() => {
    gameRef.current = game;
  }, [game]);

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
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    if (game.status !== "finished") return;

    let cancelled = false;
    (async () => {
      const bal = await GameService.getMmcBalance(user.id);
      if (!cancelled) setMmcBalance(bal);
    })();

    return () => {
      cancelled = true;
    };
  }, [game.status, user?.id]);

  const isHost = user?.id === game.host_id;
  const isGuest = user?.id === game.guest_id;

  const mySymbol = isHost ? game.host_symbol : isGuest ? game.guest_symbol : null;
  const isMyTurn = !!user?.id && game.turn_player_id === user.id;

  const betNotSet = game.bet_amount == null;
  const betDisplay = game.bet_amount == null ? "—" : game.bet_amount;

  // Acceso directo a propiedades de TTTGame
  const hasPendingBetProposal = game.next_bet_amount != null && game.next_bet_proposer_id != null;
  const iProposedBet = hasPendingBetProposal && game.next_bet_proposer_id === user?.id;

  const boardEmpty = (game.board ?? "_________") === "_________";

  const canNegotiateBetNow =
    (isHost || isGuest) &&
    game.status === "active" &&
    betNotSet &&
    !!game.host_id &&
    !!game.guest_id &&
    boardEmpty;

  const handleCellClick = async (cell: number) => {
    if (!user) return;
    if (!isMyTurn) return;
    if (game.bet_amount == null) return;

    const board = game.board ?? "_________";
    if (getCell(board, cell) !== "_") return;

    setLoading(true);
    const { success, error } = await GameService.submitTTTMove(game.id, cell);
    setLoading(false);

    if (!success) {
      toast({ title: t("common.error"), description: error || t("game_room.errors.move_failed"), variant: "destructive" });
      return;
    }

    toast({ title: t("common.success"), description: t("game_room.active_game.move_submitted") });
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

  const handleProposeNewBet = async () => {
    if (!user) return;
    if (newBet === "" || Number(newBet) <= 0) return;

    setIsBetSubmitting(true);
    const { success, error } = await GameService.proposeNewTTTBet(game.id, Number(newBet));
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
            {onBackToLobby && (
              <Button variant="outline" className="flex-1" onClick={onBackToLobby}>
                {t("game_room.results.new_round")}
              </Button>
            )}
            <Button variant="outline" className="flex-1" onClick={onBackToLobby ?? onLeaveGame ?? onGameEnd}>
              <LogOut className="w-4 h-4 mr-2" />
              {t("game_room.actions.leave_game")}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const board = (game.board ?? "_________").padEnd(9, "_").slice(0, 9);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card className="border-2">
        <CardHeader className="text-center">
          <Badge variant={game.status === "active" ? "default" : "secondary"} className="mx-auto">
            {t(`game_room.game_status.${game.status}` as any)}
          </Badge>

          <CardTitle className="text-3xl font-serif">
            {betDisplay} {t("mmc.short")}
          </CardTitle>

          <CardDescription>
            {mySymbol ? t("game_room.ttt.you_are", { symbol: mySymbol }) : t("game_room.waiting_opponent")}
          </CardDescription>

          <div className="text-sm text-muted-foreground">
            {t("game_room.mmc_balance")}:{" "}
            <span className="font-medium text-foreground">
              {mmcBalance == null ? "—" : `${mmcBalance.toLocaleString()} ${t("mmc.short")}`}
            </span>
          </div>

          {(game.status === "active" || game.status === "playing") && !!mySymbol && (
            <div className="text-sm font-medium">
              {isMyTurn ? t("game_room.ttt.your_turn") : t("game_room.ttt.opponent_turn")}
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
                <div className="rounded-xl border border-stone-200 dark:border-stone-800 p-4 space-y-3">
                  <div className="text-sm font-medium">{t("game_room.active_game.bet_amount_mmc")}</div>

                  {!hasPendingBetProposal ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        value={newBet}
                        onChange={(e) => setNewBet(e.target.value === "" ? "" : Number(e.target.value))}
                        className="w-28 rounded-md border px-2 py-1 text-sm bg-background text-foreground"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleProposeNewBet}
                        disabled={isBetSubmitting || newBet === "" || Number(newBet) <= 0}
                      >
                        {isBetSubmitting ? t("common.loading") : t("game_room.active_game.propose_button")}
                      </Button>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-amber-500/60 bg-amber-500/10 p-3 text-sm space-y-2">
                      {iProposedBet ? (
                        <p className="text-amber-200">
                          {t("game_room.bet_change.pending_for_other", { amount: game.next_bet_amount })}
                        </p>
                      ) : (
                        <>
                          <p className="text-amber-200">
                            {t("game_room.bet_change.pending_for_you", { amount: game.next_bet_amount })}
                          </p>
                          <Button size="sm" onClick={handleAcceptNewBet} disabled={isBetSubmitting}>
                            {isBetSubmitting ? t("common.loading") : t("game_room.active_game.accept_button")}
                          </Button>
                        </>
                      )}
                    </div>
                  )}

                  <div className="text-xs text-muted-foreground">{t("game_room.active_game.bet_help")}</div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 9 }).map((_, idx) => {
                  const cell = getCell(board, idx);
                  const disabled =
                    loading ||
                    !(game.status === "active" || game.status === "playing") ||
                    game.bet_amount == null ||
                    !isMyTurn ||
                    cell !== "_" ||
                    !(isHost || isGuest);

                  return (
                    <button
                      key={idx}
                      type="button"
                      aria-label={t("game_room.ttt.cell_aria", { index: idx + 1 })}
                      disabled={disabled}
                      onClick={() => void handleCellClick(idx)}
                      className={cn(
                        "aspect-square rounded-xl border text-4xl font-bold",
                        "flex items-center justify-center",
                        "transition-colors",
                        disabled ? "opacity-70" : "hover:bg-stone-100 dark:hover:bg-stone-900"
                      )}
                    >
                      {cell === "_" ? "" : cell}
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
                <Button onClick={handleLeaveConfirmed} disabled={loading}>
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