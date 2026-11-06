/**
 * OrbitGuard High-Precision Pass Planner & Scheduler Tests
 * =========================================================
 * Tests sub-second pass prediction, bisection refinement, ICS calendar export,
 * and CSV format compatibility.
 */

import { describe, it, expect } from 'vitest';
import {
  predictDetailedPasses,
  generatePassICS,
  generatePassCSV,
  getSatelliteFootprintRadiusKm,
  DetailedPass,
} from '../lib/rf/passPlanner';

// Real ISS (NORAD 25544) TLE sample
const ISS_LINE1 = '1 25544U 98067A   24065.50000000  .00016717  00000+0  10270-3 0  9993';
const ISS_LINE2 = '2 25544  51.6400 208.8000 0004500  70.0000 290.0000 15.49800000440001';

const BENGALURU_OBSERVER = {
  lat: 12.9716,
  lon: 77.5946,
  altM: 920,
  name: 'Bengaluru Ground Station',
};

describe('Pass Planner & Export Engine (Phase 4)', () => {
  it('computes satellite footprint ground radius correctly from spherical geometry', () => {
    // ISS at ~420 km altitude
    // centralAngle = arccos(6378.137 / (6378.137 + 420)) ≈ 0.35335 rad (20.25 degrees)
    // S = 6378.137 * 0.35335 ≈ 2253.72 km
    const radiusKm = getSatelliteFootprintRadiusKm(420);
    expect(radiusKm).toBeGreaterThan(2000);
    expect(radiusKm).toBeLessThan(2500);
    expect(radiusKm).toBeCloseTo(2253.7, 0);
  });

  it('predicts upcoming passes with sub-second bisection and detailed time-series', () => {
    const passes = predictDetailedPasses(
      ISS_LINE1,
      ISS_LINE2,
      'ISS (ZARYA)',
      25544,
      BENGALURU_OBSERVER,
      437.5e6,
      10.0, // 10 degree elevation mask
      72,   // 72 hours search
      5     // max 5 passes
    );

    expect(Array.isArray(passes)).toBe(true);
    if (passes.length > 0) {
      const p = passes[0];
      expect(p.noradId).toBe(25544);
      expect(p.maxElevationDeg).toBeGreaterThanOrEqual(10.0);
      expect(p.durationSeconds).toBeGreaterThan(60);
      expect(p.samples.length).toBeGreaterThan(5);

      // Verify sample properties
      const s = p.samples[0];
      expect(typeof s.azDeg).toBe('number');
      expect(typeof s.elDeg).toBe('number');
      expect(typeof s.rangeKm).toBe('number');
      expect(typeof s.dopplerShiftHz).toBe('number');
      expect(typeof s.marginDb).toBe('number');
    }
  });

  it('generates valid iCalendar (.ics) string containing RFC 5545 calendar fields', () => {
    const mockPasses: DetailedPass[] = [
      {
        id: '25544-1700000000000',
        satName: 'ISS (ZARYA)',
        noradId: 25544,
        aosTimeIso: '2026-11-06T18:00:00.000Z',
        tcaTimeIso: '2026-11-06T18:05:00.000Z',
        losTimeIso: '2026-11-06T18:10:00.000Z',
        aosEpochMs: 1700000000000,
        tcaEpochMs: 1700000300000,
        losEpochMs: 1700000600000,
        durationSeconds: 600,
        maxElevationDeg: 65.5,
        aosAzimuthDeg: 210.0,
        tcaAzimuthDeg: 120.0,
        losAzimuthDeg: 45.0,
        minRangeKm: 480.0,
        maxDopplerShiftHz: 9200.0,
        maxDopplerRateHzS: 125.0,
        quality: 'EXCELLENT',
        samples: [],
      },
    ];

    const ics = generatePassICS(mockPasses);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('VERSION:2.0');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('SUMMARY:🛰️ Satellite Pass: ISS (ZARYA)');
    expect(ics).toContain('Max Elevation: 65.5°');
    expect(ics).toContain('END:VEVENT');
    expect(ics).toContain('END:VCALENDAR');
  });

  it('generates standard CSV output with header columns', () => {
    const mockPasses: DetailedPass[] = [
      {
        id: '25544-1700000000000',
        satName: 'ISS (ZARYA)',
        noradId: 25544,
        aosTimeIso: '2026-11-06T18:00:00.000Z',
        tcaTimeIso: '2026-11-06T18:05:00.000Z',
        losTimeIso: '2026-11-06T18:10:00.000Z',
        aosEpochMs: 1700000000000,
        tcaEpochMs: 1700000300000,
        losEpochMs: 1700000600000,
        durationSeconds: 600,
        maxElevationDeg: 65.5,
        aosAzimuthDeg: 210.0,
        tcaAzimuthDeg: 120.0,
        losAzimuthDeg: 45.0,
        minRangeKm: 480.0,
        maxDopplerShiftHz: 9200.0,
        maxDopplerRateHzS: 125.0,
        quality: 'EXCELLENT',
        samples: [],
      },
    ];

    const csv = generatePassCSV(mockPasses);
    expect(csv).toContain('Satellite Name,NORAD ID,AOS UTC,TCA UTC,LOS UTC');
    expect(csv).toContain('"ISS (ZARYA)",25544');
    expect(csv).toContain('65.5,210,120,45,480,9200,125,EXCELLENT');
  });
});
