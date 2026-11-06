/**
 * Velocity Extrapolation Error Bound Test (Phase 2)
 * ==================================================
 * Tests the maximum error introduced by shader linear velocity extrapolation
 * (pos = pos0 + vel0 * dt) over worker tick intervals (dt = 0.5s to 1.0s)
 * against true nonlinear SGP4 propagation.
 *
 * Verifies that the extrapolation error remains below 15 meters for LEO orbits,
 * which is visually indistinguishable (< 0.003 pixels at Earth scale).
 */

import { describe, it, expect } from 'vitest';
import * as satellite from 'satellite.js';

describe('Vertex Shader Linear Velocity Extrapolation Error Bound', () => {
  // ISS (ZARYA) - High velocity LEO orbit (~7.66 km/s, 51.6° inc)
  const line1 = '1 25544U 98067A   26309.91667824  .00014285  00000+0  25841-3 0  9993';
  const line2 = '2 25544  51.6415 160.8225 0005820  44.7502  71.9546 15.49815412478546';

  const satrec = satellite.twoline2satrec(line1, line2);

  it('bounds extrapolation error over 0.5-second tick interval', () => {
    const epochDate = new Date();
    const pv0 = satellite.propagate(satrec, epochDate);
    expect(pv0.position).toBeTruthy();
    expect(pv0.velocity).toBeTruthy();

    const p0 = pv0.position as { x: number; y: number; z: number };
    const v0 = pv0.velocity as { x: number; y: number; z: number };

    // Linear extrapolation at dt = 0.5s (worker tick rate of 2 Hz)
    const dtSeconds = 0.5;
    const pExtrapolated = {
      x: p0.x + v0.x * dtSeconds,
      y: p0.y + v0.y * dtSeconds,
      z: p0.z + v0.z * dtSeconds,
    };

    // True SGP4 position at epoch + dt
    const trueDate = new Date(epochDate.getTime() + dtSeconds * 1000);
    const pvTrue = satellite.propagate(satrec, trueDate);
    const pTrue = pvTrue.position as { x: number; y: number; z: number };

    const dx = pExtrapolated.x - pTrue.x;
    const dy = pExtrapolated.y - pTrue.y;
    const dz = pExtrapolated.z - pTrue.z;
    const errorKm = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const errorMeters = errorKm * 1000.0;

    console.log(`[Extrapolation Test] dt = 0.5s: error = ${errorMeters.toFixed(3)} meters (${errorKm.toExponential(3)} km)`);

    // For LEO (gravitational acceleration g ~ 8.6 m/s^2), delta_r ~ 0.5 * g * dt^2 ~ 0.5 * 8.6 * 0.25 ~ 1.08 meters!
    // Must be strictly under 5 meters
    expect(errorMeters).toBeLessThan(5.0);
  });

  it('bounds extrapolation error over 1.0-second tick interval', () => {
    const epochDate = new Date();
    const pv0 = satellite.propagate(satrec, epochDate);
    const p0 = pv0.position as { x: number; y: number; z: number };
    const v0 = pv0.velocity as { x: number; y: number; z: number };

    const dtSeconds = 1.0;
    const pExtrapolated = {
      x: p0.x + v0.x * dtSeconds,
      y: p0.y + v0.y * dtSeconds,
      z: p0.z + v0.z * dtSeconds,
    };

    const trueDate = new Date(epochDate.getTime() + dtSeconds * 1000);
    const pvTrue = satellite.propagate(satrec, trueDate);
    const pTrue = pvTrue.position as { x: number; y: number; z: number };

    const dx = pExtrapolated.x - pTrue.x;
    const dy = pExtrapolated.y - pTrue.y;
    const dz = pExtrapolated.z - pTrue.z;
    const errorKm = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const errorMeters = errorKm * 1000.0;

    console.log(`[Extrapolation Test] dt = 1.0s: error = ${errorMeters.toFixed(3)} meters (${errorKm.toExponential(3)} km)`);

    // For dt = 1.0s, delta_r ~ 0.5 * 8.6 * 1.0^2 ~ 4.3 meters
    // Must be strictly under 15 meters
    expect(errorMeters).toBeLessThan(15.0);
  });
});
