import React from 'react';
import { GameState } from '../types/GameState';

interface GameUIProps {
  gameState: GameState;
  onStartGame: () => void;
}

export default function GameUI({ gameState, onStartGame }: GameUIProps) {
  if (gameState === GameState.PLAYING) {
    return null; // Hide UI when playing
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.3)', // Semi-transparent overlay
        zIndex: 1000,
        pointerEvents: 'none' // Allow clicks to pass through to canvas
      }}
    >
      <button
        onClick={onStartGame}
        style={{
          background: 'white',
          border: '2px solid #333',
          borderRadius: '8px',
          padding: '16px 32px',
          fontSize: '24px',
          fontWeight: 'bold',
          color: '#333',
          cursor: 'pointer',
          pointerEvents: 'auto' // Re-enable pointer events only for the button
        }}
      >
        Start
      </button>
    </div>
  );
}