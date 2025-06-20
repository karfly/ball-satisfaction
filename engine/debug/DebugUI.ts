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
    "Trails enabled": true,
    ballCount: 0,
    totalSpawned: 0,
    escapedBalls: 0,
    rendererType: "Unknown"
  };

  constructor(private world: RAPIER.World, app: PIXI.Application) {
    this.stats = new Stats(app.renderer);                      // FPS/DC/MS overlay

    // Detect renderer type
    const rendererType = this.getRendererType(app.renderer);
    this.params.rendererType = rendererType;

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
    this.gui.add(this.params, "Trails enabled");
    this.gui.add(this.params, "ballCount").listen();
    this.gui.add(this.params, "totalSpawned").listen();
    this.gui.add(this.params, "escapedBalls").listen();
    this.gui.add(this.params, "rendererType").listen();
  }

  private getRendererType(renderer: PIXI.Renderer): string {
    // PixiJS 8 renderer type detection
    if (renderer.type === PIXI.RendererType.WEBGL) {
      // Check if it's WebGL2 by looking at the WebGL context
      const gl = (renderer as any).gl;
      if (gl && gl.constructor.name === 'WebGL2RenderingContext') {
        return 'WebGL2';
      } else if (gl && gl.constructor.name === 'WebGLRenderingContext') {
        return 'WebGL1';
      }
      return 'WebGL (Unknown Version)';
    } else {
      // Fallback for any non-WebGL renderer (Canvas or others)
      return 'Canvas/Other';
    }
  }

  destroy() {
    this.gui.destroy();
  }
}