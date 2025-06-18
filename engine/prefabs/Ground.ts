import * as PIXI from "pixi.js";
import type RAPIER from "@dimforge/rapier2d-deterministic";
import { Prefab } from "./Prefab";
import { p2m, m2p } from "../scale";

export class Ground extends Prefab {
  private w: number;
  private groundY: number;

  constructor(world: RAPIER.World, R: typeof RAPIER, screenWidthPx: number, screenHeightPx: number) {
    super(world);
    this.w = p2m(screenWidthPx);
    // Place ground near bottom of screen
    this.groundY = p2m(screenHeightPx) - 0.5; // 0.5m from bottom
    this.init(R);
  }

  protected createPhysics(R: typeof RAPIER) {
    this.body = this.world.createRigidBody(R.RigidBodyDesc.fixed()
      .setTranslation(this.w / 2, this.groundY));
    this.world.createCollider(R.ColliderDesc.cuboid(this.w / 2, 0.2), this.body);
  }

  protected createGraphics() {
    const g = new PIXI.Graphics();
    g.rect(-m2p(this.w/2), -m2p(0.2), m2p(this.w), m2p(0.4));
    g.fill(0x00ff00);
    this.graphic = g;
  }
}