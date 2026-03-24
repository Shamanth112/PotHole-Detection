import React, { useState, useEffect, useRef } from 'react';
import { Upload, MapPin, CheckCircle2, AlertTriangle, Info, ArrowLeft, Loader2, Camera, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useConvex } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { uploadToConvex } from '../services/storageService';
import { Id } from '../../convex/_generated/dataModel';

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

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            address: 'Auto-detected location'
          });
          setIsLocating(false);
        },
        (error) => {
          console.error("Error getting location:", error);
          // Fallback to default if denied
          setLocation({
            lat: 40.7128,
            lng: -74.0060,
            address: 'Default Location (GPS Disabled)'
          });
          setIsLocating(false);
        }
      );
    } else {
      setIsLocating(false);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      alert("Please upload a photo of the pothole.");
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      let reportImageId: string | undefined;
      let reportImageUrl: string | undefined;
      
      try {
        reportImageId = await uploadToConvex(convex, selectedFile);
        // resolve to URL so we have it for older views / map markers
        reportImageUrl = await convex.query(api.storage.getImageUrl, { storageId: reportImageId as Id<"_storage"> }) as string;
      } catch (uploadError: any) {
        console.error("Upload error:", uploadError);
        throw new Error(`Photo upload failed: ${uploadError.message || 'Check storage permissions'}`);
      }

      onSubmit({ 
        severity, 
        notes,
        latitude: location?.lat || 40.7128,
        longitude: location?.lng || -74.0060,
        address: location?.address || 'Unknown Location',
        reportImageId,
        reportImageUrl
      });
    } catch (error: any) {
      console.error("Error submitting report:", error);
      alert(error.message || "Failed to submit report. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <header className="bg-[#1a365d] text-white p-6 flex items-center gap-4 shadow-lg">
        <button onClick={onBack} className="p-1 hover:bg-white/10 rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-bold tracking-tight">Report Pothole</h1>
      </header>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex-1 p-6 flex flex-col gap-8 overflow-y-auto">
        {/* Photo Evidence */}
        <section>
          <h3 className="text-sm font-bold text-[#4a5568] mb-4 uppercase tracking-wider">Photo Evidence</h3>
          {!previewUrl ? (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="aspect-video border-2 border-dashed border-[#cbd5e0] rounded-2xl flex flex-col items-center justify-center gap-4 bg-[#f7fafc] hover:bg-[#edf2f7] transition-all cursor-pointer"
            >
              <Camera className="w-12 h-12 text-[#a0aec0]" />
              <div className="text-center">
                <p className="font-bold text-[#4a5568]">Tap to take photo</p>
                <p className="text-xs text-[#718096]">or upload from gallery</p>
              </div>
            </div>
          ) : (
            <div className="relative aspect-video rounded-2xl overflow-hidden border-2 border-[#1a365d] shadow-lg">
              <img src={previewUrl} className="w-full h-full object-cover" alt="Preview" />
              <button 
                type="button"
                onClick={clearSelection}
                className="absolute top-4 right-4 p-2 bg-black/60 rounded-full text-white hover:bg-black/80"
              >
                <X className="w-5 h-5" />
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
        </section>

        {/* Location */}
        <section>
          <h3 className="text-sm font-bold text-[#4a5568] mb-4 uppercase tracking-wider">Location</h3>
          <div className="p-5 bg-white border border-[#e2e8f0] rounded-2xl flex items-center gap-4 shadow-sm relative overflow-hidden group">
            <div className="w-12 h-12 bg-[#ebf8ff] rounded-xl flex items-center justify-center shrink-0">
              {isLocating ? (
                <Loader2 className="w-6 h-6 text-[#3182ce] animate-spin" />
              ) : (
                <MapPin className="w-6 h-6 text-[#3182ce]" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-[#2d3748] text-sm">
                {isLocating ? 'Detecting Location...' : 'Auto-detected (GPS)'}
              </p>
              <p className="text-xs text-[#718096] truncate">
                {location?.address || 'Waiting for GPS...'}
              </p>
              {location && (
                <p className="text-[10px] text-[#a0aec0] font-mono">
                  {location.lat.toFixed(4)}° N, {location.lng.toFixed(4)}° W
                </p>
              )}
            </div>
            {!isLocating && <CheckCircle2 className="w-6 h-6 text-[#48bb78] shrink-0" />}
          </div>
        </section>

        {/* Severity Level */}
        <section>
          <h3 className="text-sm font-bold text-[#4a5568] mb-4 uppercase tracking-wider">Severity Level</h3>
          <div className="flex flex-col gap-3">
            <SeverityCard 
              level="low" 
              label="Low" 
              description="Minor damage, safe to drive" 
              selected={severity === 'low'} 
              onClick={() => setSeverity('low')} 
            />
            <SeverityCard 
              level="medium" 
              label="Medium" 
              description="Noticeable damage, caution advised" 
              selected={severity === 'medium'} 
              onClick={() => setSeverity('medium')} 
            />
            <SeverityCard 
              level="high" 
              label="High" 
              description="Severe damage, avoid if possible" 
              selected={severity === 'high'} 
              onClick={() => setSeverity('high')} 
            />
          </div>
        </section>

        {/* Additional Notes */}
        <section>
          <h3 className="text-sm font-bold text-[#4a5568] mb-4 uppercase tracking-wider">Additional Notes (Optional)</h3>
          <textarea 
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full p-4 bg-white border border-[#e2e8f0] rounded-2xl text-sm focus:ring-2 focus:ring-[#3182ce] outline-none transition-all min-h-[120px]"
            placeholder="Add any additional details..."
          />
        </section>

        {/* Submit Button */}
        <div className="mt-auto pt-6 flex flex-col gap-4">
          <button 
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all active:scale-95 flex items-center justify-center gap-3 ${
              isSubmitting ? 'bg-[#a0aec0]' : 'bg-[#1a365d] hover:bg-[#152a4a]'
            }`}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Report'}
          </button>
          <p className="text-center text-xs text-[#718096]">Please upload a photo to continue</p>
        </div>
      </form>
    </div>
  );
}

function SeverityCard({ level, label, description, selected, onClick }: { level: string; label: string; description: string; selected: boolean; onClick: () => void }) {
  return (
    <div 
      onClick={onClick}
      className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between ${
        selected ? 'border-[#1a365d] bg-[#ebf8ff]' : 'border-[#e2e8f0] bg-white hover:border-[#cbd5e0]'
      }`}
    >
      <div className="flex flex-col gap-1">
        <p className="font-bold text-[#2d3748]">{label}</p>
        <p className="text-xs text-[#718096]">{description}</p>
      </div>
      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
        selected ? 'border-[#1a365d]' : 'border-[#cbd5e0]'
      }`}>
        {selected && <div className="w-3 h-3 bg-[#1a365d] rounded-full" />}
      </div>
    </div>
  );
}
