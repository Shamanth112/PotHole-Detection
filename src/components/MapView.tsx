import React, { useState, useEffect } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin, InfoWindow, useAdvancedMarkerRef } from '@vis.gl/react-google-maps';
import { Pothole } from '../hooks/usePotholes';
import { MapPin, Calendar, User, Navigation, LocateFixed, Filter, Plus } from 'lucide-react';

const API_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || '';
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
            if (!prev) {
              setMapCenter(newLocation);
              return true;
            }
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
      <div className="flex flex-col items-center justify-center h-full bg-zinc-900 text-white p-8 text-center rounded-2xl border border-zinc-800">
        <MapPin className="w-12 h-12 mb-4 text-zinc-600" />
        <h2 className="text-xl font-bold mb-2">Google Maps Key Required</h2>
        <p className="text-zinc-400 text-sm max-w-xs">
          Please add your <code>GOOGLE_MAPS_PLATFORM_KEY</code> to the AI Studio Secrets to enable the map view.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-white flex flex-col relative">
      {/* Header */}
      <header className="bg-[#1a365d] text-white p-6 shadow-lg z-20">
        <h1 className="text-xl font-bold tracking-tight">Pothole Map</h1>
      </header>

      {/* Filters */}
      <div className="p-4 bg-white border-b border-[#e2e8f0] z-20">
        <div className="flex items-center gap-2 mb-3 text-sm font-bold text-[#4a5568]">
          <Filter className="w-4 h-4" />
          <span>Filter by Severity:</span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {['all', 'low', 'medium', 'high'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={`px-6 py-2 rounded-full text-sm font-bold transition-all whitespace-nowrap ${
                filter === f 
                  ? 'bg-[#1a365d] text-white shadow-md' 
                  : 'bg-[#f7fafc] text-[#718096] border border-[#e2e8f0] hover:bg-[#edf2f7]'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Map Container */}
      <div className="flex-1 relative">
        <APIProvider apiKey={API_KEY} version="weekly">
          <Map
            center={mapCenter}
            onCenterChanged={(ev) => setMapCenter(ev.detail.center)}
            defaultZoom={15}
            mapId="POTHOLE_MAP_ID"
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            style={{ width: '100%', height: '100%' }}
            gestureHandling={'greedy'}
            disableDefaultUI={true}
          >
            {userLocation && (
              <AdvancedMarker position={userLocation}>
                <div className="relative flex items-center justify-center">
                  <div className="absolute w-8 h-8 bg-blue-500/30 rounded-full animate-ping" />
                  <div className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg" />
                </div>
              </AdvancedMarker>
            )}

            {filteredPotholes.map((p) => (
              <PotholeMarker 
                key={p._id} 
                pothole={p} 
                onSelect={() => setSelectedPothole(p)} 
              />
            ))}

            {selectedPothole && (
              <InfoWindow
                position={{ lat: selectedPothole.latitude, lng: selectedPothole.longitude }}
                onCloseClick={() => setSelectedPothole(null)}
              >
                <div className="p-2 max-w-xs">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-3 h-3 rounded-full ${
                      selectedPothole.severity === 'high' ? 'bg-red-500' : 
                      selectedPothole.severity === 'medium' ? 'bg-orange-500' : 'bg-yellow-500'
                    }`} />
                    <span className="font-bold text-zinc-900 uppercase text-xs tracking-tighter">
                      {selectedPothole.severity} Severity
                    </span>
                  </div>
                  <div className="space-y-1 text-xs text-zinc-600">
                    <div className="flex items-center gap-1.5">
                      <User className="w-3 h-3" />
                      <span className="font-medium">{selectedPothole.userName || 'Anonymous Reporter'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(selectedPothole._creationTime).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Navigation className="w-3 h-3" />
                      <span>{selectedPothole.latitude.toFixed(4)}, {selectedPothole.longitude.toFixed(4)}</span>
                    </div>
                  </div>
                </div>
              </InfoWindow>
            )}
          </Map>
        </APIProvider>

        {/* Recenter Button */}
        {userLocation && (
          <button 
            onClick={() => setMapCenter(userLocation)}
            className="absolute bottom-4 right-4 p-3 bg-white text-[#1a365d] rounded-full shadow-xl hover:bg-zinc-100 transition-all z-10 border border-[#e2e8f0]"
          >
            <LocateFixed className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Bottom Summary Bar */}
      <div className="p-4 bg-white border-t border-[#e2e8f0] flex items-center justify-between shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
        <div className="flex items-center gap-8 flex-1">
          <div className="flex flex-col items-center">
            <p className="text-2xl font-bold text-[#e53e3e]">{potholes.filter(p => p.severity === 'high').length}</p>
            <p className="text-[10px] font-bold text-[#718096] uppercase tracking-wider">High</p>
          </div>
          <div className="w-px h-8 bg-[#e2e8f0]" />
          <div className="flex flex-col items-center">
            <p className="text-2xl font-bold text-[#dd6b20]">{potholes.filter(p => p.severity === 'medium').length}</p>
            <p className="text-[10px] font-bold text-[#718096] uppercase tracking-wider">Medium</p>
          </div>
          <div className="w-px h-8 bg-[#e2e8f0]" />
          <div className="flex flex-col items-center">
            <p className="text-2xl font-bold text-[#d69e2e]">{potholes.filter(p => p.severity === 'low').length}</p>
            <p className="text-[10px] font-bold text-[#718096] uppercase tracking-wider">Low</p>
          </div>
        </div>
        
        <button 
          onClick={onAddReport}
          className="w-16 h-16 bg-[#1a365d] text-white rounded-full flex items-center justify-center shadow-xl hover:scale-105 transition-all active:scale-95"
        >
          <Plus className="w-8 h-8" />
        </button>
      </div>
    </div>
  );
}

function PotholeMarker({ pothole, onSelect }: { pothole: Pothole; onSelect: () => void; key?: string }) {
  const [markerRef, marker] = useAdvancedMarkerRef();

  return (
    <AdvancedMarker
      ref={markerRef}
      position={{ lat: pothole.latitude, lng: pothole.longitude }}
      onClick={onSelect}
    >
      <div className="relative flex items-center justify-center group">
        <div className={`absolute w-10 h-10 rounded-full opacity-20 group-hover:scale-110 transition-all ${
          pothole.severity === 'high' ? 'bg-red-500' : pothole.severity === 'medium' ? 'bg-orange-500' : 'bg-yellow-500'
        }`} />
        <MapPin className={`w-8 h-8 drop-shadow-lg ${
          pothole.severity === 'high' ? 'text-red-600' : pothole.severity === 'medium' ? 'text-orange-600' : 'text-yellow-600'
        }`} fill="currentColor" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] w-2 h-2 bg-white rounded-full" />
      </div>
    </AdvancedMarker>
  );
}
