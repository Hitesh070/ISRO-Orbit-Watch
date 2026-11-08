/**
 * Navbar Component
 * OrbitGuard primary application banner featuring telemetry metrics ticker,
 * dual Local / UTC orbital clock, navigation routes, and TLE cache refresh trigger.
 * Enforced pure space dark theme.
 */

import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Globe,
  BarChart3,
  AlertOctagon,
  RefreshCw,
  Satellite,
  Radio,
  Clock,
  Activity,
  MapPin,
  HelpCircle,
  Share2,
  Check,
  Settings,
} from 'lucide-react';
import { useOrbitStore, getShareableUrl } from '../../store/useOrbitStore';
import { LocationModal } from '../common/LocationModal';
import { ShareModal } from '../common/ShareModal';
import { copyTextToClipboard } from '../../utils/clipboard';

export const Navbar = () => {
  const satellites = useOrbitStore((state) => state.satellites);
  const debris = useOrbitStore((state) => state.debris);
  const conjunctions = useOrbitStore((state) => state.conjunctions);
  const toggleHud = useOrbitStore((state) => state.toggleHud);
  const isHudVisible = useOrbitStore((state) => state.isHudVisible);
  const observerLocation = useOrbitStore((state) => state.observerLocation);
  const detectUserLocation = useOrbitStore((state) => state.detectUserLocation);
  const simulatedTimeMs = useOrbitStore((state) => state.simulatedTimeMs);
  const simulationSpeed = useOrbitStore((state) => state.simulationSpeed);
  const toggleHelp = useOrbitStore((state) => state.toggleHelp);
  const toggleSettings = useOrbitStore((state) => state.toggleSettings);
  const settings = useOrbitStore((state) => state.settings);
  const filters = useOrbitStore((state) => state.filters);

  const [utcTime, setUtcTime] = useState('');
  const [localTime, setLocalTime] = useState('');
  const [timeZoneLabel, setTimeZoneLabel] = useState('LOC');
  const [copiedLink, setCopiedLink] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  const handleCopyLink = async () => {
    setIsShareModalOpen(true);
    const url = getShareableUrl();
    const success = await copyTextToClipboard(url);
    if (success) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  // Live Dual Clocks (Synchronized User Local Time + Simulated Spacecraft UTC Time)
  useEffect(() => {
    const pad = (n) => String(n).padStart(2, '0');
    const updateTime = () => {
      const state = useOrbitStore.getState();
      const wallNow = new Date();
      const currentSimMs = state.simulationSpeed > 1 ? (state.simulatedTimeMs || Date.now()) : Date.now();
      const simNow = new Date(currentSimMs);

      const lHours = pad(wallNow.getHours());
      const lMinutes = pad(wallNow.getMinutes());
      const lSeconds = pad(wallNow.getSeconds());
      setLocalTime(`${lHours}:${lMinutes}:${lSeconds}`);

      const uHours = pad(simNow.getUTCHours());
      const uMinutes = pad(simNow.getUTCMinutes());
      const uSeconds = pad(simNow.getUTCSeconds());
      setUtcTime(`${uHours}:${uMinutes}:${uSeconds} UTC`);

      try {
        const parts = wallNow.toLocaleTimeString([], { timeZoneName: 'short' }).split(' ');
        setTimeZoneLabel(parts[parts.length - 1] || 'LOC');
      } catch {
        setTimeZoneLabel('LOC');
      }
    };
    updateTime();
    const interval = setInterval(updateTime, 250);
    return () => clearInterval(interval);
  }, []);

  const criticalConjunctions = conjunctions.filter(
    (c) => c.risk_level === 'CRITICAL' && (!filters?.indianSatsOnly || c.object1?.is_isro || c.object2?.is_isro)
  ).length;
  const isroCount = satellites.filter((s) => s.is_isro).length;
  const activeSatsCount = filters?.indianSatsOnly ? isroCount : satellites.length;

  return (
    <header className="sticky top-0 z-50 w-full glass-panel border-b border-cyan-500/20 px-2 sm:px-4 py-1.5 shadow-xl select-none ">
      <div className="w-full flex items-center justify-between gap-1.5 sm:gap-2">
        {/* Logo and Brand */}
        <div className="flex items-center gap-3">
          <NavLink to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 p-0.5 shadow-glow-cyan flex items-center justify-center">
              <div className="w-full h-full bg-space-950 rounded-[10px] flex items-center justify-center">
                <Satellite className="w-5 h-5 text-cyan-400 group-hover:rotate-12 transition-transform duration-300" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-base md:text-lg tracking-tight bg-gradient-to-r from-cyan-400 via-sky-300 to-emerald-400 bg-clip-text text-transparent">
                  OrbitGuard
                </span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  v5.0
                </span>
              </div>
              <p className="text-[10px] font-mono text-slate-400 hidden min-[1400px]:block">
                SGP4 Orbit Predictions & Catalog Screening
              </p>
            </div>
          </NavLink>
        </div>

        {/* Catalog object counters */}
        <div className="hidden min-[1680px]:flex items-center gap-3 text-xs font-mono px-2.5 py-1 rounded-lg bg-space-950/70 border border-slate-800 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-slate-400">{filters?.indianSatsOnly ? 'ISRO Spacecraft:' : 'Active Spacecraft:'}</span>
            <span className="font-bold text-emerald-400">{activeSatsCount}</span>
          </div>

          <div className="w-px h-3.5 bg-slate-800" />

          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-slate-400">Tracked Debris:</span>
            <span className="font-bold text-amber-400">{(debris || []).length.toLocaleString()}</span>
          </div>

          <div className="w-px h-3.5 bg-slate-800" />

          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            <span className="text-slate-400">Conjunctions:</span>
            <span className="font-bold text-rose-400">{criticalConjunctions} Critical by distance</span>
          </div>
        </div>

        {/* Navigation Routes */}
        <nav className="flex items-center gap-1 shrink-0">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold font-mono transition ${
                isActive
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-glow-cyan'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
              }`
            }
          >
            <Globe className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="hidden sm:inline">3D Globe</span>
          </NavLink>

          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold font-mono transition ${
                isActive
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-glow-cyan'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
              }`
            }
          >
            <BarChart3 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="hidden md:inline">Analytics</span>
            <span className="hidden min-[1400px]:inline"> &amp; Risk</span>
          </NavLink>

          <NavLink
            to="/conjunctions"
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold font-mono transition relative ${
                isActive
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-glow-rose'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
              }`
            }
          >
            <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="hidden md:inline">Conjunctions</span>
            {criticalConjunctions > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-500 absolute -top-0.5 -right-0.5 animate-pulse" />
            )}
          </NavLink>

          <NavLink
            to="/rf"
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold font-mono transition ${
                isActive
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-glow-cyan'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
              }`
            }
          >
            <Radio className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="hidden md:inline">RF Station</span>
          </NavLink>
        </nav>

        {/* Right Section: Location, Live Clock & Control Suite (Guaranteed Visible) */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Ground Station / Observer Location */}
          <button
            onClick={() => setIsLocationModalOpen(true)}
            title="Click to select Ground Station preset or enter custom coordinates"
            className="hidden xl:flex items-center gap-1.5 px-2 py-1 rounded-lg bg-space-950/80 border border-slate-700 hover:border-cyan-400 text-[11px] font-mono text-slate-300 hover:text-cyan-300 transition shrink-0"
          >
            <MapPin className="w-3.5 h-3.5 text-emerald-400 animate-pulse shrink-0" />
            <span className="truncate max-w-[130px] font-medium">
              {(observerLocation?.name || 'Station')
                .replace(/\(Inferred\s*GPS\)/i, '(GPS)')
                .replace(/\(Inferred\)/i, '')
                .replace(/Ground\s*Station/i, '')
                .trim()}
            </span>
          </button>

          {/* Clock Widget */}
          <div className="flex flex-col items-end justify-center shrink-0 whitespace-nowrap text-right font-mono px-2 py-0.5 rounded-lg bg-space-950/60 border border-slate-800">
            <div className="text-xs text-cyan-300 font-bold flex items-center justify-end gap-1.5 leading-tight">
              <Clock className="w-3 h-3 text-cyan-400 shrink-0" />
              <span className="tracking-wider">
                {settings?.timeFormat === 'utc_primary' ? utcTime : localTime}
              </span>
              <span className="text-[10px] text-slate-400 font-normal">
                {settings?.timeFormat === 'utc_primary' ? '' : timeZoneLabel}
              </span>
              <span
                className={`text-[9px] px-1 py-0.2 rounded font-mono font-bold ${
                  simulationSpeed > 1
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                }`}
              >
                {simulationSpeed > 1 ? `${simulationSpeed}x` : 'UTC NOW'}
              </span>
            </div>
            <div className="text-[10px] text-slate-400 tracking-wider leading-tight mt-0.5">
              {settings?.timeFormat === 'utc_primary' ? `${localTime} ${timeZoneLabel}` : utcTime}
            </div>
          </div>

          {/* Action Control Buttons (Always Visible with shrink-0) */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* Copy Shareable State Link */}
            <button
              onClick={handleCopyLink}
              title={copiedLink ? 'Deep-Link Copied to Clipboard!' : 'Share State: Copy Deep-Link URL'}
              className={`p-1.5 rounded-lg border transition shadow-sm ${
                copiedLink
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-glow-emerald'
                  : 'bg-space-900 border-slate-700 hover:border-cyan-400 text-slate-300 hover:text-cyan-300'
              }`}
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
            </button>

            {/* Performance HUD Toggle */}
            <button
              onClick={toggleHud}
              title="Toggle Performance & Astrodynamic HUD (~)"
              className={`p-1.5 rounded-lg border transition shadow-sm ${
                isHudVisible
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-glow-emerald'
                  : 'bg-space-900 border-slate-700 hover:border-emerald-400 text-slate-300 hover:text-emerald-300'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
            </button>

            {/* System Settings Drawer */}
            <button
              onClick={toggleSettings}
              title="Open System Settings & Units"
              className="p-1.5 rounded-lg bg-space-900 border border-slate-700 hover:border-cyan-400 text-slate-300 hover:text-cyan-300 transition shadow-sm"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>

            {/* Scheduled catalog refresh status */}
            <button
              type="button"
              disabled
              title="Catalog snapshots update on the configured backend schedule; this client cannot force a refresh."
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-space-950/40 border border-slate-700 text-slate-400 text-xs font-mono font-semibold shrink-0 cursor-default"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden min-[1600px]:inline">Scheduled refresh</span>
            </button>

            {/* Reference & Help Modal Toggle */}
            <button
              onClick={toggleHelp}
              title="Open Documentation & Keyboard Shortcuts (?)"
              className="p-1.5 rounded-lg bg-space-900 border border-slate-700 hover:border-cyan-400 text-slate-300 hover:text-cyan-300 transition shadow-sm"
            >
              <HelpCircle className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
      <LocationModal isOpen={isLocationModalOpen} onClose={() => setIsLocationModalOpen(false)} />
      <ShareModal isOpen={isShareModalOpen} onClose={() => setIsShareModalOpen(false)} />
    </header>
  );
};

export default Navbar;
