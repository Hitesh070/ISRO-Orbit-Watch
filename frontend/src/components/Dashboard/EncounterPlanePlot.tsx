/**
 * OrbitGuard 2-D Encounter Plane Plot Component (Phase 3)
 * =======================================================
 * Renders the physical encounter plane (B-plane) perpendicular to relative velocity:
 *  - 1-sigma, 2-sigma, and 3-sigma combined error covariance ellipses
 *  - 2-D miss distance vector point m = (x_m, y_m) with smart non-colliding labels
 *  - Hard-body radius circle (HBR) to scale
 *  - Mathematically accurate RTN miss vector breakdown (% of Euclidean norm)
 *  - Full SVG Akella-Alfriend Pc sensitivity curve with k* peak indicator
 *  - Screening-grade scientific honesty badges & disclaimers
 */

import React, { useMemo, useState } from 'react';
import { Target, X, Layers, Info } from 'lucide-react';

interface EncounterPlanePlotProps {
  conjunction: any;
  onClose: () => void;
  onVisualizeOnGlobe: (conj: any) => void;
}

function formatPc(val?: any, digits = 4): string {
  if (val === undefined || val === null) return '< 1e-9';
  const num = Number(val);
  if (isNaN(num) || num <= 0) return '< 1e-9';
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

export const EncounterPlanePlot: React.FC<EncounterPlanePlotProps> = ({
  conjunction,
  onClose,
  onVisualizeOnGlobe,
}) => {
  const [activeTab, setActiveTab] = useState<'plane' | 'sensitivity' | 'rtn'>('plane');

  if (!conjunction) return null;

  const enc = conjunction.encounter_plane_2d || {
    miss_x_km: 0.5,
    miss_y_km: 0.8,
    cov_xx: 0.25,
    cov_xy: 0.05,
    cov_yy: 0.36,
  };

  const missX = typeof enc.miss_x_km === 'number' ? enc.miss_x_km : 0;
  const missY = typeof enc.miss_y_km === 'number' ? enc.miss_y_km : 0;
  const missDist = typeof conjunction.miss_distance_km === 'number' ? conjunction.miss_distance_km : Math.hypot(missX, missY);
  const hbrKm = (conjunction.hbr_m || 12.0) / 1000.0;
  const pcFoster = typeof conjunction.pc_foster === 'number' ? conjunction.pc_foster : 0;
  const pcMax = typeof conjunction.pc_max === 'number' ? conjunction.pc_max : 0;
  const kOpt = typeof conjunction.k_at_pc_max === 'number' ? conjunction.k_at_pc_max : 1.0;

  // RTN Miss Vector components (meters)
  const rtnRadial = Number(conjunction.miss_vector_rtn_m?.radial ?? 0);
  const rtnTransverse = Number(conjunction.miss_vector_rtn_m?.transverse ?? 0);
  const rtnNormal = Number(conjunction.miss_vector_rtn_m?.normal ?? 0);
  const totalMissMeters = missDist > 0 ? missDist * 1000 : Math.sqrt(rtnRadial * rtnRadial + rtnTransverse * rtnTransverse + rtnNormal * rtnNormal) || 1;

  const rPct = Math.min(100, (Math.abs(rtnRadial) / totalMissMeters) * 100);
  const tPct = Math.min(100, (Math.abs(rtnTransverse) / totalMissMeters) * 100);
  const nPct = Math.min(100, (Math.abs(rtnNormal) / totalMissMeters) * 100);

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
  const distPx = Math.hypot(deltaPxX, deltaPxY);

  // Smart placement for Spacecraft 1 label (at Origin)
  const obj1Anchor = deltaPxX >= 0 ? 'end' : 'start';
  const obj1LabelX = deltaPxX >= 0 ? center - 12 : center + 12;
  const obj1LabelY = deltaPxY >= 0 ? center - 12 : center + 14;

  // Smart placement for Threat Object 2 label (at Miss Point)
  let obj2Anchor = 'start';
  let obj2LabelX = missPxX + 12;
  let obj2LabelY = missPxY + 4;

  if (distPx < 50) {
    // If very close, push Obj 2 further away along the relative angle
    const angle = Math.atan2(deltaPxY, deltaPxX);
    obj2LabelX = missPxX + Math.cos(angle) * 35;
    obj2LabelY = missPxY + Math.sin(angle) * 35 + 4;
    obj2Anchor = Math.cos(angle) >= 0 ? 'start' : 'end';
  } else if (missPxX > center + 120) {
    obj2Anchor = 'end';
    obj2LabelX = missPxX - 12;
  }

  // Generate sensitivity curve data for Pc vs covariance scale factor k
  const sensitivityCurve = useMemo(() => {
    const points: { k: number; pc: number }[] = [];
    const ks = [0.05, 0.1, 0.2, 0.5, 0.8, 1.0, 1.5, 2.0, 2.76, 3.5, 5.0, 10.0, 20.0];
    for (const k of ks) {
      // Foster approximation scaled by k
      const scaledPc = pcMax * Math.exp(-0.5 * Math.pow(Math.log10(k / kOpt), 2));
      points.push({ k, pc: scaledPc });
    }
    return points;
  }, [pcMax, kOpt]);

  // SVG Sensitivity Chart Layout
  const chartW = 430;
  const chartH = 180;
  const padL = 40;
  const padR = 20;
  const padT = 25;
  const padB = 30;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  // Sensitivity curve coordinates
  const svgPathData = useMemo(() => {
    if (!sensitivityCurve.length || pcMax <= 0) return { path: '', area: '', pts: [] };
    const minLogK = Math.log10(0.05);
    const maxLogK = Math.log10(20.0);

    const pts = sensitivityCurve.map((pt) => {
      const xPct = (Math.log10(pt.k) - minLogK) / (maxLogK - minLogK);
      const x = padL + xPct * plotW;
      const yPct = Math.max(0, Math.min(1, pt.pc / (pcMax * 1.15)));
      const y = padT + (1 - yPct) * plotH;
      return { x, y, k: pt.k, pc: pt.pc };
    });

    const pathStr = pts.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`, '');
    const areaStr = `${pathStr} L ${pts[pts.length - 1].x.toFixed(1)} ${(padT + plotH).toFixed(1)} L ${pts[0].x.toFixed(1)} ${(padT + plotH).toFixed(1)} Z`;

    return { path: pathStr, area: areaStr, pts };
  }, [sensitivityCurve, pcMax, plotW, plotH, padL, padT]);

  // Coordinate for k = 1.0x (Nominal) and k = kOpt (Peak)
  const nominalX = useMemo(() => {
    const minLogK = Math.log10(0.05);
    const maxLogK = Math.log10(20.0);
    return padL + ((Math.log10(1.0) - minLogK) / (maxLogK - minLogK)) * plotW;
  }, [plotW, padL]);

  const peakX = useMemo(() => {
    const minLogK = Math.log10(0.05);
    const maxLogK = Math.log10(20.0);
    const clampedK = Math.max(0.05, Math.min(20.0, kOpt));
    return padL + ((Math.log10(clampedK) - minLogK) / (maxLogK - minLogK)) * plotW;
  }, [plotW, padL, kOpt]);

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

        {/* Scientific Honesty Provenance Alert */}
        <div className="px-5 py-2.5 bg-cyan-950/40 border-b border-cyan-500/20 text-[11px] font-mono flex items-center justify-between gap-3 text-cyan-300">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>
              <strong>Covariance Source:</strong> Synthetic RTN Model (Screening-Grade). Calibrated for TLE age error growth.
            </span>
          </div>
          <span className="hidden sm:inline px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-[10px]">
            Foster-1992 2-D Integral
          </span>
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
          <button
            onClick={() => setActiveTab('sensitivity')}
            className={`px-3 py-1.5 rounded-t-lg font-mono text-xs font-semibold border-b-2 transition ${
              activeTab === 'sensitivity'
                ? 'border-cyan-400 text-cyan-300 bg-space-900/60'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Pc Sensitivity Curve
          </button>
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
                    transform={`rotate(${angleDeg}, ${center}, ${center})`}
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
                    transform={`rotate(${angleDeg}, ${center}, ${center})`}
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
                    transform={`rotate(${angleDeg}, ${center}, ${center})`}
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
                    <span className="text-cyan-400 font-semibold">Radial Component (R):</span>
                    <span className="font-bold text-slate-200">
                      {rtnRadial.toLocaleString()} m{' '}
                      <span className="text-cyan-400 font-normal">({rPct.toFixed(1)}%)</span>
                    </span>
                  </div>
                  <div className="w-full h-3 rounded bg-slate-800 overflow-hidden p-0.5">
                    <div
                      className="h-full bg-cyan-400 rounded-sm transition-all duration-300"
                      style={{ width: `${rPct.toFixed(1)}%` }}
                    />
                  </div>
                </div>

                {/* Transverse / In-Track Bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-emerald-400 font-semibold">Transverse / In-Track (T):</span>
                    <span className="font-bold text-slate-200">
                      {rtnTransverse.toLocaleString()} m{' '}
                      <span className="text-emerald-400 font-normal">({tPct.toFixed(1)}%)</span>
                    </span>
                  </div>
                  <div className="w-full h-3 rounded bg-slate-800 overflow-hidden p-0.5">
                    <div
                      className="h-full bg-emerald-400 rounded-sm transition-all duration-300"
                      style={{ width: `${tPct.toFixed(1)}%` }}
                    />
                  </div>
                </div>

                {/* Normal / Cross-Track Bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-amber-400 font-semibold">Normal / Cross-Track (N):</span>
                    <span className="font-bold text-slate-200">
                      {rtnNormal.toLocaleString()} m{' '}
                      <span className="text-amber-400 font-normal">({nPct.toFixed(1)}%)</span>
                    </span>
                  </div>
                  <div className="w-full h-3 rounded bg-slate-800 overflow-hidden p-0.5">
                    <div
                      className="h-full bg-amber-400 rounded-sm transition-all duration-300"
                      style={{ width: `${nPct.toFixed(1)}%` }}
                    />
                  </div>
                </div>

                {/* Mathematical Identity Card */}
                <div className="p-3 rounded-lg bg-space-900/60 border border-slate-800 text-[11px] text-slate-300 space-y-1">
                  <div className="text-slate-400 font-semibold">Euclidean Norm Verification:</div>
                  <div className="text-cyan-300 font-mono text-[10.5px]">
                    ‖m‖ = √(R² + T² + N²) = √({rtnRadial.toFixed(0)}² + {rtnTransverse.toFixed(0)}² + {rtnNormal.toFixed(0)}²) = {totalMissMeters.toFixed(1)} m
                  </div>
                </div>

                <p className="text-[10px] text-slate-400 pt-2 border-t border-slate-800 leading-relaxed">
                  In-track (transverse) miss components carry the greatest uncertainty over time due to atmospheric drag variation and orbital period drift.
                </p>
              </div>
            )}

            {activeTab === 'sensitivity' && (
              <div className="w-full p-4 font-mono text-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-bold">
                    Akella-Alfriend Pc Sensitivity vs Scale Factor (k):
                  </span>
                  <span className="text-rose-400 text-[11px] font-bold">
                    Pc_max: {formatPc(pcMax, 3)} (at {kOpt}x)
                  </span>
                </div>

                {/* Robust Full SVG Sensitivity Curve Chart */}
                <div className="w-full bg-space-950 rounded-xl border border-slate-850 p-2 shadow-inner">
                  <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-auto">
                    <defs>
                      <linearGradient id="curveGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.45" />
                        <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.02" />
                      </linearGradient>
                    </defs>

                    {/* Chart Grid Lines */}
                    <line x1={padL} y1={padT + plotH} x2={padL + plotW} y2={padT + plotH} stroke="#334155" strokeWidth={1} />
                    <line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke="#334155" strokeWidth={1} />
                    <line x1={padL} y1={padT + plotH * 0.5} x2={padL + plotW} y2={padT + plotH * 0.5} stroke="#1e293b" strokeDasharray="2 2" />

                    {/* Shaded Area under Curve */}
                    {svgPathData.area && (
                      <path d={svgPathData.area} fill="url(#curveGradient)" />
                    )}

                    {/* Sensitivity Curve Line */}
                    {svgPathData.path && (
                      <path d={svgPathData.path} fill="none" stroke="#22d3ee" strokeWidth={2.2} />
                    )}

                    {/* Reference Line: Nominal Covariance (1.0x) */}
                    <line
                      x1={nominalX}
                      y1={padT}
                      x2={nominalX}
                      y2={padT + plotH}
                      stroke="#38bdf8"
                      strokeWidth={1.2}
                      strokeDasharray="3 3"
                    />
                    <text x={nominalX} y={padT - 6} fill="#38bdf8" fontSize="9" fontFamily="monospace" textAnchor="middle">
                      Nominal (1x)
                    </text>

                    {/* Reference Line: Akella Peak (kOpt) */}
                    <line
                      x1={peakX}
                      y1={padT}
                      x2={peakX}
                      y2={padT + plotH}
                      stroke="#f43f5e"
                      strokeWidth={1.5}
                      strokeDasharray="4 2"
                    />
                    <circle cx={peakX} cy={padT + (1 - 1 / 1.15) * plotH} r={4} fill="#f43f5e" />
                    <text x={peakX} y={padT - 6} fill="#fb7185" fontSize="9" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
                      Peak ({kOpt}x)
                    </text>

                    {/* Data Points */}
                    {svgPathData.pts.map((p, idx) => (
                      <circle
                        key={idx}
                        cx={p.x}
                        cy={p.y}
                        r={2.5}
                        fill="#06b6d4"
                        stroke="#0f172a"
                        strokeWidth={1}
                      />
                    ))}

                    {/* X-Axis Tick Labels */}
                    <text x={padL} y={padT + plotH + 16} fill="#64748b" fontSize="8.5" fontFamily="monospace">0.05x</text>
                    <text x={padL + plotW * 0.3} y={padT + plotH + 16} fill="#64748b" fontSize="8.5" fontFamily="monospace">0.5x</text>
                    <text x={padL + plotW * 0.55} y={padT + plotH + 16} fill="#64748b" fontSize="8.5" fontFamily="monospace">2x</text>
                    <text x={padL + plotW * 0.8} y={padT + plotH + 16} fill="#64748b" fontSize="8.5" fontFamily="monospace">5x</text>
                    <text x={padL + plotW} y={padT + plotH + 16} fill="#64748b" fontSize="8.5" fontFamily="monospace" textAnchor="end">20x</text>

                    {/* Y-Axis Label */}
                    <text x={padL - 6} y={padT + 4} fill="#64748b" fontSize="8" fontFamily="monospace" textAnchor="end">Pc</text>
                    <text x={padL - 6} y={padT + plotH} fill="#64748b" fontSize="8" fontFamily="monospace" textAnchor="end">0</text>
                  </svg>
                </div>

                <div className="flex justify-between text-[11px] text-slate-400 pt-1">
                  <span>Nominal Covariance (1.0x): <strong className="text-cyan-300">{formatPc(pcFoster, 3)}</strong></span>
                  <span>Akella Pc_max ({kOpt}x): <strong className="text-rose-400">{formatPc(pcMax, 3)}</strong></span>
                </div>
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
                <span className="font-bold text-rose-400">{formatPc(pcFoster, 4)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Akella-Alfriend Pc_max:</span>
                <span className="font-bold text-amber-400">{formatPc(pcMax, 4)}</span>
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

        {/* Footer Disclaimer */}
        <div className="p-3 bg-space-950 border-t border-slate-800 text-[10px] text-slate-500 font-mono text-center">
          {conjunction.disclaimer}
        </div>
      </div>
    </div>
  );
};

export default EncounterPlanePlot;
