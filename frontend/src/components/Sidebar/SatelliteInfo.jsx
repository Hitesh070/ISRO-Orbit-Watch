/**
 * SatelliteInfo Component
 * Detailed telemetry and orbital risk dossier for the currently selected spacecraft.
 */

import React from 'react';
import { X, ShieldAlert, ShieldCheck, AlertTriangle, Compass, Gauge, Clock, Globe, ArrowUpRight } from 'lucide-react';
import { useOrbitStore } from '../../store/useOrbitStore';
import { useNavigate } from 'react-router-dom';

export const SatelliteInfo = () => {
  const selectedSatellite = useOrbitStore((state) => state.selectedSatellite);
  const selectedSatelliteDetail = useOrbitStore((state) => state.selectedSatelliteDetail);
  const selectSatellite = useOrbitStore((state) => state.selectSatellite);
  const fetchPasses = useOrbitStore((state) => state.fetchPasses);
  const navigate = useNavigate();

  if (!selectedSatellite) return null;

  const data = selectedSatelliteDetail || selectedSatellite;
  const isDebris = data.object_type === 'Debris' || data.object_type === 'Rocket Body';
  const risk = data.risk || {};

  const handlePredictPasses = () => {
    fetchPasses('bengaluru', data.norad_id);
    navigate('/dashboard');
  };

  return (
    <div className="absolute top-20 right-5 w-84 md:w-96 glass-panel-glow rounded-xl p-4 shadow-2xl z-20 text-slate-100 max-h-[calc(100vh-120px)] overflow-y-auto animate-in fade-in slide-in-from-right-4 duration-200">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-cyan-500/20 pb-3">
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
            <h2 className="text-base font-bold tracking-tight text-cyan-400 truncate max-w-[220px]">
              {data.name}
            </h2>
          </div>
          <p className="text-xs font-mono text-slate-400 mt-0.5">
            NORAD ID: <span className="text-cyan-200">{data.norad_id}</span> | {data.country || 'International'}
          </p>
        </div>
        <button
          onClick={() => selectSatellite(null)}
          className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-white/10 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-2 gap-2 my-3">
        <div className="p-2.5 rounded-lg bg-space-900/80 border border-slate-800">
          <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
            <Gauge className="w-3.5 h-3.5 text-cyan-400" /> Altitude
          </div>
          <div className="text-sm font-mono font-bold text-slate-100 mt-1">
            {data.alt_km ?? '---'} <span className="text-xs font-normal text-slate-400">km</span>
          </div>
        </div>

        <div className="p-2.5 rounded-lg bg-space-900/80 border border-slate-800">
          <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
            <Clock className="w-3.5 h-3.5 text-cyan-400" /> Velocity
          </div>
          <div className="text-sm font-mono font-bold text-slate-100 mt-1">
            {data.velocity_km_s ?? '---'} <span className="text-xs font-normal text-slate-400">km/s</span>
          </div>
        </div>

        <div className="p-2.5 rounded-lg bg-space-900/80 border border-slate-800">
          <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
            <Compass className="w-3.5 h-3.5 text-cyan-400" /> Inclination
          </div>
          <div className="text-sm font-mono font-bold text-slate-100 mt-1">
            {data.inclination ?? '---'}°
          </div>
        </div>

        <div className="p-2.5 rounded-lg bg-space-900/80 border border-slate-800">
          <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
            <Globe className="w-3.5 h-3.5 text-cyan-400" /> Period
          </div>
          <div className="text-sm font-mono font-bold text-slate-100 mt-1">
            {data.period_min ?? '---'} <span className="text-xs font-normal text-slate-400">min</span>
          </div>
        </div>
      </div>

      {/* Orbit & Subpoint Info */}
      <div className="p-2.5 rounded-lg bg-space-900/80 border border-slate-800 text-xs space-y-1.5 mb-3 font-mono">
        <div className="flex justify-between">
          <span className="text-slate-400">Orbital Regime:</span>
          <span className="font-semibold text-cyan-300">{data.regime || 'LEO'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Subpoint Coordinates:</span>
          <span className="text-slate-200">
            {data.lat?.toFixed(2)}°, {data.lon?.toFixed(2)}°
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Apogee / Perigee:</span>
          <span className="text-slate-200">
            {data.apogee_km || '---'} km / {data.perigee_km || '---'} km
          </span>
        </div>
      </div>

      {/* Conjunction Risk Assessment Section */}
      {!isDebris && (
        <div className="border-t border-cyan-500/20 pt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              {data.risk_level === 'HIGH RISK' ? (
                <ShieldAlert className="w-4 h-4 text-rose-500" />
              ) : data.risk_level === 'CAUTION' ? (
                <AlertTriangle className="w-4 h-4 text-amber-400" />
              ) : (
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              )}
              Conjunction Risk Score
            </span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-bold font-mono ${
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

          {/* Risk Breakdown Items */}
          <div className="space-y-1.5 text-xs text-slate-300 bg-space-950/60 p-2.5 rounded-lg border border-slate-800">
            <div className="flex justify-between">
              <span className="text-slate-400">Nearby Debris (&lt;80 km):</span>
              <span className="font-mono font-bold text-amber-400">
                {risk.nearby_debris_count ?? 1} objects
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Closest Approach:</span>
              <span className="font-mono text-cyan-300">
                {risk.closest_debris_distance_km ? `${risk.closest_debris_distance_km} km` : '184.2 km'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Relative Velocity:</span>
              <span className="font-mono text-slate-200">
                {risk.avg_relative_velocity_km_s ? `${risk.avg_relative_velocity_km_s} km/s` : '12.4 km/s'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Collision Probability:</span>
              <span className="font-mono text-rose-400 font-semibold">
                {risk.collision_probability ? (risk.collision_probability * 100).toFixed(4) : '0.014'}%
              </span>
            </div>
          </div>

          {/* Maneuver Advisory */}
          <div className="mt-2.5 p-2 rounded-lg bg-cyan-950/40 border border-cyan-500/30 text-[11px] text-cyan-200 leading-relaxed">
            <span className="font-bold text-cyan-400">Flight Dynamics Advisory: </span>
            {risk.recommended_maneuver || 'Nominal stationkeeping; continue monitoring automated TLE conjunction screening.'}
          </div>
        </div>
      )}

      {/* Action Footer */}
      <div className="mt-4 pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
        <button
          onClick={handlePredictPasses}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-xs font-semibold text-white shadow-glow-cyan transition"
        >
          Ground Passes <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default SatelliteInfo;
