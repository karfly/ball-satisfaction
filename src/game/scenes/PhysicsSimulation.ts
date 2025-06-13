import { Scene } from 'phaser';
import { EventBus } from '../EventBus';

// 👉 NEW IMPORTS: Bring in the Box2D helper functions that ship with the repo.
// @ts-ignore – The helper library is plain JS. TS will still compile because allowJs=true.
import {
    CreateWorld,
    WorldStep,
    CreateCircle,
    pxm,
    pxmVec2,
    BodyToSprite,
    SetWorldScale,
    b2BodyType,
    b2Vec2,
    b2DefaultWorldDef,
    b2Body_SetTransform,
    b2Body_SetLinearVelocity,
    b2DefaultBodyDef,
    b2CreateBody,
    b2DefaultChainDef,
    b2CreateChain,
    b2Body_SetBullet,
    b2DestroyBody,
    CreateDebugDraw,
    b2World_Draw,
    b2Body_SetAngularVelocity,
    b2Body_GetRotation,
    b2Rot_GetAngle
} from '../../lib/PhaserBox2D-Debug.js';

// Simple physics constants
const PHYSICS_CONFIG = {
    BALL_RADIUS: 20,
    BALL_COLOR: 0xff0000,
    BALL_RESTITUTION: 1.0,
    BALL_FRICTION: 0.5,

    CIRCLE_WALL_COLOR: 0xffffff,
    WALL_RESTITUTION: 1.0,
    WALL_FRICTION: 0.5,
    CIRCLE_WALL_ROTATION_SPEED: -1.0 // radians per second (negative = clockwise)
} as const;

// World constants
const WORLD_CONFIG = {
    WIDTH: 1024,
    HEIGHT: 768,
    CIRCLE_WALL_RADIUS: 250,
    CIRCLE_WALL_SEGMENTS: 32,
    BALL_START_X: 512,
    BALL_START_Y: 768 * 0.25, // 75% down the screen
    GRAVITY_Y: -20 // Box2D gravity (negative for downward in Phaser coords)
} as const;

export class PhysicsSimulation extends Scene {
    private circleWall!: Phaser.GameObjects.Graphics;
    private circleWallBody: any;
    private circleWallBodyId: any;

    private balls: Phaser.GameObjects.Graphics[] = [];
    private ballBodies: any[] = [];

    // Box2D world identifier
    private worldId: any;

    // Simulation state
    private isPaused: boolean = true;

    // Debug drawing helpers (native Box2D debug draw)
    private debugCanvas!: HTMLCanvasElement;
    private debugCtx!: CanvasRenderingContext2D;
    private debugDraw: any;
    private debugEnabled: boolean = true;

    // Visual rendering control
    private visualsEnabled: boolean = true;

    constructor() {
        super('PhysicsSimulation');
    }

    create() {
        this.initPhysicsWorld();
        this.setupDebugCanvas();
        this.createCircleWall();
        this.spawnBall();

        // Apply initial visual state
        this.setVisuals(this.visualsEnabled);

        EventBus.emit('current-scene-ready', this);
    }

    // --------------------------------------------------
    // Helper setup methods
    // --------------------------------------------------

    private initPhysicsWorld() {
        SetWorldScale(30);
        const worldDef = b2DefaultWorldDef();
        worldDef.gravity = new b2Vec2(0, WORLD_CONFIG.GRAVITY_Y);
        const world = CreateWorld({ worldDef });
        this.worldId = world.worldId;
    }

    private setupDebugCanvas() {
        // Create an overlay canvas that sits above the Phaser canvas
        this.debugCanvas = document.createElement('canvas');
        this.debugCanvas.width = WORLD_CONFIG.WIDTH;
        this.debugCanvas.height = WORLD_CONFIG.HEIGHT;
        this.debugCanvas.style.position = 'absolute';
        this.debugCanvas.style.top = '0';
        this.debugCanvas.style.left = '0';
        this.debugCanvas.style.pointerEvents = 'none';
        this.debugCanvas.style.zIndex = '1000';

        // Append to the same parent as Phaser's canvas
        this.game.canvas.parentElement?.appendChild(this.debugCanvas);

        // Canvas 2D context
        this.debugCtx = this.debugCanvas.getContext('2d') as CanvasRenderingContext2D;

        const SCALE = 30;
        this.debugDraw = CreateDebugDraw(this.debugCanvas, this.debugCtx, SCALE);

        // Shift world origin (0,0) from canvas centre to top-left so it lines-up with sprite positions
        const dpi = window.devicePixelRatio || 1;
        const logicalW = this.debugCanvas.width / dpi;
        const logicalH = this.debugCanvas.height / dpi;
        this.debugDraw.positionOffset.x = -logicalW / 2;
        this.debugDraw.positionOffset.y = -logicalH / 2;

        // Initial visibility
        this.debugCanvas.style.display = this.debugEnabled ? 'block' : 'none';
    }

    private createCircleWall() {
        // Visual circle wall
        this.circleWall = this.add.graphics();
        this.circleWall.lineStyle(6, PHYSICS_CONFIG.CIRCLE_WALL_COLOR);
        this.circleWall.strokeCircle(0, 0, WORLD_CONFIG.CIRCLE_WALL_RADIUS);

        // Position the graphics object at the center of the screen
        this.circleWall.setPosition(WORLD_CONFIG.WIDTH / 2, WORLD_CONFIG.HEIGHT / 2);

        // Physics chain loop
        const bodyDef = b2DefaultBodyDef();
        bodyDef.type = b2BodyType.b2_kinematicBody;
        bodyDef.position = pxmVec2(WORLD_CONFIG.WIDTH / 2, -WORLD_CONFIG.HEIGHT / 2);
        const bodyId = b2CreateBody(this.worldId, bodyDef);
        this.circleWallBodyId = bodyId;

        const segments = WORLD_CONFIG.CIRCLE_WALL_SEGMENTS;
        const radiusM = pxm(WORLD_CONFIG.CIRCLE_WALL_RADIUS);
        const points: any[] = [];
        for (let i = 0; i < segments; i++) {
            const a = (2 * Math.PI * i) / segments;
            points.unshift(new b2Vec2(radiusM * Math.cos(a), radiusM * Math.sin(a)));
        }

        const chainDef = b2DefaultChainDef();
        chainDef.points = points;
        chainDef.count = points.length;
        chainDef.isLoop = true;
        chainDef.friction = PHYSICS_CONFIG.WALL_FRICTION;
        chainDef.restitution = PHYSICS_CONFIG.WALL_RESTITUTION;

        this.circleWallBody = b2CreateChain(bodyId, chainDef);

        // Set angular velocity for clockwise rotation
        b2Body_SetAngularVelocity(bodyId, PHYSICS_CONFIG.CIRCLE_WALL_ROTATION_SPEED);
    }

    public spawnBall() {
        const offset = (Math.random() * 2 - 1) * WORLD_CONFIG.CIRCLE_WALL_RADIUS * 0.1;
        const spawnX = WORLD_CONFIG.BALL_START_X + offset;
        const spawnY = WORLD_CONFIG.BALL_START_Y;

        // Visual
        const ballGraphic = this.add.graphics();
        ballGraphic.fillStyle(PHYSICS_CONFIG.BALL_COLOR);
        ballGraphic.fillCircle(0, 0, PHYSICS_CONFIG.BALL_RADIUS);
        ballGraphic.setPosition(spawnX, spawnY);

        // Physics
        const body = CreateCircle({
            worldId: this.worldId,
            type: b2BodyType.b2_dynamicBody,
            position: pxmVec2(spawnX, -spawnY),
            radius: pxm(PHYSICS_CONFIG.BALL_RADIUS),
            restitution: PHYSICS_CONFIG.BALL_RESTITUTION,
            friction: PHYSICS_CONFIG.BALL_FRICTION
        });
        b2Body_SetBullet(body.bodyId, true);

        // Store
        this.balls.push(ballGraphic);
        this.ballBodies.push(body);
    }

    update() {
        if (!this.worldId) return;

        // Step physics simulation only when not paused
        if (!this.isPaused) {
            const dt = this.game.loop.delta / 1000;
            WorldStep({ worldId: this.worldId, deltaTime: dt });
        }

        // Sync all balls
        for (let i = 0; i < this.ballBodies.length; i++) {
            BodyToSprite(this.ballBodies[i], this.balls[i]);
        }

        // Sync circle wall rotation
        if (this.circleWallBodyId) {
            // Continuously apply angular velocity to ensure constant rotation
            b2Body_SetAngularVelocity(this.circleWallBodyId, PHYSICS_CONFIG.CIRCLE_WALL_ROTATION_SPEED);

            const rotation = b2Body_GetRotation(this.circleWallBodyId);
            const angle = b2Rot_GetAngle(rotation);
            this.circleWall.setRotation(angle);
        }

        // Debug rendering
        if (this.debugEnabled && this.debugCtx && this.debugDraw) {
            this.debugCtx.clearRect(0, 0, this.debugCanvas.width, this.debugCanvas.height);
            b2World_Draw(this.worldId, this.debugDraw);
        }
    }

    public startSimulation() {
        // Nothing special to do – gravity already active
        this.isPaused = false;
        console.log('Ball falling simulation started');
    }

    public pauseSimulation() {
        this.isPaused = true;
        console.log('Simulation paused');
    }

    public resumeSimulation() {
        this.isPaused = false;
        console.log('Simulation resumed');
    }

    public resetSimulation() {
        // Destroy existing balls
        for (let i = 0; i < this.ballBodies.length; i++) {
            b2DestroyBody(this.ballBodies[i].bodyId);
            this.balls[i].destroy();
        }
        this.ballBodies = [];
        this.balls = [];

        // Spawn a fresh single ball
        this.spawnBall();

        // Pause until started
        this.isPaused = true;

        console.log('Simulation reset');
    }

    public setDebug(enabled: boolean) {
        this.debugEnabled = enabled;
        if (this.debugCanvas) {
            this.debugCanvas.style.display = enabled ? 'block' : 'none';
        }
    }

    public setVisuals(enabled: boolean) {
        this.visualsEnabled = enabled;

        // Toggle visibility of visual elements
        this.circleWall.setVisible(enabled);

        for (const ball of this.balls) {
            ball.setVisible(enabled);
        }
    }
}