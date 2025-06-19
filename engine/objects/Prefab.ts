import * as PIXI from "pixi.js";
import type RAPIER from "@dimforge/rapier2d-deterministic";
import { m2p } from "../scale";

export abstract class Prefab {
  body!: RAPIER.RigidBody;
  graphic!: PIXI.Container;

  constructor(
    protected world: RAPIER.World,
    protected R: typeof RAPIER
  ) {}

  protected abstract createPhysics(): void;
  protected abstract createGraphics(): void;

  init() {
    this.createPhysics();
    this.createGraphics();
  }

  updateFromPhysics() {
    const p = this.body.translation();
    this.graphic.position.set(m2p(p.x), m2p(p.y));
    this.graphic.rotation = this.body.rotation();
  }
}