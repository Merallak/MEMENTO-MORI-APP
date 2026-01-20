import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";

interface TurnDeciderProps {
  winnerName: string;
  onComplete: () => void;
  duration?: number;
}

type AnimationType = "coin" | "dice" | "roulette";

export function TurnDecider({ winnerName, onComplete, duration = 2500 }: TurnDeciderProps) {
  const { t } = useLanguage();
  const [phase, setPhase] = useState<"animating" | "revealing" | "done">("animating");
  const [animationType] = useState<AnimationType>(() => {
    const types: AnimationType[] = ["coin", "dice", "roulette"];
    return types[Math.floor(Math.random() * types.length)];
  });

  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    const revealTimer = setTimeout(() => setPhase("revealing"), duration);
    const doneTimer = setTimeout(() => {
      setPhase("done");
      onCompleteRef.current();
    }, duration + 1500);

    return () => {
      clearTimeout(revealTimer);
      clearTimeout(doneTimer);
    };
  }, [duration]);

  if (phase === "done") return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      >
        <div className="flex flex-col items-center gap-6 p-8">
          {phase === "animating" && (
            <>
              <div className="text-lg text-white/80 font-medium">
                {t("game_room.turn_decider.deciding")}
              </div>
              {animationType === "coin" && <CoinAnimation />}
              {animationType === "dice" && <DiceAnimation />}
              {animationType === "roulette" && <RouletteAnimation />}
            </>
          )}

          {phase === "revealing" && (
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", damping: 15 }}
              className="text-center"
            >
              <div className="text-xl text-white/80 mb-2">
                {t("game_room.turn_decider.goes_first")}
              </div>
              <div className="text-4xl font-bold text-white">{winnerName}</div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function CoinAnimation() {
  return (
    <motion.div
      animate={{ rotateY: [0, 1800] }}
      transition={{ duration: 2.5, ease: "easeInOut" }}
      className="w-24 h-24 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-4xl font-bold text-yellow-900 shadow-xl"
      style={{ transformStyle: "preserve-3d" }}
    >
      ?
    </motion.div>
  );
}

function DiceAnimation() {
  const [face, setFace] = useState(1);

  useEffect(() => {
    const interval = setInterval(() => {
      setFace(Math.floor(Math.random() * 6) + 1);
    }, 100);

    const timeout = setTimeout(() => clearInterval(interval), 2400);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);

  const dots: Record<number, string> = {
    1: "⚀",
    2: "⚁",
    3: "⚂",
    4: "⚃",
    5: "⚄",
    6: "⚅",
  };

  return (
    <motion.div
      animate={{ rotate: [0, 360, 720, 1080] }}
      transition={{ duration: 2.5, ease: "easeInOut" }}
      className="w-24 h-24 rounded-xl bg-white flex items-center justify-center text-6xl shadow-xl"
    >
      {dots[face]}
    </motion.div>
  );
}

function RouletteAnimation() {
  return (
    <div className="relative w-28 h-28">
      <motion.div
        animate={{ rotate: [0, 1440] }}
        transition={{ duration: 2.5, ease: "easeOut" }}
        className="w-28 h-28 rounded-full border-8 border-dashed border-white/60"
      />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white" />
      <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-b-[12px] border-l-transparent border-r-transparent border-b-red-500" />
    </div>
  );
}