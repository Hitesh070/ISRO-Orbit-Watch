/**
 * OrbitGuard Client-Side Topocentric Pass Predictor Engine
 * ========================================================
 * High-precision, zero-latency satellite pass opportunity prediction directly
 * inside the browser using satellite.js and WGS84 topocentric coordinate transforms.
 *
 * Replaces server-side Skyfield dependencies to minimize serverless cold-start latency.
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
}

const COMPASS_POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'N'];

export function radiansToDegrees(rad: number): number {
  return (rad * 180.0) / Math.PI;
}

export function degreesToRadians(deg: number): number {
  return (deg * Math.PI) / 180.0;
}

export function azimuthToCompass(azDeg: number): string {
  const norm = (azDeg % 360 + 360) % 360;
  const idx = Math.round(norm / 45) % 8;
  return COMPASS_POINTS[idx];
}

/**
 * Predicts upcoming pass opportunities for a satellite over an observer location.
 *
 * @param line1 TLE line 1
 * @param line2 TLE line 2
 * @param observer Observer ground station coordinates
 * @param daysAhead Search window in days (default: 3)
 * @param minElevationDeg Elevation mask threshold in degrees (default: 10.0)
 * @param maxPasses Maximum number of pass opportunities to return (default: 8)
 */
export function predictPassesClient(
  line1: string,
  line2: string,
  observer: GroundStation,
  daysAhead = 3,
  minElevationDeg = 10.0,
  maxPasses = 8
): SatellitePass[] {
  let satrec: satellite.SatRec;
  try {
    satrec = satellite.twoline2satrec(line1, line2);
    if (!satrec || (satrec.error && satrec.error !== 0)) {
      return [];
    }
  } catch (err) {
    return [];
  }

  const observerGd: satellite.GeodeticLocation = {
    longitude: degreesToRadians(observer.lon),
    latitude: degreesToRadians(observer.lat),
    height: observer.altM / 1000.0, // km
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
      if (durationSec >= 90) { // Filter out momentary horizon clips
        const minutes = Math.floor(durationSec / 60);
        const seconds = durationSec % 60;

        let quality: 'EXCELLENT' | 'GOOD' | 'FAIR' = 'FAIR';
        if (maxEl >= 50) quality = 'EXCELLENT';
        else if (maxEl >= 25) quality = 'GOOD';

        passes.push({
          aosTimeIso: new Date(passStartTime).toISOString(),
          culminationTimeIso: new Date(maxElTime).toISOString(),
          losTimeIso: new Date(passEndTime).toISOString(),
          aosEpoch: Math.floor(passStartTime / 1000),
          culminationEpoch: Math.floor(maxElTime / 1000),
          losEpoch: Math.floor(passEndTime / 1000),
          maxElevationDeg: Number(maxEl.toFixed(1)),
          aosAzimuthDeg: Number(aosAz.toFixed(1)),
          culminationAzimuthDeg: Number(maxElAz.toFixed(1)),
          losAzimuthDeg: Number(losAz.toFixed(1)),
          aosDirection: azimuthToCompass(aosAz),
          losDirection: azimuthToCompass(losAz),
          durationSeconds: durationSec,
          durationStr: `${minutes}m ${seconds}s`,
          quality,
          minDistanceKm: Number(minRange.toFixed(1)),
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
