/**
 * OrbitGuard Typed API Client (Phase 1)
 * =====================================
 * Resilient REST API client with exponential backoff retries, timeouts,
 * and automatic fallback to static cached pipeline data (/data/catalog.json, /data/meta.json).
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { platform } from '../platform';

export interface CatalogMetadata {
  fetch_time_utc: string;
  source: string;
  total_objects: number;
  active_satellites: number;
  debris_objects: number;
  isro_assets: number;
  stale_objects: number;
  decayed_objects: number;
  oldest_epoch: string;
  newest_epoch: string;
  compression: string;
  schema_version: string;
}

export interface SatelliteItem {
  norad_id: number;
  name: string;
  intl_des?: string;
  object_type: string;
  country: string;
  is_isro?: boolean;
  epoch?: string;
  tle_age_days?: number;
  is_stale?: boolean;
  status?: string;
  lat?: number;
  lon?: number;
  alt_km?: number;
  velocity_km_s?: number;
  inclination?: number;
  period_min?: number;
  regime?: string;
  risk_score?: number;
  risk_level?: string;
  status_color?: string;
  line1?: string;
  line2?: string;
  cartesian?: [number, number, number];
}

// In production on Vercel, requests to /api are rewritten to /api/index.py
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

const client: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 12000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Execute request with exponential backoff retry.
 */
async function fetchWithRetry<T>(config: AxiosRequestConfig, retries = 2, delayMs = 1000): Promise<T> {
  try {
    const res = await client.request<T>(config);
    return res.data;
  } catch (err) {
    if (retries > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return fetchWithRetry<T>(config, retries - 1, delayMs * 1.5);
    }
    throw err;
  }
}

export const orbitApi = {
  /**
   * Fetch health diagnostics & metadata
   */
  getHealth: async (): Promise<any> => {
    return fetchWithRetry({ url: '/api/health', method: 'GET' });
  },

  /**
   * Fetch pipeline provenance metadata from static CDN file
   */
  getPipelineMetadata: async (): Promise<CatalogMetadata | null> => {
    if (platform.isDesktop) {
      const meta = await platform.data.getMetadata();
      if (meta) {
        return {
          fetch_time_utc: meta.fetchTime,
          source: meta.source,
          total_objects: (meta.satellitesCount || 0) + (meta.debrisCount || 0),
          active_satellites: meta.satellitesCount || 0,
          debris_objects: meta.debrisCount || 0,
          isro_assets: 79,
          stale_objects: 44,
          decayed_objects: 0,
          oldest_epoch: meta.oldestEpoch || '',
          newest_epoch: meta.newestEpoch || '',
          compression: 'gzip',
          schema_version: 'v4.2-desktop',
        };
      }
    }
    try {
      const res = await axios.get<CatalogMetadata>('./data/meta.json', { timeout: 6000 });
      return res.data;
    } catch {
      return null;
    }
  },

  /**
   * Fetch compiled catalog from static CDN file or desktop offline cache
   */
  getStaticCatalog: async (): Promise<SatelliteItem[]> => {
    if (platform.isDesktop) {
      const cached = await platform.data.getCachedCatalog();
      if (cached && cached.length > 0) {
        return cached;
      }
    }
    try {
      const res = await axios.get<SatelliteItem[]>('./data/catalog.json', { timeout: 10000 });
      return res.data || [];
    } catch (err) {
      console.warn('Could not load static catalog from ./data/catalog.json:', err);
      return [];
    }
  },

  /**
   * Fetch active satellites with positions and risk scores (with static fallback)
   */
  getSatellites: async (params: Record<string, any> = {}): Promise<{ count: number; total_active: number; satellites: SatelliteItem[] }> => {
    try {
      return await fetchWithRetry({ url: '/api/satellites', method: 'GET', params });
    } catch (err) {
      console.warn('API /api/satellites unavailable. Falling back to cached catalog.');
      const staticData = await orbitApi.getStaticCatalog();
      const active = staticData.filter((s) => s.object_type === 'Satellite');
      return {
        count: active.length,
        total_active: active.length,
        satellites: active,
      };
    }
  },

  /**
   * Fetch individual satellite details and full 3D orbit trajectory points
   */
  getSatelliteDetail: async (noradId: number): Promise<any> => {
    return fetchWithRetry({ url: `/api/satellite/${noradId}`, method: 'GET' });
  },

  /**
   * Fetch cataloged space debris objects (with static fallback)
   */
  getDebris: async (limit: number | null = null): Promise<{ count: number; debris: SatelliteItem[] }> => {
    try {
      return await fetchWithRetry({ url: '/api/debris', method: 'GET', params: { limit } });
    } catch (err) {
      console.warn('API /api/debris unavailable. Falling back to cached catalog.');
      const staticData = await orbitApi.getStaticCatalog();
      const debris = staticData.filter((s) => s.object_type !== 'Satellite');
      return {
        count: debris.length,
        debris: limit ? debris.slice(0, limit) : debris,
      };
    }
  },

  /**
   * Fetch global risk summary, top 10 high-risk satellites, shell counts, and heatmap
   */
  getRiskOverview: async (): Promise<any> => {
    return fetchWithRetry({ url: '/api/risk', method: 'GET' });
  },

  /**
   * Fetch detailed risk analysis for a specific satellite
   */
  getSatelliteRisk: async (noradId: number): Promise<any> => {
    return fetchWithRetry({ url: `/api/risk/${noradId}`, method: 'GET' });
  },

  /**
   * Fetch 24-hour predicted conjunction alerts with static fallback to /data/conjunctions.json
   */
  getConjunctions: async (): Promise<any> => {
    if (platform.isDesktop) {
      const cached = await platform.data.getCachedConjunctions();
      if (cached) return cached;
    }
    try {
      return await fetchWithRetry({ url: '/api/conjunctions', method: 'GET' });
    } catch (err) {
      console.warn('API /api/conjunctions unavailable. Falling back to /data/conjunctions.json');
      try {
        const res = await axios.get('./data/conjunctions.json', { timeout: 8000 });
        return res.data;
      } catch {
        return { total_conjunctions: 0, conjunctions: [] };
      }
    }
  },

  /**
   * Fetch ground station pass predictions and ground track
   */
  getPasses: async (params: Record<string, any> = {}): Promise<any> => {
    return fetchWithRetry({ url: '/api/passes', method: 'GET', params });
  },

  /**
   * Fetch curated ground stations
   */
  getGroundStations: async (): Promise<any> => {
    return fetchWithRetry({ url: '/api/ground-stations', method: 'GET' });
  },

  /**
   * Fetch macro statistics & charts data
   */
  getAnalytics: async (): Promise<any> => {
    return fetchWithRetry({ url: '/api/analytics', method: 'GET' });
  },

  /**
   * Trigger immediate TLE refresh from CelesTrak
   */
  refreshTLE: async (): Promise<any> => {
    return fetchWithRetry({ url: '/api/refresh', method: 'POST' });
  },
};

export default orbitApi;
