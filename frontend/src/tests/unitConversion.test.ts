import { describe, it, expect } from 'vitest';
import { formatDistance, formatSpeed, formatAltitude } from '../utils/unitConversion';

describe('Unit Conversion Utilities', () => {
  it('formats metric distances accurately', () => {
    expect(formatDistance(420.5, 'metric', 1)).toBe('420.5 km');
    expect(formatDistance(null, 'metric')).toBe('---');
    expect(formatDistance('---', 'metric')).toBe('---');
  });

  it('converts metric kilometers to imperial miles accurately', () => {
    // 100 km ≈ 62.1 mi
    expect(formatDistance(100, 'imperial', 1)).toBe('62.1 mi');
    // ISS ~420 km altitude ≈ 261.0 miles
    expect(formatDistance(420, 'imperial', 1)).toBe('261.0 mi');
  });

  it('formats speed in km/s and mi/s', () => {
    expect(formatSpeed(7.66, 'metric', 2)).toBe('7.66 km/s');
    // 7.66 km/s ≈ 4.760 mi/s
    expect(formatSpeed(7.66, 'imperial', 3)).toBe('4.760 mi/s');
  });

  it('converts station altitude from meters to feet', () => {
    expect(formatAltitude(920, 'metric')).toBe('920 m');
    // 920 meters * 3.28084 ≈ 3018 ft
    expect(formatAltitude(920, 'imperial')).toBe('3018 ft');
  });
});
