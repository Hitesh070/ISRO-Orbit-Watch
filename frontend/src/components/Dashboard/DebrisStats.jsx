/**
 * DebrisStats Component
 * Visualizes orbital shell debris concentration via Recharts bar charts and renders
 * an interactive 2D Altitude x Inclination debris collision density heatmap.
 */

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts';
import { Layers, Flame, Info } from 'lucide-react';
import { useOrbitStore } from '../../store/useOrbitStore';

export const DebrisStats = () => {
  const riskOverview = useOrbitStore((state) => state.riskOverview);
  const catalog = useOrbitStore((state) => state.catalog);

  // Compute live debris distribution from active catalog with global SSN baseline
  const shellStats = React.useMemo(() => {
    if (catalog && catalog.length > 0) {
      const debrisObjects = catalog.filter(
        (c) => c.object_type === 'Debris' || c.object_type === 'Rocket Body'
      );
      if (debrisObjects.length > 0) {
        let leo = 0;
        let meo = 0;
        let geo = 0;
        for (const d of debrisObjects) {
          const alt = d.perigee_km || d.alt_km || 0;
          if (alt < 2000) leo++;
          else if (alt < 35786) meo++;
          else geo++;
        }
        return [
          { shell: 'LEO (<2000 km)', count: leo || 2672, density: 'Critical' },
          { shell: 'MEO (2000-35786 km)', count: meo || 145, density: 'Moderate' },
          { shell: 'GEO (≥35786 km)', count: geo || 320, density: 'High' },
        ];
      }
    }
    return (
      riskOverview?.shell_stats || [
        { shell: 'LEO (<2000 km)', count: 18450, density: 'Critical' },
        { shell: 'MEO (2000-35786 km)', count: 820, density: 'Moderate' },
        { shell: 'GEO (≥35786 km)', count: 2150, density: 'High' },
      ]
    );
  }, [catalog, riskOverview]);

  const heatmap = riskOverview?.heatmap || [];

  const shellColors = ['#ef4444', '#f59e0b', '#8b5cf6'];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Chart: Debris by Orbital Shell */}
      <div className="glass-panel rounded-xl p-5 shadow-2xl flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-cyan-500/20 mb-4">
            <h3 className="text-sm font-bold text-cyan-400 flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              Space Debris Density by Orbital Shell
            </h3>
            <span className="text-[11px] font-mono text-slate-400">LEO vs MEO vs GEO</span>
          </div>

          <p className="text-xs text-slate-400 mb-4 leading-relaxed">
            Low Earth Orbit (LEO) holds over 85% of cataloged debris pieces, created by ASAT tests,
            historical fragmentation collisions, and spent booster breakups.
          </p>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={shellStats} margin={{ top: 25, right: 20, left: -10, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="shell"
                  stroke="#94a3b8"
                  tick={{ fontSize: 11, fontFamily: 'monospace' }}
                  angle={-10}
                  textAnchor="end"
                />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 11, fontFamily: 'monospace' }} domain={[0, (dataMax) => Math.ceil(dataMax * 1.25)]} />
                <Tooltip
                  cursor={{ fill: 'rgba(34, 211, 238, 0.08)' }}
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const d = payload[0];
                    return (
                      <div className="p-3 rounded-lg bg-space-950/95 border border-cyan-500/50 text-xs font-mono shadow-2xl backdrop-blur-md">
                        <div className="text-slate-100 font-bold text-sm mb-1.5">{d.payload.shell}</div>
                        <div className="flex items-center gap-2 text-cyan-300 font-bold text-xs">
                          <span>Tracked Debris:</span>
                          <span className="text-white font-extrabold bg-cyan-950 px-2 py-0.5 rounded border border-cyan-500/40 text-sm">
                            {Number(d.value).toLocaleString()}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-300 mt-1.5 flex items-center gap-1.5">
                          <span>Collision Hazard:</span>
                          <span className={`font-bold uppercase ${
                            d.payload.density === 'Critical' ? 'text-rose-400' :
                            d.payload.density === 'High' ? 'text-amber-400' : 'text-emerald-400'
                          }`}>
                            {d.payload.density}
                          </span>
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  <LabelList
                    dataKey="count"
                    position="top"
                    fill="#38bdf8"
                    fontSize={12}
                    fontWeight="bold"
                    fontFamily="monospace"
                    formatter={(val) => Number(val).toLocaleString()}
                  />
                  {shellStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={shellColors[index % shellColors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Shell Breakdown Badges */}
        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-800 text-center">
          {shellStats.map((s, idx) => (
            <div key={idx} className="p-2 rounded-lg bg-space-950/70 border border-slate-800">
              <div className="text-[10px] font-mono text-slate-400 truncate">{s.shell}</div>
              <div className="text-sm font-mono font-bold text-slate-100 mt-0.5">{s.count}</div>
              <div
                className={`text-[9px] font-semibold uppercase tracking-wider mt-0.5 ${
                  s.density === 'Critical'
                    ? 'text-rose-400'
                    : s.density === 'High'
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}
              >
                {s.density} Risk
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Heatmap: Altitude vs Inclination Debris Density Matrix */}
      <div className="glass-panel rounded-xl p-5 shadow-2xl flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-cyan-500/20 mb-3">
            <h3 className="text-sm font-bold text-cyan-400 flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-400" />
              Orbital Regime Risk Heatmap
            </h3>
            <span className="text-[11px] font-mono text-slate-400">Altitude × Inclination</span>
          </div>

          <p className="text-xs text-slate-400 mb-3 leading-relaxed">
            Concentration matrix identifying severe collision hazard choke-points in polar SSO
            (85°-105°) and high-inclination Russian/Iridium shells.
          </p>

          {/* 2D Heatmap Grid */}
          <div className="grid grid-cols-4 gap-1.5 text-center">
            {heatmap.slice(0, 16).map((cell, idx) => {
              const level = cell.density_level;
              let bg = 'bg-slate-900/60 border-slate-800 text-slate-400';
              if (level === 'Severe') {
                bg = 'bg-rose-500/25 border-rose-500/50 text-rose-300 font-bold';
              } else if (level === 'High') {
                bg = 'bg-amber-500/20 border-amber-500/40 text-amber-300 font-semibold';
              } else if (level === 'Moderate') {
                bg = 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300';
              }

              return (
                <div
                  key={idx}
                  className={`p-2 rounded-lg border text-xs transition hover:scale-[1.02] flex flex-col justify-between min-h-[58px] ${bg}`}
                >
                  <div className="text-[10px] font-mono text-slate-400 truncate">
                    {cell.altitude_bin ? cell.altitude_bin.split(' ')[0] : (cell.bin || '---')}
                  </div>
                  <div className="font-mono text-xs">{cell.object_count} obj</div>
                  <div className="text-[9px] uppercase tracking-wider">{level}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Heatmap Legend */}
        <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-400">
          <span className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-cyan-400" /> Density Levels:
          </span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-cyan-500/30 border border-cyan-400" /> Mod
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-amber-500/30 border border-amber-400" /> High
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-rose-500/40 border border-rose-400" /> Severe
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DebrisStats;
