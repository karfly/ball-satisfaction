import * as PIXI from "pixi.js";
import type RAPIER from "@dimforge/rapier2d-deterministic";
import { GUI } from "dat.gui";
import { Stats } from "pixi-stats";

export class DebugUI {
  gui = new GUI();
  stats: Stats;
  params = {
    gravity: 9.81,
    "View colliders": true,
    "View graphics": true,
    ballY_px: 0,
    ballY_m: 0
  };

  constructor(private world: RAPIER.World, app: PIXI.Application) {
    this.stats = new Stats(app.renderer);                      // FPS/DC/MS overlay

    this.gui.add(this.params, "gravity", -20, 20, 0.1)
      .onChange((v: number) => {
        this.world.gravity.y = v;
      });
    this.gui.add(this.params, "View colliders");
    this.gui.add(this.params, "View graphics");
    this.gui.add(this.params, "ballY_px").listen();
    this.gui.add(this.params, "ballY_m").listen();
  }

    destroy() {
    this.gui.destroy();
  }
}