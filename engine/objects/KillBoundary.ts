import * as PIXI from "pixi.js";
import type RAPIER from "@dimforge/rapier2d-deterministic";
import { Prefab } from "./Prefab";
import { m2p, p2m } from "../scale";
import type { KillBoundaryConfig } from "./interfaces";

export class KillBoundary extends Prefab {
  private killSensorColliders: RAPIER.Collider[] = [];
  private onBallKill?: (killedBall: RAPIER.RigidBody) => void;
  private killedBallHandles = new Set<number>();
  private screenDimensions: { width: number; height: number };

  constructor(
    world: RAPIER.World,
    R: typeof RAPIER,
    private config: KillBoundaryConfig,
    screenWidth: number,
    screenHeight: number
  ) {
    super(world, R);
    this.screenDimensions = { width: screenWidth, height: screenHeight };
    this.init();
  }

  setKillHandler(handler: (killedBall: RAPIER.RigidBody) => void) {
    this.onBallKill = handler;
  }

  updateScreenDimensions(width: number, height: number) {
    this.screenDimensions = { width, height };
    this.recreateBoundaries();
  }

  private recreateBoundaries() {
    // Remove existing colliders
    this.killSensorColliders.forEach(collider => {
      this.world.removeCollider(collider, false);
    });
    this.killSensorColliders = [];

    // Remove existing graphics
    this.graphic.removeChildren();

    // Recreate physics and graphics
    this.createPhysics();
    this.createGraphics();
  }

  protected createPhysics() {
    // Create static body for boundaries
    this.body = this.world.createRigidBody(
      this.R.RigidBodyDesc.fixed()
        .setTranslation(0, 0)
    );

    // Convert screen dimensions to physics units (screen center is at 0,0)
    const screenWidthPhysics = p2m(this.screenDimensions.width);
    const screenHeightPhysics = p2m(this.screenDimensions.height);
    const halfWidth = screenWidthPhysics / 2;
    const halfHeight = screenHeightPhysics / 2;

    // Create four boundary boxes
    const boundaries = [
      // Top boundary
      {
        x: 0,
        y: -halfHeight - this.config.offset - this.config.thickness / 2,
        width: screenWidthPhysics + 2 * this.config.offset,
        height: this.config.thickness
      },
      // Bottom boundary
      {
        x: 0,
        y: halfHeight + this.config.offset + this.config.thickness / 2,
        width: screenWidthPhysics + 2 * this.config.offset,
        height: this.config.thickness
      },
      // Left boundary
      {
        x: -halfWidth - this.config.offset - this.config.thickness / 2,
        y: 0,
        width: this.config.thickness,
        height: screenHeightPhysics + 2 * this.config.offset
      },
      // Right boundary
      {
        x: halfWidth + this.config.offset + this.config.thickness / 2,
        y: 0,
        width: this.config.thickness,
        height: screenHeightPhysics + 2 * this.config.offset
      }
    ];

    boundaries.forEach(boundary => {
      const collider = this.world.createCollider(
        this.R.ColliderDesc.cuboid(boundary.width / 2, boundary.height / 2)
          .setTranslation(boundary.x, boundary.y)
          .setSensor(true)
          .setActiveEvents(this.R.ActiveEvents.COLLISION_EVENTS)
          .setEnabled(true),
        this.body
      );
      this.killSensorColliders.push(collider);
    });
  }

  protected createGraphics() {
    const g = new PIXI.Graphics();
    this.graphic = g;
  }

  processCollisionEvent(h1: number, h2: number, started: boolean) {
    if (!started) return;

    const c1 = this.world.getCollider(h1);
    const c2 = this.world.getCollider(h2);
    if (!c1 || !c2) return;

    const killSensor = c1.isSensor() ? c1 : c2.isSensor() ? c2 : null;
    if (!killSensor) return;

    // Check if the kill sensor belongs to this kill boundary
    if (!this.killSensorColliders.includes(killSensor)) return;

    const ballCollider = killSensor === c1 ? c2 : c1;
    const killedBall = ballCollider.parent();
    if (killedBall === null) return;

    // Prevent duplicate processing of the same ball
    const ballHandle = killedBall.handle;
    if (this.killedBallHandles.has(ballHandle)) {
      return;
    }

    this.killedBallHandles.add(ballHandle);

    if (this.onBallKill) {
      this.onBallKill(killedBall);
    }
  }

  /**
   * Clean up tracking for a ball that has been removed from the world
   */
  cleanupKilledBall(ballHandle: number) {
    this.killedBallHandles.delete(ballHandle);
  }
}