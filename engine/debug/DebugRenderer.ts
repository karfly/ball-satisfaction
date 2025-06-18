import * as PIXI from "pixi.js";
import type RAPIER from "@dimforge/rapier2d-deterministic";
import { m2p } from "../scale";

export class DebugRenderer {
  layer = new PIXI.Graphics();

  constructor(private world: RAPIER.World, stage: PIXI.Container) {
    stage.addChild(this.layer);
  }

  render() {
    const { vertices, colors } = this.world.debugRender();         // lines API
    const g = this.layer;
    g.clear();

    // Draw all debug lines
    for (let i = 0; i < vertices.length; i += 4) {
      const c = (i/4)*8;
      const color = (colors[c] * 255 << 16) | (colors[c+1] * 255 << 8) | (colors[c+2] * 255);
      const alpha = colors[c+3];

      // Create a new path for each line with its own color
      g.moveTo(m2p(vertices[i]), m2p(vertices[i+1]));
      g.lineTo(m2p(vertices[i+2]), m2p(vertices[i+3]));
      g.stroke({ width: 2, color: color, alpha: alpha });
    }
  }
}