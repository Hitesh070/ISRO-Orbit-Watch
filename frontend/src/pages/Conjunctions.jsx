/**
 * Conjunctions Page
 * Dedicated orbital conjunction assessment and planetary defense panel with
 * collision avoidance thresholds, TCA countdowns, and close approach geometry analysis.
 */

import React, { useEffect } from 'react';
import { AlertOctagon, ShieldAlert, Zap, Compass, Info, CheckCircle2 } from 'lucide-react';
import ConjunctionPanel from '../components/Dashboard/ConjunctionPanel';
import { useOrbitStore } from '../store/useOrbitStore';

export const Conjunctions = () => {
  const conjunctions = useOrbitStore((state) => state.conjunctions);

  const criticalCount = conjunctions.filter((c) => c.risk_level === 'CRITICAL').length;
  const highCount = conjunctions.filter((c) => c.risk_level === 'HIGH').length;

  return (
    <div className="min-h-[calc(100vh-60px)] bg-space-950 p-4 md:p-6 text-slate-100 overflow-y-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-rose-500/20 gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold tracking-tight bg-gradient-to-r from-rose-400 via-amber-300 to-cyan-400 bg-clip-text text-transparent flex items-center gap-2.5">
            <AlertOctagon className="w-6 h-6 text-rose-500" />
            Active Orbital Conjunction Alerts & Collision Screening
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Predictive 24-hour lookahead screening detecting close approaches between operational satellites and space debris fragments.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-lg bg-rose-950/60 border border-rose-500/40 text-rose-300 font-mono text-xs font-bold flex items-center gap-1.5 shadow-glow-rose">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            {criticalCount} Critical Conjunctions (&lt;5 km)
          </span>
        </div>
      </div>

      {/* Protocol Explanation Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl glass-panel border border-cyan-500/20">
          <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs font-mono mb-1.5">
            <Info className="w-4 h-4 text-cyan-400" /> 1. Conjunction Criteria
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Identifies when two orbital trajectories intersect within a Euclidean distance of <strong>&lt;5 km</strong> (Critical) or <strong>5-15 km</strong> (High Alert) within a rolling 24-hour lookahead window.
          </p>
        </div>

        <div className="p-4 rounded-xl glass-panel border border-amber-500/20">
          <div className="flex items-center gap-2 text-amber-300 font-bold text-xs font-mono mb-1.5">
            <Zap className="w-4 h-4 text-amber-400" /> 2. Relative Velocity Dynamics
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Orbital collision encounters typically occur at closing speeds between <strong>8 km/s and 14 km/s</strong> (28,000–50,000 km/h), where a 1 cm bolt carries the kinetic energy of a hand grenade.
          </p>
        </div>

        <div className="p-4 rounded-xl glass-panel border border-emerald-500/20">
          <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs font-mono mb-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" /> 3. Avoidance Maneuvers (CAM)
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            When collision probability exceeds 10⁻⁴ (1 in 10,000), satellite ground controllers schedule a prograde or radial thruster burn (+0.5 to 1.5 m/s delta-v) 12–24 hours prior to TCA.
          </p>
        </div>
      </div>

      {/* Primary Alerts Feed */}
      <ConjunctionPanel />
    </div>
  );
};

export default Conjunctions;
