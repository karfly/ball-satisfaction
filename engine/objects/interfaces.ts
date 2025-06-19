export interface BallConfig {
  radius: number;
  restitution: number;
  friction: number;
  color: number;
  ccdEnabled: boolean;
}

export interface RingConfig {
  radius: number;
  thickness: number;
  gapAngle: number;
  segments: number;
  spinSpeed: number;
  restitution: number;
  friction: number;
  color: number;
  sensorOffset: number;
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