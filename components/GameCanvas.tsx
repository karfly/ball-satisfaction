import { useRef, useEffect, useState } from "react";
import { Game } from "../engine/Game";
import { GameState } from "../types/GameState";
import GameUI from "./GameUI";

export default function GameCanvas() {
  const host = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [gameState, setGameState] = useState<GameState>(GameState.LOADING);

  useEffect(() => {
    const g = new Game();
    gameRef.current = g;

    // Set up game state change listener
    g.onGameStateChange = (newState: GameState) => {
      setGameState(newState);
    };

    g.init(host.current!);

    return () => {
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
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <div ref={host} style={{ width: "100%", height: "100%" }} />
      <GameUI gameState={gameState} onStartGame={handleStartGame} />
    </div>
  );
}