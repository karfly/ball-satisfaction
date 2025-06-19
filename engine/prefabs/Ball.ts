import * as PIXI from "pixi.js";
import type RAPIER from "@dimforge/rapier2d-deterministic";
import { Prefab } from "./Prefab";
import { p2m, m2p } from "../scale";

export class Ball extends Prefab {
  radius = 0.2;  // 3x smaller than original 0.4
  private spawnX: number;
  private spawnY: number;

  constructor(world: RAPIER.World, R: typeof RAPIER, xM: number, yM: number) {
    super(world);
    this.spawnX = xM;  // Store in meters
    this.spawnY = yM;  // Store in meters
    this.init(R);
  }

      static createInsideRing(world: RAPIER.World, R: typeof RAPIER, ringRadius: number, gapAngle: number): Ball {
    // Spawn at center (0, 0) in physics coordinates
    const ball = new Ball(world, R, 0, 0);

    // Set random downward velocity (±45 degrees from vertical)
    const minAngle = Math.PI / 4;      // 45 degrees
    const maxAngle = 3 * Math.PI / 4;  // 135 degrees
    const dir = minAngle + Math.random() * (maxAngle - minAngle);
    const velocity = 100;
    ball.body.setLinvel({ x: velocity * Math.cos(dir), y: velocity * Math.sin(dir) }, true);

    return ball;
  }

  protected createPhysics(R: typeof RAPIER) {
    this.body = this.world.createRigidBody(
      R.RigidBodyDesc.dynamic()
        .setTranslation(this.spawnX, this.spawnY)  // Already in meters
        .setCcdEnabled(true)  // Enable CCD for fast-moving balls
    );
    const collider = R.ColliderDesc.ball(this.radius)
      .setRestitution(1)
      .setFriction(0);
    this.world.createCollider(collider, this.body);
  }

  protected createGraphics() {
    const g = new PIXI.Graphics();
    g.circle(0, 0, m2p(this.radius));
    g.fill(0xff3333);
    this.graphic = g;
  }
}