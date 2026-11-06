/**
 * RiskTable Component
 * Sortable, detailed audit table highlighting the top 10 operational satellites
 * facing critical space debris proximity and high collision vulnerability scores.
 */

import React, { useState } from 'react';
import { ShieldAlert, ArrowUpDown, ExternalLink, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useOrbitStore } from '../../store/useOrbitStore';
import { useNavigate } from 'react-router-dom';

export const RiskTable = () => {
  const riskOverview = useOrbitStore((state) => state.riskOverview);
  const selectSatellite = useOrbitStore((state) => state.selectSatellite);
  const navigate = useNavigate();

  const [sortField, setSortField] = useState('risk_score');
  const [sortAsc, setSortAsc] = useState(false);

  const top10 = riskOverview?.top_10 || [];

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const sortedData = [...top10].sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];
    if (typeof aVal === 'string') {
      return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    return sortAsc ? (aVal || 0) - (bVal || 0) : (bVal || 0) - (aVal || 0);
  });

  const handleInspect = (noradId) => {
    selectSatellite(noradId);
    navigate('/');
  };

  return (
    <div className="glass-panel rounded-xl p-5 shadow-2xl">
      {/* Table Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-cyan-500/20 mb-4 gap-2">
        <div>
          <h2 className="text-base font-bold text-cyan-400 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-500" />
            Top 10 High-Risk Active Satellites
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Ranked by conjunction threat formula: (nearby debris count × relative velocity) / altitude factor
          </p>
        </div>
        <div className="text-xs font-mono text-cyan-300 bg-cyan-950/40 px-3 py-1.5 rounded-lg border border-cyan-500/30 self-start sm:self-auto">
          Updated from CelesTrak SGP4 Catalog
        </div>
      </div>

      {/* Responsive Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-sans">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 font-mono uppercase text-[11px]">
              <th className="py-2.5 px-3">Rank</th>
              <th className="py-2.5 px-3 cursor-pointer hover:text-cyan-300" onClick={() => handleSort('name')}>
                <div className="flex items-center gap-1">Satellite <ArrowUpDown className="w-3 h-3" /></div>
              </th>
              <th className="py-2.5 px-3 cursor-pointer hover:text-cyan-300" onClick={() => handleSort('altitude_km')}>
                <div className="flex items-center gap-1">Alt (km) <ArrowUpDown className="w-3 h-3" /></div>
              </th>
              <th className="py-2.5 px-3 cursor-pointer hover:text-cyan-300" onClick={() => handleSort('nearby_debris_count')}>
                <div className="flex items-center gap-1">Nearby Debris <ArrowUpDown className="w-3 h-3" /></div>
              </th>
              <th className="py-2.5 px-3 cursor-pointer hover:text-cyan-300" onClick={() => handleSort('closest_debris_distance_km')}>
                <div className="flex items-center gap-1">Closest Debris <ArrowUpDown className="w-3 h-3" /></div>
              </th>
              <th className="py-2.5 px-3 cursor-pointer hover:text-cyan-300" onClick={() => handleSort('avg_relative_velocity_km_s')}>
                <div className="flex items-center gap-1">Rel Vel <ArrowUpDown className="w-3 h-3" /></div>
              </th>
              <th className="py-2.5 px-3 cursor-pointer hover:text-cyan-300" onClick={() => handleSort('risk_score')}>
                <div className="flex items-center gap-1">Risk Score <ArrowUpDown className="w-3 h-3" /></div>
              </th>
              <th className="py-2.5 px-3 text-center">Inspect</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-850">
            {sortedData.map((sat, index) => {
              const score = sat.risk_score || 0;
              const isHigh = score >= 70;
              const isCaution = score >= 35 && score < 70;

              return (
                <tr key={sat.norad_id} className="hover:bg-slate-900/60 transition group">
                  <td className="py-3 px-3 font-mono font-bold text-slate-400">
                    #{index + 1}
                  </td>
                  <td className="py-3 px-3">
                    <div className="font-semibold text-slate-100 group-hover:text-cyan-300 transition">
                      {sat.name}
                    </div>
                    <div className="text-[10px] font-mono text-slate-500">
                      NORAD: {sat.norad_id} | {sat.country}
                    </div>
                  </td>
                  <td className="py-3 px-3 font-mono text-slate-300">
                    {sat.altitude_km?.toFixed(1) || '---'}
                  </td>
                  <td className="py-3 px-3 font-mono">
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 font-bold border border-amber-500/30">
                      {sat.nearby_debris_count}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <div className="font-mono text-cyan-300 font-medium">
                      {sat.closest_debris_distance_km?.toFixed(1)} km
                    </div>
                    <div className="text-[10px] text-slate-400 truncate max-w-[140px]">
                      {sat.closest_debris_name}
                    </div>
                  </td>
                  <td className="py-3 px-3 font-mono text-slate-300">
                    {sat.avg_relative_velocity_km_s?.toFixed(2)} km/s
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            isHigh ? 'bg-rose-500' : isCaution ? 'bg-amber-400' : 'bg-emerald-400'
                          }`}
                          style={{ width: `${Math.min(100, score)}%` }}
                        />
                      </div>
                      <span
                        className={`font-mono font-bold ${
                          isHigh ? 'text-rose-400' : isCaution ? 'text-amber-300' : 'text-emerald-400'
                        }`}
                      >
                        {score}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <button
                      onClick={() => handleInspect(sat.norad_id)}
                      className="p-1.5 rounded-lg bg-cyan-950/60 hover:bg-cyan-600/40 text-cyan-400 border border-cyan-500/30 transition hover:shadow-glow-cyan"
                      title="Inspect 3D Orbit on Globe"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RiskTable;
