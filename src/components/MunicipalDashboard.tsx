import React, { useState, useRef } from 'react';
import { Pothole } from '../hooks/usePotholes';
import { MapPin, User, Navigation, Clock, ShieldAlert, CheckCircle2, Loader2, AlertCircle, Camera as CameraIcon, X, TrendingUp, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useConvex } from 'convex/react';
import { uploadToConvex } from '../services/storageService';
import ImageViewer from './ImageViewer';
import { Id } from '@/convex/_generated/dataModel';

interface MunicipalDashboardProps {
  potholes?: Pothole[];
}

export default function MunicipalDashboard({ potholes: propPotholes }: MunicipalDashboardProps) {
  const convex = useConvex();
  const potholesQuery = useQuery(api.potholes.listAll);
  const potholes = potholesQuery ?? (propPotholes || []);
  const fetchLoading = potholesQuery === undefined;

  const updateStatusMutation = useMutation(api.potholes.updateStatus);

  const [viewingImage, setViewingImage] = useState<{ url: string; title: string } | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | string>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setSelectedFile(file); setPreviewUrl(URL.createObjectURL(file)); }
  };

  const clearSelection = () => {
    setSelectedFile(null); setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const updateStatus = async (id: Id<"potholes">, newStatus: Pothole['status']) => {
    if (newStatus === 'resolved' && !selectedFile && resolvingId !== (id as string)) {
      setResolvingId(id as string); return;
    }
    setUpdatingId(id as string);
    try {
      let resolvedImageId: string | undefined;
      let resolvedImageUrl: string | undefined;
      if (newStatus === 'resolved' && selectedFile) {
        try {
          resolvedImageId = await uploadToConvex(convex, selectedFile);
          resolvedImageUrl = await convex.query(api.storage.getImageUrl, { storageId: resolvedImageId as Id<"_storage"> }) as string;
        } catch (uploadError: any) {
          throw new Error(`Photo upload failed: ${uploadError.message}`);
        }
      }
      await updateStatusMutation({ potholeId: id as Id<"potholes">, status: newStatus as any, resolvedImageId: resolvedImageId as any, resolvedImageUrl });
      setResolvingId(null); clearSelection();
    } catch (error: any) {
      alert(error.message || "Failed to update status.");
    } finally { setUpdatingId(null); }
  };

  const stats = {
    total: potholes.length,
    reported: potholes.filter(p => p.status === 'reported').length,
    fixing: potholes.filter(p => p.status === 'fixing').length,
    resolved: potholes.filter(p => p.status === 'resolved').length,
    high: potholes.filter(p => p.severity === 'high').length,
  };

  const filtered = filterStatus === 'all' ? potholes : potholes.filter(p => p.status === filterStatus);

  const statusBtns = [
    { key: 'reported', label: 'Reported', color: 'text-zinc-400', activeColor: 'text-zinc-100', activeBg: 'rgba(100,116,139,0.2)', activeBorder: 'rgba(100,116,139,0.4)' },
    { key: 'verified', label: 'Verified',  color: 'text-purple-400', activeColor: 'text-purple-300', activeBg: 'rgba(139,92,246,0.15)', activeBorder: 'rgba(139,92,246,0.4)' },
    { key: 'fixing',   label: 'Fixing',   color: 'text-blue-400',   activeColor: 'text-blue-300',   activeBg: 'rgba(59,130,246,0.15)',  activeBorder: 'rgba(59,130,246,0.4)'  },
    { key: 'resolved', label: 'Resolved', color: 'text-emerald-400',activeColor: 'text-emerald-300',activeBg: 'rgba(16,185,129,0.15)',  activeBorder: 'rgba(16,185,129,0.4)'  },
  ];

  return (
    <div className="min-h-full p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      {/* ── Header Stats ── */}
      <div>
        <h1 className="text-2xl md:text-3xl font-black tracking-tight">Municipal <span className="gradient-text-blue">Control Center</span></h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Real-time pothole detection feed</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total',    value: stats.total,    color: 'text-blue-400',    bg: 'rgba(59,130,246,0.08)'  },
          { label: 'Pending',  value: stats.reported, color: 'text-orange-400',  bg: 'rgba(249,115,22,0.08)'  },
          { label: 'Fixing',   value: stats.fixing,   color: 'text-cyan-400',    bg: 'rgba(6,182,212,0.08)'   },
          { label: 'Resolved', value: stats.resolved, color: 'text-emerald-400', bg: 'rgba(16,185,129,0.08)'  },
        ].map(({ label, value, color, bg }, i) => (
          <motion.div key={label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="stat-card text-center">
            <p className={`text-3xl font-black ${color}`}>{value}</p>
            <p className="text-[10px] font-semibold uppercase tracking-widest mt-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
          </motion.div>
        ))}
      </div>

      {/* ── Filter Tabs ── */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setFilterStatus('all')} className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all"
          style={{ background: filterStatus === 'all' ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.04)', border: `1px solid ${filterStatus === 'all' ? 'rgba(59,130,246,0.4)' : 'var(--border)'}`, color: filterStatus === 'all' ? '#60a5fa' : 'var(--text-secondary)' }}>
          All ({stats.total})
        </button>
        {statusBtns.map(({ key, label }) => {
          const count = potholes.filter(p => p.status === key).length;
          return (
            <button key={key} onClick={() => setFilterStatus(key)} className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all"
              style={{ background: filterStatus === key ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.04)', border: `1px solid ${filterStatus === key ? 'rgba(59,130,246,0.4)' : 'var(--border)'}`, color: filterStatus === key ? '#60a5fa' : 'var(--text-secondary)' }}>
              {label} ({count})
            </button>
          );
        })}
      </div>

      {/* ── Feed ── */}
      {fetchLoading ? (
        <div className="flex justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-10 h-10 animate-spin" style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading reports...</p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-3xl p-16 text-center">
          <MapPin className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p className="font-bold">No reports found</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>No potholes match the selected filter</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((p, index) => (
            <motion.div
              key={p._id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="glass-hover rounded-2xl overflow-hidden"
            >
              {/* Severity top strip */}
              <div className="h-0.5" style={{ background: p.severity === 'high' ? '#ef4444' : p.severity === 'medium' ? '#f97316' : '#eab308' }} />

              <div className="p-5 space-y-4">
                {/* Main info row */}
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                      p.severity === 'high' ? 'badge-high' : p.severity === 'medium' ? 'badge-medium' : 'badge-low'
                    }`}>
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-base leading-snug">
                        {p.address || `${p.latitude.toFixed(6)}, ${p.longitude.toFixed(6)}`}
                      </h3>

                      {/* Images row */}
                      {(p.reportImageUrl || p.resolvedImageUrl) && (
                        <div className="flex gap-3 mt-3 overflow-x-auto no-scrollbar">
                          {p.reportImageUrl && (
                            <div className="shrink-0 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setViewingImage({ url: p.reportImageUrl!, title: 'Report Photo' })}>
                              <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>Report</p>
                              <img src={p.reportImageUrl} alt="Report" className="w-28 h-28 object-cover rounded-xl" style={{ border: '1px solid var(--border)' }} referrerPolicy="no-referrer" />
                            </div>
                          )}
                          {p.resolvedImageUrl && (
                            <div className="shrink-0 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setViewingImage({ url: p.resolvedImageUrl!, title: 'Resolution Photo' })}>
                              <p className="text-[9px] font-bold uppercase tracking-widest mb-1 text-emerald-400">Resolved</p>
                              <img src={p.resolvedImageUrl} alt="Resolved" className="w-28 h-28 object-cover rounded-xl border border-emerald-500/30" referrerPolicy="no-referrer" />
                            </div>
                          )}
                        </div>
                      )}

                      {/* Meta tags */}
                      <div className="flex flex-wrap gap-2 mt-3">
                        <a
                          href={`https://www.google.com/maps?q=${p.latitude},${p.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open in Google Maps"
                          className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-mono transition-all hover:opacity-80"
                          style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)', color: '#60a5fa', textDecoration: 'none' }}
                        >
                          <Navigation className="w-3 h-3 text-blue-400 shrink-0" />
                          {p.latitude.toFixed(5)}, {p.longitude.toFixed(5)}
                          <span style={{ fontSize: '9px', opacity: 0.7, marginLeft: '2px' }}>↗</span>
                        </a>
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                          <Clock className="w-3 h-3" />
                          {new Date(p._creationTime).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right side */}
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)' }}>
                        <User className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Reported By</p>
                        <p className="text-sm font-bold">{p.userName || 'Anonymous'}</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                      p.severity === 'high' ? 'badge-high' : p.severity === 'medium' ? 'badge-medium' : 'badge-low'
                    }`}>{p.severity}</span>
                  </div>
                </div>

                {/* Status update row */}
                <div className="flex flex-wrap items-center gap-2 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                  <span className="text-[10px] font-semibold uppercase tracking-widest mr-1" style={{ color: 'var(--text-muted)' }}>Update Status:</span>
                  {statusBtns.map(({ key, label, activeColor, activeBg, activeBorder }) => (
                    <button
                      key={key}
                      onClick={() => updateStatus(p._id as any, key as any)}
                      disabled={!!updatingId}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
                      style={{
                        background: p.status === key ? activeBg : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${p.status === key ? activeBorder : 'var(--border)'}`,
                        color: p.status === key ? activeColor : 'var(--text-muted)',
                      }}
                    >
                      {p.status === key ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                      {label}
                      {updatingId === p._id && p.status === key && <Loader2 className="w-3 h-3 animate-spin" />}
                    </button>
                  ))}
                </div>

                {/* Resolve upload form */}
                <AnimatePresence>
                  {resolvingId === p._id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="rounded-2xl overflow-hidden"
                      style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}
                    >
                      <div className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold text-emerald-400">Upload Resolution Photo</h4>
                          <button onClick={() => setResolvingId(null)} style={{ color: 'var(--text-muted)' }}>
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        {!previewUrl ? (
                          <button onClick={() => fileInputRef.current?.click()} className="w-full h-28 rounded-xl flex flex-col items-center justify-center gap-2 transition-all hover:border-emerald-500/40" style={{ border: '2px dashed rgba(16,185,129,0.3)' }}>
                            <CameraIcon className="w-6 h-6 text-emerald-500" />
                            <span className="text-xs font-semibold text-emerald-400">Take Photo or Upload</span>
                          </button>
                        ) : (
                          <div className="relative h-28 rounded-xl overflow-hidden">
                            <img src={previewUrl} className="w-full h-full object-cover" alt="Preview" />
                            <button onClick={clearSelection} className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-white hover:bg-black/80">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" capture="environment" className="hidden" />
                        <button
                          disabled={!selectedFile || !!updatingId}
                          onClick={() => updateStatus(p._id as any, 'resolved')}
                          className="w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-40"
                          style={{ background: selectedFile ? 'linear-gradient(135deg, #10b981, #059669)' : 'rgba(255,255,255,0.06)', color: selectedFile ? 'white' : 'var(--text-muted)', boxShadow: selectedFile ? '0 4px 15px rgba(16,185,129,0.3)' : 'none' }}
                        >
                          {updatingId === p._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                          Confirm Resolution
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <ImageViewer url={viewingImage?.url || null} title={viewingImage?.title} onClose={() => setViewingImage(null)} />
    </div>
  );
}


