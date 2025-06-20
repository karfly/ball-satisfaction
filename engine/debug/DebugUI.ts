import * as PIXI from "pixi.js";
import type RAPIER from "@dimforge/rapier2d-deterministic";
import { GUI } from "dat.gui";
import { Stats } from "pixi-stats";
import { scaleManager } from "../scale";

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
    rendererType: "Unknown",
    currentPPM: 50,
    screenDimensions: "0x0",
    ringTargetSize: "0px"
  };

  constructor(private world: RAPIER.World, app: PIXI.Application) {
    this.stats = new Stats(app.renderer);                      // FPS/DC/MS overlay

    // Detect renderer type
    const rendererType = this.getRendererType(app.renderer);
    this.params.rendererType = rendererType;

    // Initialize scaling info
    this.updateScalingInfo(app);

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

    // Basic controls
    this.gui.add(this.params, "View colliders");
    this.gui.add(this.params, "View graphics");
    this.gui.add(this.params, "Trails enabled");

    // Game stats folder
    const gameFolder = this.gui.addFolder("Game Stats");
    gameFolder.add(this.params, "ballCount").listen();
    gameFolder.add(this.params, "totalSpawned").listen();
    gameFolder.add(this.params, "escapedBalls").listen();

    // Technical info folder
    const techFolder = this.gui.addFolder("Technical Info");
    techFolder.add(this.params, "rendererType").listen();
    techFolder.add(this.params, "currentPPM").listen();
    techFolder.add(this.params, "screenDimensions").listen();
    techFolder.add(this.params, "ringTargetSize").listen();

    // Responsive scaling controls folder
    const scalingFolder = this.gui.addFolder("Responsive Scaling");
    const config = scaleManager.getConfig();
    scalingFolder.add(config, "targetRingScreenRatio", 0.5, 1.0).step(0.05).name("Ring Screen Ratio").onChange((value: number) => {
      scaleManager.updateConfig({ targetRingScreenRatio: value });
      // Trigger recalculation if needed
      const newPPM = scaleManager.updatePPM(app.screen.width, app.screen.height);
      this.updateScalingInfo(app);
    });

    scalingFolder.add(config, "minPPM", 10, 50).step(1).name("Min PPM").onChange((value: number) => {
      scaleManager.updateConfig({ minPPM: value });
    });

    scalingFolder.add(config, "maxPPM", 50, 150).step(5).name("Max PPM").onChange((value: number) => {
      scaleManager.updateConfig({ maxPPM: value });
    });
  }

  updateScalingInfo(app: PIXI.Application) {
    this.params.currentPPM = Math.round(scaleManager.getPPM() * 10) / 10; // Round to 1 decimal
    this.params.screenDimensions = `${app.screen.width}x${app.screen.height}`;

    const minDimension = Math.min(app.screen.width, app.screen.height);
    const config = scaleManager.getConfig();
    const targetSize = Math.round(minDimension * config.targetRingScreenRatio);
    this.params.ringTargetSize = `${targetSize}px`;
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