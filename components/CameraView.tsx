import React, { useEffect, useRef, useState } from 'react';
import { HandData } from '../types';

interface CameraViewProps {
  onFrame: (video: HTMLVideoElement, timestamp: number) => void;
  width: number;
  height: number;
  isActive: boolean;
  leftHandMetrics: HandData | null;
  rightHandMetrics: HandData | null;
}

export const CameraView: React.FC<CameraViewProps> = ({ 
  onFrame, 
  width, 
  height, 
  isActive,
  leftHandMetrics,
  rightHandMetrics
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();
  
  // Setup Camera
  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: width },
            height: { ideal: height },
            facingMode: 'user'
          }
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            requestRef.current = requestAnimationFrame(loop);
          };
        }
      } catch (err) {
        console.error("Camera access denied:", err);
      }
    };

    if (isActive) {
      startCamera();
    } else {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(t => t.stop());
      }
    }

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isActive, width, height]);

  // Main Loop
  const loop = (time: number) => {
    if (videoRef.current && canvasRef.current && isActive) {
      onFrame(videoRef.current, time);
      
      // We draw custom overlays here instead of passing canvas ref up
      // This keeps rendering logic collocated with visual layer
      drawOverlays();
    }
    requestRef.current = requestAnimationFrame(loop);
  };

  const drawOverlays = () => {
    const ctx = canvasRef.current?.getContext('2d');
    const video = videoRef.current;
    
    if (!ctx || !video) return;

    // Clear and draw video frame
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    // Mirror the video context
    ctx.scale(-1, 1);
    ctx.translate(-width, 0);
    ctx.drawImage(video, 0, 0, width, height);
    ctx.restore();

    // Draw HUD elements using the metrics passed down
    // Since we mirrored the video context above for the image, we must be careful with coordinates.
    // However, MediaPipe returns normalized coordinates (0-1).
    // The visualizer usually expects 0,0 top-left.
    // Because we mirrored the video draw, we should probably mirror the drawing coords too.
    
    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-width, 0);

    drawHandOverlay(ctx, leftHandMetrics);
    drawHandOverlay(ctx, rightHandMetrics);
    
    ctx.restore();
  };

  const drawHandOverlay = (ctx: CanvasRenderingContext2D, hand: HandData | null) => {
    if (!hand) return;
    
    const color = hand.isMoving ? '#10b981' : '#64748b'; // Green if moving, Slate if idle
    
    // Draw skeleton
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    
    // Simple connections for visualization speed (Wrist to fingers)
    const palmBase = hand.landmarks[0];
    
    // Draw joints
    hand.landmarks.forEach(pt => {
      ctx.beginPath();
      ctx.arc(pt.x * width, pt.y * height, 3, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
    });

    // Draw Velocity Vector from wrist
    // Velocity is scalar, but we can infer direction from last pos if we tracked it here.
    // For now, just a circle around wrist indicating "Energy"
    if (hand.velocity > 0.1) {
      ctx.beginPath();
      ctx.arc(palmBase.x * width, palmBase.y * height, hand.velocity * 50, 0, 2 * Math.PI);
      ctx.strokeStyle = `rgba(16, 185, 129, ${Math.min(hand.velocity, 1)})`;
      ctx.stroke();
    }
  };

  return (
    <div className="relative rounded-lg overflow-hidden border border-industrial-700 bg-industrial-900 shadow-2xl">
      <video
        ref={videoRef}
        className="hidden" // Hidden, we draw to canvas
        playsInline
        muted
      />
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="block w-full h-auto bg-black"
      />
      
      {/* Overlay UI for status - absolute positioned on top of canvas */}
      <div className="absolute top-4 left-4 flex flex-col gap-2">
         <div className={`px-3 py-1 rounded text-xs font-mono font-bold flex items-center gap-2 ${leftHandMetrics?.isMoving ? 'bg-emerald-500/90 text-white' : 'bg-black/50 text-gray-400'}`}>
            <span className="w-2 h-2 rounded-full bg-current"></span>
            LEFT HAND: {leftHandMetrics?.isMoving ? 'MOVING' : 'IDLE'}
            <span className="ml-2 opacity-75">{leftHandMetrics?.velocity.toFixed(3)} v</span>
         </div>
         <div className={`px-3 py-1 rounded text-xs font-mono font-bold flex items-center gap-2 ${rightHandMetrics?.isMoving ? 'bg-emerald-500/90 text-white' : 'bg-black/50 text-gray-400'}`}>
            <span className="w-2 h-2 rounded-full bg-current"></span>
            RIGHT HAND: {rightHandMetrics?.isMoving ? 'MOVING' : 'IDLE'}
            <span className="ml-2 opacity-75">{rightHandMetrics?.velocity.toFixed(3)} v</span>
         </div>
      </div>
    </div>
  );
};