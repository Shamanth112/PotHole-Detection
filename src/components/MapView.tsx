import React, { useState, useEffect } from 'react';
import { APIProvider, Map, AdvancedMarker, InfoWindow, useAdvancedMarkerRef } from '@vis.gl/react-google-maps';
import { Pothole } from '../hooks/usePotholes';
import { MapPin, Calendar, User, Navigation, LocateFixed, Filter, Plus, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';

const API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_PLATFORM_KEY as string) || '';
const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

interface MapViewProps {
  potholes: Pothole[];
  onAddReport?: () => void;
}

export default function MapView({ potholes, onAddReport }: MapViewProps) {
  const [selectedPothole, setSelectedPothole] = useState<Pothole | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({ lat: 37.42, lng: -122.08 });
  const [hasInitializedCenter, setHasInitializedCenter] = useState(false);
  const [filter, setFilter] = useState<'all' | 'low' | 'medium' | 'high'>('all');

  useEffect(() => {
    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const newLocation = { lat: latitude, lng: longitude };
          setUserLocation(newLocation);
          setHasInitializedCenter(prev => {
            if (!prev) { setMapCenter(newLocation); return true; }
            return prev;
          });
        },
        (error) => console.error("Error watching position:", error),
        { enableHighAccuracy: true }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  const filteredPotholes = potholes.filter(p => filter === 'all' || p.severity === filter);

  if (!hasValidKey) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center" style={{ background: 'var(--bg-secondary)' }}>
        <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>
          <MapPin className="w-10 h-10" style={{ color: 'var(--text-muted)' }} />
        </div>
        <h2 className="text-xl font-bold mb-2">Google Maps Key Required</h2>
        <p className="text-sm max-w-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          Add your <code className="px-1.5 py-0.5 rounded text-xs" style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa' }}>VITE_GOOGLE_MAPS_PLATFORM_KEY</code> to the Environment Variables to enable the live map.
        </p>
      </div>
    );
  }

  const counts = {
    high: potholes.filter(p => p.severity === 'high').length,
    medium: potholes.filter(p => p.severity === 'medium').length,
    low: potholes.filter(p => p.severity === 'low').length,
  };

  return (
    <div className="w-full h-full flex flex-col relative" style={{ background: 'var(--bg-primary)' }}>
      {/* ── Top bar ── */}
      <div className="glass-strong z-20 px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-black">Live <span className="gradient-text-blue">Pothole Map</span></h1>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{filteredPotholes.length} markers visible</p>
          </div>
          <div className="flex items-center gap-3">
            {[
              { label: 'High',   count: counts.high,   color: 'text-red-400'    },
              { label: 'Med',    count: counts.medium, color: 'text-orange-400' },
              { label: 'Low',    count: counts.low,    color: 'text-yellow-400' },
            ].map(({ label, count, color }) => (
              <div key={label} className="text-center">
                <p className={`text-base font-black ${color}`}>{count}</p>
                <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {(['all', 'high', 'medium', 'low'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-4 py-1.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all whitespace-nowrap"
              style={{
                background: filter === f ? (f === 'high' ? 'rgba(239,68,68,0.2)' : f === 'medium' ? 'rgba(249,115,22,0.2)' : f === 'low' ? 'rgba(234,179,8,0.2)' : 'rgba(59,130,246,0.2)') : 'rgba(255,255,255,0.04)',
                border: `1px solid ${filter === f ? (f === 'high' ? 'rgba(239,68,68,0.4)' : f === 'medium' ? 'rgba(249,115,22,0.4)' : f === 'low' ? 'rgba(234,179,8,0.4)' : 'rgba(59,130,246,0.4)') : 'var(--border)'}`,
                color: filter === f ? (f === 'high' ? '#f87171' : f === 'medium' ? '#fb923c' : f === 'low' ? '#facc15' : '#60a5fa') : 'var(--text-secondary)',
              }}
            >
              {f === 'all' ? 'All Potholes' : f.charAt(0).toUpperCase() + f.slice(1) + ' Severity'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Map ── */}
      <div className="flex-1 relative map-container">
        <APIProvider apiKey={API_KEY} version="weekly">
          <Map
            center={mapCenter}
            onCenterChanged={(ev: any) => setMapCenter(ev.detail.center)}
            defaultZoom={15}
            mapId="POTHOLE_MAP_ID"
            style={{ width: '100%', height: '100%' }}
            gestureHandling={'greedy'}
            disableDefaultUI={true}
          >
            {/* User location */}
            {userLocation && (
              <AdvancedMarker position={userLocation}>
                <div className="relative flex items-center justify-center">
                  <div className="absolute w-10 h-10 bg-blue-500/30 rounded-full animate-ping" />
                  <div className="w-5 h-5 bg-blue-500 rounded-full border-2 border-white shadow-lg" />
                </div>
              </AdvancedMarker>
            )}

            {filteredPotholes.map((p) => (
              <PotholeMarker key={p._id} pothole={p} onSelect={() => setSelectedPothole(p)} />
            ))}

            {selectedPothole && (
              <InfoWindow
                position={{ lat: selectedPothole.latitude, lng: selectedPothole.longitude }}
                onCloseClick={() => setSelectedPothole(null)}
              >
                <div className="p-3 min-w-[200px]" style={{ fontFamily: 'Inter, sans-serif' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-3 h-3 rounded-full ${selectedPothole.severity === 'high' ? 'bg-red-500' : selectedPothole.severity === 'medium' ? 'bg-orange-500' : 'bg-yellow-500'}`} />
                    <span className="font-bold text-gray-800 text-xs uppercase tracking-wider">
                      {selectedPothole.severity} Severity
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs text-gray-600">
                    {selectedPothole.address && (
                      <div className="flex items-start gap-1.5">
                        <MapPin className="w-3 h-3 mt-0.5 shrink-0 text-blue-500" />
                        <span className="font-medium leading-snug">{selectedPothole.address}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <User className="w-3 h-3 shrink-0" />
                      <span>{selectedPothole.userName || 'Anonymous Reporter'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3 h-3 shrink-0" />
                      <span>{new Date(selectedPothole._creationTime).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Navigation className="w-3 h-3 shrink-0" />
                      <span className="font-mono">{selectedPothole.latitude.toFixed(5)}, {selectedPothole.longitude.toFixed(5)}</span>
                    </div>
                    <div className="mt-2 pt-2" style={{ borderTop: '1px solid #e5e7eb' }}>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                        selectedPothole.status === 'resolved' ? 'bg-green-100 text-green-700' :
                        selectedPothole.status === 'fixing' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                      }`}>{selectedPothole.status}</span>
                    </div>
                  </div>
                </div>
              </InfoWindow>
            )}
          </Map>
        </APIProvider>

        {/* Recenter button */}
        {userLocation && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setMapCenter(userLocation)}
            className="absolute bottom-24 right-4 z-10 w-12 h-12 rounded-2xl flex items-center justify-center glass-strong transition-all"
            style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}
          >
            <LocateFixed className="w-5 h-5 text-blue-400" />
          </motion.button>
        )}

        {/* Add report FAB */}
        {onAddReport && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onAddReport}
            className="absolute bottom-6 right-4 z-10 w-14 h-14 rounded-2xl flex items-center justify-center text-white"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #06b6d4)', boxShadow: '0 8px 24px rgba(59,130,246,0.45)' }}
          >
            <Plus className="w-7 h-7" />
          </motion.button>
        )}
      </div>
    </div>
  );
}

function PotholeMarker({ pothole, onSelect }: { pothole: Pothole; onSelect: () => void; key?: string }) {
  const [markerRef] = useAdvancedMarkerRef();
  const color = pothole.severity === 'high' ? '#ef4444' : pothole.severity === 'medium' ? '#f97316' : '#eab308';
  const glow = pothole.severity === 'high' ? 'rgba(239,68,68,0.4)' : pothole.severity === 'medium' ? 'rgba(249,115,22,0.4)' : 'rgba(234,179,8,0.4)';

  return (
    <AdvancedMarker ref={markerRef} position={{ lat: pothole.latitude, lng: pothole.longitude }} onClick={onSelect}>
      <div className="relative flex items-center justify-center group cursor-pointer">
        {/* Pulsing ring */}
        <div className="absolute w-8 h-8 rounded-full opacity-0 group-hover:opacity-100 transition-all" style={{ background: glow, animation: 'pulse 2s infinite' }} />
        {/* Marker body */}
        <div className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center shadow-lg transition-transform group-hover:scale-110"
          style={{ background: color, boxShadow: `0 2px 12px ${glow}` }}>
          <AlertTriangle className="w-3.5 h-3.5 text-white" />
        </div>
        {/* Tail */}
        <div className="absolute -bottom-1.5 w-0 h-0" style={{ borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: `8px solid ${color}` }} />
      </div>
    </AdvancedMarker>
  );
}
