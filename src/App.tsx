import { useRef, useState, useEffect } from 'react';
import { IRefPhaserGame, PhaserGame } from './PhaserGame';
import { PhysicsSimulation } from './game/scenes/PhysicsSimulation';

function App() {
    const phaserRef = useRef<IRefPhaserGame | null>(null);
    const [isRunning, setIsRunning] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [showDebug, setShowDebug] = useState(true);
    const [showVisuals, setShowVisuals] = useState(true);
    const [fps, setFps] = useState<number>(0);

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
        // ensure debug and visuals state matches checkboxes
        const scene = phaserRef.current?.scene as PhysicsSimulation;
        scene?.setDebug(showDebug);
        scene?.setVisuals(showVisuals);
    };

    const handleDebugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const checked = e.target.checked;
        setShowDebug(checked);
        const scene = phaserRef.current?.scene as PhysicsSimulation;
        scene?.setDebug(checked);
    };

    const handleVisualsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const checked = e.target.checked;
        setShowVisuals(checked);
        const scene = phaserRef.current?.scene as PhysicsSimulation;
        scene?.setVisuals(checked);
    };

    const handleSpawnBall = () => {
        const scene = phaserRef.current?.scene as PhysicsSimulation;
        scene?.spawnBall();
    };

    // FPS updater
    useEffect(() => {
        let frameId: number;
        const update = () => {
            const currentFps = phaserRef.current?.game ? Math.round(phaserRef.current.game.loop.actualFps) : 0;
            setFps(currentFps);
            frameId = requestAnimationFrame(update);
        };
        frameId = requestAnimationFrame(update);
        return () => cancelAnimationFrame(frameId);
    }, []);

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
                    <button className="button" onClick={handleSpawnBall} style={{ marginLeft: '8px' }}>
                        Spawn Ball
                    </button>
                </div>

                <div className="info-panel">
                    <p><strong>Status:</strong> {isRunning ? (isPaused ? 'Paused' : 'Running') : 'Stopped'}</p>
                    <p>Watch the red ball bounce around the white ring!</p>
                    <p><strong>FPS:</strong> {fps}</p>
                    <label style={{ display: 'block', marginTop: '8px' }}>
                        <input type="checkbox" checked={showDebug} onChange={handleDebugChange} />
                        {' '}Debug
                    </label>
                    <label style={{ display: 'block', marginTop: '8px' }}>
                        <input type="checkbox" checked={showVisuals} onChange={handleVisualsChange} />
                        {' '}Visuals
                    </label>
                </div>
            </div>
        </div>
    );
}

export default App;
