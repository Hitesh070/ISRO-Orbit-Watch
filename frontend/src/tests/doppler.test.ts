/**
 * OrbitGuard RF Doppler & Topocentric Range Rate Unit Tests
 * ========================================================
 * Verifies astrodynamic Doppler calculations, observer Earth-rotation tangential
 * velocity compensation, sign conventions, and uplink pre-compensation.
 */

import { describe, it, expect } from 'vitest';
import {
  rangeRateKmS,
  dopplerShiftHz,
  uplinkTxHz,
  dopplerRateHzS,
  C_KM_S,
  OMEGA_E,
  Vec3,
} from '../lib/rf/doppler';

describe('Astrodynamic Doppler Engine (Phase 4)', () => {
  it('correctly implements the sign convention (approaching = +Δf, receding = -Δf)', () => {
    const f0 = 437.5e6; // 437.5 MHz UHF carrier

    // Approaching satellite: range rate < 0
    const approachingRr = -6.5; // km/s
    const dfApproaching = dopplerShiftHz(f0, approachingRr);
    expect(dfApproaching).toBeGreaterThan(0);
    // Δf = -f0 * (-6.5) / 299792.458 ≈ +9485.73 Hz
    expect(dfApproaching).toBeCloseTo(9485.73, 1);

    // Receding satellite: range rate > 0
    const recedingRr = +6.5; // km/s
    const dfReceding = dopplerShiftHz(f0, recedingRr);
    expect(dfReceding).toBeLessThan(0);
    expect(dfReceding).toBeCloseTo(-9485.73, 1);
  });

  it('exhibits exact zero Doppler shift at Time of Closest Approach (TCA)', () => {
    const f0 = 145.825e6; // ISS VHF APRS
    const rrTca = 0.0; // At TCA, line-of-sight velocity component is exactly 0
    const dfTca = dopplerShiftHz(f0, rrTca);
    expect(dfTca).toBe(0.0);
  });

  it('verifies that uplink pre-compensation exactly cancels downlink shift at receiver', () => {
    const f0 = 435.0e6; // 435 MHz satellite uplink receiver
    const rr = -5.0; // km/s approaching

    // Ground station transmits pre-compensated frequency
    const fTx = uplinkTxHz(f0, rr);
    expect(fTx).toBeLessThan(f0); // Since satellite sees higher frequency, tx lower

    // What the satellite receives: f_rx = f_tx * (1 - rr / c)
    const fRxSatellite = fTx * (1.0 - rr / C_KM_S);
    expect(fRxSatellite).toBeCloseTo(f0, 6);
  });

  it('demonstrates that observer Earth rotation velocity v_obs produces significant difference', () => {
    // Observer on equator: rObs = [6378.137, 0, 0] km
    // Tangential speed = ω_E * R_E = 7.292115e-5 * 6378.137 ≈ 0.465 km/s (465 m/s)
    const rObs: Vec3 = [6378.137, 0, 0];
    const rSat: Vec3 = [6378.137, 500, 0]; // 500 km East of observer
    const vSat: Vec3 = [0, 7.5, 0]; // Moving East at 7.5 km/s

    // With Earth rotation compensation
    const rrWithObsMotion = rangeRateKmS(rSat, vSat, rObs);

    // Theoretical without observer motion: (rSat - rObs) · vSat / ||rho||
    // rho = [0, 500, 0], vSat = [0, 7.5, 0] => rr = 7.5 km/s
    // With observer motion vObs = [0, ω_E * 6378.137, 0] = [0, 0.4651, 0]
    // vRel = [0, 7.5 - 0.4651, 0] = [0, 7.0349, 0] => rr = 7.0349 km/s
    const expectedDifference = OMEGA_E * 6378.137; // ~0.465 km/s

    expect(rrWithObsMotion).toBeCloseTo(7.5 - expectedDifference, 3);
    expect(Math.abs(rrWithObsMotion - 7.5)).toBeGreaterThan(0.4); // > 400 m/s error if omitted!
  });

  it('calculates Doppler rate (Hz/s) via central difference correctly', () => {
    const f0 = 437.5e6;
    const rrPrev = -5.0; // km/s
    const rrNext = -4.9; // km/s
    const dt = 1.0; // 1 second step

    const rate = dopplerRateHzS(f0, rrPrev, rrNext, dt);
    // Δf1 = -437.5e6 * (-5.0) / 299792.458 = 7296.71
    // Δf2 = -437.5e6 * (-4.9) / 299792.458 = 7150.78
    // d(Δf)/dt = (7150.78 - 7296.71) / 2 = -72.96 Hz/s
    expect(rate).toBeCloseTo(-72.97, 1);
  });
});
