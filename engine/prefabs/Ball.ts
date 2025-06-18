import * as PIXI from "pixi.js";
import type RAPIER from "@dimforge/rapier2d-deterministic";
import { Prefab } from "./Prefab";
import { p2m, m2p } from "../scale";

export class Ball extends Prefab {
  radius = 0.4;
  private spawnX: number;
  private spawnY: number;

  constructor(world: RAPIER.World, R: typeof RAPIER, xPx: number, yPx: number) {
    super(world);
    this.spawnX = xPx;
    this.spawnY = yPx;
    this.init(R);
  }

  protected createPhysics(R: typeof RAPIER) {
    this.body = this.world.createRigidBody(
      R.RigidBodyDesc.dynamic().setTranslation(p2m(this.spawnX), p2m(this.spawnY))
    );
    const collider = R.ColliderDesc.ball(this.radius).setRestitution(0.8);
    this.world.createCollider(collider, this.body);
  }

  protected createGraphics() {
    const g = new PIXI.Graphics();
    g.circle(0, 0, m2p(this.radius));
    g.fill(0xff3333);
    this.graphic = g;
  }
}