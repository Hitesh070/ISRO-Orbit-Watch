export function normalizeConjunctionTimes(conjunctions, nowMs = Date.now()) {
  if (!Array.isArray(conjunctions) || conjunctions.length === 0) return [];
  return conjunctions.map((c) => {
    const raw = Number(c.tca_timestamp_ms);
    const parsed = c.tca_utc ? Date.parse(c.tca_utc) : NaN;
    const tca = Number.isFinite(raw) && raw > 0 ? raw : parsed;
    return {
      ...c,
      tca_timestamp_ms: Number.isFinite(tca) ? tca : null,
      tca_utc: Number.isFinite(tca) ? new Date(tca).toISOString() : null,
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
    if (saved) {
      const location = JSON.parse(saved);
      if (Number.isFinite(location?.lat) && Number.isFinite(location?.lon) && Number.isFinite(location?.alt_m) && location?.altitude_source === 'user_supplied_msl') return location;
      localStorage.removeItem('orbitguard_observer');
    }
  } catch {}
  return null;
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
  conjunctionsScreenTime: null,
  conjunctionsScreenScope: null,
  passesData: null,
  passesError: null,
  passesLoading: false,
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
      // 1x follows the current UTC clock; higher speeds advance the simulation clock faster.
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
          // Browser GPS altitude is ellipsoidal, not mean-sea-level station elevation.
          const alt = null;

          const loc = {
            lat,
            lon,
            alt_m: alt,
            altitude_source: null,
            name: `GPS location (${lat}, ${lon})`,
            isLive: true,
          };
          localStorage.setItem('orbitguard_observer', JSON.stringify(loc));
          set({ observerLocation: loc });
          console.log('[OrbitGuard] Synced observer location:', loc);
          if (alt !== null) get().fetchPasses(`${lat},${lon},${alt}`, 25544);
        },
        (err) => {
          console.warn('[OrbitGuard] Location unavailable; no inferred coordinates were used:', err.message);
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
          : activeCatalog.filter((d) => d.object_type === 'Debris');

      let computedRisk = riskRes;
      if (!computedRisk && activeCatalog && activeCatalog.length > 0) {
        let leoCount = 0;
        let meoCount = 0;
        let geoCount = 0;
        for (const o of activeCatalog) {
          const alt = o.perigee_km ?? o.alt_km;
          if (!Number.isFinite(alt)) continue;
          if (alt < 2000) leoCount++;
          else if (alt < 35786) meoCount++;
          else geoCount++;
        }
        computedRisk = {
          shell_stats: [
            { shell: 'LEO (<2000 km)', count: leoCount, density: 'Catalog count' },
            { shell: 'MEO (2000-35786 km)', count: meoCount, density: 'Catalog count' },
            { shell: 'GEO (≥35786 km)', count: geoCount, density: 'Catalog count' },
          ],
          total_debris_analyzed: activeDebris.length,
          total_active_analyzed: activeSats.length,
        };
      }

      set({
        catalog: activeCatalog,
        satellites: activeSats,
        debris: activeDebris,
        riskOverview: computedRisk,
        conjunctions: normalizeConjunctionTimes(conjRes.conjunctions || []),
        conjunctionsScreenTime: conjRes.screen_time_utc || null,
        conjunctionsScreenScope: conjRes.screening_scope || null,
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
      const fallbackDebris = fallbackCat.filter((d) => d.object_type === 'Debris');
      set({
        catalog: fallbackCat,
        satellites: fallbackCat.filter((s) => s.object_type === 'Satellite'),
        debris: fallbackDebris,
        riskOverview: null,
        conjunctions: normalizeConjunctionTimes(conjRes?.conjunctions || []),
        conjunctionsScreenTime: conjRes?.screen_time_utc || null,
        conjunctionsScreenScope: conjRes?.screening_scope || null,
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

  fetchPasses: async (city, noradId, altitudeM = null) => {
    set({ passesError: null, passesLoading: true, passesData: null });

    // Parse coordinates if city is formatted as "lat,lon"
    let lat = null;
    let lon = null;
    const rawCity = String(city || '').trim();
    if (rawCity.includes(',')) {
      const parts = rawCity.split(',');
      const pLat = Number(parts[0]);
      const pLon = Number(parts[1]);
      if (Number.isFinite(pLat) && Number.isFinite(pLon) && pLat >= -90 && pLat <= 90 && pLon >= -180 && pLon <= 180) {
        lat = pLat;
        lon = pLon;
        if (parts.length > 2 && Number.isFinite(Number(parts[2]))) altitudeM = Number(parts[2]);
      }
    }

    // 1. Attempt backend fetch if API is online
    try {
      let res = null;
      if (lat !== null && lon !== null) {
        res = await orbitApi.getPasses({ lat, lon, alt_m: altitudeM, norad_id: noradId });
      } else {
        res = await orbitApi.getPasses({ city: rawCity, norad_id: noradId });
      }
      if (res && res.passes && res.passes.length > 0) {
        set({ passesData: res, passesError: null, passesLoading: false });
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
          passesLoading: false,
        });
        return;
      }

      const station = resolveLocationClient(rawCity, lat, lon, altitudeM);
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
        passesLoading: false,
      });
    } catch (clientErr) {
      console.error('Client-side pass prediction failed:', clientErr);
      set({
        passesData: null,
        passesError: 'Failed to evaluate pass predictions for this location',
        passesLoading: false,
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

}));

/**
 * Returns current deep-linkable URL encoding active norad selection and simulation speed.
 */
export const getShareableUrl = () => {
  if (typeof window === 'undefined') return 'https://orbit-guard-tan.vercel.app';
  const state = useOrbitStore.getState();

  const isDesktopOrFile =
    typeof window !== 'undefined' &&
    (window.location.protocol === 'file:' || Boolean(window.orbitguardPlatform?.isDesktop));

  const baseOrigin = isDesktopOrFile ? 'https://orbit-guard-tan.vercel.app' : window.location.origin;
  const basePath = isDesktopOrFile ? '/' : window.location.pathname;

  const url = new URL(basePath, baseOrigin);

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

