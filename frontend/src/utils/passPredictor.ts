/**
 * OrbitGuard Client-Side Topocentric Pass Predictor Engine
 * ========================================================
 * High-precision, zero-latency satellite pass opportunity prediction directly
 * inside the browser using satellite.js and WGS84 topocentric coordinate transforms.
 *
 * Provides offline-first pass predictions and ground track calculations even
 * when backend services are offline.
 */

import * as satellite from 'satellite.js';

export interface GroundStation {
  name: string;
  city: string;
  country: string;
  lat: number;   // degrees (-90 to +90)
  lon: number;   // degrees (-180 to +180)
  altM: number;  // meters above sea level
}

export interface SatellitePass {
  // Primary camelCase attributes
  aosTimeIso: string;
  culminationTimeIso: string;
  losTimeIso: string;
  aosEpoch: number;
  culminationEpoch: number;
  losEpoch: number;
  maxElevationDeg: number;
  aosAzimuthDeg: number;
  culminationAzimuthDeg: number;
  losAzimuthDeg: number;
  aosDirection: string;
  losDirection: string;
  durationSeconds: number;
  durationStr: string;
  quality: 'EXCELLENT' | 'GOOD' | 'FAIR';
  minDistanceKm: number;

  // Snake_case aliases for UI & API compatibility
  aos_time?: string;
  culmination_time?: string;
  los_time?: string;
  max_elevation?: number;
  aos_azimuth?: number;
  culmination_azimuth?: number;
  los_azimuth?: number;
  aos_direction?: string;
  los_direction?: string;
  duration?: string;
  trajectory_summary?: string;
}

export interface GroundTrackPoint {
  lat: number;
  lon: number;
  alt_km: number;
  timestamp: string;
  is_current: boolean;
}

// Predefined global space centers & ground stations
export const FAMOUS_GROUND_STATIONS: GroundStation[] = [
  { name: 'Satish Dhawan Space Centre (SDSC SHAR)', city: 'Sriharikota', country: 'India', lat: 13.7199, lon: 80.2304, altM: 10 },
  { name: 'ISTRAC Ground Station', city: 'Bengaluru', country: 'India', lat: 12.9716, lon: 77.5946, altM: 920 },
  { name: 'New Delhi Earth Station', city: 'New Delhi', country: 'India', lat: 28.6139, lon: 77.2090, altM: 216 },
  { name: 'Mumbai Marine Gateway', city: 'Mumbai', country: 'India', lat: 19.0760, lon: 72.8777, altM: 14 },
  { name: 'Cape Canaveral Space Force Station', city: 'Cape Canaveral', country: 'USA', lat: 28.3922, lon: -80.6077, altM: 3 },
  { name: 'Johnson Space Center (NASA JSC)', city: 'Houston', country: 'USA', lat: 29.5593, lon: -95.0900, altM: 6 },
  { name: 'London Ground Station', city: 'London', country: 'UK', lat: 51.5074, lon: -0.1278, altM: 35 },
  { name: 'Tsukuba Space Center (JAXA)', city: 'Tokyo', country: 'Japan', lat: 36.0667, lon: 140.1264, altM: 25 },
  { name: 'Sydney Ground Terminal', city: 'Sydney', country: 'Australia', lat: -33.8688, lon: 151.2093, altM: 19 },
  { name: 'Guiana Space Centre (CSG)', city: 'Kourou', country: 'French Guiana', lat: 5.2390, lon: -52.7680, altM: 15 },
];

const COMPASS_POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'N'];

export function radiansToDegrees(rad: number): number {
  return (rad * 180.0) / Math.PI;
}

export function degreesToRadians(deg: number): number {
  return (deg * Math.PI) / 180.0;
}

export function azimuthToCompass(azDeg: number): string {
  const norm = ((azDeg % 360) + 360) % 360;
  const idx = Math.round(norm / 45) % 8;
  return COMPASS_POINTS[idx];
}

/**
 * Resolves a city name, "lat,lon" coordinates, or explicit numbers into a valid GroundStation.
 */
export function resolveLocationClient(
  cityOrCoord?: string,
  explicitLat?: number | null,
  explicitLon?: number | null
): GroundStation {
  if (
    typeof explicitLat === 'number' &&
    !isNaN(explicitLat) &&
    typeof explicitLon === 'number' &&
    !isNaN(explicitLon)
  ) {
    return {
      name: `Custom Ground Station (${explicitLat.toFixed(2)}°, ${explicitLon.toFixed(2)}°)`,
      city: cityOrCoord || 'Custom Location',
      country: 'User Coordinates',
      lat: explicitLat,
      lon: explicitLon,
      altM: 100,
    };
  }

  const raw = (cityOrCoord || '').trim();
  if (raw.includes(',')) {
    const parts = raw.split(',');
    const pLat = parseFloat(parts[0]);
    const pLon = parseFloat(parts[1]);
    if (!isNaN(pLat) && !isNaN(pLon)) {
      return {
        name: `Custom Ground Station (${pLat.toFixed(2)}°, ${pLon.toFixed(2)}°)`,
        city: 'Custom GPS',
        country: 'User Coordinates',
        lat: pLat,
        lon: pLon,
        altM: 100,
      };
    }
  }

  const q = raw.toLowerCase();
  for (const st of FAMOUS_GROUND_STATIONS) {
    if (
      st.city.toLowerCase() === q ||
      st.city.toLowerCase().includes(q) ||
      st.name.toLowerCase().includes(q)
    ) {
      return st;
    }
  }

  // Default to ISTRAC Ground Station (Bengaluru, ISRO HQ)
  return FAMOUS_GROUND_STATIONS[1];
}

/**
 * Predicts upcoming pass opportunities for a satellite over an observer location.
 *
 * @param line1 TLE line 1
 * @param line2 TLE line 2
 * @param observer Observer ground station coordinates
 * @param daysAhead Search window in days (default: 5)
 * @param minElevationDeg Elevation mask threshold in degrees (default: 10.0)
 * @param maxPasses Maximum number of pass opportunities to return (default: 8)
 */
export function predictPassesClient(
  line1: string,
  line2: string,
  observer: GroundStation,
  daysAhead = 5,
  minElevationDeg = 10.0,
  maxPasses = 8
): SatellitePass[] {
  let satrec: satellite.SatRec;
  try {
    satrec = satellite.twoline2satrec(line1, line2);
    if (!satrec || (satrec.error && satrec.error !== 0)) {
      return [];
    }
  } catch {
    return [];
  }

  const observerGd: satellite.GeodeticLocation = {
    longitude: degreesToRadians(observer.lon),
    latitude: degreesToRadians(observer.lat),
    height: (observer.altM || 100) / 1000.0, // km
  };

  const startTimeMs = Date.now();
  const endTimeMs = startTimeMs + daysAhead * 24 * 60 * 60 * 1000;
  const stepMs = 30 * 1000; // 30-second coarse step for detection

  const passes: SatellitePass[] = [];

  let inPass = false;
  let passStartTime = 0;
  let maxEl = -90;
  let maxElTime = 0;
  let maxElAz = 0;
  let minRange = Infinity;
  let aosAz = 0;

  for (let t = startTimeMs; t < endTimeMs; t += stepMs) {
    const d = new Date(t);
    const pv = satellite.propagate(satrec, d);
    if (!pv.position || typeof pv.position === 'boolean') continue;

    const gmst = satellite.gstime(d);
    const posEcf = satellite.eciToEcf(pv.position, gmst);
    const lookAngles = satellite.ecfToLookAngles(observerGd, posEcf);

    const elDeg = radiansToDegrees(lookAngles.elevation);
    const azDeg = radiansToDegrees(lookAngles.azimuth);
    const rangeKm = lookAngles.rangeSat;

    if (elDeg >= minElevationDeg) {
      if (!inPass) {
        // Acquisition of Signal (AOS)
        inPass = true;
        passStartTime = t;
        aosAz = azDeg;
        maxEl = elDeg;
        maxElTime = t;
        maxElAz = azDeg;
        minRange = rangeKm;
      } else {
        if (elDeg > maxEl) {
          maxEl = elDeg;
          maxElTime = t;
          maxElAz = azDeg;
          minRange = Math.min(minRange, rangeKm);
        }
      }
    } else if (inPass) {
      // Loss of Signal (LOS)
      inPass = false;
      const passEndTime = t;
      const losAz = azDeg;

      const durationSec = Math.round((passEndTime - passStartTime) / 1000);
      if (durationSec >= 90) {
        // Filter out momentary horizon clips
        const minutes = Math.floor(durationSec / 60);
        const seconds = durationSec % 60;

        let quality: 'EXCELLENT' | 'GOOD' | 'FAIR' = 'FAIR';
        if (maxEl >= 50) quality = 'EXCELLENT';
        else if (maxEl >= 25) quality = 'GOOD';

        const aosIso = new Date(passStartTime).toISOString();
        const maxIso = new Date(maxElTime).toISOString();
        const losIso = new Date(passEndTime).toISOString();
        const durStr = `${minutes}m ${seconds}s`;
        const aosDir = azimuthToCompass(aosAz);
        const losDir = azimuthToCompass(losAz);

        passes.push({
          aosTimeIso: aosIso,
          culminationTimeIso: maxIso,
          losTimeIso: losIso,
          aosEpoch: Math.floor(passStartTime / 1000),
          culminationEpoch: Math.floor(maxElTime / 1000),
          losEpoch: Math.floor(passEndTime / 1000),
          maxElevationDeg: Number(maxEl.toFixed(1)),
          aosAzimuthDeg: Number(aosAz.toFixed(1)),
          culminationAzimuthDeg: Number(maxElAz.toFixed(1)),
          losAzimuthDeg: Number(losAz.toFixed(1)),
          aosDirection: aosDir,
          losDirection: losDir,
          durationSeconds: durationSec,
          durationStr: durStr,
          quality,
          minDistanceKm: Number(minRange.toFixed(1)),

          // Snake_case aliases for PassPredictor table
          aos_time: aosIso,
          culmination_time: maxIso,
          los_time: losIso,
          max_elevation: Number(maxEl.toFixed(1)),
          aos_azimuth: Number(aosAz.toFixed(1)),
          culmination_azimuth: Number(maxElAz.toFixed(1)),
          los_azimuth: Number(losAz.toFixed(1)),
          aos_direction: aosDir,
          los_direction: losDir,
          duration: durStr,
          trajectory_summary: `${aosDir} → ${losDir}`,
        });

        if (passes.length >= maxPasses) break;
      }

      // Reset
      maxEl = -90;
      minRange = Infinity;
    }
  }

  return passes;
}

/**
 * Computes 2D ground track coordinate points for a satellite over a time window.
 */
export function computeGroundTrackClient(
  line1: string,
  line2: string,
  pastMinutes = 45,
  futureMinutes = 45,
  stepMinutes = 2
): GroundTrackPoint[] {
  let satrec: satellite.SatRec;
  try {
    satrec = satellite.twoline2satrec(line1, line2);
    if (!satrec || (satrec.error && satrec.error !== 0)) return [];
  } catch {
    return [];
  }

  const nowMs = Date.now();
  const startMs = nowMs - pastMinutes * 60 * 1000;
  const totalSteps = Math.floor((pastMinutes + futureMinutes) / stepMinutes);
  const points: GroundTrackPoint[] = [];

  for (let i = 0; i <= totalSteps; i++) {
    const t = startMs + i * stepMinutes * 60 * 1000;
    const date = new Date(t);
    const pv = satellite.propagate(satrec, date);
    if (!pv.position || typeof pv.position === 'boolean') continue;

    const gmst = satellite.gstime(date);
    const geo = satellite.eciToGeodetic(pv.position, gmst);
    const lat = Number(radiansToDegrees(geo.latitude).toFixed(4));
    let lon = Number(radiansToDegrees(geo.longitude).toFixed(4));
    if (lon > 180) lon -= 360;
    if (lon < -180) lon += 360;

    const altKm = Number(geo.height.toFixed(1));
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const mins = String(date.getUTCMinutes()).padStart(2, '0');
    const secs = String(date.getUTCSeconds()).padStart(2, '0');
    const isCurrent = Math.abs(t - nowMs) < (stepMinutes * 60 * 1000) / 2;

    points.push({
      lat,
      lon,
      alt_km: altKm,
      timestamp: `${hours}:${mins}:${secs}`,
      is_current: isCurrent,
    });
  }

  return points;
}
