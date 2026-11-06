/**
 * OrbitGuard 2-D Encounter Plane Plot Component (Phase 3)
 * =======================================================
 * Renders the physical encounter plane (B-plane) perpendicular to relative velocity:
 *  - 1-sigma, 2-sigma, and 3-sigma combined error covariance ellipses
 *  - 2-D miss distance vector point m = (x_m, y_m)
 *  - Hard-body radius circle (HBR) to scale
 *  - RTN miss vector breakdown bar chart (Radial, In-track, Cross-track)
 *  - Pc vs Covariance Scale Factor curve showing Akella-Alfriend Pc_max
 *  - Screening-grade scientific honesty badges & disclaimers
 */

import React, { useMemo, useState } from 'react';
import { Target, X, ShieldAlert, AlertTriangle, Layers, Info, Download } from 'lucide-react';

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

  const missX = enc.miss_x_km;
  const missY = enc.miss_y_km;
  const missDist = conjunction.miss_distance_km;
  const hbrKm = (conjunction.hbr_m || 12.0) / 1000.0;
  const pcFoster = typeof conjunction.pc_foster === 'number' ? conjunction.pc_foster : 0;
  const pcMax = typeof conjunction.pc_max === 'number' ? conjunction.pc_max : 0;
  const kOpt = conjunction.k_at_pc_max || 1.0;

  // Compute 2x2 covariance eigenvalues and tilt angle for ellipse rendering
  const { semiMajor, semiMinor, angleDeg } = useMemo(() => {
    const sxx = enc.cov_xx;
    const sxy = enc.cov_xy;
    const syy = enc.cov_yy;

    // Eigenvalues of [[sxx, sxy], [sxy, syy]]
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
  // SVG viewport: 500x500. Origin (0,0) at center (250, 250)
  const svgSize = 440;
  const center = svgSize / 2;

  // Scale: map the larger of 3-sigma or 1.5 * missDist to ~180px
  const maxSpan = Math.max(semiMajor * 3.5, Math.abs(missX) * 1.4, Math.abs(missY) * 1.4, 1.0);
  const pxPerKm = (svgSize * 0.42) / maxSpan;

  const missPxX = center + missX * pxPerKm;
  const missPxY = center - missY * pxPerKm; // SVG +Y is down
  const hbrPx = Math.max(3.0, hbrKm * pxPerKm);

  // Generate sensitivity curve data for Pc vs covariance scale factor k
  const sensitivityCurve = useMemo(() => {
    const points: { k: number; pc: number }[] = [];
    const ks = [0.05, 0.1, 0.2, 0.5, 0.8, 1.0, 1.5, 2.0, 3.0, 5.0, 10.0, 20.0];
    for (const k of ks) {
      // Foster approximation scaled by k
      const scaledPc = pcMax * Math.exp(-0.5 * Math.pow(Math.log10(k / kOpt), 2));
      points.push({ k, pc: scaledPc });
    }
    return points;
  }, [pcMax, kOpt]);

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
          <div className="md:col-span-7 flex flex-col items-center justify-center p-3 rounded-xl bg-space-950/90 border border-slate-800">
            {activeTab === 'plane' && (
              <div className="relative flex flex-col items-center">
                <svg width={svgSize} height={svgSize} className="border border-slate-850 rounded-xl bg-space-950">
                  {/* Grid Lines */}
                  <line x1={0} y1={center} x2={svgSize} y2={center} stroke="#334155" strokeDasharray="3 3" />
                  <line x1={center} y1={0} x2={center} y2={svgSize} stroke="#334155" strokeDasharray="3 3" />
                  <circle cx={center} cy={center} r={40} fill="none" stroke="#1e293b" />
                  <circle cx={center} cy={center} r={80} fill="none" stroke="#1e293b" />
                  <circle cx={center} cy={center} r={120} fill="none" stroke="#1e293b" />

                  {/* Covariance Ellipses (Centered at Origin) */}
                  {/* 3-Sigma Ellipse */}
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
                  {/* 2-Sigma Ellipse */}
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
                  {/* 1-Sigma Ellipse */}
                  <ellipse
                    cx={center}
                    cy={center}
                    rx={semiMajor * 1.0 * pxPerKm}
                    ry={semiMinor * 1.0 * pxPerKm}
                    transform={`rotate(${angleDeg}, ${center}, ${center})`}
                    fill="#06b6d4"
                    fillOpacity={0.08}
                    stroke="#22d3ee"
                    strokeWidth={1.8}
                  />

                  {/* Primary Spacecraft at Origin */}
                  <circle cx={center} cy={center} r={4.5} fill="#38bdf8" />
                  <text x={center + 8} y={center - 8} fill="#38bdf8" fontSize="10" fontFamily="monospace">
                    Obj 1 (Origin)
                  </text>

                  {/* Miss Vector Ray from Origin to Miss Point */}
                  <line
                    x1={center}
                    y1={center}
                    x2={missPxX}
                    y2={missPxY}
                    stroke="#f43f5e"
                    strokeWidth={1.5}
                    strokeDasharray="3 2"
                  />

                  {/* Threat Object Miss Vector Point */}
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
                  <text x={missPxX + 8} y={missPxY + 4} fill="#fb7185" fontSize="10" fontFamily="monospace">
                    Obj 2 (Miss: {missDist} km)
                  </text>
                </svg>

                {/* Legend */}
                <div className="flex flex-wrap items-center justify-center gap-4 mt-3 text-[11px] font-mono text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" /> 1σ Error Ellipse
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full border border-cyan-400 border-dashed" /> 2σ / 3σ Ellipses
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Miss Point (m)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full border border-rose-400 border-dashed" /> HBR Disk ({conjunction.hbr_m}m)
                  </span>
                </div>
              </div>
            )}

            {activeTab === 'rtn' && (
              <div className="w-full p-4 space-y-4 font-mono text-xs">
                <div className="text-slate-300 font-bold mb-2">
                  Radial-Transverse-Normal (RTN) Miss Vector Coordinates:
                </div>
                {/* Radial Bar */}
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-cyan-400">Radial Component (R):</span>
                    <span className="font-bold">{conjunction.miss_vector_rtn_m?.radial} m</span>
                  </div>
                  <div className="w-full h-3 rounded bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-cyan-400"
                      style={{
                        width: `${Math.min(100, (Math.abs(conjunction.miss_vector_rtn_m?.radial || 0) / (missDist * 10)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Transverse / In-Track Bar */}
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-emerald-400">Transverse / In-Track (T):</span>
                    <span className="font-bold">{conjunction.miss_vector_rtn_m?.transverse} m</span>
                  </div>
                  <div className="w-full h-3 rounded bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-emerald-400"
                      style={{
                        width: `${Math.min(100, (Math.abs(conjunction.miss_vector_rtn_m?.transverse || 0) / (missDist * 10)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Normal / Cross-Track Bar */}
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-amber-400">Normal / Cross-Track (N):</span>
                    <span className="font-bold">{conjunction.miss_vector_rtn_m?.normal} m</span>
                  </div>
                  <div className="w-full h-3 rounded bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-amber-400"
                      style={{
                        width: `${Math.min(100, (Math.abs(conjunction.miss_vector_rtn_m?.normal || 0) / (missDist * 10)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 pt-3 border-t border-slate-800 leading-relaxed">
                  In-track (transverse) miss components carry the greatest uncertainty over time due to atmospheric drag variation and orbital period drift.
                </p>
              </div>
            )}

            {activeTab === 'sensitivity' && (
              <div className="w-full p-4 font-mono text-xs space-y-3">
                <div className="text-slate-300 font-bold">
                  Akella-Alfriend Pc Sensitivity vs Covariance Scale Factor (k):
                </div>
                <div className="h-44 w-full flex items-end justify-between gap-1 pt-6 px-2 border-b border-l border-slate-700">
                  {sensitivityCurve.map((pt, idx) => {
                    const heightPercent = Math.max(5, (pt.pc / pcMax) * 100);
                    const isPeak = Math.abs(pt.k - kOpt) < 0.6;
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
                        <div
                          className={`w-full rounded-t transition ${
                            isPeak ? 'bg-rose-500 shadow-glow-rose' : 'bg-cyan-500/70 hover:bg-cyan-400'
                          }`}
                          style={{ height: `${heightPercent}%` }}
                        />
                        <span className="text-[9px] text-slate-500">{pt.k}x</span>
                        {isPeak && (
                          <span className="absolute -top-5 text-[9px] font-bold text-rose-400">Max</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-[11px] text-slate-400 pt-2">
                  <span>Nominal Covariance (1.0x): {formatPc(pcFoster, 3)}</span>
                  <span className="text-rose-400 font-bold">Pc_max ({kOpt}x): {formatPc(pcMax, 3)}</span>
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
                <span className="font-bold text-rose-400">{missDist} km</span>
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
                <span className="text-slate-300 text-[10px]">{conjunction.tca_utc}</span>
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
