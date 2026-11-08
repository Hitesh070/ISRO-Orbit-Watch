/**
 * SatelliteInfo Component
 * Detailed catalog and SGP4-predicted orbital state for the selected spacecraft.
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
  const conjunctions = useOrbitStore((state) => state.conjunctions);
  const navigate = useNavigate();

  // SGP4-predicted position from catalog elements at the simulation time.
  const [liveTelemetry, setLiveTelemetry] = useState(null);

  useEffect(() => {
    if (!selectedSatellite?.norad_id) return;

    const tick = () => {
      const state = useOrbitStore.getState();
      const numId = Number(selectedSatellite.norad_id);

      // Advance in lockstep with global master simulation clock
      const simMs = state.simulatedTimeMs || Date.now();
      const simDate = new Date(simMs);

      // Guarantee TLE line1 & line2
      const currentTarget = state.selectedSatellite;
      let line1 = currentTarget?.line1;
      let line2 = currentTarget?.line2;

      if (!line1 || !line2) {
        const item =
          (state.catalog || []).find((s) => Number(s.norad_id) === numId || Number(s.alt_alias_id) === numId) ||
          (state.satellites || []).find((s) => Number(s.norad_id) === numId) ||
          (state.debris || []).find((s) => Number(s.norad_id) === numId);
        if (item) {
          line1 = item.line1;
          line2 = item.line2;
        }
      }

      const realTimeData = propagateSatelliteRealTime(numId, simDate, line1, line2);
      if (realTimeData) {
        setLiveTelemetry(realTimeData);
      }
    };

    tick();
    const interval = setInterval(tick, 100);

    return () => clearInterval(interval);
  }, [selectedSatellite?.norad_id, selectedSatellite?.line1, selectedSatellite?.line2]);

  if (!selectedSatellite) return null;

  const data = selectedSatelliteDetail || selectedSatellite;
  const isDebris = data.object_type === 'Debris' || data.object_type === 'Rocket Body';
  const risk = data.risk || {};

  // Current values are propagated from catalog elements at the simulation time.
  const currentAlt = liveTelemetry?.alt_km ?? data.alt_km ?? '---';
  const currentVel = liveTelemetry?.velocity_km_s ?? data.velocity_km_s ?? '---';
  const currentLat = liveTelemetry?.lat ?? data.lat;
  const currentLon = liveTelemetry?.lon ?? data.lon;

  const observerLocation = useOrbitStore((state) => state.observerLocation);

  const handlePredictPasses = () => {
    const hasValidObserver = Number.isFinite(observerLocation?.lat) &&
      Number.isFinite(observerLocation?.lon) &&
      Number.isFinite(observerLocation?.alt_m) &&
      ['station_preset', 'user_supplied_msl'].includes(observerLocation?.altitude_source);
    if (!hasValidObserver) {
      navigate('/dashboard');
      return;
    }
    fetchPasses(`${observerLocation.lat},${observerLocation.lon},${observerLocation.alt_m}`, data.norad_id);
    navigate('/dashboard');
  };

  return (
    <div className="absolute top-16 right-4 w-80 md:w-88 glass-panel-glow rounded-xl p-4 shadow-2xl z-30 text-slate-100 max-h-[calc(100vh-100px)] overflow-y-auto no-scrollbar animate-in fade-in slide-in-from-right-4 duration-200">
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
              <Activity className="w-3 h-3" /> SGP4 PREDICTION
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
          <div className="flex items-center justify-between text-slate-400 text-[10px]">
            <div className="flex items-center gap-1.5">
              <Gauge className="w-3 h-3 text-cyan-400" /> Predicted Altitude
            </div>
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" title="SGP4 prediction from catalog orbital elements" />
          </div>
          <div className="text-sm font-mono font-bold text-slate-100 mt-0.5">
            {formatDistance(currentAlt, settings?.units, 3)}
          </div>
          {liveTelemetry?.radial_rate_ms !== undefined && (
            <div className={`text-[10px] font-mono mt-0.5 flex items-center gap-1 font-semibold ${
              liveTelemetry.radial_rate_ms >= 0 ? 'text-cyan-400' : 'text-amber-400'
            }`}>
              <span>{liveTelemetry.radial_rate_ms >= 0 ? '▲ +' : '▼ '}</span>
              <span>{Math.abs(liveTelemetry.radial_rate_ms).toFixed(1)} m/s rate</span>
            </div>
          )}
        </div>

        <div className="p-2 rounded-lg bg-space-900/80 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-[10px]">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-cyan-400" /> Velocity Vector
            </div>
            <span className="text-[9px] font-mono text-emerald-400 font-semibold">|v|</span>
          </div>
          <div className="text-sm font-mono font-bold text-emerald-300 mt-0.5">
            {formatSpeed(currentVel, settings?.units, 4)}
          </div>
          {liveTelemetry?.vx !== undefined && (
            <div className="text-[9px] font-mono text-slate-400 mt-0.5 truncate" title={`[vx, vy, vz]: [${liveTelemetry.vx}, ${liveTelemetry.vy}, ${liveTelemetry.vz}] km/s`}>
              [{liveTelemetry.vx >= 0 ? '+' : ''}{liveTelemetry.vx.toFixed(1)}, {liveTelemetry.vy >= 0 ? '+' : ''}{liveTelemetry.vy.toFixed(1)}, {liveTelemetry.vz >= 0 ? '+' : ''}{liveTelemetry.vz.toFixed(1)}]
            </div>
          )}
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

      {/* SGP4-predicted subpoint coordinates */}
      <div className="p-2 rounded-lg bg-space-900/80 border border-slate-800 text-[11px] space-y-1 mb-2.5 font-mono">
        <div className="flex justify-between">
          <span className="text-slate-400">Sub-satellite Position:</span>
          <span className="text-cyan-300 font-semibold">
            {typeof currentLat === 'number' && typeof currentLon === 'number'
              ? `${Math.abs(currentLat).toFixed(4)}°${currentLat >= 0 ? 'N' : 'S'}, ${Math.abs(currentLon).toFixed(4)}°${currentLon >= 0 ? 'E' : 'W'}`
              : '---'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Operating Agency:</span>
          <span className="text-slate-200 truncate max-w-[150px]">{data.country || 'Unavailable'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Orbital Regime:</span>
          <span className="text-amber-300">{data.regime || 'Unavailable'}</span>
        </div>

      </div>

      {/* Conjunction Risk Assessment Section */}
      {!isDebris && (
        <div className="border-t border-cyan-500/20 pt-2.5">
          {(() => {
            const matches = (conjunctions || []).filter(
              (c) => c.object1?.norad_id === data.norad_id || c.object2?.norad_id === data.norad_id
            );
            const matched = matches[0];
            const isCritical = matched?.risk_level === 'CRITICAL';
            const isWarning = matched?.risk_level === 'WARNING';
            const threatBadge = matched ? matched.risk_level : 'NO MATCHING EVENT';

            return (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    {threatBadge === 'HIGH RISK' ? (
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
                    ) : threatBadge === 'CAUTION' ? (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    ) : (
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                    Conjunction screening record
                  </span>
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full font-bold font-mono ${
                      threatBadge === 'HIGH RISK'
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                        : threatBadge === 'CAUTION'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    }`}
                  >
                    {matches.length} event{matches.length === 1 ? '' : 's'}
                  </span>
                </div>

                <div className="space-y-1 text-[11px] text-slate-300 bg-space-950/60 p-2 rounded-lg border border-slate-800 font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Screened event:</span>
                    <span className="text-amber-400 font-bold">{matched ? matched.id : 'None in loaded snapshot'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Closest Approach:</span>
                    <span className="text-cyan-300">
                      {matched
                        ? `${formatDistance(matched.miss_distance_km, settings?.units, 2)} (${matched.object1?.norad_id === data.norad_id ? matched.object2?.name : matched.object1?.name})`
                        : 'Unavailable; absence of a record is not a clearance'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Collision Probability:</span>
                    <span className="text-rose-400 font-semibold">
                        Unavailable without measured covariance
                    </span>
                  </div>
                </div>


              </>
            );
          })()}
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
