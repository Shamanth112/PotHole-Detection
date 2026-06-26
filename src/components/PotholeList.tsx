import React, { useState } from 'react';
import { Pothole } from '../hooks/usePotholes';
import { MapPin, Clock, ChevronRight, AlertTriangle, Info, Trash2, Loader2, Filter, Search, Camera } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import ImageViewer from './ImageViewer';
import { Id } from '@/convex/_generated/dataModel';

interface PotholeListProps {
  potholes: Pothole[];
}

export default function PotholeList({ potholes }: PotholeListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [localPotholes, setLocalPotholes] = useState<Pothole[] | null>(null);
  const [viewingImage, setViewingImage] = useState<{ url: string; title: string } | null>(null);
  const [filter, setFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [search, setSearch] = useState('');

  const deletePotholeMutation = useMutation(api.potholes.deletePothole);
  const displayPotholes = localPotholes ?? potholes;

  const filtered = displayPotholes
    .filter(p => filter === 'all' || p.severity === filter)
    .filter(p => !search || (p.address || '').toLowerCase().includes(search.toLowerCase()));

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this report? This cannot be undone.')) return;
    setDeletingId(id);
    try {
      await deletePotholeMutation({ potholeId: id as Id<"potholes"> });
      setLocalPotholes((prev) => (prev ?? potholes).filter((p) => p._id !== id));
    } catch (err: any) {
      alert('Failed to delete: ' + err.message);
    } finally { setDeletingId(null); }
  };

  React.useEffect(() => { setLocalPotholes(null); }, [potholes]);

  const statusConfig: Record<string, { label: string; class: string }> = {
    reported: { label: 'Reported', class: 'badge-reported' },
    verified: { label: 'Verified', class: 'badge-verified' },
    fixing:   { label: 'Fixing',   class: 'badge-fixing'   },
    resolved: { label: 'Resolved', class: 'badge-resolved' },
  };

  const statusProgress: Record<string, number> = {
    reported: 10, verified: 33, fixing: 66, resolved: 100,
  };

  const severityConfig: Record<string, { class: string; bar: string }> = {
    high:   { class: 'badge-high',   bar: '#ef4444' },
    medium: { class: 'badge-medium', bar: '#f97316' },
    low:    { class: 'badge-low',    bar: '#eab308' },
  };

  return (
    <div className="min-h-full p-4 md:p-8 max-w-6xl mx-auto space-y-5 md:space-y-6">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl md:text-3xl font-black tracking-tight">Report <span className="gradient-text-blue">History</span></h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{potholes.length} total reports in your area</p>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-col gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by location..."
            className="input-dark pl-10"
          />
        </div>
        {/* Severity filter — horizontally scrollable on mobile */}
        <div className="chip-scroll">
          {(['all', 'high', 'medium', 'low'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all"
              style={{
                background: filter === f ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${filter === f ? 'rgba(59,130,246,0.4)' : 'var(--border)'}`,
                color: filter === f ? '#60a5fa' : 'var(--text-secondary)',
              }}
            >
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ── Empty state ── */}
      {filtered.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="glass rounded-3xl p-12 md:p-16 text-center"
        >
          <div className="w-20 h-20 rounded-3xl mx-auto mb-5 flex items-center justify-center" style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}>
            <MapPin className="w-10 h-10 text-blue-400" aria-hidden="true" />
          </div>
          {potholes.length === 0 ? (
            <>
              <h3 className="text-xl font-black tracking-tight mb-2">No reports yet</h3>
              <p className="text-sm max-w-md mx-auto leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                You haven't reported any potholes yet. Be the first to help your community
                by spotting road damage with the AI scanner.
              </p>
              <div className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600/15 border border-blue-500/30 text-blue-300 text-sm font-semibold">
                <Camera className="w-4 h-4" aria-hidden="true" />
                Tap the <strong className="mx-1">Scan</strong> button below to start
              </div>
            </>
          ) : (
            <>
              <h3 className="text-xl font-black tracking-tight mb-2">No reports match your filters</h3>
              <p className="text-sm max-w-md mx-auto leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                Try clearing your search or selecting a different severity filter.
              </p>
              <button
                onClick={() => { setSearch(''); setFilter('all'); }}
                className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-700/40 hover:bg-zinc-700/60 border border-zinc-600/50 text-sm font-semibold transition-colors"
              >
                Clear filters
              </button>
            </>
          )}
        </motion.div>
      )}

      {/* ── Cards grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        <AnimatePresence>
          {filtered.map((p, i) => {
            const sev = severityConfig[p.severity] ?? severityConfig.low!;
            const st = statusConfig[p.status] ?? statusConfig.reported!;
            const progress = statusProgress[p.status] ?? 10;

            return (
              <motion.div
                key={p._id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: i * 0.04 }}
                className="glass-hover rounded-2xl p-5 flex flex-col gap-4 relative overflow-hidden group"
              >
                {/* Severity glow strip */}
                <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: p.severity === 'high' ? 'linear-gradient(90deg, #ef4444, transparent)' : p.severity === 'medium' ? 'linear-gradient(90deg, #f97316, transparent)' : 'linear-gradient(90deg, #eab308, transparent)' }} />

                {/* Top row */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`${sev.class} px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest`}>
                      {p.severity}
                    </span>
                    <span className={`${st.class} px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest`}>
                      {st.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
                    <Clock className="w-3 h-3" />
                    {new Date(p._creationTime).toLocaleDateString()}
                  </div>
                </div>

                {/* Address */}
                <div>
                  <h3 className="font-bold text-sm leading-snug line-clamp-2">
                    {p.address || `${p.latitude.toFixed(4)}, ${p.longitude.toFixed(4)}`}
                  </h3>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>by {p.userName || 'Anonymous'}</p>
                </div>

                {/* Images */}
                {(p.reportImageUrl || p.resolvedImageUrl) && (
                  <div className="flex gap-2 overflow-x-auto no-scrollbar">
                    {p.reportImageUrl && (
                      <div className="shrink-0 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setViewingImage({ url: p.reportImageUrl!, title: 'Report Photo' })}>
                        <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>Report</p>
                        <img src={p.reportImageUrl} className="w-20 h-20 object-cover rounded-xl" style={{ border: '1px solid var(--border)' }} alt="Report" referrerPolicy="no-referrer" />
                      </div>
                    )}
                    {p.resolvedImageUrl && (
                      <div className="shrink-0 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setViewingImage({ url: p.resolvedImageUrl!, title: 'Resolved Photo' })}>
                        <p className="text-[9px] font-bold uppercase tracking-widest mb-1 text-emerald-400">Resolved</p>
                        <img src={p.resolvedImageUrl} className="w-20 h-20 object-cover rounded-xl border border-emerald-500/30" alt="Resolved" referrerPolicy="no-referrer" />
                      </div>
                    )}
                  </div>
                )}

                {/* Progress bar */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Resolution Progress</span>
                    <span className="text-[10px] font-bold" style={{ color: 'var(--text-secondary)' }}>{progress}%</span>
                  </div>
                  <div className="progress-bar">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ delay: i * 0.04 + 0.3, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                      className="progress-fill"
                      style={{ background: p.status === 'resolved' ? '#10b981' : p.status === 'fixing' ? '#3b82f6' : p.status === 'verified' ? '#8b5cf6' : '#64748b' }}
                    />
                  </div>
                </div>

                {/* Delete button */}
                <button
                  onClick={() => handleDelete(p._id)}
                  disabled={deletingId === p._id}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-all hover:bg-red-500/10 disabled:opacity-50"
                  style={{ border: '1px solid rgba(239,68,68,0.15)', color: '#f87171' }}
                >
                  {deletingId === p._id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  {deletingId === p._id ? 'Deleting...' : 'Delete Report'}
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <ImageViewer url={viewingImage?.url || null} title={viewingImage?.title} onClose={() => setViewingImage(null)} />
    </div>
  );
}
