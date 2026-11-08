/**
 * OrbitGuard Startup Calibration & Ingestion Modal
 * ===================================================
 * Displays startup status, catalog availability, observer inputs, and SGP4 data provenance.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Satellite,
  Clock,
  MapPin,
  Activity,
  CheckCircle2,
  Radio,
  ArrowRight,
  Terminal,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import * as satellite from 'satellite.js';
import { useOrbitStore } from '../../store/useOrbitStore';

interface StartupCalibrationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StartupCalibrationModal: React.FC<StartupCalibrationModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [progress, setProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [clockData, setClockData] = useState<{ utc: string; local: string; gmst: string; date: string }>({
    utc: '',
    local: '',
    gmst: '',
    date: '',
  });

  const observerLocation = useOrbitStore((state) => state.observerLocation);
  const catalog = useOrbitStore((state) => state.catalog);
  const satellites = useOrbitStore((state) => state.satellites);
  const debris = useOrbitStore((state) => state.debris);
  const fetchInitialData = useOrbitStore((state) => state.fetchInitialData);
  const metadata = useOrbitStore((state) => state.metadata);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const sequenceRunningRef = useRef(false);

  // Auto-scroll terminal log
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Main calibration sequence orchestrator - runs ONCE per modal opening
  useEffect(() => {
    if (!isOpen) {
      sequenceRunningRef.current = false;
      setProgress(0);
      setCurrentStage(0);
      setLogs([]);
      return;
    }

    if (sequenceRunningRef.current) return;
    sequenceRunningRef.current = true;

    let isCancelled = false;

    const addLog = (msg: string) => {
      if (isCancelled) return;
      const now = new Date();
      const timeStr = now.toISOString().slice(11, 19);
      setLogs((prev) => [...prev, `[${timeStr}] ${msg}`]);
    };

    const runCalibrationSequence = async () => {
      // Stage 0: Initial boot
      addLog('INIT: OrbitGuard interface starting...');
      addLog('STATUS: Orbital positions are predictions from catalog elements; no sensor telemetry is connected.');
      setProgress(15);
      await new Promise((r) => setTimeout(r, 350));
      if (isCancelled) return;

      // Stage 1: Time, Date & GMST Ephemeris
      setCurrentStage(1);
      const now = new Date();
      const gmstRad = satellite.gstime(now);
      const gmstHours = ((gmstRad * 12) / Math.PI + 24) % 24;
      const hours = Math.floor(gmstHours);
      const mins = Math.floor((gmstHours - hours) * 60);
      const secs = Math.floor(((gmstHours - hours) * 60 - mins) * 60);
      const gmstFormatted = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}h`;

      setClockData({
        utc: now.toISOString().slice(11, 19) + ' UTC',
        local: now.toLocaleTimeString(),
        gmst: gmstFormatted,
        date: now.toISOString().slice(0, 10),
      });

      addLog(`CLOCK: System time is ${now.toISOString().slice(0, 19)} UTC.`);
      addLog(`TIME: Computed Greenwich Mean Sidereal Time (GMST = ${gmstFormatted}).`);
      setProgress(35);
      await new Promise((r) => setTimeout(r, 350));
      if (isCancelled) return;

      // Stage 2: Observer Ground Station Geolocation
      setCurrentStage(2);
      addLog('OBSERVER: Checking for a user supplied site and mean sea level altitude...');
      await new Promise((r) => setTimeout(r, 350));
      if (isCancelled) return;

      const storeState = useOrbitStore.getState();
      const loc = storeState.observerLocation || observerLocation;
      addLog(loc && Number.isFinite(loc.lat) && Number.isFinite(loc.lon) && Number.isFinite(loc.alt_m)
        ? `OBSERVER: ${loc.name || 'User site'} (${loc.lat}°, ${loc.lon}°, ${loc.alt_m} m MSL).`
        : 'OBSERVER: No complete site selected. Pass predictions require latitude, longitude, and altitude above mean sea level.');
      setProgress(60);
      await new Promise((r) => setTimeout(r, 350));
      if (isCancelled) return;

      // Stage 3: Load catalog data and show its actual source metadata.
      setCurrentStage(3);
      addLog('CATALOG: Checking for available catalog records...');

      let currentState = useOrbitStore.getState();
      if (!currentState.catalog || currentState.catalog.length === 0) {
        await fetchInitialData().catch(() => {});
        currentState = useOrbitStore.getState();
      } else {
        await new Promise((r) => setTimeout(r, 300));
      }
      if (isCancelled) return;

      const totalCount = currentState.catalog?.length ?? 0;
      const isroCount = (currentState.satellites || []).filter((s: any) => s.is_isro).length;
      const debrisCount = currentState.debris?.length ?? 0;

      addLog(`CATALOG: ${totalCount.toLocaleString()} records currently loaded; source freshness is shown in the catalog status banner.`);
      addLog(`CATALOG: ${isroCount} records tagged ISRO | ${debrisCount.toLocaleString()} records classified as debris or rocket body.`);
      setProgress(85);
      await new Promise((r) => setTimeout(r, 350));
      if (isCancelled) return;

      // Stage 4: Report the prediction source accurately.
      setCurrentStage(4);
      addLog('PROPAGATION: Positions are SGP4 predictions from catalog elements at the selected time.');
      addLog('SCREENING: Collision probability is unavailable when object covariance is not supplied.');
      setProgress(98);
      await new Promise((r) => setTimeout(r, 350));
      if (isCancelled) return;

      // Stage 5: Nominal Ready State
      setCurrentStage(5);
      setProgress(100);
      addLog('READY: Startup sequence complete. Catalog freshness and screening coverage appear in the status banner.');

      // Auto-launch after 600ms
      setTimeout(() => {
        if (!isCancelled) {
          onCloseRef.current();
        }
      }, 600);
    };

    runCalibrationSequence();

    return () => {
      isCancelled = true;
    };
  }, [isOpen]);

  const handleDismiss = () => {
    sequenceRunningRef.current = false;
    onCloseRef.current();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-space-950/90 backdrop-blur-xl select-none animate-in fade-in duration-300">
      <div className="relative w-full max-w-3xl glass-panel border border-cyan-500/40 rounded-2xl shadow-2xl p-5 md:p-7 flex flex-col gap-5 text-slate-100 overflow-hidden bg-space-950/95">
        {/* Glowing backdrop accents */}
        <div className="absolute -top-32 -left-32 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-cyan-500/20 pb-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 p-0.5 shadow-glow-cyan flex items-center justify-center">
              <div className="w-full h-full bg-space-950 rounded-[10px] flex items-center justify-center">
                <Satellite className="w-6 h-6 text-cyan-400 animate-pulse" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg md:text-xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-300 via-sky-200 to-emerald-300 bg-clip-text text-transparent">
                  OrbitGuard System Calibration
                </h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  v5.0
                </span>
              </div>
              <p className="text-xs font-mono text-slate-400 mt-0.5">
                System time, catalog availability, and observer input status
              </p>
            </div>
          </div>

          <button
            onClick={handleDismiss}
            className="text-xs font-mono text-slate-400 hover:text-cyan-300 transition px-3 py-1.5 rounded-lg border border-slate-700 hover:border-cyan-500/40 bg-space-900/60"
          >
            Skip Calibration →
          </button>
        </div>

        {/* Dynamic Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-cyan-300 flex items-center gap-2 font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
              {progress < 35
                ? 'Step 1/4: Reading system UTC and computing GMST...'
                : progress < 60
                ? 'Step 2/4: Checking observer site inputs...'
                : progress < 85
                ? 'Step 3/4: Checking loaded catalog records...'
                : progress < 100
                ? 'Step 4/4: Checking catalog-based SGP4 prediction status...'
                : 'Startup sequence complete.'}
            </span>
            <span className="text-emerald-400 font-bold">{progress}%</span>
          </div>

          <div className="w-full h-2 rounded-full bg-space-900 border border-slate-800 overflow-hidden relative">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 via-sky-400 to-emerald-400 transition-all duration-300 rounded-full shadow-glow-cyan"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Startup status cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
          {/* Card 1: Time & Date */}
          <div className={`p-3 rounded-xl border transition-all ${
            currentStage >= 1
              ? 'bg-space-900/90 border-cyan-500/40 shadow-glow-cyan'
              : 'bg-space-900/40 border-slate-800 opacity-60'
          }`}>
            <div className="flex items-center justify-between text-slate-400 text-[10px] font-mono">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-cyan-400" /> Mission Clock
              </span>
              {currentStage >= 1 && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
            </div>
            <div className="mt-1 font-mono">
              <div className="text-xs font-bold text-slate-100">{clockData.utc || 'Syncing...'}</div>
              <div className="text-[10px] text-cyan-300">GMST: {clockData.gmst || 'Calculating...'}</div>
              <div className="text-[9px] text-slate-400">{clockData.date || 'Epoch Sync'}</div>
            </div>
          </div>

          {/* Card 2: Ground Station Geolocation */}
          <div className={`p-3 rounded-xl border transition-all ${
            currentStage >= 2
              ? 'bg-space-900/90 border-emerald-500/40 shadow-glow-emerald'
              : 'bg-space-900/40 border-slate-800 opacity-60'
          }`}>
            <div className="flex items-center justify-between text-slate-400 text-[10px] font-mono">
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-400" /> Ground Station
              </span>
              {currentStage >= 2 && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
            </div>
            <div className="mt-1 font-mono">
              <div className="text-xs font-bold text-emerald-300 truncate max-w-[150px]">
                {observerLocation?.name?.split('(')[0] || 'No site selected'}
              </div>
              <div className="text-[10px] text-slate-300">
                {Number.isFinite(observerLocation?.lat) && Number.isFinite(observerLocation?.lon) ? `${observerLocation.lat}°, ${observerLocation.lon}°` : 'Coordinates unavailable'}
              </div>
              <div className="text-[9px] text-slate-400">Altitude MSL: {Number.isFinite(observerLocation?.alt_m) ? `${observerLocation.alt_m} m` : 'not provided'}</div>
            </div>
          </div>

          {/* Card 3: Space Agencies */}
          <div className={`p-3 rounded-xl border transition-all ${
            currentStage >= 3
              ? 'bg-space-900/90 border-amber-500/40'
              : 'bg-space-900/40 border-slate-800 opacity-60'
          }`}>
            <div className="flex items-center justify-between text-slate-400 text-[10px] font-mono">
              <span className="flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-amber-400" /> Loaded Catalog
              </span>
              {currentStage >= 3 && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
            </div>
            <div className="mt-1 font-mono">
              <div className="text-xs font-bold text-amber-300">
                {catalog.length > 0 ? `${catalog.length.toLocaleString()} records` : 'Unavailable'}
              </div>
              <div className="text-[10px] text-slate-300">
                {satellites.filter((s: any) => s.is_isro).length} ISRO Spacecraft
              </div>
              <div className="text-[9px] text-slate-400 truncate">{metadata?.source || 'Source unavailable'}</div>
            </div>
          </div>

          {/* Card 4: Astrodynamics & GPU Engine */}
          <div className={`p-3 rounded-xl border transition-all ${
            currentStage >= 4
              ? 'bg-space-900/90 border-sky-500/40'
              : 'bg-space-900/40 border-slate-800 opacity-60'
          }`}>
            <div className="flex items-center justify-between text-slate-400 text-[10px] font-mono">
              <span className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-sky-400" /> Orbit Prediction
              </span>
              {currentStage >= 4 && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
            </div>
            <div className="mt-1 font-mono">
              <div className="text-xs font-bold text-sky-300">
                {currentStage >= 4 ? 'SGP4 element propagation' : 'Waiting for startup status'}
              </div>
              <div className="text-[10px] text-slate-300">Element-set based positions</div>
              <div className="text-[9px] text-slate-400">Not live sensor telemetry</div>
            </div>
          </div>
        </div>

        {/* Live Mission Diagnostic Terminal */}
        <div className="p-3.5 rounded-xl bg-space-950 border border-slate-800 font-mono text-[11px] h-40 overflow-y-auto no-scrollbar space-y-1">
          <div className="text-slate-500 flex items-center gap-1.5 pb-1 border-b border-slate-900 text-[10px]">
            <Terminal className="w-3 h-3 text-cyan-400" />
            <span>ORBITGUARD STARTUP STATUS</span>
          </div>

          {logs.map((log, index) => {
            const isReady = log.includes('READY:');
            const isInit = log.includes('INIT:');
            const isSync = log.includes('SYNC:');
            const isAgency = log.includes('AGENCY:');
            return (
              <div
                key={index}
                className={`leading-relaxed ${
                  isReady
                    ? 'text-emerald-400 font-bold'
                    : isSync
                    ? 'text-cyan-300'
                    : isAgency
                    ? 'text-amber-300'
                    : isInit
                    ? 'text-sky-300 font-semibold'
                    : 'text-slate-300'
                }`}
              >
                {log}
              </div>
            );
          })}
          <div ref={logsEndRef} />
        </div>

        {/* Launch Mission Control Footer */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <ShieldCheck className={`w-4 h-4 ${progress === 100 ? 'text-emerald-400' : 'text-cyan-400 animate-pulse'}`} />
            <span>
              {progress === 100
                ? 'Startup sequence complete • Review data status above'
                : `Starting OrbitGuard (${progress}%)`}
            </span>
          </div>

          <button
            onClick={handleDismiss}
            className={`px-5 py-2.5 rounded-xl font-mono text-xs font-bold transition flex items-center gap-2 shadow-lg ${
              progress === 100
                ? 'bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 shadow-glow-cyan hover:scale-[1.02]'
                : 'bg-space-900 border border-cyan-500/40 text-cyan-300 hover:bg-space-850'
            }`}
          >
            <span>{progress === 100 ? 'Enter Mission Control' : 'Launch Now'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default StartupCalibrationModal;
