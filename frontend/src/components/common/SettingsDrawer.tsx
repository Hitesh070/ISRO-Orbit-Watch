/**
 * OrbitGuard Persistent Settings Drawer (Phase 6)
 * ===============================================
 * Allows customization of:
 * - Distance and velocity units (Metric km / km/s vs Imperial miles / mi/s)
 * - Clock presentation (Local Time primary vs UTC primary)
 * - 3D Graphics performance profile (High, Medium, Low, Auto)
 * - Accessibility (WCAG AA Reduced Motion)
 * - Ground Station look-angle elevation mask (0° to 20°)
 * - Conjunction assessment covariance scaling (k multiplier)
 * - Collision probability (Pc) screening thresholds
 *
 * Persists immediately into localStorage under 'orbitguard_settings_v1'.
 */

import React, { useState } from 'react';
import {
  X,
  Settings,
  RotateCcw,
  Check,
  Gauge,
  Clock,
  Radio,
  Sliders,
  ShieldAlert,
  Sparkles,
  Info,
} from 'lucide-react';
import { useOrbitStore } from '../../store/useOrbitStore';

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsDrawer: React.FC<SettingsDrawerProps> = ({ isOpen, onClose }) => {
  const settings = useOrbitStore((state) => state.settings);
  const updateSettings = useOrbitStore((state) => state.updateSettings);
  const resetSettings = useOrbitStore((state) => state.resetSettings);

  const [savedBanner, setSavedBanner] = useState(false);

  if (!isOpen) return null;

  const handleUpdate = (partial: Parameters<typeof updateSettings>[0]) => {
    updateSettings(partial);
    setSavedBanner(true);
    setTimeout(() => setSavedBanner(false), 2000);
  };

  const handleReset = () => {
    resetSettings();
    setSavedBanner(true);
    setTimeout(() => setSavedBanner(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-space-950/70 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-space-950 border-l border-cyan-500/30 p-5 shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-300"
        role="dialog"
        aria-modal="true"
        aria-label="OrbitGuard Settings"
      >
        <div>
          {/* Header */}
          <div className="flex items-center justify-between pb-3.5 border-b border-cyan-500/20">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <Settings className="w-5 h-5 animate-spin-slow" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  System Settings & Units
                </h2>
                <p className="text-[11px] font-mono text-cyan-400">OrbitGuard v4.2 Preferences</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
              title="Close Settings"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {savedBanner && (
            <div className="mt-3 py-1.5 px-3 rounded-lg bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 text-xs font-mono flex items-center gap-2 animate-in fade-in duration-150">
              <Check className="w-4 h-4 text-emerald-400" />
              Preferences saved & applied.
            </div>
          )}

          {/* Settings Sections */}
          <div className="mt-5 space-y-6 text-xs text-slate-300 font-sans">
            {/* Section 1: Units & Presentation */}
            <div>
              <div className="flex items-center gap-1.5 text-cyan-400 font-bold uppercase tracking-wider text-[11px] mb-2.5">
                <Gauge className="w-3.5 h-3.5" /> Physical Units & Standards
              </div>
              <div className="bg-space-900/80 border border-slate-800 rounded-xl p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-200">Distance & Velocity Units</div>
                    <div className="text-[10px] text-slate-400">Altitude, range, and velocity display</div>
                  </div>
                  <div className="flex bg-space-950 p-0.5 rounded-lg border border-slate-800">
                    <button
                      onClick={() => handleUpdate({ units: 'metric' })}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-bold transition ${
                        settings.units === 'metric'
                          ? 'bg-cyan-500 text-space-950 shadow-glow-cyan'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Metric (km)
                    </button>
                    <button
                      onClick={() => handleUpdate({ units: 'imperial' })}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-bold transition ${
                        settings.units === 'imperial'
                          ? 'bg-cyan-500 text-space-950 shadow-glow-cyan'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Imperial (mi)
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2.5 border-t border-slate-800/60">
                  <div>
                    <div className="font-semibold text-slate-200">Mission Clock Emphasis</div>
                    <div className="text-[10px] text-slate-400">Preferred primary clock in the header</div>
                  </div>
                  <div className="flex bg-space-950 p-0.5 rounded-lg border border-slate-800">
                    <button
                      onClick={() => handleUpdate({ timeFormat: 'local_primary' })}
                      className={`px-2 py-1 rounded-md text-[11px] font-mono transition ${
                        settings.timeFormat === 'local_primary'
                          ? 'bg-cyan-500 text-space-950 font-bold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Local Time
                    </button>
                    <button
                      onClick={() => handleUpdate({ timeFormat: 'utc_primary' })}
                      className={`px-2 py-1 rounded-md text-[11px] font-mono transition ${
                        settings.timeFormat === 'utc_primary'
                          ? 'bg-cyan-500 text-space-950 font-bold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      UTC Space
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: 3D Graphics & Performance */}
            <div>
              <div className="flex items-center gap-1.5 text-cyan-400 font-bold uppercase tracking-wider text-[11px] mb-2.5">
                <Sparkles className="w-3.5 h-3.5" /> 3D Graphics & Accessibility
              </div>
              <div className="bg-space-900/80 border border-slate-800 rounded-xl p-3 space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-slate-200">Shader Quality Preset</span>
                    <span className="font-mono text-cyan-400 uppercase text-[11px] font-bold">
                      {settings.quality}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1 text-[11px] font-mono">
                    {(['high', 'medium', 'low', 'auto'] as const).map((q) => (
                      <button
                        key={q}
                        onClick={() => handleUpdate({ quality: q })}
                        className={`py-1 rounded-md border text-center uppercase transition ${
                          settings.quality === q
                            ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 font-bold'
                            : 'bg-space-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    * High renders full atmospheric Rayleigh scattering and 60 FPS velocity extrapolation. Low reduces shader operations for battery efficiency.
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2.5 border-t border-slate-800/60">
                  <div>
                    <div className="font-semibold text-slate-200">Reduced Motion (WCAG AA)</div>
                    <div className="text-[10px] text-slate-400">Stops animated cloud drift and pulsing glows</div>
                  </div>
                  <button
                    onClick={() => handleUpdate({ reducedMotion: !settings.reducedMotion })}
                    className={`w-11 h-6 rounded-full transition-colors p-0.5 ${
                      settings.reducedMotion ? 'bg-cyan-500' : 'bg-slate-800'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white transition-transform ${
                        settings.reducedMotion ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Section 3: RF Ground Station Defaults */}
            <div>
              <div className="flex items-center gap-1.5 text-cyan-400 font-bold uppercase tracking-wider text-[11px] mb-2.5">
                <Radio className="w-3.5 h-3.5" /> Ground Station Look Angles
              </div>
              <div className="bg-space-900/80 border border-slate-800 rounded-xl p-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-semibold text-slate-200">Default Horizon Elevation Mask</span>
                  <span className="font-mono text-cyan-300 font-bold">{settings.elevationMaskDeg}°</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="20"
                  step="1"
                  value={settings.elevationMaskDeg}
                  onChange={(e) => handleUpdate({ elevationMaskDeg: Number(e.target.value) })}
                  className="w-full accent-cyan-400 h-1.5 bg-space-950 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1">
                  <span>0° (Flat Sea Horizon)</span>
                  <span>5° (Standard Ground Station)</span>
                  <span>20° (Urban Mask)</span>
                </div>
              </div>
            </div>

            {/* Section 4: Conjunction Uncertainty & Screening */}
            <div>
              <div className="flex items-center gap-1.5 text-cyan-400 font-bold uppercase tracking-wider text-[11px] mb-2.5">
                <ShieldAlert className="w-3.5 h-3.5" /> Conjunction Screening Sensitivity
              </div>
              <div className="bg-space-900/80 border border-slate-800 rounded-xl p-3 space-y-3">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <div>
                      <span className="font-semibold text-slate-200">Covariance Scale Factor (k)</span>
                      <div className="text-[10px] text-slate-400">Akella Pc sensitivity multiplier</div>
                    </div>
                    <span className="font-mono text-cyan-300 font-bold">{settings.covarianceScaleK.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="5.0"
                    step="0.1"
                    value={settings.covarianceScaleK}
                    onChange={(e) => handleUpdate({ covarianceScaleK: Number(e.target.value) })}
                    className="w-full accent-cyan-400 h-1.5 bg-space-950 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div className="pt-2 border-t border-slate-800/60 text-[10px] text-slate-400 flex items-start gap-1.5">
                  <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    Synthetic RTN covariance is screening-grade. Scaling k simulates along-track error inflation for older element sets.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-cyan-500/20 flex items-center justify-between gap-3">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 text-xs font-mono transition"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset Defaults
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-space-950 font-bold text-xs shadow-glow-cyan transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsDrawer;
