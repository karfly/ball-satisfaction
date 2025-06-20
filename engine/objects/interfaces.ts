export interface BallConfig {
  radius: number;
  restitution: number;
  friction: number;
  color: number;
  trail: BallTrailConfig;
  /** Glow effect configuration */
  glow: {
    enabled: boolean;
    distance: number;
    outerStrength: number;
    color?: number; // Optional - defaults to ball color if not specified
    quality: number;
  };
}

export interface RingConfig {
  radius: number;
  thickness: number;
  gapAngle: number;
  gapCenterAngle: number; // Angle in radians where gap center should be positioned
  segments: number;
  spinSpeed: number;
  restitution: number;
  friction: number;
  color: number;
  escapeSensorOffset: number;
  /** Radial thickness (in meters) of the escape sensor ring */
  escapeSensorThickness: number;
  /** Radius of the rounded corners at gap edges. If not specified, defaults to thickness/4 */
  cornerRadius?: number;
  /** Glow effect configuration */
  glow: {
    enabled: boolean;
    distance: number;
    outerStrength: number;
    color: number;
    quality: number;
  };
  /** Particle effect configuration for ring collisions */
  particles: {
    enabled: boolean;
    color?: number; // Optional - if set, use this color; if not set, use ball color
    dustIntensity?: number; // Dust particle count multiplier (0.5-2.0)
  };
}

export interface BallSpawnConfig {
  position: { x: number; y: number };
  velocity: { magnitude: number; angle: number } | { x: number; y: number };
  angleRange?: { min: number; max: number }; // For random direction
}

export interface KillBoundaryConfig {
  thickness: number;
  offset: number; // Distance beyond screen edges (in physics units)
}

export interface BallTrailConfig {
  enabled: boolean;
  maxLength: number;      // Number of trail segments
  fadeAlpha: number;      // Alpha at trail end (0.0-1.0)
  width: number;          // Trail width multiplier
  color?: number;         // Override ball color (optional)
  updateInterval: number; // Milliseconds between trail updates
}

export interface TrailSegment {
  x: number;
  y: number;
  timestamp: number;
}