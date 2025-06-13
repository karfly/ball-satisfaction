import { useRef, useState } from 'react';
import { IRefPhaserGame, PhaserGame } from './PhaserGame';
import { PhysicsSimulation } from './game/scenes/PhysicsSimulation';

function App() {
    const phaserRef = useRef<IRefPhaserGame | null>(null);
    const [isRunning, setIsRunning] = useState(false);

    const handleStartReset = () => {
        const scene = phaserRef.current?.scene as PhysicsSimulation;
        if (!scene) return;

        if (isRunning) {
            // Reset ball position and immediately restart
            scene.resetSimulation();
            setTimeout(() => scene.startSimulation(), 50);
        } else {
            // Start the physics simulation
            scene.startSimulation();
            setIsRunning(true);
        }
    };

    const onSceneReady = () => {
        // Reset UI state when scene is ready
        setIsRunning(false);
    };

    return (
        <div id="app">
            <PhaserGame ref={phaserRef} currentActiveScene={onSceneReady} />

            <div className="controls-panel">
                <div className="button-container">
                    <button className="button" onClick={handleStartReset}>
                        {isRunning ? 'Reset' : 'Start'}
                    </button>
                </div>

                <div className="info-panel">
                    <p><strong>Status:</strong> {isRunning ? 'Running' : 'Stopped'}</p>
                    <p>Watch the red ball bounce around the white ring!</p>
                </div>
            </div>
        </div>
    );
}

export default App;
