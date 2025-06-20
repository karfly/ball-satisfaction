import React from 'react';
import { GameState } from '../types/GameState';
import { Button } from './ui/button';

interface GameUIProps {
  gameState: GameState;
  onStartGame: () => void;
  gameTimer?: number;
  gameProgress?: { escaped: number; target: number };
  gameConfig?: {
    targetEscapes: number;
    timeLimit: number;
  };
}

export default function GameUI({ gameState, onStartGame, gameTimer = 0, gameProgress, gameConfig }: GameUIProps) {
  // Render different UI based on game state
  const renderStartScreen = () => (


    <div className="absolute inset-0 flex flex-col items-center justify-center z-50 pointer-events-none">
      {/* Start button positioned in the center (over the spinning ring) */}
      <div className="pointer-events-auto mb-8">
        <Button
          onClick={onStartGame}
          size="default"
          className="text-2xl font-bold !px-10 !py-6 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
        >
          Start
        </Button>
      </div>
    </div>
  );

  const renderGameHUD = () => (
    <div className="absolute top-6 left-6 z-50 pointer-events-none">
      <div className="bg-black/80 backdrop-blur-sm text-white p-4 rounded-lg shadow-lg border border-white/20">
        <div className="flex items-center space-x-6">
          <div className="text-center">
            <div className="text-sm text-gray-300">Escaped</div>
            <div className="text-xl font-bold text-green-400">
              {gameProgress?.escaped || 0} / {gameProgress?.target || 10}
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-300">Time</div>
            <div className="text-xl font-bold text-blue-400">{gameTimer}s</div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderGameOverScreen = () => (
    <div className="absolute inset-0 flex flex-col items-center justify-center z-50 pointer-events-none bg-black/50">
      <div className="pointer-events-auto text-center text-white space-y-6">
        <h1 className="text-4xl font-bold text-red-400 mb-4">Game Over!</h1>
        <div className="space-y-2">
          <p className="text-xl">Time's up!</p>
          <p className="text-lg">
            You escaped <span className="font-bold text-yellow-300">{gameProgress?.escaped || 0}</span> out of <span className="font-bold text-white">{gameProgress?.target || 10}</span> balls
          </p>
        </div>
        <Button
          onClick={onStartGame}
          size="lg"
          className="text-2xl font-bold px-16 py-8 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
        >
          Try Again
        </Button>
      </div>
    </div>
  );

  const renderWinScreen = () => (
    <div className="absolute inset-0 flex flex-col items-center justify-center z-50 pointer-events-none bg-black/50">
      <div className="pointer-events-auto text-center text-white space-y-6">
        <h1 className="text-4xl font-bold text-green-400 mb-4">Victory!</h1>
        <div className="space-y-2">
          <p className="text-xl">Congratulations!</p>
          <p className="text-lg">
            You escaped all <span className="font-bold text-yellow-300">{gameProgress?.target || 10}</span> balls
          </p>
          <p className="text-lg">
            with <span className="font-bold text-blue-300">{gameTimer}</span> seconds remaining!
          </p>
        </div>
        <Button
          onClick={onStartGame}
          size="lg"
          className="text-2xl font-bold px-16 py-8 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
        >
          Play Again
        </Button>
      </div>
    </div>
  );

  // Render based on game state
  switch (gameState) {
    case GameState.LOADING:
      return renderStartScreen();
    case GameState.PLAYING:
      return renderGameHUD();
    case GameState.GAME_OVER:
      return renderGameOverScreen();
    case GameState.WIN:
      return renderWinScreen();
    default:
      return (
        <div className="absolute inset-0 flex items-center justify-center z-50 bg-purple-600/90 text-white text-2xl">
          <div className="bg-white/10 p-8 rounded-2xl">
            <p>🤔 Unknown State: {gameState}</p>
          </div>
        </div>
      );
  }
}