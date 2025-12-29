import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CameraView } from './components/CameraView';
import { Timeline } from './components/Timeline';
import { EventLog } from './components/EventLog';
import { handTracker } from './services/handTracker';
import { MotionAnalyzer } from './services/motionAnalyzer';
import { HandData, Handedness, MotionEvent } from './types';
import { Activity, Play, RotateCcw, Download, Settings } from 'lucide-react';

const TRACKER_CONFIG = {
  threshold: 0.8,      // Sensitivity
  smoothingFrames: 5,  // Jitter reduction
  minDurationFrames: 5 // Noise filter
};

export default function App() {
  const [isTracking, setIsTracking] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(true);
  
  // State for Visualization
  const [leftHand, setLeftHand] = useState<HandData | null>(null);
  const [rightHand, setRightHand] = useState<HandData | null>(null);
  const [events, setEvents] = useState<MotionEvent[]>([]);
  const [timelineData, setTimelineData] = useState<{time: number, leftV: number, rightV: number}[]>([]);
  
  // Logic Engine
  const analyzerRef = useRef(new MotionAnalyzer(TRACKER_CONFIG));

  useEffect(() => {
    handTracker.initialize().then(() => setIsModelLoading(false));
  }, []);

  const handleFrame = useCallback((video: HTMLVideoElement, timestamp: number) => {
    // 1. Detect
    const result = handTracker.detect(video, timestamp);
    
    // 2. Map MediaPipe result to L/R
    // MediaPipe HandLandmarker results.handedness is array of categories.
    // result.landmarks is array of landmark lists.
    let leftLM = null;
    let rightLM = null;

    if (result && result.handedness.length > 0) {
      result.handedness.forEach((h, index) => {
        const label = h[0].categoryName; // "Left" or "Right"
        // Note: MediaPipe assumes mirrored input for "Left" vs "Right" labels sometimes.
        // Usually, if using selfie camera:
        // "Left" label -> Is actually the user's Right hand visually if mirrored?
        // Let's stick to the label provided, but be aware of mirroring in UI.
        const landmarks = result.landmarks[index];
        
        if (label === 'Left') leftLM = landmarks;
        if (label === 'Right') rightLM = landmarks;
      });
    }

    // 3. Analyze Motion
    const analysis = analyzerRef.current.processFrame(performance.now(), leftLM, rightLM);

    // 4. Update State
    setLeftHand(analysis.leftMetrics);
    setRightHand(analysis.rightMetrics);
    
    if (analysis.events.length > 0) {
      setEvents(prev => [...prev, ...analysis.events]);
    }

    // 5. Update Graph Data (Throttled slightly could be good, but per-frame is smooth)
    setTimelineData(prev => {
      const newData = [
        ...prev, 
        {
          // Actually, let's use the session relative time
          // But performance.now() is monotonic.
          // Let's just push raw timestamps and format in chart.
          time: performance.now(),
          leftV: analysis.leftMetrics?.velocity || 0,
          rightV: analysis.rightMetrics?.velocity || 0
        }
      ];
      // Keep only last 300 frames to prevent memory leak in long sessions
      return newData.slice(-300);
    });

  }, []);

  const toggleTracking = () => {
    if (!isTracking) {
      analyzerRef.current.resetSession();
      setEvents([]);
      setTimelineData([]);
    }
    setIsTracking(!isTracking);
  };

  const handleReset = () => {
    setIsTracking(false);
    analyzerRef.current.resetSession();
    setEvents([]);
    setTimelineData([]);
    setLeftHand(null);
    setRightHand(null);
  };

  const exportData = () => {
    const dataStr = JSON.stringify(events, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `motion-session-${new Date().toISOString()}.json`;
    link.click();
  };

  return (
    <div className="min-h-screen bg-industrial-900 text-industrial-100 flex flex-col font-sans">
      {/* Header */}
      <header className="h-16 border-b border-industrial-700 bg-industrial-800 flex items-center px-6 justify-between shadow-md z-10">
        <div className="flex items-center gap-3">
          <Activity className="text-accent-cyan" />
          <h1 className="text-xl font-bold tracking-tight">Motion<span className="text-industrial-400">Tracker</span> Pro</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-xs text-industrial-400 font-mono">
            ENGINEERING MODE
          </div>
          <button className="p-2 hover:bg-industrial-700 rounded text-industrial-400">
            <Settings size={20} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        
        {/* Left Col: Camera & Graph */}
        <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto">
          
          {/* Camera Container */}
          <div className="w-full aspect-video bg-black rounded-lg relative flex items-center justify-center border border-industrial-700 shadow-inner">
            {isModelLoading ? (
              <div className="text-accent-cyan animate-pulse font-mono">INITIALIZING AI MODELS...</div>
            ) : (
              <CameraView 
                width={640}
                height={360}
                isActive={isTracking}
                onFrame={handleFrame}
                leftHandMetrics={leftHand}
                rightHandMetrics={rightHand}
              />
            )}
            
            {!isTracking && !isModelLoading && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm">
                <button 
                  onClick={toggleTracking}
                  className="bg-accent-cyan hover:bg-cyan-500 text-black font-bold py-3 px-8 rounded-full flex items-center gap-2 transition-all transform hover:scale-105 shadow-[0_0_20px_rgba(6,182,212,0.3)]"
                >
                  <Play fill="currentColor" />
                  START SESSION
                </button>
              </div>
            )}
          </div>

          {/* Timeline Graph */}
          <Timeline data={timelineData} events={events} />
        </div>

        {/* Right Col: Controls & Log */}
        <div className="w-full lg:w-96 bg-industrial-900 border-l border-industrial-700 flex flex-col">
          
          {/* Action Panel */}
          <div className="p-6 border-b border-industrial-700 grid grid-cols-2 gap-3">
             <button 
               onClick={toggleTracking}
               disabled={isModelLoading}
               className={`col-span-2 py-3 rounded font-bold text-sm tracking-wide transition-colors flex justify-center items-center gap-2
                 ${isTracking 
                   ? 'bg-accent-rose text-white hover:bg-rose-600' 
                   : 'bg-accent-cyan text-black hover:bg-cyan-400'
                 } disabled:opacity-50 disabled:cursor-not-allowed`}
             >
               {isTracking ? 'STOP TRACKING' : 'RESUME TRACKING'}
             </button>
             
             <button 
               onClick={handleReset}
               className="py-2 bg-industrial-700 hover:bg-industrial-600 text-white rounded text-xs font-mono flex justify-center items-center gap-2"
             >
               <RotateCcw size={14} /> RESET
             </button>
             
             <button 
               onClick={exportData}
               disabled={events.length === 0}
               className="py-2 bg-industrial-700 hover:bg-industrial-600 text-white rounded text-xs font-mono flex justify-center items-center gap-2 disabled:opacity-50"
             >
               <Download size={14} /> EXPORT CSV
             </button>
          </div>

          {/* Metrics Summary */}
          <div className="p-6 border-b border-industrial-700">
             <h3 className="text-industrial-500 text-xs font-bold mb-4 uppercase">Session Metrics</h3>
             <div className="grid grid-cols-2 gap-4">
               <div className="bg-industrial-800 p-3 rounded border border-industrial-700">
                 <div className="text-xs text-industrial-400 mb-1">Last Motion</div>
                 <div className="text-xl font-mono text-white">
                   {events.length > 0 ? (events[events.length-1].hand) : '--'}
                 </div>
               </div>
               <div className="bg-industrial-800 p-3 rounded border border-industrial-700">
                 <div className="text-xs text-industrial-400 mb-1">Total Moves</div>
                 <div className="text-xl font-mono text-white">{events.filter(e => e.type === 'START').length}</div>
               </div>
             </div>
          </div>

          {/* Event Log */}
          <div className="flex-1 p-4 overflow-hidden">
             <EventLog events={events} />
          </div>

        </div>
      </main>
    </div>
  );
}