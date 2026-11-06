/**
 * OrbitGuard Help, Keyboard Shortcuts & Scientific Disclaimers Modal (Phase 6)
 * ===========================================================================
 * Comprehensive in-app reference guide covering:
 * - Keyboard shortcuts
 * - Astrodynamics architecture overview
 * - Operational disclaimers and scientific assumptions
 */

import React, { useState } from 'react';
import {
  HelpCircle,
  X,
  Keyboard,
  BookOpen,
  AlertTriangle,
  Layers,
  Cpu,
  Radio,
  ExternalLink,
} from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'SHORTCUTS' | 'ARCHITECTURE' | 'ASSUMPTIONS'>('SHORTCUTS');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-space-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="glass-panel border border-cyan-500/40 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl text-slate-100 font-sans">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-space-950/70">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-slate-100">
              OrbitGuard Reference & Documentation
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 px-5 pt-2 gap-2 bg-space-900/40 text-xs font-mono">
          <button
            onClick={() => setActiveTab('SHORTCUTS')}
            className={`px-3 py-2 rounded-t-lg font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'SHORTCUTS'
                ? 'border-cyan-400 text-cyan-300 bg-space-900/60'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Keyboard className="w-3.5 h-3.5" /> Keyboard Shortcuts
          </button>
          <button
            onClick={() => setActiveTab('ARCHITECTURE')}
            className={`px-3 py-2 rounded-t-lg font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'ARCHITECTURE'
                ? 'border-cyan-400 text-cyan-300 bg-space-900/60'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" /> Architecture
          </button>
          <button
            onClick={() => setActiveTab('ASSUMPTIONS')}
            className={`px-3 py-2 rounded-t-lg font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'ASSUMPTIONS'
                ? 'border-cyan-400 text-cyan-300 bg-space-900/60'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" /> Assumptions & Limits
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs font-sans leading-relaxed">
          {activeTab === 'SHORTCUTS' && (
            <div className="space-y-3 font-mono">
              <p className="text-slate-400 font-sans text-xs mb-3">
                Quick operational hotkeys for rapid viewport manipulation and telemetry inspection:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-space-900/80 border border-slate-800">
                  <span className="text-slate-300">Toggle Performance HUD</span>
                  <kbd className="px-2 py-1 rounded bg-space-950 border border-slate-700 text-cyan-300 text-[11px] font-bold">~</kbd>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-space-900/80 border border-slate-800">
                  <span className="text-slate-300">Clear Satellite Selection</span>
                  <kbd className="px-2 py-1 rounded bg-space-950 border border-slate-700 text-cyan-300 text-[11px] font-bold">Esc</kbd>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-space-900/80 border border-slate-800">
                  <span className="text-slate-300">Simulation Speed: 1x (Live)</span>
                  <kbd className="px-2 py-1 rounded bg-space-950 border border-slate-700 text-cyan-300 text-[11px] font-bold">1</kbd>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-space-900/80 border border-slate-800">
                  <span className="text-slate-300">Simulation Speed: 5x Fast</span>
                  <kbd className="px-2 py-1 rounded bg-space-950 border border-slate-700 text-cyan-300 text-[11px] font-bold">5</kbd>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-space-900/80 border border-slate-800">
                  <span className="text-slate-300">Simulation Speed: 60x Warp</span>
                  <kbd className="px-2 py-1 rounded bg-space-950 border border-slate-700 text-cyan-300 text-[11px] font-bold">6</kbd>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-space-900/80 border border-slate-800">
                  <span className="text-slate-300">Open Help & Reference</span>
                  <kbd className="px-2 py-1 rounded bg-space-950 border border-slate-700 text-cyan-300 text-[11px] font-bold">?</kbd>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ARCHITECTURE' && (
            <div className="space-y-3">
              <h3 className="font-bold text-sm text-cyan-400">OrbitGuard Engineering Foundations</h3>
              <p className="text-slate-300">
                OrbitGuard is an astrodynamics-grade Space Situational Awareness (SSA) system engineered with high-performance WebGL/WebWorker pipelining:
              </p>

              <div className="space-y-2">
                <div className="p-3 rounded-lg bg-space-900/70 border border-slate-800">
                  <div className="font-bold text-cyan-300 text-[11px] font-mono mb-1">
                    1. Dedicated Web Worker SGP4 Propagator (Zero Garbage Collection)
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    Offloads numerical orbit propagation to background worker threads using ping-pong transferable Float32Arrays. Never blocks the browser UI main thread.
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-space-900/70 border border-slate-800">
                  <div className="font-bold text-cyan-300 text-[11px] font-mono mb-1">
                    2. GPU Vertex Shader Extrapolation (Single Draw Call)
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    Renders 25,000+ objects in one single Three.js draw call. The vertex shader performs real-time linear velocity extrapolation at 60 FPS:
                    <code className="text-cyan-200 ml-1">pos = aPos + aVel * uDt</code>.
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-space-900/70 border border-slate-800">
                  <div className="font-bold text-cyan-300 text-[11px] font-mono mb-1">
                    3. Celestial Inertial Frame (TEME) Alignment
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    Satellites propagate in the True Equator, Mean Equinox (TEME) frame while Earth rotates rigidly by Greenwich Mean Sidereal Time (GMST).
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ASSUMPTIONS' && (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-500/40 text-rose-300 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-xs">Scientific Transparency Notice</div>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    OrbitGuard is an academic and engineering analysis demonstration. It is <strong>NOT an operational guidance system</strong>. Collision avoidance decisions require official Conjunction Data Messages (CDMs) from military or owner-operator radar tracking.
                  </p>
                </div>
              </div>

              <div className="space-y-2 text-slate-300">
                <div className="p-2.5 rounded-lg bg-space-900/60 border border-slate-800">
                  <strong className="text-cyan-300 font-mono text-[11px] block">TLE Accuracy Limits:</strong>
                  Public Two-Line Element sets degrade over time due to unmodeled atmospheric drag and solar radiation pressure. Errors typically grow by 1–3 km per day for LEO assets.
                </div>

                <div className="p-2.5 rounded-lg bg-space-900/60 border border-slate-800">
                  <strong className="text-cyan-300 font-mono text-[11px] block">Synthetic RTN Covariance:</strong>
                  Public CelesTrak element sets do not distribute true error covariance matrices. OrbitGuard synthesizes an age-scaled Radial-Transverse-Normal covariance matrix for screening-grade Foster-1992 Pc integration.
                </div>

                <div className="p-2.5 rounded-lg bg-space-900/60 border border-slate-800">
                  <strong className="text-cyan-300 font-mono text-[11px] block">RF Atmosphere Model:</strong>
                  Atmospheric attenuation uses a simplified cosecant model. Professional missions must refer to ITU-R P.618 and P.676 recommendations.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-800 bg-space-950/70 text-slate-400 text-[11px]">
          <span>OrbitGuard v4.0 • EEE Space Systems Suite</span>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-space-900 hover:bg-space-850 text-slate-200 border border-slate-700 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default HelpModal;
