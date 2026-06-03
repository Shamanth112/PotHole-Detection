import React, { useState } from 'react';
import { Upload, MapPin, CheckCircle2, AlertTriangle, Info, ArrowLeft, Loader2, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useConvex } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { uploadToConvex } from '../services/storageService';
import { Id } from '@/convex/_generated/dataModel';
import { useEffect, useRef } from 'react';

interface ReportViewProps {
  onBack: () => void;
  onSubmit: (data: any) => void;
  userId: string;
}

export default function ReportView({ onBack, onSubmit, userId }: ReportViewProps) {
  const convex = useConvex();
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high'>('medium');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [isLocating, setIsLocating] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
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
      onSubmit({ severity, notes, latitude: location?.lat || 40.7128, longitude: location?.lng || -74.0060, address: location?.address || 'Unknown Location', reportImageId, reportImageUrl });
    } catch (error: any) {
      alert(error.message || "Failed to submit report.");
    } finally { setIsSubmitting(false); }
  };

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
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Help improve road safety in your city</p>
          </div>
        </div>

        {/* Form sections — fields read from React state, submit is in sticky footer */}
        <div className="space-y-4 md:space-y-6">
          {/* ── Photo Upload ── */}
        <div className="glass rounded-2xl overflow-hidden">
          <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <h3 className="text-sm font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>📸 Photo Evidence</h3>
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
                  <span className="text-xs font-semibold text-white">Photo ready</span>
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
        </div>{/* end notes card */}
        </div>{/* end space-y fields wrapper */}
      </div>{/* end scrollable content */}

      {/* ── Sticky Submit — pinned to bottom on mobile ── */}
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
              <><Loader2 className="w-5 h-5 animate-spin" /> Submitting...</>
            ) : (
              <><CheckCircle2 className="w-5 h-5" /> Submit Report</>
            )}
          </motion.button>
          <p className="text-center text-xs mt-2" style={{ color: 'var(--text-muted)' }}>Photo is required. Your location will be attached automatically.</p>
        </form>
      </div>
    </div>
  );
}
