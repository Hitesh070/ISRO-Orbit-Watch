/**
 * LocationModal Component
 * =======================
 * Allows manual ground station / observer location selection:
 * - Direct option to query and access current browser / GPS location
 * - Quick-select presets for major Indian space centers & international ground stations
 * - Custom GPS coordinate input (Latitude, Longitude, Altitude, Station Name)
 * - Uses React Portal to document.body to prevent parent container clip / backdrop-filter offset
 */

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { MapPin, X, LocateFixed, Check, Satellite, Navigation, ArrowRight, Loader2 } from 'lucide-react';
import { useOrbitStore } from '../../store/useOrbitStore';

interface LocationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LocationModal: React.FC<LocationModalProps> = ({ isOpen, onClose }) => {
  const observerLocation = useOrbitStore((state) => state.observerLocation);
  const setObserverLocation = useOrbitStore((state) => state.setObserverLocation);
  const fetchPasses = useOrbitStore((state) => state.fetchPasses);

  const [activeTab, setActiveTab] = useState<'presets' | 'custom'>('custom');
  const [customName, setCustomName] = useState('');
  const [customLat, setCustomLat] = useState('');
  const [customLon, setCustomLon] = useState('');
  const [customAlt, setCustomAlt] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [locateStatus, setLocateStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleUseCurrentBrowserLocation = () => {
    setIsLocating(true);
    setLocateStatus('Querying browser geolocation...');

    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          // Browser GPS altitude is ellipsoidal; this predictor requires mean-sea-level elevation.
          setCustomLat(lat.toFixed(4));
          setCustomLon(lon.toFixed(4));
          setActiveTab('custom');
          setIsLocating(false);
          setLocateStatus('GPS provides coordinates, but its altitude is ellipsoidal. Enter site elevation above mean sea level before predicting passes.');
        },
        (err) => {
          console.warn('[LocationModal] Browser geolocation warning:', err.message);
          setIsLocating(false);
          setLocateStatus('Browser location unavailable. Enter latitude, longitude, and altitude above mean sea level.');
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      setIsLocating(false);
      setLocateStatus(null);
    }
  };

  const handleSaveCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const lat = parseFloat(customLat);
    const lon = parseFloat(customLon);
    const alt = Number(customAlt);

    if (isNaN(lat) || lat < -90 || lat > 90) {
      setErrorMsg('Latitude must be between -90° and +90°');
      return;
    }
    if (isNaN(lon) || lon < -180 || lon > 180) {
      setErrorMsg('Longitude must be between -180° and +180°');
      return;
    }
    if (!Number.isFinite(alt) || alt < -500 || alt > 10000) {
      setErrorMsg('Altitude must be provided in meters and between -500 and 10,000.');
      return;
    }

    const name = customName.trim() || `Custom Station (${lat}°, ${lon}°)`;
    const loc = {
      lat: Number(lat.toFixed(4)),
      lon: Number(lon.toFixed(4)),
      alt_m: Math.round(alt),
      altitude_source: 'user_supplied_msl',
      name: `${name} (${Math.abs(lat)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon)}°${lon >= 0 ? 'E' : 'W'})`,
      isLive: true,
    };

    setObserverLocation(loc);
    fetchPasses(`${loc.lat},${loc.lon},${loc.alt_m}`, 25544);
    onClose();
  };

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-xl glass-panel-glow rounded-2xl border border-cyan-500/40 shadow-2xl overflow-hidden font-mono text-xs flex flex-col max-h-[90vh] bg-space-950/95 animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-cyan-500/20 bg-space-950/90 shrink-0">
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

        {/* Prominent Current Browser / GPS Location Option */}
        <div className="p-3 bg-gradient-to-r from-emerald-950/40 via-cyan-950/30 to-space-950/90 border-b border-cyan-500/20 shrink-0">
          <button
            type="button"
            onClick={handleUseCurrentBrowserLocation}
            disabled={isLocating}
            className="w-full p-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border-2 border-emerald-500/50 hover:border-emerald-400 text-emerald-300 font-bold flex items-center justify-between transition shadow-glow-emerald group text-left cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0">
                {isLocating ? (
                  <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
                ) : (
                  <LocateFixed className="w-5 h-5 text-emerald-400 animate-pulse" />
                )}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-emerald-300 group-hover:text-emerald-200 flex items-center gap-2">
                  <span>Use Current Browser / GPS Location</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-400/20 border border-emerald-400/40 text-emerald-300 font-semibold">
                    Browser GPS
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                  {locateStatus || 'Use device coordinates for SGP4 pass predictions when browser location is available'}
                </div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-emerald-400 group-hover:translate-x-1 transition-transform shrink-0 ml-2" />
          </button>
        </div>

        {/* Current Active Location Display */}
        <div className="p-3 bg-space-900/60 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="text-slate-400 text-[11px] shrink-0">Active Station:</span>
            <span className="text-emerald-300 font-bold truncate">
              {observerLocation?.name || 'No observer station selected'}
            </span>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-slate-800 bg-space-950/40 text-[11px] shrink-0">
          <button
            onClick={() => setActiveTab('presets')}
            disabled
            title="No station presets are available until their coordinates and elevations are verified."
            className={`flex-1 py-2.5 font-bold transition flex items-center justify-center gap-1.5 ${
              activeTab === 'presets'
                ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-500/10'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Satellite className="w-3.5 h-3.5" />
            <span>Station presets unavailable</span>
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
            <div className="p-3 rounded-lg border border-slate-700 text-slate-400">No station presets are available until their coordinates and elevations are verified. Enter your observer coordinates manually.</div>
          ) : (
            <form onSubmit={handleSaveCustom} className="space-y-3">
              {errorMsg && (
                <div className="p-2 rounded bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[11px]">
                  {errorMsg}
                </div>
              )}
              <div>
                <label className="block text-slate-400 text-[11px] mb-1">Station / Site Name</label>
                <input
                  type="text"
                  placeholder="e.g. My Backyard Ground Station"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-space-950 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 text-[11px] mb-1">Latitude (-90° to +90°)</label>
                  <input
                    type="number"
                    step="0.0001"
                    placeholder="13.0827"
                    value={customLat}
                    onChange={(e) => setCustomLat(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg bg-space-950 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-[11px] mb-1">Longitude (-180° to +180°)</label>
                  <input
                    type="number"
                    step="0.0001"
                    placeholder="80.2707"
                    value={customLon}
                    onChange={(e) => setCustomLon(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg bg-space-950 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-slate-400 text-[11px] mb-1">Altitude Above Sea Level (meters)</label>
                <input
                  type="number"
                  placeholder="Altitude above sea level (meters)"
                  value={customAlt}
                  onChange={(e) => setCustomAlt(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-space-950 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold transition flex items-center justify-center gap-2 shadow-glow-cyan"
              >
                <Check className="w-4 h-4" />
                <span>Save & Set As Active Ground Station</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};

export default LocationModal;
