/**
 * OrbitGuard High-Precision Pass Planner & RF Analysis Engine
 * ============================================================
 * Provides sub-second bisection AOS/TCA/LOS refinement, look-angle trajectory time-series,
 * Doppler profiles, polar sky track projections, and standard .ics / .csv export formats.
 */

import * as satellite from 'satellite.js';
import { rangeRateKmS, dopplerShiftHz } from './doppler';
import { fsplDb, computeLinkBudget, LINK_BUDGET_PRESETS } from './linkBudget';

export interface ObserverSite {
  lat: number;   // degrees (-90 to +90)
  lon: number;   // degrees (-180 to +180)
  altM: number;  // meters above sea level
  name: string;
}

export interface PassSample {
  timeIso: string;
  epochMs: number;
  azDeg: number;
  elDeg: number;
  rangeKm: number;
  rangeRateKmS: number;
  dopplerShiftHz: number;
  fsplDb: number;
  marginDb: number;
}

export interface DetailedPass {
  id: string;
  satName: string;
  noradId: number;
  aosTimeIso: string;
  tcaTimeIso: string;
  losTimeIso: string;
  aosEpochMs: number;
  tcaEpochMs: number;
  losEpochMs: number;
  durationSeconds: number;
  maxElevationDeg: number;
  aosAzimuthDeg: number;
  tcaAzimuthDeg: number;
  losAzimuthDeg: number;
  minRangeKm: number;
  maxDopplerShiftHz: number;
  maxDopplerRateHzS: number;
  quality: 'EXCELLENT' | 'GOOD' | 'FAIR';
  samples: PassSample[];
}

const EARTH_RADIUS_KM = 6378.137;

/**
 * Calculates topocentric look angles and range rate for an observer at time t
 */
function getLookAngles(
  satrec: satellite.SatRec,
  observerGd: satellite.GeodeticLocation,
  date: Date
) {
  const pv = satellite.propagate(satrec, date);
  if (!pv.position || typeof pv.position === 'boolean' || !pv.velocity || typeof pv.velocity === 'boolean') {
    return null;
  }

  const gmst = satellite.gstime(date);
  const posEcf = satellite.eciToEcf(pv.position, gmst);
  const lookAngles = satellite.ecfToLookAngles(observerGd, posEcf);

  const elDeg = (lookAngles.elevation * 180.0) / Math.PI;
  const azDeg = ((lookAngles.azimuth * 180.0) / Math.PI + 360.0) % 360.0;
  const rangeKm = lookAngles.rangeSat;

  // Convert observer to ECI to compute precise range rate with Earth rotation
  const obsEcf = satellite.geodeticToEcf(observerGd);
  const obsEci = satellite.ecfToEci(obsEcf, gmst);

  const rSat: [number, number, number] = [pv.position.x, pv.position.y, pv.position.z];
  const vSat: [number, number, number] = [pv.velocity.x, pv.velocity.y, pv.velocity.z];
  const rObs: [number, number, number] = [obsEci.x, obsEci.y, obsEci.z];

  const rrKmS = rangeRateKmS(rSat, vSat, rObs);

  return { elDeg, azDeg, rangeKm, rrKmS };
}

/**
 * Bisects between t1 and t2 to find exact crossing of elevationMaskDeg within 1 second.
 */
function refineElevationCrossing(
  satrec: satellite.SatRec,
  observerGd: satellite.GeodeticLocation,
  t1Ms: number,
  t2Ms: number,
  elevationMaskDeg: number
): number {
  let left = t1Ms;
  let right = t2Ms;

  for (let i = 0; i < 15; i++) {
    if (Math.abs(right - left) < 500) break;
    const mid = (left + right) / 2;
    const look = getLookAngles(satrec, observerGd, new Date(mid));
    if (!look) break;

    const lookLeft = getLookAngles(satrec, observerGd, new Date(left));
    if (!lookLeft) break;

    if ((lookLeft.elDeg - elevationMaskDeg) * (look.elDeg - elevationMaskDeg) <= 0) {
      right = mid;
    } else {
      left = mid;
    }
  }

  return Math.round((left + right) / 2);
}

/**
 * Finds exact Time of Closest Approach (TCA) / maximum elevation using Golden Section Search.
 */
function refineTca(
  satrec: satellite.SatRec,
  observerGd: satellite.GeodeticLocation,
  t1Ms: number,
  t2Ms: number
): { tcaMs: number; maxElDeg: number; tcaAzDeg: number; minRangeKm: number } {
  const phi = (1 + Math.sqrt(5)) / 2;
  const resphi = 2 - phi;

  let a = t1Ms;
  let b = t2Ms;
  let c = a + resphi * (b - a);
  let d = b - resphi * (b - a);

  let lookC = getLookAngles(satrec, observerGd, new Date(c));
  let lookD = getLookAngles(satrec, observerGd, new Date(d));

  let elC = lookC?.elDeg ?? -90;
  let elD = lookD?.elDeg ?? -90;

  for (let i = 0; i < 20; i++) {
    if (Math.abs(b - a) < 500) break;

    if (elC < elD) {
      a = c;
      c = d;
      elC = elD;
      d = b - resphi * (b - a);
      lookD = getLookAngles(satrec, observerGd, new Date(d));
      elD = lookD?.elDeg ?? -90;
    } else {
      b = d;
      d = c;
      elD = elC;
      c = a + resphi * (b - a);
      lookC = getLookAngles(satrec, observerGd, new Date(c));
      elC = lookC?.elDeg ?? -90;
    }
  }

  const bestTca = Math.round((a + b) / 2);
  const lookBest = getLookAngles(satrec, observerGd, new Date(bestTca));

  return {
    tcaMs: bestTca,
    maxElDeg: lookBest ? Number(lookBest.elDeg.toFixed(2)) : 0,
    tcaAzDeg: lookBest ? Number(lookBest.azDeg.toFixed(2)) : 0,
    minRangeKm: lookBest ? Number(lookBest.rangeKm.toFixed(2)) : 1000,
  };
}

/**
 * Predicts and analyses detailed passes for a satellite with full RF telemetry time-series.
 */
export function predictDetailedPasses(
  line1: string,
  line2: string,
  satName: string,
  noradId: number,
  observer: ObserverSite,
  carrierFreqHz = 437.5e6,
  elevationMaskDeg = 5.0,
  searchHours = 48,
  maxPasses = 10
): DetailedPass[] {
  let satrec: satellite.SatRec;
  try {
    satrec = satellite.twoline2satrec(line1, line2);
    if (!satrec || (satrec.error && satrec.error !== 0)) return [];
  } catch {
    return [];
  }

  const observerGd: satellite.GeodeticLocation = {
    latitude: (observer.lat * Math.PI) / 180.0,
    longitude: (observer.lon * Math.PI) / 180.0,
    height: Math.max(observer.altM, 0) / 1000.0, // km
  };

  const startMs = Date.now();
  const endMs = startMs + searchHours * 3600 * 1000;
  const coarseStepMs = 30 * 1000; // 30s screening step

  const passes: DetailedPass[] = [];
  let inPass = false;
  let passStartCandidate = 0;
  let passPrevCandidate = 0;
  let coarseMaxEl = -90;
  let coarseMaxElTime = 0;

  for (let t = startMs; t <= endMs; t += coarseStepMs) {
    const look = getLookAngles(satrec, observerGd, new Date(t));
    if (!look) continue;

    if (look.elDeg >= elevationMaskDeg) {
      if (!inPass) {
        inPass = true;
        passStartCandidate = t;
        passPrevCandidate = t - coarseStepMs;
        coarseMaxEl = look.elDeg;
        coarseMaxElTime = t;
      } else {
        if (look.elDeg > coarseMaxEl) {
          coarseMaxEl = look.elDeg;
          coarseMaxElTime = t;
        }
      }
    } else if (inPass) {
      inPass = false;
      const passEndCandidate = t;
      const passPrevEnd = t - coarseStepMs;

      // Refine AOS and LOS to < 1s precision
      const refinedAosMs = refineElevationCrossing(satrec, observerGd, passPrevCandidate, passStartCandidate, elevationMaskDeg);
      const refinedLosMs = refineElevationCrossing(satrec, observerGd, passPrevEnd, passEndCandidate, elevationMaskDeg);

      const durationSec = Math.round((refinedLosMs - refinedAosMs) / 1000);

      // Filter out spurious or horizon skimming passes (< 60s)
      if (durationSec >= 60) {
        // Refine TCA and max elevation
        const { tcaMs, maxElDeg, tcaAzDeg, minRangeKm } = refineTca(
          satrec,
          observerGd,
          Math.max(refinedAosMs, coarseMaxElTime - 45000),
          Math.min(refinedLosMs, coarseMaxElTime + 45000)
        );

        const lookAos = getLookAngles(satrec, observerGd, new Date(refinedAosMs));
        const lookLos = getLookAngles(satrec, observerGd, new Date(refinedLosMs));

        // Generate high-resolution time series for charts (every 10s during pass)
        const samples: PassSample[] = [];
        let maxDoppler = 0;
        let maxDopplerRate = 0;

        const sampleStepMs = Math.max(5000, Math.floor((refinedLosMs - refinedAosMs) / 40));
        let prevSample: PassSample | null = null;

        for (let st = refinedAosMs; st <= refinedLosMs; st += sampleStepMs) {
          const sLook = getLookAngles(satrec, observerGd, new Date(st));
          if (!sLook) continue;

          const dShift = dopplerShiftHz(carrierFreqHz, sLook.rrKmS);
          const fspl = fsplDb(sLook.rangeKm, carrierFreqHz / 1e6);

          // Evaluate link budget for standard UHF cubesat preset along pass
          const lb = computeLinkBudget({
            ...LINK_BUDGET_PRESETS.UHF_CUBESAT,
            carrierFreqHz,
            slantRangeKm: sLook.rangeKm,
            elevationDeg: sLook.elDeg,
          });

          const sample: PassSample = {
            timeIso: new Date(st).toISOString(),
            epochMs: st,
            azDeg: Number(sLook.azDeg.toFixed(1)),
            elDeg: Number(sLook.elDeg.toFixed(1)),
            rangeKm: Number(sLook.rangeKm.toFixed(1)),
            rangeRateKmS: Number(sLook.rrKmS.toFixed(3)),
            dopplerShiftHz: Number(dShift.toFixed(1)),
            fsplDb: Number(fspl.toFixed(1)),
            marginDb: Number(lb.marginDb.toFixed(1)),
          };

          if (Math.abs(dShift) > maxDoppler) maxDoppler = Math.abs(dShift);

          if (prevSample) {
            const dt = (st - prevSample.epochMs) / 1000.0;
            const rate = Math.abs((sample.dopplerShiftHz - prevSample.dopplerShiftHz) / dt);
            if (rate > maxDopplerRate) maxDopplerRate = rate;
          }

          samples.push(sample);
          prevSample = sample;
        }

        let quality: 'EXCELLENT' | 'GOOD' | 'FAIR' = 'FAIR';
        if (maxElDeg >= 45) quality = 'EXCELLENT';
        else if (maxElDeg >= 20) quality = 'GOOD';

        passes.push({
          id: `${noradId}-${refinedAosMs}`,
          satName,
          noradId,
          aosTimeIso: new Date(refinedAosMs).toISOString(),
          tcaTimeIso: new Date(tcaMs).toISOString(),
          losTimeIso: new Date(refinedLosMs).toISOString(),
          aosEpochMs: refinedAosMs,
          tcaEpochMs: tcaMs,
          losEpochMs: refinedLosMs,
          durationSeconds: durationSec,
          maxElevationDeg: maxElDeg,
          aosAzimuthDeg: lookAos ? Number(lookAos.azDeg.toFixed(1)) : 0,
          tcaAzimuthDeg: tcaAzDeg,
          losAzimuthDeg: lookLos ? Number(lookLos.azDeg.toFixed(1)) : 0,
          minRangeKm,
          maxDopplerShiftHz: Number(maxDoppler.toFixed(1)),
          maxDopplerRateHzS: Number(maxDopplerRate.toFixed(2)),
          quality,
          samples,
        });

        if (passes.length >= maxPasses) break;
      }

      coarseMaxEl = -90;
    }
  }

  return passes;
}

/**
 * Generates an iCalendar (.ics) string for pass scheduling in Google/Apple/Outlook calendars.
 */
export function generatePassICS(passes: DetailedPass[]): string {
  const formatIcsDate = (date: Date) => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  let ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//OrbitGuard//Ground Station Pass Scheduler//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  for (const p of passes) {
    const aos = new Date(p.aosEpochMs);
    const los = new Date(p.losEpochMs);
    ics.push('BEGIN:VEVENT');
    ics.push(`UID:pass-${p.id}@orbitguard.space`);
    ics.push(`DTSTAMP:${formatIcsDate(new Date())}`);
    ics.push(`DTSTART:${formatIcsDate(aos)}`);
    ics.push(`DTEND:${formatIcsDate(los)}`);
    ics.push(`SUMMARY:🛰️ Satellite Pass: ${p.satName} (Max El: ${p.maxElevationDeg}°)`);
    ics.push(
      `DESCRIPTION:Satellite: ${p.satName} (NORAD ${p.noradId})\\n` +
      `Max Elevation: ${p.maxElevationDeg}° at ${new Date(p.tcaEpochMs).toUTCString()}\\n` +
      `AOS: ${p.aosAzimuthDeg}° Azimuth\\n` +
      `LOS: ${p.losAzimuthDeg}° Azimuth\\n` +
      `Duration: ${Math.floor(p.durationSeconds / 60)}m ${p.durationSeconds % 60}s\\n` +
      `Min Slant Range: ${p.minRangeKm} km\\n` +
      `Max Doppler Shift: ±${p.maxDopplerShiftHz} Hz\\n` +
      `Tracked via OrbitGuard SSA Platform.`
    );
    ics.push(`LOCATION:Observer Ground Station`);
    ics.push('STATUS:CONFIRMED');
    ics.push('END:VEVENT');
  }

  ics.push('END:VCALENDAR');
  return ics.join('\r\n');
}

/**
 * Generates CSV string for export to spreadsheets or ground-station logs.
 */
export function generatePassCSV(passes: DetailedPass[]): string {
  const headers = [
    'Satellite Name',
    'NORAD ID',
    'AOS UTC',
    'TCA UTC',
    'LOS UTC',
    'Duration (s)',
    'Max Elevation (deg)',
    'AOS Azimuth (deg)',
    'TCA Azimuth (deg)',
    'LOS Azimuth (deg)',
    'Min Range (km)',
    'Max Doppler Shift (Hz)',
    'Max Doppler Rate (Hz/s)',
    'Quality Rating',
  ];

  const rows = passes.map((p) => [
    `"${p.satName}"`,
    p.noradId,
    p.aosTimeIso,
    p.tcaTimeIso,
    p.losTimeIso,
    p.durationSeconds,
    p.maxElevationDeg,
    p.aosAzimuthDeg,
    p.tcaAzimuthDeg,
    p.losAzimuthDeg,
    p.minRangeKm,
    p.maxDopplerShiftHz,
    p.maxDopplerRateHzS,
    p.quality,
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

/**
 * Calculates satellite footprint ground radius in kilometers.
 * θ_fp = arccos(R_E / (R_E + altitude_km))
 * Footprint radius S = R_E * θ_fp
 */
export function getSatelliteFootprintRadiusKm(altitudeKm: number): number {
  if (altitudeKm <= 0) return 0;
  const centralAngleRad = Math.acos(EARTH_RADIUS_KM / (EARTH_RADIUS_KM + altitudeKm));
  return EARTH_RADIUS_KM * centralAngleRad;
}
