/**
 * OrbitGuard Doppler S-Curve & Frequency Shift Component
 * ========================================================
 * Visualizes the classic S-curve Doppler trajectory for a satellite ground pass.
 * Shows downlink received Doppler shift Δf and ground station uplink pre-compensation.
 */

import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { DetailedPass, PassSample } from '../../lib/rf/passPlanner';
import { Radio, Zap } from 'lucide-react';

interface DopplerCurveChartProps {
  pass: DetailedPass | null;
  carrierFreqHz: number;
  onHoverSample?: (sample: PassSample | null) => void;
}

export const DopplerCurveChart: React.FC<DopplerCurveChartProps> = ({
  pass,
  carrierFreqHz,
  onHoverSample,
}) => {
  if (!pass || !pass.samples || pass.samples.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-52 text-slate-500 font-mono text-xs">
        <Radio className="w-8 h-8 text-slate-600 mb-2 animate-pulse" />
        <span>Select an active satellite pass to evaluate Doppler trajectory</span>
      </div>
    );
  }

  // Format data for Recharts
  const chartData = pass.samples.map((s) => {
    const d = new Date(s.epochMs);
    const clockLabel = d.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const elapsedSec = Math.max(0, Math.round((s.epochMs - pass.aosEpochMs) / 1000));
    const elapsedLabel = `T+${Math.floor(elapsedSec / 60)}:${String(elapsedSec % 60).padStart(2, '0')}`;

    // Uplink pre-compensation shift is the negative of received shift to arrive at satellite at nominal f0
    const uplinkShiftHz = -s.dopplerShiftHz;

    return {
      time: clockLabel,
      elapsed: elapsedLabel,
      epochMs: s.epochMs,
      dopplerShiftHz: Number(s.dopplerShiftHz.toFixed(1)),
      uplinkShiftHz: Number(uplinkShiftHz.toFixed(1)),
      elevationDeg: s.elDeg,
      rangeKm: s.rangeKm,
      sample: s,
    };
  });

  const maxShift = pass.maxDopplerShiftHz;
  const maxRate = pass.maxDopplerRateHzS;
  const freqMHz = (carrierFreqHz / 1e6).toFixed(3);

  return (
    <div className="flex flex-col gap-2 w-full font-mono">
      {/* Top Telemetry Summary Pill Bar */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="p-2 rounded-lg bg-space-950/80 border border-slate-800 flex flex-col">
          <span className="text-[10px] text-slate-400">Carrier Freq (f₀)</span>
          <span className="text-cyan-400 font-bold">{freqMHz} MHz</span>
        </div>
        <div className="p-2 rounded-lg bg-space-950/80 border border-slate-800 flex flex-col">
          <span className="text-[10px] text-slate-400">Max Doppler Shift (Δf)</span>
          <span className="text-amber-400 font-bold">±{maxShift.toFixed(1)} Hz</span>
        </div>
        <div className="p-2 rounded-lg bg-space-950/80 border border-slate-800 flex flex-col">
          <span className="text-[10px] text-slate-400">Peak Doppler Rate</span>
          <span className="text-emerald-400 font-bold">{maxRate.toFixed(1)} Hz/s</span>
        </div>
      </div>

      {/* S-Curve Line Chart */}
      <div className="h-56 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 10, right: 15, left: 15, bottom: 0 }}
            onMouseMove={(e) => {
              if (e.activePayload && e.activePayload[0] && onHoverSample) {
                onHoverSample(e.activePayload[0].payload.sample);
              }
            }}
            onMouseLeave={() => onHoverSample && onHoverSample(null)}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              dataKey="time"
              stroke="#64748b"
              fontSize={10}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={35}
            />
            <YAxis
              width={72}
              stroke="#64748b"
              fontSize={10}
              tickLine={false}
              tickFormatter={(v: number) => {
                if (Math.abs(v) < 1) return '0 Hz';
                const sign = v > 0 ? '+' : '';
                if (Math.abs(v) >= 1000) {
                  return `${sign}${(v / 1000).toFixed(1)} kHz`;
                }
                return `${sign}${Math.round(v)} Hz`;
              }}
              domain={[-maxShift * 1.15, maxShift * 1.15]}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="p-2.5 rounded-lg bg-space-950 border border-cyan-500/30 text-slate-200 text-[11px] font-mono shadow-xl space-y-1">
                    <div className="font-bold text-cyan-400 flex items-center justify-between gap-3">
                      <span>{d.time} (UTC/Local)</span>
                      <span className="text-slate-400 text-[10px] font-normal">{d.elapsed}</span>
                    </div>
                    <div className="text-amber-300">
                      Downlink Δf: {d.dopplerShiftHz >= 0 ? '+' : ''}{d.dopplerShiftHz.toLocaleString()} Hz
                    </div>
                    <div className="text-sky-300">
                      Uplink Pre-Comp: {d.uplinkShiftHz >= 0 ? '+' : ''}{d.uplinkShiftHz.toLocaleString()} Hz
                    </div>
                    <div className="text-slate-400 text-[10.5px]">
                      Elevation: {d.elevationDeg}° | Range: {d.rangeKm.toLocaleString()} km
                    </div>
                  </div>
                );
              }}
            />
            <ReferenceLine y={0} stroke="#475569" strokeDasharray="2 2" />
            {/* Downlink Doppler Shift (S-Curve) */}
            <Line
              type="monotone"
              dataKey="dopplerShiftHz"
              stroke="#f59e0b"
              strokeWidth={2.2}
              dot={false}
              activeDot={{ r: 5, fill: '#f59e0b', stroke: '#ffffff' }}
              name="Downlink Δf"
            />
            {/* Uplink Pre-Compensation Shift */}
            <Line
              type="monotone"
              dataKey="uplinkShiftHz"
              stroke="#06b6d4"
              strokeWidth={1.8}
              strokeDasharray="4 4"
              dot={false}
              name="Uplink Pre-Comp"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-between text-[10px] text-slate-400 px-1">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-0.5 bg-amber-400" /> Downlink Received Δf (S-Curve)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-0.5 bg-cyan-400 border-dashed" /> Uplink Pre-Compensation
          </span>
        </div>
        <span className="text-slate-500 flex items-center gap-1">
          <Zap className="w-3 h-3 text-cyan-400" /> Doppler zero-crossing at TCA
        </span>
      </div>
    </div>
  );
};

export default DopplerCurveChart;
