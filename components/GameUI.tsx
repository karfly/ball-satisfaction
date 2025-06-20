import React from 'react';
import { GameState } from '../types/GameState';

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
  const renderLoadingScreen = () => (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        zIndex: 1000,
        pointerEvents: 'none',
        color: 'white',
        textAlign: 'center'
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
          pointerEvents: 'auto',
          marginBottom: '32px',
          transition: 'all 0.2s ease',
          boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)'
        }}
        onMouseEnter={(e) => {
          const target = e.target as HTMLButtonElement;
          target.style.transform = 'scale(1.05)';
          target.style.background = '#f0f0f0';
        }}
        onMouseLeave={(e) => {
          const target = e.target as HTMLButtonElement;
          target.style.transform = 'scale(1)';
          target.style.background = 'white';
        }}
      >
        Start
      </button>
      <div style={{
        fontSize: '18px',
        maxWidth: '400px',
        lineHeight: '1.4',
        pointerEvents: 'none'
      }}>
        Escape {gameConfig?.targetEscapes || 8} balls through the gap in {gameConfig?.timeLimit || 60} seconds. 2 new balls spawn with each escape!
      </div>
    </div>
  );

  const renderGameOverScreen = () => (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        zIndex: 1000,
        pointerEvents: 'none',
        color: 'white',
        textAlign: 'center'
      }}
    >
      <div style={{
        fontSize: '32px',
        fontWeight: 'bold',
        marginBottom: '24px',
        pointerEvents: 'none'
      }}>
        You lost! Time's up!
      </div>
      <button
        onClick={onStartGame}
        style={{
          background: 'white',
          border: '2px solid #333',
          borderRadius: '8px',
          padding: '16px 32px',
          fontSize: '20px',
          fontWeight: 'bold',
          color: '#333',
          cursor: 'pointer',
          pointerEvents: 'auto',
          transition: 'all 0.2s ease',
          boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)'
        }}
        onMouseEnter={(e) => {
          const target = e.target as HTMLButtonElement;
          target.style.transform = 'scale(1.05)';
          target.style.background = '#f0f0f0';
        }}
        onMouseLeave={(e) => {
          const target = e.target as HTMLButtonElement;
          target.style.transform = 'scale(1)';
          target.style.background = 'white';
        }}
      >
        Reload
      </button>
    </div>
  );

  const renderWinScreen = () => (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 100, 0, 0.2)',
        zIndex: 1000,
        pointerEvents: 'none',
        color: 'white',
        textAlign: 'center'
      }}
    >
      <div style={{
        fontSize: '36px',
        fontWeight: 'bold',
        marginBottom: '24px',
        pointerEvents: 'none'
      }}>
        You win! Congratulations!
      </div>
      <button
        onClick={onStartGame}
        style={{
          background: 'white',
          border: '2px solid #333',
          borderRadius: '8px',
          padding: '16px 32px',
          fontSize: '20px',
          fontWeight: 'bold',
          color: '#333',
          cursor: 'pointer',
          pointerEvents: 'auto',
          transition: 'all 0.2s ease',
          boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)'
        }}
        onMouseEnter={(e) => {
          const target = e.target as HTMLButtonElement;
          target.style.transform = 'scale(1.05)';
          target.style.background = '#f0f0f0';
        }}
        onMouseLeave={(e) => {
          const target = e.target as HTMLButtonElement;
          target.style.transform = 'scale(1)';
          target.style.background = 'white';
        }}
      >
        Start Again
      </button>
    </div>
  );

  const renderGameHUD = () => (
    <div
      style={{
        position: 'absolute',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        pointerEvents: 'none',
        color: 'white',
        textAlign: 'center',
        fontSize: '24px',
        fontWeight: 'bold'
      }}
    >
             <div style={{ marginBottom: '8px' }}>
         Escaped: {gameProgress?.escaped || 0} / {gameProgress?.target || 8}
       </div>
      <div style={{ fontSize: '20px' }}>
        {gameTimer}s
      </div>
    </div>
  );

  // Render based on game state
  switch (gameState) {
    case GameState.LOADING:
      return renderLoadingScreen();
    case GameState.PLAYING:
      return renderGameHUD();
    case GameState.GAME_OVER:
      return renderGameOverScreen();
    case GameState.WIN:
      return renderWinScreen();
    default:
      return null;
  }
}