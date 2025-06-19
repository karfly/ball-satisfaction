import * as PIXI from "pixi.js";
import type RAPIER from "@dimforge/rapier2d-deterministic";
import { Ball, Ring, Prefab, type BallConfig, type RingConfig, type GroundConfig, type BallSpawnConfig } from "./objects";
import { m2p } from "./scale";
import { DebugUI } from "./debug/DebugUI";
import { DebugRenderer } from "./debug/DebugRenderer";

// Centralized Game Configuration
const GAME_CONFIG = {
  physics: {
    gravity: { x: 0, y: 20 },
    fixedDt: 1/60
  },

  ball: {
    radius: 0.2,
    restitution: 1.0,
    friction: 0.0,
    color: 0xff3333,
    ccdEnabled: true
  } as BallConfig,

  ring: {
    radius: 5.5,
    thickness: 0.3,
    gapAngle: Math.PI / 12, // 15 degrees
    segments: 128,
    spinSpeed: 0.1,
    restitution: 1.0,
    friction: 0.0,
    color: 0x00ffff,
    sensorOffset: 0.5
  } as RingConfig,

  ground: {
    width: 20, // Will be overridden based on screen size
    thickness: 0.2,
    restitution: 0.8,
    color: 0x00ff00,
    bottomOffset: 0.5
  } as GroundConfig,

  spawning: {
    initial: {
      position: { x: 0, y: 0 },
      velocity: { magnitude: 100, angle: 0 },
      angleRange: { min: Math.PI/4, max: 3*Math.PI/4 }
    },
    onEscape: {
      count: 2,
      position: { x: 0, y: 0 },
      velocity: { magnitude: 100, angle: 0 },
      angleRange: { min: Math.PI/4, max: 3*Math.PI/4 }
    }
  }
} as const;

export class Game {
  app!: PIXI.Application;
  world!: RAPIER.World;
  objects: Prefab[] = [];
  balls: Ball[] = [];
  ring!: Ring;
  R!: typeof RAPIER;
  debugUI!: DebugUI;
  debugRenderer!: DebugRenderer;

  async init(container: HTMLElement) {
    try {
      this.R = await import("@dimforge/rapier2d-deterministic");

      this.world = new this.R.World(GAME_CONFIG.physics.gravity);
      this.world.integrationParameters.dt = GAME_CONFIG.physics.fixedDt;

      this.app = new PIXI.Application();
      await this.app.init({
        resizeTo: window,
        background: 0x333333
      });
      container.appendChild(this.app.canvas);

      // Center the stage so (0,0) physics coordinates appear at screen center
      this.app.stage.position.set(this.app.screen.width / 2, this.app.screen.height / 2);

      this.debugUI = new DebugUI(this.world, this.app);
      this.debugRenderer = new DebugRenderer(this.world, this.app.stage);

      // Create ring arena
      this.ring = new Ring(this.world, this.R, GAME_CONFIG.ring);
      this.objects.push(this.ring);

      // Set up escape handler
      this.ring.setEscapeHandler((escapedBall) => {
        this.handleBallEscape(escapedBall);
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

  private spawnEscapeBalls() {
    for (let i = 0; i < GAME_CONFIG.spawning.onEscape.count; i++) {
      this.spawnBall(GAME_CONFIG.spawning.onEscape);
    }
  }

  private handleBallEscape(escapedBall: RAPIER.RigidBody) {
    // Remove the escaped ball
    const escapedIndex = this.balls.findIndex(ball => ball.body.handle === escapedBall.handle);
    if (escapedIndex !== -1) {
      const escapedBallPrefab = this.balls[escapedIndex];
      this.app.stage.removeChild(escapedBallPrefab.graphic);
      this.balls.splice(escapedIndex, 1);

      const prefabIndex = this.objects.indexOf(escapedBallPrefab);
      if (prefabIndex !== -1) {
        this.objects.splice(prefabIndex, 1);
      }
    }

    this.world.removeRigidBody(escapedBall);

    // Spawn new balls using config
    this.spawnEscapeBalls();
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
        // Step the ring (spin + event handling)
        this.ring.step(dt);

        // Step the world with the ring's event queue
        this.world.step(this.ring.getEventQueue());

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
      if (this.balls.length > 0) {
        this.debugUI.params.ballY_px = Math.round(m2p(this.balls[0].body.translation().y));
        this.debugUI.params.ballY_m = +this.balls[0].body.translation().y.toFixed(2);
      }
    });
  }

  destroy() {
    this.app.destroy(true);
    this.debugUI.destroy();
  }
}