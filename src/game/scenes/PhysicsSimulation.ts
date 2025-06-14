import { Scene } from 'phaser';
import { EventBus } from '../EventBus';

// 👉 NEW IMPORTS: Bring in the Box2D helper functions that ship with the repo.
// @ts-ignore – The helper library is plain JS. TS will still compile because allowJs=true.
import {
    CreateWorld,
    WorldStep,
    CreateCircle,
    CreateCapsule,
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
    b2Rot_GetAngle,
    b2Body_SetUserData,
    b2Shape_EnableSensorEvents,
    b2World_GetSensorEvents,
    b2Shape_GetBody,
    b2CreatePolygonShape,
    b2MakeOffsetBox,
    b2DefaultShapeDef,
    b2Body_GetUserData,
    b2World_GetContactEvents,
    b2Body_GetPosition,
    b2Body_ApplyLinearImpulse,
    b2Body_GetLinearVelocity
} from '../../lib/PhaserBox2D-Debug.js';

// Simple physics constants
const PHYSICS_CONFIG = {
    BALL_RADIUS: 10,
    BALL_COLOR: 0xff0000,
    BALL_RESTITUTION: 1.0,
    BALL_FRICTION: 0.1,
    BALL_INITIAL_VELOCITY_Y: -10, // A negative value for downward velocity in Box2D

    CIRCLE_WALL_COLOR: 0xffffff,
    WALL_RESTITUTION: 1.0,
    WALL_FRICTION: 0.0,
    WALL_THICKNESS: 15,
    CIRCLE_WALL_ROTATION_SPEED: -1.0, // radians per second (negative = clockwise)
    BUMP_AMPLITUDE: 3 // pixels
} as const;

// World constants
const WORLD_CONFIG = {
    WIDTH: 1024,
    HEIGHT: 768,
    CIRCLE_WALL_RADIUS: 250,
    CIRCLE_WALL_SEGMENTS: 128,

    CIRCLE_WALL_HOLE_SIZE_DEGREES: 7,
    CIRCLE_WALL_HOLE_POSITION_DEGREES: 90, // Top of the circle (0=right, 90=top, 180=left, 270=bottom)

    BALL_START_X: 512,
    BALL_START_Y: 768 * (0.1), // 75% down the screen
    GRAVITY_Y: -20 // Box2D gravity (negative for downward in Phaser coords)
} as const;

// Fine-tuning for the physics solver. Increasing the number of sub-steps helps
// prevent small/fast bodies from tunnelling through thin geometry.
const WORLD_STEP_CONFIG = {
    FIXED_TIME_STEP: 1 / 60, // seconds
    SUB_STEPS: 8            // default was 4 – doubling gives better CCD
} as const;

const KILL_BOUNDARY_CONFIG = {
    BUFFER: 100 // pixels
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

    // Hole sensor tracking
    private holeSensorShapeId: any;
    private triggeredBallBodies: Set<any> = new Set();

    constructor() {
        super('PhysicsSimulation');
    }

    create() {
        this.initPhysicsWorld();
        this.setupDebugCanvas();
        this.createCircleWall();
        this.createKillBoundaries();
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
        // --- 1. HOLE GEOMETRY CALCULATION ---
        // Convert hole properties from degrees to radians for calculations
        const holePositionRad = (WORLD_CONFIG.CIRCLE_WALL_HOLE_POSITION_DEGREES * Math.PI) / 180;
        const holeSizeRad = (WORLD_CONFIG.CIRCLE_WALL_HOLE_SIZE_DEGREES * Math.PI) / 180;

        // The hole starts and ends on either side of its center position
        const holeStartRad = holePositionRad - holeSizeRad / 2;
        const holeEndRad = holePositionRad + holeSizeRad / 2;

        // --- 2. GENERATE POINTS FOR THE WALL ARC (SKIPPING THE HOLE) ---
        const segments = WORLD_CONFIG.CIRCLE_WALL_SEGMENTS;
        const radius = WORLD_CONFIG.CIRCLE_WALL_RADIUS;

        // For the physics chain we want to align with the INNER edge of the visual wall.
        // The visual line is drawn centred on `radius` with a thickness, so its inner edge
        // is `radius - WALL_THICKNESS / 2`.
        const physicsRadius = radius - PHYSICS_CONFIG.WALL_THICKNESS / 2;
        const outerPhysicsRadius = radius + PHYSICS_CONFIG.WALL_THICKNESS / 2;

        const wallArcRad = 2 * Math.PI - holeSizeRad; // total radians for the wall
        const angleStep = wallArcRad / segments;      // uniform step size

        const visualPoints: Phaser.Math.Vector2[] = [];
        const physicsPoints: any[] = [];
        const outerPhysicsPoints: any[] = [];

        for (let i = 0; i <= segments; i++) {
            const currentAngle = holeEndRad + i * angleStep;

            // Visual point coordinates (smooth circle)
            const x = radius * Math.cos(currentAngle);
            const y = radius * Math.sin(currentAngle);

            // For visual rendering we omit the first and last points – they correspond to the
            // exact edges of the hole and leaving them out avoids small caps being drawn.
            if (i !== 0 && i !== segments) {
                visualPoints.push(new Phaser.Math.Vector2(x, y));
            }

            // --- Apply noise to the radius for the physics body ---
            const noise = (Math.random() * 2 - 1) * PHYSICS_CONFIG.BUMP_AMPLITUDE;
            const innerPhysicsRadius = physicsRadius + noise;

            // Physics point at the inner surface (with noise)
            const px = innerPhysicsRadius * Math.cos(currentAngle);
            const py = innerPhysicsRadius * Math.sin(currentAngle);

            // Physics chain needs the full set, including the two end‐points.
            physicsPoints.push(new b2Vec2(pxm(px), pxm(-py)));

            // Outer physics point at the outer surface (no noise)
            const ox = outerPhysicsRadius * Math.cos(currentAngle);
            const oy = outerPhysicsRadius * Math.sin(currentAngle);
            outerPhysicsPoints.push(new b2Vec2(pxm(ox), pxm(-oy)));
        }

        // --- 3. CREATE VISUAL WALL ---
        this.circleWall = this.add.graphics();
        this.circleWall.lineStyle(PHYSICS_CONFIG.WALL_THICKNESS, PHYSICS_CONFIG.CIRCLE_WALL_COLOR, 1);
        this.circleWall.strokePoints(visualPoints); // Draw the arc using the generated points
        this.circleWall.setPosition(WORLD_CONFIG.WIDTH / 2, WORLD_CONFIG.HEIGHT / 2);

        // --- 4. CREATE PHYSICS BODY ---
        const bodyDef = b2DefaultBodyDef();
        bodyDef.type = b2BodyType.b2_kinematicBody;
        // Remember Box2D's Y-axis is inverted from Phaser's, so we negate the y-position
        bodyDef.position = pxmVec2(WORLD_CONFIG.WIDTH / 2, -WORLD_CONFIG.HEIGHT / 2);
        const bodyId = b2CreateBody(this.worldId, bodyDef);
        this.circleWallBodyId = bodyId;

        // Tag the wall's body so we can identify it in collisions
        b2Body_SetUserData(bodyId, { type: 'circle-wall' });

        const chainDef = b2DefaultChainDef();
        // No reversal needed because after Y inversion the points are already clockwise, giving inward-facing normals
        chainDef.points = physicsPoints;
        chainDef.count = physicsPoints.length;
        chainDef.isLoop = false; // This is now an open chain, not a closed loop
        chainDef.friction = PHYSICS_CONFIG.WALL_FRICTION;
        chainDef.restitution = PHYSICS_CONFIG.WALL_RESTITUTION;

        this.circleWallBody = b2CreateChain(bodyId, chainDef);

        const outerChainDef = b2DefaultChainDef();
        // The outer wall needs to be wound in the opposite direction (CCW) for its
        // normals to point outwards and contain the balls.
        outerChainDef.points = outerPhysicsPoints.reverse();
        outerChainDef.count = outerPhysicsPoints.length;
        outerChainDef.isLoop = false;
        outerChainDef.friction = PHYSICS_CONFIG.WALL_FRICTION;
        outerChainDef.restitution = PHYSICS_CONFIG.WALL_RESTITUTION;
        b2CreateChain(bodyId, outerChainDef);

        // --- 5. SET ROTATION ---
        // Set angular velocity for clockwise rotation, same as before
        b2Body_SetAngularVelocity(bodyId, PHYSICS_CONFIG.CIRCLE_WALL_ROTATION_SPEED);

        // --- 6. ADD CAPSULES AT HOLE CORNERS ---
        const thickness = PHYSICS_CONFIG.WALL_THICKNESS;
        const capRadius = thickness / 3;

        // Helper to build a capsule that extends the visual stroke tangentially
        const makeEdgeCapsule = (edge: Phaser.Math.Vector2, tangent: Phaser.Math.Vector2) => {
            const halfLen = thickness / 2;
            const tDir = tangent.clone().normalize();

            const p1 = edge.clone().subtract(tDir.clone().scale(halfLen));
            const p2 = edge.clone().add(tDir.clone().scale(halfLen));

            CreateCapsule({
                worldId: this.worldId,
                bodyId: bodyId, // attach to rotating wall
                center1: new b2Vec2(pxm(p1.x), pxm(-p1.y)),
                center2: new b2Vec2(pxm(p2.x), pxm(-p2.y)),
                radius: pxm(capRadius),
                friction: PHYSICS_CONFIG.WALL_FRICTION,
                restitution: PHYSICS_CONFIG.WALL_RESTITUTION
            });
        };

        // Build tangent capsules using the visual arc points
        if (visualPoints.length >= 2) {
            // Left hole edge (array start)
            const leftEdge = visualPoints[1];
            const leftNext = visualPoints[2];
            makeEdgeCapsule(leftEdge, leftNext.clone().subtract(leftEdge));

            // Right hole edge (array end)
            const rightEdge = visualPoints[visualPoints.length - 2];
            const rightPrev = visualPoints[visualPoints.length - 3];
            makeEdgeCapsule(rightEdge, rightPrev.clone().subtract(rightEdge));
        }

        // --- 7. ADD SENSOR BOX ACROSS HOLE (OUTER EDGE) ---
        const outerRadius = radius + thickness / 2;
        const p1x = outerRadius * Math.cos(holeStartRad);
        const p1y = outerRadius * Math.sin(holeStartRad);
        const p2x = outerRadius * Math.cos(holeEndRad);
        const p2y = outerRadius * Math.sin(holeEndRad);

        const centerX = (p1x + p2x) / 2;
        const centerY = (p1y + p2y) / 2;

        const dx = p2x - p1x;
        const dy = p2y - p1y;

        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);

        const sensorBox = b2MakeOffsetBox(
            pxm(length), // half-width
            pxm(0.1 / 2),    // half-height
            new b2Vec2(pxm(centerX), pxm(-centerY)), // center position, relative to body
            angle
        );

        const shapeDef = b2DefaultShapeDef();
        shapeDef.isSensor = true;
        shapeDef.customColor = 0x808080; // Gray

        const sensorShapeId = b2CreatePolygonShape(bodyId, shapeDef, sensorBox);

        this.holeSensorShapeId = sensorShapeId;
        b2Shape_EnableSensorEvents(this.holeSensorShapeId, true);
    }

    private createKillBoundaries() {
        const { WIDTH, HEIGHT } = WORLD_CONFIG;
        const { BUFFER } = KILL_BOUNDARY_CONFIG;

        const halfW = pxm(WIDTH / 2);
        const halfH = pxm(HEIGHT / 2);
        const halfBuff = pxm(BUFFER / 2);

        // A single static body will hold all four sensor shapes
        const boundaryBodyDef = b2DefaultBodyDef();
        const boundaryBodyId = b2CreateBody(this.worldId, boundaryBodyDef);

        const shapeDef = b2DefaultShapeDef();
        shapeDef.isSensor = true;
        b2Body_SetUserData(boundaryBodyId, { type: 'kill-boundary' });

        // Helper to create and attach a sensor box
        const createSensor = (
            width: number,
            height: number,
            center: { x: number; y: number }
        ) => {
            const sensorBox = b2MakeOffsetBox(
                width,
                height,
                new b2Vec2(center.x, center.y),
                0
            );
            const shapeId = b2CreatePolygonShape(boundaryBodyId, shapeDef, sensorBox);
            b2Shape_EnableSensorEvents(shapeId, true);
        };

        // Top boundary sensor
        createSensor(halfW + halfBuff, halfBuff, { x: halfW, y: halfBuff });
        // Bottom boundary sensor
        createSensor(halfW + halfBuff, halfBuff, { x: halfW, y: -halfH * 2 - halfBuff });
        // Left boundary sensor
        createSensor(halfBuff, halfH + halfBuff, { x: -halfBuff, y: -halfH });
        // Right boundary sensor
        createSensor(halfBuff, halfH + halfBuff, { x: halfW * 2 + halfBuff, y: -halfH });
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
        b2Body_SetLinearVelocity(
            body.bodyId,
            new b2Vec2(0, PHYSICS_CONFIG.BALL_INITIAL_VELOCITY_Y)
        );

        // Tag body so we can recognise it later
        b2Body_SetUserData(body.bodyId, { type: 'ball' });

        // Store
        this.balls.push(ballGraphic);
        this.ballBodies.push(body);
    }

    update() {
        if (!this.worldId) return;

        // Step physics simulation only when not paused
        if (!this.isPaused) {
            const dt = this.game.loop.delta / 1000;
            WorldStep({
                worldId: this.worldId,
                deltaTime: dt,
                fixedTimeStep: WORLD_STEP_CONFIG.FIXED_TIME_STEP,
                subStepCount: WORLD_STEP_CONFIG.SUB_STEPS
            });
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
            // Phaser's positive rotation is clockwise, whereas Box2D's positive rotation is counter-clockwise.
            // Negate the angle so the visual matches the physics body's orientation.
            this.circleWall.setRotation(-angle);
        }

        // --- Sensor processing: detect balls exiting hole ---
        const sensorEvents = b2World_GetSensorEvents(this.worldId);
        if (sensorEvents && sensorEvents.beginCount) {
            for (let i = 0; i < sensorEvents.beginCount; i++) {
                const ev = sensorEvents.beginEvents[i];

                // The sensor is always the hole segment we created
                if (
                    this.holeSensorShapeId &&
                    ev.sensorShapeId.index1 === this.holeSensorShapeId.index1
                ) {
                    const visitorBodyId = b2Shape_GetBody(ev.visitorShapeId);
                    const visitorUserData = b2Body_GetUserData(visitorBodyId);

                    if (
                        visitorUserData?.type === 'ball' &&
                        !this.triggeredBallBodies.has(visitorBodyId.index1)
                    ) {
                        this.triggeredBallBodies.add(visitorBodyId.index1);
                        // Spawn two new balls when first exiting
                        this.spawnBall();
                        this.spawnBall();
                    }
                }
            }
        }

        const bodiesToDestroy = new Set<number>();

        // Process sensor end events for kill boundaries
        if (sensorEvents && sensorEvents.endCount) {
            for (let i = 0; i < sensorEvents.endCount; i++) {
                const ev = sensorEvents.endEvents[i];
                const sensorBody = b2Shape_GetBody(ev.sensorShapeId);
                const visitorBody = b2Shape_GetBody(ev.visitorShapeId);
                const sensorData = b2Body_GetUserData(sensorBody);
                const visitorData = b2Body_GetUserData(visitorBody);

                // Check if a ball has left a kill boundary
                if (sensorData?.type === 'kill-boundary' && visitorData?.type === 'ball') {
                    bodiesToDestroy.add(visitorBody.index1);
                } else if (
                    visitorData?.type === 'kill-boundary' &&
                    sensorData?.type === 'ball'
                ) {
                    bodiesToDestroy.add(sensorBody.index1);
                }
            }
        }

        // Safely destroy bodies after the simulation step
        if (bodiesToDestroy.size > 0) {
            this.ballBodies = this.ballBodies.filter((body, i) => {
                if (bodiesToDestroy.has(body.bodyId.index1)) {
                    b2DestroyBody(body.bodyId);
                    this.balls[i].destroy();
                    this.triggeredBallBodies.delete(body.bodyId.index1);
                    return false; // Remove from arrays
                }
                return true;
            });
            this.balls = this.balls.filter((g) => g.active);
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