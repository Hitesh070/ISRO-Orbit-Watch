/**
 * OrbitGuard Antenna Rotator Control Panel (Phase 5)
 * ===================================================
 * Interactive ground station antenna tracking dashboard supporting:
 * - Virtual Simulator, Web Serial API, and Local Bridge transports
 * - Dual-axis Commanded vs Actual position dials (Azimuth & Elevation)
 * - Autonomous pass tracking loop, Zenith keyhole management, and E-Stop
 * - Real-time GS-232 / rotctld protocol command terminal log
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  SimulatorTransport,
  WebSerialTransport,
  LocalBridgeTransport,
  NativeSerialTransport,
  TcpTransport,
  RotatorTransport,
  RotatorStatus,
  CommandLogEntry,
  TransportType,
} from '../../lib/tracking/rotatorTransport';
import {
  TrackingController,
  TrackingState,
  DEFAULT_TRACKING_CONFIG,
} from '../../lib/tracking/trackingLogic';
import { DetailedPass } from '../../lib/rf/passPlanner';
import { platform } from '../../platform';
import { SerialPortInfo } from '../../shared/ipc';
import {
  Radio,
  Sliders,
  Play,
  Square,
  AlertOctagon,
  Terminal,
  Activity,
  Compass,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Zap,
  Cpu,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';

interface RotatorPanelProps {
  pass: DetailedPass | null;
}

export const RotatorPanel: React.FC<RotatorPanelProps> = ({ pass }) => {
  const isDesktop = platform.isDesktop;
  const [selectedTransportType, setSelectedTransportType] = useState<TransportType>(
    isDesktop ? 'NATIVE_SERIAL' : 'SIMULATOR'
  );

  // Available COM ports on Windows
  const [availablePorts, setAvailablePorts] = useState<SerialPortInfo[]>([]);
  const [selectedPort, setSelectedPort] = useState<string>('');
  const [selectedBaud, setSelectedBaud] = useState<number>(9600);
  const [motionConfirmed, setMotionConfirmed] = useState<boolean>(false);
  const [showMotionConfirmDialog, setShowMotionConfirmDialog] = useState<boolean>(false);

  // Transports
  const simTransport = useMemo(() => new SimulatorTransport(), []);
  const webSerialTransport = useMemo(() => new WebSerialTransport(), []);
  const bridgeTransport = useMemo(() => new LocalBridgeTransport(), []);
  const nativeSerialTransport = useMemo(() => new NativeSerialTransport(), []);
  const tcpTransport = useMemo(() => new TcpTransport(), []);

  const activeTransport: RotatorTransport = useMemo(() => {
    if (selectedTransportType === 'NATIVE_SERIAL') return nativeSerialTransport;
    if (selectedTransportType === 'TCP_ROTCTLD') return tcpTransport;
    if (selectedTransportType === 'WEB_SERIAL') return webSerialTransport;
    if (selectedTransportType === 'LOCAL_BRIDGE') return bridgeTransport;
    return simTransport;
  }, [
    selectedTransportType,
    nativeSerialTransport,
    tcpTransport,
    webSerialTransport,
    bridgeTransport,
    simTransport,
  ]);

  // Load available COM ports on desktop
  const refreshPorts = async () => {
    if (isDesktop) {
      const ports = await platform.serial.listPorts();
      setAvailablePorts(ports);
      if (ports.length > 0 && !selectedPort) {
        setSelectedPort(ports[0].path);
      }
    }
  };

  useEffect(() => {
    refreshPorts();
  }, [isDesktop]);

  // Controller
  const controller = useMemo(() => new TrackingController(activeTransport), [activeTransport]);

  const [rotStatus, setRotStatus] = useState<RotatorStatus>(activeTransport.getStatus());
  const [trackingState, setTrackingState] = useState<TrackingState>('IDLE');
  const [logs, setLogs] = useState<CommandLogEntry[]>([]);
  const [isDryRun, setIsDryRun] = useState(false);
  const [isAutoTracking, setIsAutoTracking] = useState(false);

  const logContainerRef = useRef<HTMLDivElement>(null);

  // Subscribe to transport status and logs
  useEffect(() => {
    const unsubStatus = activeTransport.onStatusUpdate((s) => setRotStatus(s));
    const unsubLog = activeTransport.onCommandLog((entry) => {
      setLogs((prev) => [...prev.slice(-49), entry]);
    });

    controller.onStateChange((state) => {
      setTrackingState(state);
    });

    return () => {
      unsubStatus();
      unsubLog();
    };
  }, [activeTransport, controller]);

  // Pass updates to controller
  useEffect(() => {
    controller.setPass(pass);
  }, [pass, controller]);

  // Auto-scroll logs terminal
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const handleConnect = async () => {
    if (rotStatus.connected) {
      await activeTransport.disconnect();
      setIsAutoTracking(false);
      controller.stop();
    } else {
      if (selectedTransportType === 'NATIVE_SERIAL') {
        if (!selectedPort && availablePorts.length > 0) {
          setSelectedPort(availablePorts[0].path);
        }
        await activeTransport.connect({
          path: selectedPort || (availablePorts[0]?.path || 'COM3'),
          baudRate: selectedBaud,
        });
      } else {
        await activeTransport.connect();
      }
    }
  };

  const handleTestConnection = async () => {
    if (!rotStatus.connected) return;
    if (selectedTransportType === 'NATIVE_SERIAL') {
      await platform.serial.write('C2\r');
    } else if (selectedTransportType === 'TCP_ROTCTLD') {
      await platform.rotctld.sendCommand('p');
    }
  };

  const handleToggleAutoTrack = () => {
    if (isAutoTracking) {
      setIsAutoTracking(false);
      controller.stop();
    } else {
      setIsAutoTracking(true);
      controller.setDryRun(isDryRun);
      controller.start();
    }
  };

  const handleEmergencyStop = () => {
    setIsAutoTracking(false);
    controller.emergencyStop();
  };

  const handleManualNudge = (dAz: number, dEl: number) => {
    const newAz = (rotStatus.actualAz + dAz + 360) % 360;
    const newEl = Math.max(0, Math.min(90, rotStatus.actualEl + dEl));
    activeTransport.setTarget(newAz, newEl);
  };

  return (
    <div className="glass-panel p-4 md:p-5 rounded-2xl border border-slate-800 flex flex-col gap-4 font-mono text-xs">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <h2 className="text-sm md:text-base font-bold text-cyan-400 flex items-center gap-2">
            <Radio className="w-5 h-5 text-cyan-400" />
            Antenna Rotator Pan-Tilt Controller (Phase 5)
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Drive real (Web Serial / rotctld bridge) or simulated dual-axis steerable dish/Yagi arrays.
          </p>
        </div>

        {/* Transport Selector & Connect Button */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedTransportType}
            onChange={(e) => {
              if (rotStatus.connected) activeTransport.disconnect();
              setSelectedTransportType(e.target.value as TransportType);
            }}
            className="px-2.5 py-1.5 rounded-lg bg-space-950 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-cyan-400 font-bold"
          >
            <option value="SIMULATOR">Virtual Simulator (GS-232 Emulation)</option>
            {isDesktop && <option value="NATIVE_SERIAL">Windows COM Port (Native SerialPort)</option>}
            {isDesktop && <option value="TCP_ROTCTLD">Hamlib rotctld TCP (127.0.0.1:4533)</option>}
            <option value="WEB_SERIAL">Web Serial API (USB CDC Direct)</option>
            <option value="LOCAL_BRIDGE">Local Bridge (ws://127.0.0.1:8765)</option>
          </select>

          <button
            onClick={handleConnect}
            className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
              rotStatus.connected
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${rotStatus.connected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
            {rotStatus.connected ? 'Disconnect' : 'Connect'}
          </button>
        </div>
      </div>

      {/* Desktop Native Serial Hardware Configuration Bar */}
      {selectedTransportType === 'NATIVE_SERIAL' && (
        <div className="p-3 rounded-xl bg-space-950 border border-cyan-500/30 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-400 flex items-center gap-1 text-[11px]">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" /> COM Port:
            </span>
            <select
              value={selectedPort}
              onChange={(e) => setSelectedPort(e.target.value)}
              disabled={rotStatus.connected}
              className="px-2.5 py-1 rounded bg-space-900 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-cyan-400 font-mono"
            >
              {availablePorts.length > 0 ? (
                availablePorts.map((p) => (
                  <option key={p.path} value={p.path}>
                    {p.friendlyName}
                  </option>
                ))
              ) : (
                <option value="COM3">COM3 (Default)</option>
              )}
            </select>

            <button
              onClick={refreshPorts}
              title="Rescan Windows Device Manager for connected USB-Serial COM ports"
              className="p-1.5 rounded bg-space-900 border border-slate-700 hover:border-cyan-400 text-slate-400 hover:text-white transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            <span className="text-slate-400 text-[11px] ml-2">Baud Rate:</span>
            <select
              value={selectedBaud}
              onChange={(e) => setSelectedBaud(Number(e.target.value))}
              disabled={rotStatus.connected}
              className="px-2 py-1 rounded bg-space-900 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-cyan-400 font-mono"
            >
              {[9600, 19200, 38400, 57600, 115200].map((b) => (
                <option key={b} value={b}>
                  {b} 8N1
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            {rotStatus.connected && (
              <>
                <button
                  onClick={handleTestConnection}
                  className="px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30 text-[11px] font-bold transition flex items-center gap-1"
                  title="Send harmless GS-232 C2 query to verify controller response"
                >
                  <Zap className="w-3 h-3 text-cyan-400" /> Test Link (C2)
                </button>

                <button
                  onClick={() => activeTransport.home?.()}
                  className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 text-[11px] font-bold transition flex items-center gap-1"
                  title="Drive antenna rotator toward physical home limit switches"
                >
                  <Compass className="w-3 h-3 text-amber-400" /> Home (H)
                </button>

                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    rotStatus.isHomed
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : rotStatus.homingState === 'HOMING'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  }`}
                >
                  {rotStatus.isHomed
                    ? 'HOMED (READY)'
                    : rotStatus.homingState === 'HOMING'
                    ? 'HOMING...'
                    : 'NOT HOMED'}
                </span>
              </>
            )}
            <span className="text-[10px] text-slate-500 font-sans hidden lg:inline">
              * Supports FTDI, CH340, CP210x, and ESP32 drivers.
            </span>
          </div>
        </div>
      )}

      {rotStatus.error && (
        <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300 text-[11px] flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{rotStatus.error}</span>
        </div>
      )}

      {/* Main Dual Gauges Viewport */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Azimuth & Elevation Gauges (Left 7 Cols) */}
        <div className="md:col-span-7 grid grid-cols-2 gap-3 p-3 rounded-xl bg-space-950/80 border border-slate-800">
          {/* Azimuth Gauge */}
          <div className="flex flex-col items-center justify-center p-3 rounded-lg bg-space-900/60 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
              <Compass className="w-3.5 h-3.5 text-cyan-400" /> Azimuth (0° - 360°)
            </span>
            <div className="text-2xl font-bold text-cyan-300 mt-2">
              {rotStatus.actualAz.toFixed(1)}°
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Target: <strong className="text-slate-200">{rotStatus.commandedAz.toFixed(1)}°</strong>
            </div>

            {/* Circular Azimuth Visualizer Dial */}
            <div className="relative w-24 h-24 my-2">
              <svg width="96" height="96" className="overflow-visible">
                <circle cx="48" cy="48" r="42" fill="none" stroke="#1e293b" strokeWidth="3" />
                {/* Target needle (dotted) */}
                <line
                  x1="48"
                  y1="48"
                  x2={48 + 38 * Math.cos(((rotStatus.commandedAz - 90) * Math.PI) / 180)}
                  y2={48 + 38 * Math.sin(((rotStatus.commandedAz - 90) * Math.PI) / 180)}
                  stroke="#64748b"
                  strokeWidth="2"
                  strokeDasharray="2 2"
                />
                {/* Actual needle (solid cyan) */}
                <line
                  x1="48"
                  y1="48"
                  x2={48 + 38 * Math.cos(((rotStatus.actualAz - 90) * Math.PI) / 180)}
                  y2={48 + 38 * Math.sin(((rotStatus.actualAz - 90) * Math.PI) / 180)}
                  stroke="#22d3ee"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <circle cx="48" cy="48" r="4" fill="#06b6d4" />
              </svg>
            </div>

            {/* Quick Nudge Buttons */}
            <div className="flex items-center gap-1 mt-1">
              <button
                onClick={() => handleManualNudge(-5, 0)}
                className="px-2 py-0.5 rounded bg-space-950 border border-slate-700 hover:border-cyan-400 text-slate-300 text-[10px]"
              >
                -5°
              </button>
              <button
                onClick={() => handleManualNudge(+5, 0)}
                className="px-2 py-0.5 rounded bg-space-950 border border-slate-700 hover:border-cyan-400 text-slate-300 text-[10px]"
              >
                +5°
              </button>
            </div>
          </div>

          {/* Elevation Gauge */}
          <div className="flex flex-col items-center justify-center p-3 rounded-lg bg-space-900/60 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-emerald-400" /> Elevation (0° - 90°)
            </span>
            <div className="text-2xl font-bold text-emerald-300 mt-2">
              {rotStatus.actualEl.toFixed(1)}°
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Target: <strong className="text-slate-200">{rotStatus.commandedEl.toFixed(1)}°</strong>
            </div>

            {/* Semi-Circle Elevation Arc Dial */}
            <div className="relative w-24 h-24 my-2 flex items-center justify-center">
              <svg width="96" height="96" className="overflow-visible">
                {/* 0-90 Arc */}
                <path
                  d="M 12 80 A 36 36 0 0 1 84 80"
                  fill="none"
                  stroke="#1e293b"
                  strokeWidth="3"
                />
                {/* Elevation needle */}
                <line
                  x1="48"
                  y1="80"
                  x2={48 + 36 * Math.cos(((180 - rotStatus.actualEl) * Math.PI) / 180)}
                  y2={80 - 36 * Math.sin((rotStatus.actualEl * Math.PI) / 180)}
                  stroke="#10b981"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <circle cx="48" cy="80" r="4" fill="#10b981" />
              </svg>
            </div>

            {/* Quick Nudge Buttons */}
            <div className="flex items-center gap-1 mt-1">
              <button
                onClick={() => handleManualNudge(0, -5)}
                className="px-2 py-0.5 rounded bg-space-950 border border-slate-700 hover:border-emerald-400 text-slate-300 text-[10px]"
              >
                -5°
              </button>
              <button
                onClick={() => handleManualNudge(0, +5)}
                className="px-2 py-0.5 rounded bg-space-950 border border-slate-700 hover:border-emerald-400 text-slate-300 text-[10px]"
              >
                +5°
              </button>
            </div>
          </div>
        </div>

        {/* Tracking Supervision & Controls (Right 5 Cols) */}
        <div className="md:col-span-5 flex flex-col justify-between gap-3 p-3.5 rounded-xl bg-space-950/80 border border-slate-800">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-slate-400">Supervisor State:</span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                  trackingState === 'TRACKING'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : trackingState === 'ZENITH_HOLD'
                    ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                    : trackingState === 'EMERGENCY_STOP'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-glow-rose'
                    : 'bg-space-900 text-slate-400 border-slate-700'
                }`}
              >
                {trackingState}
              </span>
            </div>

            <div className="space-y-2 mt-3 text-[11px]">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Instant Pointing Error:</span>
                <span className={`font-bold ${rotStatus.pointingErrorDeg < 2.0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {rotStatus.pointingErrorDeg}°
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Active Satellite Pass:</span>
                <span className="text-cyan-300 font-bold truncate max-w-[140px]">
                  {pass ? pass.satName : 'No pass selected'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Motor Motion:</span>
                <span className={rotStatus.isMoving ? 'text-cyan-400 animate-pulse' : 'text-slate-500'}>
                  {rotStatus.isMoving ? 'SLEWING AXES...' : 'STATIONARY'}
                </span>
              </div>
            </div>
          </div>

          {/* Action Button Row */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <div className="flex items-center gap-2">
              <button
                onClick={handleToggleAutoTrack}
                disabled={!pass || (!rotStatus.connected && !isDryRun)}
                className={`flex-1 py-2 rounded-xl font-bold flex items-center justify-center gap-2 transition shadow-md disabled:opacity-40 ${
                  isAutoTracking
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-cyan-500 text-space-950 font-bold shadow-glow-cyan'
                }`}
              >
                {isAutoTracking ? (
                  <>
                    <Square className="w-4 h-4" /> Stop Autonomous Tracking
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" /> Start Autonomous Tracking
                  </>
                )}
              </button>

              <button
                onClick={handleEmergencyStop}
                title="Immediate Mechanical Emergency Stop (E-Stop)"
                className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-1 shadow-glow-rose transition"
              >
                <AlertOctagon className="w-4 h-4" /> E-STOP
              </button>
            </div>

            {/* Dry-run safety toggle */}
            <label className="flex items-center gap-2 cursor-pointer text-[10px] text-slate-400 select-none">
              <input
                type="checkbox"
                checked={isDryRun}
                onChange={(e) => setIsDryRun(e.target.checked)}
                className="rounded accent-cyan-400"
              />
              <span>Dry-run simulation mode (logs commands without commanding real motion)</span>
            </label>
          </div>
        </div>
      </div>

      {/* Protocol Terminal Log (Last 50 Packets) */}
      <div className="rounded-xl bg-space-950/95 border border-slate-800 p-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-[10px] text-slate-400">
          <span className="flex items-center gap-1.5 font-bold text-slate-300">
            <Terminal className="w-3.5 h-3.5 text-cyan-400" /> Live GS-232 / rotctld Protocol Terminal
          </span>
          <button
            onClick={() => setLogs([])}
            className="hover:text-cyan-300 transition text-[9px]"
          >
            Clear Log
          </button>
        </div>

        <div
          ref={logContainerRef}
          className="h-28 overflow-y-auto mt-2 font-mono text-[10px] space-y-1 pr-1 text-slate-300"
        >
          {logs.length === 0 ? (
            <div className="text-slate-600 italic">No commands logged yet. Connect to begin transaction logging.</div>
          ) : (
            logs.map((log, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-slate-600">{log.time}</span>
                <span
                  className={`font-bold px-1 rounded text-[9px] ${
                    log.direction === 'TX'
                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                      : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  }`}
                >
                  {log.direction}
                </span>
                <span className={log.direction === 'TX' ? 'text-cyan-200' : 'text-slate-200'}>
                  {log.command}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default RotatorPanel;
