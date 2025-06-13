import { Scene } from 'phaser';
import { EventBus } from '../EventBus';

export class PhysicsSimulation extends Scene {
    private world: any;
    private ball: Phaser.GameObjects.Graphics;
    private ring: Phaser.GameObjects.Graphics;
    private isSimulationRunning: boolean = false;
    private ballBody: any;
    private ringBodies: any[] = [];

    constructor() {
        super('PhysicsSimulation');
    }

        create() {
        // Initialize physics and create game objects immediately
        this.initializePhysics();
        this.createRing();
        this.createBall();

        // Emit scene ready event
        EventBus.emit('current-scene-ready', this);
    }

    private initializePhysics() {
        // For now, we'll use Phaser's built-in Matter.js physics for a working demo
        // and we can upgrade to Box2D later once the plugin is properly loaded
        this.matter.world.setBounds(0, 0, 1024, 768, 32, true, true, false, true);
        this.matter.world.engine.world.gravity.y = 0.8;
    }

        private createRing() {
        // Create visual ring
        this.ring = this.add.graphics();
        this.ring.lineStyle(8, 0xffffff);
        this.ring.strokeCircle(512, 384, 200);

        // Create physics bodies for the ring using Matter.js
        this.createRingPhysics();
    }

    private createRingPhysics() {
        const centerX = 512;
        const centerY = 384;
        const radius = 200;
        const segments = 16; // Fewer segments for better performance

        for (let i = 0; i < segments; i++) {
            const angle1 = (i / segments) * Math.PI * 2;
            const angle2 = ((i + 1) / segments) * Math.PI * 2;

            const x1 = centerX + Math.cos(angle1) * radius;
            const y1 = centerY + Math.sin(angle1) * radius;
            const x2 = centerX + Math.cos(angle2) * radius;
            const y2 = centerY + Math.sin(angle2) * radius;

            // Create line segment for the ring
            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2;
            const width = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
            const angle = Math.atan2(y2 - y1, x2 - x1);

            const segment = this.matter.add.rectangle(midX, midY, width, 8, {
                isStatic: true,
                angle: angle,
                render: { visible: false },
                restitution: 0.9, // High bounce
                friction: 0.1
            });

            this.ringBodies.push(segment);
        }
    }

    private createBall() {
        // Create visual ball
        this.ball = this.add.graphics();
        this.ball.fillStyle(0xff0000);
        this.ball.fillCircle(0, 0, 16);
        this.ball.x = 512;
        this.ball.y = 200; // Start above center

        // Create physics body for the ball
        this.createBallPhysics();
    }

    private createBallPhysics() {
        // Create physics body
        this.ballBody = this.matter.add.circle(512, 200, 16, {
            restitution: 0.9, // Very bouncy
            friction: 0.1,
            density: 0.001,
            render: { visible: false }
        });

        // Initially make the ball static (not affected by gravity)
        this.matter.body.setStatic(this.ballBody, true);
    }

    public startSimulation() {
        if (!this.isSimulationRunning) {
            this.isSimulationRunning = true;

            // Make the ball dynamic so it's affected by gravity
            this.matter.body.setStatic(this.ballBody, false);
        }
    }

    public resetSimulation() {
        if (this.ballBody) {
            // Reset ball position and make it static again
            this.matter.body.setStatic(this.ballBody, true);
            this.matter.body.setPosition(this.ballBody, { x: 512, y: 200 });
            this.matter.body.setVelocity(this.ballBody, { x: 0, y: 0 });
            this.matter.body.setAngularVelocity(this.ballBody, 0);

            this.isSimulationRunning = false;
        }
    }

    update() {
        if (this.ballBody) {
            // Update visual ball position from physics body
            this.ball.x = this.ballBody.position.x;
            this.ball.y = this.ballBody.position.y;
            this.ball.rotation = this.ballBody.angle;
        }
    }
}