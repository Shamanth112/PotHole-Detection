import React, { useState, useEffect, useRef } from 'react';
import { Upload, MapPin, CheckCircle2, AlertTriangle, Info, ArrowLeft, Loader2, X, Brain, Ruler, XCircle, Share2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useConvex, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { uploadToConvex } from '../services/storageService';
import { Id } from '@/convex/_generated/dataModel';

interface ReportViewProps {
  onBack: () => void;
  /** Returns the new potholeId so we can track AI status */
  onSubmit: (data: any) => Promise<Id<'potholes'> | void>;
  userId: string;
}

// ── AI Status Screen ───────────────────────────────────────────────────────────

/** Build a shareable plain-text summary of a verified report. */
function buildShareText(pothole: { latitude: number; longitude: number; severity: string; address?: string | null; aiDescription?: string | null; aiDepthEstimate?: string | null }): string {
  const lines = [
    '🛣️ I just reported a pothole with RoadGuard!',
    '',
    `📍 Location: ${pothole.address ?? `${pothole.latitude.toFixed(4)}, ${pothole.longitude.toFixed(4)}`}`,
    `⚠️ Severity: ${pothole.severity}`,
  ];
  if (pothole.aiDepthEstimate) lines.push(`📏 Estimated depth: ${pothole.aiDepthEstimate}`);
  if (pothole.aiDescription) lines.push(`🤖 AI says: ${pothole.aiDescription}`);
  lines.push('', 'Help keep our roads safe — download RoadGuard today!');
  return lines.join('\n');
}

const AI_TIMEOUT_MS = 30_000;

function AiStatusScreen({
  potholeId,
  onDone,
  onBack,
}: {
  potholeId: Id<'potholes'>;
  onDone: () => void;
  onBack: () => void;
}) {
  const pothole = useQuery(api.potholes.getById, { potholeId });
  const [shareStatus, setShareStatus] = useState<'idle' | 'shared' | 'failed'>('idle');

  // aiVerified is undefined while pending, true when verified, false when dismissed
  const pending = pothole?.aiVerified === undefined || pothole?.aiVerified === null;
  const verified = pothole?.aiVerified === true;
  const rejected = pothole?.aiVerified === false;

  // After 30s of pending, show a slower-loading message so users don't
  // think the app is broken (Gemini can take a while when the free tier
  // is busy).
  const [slowLoad, setSlowLoad] = useState(false);
  useEffect(() => {
    if (!pending) { setSlowLoad(false); return; }
    const t = window.setTimeout(() => setSlowLoad(true), AI_TIMEOUT_MS);
    return () => window.clearTimeout(t);
  }, [pending]);

  const handleShare = async () => {
    if (!pothole) return;
    const text = buildShareText(pothole);
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Pothole reported with RoadGuard', text });
        setShareStatus('shared');
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        setShareStatus('shared');
      } else {
        setShareStatus('failed');
      }
    } catch {
      setShareStatus('failed');
    }
    // Reset the toast after a few seconds
    window.setTimeout(() => setShareStatus('idle'), 2500);
  };

  return (
    <div className="min-h-full flex flex-col items-center justify-center p-6 max-w-md mx-auto w-full gap-6" role="status" aria-live="polite">
      <AnimatePresence mode="wait">
        {pending && (
          <motion.div
            key="pending"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="w-full glass rounded-3xl p-8 flex flex-col items-center gap-5 text-center"
          >
            {/* Animated brain */}
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)' }}>
                <Brain className="w-10 h-10 text-blue-400" aria-hidden="true" />
              </div>
              <div className="absolute inset-0 rounded-2xl animate-ping" style={{ background: 'rgba(59,130,246,0.1)' }} />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight">AI Verifying…</h2>
              <p className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {slowLoad
                  ? 'The AI is taking longer than usual. Your report has been saved — feel free to come back in a few minutes, we\'ll have an answer waiting for you.'
                  : 'Gemini Vision is analysing your photo to confirm the pothole and estimate its depth. This usually takes a few seconds.'}
              </p>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl" style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}>
              <Loader2 className="w-4 h-4 text-blue-400 animate-spin" aria-hidden="true" />
              <span className="text-xs font-semibold text-blue-400">
                {slowLoad ? 'Still working…' : 'Analysis in progress'}
              </span>
            </div>
            {slowLoad && (
              <button
                onClick={onBack}
                className="text-xs font-bold text-blue-300 hover:text-blue-200 underline-offset-2 hover:underline"
              >
                Got it — check later
              </button>
            )}
          </motion.div>
        )}

        {verified && pothole && (
          <motion.div
            key="verified"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full glass rounded-3xl p-8 flex flex-col items-center gap-5 text-center"
            style={{ border: '1px solid rgba(16,185,129,0.3)' }}
          >
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)' }}>
              <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight text-emerald-400">Pothole Verified ✓</h2>
              <p className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                AI has confirmed a pothole in your photo. Your report has been automatically verified and sent to the municipal team.
              </p>
            </div>

            {/* AI Report card */}
            <div className="w-full rounded-2xl overflow-hidden text-left" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid rgba(16,185,129,0.15)' }}>
                <Brain className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">AI Analysis Report</span>
              </div>
              <div className="p-4 space-y-3">
                {(pothole as any).aiDescription && (
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {(pothole as any).aiDescription}
                  </p>
                )}
                <div className="flex flex-wrap gap-4">
                  {(pothole as any).aiDepthEstimate && (
                    <div className="flex items-center gap-1.5">
                      <Ruler className="w-3 h-3 text-blue-400" />
                      <span className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>Estimated Depth:</span>
                      <span className="text-[10px] font-black text-blue-400">{(pothole as any).aiDepthEstimate}</span>
                    </div>
                  )}
                  {(pothole as any).aiSeverityConfidence && (
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="w-3 h-3 text-orange-400" />
                      <span className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>Severity:</span>
                      <span className="text-[10px] font-black text-orange-400">{(pothole as any).aiSeverityConfidence}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="w-full flex gap-3">
              <button
                onClick={handleShare}
                className="flex-1 py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
                style={{
                  background: 'rgba(59,130,246,0.1)',
                  border: '1px solid rgba(59,130,246,0.3)',
                  color: '#60a5fa',
                }}
                aria-label="Share this pothole report"
              >
                <Share2 className="w-4 h-4" aria-hidden="true" />
                {shareStatus === 'shared' ? 'Copied!' : shareStatus === 'failed' ? 'Try again' : 'Share'}
              </button>
              <button
                onClick={onDone}
                className="flex-1 py-3.5 rounded-2xl font-black text-white text-sm"
                style={{ background: 'linear-gradient(135deg, #10b981, #059669)', boxShadow: '0 8px 24px rgba(16,185,129,0.3)' }}
              >
                Done
              </button>
            </div>
          </motion.div>
        )}

        {rejected && pothole && (
          <motion.div
            key="rejected"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full glass rounded-3xl p-8 flex flex-col items-center gap-5 text-center"
            style={{ border: '1px solid rgba(239,68,68,0.3)' }}
          >
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)' }}>
              <XCircle className="w-10 h-10 text-red-400" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight text-red-400">Report Rejected</h2>
              <p className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                AI could not detect a pothole in your image. Please submit a clearer photo showing the road damage.
              </p>
            </div>

            {(pothole as any).aiDescription && (
              <div className="w-full rounded-2xl p-4 text-left text-xs leading-relaxed" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', color: 'var(--text-secondary)' }}>
                <span className="text-red-400 font-bold text-[10px] uppercase tracking-widest block mb-1">AI Reason</span>
                {(pothole as any).aiDescription}
              </div>
            )}

            <div className="flex gap-3 w-full">
              <button
                onClick={onBack}
                className="flex-1 py-3.5 rounded-2xl font-bold text-sm transition-all"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}
              >
                Try Again
              </button>
              <button
                onClick={onDone}
                className="flex-1 py-3.5 rounded-2xl font-bold text-sm"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
              >
                Back Home
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main Report Form ──────────────────────────────────────────────────────────
export default function ReportView({ onBack, onSubmit, userId }: ReportViewProps) {
  const convex = useConvex();
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high'>('medium');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [isLocating, setIsLocating] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submittedPotholeId, setSubmittedPotholeId] = useState<Id<'potholes'> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setSelectedFile(file); setPreviewUrl(URL.createObjectURL(file)); }
  };

  const clearSelection = () => {
    setSelectedFile(null); setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => { setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, address: 'Auto-detected location' }); setIsLocating(false); },
        () => { setLocation({ lat: 40.7128, lng: -74.0060, address: 'Default Location (GPS Disabled)' }); setIsLocating(false); }
      );
    } else { setIsLocating(false); }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) { alert("Please upload a photo of the pothole."); return; }
    setIsSubmitting(true);
    try {
      let reportImageId: string | undefined;
      let reportImageUrl: string | undefined;
      try {
        reportImageId = await uploadToConvex(convex, selectedFile);
        reportImageUrl = await convex.query(api.storage.getImageUrl, { storageId: reportImageId as Id<"_storage"> }) as string;
      } catch (uploadError: any) {
        throw new Error(`Photo upload failed: ${uploadError.message || 'Check storage permissions'}`);
      }
      const newId = await onSubmit({
        severity, notes,
        latitude: location?.lat || 40.7128,
        longitude: location?.lng || -74.0060,
        address: location?.address || 'Unknown Location',
        reportImageId,
        reportImageUrl,
      });
      if (newId) {
        setSubmittedPotholeId(newId as Id<'potholes'>);
      } else {
        onBack();
      }
    } catch (error: any) {
      alert(error.message || "Failed to submit report.");
    } finally { setIsSubmitting(false); }
  };

  // ── Show AI status screen after submission ──
  if (submittedPotholeId) {
    return (
      <AiStatusScreen
        potholeId={submittedPotholeId}
        onDone={onBack}
        onBack={() => setSubmittedPotholeId(null)}
      />
    );
  }

  const severityOptions = [
    { level: 'low',    label: 'Low Severity',    desc: 'Minor damage, safe to drive',        icon: <Info className="w-5 h-5" />,          color: 'text-yellow-400', bg: 'rgba(234,179,8,0.08)',   border: 'rgba(234,179,8,0.3)',   selectedBorder: 'rgba(234,179,8,0.6)'   },
    { level: 'medium', label: 'Medium Severity', desc: 'Noticeable damage, caution advised',  icon: <AlertTriangle className="w-5 h-5" />,  color: 'text-orange-400', bg: 'rgba(249,115,22,0.08)',  border: 'rgba(249,115,22,0.2)',  selectedBorder: 'rgba(249,115,22,0.6)'  },
    { level: 'high',   label: 'High Severity',   desc: 'Severe damage, avoid if possible',   icon: <AlertTriangle className="w-5 h-5" />,  color: 'text-red-400',    bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.2)',   selectedBorder: 'rgba(239,68,68,0.6)'   },
  ];

  return (
    <div className="min-h-full flex flex-col">
      {/* Scrollable content area */}
      <div className="flex-1 p-4 md:p-8 max-w-2xl mx-auto w-full space-y-4 md:space-y-6 pb-28 md:pb-6">
        {/* ── Header ── */}
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="w-10 h-10 rounded-xl glass flex items-center justify-center transition-all hover:bg-white/10" style={{ color: 'var(--text-secondary)' }}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight">Report <span className="gradient-text-blue">Pothole</span></h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Photo is AI-verified automatically</p>
          </div>
        </div>

        <div className="space-y-4 md:space-y-6">
          {/* ── Photo Upload ── */}
          <div className="glass rounded-2xl overflow-hidden">
            <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <h3 className="text-sm font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>📸 Photo Evidence</h3>
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>AI will analyse this photo to verify the pothole and estimate depth</p>
            </div>
            <div className="p-4">
              {!previewUrl ? (
                <motion.div
                  whileHover={{ scale: 1.01 }}
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-2xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-all py-12"
                  style={{ border: '2px dashed rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.04)' }}
                >
                  <div className="w-14 h-14 rounded-2xl gradient-blue flex items-center justify-center glow-blue">
                    <Upload className="w-7 h-7 text-white" />
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-blue-400">Tap to take photo</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>or upload from gallery • JPG, PNG, WEBP</p>
                  </div>
                </motion.div>
              ) : (
                <div className="relative rounded-2xl overflow-hidden" style={{ aspectRatio: '16/9' }}>
                  <img src={previewUrl} className="w-full h-full object-cover" alt="Preview" />
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.4), transparent)' }} />
                  <button type="button" onClick={clearSelection} className="absolute top-3 right-3 p-2 rounded-xl bg-black/60 backdrop-blur-sm text-white hover:bg-black/80 transition-all">
                    <X className="w-4 h-4" />
                  </button>
                  <div className="absolute bottom-3 left-3 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="text-xs font-semibold text-white">Photo ready • AI will verify</span>
                  </div>
                </div>
              )}
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" capture="environment" className="hidden" />
            </div>
          </div>

          {/* ── Location ── */}
          <div className="glass rounded-2xl overflow-hidden">
            <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <h3 className="text-sm font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>📍 Location</h3>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-4 p-4 rounded-xl" style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}>
                <div className="w-12 h-12 rounded-xl gradient-blue flex items-center justify-center shrink-0">
                  {isLocating ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <MapPin className="w-5 h-5 text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-blue-400">{isLocating ? 'Detecting location...' : 'GPS Location Detected'}</p>
                  <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>{location?.address || 'Acquiring GPS signal...'}</p>
                  {location && <p className="text-[10px] font-mono mt-1" style={{ color: 'var(--text-muted)' }}>{location.lat.toFixed(5)}°, {location.lng.toFixed(5)}°</p>}
                </div>
                {!isLocating && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
              </div>
            </div>
          </div>

          {/* ── Severity ── */}
          <div className="glass rounded-2xl overflow-hidden">
            <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <h3 className="text-sm font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>⚠️ Severity Level</h3>
            </div>
            <div className="p-4 space-y-3">
              {severityOptions.map(({ level, label, desc, icon, color, bg, border, selectedBorder }) => (
                <motion.div
                  key={level}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => setSeverity(level as any)}
                  className="flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all"
                  style={{
                    background: severity === level ? bg : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${severity === level ? selectedBorder : border}`,
                    boxShadow: severity === level ? `0 0 16px ${bg}` : 'none',
                  }}
                >
                  <div className={`${color} shrink-0`}>{icon}</div>
                  <div className="flex-1">
                    <p className={`font-bold text-sm ${severity === level ? color : ''}`}>{label}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{desc}</p>
                  </div>
                  <div className="w-5 h-5 rounded-full flex items-center justify-center border-2 shrink-0 transition-all"
                    style={{ borderColor: severity === level ? selectedBorder : 'var(--border)', background: severity === level ? bg : 'transparent' }}>
                    {severity === level && <div className="w-2.5 h-2.5 rounded-full" style={{ background: selectedBorder }} />}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* ── Notes ── */}
          <div className="glass rounded-2xl overflow-hidden">
            <div className="px-5 py-3 md:py-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <h3 className="text-sm font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>📝 Additional Notes <span style={{ color: 'var(--text-muted)' }}>(Optional)</span></h3>
            </div>
            <div className="p-4">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="input-dark min-h-[80px] md:min-h-[100px] resize-none"
                placeholder="Add any helpful details — e.g. near the bus stop, causes tire damage..."
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Sticky Submit ── */}
      <div
        className="sticky bottom-0 left-0 right-0 p-4 md:static md:p-0 md:max-w-2xl md:mx-auto md:w-full"
        style={{
          background: 'linear-gradient(to top, var(--bg-primary) 70%, transparent)',
          paddingBottom: 'max(1rem, calc(0.5rem + env(safe-area-inset-bottom)))',
        }}
      >
        <form onSubmit={handleSubmit}>
          <motion.button
            type="submit"
            disabled={isSubmitting}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full py-4 rounded-2xl font-black text-white text-base transition-all flex items-center justify-center gap-3 disabled:opacity-60"
            style={{ background: isSubmitting ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #3b82f6, #0284c7)', boxShadow: isSubmitting ? 'none' : '0 8px 32px rgba(59,130,246,0.35)' }}
          >
            {isSubmitting ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Uploading &amp; Submitting…</>
            ) : (
              <><Brain className="w-5 h-5" /> Submit &amp; AI Verify</>
            )}
          </motion.button>
          <p className="text-center text-xs mt-2" style={{ color: 'var(--text-muted)' }}>Photo required • AI verifies pothole &amp; estimates depth automatically</p>
        </form>
      </div>
    </div>
  );
}
