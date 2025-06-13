import { PhysicsSimulation } from './scenes/PhysicsSimulation';
import { AUTO, Game } from 'phaser';

//  Find out more information about the Game Config at:
//  https://newdocs.phaser.io/docs/3.70.0/Phaser.Types.Core.GameConfig
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
            debug: false
        }
    },
    scene: [
        PhysicsSimulation
    ]
};

const StartGame = (parent: string) => {

    return new Game({ ...config, parent });

}

export default StartGame;
