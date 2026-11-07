/**
 * OrbitGuard RF & Ground Station Telemetry Suite (Phase 4)
 * ========================================================
 * Complete professional RF pass planning, Doppler shift tracking, polar sky plot,
 * link budget calculation, and calendar (.ics / .csv) scheduling.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useOrbitStore } from '../../store/useOrbitStore';
import defaultFrequencies from '../../config/frequencies.json';
import {
  predictDetailedPasses,
  generatePassICS,
  generatePassCSV,
  DetailedPass,
  PassSample,
  ObserverSite,
} from '../../lib/rf/passPlanner';
import PolarSkyPlot from './PolarSkyPlot';
import DopplerCurveChart from './DopplerCurveChart';
import LinkBudgetPanel from './LinkBudgetPanel';
import RotatorPanel from '../tracking/RotatorPanel';
import {
  Radio,
  MapPin,
  Calendar,
  Download,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Compass,
  Zap,
  Activity,
  Layers,
  ChevronRight,
} from 'lucide-react';

export const RFSuite: React.FC = () => {
  const catalog = useOrbitStore((state) => state.catalog);
  const selectedSatellite = useOrbitStore((state) => state.selectedSatellite);
  const selectSatellite = useOrbitStore((state) => state.selectSatellite);
  const observerLocation = useOrbitStore((state) => state.observerLocation);
  const detectUserLocation = useOrbitStore((state) => state.detectUserLocation);
  const setObserverLocation = useOrbitStore((state) => state.setObserverLocation);
  const settings = useOrbitStore((state) => state.settings);

  // Elevation mask setting (degrees, 0 to 20)
  const [elevationMask, setElevationMask] = useState(settings?.elevationMaskDeg || 5.0);

  useEffect(() => {
    if (settings?.elevationMaskDeg !== undefined) {
      setElevationMask(settings.elevationMaskDeg);
    }
  }, [settings?.elevationMaskDeg]);

  // Active target satellite NORAD ID
  const [targetNoradId, setTargetNoradId] = useState<number>(
    selectedSatellite?.norad_id || 25544 // Default to ISS
  );

  // Frequency database with local user edits
  const [frequencies, setFrequencies] = useState(() => {
    try {
      const saved = localStorage.getItem('orbitguard_custom_frequencies');
      return saved ? JSON.parse(saved) : defaultFrequencies;
    } catch {
      return defaultFrequencies;
    }
  });

  // Active RF analysis subtab: 'DOPPLER' | 'LINK_BUDGET' | 'ROTATOR'
  const [activeSubTab, setActiveSubTab] = useState<'DOPPLER' | 'LINK_BUDGET' | 'ROTATOR'>('DOPPLER');

  // Currently inspected pass
  const [selectedPass, setSelectedPass] = useState<DetailedPass | null>(null);

  // Hovered sample along trajectory
  const [hoveredSample, setHoveredSample] = useState<PassSample | null>(null);

  // Target satellite record
  const targetSat = useMemo(() => {
    return catalog.find((s: any) => s.norad_id === targetNoradId) || catalog[0] || null;
  }, [catalog, targetNoradId]);

  // Target frequency profile
  const targetFreq = useMemo(() => {
    return (
      frequencies.find((f: any) => f.noradId === targetNoradId) || {
        noradId: targetNoradId,
        name: targetSat?.name || 'Unknown Satellite',
        band: 'VHF/UHF Standard',
        downlinkHz: 437.5e6,
        uplinkHz: 145.9e6,
        mode: 'Telemetry / FM',
        verified: false,
        source: 'Standard Default (Unverified)',
      }
    );
  }, [frequencies, targetNoradId, targetSat]);

  // Observer coordinates
  const observerSite: ObserverSite = useMemo(
    () => ({
      lat: observerLocation?.lat ?? 12.9716,
      lon: observerLocation?.lon ?? 77.5946,
      altM: observerLocation?.alt_m ?? 920,
      name: observerLocation?.name ?? 'Bengaluru Ground Station',
    }),
    [observerLocation]
  );

  // Compute upcoming detailed passes
  const passes: DetailedPass[] = useMemo(() => {
    const l1 = targetSat?.line1 || targetSat?.tle_line1;
    const l2 = targetSat?.line2 || targetSat?.tle_line2;
    if (!l1 || !l2) return [];

    return predictDetailedPasses(
      l1,
      l2,
      targetSat.name,
      targetSat.norad_id,
      observerSite,
      targetFreq.downlinkHz,
      elevationMask,
      72, // 72-hour window
      8   // up to 8 passes
    );
  }, [targetSat, observerSite, targetFreq.downlinkHz, elevationMask]);

  // Default select first pass when passes recalculate
  useEffect(() => {
    if (passes.length > 0) {
      setSelectedPass(passes[0]);
    } else {
      setSelectedPass(null);
    }
  }, [passes]);

  // Sync selected satellite when user picks from external globe
  useEffect(() => {
    if (selectedSatellite?.norad_id && selectedSatellite.norad_id !== targetNoradId) {
      setTargetNoradId(selectedSatellite.norad_id);
    }
  }, [selectedSatellite]);

  // Download pass schedule as .ics
  const handleDownloadICS = () => {
    if (passes.length === 0) return;
    const icsContent = generatePassICS(passes);
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `orbitguard_passes_${targetSat?.name || targetNoradId}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Download pass schedule as .csv
  const handleDownloadCSV = () => {
    if (passes.length === 0) return;
    const csvContent = generatePassCSV(passes);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `orbitguard_passes_${targetSat?.name || targetNoradId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-4 font-mono text-slate-100 max-w-7xl mx-auto pb-10">
      {/* Top Header Banner */}
      <div className="glass-panel p-4 md:p-5 rounded-2xl border border-cyan-500/20 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-cyan-400" />
            <h1 className="text-base md:text-lg font-bold tracking-tight bg-gradient-to-r from-cyan-400 to-sky-300 bg-clip-text text-transparent">
              RF Ground Station Suite & Doppler Analysis
            </h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              Phase 4 EEE Suite
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Topocentric look-angle pass planning, Earth-rotation Doppler compensation, polar sky plots, and dynamic RF link budget.
          </p>
        </div>

        {/* Observer Ground Station Settings */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-space-950/80 border border-slate-800">
            <MapPin className="w-4 h-4 text-emerald-400 animate-pulse" />
            <div>
              <div className="text-[10px] text-slate-400">Ground Station Site</div>
              <div className="font-semibold text-slate-200 truncate max-w-[170px]">{observerSite.name}</div>
            </div>
            <button
              onClick={detectUserLocation}
              title="Re-sync browser GPS location"
              className="ml-1 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 text-[10px] transition"
            >
              GPS
            </button>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-space-950/80 border border-slate-800">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <div>
              <div className="text-[10px] text-slate-400">Elevation Mask</div>
              <div className="font-bold text-cyan-300">{elevationMask}°</div>
            </div>
            <input
              type="range"
              min="0"
              max="20"
              step="1"
              value={elevationMask}
              onChange={(e) => setElevationMask(Number(e.target.value))}
              className="w-16 accent-cyan-400 cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Target Spacecraft & RF Frequency Selector Bar */}
      <div className="glass-panel p-4 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <span className="text-slate-400 font-semibold flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-cyan-400" /> Target Satellite:
          </span>
          <select
            value={targetNoradId}
            onChange={(e) => {
              const id = Number(e.target.value);
              setTargetNoradId(id);
              selectSatellite(id);
            }}
            className="px-3 py-1.5 rounded-lg bg-space-950 border border-slate-700 text-cyan-300 font-semibold focus:outline-none focus:border-cyan-400"
          >
            {catalog.map((s: any) => (
              <option key={s.norad_id} value={s.norad_id}>
                {s.name} (NORAD {s.norad_id}) {s.is_isro ? '🇮🇳 [ISRO]' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Frequency & Verification Status Badge */}
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-slate-400">Carrier:</span>
          <span className="font-bold text-slate-200">
            {(targetFreq.downlinkHz / 1e6).toFixed(3)} MHz
          </span>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold border flex items-center gap-1 ${
              targetFreq.verified
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
            }`}
          >
            {targetFreq.verified ? (
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-3 h-3 text-amber-400" />
            )}
            {targetFreq.verified ? 'Verified Coordination' : 'Screening Preset (Confirm before Tx)'}
          </span>
        </div>
      </div>

      {/* Primary Pass Visualizer: Polar Sky Plot & RF Telemetry */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Polar Sky Plot (Topocentric Track) */}
        <div className="lg:col-span-5 glass-panel p-4 rounded-2xl border border-slate-800 flex flex-col items-center justify-between">
          <div className="w-full flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
            <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-cyan-400" /> Polar Sky Plot (North Up)
            </span>
            {selectedPass && (
              <span className="text-[10px] text-cyan-300">
                Max El: <strong className="text-cyan-200">{selectedPass.maxElevationDeg}°</strong> at{' '}
                {new Date(selectedPass.tcaEpochMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>

          <PolarSkyPlot
            pass={selectedPass}
            selectedSample={hoveredSample}
            onHoverSample={setHoveredSample}
          />

          <div className="w-full text-center text-[10px] text-slate-500 mt-2">
            Radial distance from center represents zenith angle (90° - Elevation).
          </div>
        </div>

        {/* Right Column: Doppler S-Curve & Dynamic Link Budget */}
        <div className="lg:col-span-7 glass-panel p-4 rounded-2xl border border-slate-800 flex flex-col justify-between">
          <div>
            {/* Sub-tabs */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveSubTab('DOPPLER')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition ${
                    activeSubTab === 'DOPPLER'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-glow-amber'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5" /> Doppler S-Curve & Tracking
                </button>
                <button
                  onClick={() => setActiveSubTab('LINK_BUDGET')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition ${
                    activeSubTab === 'LINK_BUDGET'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-glow-cyan'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Radio className="w-3.5 h-3.5" /> Dynamic Link Budget (FSPL)
                </button>
                <button
                  onClick={() => setActiveSubTab('ROTATOR')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition ${
                    activeSubTab === 'ROTATOR'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-glow-emerald'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Compass className="w-3.5 h-3.5" /> Antenna Rotator Control
                </button>
              </div>

              {selectedPass && (
                <div className="text-[10px] text-slate-400">
                  Pass Duration: <span className="text-slate-200 font-bold">{Math.floor(selectedPass.durationSeconds / 60)}m {selectedPass.durationSeconds % 60}s</span>
                </div>
              )}
            </div>

            {/* Subtab Viewports */}
            {activeSubTab === 'DOPPLER' ? (
              <DopplerCurveChart
                pass={selectedPass}
                carrierFreqHz={targetFreq.downlinkHz}
                onHoverSample={setHoveredSample}
              />
            ) : activeSubTab === 'LINK_BUDGET' ? (
              <LinkBudgetPanel
                pass={selectedPass}
                carrierFreqHz={targetFreq.downlinkHz}
              />
            ) : (
              <RotatorPanel pass={selectedPass} />
            )}
          </div>

          <div className="text-[10px] text-slate-500 border-t border-slate-900 pt-2 mt-3 flex items-center justify-between">
            <span>Observer Earth rotation velocity compensation: <strong className="text-slate-400">v_obs = [-ω_E·y, ω_E·x, 0]</strong></span>
            <span>Relativistic error bound: &lt; 1e-9</span>
          </div>
        </div>
      </div>

      {/* Upcoming Pass Schedule Table */}
      <div className="glass-panel p-4 md:p-5 rounded-2xl border border-slate-800 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3 mb-3">
          <div>
            <h2 className="text-sm md:text-base font-bold text-slate-200 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-cyan-400" />
              Upcoming Pass Opportunities Schedule ({passes.length})
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Next 72 hours topocentric pass predictions refined by bisection to &lt; 1s accuracy.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadICS}
              disabled={passes.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-space-950 border border-slate-700 hover:border-cyan-400 text-cyan-300 hover:text-cyan-100 text-xs transition disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" /> Export .ICS Calendar
            </button>
            <button
              onClick={handleDownloadCSV}
              disabled={passes.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-space-950 border border-slate-700 hover:border-emerald-400 text-emerald-300 hover:text-emerald-100 text-xs transition disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" /> Export .CSV Log
            </button>
          </div>
        </div>

        {passes.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs">
            No pass opportunities found above the {elevationMask}° elevation mask in the next 72 hours.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-[10px] uppercase">
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3">AOS Time (Local)</th>
                  <th className="py-2 px-3">TCA (Max El)</th>
                  <th className="py-2 px-3">LOS Time</th>
                  <th className="py-2 px-3">Duration</th>
                  <th className="py-2 px-3">Azimuth Trajectory</th>
                  <th className="py-2 px-3">Min Slant Range</th>
                  <th className="py-2 px-3">Max Doppler</th>
                  <th className="py-2 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {passes.map((p) => {
                  const isSelected = selectedPass?.id === p.id;
                  const aosDate = new Date(p.aosEpochMs);
                  const tcaDate = new Date(p.tcaEpochMs);
                  const losDate = new Date(p.losEpochMs);

                  return (
                    <tr
                      key={p.id}
                      onClick={() => setSelectedPass(p)}
                      className={`cursor-pointer transition ${
                        isSelected
                          ? 'bg-cyan-500/15 text-cyan-200'
                          : 'hover:bg-white/5 text-slate-300'
                      }`}
                    >
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            p.quality === 'EXCELLENT'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : p.quality === 'GOOD'
                              ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                              : 'bg-slate-500/10 text-slate-400 border-slate-500/30'
                          }`}
                        >
                          {p.quality}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-semibold">
                        {aosDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        <div className="text-[10px] text-slate-500">{aosDate.toLocaleDateString([], { month: 'short', day: 'numeric' })}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-bold text-cyan-400">{p.maxElevationDeg}°</span>
                        <div className="text-[10px] text-slate-500">
                          {tcaDate.toLocaleTimeString([], { minute: '2-digit', second: '2-digit' })}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">
                        {losDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-200">
                        {Math.floor(p.durationSeconds / 60)}m {p.durationSeconds % 60}s
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">
                        {p.aosAzimuthDeg}° → {p.tcaAzimuthDeg}° → {p.losAzimuthDeg}°
                      </td>
                      <td className="py-2.5 px-3 text-slate-300">
                        {p.minRangeKm} km
                      </td>
                      <td className="py-2.5 px-3 text-amber-300">
                        ±{p.maxDopplerShiftHz} Hz
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPass(p);
                          }}
                          className={`px-2.5 py-1 rounded text-[11px] font-semibold transition ${
                            isSelected
                              ? 'bg-cyan-500 text-space-950 font-bold'
                              : 'bg-space-900 border border-slate-700 hover:border-cyan-400 text-slate-300'
                          }`}
                        >
                          {isSelected ? 'Active' : 'Plot'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default RFSuite;
