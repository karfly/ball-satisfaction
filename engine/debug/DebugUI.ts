import * as PIXI from "pixi.js";
import type RAPIER from "@dimforge/rapier2d-deterministic";
import { GUI } from "dat.gui";
import { Stats } from "pixi-stats";

export class DebugUI {
  gui = new GUI();
  stats: Stats;
  params = {
    "View colliders": true,
    "View graphics": true,
    ballCount: 0,
    totalSpawned: 0,
    escapedBalls: 0
  };

  constructor(private world: RAPIER.World, app: PIXI.Application) {
    this.stats = new Stats(app.renderer);                      // FPS/DC/MS overlay

    // Add required CSS styling for stats display
    const style = document.createElement('style');
    style.textContent = `
      #stats {
        position: fixed;
        top: 0;
        left: 0;
        z-index: 1000;
      }
      #stats canvas {
        width: max(100px, 10vw, 10vh);
        height: max(60px, 6vh, 6vw);
        user-select: none;
      }
    `;
    document.head.appendChild(style);

    this.gui.add(this.params, "View colliders");
    this.gui.add(this.params, "View graphics");
    this.gui.add(this.params, "ballCount").listen();
    this.gui.add(this.params, "totalSpawned").listen();
    this.gui.add(this.params, "escapedBalls").listen();
  }

    destroy() {
    this.gui.destroy();
  }
}