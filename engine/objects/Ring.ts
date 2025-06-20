import * as PIXI from "pixi.js";
import type RAPIER from "@dimforge/rapier2d-deterministic";
import { GlowFilter } from 'pixi-filters';
import { Prefab } from "./Prefab";
import { m2p } from "../scale";
import type { RingConfig } from "./interfaces";

export class Ring extends Prefab {
  /** Array of escape sensor segment colliders forming a closed ring outside the main ring */
  private escapeSensorColliders: RAPIER.Collider[] = [];
  /** Array of corner capsule colliders for rounded gap edges */
  private cornerColliders: RAPIER.Collider[] = [];
  private eventQueue!: RAPIER.EventQueue;
  private onBallRingEscape?: (escapedBall: RAPIER.RigidBody) => void;
  /** Track balls that have already triggered ring escape to prevent duplicates */
  private escapedBallHandles = new Set<number>();

  constructor(
    world: RAPIER.World,
    R: typeof RAPIER,
    private config: RingConfig
  ) {
    super(world, R);
    this.eventQueue = new R.EventQueue(true);
    this.init();
  }

  setRingEscapeHandler(handler: (escapedBall: RAPIER.RigidBody) => void) {
    this.onBallRingEscape = handler;
  }

  /**
   * Check if an angle falls within the gap, handling wrap-around at 2π
   */
  private isAngleInGap(angle: number, gapStart: number, gapEnd: number): boolean {
    // Normalize angles to [0, 2π)
    const normalizeAngle = (a: number) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

    const normAngle = normalizeAngle(angle);
    const normStart = normalizeAngle(gapStart);
    const normEnd = normalizeAngle(gapEnd);

    // Handle case where gap crosses 0/2π boundary
    if (normStart > normEnd) {
      return normAngle >= normStart || normAngle <= normEnd;
    } else {
      return normAngle >= normStart && normAngle <= normEnd;
    }
  }

  /**
   * Create rounded corner capsules at the gap edges
   */
  private createCornerCapsules(gapStartAngle: number, gapEndAngle: number) {
    // Get corner radius from config or use default
    const cornerRadius = this.config.cornerRadius ?? this.config.thickness / 2;

    // Skip if corner radius is too small or disabled
    if (cornerRadius <= 0) {
      return;
    }

    // Capsule half-height spans from inner edge to outer edge of ring
    const capsuleHalfHeight = this.config.thickness / 4;

    // Create capsule at gap start
    const startCornerCollider = this.world.createCollider(
      this.R.ColliderDesc.capsule(capsuleHalfHeight, cornerRadius)
        .setTranslation(
          this.config.radius * Math.cos(gapStartAngle),
          this.config.radius * Math.sin(gapStartAngle)
        )
        .setRotation(gapStartAngle) // Tangent to the ring
        .setFriction(this.config.friction)
        .setRestitution(this.config.restitution)
        .setEnabled(true),
      this.body
    );
    this.cornerColliders.push(startCornerCollider);

    // Create capsule at gap end
    const endCornerCollider = this.world.createCollider(
      this.R.ColliderDesc.capsule(capsuleHalfHeight, cornerRadius)
        .setTranslation(
          this.config.radius * Math.cos(gapEndAngle),
          this.config.radius * Math.sin(gapEndAngle)
        )
        .setRotation(gapEndAngle) // Tangent to the ring
        .setFriction(this.config.friction)
        .setRestitution(this.config.restitution)
        .setEnabled(true),
      this.body
    );
    this.cornerColliders.push(endCornerCollider);
  }

  protected createPhysics() {
    // Create kinematic ring body
    this.body = this.world.createRigidBody(
      this.R.RigidBodyDesc.kinematicPositionBased()
        .setTranslation(0, 0)  // Physics coordinates centered at origin
        .setCcdEnabled(true) // CCD enabled by default for all kinematic objects
    );

    // Calculate gap boundaries: gap is centered at gapCenterAngle
    const gapStartAngle = this.config.gapCenterAngle - this.config.gapAngle / 2;
    const gapEndAngle = this.config.gapCenterAngle + this.config.gapAngle / 2;

    // Create segments distributed around full circle, skipping gap area
    const totalAngleStep = (2 * Math.PI) / this.config.segments;

    for (let i = 0; i < this.config.segments; ++i) {
      const midAngle = totalAngleStep * (i + 0.5);

      // Skip segments that fall within the gap
      if (this.isAngleInGap(midAngle, gapStartAngle, gapEndAngle)) {
        continue;
      }

      this.world.createCollider(
        this.R.ColliderDesc.cuboid(this.config.thickness / 2, this.config.thickness / 2)
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

    // Create a closed ring of escape sensor segments (no gap)
    const escapeSensorRadius = this.config.radius + this.config.thickness + this.config.escapeSensorOffset + this.config.escapeSensorThickness / 2;
    const escapeSensorAngleStep = (2 * Math.PI) / this.config.segments;

    for (let i = 0; i < this.config.segments; ++i) {
      const midAngle = escapeSensorAngleStep * (i + 0.5);

      const escapeSensorCollider = this.world.createCollider(
        this.R.ColliderDesc.cuboid(this.config.escapeSensorThickness / 2, this.config.escapeSensorThickness / 2)
          .setTranslation(
            escapeSensorRadius * Math.cos(midAngle),
            escapeSensorRadius * Math.sin(midAngle)
          )
          .setRotation(midAngle)
          .setSensor(true)
          .setActiveEvents(this.R.ActiveEvents.COLLISION_EVENTS)
          .setEnabled(true),
        this.body
      );
      this.escapeSensorColliders.push(escapeSensorCollider);
    }

    // Create rounded corner capsules at gap edges
    this.createCornerCapsules(gapStartAngle, gapEndAngle);

    // Store spin speed in userData
    this.body.userData = { spinSpeed: this.config.spinSpeed };
  }

  protected createGraphics() {
    const g = new PIXI.Graphics();

    // Compute gap angles (in radians)
    const gapStartAngle = this.config.gapCenterAngle - this.config.gapAngle / 2;
    const gapEndAngle   = this.config.gapCenterAngle + this.config.gapAngle / 2;

    // Configure stroke so that its centre lies exactly on the physics radius
    g.setStrokeStyle({
      width: m2p(this.config.thickness),
      color: this.config.color,
      cap:   "round",
      join:  "round",
      alignment: 0.5
    });

    const radiusPx = m2p(this.config.radius);

    // Draw the ring as a single arc that wraps around the gap (clockwise)
    // Example: if gap is from 4.5→4.9 rad, we draw from 4.9 → (4.5+2π) rad.
    g.arc(0, 0, radiusPx, gapEndAngle, gapStartAngle + 2 * Math.PI);
    g.stroke();

    // Apply glow effect if enabled
    if (this.config.glow.enabled) {
      const glowFilter = new GlowFilter({
        distance: this.config.glow.distance,
        outerStrength: this.config.glow.outerStrength,
        color: this.config.glow.color,
        quality: this.config.glow.quality
      });
      g.filters = [glowFilter];
    }

    this.graphic = g;
  }

  step(fixedStep: number) {
    // Spin the ring
    const currentRot = this.body.rotation();
    this.body.setNextKinematicRotation(currentRot + this.config.spinSpeed * fixedStep);
  }

  processCollisionEvent(h1: number, h2: number, started: boolean) {
    if (!started) return;

    const c1 = this.world.getCollider(h1);
    const c2 = this.world.getCollider(h2);
    if (!c1 || !c2) return;

    const escapeSensor = c1.isSensor() ? c1 : c2.isSensor() ? c2 : null;
    if (!escapeSensor) return;

    // Check if the escape sensor belongs to this ring
    if (!this.escapeSensorColliders.includes(escapeSensor)) return;

    const ballCollider = escapeSensor === c1 ? c2 : c1;
    const escapedBall = ballCollider.parent();
    if (escapedBall === null) return;

    // Prevent duplicate processing of the same ball
    const ballHandle = escapedBall.handle;
    if (this.escapedBallHandles.has(ballHandle)) {
      return;
    }

    this.escapedBallHandles.add(ballHandle);

    if (this.onBallRingEscape) {
      this.onBallRingEscape(escapedBall);
    }
  }

  getEventQueue(): RAPIER.EventQueue {
    return this.eventQueue;
  }

  /**
   * Clean up tracking for a ball that has been removed from the world
   */
  cleanupEscapedBall(ballHandle: number) {
    this.escapedBallHandles.delete(ballHandle);
  }
}