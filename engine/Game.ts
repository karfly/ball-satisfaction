import * as PIXI from "pixi.js";
import type RAPIER from "@dimforge/rapier2d-deterministic";
import { Ball, Ring, Prefab, type RingSpec } from "./prefabs";
import { m2p } from "./scale";
import { DebugUI } from "./debug/DebugUI";
import { DebugRenderer } from "./debug/DebugRenderer";

export class Game {
  app!: PIXI.Application;
  world!: RAPIER.World;
  prefabs: Prefab[] = [];
  balls: Ball[] = [];
  ring!: Ring;
  R!: typeof RAPIER;
  debugUI!: DebugUI;
  debugRenderer!: DebugRenderer;

  async init(container: HTMLElement) {
    try {
        this.R = await import("@dimforge/rapier2d-deterministic");

        this.world = new this.R.World({ x: 0, y: 20 });      // Downward gravity
    this.world.integrationParameters.dt = 1 / 60;      // fixed dt

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
    const ringSpec: RingSpec = {
      radius: 5.5,          // meters (smaller ring)
      thickness: 0.3,     // meters
      gapAngle: Math.PI / 12,  // 60 degrees gap
      segments: 128,       // smooth edge
      spinSpeed: 0.1        // radians per second
    };

    this.ring = new Ring(this.world, this.R, ringSpec);
    this.prefabs.push(this.ring);

    // Set up escape handler
    this.ring.setEscapeHandler((escapedBall) => {
      this.handleBallEscape(escapedBall);
    });

    // Spawn initial ball
    const initialBall = Ball.createInsideRing(this.world, this.R, ringSpec.radius, ringSpec.gapAngle);
    this.balls.push(initialBall);
    this.prefabs.push(initialBall);

    this.prefabs.forEach(p => this.app.stage.addChild(p.graphic));

    this.startLoop();
    } catch (error) {
      console.error("Failed to initialize game:", error);
    }
  }

  private handleBallEscape(escapedBall: RAPIER.RigidBody) {
    // Remove the escaped ball
    const escapedIndex = this.balls.findIndex(ball => ball.body.handle === escapedBall.handle);
    if (escapedIndex !== -1) {
      const escapedBallPrefab = this.balls[escapedIndex];
      this.app.stage.removeChild(escapedBallPrefab.graphic);
      this.balls.splice(escapedIndex, 1);

      const prefabIndex = this.prefabs.indexOf(escapedBallPrefab);
      if (prefabIndex !== -1) {
        this.prefabs.splice(prefabIndex, 1);
      }
    }

    this.world.removeRigidBody(escapedBall);

    // Spawn two new balls inside the ring
    const ringSpec = {
      radius: 5.5,
      gapAngle: Math.PI / 6
    };

    for (let i = 0; i < 2; ++i) {
      const newBall = Ball.createInsideRing(this.world, this.R, ringSpec.radius, ringSpec.gapAngle);
      this.balls.push(newBall);
      this.prefabs.push(newBall);
      this.app.stage.addChild(newBall.graphic);
    }
  }

  private startLoop() {
    const dt = 1/60;
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

        this.prefabs.forEach(p => p.updateFromPhysics());
        acc -= dt;
      }

      // Handle graphics visibility
      this.prefabs.forEach(p => {
        p.graphic.visible = this.debugUI.params["View graphics"];
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