/**

 * ConjunctionPanel Component (Phase 3 Conjunction Assessment Suite)

 * =================================================================

 * Displays recorded GP-element screening results, miss distance, relative speed,
 * and the recorded TCA. Collision probability remains unavailable without measured covariance.

 *  - Sortable columns, search filter, and ISRO asset filter

 *  - CSV and JSON export functions

 *  - Covariance-dependent encounter plots remain disabled when those inputs are absent

 */

import React, { useState, useEffect, useMemo } from 'react';

import {

  AlertTriangle,

  Clock,

  ExternalLink,

  Target,

  ArrowUpDown,
  ArrowUp,
  ArrowDown,

  Download,

  Search,

  Filter,

  ShieldAlert,

  Info,

} from 'lucide-react';

import { useOrbitStore } from '../../store/useOrbitStore';

import { formatDistance, formatSpeed } from '../../utils/unitConversion';

import { useNavigate } from 'react-router-dom';


/**

 * Derive countdown text from the recorded TCA only. No orbit-cycle rollover or
 * interpolation is used because the record does not contain a current pair state.

 */

function getLiveConjunctionTelemetry(conj: any, nowMs: number) {
  const rawTca = Number(conj.tca_timestamp_ms);
  const effectiveTcaMs = Number.isFinite(rawTca) && rawTca > 0 ? rawTca : null;
  const dtSec = effectiveTcaMs === null ? null : (effectiveTcaMs - nowMs) / 1000;
  return {
    effectiveTcaMs,
    dtSec,
    statusText: dtSec === null ? 'TCA unavailable' : dtSec >= 0 ? 'Before recorded TCA' : 'Recorded TCA passed',
    statusColor: dtSec === null ? 'text-slate-500' : dtSec >= 0 ? 'text-amber-400' : 'text-slate-400',
  };
}

function formatCountdown(targetTimestampMs: number, nowMs: number): string {
  if (!Number.isFinite(targetTimestampMs)) return 'TCA unavailable';
  const rawDiffSec = Math.floor((targetTimestampMs - nowMs) / 1000);
  const diffSec = Math.abs(rawDiffSec);

  const hours = Math.floor(diffSec / 3600);

  const minutes = Math.floor((diffSec % 3600) / 60);

  const seconds = diffSec % 60;

  const duration = `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
  return rawDiffSec > 0 ? `TCA in ${duration}` : `TCA passed ${duration} ago`;

}

function formatPc(val?: any, digits = 3): string {
  if (val === undefined || val === null) return 'Unavailable';
  const num = Number(val);
  if (isNaN(num) || num < 1e-9) return '< 1e-9';
  return num.toExponential(digits);
}

export const ConjunctionPanel = () => {

  const conjunctions = useOrbitStore((state: any) => state.conjunctions);
  const screenTime = useOrbitStore((state: any) => state.conjunctionsScreenTime);

  const selectConjunction = useOrbitStore((state: any) => state.selectConjunction);

  const selectSatellite = useOrbitStore((state: any) => state.selectSatellite);

  const settings = useOrbitStore((state: any) => state.settings);

  const simulatedTimeMs = useOrbitStore((state: any) => state.simulatedTimeMs);

  const navigate = useNavigate();

  // State

  const [searchQuery, setSearchQuery] = useState('');

  const [isroOnly, setIsroOnly] = useState(true);

  const [riskFilter, setRiskFilter] = useState('ALL');

  const [maxDistFilter, setMaxDistFilter] = useState(25);

  const [sortField, setSortField] = useState('pc_foster');

  const [sortAsc, setSortAsc] = useState(false);

  // Live timer tick for countdown

  const [, setTick] = useState(0);

  useEffect(() => {

    const timer = setInterval(() => setTick((t) => t + 1), 1000);

    return () => clearInterval(timer);

  }, []);

  // Filtered and sorted conjunction records

  const filteredEvents = useMemo(() => {

    return (conjunctions || [])

      .filter((c: any) => {

        if (isroOnly && !c.object1?.is_isro && !c.object2?.is_isro) return false;

        if (riskFilter !== 'ALL' && c.risk_level !== riskFilter) return false;

        if (c.miss_distance_km > maxDistFilter) return false;

        if (searchQuery) {

          const q = searchQuery.toLowerCase().trim();

          const match1 = c.object1?.name?.toLowerCase().includes(q) || String(c.object1?.norad_id).includes(q);

          const match2 = c.object2?.name?.toLowerCase().includes(q) || String(c.object2?.norad_id).includes(q);

          if (!match1 && !match2) return false;

        }

        return true;

      })

      .sort((a: any, b: any) => {

        let valA = a[sortField];

        let valB = b[sortField];

        if (typeof valA === 'string') {

          return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);

        }

        return sortAsc ? (valA || 0) - (valB || 0) : (valB || 0) - (valA || 0);

      });

  }, [conjunctions, isroOnly, riskFilter, maxDistFilter, searchQuery, sortField, sortAsc]);

  const handleSort = (field: string) => {

    if (sortField === field) {

      setSortAsc(!sortAsc);

    } else {

      setSortField(field);

      setSortAsc(false);

    }

  };

  const handleVisualize = (conj: any) => {

    selectConjunction(conj);

    selectSatellite(conj.object1?.norad_id);

    navigate('/');

  };

  // CSV Export handler

  const handleExportCSV = () => {

    if (!filteredEvents.length) return;

    const headers = [

      'ID',

      'Target_Name',

      'Target_NORAD',

      'Threat_Name',

      'Threat_NORAD',

      'TCA_UTC',

      'Miss_Distance_km',

      'Rel_Velocity_kms',

      'Pc_Foster',

      'Pc_Max',

      'Mahalanobis_Dist',

      'Risk_Level',

      'Covariance_Source',

    ];

    const rows = filteredEvents.map((c: any) => [

      c.id,

      `"${c.object1?.name}"`,

      c.object1?.norad_id,

      `"${c.object2?.name}"`,

      c.object2?.norad_id,

      c.tca_utc,

      c.miss_distance_km,

      c.relative_speed_kms,

      !String(c.covariance_source || '').toLowerCase().includes('cdm') || String(c.covariance_source || '').toLowerCase().includes('synthetic') ? null : c.pc_foster,

      !String(c.covariance_source || '').toLowerCase().includes('cdm') || String(c.covariance_source || '').toLowerCase().includes('synthetic') ? null : c.pc_max,

      !String(c.covariance_source || '').toLowerCase().includes('cdm') || String(c.covariance_source || '').toLowerCase().includes('synthetic') ? null : c.mahalanobis_dist,

      c.risk_level,

      `"${c.covariance_source}"`,

    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);

    const link = document.createElement('a');

    link.setAttribute('href', encodedUri);

    link.setAttribute('download', `orbitguard_conjunctions_${new Date().toISOString().slice(0, 10)}.csv`);

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

  };

  // JSON Export handler

  const handleExportJSON = () => {

    if (!filteredEvents.length) return;

    const exportEvents = filteredEvents.map((event: any) => {
      const source = String(event.covariance_source || '').toLowerCase();
      if (source.includes('cdm') && !source.includes('synthetic')) return event;
      return { ...event, pc_foster: null, pc_max: null, mahalanobis_dist: null, encounter_plane_2d: undefined };
    });
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(exportEvents, null, 2))}`;

    const link = document.createElement('a');

    link.setAttribute('href', jsonString);

    link.setAttribute('download', `orbitguard_conjunctions_${new Date().toISOString().slice(0, 10)}.json`);

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

  };

  return (

    <div className="space-y-4">

      {/* Controls & Filter Bar */}

      <div className="glass-panel rounded-xl p-4 shadow-xl border border-cyan-500/20 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs font-mono">

        {/* Search */}

        <div className="flex items-center gap-2 flex-1 max-w-md">

          <div className="relative w-full">

            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />

            <input

              type="text"

              value={searchQuery}

              onChange={(e) => setSearchQuery(e.target.value)}

              placeholder="Filter by satellite name or NORAD ID..."

              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-space-950 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 text-xs"

            />

          </div>

        </div>

        {/* Filters */}

        <div className="flex flex-wrap items-center gap-2.5">

          {/* The display clock updates; event data remains tied to its recorded screen time. */}

          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 font-bold text-xs shadow-glow-emerald">

            <span className="w-2 h-2 rounded-full bg-cyan-400" />

            <span>TCA clock</span>

          </div>

          {/* ISRO Filter */}

          <button

            onClick={() => setIsroOnly(!isroOnly)}

            className={`px-3 py-1.5 rounded-lg border font-bold transition flex items-center gap-1.5 ${

              isroOnly

                ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-glow-amber'

                : 'bg-space-900 border-slate-700 text-slate-400 hover:text-slate-200'

            }`}

          >

            {isroOnly ? 'ISRO Assets Only' : 'Showing All Assets'}

          </button>

          {/* Risk Level Filter */}

          <select

            value={riskFilter}

            onChange={(e) => setRiskFilter(e.target.value)}

            className="px-2.5 py-1.5 rounded-lg bg-space-950 border border-slate-700 text-slate-300 focus:border-cyan-400 focus:outline-none"

          >

            <option value="ALL">All Risk Levels</option>

            <option value="CRITICAL">Critical screening class (miss distance &lt;1 km)</option>

            <option value="WARNING">Warning screening class (miss distance &lt;5 km)</option>

            <option value="MONITORED">Monitored</option>

            <option value="CO-ORBITAL">Co-Orbital Clusters</option>

          </select>

          {/* Max Miss Distance */}

          <select

            value={maxDistFilter}

            onChange={(e) => setMaxDistFilter(Number(e.target.value))}

            className="px-2.5 py-1.5 rounded-lg bg-space-950 border border-slate-700 text-slate-300 focus:border-cyan-400 focus:outline-none"

          >

            <option value={5}>&lt; 5 km Miss</option>

            <option value={10}>&lt; 10 km Miss</option>

            <option value={25}>&lt; 25 km Miss</option>

          </select>

          {/* Export Buttons */}

          <div className="flex items-center gap-1.5 border-l border-slate-700 pl-2">

            <button

              onClick={handleExportCSV}

              title="Export Conjunction Data as CSV"

              className="p-1.5 rounded bg-space-900 border border-slate-700 hover:border-cyan-400 text-cyan-300 hover:text-white transition flex items-center gap-1 text-[11px]"

            >

              <Download className="w-3.5 h-3.5" /> CSV

            </button>

            <button

              onClick={handleExportJSON}

              title="Export Conjunction Data as JSON"

              className="p-1.5 rounded bg-space-900 border border-slate-700 hover:border-cyan-400 text-cyan-300 hover:text-white transition flex items-center gap-1 text-[11px]"

            >

              <Download className="w-3.5 h-3.5" /> JSON

            </button>

          </div>

        </div>

      </div>

      {/* Conjunction Table */}

      <div className="glass-panel rounded-xl shadow-2xl border border-cyan-500/20 overflow-hidden">

        <div className="overflow-x-auto">

          <table className="w-full text-left text-xs font-sans">

            <thead>

              <tr className="border-b border-slate-800 text-slate-400 font-mono uppercase text-[11px] bg-space-950/70">

                <th className="py-3 px-3">Target Spacecraft</th>

                <th className="py-3 px-3">Threat Object</th>

                <th className="py-3 px-3 cursor-pointer hover:text-cyan-300" onClick={() => handleSort('miss_distance_km')}>

                  <div className="flex items-center gap-1">TCA Miss <ArrowUpDown className="w-3 h-3" /></div>

                </th>

                <th className="py-3 px-3 text-cyan-300">

                  <div className="flex items-center gap-1">Current Separation</div>

                </th>

                <th className="py-3 px-3 cursor-pointer hover:text-cyan-300" onClick={() => handleSort('relative_speed_kms')}>

                  <div className="flex items-center gap-1">Rel Vel <ArrowUpDown className="w-3 h-3" /></div>

                </th>

                <th className="py-3 px-3 cursor-pointer hover:text-cyan-300" onClick={() => handleSort('pc_foster')}>

                  <div className="flex items-center gap-1">Foster Pc <ArrowUpDown className="w-3 h-3" /></div>

                </th>

                <th className="py-3 px-3 cursor-pointer hover:text-cyan-300" onClick={() => handleSort('pc_max')}>

                  <div className="flex items-center gap-1">Pc Max <ArrowUpDown className="w-3 h-3" /></div>

                </th>

                <th className="py-3 px-3 cursor-pointer hover:text-cyan-300" onClick={() => handleSort('tca_timestamp_ms')}>

                  <div className="flex items-center gap-1">TCA & Countdown <ArrowUpDown className="w-3 h-3" /></div>

                </th>

                <th className="py-3 px-3 text-center">Encounter Plane</th>

                <th className="py-3 px-3 text-center">Globe</th>

              </tr>

            </thead>

            <tbody className="divide-y divide-slate-800">

              {filteredEvents.length === 0 ? (

                <tr>

                  <td colSpan={10} className="py-8 text-center text-slate-400 font-mono">

                    {screenTime
                      ? 'No records match the selected filters in this screening snapshot. This does not establish that the orbit is clear.'
                      : 'No verified conjunction screening snapshot is available. This does not establish that the orbit is clear.'}

                  </td>

                </tr>

              ) : (

                filteredEvents.map((conj: any) => {

                  const now = simulatedTimeMs || Date.now();

                  const live = getLiveConjunctionTelemetry(conj, now);

                  const countdown = formatCountdown(live.effectiveTcaMs ?? Number.NaN, now);
                  const covarianceSource = String(conj.covariance_source || '').toLowerCase();
                  const pcAvailable = covarianceSource.includes('cdm') && !covarianceSource.includes('synthetic');

                  const isCritical = conj.risk_level === 'CRITICAL';

                  const isWarning = conj.risk_level === 'WARNING';

                  return (

                    <tr

                      key={conj.id}

                      className={`hover:bg-space-900/60 transition group ${

                        isCritical ? 'bg-rose-950/20' : isWarning ? 'bg-amber-950/10' : ''

                      }`}

                    >

                      {/* Target Spacecraft */}

                      <td className="py-2.5 px-3">

                        <div className="font-bold text-slate-100 flex items-center gap-1.5">

                          {conj.object1?.is_isro && (

                            <span className="px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-mono border border-amber-500/40">

                              ISRO

                            </span>

                          )}

                          <span className="truncate max-w-[150px]">{conj.object1?.name}</span>

                        </div>

                        <div className="text-[10px] font-mono text-slate-400">

                          NORAD: {conj.object1?.norad_id} • Age: {conj.object1?.tle_age_days}d

                        </div>

                      </td>

                      {/* Threat Object */}

                      <td className="py-2.5 px-3">

                        <div className="font-bold text-rose-300 truncate max-w-[150px]">

                          {conj.object2?.name}

                        </div>

                        <div className="text-[10px] font-mono text-slate-400">

                          NORAD: {conj.object2?.norad_id} • Age: {conj.object2?.tle_age_days}d

                        </div>

                      </td>

                      {/* TCA Miss Distance */}

                      <td className="py-2.5 px-3 font-mono font-bold">

                        <span

                          className={

                            conj.miss_distance_km < 1.0

                              ? 'text-rose-400 font-extrabold'

                              : conj.miss_distance_km < 5.0

                              ? 'text-amber-400'

                              : 'text-slate-300'

                          }

                        >

                          {formatDistance(conj.miss_distance_km, settings?.units, 1)}

                        </span>

                      </td>

                  {/* No current pair state is available in the screening record. */}

                      <td className="py-2.5 px-3 font-mono">

                        <div className="font-bold text-slate-100">

                          Unavailable

                        </div>

                        <div className={`text-[10px] font-mono ${live.statusColor}`}>

                          Current two-object state was not supplied

                        </div>

                      </td>

                  {/* Relative speed at the predicted TCA */}
                      <td className="py-2.5 px-3 font-mono">
                        <div className="font-bold text-slate-100">
                          {conj.relative_speed_kms == null ? 'Unavailable' : formatSpeed(conj.relative_speed_kms, settings?.units, 2)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          At predicted TCA
                        </div>
                      </td>

                  {/* Probability is available only with measured covariance. */}
                      <td className="py-2.5 px-3 font-mono font-bold">
                        <div
                          className={
                            pcAvailable && (conj.pc_foster || 0) >= 1e-4
                              ? 'text-rose-400'
                              : pcAvailable && (conj.pc_foster || 0) >= 1e-7
                              ? 'text-amber-400'
                              : 'text-slate-400'
                          }
                        >
                          <span className="whitespace-nowrap">{pcAvailable ? formatPc(conj.pc_foster, 3) : 'Unavailable: measured covariance not supplied'}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-normal">
                          {pcAvailable ? 'Calculated using supplied covariance' : 'No measured covariance provided'}
                        </div>
                      </td>

                  {/* Probability bound is unavailable without measured covariance. */}
                      <td className="py-2.5 px-3 font-mono font-bold text-cyan-300 whitespace-nowrap">
                        <div>{pcAvailable ? formatPc(conj.pc_max, 3) : 'Unavailable: measured covariance not supplied'}</div>
                        <div className="text-[10px] text-cyan-600 font-normal">
                          {pcAvailable ? 'Calculated using supplied covariance' : 'No measured covariance provided'}
                        </div>
                      </td>

                      {/* TCA & Countdown */}

                      <td className="py-2.5 px-3 font-mono">

                        <div className="text-slate-200 text-[11px]">{live.effectiveTcaMs === null ? 'TCA unavailable' : `${new Date(live.effectiveTcaMs).toISOString().replace('T', ' ').slice(0, 19)} UTC`}</div>

                        <div className="text-cyan-400 font-bold text-[10px] flex items-center gap-1 mt-0.5">

                          <Clock className="w-3 h-3" />

                          <span>{countdown}</span>

                        </div>

                      </td>

                      {/* Status */}

                      <td className="py-2.5 px-3 text-center">

                        <span

                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${

                            isCritical

                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-glow-rose'

                              : isWarning

                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'

                              : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'

                          }`}

                        >

                          {conj.risk_level}

                        </span>

                      </td>

                      {/* B-Plane Button */}

                      <td className="py-2.5 px-3 text-center">

                        <button

                          disabled={!pcAvailable || !conj.encounter_plane_2d}

                          title="Encounter-plane covariance is unavailable for these records."

                          className="px-2 py-1 rounded bg-space-900 border border-slate-700 text-slate-500 font-mono text-[11px] transition inline-flex items-center gap-1 disabled:cursor-not-allowed"

                        >

                          <Target className="w-3 h-3" /> Plot unavailable

                        </button>

                      </td>

                      {/* 3D Globe Button */}

                      <td className="py-2.5 px-3 text-center">

                        <button

                          onClick={() => handleVisualize(conj)}

                          className="p-1.5 rounded bg-cyan-600/20 border border-cyan-500/40 hover:bg-cyan-600/40 text-cyan-300 hover:text-white transition inline-flex items-center"

                          title="Show on 3D Globe"

                        >

                          <ExternalLink className="w-3.5 h-3.5" />

                        </button>

                      </td>

                    </tr>

                  );

                })

              )}

            </tbody>

          </table>

        </div>

        {/* Footer Provenance Note */}

        <div className="p-3 bg-space-950/80 border-t border-slate-800 text-[11px] font-mono text-slate-400 flex flex-col sm:flex-row sm:items-center justify-between gap-2">

          <span>

            Public GP elements do not provide object covariance or physical hard-body radii; collision probability is unavailable.

          </span>

          <span className="text-[10px] text-slate-500">

            Advisory Notice: Screening use only. CAM maneuvers require official CDMs.

          </span>

        </div>

      </div>

    </div>

  );

};

export default ConjunctionPanel;

