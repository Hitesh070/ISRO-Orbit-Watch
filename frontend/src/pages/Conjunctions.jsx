/**
 * Conjunctions Page
 * Dedicated orbital conjunction assessment and planetary defense panel with
 * collision avoidance thresholds, TCA countdowns, and close approach geometry analysis.
 */

import React from 'react';
import ConjunctionPanel from '../components/Dashboard/ConjunctionPanel';
import { useOrbitStore } from '../store/useOrbitStore';

export const Conjunctions = () => {
  const conjunctions = useOrbitStore((state) => state.conjunctions);
  const criticalCount = conjunctions.filter((c) => c.risk_level === 'CRITICAL').length;

  return (
    <div className="w-full bg-space-950 p-4 md:p-6 text-slate-100 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-rose-500/20 gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold tracking-tight bg-gradient-to-r from-rose-400 via-amber-300 to-cyan-400 bg-clip-text text-transparent">
            Active Orbital Conjunction Alerts & Collision Screening
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-lg bg-rose-950/60 border border-rose-500/40 text-rose-300 font-mono text-xs font-bold flex items-center gap-1.5 shadow-glow-rose">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            {criticalCount} Critical Conjunctions
          </span>
        </div>
      </div>

      {/* Primary Alerts Feed */}
      <ConjunctionPanel />
    </div>
  );
};

export default Conjunctions;
