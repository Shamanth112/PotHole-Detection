import React, { useRef, useEffect, useState, useCallback } from 'react';
import { loadModel, detectPotholes, isModelLoaded, getModelError, resetModel, Detection } from '../services/detectionService';
import { useConvex } from 'convex/react';
import { Camera, AlertTriangle, ShieldCheck, ArrowLeft, Zap, Activity, PackageOpen, MapPin, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { uploadToConvex } from '../services/storageService';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';

interface CameraViewProps {
  onDetection: (detection: Detection, imageUrl: string) => void;
  onBack: () => void;
  gpsActive: boolean;
  userLocation: { lat: number; lng: number } | null;
}

// Haversine distance in metres between two GPS points
function haversineMetres(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const c = sinLat * sinLat + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * sinLng * sinLng;
  return R * 2 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c));
}

const MIN_REPORT_DISTANCE_M = 25; // Don't re-report within 25 m of a previous report

/** Draw corner-bracket bounding box */
function drawBracketBox(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  color: string, lineWidth: number
) {
  const s = Math.min(22, w * 0.28, h * 0.28);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, y + s); ctx.lineTo(x, y); ctx.lineTo(x + s, y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + w - s, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + s); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + w, y + h - s); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - s, y + h); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + s, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - s); ctx.stroke();
}

interface SessionReport {
  id: string;
  thumbnail: string;
  confidence: number;
  lat?: number;
  lng?: number;
  time: string;
}

export default function CameraView({ onDetection, onBack, gpsActive, userLocation }: CameraViewProps) {
  const convex = useConvex();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const isProcessingRef = useRef(false);
  const lastReportLocations = useRef<Array<{ lat: number; lng: number }>>([]);
  const lastDetectionTime = useRef<number>(0);
  const lastDetectionsRef = useRef<Detection[]>([]);
  const fpsRef = useRef<{ frames: number; last: number }>({ frames: 0, last: Date.now() });

  const [modelStatus, setModelStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [modelErrorMsg, setModelErrorMsg] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [showShutter, setShowShutter] = useState(false);
  const [fps, setFps] = useState(0);
  const [liveDetections, setLiveDetections] = useState<Detection[]>([]);
  const [cameraReady, setCameraReady] = useState(false);
  const [sessionReports, setSessionReports] = useState<SessionReport[]>([]);
  const [showReportedToast, setShowReportedToast] = useState<string | null>(null); // confidence string

  // ── Camera ──────────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      if (videoRef.current) videoRef.current.srcObject = stream;
    }
  }, []);

  // Track userLocation in a ref so the render loop doesn't restart on every GPS update
  const userLocationRef = useRef(userLocation);
  useEffect(() => { userLocationRef.current = userLocation; }, [userLocation]);

  // ── Initialization: start camera + load model in PARALLEL ──────────────────
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      // Start camera immediately — don't wait for model
      startCamera().catch(err => console.error('[Camera] Failed to start:', err));

      try {
        await loadModel();
        if (!cancelled) setModelStatus('ready');
      } catch (err: any) {
        if (!cancelled) {
          setModelErrorMsg(err?.message || String(err));
          setModelStatus('error');
        }
      }
    };

    init();

    return () => {
      cancelled = true;
      cancelAnimationFrame(animFrameRef.current);
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  // ── Canvas sync ──────────────────────────────────────────────────────────
  const syncCanvas = useCallback(() => {
    const v = videoRef.current, c = canvasRef.current;
    if (!v || !c) return;
    const r = v.getBoundingClientRect();
    if (c.width !== r.width || c.height !== r.height) { c.width = r.width; c.height = r.height; }
  }, []);

  // ── Drawing ──────────────────────────────────────────────────────────────
  const drawOverlay = useCallback((detections: Detection[]) => {
    const canvas = canvasRef.current, video = videoRef.current;
    if (!canvas || !video) return;
    syncCanvas();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    const scaleX = W / (video.videoWidth || 1);
    const scaleY = H / (video.videoHeight || 1);
    const ROI_Y = H * 0.25;

    ctx.clearRect(0, 0, W, H);

    // Grid
    ctx.save();
    ctx.strokeStyle = 'rgba(59,130,246,0.06)';
    ctx.lineWidth = 0.5;
    const g = 36;
    for (let x = 0; x < W; x += g) { ctx.beginPath(); ctx.moveTo(x, ROI_Y); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = ROI_Y; y < H; y += g) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.restore();

    // ROI line
    ctx.save();
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, ROI_Y); ctx.lineTo(W, ROI_Y); ctx.stroke();
    ctx.restore();

    // Boxes
    detections.forEach(d => {
      if (d.class !== 'pothole') return;
      const [bx, by, bw, bh] = d.bbox;
      const x = bx * scaleX, y = by * scaleY, w = bw * scaleX, h = bh * scaleY;
      const pct = Math.round(d.score * 100);
      const onRoad = (by + bh / 2) * scaleY > ROI_Y;
      const color = onRoad ? (pct >= 80 ? '#ef4444' : pct >= 60 ? '#f97316' : '#eab308') : 'rgba(239,68,68,0.3)';

      ctx.save();
      ctx.shadowColor = color; ctx.shadowBlur = onRoad ? 18 : 4;
      ctx.fillStyle = onRoad ? `${color}12` : `${color}06`;
      ctx.fillRect(x, y, w, h);
      drawBracketBox(ctx, x, y, w, h, color, onRoad ? 2.5 : 1.2);
      ctx.restore();

      if (onRoad) {
        const label = `POTHOLE  ${pct}%`;
        ctx.save();
        ctx.font = 'bold 11px monospace';
        const tw = ctx.measureText(label).width + 16;
        const ly = y > 28 ? y - 10 : y + h + 10;
        ctx.fillStyle = color;
        ctx.beginPath(); (ctx as any).roundRect(x, ly - 14, tw, 18, 4); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.fillText(label, x + 8, ly);
        ctx.restore();

        const cx = x + w / 2, cy = y + h / 2, cs = 9;
        ctx.save();
        ctx.strokeStyle = `${color}aa`; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(cx - cs, cy); ctx.lineTo(cx + cs, cy); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, cy - cs); ctx.lineTo(cx, cy + cs); ctx.stroke();
        ctx.restore();
      }
    });
  }, [syncCanvas]);

  // ── Render loop ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (modelStatus !== 'ready') return;
    let frameCount = 0;

    const loop = () => {
      animFrameRef.current = requestAnimationFrame(loop);
      fpsRef.current.frames++;
      const now = Date.now();
      if (now - fpsRef.current.last >= 1000) {
        setFps(fpsRef.current.frames);
        fpsRef.current = { frames: 0, last: now };
      }

      drawOverlay(lastDetectionsRef.current);

      frameCount++;
      const video = videoRef.current;
      if (frameCount % 5 === 0 && !isProcessingRef.current && video?.readyState === 4) {
        isProcessingRef.current = true;
        detectPotholes(video).then(results => {
          const videoH = video.videoHeight || 1;
          const filtered = results.filter(d =>
            d.class === 'pothole' && d.score >= 0.25 &&
            (d.bbox[1] + d.bbox[3] / 2) / videoH > 0.25
          );
          lastDetectionsRef.current = results;
          setLiveDetections(filtered);

          if (filtered.length > 0) {
            const t = Date.now();
            // Time throttle: at least 1.5 s between captures
            if (t - lastDetectionTime.current > 1500) {
              // Location dedup: don't re-report within MIN_REPORT_DISTANCE_M
              const loc = userLocationRef.current; // use ref — no loop restart on GPS change
              const tooClose = loc ? lastReportLocations.current.some(
                prev => haversineMetres(prev, loc) < MIN_REPORT_DISTANCE_M
              ) : false;

              if (!tooClose) {
                lastDetectionTime.current = t;
                if (loc) lastReportLocations.current.push({ lat: loc.lat, lng: loc.lng });
                captureAndReport(filtered[0]);
              }
            }
          }
        }).catch(console.error).finally(() => { isProcessingRef.current = false; });
      }
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [modelStatus, drawOverlay]); // userLocation is now read via ref — no restart on GPS updates

  // ── Capture + report ──────────────────────────────────────────────────────
  const captureAndReport = async (detection: Detection) => {
    if (!videoRef.current || isUploading) return;

    setIsUploading(true);
    setShowShutter(true);
    setTimeout(() => setShowShutter(false), 110);

    try {
      const cap = document.createElement('canvas');
      cap.width = videoRef.current.videoWidth;
      cap.height = videoRef.current.videoHeight;
      cap.getContext('2d')!.drawImage(videoRef.current, 0, 0);

      // Thumbnail for session strip
      const thumb = document.createElement('canvas');
      thumb.width = 80; thumb.height = 56;
      thumb.getContext('2d')!.drawImage(cap, 0, 0, 80, 56);
      const thumbUrl = thumb.toDataURL('image/jpeg', 0.7);

      const blob = await new Promise<Blob | null>(r => cap.toBlob(r, 'image/jpeg', 0.85));
      if (!blob) return;

      const storageId = await uploadToConvex(convex, blob);
      const url = await convex.query(api.storage.getImageUrl, { storageId: storageId as Id<"_storage"> }) as string;
      
      onDetection(detection, url);

      const conf = Math.round(detection.score * 100);
      setSessionReports(prev => [{
        id: Date.now().toString(),
        thumbnail: thumbUrl,
        confidence: conf,
        lat: userLocation?.lat,
        lng: userLocation?.lng,
        time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      }, ...prev.slice(0, 11)]); // keep last 12

      setShowReportedToast(`${conf}% · Pothole Logged`);
      setTimeout(() => setShowReportedToast(null), 2000);
    } catch (e) {
      console.error('Capture error:', e);
    } finally {
      setIsUploading(false);
    }
  };

  const topHit = liveDetections[0];
  const conf = topHit ? Math.round(topHit.score * 100) : 0;
  const severity = conf >= 80 ? { label: 'HIGH', color: '#ef4444' }
    : conf >= 60 ? { label: 'MEDIUM', color: '#f97316' }
    : { label: 'LOW', color: '#eab308' };

  // ── Error screen ──────────────────────────────────────────────────────────
  if (modelStatus === 'error') {
    return (
      <div className="relative w-full h-full bg-zinc-950 rounded-2xl border border-zinc-800 flex flex-col items-center justify-center p-8 gap-6">
        <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-500/20">
          <PackageOpen className="w-8 h-8 text-amber-500" />
        </div>
        <div className="text-center max-w-sm">
          <h3 className="text-white font-black text-lg uppercase tracking-tight mb-2">YOLO Model Not Found</h3>
          <p className="text-zinc-400 text-xs leading-relaxed mb-4">
            Place your exported <span className="text-white font-mono">best.onnx</span> in the <span className="text-white font-mono">public/</span> folder and set <span className="text-white font-mono">VITE_MODEL_URL=/best.onnx</span> in <span className="text-white font-mono">.env</span>.
          </p>
          <div className="bg-black rounded-xl p-4 text-left border border-zinc-800">
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Export Command</p>
            <p className="text-emerald-400 font-mono text-xs">yolo export model=best.pt \</p>
            <p className="text-emerald-400 font-mono text-xs pl-4">format=onnx imgsz=640</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => {
              resetModel();
              setModelErrorMsg('');
              setModelStatus('loading');
              loadModel()
                .then(() => setModelStatus('ready'))
                .catch(err => { setModelErrorMsg(err?.message || String(err)); setModelStatus('error'); });
            }}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold transition-all"
          >
            <Zap className="w-4 h-4" /> Retry
          </button>
          <button onClick={onBack} className="flex items-center gap-2 px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-sm font-bold transition-all">
            <ArrowLeft className="w-4 h-4" /> Go Back
          </button>
        </div>
        {modelErrorMsg && (
          <p className="text-red-400/60 text-[10px] font-mono max-w-sm text-center break-all">{modelErrorMsg}</p>
        )}
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-black overflow-hidden rounded-2xl shadow-2xl border border-zinc-800 flex flex-col">
      {/* ── Video + Canvas ── */}
      <div className="relative flex-1 min-h-0">
        <video ref={videoRef} autoPlay playsInline muted
          className="absolute inset-0 w-full h-full object-cover"
          onLoadedMetadata={() => { syncCanvas(); setCameraReady(true); }}
        />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

        {/* Shutter */}
        <AnimatePresence>
          {showShutter && (
            <motion.div initial={{ opacity: 0.7 }} animate={{ opacity: 0 }} transition={{ duration: 0.11 }}
              className="absolute inset-0 bg-white z-[60] pointer-events-none" />
          )}
        </AnimatePresence>

        {/* Reported toast */}
        <AnimatePresence>
          {showReportedToast && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: -30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: -30 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="absolute top-20 left-1/2 -translate-x-1/2 z-[70] pointer-events-none"
            >
              <div className="bg-emerald-500 text-white px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-2.5 border-2 border-white/20 whitespace-nowrap">
                <CheckCircle2 className="w-4 h-4" />
                <span className="font-black text-xs uppercase tracking-widest">{showReportedToast}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Model loading */}
        <AnimatePresence>
          {modelStatus === 'loading' && (
            <motion.div initial={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 bg-black flex flex-col items-center justify-center gap-6">
              <div className="relative w-20 h-20">
                <div className="absolute inset-0 rounded-full border-4 border-zinc-800" />
                <div className="absolute inset-0 rounded-full border-4 border-t-red-500 animate-spin" />
                <Zap className="absolute inset-0 m-auto w-8 h-8 text-red-500" />
              </div>
              <div className="text-center">
                <p className="text-white font-black text-lg uppercase tracking-widest">Loading YOLO Model</p>
                <p className="text-zinc-500 text-xs mt-1">Initializing ONNX Runtime WebAssembly…</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Top-left HUD ── */}
        <div className="absolute top-3 left-3 z-20 flex flex-col gap-1.5">
          <div className="flex items-center gap-2 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
            <div className={`w-2 h-2 rounded-full animate-pulse ${isUploading ? 'bg-blue-400' : modelStatus === 'ready' ? 'bg-red-500' : 'bg-yellow-500'}`} />
            <span className="text-[10px] font-black uppercase tracking-widest text-white">
              {isUploading ? 'Saving…' : 'YOLO Patrol'}
            </span>
          </div>
          <div className="flex items-center gap-2 bg-black/50 backdrop-blur-md px-3 py-1 rounded-lg border border-white/10">
            <div className={`w-1.5 h-1.5 rounded-full ${gpsActive ? 'bg-emerald-400' : 'bg-red-500 animate-pulse'}`} />
            <span className="text-[10px] font-mono text-zinc-300">GPS: {gpsActive ? 'LOCKED' : 'WAITING'}</span>
          </div>
          {cameraReady && (
            <div className="flex items-center gap-2 bg-black/50 backdrop-blur-md px-3 py-1 rounded-lg border border-white/10">
              <Activity className="w-3 h-3 text-blue-400" />
              <span className="text-[10px] font-mono text-blue-300">{fps} FPS</span>
            </div>
          )}
        </div>

        {/* ── Session counter (top-center) ── */}
        {sessionReports.length > 0 && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20">
            <div className="flex items-center gap-2 bg-red-600/90 backdrop-blur-md px-4 py-1.5 rounded-full border border-red-400/30 shadow-lg">
              <MapPin className="w-3.5 h-3.5 text-white" />
              <span className="text-white font-black text-xs uppercase tracking-widest">
                {sessionReports.length} Pothole{sessionReports.length > 1 ? 's' : ''} Logged
              </span>
            </div>
          </div>
        )}

        {/* ── Top-right controls ── */}
        <div className="absolute top-3 right-3 z-20 flex gap-2">
          <button onClick={onBack}
            className="p-2.5 bg-black/50 hover:bg-black/70 backdrop-blur-md rounded-full border border-white/10 transition-all active:scale-90">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <button onClick={() => { if (liveDetections[0]) captureAndReport(liveDetections[0]); }}
            className="p-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full border border-white/10 transition-all active:scale-90" title="Manual Capture">
            <Camera className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* ── Road zone label ── */}
        <div className="absolute pointer-events-none z-10" style={{ top: '25%', left: 0, right: 0 }}>
          <div className="flex items-center justify-center">
            <span className="px-3 py-0.5 bg-blue-500/20 border border-blue-500/30 rounded-full text-[8px] font-black text-blue-300 uppercase tracking-widest">
              ▼ Road Patrol Zone ▼
            </span>
          </div>
        </div>

        {/* ── Scanning line ── */}
        <motion.div
          animate={{ top: ['25%', '100%', '25%'] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: 'linear' }}
          className="absolute left-0 right-0 h-px z-10 pointer-events-none"
          style={{ background: 'linear-gradient(90deg,transparent,rgba(239,68,68,0.55),transparent)', boxShadow: '0 0 10px 2px rgba(239,68,68,0.25)' }}
        />

        {/* ── Live alert ── */}
        <AnimatePresence>
          {liveDetections.length > 0 && (
            <motion.div
              key="alert"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              className="absolute bottom-3 left-3 right-3 z-20"
            >
              <div className="rounded-2xl p-3.5 flex items-center justify-between shadow-2xl border"
                style={{ background: `${severity.color}14`, borderColor: `${severity.color}38` }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `${severity.color}22` }}>
                    <AlertTriangle className="w-5 h-5 animate-pulse" style={{ color: severity.color }} />
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Road Hazard · YOLO</p>
                    <p className="font-black text-base italic uppercase tracking-tighter text-white">Pothole Detected</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-0.5 shrink-0">
                  <div className="px-2.5 py-1 rounded-lg font-black text-sm text-white" style={{ background: severity.color }}>{conf}%</div>
                  <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: severity.color }}>{severity.label}</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Session thumbnail strip ── */}
      <AnimatePresence>
        {sessionReports.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="bg-zinc-950 border-t border-zinc-800 px-3 py-2 overflow-hidden"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">
                Session Reports — {sessionReports.length} Logged
              </span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {sessionReports.map(r => (
                <motion.div
                  key={r.id}
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="shrink-0 relative"
                >
                  <img src={r.thumbnail} className="w-16 h-11 object-cover rounded-lg border border-zinc-700" alt="detected" />
                  <div className="absolute bottom-0 left-0 right-0 bg-black/70 rounded-b-lg px-1 py-0.5 text-center">
                    <span className="text-[7px] font-black text-red-400">{r.confidence}%</span>
                  </div>
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border border-zinc-950" />
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
