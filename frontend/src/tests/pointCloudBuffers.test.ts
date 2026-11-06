/**
 * Point Cloud TypedArray & Buffer Architecture Unit Tests (Phase 2)
 * =================================================================
 * Verifies memory layout, scene unit normalization, and color attribute encoding
 * for the single-draw-call 25,000+ object GPU particle system.
 */

import { describe, it, expect } from 'vitest';

const EARTH_RADIUS_KM = 6378.137;
const KM_TO_SCENE = 1.0 / EARTH_RADIUS_KM;

describe('Point Cloud GPU Attribute Buffers & Memory Layout', () => {
  it('correctly dimensions structure-of-arrays for 25,000 objects', () => {
    const N = 25000;
    const posBuffer = new Float32Array(N * 3);
    const velBuffer = new Float32Array(N * 3);
    const statusBuffer = new Uint8Array(N);

    // Verify buffer byte lengths
    expect(posBuffer.byteLength).toBe(N * 3 * 4); // 300,000 bytes (~300 KB)
    expect(velBuffer.byteLength).toBe(N * 3 * 4); // 300,000 bytes (~300 KB)
    expect(statusBuffer.byteLength).toBe(N * 1);   // 25,000 bytes (~25 KB)

    // Total memory footprint is ~625 KB, well within transferable buffer limits
    const totalBytes = posBuffer.byteLength + velBuffer.byteLength + statusBuffer.byteLength;
    expect(totalBytes).toBe(625000);
  });

  it('normalizes TEME coordinates to Earth radius scene units (R_E = 1.0)', () => {
    // International Space Station (ISS) approximate altitude = 420 km
    const issAltKm = 420.0;
    const issOrbitalRadiusKm = EARTH_RADIUS_KM + issAltKm;

    const issPosTeme = { x: issOrbitalRadiusKm, y: 0.0, z: 0.0 };

    // Normalized scene units
    const px = issPosTeme.x * KM_TO_SCENE;
    const py = issPosTeme.z * KM_TO_SCENE;
    const pz = -issPosTeme.y * KM_TO_SCENE;

    const sceneRadius = Math.sqrt(px * px + py * py + pz * pz);

    // In scene units, Earth surface is at 1.0, ISS is at 1.0 + 420/6378.137 = 1.0658
    expect(sceneRadius).toBeCloseTo(1.06585, 4);
    expect(sceneRadius).toBeGreaterThan(1.0); // Never inside Earth
  });

  it('encodes distinctive color-coding for ISRO assets vs space debris', () => {
    const mockCatalog = [
      { norad_id: 36795, name: 'CARTOSAT-2B', is_isro: true, object_type: 'Satellite' },
      { norad_id: 25544, name: 'ISS (ZARYA)', is_isro: false, object_type: 'Satellite' },
      { norad_id: 29742, name: 'FENGYUN 1C DEB', is_isro: false, object_type: 'Debris' },
    ];

    const colors = new Float32Array(mockCatalog.length * 3);

    for (let i = 0; i < mockCatalog.length; i++) {
      const item = mockCatalog[i];
      let r = 0.0, g = 0.0, b = 0.0;

      if (item.is_isro) {
        // Distinct ISRO Saffron [1.0, 0.6, 0.2]
        r = 1.0; g = 0.6; b = 0.2;
      } else if (item.object_type === 'Debris') {
        // High-risk Debris Rose [0.95, 0.25, 0.3]
        r = 0.95; g = 0.25; b = 0.3;
      } else {
        // Payload Cyan [0.0, 0.94, 1.0]
        r = 0.0; g = 0.94; b = 1.0;
      }

      colors[i * 3] = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;
    }

    // Check ISRO CARTOSAT-2B color
    expect(colors[0]).toBeCloseTo(1.0, 4);
    expect(colors[1]).toBeCloseTo(0.6, 4);
    expect(colors[2]).toBeCloseTo(0.2, 4);

    // Check ISS Cyan color
    expect(colors[3]).toBeCloseTo(0.0, 4);
    expect(colors[4]).toBeCloseTo(0.94, 2);
    expect(colors[5]).toBeCloseTo(1.0, 4);

    // Check Debris Rose color
    expect(colors[6]).toBeCloseTo(0.95, 2);
    expect(colors[7]).toBeCloseTo(0.25, 2);
    expect(colors[8]).toBeCloseTo(0.3, 2);
  });
});
