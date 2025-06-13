import { Scene } from 'phaser';
import { EventBus } from '../EventBus';

// 👉 NEW IMPORTS: Bring in the Box2D helper functions that ship with the repo.
// @ts-ignore – The helper library is plain JS. TS will still compile because allowJs=true.
import {
    CreateWorld,
    WorldStep,
    CreateCircle,
    CreateBoxPolygon,
    pxm,
    pxmVec2,
    BodyToSprite,
    SetWorldScale,
    b2BodyType,
    b2Vec2,
    b2DefaultWorldDef,
    b2Body_SetTransform,
    b2Body_SetLinearVelocity
} from '../../lib/PhaserBox2D.js';

// Simple physics constants
const PHYSICS_CONFIG = {
    BALL_RADIUS: 20,
    BALL_COLOR: 0xff0000,
    GROUND_COLOR: 0xffffff,
    BOUNCE: 0.9
} as const;

// World constants
const WORLD_CONFIG = {
    WIDTH: 1024,
    HEIGHT: 768,
    BALL_START_X: 512,
    BALL_START_Y: 100,
    GROUND_HEIGHT: 40
} as const;

export class PhysicsSimulation extends Scene {
    private ball!: Phaser.GameObjects.Graphics;
    private ground!: Phaser.GameObjects.Graphics;
    // Box2D body wrapper objects returned from CreateCircle / CreateBoxPolygon
    private ballBody: any;
    private groundBody: any;

    // Box2D world identifier
    private worldId: any;

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
        // 2) Render ground (purely visual)
        // --------------------------------------------------
        this.ground = this.add.graphics();
        this.ground.fillStyle(PHYSICS_CONFIG.GROUND_COLOR);
        this.ground.fillRect(
            0,
            WORLD_CONFIG.HEIGHT - WORLD_CONFIG.GROUND_HEIGHT,
            WORLD_CONFIG.WIDTH,
            WORLD_CONFIG.GROUND_HEIGHT
        );

        // Physics ground body (static box)
        this.groundBody = CreateBoxPolygon({
            worldId: this.worldId,
            type: b2BodyType.b2_staticBody,
            position: pxmVec2(
                WORLD_CONFIG.WIDTH / 2,
                -(WORLD_CONFIG.HEIGHT - WORLD_CONFIG.GROUND_HEIGHT / 2)
            ),
            size: pxmVec2(WORLD_CONFIG.WIDTH / 2, WORLD_CONFIG.GROUND_HEIGHT / 2)
        });

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
            restitution: PHYSICS_CONFIG.BOUNCE
        });

        // Start the simulation immediately
        this.startSimulation();

        // Notify that scene is ready
        EventBus.emit('current-scene-ready', this);
    }

    update() {
        if (!this.worldId) return;

        // Step physics simulation (convert delta from ms to s)
        const dt = this.game.loop.delta / 1000;
        WorldStep({ worldId: this.worldId, deltaTime: dt });

        // Sync visual ball with physics body
        if (this.ballBody && this.ball) {
            BodyToSprite(this.ballBody, this.ball);
        }
    }

    public startSimulation() {
        // Nothing special to do – gravity already active
        console.log('Ball falling simulation started');
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

        console.log('Simulation reset');
    }
}