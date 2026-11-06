/**
 * ConjunctionPanel Component
 * Real-time Space Conjunction Assessment alerts with live countdown timers to TCA
 * (Time of Closest Approach), miss distance thresholds, and 3D globe visualization hooks.
 */

import React, { useState, useEffect } from 'react';
import { AlertCircle, Clock, Zap, Target, ExternalLink, ShieldAlert } from 'lucide-react';
import { useOrbitStore } from '../../store/useOrbitStore';
import { useNavigate } from 'react-router-dom';

/**
 * Format remaining seconds into HH:MM:SS
 */
function formatCountdown(targetEpoch) {
  const nowEpoch = Math.floor(Date.now() / 1000);
  const diffSec = targetEpoch - nowEpoch;
  if (diffSec <= 0) return 'TCA REACHED';

  const hours = Math.floor(diffSec / 3600);
  const minutes = Math.floor((diffSec % 3600) / 60);
  const seconds = diffSec % 60;
  return `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
}

export const ConjunctionPanel = () => {
  const conjunctions = useOrbitStore((state) => state.conjunctions);
  const selectConjunction = useOrbitStore((state) => state.selectConjunction);
  const selectSatellite = useOrbitStore((state) => state.selectSatellite);
  const navigate = useNavigate();

  // Tick timer every second for live countdowns
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleVisualize = (conj) => {
    selectConjunction(conj);
    selectSatellite(conj.object1.norad_id);
    navigate('/');
  };

  return (
    <div className="glass-panel rounded-xl p-5 shadow-2xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-cyan-500/20 mb-4 gap-2">
        <div>
          <h2 className="text-base font-bold text-cyan-400 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-500 animate-pulse" />
            24-Hour Conjunction Alert Feed
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Automated screening of close approaches bringing cataloged objects within &lt;30 km miss distance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 font-mono text-xs font-bold border border-rose-500/40">
            {conjunctions.length} Active Warnings
          </span>
        </div>
      </div>

      {/* Conjunctions List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {conjunctions.map((conj) => {
          const isCritical = conj.risk_level === 'CRITICAL';
          const isHigh = conj.risk_level === 'HIGH';
          const countdown = formatCountdown(conj.tca_epoch);

          return (
            <div
              key={conj.id}
              className={`rounded-xl p-4 border transition-all flex flex-col justify-between ${
                isCritical
                  ? 'bg-rose-950/25 border-rose-500/50 hover:border-rose-400 shadow-glow-rose'
                  : isHigh
                  ? 'bg-amber-950/20 border-amber-500/40 hover:border-amber-300'
                  : 'bg-space-900/60 border-slate-800 hover:border-cyan-500/40'
              }`}
            >
              <div>
                {/* Status Badge & Countdown */}
                <div className="flex items-center justify-between mb-2.5">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase border ${
                      isCritical
                        ? 'bg-rose-500/30 text-rose-300 border-rose-500/60'
                        : isHigh
                        ? 'bg-amber-500/30 text-amber-300 border-amber-500/60'
                        : 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40'
                    }`}
                  >
                    {conj.risk_level} CONJUNCTION
                  </span>

                  <div className="flex items-center gap-1 text-[11px] font-mono text-cyan-300">
                    <Clock className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{countdown}</span>
                  </div>
                </div>

                {/* Encountered Spacecraft Pair */}
                <div className="space-y-1.5 mb-3">
                  <div className="p-2 rounded-lg bg-space-950/70 border border-slate-800">
                    <div className="text-[10px] text-cyan-400 font-mono">OBJECT 1 (Spacecraft)</div>
                    <div className="text-xs font-bold text-slate-100 truncate">
                      {conj.object1.name}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      NORAD: {conj.object1.norad_id}
                    </div>
                  </div>

                  <div className="p-2 rounded-lg bg-space-950/70 border border-slate-800">
                    <div className="text-[10px] text-rose-400 font-mono">OBJECT 2 (Debris / Threat)</div>
                    <div className="text-xs font-bold text-slate-100 truncate">
                      {conj.object2.name}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      NORAD: {conj.object2.norad_id}
                    </div>
                  </div>
                </div>

                {/* Quantitative Metrics */}
                <div className="grid grid-cols-2 gap-1.5 text-xs font-mono mb-3 bg-space-950/50 p-2 rounded-lg border border-slate-800">
                  <div>
                    <div className="text-[10px] text-slate-400">Miss Distance:</div>
                    <div className="font-bold text-rose-400 mt-0.5">
                      {conj.miss_distance_km} km
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">Relative Velocity:</div>
                    <div className="font-bold text-slate-200 mt-0.5">
                      {conj.relative_velocity_km_s} km/s
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">Collision Prob:</div>
                    <div className="font-bold text-amber-400 mt-0.5">
                      {(conj.collision_probability * 100).toFixed(4)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">TCA Altitude:</div>
                    <div className="font-bold text-cyan-300 mt-0.5">
                      {conj.altitude_km} km
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={() => handleVisualize(conj)}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-cyan-600/30 hover:bg-cyan-600/60 text-cyan-300 border border-cyan-500/40 text-xs font-semibold font-mono transition"
              >
                Visualize Encounter on 3D Globe <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ConjunctionPanel;
