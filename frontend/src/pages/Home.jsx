/**
 * Home Page
 * Primary 3D interactive viewport featuring the Earth globe, orbital paths,
 * filter drawer, satellite telemetry card, simulation controls, and 3D camera zoom/reset.
 */

import React, { useState, useEffect } from 'react';
import EarthGlobe from '../components/Globe/EarthGlobe';
import FilterPanel from '../components/Sidebar/FilterPanel';
import SatelliteInfo from '../components/Sidebar/SatelliteInfo';
import { useOrbitStore } from '../store/useOrbitStore';
import {
  SlidersHorizontal,
  Info,
  ZoomIn,
  ZoomOut,
  Compass,
  RotateCcw,
} from 'lucide-react';

export const Home = () => {
  const [showFilters, setShowFilters] = useState(true);
  const selectedSatellite = useOrbitStore((state) => state.selectedSatellite);
  const simulationSpeed = useOrbitStore((state) => state.simulationSpeed);
  const setSimulationSpeed = useOrbitStore((state) => state.setSimulationSpeed);
  const triggerCameraAction = useOrbitStore((state) => state.triggerCameraAction);

  // Keyboard shortcuts for quick zoom and camera positioning
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if typing inside input
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      if (e.key === '+' || e.key === '=') {
        triggerCameraAction('zoomIn');
      } else if (e.key === '-' || e.key === '_') {
        triggerCameraAction('zoomOut');
      } else if (e.key.toLowerCase() === 'r' || e.key === '0') {
        triggerCameraAction('reset');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [triggerCameraAction]);

  return (
    <div className="relative w-full h-[calc(100vh-60px)] overflow-hidden bg-space-950 select-none">
      {/* 3D Earth Globe Canvas Viewport */}
      <EarthGlobe />

      {/* Toggle Filter Panel Button (Mobile / Clean View) */}
      <button
        onClick={() => setShowFilters(!showFilters)}
        className="absolute top-4 left-4 z-20 p-2.5 rounded-xl glass-panel-glow text-cyan-400 hover:text-cyan-200 transition"
        title="Toggle Filters"
      >
        <SlidersHorizontal className="w-5 h-5" />
      </button>

      {/* Filter Sidebar */}
      {showFilters && <FilterPanel />}

      {/* Satellite Info Card (Displays when any satellite/debris is clicked) */}
      {selectedSatellite && <SatelliteInfo />}

      {/* Floating 3D Navigation Controls (Zoom In, Zoom Out, Center View) */}
      <div className="absolute bottom-5 right-5 z-20 flex flex-col gap-1.5 glass-panel p-1.5 rounded-xl shadow-2xl">
        <button
          onClick={() => triggerCameraAction('zoomIn')}
          title="Zoom In (+)"
          className="p-2 rounded-lg text-slate-300 hover:text-cyan-300 hover:bg-white/10 transition"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => triggerCameraAction('zoomOut')}
          title="Zoom Out (-)"
          className="p-2 rounded-lg text-slate-300 hover:text-cyan-300 hover:bg-white/10 transition"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={() => triggerCameraAction('reset')}
          title="Center View & Reset Zoom (R)"
          className="p-2 rounded-lg text-slate-300 hover:text-emerald-300 hover:bg-white/10 transition"
        >
          <Compass className="w-4 h-4" />
        </button>
      </div>

      {/* Bottom Floating Telemetry & Simulation Controls Bar */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 glass-panel px-4 py-2 rounded-2xl shadow-2xl text-xs font-mono">
        <div className="flex items-center gap-2 pr-3 border-r border-slate-800 text-slate-300">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="hidden sm:inline">Orbit Simulation:</span>
          <span className="text-cyan-400 font-bold">{simulationSpeed}x</span>
        </div>

        {/* Speed presets */}
        <div className="flex items-center gap-1">
          {[1, 5, 15, 60].map((speed) => (
            <button
              key={speed}
              onClick={() => setSimulationSpeed(speed)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition ${
                simulationSpeed === speed
                  ? 'bg-cyan-500 text-space-950 shadow-glow-cyan'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {speed}x
            </button>
          ))}
        </div>

        {/* Center / Reset Camera shortcut */}
        <div className="pl-2 border-l border-slate-800">
          <button
            onClick={() => triggerCameraAction('reset')}
            title="Reset Camera & Center Earth (R)"
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-slate-400 hover:text-cyan-300 hover:bg-white/5 transition"
          >
            <RotateCcw className="w-3 h-3 text-cyan-400" />
            <span className="hidden lg:inline">Center Earth</span>
          </button>
        </div>

        {/* Quick Hint */}
        <div className="hidden md:flex items-center gap-1.5 pl-3 border-l border-slate-800 text-slate-400 text-[11px]">
          <Info className="w-3.5 h-3.5 text-cyan-400" />
          <span>Click any satellite dot to view risk dossier & orbit</span>
        </div>
      </div>
    </div>
  );
};

export default Home;
