import { useState, useEffect } from "react";
import { GameService, type RPSGame } from "@/services/gameService";
import { useAuth } from "@/contexts/AuthContext";
import { GameLobby } from "./GameLobby";
import { ActiveGame } from "./ActiveGame";
import { Loader2 } from "lucide-react";

export function GameRoom() {
  const { user } = useAuth();
  const [activeGame, setActiveGame] = useState<RPSGame | null>(null);
  const [loading, setLoading] = useState(true);

  const checkActiveGame = async () => {
    if (!user) return;
    const game = await GameService.getUserActiveGame(user.id);
    setActiveGame(game);
    setLoading(false);
  };

  useEffect(() => {
    checkActiveGame();
  }, [user]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (activeGame) {
    return (
      <ActiveGame 
        game={activeGame} 
        onGameEnd={() => {
          // Fin de la partida (por ejemplo, terminó una ronda o fue cancelada)
          setActiveGame(null);
          void checkActiveGame();
        }}
        onLeaveGame={() => {
          // El usuario decide salir explícitamente de la sala de juego
          setActiveGame(null);
        }}
      />
    );
  }

  return (
    <GameLobby onGameJoined={checkActiveGame} />
  );
}