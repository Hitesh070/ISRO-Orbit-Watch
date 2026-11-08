/**
 * OrbitGuard Real-Time SGP4 Astrodynamics Engine
 * Continuous sub-second orbital position and velocity propagation directly in the browser
 * using official NORAD / CelesTrak Two-Line Element (TLE) sets and satellite.js.
 */

import * as satellite from 'satellite.js';

const EARTH_RADIUS_KM = 6378.137;

// Official TLE Catalog (Active satellites + High-Profile ISRO spacecraft + Debris fields)
export const OFFICIAL_TLE_CATALOG = [];

// Satrec entries are registered only from element sets supplied by the loaded catalog.
const SATREC_CACHE = new Map();

/**
 * Convert geodetic lat/lon/alt to Three.js Cartesian coordinate vector
 */
export function geodeticToCartesian(latDeg, lonDeg, altKm) {
  const latRad = (latDeg * Math.PI) / 180;
  const lonRad = (lonDeg * Math.PI) / 180;
  const r = (EARTH_RADIUS_KM + altKm) / EARTH_RADIUS_KM;

  const x = r * Math.cos(latRad) * Math.sin(lonRad);
  const y = r * Math.sin(latRad);
  const z = r * Math.cos(latRad) * Math.cos(lonRad);
  return [Number(x.toFixed(5)), Number(y.toFixed(5)), Number(z.toFixed(5))];
}

/**
 * Register or update TLE elements for a satellite to compile satrec into cache
 */
export function registerSatelliteTLE(noradId, line1, line2) {
  if (!noradId || !line1 || !line2) return null;
  const numId = Number(noradId);
  try {
    const satrec = satellite.twoline2satrec(line1, line2);
    if (satrec) {
      SATREC_CACHE.set(numId, satrec);
      return satrec;
    }
  } catch (err) {
    console.warn(`Failed compiling satrec for ${noradId}:`, err);
  }
  return null;
}

/**
 * Propagate a single satellite to the exact timestamp `date`
 */
export function propagateSatelliteRealTime(noradId, date = new Date(), line1 = null, line2 = null) {
  const numId = Number(noradId);
  if (!line1 || !line2) return null;
  const satrec = registerSatelliteTLE(numId, line1, line2);
  if (!satrec) return null;

  try {
    const pv = satellite.propagate(satrec, date);
    if (!pv.position || typeof pv.position === 'boolean' || !pv.velocity || typeof pv.velocity === 'boolean') return null;

    const gmst = satellite.gstime(date);
    const gd = satellite.eciToGeodetic(pv.position, gmst);

    const latDeg = satellite.degreesLat(gd.latitude);
    const lonDeg = satellite.degreesLong(gd.longitude);
    const altKm = gd.height;

    // Velocity magnitude in km/s
    const vx = pv.velocity.x;
    const vy = pv.velocity.y;
    const vz = pv.velocity.z;
    const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);

    // Compute radial climb rate in m/s: dr/dt = (r · v) / |r|
    const rMag = Math.sqrt(pv.position.x * pv.position.x + pv.position.y * pv.position.y + pv.position.z * pv.position.z);
    const vRadialKms = (pv.position.x * vx + pv.position.y * vy + pv.position.z * vz) / (rMag || 1);
    const radialRateMs = vRadialKms * 1000.0;

    const cartesian = geodeticToCartesian(latDeg, lonDeg, altKm);

    return {
      lat: Number(latDeg.toFixed(4)),
      lon: Number(lonDeg.toFixed(4)),
      alt_km: altKm,
      alt_km_display: Number(altKm.toFixed(3)),
      velocity_km_s: speed,
      velocity_km_s_display: Number(speed.toFixed(4)),
      vx: Number(vx.toFixed(3)),
      vy: Number(vy.toFixed(3)),
      vz: Number(vz.toFixed(3)),
      radial_rate_ms: radialRateMs,
      cartesian,
    };
  } catch (err) {
    return null;
  }
}

/**
 * Propagate entire catalog in real-time at the exact millisecond/sub-second timestamp
 */
export function propagateCatalogRealTime(date = new Date()) {
  const gmst = satellite.gstime(date);
  const activeSats = [];
  const debrisList = [];

  for (const item of OFFICIAL_TLE_CATALOG) {
    const satrec = SATREC_CACHE.get(item.norad_id);
    if (!satrec) continue;

    try {
      const pv = satellite.propagate(satrec, date);
      if (!pv.position) continue;

      const gd = satellite.eciToGeodetic(pv.position, gmst);
      const latDeg = satellite.degreesLat(gd.latitude);
      const lonDeg = satellite.degreesLong(gd.longitude);
      const altKm = gd.height;

      const vx = pv.velocity.x;
      const vy = pv.velocity.y;
      const vz = pv.velocity.z;
      const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
      const cartesian = geodeticToCartesian(latDeg, lonDeg, altKm);

      const updated = {
        ...item,
        lat: Number(latDeg.toFixed(4)),
        lon: Number(lonDeg.toFixed(4)),
        alt_km: Number(altKm.toFixed(2)),
        velocity_km_s: Number(speed.toFixed(3)),
        cartesian,
      };

      if (item.object_type === 'Satellite') {
        activeSats.push(updated);
      } else {
        debrisList.push(updated);
      }
    } catch (err) {
      continue;
    }
  }

  return { activeSats, debrisList };
}

/**
 * Sample 180 points over one full orbital period to render glowing orbit lines
 */
export function computeOrbitPathClient(noradId, numPoints = 180) {
  const satrec = SATREC_CACHE.get(noradId);
  if (!satrec) return [];

  try {
    const meanMotionRevPerDay = (satrec.no * 1440.0) / (2.0 * Math.PI);
    const periodMinutes = 1440.0 / meanMotionRevPerDay;
    const nowMs = Date.now();
    const points = [];

    for (let i = 0; i <= numPoints; i++) {
      const stepMs = nowMs + (i / numPoints) * periodMinutes * 60 * 1000;
      const d = new Date(stepMs);
      const pv = satellite.propagate(satrec, d);
      if (!pv.position) continue;

      const gmst = satellite.gstime(d);
      const gd = satellite.eciToGeodetic(pv.position, gmst);
      const lat = satellite.degreesLat(gd.latitude);
      const lon = satellite.degreesLong(gd.longitude);
      const alt = gd.height;

      points.push(geodeticToCartesian(lat, lon, alt));
    }

    return points;
  } catch (err) {
    return [];
  }
}
