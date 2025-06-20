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
  private getEmitter(effectType: string, color?: number): Emitter {
    const emitterKey = color !== undefined ? `${effectType}-${color}` : effectType;

    if (this.emitters.has(emitterKey)) {
      return this.emitters.get(emitterKey)!;
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
      case 'dust-fall':
        // Create simple circle dust texture
        const dustCanvas = document.createElement('canvas');
        dustCanvas.width = 4;
        dustCanvas.height = 4;
        const dustCtx = dustCanvas.getContext('2d');
        if (dustCtx) {
          // Use provided color or default white
          const dustColor = color !== undefined ? '#' + color.toString(16).padStart(6, '0') : '#ffffff';
          dustCtx.fillStyle = dustColor;
          dustCtx.beginPath();
          dustCtx.arc(2, 2, 1.5, 0, Math.PI * 2);
          dustCtx.fill();
        }
        const dustTexture = PIXI.Texture.from(dustCanvas);

        particleConfig = {
          lifetime: {
            min: 1.0,
            max: 2.0  // Medium lifetime for dust settling
          },
          frequency: 0.008,
          spawnChance: 0.3,
          particlesPerWave: 15,  // Moderate particle count
          emitterLifetime: -1,
          pos: { x: 0, y: 0 },
          addAtBack: false,
          behaviors: [
            {
              type: 'alpha',
              config: {
                alpha: {
                  list: [
                    { value: 1.0, time: 0 },    // Start semi-transparent
                    { value: 0.0, time: 0.5 },     // Fade to transparent
                    { value: 0.0, time: 1.0 }     // Fade to transparent
                  ]
                }
              }
            },
            {
              type: 'scale',
              config: {
                scale: {
                  list: [
                    { value: 1.0, time: 0 },    // Start normal size
                    { value: 0.5, time: 1 }     // Shrink as it fades
                  ]
                }
              }
            },

            {
              type: 'moveAcceleration',
              config: {
                accel: {
                  x: 0,
                  y: 200  // Gravity-like downward acceleration
                },
                minStart: 0,
                maxStart: 0
              }
            },
            {
              type: 'moveSpeed',
              config: {
                speed: {
                  list: [
                    { value: 60, time: 0 },   // Initial outward velocity
                    { value: 20, time: 0.3 }, // Slow down due to air resistance
                    { value: 20, time: 1 }    // Terminal velocity
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
              type: 'textureSingle',
              config: {
                texture: dustTexture
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
      this.emitters.set(emitterKey, emitter);
      return emitter;
    } catch (error) {
      console.error(`❌ Failed to create ${emitterKey} particle emitter:`, error);
      throw error;
    }
  }

  /**
   * Emit particles at world coordinates (physics coordinates)
   */
  emitParticlesAt(effectType: string, physicsX: number, physicsY: number, collisionInfo?: {
    angle?: number; // Collision angle in radians
    velocity?: { x: number; y: number }; // Ball velocity at collision
    intensity?: number; // Collision intensity (0-1)
    ballColor?: number; // Ball color for particles
  }) {
    try {
      const emitter = this.getEmitter(effectType, collisionInfo?.ballColor);

      // Convert physics coordinates to screen coordinates
      const screenX = m2p(physicsX);
      const screenY = m2p(physicsY);

      // Since our container is added to the main stage (which is centered),
      // we need to account for the stage offset
      const finalX = screenX;
      const finalY = screenY;

      emitter.updateSpawnPos(finalX, finalY);

      // For dust-fall effect, vary particle count based on collision intensity
      if (effectType === 'dust-fall' && collisionInfo?.intensity !== undefined) {
        const baseParticleCount = 20;
        const intensityMultiplier = 0.5 + (collisionInfo.intensity * 1.5); // Range: 0.5 to 2.0
        emitter.particlesPerWave = Math.floor(baseParticleCount * intensityMultiplier);
      }

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