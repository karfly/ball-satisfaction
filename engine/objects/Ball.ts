import * as PIXI from "pixi.js";
import type RAPIER from "@dimforge/rapier2d-deterministic";
import { GlowFilter } from 'pixi-filters';
import { Prefab } from "./Prefab";
import { m2p } from "../scale";
import type { BallConfig, TrailSegment } from "./interfaces";

export class Ball extends Prefab {
  private trailHistory: TrailSegment[] = [];
  private trailGraphic: PIXI.Graphics;
  private ballGraphic: PIXI.Graphics;
  private lastTrailUpdate: number = 0;

  constructor(
    world: RAPIER.World,
    R: typeof RAPIER,
    private config: BallConfig,
    private spawnX: number,
    private spawnY: number,
    private initialVelocity: { x: number; y: number }
  ) {
    super(world, R);
    this.trailGraphic = new PIXI.Graphics();
    this.ballGraphic = new PIXI.Graphics();
    this.init();
    // Set initial velocity after physics creation
    this.body.setLinvel(this.initialVelocity, true);
  }

  protected createPhysics() {
    this.body = this.world.createRigidBody(
      this.R.RigidBodyDesc.dynamic()
        .setTranslation(this.spawnX, this.spawnY)
        .setCcdEnabled(true) // CCD enabled by default for all dynamic objects
    );

    const collider = this.R.ColliderDesc.ball(this.config.radius)
      .setRestitution(this.config.restitution)
      .setFriction(this.config.friction);
    this.world.createCollider(collider, this.body);
  }

    protected createGraphics() {
    // Create the ball graphic (this will be rotated)
    this.ballGraphic.circle(0, 0, m2p(this.config.radius));
    this.ballGraphic.fill(this.config.color);

    // Apply glow effect if enabled
    if (this.config.glow.enabled) {
      const glowFilter = new GlowFilter({
        distance: this.config.glow.distance,
        outerStrength: this.config.glow.outerStrength,
        color: this.config.glow.color ?? this.config.color, // Use ball color if glow color not specified
        quality: this.config.glow.quality
      });
      this.ballGraphic.filters = [glowFilter];
    }

    // Create container to hold both trail and ball
    const container = new PIXI.Container();
    container.addChild(this.trailGraphic); // Trail behind ball (won't rotate)
    container.addChild(this.ballGraphic); // Ball in front (will rotate independently)

    this.graphic = container;
  }

  updateFromPhysics() {
    const p = this.body.translation();
    // Set position of the entire container (ball + trail)
    this.graphic.position.set(m2p(p.x), m2p(p.y));

    // Only rotate the ball graphic, not the entire container
    this.ballGraphic.rotation = this.body.rotation();

    // Update trail if enabled
    if (this.config.trail.enabled) {
      this.updateTrail(p.x, p.y);
    }
  }

  private updateTrail(physicsX: number, physicsY: number) {
    const now = performance.now();

    // Throttle trail updates based on updateInterval
    if (now - this.lastTrailUpdate < this.config.trail.updateInterval) {
      return;
    }

    this.lastTrailUpdate = now;

    // Add current position to trail history
    this.trailHistory.push({
      x: physicsX,
      y: physicsY,
      timestamp: now
    });

    // Remove old segments beyond maxLength
    while (this.trailHistory.length > this.config.trail.maxLength) {
      this.trailHistory.shift();
    }

    // Render the trail
    this.renderTrail();
  }

  private renderTrail() {
    this.trailGraphic.clear();

    if (this.trailHistory.length < 2) {
      return;
    }

    const trailColor = this.config.trail.color ?? this.config.color;
    const ballRadius = m2p(this.config.radius);
    const maxTrailWidth = ballRadius * 2 * this.config.trail.width; // Start with ball diameter

    // Draw trail segments
    for (let i = 1; i < this.trailHistory.length; i++) {
      const current = this.trailHistory[i];
      const previous = this.trailHistory[i - 1];

      // Calculate fade based on position in trail (newer = more opaque)
      const progress = i / this.trailHistory.length;
      // Non-linear fade - quadratic curve makes tail fade faster
      const fadeProgress = progress ** 3;
      const alpha = this.config.trail.fadeAlpha + ((1 - this.config.trail.fadeAlpha)) * fadeProgress;

      // Calculate width tapering - start wide and taper to thin
      // progress = 1 (newest) should have max width, progress = 0 (oldest) should have min width
      const width = maxTrailWidth * progress;

      // Convert physics coordinates to pixel coordinates relative to ball position
      const currentPixel = { x: m2p(current.x), y: m2p(current.y) };
      const previousPixel = { x: m2p(previous.x), y: m2p(previous.y) };

      // Get ball's current position in pixels
      const ballPixelPos = { x: m2p(this.body.translation().x), y: m2p(this.body.translation().y) };

      // Make trail coordinates relative to ball's current position
      const relativeStart = {
        x: previousPixel.x - ballPixelPos.x,
        y: previousPixel.y - ballPixelPos.y
      };
      const relativeEnd = {
        x: currentPixel.x - ballPixelPos.x,
        y: currentPixel.y - ballPixelPos.y
      };

      // Draw trail segment
      this.trailGraphic.moveTo(relativeStart.x, relativeStart.y);
      this.trailGraphic.lineTo(relativeEnd.x, relativeEnd.y);
      this.trailGraphic.stroke({
        color: trailColor,
        width: Math.max(0.5, width),
        alpha: alpha,
        cap: 'round',
        join: 'round'
      });
    }
  }

  clearTrail() {
    this.trailHistory = [];
    this.trailGraphic.clear();
  }

  setTrailEnabled(enabled: boolean) {
    this.config.trail.enabled = enabled;
    if (!enabled) {
      this.clearTrail();
    }
  }

  // Override destroy to cleanup trail
  destroy() {
    this.clearTrail();
    if (this.trailGraphic) {
      this.trailGraphic.destroy();
    }
    if (this.ballGraphic) {
      this.ballGraphic.destroy();
    }
  }
}