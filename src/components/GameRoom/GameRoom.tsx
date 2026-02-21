import { useState, useEffect } from "react";
import {
  GameService,
  type RPSGame,
  type TTTGame,
  type CoinflipGame,
} from "@/services/gameService";
import { useAuth } from "@/contexts/AuthContext";
import { GameLobby } from "./GameLobby";
import { ActiveRPSGame } from "./ActiveRPSGame"; // CORREGIDO: Importar el nuevo archivo
import { ActiveTTTGame } from "./ActiveTTTGame";
import { ActiveCoinflipGame } from "./ActiveCoinflipGame";
import { Loader2 } from "lucide-react";

type ActiveGameState =
  | { type: "rps"; game: RPSGame }
  | { type: "ttt"; game: TTTGame }
  | { type: "coinflip"; game: CoinflipGame }
  | null;

export function GameRoom() {
  const { user } = useAuth();

  const [activeGame, setActiveGame] = useState<ActiveGameState>(null);
  const [loading, setLoading] = useState(true);

  const checkActiveGame = async () => {
    if (!user) {
      setActiveGame(null);
      setLoading(false);
      return;
    }

    // Check RPS
    const rps = await GameService.getUserActiveGame(user.id);
    if (rps) {
      setActiveGame({ type: "rps", game: rps });
      setLoading(false);
      return;
    }

    // Check TTT
    const ttt = await GameService.getUserActiveTTTGame(user.id);
    if (ttt) {
      setActiveGame({ type: "ttt", game: ttt });
      setLoading(false);
      return;
    }

    // Check Coinflip
    const coinflip = await GameService.getUserActiveCoinflipGame(user.id);
    if (coinflip) {
      setActiveGame({ type: "coinflip", game: coinflip });
      setLoading(false);
      return;
    }

    setActiveGame(null);
    setLoading(false);
  };

  useEffect(() => {
    void checkActiveGame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="relative">
      {activeGame ? (
        activeGame.type === "rps" ? (
          <ActiveRPSGame // CORREGIDO: Usar el nuevo componente
            game={activeGame.game}
            onGameEnd={() => {
              setActiveGame(null);
              void checkActiveGame();
            }}
            onLeaveGame={() => {
              setActiveGame(null);
            }}
          />
        ) : activeGame.type === "ttt" ? (
          <ActiveTTTGame
            game={activeGame.game}
            onGameEnd={() => {
              setActiveGame(null);
              void checkActiveGame();
            }}
            onLeaveGame={() => {
              setActiveGame(null);
            }}
          />
        ) : activeGame.type === "coinflip" ? (
          <ActiveCoinflipGame
            game={activeGame.game}
            onGameEnd={() => {
              setActiveGame(null);
              void checkActiveGame();
            }}
            onLeaveGame={() => {
              setActiveGame(null);
            }}
          />
        ) : null
      ) : (
        <GameLobby onGameJoined={checkActiveGame} />
      )}
    </div>
  );
}