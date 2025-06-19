export interface BallConfig {
  radius: number;
  restitution: number;
  friction: number;
  color: number;
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
  sensorOffset: number;
  /** Radial thickness (in meters) of the sensor ring */
  sensorThickness: number;
}

export interface GroundConfig {
  width: number;
  thickness: number;
  restitution: number;
  color: number;
  bottomOffset: number;
}

export interface BallSpawnConfig {
  position: { x: number; y: number };
  velocity: { magnitude: number; angle: number } | { x: number; y: number };
  angleRange?: { min: number; max: number }; // For random direction
}

export interface KillBoundaryConfig {
  thickness: number;
  offset: number; // Distance beyond screen edges (in physics units)
  debugVisible: boolean;
  debugColor: number;
  debugAlpha: number;
}