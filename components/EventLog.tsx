import React, { useRef, useEffect } from 'react';
import { MotionEvent, Handedness } from '../types';
import { Clock, ArrowRight, Play, Square } from 'lucide-react';

interface EventLogProps {
  events: MotionEvent[];
}

export const EventLog: React.FC<EventLogProps> = ({ events }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  return (
    <div className="flex flex-col h-full bg-industrial-800 rounded-lg border border-industrial-700 overflow-hidden">
      <div className="p-3 bg-industrial-900 border-b border-industrial-700 flex justify-between items-center">
        <h3 className="text-industrial-300 text-xs font-mono uppercase tracking-wider">Motion Sequence Log</h3>
        <span className="text-xs text-industrial-500 font-mono">{events.length} Events</span>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {events.length === 0 && (
          <div className="text-center text-industrial-600 text-sm mt-10 italic">
            Waiting for motion...
          </div>
        )}
        
        {events.map((evt) => (
          <div 
            key={evt.id} 
            className={`flex items-center justify-between p-2 rounded border-l-2 ${
              evt.hand === Handedness.Left 
                ? 'bg-amber-900/10 border-accent-amber' 
                : 'bg-cyan-900/10 border-accent-cyan'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className={`text-xs font-bold uppercase w-12 ${
                evt.hand === Handedness.Left ? 'text-accent-amber' : 'text-accent-cyan'
              }`}>
                {evt.hand}
              </span>
              
              <div className="flex flex-col">
                <span className="text-sm text-gray-200 font-medium flex items-center gap-1">
                  {evt.type === 'START' ? <Play size={12}/> : <Square size={12}/>}
                  {evt.type === 'START' ? `Motion #${evt.orderIndex}` : 'Stopped'}
                </span>
                {evt.type === 'STOP' && (
                  <span className="text-xs text-industrial-400">
                    Dur: {(evt.duration! / 1000).toFixed(2)}s | Dist: {evt.distance?.toFixed(1)}
                  </span>
                )}
              </div>
            </div>

            <span className="font-mono text-xs text-industrial-500">
              {(evt.timestamp / 1000).toFixed(3)}s
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};