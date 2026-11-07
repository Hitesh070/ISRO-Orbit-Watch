/**
 * FilterPanel Component
 * Floating controls providing search by name/NORAD ID, orbital regime selection,
 * country filtering, risk level filtering, and 3D layer visibility toggles.
 */

import React from 'react';
import { Search, Layers, SlidersHorizontal, RotateCcw, Eye, EyeOff, Star } from 'lucide-react';
import { useOrbitStore } from '../../store/useOrbitStore';

export const FilterPanel = () => {
  const filters = useOrbitStore((state) => state.filters);
  const layers = useOrbitStore((state) => state.layers);
  const satellites = useOrbitStore((state) => state.satellites);
  const debris = useOrbitStore((state) => state.debris);
  const favourites = useOrbitStore((state) => state.favourites);
  const setFilter = useOrbitStore((state) => state.setFilter);
  const toggleLayer = useOrbitStore((state) => state.toggleLayer);
  const resetFilters = useOrbitStore((state) => state.resetFilters);

  return (
    <div className="absolute top-20 left-5 w-80 md:w-84 glass-panel rounded-xl p-4 shadow-2xl z-20 text-slate-100 max-h-[calc(100vh-120px)] overflow-y-auto no-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2.5 mb-3">
        <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm tracking-wide">
          <SlidersHorizontal className="w-4 h-4" /> Orbital Telemetry Filters
        </div>
        <button
          onClick={resetFilters}
          title="Reset Filters"
          className="text-slate-400 hover:text-cyan-300 p-1 rounded-md hover:bg-white/5 transition"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Search Input */}
      <div className="relative mb-3">
        <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
        <input
          type="text"
          value={filters.search}
          onChange={(e) => setFilter('search', e.target.value)}
          placeholder="Search Satellite / NORAD ID..."
          className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-space-950/80 border border-slate-700 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono transition"
        />
      </div>

      {/* Layer Toggles */}
      <div className="mb-3.5">
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Layers className="w-3 h-3 text-cyan-400" /> 3D Visual Layers
        </div>
        <div className="grid grid-cols-2 gap-1.5 text-xs font-mono">
          <button
            onClick={() => toggleLayer('satellites')}
            className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border transition ${
              layers.satellites
                ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
                : 'bg-space-900 border-slate-800 text-slate-500'
            }`}
          >
            <span>Satellites</span>
            {layers.satellites ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={() => toggleLayer('debris')}
            className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border transition ${
              layers.debris
                ? 'bg-orange-950/40 border-orange-500/50 text-orange-300'
                : 'bg-space-900 border-slate-800 text-slate-500'
            }`}
          >
            <span>Debris</span>
            {layers.debris ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={() => toggleLayer('orbits')}
            className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border transition ${
              layers.orbits
                ? 'bg-cyan-950/40 border-cyan-500/50 text-cyan-300'
                : 'bg-space-900 border-slate-800 text-slate-500'
            }`}
          >
            <span>Orbits</span>
            {layers.orbits ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={() => toggleLayer('clouds')}
            className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border transition ${
              layers.clouds
                ? 'bg-sky-950/40 border-sky-500/50 text-sky-300'
                : 'bg-space-900 border-slate-800 text-slate-500'
            }`}
          >
            <span>Clouds</span>
            {layers.clouds ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* ISRO Filter Button */}
      <button
        onClick={() => setFilter('indianSatsOnly', !filters.indianSatsOnly)}
        className={`w-full flex items-center justify-center py-2 px-3 rounded-lg border text-xs font-mono font-bold transition mb-2 tracking-wider ${
          filters.indianSatsOnly
            ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-glow-amber'
            : 'bg-space-950/60 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
        }`}
        title="Filter ISRO Spacecraft"
      >
        <span>ISRO</span>
      </button>

      {/* Starred Favourites Only Filter */}
      <button
        onClick={() => setFilter('favouritesOnly', !filters.favouritesOnly)}
        className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg border text-xs font-mono transition mb-3 ${
          filters.favouritesOnly
            ? 'bg-amber-950/50 border-amber-500/60 text-amber-300 font-bold shadow-glow-amber'
            : 'bg-space-950/60 border-slate-800 text-slate-400 hover:text-white'
        }`}
      >
        <div className="flex items-center gap-2">
          <Star className={`w-3.5 h-3.5 ${filters.favouritesOnly ? 'fill-amber-400 text-amber-400' : 'text-slate-400'}`} />
          <span>Starred Favourites Only</span>
        </div>
        <span className="text-[10px] px-1.5 py-0.2 rounded bg-space-900 border border-slate-700 font-bold">
          {favourites?.length || 0}
        </span>
      </button>

      {/* Dropdown Filters */}
      <div className="space-y-2.5 text-xs">
        {/* Orbital Regime Filter */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Orbital Regime
          </label>
          <select
            value={filters.regime}
            onChange={(e) => setFilter('regime', e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg bg-space-950/80 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-cyan-400 transition"
          >
            <option value="ALL">All Regimes (LEO / MEO / GEO)</option>
            <option value="LEO">LEO (&lt; 2000 km)</option>
            <option value="MEO">MEO (2000 - 35786 km)</option>
            <option value="GEO">GEO (~35786 km)</option>
          </select>
        </div>

        {/* Country / Agency Filter */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Country / Agency
          </label>
          <select
            value={filters.country}
            onChange={(e) => setFilter('country', e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg bg-space-950/80 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-cyan-400 transition"
          >
            <option value="ALL">All Countries / Agencies</option>
            <option value="India">India (ISRO)</option>
            <option value="United States">United States (NASA / SpaceX)</option>
            <option value="Russia">Russia (Roscosmos)</option>
            <option value="China">China (CNSA)</option>
            <option value="Europe">Europe (ESA)</option>
            <option value="United Kingdom">United Kingdom (OneWeb)</option>
            <option value="Japan">Japan (JAXA)</option>
          </select>
        </div>

        {/* Risk Level Filter */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Collision Risk Threshold
          </label>
          <select
            value={filters.riskLevel}
            onChange={(e) => setFilter('riskLevel', e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg bg-space-950/80 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-cyan-400 transition"
          >
            <option value="ALL">All Risk Levels</option>
            <option value="HIGH RISK">High Risk (Score ≥ 70) 🔴</option>
            <option value="CAUTION">Caution (Score 35-69) 🟡</option>
            <option value="SAFE">Safe (Score &lt; 35) 🟢</option>
          </select>
        </div>
      </div>

      {/* Summary Footer */}
      <div className="mt-3.5 pt-2.5 border-t border-slate-800 text-[11px] font-mono text-slate-400 flex justify-between items-center">
        <span>Tracking:</span>
        <span className="text-cyan-300 font-bold">
          {filters.indianSatsOnly ? `${satellites.filter(s => s.is_isro).length || 79} ISRO Active` : `${satellites.length} Active`} | {debris.length} Debris
        </span>
      </div>
    </div>
  );
};

export default FilterPanel;
