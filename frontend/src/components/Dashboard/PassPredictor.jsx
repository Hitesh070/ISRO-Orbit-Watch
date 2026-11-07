/**
 * PassPredictor Component
 * High-precision ground station pass prediction engine using Skyfield's find_events.
 * Features automated browser GPS geolocation auto-detection.
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Radio, MapPin, Compass, Clock, Send, Globe2, Sparkles, Navigation, LocateFixed, ArrowRight } from 'lucide-react';
import { useOrbitStore } from '../../store/useOrbitStore';

export const PassPredictor = () => {
  const groundStations = useOrbitStore((state) => state.groundStations);
  const passesData = useOrbitStore((state) => state.passesData);
  const passesError = useOrbitStore((state) => state.passesError);
  const fetchPasses = useOrbitStore((state) => state.fetchPasses);
  const satellites = useOrbitStore((state) => state.satellites);

  const [selectedCity, setSelectedCity] = useState('bengaluru');
  const [selectedNorad, setSelectedNorad] = useState(25544); // ISS
  const [customLat, setCustomLat] = useState('');
  const [customLon, setCustomLon] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [geoStatus, setGeoStatus] = useState('');

  // Auto-detect user's real location on load
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
          // Fallback to Bengaluru (ISRO Headquarters)
          fetchPasses('bengaluru', selectedNorad);
        },
        { timeout: 8000 }
      );
    } else {
      fetchPasses('bengaluru', selectedNorad);
    }
  }, []);

  const handleDetectLocation = () => {
    if (!('geolocation' in navigator)) {
      setGeoStatus('Geolocation not supported by this browser.');
      return;
    }
    setGeoStatus('Acquiring GPS coordinates...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = Number(position.coords.latitude.toFixed(4));
        const lon = Number(position.coords.longitude.toFixed(4));
        setCustomLat(String(lat));
        setCustomLon(String(lon));
        setIsCustom(true);
        setGeoStatus(`Acquired: ${lat}° N, ${lon}° E`);
        fetchPasses(`${lat},${lon}`, selectedNorad);
      },
      (err) => {
        setGeoStatus(`Location access denied or timed out (${err.message}).`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handlePredict = (e) => {
    e.preventDefault();
    if (isCustom && customLat && customLon) {
      fetchPasses(`${customLat},${customLon}`, selectedNorad);
    } else {
      fetchPasses(selectedCity, selectedNorad);
    }
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
        <div className="text-[11px] font-mono text-cyan-300 bg-cyan-950/40 px-3 py-1.5 rounded-lg border border-cyan-500/30 mb-3 flex items-center gap-2">
          <MapPin className="w-3.5 h-3.5 text-cyan-400" />
          <span>{geoStatus}</span>
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

        {/* Target Spacecraft Selection */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Target Spacecraft
          </label>
          <select
            value={selectedNorad}
            onChange={(e) => setSelectedNorad(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-lg bg-space-950/80 border border-slate-700 text-slate-200 focus:outline-none focus:border-cyan-400"
          >
            <option value={25544}>ISS (ZARYA) - 25544</option>
            <option value={48274}>TIANGONG (CSS) - 48274</option>
            <option value={36795}>CARTOSAT-2B (ISRO) - 36795</option>
            <option value={44804}>CARTOSAT-3 (ISRO) - 44804</option>
            <option value={44857}>RISAT-2BR1 (ISRO) - 44857</option>
            <option value={20580}>HST (HUBBLE) - 20580</option>
            {satellites
              .filter((s) => ![25544, 48274, 36795, 44804, 44857, 20580].includes(s.norad_id))
              .map((s) => (
                <option key={s.norad_id} value={s.norad_id}>
                  {s.name} - {s.norad_id}
                </option>
              ))}
          </select>
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
            Spacecraft: <strong className="text-emerald-300">{satInfo.name || 'ISS (ZARYA)'}</strong> (NORAD: {satInfo.norad_id || 25544})
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
                    {p.trajectory_summary || 'N/A'} ({p.aos_azimuth}° → {p.los_azimuth}°)
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
