import { HandData, Handedness, MotionEvent, Point, TrackerConfig } from '../types';

// Simple moving average buffer
class VelocityBuffer {
  private buffer: number[] = [];
  private size: number;

  constructor(size: number) {
    this.size = size;
  }

  add(val: number) {
    this.buffer.push(val);
    if (this.buffer.length > this.size) {
      this.buffer.shift();
    }
  }

  get average(): number {
    if (this.buffer.length === 0) return 0;
    const sum = this.buffer.reduce((a, b) => a + b, 0);
    return sum / this.buffer.length;
  }

  reset() {
    this.buffer = [];
  }
}

interface HandState {
  isMoving: boolean;
  motionStartTime: number | null;
  lastPosition: Point | null;
  totalDistance: number;
  velocityBuffer: VelocityBuffer;
  framesBelowThreshold: number; // For debounce
  framesAboveThreshold: number; // For debounce
}

export class MotionAnalyzer {
  private config: TrackerConfig;
  private leftHand: HandState;
  private rightHand: HandState;
  private sessionStartTime: number = 0;
  private eventCounter: number = 0;
  private moveOrderCounter: number = 0;

  constructor(config: TrackerConfig) {
    this.config = config;
    this.leftHand = this.createHandState();
    this.rightHand = this.createHandState();
  }

  private createHandState(): HandState {
    return {
      isMoving: false,
      motionStartTime: null,
      lastPosition: null,
      totalDistance: 0,
      velocityBuffer: new VelocityBuffer(this.config.smoothingFrames),
      framesBelowThreshold: 0,
      framesAboveThreshold: 0
    };
  }

  public resetSession() {
    this.sessionStartTime = performance.now();
    this.eventCounter = 0;
    this.moveOrderCounter = 0;
    this.leftHand = this.createHandState();
    this.rightHand = this.createHandState();
  }

  public processFrame(
    timestamp: number,
    leftLandmarks: Point[] | null,
    rightLandmarks: Point[] | null
  ): { events: MotionEvent[], leftMetrics: HandData | null, rightMetrics: HandData | null } {
    
    const events: MotionEvent[] = [];
    const leftMetrics = this.analyzeHand(timestamp, Handedness.Left, leftLandmarks, this.leftHand, events);
    const rightMetrics = this.analyzeHand(timestamp, Handedness.Right, rightLandmarks, this.rightHand, events);

    return { events, leftMetrics, rightMetrics };
  }

  private analyzeHand(
    timestamp: number,
    handedness: Handedness,
    landmarks: Point[] | null,
    state: HandState,
    events: MotionEvent[]
  ): HandData | null {
    if (!landmarks || landmarks.length === 0) {
      // If hand lost, reset buffer but keep state potentially (or reset? let's hold for now)
      state.velocityBuffer.add(0);
      return null;
    }

    // Use wrist (index 0) and middle finger mcp (index 9) average for stability
    const p1 = landmarks[0];
    const p2 = landmarks[9];
    const currentPos = {
      x: (p1.x + p2.x) / 2,
      y: (p1.y + p2.y) / 2,
      z: (p1.z + p2.z) / 2
    };

    let instantaneousVelocity = 0;

    if (state.lastPosition) {
      // Euclidean distance (ignoring Z for 2D screen motion mostly, but using 3D if available)
      // Note: MediaPipe z is relative to wrist, x/y are normalized 0-1.
      // We focus on x/y for screen plane motion.
      const dx = currentPos.x - state.lastPosition.x;
      const dy = currentPos.y - state.lastPosition.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      // Scale up normalized coords roughly to make numbers readable (e.g. * 100)
      instantaneousVelocity = dist * 100; 
    }

    state.lastPosition = currentPos;
    state.velocityBuffer.add(instantaneousVelocity);
    const smoothedVelocity = state.velocityBuffer.average;

    // Hysteresis Logic
    if (!state.isMoving) {
      if (smoothedVelocity > this.config.threshold) {
        state.framesAboveThreshold++;
        if (state.framesAboveThreshold >= this.config.minDurationFrames) {
          // START MOTION
          state.isMoving = true;
          state.motionStartTime = timestamp;
          state.totalDistance = 0;
          this.moveOrderCounter++;
          
          events.push({
            id: `evt_${this.eventCounter++}`,
            hand: handedness,
            type: 'START',
            timestamp: timestamp - this.sessionStartTime,
            orderIndex: this.moveOrderCounter
          });
        }
      } else {
        state.framesAboveThreshold = 0;
      }
    } else {
      // Accumulate distance while moving
      state.totalDistance += instantaneousVelocity;

      if (smoothedVelocity < this.config.threshold * 0.5) { // Lower threshold to stop (hysteresis)
        state.framesBelowThreshold++;
        if (state.framesBelowThreshold >= this.config.minDurationFrames) {
          // STOP MOTION
          state.isMoving = false;
          const duration = timestamp - (state.motionStartTime || timestamp);
          
          events.push({
            id: `evt_${this.eventCounter++}`,
            hand: handedness,
            type: 'STOP',
            timestamp: timestamp - this.sessionStartTime,
            duration: duration,
            distance: state.totalDistance
          });
          
          state.motionStartTime = null;
        }
      } else {
        state.framesBelowThreshold = 0;
      }
    }

    return {
      handedness,
      landmarks,
      velocity: smoothedVelocity,
      isMoving: state.isMoving,
      score: 1.0
    };
  }
}