import * as PIXI from "pixi.js";
import type RAPIER from "@dimforge/rapier2d-deterministic";
import { Prefab } from "./Prefab";
import { m2p } from "../scale";
import type { BallConfig } from "./interfaces";

export class Ball extends Prefab {
  constructor(
    world: RAPIER.World,
    R: typeof RAPIER,
    private config: BallConfig,
    private spawnX: number,
    private spawnY: number,
    private initialVelocity: { x: number; y: number }
  ) {
    super(world, R);
    this.init();
    // Set initial velocity after physics creation
    this.body.setLinvel(this.initialVelocity, true);
  }

  protected createPhysics() {
    this.body = this.world.createRigidBody(
      this.R.RigidBodyDesc.dynamic()
        .setTranslation(this.spawnX, this.spawnY)
        .setCcdEnabled(this.config.ccdEnabled)
    );

    const collider = this.R.ColliderDesc.ball(this.config.radius)
      .setRestitution(this.config.restitution)
      .setFriction(this.config.friction);
    this.world.createCollider(collider, this.body);
  }

  protected createGraphics() {
    const g = new PIXI.Graphics();
    g.circle(0, 0, m2p(this.config.radius));
    g.fill(this.config.color);
    this.graphic = g;
  }
}