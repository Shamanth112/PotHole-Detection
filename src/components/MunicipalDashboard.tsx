import React, { useState, useRef, useEffect } from 'react';
import { Pothole } from '../hooks/usePotholes';
import { MapPin, User, Navigation, Clock, ShieldAlert, CheckCircle2, Loader2, AlertCircle, Camera, Image as ImageIcon, X, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../supabase';
import { uploadPotholeImage } from '../services/storageService';

interface MunicipalDashboardProps {
  potholes?: Pothole[]; // now optional, kept for backward compat
}

export default function MunicipalDashboard({ potholes: propPotholes }: MunicipalDashboardProps) {
  const [allPotholes, setAllPotholes] = useState<Pothole[]>([]);
  const [fetchLoading, setFetchLoading] = useState(true);

  // Fetch ALL potholes directly — never filter by user
  const fetchAll = async () => {
    const { data, error } = await supabase
      .from('potholes')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setAllPotholes(data);
    setFetchLoading(false);
  };

  useEffect(() => {
    fetchAll();
    const channel = supabase
      .channel('municipal-potholes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'potholes' }, () => {
        fetchAll();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Use directly-fetched data; fall back to prop only if still loading
  const potholes = fetchLoading ? (propPotholes || []) : allPotholes;


  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const updateStatus = async (id: string, newStatus: Pothole['status']) => {
    if (newStatus === 'resolved' && !selectedFile && resolvingId !== id) {
      setResolvingId(id);
      return;
    }

    setUpdatingId(id);
    try {
      let resolvedImageUrl = '';
      if (newStatus === 'resolved' && selectedFile) {
        try {
          resolvedImageUrl = await uploadPotholeImage(selectedFile, `resolved/${id}_${Date.now()}.jpg`);
        } catch (uploadError: any) {
          console.error("Upload error:", uploadError);
          throw new Error(`Photo upload failed: ${uploadError.message || 'Check storage permissions'}`);
        }
      }

      const updateData: any = { status: newStatus };
      if (resolvedImageUrl) {
        updateData.resolved_image_url = resolvedImageUrl;
      }
      
      const { error } = await supabase
        .from('potholes')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      setResolvingId(null);
      clearSelection();
    } catch (error: any) {
      console.error("Error updating status:", error);
      alert(error.message || "Failed to update status. Please try again.");
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
                        {p.report_image_url && (
                          <div className="mt-2 mb-3">
                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Report Photo</p>
                            <img 
                              src={p.report_image_url} 
                              alt="Reported Pothole" 
                              className="w-32 h-32 object-cover rounded-xl border border-zinc-800"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        )}
                        {p.resolved_image_url && (
                          <div className="mt-2 mb-3">
                            <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-1">Resolution Photo</p>
                            <img 
                              src={p.resolved_image_url} 
                              alt="Resolved Pothole" 
                              className="w-32 h-32 object-cover rounded-xl border border-emerald-500/30"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500">
                          <div className="flex items-center gap-1.5 bg-black/40 px-2 py-1 rounded-md border border-zinc-800">
                            <Navigation className="w-3 h-3 text-blue-500" />
                            <span className="font-mono">{p.latitude.toFixed(6)}, {p.longitude.toFixed(6)}</span>
                          </div>
                          <div className="flex items-center gap-1.5 bg-black/40 px-2 py-1 rounded-md border border-zinc-800">
                            <Clock className="w-3 h-3 text-zinc-400" />
                            <span>{new Date(p.created_at).toLocaleString()}</span>
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
                          <p className="text-sm font-bold text-zinc-200">{p.user_name || 'Anonymous Citizen'}</p>
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

                  <AnimatePresence>
                    {resolvingId === p.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-4 p-4 bg-zinc-800/50 rounded-2xl border border-zinc-700 overflow-hidden"
                      >
                        <div className="flex flex-col gap-4">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold text-white">Upload Resolution Photo</h4>
                            <button onClick={() => setResolvingId(null)} className="text-zinc-500 hover:text-white">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          
                          <div className="flex items-center gap-4">
                            {!previewUrl ? (
                              <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full h-32 border-2 border-dashed border-zinc-700 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-blue-500/50 transition-all"
                              >
                                <Camera className="w-6 h-6 text-zinc-500" />
                                <span className="text-xs font-bold text-zinc-500">Take Photo or Upload</span>
                              </button>
                            ) : (
                              <div className="relative w-full h-32">
                                <img src={previewUrl} className="w-full h-full object-cover rounded-xl" alt="Preview" />
                                <button 
                                  onClick={clearSelection}
                                  className="absolute top-2 right-2 p-1 bg-black/60 rounded-full text-white hover:bg-black/80"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                            <input 
                              type="file" 
                              ref={fileInputRef}
                              onChange={handleFileChange}
                              accept="image/*"
                              capture="environment"
                              className="hidden"
                            />
                          </div>

                          <button
                            disabled={!selectedFile || updatingId === p.id}
                            onClick={() => updateStatus(p.id, 'resolved')}
                            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2"
                          >
                            {updatingId === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            Confirm Resolution
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
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
