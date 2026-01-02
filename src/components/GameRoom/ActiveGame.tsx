import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GameService, type GameMove, type RPSGame } from "@/services/gameService";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Scissors, Scroll, Trophy, RotateCcw, LogOut } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface ActiveGameProps {
    game: RPSGame & {
        host?: { full_name: string; email: string };
        guest?: { full_name: string; email: string };
    };
    onGameEnd: () => void;
    onBackToLobby?: () => void;
    onLeaveGame?: () => void;
}

export function ActiveGame({
    game: initialGame,
    onGameEnd,
    onBackToLobby,
    onLeaveGame,
}: ActiveGameProps) {
    const { user } = useAuth();
    const { t } = useLanguage();

    const [game, setGame] = useState <
        RPSGame & {
            host?: { full_name: string; email: string };
            guest?: { full_name: string; email: string };
        }
        > (initialGame);

    const [loading, setLoading] = useState(false);
    const [myMove, setMyMove] = useState < GameMove | null > (null);

    // Evitar closures “viejos” en callbacks
    const gameRef = useRef(game);
    useEffect(() => {
        gameRef.current = game;
    }, [game]);

    useEffect(() => {
        // Realtime subscription
        const channel = GameService.subscribeToGame(initialGame.id, (updatedGame) => {
            setGame(updatedGame);

            // Si backend reseteó la ronda (moves limpios), reseteamos estado local
            const movesCleared = !updatedGame.host_move && !updatedGame.guest_move;
            if (movesCleared && (updatedGame.status === "active" || updatedGame.status === "playing")) {
                setMyMove(null);
            }

            if (updatedGame.status === "cancelled") {
                onGameEnd();
            }
        });

        // Fallback polling
        const interval = setInterval(async () => {
            const { data } = await GameService.getGame(initialGame.id);
            if (data) {
                setGame(data);
                const movesCleared = !data.host_move && !data.guest_move;
                if (movesCleared && (data.status === "active" || data.status === "playing")) {
                    setMyMove(null);
                }
            }
        }, 3000);

        return () => {
            GameService.unsubscribeFromGame(channel);
            clearInterval(interval);
        };
    }, [initialGame.id, onGameEnd]);

    const handleMove = async (move: GameMove) => {
        if (!user) return;
        setLoading(true);

        const { success, error } = await GameService.submitMove(game.id, move);

        if (success) {
            setMyMove(move);
            toast({
                title: t("common.success"),
                description: "Move submitted successfully",
            });
        } else {
            toast({
                title: t("common.error"),
                description: error || t("game_room.errors.move_failed"),
                variant: "destructive",
            });
        }
        setLoading(false);
    };

    const handleRestart = async () => {
        setLoading(true);
        const { success, error } = await GameService.restartGame(game.id);

        if (success) {
            setMyMove(null);
            toast({
                title: t("game_room.results.new_round"),
                description: t("game_room.results.continue_playing"),
            });

            // Traer estado actualizado
            const { data } = await GameService.getGame(game.id);
            if (data) setGame(data);
        } else {
            toast({ title: "Error", description: error, variant: "destructive" });
        }
        setLoading(false);
    };

    const handleForfeit = async () => {
        setLoading(true);
        const result = await GameService.forfeitGame(game.id);
        setLoading(false);

        if (result.success) {
            onGameEnd();
        } else if (result.error) {
            toast({ title: "Error", description: result.error, variant: "destructive" });
        }
    };

    const isHost = user?.id === game.host_id;
    const isGuest = user?.id === game.guest_id;

    const hasMoved =
        myMove !== null || (isHost ? !!game.host_move : !!game.guest_move);

    const opponentHasMoved = isHost ? !!game.guest_move : !!game.host_move;

    const getMoveIcon = (move: string | null) => {
        const iconVariants = {
            hidden: { opacity: 0, scale: 0.8, rotateY: 90 },
            visible: { opacity: 1, scale: 1, rotateY: 0 },
            exit: { opacity: 0, scale: 0.8, rotateY: -90 },
        };

        switch (move) {
            case "rock":
                return (
                    <motion.div
                        variants={iconVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        transition={{ duration: 0.5, ease: "easeInOut" }}
                        className="p-4 bg-stone-100 rounded-full shadow-lg"
                    >
                        <motion.div
                            className="w-8 h-8 bg-stone-800 rounded-full"
                            animate={{ scale: [1, 1.1, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                        />
                    </motion.div>
                );
            case "paper":
                return (
                    <motion.div
                        variants={iconVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        transition={{ duration: 0.5, ease: "easeInOut" }}
                    >
                        <Scroll className="w-12 h-12 text-blue-500" />
                    </motion.div>
                );
            case "scissors":
                return (
                    <motion.div
                        variants={iconVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        transition={{ duration: 0.5, ease: "easeInOut" }}
                    >
                        <motion.div
                            animate={{ rotate: [0, 10, -10, 0] }}
                            transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                        >
                            <Scissors className="w-12 h-12 text-red-500" />
                        </motion.div>
                    </motion.div>
                );
            default:
                return (
                    <motion.div
                        className="w-12 h-12 bg-stone-200 rounded-full"
                        animate={{
                            scale: [1, 1.1, 1],
                            opacity: [0.5, 1, 0.5],
                        }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                    />
                );
        }
    };

    const renderResult = () => {
        if (game.status !== "finished") return null;

        const isDraw = !game.winner_id;

        let winner: "host" | "guest" | null = null;
        if (game.winner_id === game.host_id) winner = "host";
        else if (game.winner_id === game.guest_id) winner = "guest";

        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-8 text-center space-y-4 p-6 bg-stone-50 dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800"
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                    className={cn(
                        "text-center p-6 rounded-2xl",
                        winner === "host"
                            ? "bg-green-500/20 border-green-500/50"
                            : winner === "guest"
                                ? "bg-blue-500/20 border-blue-500/50"
                                : "bg-yellow-500/20 border-yellow-500/50"
                    )}
                >
                    <Trophy
                        className={cn(
                            "w-16 h-16 mx-auto mb-4",
                            winner === "host"
                                ? "text-green-400"
                                : winner === "guest"
                                    ? "text-blue-400"
                                    : "text-yellow-400"
                        )}
                    />

                    <h3 className="text-2xl font-bold text-white mb-2">
                        {isDraw ? t("game_room.draw") : t("game_room.results.winner")}
                    </h3>

                    <p className="text-3xl font-bold text-white mb-4">
                        {winner === "host"
                            ? game.host?.full_name || (isHost ? t("game_room.results.you") : t("game_room.anonymous"))
                            : winner === "guest"
                                ? game.guest?.full_name || (isGuest ? t("game_room.results.you") : t("game_room.anonymous"))
                                : t("game_room.draw")}
                    </p>

                    <div className="text-xl text-yellow-400 mb-6">
                        {t("game_room.results.prize")}: {game.bet_amount} MMC
                    </div>

                    <div className="space-y-3">
                        <Button
                            onClick={handleRestart}
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold py-3"
                        >
                            <RotateCcw className="w-5 h-5 mr-2" />
                            {loading ? t("common.loading") : t("game_room.results.continue_playing")}
                        </Button>

                        <div className="flex gap-3">
                            {onBackToLobby && (
                                <Button
                                    onClick={onBackToLobby}
                                    variant="outline"
                                    className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-800"
                                >
                                    {t("game_room.results.new_round")}
                                </Button>
                            )}

                            <Button
                                onClick={onBackToLobby ?? onLeaveGame ?? onGameEnd}
                                variant="outline"
                                className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-800"
                            >
                                <LogOut className="w-4 h-4 mr-2" />
                                {t("game_room.actions.leave_game")}
                            </Button>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        );
    };

    return (
        <motion.div
            className="max-w-2xl mx-auto space-y-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
        >
            <motion.div
                variants={{
                    initial: { scale: 0.9, opacity: 0 },
                    animate: { scale: 1, opacity: 1 },
                }}
                transition={{ ease: [0.23, 1, 0.32, 1] }}
            >
                <Card
                    className={cn(
                        "border-2 transition-all duration-500",
                        game.status === "finished" &&
                        "border-green-500/50 bg-green-50/50 dark:border-green-400/30 dark:bg-green-950/20",
                        (game.status === "playing" || game.status === "active") &&
                        "border-yellow-500/50 bg-yellow-50/50 dark:border-yellow-400/30 dark:bg-yellow-950/20",
                        game.status === "waiting" &&
                        "border-blue-500/50 bg-blue-50/50 dark:border-blue-400/30 dark:bg-blue-950/20"
                    )}
                >
                    <div className="text-center pb-2">
                        <CardHeader>
                            <Badge
                                variant={game.status === "active" ? "default" : "secondary"}
                                className={cn(
                                    "mx-auto mb-2 transition-all duration-300",
                                    game.status === "finished" && "bg-green-500 hover:bg-green-600",
                                    (game.status === "playing" || game.status === "active") &&
                                    "bg-yellow-500 hover:bg-yellow-600",
                                    game.status === "waiting" && "bg-blue-500 hover:bg-blue-600"
                                )}
                            >
                                {t(`game_room.game_status.${game.status}` as any)}
                            </Badge>

                            <CardTitle className="text-3xl font-serif">
                                {game.bet_amount} MMC
                            </CardTitle>

                            <CardDescription>
                                {isHost ? "You vs Guest" : "Host vs You"}
                            </CardDescription>
                        </CardHeader>
                    </div>

                    <CardContent className="space-y-8">
                        <AnimatePresence mode="wait">
                            {game.status === "waiting" ? (
                                <motion.div
                                    key="waiting"
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 1.05 }}
                                    transition={{ duration: 0.4, ease: "easeInOut" }}
                                    className="text-center py-12 space-y-4"
                                >
                                    <motion.div
                                        animate={{ rotate: [0, 360], scale: [1, 1.1, 1] }}
                                        transition={{
                                            rotate: { duration: 2, repeat: Infinity, ease: "linear" },
                                            scale: {
                                                duration: 1,
                                                repeat: Infinity,
                                                repeatType: "reverse",
                                                ease: "easeInOut",
                                            },
                                        }}
                                    >
                                        <Loader2 className="w-12 h-12 mx-auto text-primary" />
                                    </motion.div>

                                    <motion.h3
                                        className="text-xl font-medium"
                                        animate={{ opacity: [0.5, 1, 0.5] }}
                                        transition={{ duration: 2, repeat: Infinity }}
                                    >
                                        {t("game_room.waiting_opponent")}
                                    </motion.h3>

                                    <div className="mt-4 flex flex-col sm:flex-row gap-3 justify-center">
                                        <Button
                                            variant="ghost"
                                            onClick={handleForfeit}
                                            className="text-muted-foreground hover:text-foreground"
                                            disabled={loading}
                                        >
                                            <LogOut className="w-4 h-4 mr-2" />
                                            {t("game_room.actions.leave_game")}
                                        </Button>
                                    </div>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="playing"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.4 }}
                                    className="space-y-8"
                                >
                                    {/* Arena */}
                                    <motion.div
                                        className="flex justify-between items-center px-4 md:px-12"
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.5, delay: 0.2 }}
                                    >
                                        {/* My Move */}
                                        <motion.div
                                            className="text-center space-y-2"
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ duration: 0.5, delay: 0.3 }}
                                        >
                                            <div className="text-sm font-medium text-muted-foreground">
                                                You
                                            </div>
                                            <motion.div
                                                className={cn(
                                                    "w-24 h-24 rounded-2xl flex items-center justify-center border-2 transition-all duration-300",
                                                    hasMoved
                                                        ? "border-primary bg-primary/5 shadow-lg shadow-primary/20"
                                                        : "border-dashed border-stone-300"
                                                )}
                                            >
                                                {game.status === "finished" ? (
                                                    getMoveIcon(isHost ? game.host_move : game.guest_move)
                                                ) : hasMoved ? (
                                                    <div className="w-12 h-12 bg-primary rounded-full" />
                                                ) : (
                                                    <motion.span
                                                        className="text-4xl"
                                                        animate={{ opacity: [0.3, 0.6, 0.3] }}
                                                        transition={{ duration: 1.5, repeat: Infinity }}
                                                    >
                                                        ?
                                                    </motion.span>
                                                )}
                                            </motion.div>
                                        </motion.div>

                                        <motion.div
                                            className="text-2xl font-bold text-muted-foreground"
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            transition={{
                                                delay: 0.4,
                                                type: "spring",
                                                stiffness: 400,
                                            }}
                                        >
                                            VS
                                        </motion.div>

                                        {/* Opponent Move */}
                                        <motion.div
                                            className="text-center space-y-2"
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ duration: 0.5, delay: 0.5 }}
                                        >
                                            <div className="text-sm font-medium text-muted-foreground">
                                                Opponent
                                            </div>
                                            <motion.div
                                                className={cn(
                                                    "w-24 h-24 rounded-2xl flex items-center justify-center border-2 transition-all duration-300",
                                                    game.status === "finished" ||
                                                        (game.status === "active" &&
                                                            !hasMoved &&
                                                            opponentHasMoved)
                                                        ? "border-stone-800 bg-stone-100 shadow-lg"
                                                        : "border-dashed border-stone-300"
                                                )}
                                            >
                                                {game.status === "finished" ? (
                                                    getMoveIcon(isHost ? game.guest_move : game.host_move)
                                                ) : (
                                                    <motion.span
                                                        className="text-4xl"
                                                        animate={{
                                                            opacity: [0.3, 0.6, 0.3],
                                                            rotate: [0, 5, -5, 0],
                                                        }}
                                                        transition={{
                                                            opacity: { duration: 1.5, repeat: Infinity },
                                                            rotate: {
                                                                duration: 2,
                                                                repeat: Infinity,
                                                                ease: "easeInOut",
                                                            },
                                                        }}
                                                    >
                                                        ?
                                                    </motion.span>
                                                )}
                                            </motion.div>
                                        </motion.div>
                                    </motion.div>

                                    {/* Controls */}
                                    <AnimatePresence mode="wait">
                                        {(game.status === "active" || game.status === "playing") &&
                                            !hasMoved && (
                                                <motion.div
                                                    key="move-controls"
                                                    initial={{ opacity: 0, y: 20 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: -20 }}
                                                    transition={{ duration: 0.5 }}
                                                    className="space-y-4"
                                                >
                                                    <p className="text-center text-lg font-medium">
                                                        {t("game_room.your_move")}
                                                    </p>

                                                    <div className="grid grid-cols-3 gap-4">
                                                        {[
                                                            {
                                                                move: "rock" as GameMove,
                                                                icon: (
                                                                    <div className="w-8 h-8 bg-stone-800 rounded-full" />
                                                                ),
                                                            },
                                                            {
                                                                move: "paper" as GameMove,
                                                                icon: <Scroll className="w-8 h-8" />,
                                                            },
                                                            {
                                                                move: "scissors" as GameMove,
                                                                icon: <Scissors className="w-8 h-8" />,
                                                            },
                                                        ].map((item) => (
                                                            <Button
                                                                key={item.move}
                                                                variant="outline"
                                                                className="h-24 w-full flex flex-col gap-2"
                                                                onClick={() => handleMove(item.move)}
                                                                disabled={loading}
                                                            >
                                                                {item.icon}
                                                                {t(`game_room.${item.move}`)}
                                                            </Button>
                                                        ))}
                                                    </div>
                                                </motion.div>
                                            )}
                                    </AnimatePresence>

                                    <AnimatePresence>
                                        {(game.status === "active" || game.status === "playing") &&
                                            hasMoved && (
                                                <motion.div
                                                    key="waiting-opponent"
                                                    initial={{ opacity: 0, scale: 0.9 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    exit={{ opacity: 0, scale: 0.9 }}
                                                    className="text-center py-8"
                                                >
                                                    <div className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-yellow-100 to-orange-100 text-yellow-800 rounded-full shadow-lg">
                                                        <Loader2 className="w-5 h-5 animate-spin" />
                                                        {t("game_room.waiting_opponent")}
                                                    </div>

                                                    <div className="flex justify-center mt-4">
                                                        <Button
                                                            variant="ghost"
                                                            onClick={handleForfeit}
                                                            disabled={loading}
                                                            className="text-muted-foreground hover:text-foreground"
                                                        >
                                                            <LogOut className="w-4 h-4 mr-2" />
                                                            {t("game_room.actions.leave_game")}
                                                        </Button>
                                                    </div>
                                                </motion.div>
                                            )}
                                    </AnimatePresence>

                                    <AnimatePresence mode="wait">
                                        {game.status === "finished" && renderResult()}
                                    </AnimatePresence>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </CardContent>
                </Card>
            </motion.div>
        </motion.div>
    );
}