import { Scene } from 'phaser';
import { EventBus } from '../EventBus';

// Physics constants
const PHYSICS_CONFIG = {
    GRAVITY: 0.8,
    BALL_RADIUS: 16,
    BALL_RESTITUTION: 0.9,
    BALL_FRICTION: 0.1,
    BALL_DENSITY: 0.001,
    RING_RADIUS: 200,
    RING_THICKNESS: 8,
    RING_SEGMENTS: 16,
    RING_RESTITUTION: 0.9,
    RING_FRICTION: 0.1
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

export class PhysicsSimulation extends Scene {
    private ball!: Phaser.GameObjects.Graphics;
    private ring!: Phaser.GameObjects.Graphics;
    private ballBody!: MatterJS.BodyType;
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
        // Set up Matter.js physics world
        this.matter.world.setBounds(
            0, 0,
            WORLD_CONFIG.WIDTH,
            WORLD_CONFIG.HEIGHT,
            32,
            true, true, false, true
        );
        this.matter.world.engine.world.gravity.y = PHYSICS_CONFIG.GRAVITY;
    }

    private createVisuals() {
        this.createRingVisual();
        this.createBallVisual();
    }

    private createRingVisual() {
        this.ring = this.add.graphics();
        this.ring.lineStyle(PHYSICS_CONFIG.RING_THICKNESS, COLORS.RING);
        this.ring.strokeCircle(
            WORLD_CONFIG.CENTER_X,
            WORLD_CONFIG.CENTER_Y,
            PHYSICS_CONFIG.RING_RADIUS
        );
    }

    private createBallVisual() {
        this.ball = this.add.graphics();
        this.ball.fillStyle(COLORS.BALL);
        this.ball.fillCircle(0, 0, PHYSICS_CONFIG.BALL_RADIUS);
        this.ball.x = WORLD_CONFIG.CENTER_X;
        this.ball.y = WORLD_CONFIG.BALL_START_Y;
    }

    private createPhysicsBodies() {
        this.createRingPhysics();
        this.createBallPhysics();
    }

    private createRingPhysics() {
        const { CENTER_X, CENTER_Y } = WORLD_CONFIG;
        const { RING_RADIUS, RING_SEGMENTS, RING_THICKNESS, RING_RESTITUTION, RING_FRICTION } = PHYSICS_CONFIG;

        // Create ring as multiple static line segments
        for (let i = 0; i < RING_SEGMENTS; i++) {
            const angle1 = (i / RING_SEGMENTS) * Math.PI * 2;
            const angle2 = ((i + 1) / RING_SEGMENTS) * Math.PI * 2;

            const x1 = CENTER_X + Math.cos(angle1) * RING_RADIUS;
            const y1 = CENTER_Y + Math.sin(angle1) * RING_RADIUS;
            const x2 = CENTER_X + Math.cos(angle2) * RING_RADIUS;
            const y2 = CENTER_Y + Math.sin(angle2) * RING_RADIUS;

            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2;
            const segmentLength = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
            const segmentAngle = Math.atan2(y2 - y1, x2 - x1);

            this.matter.add.rectangle(midX, midY, segmentLength, RING_THICKNESS, {
                isStatic: true,
                angle: segmentAngle,
                render: { visible: false },
                restitution: RING_RESTITUTION,
                friction: RING_FRICTION
            });
        }
    }

    private createBallPhysics() {
        const { CENTER_X, BALL_START_Y } = WORLD_CONFIG;
        const { BALL_RADIUS, BALL_RESTITUTION, BALL_FRICTION, BALL_DENSITY } = PHYSICS_CONFIG;

        this.ballBody = this.matter.add.circle(CENTER_X, BALL_START_Y, BALL_RADIUS, {
            restitution: BALL_RESTITUTION,
            friction: BALL_FRICTION,
            density: BALL_DENSITY,
            render: { visible: false }
        });

        // Start with ball static (not affected by gravity)
        this.matter.body.setStatic(this.ballBody, true);
    }

    public startSimulation() {
        if (!this.isRunning) {
            this.isRunning = true;
            // Enable physics on the ball
            this.matter.body.setStatic(this.ballBody, false);
        }
    }

    public resetSimulation() {
        if (this.ballBody) {
            // Stop the ball and reset its position
            this.matter.body.setStatic(this.ballBody, true);
            this.matter.body.setPosition(this.ballBody, {
                x: WORLD_CONFIG.CENTER_X,
                y: WORLD_CONFIG.BALL_START_Y
            });
            this.matter.body.setVelocity(this.ballBody, { x: 0, y: 0 });
            this.matter.body.setAngularVelocity(this.ballBody, 0);

            this.isRunning = false;
        }
    }

    update() {
        // Sync visual ball with physics body
        if (this.ballBody && this.ball) {
            this.ball.x = this.ballBody.position.x;
            this.ball.y = this.ballBody.position.y;
            this.ball.rotation = this.ballBody.angle;
        }
    }
}