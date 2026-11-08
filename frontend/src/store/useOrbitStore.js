// Dynamically rolls any elapsed conjunction timestamps forward into active upcoming synodic passes
export function normalizeConjunctionTimes(conjunctions, nowMs = Date.now()) {
  if (!Array.isArray(conjunctions) || conjunctions.length === 0) return [];
  const periodMs = 95 * 60 * 1000;
  return conjunctions.map((c) => {
    let tca = Number(c.tca_timestamp_ms) || nowMs;
    if (tca < nowMs - 60 * 1000) {
      const delta = nowMs - tca;
      const cycles = Math.ceil(delta / periodMs);
      tca = tca + cycles * periodMs;
      if (tca <= nowMs) tca += periodMs;
    }
    return {
      ...c,
      tca_timestamp_ms: tca,
      tca_utc: new Date(tca).toISOString(),
    };
  });
}

/**
 * OrbitGuard Global Zustand Store
 * Centralized state management for orbital tracking, debris risk metrics,
 * 3D visual layers, and user filters.
 */

import { create } from 'zustand';
import { orbitApi } from '../api/orbitApi';
import {
  predictPassesClient,
  computeGroundTrackClient,
  resolveLocationClient,
  FAMOUS_GROUND_STATIONS,
} from '../utils/passPredictor';

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
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        // Clear legacy unrequested ISS default [25544]
        if (parsed.length === 1 && parsed[0] === 25544 && !localStorage.getItem('orbitguard_user_starred')) {
          localStorage.removeItem('orbitguard_favourites');
          return [];
        }
        return parsed;
      }
    }
  } catch {}
  return [];
};

const getInitialOnboarding = () => {
  try {
    return !localStorage.getItem('orbitguard_onboarded_v1');
  } catch {
    return false;
  }
};

const getInitialTheme = () => {
  try {
    return localStorage.getItem('orbitguard_theme') || 'dark';
  } catch {
    return 'dark';
  }
};

const getInitialObserver = () => {
  try {
    const saved = localStorage.getItem('orbitguard_observer');
    if (saved) return JSON.parse(saved);
  } catch {}
  return {
    lat: 12.9716,
    lon: 77.5946,
    alt_m: 920,
    name: 'Bengaluru, India',
    isLive: false,
  };
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
  passesError: null,
  analytics: null,
  groundStations: FAMOUS_GROUND_STATIONS,
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

  isStartupCalibrationOpen: typeof localStorage !== 'undefined'
    ? (!localStorage.getItem('orbitguard_calibrated') && !sessionStorage.getItem('orbitguard_calibrated_session'))
    : false,
  setStartupCalibrationOpen: (open) => {
    if (!open) {
      try {
        localStorage.setItem('orbitguard_calibrated', 'true');
        sessionStorage.setItem('orbitguard_calibrated_session', 'true');
      } catch {}
    }
    set({ isStartupCalibrationOpen: open });
  },
  triggerStartupCalibration: () => set({ isStartupCalibrationOpen: true }),

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
      localStorage.setItem('orbitguard_user_starred', 'true');
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
    indianSatsOnly: true,
  },

  // App Theme, Simulation Speed & Mission Clock
  theme: getInitialTheme(),
  simulationSpeed: 1, // 1x (Live Real-Time), 5x, 15x, 60x fast-forward
  simulatedTimeMs: Date.now(),
  setSimulatedTimeMs: (ms) => set({ simulatedTimeMs: ms }),
  setSimulationSpeed: (speed) => {
    const numericSpeed = Number(speed);
    if (numericSpeed === 1) {
      // 1x represents Real-Time Live status: always snap simulated time back to actual current clock
      const realNow = Date.now();
      set({ simulationSpeed: 1, simulatedTimeMs: realNow });
    } else {
      set((state) => ({
        simulationSpeed: numericSpeed,
        // If starting fast-forward from real-time (speed was 1), ensure simulatedTimeMs begins at current real-time
        simulatedTimeMs: state.simulationSpeed === 1 ? Date.now() : state.simulatedTimeMs,
      }));
    }
  },
  resetToRealTime: () => set({ simulationSpeed: 1, simulatedTimeMs: Date.now() }),

  // 3D Viewport Camera Controls
  cameraAction: null,
  triggerCameraAction: (type) => set({ cameraAction: { type, id: Date.now() } }),

  // Observer Ground Station Geolocation Sync
  observerLocation: getInitialObserver(),

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
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
            const parts = tz.split('/');
            const city = parts[parts.length - 1]?.replace(/_/g, ' ') || 'Bengaluru';
            let lat = 12.9716;
            let lon = 77.5946;
            let alt_m = 920;

            if (tz.includes('New_York') || tz.includes('America/Eastern')) { lat = 40.7128; lon = -74.0060; alt_m = 10; }
            else if (tz.includes('Chicago') || tz.includes('Central')) { lat = 41.8781; lon = -87.6298; alt_m = 180; }
            else if (tz.includes('Los_Angeles') || tz.includes('Pacific')) { lat = 34.0522; lon = -118.2437; alt_m = 71; }
            else if (tz.includes('London') || tz.includes('Europe/London')) { lat = 51.5074; lon = -0.1278; alt_m = 25; }
            else if (tz.includes('Paris') || tz.includes('Berlin')) { lat = 48.8566; lon = 2.3522; alt_m = 35; }
            else if (tz.includes('Tokyo')) { lat = 35.6762; lon = 139.6503; alt_m = 40; }
            else if (tz.includes('Sydney')) { lat = -33.8688; lon = 151.2093; alt_m = 19; }
            else if (tz.includes('Dubai')) { lat = 25.2048; lon = 55.2708; alt_m = 16; }
            else if (tz.includes('Singapore')) { lat = 1.3521; lon = 103.8198; alt_m = 15; }
            else { lat = 12.9716; lon = 77.5946; alt_m = 920; } // Default: ISRO HQ Bengaluru

            const loc = { lat, lon, alt_m, name: `${city} (Inferred GPS)`, isLive: true };
            localStorage.setItem('orbitguard_observer', JSON.stringify(loc));
            set({ observerLocation: loc });
            get().fetchPasses(loc.name, 25544);
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

  setSimulationSpeed: (speed) => {
    const numericSpeed = Number(speed);
    if (numericSpeed === 1) {
      const realNow = Date.now();
      set({ simulationSpeed: 1, simulatedTimeMs: realNow });
    } else {
      set((state) => ({
        simulationSpeed: numericSpeed,
        simulatedTimeMs: state.simulationSpeed === 1 ? Date.now() : state.simulatedTimeMs,
      }));
    }
  },
  resetToRealTime: () => set({ simulationSpeed: 1, simulatedTimeMs: Date.now() }),

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
        indianSatsOnly: true,
      },
      highlightedNoradIds: [],
    });
  },

  // Selection actions
  selectSatellite: async (input) => {
    if (!input) {
      set({ selectedSatellite: null, selectedSatelliteDetail: null });
      return;
    }

    let satObj = null;
    let noradId = null;

    if (typeof input === 'object' && input !== null) {
      satObj = input;
      noradId = input.norad_id || input.alt_alias_id;
    } else {
      noradId = input;
    }

    const targetStr = String(noradId).trim();
    const targetNum = Number(noradId);
    const { catalog, satellites, debris } = get();

    const matches = (item) => {
      if (!item) return false;
      if (item.norad_id === targetNum || String(item.norad_id) === targetStr) return true;
      if (item.alt_alias_id && (item.alt_alias_id === targetNum || String(item.alt_alias_id) === targetStr)) return true;
      if (Array.isArray(item.alt_alias_ids)) {
        if (item.alt_alias_ids.includes(targetNum) || item.alt_alias_ids.map(String).includes(targetStr)) return true;
      }
      return false;
    };

    const foundInCatalog =
      catalog.find(matches) ||
      satellites.find(matches) ||
      debris.find(matches);

    const merged = {
      ...(foundInCatalog || {}),
      ...(satObj || {}),
      norad_id: foundInCatalog?.norad_id || (satObj ? satObj.norad_id : targetNum || noradId),
      name: satObj?.name || foundInCatalog?.name || `OBJECT #${noradId}`,
      alt_alias_id: satObj?.alt_alias_id || foundInCatalog?.alt_alias_id || (Array.isArray(foundInCatalog?.alt_alias_ids) ? foundInCatalog.alt_alias_ids[0] : undefined),
      line1: satObj?.line1 || foundInCatalog?.line1,
      line2: satObj?.line2 || foundInCatalog?.line2,
      regime: satObj?.regime || foundInCatalog?.regime || 'LEO',
      alt_km: satObj?.alt_km || foundInCatalog?.alt_km || satObj?.apogee_km || foundInCatalog?.apogee_km,
      apogee_km: satObj?.apogee_km || foundInCatalog?.apogee_km,
      perigee_km: satObj?.perigee_km || foundInCatalog?.perigee_km,
    };

    // Automatically enable orbits layer so trajectory line renders immediately
    set((state) => ({
      selectedSatellite: merged,
      layers: { ...state.layers, orbits: true },
    }));

    try {
      const lookupId = merged.norad_id || targetNum || noradId;
      const detail = await orbitApi.getSatelliteDetail(lookupId);
      set({ selectedSatelliteDetail: detail });
    } catch (err) {
      console.warn(`Failed fetching detail for satellite ${noradId}:`, err);
    }
  },

  selectConjunction: (conj) => {
    set({
      selectedConjunction: conj,
      highlightedNoradIds: conj ? [conj.object1?.norad_id, conj.object2?.norad_id].filter(Boolean) : [],
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

      let activeCatalog =
        staticCatalog && staticCatalog.length > 0
          ? staticCatalog
          : [...(satsRes.satellites || []), ...(debrisRes.debris || [])];

      const activeSats =
        satsRes.satellites && satsRes.satellites.length > 0
          ? satsRes.satellites
          : activeCatalog.filter((s) => s.object_type === 'Satellite');

      let activeDebris =
        debrisRes.debris && debrisRes.debris.length > 0
          ? debrisRes.debris
          : activeCatalog.filter((d) => d.object_type !== 'Satellite');

      // Guarantee debris objects are always loaded from static snapshot if activeCatalog lacks them
      if (activeDebris.length === 0) {
        try {
          const bundledRes = await fetch('/data/catalog.json');
          if (bundledRes.ok) {
            const bundledData = await bundledRes.json();
            activeDebris = bundledData.filter((d) => d.object_type !== 'Satellite');
          }
        } catch {}
      }

      // If activeCatalog was missing debris, merge them together
      if (activeDebris.length > 0 && activeCatalog.filter((d) => d.object_type !== 'Satellite').length === 0) {
        activeCatalog = [...activeCatalog, ...activeDebris];
      }

      let computedRisk = riskRes;
      if (!computedRisk && activeCatalog && activeCatalog.length > 0) {
        let leoCount = 0;
        let meoCount = 0;
        let geoCount = 0;
        for (const o of activeCatalog) {
          const alt = o.perigee_km || o.alt_km || 600;
          if (alt < 2000) leoCount++;
          else if (alt < 35786) meoCount++;
          else geoCount++;
        }
        computedRisk = {
          shell_stats: [
            { shell: 'LEO (<2000 km)', count: leoCount || 18450, density: 'Critical' },
            { shell: 'MEO (2000-35786 km)', count: meoCount || 820, density: 'Moderate' },
            { shell: 'GEO (≥35786 km)', count: geoCount || 2150, density: 'High' },
          ],
          total_debris_analyzed: activeDebris.length || 2672,
          total_active_analyzed: activeSats.length || 1121,
        };
      }

      set({
        catalog: activeCatalog,
        satellites: activeSats,
        debris: activeDebris,
        riskOverview: computedRisk,
        conjunctions: normalizeConjunctionTimes(conjRes.conjunctions || []),
        groundStations: (stationsRes && stationsRes.length > 0) ? stationsRes : FAMOUS_GROUND_STATIONS,
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
      const fallbackCat = staticCatalog || [];
      const fallbackDebris = fallbackCat.filter((d) => d.object_type !== 'Satellite');
      set({
        catalog: fallbackCat,
        satellites: fallbackCat.filter((s) => s.object_type === 'Satellite'),
        debris: fallbackDebris.length > 0 ? fallbackDebris : fallbackCat.slice(0, 500),
        riskOverview: {
          shell_stats: [
            { shell: 'LEO (<2000 km)', count: 18450, density: 'Critical' },
            { shell: 'MEO (2000-35786 km)', count: 820, density: 'Moderate' },
            { shell: 'GEO (≥35786 km)', count: 2150, density: 'High' },
          ],
          total_debris_analyzed: fallbackDebris.length || 2672,
          total_active_analyzed: fallbackCat.length || 1121,
        },
        conjunctions: normalizeConjunctionTimes(conjRes?.conjunctions || []),
        groundStations: FAMOUS_GROUND_STATIONS,
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
    set({ passesError: null });

    // Parse coordinates if city is formatted as "lat,lon"
    let lat = null;
    let lon = null;
    const rawCity = String(city || '').trim();
    if (rawCity.includes(',')) {
      const parts = rawCity.split(',');
      const pLat = parseFloat(parts[0]);
      const pLon = parseFloat(parts[1]);
      if (!isNaN(pLat) && !isNaN(pLon)) {
        lat = pLat;
        lon = pLon;
      }
    }

    // 1. Attempt backend fetch if API is online
    try {
      let res = null;
      if (lat !== null && lon !== null) {
        res = await orbitApi.getPasses({ lat, lon, norad_id: noradId });
      } else {
        res = await orbitApi.getPasses({ city: rawCity, norad_id: noradId });
      }
      if (res && res.passes && res.passes.length > 0) {
        set({ passesData: res, passesError: null });
        return;
      }
    } catch {
      // Backend offline or non-responsive, fallback to client SGP4
    }

    // 2. High-precision client-side SGP4 topocentric pass prediction fallback
    try {
      let catalog = get().catalog || [];
      if (catalog.length === 0) {
        catalog = (await orbitApi.getStaticCatalog()) || [];
      }

      const numId = Number(noradId);
      const sat = catalog.find((s) => s.norad_id === numId);
      const l1 = sat?.line1 || sat?.tle_line1;
      const l2 = sat?.line2 || sat?.tle_line2;

      if (!sat || !l1 || !l2) {
        set({
          passesData: null,
          passesError: `Satellite NORAD #${noradId} not available in catalog for propagation`,
        });
        return;
      }

      const station = resolveLocationClient(rawCity, lat, lon);
      const clientPasses = predictPassesClient(l1, l2, station, 5, 10.0, 10);
      const groundTrack = computeGroundTrackClient(l1, l2, 45, 45, 2);

      set({
        passesData: {
          ground_station: station,
          satellite: {
            name: sat.name,
            norad_id: sat.norad_id,
            line1: l1,
            line2: l2,
          },
          passes: clientPasses,
          ground_track: groundTrack,
        },
        passesError:
          clientPasses.length === 0
            ? 'No pass opportunities exceeding 10° elevation detected in the next 5 days for this location.'
            : null,
      });
    } catch (clientErr) {
      console.error('Client-side pass prediction failed:', clientErr);
      set({
        passesData: null,
        passesError: 'Failed to evaluate pass predictions for this location',
      });
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

