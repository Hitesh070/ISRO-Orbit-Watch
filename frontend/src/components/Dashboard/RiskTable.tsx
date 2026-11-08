/**
 * RiskTable Component (Phase 3 Conjunction Risk Suite)
 * ====================================================
 * Displays screened conjunction records without synthesizing missing encounter data.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldAlert,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  Info,
  AlertTriangle,
  ShieldCheck,
  Activity,
} from 'lucide-react';
import { useOrbitStore } from '../../store/useOrbitStore';
import { formatDistance, formatSpeed } from '../../utils/unitConversion';
import { useNavigate } from 'react-router-dom';

/**
 * Reads only the recorded screening TCA. It does not extrapolate an encounter state.
 */
function getTcaStatus(timestampMs: number | null, nowMs: number) {
  if (timestampMs === null || !Number.isFinite(timestampMs)) return 'TCA unavailable';
  const deltaSeconds = Math.round((timestampMs - nowMs) / 1000);
  if (Math.abs(deltaSeconds) < 1) return 'At TCA';
  const duration = formatTcaCountdown(Math.abs(deltaSeconds));
  return deltaSeconds > 0 ? `TCA in ${duration}` : `TCA passed ${duration} ago`;
}

/**
 * Formats ticking TCA countdown with live hours, minutes, and seconds.
 */
function formatTcaCountdown(totalSec: number): string {
  totalSec = Math.max(0, Math.round(totalSec));
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
  }
  return `${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
}

function formatPc(val?: any, digits = 3): string {
  if (val === undefined || val === null) return 'Unavailable';
  const num = Number(val);
  if (isNaN(num) || num < 1e-9) return '< 1e-9';
  return num.toExponential(digits);
}

export const RiskTable = () => {
  const conjunctions = useOrbitStore((state: any) => state.conjunctions);
  const selectSatellite = useOrbitStore((state: any) => state.selectSatellite);
  const selectConjunction = useOrbitStore((state: any) => state.selectConjunction);
  const simulatedTimeMs = useOrbitStore((state: any) => state.simulatedTimeMs);
  const simulationSpeed = useOrbitStore((state: any) => state.simulationSpeed);
  const settings = useOrbitStore((state: any) => state.settings);
  const navigate = useNavigate();

  const [sortField, setSortField] = useState('pc_foster');
  const [sortAsc, setSortAsc] = useState(false);
  const [isroOnly, setIsroOnly] = useState(true);

  // Live 1-second auto-sync ticker for sub-second astrodynamic updates
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // Live master simulation / real-time clock
  const currentNowMs = simulationSpeed === 1 ? Date.now() : (simulatedTimeMs || Date.now());

  // Merge conjunction risk metrics & live spacecraft astrodynamic telemetry
  const combinedRiskRows = useMemo(() => {
    return (conjunctions || [])
      .filter((c: any) => {
        if (!isroOnly) return true;
        return Boolean(c.object1?.is_isro || c.object2?.is_isro);
      })
      .map((c: any, idx: number) => {
        const primary = c.object1 || {};
        const secondary = c.object2 || {};
        const tca = Number(c.tca_timestamp_ms);
        const covarianceSource = String(c.covariance_source || '').toLowerCase();
        const hasMeasuredCovariance = covarianceSource.includes('cdm') && !covarianceSource.includes('synthetic');
        return {
          id: c.id || `conj-${primary.norad_id ?? 'unknown'}-${secondary.norad_id ?? idx}`,
          initialRank: idx + 1,
          norad_id: primary.norad_id,
          secondary_norad_id: secondary.norad_id,
          name: primary.name || 'Unknown object',
          secondary_name: secondary.name || 'Unknown object',
          country: primary.country,
          is_isro: Boolean(primary.is_isro || secondary.is_isro),
          altitude_km: null,
          congestion_index: null,
          nearby_debris_count: null,
          miss_distance_km: Number.isFinite(Number(c.miss_distance_km)) ? Number(c.miss_distance_km) : null,
          relative_speed_kms: Number.isFinite(Number(c.relative_speed_kms)) ? Number(c.relative_speed_kms) : null,
          pc_foster: hasMeasuredCovariance ? c.pc_foster : null,
          pc_max: hasMeasuredCovariance ? c.pc_max : null,
          tca_timestamp_ms: Number.isFinite(tca) && tca > 0 ? tca : null,
          tle_age_days: primary.tle_age_days ?? null,
          risk_level: c.risk_level,
          conjunction: c,
        };
      });
  }, [conjunctions, isroOnly]);

  const sortedRows = useMemo(() => {
    return [...combinedRiskRows].sort((a: any, b: any) => {
      const valA = a[sortField];
      const valB = b[sortField];

      if (valA === valB) return 0;
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;

      // Textual string columns
      if (sortField === 'name' || sortField === 'secondary_name' || sortField === 'country') {
        const comp = String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' });
        return sortAsc ? comp : -comp;
      }

      // Strictly numerical comparisons for all metric columns
      const numA = Number(valA);
      const numB = Number(valB);

      if (isNaN(numA) && isNaN(numB)) return 0;
      if (isNaN(numA)) return 1;
      if (isNaN(numB)) return -1;

      return sortAsc ? numA - numB : numB - numA;
    });
  }, [combinedRiskRows, sortField, sortAsc]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      const defaultAsc = ['initialRank', 'name', 'miss_distance_km', 'tca_timestamp_ms'].includes(field);
      setSortAsc(defaultAsc);
    }
  };

  const handleInspect = (row: any) => {
    if (row.conjunction) {
      selectConjunction(row.conjunction);
    }
    selectSatellite(row.norad_id);
    navigate('/');
  };

  const renderSortIndicator = (field: string) => {
    if (sortField === field) {
      return sortAsc ? (
        <ArrowUp className="w-3.5 h-3.5 text-cyan-400" />
      ) : (
        <ArrowDown className="w-3.5 h-3.5 text-cyan-400" />
      );
    }
    return <ArrowUpDown className="w-3 h-3 text-slate-500 opacity-60" />;
  };

  return (
    <div className="glass-panel rounded-xl p-5 shadow-2xl">
      {/* Table Title & Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-cyan-500/20 mb-4 gap-2">
        <div>
          <h2 className="text-base font-bold text-cyan-400 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-500" />
            Catalog Conjunction Screening Results
          </h2>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* ISRO Filter Button */}
          <button
            onClick={() => setIsroOnly(!isroOnly)}
            className={`px-3 py-1 rounded-lg text-xs font-mono font-bold border transition ${
              isroOnly
                ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-glow-amber'
                : 'bg-space-900 border-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            {isroOnly ? 'ISRO Assets Only' : 'Showing All Assets'}
          </button>
          <span className="text-xs font-mono text-cyan-300 bg-cyan-950/40 px-3 py-1 rounded-lg border border-cyan-500/30">
            Collision probability unavailable without measured covariance
          </span>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 font-bold text-[10px] shadow-glow-emerald">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>SGP4 SCREENING • TLE-BASED</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-sans">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 font-mono uppercase text-[11px] bg-space-950/60 select-none">
              <th
                className={`py-2.5 px-3 cursor-pointer transition-colors ${
                  sortField === 'initialRank' ? 'text-cyan-300 font-bold' : 'hover:text-cyan-300'
                }`}
                onClick={() => handleSort('initialRank')}
                title="Click to sort by Risk Rank"
              >
                <div className="flex items-center gap-1">
                  <span>Rank</span>
                  {renderSortIndicator('initialRank')}
                </div>
              </th>
              <th
                className={`py-2.5 px-3 cursor-pointer transition-colors ${
                  sortField === 'name' ? 'text-cyan-300 font-bold' : 'hover:text-cyan-300'
                }`}
                onClick={() => handleSort('name')}
                title="Click to sort by Satellite Name"
              >
                <div className="flex items-center gap-1">
                  <span>Satellite</span>
                  {renderSortIndicator('name')}
                </div>
              </th>
              <th
                className={`py-2.5 px-3 cursor-pointer transition-colors ${
                  sortField === 'altitude_km' ? 'text-cyan-300 font-bold' : 'hover:text-cyan-300'
                }`}
                onClick={() => handleSort('altitude_km')}
                title="Click to sort by Real-Time Orbital Altitude"
              >
                <div className="flex items-center gap-1">
                  <span>Alt (km)</span>
                  {renderSortIndicator('altitude_km')}
                </div>
              </th>
              <th
                className={`py-2.5 px-3 cursor-pointer transition-colors ${
                  sortField === 'miss_distance_km' ? 'text-cyan-300 font-bold' : 'hover:text-cyan-300'
                }`}
                onClick={() => handleSort('miss_distance_km')}
                title="Click to sort by Miss Distance (closest first)"
              >
                <div className="flex items-center gap-1">
                  <span>Miss Dist</span>
                  {renderSortIndicator('miss_distance_km')}
                </div>
              </th>
              <th
                className={`py-2.5 px-3 cursor-pointer transition-colors ${
                  sortField === 'relative_speed_kms' ? 'text-cyan-300 font-bold' : 'hover:text-cyan-300'
                }`}
                onClick={() => handleSort('relative_speed_kms')}
                title="Click to sort by Relative Velocity"
              >
                <div className="flex items-center gap-1">
                  <span>Rel Vel</span>
                  {renderSortIndicator('relative_speed_kms')}
                </div>
              </th>
              <th
                className={`py-2.5 px-3 cursor-pointer transition-colors ${
                  sortField === 'pc_foster' ? 'text-cyan-300 font-bold' : 'hover:text-cyan-300'
                }`}
                onClick={() => handleSort('pc_foster')}
                title="Click to sort by Foster-1992 Pc"
              >
                <div className="flex items-center gap-1">
                  <span>Foster Pc</span>
                  {renderSortIndicator('pc_foster')}
                </div>
              </th>
              <th
                className={`py-2.5 px-3 cursor-pointer transition-colors ${
                  sortField === 'pc_max' ? 'text-cyan-300 font-bold' : 'hover:text-cyan-300'
                }`}
                onClick={() => handleSort('pc_max')}
                title="Click to sort by Maximum Pc Bound"
              >
                <div className="flex items-center gap-1">
                  <span>Pc Max</span>
                  {renderSortIndicator('pc_max')}
                </div>
              </th>
              <th
                className={`py-2.5 px-3 cursor-pointer transition-colors ${
                  sortField === 'tca_timestamp_ms' ? 'text-cyan-300 font-bold' : 'hover:text-cyan-300'
                }`}
                onClick={() => handleSort('tca_timestamp_ms')}
                title="Click to sort by Time to Closest Approach"
              >
                <div className="flex items-center gap-1">
                  <span>TCA</span>
                  {renderSortIndicator('tca_timestamp_ms')}
                </div>
              </th>
              <th className="py-2.5 px-3 text-center">Inspect</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-850">
            {sortedRows.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-slate-400 font-mono">
                  No conjunction screening results are available for the selected filter.
                </td>
              </tr>
            ) : sortedRows.map((sat: any, index: number) => {
              const pc = sat.pc_foster;
              const isCriticalPc = pc >= 1e-4;
              const isWarningPc = pc >= 1e-7;
              const countdown = getTcaStatus(sat.tca_timestamp_ms, currentNowMs);

              return (
                <tr
                  key={sat.id}
                  className={`hover:bg-slate-900/60 transition group font-mono ${
                    isCriticalPc
                      ? 'bg-rose-950/10'
                      : isWarningPc
                      ? 'bg-amber-950/10'
                      : ''
                  }`}
                >
                  <td className="py-3 px-3 text-slate-400 font-mono">#{sat.initialRank || index + 1}</td>

                  {/* Name & ISRO badge */}
                  <td className="py-3 px-3 font-sans">
                    <div className="font-bold text-slate-100 flex items-center gap-1.5">
                      {sat.is_isro && (
                        <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono text-[9px] border border-amber-500/40">
                          ISRO
                        </span>
                      )}
                      <span>{sat.name}</span>
                    </div>
                    {sat.secondary_name && (
                      <div className="text-[10px] text-cyan-400 font-mono flex items-center gap-1">
                        <span className="text-slate-500">vs</span> {sat.secondary_name}
                      </div>
                    )}
                    <div className="text-[10px] font-mono text-slate-400">
                      NORAD: {sat.norad_id} {sat.secondary_norad_id ? `• SEC: ${sat.secondary_norad_id}` : ''} • Age: {sat.tle_age_days}d
                    </div>
                  </td>

                  {/* Live Orbital Altitude */}
                  <td className="py-3 px-3 font-mono">
                    <div className="text-slate-200 font-bold">
                      {sat.altitude_km == null ? 'Unavailable' : formatDistance(sat.altitude_km, settings?.units, 0)}
                    </div>
                    <div className="text-[10px] text-cyan-400/80 flex items-center gap-1">
                      <Activity className="w-2.5 h-2.5 text-cyan-400" />
                      <span>Unavailable in event record</span>
                    </div>
                  </td>

                  {/* Miss Distance & Instantaneous Live Separation */}
                  <td className="py-3 px-3 font-mono">
                    <div className="font-bold">
                      <span className={sat.miss_distance_km != null && sat.miss_distance_km < 5.0 ? 'text-amber-400' : 'text-slate-200'}>
                        {sat.miss_distance_km == null ? 'Unavailable' : formatDistance(sat.miss_distance_km, settings?.units, 1)}
                      </span>
                      <span className="text-[10px] text-slate-500 ml-1 font-normal">TCA</span>
                    </div>
                    <div className="text-[10px] text-cyan-400 flex items-center gap-1">
                      <span>Current separation unavailable</span>
                    </div>
                  </td>

                  {/* Relative Velocity (Live Instantaneous + TCA Nominal) */}
                  <td className="py-3 px-3">
                    <div className="text-slate-100 font-bold">
                      {sat.relative_speed_kms == null ? 'Unavailable' : formatSpeed(sat.relative_speed_kms, settings?.units, 2)}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      At predicted TCA
                    </div>
                  </td>

                  {/* Foster Pc (Live Proximity Scaled + Peak Nominal) */}
                  <td className="py-3 px-3 font-bold whitespace-nowrap">
                    <div
                      className={
                        (sat.pc_foster || 0) >= 1e-4
                          ? 'text-rose-400 font-extrabold'
                          : (sat.pc_foster || 0) >= 1e-7
                          ? 'text-amber-400'
                          : 'text-slate-400'
                      }
                    >
                      {formatPc(sat.pc_foster, 3)}
                    </div>
                    <div className="text-[10px] text-slate-500 font-normal">
                      Covariance source: {String(sat.conjunction?.covariance_source || 'Unavailable')}
                    </div>
                  </td>

                  {/* Pc Max is shown only when supplied by measured covariance data. */}
                  <td className="py-3 px-3 text-cyan-300 font-bold whitespace-nowrap">
                    <div>{formatPc(sat.pc_max, 3)}</div>
                    <div className="text-[10px] text-cyan-600 font-normal">
                      Unavailable without measured covariance
                    </div>
                  </td>

                  {/* Real-Time Live TCA Countdown */}
                  <td className="py-3 px-3 font-mono">
                    <div className="text-cyan-300 font-bold text-xs tracking-wider">{countdown}</div>
                  </td>

                  {/* Action */}
                  <td className="py-3 px-3 text-center">
                    <button
                      onClick={() => handleInspect(sat)}
                      className="p-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/50 text-cyan-300 border border-cyan-500/30 transition inline-flex items-center justify-center"
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
