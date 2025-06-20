import * as PIXI from "pixi.js";
import type RAPIER from "@dimforge/rapier2d-deterministic";
import { Ball, Ring, KillBoundary, Prefab, type BallConfig, type RingConfig, type BallSpawnConfig, type KillBoundaryConfig } from "./objects";
import { m2p } from "./scale";
import { DebugUI } from "./debug/DebugUI";
import { DebugRenderer } from "./debug/DebugRenderer";

// Centralized Game Configuration
const GAME_CONFIG = {
  physics: {
    gravity: { x: 0, y: 20 },
    fixedDt: 1/60
  },

  gameplay: {
    maxBalls: 100
  },

  ball: {
    radius: 0.25,
    restitution: 0.9,
    friction: 0.1,
    color: 0xff3333
  } as BallConfig,

  ring: {
    radius: 5.5,
    thickness: 0.3,
    gapAngle: Math.PI / 8.0, // 15 degrees
    gapCenterAngle: 3/2 * Math.PI, // Gap center at top (12 o'clock position)
    // gapCenterAngle: Math.PI / 2, // Gap center at top (12 o'clock position)
    segments: 256,
    spinSpeed: 0.5,
    restitution: 0.9,
    friction: 0.9,
    color: 0x00ffff,
    sensorOffset: 0.0,
    sensorThickness: 0.5
  } as RingConfig,

  spawning: {
    initial: {
      position: { x: 0, y: 0 },
      velocity: { magnitude: 5, angle: 0 },
      angleRange: { min: Math.PI/4, max: 3*Math.PI/4 }
    },
    onRingTouch: {
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
  totalBallsSpawned: number = 0;
  escapedBallsCount: number = 0;

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

      // Center the stage so (0,0) physics coordinates appear at screen center
      this.app.stage.position.set(this.app.screen.width / 2, this.app.screen.height / 2);

      this.debugUI = new DebugUI(this.world, this.app);
      this.debugRenderer = new DebugRenderer(this.world, this.app.stage);

      // Create ring arena
      this.ring = new Ring(this.world, this.R, GAME_CONFIG.ring);
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

      // Set up ring touch handler (for spawning)
      this.ring.setRingTouchHandler((touchedBall) => {
        this.handleBallRingTouch(touchedBall);
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

  private spawnBall(spawnConfig: BallSpawnConfig): Ball {
    const velocity = this.calculateVelocity(spawnConfig);

    const ball = new Ball(
      this.world,
      this.R,
      GAME_CONFIG.ball,
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

  private spawnRingTouchBalls() {
    // Check if we're at the ball limit
    if (this.totalBallsSpawned >= GAME_CONFIG.gameplay.maxBalls) {
      return;
    }

    // Calculate how many balls we can spawn without exceeding the limit
    const ballsToSpawn = Math.min(
      GAME_CONFIG.spawning.onRingTouch.count,
      GAME_CONFIG.gameplay.maxBalls - this.totalBallsSpawned
    );

    for (let i = 0; i < ballsToSpawn; i++) {
      this.spawnBall(GAME_CONFIG.spawning.onRingTouch);
    }
  }

  private handleBallRingTouch(touchedBall: RAPIER.RigidBody) {
    // Ring touch means ball escaped through the gap - increment counter
    this.escapedBallsCount++;

    // Ring touch also triggers spawning of new balls
    this.spawnRingTouchBalls();
  }

  private handleBallKill(killedBall: RAPIER.RigidBody) {
    const ballHandle = killedBall.handle;

    // Remove the killed ball
    const killedIndex = this.balls.findIndex(ball => ball.body.handle === killedBall.handle);
    if (killedIndex !== -1) {
      const killedBallPrefab = this.balls[killedIndex];
      this.app.stage.removeChild(killedBallPrefab.graphic);
      this.balls.splice(killedIndex, 1);

      const prefabIndex = this.objects.indexOf(killedBallPrefab);
      if (prefabIndex !== -1) {
        this.objects.splice(prefabIndex, 1);
      }
    }

    this.world.removeRigidBody(killedBall);

    // Clean up the ball handle from ring's touch tracking
    this.ring.cleanupTouchedBall(ballHandle);

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

                // Step the world ONCE per frame (maintains correct physics timing)
        this.world.step(this.ring.getEventQueue());

        // Process collision events from the shared event queue
        this.ring.getEventQueue().drainCollisionEvents((h1, h2, started) => {
          // Both Ring and KillBoundary check if collision involves their sensors
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
    this.app.destroy(true);
    this.debugUI.destroy();
  }
}