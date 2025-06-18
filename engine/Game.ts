import * as PIXI from "pixi.js";
import type RAPIER from "@dimforge/rapier2d-deterministic";
import { Ball, Ground, Prefab } from "./prefabs";
import { m2p } from "./scale";
import { DebugUI } from "./debug/DebugUI";
import { DebugRenderer } from "./debug/DebugRenderer";

export class Game {
  app!: PIXI.Application;
  world!: RAPIER.World;
  prefabs: Prefab[] = [];
  debugUI!: DebugUI;
  debugRenderer!: DebugRenderer;

  async init(container: HTMLElement) {
    try {
        const R = await import("@dimforge/rapier2d-deterministic");

        this.world = new R.World({ x: 0, y: 9.81 });       // m/s² downward
    this.world.integrationParameters.dt = 1 / 60;      // fixed dt

    this.app = new PIXI.Application();
        await this.app.init({
      resizeTo: window,
      background: 0x333333
    });
    container.appendChild(this.app.canvas);

    this.debugUI = new DebugUI(this.world, this.app);
    this.debugRenderer = new DebugRenderer(this.world, this.app.stage);

    this.prefabs.push(new Ground(this.world, R, this.app.screen.width, this.app.screen.height));
    this.prefabs.push(new Ball(this.world, R, this.app.screen.width / 2, m2p(1)));
    this.prefabs.forEach(p => this.app.stage.addChild(p.graphic));

    this.startLoop();
    } catch (error) {
      console.error("Failed to initialize game:", error);
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
        this.world.step();
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

      // Update debug info
      this.debugUI.params.ballY_px = Math.round(m2p(this.prefabs[1].body.translation().y));
      this.debugUI.params.ballY_m = +this.prefabs[1].body.translation().y.toFixed(2);
    });
  }

  destroy() {
    this.app.destroy(true);
    this.debugUI.destroy();
  }
}