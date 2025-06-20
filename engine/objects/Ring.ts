import * as PIXI from "pixi.js";
import type RAPIER from "@dimforge/rapier2d-deterministic";
import { GlowFilter } from 'pixi-filters';
import { Prefab } from "./Prefab";
import { m2p } from "../scale";
import type { RingConfig } from "./interfaces";
import type { ParticleManager } from "../ParticleManager";

export class Ring extends Prefab {
  /** Array of escape sensor segment colliders forming a closed ring outside the main ring */
  private escapeSensorColliders: RAPIER.Collider[] = [];
  /** Array of corner capsule colliders for rounded gap edges */
  private cornerColliders: RAPIER.Collider[] = [];
  /** Array of physical ring segment colliders */
  private ringColliders: RAPIER.Collider[] = [];
  /** Map for O(1) ring collider lookup by handle */
  private ringColliderMap = new Map<number, RAPIER.Collider>();
  private eventQueue!: RAPIER.EventQueue;
  private onBallRingEscape?: (escapedBall: RAPIER.RigidBody) => void;
  /** Track balls that have already triggered ring escape to prevent duplicates */
  private escapedBallHandles = new Set<number>();
  /** Track last particle emission time per ball (ballHandle -> timestamp) */
  private lastParticleEmissionTime = new Map<number, number>();
  /** Reference to the independent particle manager */
  private particleManager?: ParticleManager;
  /** Current physics time for collision tracking */
  private currentPhysicsTime: number = 0;

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

  setParticleManager(particleManager: ParticleManager) {
    this.particleManager = particleManager;
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
        .setActiveEvents(this.R.ActiveEvents.COLLISION_EVENTS)
        .setEnabled(true),
      this.body
    );
    this.cornerColliders.push(startCornerCollider);
    this.ringColliderMap.set(startCornerCollider.handle, startCornerCollider);

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
        .setActiveEvents(this.R.ActiveEvents.COLLISION_EVENTS)
        .setEnabled(true),
      this.body
    );
    this.cornerColliders.push(endCornerCollider);
    this.ringColliderMap.set(endCornerCollider.handle, endCornerCollider);
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

      const ringCollider = this.world.createCollider(
        this.R.ColliderDesc.cuboid(this.config.thickness / 2, this.config.thickness / 2)
          .setTranslation(
            this.config.radius * Math.cos(midAngle),
            this.config.radius * Math.sin(midAngle)
          )
          .setRotation(midAngle)
          .setFriction(this.config.friction)
          .setRestitution(this.config.restitution)
          .setActiveEvents(this.R.ActiveEvents.COLLISION_EVENTS)
          .setEnabled(true),
        this.body
      );
      this.ringColliders.push(ringCollider);
      this.ringColliderMap.set(ringCollider.handle, ringCollider);
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
    // Update physics time for collision tracking
    this.currentPhysicsTime += fixedStep;

    // Periodic cleanup of old emission timestamps (every 10 seconds)
    if (Math.floor(this.currentPhysicsTime) % 10 === 0 &&
        this.currentPhysicsTime - Math.floor(this.currentPhysicsTime) < fixedStep) {
      this.cleanupOldEmissionTimes();
    }

    // Spin the ring
    const currentRot = this.body.rotation();
    this.body.setNextKinematicRotation(currentRot + this.config.spinSpeed * fixedStep);
  }

  processCollisionEvent(h1: number, h2: number, started: boolean) {
    if (!started) return;

    const c1 = this.world.getCollider(h1);
    const c2 = this.world.getCollider(h2);
    if (!c1 || !c2) return;

    // Check for escape sensor collision (ball escaping through ring)
    const escapeSensor = c1.isSensor() ? c1 : c2.isSensor() ? c2 : null;
    if (escapeSensor && this.escapeSensorColliders.includes(escapeSensor)) {
      this.handleEscapeCollision(escapeSensor === c1 ? c2 : c1);
      return;
    }

    // Check for physical ring collision (ball hitting ring) - O(1) lookup
    const ringCollider = this.ringColliderMap.get(h1) || this.ringColliderMap.get(h2);
    if (ringCollider) {
      const ballCollider = ringCollider.handle === h1 ? c2 : c1;
      this.handleRingCollision(ballCollider, ringCollider);
    }
  }

  private handleEscapeCollision(ballCollider: RAPIER.Collider) {
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

  private handleRingCollision(ballCollider: RAPIER.Collider, ringCollider: RAPIER.Collider) {
    const collidedBall = ballCollider.parent();
    if (collidedBall === null) return;

    // Get cooldown duration from config (default 0.25 seconds - much shorter than before)
    const cooldownDuration = this.config.particles?.cooldownDuration ?? 0.25;

    // Check time-based cooldown per ball
    const ballHandle = collidedBall.handle;
    const lastEmissionTime = this.lastParticleEmissionTime.get(ballHandle);

    if (lastEmissionTime !== undefined &&
        (this.currentPhysicsTime - lastEmissionTime) < cooldownDuration) {
      return; // Still in cooldown period
    }

    // Update emission time
    this.lastParticleEmissionTime.set(ballHandle, this.currentPhysicsTime);

    // Calculate particle emission point at center of ring wall
    const ringBodyPos = this.body.translation(); // Should be (0,0)
    const ballPos = ballCollider.parent()?.translation();

    if (!ballPos) return; // Can't calculate without ball position

    // Calculate angle from ring center to ball collision point
    const collisionAngle = Math.atan2(ballPos.y - ringBodyPos.y, ballPos.x - ringBodyPos.x);

    // Emit particles at the center of the ring wall (ring radius distance from center)
    const actualCollisionX = ringBodyPos.x + this.config.radius * Math.cos(collisionAngle);
    const actualCollisionY = ringBodyPos.y + this.config.radius * Math.sin(collisionAngle);

    // Emit particles at the center of the ring wall
    if (this.config.particles.enabled && this.particleManager) {
      // Get ball velocity for collision information
      const ballVelocity = collidedBall.linvel();
      const velocityMagnitude = Math.sqrt(ballVelocity.x * ballVelocity.x + ballVelocity.y * ballVelocity.y);
      const intensity = Math.min(1.0, velocityMagnitude / 5.0); // Normalize to 0-1 based on velocity

      // Emit dust-fall effect
      const ballColor = this.config.particles.color || (ballCollider.parent()?.userData as any)?.color;
      this.particleManager.emitParticlesAt('dust-fall', actualCollisionX, actualCollisionY, {
        angle: collisionAngle,
        velocity: ballVelocity,
        intensity: intensity * (this.config.particles.dustIntensity ?? 1.0),
        ballColor: ballColor
      });
    }
  }

  getEventQueue(): RAPIER.EventQueue {
    return this.eventQueue;
  }

    /**
   * Clean up old emission timestamps to prevent memory leaks
   */
  private cleanupOldEmissionTimes() {
    const maxAge = 5.0; // Keep timestamps for last 5 seconds
    const cutoffTime = this.currentPhysicsTime - maxAge;

    const keysToDelete: number[] = [];
    this.lastParticleEmissionTime.forEach((timestamp, ballHandle) => {
      if (timestamp < cutoffTime) {
        keysToDelete.push(ballHandle);
      }
    });

    keysToDelete.forEach(ballHandle => {
      this.lastParticleEmissionTime.delete(ballHandle);
    });
  }

  /**
   * Clean up tracking for a ball that has been removed from the world
   */
  cleanupEscapedBall(ballHandle: number) {
    this.escapedBallHandles.delete(ballHandle);
    // Also clean up particle emission tracking
    this.lastParticleEmissionTime.delete(ballHandle);
  }
}