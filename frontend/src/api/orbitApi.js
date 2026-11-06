/**
 * OrbitGuard API Client
 * Facilitates REST interactions with the Python FastAPI backend.
 */

import axios from 'axios';

// Detect whether running in Vite dev with proxy or direct connection
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const orbitApi = {
  /**
   * Fetch active satellites with positions and risk scores
   */
  getSatellites: async (params = {}) => {
    const response = await apiClient.get('/api/satellites', { params });
    return response.data;
  },

  /**
   * Fetch individual satellite details and full 3D orbit trajectory points
   */
  getSatelliteDetail: async (noradId) => {
    const response = await apiClient.get(`/api/satellite/${noradId}`);
    return response.data;
  },

  /**
   * Fetch cataloged space debris objects
   */
  getDebris: async (limit = null) => {
    const response = await apiClient.get('/api/debris', { params: { limit } });
    return response.data;
  },

  /**
   * Fetch global risk summary, top 10 high-risk satellites, shell counts, and heatmap
   */
  getRiskOverview: async () => {
    const response = await apiClient.get('/api/risk');
    return response.data;
  },

  /**
   * Fetch detailed risk analysis for a specific satellite
   */
  getSatelliteRisk: async (noradId) => {
    const response = await apiClient.get(`/api/risk/${noradId}`);
    return response.data;
  },

  /**
   * Fetch 24-hour predicted conjunction alerts
   */
  getConjunctions: async () => {
    const response = await apiClient.get('/api/conjunctions');
    return response.data;
  },

  /**
   * Fetch ground station pass predictions and ground track
   */
  getPasses: async (params = {}) => {
    const response = await apiClient.get('/api/passes', { params });
    return response.data;
  },

  /**
   * Fetch curated ground stations
   */
  getGroundStations: async () => {
    const response = await apiClient.get('/api/ground-stations');
    return response.data;
  },

  /**
   * Fetch macro statistics & charts data
   */
  getAnalytics: async () => {
    const response = await apiClient.get('/api/analytics');
    return response.data;
  },

  /**
   * Trigger immediate TLE refresh from CelesTrak
   */
  refreshTLE: async () => {
    const response = await apiClient.post('/api/refresh');
    return response.data;
  },
};

export default orbitApi;
