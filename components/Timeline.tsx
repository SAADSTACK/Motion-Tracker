import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { MotionEvent } from '../types';

interface TimelineProps {
  data: { time: number; leftV: number; rightV: number }[];
  events: MotionEvent[];
}

export const Timeline: React.FC<TimelineProps> = ({ data, events }) => {
  // We only keep last 100 frames for performance in the graph usually, or full session
  const displayData = data.slice(-200); 

  return (
    <div className="h-64 w-full bg-industrial-800 rounded-lg border border-industrial-700 p-4">
      <h3 className="text-industrial-300 text-xs font-mono mb-2 uppercase tracking-wider">Velocity Timeline</h3>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={displayData}>
          <defs>
            <linearGradient id="colorLeft" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorRight" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <XAxis 
            dataKey="time" 
            type="number" 
            domain={['dataMin', 'dataMax']} 
            tickFormatter={(t) => (t/1000).toFixed(1) + 's'}
            stroke="#475569"
            tick={{fill: '#64748b', fontSize: 10}}
          />
          <YAxis hide domain={[0, 10]} /> {/* Assuming max velocity around 10 */}
          <Tooltip 
            contentStyle={{backgroundColor: '#1e293b', border: '1px solid #334155'}}
            itemStyle={{fontSize: '12px'}}
            labelFormatter={(t) => (t/1000).toFixed(2) + 's'}
          />
          <Area 
            type="monotone" 
            dataKey="leftV" 
            stroke="#f59e0b" 
            fillOpacity={1} 
            fill="url(#colorLeft)" 
            name="Left Velocity"
            isAnimationActive={false}
          />
          <Area 
            type="monotone" 
            dataKey="rightV" 
            stroke="#06b6d4" 
            fillOpacity={1} 
            fill="url(#colorRight)" 
            name="Right Velocity"
            isAnimationActive={false}
          />
          {events.map(evt => (
             evt.type === 'START' && (
              <ReferenceLine 
                key={evt.id} 
                x={evt.timestamp} 
                stroke={evt.hand === 'Left' ? '#f59e0b' : '#06b6d4'} 
                strokeDasharray="3 3"
                label={{ 
                  value: `${evt.orderIndex}`, 
                  position: 'insideTop', 
                  fill: 'white', 
                  fontSize: 10 
                }}
              />
             )
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};