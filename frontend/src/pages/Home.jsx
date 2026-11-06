/**
 * Home Page
 * Primary 3D interactive viewport featuring the Earth globe, orbital paths,
 * filter drawer, satellite telemetry card, and simulation controls.
 */

import React, { useState } from 'react';
import EarthGlobe from '../components/Globe/EarthGlobe';
import FilterPanel from '../components/Sidebar/FilterPanel';
import SatelliteInfo from '../components/Sidebar/SatelliteInfo';
import { useOrbitStore } from '../store/useOrbitStore';
import { SlidersHorizontal, Info, ShieldAlert, Sparkles, FastForward } from 'lucide-react';

export const Home = () => {
  const [showFilters, setShowFilters] = useState(true);
  const selectedSatellite = useOrbitStore((state) => state.selectedSatellite);
  const simulationSpeed = useOrbitStore((state) => state.simulationSpeed);
  const setSimulationSpeed = useOrbitStore((state) => state.setSimulationSpeed);
  const satellites = useOrbitStore((state) => state.satellites);
  const debris = useOrbitStore((state) => state.debris);

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
