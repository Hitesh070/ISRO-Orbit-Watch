/**
 * OrbitGuard Global Zustand Store
 * Centralized state management for orbital tracking, debris risk metrics,
 * 3D visual layers, and user filters.
 */

import { create } from 'zustand';
import { orbitApi } from '../api/orbitApi';
import { predictPassesClient } from '../utils/passPredictor';

export const DEFAULT_SETTINGS = {
  units: 'metric', // 'metric' (km, km/s) | 'imperial' (miles, mi/s)
  timeFormat: 'local_primary', // 'local_primary' | 'utc_primary'
  quality: 'high', // 'auto' | 'high' | 'medium' | 'low'
  reducedMotion: false,
  elevationMaskDeg: 5,
  covarianceScaleK: 1.0,
  criticalPcThreshold: 1e-4,
  warningPcThreshold: 1e-5,
};

const getInitialSettings = () => {
  try {
    const saved = localStorage.getItem('orbitguard_settings_v1');
    if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
  } catch {}
  return DEFAULT_SETTINGS;
};

const getInitialFavourites = () => {
  try {
    const saved = localStorage.getItem('orbitguard_favourites');
    if (saved) return JSON.parse(saved);
  } catch {}
  return [25544]; // default ISS
};

const getInitialOnboarding = () => {
  try {
    return !localStorage.getItem('orbitguard_onboarded_v1');
  } catch {
    return false;
  }
};

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

  // Modal dialog states (Phase 6)
  isHelpOpen: false,
  toggleHelp: () => set((state) => ({ isHelpOpen: !state.isHelpOpen })),
  setHelpOpen: (open) => set({ isHelpOpen: open }),

  isSettingsOpen: false,
  toggleSettings: () => set((state) => ({ isSettingsOpen: !state.isSettingsOpen })),
  setSettingsOpen: (open) => set({ isSettingsOpen: open }),

  isTrainerOpen: false,
  toggleTrainer: () => set((state) => ({ isTrainerOpen: !state.isTrainerOpen })),
  setTrainerOpen: (open) => set({ isTrainerOpen: open }),

  isOnboardingOpen: getInitialOnboarding(),
  toggleOnboarding: () => set((state) => ({ isOnboardingOpen: !state.isOnboardingOpen })),
  setOnboardingOpen: (open) => {
    if (!open) {
      try {
        localStorage.setItem('orbitguard_onboarded_v1', 'true');
      } catch {}
    }
    set({ isOnboardingOpen: open });
  },

  // User Settings & Unit System (Phase 6)
  settings: getInitialSettings(),
  updateSettings: (newSettings) => {
    const merged = { ...get().settings, ...newSettings };
    try {
      localStorage.setItem('orbitguard_settings_v1', JSON.stringify(merged));
    } catch {}
    set({ settings: merged });
  },
  resetSettings: () => {
    try {
      localStorage.setItem('orbitguard_settings_v1', JSON.stringify(DEFAULT_SETTINGS));
    } catch {}
    set({ settings: DEFAULT_SETTINGS });
  },

  // Favourites / Bookmarks
  favourites: getInitialFavourites(),
  toggleFavourite: (noradId) => {
    const numId = Number(noradId);
    const current = get().favourites;
    const next = current.includes(numId)
      ? current.filter((id) => id !== numId)
      : [...current, numId];
    try {
      localStorage.setItem('orbitguard_favourites', JSON.stringify(next));
    } catch {}
    set({ favourites: next });
  },
  isFavourite: (noradId) => get().favourites.includes(Number(noradId)),

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
    favouritesOnly: false,
  },

  // App Theme, Simulation Speed & Mission Clock
  theme: localStorage.getItem('orbitguard_theme') || 'dark',
  simulationSpeed: 1, // 1x, 5x, 15x, 60x fast-forward
  simulatedTimeMs: Date.now(),
  setSimulatedTimeMs: (ms) => set({ simulatedTimeMs: ms }),
  setSimulationSpeed: (speed) => set({ simulationSpeed: speed }),

  // Observer Ground Station Geolocation Sync
  observerLocation: JSON.parse(localStorage.getItem('orbitguard_observer') || 'null') || {
    lat: 12.9716,
    lon: 77.5946,
    alt_m: 920,
    name: 'Bengaluru, India',
    isLive: false,
  },

  detectUserLocation: () => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = Number(pos.coords.latitude.toFixed(4));
          const lon = Number(pos.coords.longitude.toFixed(4));
          const alt = pos.coords.altitude ? Math.round(pos.coords.altitude) : 100;

          // Attempt timezone name extraction
          let tzCity = 'My Station';
          try {
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
            tzCity = tz.split('/')[1]?.replace(/_/g, ' ') || 'My Station';
          } catch {}

          const loc = {
            lat,
            lon,
            alt_m: alt,
            name: `${tzCity} (${Math.abs(lat)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon)}°${lon >= 0 ? 'E' : 'W'})`,
            isLive: true,
          };
          localStorage.setItem('orbitguard_observer', JSON.stringify(loc));
          set({ observerLocation: loc });
          console.log('[OrbitGuard] Synced observer location:', loc);
          get().fetchPasses(loc.name, 25544);
        },
        (err) => {
          console.warn('[OrbitGuard] Geolocation notice:', err.message);
          // Set timezone-inferred location as friendly default
          try {
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
            if (tz.includes('Kolkata') || tz.includes('Calcutta') || tz.includes('India')) {
              const loc = { lat: 12.9716, lon: 77.5946, alt_m: 920, name: 'Bengaluru, India', isLive: true };
              set({ observerLocation: loc });
            }
          } catch {}
        },
        { timeout: 8000, enableHighAccuracy: true }
      );
    }
  },

  setObserverLocation: (location) => {
    localStorage.setItem('orbitguard_observer', JSON.stringify(location));
    set({ observerLocation: location });
  },

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
        favouritesOnly: false,
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

    const targetStr = String(noradId).trim();
    const { catalog, satellites, debris } = get();
    const found =
      catalog.find((c) => String(c.norad_id) === targetStr) ||
      satellites.find((s) => String(s.norad_id) === targetStr) ||
      debris.find((d) => String(d.norad_id) === targetStr);

    set({ selectedSatellite: found || { norad_id: Number(noradId) || noradId, name: `OBJECT ${noradId}` } });

    try {
      const detail = await orbitApi.getSatelliteDetail(Number(noradId) || noradId);
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

/**
 * Returns current deep-linkable URL encoding active norad selection and simulation speed.
 */
export const getShareableUrl = () => {
  if (typeof window === 'undefined') return '';
  const state = useOrbitStore.getState();
  const url = new URL(window.location.href);

  if (state.selectedSatellite?.norad_id) {
    url.searchParams.set('norad', String(state.selectedSatellite.norad_id));
  } else {
    url.searchParams.delete('norad');
  }

  if (state.simulationSpeed && state.simulationSpeed > 1) {
    url.searchParams.set('speed', String(state.simulationSpeed));
  } else {
    url.searchParams.delete('speed');
  }

  return url.toString();
};

