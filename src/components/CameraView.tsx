import React, { useRef, useEffect, useState, useCallback } from 'react';
import { loadModel, detectPotholes, Detection } from '../services/detectionService';
import { auth } from '../firebase';
import { Camera, AlertTriangle, ShieldCheck, ArrowLeft, Zap, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { uploadPotholeImageFromBlob } from '../services/storageService';

interface CameraViewProps {
  onDetection: (detection: Detection, imageUrl: string) => void;
  onBack: () => void;
  gpsActive: boolean;
}

// Corner bracket for bounding box decoration
function drawCornerBracket(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  size: number, color: string, lineWidth: number
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  const s = Math.min(size, w * 0.3, h * 0.3);
  // TL
  ctx.beginPath(); ctx.moveTo(x, y + s); ctx.lineTo(x, y); ctx.lineTo(x + s, y); ctx.stroke();
  // TR
  ctx.beginPath(); ctx.moveTo(x + w - s, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + s); ctx.stroke();
  // BR
  ctx.beginPath(); ctx.moveTo(x + w, y + h - s); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - s, y + h); ctx.stroke();
  // BL
  ctx.beginPath(); ctx.moveTo(x + s, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - s); ctx.stroke();
}

export default function CameraView({ onDetection, onBack, gpsActive }: CameraViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const isProcessingRef = useRef(false);  // Prevents detection queue buildup
  const lastDetectionTime = useRef<number>(0);
  const fpsRef = useRef<{ frames: number; last: number; value: number }>({ frames: 0, last: Date.now(), value: 0 });
  const lastDetectionsRef = useRef<Detection[]>([]); // Keep last frame's detections for drawing during processing

  const [isModelLoading, setIsModelLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [showShutter, setShowShutter] = useState(false);
  const [showReportedToast, setShowReportedToast] = useState(false);
  const [fps, setFps] = useState(0);
  const [currentDetections, setCurrentDetections] = useState<Detection[]>([]);
  const [cameraReady, setCameraReady] = useState(false);

  // ──────────────────────────────────────────────
  // Camera setup
  // ──────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      // Fallback: any camera
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      if (videoRef.current) videoRef.current.srcObject = stream;
    }
  }, []);

  useEffect(() => {
    async function setup() {
      await loadModel();
      setIsModelLoading(false);
      await startCamera();
    }
    setup();
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  // ──────────────────────────────────────────────
  // Canvas sizing — match the video's DISPLAYED size
  // ──────────────────────────────────────────────
  const syncCanvasSize = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    // Use the element's rendered pixel dimensions (not stream resolution)
    const rect = video.getBoundingClientRect();
    if (canvas.width !== rect.width || canvas.height !== rect.height) {
      canvas.width = rect.width;
      canvas.height = rect.height;
    }
  }, []);

  // ──────────────────────────────────────────────
  // Drawing: bounding boxes + grid overlay
  // ──────────────────────────────────────────────
  const drawFrame = useCallback((detections: Detection[]) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    syncCanvasSize();

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const scaleX = W / (video.videoWidth || W);
    const scaleY = H / (video.videoHeight || H);
    const ROI_Y = H * 0.42; // Top of road detection zone

    ctx.clearRect(0, 0, W, H);

    // ── Subtle scan grid (bottom 58% only) ──
    ctx.save();
    ctx.strokeStyle = 'rgba(59,130,246,0.06)';
    ctx.lineWidth = 0.5;
    const gridSize = 36;
    for (let x = 0; x < W; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, ROI_Y); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = ROI_Y; y < H; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.restore();

    // ── ROI divider line ──
    ctx.save();
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, ROI_Y); ctx.lineTo(W, ROI_Y); ctx.stroke();
    ctx.restore();

    // ── Bounding boxes ──
    const potholes = detections.filter(d => d.class === 'pothole' && d.score > 0.45);
    const others = detections.filter(d => d.class !== 'pothole');

    // Draw non-pothole detections faintly
    ctx.save();
    others.forEach(d => {
      const [bx, by, bw, bh] = d.bbox;
      const x = bx * scaleX, y = by * scaleY, w = bw * scaleX, h = bh * scaleY;
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, w, h);
    });
    ctx.restore();

    // Draw potholes with corner brackets + glow
    potholes.forEach(d => {
      const [bx, by, bw, bh] = d.bbox;
      const x = bx * scaleX, y = by * scaleY, w = bw * scaleX, h = bh * scaleY;
      const pct = Math.round(d.score * 100);
      const isOnRoad = (by + bh / 2) * scaleY > ROI_Y;

      // Glow shadow
      ctx.save();
      ctx.shadowColor = isOnRoad ? '#ef4444' : 'rgba(239,68,68,0.3)';
      ctx.shadowBlur = isOnRoad ? 20 : 6;

      // Semi-transparent fill
      ctx.fillStyle = isOnRoad ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.03)';
      ctx.fillRect(x, y, w, h);

      // Corner brackets
      const bracketColor = isOnRoad ? '#ef4444' : 'rgba(239,68,68,0.35)';
      drawCornerBracket(ctx, x, y, w, h, 20, bracketColor, isOnRoad ? 3 : 1.5);
      ctx.restore();

      if (isOnRoad) {
        // Confidence pill label
        const label = `POTHOLE  ${pct}%`;
        ctx.save();
        ctx.font = 'bold 11px monospace';
        const tw = ctx.measureText(label).width;
        const lx = x;
        const ly = y > 28 ? y - 10 : y + h + 10;
        ctx.fillStyle = 'rgba(239,68,68,0.9)';
        ctx.beginPath();
        ctx.roundRect(lx, ly - 14, tw + 16, 18, 4);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillText(label, lx + 8, ly);
        ctx.restore();

        // Animated cross-hair center
        const cx = x + w / 2, cy = y + h / 2;
        const cht = 8;
        ctx.save();
        ctx.strokeStyle = 'rgba(239,68,68,0.7)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(cx - cht, cy); ctx.lineTo(cx + cht, cy); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, cy - cht); ctx.lineTo(cx, cy + cht); ctx.stroke();
        ctx.restore();
      }
    });
  }, [syncCanvasSize]);

  // ──────────────────────────────────────────────
  // Main render loop: draws every frame, detects every ~150ms if not busy
  // ──────────────────────────────────────────────
  useEffect(() => {
    if (isModelLoading) return;

    let frameCount = 0;
    const DETECT_EVERY_N_FRAMES = 5; // ~150ms at 30fps

    const loop = () => {
      animFrameRef.current = requestAnimationFrame(loop);

      // FPS counter
      fpsRef.current.frames++;
      const now = Date.now();
      if (now - fpsRef.current.last >= 1000) {
        const newFps = fpsRef.current.frames;
        fpsRef.current = { frames: 0, last: now, value: newFps };
        setFps(newFps);
      }

      // Always draw the last known detections (smooth visual)
      drawFrame(lastDetectionsRef.current);

      // Run detection only every N frames and only if not already processing
      frameCount++;
      if (frameCount % DETECT_EVERY_N_FRAMES === 0 && !isProcessingRef.current && videoRef.current?.readyState === 4) {
        isProcessingRef.current = true;
        detectPotholes(videoRef.current!).then(results => {
          const ROI_TOP_PERCENT = 0.42;
          const videoH = videoRef.current?.videoHeight || 1;
          const potholes = results.filter(d => {
            if (d.class !== 'pothole' || d.score < 0.45) return false;
            const centerY = d.bbox[1] + d.bbox[3] / 2;
            return (centerY / videoH) > ROI_TOP_PERCENT;
          });

          lastDetectionsRef.current = results;
          setCurrentDetections(potholes);

          // Auto-report throttle: at most once per 3 seconds
          if (potholes.length > 0) {
            const t = Date.now();
            if (t - lastDetectionTime.current > 3000) {
              lastDetectionTime.current = t;
              captureAndReport(potholes[0]);
            }
          }
        }).finally(() => {
          isProcessingRef.current = false;
        });
      }
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isModelLoading, drawFrame]);

  // ──────────────────────────────────────────────
  // Capture frame and report (fixed: uses Firebase auth, not Supabase auth)
  // ──────────────────────────────────────────────
  const captureAndReport = async (detection: Detection) => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser || !videoRef.current || isUploading) return;

    setIsUploading(true);
    setShowShutter(true);
    setTimeout(() => setShowShutter(false), 120);

    try {
      const cap = document.createElement('canvas');
      cap.width = videoRef.current.videoWidth;
      cap.height = videoRef.current.videoHeight;
      const capCtx = cap.getContext('2d');
      if (!capCtx) return;
      capCtx.drawImage(videoRef.current, 0, 0);

      const blob = await new Promise<Blob | null>(res => cap.toBlob(res, 'image/jpeg', 0.82));
      if (!blob) return;

      const reportId = `ai_${Date.now()}`;
      const imageUrl = await uploadPotholeImageFromBlob(blob, `reports/${firebaseUser.uid}/${reportId}.jpg`);
      onDetection(detection, imageUrl);

      setShowReportedToast(true);
      setTimeout(() => setShowReportedToast(false), 2500);
    } catch (err) {
      console.error('Capture/upload error:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const topPothole = currentDetections[0];
  const confidence = topPothole ? Math.round(topPothole.score * 100) : 0;
  const severityLabel = confidence >= 85 ? 'HIGH' : confidence >= 65 ? 'MEDIUM' : 'LOW';
  const severityColor = confidence >= 85 ? '#ef4444' : confidence >= 65 ? '#f97316' : '#eab308';

  return (
    <div className="relative w-full h-full bg-black overflow-hidden rounded-2xl shadow-2xl border border-zinc-800">
      {/* Live video */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
        onLoadedMetadata={() => {
          syncCanvasSize();
          setCameraReady(true);
        }}
      />

      {/* Detection overlay canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ mixBlendMode: 'normal' }}
      />

      {/* Shutter flash */}
      <AnimatePresence>
        {showShutter && (
          <motion.div
            initial={{ opacity: 0.8 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="absolute inset-0 bg-white z-[60] pointer-events-none"
          />
        )}
      </AnimatePresence>

      {/* Reported toast */}
      <AnimatePresence>
        {showReportedToast && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: -40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -40 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="absolute top-20 left-1/2 -translate-x-1/2 z-[70] pointer-events-none"
          >
            <div className="bg-emerald-500 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 border-2 border-white/20 whitespace-nowrap">
              <ShieldCheck className="w-5 h-5" />
              <span className="font-black uppercase tracking-widest text-xs">Auto-Reported!</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Model loading screen */}
      <AnimatePresence>
        {isModelLoading && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-black flex flex-col items-center justify-center gap-6"
          >
            <div className="relative w-20 h-20">
              <div className="absolute inset-0 rounded-full border-4 border-zinc-800" />
              <div className="absolute inset-0 rounded-full border-4 border-t-red-500 animate-spin" />
              <Zap className="absolute inset-0 m-auto w-8 h-8 text-red-500" />
            </div>
            <div className="text-center">
              <p className="text-white font-black text-lg uppercase tracking-widest">Loading AI Model</p>
              <p className="text-zinc-500 text-xs mt-1">Initializing TensorFlow lite engine...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Top-left HUD ── */}
      <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
        {/* AI status */}
        <div className="flex items-center gap-2 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
          <div className={`w-2 h-2 rounded-full ${isModelLoading ? 'bg-yellow-500 animate-pulse' : isUploading ? 'bg-blue-400 animate-pulse' : 'bg-red-500 animate-pulse'}`} />
          <span className="text-[10px] font-black uppercase tracking-widest text-white">
            {isModelLoading ? 'AI Init…' : isUploading ? 'Uploading' : 'AI Live'}
          </span>
        </div>

        {/* GPS */}
        <div className="flex items-center gap-2 bg-black/50 backdrop-blur-md px-3 py-1 rounded-lg border border-white/10">
          <div className={`w-1.5 h-1.5 rounded-full ${gpsActive ? 'bg-emerald-400' : 'bg-red-500 animate-pulse'}`} />
          <span className="text-[10px] font-mono text-zinc-300">GPS: {gpsActive ? 'LOCKED' : 'WAITING'}</span>
        </div>

        {/* FPS Counter */}
        {cameraReady && (
          <div className="flex items-center gap-2 bg-black/50 backdrop-blur-md px-3 py-1 rounded-lg border border-white/10">
            <Activity className="w-3 h-3 text-blue-400" />
            <span className="text-[10px] font-mono text-blue-300">{fps} FPS</span>
          </div>
        )}
      </div>

      {/* ── Top-right controls ── */}
      <div className="absolute top-4 right-4 z-20 flex gap-2">
        <button
          onClick={onBack}
          className="p-3 bg-black/50 hover:bg-black/70 backdrop-blur-md rounded-full transition-all border border-white/10 active:scale-90"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <button
          onClick={() => captureAndReport({ bbox: [0, 0, 0, 0], class: 'pothole', score: 1 })}
          className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full transition-all border border-white/10 active:scale-90"
          title="Manual Capture"
        >
          <Camera className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* ── Road zone label ── */}
      <div className="absolute pointer-events-none z-10" style={{ top: '42%', left: 0, right: 0 }}>
        <div className="flex items-center justify-center">
          <span className="px-3 py-0.5 bg-blue-500/20 border border-blue-500/30 rounded-full text-[8px] font-black text-blue-300 uppercase tracking-widest">
            ▼ Road Detection Zone ▼
          </span>
        </div>
      </div>

      {/* ── Scanning line animation ── */}
      <motion.div
        animate={{ top: ['42%', '100%', '42%'] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
        className="absolute left-0 right-0 h-px z-10 pointer-events-none"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(239,68,68,0.6), transparent)',
          boxShadow: '0 0 12px 2px rgba(239,68,68,0.3)',
        }}
      />

      {/* ── Live pothole alert banner ── */}
      <AnimatePresence>
        {currentDetections.length > 0 && (
          <motion.div
            key="alert"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="absolute bottom-20 left-4 right-4 z-20"
          >
            <div
              className="rounded-2xl p-4 flex items-center justify-between shadow-2xl border"
              style={{
                background: `${severityColor}18`,
                borderColor: `${severityColor}40`,
              }}
            >
              <div className="flex items-center gap-4">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `${severityColor}25` }}
                >
                  <AlertTriangle className="w-6 h-6 animate-pulse" style={{ color: severityColor }} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Road Hazard Detected</p>
                  <p className="font-black text-lg italic uppercase tracking-tighter text-white">Pothole Identified</p>
                  <p className="text-[10px] font-bold text-zinc-400 mt-0.5">{currentDetections.length} pothole{currentDetections.length > 1 ? 's' : ''} in frame</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <div
                  className="px-3 py-1 rounded-lg font-black text-sm text-white"
                  style={{ background: severityColor }}
                >
                  {confidence}%
                </div>
                <span
                  className="text-[9px] font-black uppercase tracking-widest"
                  style={{ color: severityColor }}
                >
                  {severityLabel}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Bottom info bar ── */}
      <div className="absolute bottom-4 left-4 right-4 z-10">
        <div className="bg-black/60 backdrop-blur-xl p-3 rounded-2xl border border-white/10 text-center">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-0.5">Simulation Mode</p>
          <p className="text-[9px] text-zinc-500">
            Point at a <span className="text-white">bowl · cup · bottle · phone</span> to simulate pothole detection
          </p>
        </div>
      </div>
    </div>
  );
}
