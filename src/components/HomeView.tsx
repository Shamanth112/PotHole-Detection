import React from 'react';
import { Play, FileText, Activity, CheckCircle2, ShieldAlert, Wifi } from 'lucide-react';
import { motion } from 'motion/react';

interface HomeViewProps {
  onStartDetection: () => void;
  onReportManually: () => void;
  stats: {
    detectedToday: number;
    fixedThisWeek: number;
  };
}

export default function HomeView({ onStartDetection, onReportManually, stats }: HomeViewProps) {
  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <header className="bg-[#1a365d] text-white p-6 flex justify-between items-center shadow-lg">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-6 h-6" />
          <h1 className="text-xl font-bold tracking-tight">RoadGuard</h1>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium opacity-90">
          <Wifi className="w-4 h-4 text-emerald-400" />
          <span>GPS: Active</span>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 p-6 md:p-12 flex flex-col gap-8 overflow-y-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Camera Placeholder */}
          <div className="aspect-video bg-[#2d3748] rounded-[2.5rem] relative flex flex-col items-center justify-center overflow-hidden shadow-2xl border-8 border-[#1a365d]/5 group">
            <div className="absolute top-6 left-6 flex items-center gap-3">
              <div className="w-3 h-3 bg-zinc-500 rounded-full animate-pulse" />
              <span className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em]">System Standby</span>
            </div>
            
            <motion.div 
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 4, repeat: Infinity }}
              className="w-32 h-32 rounded-full border-8 border-zinc-700/30 flex items-center justify-center relative"
            >
              <div className="w-20 h-20 rounded-full border-4 border-zinc-700/20" />
              <div className="absolute inset-0 border-t-4 border-blue-500/20 rounded-full animate-spin" />
            </motion.div>
            
            <div className="mt-8 text-center space-y-2">
              <p className="text-zinc-400 font-black text-xl tracking-tighter italic uppercase">AI Vision Ready</p>
              <p className="text-zinc-600 text-xs font-medium tracking-widest uppercase">Connect camera to begin scanning</p>
            </div>

            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>

          <div className="flex flex-col gap-8">
            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
              <button 
                onClick={onStartDetection}
                className="group relative overflow-hidden bg-[#1a365d] text-white py-6 rounded-3xl font-black text-lg flex items-center justify-center gap-4 shadow-2xl hover:bg-[#152a4a] transition-all active:scale-95"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-400/0 via-white/10 to-blue-400/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                <Play className="w-6 h-6 fill-current" />
                <span className="tracking-tighter uppercase italic">Start AI Detection</span>
              </button>
              
              <button 
                onClick={onReportManually}
                className="bg-white text-[#1a365d] border-4 border-[#1a365d] py-6 rounded-3xl font-black text-lg flex items-center justify-center gap-4 hover:bg-[#f7fafc] transition-all active:scale-95 shadow-xl"
              >
                <FileText className="w-6 h-6" />
                <span className="tracking-tighter uppercase italic">Manual Report</span>
              </button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#ebf8ff] p-8 rounded-[2rem] border-2 border-blue-100 flex flex-col items-center justify-center text-center shadow-sm hover:shadow-md transition-shadow">
                <p className="text-5xl font-black text-[#2b6cb0] mb-2 tracking-tighter">{stats.detectedToday}</p>
                <p className="text-[10px] font-black text-[#4a5568] uppercase tracking-[0.2em]">Detected Today</p>
              </div>
              <div className="bg-[#f0fff4] p-8 rounded-[2rem] border-2 border-green-100 flex flex-col items-center justify-center text-center shadow-sm hover:shadow-md transition-shadow">
                <p className="text-5xl font-black text-[#2f855a] mb-2 tracking-tighter">{stats.fixedThisWeek}</p>
                <p className="text-[10px] font-black text-[#4a5568] uppercase tracking-[0.2em]">Fixed This Week</p>
              </div>
            </div>

            {/* Quick Tips */}
            <div className="bg-zinc-50 p-6 rounded-3xl border border-zinc-200 flex items-start gap-4">
              <div className="w-10 h-10 bg-white rounded-xl border border-zinc-200 flex items-center justify-center shrink-0">
                <Activity className="w-5 h-5 text-[#1a365d]" />
              </div>
              <div>
                <p className="font-bold text-zinc-900 text-sm">Pro Tip</p>
                <p className="text-xs text-zinc-500 leading-relaxed">Mount your device securely on the dashboard for the most accurate AI detection while driving.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
