import React, { useState, useEffect } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin, InfoWindow, useAdvancedMarkerRef } from '@vis.gl/react-google-maps';
import { Pothole } from '../hooks/usePotholes';
import { MapPin, Calendar, User, Navigation, LocateFixed } from 'lucide-react';

const API_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || '';
const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

interface MapViewProps {
  potholes: Pothole[];
}

export default function MapView({ potholes }: MapViewProps) {
  const [selectedPothole, setSelectedPothole] = useState<Pothole | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({ lat: 37.42, lng: -122.08 });

  useEffect(() => {
    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation({ lat: latitude, lng: longitude });
          // Optionally center map on user first time
          if (!userLocation) {
            setMapCenter({ lat: latitude, lng: longitude });
          }
        },
        (error) => console.error("Error watching position:", error),
        { enableHighAccuracy: true }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

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
    <div className="w-full h-full rounded-2xl overflow-hidden shadow-inner border border-zinc-800 relative">
      <APIProvider apiKey={API_KEY} version="weekly">
        <Map
          defaultCenter={mapCenter}
          defaultZoom={15}
          mapId="POTHOLE_MAP_ID"
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          style={{ width: '100%', height: '100%' }}
          gestureHandling={'greedy'}
          disableDefaultUI={true}
        >
          {/* User Location Marker */}
          {userLocation && (
            <AdvancedMarker position={userLocation}>
              <div className="relative flex items-center justify-center">
                <div className="absolute w-8 h-8 bg-blue-500/30 rounded-full animate-ping" />
                <div className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg" />
              </div>
            </AdvancedMarker>
          )}

          {potholes.map((p) => (
            <PotholeMarker 
              key={p.id} 
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
                    <Calendar className="w-3 h-3" />
                    <span>{new Date(selectedPothole.timestamp?.seconds * 1000).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Navigation className="w-3 h-3" />
                    <span>{selectedPothole.latitude.toFixed(4)}, {selectedPothole.longitude.toFixed(4)}</span>
                  </div>
                  {selectedPothole.userName && (
                    <div className="flex items-center gap-1.5">
                      <User className="w-3 h-3" />
                      <span>Reported by: {selectedPothole.userName}</span>
                    </div>
                  )}
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
          className="absolute bottom-4 right-4 p-3 bg-white text-black rounded-full shadow-xl hover:bg-zinc-100 transition-all z-10"
        >
          <LocateFixed className="w-5 h-5" />
        </button>
      )}
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
      <Pin
        background={pothole.severity === 'high' ? '#ef4444' : pothole.severity === 'medium' ? '#f97316' : '#eab308'}
        glyphColor={'#fff'}
        borderColor={'#000'}
      />
    </AdvancedMarker>
  );
}
