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
    <div className="w-full bg-space-950 p-4 md:p-6 text-slate-100 space-y-6">
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
            {criticalCount} Critical Conjunctions
          </span>
        </div>
      </div>

      {/* Screening Advisory Notice */}
      <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/30 text-amber-200 text-xs font-mono flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-amber-300">Screening Advisory & Scientific Disclaimer:</span>
          <span className="text-slate-300 ml-1.5">
            Conjunction assessment calculations are generated from public TLE/GP element sets using synthetic RTN covariance models. They serve as <strong>screening-grade situational awareness</strong>. Collision Avoidance Maneuver (CAM) decisions require official Conjunction Data Messages (CDMs) from owner-operators or JSpOC.
          </span>
        </div>
      </div>

      {/* Protocol Explanation Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl glass-panel border border-cyan-500/20">
          <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs font-mono mb-1.5">
            <Info className="w-4 h-4 text-cyan-400" /> 1. Foster-1992 2-D Integral
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Integrates the bivariate Gaussian position uncertainty over the hard-body circle on the encounter plane perpendicular to relative velocity using 64-point Gauss-Legendre quadrature.
          </p>
        </div>

        <div className="p-4 rounded-xl glass-panel border border-amber-500/20">
          <div className="flex items-center gap-2 text-amber-300 font-bold text-xs font-mono mb-1.5">
            <Zap className="w-4 h-4 text-amber-400" /> 2. Akella-Alfriend Pc_max
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Conservative upper bound on collision risk. Scans covariance scaling factors k from 0.01x to 100x to identify the worst-case collision probability independent of covariance scale calibration errors.
          </p>
        </div>

        <div className="p-4 rounded-xl glass-panel border border-emerald-500/20">
          <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs font-mono mb-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" /> 3. Screening Advisory Thresholds
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Operational action threshold is typically Pc ≥ 10⁻⁴ (1 in 10,000) or miss distance &lt; 1 km. Monitored threshold is Pc ≥ 10⁻⁷. Co-orbital pairs (closing speed &lt; 80 m/s) are flagged separately.
          </p>
        </div>
      </div>

      {/* Primary Alerts Feed */}
      <ConjunctionPanel />
    </div>
  );
};

export default Conjunctions;
