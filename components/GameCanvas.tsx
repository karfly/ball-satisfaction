import { useRef, useEffect, useState } from "react";
import { Game } from "../engine/Game";
import { GameState } from "../types/GameState";
import GameUI from "./GameUI";

export default function GameCanvas() {
  const host = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [gameState, setGameState] = useState<GameState>(GameState.LOADING);
  const [gameTimer, setGameTimer] = useState<number>(0);
  const [gameProgress, setGameProgress] = useState<{ escaped: number; target: number }>({ escaped: 0, target: 8 });
  const [gameConfig, setGameConfig] = useState<{ targetEscapes: number; timeLimit: number }>({ targetEscapes: 8, timeLimit: 60 });

  useEffect(() => {
    const g = new Game();
    gameRef.current = g;

    // Set up game state change listener
    g.onGameStateChange = (newState: GameState) => {
      setGameState(newState);
    };

        g.init(host.current!);

    // Get game configuration
    setGameConfig(g.getGameConfig());

    // Set up regular updates for timer and progress during gameplay
    const updateInterval = setInterval(() => {
      if (gameRef.current && gameRef.current.getGameState() === GameState.PLAYING) {
        setGameTimer(gameRef.current.getGameTimer());
        setGameProgress(gameRef.current.getGameProgress());
      }
    }, 100); // Update 10 times per second for smooth timer

    return () => {
      clearInterval(updateInterval);
      g.destroy();
      gameRef.current = null;
    };
  }, []);

  const handleStartGame = () => {
    if (gameRef.current) {
      gameRef.current.startGame();
    }
  };

  return (
    <div className="w-full h-full relative">
      <div ref={host} className="w-full h-full" />
      <GameUI
        gameState={gameState}
        onStartGame={handleStartGame}
        gameTimer={gameTimer}
        gameProgress={gameProgress}
        gameConfig={gameConfig}
      />
    </div>
  );
}