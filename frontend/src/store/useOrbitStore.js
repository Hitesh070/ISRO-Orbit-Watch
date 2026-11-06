/**
 * OrbitGuard Global Zustand Store
 * Centralized state management for orbital tracking, debris risk metrics,
 * 3D visual layers, and user filters.
 */

import { create } from 'zustand';
import { orbitApi } from '../api/orbitApi';
import { predictPassesClient } from '../utils/passPredictor';

export const useOrbitStore = create((set, get) => ({
  // Core orbital dataset
  catalog: [],
  satellites: [],
  debris: [],
  selectedSatellite: null,
  selectedSatelliteDetail: null,
  selectedConjunction: null,
  highlightedNoradIds: [],

  // Dashboard & Risk analytics
  riskOverview: null,
  conjunctions: [],
  passesData: null,
  analytics: null,
  groundStations: [],
  metadata: null,

  // Performance & Astrodynamic HUD (Phase 2)
  isHudVisible: false,
  workerLatencyMs: 0,
  toggleHud: () => set((state) => ({ isHudVisible: !state.isHudVisible })),
  setWorkerLatencyMs: (ms) => set({ workerLatencyMs: ms }),

  // UI & Layer toggles
  layers: {
    satellites: true,
    debris: true,
    orbits: true,
    clouds: true,
    atmosphere: true,
  },

  // Search & Filter criteria
  filters: {
    search: '',
    regime: 'ALL',
    country: 'ALL',
    objectType: 'ALL',
    riskLevel: 'ALL',
  },

  // App Theme & Execution Mode
  theme: localStorage.getItem('orbitguard_theme') || 'dark',
  simulationSpeed: 1, // 1x, 10x, 60x fast-forward
  isLoading: false,
  error: null,
  lastUpdated: null,

  // Theme action
  toggleTheme: () => {
    const nextTheme = get().theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('orbitguard_theme', nextTheme);
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
    set({ theme: nextTheme });
  },

  setSimulationSpeed: (speed) => set({ simulationSpeed: speed }),

  // Layer toggle action
  toggleLayer: (layerName) => {
    set((state) => ({
      layers: {
        ...state.layers,
        [layerName]: !state.layers[layerName],
      },
    }));
  },

  // Filter setters
  setFilter: (key, value) => {
    set((state) => ({
      filters: {
        ...state.filters,
        [key]: value,
      },
    }));
  },

  resetFilters: () => {
    set({
      filters: {
        search: '',
        regime: 'ALL',
        country: 'ALL',
        objectType: 'ALL',
        riskLevel: 'ALL',
      },
      highlightedNoradIds: [],
    });
  },

  // Selection actions
  selectSatellite: async (noradId) => {
    if (!noradId) {
      set({ selectedSatellite: null, selectedSatelliteDetail: null });
      return;
    }

    const { catalog, satellites, debris } = get();
    const found =
      catalog.find((c) => c.norad_id === noradId) ||
      satellites.find((s) => s.norad_id === noradId) ||
      debris.find((d) => d.norad_id === noradId);

    set({ selectedSatellite: found || { norad_id: noradId, name: `OBJECT ${noradId}` } });

    try {
      const detail = await orbitApi.getSatelliteDetail(noradId);
      set({ selectedSatelliteDetail: detail });
    } catch (err) {
      console.warn(`Failed fetching detail for satellite ${noradId}:`, err);
    }
  },

  selectConjunction: (conj) => {
    set({
      selectedConjunction: conj,
      highlightedNoradIds: conj ? [conj.object1.norad_id, conj.object2.norad_id] : [],
    });
  },

  setHighlightedNoradIds: (ids) => set({ highlightedNoradIds: ids }),

  // Data fetch actions
  fetchInitialData: async () => {
    set({ isLoading: true, error: null });
    try {
      const [satsRes, debrisRes, riskRes, conjRes, stationsRes, metaRes, staticCatalog] = await Promise.all([
        orbitApi.getSatellites(),
        orbitApi.getDebris(),
        orbitApi.getRiskOverview(),
        orbitApi.getConjunctions(),
        orbitApi.getGroundStations(),
        orbitApi.getPipelineMetadata(),
        orbitApi.getStaticCatalog(),
      ]);

      const activeCatalog =
        staticCatalog && staticCatalog.length > 0
          ? staticCatalog
          : [...(satsRes.satellites || []), ...(debrisRes.debris || [])];

      const activeSats =
        satsRes.satellites && satsRes.satellites.length > 0
          ? satsRes.satellites
          : activeCatalog.filter((s) => s.object_type === 'Satellite');

      const activeDebris =
        debrisRes.debris && debrisRes.debris.length > 0
          ? debrisRes.debris
          : activeCatalog.filter((d) => d.object_type !== 'Satellite');

      set({
        catalog: activeCatalog,
        satellites: activeSats,
        debris: activeDebris,
        riskOverview: riskRes,
        conjunctions: conjRes.conjunctions || [],
        groundStations: stationsRes || [],
        metadata: metaRes,
        isLoading: false,
        lastUpdated: new Date().toLocaleTimeString(),
      });
    } catch (err) {
      console.error('OrbitGuard initial fetch error:', err);
      // Attempt to load metadata and static artifacts even on error
      const [meta, staticCatalog, conjRes] = await Promise.all([
        orbitApi.getPipelineMetadata(),
        orbitApi.getStaticCatalog(),
        orbitApi.getConjunctions(),
      ]);
      set({
        catalog: staticCatalog || [],
        satellites: (staticCatalog || []).filter((s) => s.object_type === 'Satellite'),
        debris: (staticCatalog || []).filter((d) => d.object_type !== 'Satellite'),
        conjunctions: conjRes?.conjunctions || [],
        metadata: meta,
        error: err.message || 'Failed to initialize orbit telemetry data',
        isLoading: false,
      });
    }
  },

  fetchSatellites: async () => {
    try {
      const res = await orbitApi.getSatellites();
      set({ satellites: res.satellites || [] });
    } catch (err) {
      console.error('Error fetching satellites:', err);
    }
  },

  fetchPasses: async (city = 'bengaluru', noradId = 25544) => {
    try {
      const res = await orbitApi.getPasses({ city, norad_id: noradId });
      set({ passesData: res });
    } catch (err) {
      console.error('Error fetching passes:', err);
    }
  },

  fetchAnalytics: async () => {
    try {
      const res = await orbitApi.getAnalytics();
      set({ analytics: res });
    } catch (err) {
      console.error('Error fetching analytics:', err);
    }
  },

  triggerRefreshTLE: async () => {
    set({ isLoading: true });
    try {
      await orbitApi.refreshTLE();
      await get().fetchInitialData();
    } catch (err) {
      console.error('Error refreshing TLE:', err);
      set({ isLoading: false });
    }
  },
}));
