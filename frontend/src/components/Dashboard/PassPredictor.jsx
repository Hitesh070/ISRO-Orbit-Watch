/**
 * PassPredictor Component
 * High-precision ground station pass prediction engine using Skyfield's find_events.
 * Features automated browser GPS geolocation auto-detection, searchable spacecraft selector,
 * and topocentric AOS / LOS / Max Elevation pass trajectories.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Radio,
  MapPin,
  Compass,
  Clock,
  Send,
  Globe2,
  Sparkles,
  Navigation,
  LocateFixed,
  ArrowRight,
  Search,
  ChevronDown,
  X,
  Satellite,
} from 'lucide-react';
import { useOrbitStore } from '../../store/useOrbitStore';

export const PassPredictor = () => {
  const groundStations = useOrbitStore((state) => state.groundStations);
  const passesData = useOrbitStore((state) => state.passesData);
  const passesError = useOrbitStore((state) => state.passesError);
  const fetchPasses = useOrbitStore((state) => state.fetchPasses);
  const satellites = useOrbitStore((state) => state.satellites);
  const catalog = useOrbitStore((state) => state.catalog);
  const selectedSatellite = useOrbitStore((state) => state.selectedSatellite);

  const [selectedCity, setSelectedCity] = useState('bengaluru');
  const [selectedNorad, setSelectedNorad] = useState(36795); // Default to ISRO CARTOSAT-2B
  const [isroOnly, setIsroOnly] = useState(true);
  const [customLat, setCustomLat] = useState('');
  const [customLon, setCustomLon] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [geoStatus, setGeoStatus] = useState('');

  // Searchable combobox states
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Sync with global selected satellite if present
  useEffect(() => {
    if (selectedSatellite && selectedSatellite.norad_id) {
      setSelectedNorad(selectedSatellite.norad_id);
    }
  }, [selectedSatellite]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Build unified satellite list with top presets prioritized
  const allSatellites = useMemo(() => {
    const pool = catalog && catalog.length > 0 ? catalog : satellites;
    const filtered = pool.filter(
      (s) => s.object_type === 'Satellite' || !s.object_type || s.type === 'PAYLOAD'
    );
    const map = new Map();
    const priorityIds = [25544, 48274, 36795, 44804, 44857, 101228, 20580];
    const priorityList = [];
    const others = [];

    for (const s of filtered) {
      if (!s.norad_id || map.has(s.norad_id)) continue;
      map.set(s.norad_id, s);
      if (priorityIds.includes(s.norad_id)) {
        priorityList.push(s);
      } else {
        others.push(s);
      }
    }

    priorityList.sort((a, b) => priorityIds.indexOf(a.norad_id) - priorityIds.indexOf(b.norad_id));
    others.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    return [...priorityList, ...others];
  }, [catalog, satellites]);

  const selectedSatObj = useMemo(() => {
    return allSatellites.find((s) => s.norad_id === selectedNorad);
  }, [allSatellites, selectedNorad]);

  const filteredSatellites = useMemo(() => {
    let list = allSatellites;
    if (isroOnly) {
      list = list.filter((s) => s.is_isro || s.country?.toLowerCase().includes('india'));
    }
    if (!searchTerm.trim()) return list;
    const q = searchTerm.toLowerCase().trim();
    return list.filter(
      (s) =>
        (s.name || '').toLowerCase().includes(q) ||
        String(s.norad_id).includes(q) ||
        (s.intl_des || '').toLowerCase().includes(q) ||
        (s.country || '').toLowerCase().includes(q)
    );
  }, [allSatellites, isroOnly, searchTerm]);

  // Auto-detect user's real location on load with smooth fallback
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = Number(position.coords.latitude.toFixed(4));
          const lon = Number(position.coords.longitude.toFixed(4));
          setCustomLat(String(lat));
          setCustomLon(String(lon));
          setIsCustom(true);
          setGeoStatus(`Auto-detected: ${lat}°, ${lon}°`);
          fetchPasses(`${lat},${lon}`, selectedNorad);
        },
        () => {
          applyFallbackLocation();
        },
        { timeout: 4000 }
      );
    } else {
      applyFallbackLocation();
    }
  }, []);

  // Auto-dismiss geo status after 6 seconds
  useEffect(() => {
    if (!geoStatus) return;
    const timer = setTimeout(() => setGeoStatus(null), 6000);
    return () => clearTimeout(timer);
  }, [geoStatus]);

  const applyFallbackLocation = async () => {
    // 1. Try fast IP-based geolocation fallback
    try {
      const res = await fetch('https://ipapi.co/json/');
      if (res.ok) {
        const ipData = await res.json();
        if (ipData.latitude && ipData.longitude) {
          const lat = Number(Number(ipData.latitude).toFixed(4));
          const lon = Number(Number(ipData.longitude).toFixed(4));
          const city = ipData.city || 'Local Station';
          setCustomLat(String(lat));
          setCustomLon(String(lon));
          setIsCustom(true);
          setGeoStatus(`Active Location: ${city} (${lat}°, ${lon}°)`);
          fetchPasses(`${lat},${lon}`, selectedNorad);
          return;
        }
      }
    } catch {}

    // 2. Fallback to active Ground Station from store (e.g. NRSC Hyderabad / ISRO HQ)
    const obs = useOrbitStore.getState().observerLocation;
    const fallbackLat = obs?.lat ?? 17.3850;
    const fallbackLon = obs?.lon ?? 78.4867;
    const fallbackName = obs?.name || 'NRSC Hyderabad (ISRO Ground Station)';
    setCustomLat(String(fallbackLat));
    setCustomLon(String(fallbackLon));
    setIsCustom(true);
    setGeoStatus(`Ground Station: ${fallbackName}`);
    fetchPasses(`${fallbackLat},${fallbackLon}`, selectedNorad);
  };

  const handleDetectLocation = () => {
    if (!('geolocation' in navigator)) {
      applyFallbackLocation();
      return;
    }
    setGeoStatus('Acquiring location...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = Number(position.coords.latitude.toFixed(4));
        const lon = Number(position.coords.longitude.toFixed(4));
        setCustomLat(String(lat));
        setCustomLon(String(lon));
        setIsCustom(true);
        setGeoStatus(`GPS Acquired: ${lat}° N, ${lon}° E`);
        fetchPasses(`${lat},${lon}`, selectedNorad);
      },
      () => {
        // Smoothly fall back without showing error banner
        applyFallbackLocation();
      },
      { enableHighAccuracy: false, timeout: 4000 }
    );
  };

  const handlePredict = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (isCustom && customLat && customLon) {
      fetchPasses(`${customLat},${customLon}`, selectedNorad);
    } else {
      fetchPasses(selectedCity, selectedNorad);
    }
  };

  const handleSelectSatellite = (noradId) => {
    setSelectedNorad(noradId);
    setSearchTerm('');
    setIsDropdownOpen(false);
    if (isCustom && customLat && customLon) {
      fetchPasses(`${customLat},${customLon}`, noradId);
    } else {
      fetchPasses(selectedCity, noradId);
    }
  };

  const formatTrajectory = (p) => {
    let summary = p.trajectory_summary || `${p.aos_direction || 'N'} → ${p.los_direction || 'S'}`;
    // Strip Python tuple string artifact like ('NE',) -> NE
    summary = summary.replace(/\(['"]?([A-Za-z]+)['"]?,\)/g, '$1').replace(/[()',]/g, '').trim();
    return `${summary} (${p.aos_azimuth}° → ${p.los_azimuth}°)`;
  };

  const passes = passesData?.passes || [];
  const groundTrack = passesData?.ground_track || [];
  const stationInfo = passesData?.ground_station || {};
  const satInfo = passesData?.satellite || {};

  return (
    <div className="glass-panel rounded-xl p-5 shadow-2xl">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-cyan-500/20 mb-4 gap-2">
        <div>
          <h2 className="text-base font-bold text-cyan-400 flex items-center gap-2">
            <Radio className="w-5 h-5 text-cyan-400" />
            Ground Station Pass Predictor (AOS / LOS / Max Elevation)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            SGP4 topocentric line-of-sight tracking for satellite communication and optical observation
          </p>
        </div>

        {/* Actions: Live GPS & Full RF Suite */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/rf"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-mono font-semibold transition shadow-glow-cyan"
          >
            <Radio className="w-4 h-4 text-cyan-400" />
            <span>Open RF Doppler & Link Suite</span>
            <ArrowRight className="w-3.5 h-3.5 text-cyan-400" />
          </Link>

          <button
            type="button"
            onClick={handleDetectLocation}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/40 text-xs font-mono font-semibold transition hover:shadow-glow-emerald"
          >
            <LocateFixed className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span>Use My GPS</span>
          </button>
        </div>
      </div>

      {geoStatus && (
        <div className="text-[11px] font-mono text-cyan-300 bg-cyan-950/50 px-3 py-1.5 rounded-lg border border-cyan-500/40 mb-3 flex items-center justify-between gap-2 animate-in fade-in duration-200">
          <div className="flex items-center gap-2 min-w-0">
            <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="truncate">{geoStatus}</span>
          </div>
          <button
            type="button"
            onClick={() => setGeoStatus(null)}
            className="text-slate-400 hover:text-white p-0.5 rounded transition shrink-0"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Control Form */}
      <form onSubmit={handlePredict} className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-5 text-xs font-mono">
        {/* Ground Station Selection */}
        <div className="md:col-span-2">
          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Ground Station / Location
          </label>
          <div className="flex gap-2">
            <select
              value={isCustom ? 'custom' : selectedCity}
              onChange={(e) => {
                if (e.target.value === 'custom') {
                  setIsCustom(true);
                } else {
                  setIsCustom(false);
                  setSelectedCity(e.target.value);
                }
              }}
              className="w-full px-3 py-2 rounded-lg bg-space-950/80 border border-slate-700 text-slate-200 focus:outline-none focus:border-cyan-400"
            >
              <option value="custom">📍 Custom / Browser GPS Coordinates</option>
              {groundStations.map((gs) => (
                <option key={gs.city.toLowerCase()} value={gs.city.toLowerCase()}>
                  {gs.city} — {gs.name} ({gs.country})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Target Spacecraft Searchable Combobox */}
        <div className="relative" ref={dropdownRef}>
          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Target Spacecraft</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsroOnly(!isroOnly)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border transition ${
                  isroOnly
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                    : 'bg-space-900 border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                {isroOnly ? 'ISRO Assets Only' : 'Showing All'}
              </button>
              <span className="text-[10px] text-cyan-400 font-normal">Searchable</span>
            </div>
          </label>

          <div
            onClick={() => setIsDropdownOpen(true)}
            className="w-full px-3 py-2 rounded-lg bg-space-950/80 border border-slate-700 hover:border-cyan-500/50 focus-within:border-cyan-400 text-slate-200 flex items-center justify-between cursor-pointer transition"
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Search className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              {isDropdownOpen ? (
                <input
                  type="text"
                  autoFocus
                  placeholder="Type satellite name or NORAD..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-transparent text-slate-100 placeholder-slate-500 focus:outline-none text-xs w-full"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="truncate text-slate-200 font-medium">
                  {selectedSatObj ? `${selectedSatObj.name} (${selectedSatObj.norad_id})` : `NORAD #${selectedNorad}`}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0 ml-2">
              {isDropdownOpen && searchTerm && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSearchTerm('');
                  }}
                  className="p-0.5 text-slate-400 hover:text-slate-200"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180 text-cyan-400' : ''}`}
              />
            </div>
          </div>

          {/* Floating Dropdown List */}
          {isDropdownOpen && (
            <div className="absolute left-0 right-0 top-full mt-1 max-h-64 overflow-y-auto bg-space-950 border border-cyan-500/40 rounded-lg shadow-2xl z-50 p-1 divide-y divide-slate-800/60 custom-scrollbar">
              {filteredSatellites.length === 0 ? (
                <div className="p-3 text-center text-slate-500 text-[11px]">
                  No satellites matching "{searchTerm}"
                </div>
              ) : (
                filteredSatellites.map((sat) => {
                  const isSelected = sat.norad_id === selectedNorad;
                  return (
                    <div
                      key={sat.norad_id}
                      onClick={() => handleSelectSatellite(sat.norad_id)}
                      className={`px-2.5 py-2 rounded flex items-center justify-between cursor-pointer transition ${
                        isSelected
                          ? 'bg-cyan-950/60 text-cyan-300 font-bold border border-cyan-500/40'
                          : 'hover:bg-slate-900/80 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Satellite className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-cyan-400' : 'text-slate-500'}`} />
                        <div className="min-w-0 truncate">
                          <div className="truncate text-xs font-semibold">{sat.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            NORAD #{sat.norad_id} • {sat.country || 'International'}
                          </div>
                        </div>
                      </div>

                      {sat.is_isro && (
                        <span className="shrink-0 ml-2 px-1.5 py-0.2 text-[9px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded">
                          ISRO
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Predict Button */}
        <div className="flex items-end">
          <button
            type="submit"
            className="w-full py-2 px-4 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold flex items-center justify-center gap-1.5 shadow-glow-cyan transition"
          >
            <Send className="w-3.5 h-3.5" /> Predict Passes
          </button>
        </div>

        {/* Custom Lat / Lon Inputs if selected */}
        {isCustom && (
          <div className="md:col-span-4 grid grid-cols-2 gap-3 mt-1">
            <input
              type="number"
              step="0.0001"
              value={customLat}
              onChange={(e) => setCustomLat(e.target.value)}
              placeholder="Latitude (e.g. 13.0827)"
              className="px-3 py-2 rounded-lg bg-space-950 border border-slate-700 text-slate-200"
            />
            <input
              type="number"
              step="0.0001"
              value={customLon}
              onChange={(e) => setCustomLon(e.target.value)}
              placeholder="Longitude (e.g. 80.2707)"
              className="px-3 py-2 rounded-lg bg-space-950 border border-slate-700 text-slate-200"
            />
          </div>
        )}
      </form>

      {/* Target & Station Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-cyan-950/40 border border-cyan-500/30 text-xs font-mono mb-4">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-cyan-400" />
          <span>
            Target Location: <strong className="text-cyan-200">{stationInfo.name || 'Selected Ground Station'}</strong> ({stationInfo.lat?.toFixed(2)}°, {stationInfo.lon?.toFixed(2)}°)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span>
            Spacecraft: <strong className="text-emerald-300">{satInfo.name || selectedSatObj?.name || 'ISS (ZARYA)'}</strong> (NORAD: {satInfo.norad_id || selectedNorad})
          </span>
        </div>
      </div>

      {/* Passes Results Table */}
      <div className="overflow-x-auto mb-5">
        <table className="w-full text-left text-xs font-sans">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 font-mono uppercase text-[11px]">
              <th className="py-2.5 px-3">Pass #</th>
              <th className="py-2.5 px-3">AOS Time (UTC)</th>
              <th className="py-2.5 px-3">Max Elevation</th>
              <th className="py-2.5 px-3">LOS Time (UTC)</th>
              <th className="py-2.5 px-3">Duration</th>
              <th className="py-2.5 px-3">Azimuth Trajectory</th>
              <th className="py-2.5 px-3 text-center">Quality</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-850">
            {passes.length > 0 ? (
              passes.map((p, idx) => (
                <tr key={idx} className="hover:bg-slate-900/60 transition">
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-400">
                    #{idx + 1}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-cyan-300">
                    {p.aos_time ? p.aos_time.replace('T', ' ').replace('Z', '') : '---'}
                  </td>
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-100">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs ${
                        p.max_elevation >= 50
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : p.max_elevation >= 25
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {p.max_elevation}°
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-300">
                    {p.los_time ? p.los_time.replace('T', ' ').replace('Z', '') : '---'}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-200">
                    {p.duration || '---'}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-cyan-400">
                    {formatTrajectory(p)}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span
                      className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        p.quality === 'EXCELLENT'
                          ? 'text-emerald-400'
                          : p.quality === 'GOOD'
                          ? 'text-cyan-400'
                          : 'text-slate-400'
                      }`}
                    >
                      {p.quality}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className={`py-6 text-center font-mono ${passesError ? 'text-amber-400 bg-amber-950/20' : 'text-slate-400'}`}>
                  {passesError || 'Evaluating upcoming pass geometry over your location...'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 2D Ground Track Polyline Coordinates Section */}
      {groundTrack.length > 0 && (
        <div className="pt-4 border-t border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-cyan-400 font-mono flex items-center gap-1.5 uppercase tracking-wider">
              <Navigation className="w-3.5 h-3.5" /> Orbit Ground Track Subpoint Coordinates
            </h3>
            <span className="text-[10px] font-mono text-slate-400">Past 45m → Future 45m</span>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 font-mono text-[10px]">
            {groundTrack.map((pt, i) => (
              <div
                key={i}
                className={`p-2 rounded-lg border whitespace-nowrap min-w-[120px] flex-shrink-0 ${
                  pt.is_current
                    ? 'bg-emerald-950/40 border-emerald-500 text-emerald-300 font-bold shadow-glow-emerald'
                    : 'bg-space-950/60 border-slate-800 text-slate-400'
                }`}
              >
                <div className="text-[9px] uppercase tracking-wider text-slate-500 flex justify-between">
                  <span>{pt.timestamp}</span>
                  {pt.is_current && <span className="text-emerald-400">LIVE</span>}
                </div>
                <div className="text-slate-200 mt-1">
                  {pt.lat}°, {pt.lon}°
                </div>
                <div className="text-slate-400 text-[9px]">{pt.alt_km} km</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PassPredictor;
