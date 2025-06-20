import * as PIXI from "pixi.js";
import { Emitter } from '@barvynkoa/particle-emitter';
import { m2p } from "./scale";

export class ParticleManager {
  private container: PIXI.Container;
  private emitters: Map<string, Emitter> = new Map();

  constructor(stage: PIXI.Container) {
    // Create independent container for all particles
    this.container = new PIXI.Container();
    stage.addChild(this.container);
  }

  /**
   * Create or get an emitter for a specific effect type
   */
  private getEmitter(effectType: string): Emitter {
    if (this.emitters.has(effectType)) {
      return this.emitters.get(effectType)!;
    }

    // Create particle texture
    const canvas = document.createElement('canvas');
    canvas.width = 8;
    canvas.height = 8;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(4, 4, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    const texture = PIXI.Texture.from(canvas);

    // Configure particle effect based on type
    let particleConfig: any;

    switch (effectType) {
      case 'ring-collision':
        particleConfig = {
          lifetime: {
            min: 0.3,
            max: 0.8
          },
          frequency: 0.01,
          spawnChance: 1,
          particlesPerWave: 12,
          emitterLifetime: -1,
          maxParticles: 200,
          pos: { x: 0, y: 0 },
          addAtBack: false,
          behaviors: [
            {
              type: 'alpha',
              config: {
                alpha: {
                  list: [
                    { value: 0.9, time: 0 },
                    { value: 0.1, time: 1 }
                  ]
                }
              }
            },
            {
              type: 'scale',
              config: {
                scale: {
                  list: [
                    { value: 1.0, time: 0 },
                    { value: 0.3, time: 1 }
                  ]
                }
              }
            },
            {
              type: 'color',
              config: {
                color: {
                  list: [
                    { value: 'ffdd00', time: 0 },
                    { value: 'ff8800', time: 0.5 },
                    { value: 'ff4400', time: 1 }
                  ]
                }
              }
            },
            {
              type: 'moveSpeed',
              config: {
                speed: {
                  list: [
                    { value: 150, time: 0 },
                    { value: 20, time: 1 }
                  ],
                  isStepped: false
                }
              }
            },
            {
              type: 'rotationStatic',
              config: {
                min: 0,
                max: 360
              }
            },
            {
              type: 'spawnShape',
              config: {
                type: 'torus',
                data: {
                  x: 0,
                  y: 0,
                  radius: 8
                }
              }
            },
            {
              type: 'textureSingle',
              config: {
                texture: texture
              }
            }
          ]
        };
        break;

      default:
        throw new Error(`Unknown particle effect type: ${effectType}`);
    }

    try {
      const emitter = new Emitter(this.container, particleConfig);
      emitter.emit = false;
      this.emitters.set(effectType, emitter);
      return emitter;
    } catch (error) {
      console.error(`❌ Failed to create ${effectType} particle emitter:`, error);
      throw error;
    }
  }

  /**
   * Emit particles at world coordinates (physics coordinates)
   */
  emitParticlesAt(effectType: string, physicsX: number, physicsY: number) {
    try {
      const emitter = this.getEmitter(effectType);

      // Convert physics coordinates to screen coordinates
      const screenX = m2p(physicsX);
      const screenY = m2p(physicsY);

      // Since our container is added to the main stage (which is centered),
      // we need to account for the stage offset
      const finalX = screenX;
      const finalY = screenY;

      emitter.updateSpawnPos(finalX, finalY);
      emitter.emitNow();

    } catch (error) {
      console.error(`❌ Failed to emit ${effectType} particles:`, error);
    }
  }

  /**
   * Update all emitters (call this in the game loop)
   */
  update(deltaTime: number) {
    this.emitters.forEach((emitter) => {
      emitter.update(deltaTime);
    });
  }

  /**
   * Clean up all emitters
   */
  destroy() {
    this.emitters.forEach((emitter) => {
      emitter.destroy();
    });
    this.emitters.clear();

    if (this.container.parent) {
      this.container.parent.removeChild(this.container);
    }
    this.container.destroy();
  }
}