import React, { useState } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin, InfoWindow, useAdvancedMarkerRef } from '@vis.gl/react-google-maps';
import { Pothole } from '../hooks/usePotholes';
import { MapPin, Calendar, User, Navigation } from 'lucide-react';

const API_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || '';
const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

interface MapViewProps {
  potholes: Pothole[];
}

export default function MapView({ potholes }: MapViewProps) {
  const [selectedPothole, setSelectedPothole] = useState<Pothole | null>(null);

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
    <div className="w-full h-full rounded-2xl overflow-hidden shadow-inner border border-zinc-800">
      <APIProvider apiKey={API_KEY} version="weekly">
        <Map
          defaultCenter={{ lat: 37.42, lng: -122.08 }}
          defaultZoom={12}
          mapId="POTHOLE_MAP_ID"
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          style={{ width: '100%', height: '100%' }}
          gestureHandling={'greedy'}
          disableDefaultUI={true}
        >
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
                </div>
              </div>
            </InfoWindow>
          )}
        </Map>
      </APIProvider>
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
