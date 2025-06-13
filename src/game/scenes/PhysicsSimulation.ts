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
    b2DebugDraw,
    b2World_Draw
} from '../../lib/PhaserBox2D.js';

// Simple physics constants
const PHYSICS_CONFIG = {
    BALL_RADIUS: 20,
    BALL_COLOR: 0xff0000,
    BALL_RESTITUTION: 1.0,
    BALL_FRICTION: 0.0,

    CIRCLE_WALL_COLOR: 0xffffff,
    WALL_RESTITUTION: 1.0,
    WALL_FRICTION: 0.0
} as const;

// World constants
const WORLD_CONFIG = {
    WIDTH: 1024,
    HEIGHT: 768,
    CIRCLE_WALL_RADIUS: 250,
    CIRCLE_WALL_SEGMENTS: 512,
    BALL_START_X: 512,
    BALL_START_Y: 768 * 0.25, // 75% down the screen
    GRAVITY_Y: -20 // Box2D gravity (negative for downward in Phaser coords)
} as const;

export class PhysicsSimulation extends Scene {
    private circleWall!: Phaser.GameObjects.Graphics;
    private circleWallBody: any;

    private balls: Phaser.GameObjects.Graphics[] = [];
    private ballBodies: any[] = [];

    // Box2D world identifier
    private worldId: any;

    // Simulation state
    private isPaused: boolean = true;

    // Debug drawing helpers
    private debugGraphics!: Phaser.GameObjects.Graphics;
    private debugDraw: any;
    private debugEnabled: boolean = false;

    constructor() {
        super('PhysicsSimulation');
    }

    create() {
        this.initPhysicsWorld();
        this.setupDebugGraphics();
        this.createCircleWall();
        this.spawnBall();

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

    private setupDebugGraphics() {
        this.debugGraphics = this.add.graphics();
        this.debugGraphics.setDepth(1000);
        this.debugGraphics.setVisible(this.debugEnabled);

        const SCALE = 30;
        this.debugDraw = new b2DebugDraw();

        const toPxX = (x: number) => x * SCALE;
        const toPxY = (y: number) => -y * SCALE;

        // Line, circle, polygon
        this.debugDraw.DrawSegment = (p1: any, p2: any, color: number) => {
            this.debugGraphics.lineStyle(1, color & 0xffffff, 1);
            this.debugGraphics.beginPath();
            this.debugGraphics.moveTo(toPxX(p1.x), toPxY(p1.y));
            this.debugGraphics.lineTo(toPxX(p2.x), toPxY(p2.y));
            this.debugGraphics.strokePath();
        };

        this.debugDraw.DrawCircle = (center: any, radius: number, color: number) => {
            this.debugGraphics.lineStyle(1, color & 0xffffff, 1);
            this.debugGraphics.strokeCircle(toPxX(center.x), toPxY(center.y), radius * SCALE);
        };

        this.debugDraw.DrawPolygon = (xf: any, verts: any[], count: number, color: number) => {
            if (count <= 0) return;
            this.debugGraphics.lineStyle(1, color & 0xffffff, 1);
            this.debugGraphics.beginPath();
            const rot = xf.q;
            const trans = xf.p;
            const transformPoint = (v: any) => {
                const x = rot.c * v.x - rot.s * v.y + trans.x;
                const y = rot.s * v.x + rot.c * v.y + trans.y;
                return { x, y };
            };
            const first = transformPoint(verts[0]);
            this.debugGraphics.moveTo(toPxX(first.x), toPxY(first.y));
            for (let i = 1; i < count; ++i) {
                const p = transformPoint(verts[i]);
                this.debugGraphics.lineTo(toPxX(p.x), toPxY(p.y));
            }
            this.debugGraphics.lineTo(toPxX(first.x), toPxY(first.y));
            this.debugGraphics.strokePath();
        };

        // Fallbacks for solid drawing
        this.debugDraw.DrawSolidCircle = (xf: any, radius: number, color: number) => {
            const center = xf.p;
            this.debugDraw.DrawCircle(center, radius, color);
        };
        this.debugDraw.DrawSolidPolygon = (xf: any, verts: any[], count: number, color: number) => {
            this.debugDraw.DrawPolygon(xf, verts, count, color);
        };
    }

    private createCircleWall() {
        // Visual circle wall
        this.circleWall = this.add.graphics();
        this.circleWall.lineStyle(6, PHYSICS_CONFIG.CIRCLE_WALL_COLOR);
        this.circleWall.strokeCircle(
            WORLD_CONFIG.WIDTH / 2,
            WORLD_CONFIG.HEIGHT / 2,
            WORLD_CONFIG.CIRCLE_WALL_RADIUS
        );

        // Physics chain loop
        const bodyDef = b2DefaultBodyDef();
        bodyDef.type = b2BodyType.b2_staticBody;
        bodyDef.position = pxmVec2(WORLD_CONFIG.WIDTH / 2, -WORLD_CONFIG.HEIGHT / 2);
        const bodyId = b2CreateBody(this.worldId, bodyDef);

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

        // Debug rendering
        if (this.debugEnabled && this.debugGraphics && this.debugDraw) {
            this.debugGraphics.clear();
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
        if (this.debugGraphics) {
            this.debugGraphics.setVisible(enabled);
        }
    }
}