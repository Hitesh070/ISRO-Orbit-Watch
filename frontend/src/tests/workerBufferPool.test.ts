import { describe, it, expect } from 'vitest';
import { getCatalogRevisionKey } from '../hooks/usePropagatorWorker';

describe('Worker Catalog Revision & Buffer Zero-Churn', () => {
  const sampleCatalog = [
    {
      norad_id: 25544,
      name: 'ISS (ZARYA)',
      line1: '1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9002',
      line2: '2 25544  51.6400 208.1000 0004000  60.0000 300.0000 15.49500000999991',
    },
    {
      norad_id: 43226,
      name: 'CARTOSAT-2F',
      line1: '1 43226U 18004A   24001.50000000  .00000300  00000-0  20000-4 0  9999',
      line2: '2 43226  97.5000 150.0000 0010000  45.0000 315.0000 14.80000000999992',
    },
    {
      norad_id: 59000,
      name: 'INSAT-3DS',
      line1: '1 59000U 24001A   24001.50000000  .00000100  00000-0  00000-0 0  9999',
      line2: '2 59000   0.0500  74.0000 0002000  10.0000 350.0000  1.00270000999993',
    },
  ];

  it('generates identical revision keys for polling cycles with identical catalog data', () => {
    const key1 = getCatalogRevisionKey(sampleCatalog);
    // Simulating polling producing a new array reference with the exact same elements
    const polledCatalogCopy = sampleCatalog.map((item) => ({ ...item }));
    const key2 = getCatalogRevisionKey(polledCatalogCopy);

    expect(key1).toBe(key2);
    expect(key1).toBeTruthy();
  });

  it('detects orbital catalog element updates and generates a new revision key', () => {
    const keyInitial = getCatalogRevisionKey(sampleCatalog);
    const updatedCatalog = [
      {
        ...sampleCatalog[0],
        line1: '1 25544U 98067A   24002.80000000  .00016717  00000-0  10270-3 0  9003',
      },
      sampleCatalog[1],
      sampleCatalog[2],
    ];
    const keyUpdated = getCatalogRevisionKey(updatedCatalog);

    expect(keyUpdated).not.toBe(keyInitial);
  });

  it('handles empty or null catalog gracefully', () => {
    expect(getCatalogRevisionKey([])).toBe('');
    expect(getCatalogRevisionKey(null as any)).toBe('');
  });
});
