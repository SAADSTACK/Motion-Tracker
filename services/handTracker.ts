import { FilesetResolver, HandLandmarker, DrawingUtils } from "@mediapipe/tasks-vision";

export class HandTrackerService {
  private handLandmarker: HandLandmarker | null = null;
  private isLoaded = false;

  async initialize() {
    if (this.isLoaded) return;

    try {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
      );
      
      this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
          delegate: "GPU"
        },
        runningMode: "VIDEO",
        numHands: 2
      });
      
      this.isLoaded = true;
    } catch (error) {
      console.error("Failed to load MediaPipe HandLandmarker:", error);
      throw error;
    }
  }

  detect(video: HTMLVideoElement, timestamp: number) {
    if (!this.handLandmarker || !this.isLoaded) return null;
    return this.handLandmarker.detectForVideo(video, timestamp);
  }

  draw(canvasCtx: CanvasRenderingContext2D, landmarks: any[]) {
    const drawingUtils = new DrawingUtils(canvasCtx);
    for (const landmark of landmarks) {
      drawingUtils.drawConnectors(landmark, HandLandmarker.HAND_CONNECTIONS, {
        color: "#06b6d4",
        lineWidth: 2
      });
      drawingUtils.drawLandmarks(landmark, {
        color: "#e2e8f0",
        lineWidth: 1,
        radius: 3
      });
    }
  }
}

export const handTracker = new HandTrackerService();