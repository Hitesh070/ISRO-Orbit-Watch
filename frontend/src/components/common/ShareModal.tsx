/**
 * OrbitGuard Share State & Deep-Link Modal
 * ========================================
 * Provides instant sharing of catalog-based orbit view state and active satellite selection,
 * simulation speed, and view route across web and desktop platforms.
 * Portaled to document.body with z-[9999] to prevent clipping from parent sticky/filter containers.
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Share2,
  X,
  Copy,
  Check,
  ExternalLink,
  Globe,
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

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

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
          text: `View ${selectedSatellite?.name || 'an orbital prediction'} on OrbitGuard`,
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

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] overflow-y-auto bg-space-950/85 backdrop-blur-md p-3 sm:p-4 flex min-h-screen items-center justify-center animate-in fade-in duration-150 select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-lg my-auto glass-panel-glow border border-cyan-500/40 rounded-2xl shadow-2xl text-slate-100 font-sans bg-space-950/98 flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-space-950/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center shadow-glow-cyan/20">
              <Share2 className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h2 id="share-modal-title" className="text-sm sm:text-base font-bold text-slate-100 leading-tight">
                Share Telemetry State
              </h2>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                Generate a permanent deep-link to this exact orbital scenario
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body - Scrollable if screen height is constrained */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          {/* Active State Configuration Card */}
          <div className="p-3.5 rounded-xl bg-space-900/80 border border-slate-800/90 space-y-2.5 text-xs font-mono shadow-inner">
            <div className="text-[10.5px] text-slate-400 font-semibold uppercase tracking-wider pb-1.5 border-b border-slate-800/80 flex items-center justify-between">
              <span>Active Parameters Encoded:</span>
              <span className="text-[10px] text-cyan-400 bg-cyan-950/60 border border-cyan-800/50 px-1.5 py-0.5 rounded">
                Deep Link Ready
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-400 flex items-center gap-1.5 shrink-0">
                <Satellite className="w-3.5 h-3.5 text-cyan-400" /> Target Spacecraft:
              </span>
              <span className="font-bold text-slate-200 text-right truncate">
                {selectedSatellite ? `${selectedSatellite.name} (#${selectedSatellite.norad_id})` : 'Global Fleet View'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-400 flex items-center gap-1.5 shrink-0">
                <Compass className="w-3.5 h-3.5 text-emerald-400" /> Simulation Clock:
              </span>
              <span className="font-bold text-emerald-300">
                {simulationSpeed > 1 ? `${simulationSpeed}x Speed` : '1x Current UTC Clock'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-400 flex items-center gap-1.5 shrink-0">
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
                className="flex-1 px-3 py-2 rounded-lg bg-space-950 border border-slate-700 text-cyan-300 font-mono text-xs focus:outline-none focus:border-cyan-400 select-all shadow-inner"
              />
              <button
                onClick={handleCopy}
                className={`px-3.5 py-2 rounded-lg font-mono text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
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

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};

export default ShareModal;
