/**
 * OrbitGuard Polar Sky Plot Component
 * =====================================
 * Renders topocentric Azimuth / Elevation satellite pass trajectory in a circular
 * polar coordinate system (North Up, East Right).
 *
 * Polar Mapping:
 * - Center = Zenith (Elevation 90°)
 * - Outer boundary circle = Horizon (Elevation 0° or mask)
 * - Angle θ = Azimuth measured clockwise from North (0° = Top)
 * - Radius r = R * (90 - Elevation) / 90
 */

import React from 'react';
import { DetailedPass, PassSample } from '../../lib/rf/passPlanner';

interface PolarSkyPlotProps {
  pass: DetailedPass | null;
  selectedSample?: PassSample | null;
  onHoverSample?: (sample: PassSample | null) => void;
}

export const PolarSkyPlot: React.FC<PolarSkyPlotProps> = ({ pass, selectedSample, onHoverSample }) => {
  const size = 320;
  const center = size / 2;
  const radius = center - 28; // Padding for cardinal labels

  // Convert (azimuth, elevation) to SVG (cx, cy)
  const polarToSvg = (azDeg: number, elDeg: number): [number, number] => {
    const clampedEl = Math.max(0, Math.min(90, elDeg));
    const r = radius * ((90 - clampedEl) / 90.0);
    const thetaRad = ((azDeg - 90) * Math.PI) / 180.0; // 0 deg is North (+Y in math = up)
    const x = center + r * Math.cos(thetaRad);
    const y = center + r * Math.sin(thetaRad);
    return [x, y];
  };

  // Generate SVG path for pass trajectory
  const pathD = React.useMemo(() => {
    if (!pass || !pass.samples || pass.samples.length < 2) return '';
    return pass.samples.reduce((acc, sample, i) => {
      const [x, y] = polarToSvg(sample.azDeg, sample.elDeg);
      return i === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : `${acc} L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }, '');
  }, [pass]);

  const aosPos = pass && pass.samples.length > 0 ? polarToSvg(pass.samples[0].azDeg, pass.samples[0].elDeg) : null;
  const losPos = pass && pass.samples.length > 0 ? polarToSvg(pass.samples[pass.samples.length - 1].azDeg, pass.samples[pass.samples.length - 1].elDeg) : null;
  const tcaPos = pass ? polarToSvg(pass.tcaAzimuthDeg, pass.maxElevationDeg) : null;

  return (
    <div className="flex flex-col items-center select-none">
      <div className="relative">
        <svg width={size} height={size} className="overflow-visible">
          {/* Radial concentric elevation circles */}
          {[0, 30, 60].map((el) => {
            const r = radius * ((90 - el) / 90.0);
            return (
              <g key={el}>
                <circle
                  cx={center}
                  cy={center}
                  r={r}
                  fill="none"
                  stroke={el === 0 ? '#38bdf8' : '#334155'}
                  strokeWidth={el === 0 ? 1.5 : 1}
                  strokeDasharray={el === 0 ? 'none' : '3 3'}
                  opacity={el === 0 ? 0.7 : 0.45}
                />
                <text
                  x={center + 4}
                  y={center - r + 11}
                  fill="#64748b"
                  fontSize="9"
                  fontFamily="monospace"
                >
                  {el}°
                </text>
              </g>
            );
          })}

          {/* Center Zenith Crosshair (90°) */}
          <circle cx={center} cy={center} r={3} fill="#0ea5e9" opacity={0.8} />
          <text x={center + 5} y={center + 4} fill="#0ea5e9" fontSize="9" fontFamily="monospace" fontWeight="bold">
            90° Z
          </text>

          {/* Radial Cardinal Spokes */}
          {[
            { angle: 0, label: 'N', color: '#38bdf8' },
            { angle: 45, label: 'NE', color: '#64748b' },
            { angle: 90, label: 'E', color: '#94a3b8' },
            { angle: 135, label: 'SE', color: '#64748b' },
            { angle: 180, label: 'S', color: '#94a3b8' },
            { angle: 225, label: 'SW', color: '#64748b' },
            { angle: 270, label: 'W', color: '#94a3b8' },
            { angle: 315, label: 'NW', color: '#64748b' },
          ].map(({ angle, label, color }) => {
            const rad = ((angle - 90) * Math.PI) / 180.0;
            const x1 = center + (radius * 0.15) * Math.cos(rad);
            const y1 = center + (radius * 0.15) * Math.sin(rad);
            const x2 = center + radius * Math.cos(rad);
            const y2 = center + radius * Math.sin(rad);
            const lx = center + (radius + 16) * Math.cos(rad);
            const ly = center + (radius + 16) * Math.sin(rad) + 3;

            return (
              <g key={label}>
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="#1e293b"
                  strokeWidth={angle % 90 === 0 ? 1.5 : 0.8}
                />
                <text
                  x={lx}
                  y={ly}
                  fill={color}
                  fontSize={angle % 90 === 0 ? '11' : '9'}
                  fontWeight={angle === 0 ? 'bold' : 'normal'}
                  textAnchor="middle"
                  fontFamily="monospace"
                >
                  {label}
                </text>
              </g>
            );
          })}

          {/* Pass Trajectory Glow and Track Line */}
          {pathD && (
            <>
              {/* Outer Cyan Glow */}
              <path
                d={pathD}
                fill="none"
                stroke="#22d3ee"
                strokeWidth={5}
                strokeLinecap="round"
                opacity={0.3}
              />
              {/* Core Solid Track */}
              <path
                d={pathD}
                fill="none"
                stroke="#38bdf8"
                strokeWidth={2.2}
                strokeLinecap="round"
              />
            </>
          )}

          {/* Interactive Trajectory Sample Nodes */}
          {pass?.samples.map((s, idx) => {
            const [sx, sy] = polarToSvg(s.azDeg, s.elDeg);
            const isHovered = selectedSample?.epochMs === s.epochMs;
            return (
              <circle
                key={idx}
                cx={sx}
                cy={sy}
                r={isHovered ? 5.5 : 2.5}
                fill={isHovered ? '#f59e0b' : '#38bdf8'}
                stroke="#0f172a"
                strokeWidth={1}
                className="cursor-pointer transition-all duration-150"
                onMouseEnter={() => onHoverSample && onHoverSample(s)}
                onMouseLeave={() => onHoverSample && onHoverSample(null)}
              />
            );
          })}

          {/* AOS (Acquisition of Signal) Point Marker */}
          {aosPos && (
            <g transform={`translate(${aosPos[0]}, ${aosPos[1]})`}>
              <circle r={6} fill="#10b981" />
              <text x={8} y={-4} fill="#10b981" fontSize="10" fontFamily="monospace" fontWeight="bold">
                AOS {pass?.aosAzimuthDeg}°
              </text>
            </g>
          )}

          {/* TCA (Max Elevation / Culmination) Point Marker */}
          {tcaPos && (
            <g transform={`translate(${tcaPos[0]}, ${tcaPos[1]})`}>
              <circle r={7} fill="#06b6d4" stroke="#ffffff" strokeWidth={1.5} />
              <text x={9} y={-6} fill="#38bdf8" fontSize="10" fontFamily="monospace" fontWeight="bold">
                TCA {pass?.maxElevationDeg}° el
              </text>
            </g>
          )}

          {/* LOS (Loss of Signal) Point Marker */}
          {losPos && (
            <g transform={`translate(${losPos[0]}, ${losPos[1]})`}>
              <circle r={6} fill="#f43f5e" />
              <text x={8} y={12} fill="#f43f5e" fontSize="10" fontFamily="monospace" fontWeight="bold">
                LOS {pass?.losAzimuthDeg}°
              </text>
            </g>
          )}
        </svg>

        {/* Selected Point Telemetry HUD overlay */}
        {selectedSample && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded bg-space-950/90 border border-amber-500/40 text-[10px] font-mono text-amber-300 shadow-xl pointer-events-none flex items-center gap-2">
            <span>Az: {selectedSample.azDeg}°</span>
            <span>El: {selectedSample.elDeg}°</span>
            <span>R: {selectedSample.rangeKm}km</span>
            <span>Δf: {selectedSample.dopplerShiftHz >= 0 ? '+' : ''}{selectedSample.dopplerShiftHz}Hz</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-4 text-[10px] font-mono text-slate-400 mt-2">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400" /> AOS Rise
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-cyan-400" /> TCA Culmination
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-rose-500" /> LOS Set
        </span>
      </div>
    </div>
  );
};

export default PolarSkyPlot;
