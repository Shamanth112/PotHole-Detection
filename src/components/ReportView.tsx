import React, { useState, useEffect } from 'react';
import { Upload, MapPin, CheckCircle2, AlertTriangle, Info, ArrowLeft, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

interface ReportViewProps {
  onBack: () => void;
  onSubmit: (data: any) => void;
}

export default function ReportView({ onBack, onSubmit }: ReportViewProps) {
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high'>('medium');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [isLocating, setIsLocating] = useState(true);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate submission
    setTimeout(() => {
      onSubmit({ 
        severity, 
        notes,
        latitude: location?.lat || 40.7128,
        longitude: location?.lng || -74.0060,
        address: location?.address || 'Unknown Location'
      });
      setIsSubmitting(false);
    }, 1500);
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
          <div className="aspect-video border-2 border-dashed border-[#cbd5e0] rounded-2xl flex flex-col items-center justify-center gap-4 bg-[#f7fafc] hover:bg-[#edf2f7] transition-all cursor-pointer">
            <Upload className="w-12 h-12 text-[#a0aec0]" />
            <div className="text-center">
              <p className="font-bold text-[#4a5568]">Tap to upload photo</p>
              <p className="text-xs text-[#718096]">or use camera</p>
            </div>
          </div>
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
