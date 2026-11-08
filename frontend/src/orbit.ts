import {
  degreesToRadians,
  eciToEcf,
  eciToGeodetic,
  ecfToLookAngles,
  gstime,
  json2satrec,
  propagate,
  type OMMJsonObject,
  type SatRec,
} from 'satellite.js';
import type { OmmRecord, SatellitePosition } from './types';

export const EARTH_RADIUS_KM = 6378.137;

export function altitudeToEarthRadii(altitudeKm: number): number {
  return 1 + altitudeKm / EARTH_RADIUS_KM;
}

export function makeSatRec(record: OmmRecord): SatRec {
  return json2satrec({
    ...record,
    NORAD_CAT_ID: Number(record.NORAD_CAT_ID),
    MEAN_MOTION_DDOT: Number(record.MEAN_MOTION_DDOT ?? 0),
    BSTAR: Number(record.BSTAR ?? 0),
    MEAN_MOTION_DOT: Number(record.MEAN_MOTION_DOT ?? 0),
    ELEMENT_SET_NO: Number(record.ELEMENT_SET_NO ?? 0),
  } as OMMJsonObject);
}

export function calculatePosition(record: OmmRecord, satrec: SatRec, date: Date): SatellitePosition | null {
  const state = propagate(satrec, date);
  if (!state) return null;
  const geodetic = eciToGeodetic(state.position, gstime(date));
  const ageHours = Math.max(0, (date.getTime() - Date.parse(record.EPOCH)) / 3_600_000);
  const speedKmS = Math.hypot(state.velocity.x, state.velocity.y, state.velocity.z);
  if (![geodetic.latitude, geodetic.longitude, geodetic.height, speedKmS, ageHours].every(Number.isFinite)) return null;
  return {
    record,
    latitude: geodetic.latitude * (180 / Math.PI),
    longitude: geodetic.longitude * (180 / Math.PI),
    altitudeKm: geodetic.height,
    speedKmS,
    ageHours,
    staleElements: ageHours > 168,
  };
}

export interface PassPrediction {
  aos: Date;
  los: Date;
  maxElevationDeg: number;
}

export interface ObserverInput {
  latitudeDeg: number;
  longitudeDeg: number;
  altitudeM: number;
  maskDeg: number;
}

function elevationAt(satrec: SatRec, observer: ObserverInput, time: Date): number | null {
  const state = propagate(satrec, time);
  if (!state) return null;
  const observerGeodetic = {
    latitude: degreesToRadians(observer.latitudeDeg),
    longitude: degreesToRadians(observer.longitudeDeg),
    height: observer.altitudeM / 1000,
  };
  const satelliteEcf = eciToEcf(state.position, gstime(time));
  return ecfToLookAngles(observerGeodetic, satelliteEcf).elevation * (180 / Math.PI);
}

function refineCrossing(
  satrec: SatRec,
  observer: ObserverInput,
  left: Date,
  right: Date,
  rising: boolean,
): Date {
  let lo = left.getTime();
  let hi = right.getTime();
  for (let i = 0; i < 24 && hi - lo > 1000; i += 1) {
    const mid = (lo + hi) / 2;
    const elevation = elevationAt(satrec, observer, new Date(mid));
    if (elevation === null) break;
    if ((elevation >= observer.maskDeg) === rising) hi = mid;
    else lo = mid;
  }
  return new Date(hi);
}

export function predictNextPass(
  satrec: SatRec,
  observer: ObserverInput,
  start: Date,
  horizonHours = 72,
): PassPrediction | null {
  const stepMs = 60_000;
  const endMs = start.getTime() + horizonHours * 3_600_000;
  let previousTime = start;
  let previousElevation = elevationAt(satrec, observer, previousTime);
  let aos: Date | null = previousElevation !== null && previousElevation >= observer.maskDeg ? start : null;
  let maxElevation = previousElevation ?? -90;

  for (let t = start.getTime() + stepMs; t <= endMs; t += stepMs) {
    const time = new Date(t);
    const elevation = elevationAt(satrec, observer, time);
    if (elevation === null) {
      previousTime = time;
      previousElevation = null;
      continue;
    }
    maxElevation = Math.max(maxElevation, elevation);
    if (previousElevation !== null && previousElevation < observer.maskDeg && elevation >= observer.maskDeg) {
      aos = refineCrossing(satrec, observer, previousTime, time, true);
      maxElevation = elevation;
    } else if (aos && previousElevation !== null && previousElevation >= observer.maskDeg && elevation < observer.maskDeg) {
      const los = refineCrossing(satrec, observer, previousTime, time, false);
      return { aos, los, maxElevationDeg: maxElevation };
    }
    previousTime = time;
    previousElevation = elevation;
  }
  return null;
}

export function predictOrbitTrack(satrec: SatRec, now: Date, periodMinutes: number): [number, number, number][] {
  const durationMs = Math.min(Math.max(periodMinutes, 80), 1600) * 60_000;
  const steps = 144;
  const points: [number, number, number][] = [];
  for (let i = 0; i <= steps; i += 1) {
    const time = new Date(now.getTime() + durationMs * (i / steps));
    const state = propagate(satrec, time);
    if (!state) continue;
    const geodetic = eciToGeodetic(state.position, gstime(time));
    if (!Number.isFinite(geodetic.latitude) || !Number.isFinite(geodetic.longitude)) continue;
    points.push([
      geodetic.longitude * (180 / Math.PI),
      geodetic.latitude * (180 / Math.PI),
      geodetic.height,
    ]);
  }
  return points;
}
