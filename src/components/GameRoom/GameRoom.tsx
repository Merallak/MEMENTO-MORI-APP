import { useState, useEffect } from "react";
import { GameService, type RPSGame } from "@/services/gameService";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { GameLobby } from "./GameLobby";
import { ActiveGame } from "./ActiveGame";
import { Loader2, LogOut } from "lucide-react";
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
import { toast } from "@/hooks/use-toast";

export function GameRoom() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const [activeGame, setActiveGame] = useState<RPSGame | null>(null);
  const [loading, setLoading] = useState(true);

  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const checkActiveGame = async () => {
    if (!user) return;
    const game = await GameService.getUserActiveGame(user.id);
    setActiveGame(game);
    setLoading(false);
  };

  useEffect(() => {
    checkActiveGame();
  }, [user]);

  const handleLeaveConfirmed = async () => {
    if (!user) return;

    // Si no hay partida activa, no hacemos nada (ya estás en el lobby)
    if (!activeGame) {
      setLeaveOpen(false);
      return;
    }

    setLeaving(true);
    const result = await GameService.forfeitGame(activeGame.id);
    setLeaving(false);

    if (!result.success) {
      toast({
        title: t("common.error"),
        description: result.error || t("game_room.errors.move_failed"),
        variant: "destructive",
      });
      return;
    }

    setActiveGame(null);
    setLeaveOpen(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Botón persistente */}
      <div className="fixed top-32 right-6 z-50">
        <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" disabled={!activeGame || leaving}>
              <LogOut className="w-4 h-4 mr-2" />
              {t("game_room.actions.leave_game")}
            </Button>
          </DialogTrigger>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("game_room.actions.leave_confirm_title")}</DialogTitle>
              <DialogDescription>
                {t("game_room.actions.leave_confirm_desc")}
              </DialogDescription>
            </DialogHeader>

            <DialogFooter>
              <Button variant="outline" onClick={() => setLeaveOpen(false)} disabled={leaving}>
                {t("common.cancel")}
              </Button>
              <Button onClick={handleLeaveConfirmed} disabled={leaving}>
                {leaving ? t("common.loading") : t("common.confirm")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Contenido actual */}
      {activeGame ? (
        <ActiveGame
          game={activeGame}
          onGameEnd={() => {
            setActiveGame(null);
            void checkActiveGame();
          }}
          onLeaveGame={() => {
            setActiveGame(null);
          }}
        />
      ) : (
        <GameLobby onGameJoined={checkActiveGame} />
      )}
    </div>
  );
}