/**
 * SGP4 Verification Test Suite (satellite.js)
 * ============================================
 * Tests satellite.js SGP4 orbital propagation against the official published
 * Vallado verification vectors (AIAA 2006-6753).
 *
 * Verifies that satellite.js agrees with the official reference dataset
 * within documented tolerances (< 1e-3 km = 1 meter, < 1e-5 km/s = 10 mm/s).
 */

import { describe, it, expect } from 'vitest';
import * as satellite from 'satellite.js';
import valladoData from './fixtures/vallado_cases.json';

describe('SGP4 Correctness Validation (satellite.js vs Vallado AIAA 2006-6753)', () => {
  it('propagates official Vallado verification cases within strict tolerance', () => {
    const validCases = valladoData.valid_cases;
    expect(validCases.length).toBeGreaterThan(50);

    let maxPosErr = 0;
    let maxVelErr = 0;

    for (const testCase of validCases) {
      const satrec = satellite.twoline2satrec(testCase.line1, testCase.line2);
      expect(satrec).toBeDefined();

      const pv = satellite.sgp4(satrec, testCase.tsince_min);
      expect(pv).toBeDefined();
      expect(pv.position).toBeTruthy();
      expect(pv.velocity).toBeTruthy();

      const r = pv.position as { x: number; y: number; z: number };
      const v = pv.velocity as { x: number; y: number; z: number };

      const expR = testCase.expected_r_km;
      const expV = testCase.expected_v_km_s;

      const dx = r.x - expR[0];
      const dy = r.y - expR[1];
      const dz = r.z - expR[2];
      const posErr = Math.sqrt(dx * dx + dy * dy + dz * dz);

      const dvx = v.x - expV[0];
      const dvy = v.y - expV[1];
      const dvz = v.z - expV[2];
      const velErr = Math.sqrt(dvx * dvx + dvy * dvy + dvz * dvz);

      if (posErr > maxPosErr) maxPosErr = posErr;
      if (velErr > maxVelErr) maxVelErr = velErr;

      // Position tolerance < 1e-3 km (1 meter), velocity tolerance < 1e-5 km/s (10 mm/s)
      expect(posErr).toBeLessThan(1e-3);
      expect(velErr).toBeLessThan(1e-5);
    }

    console.log(`[satellite.js Vallado Validation] Passed ${validCases.length} cases.`);
    console.log(`Max Position Error: ${maxPosErr.toExponential(4)} km (${(maxPosErr * 1e6).toFixed(3)} mm)`);
    console.log(`Max Velocity Error: ${maxVelErr.toExponential(4)} km/s (${(maxVelErr * 1e6).toFixed(3)} mm/s)`);
  });

  it('correctly handles decayed or invalid orbits without crashing', () => {
    // Extreme drag re-entered orbit
    const line1 = '1 99999U 20001A   20001.00000000  .15000000  00000+0  10000-1 0  9999';
    const line2 = '2 99999  51.6400 100.0000 0005000  50.0000 310.0000 16.50000000    10';

    const satrec = satellite.twoline2satrec(line1, line2);
    // Propagate 50 days (72000 minutes) into the future
    const pv = satellite.sgp4(satrec, 72000.0);

    // satellite.js returns false for position or sets satrec.error
    const isDecayed = !pv.position || (satrec.error && satrec.error !== 0);
    expect(isDecayed).toBe(true);
  });
});
