import React, { useState } from 'react';
import { Pothole } from '../hooks/usePotholes';
import { MapPin, User, Navigation, Clock, ShieldAlert, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface MunicipalDashboardProps {
  potholes: Pothole[];
}

export default function MunicipalDashboard({ potholes }: MunicipalDashboardProps) {
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const updateStatus = async (id: string, newStatus: Pothole['status']) => {
    setUpdatingId(id);
    try {
      const potholeRef = doc(db, 'potholes', id);
      await updateDoc(potholeRef, { status: newStatus });
    } catch (error) {
      console.error("Error updating status:", error);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/20">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tighter uppercase italic">
                Pothole<span className="text-blue-600">Detection</span> IDP
              </h1>
              <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Pothole Detection Feed</p>
            </div>
          </div>
          <div className="bg-zinc-900 px-4 py-2 rounded-xl border border-zinc-800">
            <span className="text-blue-500 font-black text-xl">{potholes.length}</span>
            <span className="text-zinc-500 text-[10px] font-bold uppercase ml-2">Total Detections</span>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-4">
          {potholes.length === 0 ? (
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-20 text-center">
              <MapPin className="w-12 h-12 text-zinc-700 mx-auto mb-4 opacity-20" />
              <p className="text-zinc-500 italic">No potholes reported in the system yet.</p>
            </div>
          ) : (
            potholes.map((p, index) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 hover:border-blue-500/50 transition-all group"
              >
                <div className="flex flex-col gap-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                        p.severity === 'high' ? 'bg-red-500/10 text-red-500' : 
                        p.severity === 'medium' ? 'bg-orange-500/10 text-orange-500' : 'bg-yellow-500/10 text-yellow-500'
                      }`}>
                        <MapPin className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-white mb-1 group-hover:text-blue-400 transition-colors">
                          {p.address || `Pothole at ${p.latitude.toFixed(6)}, ${p.longitude.toFixed(6)}`}
                        </h3>
                        <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500">
                          <div className="flex items-center gap-1.5 bg-black/40 px-2 py-1 rounded-md border border-zinc-800">
                            <Navigation className="w-3 h-3 text-blue-500" />
                            <span className="font-mono">{p.latitude.toFixed(6)}, {p.longitude.toFixed(6)}</span>
                          </div>
                          <div className="flex items-center gap-1.5 bg-black/40 px-2 py-1 rounded-md border border-zinc-800">
                            <Clock className="w-3 h-3 text-zinc-400" />
                            <span>{new Date(p.timestamp?.seconds * 1000).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center">
                          <User className="w-4 h-4 text-zinc-400" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Reported By</p>
                          <p className="text-sm font-bold text-zinc-200">{p.userName || 'Anonymous Citizen'}</p>
                        </div>
                      </div>
                      <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${
                        p.severity === 'high' ? 'bg-red-500/20 text-red-500 border border-red-500/30' : 
                        p.severity === 'medium' ? 'bg-orange-500/20 text-orange-500 border border-orange-500/30' : 
                        'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30'
                      }`}>
                        {p.severity} Priority
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-zinc-800">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mr-2">Update Status:</span>
                    <StatusButton 
                      active={p.status === 'reported'} 
                      onClick={() => updateStatus(p.id, 'reported')} 
                      label="Reported" 
                      color="zinc" 
                      loading={updatingId === p.id}
                    />
                    <StatusButton 
                      active={p.status === 'verified'} 
                      onClick={() => updateStatus(p.id, 'verified')} 
                      label="Verified" 
                      color="purple" 
                      loading={updatingId === p.id}
                    />
                    <StatusButton 
                      active={p.status === 'fixing'} 
                      onClick={() => updateStatus(p.id, 'fixing')} 
                      label="Fixing" 
                      color="blue" 
                      loading={updatingId === p.id}
                    />
                    <StatusButton 
                      active={p.status === 'resolved'} 
                      onClick={() => updateStatus(p.id, 'resolved')} 
                      label="Resolved" 
                      color="emerald" 
                      loading={updatingId === p.id}
                    />
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function StatusButton({ active, onClick, label, color, loading }: { active: boolean; onClick: () => void; label: string; color: string; loading: boolean }) {
  const colors: Record<string, string> = {
    zinc: active ? 'bg-zinc-100 text-black' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700',
    purple: active ? 'bg-purple-600 text-white' : 'bg-purple-900/20 text-purple-400 hover:bg-purple-900/40',
    blue: active ? 'bg-blue-600 text-white' : 'bg-blue-900/20 text-blue-400 hover:bg-blue-900/40',
    emerald: active ? 'bg-emerald-600 text-white' : 'bg-emerald-900/20 text-emerald-400 hover:bg-emerald-900/40',
  };

  return (
    <button 
      onClick={onClick} 
      disabled={loading}
      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${colors[color]}`}
    >
      {active ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
      {label}
      {loading && active && <Loader2 className="w-3 h-3 animate-spin" />}
    </button>
  );
}
