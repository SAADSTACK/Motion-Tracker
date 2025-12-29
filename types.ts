export interface Point {
  x: number;
  y: number;
  z: number;
}

export enum Handedness {
  Left = 'Left',
  Right = 'Right'
}

export interface HandData {
  handedness: Handedness;
  landmarks: Point[];
  velocity: number; // pixels per frame (or normalized units)
  isMoving: boolean;
  score: number;
}

export interface MotionEvent {
  id: string;
  hand: Handedness;
  type: 'START' | 'STOP';
  timestamp: number;
  duration?: number; // For STOP events
  distance?: number; // Total distance traveled
  orderIndex?: number; // 1st, 2nd, etc.
}

export interface MotionSession {
  isActive: boolean;
  startTime: number;
  events: MotionEvent[];
  logs: string[];
}

export interface TrackerConfig {
  threshold: number; // Velocity threshold to trigger movement
  smoothingFrames: number; // Number of frames to average velocity
  minDurationFrames: number; // Minimum frames to count as a move
}