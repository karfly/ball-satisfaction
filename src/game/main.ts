import { AUTO, Game } from 'phaser';
import { PhysicsSimulation } from './scenes/PhysicsSimulation';

// Game configuration
const config: Phaser.Types.Core.GameConfig = {
    type: AUTO,
    width: 1024,
    height: 768,
    parent: 'game-container',
    backgroundColor: '#1a1a2e',
    physics: {
        default: 'matter',
        matter: {
            enableSleeping: false,
            gravity: { x: 0, y: 0.8 },
            debug: false // Set to true for physics debugging
        }
    },
    scene: [PhysicsSimulation]
};

/**
 * Initialize and start the Phaser game
 * @param parent - The DOM element ID to attach the game to
 * @returns The Phaser Game instance
 */
const StartGame = (parent: string): Game => {
    return new Game({ ...config, parent });
};

export default StartGame;
