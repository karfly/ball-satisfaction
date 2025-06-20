import * as PIXI from "pixi.js";
import type RAPIER from "@dimforge/rapier2d-deterministic";
import { Ball, Ring, KillBoundary, Prefab, type BallConfig, type RingConfig, type BallSpawnConfig, type KillBoundaryConfig } from "./objects";
import { m2p, scaleManager } from "./scale";
import { DebugUI } from "./debug/DebugUI";
import { DebugRenderer } from "./debug/DebugRenderer";
import { ParticleManager } from "./ParticleManager";

// Centralized Game Configuration
const GAME_CONFIG = {
  physics: {
    gravity: { x: 0, y: 20 },
    fixedDt: 1/120
  },

  gameplay: {
    maxBalls: 10
  },

  // Color palette for random ball colors
  ballColors: [
    0xFF3333,
    0x33ff33,
    0x3333ff,
    0xA8F8FF,
    0xFF33F1,
    0x0B7575,
    0xff8833,
    0x8833ff
  ],

  ball: {
    radius: 0.5,
    restitution: 1.0,
    friction: 0.1,
    color: 0xff3333,
    trail: {
      enabled: false,
      maxLength: 7,
      fadeAlpha: 0.0,
      width: 1.0,
      updateInterval: 1.0 // ~60fps trail updates
    },
    glow: {
      enabled: false,
      distance: 10,
      outerStrength: 1.2,
      quality: 0.5
    }
  } as BallConfig,

  ring: {
    radius: 5.5,
    thickness: 0.3,
    gapAngle: Math.PI / 6.0, // 15 degrees
    gapCenterAngle: 3/2 * Math.PI, // Gap center at top (12 o'clock position)
    // gapCenterAngle: Math.PI / 2, // Gap center at top (12 o'clock position)
    segments: 256,
    spinSpeed: 1.0,
    restitution: 0.8,
    friction: 1.0,
    color: 0xFFFFFF,
    escapeSensorOffset: 0.0,
    escapeSensorThickness: 0.5,
    glow: {
      enabled: false,
      distance: 7,
      outerStrength: 1.5,
      color: 0xFFFFFF,
      quality: 0.5
    },
    particles: {
      enabled: true,
      color: 0xffffff, // Uncomment to use fixed dust color, comment out to use ball color
      dustIntensity: 1.0, // Normal dust intensity
      cooldownDuration: 0.1 // Cooldown duration for particle emission
    }
  } as RingConfig,

  spawning: {
    initial: {
      position: { x: 0, y: 0 },
      velocity: { magnitude: 5, angle: 0 },
      angleRange: { min: Math.PI/4, max: 3*Math.PI/4 }
    },
    onRingEscape: {
      count: 2,
      position: { x: 0, y: 0 },
      velocity: { magnitude: 5, angle: 0 },
      angleRange: { min: Math.PI/4, max: 3*Math.PI/4 }
    }
  },

  killBoundary: {
    thickness: 1.0,
    offset: 1.0
  } as KillBoundaryConfig
} as const;

export class Game {
  app!: PIXI.Application;
  world!: RAPIER.World;
  objects: Prefab[] = [];
  balls: Ball[] = [];
  ring!: Ring;
  killBoundary!: KillBoundary;
  R!: typeof RAPIER;
  debugUI!: DebugUI;
  debugRenderer!: DebugRenderer;
  particleManager!: ParticleManager;
  totalBallsSpawned: number = 0;
  escapedBallsCount: number = 0;
  private currentColorIndex: number = 0;
  private resizeHandler!: () => void;

  async init(container: HTMLElement) {
    try {
      this.R = await import("@dimforge/rapier2d-deterministic");

      this.world = new this.R.World(GAME_CONFIG.physics.gravity);
      this.world.integrationParameters.dt = GAME_CONFIG.physics.fixedDt;

      this.app = new PIXI.Application();
      await this.app.init({
        resizeTo: window,
        antialias: true,
        background: 0x333333,
        autoDensity: true,
        resolution: Math.max(2, window.devicePixelRatio),
      });
      container.appendChild(this.app.canvas);

      // Initialize responsive scaling
      this.initializeResponsiveScaling();

      // Log renderer type for debugging
      const gl = (this.app.renderer as any).gl;
      let rendererType = 'Unknown';
      if (this.app.renderer.type === PIXI.RendererType.WEBGL) {
        if (gl && gl.constructor.name === 'WebGL2RenderingContext') {
          rendererType = 'WebGL2';
        } else if (gl && gl.constructor.name === 'WebGLRenderingContext') {
          rendererType = 'WebGL1';
        } else {
          rendererType = 'WebGL (Unknown Version)';
        }
      } else {
        rendererType = 'Canvas/Other';
      }
      console.log(`PixiJS Renderer: ${rendererType}`);
      console.log(`Responsive scaling initialized - PPM: ${scaleManager.getPPM()}`);

      // Center the stage so (0,0) physics coordinates appear at screen center
      this.app.stage.position.set(this.app.screen.width / 2, this.app.screen.height / 2);

      this.debugUI = new DebugUI(this.world, this.app);
      this.debugRenderer = new DebugRenderer(this.world, this.app.stage);
      this.particleManager = new ParticleManager(this.app.stage);

      // Create ring arena
      this.ring = new Ring(this.world, this.R, GAME_CONFIG.ring);
      this.ring.setParticleManager(this.particleManager);
      this.objects.push(this.ring);

      // Create kill boundaries
      this.killBoundary = new KillBoundary(
        this.world,
        this.R,
        GAME_CONFIG.killBoundary,
        this.app.screen.width,
        this.app.screen.height
      );
      this.objects.push(this.killBoundary);

      // Set up ring escape handler (for spawning)
      this.ring.setRingEscapeHandler((escapedBall) => {
        this.handleBallRingEscape(escapedBall);
      });

      // Set up kill boundary handler (for destruction)
      this.killBoundary.setKillHandler((killedBall) => {
        this.handleBallKill(killedBall);
      });

      // Spawn initial ball
      this.spawnInitialBall();

      this.objects.forEach(obj => this.app.stage.addChild(obj.graphic));

      this.startLoop();
    } catch (error) {
      console.error("Failed to initialize game:", error);
    }
  }

  /**
   * Initialize responsive scaling system and set up resize handling
   */
  private initializeResponsiveScaling() {
    // Calculate optimal scaling for current screen size
    const screenWidth = this.app.screen.width;
    const screenHeight = this.app.screen.height;

    // Update the scale manager with current screen dimensions
    const newPPM = scaleManager.updatePPM(screenWidth, screenHeight);

    console.log(`Screen: ${screenWidth}x${screenHeight}, Ring target: ${Math.round(Math.min(screenWidth, screenHeight) * 0.75)}px, PPM: ${newPPM.toFixed(1)}`);

    // Set up resize handler for responsive behavior
    this.resizeHandler = () => {
      this.handleResize();
    };

    // Listen for window resize events
    window.addEventListener('resize', this.resizeHandler);

    // Also listen for orientation change on mobile devices
    window.addEventListener('orientationchange', () => {
      // Delay handling orientation change to allow UI to settle
      setTimeout(this.resizeHandler, 100);
    });
  }

  /**
   * Handle window resize events with responsive scaling
   */
  private handleResize() {
    const newScreenWidth = this.app.screen.width;
    const newScreenHeight = this.app.screen.height;

    // Update scaling
    const oldPPM = scaleManager.getPPM();
    const newPPM = scaleManager.updatePPM(newScreenWidth, newScreenHeight);

    // Only update if PPM changed significantly (avoid excessive updates)
    if (Math.abs(newPPM - oldPPM) > 0.5) {
      console.log(`Resize detected - New screen: ${newScreenWidth}x${newScreenHeight}, PPM: ${oldPPM.toFixed(1)} → ${newPPM.toFixed(1)}`);

      // Re-center the stage
      this.app.stage.position.set(newScreenWidth / 2, newScreenHeight / 2);

      // Update kill boundaries with new screen dimensions
      this.updateKillBoundaries(newScreenWidth, newScreenHeight);

      // Force recreation of graphics for all objects to use new scale
      this.updateAllGraphicsWithNewScale();

      // Update debug UI with new scaling information
      this.debugUI.updateScalingInfo(this.app);
    }
  }

  /**
   * Update kill boundaries for new screen dimensions
   */
  private updateKillBoundaries(screenWidth: number, screenHeight: number) {
    if (this.killBoundary) {
      // Remove old kill boundary
      const killBoundaryIndex = this.objects.indexOf(this.killBoundary);
      if (killBoundaryIndex !== -1) {
        this.app.stage.removeChild(this.killBoundary.graphic);
        this.objects.splice(killBoundaryIndex, 1);
      }

      // Create new kill boundary with updated dimensions
      this.killBoundary = new KillBoundary(
        this.world,
        this.R,
        GAME_CONFIG.killBoundary,
        screenWidth,
        screenHeight
      );

      // Re-setup kill handler
      this.killBoundary.setKillHandler((killedBall) => {
        this.handleBallKill(killedBall);
      });

      this.objects.push(this.killBoundary);
      this.app.stage.addChild(this.killBoundary.graphic);
    }
  }

  /**
   * Update all graphics with new scale
   */
  private updateAllGraphicsWithNewScale() {
    // Recreate graphics for all objects with new scaling
    this.objects.forEach(obj => {
      if (obj.graphic) {
        this.app.stage.removeChild(obj.graphic);
        // Force recreation of graphics with new scale
        (obj as any).createGraphics();
        this.app.stage.addChild(obj.graphic);
      }
    });
  }

  private spawnBall(spawnConfig: BallSpawnConfig): Ball {
    const velocity = this.calculateVelocity(spawnConfig);

    // Create ball config with next color in rotation
    const selectedColor = GAME_CONFIG.ballColors[this.currentColorIndex];
    this.currentColorIndex = (this.currentColorIndex + 1) % GAME_CONFIG.ballColors.length;

    const ballConfig: BallConfig = {
      ...GAME_CONFIG.ball,
      color: selectedColor
    };

    const ball = new Ball(
      this.world,
      this.R,
      ballConfig,
      spawnConfig.position.x,
      spawnConfig.position.y,
      velocity
    );

    this.totalBallsSpawned++;
    this.balls.push(ball);
    this.objects.push(ball);
    this.app.stage.addChild(ball.graphic);

    return ball;
  }

  private calculateVelocity(spawnConfig: BallSpawnConfig): { x: number; y: number } {
    if ('x' in spawnConfig.velocity) {
      return spawnConfig.velocity;
    }

    let angle = spawnConfig.velocity.angle;
    if (spawnConfig.angleRange) {
      const { min, max } = spawnConfig.angleRange;
      angle = min + Math.random() * (max - min);
    }

    const magnitude = spawnConfig.velocity.magnitude;
    return {
      x: magnitude * Math.cos(angle),
      y: magnitude * Math.sin(angle)
    };
  }

  private spawnInitialBall() {
    this.spawnBall(GAME_CONFIG.spawning.initial);
  }

  private spawnRingEscapeBalls() {
    // Check if we're at the ball limit
    if (this.totalBallsSpawned >= GAME_CONFIG.gameplay.maxBalls) {
      return;
    }

    // Calculate how many balls we can spawn without exceeding the limit
    const ballsToSpawn = Math.min(
      GAME_CONFIG.spawning.onRingEscape.count,
      GAME_CONFIG.gameplay.maxBalls - this.totalBallsSpawned
    );

    for (let i = 0; i < ballsToSpawn; i++) {
      this.spawnBall(GAME_CONFIG.spawning.onRingEscape);
    }
  }

  private handleBallRingEscape(escapedBall: RAPIER.RigidBody) {
    // Ring escape means ball escaped through the gap - increment counter
    this.escapedBallsCount++;

    // Ring escape also triggers spawning of new balls
    this.spawnRingEscapeBalls();
  }

  private handleBallKill(killedBall: RAPIER.RigidBody) {
    const ballHandle = killedBall.handle;

    // Remove the killed ball
    const killedIndex = this.balls.findIndex(ball => ball.body.handle === killedBall.handle);
    if (killedIndex !== -1) {
      const killedBallPrefab = this.balls[killedIndex];
      this.app.stage.removeChild(killedBallPrefab.graphic);

      // Cleanup trail before removing ball
      killedBallPrefab.destroy();

      this.balls.splice(killedIndex, 1);

      const prefabIndex = this.objects.indexOf(killedBallPrefab);
      if (prefabIndex !== -1) {
        this.objects.splice(prefabIndex, 1);
      }
    }

    this.world.removeRigidBody(killedBall);

    // Clean up the ball handle from ring's escape tracking
    this.ring.cleanupEscapedBall(ballHandle);

    // Clean up the ball handle from kill boundary tracking
    this.killBoundary.cleanupKilledBall(ballHandle);
  }

  private startLoop() {
    const dt = GAME_CONFIG.physics.fixedDt;
    let acc = 0;
    let last = performance.now();

    this.app.ticker.add(() => {
      const now = performance.now();
      acc += (now - last)/1000;
      last = now;

      while (acc >= dt) {
        // Step the ring (handle spinning)
        this.ring.step(dt);

        // Update particle manager
        this.particleManager.update(dt);

                // Step the world ONCE per frame (maintains correct physics timing)
        this.world.step(this.ring.getEventQueue());

        // Process collision events from the shared event queue
        this.ring.getEventQueue().drainCollisionEvents((h1, h2, started) => {
          // Both Ring and KillBoundary check if collision involves their escape/kill sensors
          this.ring.processCollisionEvent(h1, h2, started);
          this.killBoundary.processCollisionEvent(h1, h2, started);
        });

        this.objects.forEach(obj => obj.updateFromPhysics());
        acc -= dt;
      }

      // Handle graphics visibility
      this.objects.forEach(obj => {
        obj.graphic.visible = this.debugUI.params["View graphics"];
      });



      // Handle debug collider rendering
      if (this.debugUI.params["View colliders"]) {
        this.debugRenderer.render();
      } else {
        this.debugRenderer.layer.clear();
      }

      // Update debug info - show ball count instead
      this.debugUI.params.ballCount = this.balls.length;
      this.debugUI.params.totalSpawned = this.totalBallsSpawned;
      this.debugUI.params.escapedBalls = this.escapedBallsCount;
    });
  }

  destroy() {
    // Clean up resize handlers
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      window.removeEventListener('orientationchange', this.resizeHandler);
    }

    this.app.destroy(true);
    this.debugUI.destroy();
    this.particleManager.destroy();
  }
}