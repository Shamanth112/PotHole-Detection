import React, { useRef, useEffect, useState } from 'react';
import { loadModel, detectPotholes, Detection } from '../services/detectionService';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Camera, AlertTriangle, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CameraViewProps {
  onDetection: (detection: Detection) => void;
}

export default function CameraView({ onDetection }: CameraViewProps) {
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
        const potholes = results.filter(d => d.class === 'pothole' && d.score > 0.6);
        
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

    // Get GPS location
    navigator.geolocation.getCurrentPosition(async (position) => {
      const { latitude, longitude } = position.coords;
      
      try {
        await addDoc(collection(db, 'potholes'), {
          latitude,
          longitude,
          timestamp: serverTimestamp(),
          severity: detection.score > 0.8 ? 'high' : 'medium',
          userId: auth.currentUser?.uid,
          class: detection.class
        });
        onDetection(detection);
      } catch (error) {
        console.error("Error saving pothole:", error);
      }
    });
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
      
      <div className="absolute top-4 left-4 z-10">
        <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20">
          <div className={`w-2 h-2 rounded-full ${isModelLoading ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`} />
          <span className="text-xs font-medium text-white">
            {isModelLoading ? 'AI Loading...' : 'AI Active'}
          </span>
        </div>
      </div>

      <AnimatePresence>
        {detections.some(d => d.class === 'pothole') && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20"
          >
            <div className="bg-red-600 text-white px-6 py-3 rounded-2xl shadow-xl flex items-center gap-3 border-2 border-red-400">
              <AlertTriangle className="w-6 h-6 animate-bounce" />
              <span className="font-bold text-lg uppercase tracking-wider">Pothole Detected!</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute top-4 right-4 z-10">
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
