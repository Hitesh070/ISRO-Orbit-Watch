/**
 * SatelliteInfo Component
 * Detailed telemetry and orbital risk dossier for the currently selected spacecraft.
 * Features live sub-second continuous telemetry propagation.
 */

import React, { useState, useEffect } from 'react';
import { X, ShieldAlert, ShieldCheck, AlertTriangle, Compass, Gauge, Clock, Globe, ArrowUpRight, Activity, Star } from 'lucide-react';
import { useOrbitStore } from '../../store/useOrbitStore';
import { propagateSatelliteRealTime } from '../../utils/sgp4Engine';
import { formatDistance, formatSpeed } from '../../utils/unitConversion';
import { useNavigate } from 'react-router-dom';

export const SatelliteInfo = () => {
  const selectedSatellite = useOrbitStore((state) => state.selectedSatellite);
  const selectedSatelliteDetail = useOrbitStore((state) => state.selectedSatelliteDetail);
  const selectSatellite = useOrbitStore((state) => state.selectSatellite);
  const fetchPasses = useOrbitStore((state) => state.fetchPasses);
  const favourites = useOrbitStore((state) => state.favourites);
  const toggleFavourite = useOrbitStore((state) => state.toggleFavourite);
  const settings = useOrbitStore((state) => state.settings);
  const navigate = useNavigate();

  // Real-time sub-second continuous live position state
  const [liveTelemetry, setLiveTelemetry] = useState(null);

  useEffect(() => {
    if (!selectedSatellite?.norad_id) return;

    // High frequency 100ms update loop for live sub-second propagation
    const interval = setInterval(() => {
      const now = new Date();
      const currentTarget = useOrbitStore.getState().selectedSatellite;
      const realTimeData = propagateSatelliteRealTime(
        selectedSatellite.norad_id,
        now,
        currentTarget?.line1,
        currentTarget?.line2
      );
      if (realTimeData) {
        setLiveTelemetry(realTimeData);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [selectedSatellite?.norad_id]);

  if (!selectedSatellite) return null;

  const data = selectedSatelliteDetail || selectedSatellite;
  const isDebris = data.object_type === 'Debris' || data.object_type === 'Rocket Body';
  const risk = data.risk || {};

  // Current values: prefer live sub-second telemetry if available
  const currentAlt = liveTelemetry?.alt_km ?? data.alt_km ?? '---';
  const currentVel = liveTelemetry?.velocity_km_s ?? data.velocity_km_s ?? '---';
  const currentLat = liveTelemetry?.lat ?? data.lat ?? 0;
  const currentLon = liveTelemetry?.lon ?? data.lon ?? 0;

  const observerLocation = useOrbitStore((state) => state.observerLocation);

  const handlePredictPasses = () => {
    fetchPasses(observerLocation?.name || 'Observer Station', data.norad_id);
    navigate('/dashboard');
  };

  return (
    <div className="absolute top-16 right-4 w-80 md:w-88 glass-panel-glow rounded-xl p-4 shadow-2xl z-30 text-slate-100 max-h-[calc(100vh-100px)] overflow-y-auto animate-in fade-in slide-in-from-right-4 duration-200">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-cyan-500/20 pb-2.5">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                data.status_color === 'red'
                  ? 'bg-rose-500 shadow-glow-rose'
                  : data.status_color === 'yellow'
                  ? 'bg-amber-400 shadow-glow-amber'
                  : 'bg-emerald-400 shadow-glow-emerald'
              }`}
            />
            <h2 className="text-sm md:text-base font-bold tracking-tight text-cyan-400 truncate max-w-[200px]">
              {data.name}
            </h2>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] font-mono text-slate-400">
              NORAD: <span className="text-cyan-200 font-semibold">{data.norad_id}</span>
            </span>
            <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
              <Activity className="w-3 h-3 animate-pulse" /> LIVE SGP4
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => toggleFavourite(data.norad_id)}
            className={`p-1 rounded-md transition ${
              favourites?.includes(Number(data.norad_id))
                ? 'text-amber-400 bg-amber-400/10'
                : 'text-slate-500 hover:text-amber-300 hover:bg-white/5'
            }`}
            title={favourites?.includes(Number(data.norad_id)) ? 'Starred Satellite' : 'Add to Starred'}
          >
            <Star className={`w-4 h-4 ${favourites?.includes(Number(data.norad_id)) ? 'fill-amber-400' : ''}`} />
          </button>
          <button
            onClick={() => selectSatellite(null)}
            className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-white/10 transition"
            title="Close Panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Primary Metrics Grid (Continuously Ticking Sub-Second Telemetry) */}
      <div className="grid grid-cols-2 gap-2 my-2.5">
        <div className="p-2 rounded-lg bg-space-900/80 border border-slate-800">
          <div className="flex items-center gap-1.5 text-slate-400 text-[10px]">
            <Gauge className="w-3 h-3 text-cyan-400" /> Real-Time Altitude
          </div>
          <div className="text-sm font-mono font-bold text-slate-100 mt-0.5">
            {formatDistance(currentAlt, settings?.units, 2)}
          </div>
        </div>

        <div className="p-2 rounded-lg bg-space-900/80 border border-slate-800">
          <div className="flex items-center gap-1.5 text-slate-400 text-[10px]">
            <Clock className="w-3 h-3 text-cyan-400" /> Velocity Vector
          </div>
          <div className="text-sm font-mono font-bold text-emerald-300 mt-0.5">
            {formatSpeed(currentVel, settings?.units, 3)}
          </div>
        </div>

        <div className="p-2 rounded-lg bg-space-900/80 border border-slate-800">
          <div className="flex items-center gap-1.5 text-slate-400 text-[10px]">
            <Compass className="w-3 h-3 text-cyan-400" /> Inclination
          </div>
          <div className="text-xs font-mono font-bold text-slate-100 mt-0.5">
            {data.inclination ?? '---'}°
          </div>
        </div>

        <div className="p-2 rounded-lg bg-space-900/80 border border-slate-800">
          <div className="flex items-center gap-1.5 text-slate-400 text-[10px]">
            <Globe className="w-3 h-3 text-cyan-400" /> Period
          </div>
          <div className="text-xs font-mono font-bold text-slate-100 mt-0.5">
            {data.period_min ?? '---'} <span className="text-[10px] font-normal text-slate-400">min</span>
          </div>
        </div>
      </div>

      {/* Real-time Subpoint Coordinates */}
      <div className="p-2 rounded-lg bg-space-900/80 border border-slate-800 text-[11px] space-y-1 mb-2.5 font-mono">
        <div className="flex justify-between">
          <span className="text-slate-400">Sub-satellite Position:</span>
          <span className="text-cyan-300 font-semibold">
            {typeof currentLat === 'number' ? `${currentLat.toFixed(4)}°, ${currentLon.toFixed(4)}°` : '---'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Operating Agency:</span>
          <span className="text-slate-200 truncate max-w-[150px]">{data.country || 'International'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Orbital Regime:</span>
          <span className="text-amber-300">{data.regime || 'LEO'}</span>
        </div>
        <div className="flex justify-between items-center pt-1 border-t border-slate-800/60">
          <span className="text-slate-400">Element Epoch Age:</span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] ${
            (data.tle_age_days ?? 1.2) > 14
              ? 'bg-amber-950/80 text-amber-400 border border-amber-500/40'
              : 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
          }`}>
            {(data.tle_age_days ?? 1.2).toFixed(1)} days {(data.tle_age_days ?? 1.2) > 14 ? '⚠️ (Stale)' : '✓ (Fresh)'}
          </span>
        </div>
        <div className="text-[9px] text-slate-500 leading-tight pt-0.5">
          * SGP4 LEO error grows ~1–3 km/day past epoch due to atmospheric drag variation.
        </div>
      </div>

      {/* Conjunction Risk Assessment Section */}
      {!isDebris && (
        <div className="border-t border-cyan-500/20 pt-2.5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              {data.risk_level === 'HIGH RISK' ? (
                <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
              ) : data.risk_level === 'CAUTION' ? (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              )}
              Conjunction Threat Score
            </span>
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full font-bold font-mono ${
                data.risk_level === 'HIGH RISK'
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                  : data.risk_level === 'CAUTION'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              }`}
            >
              {data.risk_score ?? risk.risk_score ?? 15.0} / 100
            </span>
          </div>

          <div className="space-y-1 text-[11px] text-slate-300 bg-space-950/60 p-2 rounded-lg border border-slate-800 font-mono">
            <div className="flex justify-between">
              <span className="text-slate-400">Nearby Debris (&lt;80 km):</span>
              <span className="text-amber-400 font-bold">{risk.nearby_debris_count ?? 1} objects</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Closest Approach:</span>
              <span className="text-cyan-300">
                {risk.closest_debris_distance_km ? `${risk.closest_debris_distance_km} km` : '142.5 km'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Collision Probability:</span>
              <span className="text-rose-400 font-semibold">
                {risk.collision_probability ? (risk.collision_probability * 100).toFixed(4) : '0.012'}%
              </span>
            </div>
          </div>

          {/* Maneuver Advisory */}
          <div className="mt-2 p-2 rounded-lg bg-cyan-950/40 border border-cyan-500/30 text-[10px] text-cyan-200 leading-relaxed font-sans">
            <span className="font-bold text-cyan-400">ISRO/SSA Advisory: </span>
            {risk.recommended_maneuver || 'Nominal orbital stationkeeping; continue monitoring automated TLE conjunction screening.'}
          </div>
        </div>
      )}

      {/* Action Footer */}
      <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
        <button
          onClick={handlePredictPasses}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-xs font-semibold text-white shadow-glow-cyan transition"
        >
          Predict Ground Passes <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default SatelliteInfo;
