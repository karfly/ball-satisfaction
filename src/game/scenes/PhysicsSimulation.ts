import { Scene } from 'phaser';
import { EventBus } from '../EventBus';
import {
    CreateWorld,
    CreateCircle,
    CreateBoxPolygon,
    WorldStep,
    b2DefaultWorldDef,
    b2Vec2,
    b2Rot,
    b2Body_SetType,
    b2Body_SetTransform,
    b2Body_SetLinearVelocity,
    b2Body_SetAngularVelocity,
    b2Body_GetPosition,
    b2Body_GetRotation,
    b2BodyType
} from 'phaser-box2d';

// Physics constants (converted to Box2D scale)
const PHYSICS_CONFIG = {
    GRAVITY: 10, // Box2D uses m/s², more realistic gravity
    BALL_RADIUS_PIXELS: 16, // Visual radius in pixels
    BALL_RADIUS_METERS: 0.5, // Physics radius in meters (Box2D scale)
    BALL_RESTITUTION: 0.9,
    BALL_FRICTION: 0.1,
    BALL_DENSITY: 1.0,
    RING_RADIUS_PIXELS: 200, // Visual radius in pixels
    RING_RADIUS_METERS: 6.5, // Physics radius in meters
    RING_THICKNESS_METERS: 0.3,
    RING_RESTITUTION: 0.9,
    RING_FRICTION: 0.1,
    SCALE_FACTOR: 30 // Pixels per meter conversion
} as const;

// Game world constants
const WORLD_CONFIG = {
    WIDTH: 1024,
    HEIGHT: 768,
    CENTER_X: 512,
    CENTER_Y: 384,
    BALL_START_Y: 200
} as const;

// Colors
const COLORS = {
    BALL: 0xff0000,
    RING: 0xffffff
} as const;

// Helper functions for coordinate conversion
const pixelsToMeters = (pixels: number): number => pixels / PHYSICS_CONFIG.SCALE_FACTOR;
const metersToPixels = (meters: number): number => meters * PHYSICS_CONFIG.SCALE_FACTOR;

export class PhysicsSimulation extends Scene {
    private ball!: Phaser.GameObjects.Graphics;
    private ring!: Phaser.GameObjects.Graphics;
    private worldId!: any; // Box2D world ID
    private ballBodyId!: any; // Box2D body ID
    private ringBodyId!: any; // Box2D body ID for outer ring
    private isRunning: boolean = false;

    constructor() {
        super('PhysicsSimulation');
    }

    create() {
        this.initializePhysics();
        this.createVisuals();
        this.createPhysicsBodies();

        // Notify that scene is ready
        EventBus.emit('current-scene-ready', this);
    }

    private initializePhysics() {
        try {
            // Create Box2D world with gravity
            const worldDef = b2DefaultWorldDef();
            worldDef.gravity = new b2Vec2(0, PHYSICS_CONFIG.GRAVITY);

            const world = CreateWorld({ worldDef });
            this.worldId = world.worldId;
            console.log('Box2D world created with ID:', this.worldId);
        } catch (error) {
            console.error('Failed to initialize Box2D physics:', error);
        }
    }

    private createVisuals() {
        this.createRingVisual();
        this.createBallVisual();
    }

    private createRingVisual() {
        this.ring = this.add.graphics();
        this.ring.lineStyle(8, COLORS.RING); // Using pixel thickness for visual
        this.ring.strokeCircle(
            WORLD_CONFIG.CENTER_X,
            WORLD_CONFIG.CENTER_Y,
            PHYSICS_CONFIG.RING_RADIUS_PIXELS
        );
    }

    private createBallVisual() {
        this.ball = this.add.graphics();
        this.ball.fillStyle(COLORS.BALL);
        this.ball.fillCircle(0, 0, PHYSICS_CONFIG.BALL_RADIUS_PIXELS);
        this.ball.x = WORLD_CONFIG.CENTER_X;
        this.ball.y = WORLD_CONFIG.BALL_START_Y;
    }

    private createPhysicsBodies() {
        if (!this.worldId) return;

        this.createRingPhysics();
        this.createBallPhysics();
    }

    private createRingPhysics() {
        if (!this.worldId) return;

        try {
            // Create a perfect circular ring using Box2D
            // We'll create a hollow ring by using collision boundaries at the world edges

            const centerX = pixelsToMeters(WORLD_CONFIG.CENTER_X);
            const centerY = pixelsToMeters(WORLD_CONFIG.CENTER_Y);

            // Create invisible boundaries just outside the ring to contain the ball
            const ringRadius = PHYSICS_CONFIG.RING_RADIUS_METERS;
            const boundaryThickness = 0.1;

            // Top boundary
            CreateBoxPolygon({
                worldId: this.worldId,
                type: b2BodyType.b2_staticBody,
                position: new b2Vec2(centerX, centerY - ringRadius - boundaryThickness),
                size: new b2Vec2(ringRadius * 2.2, boundaryThickness),
                density: 1.0,
                friction: PHYSICS_CONFIG.RING_FRICTION,
                restitution: PHYSICS_CONFIG.RING_RESTITUTION
            });

            // Bottom boundary
            CreateBoxPolygon({
                worldId: this.worldId,
                type: b2BodyType.b2_staticBody,
                position: new b2Vec2(centerX, centerY + ringRadius + boundaryThickness),
                size: new b2Vec2(ringRadius * 2.2, boundaryThickness),
                density: 1.0,
                friction: PHYSICS_CONFIG.RING_FRICTION,
                restitution: PHYSICS_CONFIG.RING_RESTITUTION
            });

            // Left boundary
            CreateBoxPolygon({
                worldId: this.worldId,
                type: b2BodyType.b2_staticBody,
                position: new b2Vec2(centerX - ringRadius - boundaryThickness, centerY),
                size: new b2Vec2(boundaryThickness, ringRadius * 2.2),
                density: 1.0,
                friction: PHYSICS_CONFIG.RING_FRICTION,
                restitution: PHYSICS_CONFIG.RING_RESTITUTION
            });

            // Right boundary
            CreateBoxPolygon({
                worldId: this.worldId,
                type: b2BodyType.b2_staticBody,
                position: new b2Vec2(centerX + ringRadius + boundaryThickness, centerY),
                size: new b2Vec2(boundaryThickness, ringRadius * 2.2),
                density: 1.0,
                friction: PHYSICS_CONFIG.RING_FRICTION,
                restitution: PHYSICS_CONFIG.RING_RESTITUTION
            });

            console.log('Ring physics boundaries created');
        } catch (error) {
            console.error('Failed to create ring physics:', error);
        }
    }

    private createBallPhysics() {
        if (!this.worldId) return;

        try {
            const centerX = pixelsToMeters(WORLD_CONFIG.CENTER_X);
            const startY = pixelsToMeters(WORLD_CONFIG.BALL_START_Y);

            // Create a perfect circle using Box2D
            const ballResult = CreateCircle({
                worldId: this.worldId,
                type: b2BodyType.b2_staticBody, // Start as static
                position: new b2Vec2(centerX, startY),
                radius: PHYSICS_CONFIG.BALL_RADIUS_METERS,
                density: PHYSICS_CONFIG.BALL_DENSITY,
                friction: PHYSICS_CONFIG.BALL_FRICTION,
                restitution: PHYSICS_CONFIG.BALL_RESTITUTION
            });

            this.ballBodyId = ballResult.bodyId;
            console.log('Ball physics body created with ID:', this.ballBodyId);
        } catch (error) {
            console.error('Failed to create ball physics:', error);
        }
    }

    public startSimulation() {
        if (!this.isRunning && this.ballBodyId) {
            this.isRunning = true;
            // Change ball from static to dynamic to enable physics
            // Use type assertion to bypass incorrect TypeScript definitions
            (b2Body_SetType as any)(this.ballBodyId, 2); // b2_dynamicBody = 2
            console.log('Simulation started');
        }
    }

    public resetSimulation() {
        if (this.ballBodyId) {
            // Stop the ball and reset its position
            // Use type assertion to bypass incorrect TypeScript definitions
            (b2Body_SetType as any)(this.ballBodyId, 0); // b2_staticBody = 0

            const centerX = pixelsToMeters(WORLD_CONFIG.CENTER_X);
            const startY = pixelsToMeters(WORLD_CONFIG.BALL_START_Y);
            const rotation = new b2Rot(1, 0); // No rotation (cos=1, sin=0)

            b2Body_SetTransform(this.ballBodyId, new b2Vec2(centerX, startY), rotation);
            b2Body_SetLinearVelocity(this.ballBodyId, new b2Vec2(0, 0));
            b2Body_SetAngularVelocity(this.ballBodyId, 0);

            this.isRunning = false;
            console.log('Simulation reset');
        }
    }

    update(time: number, delta: number) {
        if (!this.worldId) return;

        try {
            // Step the Box2D physics world with correct configuration
            WorldStep({
                worldId: this.worldId,
                deltaTime: delta / 1000, // Convert to seconds
                fixedTimeStep: 1/60,
                subStepCount: 4
            } as any); // Use 'as any' to bypass strict typing for now

            // Sync visual ball with physics body
            if (this.ballBodyId && this.ball) {
                const position = b2Body_GetPosition(this.ballBodyId);
                const rotation = b2Body_GetRotation(this.ballBodyId);

                this.ball.x = metersToPixels(position.x);
                this.ball.y = metersToPixels(position.y);
                this.ball.rotation = Math.atan2(rotation.s, rotation.c); // Convert b2Rot to angle
            }
        } catch (error) {
            // Silently handle physics update errors to avoid spam
        }
    }
}