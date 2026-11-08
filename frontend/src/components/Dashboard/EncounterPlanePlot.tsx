/**
 * OrbitGuard 2-D Encounter Plane Plot Component (Phase 3)
 * =======================================================
 * Renders the physical encounter plane (B-plane) perpendicular to relative velocity:
 *  - 1-sigma, 2-sigma, and 3-sigma combined error covariance ellipses
 *  - 2-D miss distance vector point m = (x_m, y_m) with smart non-colliding labels
 *  - Hard-body radius circle (HBR) to scale
 *  - Measured covariance-based encounter plane, only when all required CDM fields exist
 *  - Geometric RTN miss vector breakdown
 */

import React, { useMemo, useState } from 'react';
import { Target, X, Layers, Info } from 'lucide-react';

interface EncounterPlanePlotProps {
  conjunction: any;
  onClose: () => void;
  onVisualizeOnGlobe: (conj: any) => void;
}

function formatPc(val?: any, digits = 4): string {
  if (val === undefined || val === null) return 'Unavailable';
  const num = Number(val);
  if (!Number.isFinite(num)) return 'Unavailable';
  if (num <= 0) return '< 1e-9';
  return num.toExponential(digits);
}

function formatTca(tca?: string): string {
  if (!tca) return 'N/A';
  try {
    const d = new Date(tca);
    if (isNaN(d.getTime())) return tca;
    return d.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  } catch {
    return tca;
  }
}

export const EncounterPlanePlot: React.FC<EncounterPlanePlotProps> = (props) => {
  const event = props.conjunction;
  const source = String(event?.covariance_source || '').toLowerCase();
  const enc = event?.encounter_plane_2d;
  const rtn = event?.miss_vector_rtn_m;
  const hasRequiredInputs = source.includes('cdm') && !source.includes('synthetic') &&
    enc && ['miss_x_km', 'miss_y_km', 'cov_xx', 'cov_xy', 'cov_yy'].every((key) => Number.isFinite(enc[key])) &&
    Number.isFinite(event?.miss_distance_km) && Number.isFinite(event?.hbr_m) && event.hbr_m > 0 &&
    Number.isFinite(event?.pc_foster) && Number.isFinite(event?.pc_max) && Number.isFinite(event?.k_at_pc_max) &&
    rtn && ['radial', 'transverse', 'normal'].every((key) => Number.isFinite(rtn[key]));
  if (!hasRequiredInputs) {
    return (
      <div className="p-6 rounded-xl border border-slate-700 bg-space-950 text-sm text-slate-300">
        Encounter-plane analysis is unavailable. This view requires measured covariance, hard-body radius, miss geometry, and collision probability from a CDM.
      </div>
    );
  }
  return <EncounterPlanePlotContent {...props} />;
};

const EncounterPlanePlotContent: React.FC<EncounterPlanePlotProps> = ({
  conjunction,
  onClose,
  onVisualizeOnGlobe,
}) => {
  const [activeTab, setActiveTab] = useState<'plane' | 'rtn'>('plane');

  if (!conjunction) return null;

  const enc = conjunction.encounter_plane_2d;

  const missX = enc.miss_x_km;
  const missY = enc.miss_y_km;
  const missDist = conjunction.miss_distance_km;
  const hbrKm = conjunction.hbr_m / 1000.0;
  const pcFoster = conjunction.pc_foster;
  const pcMax = conjunction.pc_max;
  const kOpt = conjunction.k_at_pc_max;

  // RTN Miss Vector components (meters)
  const rtnRadial = conjunction.miss_vector_rtn_m.radial;
  const rtnTransverse = conjunction.miss_vector_rtn_m.transverse;
  const rtnNormal = conjunction.miss_vector_rtn_m.normal;
  const totalMissMeters = missDist * 1000;

  // Squared miss-vector component as a share of squared miss distance (not an uncertainty variance).
  const normSq = totalMissMeters * totalMissMeters || 1;
  const rVarPct = Math.min(100, ((rtnRadial * rtnRadial) / normSq) * 100);
  const tVarPct = Math.min(100, ((rtnTransverse * rtnTransverse) / normSq) * 100);
  const nVarPct = Math.min(100, ((rtnNormal * rtnNormal) / normSq) * 100);

  // Unit vector directional cosines (signed projection along unit axes)
  const uR = rtnRadial / totalMissMeters;
  const uT = rtnTransverse / totalMissMeters;
  const uN = rtnNormal / totalMissMeters;

  // Compute 2x2 covariance eigenvalues and tilt angle for ellipse rendering
  const { semiMajor, semiMinor, angleDeg } = useMemo(() => {
    const sxx = enc.cov_xx;
    const sxy = enc.cov_xy;
    const syy = enc.cov_yy;

    const trace = sxx + syy;
    const det = sxx * syy - sxy * sxy;
    const disc = Math.max(0, trace * trace - 4 * det);
    const lambda1 = Math.max(0.001, (trace + Math.sqrt(disc)) / 2);
    const lambda2 = Math.max(0.001, (trace - Math.sqrt(disc)) / 2);

    const a = Math.sqrt(lambda1);
    const b = Math.sqrt(lambda2);
    const angleRad = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    const deg = (angleRad * 180) / Math.PI;

    return { semiMajor: a, semiMinor: b, angleDeg: deg };
  }, [enc]);

  // SVG coordinate transformation
  const svgSize = 440;
  const center = svgSize / 2;

  // Scale: map the larger of 3-sigma or 1.5 * missDist to ~175px
  const maxSpan = Math.max(semiMajor * 3.2, Math.abs(missX) * 1.5, Math.abs(missY) * 1.5, 1.0);
  const pxPerKm = (svgSize * 0.40) / maxSpan;

  const missPxX = center + missX * pxPerKm;
  const missPxY = center - missY * pxPerKm; // SVG +Y is down
  const hbrPx = Math.max(3.5, hbrKm * pxPerKm);

  // Collision prevention for SVG labels
  const deltaPxX = missPxX - center;
  const deltaPxY = missPxY - center;

  // Position Obj 1 (Origin) safely in upper-left quadrant from center
  const obj1Anchor: 'start' | 'end' = 'end';
  const obj1LabelX = center - 14;
  const obj1LabelY = center - 14;

  // Position Obj 2 (Threat) safely away from miss point
  const obj2Anchor: 'start' | 'end' = deltaPxX >= 0 ? 'start' : 'end';
  const obj2LabelX = deltaPxX >= 0 ? missPxX + 14 : missPxX - 14;
  const obj2LabelY = deltaPxY >= 0 ? missPxY + 16 : missPxY - 14;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-space-950/85 backdrop-blur-md select-none">
      <div className="glass-panel border border-cyan-500/40 rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto shadow-2xl bg-space-950/95 flex flex-col text-slate-100">
        {/* Header */}
        <div className="p-4 md:p-5 border-b border-cyan-500/20 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
              <Target className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base md:text-lg font-bold text-slate-100 tracking-tight">
                  Encounter Plane (B-Plane) Analysis
                </h2>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                    conjunction.risk_level === 'CRITICAL'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      : conjunction.risk_level === 'WARNING'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  }`}
                >
                  {conjunction.risk_level}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                {conjunction.object1?.name} (NORAD {conjunction.object1?.norad_id}) vs {conjunction.object2?.name} (NORAD {conjunction.object2?.norad_id})
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-space-900 border border-slate-700 hover:border-slate-500 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Tabs */}
        <div className="flex border-b border-slate-800 px-5 pt-3 gap-2">
          <button
            onClick={() => setActiveTab('plane')}
            className={`px-3 py-1.5 rounded-t-lg font-mono text-xs font-semibold border-b-2 transition ${
              activeTab === 'plane'
                ? 'border-cyan-400 text-cyan-300 bg-space-900/60'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            2D Encounter Plane
          </button>
          <button
            onClick={() => setActiveTab('rtn')}
            className={`px-3 py-1.5 rounded-t-lg font-mono text-xs font-semibold border-b-2 transition ${
              activeTab === 'rtn'
                ? 'border-cyan-400 text-cyan-300 bg-space-900/60'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            RTN Miss Breakdown
          </button>
          <span className="px-3 py-1.5 font-mono text-xs text-slate-500">Sensitivity curve unavailable</span>
        </div>

        {/* Body View */}
        <div className="p-5 flex-1 grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
          {/* Main Visual Display (Left 7 Cols) */}
          <div className="md:col-span-7 flex flex-col items-center justify-center p-3 rounded-xl bg-space-950/90 border border-slate-800 min-h-[380px]">
            {activeTab === 'plane' && (
              <div className="relative flex flex-col items-center w-full">
                <svg width={svgSize} height={svgSize} className="border border-slate-850 rounded-xl bg-space-950 shadow-inner">
                  <defs>
                    <radialGradient id="encGlow" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.18" />
                      <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
                    </radialGradient>
                  </defs>

                  {/* Grid Lines */}
                  <line x1={0} y1={center} x2={svgSize} y2={center} stroke="#334155" strokeDasharray="3 3" opacity={0.6} />
                  <line x1={center} y1={0} x2={center} y2={svgSize} stroke="#334155" strokeDasharray="3 3" opacity={0.6} />
                  <circle cx={center} cy={center} r={45} fill="none" stroke="#1e293b" />
                  <circle cx={center} cy={center} r={90} fill="none" stroke="#1e293b" />
                  <circle cx={center} cy={center} r={135} fill="none" stroke="#1e293b" />

                  {/* Axis Orientation Indicators */}
                  <text x={svgSize - 18} y={center - 6} fill="#64748b" fontSize="10" fontFamily="monospace">x_e</text>
                  <text x={center + 6} y={16} fill="#64748b" fontSize="10" fontFamily="monospace">y_e</text>

                  {/* 3-Sigma Combined Covariance Ellipse */}
                  <ellipse
                    cx={center}
                    cy={center}
                    rx={semiMajor * 3.0 * pxPerKm}
                    ry={semiMinor * 3.0 * pxPerKm}
                    transform={`rotate(${-angleDeg}, ${center}, ${center})`}
                    fill="none"
                    stroke="#0284c7"
                    strokeWidth={1}
                    strokeDasharray="4 4"
                    opacity={0.35}
                  />
                  {/* 2-Sigma Combined Covariance Ellipse */}
                  <ellipse
                    cx={center}
                    cy={center}
                    rx={semiMajor * 2.0 * pxPerKm}
                    ry={semiMinor * 2.0 * pxPerKm}
                    transform={`rotate(${-angleDeg}, ${center}, ${center})`}
                    fill="none"
                    stroke="#06b6d4"
                    strokeWidth={1.2}
                    opacity={0.55}
                  />
                  {/* 1-Sigma Combined Covariance Ellipse */}
                  <ellipse
                    cx={center}
                    cy={center}
                    rx={semiMajor * 1.0 * pxPerKm}
                    ry={semiMinor * 1.0 * pxPerKm}
                    transform={`rotate(${-angleDeg}, ${center}, ${center})`}
                    fill="url(#encGlow)"
                    stroke="#22d3ee"
                    strokeWidth={1.8}
                  />

                  {/* Miss Vector Ray from Origin to Miss Point */}
                  <line
                    x1={center}
                    y1={center}
                    x2={missPxX}
                    y2={missPxY}
                    stroke="#f43f5e"
                    strokeWidth={1.5}
                    strokeDasharray="3 2"
                    opacity={0.85}
                  />

                  {/* Spacecraft 1 at Encounter Origin (0,0) */}
                  <circle cx={center} cy={center} r={5} fill="#38bdf8" />
                  <circle cx={center} cy={center} r={8} fill="none" stroke="#38bdf8" strokeWidth={1} opacity={0.6} />

                  {/* Spacecraft 1 Label with Pill Backdrop to Guarantee No Overlap */}
                  <g transform={`translate(${obj1LabelX}, ${obj1LabelY})`}>
                    <rect
                      x={obj1Anchor === 'end' ? -80 : 0}
                      y={-11}
                      width={80}
                      height={16}
                      rx={4}
                      fill="#030712"
                      fillOpacity={0.88}
                      stroke="#0284c7"
                      strokeWidth={0.8}
                    />
                    <text
                      x={obj1Anchor === 'end' ? -4 : 4}
                      y={1}
                      fill="#38bdf8"
                      fontSize="9.5"
                      fontFamily="monospace"
                      fontWeight="bold"
                      textAnchor={obj1Anchor}
                      dominantBaseline="middle"
                    >
                      Obj 1 (Origin)
                    </text>
                  </g>

                  {/* Threat Object 2 Miss Point */}
                  <circle cx={missPxX} cy={missPxY} r={5} fill="#f43f5e" />
                  <circle
                    cx={missPxX}
                    cy={missPxY}
                    r={hbrPx}
                    fill="none"
                    stroke="#fb7185"
                    strokeWidth={1.2}
                    strokeDasharray="2 2"
                  />

                  {/* Threat Object 2 Label with Pill Backdrop */}
                  <g transform={`translate(${obj2LabelX}, ${obj2LabelY})`}>
                    <rect
                      x={obj2Anchor === 'end' ? -120 : 0}
                      y={-11}
                      width={120}
                      height={16}
                      rx={4}
                      fill="#030712"
                      fillOpacity={0.88}
                      stroke="#f43f5e"
                      strokeWidth={0.8}
                    />
                    <text
                      x={obj2Anchor === 'end' ? -4 : 4}
                      y={1}
                      fill="#fb7185"
                      fontSize="9.5"
                      fontFamily="monospace"
                      fontWeight="bold"
                      textAnchor={obj2Anchor}
                      dominantBaseline="middle"
                    >
                      Obj 2 ({missDist.toFixed(2)} km)
                    </text>
                  </g>
                </svg>

                {/* Coordinate Telemetry Strip */}
                <div className="w-full mt-2 px-3 py-1.5 rounded-lg bg-space-900/60 border border-slate-800 text-[10.5px] font-mono flex items-center justify-between text-slate-400">
                  <span>Origin: <strong className="text-cyan-300">[0.00, 0.00] km</strong></span>
                  <span>Miss Vector: <strong className="text-rose-400">[{missX.toFixed(2)}, {missY.toFixed(2)}] km</strong></span>
                  <span>Range: <strong className="text-amber-300">{missDist.toFixed(2)} km</strong></span>
                </div>

                {/* Legend */}
                <div className="flex flex-wrap items-center justify-center gap-4 mt-2.5 text-[11px] font-mono text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" /> 1σ Error Ellipse
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full border border-cyan-400 border-dashed" /> 2σ / 3σ Ellipses
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Miss Point
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full border border-rose-400 border-dashed" /> HBR Disk ({conjunction.hbr_m}m)
                  </span>
                </div>
              </div>
            )}

            {activeTab === 'rtn' && (
              <div className="w-full p-4 space-y-4 font-mono text-xs">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-300 font-bold">
                    Radial-Transverse-Normal (RTN) Decomposition:
                  </span>
                  <span className="text-cyan-400 text-[11px] font-bold">
                    Total: {totalMissMeters.toFixed(1)} m ({missDist.toFixed(2)} km)
                  </span>
                </div>

                {/* Radial Bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-cyan-400 font-semibold">
                      Radial Component (R):{' '}
                      <span className="text-slate-400 font-normal">û_R = {uR >= 0 ? `+${uR.toFixed(3)}` : uR.toFixed(3)}</span>
                    </span>
                    <span className="font-bold text-slate-200">
                      {rtnRadial.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m{' '}
                      <span className="text-cyan-400 font-normal">({rVarPct.toFixed(1)}% energy)</span>
                    </span>
                  </div>
                  <div className="w-full h-3 rounded bg-slate-800 overflow-hidden p-0.5">
                    <div
                      className="h-full bg-cyan-400 rounded-sm transition-all duration-300"
                      style={{ width: `${rVarPct.toFixed(1)}%` }}
                    />
                  </div>
                </div>

                {/* Transverse / In-Track Bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-emerald-400 font-semibold">
                      Transverse / In-Track (T):{' '}
                      <span className="text-slate-400 font-normal">û_T = {uT >= 0 ? `+${uT.toFixed(3)}` : uT.toFixed(3)}</span>
                    </span>
                    <span className="font-bold text-slate-200">
                      {rtnTransverse.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m{' '}
                      <span className="text-emerald-400 font-normal">({tVarPct.toFixed(1)}% energy)</span>
                    </span>
                  </div>
                  <div className="w-full h-3 rounded bg-slate-800 overflow-hidden p-0.5">
                    <div
                      className="h-full bg-emerald-400 rounded-sm transition-all duration-300"
                      style={{ width: `${tVarPct.toFixed(1)}%` }}
                    />
                  </div>
                </div>

                {/* Normal / Cross-Track Bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-amber-400 font-semibold">
                      Normal / Cross-Track (N):{' '}
                      <span className="text-slate-400 font-normal">û_N = {uN >= 0 ? `+${uN.toFixed(3)}` : uN.toFixed(3)}</span>
                    </span>
                    <span className="font-bold text-slate-200">
                      {rtnNormal.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m{' '}
                      <span className="text-amber-400 font-normal">({nVarPct.toFixed(1)}% energy)</span>
                    </span>
                  </div>
                  <div className="w-full h-3 rounded bg-slate-800 overflow-hidden p-0.5">
                    <div
                      className="h-full bg-amber-400 rounded-sm transition-all duration-300"
                      style={{ width: `${nVarPct.toFixed(1)}%` }}
                    />
                  </div>
                </div>

                {/* Mathematical Identity Card */}
                <div className="p-3 rounded-lg bg-space-900/60 border border-slate-800 text-[11px] text-slate-300 space-y-1.5">
                  <div className="text-slate-400 font-semibold flex items-center justify-between">
                    <span>Euclidean Norm Verification:</span>
                    <span className="text-emerald-400 text-[10px] font-mono">Σ(Energy Share) = {(rVarPct + tVarPct + nVarPct).toFixed(1)}%</span>
                  </div>
                  <div className="text-cyan-300 font-mono text-[10.5px]">
                    ‖m‖ = √(R² + T² + N²) = √({rtnRadial >= 0 ? rtnRadial.toFixed(0) : `(${rtnRadial.toFixed(0)})`}² + {rtnTransverse >= 0 ? rtnTransverse.toFixed(0) : `(${rtnTransverse.toFixed(0)})`}² + {rtnNormal >= 0 ? rtnNormal.toFixed(0) : `(${rtnNormal.toFixed(0)})`}²) = {totalMissMeters.toFixed(1)} m
                  </div>
                  <div className="text-slate-400 font-mono text-[10px]">
                    Direction cosines: û = [{uR >= 0 ? `+${uR.toFixed(3)}` : uR.toFixed(3)}, {uT >= 0 ? `+${uT.toFixed(3)}` : uT.toFixed(3)}, {uN >= 0 ? `+${uN.toFixed(3)}` : uN.toFixed(3)}] | ‖û‖ = 1.000
                  </div>
                </div>

                <p className="text-[10px] text-slate-400 pt-2 border-t border-slate-800 leading-relaxed">
                  In-track (transverse) miss components carry the greatest uncertainty over time due to atmospheric drag variation and orbital period drift.
                </p>
              </div>
            )}

          </div>

          {/* Quantitative Risk Breakdown (Right 5 Cols) */}
          <div className="md:col-span-5 space-y-3 font-mono text-xs">
            <div className="p-3.5 rounded-xl bg-space-900/70 border border-slate-800 space-y-2">
              <div className="text-cyan-400 font-bold flex items-center gap-1.5 pb-1 border-b border-slate-800">
                <Layers className="w-4 h-4" /> Collision Risk Telemetry
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Foster-1992 Pc:</span>
                <span className="font-bold text-rose-400 whitespace-nowrap">{formatPc(pcFoster, 4)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Akella-Alfriend Pc_max:</span>
                <span className="font-bold text-amber-400 whitespace-nowrap">{formatPc(pcMax, 4)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Optimal Scale Factor (k*):</span>
                <span className="text-slate-200">{kOpt}x</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Mahalanobis Distance (d_M):</span>
                <span className="text-cyan-300">{conjunction.mahalanobis_dist}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Miss Distance:</span>
                <span className="font-bold text-rose-400">{missDist.toFixed(2)} km</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Relative Velocity:</span>
                <span className="text-slate-200">{conjunction.relative_speed_kms} km/s</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Hard-Body Radius:</span>
                <span className="text-slate-200">{conjunction.hbr_m} m</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">TCA (UTC):</span>
                <span className="text-slate-300 text-[11px] font-bold">{formatTca(conjunction.tca_utc)}</span>
              </div>
            </div>

            {/* Element Set Ages */}
            <div className="p-3 rounded-xl bg-space-900/50 border border-slate-800 text-[11px] space-y-1.5">
              <div className="text-slate-400 font-bold">Element Set Freshness:</div>
              <div className="flex justify-between">
                <span>Obj 1 ({conjunction.object1?.name}):</span>
                <span className="text-cyan-400">{conjunction.object1?.tle_age_days} days old</span>
              </div>
              <div className="flex justify-between">
                <span>Obj 2 ({conjunction.object2?.name}):</span>
                <span className="text-cyan-400">{conjunction.object2?.tle_age_days} days old</span>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-2">
              <button
                onClick={() => onVisualizeOnGlobe(conjunction)}
                className="w-full py-2 px-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold font-mono text-xs transition flex items-center justify-center gap-2 shadow-glow-cyan"
              >
                Visualize Encounter on 3D Globe
              </button>
              <button
                onClick={onClose}
                className="w-full py-1.5 px-3 rounded-lg bg-space-900 border border-slate-700 hover:border-slate-500 text-slate-300 text-xs font-mono transition"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EncounterPlanePlot;
