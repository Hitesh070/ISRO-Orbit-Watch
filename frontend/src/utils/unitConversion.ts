/**
 * Unit Conversion & Formatting Utility for OrbitGuard
 * Supports Metric (km, km/s, m) and Imperial (miles, mi/s, ft)
 */

export type UnitSystem = 'metric' | 'imperial';

export const KM_TO_MILES = 0.621371192;
export const METERS_TO_FEET = 3.2808399;

export function formatDistance(
  km: number | string | undefined | null,
  units: UnitSystem = 'metric',
  decimals = 1
): string {
  if (km === undefined || km === null || km === '---') return '---';
  const val = typeof km === 'string' ? parseFloat(km) : km;
  if (isNaN(val)) return '---';

  if (units === 'imperial') {
    const mi = val * KM_TO_MILES;
    return `${mi.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} mi`;
  }
  return `${val.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} km`;
}

export function formatSpeed(
  kmS: number | string | undefined | null,
  units: UnitSystem = 'metric',
  decimals = 3
): string {
  if (kmS === undefined || kmS === null || kmS === '---') return '---';
  const val = typeof kmS === 'string' ? parseFloat(kmS) : kmS;
  if (isNaN(val)) return '---';

  if (units === 'imperial') {
    const miS = val * KM_TO_MILES;
    return `${miS.toFixed(decimals)} mi/s`;
  }
  return `${val.toFixed(decimals)} km/s`;
}

export function formatAltitude(
  altM: number | string | undefined | null,
  units: UnitSystem = 'metric'
): string {
  if (altM === undefined || altM === null) return '---';
  const val = typeof altM === 'string' ? parseFloat(altM) : altM;
  if (isNaN(val)) return '---';

  if (units === 'imperial') {
    return `${Math.round(val * METERS_TO_FEET)} ft`;
  }
  return `${Math.round(val)} m`;
}
