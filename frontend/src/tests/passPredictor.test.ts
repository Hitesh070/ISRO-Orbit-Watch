import { describe, it, expect } from 'vitest';
import {
  predictPassesClient,
  computeGroundTrackClient,
  resolveLocationClient,
  azimuthToCompass,
  GroundStation,
  FAMOUS_GROUND_STATIONS,
} from '../utils/passPredictor';

describe('Client-Side Topocentric Pass Predictor', () => {
  const station: GroundStation = {
    name: 'Satish Dhawan Space Centre (SDSC SHAR)',
    city: 'Sriharikota',
    country: 'India',
    lat: 13.7199,
    lon: 80.2304,
    altM: 10,
  };

  // ISS (ZARYA)
  const line1 = '1 25544U 98067A   26309.91667824  .00014285  00000+0  25841-3 0  9993';
  const line2 = '2 25544  51.6415 160.8225 0005820  44.7502  71.9546 15.49815412478546';

  // ISRO RESOURCESAT-2A
  const resLine1 = '1 41877U 2016-074 26310.80617260 - .0000001  00000-0  13919-4 0  9999';
  const resLine2 = '2 41877  98.7408  23.0431 0002831  49.1093 311.0329 14.21608655514566';

  it('correctly maps azimuth degrees to 8-point compass headings', () => {
    expect(azimuthToCompass(0)).toBe('N');
    expect(azimuthToCompass(45)).toBe('NE');
    expect(azimuthToCompass(90)).toBe('E');
    expect(azimuthToCompass(135)).toBe('SE');
    expect(azimuthToCompass(180)).toBe('S');
    expect(azimuthToCompass(225)).toBe('SW');
    expect(azimuthToCompass(270)).toBe('W');
    expect(azimuthToCompass(315)).toBe('NW');
  });

  it('computes topocentric pass opportunities with realistic durations and elevations', () => {
    const passes = predictPassesClient(line1, line2, station, 4, 10.0, 5);
    expect(passes).toBeInstanceOf(Array);
    expect(passes.length).toBeGreaterThan(0);

    const firstPass = passes[0];
    expect(firstPass.maxElevationDeg).toBeGreaterThanOrEqual(10.0);
    expect(firstPass.durationSeconds).toBeGreaterThan(60);
    expect(firstPass.durationSeconds).toBeLessThan(1200); // LEO pass is always < 20 min
    expect(['EXCELLENT', 'GOOD', 'FAIR']).toContain(firstPass.quality);
    expect(firstPass.minDistanceKm).toBeGreaterThan(300); // ISS altitude ~420 km
    // Verify snake_case compatibility aliases
    expect(firstPass.aos_time).toBe(firstPass.aosTimeIso);
    expect(firstPass.max_elevation).toBe(firstPass.maxElevationDeg);
  });

  it('computes topocentric passes for ISRO RESOURCESAT-2A over custom coordinates (Bengaluru)', () => {
    const customStation = resolveLocationClient('12.9716,77.5946,920');
    expect(customStation.lat).toBeCloseTo(12.9716, 3);
    expect(customStation.lon).toBeCloseTo(77.5946, 3);

    const passes = predictPassesClient(resLine1, resLine2, customStation, 5, 10.0, 8);
    expect(passes.length).toBeGreaterThan(0);
    expect(passes[0].maxElevationDeg).toBeGreaterThanOrEqual(10.0);
    expect(passes[0].durationSeconds).toBeGreaterThan(60);
    expect(passes[0].trajectory_summary).toBeTruthy();
  });

  it('generates 2D orbital ground track subpoint points', () => {
    const track = computeGroundTrackClient(resLine1, resLine2, 45, 45, 5);
    expect(track.length).toBeGreaterThan(15);
    const midPoint = track.find((p) => p.is_current);
    expect(midPoint).toBeDefined();
    expect(midPoint!.lat).toBeGreaterThanOrEqual(-90);
    expect(midPoint!.lat).toBeLessThanOrEqual(90);
    expect(midPoint!.lon).toBeGreaterThanOrEqual(-180);
    expect(midPoint!.lon).toBeLessThanOrEqual(180);
  });

  it('requires explicit coordinates and altitude instead of unverified station presets', () => {
    expect(FAMOUS_GROUND_STATIONS).toEqual([]);
    expect(() => resolveLocationClient('bengaluru')).toThrow(/Unknown ground station/);
    expect(() => resolveLocationClient('unknown_place')).toThrow(/Unknown ground station/);
    expect(() => resolveLocationClient('12.9716,77.5946')).toThrow(/Unknown ground station/);
    expect(resolveLocationClient('12.9716,77.5946,920').altM).toBe(920);
  });

  it('gracefully returns empty array for corrupt or decayed element sets', () => {
    const corruptLine1 = '1 00000U INVALID TLE LINE';
    const corruptLine2 = '2 00000 INVALID TLE LINE';
    const passes = predictPassesClient(corruptLine1, corruptLine2, station);
    expect(passes).toEqual([]);
  });
});
