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
    b2DebugDraw,
    b2World_Draw
} from '../../lib/PhaserBox2D.js';

// Simple physics constants
const PHYSICS_CONFIG = {
    BALL_RADIUS: 20,
    BALL_COLOR: 0xff0000,
    BALL_RESTITUTION: 0.99,
    BALL_FRICTION: 0.0,

    CIRCLE_WALL_COLOR: 0xffffff,
    WALL_RESTITUTION: 0.1,
    WALL_FRICTION: 0.0
} as const;

// World constants
const WORLD_CONFIG = {
    WIDTH: 1024,
    HEIGHT: 768,
    CIRCLE_WALL_RADIUS: 250,
    CIRCLE_WALL_SEGMENTS: 64,
    BALL_START_X: 512,
    BALL_START_Y: 768 * 0.25 // 75% down the screen
} as const;

export class PhysicsSimulation extends Scene {
    private ball!: Phaser.GameObjects.Graphics;
    private circleWall!: Phaser.GameObjects.Graphics;
    // Box2D body wrapper objects returned from CreateCircle / chain
    private ballBody: any;
    private circleWallBody: any;

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
        // --------------------------------------------------
        // 1) Initialise Box2D world
        // --------------------------------------------------
        SetWorldScale(30); // 30px = 1 meter (works well for typical 2D games)

        const worldDef = b2DefaultWorldDef();
        // Box2D Y axis is up (+Y), Phaser is down (+Y), so we flip sign here.
        worldDef.gravity = new b2Vec2(0, -9.8);

        const world = CreateWorld({ worldDef });
        this.worldId = world.worldId;

        // --------------------------------------------------
        // Debug-draw setup
        // --------------------------------------------------
        this.debugGraphics = this.add.graphics();
        this.debugGraphics.setDepth(1000);
        this.debugGraphics.setVisible(this.debugEnabled);

        const SCALE = 30;

        this.debugDraw = new b2DebugDraw();

        const toPxX = (x: number) => x * SCALE;
        const toPxY = (y: number) => -y * SCALE;

        // Basic implementations – enough to see shapes
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
                // Rotate then translate
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

        // Fallbacks so library doesn't throw if these are missing
        this.debugDraw.DrawSolidCircle = (xf: any, radius: number, color: number) => {
            const center = xf.p;
            this.debugDraw.DrawCircle(center, radius, color);
        };

        this.debugDraw.DrawSolidPolygon = (xf: any, verts: any[], count: number, color: number) => {
            this.debugDraw.DrawPolygon(xf, verts, count, color);
        };

        // --------------------------------------------------
        // 2) Render circle wall (visual) and create its physics chain shape
        // --------------------------------------------------
        this.circleWall = this.add.graphics();
        this.circleWall.lineStyle(6, PHYSICS_CONFIG.CIRCLE_WALL_COLOR);
        this.circleWall.strokeCircle(
            WORLD_CONFIG.WIDTH / 2,
            WORLD_CONFIG.HEIGHT / 2,
            WORLD_CONFIG.CIRCLE_WALL_RADIUS
        );

        // Physics circle wall body (static chain loop)
        const circleWallBodyDef = b2DefaultBodyDef();
        circleWallBodyDef.type = b2BodyType.b2_staticBody;
        circleWallBodyDef.position = pxmVec2(
            WORLD_CONFIG.WIDTH / 2,
            -WORLD_CONFIG.HEIGHT / 2
        );
        const circleWallBodyId = b2CreateBody(this.worldId, circleWallBodyDef);

        // Build points for chain loop
        const segments = WORLD_CONFIG.CIRCLE_WALL_SEGMENTS;
        const radiusMeters = pxm(WORLD_CONFIG.CIRCLE_WALL_RADIUS);
        const points: any[] = [];
        for (let i = 0; i < segments; i++) {
            const angle = (2 * Math.PI * i) / segments;
            // Note: push in REVERSE (clockwise) order so normals face inward
            points.unshift(new b2Vec2(
                radiusMeters * Math.cos(angle),
                radiusMeters * Math.sin(angle)
            ));
        }

        const chainDef = b2DefaultChainDef();
        chainDef.points = points;
        chainDef.count = points.length;
        chainDef.isLoop = true;
        chainDef.friction = PHYSICS_CONFIG.WALL_FRICTION;
        chainDef.restitution = PHYSICS_CONFIG.WALL_RESTITUTION;

        this.circleWallBody = b2CreateChain(circleWallBodyId, chainDef);

        // --------------------------------------------------
        // 3) Render ball (visual)
        // --------------------------------------------------
        this.ball = this.add.graphics();
        this.ball.fillStyle(PHYSICS_CONFIG.BALL_COLOR);
        this.ball.fillCircle(0, 0, PHYSICS_CONFIG.BALL_RADIUS);
        this.ball.setPosition(WORLD_CONFIG.BALL_START_X, WORLD_CONFIG.BALL_START_Y);

        // Physics ball body (dynamic circle)
        this.ballBody = CreateCircle({
            worldId: this.worldId,
            type: b2BodyType.b2_dynamicBody,
            position: pxmVec2(
                WORLD_CONFIG.BALL_START_X,
                -WORLD_CONFIG.BALL_START_Y
            ),
            radius: pxm(PHYSICS_CONFIG.BALL_RADIUS),
            restitution: PHYSICS_CONFIG.BALL_RESTITUTION,
            friction: PHYSICS_CONFIG.BALL_FRICTION
        });

        // Enable continuous collision detection (bullet) to prevent tunneling through thin wall
        b2Body_SetBullet(this.ballBody.bodyId, true);

        // Leave simulation paused until user starts it via UI

        // Notify that scene is ready
        EventBus.emit('current-scene-ready', this);
    }

    update() {
        if (!this.worldId) return;

        // Step physics simulation only when not paused
        if (!this.isPaused) {
            const dt = this.game.loop.delta / 1000;
            WorldStep({ worldId: this.worldId, deltaTime: dt });
        }

        // Sync visual ball with physics body
        if (this.ballBody && this.ball) {
            BodyToSprite(this.ballBody, this.ball);
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
        if (!this.ballBody) return;

        // Reset the physical body back to the spawn location with zero velocity
        b2Body_SetTransform(
            this.ballBody.bodyId,
            pxmVec2(WORLD_CONFIG.BALL_START_X, -WORLD_CONFIG.BALL_START_Y),
            undefined
        );

        b2Body_SetLinearVelocity(this.ballBody.bodyId, new b2Vec2(0, 0));

        // Visually sync immediately
        BodyToSprite(this.ballBody, this.ball);

        // Keep simulation paused after reset until explicitly started
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