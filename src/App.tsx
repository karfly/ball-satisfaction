import { useRef, useState } from 'react';
import { IRefPhaserGame, PhaserGame } from './PhaserGame';
import { PhysicsSimulation } from './game/scenes/PhysicsSimulation';

function App() {
    const phaserRef = useRef<IRefPhaserGame | null>(null);
    const [isRunning, setIsRunning] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [showDebug, setShowDebug] = useState(false);

    const handleStartReset = () => {
        const scene = phaserRef.current?.scene as PhysicsSimulation;
        if (!scene) return;

        if (isRunning) {
            // Reset ball position and immediately restart
            scene.resetSimulation();
            setTimeout(() => scene.startSimulation(), 50);
            setIsPaused(false);
        } else {
            // Start the physics simulation
            scene.startSimulation();
            setIsRunning(true);
            setIsPaused(false);
        }
    };

    const handlePauseToggle = () => {
        const scene = phaserRef.current?.scene as PhysicsSimulation;
        if (!scene || !isRunning) return; // can't pause if not running

        if (isPaused) {
            scene.resumeSimulation();
            setIsPaused(false);
        } else {
            scene.pauseSimulation();
            setIsPaused(true);
        }
    };

    const onSceneReady = () => {
        // Reset UI state when scene is ready
        setIsRunning(false);
        setIsPaused(false);
        // ensure debug state matches checkbox
        const scene = phaserRef.current?.scene as PhysicsSimulation;
        scene?.setDebug(showDebug);
    };

    const handleDebugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const checked = e.target.checked;
        setShowDebug(checked);
        const scene = phaserRef.current?.scene as PhysicsSimulation;
        scene?.setDebug(checked);
    };

    return (
        <div id="app">
            <PhaserGame ref={phaserRef} currentActiveScene={onSceneReady} />

            <div className="controls-panel">
                <div className="button-container">
                    <button className="button" onClick={handleStartReset}>
                        {isRunning ? 'Start Again' : 'Start'}
                    </button>
                    {isRunning && (
                        <button className="button" onClick={handlePauseToggle} style={{ marginLeft: '8px' }}>
                            {isPaused ? 'Resume' : 'Pause'}
                        </button>
                    )}
                </div>

                <div className="info-panel">
                    <p><strong>Status:</strong> {isRunning ? (isPaused ? 'Paused' : 'Running') : 'Stopped'}</p>
                    <p>Watch the red ball bounce around the white ring!</p>
                    <label style={{ display: 'block', marginTop: '8px' }}>
                        <input type="checkbox" checked={showDebug} onChange={handleDebugChange} />
                        {' '}Debug
                    </label>
                </div>
            </div>
        </div>
    );
}

export default App;
