import React, { useRef, useEffect, useState } from 'react';
import { loadModel, detectPotholes, Detection } from '../services/detectionService';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Camera, AlertTriangle, ShieldCheck, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CameraViewProps {
  onDetection: (detection: Detection) => void;
  onBack: () => void;
  gpsActive: boolean;
}

export default function CameraView({ onDetection, onBack, gpsActive }: CameraViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const lastDetectionTime = useRef<number>(0);

  useEffect(() => {
    async function setup() {
      await loadModel();
      setIsModelLoading(false);
      startCamera();
    }
    setup();
  }, []);

  const startCamera = async () => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    }
  };

  useEffect(() => {
    let animationFrameId: number;

    const render = async () => {
      if (videoRef.current && videoRef.current.readyState === 4 && !isModelLoading) {
        const results = await detectPotholes(videoRef.current);
        setDetections(results);
        
        // Filter for potholes (mocked as 'pothole' in service)
        // Focus on the road by only considering detections in the lower 60% of the screen
        const potholes = results.filter(d => {
          const isPothole = d.class === 'pothole' && d.score > 0.6;
          const [x, y, width, height] = d.bbox;
          const videoHeight = videoRef.current?.videoHeight || 1;
          const isOnRoad = (y + height / 2) > (videoHeight * 0.4); // Lower 60%
          return isPothole && isOnRoad;
        });
        
        if (potholes.length > 0) {
          const now = Date.now();
          if (now - lastDetectionTime.current > 3000) { // Throttle uploads to 3 seconds
            handlePotholeDetected(potholes[0]);
            lastDetectionTime.current = now;
          }
        }

        drawBoundingBoxes(results);
      }
      animationFrameId = requestAnimationFrame(render);
    };

    if (!isModelLoading) {
      render();
    }

    return () => cancelAnimationFrame(animationFrameId);
  }, [isModelLoading]);

  const drawBoundingBoxes = (detections: Detection[]) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !videoRef.current) return;

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    
    detections.forEach(d => {
      const [x, y, width, height] = d.bbox;
      ctx.strokeStyle = d.class === 'pothole' ? '#ef4444' : '#3b82f6';
      ctx.lineWidth = 4;
      ctx.strokeRect(x, y, width, height);

      ctx.fillStyle = d.class === 'pothole' ? '#ef4444' : '#3b82f6';
      ctx.font = '16px sans-serif';
      ctx.fillText(`${d.class} (${Math.round(d.score * 100)}%)`, x, y > 10 ? y - 5 : 10);
    });
  };

  const handlePotholeDetected = async (detection: Detection) => {
    if (!auth.currentUser) return;
    onDetection(detection);
  };

  return (
    <div className="relative w-full h-full bg-black overflow-hidden rounded-2xl shadow-2xl border-4 border-zinc-800">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
        onLoadedMetadata={() => {
          if (canvasRef.current && videoRef.current) {
            canvasRef.current.width = videoRef.current.videoWidth;
            canvasRef.current.height = videoRef.current.videoHeight;
          }
        }}
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
      />
      
      {/* Scanning Line */}
      <motion.div 
        animate={{ top: ['0%', '100%', '0%'] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
        className="absolute left-0 right-0 h-px bg-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.5)] z-10 pointer-events-none"
      />
      
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
        <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20">
          <div className={`w-2 h-2 rounded-full ${isModelLoading ? 'bg-yellow-500 animate-pulse' : 'bg-red-600 animate-pulse'}`} />
          <span className="text-[10px] font-black uppercase tracking-widest text-white">
            {isModelLoading ? 'AI Loading...' : 'AI ACTIVE'}
          </span>
        </div>
        <div className="bg-black/40 backdrop-blur-md px-3 py-1 rounded-lg border border-white/10 flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${gpsActive ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`} />
          <span className="text-[10px] font-mono text-zinc-300">
            GPS: {gpsActive ? 'LOCKED' : 'WAITING'}
          </span>
        </div>
        <div className="bg-black/40 backdrop-blur-md px-3 py-1 rounded-lg border border-white/10">
          <span className="text-[10px] font-mono text-zinc-300">
            {new Date().toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* Simulation Info */}
      <div className="absolute bottom-4 left-4 right-4 z-10">
        <div className="bg-black/60 backdrop-blur-xl p-3 rounded-2xl border border-white/10 text-center">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Simulation Mode</p>
          <p className="text-[9px] text-zinc-500">
            Use a <span className="text-white">cell phone, cup, bottle, or remote</span> as a stand-in for a pothole to test detection.
          </p>
        </div>
      </div>

      <AnimatePresence>
        {detections.some(d => d.class === 'pothole' && d.score > 0.6) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20 w-full px-6"
          >
            <div className="bg-red-600/90 backdrop-blur-xl text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between border border-red-400/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-white animate-pulse" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Detection Alert</p>
                  <p className="font-black text-xl italic uppercase tracking-tighter">Pothole Identified</p>
                </div>
              </div>
              <div className="bg-white text-red-600 px-3 py-1 rounded-lg font-black text-sm">
                {Math.round((detections.find(d => d.class === 'pothole')?.score || 0) * 100)}%
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <button 
          onClick={onBack}
          className="p-3 bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-full transition-colors border border-white/20"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <button 
          onClick={() => setIsDetecting(!isDetecting)}
          className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full transition-colors border border-white/20"
        >
          <Camera className="w-5 h-5 text-white" />
        </button>
      </div>
    </div>
  );
}
