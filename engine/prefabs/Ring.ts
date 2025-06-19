import * as PIXI from "pixi.js";
import type RAPIER from "@dimforge/rapier2d-deterministic";
import { Prefab } from "./Prefab";
import { m2p } from "../scale";

export interface RingSpec {
  radius: number;       // meters
  thickness: number;    // meters
  gapAngle: number;     // radians
  segments: number;     // >= 48 for smooth edge
  spinSpeed: number;    // radians per second
}

export class Ring extends Prefab {
  private spec: RingSpec;
  private sensorCollider!: RAPIER.Collider;
  private eventQueue!: RAPIER.EventQueue;
  private onBallEscape?: (escapedBall: RAPIER.RigidBody) => void;

  constructor(world: RAPIER.World, R: typeof RAPIER, spec: RingSpec) {
    super(world);
    this.spec = spec;
    this.eventQueue = new R.EventQueue(true);
    this.init(R);
  }

  setEscapeHandler(handler: (escapedBall: RAPIER.RigidBody) => void) {
    this.onBallEscape = handler;
  }

  protected createPhysics(R: typeof RAPIER) {
    // Create kinematic ring body
    this.body = this.world.createRigidBody(
      R.RigidBodyDesc.kinematicPositionBased()
        .setTranslation(0, 0)  // Physics coordinates centered at origin
        .setCcdEnabled(true)  // Enable CCD for rotating ring
    );

    // Create cuboid segments
    const arc = 2 * Math.PI - this.spec.gapAngle;
    const angleStep = arc / this.spec.segments;
    const halfBarLen = (this.spec.radius * angleStep) / 2;

    for (let i = 0; i < this.spec.segments; ++i) {
      const midAngle = -this.spec.gapAngle / 2 + angleStep * (i + 0.5);
      this.world.createCollider(
        R.ColliderDesc.cuboid(halfBarLen, this.spec.thickness / 2)
          .setTranslation(
            this.spec.radius * Math.cos(midAngle),
            this.spec.radius * Math.sin(midAngle)
          )
          .setRotation(midAngle)
          .setFriction(0)
          .setRestitution(1)
          .setEnabled(true),
        this.body
      );
    }

    // Create sensor outside the gap
    const sensorLen = this.spec.thickness * 2;
    const sensorDistance = this.spec.radius + this.spec.thickness + 0.5; // Outside the ring
    this.sensorCollider = this.world.createCollider(
      R.ColliderDesc.cuboid(sensorLen / 2, this.spec.thickness)
        .setTranslation(sensorDistance, 0)  // Position outside the gap
        .setSensor(true)
        .setActiveEvents(R.ActiveEvents.COLLISION_EVENTS)
        .setCollisionGroups(0b10_0001)   // membership 0b10, filter 0b0001
        .setEnabled(true),
      this.body
    );

    // Store spin speed in userData
    this.body.userData = { spinSpeed: this.spec.spinSpeed };
  }

  protected createGraphics() {
    const g = new PIXI.Graphics();

    // Draw ring segments
    const arc = 2 * Math.PI - this.spec.gapAngle;
    const angleStep = arc / this.spec.segments;
    const halfBarLen = (this.spec.radius * angleStep) / 2;

    for (let i = 0; i < this.spec.segments; ++i) {
      const midAngle = -this.spec.gapAngle / 2 + angleStep * (i + 0.5);
      const x = this.spec.radius * Math.cos(midAngle);
      const y = this.spec.radius * Math.sin(midAngle);

      // Draw each segment as a rectangle
      const segmentGraphic = new PIXI.Graphics();
      segmentGraphic.rect(-m2p(halfBarLen), -m2p(this.spec.thickness / 2),
                         m2p(halfBarLen * 2), m2p(this.spec.thickness));
      segmentGraphic.fill(0x00ffff);
      segmentGraphic.position.set(m2p(x), m2p(y));
      segmentGraphic.rotation = midAngle;

      g.addChild(segmentGraphic);
    }

    // Draw sensor (for debugging)
    const sensorLen = this.spec.thickness * 2;
    const sensorDistance = this.spec.radius + this.spec.thickness + 0.5;
    const sensorGraphic = new PIXI.Graphics();
    sensorGraphic.rect(-m2p(sensorLen / 2), -m2p(this.spec.thickness / 2),
                      m2p(sensorLen), m2p(this.spec.thickness));
    sensorGraphic.fill(0xff0000, 0.3); // Semi-transparent red
    sensorGraphic.position.set(m2p(sensorDistance), 0);  // Position outside the gap
    g.addChild(sensorGraphic);

    this.graphic = g;
  }

  step(fixedStep: number) {
    // Spin the ring
    const currentRot = this.body.rotation();
    this.body.setNextKinematicRotation(currentRot + this.spec.spinSpeed * fixedStep);

    // Handle escape events
    this.eventQueue.drainCollisionEvents((h1, h2, started) => {
      if (!started) return;

      const c1 = this.world.getCollider(h1);
      const c2 = this.world.getCollider(h2);
      if (!c1 || !c2) return;

      const sensor = c1.isSensor() ? c1 : c2.isSensor() ? c2 : null;
      if (!sensor) return;

      const ballCollider = sensor === c1 ? c2 : c1;
      const escapedBall = ballCollider.parent();
      if (escapedBall === null) return;

      if (this.onBallEscape) {
        this.onBallEscape(escapedBall);
      }
    });
  }

  getEventQueue(): RAPIER.EventQueue {
    return this.eventQueue;
  }
}