import * as PIXI from "pixi.js";
import type RAPIER from "@dimforge/rapier2d-deterministic";
import { Prefab } from "./Prefab";
import { m2p } from "../scale";
import type { RingConfig } from "./interfaces";

export class Ring extends Prefab {
  private sensorCollider!: RAPIER.Collider;
  private eventQueue!: RAPIER.EventQueue;
  private onBallEscape?: (escapedBall: RAPIER.RigidBody) => void;

  constructor(
    world: RAPIER.World,
    R: typeof RAPIER,
    private config: RingConfig
  ) {
    super(world, R);
    this.eventQueue = new R.EventQueue(true);
    this.init();
  }

  setEscapeHandler(handler: (escapedBall: RAPIER.RigidBody) => void) {
    this.onBallEscape = handler;
  }

  protected createPhysics() {
    // Create kinematic ring body
    this.body = this.world.createRigidBody(
      this.R.RigidBodyDesc.kinematicPositionBased()
        .setTranslation(0, 0)  // Physics coordinates centered at origin
        .setCcdEnabled(true)  // Enable CCD for rotating ring
    );

    // Create cuboid segments
    const arc = 2 * Math.PI - this.config.gapAngle;
    const angleStep = arc / this.config.segments;
    const halfBarLen = (this.config.radius * angleStep) / 2;

    for (let i = 0; i < this.config.segments; ++i) {
      const midAngle = -this.config.gapAngle / 2 + angleStep * (i + 0.5);
      this.world.createCollider(
        this.R.ColliderDesc.cuboid(halfBarLen, this.config.thickness / 2)
          .setTranslation(
            this.config.radius * Math.cos(midAngle),
            this.config.radius * Math.sin(midAngle)
          )
          .setRotation(midAngle)
          .setFriction(this.config.friction)
          .setRestitution(this.config.restitution)
          .setEnabled(true),
        this.body
      );
    }

    // Create sensor outside the gap
    const sensorLen = this.config.thickness * 2;
    const sensorDistance = this.config.radius + this.config.thickness + this.config.sensorOffset;
    this.sensorCollider = this.world.createCollider(
      this.R.ColliderDesc.cuboid(sensorLen / 2, this.config.thickness)
        .setTranslation(sensorDistance, 0)  // Position outside the gap
        .setSensor(true)
        .setActiveEvents(this.R.ActiveEvents.COLLISION_EVENTS)
        .setCollisionGroups(0b10_0001)   // membership 0b10, filter 0b0001
        .setEnabled(true),
      this.body
    );

    // Store spin speed in userData
    this.body.userData = { spinSpeed: this.config.spinSpeed };
  }

  protected createGraphics() {
    const g = new PIXI.Graphics();

    // Draw ring segments
    const arc = 2 * Math.PI - this.config.gapAngle;
    const angleStep = arc / this.config.segments;
    const halfBarLen = (this.config.radius * angleStep) / 2;

    for (let i = 0; i < this.config.segments; ++i) {
      const midAngle = -this.config.gapAngle / 2 + angleStep * (i + 0.5);
      const x = this.config.radius * Math.cos(midAngle);
      const y = this.config.radius * Math.sin(midAngle);

      // Draw each segment as a rectangle
      const segmentGraphic = new PIXI.Graphics();
      segmentGraphic.rect(-m2p(halfBarLen), -m2p(this.config.thickness / 2),
                         m2p(halfBarLen * 2), m2p(this.config.thickness));
      segmentGraphic.fill(this.config.color);
      segmentGraphic.position.set(m2p(x), m2p(y));
      segmentGraphic.rotation = midAngle;

      g.addChild(segmentGraphic);
    }

    // Draw sensor (for debugging)
    const sensorLen = this.config.thickness * 2;
    const sensorDistance = this.config.radius + this.config.thickness + this.config.sensorOffset;
    const sensorGraphic = new PIXI.Graphics();
    sensorGraphic.rect(-m2p(sensorLen / 2), -m2p(this.config.thickness / 2),
                      m2p(sensorLen), m2p(this.config.thickness));
    sensorGraphic.fill(0xff0000, 0.3); // Semi-transparent red
    sensorGraphic.position.set(m2p(sensorDistance), 0);  // Position outside the gap
    g.addChild(sensorGraphic);

    this.graphic = g;
  }

  step(fixedStep: number) {
    // Spin the ring
    const currentRot = this.body.rotation();
    this.body.setNextKinematicRotation(currentRot + this.config.spinSpeed * fixedStep);

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