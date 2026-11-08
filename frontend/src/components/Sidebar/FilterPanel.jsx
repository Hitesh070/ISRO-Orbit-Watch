/**
 * FilterPanel Component
 * Floating controls providing search by name/NORAD ID, orbital regime selection,
 * country filtering, risk level filtering, 3D layer visibility toggles, and live search results dropdown.
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, Layers, SlidersHorizontal, RotateCcw, Eye, EyeOff, Star, X } from 'lucide-react';
import { useOrbitStore } from '../../store/useOrbitStore';

export const FilterPanel = () => {
  const filters = useOrbitStore((state) => state.filters);
  const layers = useOrbitStore((state) => state.layers);
  const satellites = useOrbitStore((state) => state.satellites);
  const debris = useOrbitStore((state) => state.debris);
  const catalog = useOrbitStore((state) => state.catalog);
  const favourites = useOrbitStore((state) => state.favourites);
  const setFilter = useOrbitStore((state) => state.setFilter);
  const toggleLayer = useOrbitStore((state) => state.toggleLayer);
  const resetFilters = useOrbitStore((state) => state.resetFilters);
  const selectSatellite = useOrbitStore((state) => state.selectSatellite);
  const selectedSatellite = useOrbitStore((state) => state.selectedSatellite);

  const [isOpen, setIsOpen] = useState(false);
  const searchContainerRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute live search matches across active catalog
  const searchResults = useMemo(() => {
    const q = (filters.search || '').trim().toLowerCase();
    if (!q) return [];

    const pool = (catalog && catalog.length > 0) ? catalog : [...(satellites || []), ...(debris || [])];
    const matches = [];
    const seen = new Set();

    for (const item of pool) {
      if (!item || seen.has(item.norad_id)) continue;
      const norad = String(item.norad_id);
      const name = (item.name || '').toLowerCase();
      const country = (item.country || '').toLowerCase();

      // Priority ranking: exact NORAD or partial name match
      if (norad === q || norad.startsWith(q) || name.includes(q) || country.includes(q)) {
        seen.add(item.norad_id);
        matches.push(item);
        if (matches.length >= 8) break;
      }
    }
    return matches;
  }, [filters.search, catalog, satellites, debris]);

  const handleSelectSatellite = (item) => {
    selectSatellite(item);
    // If selecting a non-ISRO satellite while ISRO-only filter is active, auto-switch to show all assets
    if (filters.indianSatsOnly && !item.is_isro && !(item.country || '').toLowerCase().includes('india')) {
      setFilter('indianSatsOnly', false);
    }
    setIsOpen(false);
  };

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

      {/* Search Input with Autocomplete Results */}
      <div ref={searchContainerRef} className="relative mb-3">
        <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
        <input
          type="text"
          value={filters.search}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            setFilter('search', e.target.value);
            setIsOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && searchResults.length > 0) {
              handleSelectSatellite(searchResults[0]);
            } else if (e.key === 'Escape') {
              setFilter('search', '');
              setIsOpen(false);
            }
          }}
          placeholder="Search Satellite / NORAD ID..."
          className="w-full pl-9 pr-8 py-1.5 rounded-lg bg-space-950/80 border border-slate-700 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono transition"
        />
        {filters.search && (
          <button
            onClick={() => {
              setFilter('search', '');
              setIsOpen(false);
            }}
            title="Clear search"
            className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white p-0.5 rounded transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Dropdown Results Overlay */}
        {isOpen && filters.search && filters.search.trim().length > 0 && (
          <div className="mt-2 z-30 bg-space-950/95 border border-cyan-500/50 rounded-xl shadow-2xl backdrop-blur-md max-h-56 overflow-y-auto p-1 divide-y divide-slate-800">
            {searchResults.length > 0 ? (
              searchResults.map((item) => {
                const isDebris = item.object_type === 'Debris';
                const isSelected = selectedSatellite?.norad_id === item.norad_id;
                const alt = item.alt_km || (item.semi_major_axis_km ? item.semi_major_axis_km - 6378.137 : 600);
                const regime = item.regime || (alt < 2000 ? 'LEO' : alt < 35000 ? 'MEO' : 'GEO');

                return (
                  <button
                    key={item.norad_id}
                    onClick={() => handleSelectSatellite(item)}
                    className={`w-full text-left p-2 rounded-lg transition flex items-center justify-between group ${
                      isSelected ? 'bg-cyan-950/60 border border-cyan-500/50' : 'hover:bg-cyan-950/40'
                    }`}
                  >
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-slate-100 group-hover:text-cyan-300 truncate">
                        {item.is_isro && (
                          <span className="px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono text-[9px] border border-amber-500/40 shrink-0">
                            ISRO
                          </span>
                        )}
                        <span className="truncate">{item.name}</span>
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <span className="text-cyan-400">#{item.norad_id}</span>
                        <span>•</span>
                        <span>{regime}</span>
                        <span>•</span>
                        <span className="truncate">{item.country || 'International'}</span>
                      </div>
                    </div>
                    <span
                      className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase shrink-0 ${
                        isDebris
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      }`}
                    >
                      {isDebris ? 'Debris' : 'Active'}
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="p-3 text-center text-xs font-mono text-slate-400">
                No matching spacecraft found for "{filters.search}"
              </div>
            )}
          </div>
        )}
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
        <span>{filters.indianSatsOnly ? 'ISRO Assets Only' : 'Showing All Assets'}</span>
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
          {filters.indianSatsOnly ? `${satellites.filter(s => s.is_isro).length} ISRO Active` : `${satellites.length} Active`} | {debris.length} Debris
        </span>
      </div>
    </div>
  );
};

export default FilterPanel;
