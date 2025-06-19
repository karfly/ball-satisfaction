import * as PIXI from "pixi.js";
import type RAPIER from "@dimforge/rapier2d-deterministic";
import { Prefab } from "./Prefab";
import { p2m, m2p } from "../scale";
import type { GroundConfig } from "./interfaces";

export class Ground extends Prefab {
  private groundY: number;

  constructor(
    world: RAPIER.World,
    R: typeof RAPIER,
    private config: GroundConfig,
    screenWidthPx: number,
    screenHeightPx: number
  ) {
    super(world, R);
    // Place ground near bottom of screen
    this.groundY = p2m(screenHeightPx) - config.bottomOffset;
    this.init();
  }

  protected createPhysics() {
    this.body = this.world.createRigidBody(
      this.R.RigidBodyDesc.fixed()
        .setTranslation(this.config.width / 2, this.groundY)
    );
    const collider = this.R.ColliderDesc.cuboid(this.config.width / 2, this.config.thickness)
      .setRestitution(this.config.restitution);
    this.world.createCollider(collider, this.body);
  }

  protected createGraphics() {
    const g = new PIXI.Graphics();
    g.rect(-m2p(this.config.width/2), -m2p(this.config.thickness),
           m2p(this.config.width), m2p(this.config.thickness * 2));
    g.fill(this.config.color);
    this.graphic = g;
  }
}