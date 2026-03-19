import React from 'react';
import { Pothole } from '../hooks/usePotholes';
import { MapPin, Clock, ChevronRight, AlertCircle } from 'lucide-react';

interface PotholeListProps {
  potholes: Pothole[];
}

export default function PotholeList({ potholes }: PotholeListProps) {
  return (
    <div className="flex flex-col h-full bg-zinc-900/50 backdrop-blur-sm rounded-2xl border border-zinc-800 overflow-hidden">
      <div className="p-4 border-bottom border-zinc-800 flex items-center justify-between bg-zinc-900">
        <h3 className="font-bold text-white flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500" />
          Recent Detections
        </h3>
        <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-1 rounded-full">
          {potholes.length} total
        </span>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {potholes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-600 py-12">
            <MapPin className="w-8 h-8 mb-2 opacity-20" />
            <p className="text-sm italic">No potholes detected yet</p>
          </div>
        ) : (
          potholes.map((p) => (
            <div 
              key={p.id}
              className="group flex items-center gap-4 p-3 bg-zinc-800/40 hover:bg-zinc-800/80 rounded-xl border border-zinc-700/50 transition-all cursor-pointer"
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                p.severity === 'high' ? 'bg-red-500/20 text-red-500' : 
                p.severity === 'medium' ? 'bg-orange-500/20 text-orange-500' : 'bg-yellow-500/20 text-yellow-500'
              }`}>
                <MapPin className="w-5 h-5" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-bold text-zinc-100 text-sm truncate">
                    {p.address || `Pothole at ${p.latitude.toFixed(4)}, ${p.longitude.toFixed(4)}`}
                  </span>
                  <span className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded ${
                    p.severity === 'high' ? 'bg-red-500 text-white' : 
                    p.severity === 'medium' ? 'bg-orange-500 text-white' : 'bg-yellow-500 text-black'
                  }`}>
                    {p.severity}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-zinc-500">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(p.timestamp?.seconds * 1000).toLocaleTimeString()}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    <span>{p.userId.slice(0, 6)}...</span>
                  </div>
                </div>
              </div>
              
              <ChevronRight className="w-4 h-4 text-zinc-700 group-hover:text-zinc-400 transition-colors" />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function User({ className }: { className?: string }) {
  return (
    <svg 
      className={className} 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
