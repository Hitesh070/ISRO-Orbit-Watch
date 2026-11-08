/**
 * OrbitGuard RF Link Budget & Margin Analysis Component
 * ========================================================
 * Evaluates satellite-to-ground downlink link budget, EIRP, FSPL, received power,
 * Eb/N0, and margin across the entire pass trajectory.
 */

import React, { useState, useMemo } from 'react';
import {
  computeLinkBudget,
  LINK_BUDGET_PRESETS,
  LinkBudgetInputs,
} from '../../lib/rf/linkBudget';
import { DetailedPass } from '../../lib/rf/passPlanner';
import { CheckCircle2, AlertTriangle, XCircle, Sliders, Signal, ArrowDownToLine } from 'lucide-react';
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

interface LinkBudgetPanelProps {
  pass: DetailedPass | null;
  carrierFreqHz: number;
}

export const LinkBudgetPanel: React.FC<LinkBudgetPanelProps> = ({ pass, carrierFreqHz }) => {
  const [selectedPresetKey, setSelectedPresetKey] = useState<keyof typeof LINK_BUDGET_PRESETS | null>(null);

  // Link budget input state initialized from preset
  const [inputs, setInputs] = useState<LinkBudgetInputs>({
    ...LINK_BUDGET_PRESETS.UHF_CUBESAT,
    carrierFreqHz,
    slantRangeKm: 0,
    elevationDeg: 0,
  });

  // Switch preset
  const handleSelectPreset = (key: keyof typeof LINK_BUDGET_PRESETS) => {
    setSelectedPresetKey(key);
    const preset = LINK_BUDGET_PRESETS[key];
    setInputs((prev) => ({
      ...prev,
      ...preset,
      carrierFreqHz: carrierFreqHz > 0 ? carrierFreqHz : preset.carrierFreqHz,
      slantRangeKm: pass?.minRangeKm ?? prev.slantRangeKm,
      elevationDeg: pass?.maxElevationDeg ?? prev.elevationDeg,
    }));
  };

  const canCalculate = Boolean(
    selectedPresetKey && pass?.samples?.length && Number.isFinite(carrierFreqHz) && carrierFreqHz > 0,
  );

  // Compute link budget at TCA (closest approach / highest elevation)
  const tcaResult = useMemo(() => {
    if (!canCalculate || !pass) return null;
    return computeLinkBudget({
      ...inputs,
      carrierFreqHz,
      slantRangeKm: pass.minRangeKm,
      elevationDeg: pass.maxElevationDeg,
    });
  }, [canCalculate, carrierFreqHz, inputs, pass]);

  // Compute margin time series along the pass
  const marginTimeSeries = useMemo(() => {
    if (!canCalculate || !pass || !pass.samples || pass.samples.length === 0) return [];

    return pass.samples.map((s) => {
      const res = computeLinkBudget({
        ...inputs,
        slantRangeKm: s.rangeKm,
        elevationDeg: s.elDeg,
      });

      return {
        time: new Date(s.epochMs).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }),
        marginDb: res.marginDb,
        fsplDb: res.fsplDb,
        elevationDeg: s.elDeg,
        prDbm: res.prDbm,
      };
    });
  }, [canCalculate, inputs, pass]);

  return (
    <div className="flex flex-col gap-3 font-mono text-xs">
      {/* Preset Selector */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
          <Sliders className="w-4 h-4 text-cyan-400" />
          <span>Mission Link Presets:</span>
        </div>
        <div className="flex items-center gap-1">
          {Object.entries(LINK_BUDGET_PRESETS).map(([key, p]) => (
            <button
              key={key}
              onClick={() => handleSelectPreset(key as any)}
              className={`px-2.5 py-1 rounded text-[11px] transition ${
                selectedPresetKey === key
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-glow-cyan'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {key === 'UHF_CUBESAT' ? 'UHF CubeSat' : key === 'SBAND_LEO' ? 'S-Band LEO' : 'X-Band Downlink'}
            </button>
          ))}
        </div>
      </div>

      {!tcaResult && (
        <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-950/20 text-amber-200 text-[11px]" role="status">
          Select a mission link preset and provide a predicted pass with a verified carrier frequency to calculate an estimated link budget. Preset values are model inputs, not measured RF telemetry.
        </div>
      )}

      {/* Main Verdict Banner */}
      {tcaResult && <>
      <div
        className={`p-3 rounded-xl border flex items-center justify-between ${
          tcaResult.verdict === 'CLOSED'
            ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300 shadow-glow-emerald'
            : tcaResult.verdict === 'MARGINAL'
            ? 'bg-amber-950/30 border-amber-500/40 text-amber-300 shadow-glow-amber'
            : 'bg-rose-950/30 border-rose-500/40 text-rose-300 shadow-glow-rose'
        }`}
      >
        <div className="flex items-center gap-3">
          {tcaResult.verdict === 'CLOSED' ? (
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
          ) : tcaResult.verdict === 'MARGINAL' ? (
            <AlertTriangle className="w-6 h-6 text-amber-400" />
          ) : (
            <XCircle className="w-6 h-6 text-rose-400" />
          )}
          <div>
            <div className="text-sm font-bold tracking-tight">
              ESTIMATED LINK {tcaResult.verdict}: {tcaResult.marginDb >= 0 ? '+' : ''}{tcaResult.marginDb} dB Margin at TCA
            </div>
            <div className="text-[10px] text-slate-300 opacity-90 mt-0.5">
              Target Margin: 3.0 dB | Max Supportable Rate: {(tcaResult.maxSupportableDataRateBps / 1000).toFixed(1)} kbps
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="text-[10px] text-slate-400">Received Power (Pr)</div>
          <div className="text-sm font-bold text-slate-100">{tcaResult.prDbm} dBm</div>
        </div>
      </div>

      {/* Link Budget Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
        <div className="p-2 rounded-lg bg-space-950/80 border border-slate-800">
          <div className="text-[10px] text-slate-400">Path Loss (FSPL)</div>
          <div className="text-slate-100 font-bold mt-0.5">{tcaResult.fsplDb} dB</div>
        </div>
        <div className="p-2 rounded-lg bg-space-950/80 border border-slate-800">
          <div className="text-[10px] text-slate-400">Satellite EIRP</div>
          <div className="text-cyan-400 font-bold mt-0.5">{tcaResult.eirpDbw} dBW</div>
        </div>
        <div className="p-2 rounded-lg bg-space-950/80 border border-slate-800">
          <div className="text-[10px] text-slate-400">Ground Station G/T</div>
          <div className="text-sky-300 font-bold mt-0.5">{tcaResult.gOverTDbK} dB/K</div>
        </div>
        <div className="p-2 rounded-lg bg-space-950/80 border border-slate-800">
          <div className="text-[10px] text-slate-400">Carrier-to-Noise (C/N₀)</div>
          <div className="text-emerald-400 font-bold mt-0.5">{tcaResult.cNoDbHz} dB-Hz</div>
        </div>
      </div>
      </>}

      {/* Margin Trajectory Chart across the Pass */}
      {marginTimeSeries.length > 0 && (
        <div className="pt-2">
          <div className="text-[11px] font-semibold text-slate-300 mb-1 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Signal className="w-3.5 h-3.5 text-cyan-400" /> Link Margin Profile vs Time (dB)
            </span>
            <span className="text-[10px] text-slate-400 font-normal">
              AOS/LOS horizon degradation modeled with cosecant atmosphere
            </span>
          </div>

          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={marginTimeSeries} margin={{ top: 5, right: 15, left: 15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="time" stroke="#64748b" fontSize={10} tickLine={false} interval="preserveStartEnd" minTickGap={35} />
                <YAxis width={55} stroke="#64748b" fontSize={10} tickLine={false} tickFormatter={(v) => `${Math.round(v)} dB`} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="p-2 rounded-lg bg-space-950 border border-cyan-500/30 text-[11px] font-mono shadow-xl">
                        <div className="font-bold text-cyan-400">{d.time} (UTC)</div>
                        <div className="text-emerald-300">Link Margin: {d.marginDb} dB</div>
                        <div className="text-slate-300">FSPL: {d.fsplDb} dB</div>
                        <div className="text-amber-300">Pr: {d.prDbm} dBm</div>
                        <div className="text-slate-400">Elevation: {d.elevationDeg}°</div>
                      </div>
                    );
                  }}
                />
                <ReferenceLine y={3} stroke="#10b981" strokeDasharray="3 3" label={{ value: '3dB Target', fill: '#10b981', fontSize: 10 }} />
                <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="2 2" label={{ value: '0dB Threshold', fill: '#ef4444', fontSize: 10 }} />
                <Line
                  type="monotone"
                  dataKey="marginDb"
                  stroke="#38bdf8"
                  strokeWidth={2.2}
                  dot={false}
                  activeDot={{ r: 5, fill: '#38bdf8' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Editable Parameters Expandable Section */}
      <details className="mt-1 group">
        <summary className="cursor-pointer text-[11px] text-cyan-400 hover:text-cyan-200 select-none py-1">
          ▸ Edit RF Link Parameters (Power, Gain, Losses, Receiver Temperature)
        </summary>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2 p-3 rounded-xl bg-space-950/70 border border-slate-800">
          <div>
            <label className="text-[10px] text-slate-400 block mb-0.5">Carrier Freq (MHz)</label>
            <input
              type="number"
              value={(inputs.carrierFreqHz / 1e6).toFixed(3)}
              onChange={(e) => setInputs({ ...inputs, carrierFreqHz: Number(e.target.value) * 1e6 })}
              className="w-full px-2 py-1 rounded bg-space-900 border border-slate-700 text-slate-100 text-[11px]"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 block mb-0.5">Tx Power (Watts)</label>
            <input
              type="number"
              step="0.5"
              value={inputs.txPowerWatts}
              onChange={(e) => setInputs({ ...inputs, txPowerWatts: Number(e.target.value) })}
              className="w-full px-2 py-1 rounded bg-space-900 border border-slate-700 text-slate-100 text-[11px]"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 block mb-0.5">Tx Antenna Gain (dBi)</label>
            <input
              type="number"
              step="0.5"
              value={inputs.txAntennaGainDbi}
              onChange={(e) => setInputs({ ...inputs, txAntennaGainDbi: Number(e.target.value) })}
              className="w-full px-2 py-1 rounded bg-space-900 border border-slate-700 text-slate-100 text-[11px]"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 block mb-0.5">Rx Antenna Gain (dBi)</label>
            <input
              type="number"
              step="0.5"
              value={inputs.rxAntennaGainDbi}
              onChange={(e) => setInputs({ ...inputs, rxAntennaGainDbi: Number(e.target.value) })}
              className="w-full px-2 py-1 rounded bg-space-900 border border-slate-700 text-slate-100 text-[11px]"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 block mb-0.5">Data Rate (bps)</label>
            <input
              type="number"
              step="1000"
              value={inputs.dataRateBps}
              onChange={(e) => setInputs({ ...inputs, dataRateBps: Number(e.target.value) })}
              className="w-full px-2 py-1 rounded bg-space-900 border border-slate-700 text-slate-100 text-[11px]"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 block mb-0.5">Sys Noise Temp (K)</label>
            <input
              type="number"
              step="10"
              value={inputs.rxSystemNoiseTempK}
              onChange={(e) => setInputs({ ...inputs, rxSystemNoiseTempK: Number(e.target.value) })}
              className="w-full px-2 py-1 rounded bg-space-900 border border-slate-700 text-slate-100 text-[11px]"
            />
          </div>
        </div>
      </details>
    </div>
  );
};

export default LinkBudgetPanel;
