# Ball Satisfaction

# Local dev
``bash
ipconfig getifaddr en0  # get ip
http://{ip}:3000 on mobile
```

A deterministic 2D physics demo built with Next.js (Pages Router), PixiJS 8, and @dimforge/rapier2d-deterministic.

## Features

- **Deterministic Physics**: Uses Rapier's deterministic build for cross-platform bit-perfect results
- **Fixed Timestep**: 60 Hz accumulator loop ensures consistent simulation
- **Physics-to-Pixel Scaling**: 1 meter = 50 pixels for proper physics visualization
- **Debug Tools**:
  - dat.gui controls for gravity and physics parameters
  - pixi-stats for FPS monitoring
  - Rapier's built-in line debug renderer
- **Modular Architecture**: Clean separation between physics engine and React components

## Tech Stack

- **Framework**: Next.js 15 with Pages Router
- **Renderer**: PixiJS 8 (full-viewport canvas)
- **Physics**: @dimforge/rapier2d-deterministic 0.17.3
- **Debug UI**: dat.gui 0.7
- **Performance**: pixi-stats for FPS/Draw Calls monitoring
- **Language**: TypeScript (strict mode)

## Getting Started

### Prerequisites

- Node.js v20.0 or higher
- npm or yarn

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the physics demo.

### Building for Production

```bash
npm run build
npm start
```

## Project Structure

```
ball-satisfaction/
├── engine/                 # Physics and rendering engine
│   ├── scale.ts           # Meters-to-pixels conversion
│   ├── Game.ts            # Main game orchestrator
│   ├── prefabs/           # Game objects
│   │   ├── Prefab.ts      # Base class for physics objects
│   │   ├── Ball.ts        # Bouncing ball implementation
│   │   └── Ground.ts      # Static ground plane
│   └── debug/
│       ├── DebugUI.ts     # dat.gui controls
│       └── DebugRenderer.ts # Rapier debug visualization
├── components/
│   └── GameCanvas.tsx     # React canvas host
├── pages/
│   └── index.tsx          # Main page (SSR disabled)
└── next.config.js         # Webpack WASM configuration
```

## Key Implementation Details

### Physics Scaling
- All physics calculations use SI units (meters, kg, seconds)
- Graphics are scaled by 50 pixels per meter
- Gravity is set to 9.81 m/s² (realistic Earth gravity)

### Fixed Timestep
- Physics runs at exactly 60 Hz using an accumulator pattern
- Rendering is decoupled from physics simulation
- Ensures deterministic behavior across different devices

### Prefab System
- All game objects inherit from `Prefab` base class
- Couples Rapier physics bodies with Pixi graphics
- Automatic position/rotation synchronization

## Controls

- **Gravity Slider**: Adjust gravity from -20 to +20 m/s²
- **Show Colliders**: Toggle Rapier's debug wireframe renderer
- **Ball Position**: Real-time display in both pixels and meters
- **FPS Counter**: Performance monitoring overlay

## Deployment

This project is configured for easy deployment on Vercel:

```bash
npm run build
```

The build output is optimized for static hosting and includes proper WASM loading.