import { useRef, useState } from 'react';
import { IRefPhaserGame, PhaserGame } from './PhaserGame';
import { PhysicsSimulation } from './game/scenes/PhysicsSimulation';

function App()
{
    //  References to the PhaserGame component (game and scene are exposed)
    const phaserRef = useRef<IRefPhaserGame | null>(null);
    const [isSimulationRunning, setIsSimulationRunning] = useState(false);

    const handleStartReset = () => {
        if(phaserRef.current)
        {
            const scene = phaserRef.current.scene as PhysicsSimulation;

            if (scene && scene.scene.key === 'PhysicsSimulation')
            {
                if (isSimulationRunning) {
                    // Reset and immediately start again
                    scene.resetSimulation();
                    setTimeout(() => {
                        scene.startSimulation();
                    }, 50); // Small delay to ensure reset completes
                } else {
                    // Start simulation
                    scene.startSimulation();
                    setIsSimulationRunning(true);
                }
            }
        }
    }

    // Event emitted from the PhaserGame component
    const currentScene = (scene: Phaser.Scene) => {
        console.log('Scene ready:', scene.scene.key);

        // Scene is ready, but simulation is not started yet
        setIsSimulationRunning(false);
    }

        return (
        <div id="app">
            <PhaserGame ref={phaserRef} currentActiveScene={currentScene} />
            <div>
                <div>
                    <button
                        className="button"
                        onClick={handleStartReset}
                    >
                        {isSimulationRunning ? 'Reset' : 'Start'}
                    </button>
                </div>
                <div style={{ marginTop: '20px', color: '#ffffff' }}>
                    <p>Status: {isSimulationRunning ? 'Running' : 'Stopped'}</p>
                    <p>Watch the red ball fall and bounce in the white ring!</p>
                    <p>Click "{isSimulationRunning ? 'Reset' : 'Start'}" to {isSimulationRunning ? 'restart the simulation' : 'begin the simulation'}.</p>
                </div>
            </div>
        </div>
    )
}

export default App
