import { describe, it, expect } from 'vitest';
import { predictPassesClient, azimuthToCompass, GroundStation } from '../utils/passPredictor';

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
  });

  it('gracefully returns empty array for corrupt or decayed element sets', () => {
    const corruptLine1 = '1 00000U INVALID TLE LINE';
    const corruptLine2 = '2 00000 INVALID TLE LINE';
    const passes = predictPassesClient(corruptLine1, corruptLine2, station);
    expect(passes).toEqual([]);
  });
});
