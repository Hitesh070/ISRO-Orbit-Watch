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
  GraduationCap,
} from 'lucide-react';
import { useOrbitStore, getShareableUrl } from '../../store/useOrbitStore';
import { LocationModal } from '../common/LocationModal';

export const Navbar = () => {
  const satellites = useOrbitStore((state) => state.satellites);
  const debris = useOrbitStore((state) => state.debris);
  const conjunctions = useOrbitStore((state) => state.conjunctions);
  const isLoading = useOrbitStore((state) => state.isLoading);
  const triggerRefreshTLE = useOrbitStore((state) => state.triggerRefreshTLE);
  const toggleHud = useOrbitStore((state) => state.toggleHud);
  const isHudVisible = useOrbitStore((state) => state.isHudVisible);
  const observerLocation = useOrbitStore((state) => state.observerLocation);
  const detectUserLocation = useOrbitStore((state) => state.detectUserLocation);
  const simulatedTimeMs = useOrbitStore((state) => state.simulatedTimeMs);
  const simulationSpeed = useOrbitStore((state) => state.simulationSpeed);
  const toggleHelp = useOrbitStore((state) => state.toggleHelp);
  const toggleSettings = useOrbitStore((state) => state.toggleSettings);
  const toggleTrainer = useOrbitStore((state) => state.toggleTrainer);
  const settings = useOrbitStore((state) => state.settings);

  const [utcTime, setUtcTime] = useState('');
  const [localTime, setLocalTime] = useState('');
  const [timeZoneLabel, setTimeZoneLabel] = useState('LOC');
  const [copiedLink, setCopiedLink] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);

  const handleCopyLink = () => {
    const url = getShareableUrl();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      });
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

  const criticalConjunctions = conjunctions.filter((c) => c.risk_level === 'CRITICAL').length;

  return (
    <header className="sticky top-0 z-50 w-full glass-panel border-b border-cyan-500/20 px-3 md:px-5 py-2.5 shadow-xl select-none">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
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
                  v4.2
                </span>
              </div>
              <p className="text-[10px] font-mono text-slate-400 hidden sm:block">
                Real-Time Satellite Orbit Tracker & Debris Risk
              </p>
            </div>
          </NavLink>
        </div>

        {/* Live Telemetry Ticker */}
        <div className="hidden lg:flex items-center gap-4 text-xs font-mono px-3 py-1.5 rounded-lg bg-space-950/70 border border-slate-800">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-400">Active Spacecraft:</span>
            <span className="font-bold text-emerald-400">{satellites.length || 20}</span>
          </div>

          <div className="w-px h-3.5 bg-slate-800" />

          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-slate-400">Tracked Debris:</span>
            <span className="font-bold text-amber-400">{debris.length || 12}</span>
          </div>

          <div className="w-px h-3.5 bg-slate-800" />

          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            <span className="text-slate-400">Conjunctions:</span>
            <span className="font-bold text-rose-400">{criticalConjunctions} Critical</span>
          </div>
        </div>

        {/* Navigation Routes */}
        <nav className="flex items-center gap-1 md:gap-2">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold font-mono transition ${
                isActive
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-glow-cyan'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
              }`
            }
          >
            <Globe className="w-4 h-4 text-cyan-400" />
            <span className="hidden md:inline">3D Globe</span>
          </NavLink>

          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold font-mono transition ${
                isActive
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-glow-cyan'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
              }`
            }
          >
            <BarChart3 className="w-4 h-4 text-emerald-400" />
            <span className="hidden md:inline">Analytics & Risk</span>
          </NavLink>

          <NavLink
            to="/conjunctions"
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold font-mono transition relative ${
                isActive
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-glow-rose'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
              }`
            }
          >
            <AlertOctagon className="w-4 h-4 text-rose-400" />
            <span className="hidden md:inline">Conjunctions</span>
            {criticalConjunctions > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-500 absolute -top-0.5 -right-0.5 animate-pulse" />
            )}
          </NavLink>

          <NavLink
            to="/rf"
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold font-mono transition ${
                isActive
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-glow-cyan'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
              }`
            }
          >
            <Radio className="w-4 h-4 text-cyan-400" />
            <span className="hidden md:inline">RF Ground Station</span>
          </NavLink>
        </nav>

        {/* Dual Live Clocks & Observer Location Sync */}
        <div className="flex items-center gap-3">
          {/* Ground Station / Observer Location */}
          <button
            onClick={() => setIsLocationModalOpen(true)}
            title="Click to select Ground Station preset or enter custom coordinates"
            className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-space-950/80 border border-slate-700 hover:border-cyan-400 text-[11px] font-mono text-slate-300 hover:text-cyan-300 transition shrink-0"
          >
            <MapPin className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span className="truncate max-w-[130px] font-medium">{observerLocation?.name || 'Observer Station'}</span>
          </button>

          {/* Clock */}
          <div className="hidden sm:flex flex-col items-end justify-center shrink-0 whitespace-nowrap text-right font-mono px-2 py-0.5 rounded-lg bg-space-950/60 border border-slate-800">
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
                {simulationSpeed > 1 ? `${simulationSpeed}x` : 'LIVE'}
              </span>
            </div>
            <div className="text-[10px] text-slate-400 tracking-wider leading-tight mt-0.5">
              {settings?.timeFormat === 'utc_primary' ? `${localTime} ${timeZoneLabel}` : utcTime}
            </div>
          </div>

          {/* Copy Shareable State Link */}
          <button
            onClick={handleCopyLink}
            title={copiedLink ? 'Deep-Link Copied to Clipboard!' : 'Share State: Copy Deep-Link URL to Clipboard'}
            className={`p-2 rounded-lg border transition shadow-sm ${
              copiedLink
                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-glow-emerald'
                : 'bg-space-900 border-slate-700 hover:border-cyan-400 text-slate-300 hover:text-cyan-300'
            }`}
          >
            {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
          </button>

          {/* ISRO & HAL Interview Trainer */}
          <button
            onClick={toggleTrainer}
            title="Launch ISRO & HAL Technical Interview Simulator (I)"
            className="p-2 rounded-lg bg-space-900 border border-slate-700 hover:border-amber-400 text-amber-300 hover:text-amber-100 transition shadow-sm relative group"
          >
            <GraduationCap className="w-4 h-4" />
            <span className="hidden lg:group-hover:block absolute top-full mt-2 right-0 z-50 bg-space-950 border border-amber-500/40 text-[10px] text-amber-300 font-mono px-2 py-0.5 rounded whitespace-nowrap shadow-2xl">
              ISRO / HAL Simulator (I)
            </span>
          </button>

          {/* Performance HUD Toggle */}
          <button
            onClick={toggleHud}
            title="Toggle Performance & Astrodynamic HUD (~)"
            className={`p-2 rounded-lg border transition shadow-sm ${
              isHudVisible
                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-glow-emerald'
                : 'bg-space-900 border-slate-700 hover:border-emerald-400 text-slate-300 hover:text-emerald-300'
            }`}
          >
            <Activity className="w-4 h-4" />
          </button>

          {/* System Settings Drawer */}
          <button
            onClick={toggleSettings}
            title="Open System Settings & Units"
            className="p-2 rounded-lg bg-space-900 border border-slate-700 hover:border-cyan-400 text-slate-300 hover:text-cyan-300 transition shadow-sm"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Space Agency Auto-Sync IRT (1s) Button */}
          <button
            onClick={triggerRefreshTLE}
            disabled={isLoading}
            title="Auto-Syncing Space Agencies IRT every second (CelesTrak / US Space Command / ISRO). Click to force immediate refresh."
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-500/50 hover:border-emerald-400 text-emerald-300 hover:text-emerald-100 transition shadow-sm text-xs font-mono font-semibold shrink-0"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-300' : 'text-emerald-400'}`} />
            <span className="hidden xl:inline">Sync Space Agencies (IRT)</span>
          </button>

          {/* Reference & Help Modal Toggle */}
          <button
            onClick={toggleHelp}
            title="Open Documentation & Keyboard Shortcuts (?)"
            className="p-2 rounded-lg bg-space-900 border border-slate-700 hover:border-cyan-400 text-slate-300 hover:text-cyan-300 transition shadow-sm"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </div>
      <LocationModal isOpen={isLocationModalOpen} onClose={() => setIsLocationModalOpen(false)} />
    </header>
  );
};

export default Navbar;
