import React, { useState } from 'react';
import { Pothole } from '../hooks/usePotholes';
import { MapPin, Clock, ChevronRight, AlertTriangle, Info, Trash2, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import ImageViewer from './ImageViewer';
import { Id } from '../../convex/_generated/dataModel';

interface PotholeListProps {
  potholes: Pothole[];
}

export default function PotholeList({ potholes }: PotholeListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [localPotholes, setLocalPotholes] = useState<Pothole[] | null>(null);
  const [viewingImage, setViewingImage] = useState<{url: string, title: string} | null>(null);

  const deletePotholeMutation = useMutation(api.potholes.deletePothole);

  const displayPotholes = localPotholes ?? potholes;

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this report? This cannot be undone.')) return;
    setDeletingId(id);
    try {
      await deletePotholeMutation({ potholeId: id as Id<"potholes"> });
      // Optimistically remove from local list
      setLocalPotholes((prev) => (prev ?? potholes).filter((p) => p._id !== id));
    } catch (err: any) {
      alert('Failed to delete: ' + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  // Sync local list when prop changes (e.g. real-time update)
  React.useEffect(() => {
    setLocalPotholes(null);
  }, [potholes]);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <header className="bg-[#1a365d] text-white p-6 shadow-lg z-10">
        <h1 className="text-xl font-bold tracking-tight">Report History</h1>
      </header>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        {displayPotholes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[#a0aec0] py-24">
            <MapPin className="w-16 h-16 mb-6 opacity-20" />
            <p className="font-black text-xl italic uppercase tracking-tighter">No reports found</p>
            <p className="text-sm mt-2">Your reported potholes will appear here</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            <AnimatePresence>
              {displayPotholes.map((p) => (
                <motion.div
                  key={p._id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="bg-white rounded-3xl border-2 border-[#e2e8f0] p-6 shadow-sm hover:shadow-xl hover:border-[#1a365d]/20 transition-all flex flex-col gap-6 group relative overflow-hidden"
                >
                  <div className="flex items-start justify-between">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${
                      p.severity === 'high' ? 'bg-red-50 text-red-600' : 
                      p.severity === 'medium' ? 'bg-orange-50 text-orange-600' : 'bg-yellow-50 text-yellow-600'
                    }`}>
                      {p.severity === 'high' ? <AlertTriangle className="w-8 h-8" /> : 
                       p.severity === 'medium' ? <Info className="w-8 h-8" /> : <MapPin className="w-8 h-8" />}
                    </div>
                    
                    <div className="flex flex-col items-end gap-2">
                      <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full tracking-widest ${
                        p.severity === 'high' ? 'bg-red-600 text-white' : 
                        p.severity === 'medium' ? 'bg-orange-600 text-white' : 'bg-yellow-600 text-white'
                      }`}>
                        {p.severity}
                      </span>
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#a0aec0] uppercase tracking-widest">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(p._creationTime).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="font-black text-[#1a365d] text-lg leading-tight tracking-tighter italic uppercase">
                      {p.address || `Pothole at ${p.latitude.toFixed(4)}, ${p.longitude.toFixed(4)}`}
                    </h3>
                    <p className="text-xs text-[#718096] font-medium">Reported by {p.userName || 'Anonymous'}</p>
                    
                    <div className="flex gap-2 mt-2 overflow-x-auto pb-2">
                      {p.reportImageUrl && (
                        <div className="shrink-0 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setViewingImage({url: p.reportImageUrl!, title: 'Report Photo'})}>
                          <p className="text-[8px] font-black text-[#a0aec0] uppercase tracking-widest mb-1">Report</p>
                          <img src={p.reportImageUrl} className="w-20 h-20 object-cover rounded-xl border border-[#e2e8f0]" alt="Report" referrerPolicy="no-referrer" />
                        </div>
                      )}
                      {p.resolvedImageUrl && (
                        <div className="shrink-0 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setViewingImage({url: p.resolvedImageUrl!, title: 'Resolved Photo'})}>
                          <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest mb-1">Resolved</p>
                          <img src={p.resolvedImageUrl} className="w-20 h-20 object-cover rounded-xl border border-emerald-500/30" alt="Resolved" referrerPolicy="no-referrer" />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full animate-pulse ${
                          p.status === 'resolved' ? 'bg-emerald-500' : 
                          p.status === 'fixing' ? 'bg-blue-500' : 
                          p.status === 'verified' ? 'bg-purple-500' : 'bg-zinc-400'
                        }`} />
                        <span className={
                          p.status === 'resolved' ? 'text-emerald-600' : 
                          p.status === 'fixing' ? 'text-blue-600' : 
                          p.status === 'verified' ? 'text-purple-600' : 'text-zinc-500'
                        }>{p.status}</span>
                      </div>
                      <span className="text-[#a0aec0]">
                        {p.status === 'resolved' ? '100%' : 
                         p.status === 'fixing' ? '66%' : 
                         p.status === 'verified' ? '33%' : '10%'}
                      </span>
                    </div>
                    
                    <div className="h-2 w-full bg-[#edf2f7] rounded-full overflow-hidden shadow-inner">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ 
                          width: p.status === 'resolved' ? '100%' : 
                                 p.status === 'fixing' ? '66%' : 
                                 p.status === 'verified' ? '33%' : '10%' 
                        }}
                        className={`h-full transition-all duration-1000 ${
                          p.status === 'resolved' ? 'bg-emerald-500' : 
                          p.status === 'fixing' ? 'bg-blue-500' : 
                          p.status === 'verified' ? 'bg-purple-500' : 'bg-zinc-400'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Delete Button */}
                  <button
                    onClick={() => handleDelete(p._id)}
                    disabled={deletingId === p._id}
                    className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 rounded-2xl border-2 border-red-100 text-red-500 hover:bg-red-50 hover:border-red-200 transition-all text-xs font-black uppercase tracking-widest disabled:opacity-50"
                  >
                    {deletingId === p._id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    {deletingId === p._id ? 'Deleting...' : 'Delete Report'}
                  </button>

                  <div className="absolute bottom-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-10 h-10 bg-[#1a365d] text-white rounded-xl flex items-center justify-center shadow-lg">
                      <ChevronRight className="w-5 h-5" />
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      <ImageViewer 
        url={viewingImage?.url || null} 
        title={viewingImage?.title} 
        onClose={() => setViewingImage(null)} 
      />
    </div>
  );
}
