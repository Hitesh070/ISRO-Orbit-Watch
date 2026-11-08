/**
 * OrbitGuard Share State & Deep-Link Modal
 * ========================================
 * Provides instant sharing of real-time telemetry state, active satellite selection,
 * simulation speed, and view route across web and desktop platforms.
 */

import React, { useState } from 'react';
import {
  Share2,
  X,
  Copy,
  Check,
  ExternalLink,
  Globe,
  Radio,
  Satellite,
  Compass,
} from 'lucide-react';
import { useOrbitStore, getShareableUrl } from '../../store/useOrbitStore';
import { copyTextToClipboard } from '../../utils/clipboard';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose }) => {
  const selectedSatellite = useOrbitStore((state) => state.selectedSatellite);
  const simulationSpeed = useOrbitStore((state) => state.simulationSpeed);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const shareUrl = getShareableUrl();
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const handleCopy = async () => {
    const success = await copyTextToClipboard(shareUrl);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleNativeShare = async () => {
    if (canNativeShare) {
      try {
        await navigator.share({
          title: selectedSatellite?.name ? `OrbitGuard - ${selectedSatellite.name}` : 'OrbitGuard Satellite Tracker',
          text: `Track ${selectedSatellite?.name || 'real-time orbital telemetry'} on OrbitGuard`,
          url: shareUrl,
        });
      } catch (err) {
        console.warn('Native share dismissed or failed:', err);
      }
    }
  };

  const handleOpenBrowser = () => {
    if (typeof window !== 'undefined') {
      window.open(shareUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-space-950/80 backdrop-blur-sm animate-in fade-in duration-150 select-none">
      <div className="glass-panel border border-cyan-500/40 rounded-2xl w-full max-w-lg overflow-hidden flex flex-col shadow-2xl text-slate-100 font-sans bg-space-950/95">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-space-950/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
              <Share2 className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-sm md:text-base font-bold text-slate-100">
                Share Telemetry State
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">
                Generate a permanent deep-link to this exact orbital scenario
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4">
          {/* Active State Configuration Card */}
          <div className="p-3.5 rounded-xl bg-space-900/70 border border-slate-800 space-y-2 text-xs font-mono">
            <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider pb-1 border-b border-slate-800/80">
              Active Parameters Encoded:
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Satellite className="w-3.5 h-3.5 text-cyan-400" /> Target Spacecraft:
              </span>
              <span className="font-bold text-slate-200">
                {selectedSatellite ? `${selectedSatellite.name} (#${selectedSatellite.norad_id})` : 'Global Fleet View'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-emerald-400" /> Simulation Clock:
              </span>
              <span className="font-bold text-emerald-300">
                {simulationSpeed > 1 ? `${simulationSpeed}x Speed` : '1x Real-Time Live'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-sky-400" /> Domain:
              </span>
              <span className="text-cyan-400">orbit-guard-tan.vercel.app</span>
            </div>
          </div>

          {/* Deep Link URL Box */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono text-slate-300 flex items-center justify-between">
              <span>Shareable Deep-Link URL:</span>
              {copied && (
                <span className="text-emerald-400 font-bold flex items-center gap-1 text-[10.5px]">
                  <Check className="w-3 h-3" /> Copied to Clipboard!
                </span>
              )}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                onFocus={(e) => e.target.select()}
                className="flex-1 px-3 py-2 rounded-lg bg-space-950 border border-slate-700 text-cyan-300 font-mono text-xs focus:outline-none focus:border-cyan-400 select-all"
              />
              <button
                onClick={handleCopy}
                className={`px-3 py-2 rounded-lg font-mono text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
                  copied
                    ? 'bg-emerald-500 text-space-950 shadow-glow-emerald'
                    : 'bg-cyan-500 hover:bg-cyan-400 text-space-950 shadow-glow-cyan'
                }`}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy Link'}</span>
              </button>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
            <button
              onClick={handleOpenBrowser}
              className="flex-1 py-2 px-3 rounded-lg bg-space-900 border border-slate-700 hover:border-cyan-400 text-slate-200 hover:text-cyan-300 text-xs font-mono font-semibold transition flex items-center justify-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open in Browser</span>
            </button>
            {canNativeShare && (
              <button
                onClick={handleNativeShare}
                className="flex-1 py-2 px-3 rounded-lg bg-space-900 border border-slate-700 hover:border-emerald-400 text-slate-200 hover:text-emerald-300 text-xs font-mono font-semibold transition flex items-center justify-center gap-1.5"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>System Share...</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="py-2 px-4 rounded-lg bg-space-900 border border-slate-700 hover:border-slate-500 text-slate-400 hover:text-slate-200 text-xs font-mono transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShareModal;
