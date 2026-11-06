/**
 * Navbar Component
 * OrbitGuard primary application banner featuring telemetry metrics ticker,
 * dual Local / UTC orbital clock, navigation routes, and TLE cache refresh trigger.
 * Enforced pure space dark theme.
 */

import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { Globe, BarChart3, AlertOctagon, RefreshCw, Satellite, Radio, Clock, Activity, MapPin, HelpCircle } from 'lucide-react';
import { useOrbitStore } from '../../store/useOrbitStore';

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

  const [utcTime, setUtcTime] = useState('');
  const [localTime, setLocalTime] = useState('');

  // Live Dual Clocks (Synchronized User Local Time + Simulated Spacecraft UTC Time)
  useEffect(() => {
    const updateTime = () => {
      const wallNow = new Date();
      const currentSimMs = useOrbitStore.getState().simulatedTimeMs || Date.now();
      const simNow = new Date(currentSimMs);

      // Simulated Mission UTC time
      setUtcTime(simNow.toUTCString().replace('GMT', 'UTC'));
      // Local time with user's timezone abbreviation
      setLocalTime(
        wallNow.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
          timeZoneName: 'short',
        })
      );
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
                  v4.1
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
            onClick={detectUserLocation}
            title="Click to re-sync Ground Station with browser GPS coordinates"
            className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-space-950/80 border border-slate-700 hover:border-emerald-400 text-[11px] font-mono text-slate-300 hover:text-emerald-300 transition"
          >
            <MapPin className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span className="truncate max-w-[140px]">{observerLocation?.name || 'Observer Station'}</span>
          </button>

          {/* Clock */}
          <div className="hidden sm:block text-right font-mono">
            <div className="text-xs text-cyan-300 font-bold flex items-center justify-end gap-1.5">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>{localTime || 'Local Time'}</span>
              <span className={`text-[9px] px-1 py-0.2 rounded font-mono ${
                simulationSpeed > 1 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-emerald-500/10 text-emerald-400'
              }`}>
                {simulationSpeed > 1 ? `${simulationSpeed}x WARP` : '1x LIVE'}
              </span>
            </div>
            <div className="text-[10px] text-slate-400">
              {utcTime ? utcTime.split(' ').slice(0, 5).join(' ') : 'UTC Space Time'}
            </div>
          </div>

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

          {/* Refresh TLE */}
          <button
            onClick={triggerRefreshTLE}
            disabled={isLoading}
            title="Refresh Real-Time TLE Data from Space Agencies"
            className="p-2 rounded-lg bg-space-900 border border-slate-700 hover:border-cyan-400 text-cyan-300 hover:text-cyan-100 transition shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
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
    </header>
  );
};

export default Navbar;
