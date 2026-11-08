/**
 * DebrisStats Component
 * Visualizes orbital shell debris concentration via Recharts bar charts and renders
 * an interactive 2D altitude x inclination catalog count grid.
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

export const DebrisStats = ({ isroOnly = false }) => {
  const riskOverview = useOrbitStore((state) => state.riskOverview);
  const catalog = useOrbitStore((state) => state.catalog);
  const displayedCatalog = React.useMemo(() => {
    const source = catalog && catalog.length > 0 ? catalog : [];
    if (!isroOnly) return source;
    return source.filter((item) => item.is_isro || (item.country || '').toLowerCase().includes('india'));
  }, [catalog, isroOnly]);

  // Scope the shell counts to the same asset filter used by the dashboard cards.
  const shellStats = React.useMemo(() => {
    if (displayedCatalog.length > 0 || (catalog && catalog.length > 0)) {
      const debrisObjects = displayedCatalog.filter(
        (c) => c.object_type === 'Debris' || c.object_type === 'Rocket Body'
      );
      let leo = 0;
      let meo = 0;
      let geo = 0;
      for (const d of debrisObjects) {
        const alt = d.perigee_km ?? d.alt_km;
        if (!Number.isFinite(alt)) continue;
        if (alt < 2000) leo++;
        else if (alt < 35786) meo++;
        else geo++;
      }
      return [
        { shell: 'LEO (<2000 km)', count: leo, density: 'Catalog count' },
        { shell: 'MEO (2000-35786 km)', count: meo, density: 'Catalog count' },
        { shell: 'GEO (≥35786 km)', count: geo, density: 'Catalog count' },
      ];
    }
    return riskOverview?.shell_stats || [];
  }, [displayedCatalog, catalog, riskOverview]);

  // Compute the displayed bins only from records actually loaded.
  const heatmap = React.useMemo(() => {
    if (!isroOnly && (!catalog || catalog.length === 0) && riskOverview?.heatmap && riskOverview.heatmap.length > 0) {
      return riskOverview.heatmap;
    }

    const sourceList = displayedCatalog;
    const alt_bins = [
      ['200–600 km', 200, 600],
      ['600–900 km', 600, 900],
      ['900–1400 km', 900, 1400],
      ['1400–2000 km', 1400, 2000],
    ];
    const inc_bins = [
      ['0°–30°', 0, 30],
      ['30°–60°', 30, 60],
      ['60°–85°', 60, 85],
      ['85°–105°', 85, 105],
    ];

    const grid = [];
    for (const [altLabel, aMin, aMax] of alt_bins) {
      for (const [incLabel, iMin, iMax] of inc_bins) {
        let count = 0;
        if (sourceList.length > 0) {
          count = sourceList.filter((o) => {
            const alt = o.perigee_km ?? o.alt_km;
            const inc = o.inclination;
            if (!Number.isFinite(alt) || !Number.isFinite(inc)) return false;
            return alt >= aMin && alt < aMax && inc >= iMin && inc < iMax;
          }).length;
        }

        grid.push({
          altitude_bin: altLabel,
          inclination_bin: incLabel,
          object_count: count,
          density_level: 'Count only',
        });
      }
    }
    return grid;
  }, [catalog, displayedCatalog, isroOnly, riskOverview]);

  const shellColors = ['#ef4444', '#f59e0b', '#8b5cf6'];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Chart: Debris by Orbital Shell */}
      <div className="glass-panel rounded-xl p-5 shadow-2xl flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-cyan-500/20 mb-4">
            <h3 className="text-sm font-bold text-cyan-400 flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              Debris & Rocket Bodies by Orbital Shell
            </h3>
            <span className="text-[11px] font-mono text-slate-400">LEO vs MEO vs GEO</span>
          </div>

          <p className="text-xs text-slate-400 mb-4 leading-relaxed">
            Counts include debris and rocket bodies in the loaded catalog and use the current asset filter. They do not represent the full tracked population unless the source provides a complete catalog.
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
                          <span>Catalog objects:</span>
                          <span className="text-white font-extrabold bg-cyan-950 px-2 py-0.5 rounded border border-cyan-500/40 text-sm">
                            {Number(d.value).toLocaleString()}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-300 mt-1.5 flex items-center gap-1.5">
                          <span>Catalog count:</span>
                          <span className="font-bold uppercase text-cyan-300">
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
              <div className="text-[9px] font-semibold uppercase tracking-wider mt-0.5 text-cyan-300">
                {s.density}
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
              Orbital Catalog Distribution
            </h3>
            <span className="text-[11px] font-mono text-slate-400">Altitude × Inclination</span>
          </div>

          <p className="text-xs text-slate-400 mb-3 leading-relaxed">
            Counts records in the current asset filter by orbital altitude and inclination. This distribution is not a collision-risk or conjunction-probability assessment.
          </p>

          {/* Column Headers: Inclination Bins */}
          <div className="grid grid-cols-4 gap-1.5 text-center mb-1 text-[10px] font-mono font-semibold text-slate-400">
            <div>0°–30° <span className="text-[9px] text-slate-500 block">Equatorial</span></div>
            <div>30°–60° <span className="text-[9px] text-slate-500 block">Mid-Inc</span></div>
            <div>60°–85° <span className="text-[9px] text-slate-500 block">High-Inc</span></div>
            <div className="text-amber-300">85°–105° <span className="text-[9px] text-amber-400/80 block">Polar SSO</span></div>
          </div>

          {/* 2D Heatmap Grid */}
          <div className="grid grid-cols-4 gap-1.5 text-center">
            {heatmap.slice(0, 16).map((cell, idx) => {
              const level = cell.density_level;
              const bg = 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300';

              return (
                <div
                  key={idx}
                  title={`${cell.altitude_bin} × ${cell.inclination_bin}: ${cell.object_count} catalog objects`}
                  className={`p-2 rounded-lg border text-xs transition hover:scale-[1.03] flex flex-col justify-between min-h-[58px] ${bg}`}
                >
                  <div className="text-[10px] font-mono text-slate-300 truncate">
                    {cell.altitude_bin ? cell.altitude_bin.split(' ')[0] : (cell.bin || '---')}
                  </div>
                  <div className="font-mono text-xs font-bold text-slate-100">{cell.object_count} obj</div>
                  <div className="text-[9px] uppercase tracking-wider font-semibold">{level}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Heatmap Legend */}
        <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-400">
          <span className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-cyan-400" /> Catalog counts only:
          </span>
          <span>Each cell shows the number of catalog objects in that bin.</span>
        </div>
      </div>
    </div>
  );
};

export default DebrisStats;
