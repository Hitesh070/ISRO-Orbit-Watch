/**
 * LocationModal Component
 * =======================
 * Allows manual ground station / observer location selection:
 * - Quick-select presets for major Indian space centers & international ground stations
 * - Custom GPS coordinate input (Latitude, Longitude, Altitude, Station Name)
 * - Automatic GPS location detection button
 */

import React, { useState } from 'react';
import { MapPin, X, LocateFixed, Compass, Check, Satellite, Navigation } from 'lucide-react';
import { useOrbitStore } from '../../store/useOrbitStore';

interface LocationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface StationPreset {
  name: string;
  category: 'ISRO' | 'National' | 'Global';
  lat: number;
  lon: number;
  alt_m: number;
  description: string;
}

const PRESET_STATIONS: StationPreset[] = [
  {
    name: 'ISRO HQ / ISTRAC (Bengaluru)',
    category: 'ISRO',
    lat: 12.9716,
    lon: 77.5946,
    alt_m: 920,
    description: 'ISRO Telemetry, Tracking and Command Network',
  },
  {
    name: 'SDSC SHAR (Sriharikota)',
    category: 'ISRO',
    lat: 13.7199,
    lon: 80.2305,
    alt_m: 10,
    description: 'Satish Dhawan Space Centre - Primary Launch Port',
  },
  {
    name: 'Master Control Facility (Hassan)',
    category: 'ISRO',
    lat: 13.0033,
    lon: 76.1004,
    alt_m: 957,
    description: 'Geo-stationary Satellite Orbit Control & Stationkeeping',
  },
  {
    name: 'VSSC / Thumba (Thiruvananthapuram)',
    category: 'ISRO',
    lat: 8.5362,
    lon: 76.8687,
    alt_m: 15,
    description: 'Vikram Sarabhai Space Centre - Launch Vehicle R&D',
  },
  {
    name: 'SAC (Ahmedabad)',
    category: 'ISRO',
    lat: 23.0225,
    lon: 72.5714,
    alt_m: 53,
    description: 'Space Applications Centre - Payloads & Sensors',
  },
  {
    name: 'NRSC (Hyderabad)',
    category: 'ISRO',
    lat: 17.3850,
    lon: 78.4867,
    alt_m: 505,
    description: 'National Remote Sensing Centre - Earth Observation',
  },
  {
    name: 'New Delhi (Northern Station)',
    category: 'National',
    lat: 28.6139,
    lon: 77.2090,
    alt_m: 216,
    description: 'Northern India Telemetry & Earth Station',
  },
  {
    name: 'Mumbai (Western Coast)',
    category: 'National',
    lat: 19.0760,
    lon: 72.8777,
    alt_m: 14,
    description: 'Western Coast Maritime & Atmospheric Radar',
  },
  {
    name: 'NASA JPL (Goldstone, USA)',
    category: 'Global',
    lat: 35.4267,
    lon: -116.8900,
    alt_m: 1000,
    description: 'Deep Space Network (DSN) Primary Node',
  },
  {
    name: 'ESA Kourou (French Guiana)',
    category: 'Global',
    lat: 5.1611,
    lon: -52.6497,
    alt_m: 15,
    description: 'Guiana Space Centre - Equatorial Tracking',
  },
];

export const LocationModal: React.FC<LocationModalProps> = ({ isOpen, onClose }) => {
  const observerLocation = useOrbitStore((state) => state.observerLocation);
  const setObserverLocation = useOrbitStore((state) => state.setObserverLocation);
  const detectUserLocation = useOrbitStore((state) => state.detectUserLocation);
  const fetchPasses = useOrbitStore((state) => state.fetchPasses);

  const [activeTab, setActiveTab] = useState<'presets' | 'custom'>('presets');
  const [customName, setCustomName] = useState('');
  const [customLat, setCustomLat] = useState('');
  const [customLon, setCustomLon] = useState('');
  const [customAlt, setCustomAlt] = useState('100');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSelectPreset = (preset: StationPreset) => {
    const loc = {
      lat: preset.lat,
      lon: preset.lon,
      alt_m: preset.alt_m,
      name: `${preset.name} (${preset.lat}°N, ${preset.lon}°E)`,
      isLive: true,
    };
    setObserverLocation(loc);
    fetchPasses(loc.name, 25544);
    onClose();
  };

  const handleSaveCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const lat = parseFloat(customLat);
    const lon = parseFloat(customLon);
    const alt = parseFloat(customAlt) || 100;

    if (isNaN(lat) || lat < -90 || lat > 90) {
      setErrorMsg('Latitude must be between -90° and +90°');
      return;
    }
    if (isNaN(lon) || lon < -180 || lon > 180) {
      setErrorMsg('Longitude must be between -180° and +180°');
      return;
    }

    const name = customName.trim() || `Custom Station (${lat}°, ${lon}°)`;
    const loc = {
      lat: Number(lat.toFixed(4)),
      lon: Number(lon.toFixed(4)),
      alt_m: Math.round(alt),
      name: `${name} (${Math.abs(lat)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon)}°${lon >= 0 ? 'E' : 'W'})`,
      isLive: true,
    };

    setObserverLocation(loc);
    fetchPasses(loc.name, 25544);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <div className="w-full max-w-xl glass-panel-glow rounded-2xl border border-cyan-500/30 shadow-2xl overflow-hidden font-mono text-xs flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-cyan-500/20 bg-space-950/70">
          <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
            <MapPin className="w-4 h-4 text-emerald-400" />
            <span>Ground Station & Observer Location Selector</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current Active Location Display */}
        <div className="p-3 bg-cyan-950/30 border-b border-cyan-500/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-400 text-[11px]">Active Station:</span>
            <span className="text-emerald-300 font-bold truncate max-w-[280px]">
              {observerLocation?.name || 'Bengaluru, India'}
            </span>
          </div>
          <button
            onClick={() => {
              detectUserLocation();
              onClose();
            }}
            className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 text-[11px] font-bold flex items-center gap-1.5 transition"
          >
            <LocateFixed className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>Auto GPS</span>
          </button>
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-slate-800 bg-space-950/40 text-[11px]">
          <button
            onClick={() => setActiveTab('presets')}
            className={`flex-1 py-2.5 font-bold transition flex items-center justify-center gap-1.5 ${
              activeTab === 'presets'
                ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-500/10'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Satellite className="w-3.5 h-3.5" />
            <span>Space Agency Presets (ISRO / Global)</span>
          </button>
          <button
            onClick={() => setActiveTab('custom')}
            className={`flex-1 py-2.5 font-bold transition flex items-center justify-center gap-1.5 ${
              activeTab === 'custom'
                ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-500/10'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>Custom Coordinates</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          {activeTab === 'presets' ? (
            <div className="space-y-2">
              <div className="text-[10px] text-amber-400 font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                <span>🇮🇳 Indian Space Research Organisation (ISRO) Stations</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PRESET_STATIONS.map((preset, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelectPreset(preset)}
                    className="p-2.5 rounded-xl text-left bg-space-950/80 border border-slate-800 hover:border-cyan-500/60 hover:bg-cyan-950/30 transition flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-200 group-hover:text-cyan-300 text-xs">
                          {preset.name}
                        </span>
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                            preset.category === 'ISRO'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {preset.category}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">
                        {preset.description}
                      </p>
                    </div>
                    <div className="text-[10px] text-cyan-400/80 mt-2 font-mono">
                      {preset.lat}°N, {preset.lon}°E ({preset.alt_m}m)
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <form onSubmit={handleSaveCustom} className="space-y-3">
              {errorMsg && (
                <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300 text-[11px]">
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="block text-slate-400 text-[11px] mb-1">
                  Station Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Hassan Ground Station"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-space-950 border border-slate-700 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-400 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 text-[11px] mb-1">
                    Latitude (-90° to +90°)
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    placeholder="13.7199"
                    value={customLat}
                    onChange={(e) => setCustomLat(e.target.value)}
                    required
                    className="w-full px-3 py-1.5 rounded-lg bg-space-950 border border-slate-700 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-400 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-[11px] mb-1">
                    Longitude (-180° to +180°)
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    placeholder="80.2305"
                    value={customLon}
                    onChange={(e) => setCustomLon(e.target.value)}
                    required
                    className="w-full px-3 py-1.5 rounded-lg bg-space-950 border border-slate-700 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-400 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 text-[11px] mb-1">
                  Elevation / Altitude (meters above sea level)
                </label>
                <input
                  type="number"
                  placeholder="100"
                  value={customAlt}
                  onChange={(e) => setCustomAlt(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-space-950 border border-slate-700 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-400 text-xs"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-space-950 font-bold transition flex items-center justify-center gap-2 shadow-glow-cyan"
                >
                  <Check className="w-4 h-4" /> Save Station Coordinates
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default LocationModal;
