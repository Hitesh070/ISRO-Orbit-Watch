/**
 * OrbitGuard RF Link Budget & Free Space Path Loss Unit Tests
 * ============================================================
 * Verifies free-space path loss scaling, parabolic antenna gain equations,
 * beamwidth pointing losses, Eb/N0 margin calculation, and mission presets.
 */

import { describe, it, expect } from 'vitest';
import {
  fsplDb,
  parabolicGainDbi,
  hpbwDeg,
  pointingLossDb,
  atmosphericLossDb,
  computeLinkBudget,
  LINK_BUDGET_PRESETS,
} from '../lib/rf/linkBudget';

describe('RF Link Budget Engine (Phase 4)', () => {
  it('verifies FSPL 20*log10 scaling laws (doubling distance adds ~6.02 dB)', () => {
    const fMHz = 437.5;
    const d1Km = 1000.0;
    const d2Km = 2000.0; // 2x distance

    const fspl1 = fsplDb(d1Km, fMHz);
    const fspl2 = fsplDb(d2Km, fMHz);

    const deltaDb = fspl2 - fspl1;
    expect(deltaDb).toBeCloseTo(6.02, 2);
  });

  it('verifies FSPL 20*log10 scaling laws (doubling frequency adds ~6.02 dB)', () => {
    const dKm = 1000.0;
    const f1MHz = 1000.0;
    const f2MHz = 2000.0; // 2x frequency

    const fspl1 = fsplDb(dKm, f1MHz);
    const fspl2 = fsplDb(dKm, f2MHz);

    const deltaDb = fspl2 - fspl1;
    expect(deltaDb).toBeCloseTo(6.02, 2);
  });

  it('matches textbook hand-calculated FSPL for standard LEO geometry', () => {
    // 1000 km range at 437.5 MHz:
    // FSPL = 20*log10(1000) + 20*log10(437.5) + 32.44
    //      = 60 + 52.8196 + 32.44 = 145.2596 dB ≈ 145.26 dB
    const fspl = fsplDb(1000.0, 437.5);
    expect(fspl).toBeCloseTo(145.26, 2);
  });

  it('calculates parabolic dish antenna gain and beamwidth correctly', () => {
    const diameterM = 2.4; // 2.4 meter dish
    const freqHz = 2.25e9; // 2.25 GHz S-band
    const eta = 0.55; // 55% efficiency

    const gainDbi = parabolicGainDbi(diameterM, freqHz, eta);
    // Wavelength = 299792458 / 2.25e9 ≈ 0.13324 m
    // Factor = (pi * 2.4 / 0.13324)^2 = (56.59)^2 = 3202.9
    // Gain = 10*log10(0.55 * 3202.9) = 10*log10(1761.6) ≈ 32.46 dBi
    expect(gainDbi).toBeCloseTo(32.46, 1);

    const hpbw = hpbwDeg(diameterM, freqHz);
    // HPBW ≈ 70 * (0.13324 / 2.4) ≈ 3.886 degrees
    expect(hpbw).toBeCloseTo(3.89, 1);

    // Pointing loss for 1 degree error on 3.89 deg beamwidth
    // L_point = 12 * (1 / 3.89)^2 ≈ 0.79 dB
    const lPoint = pointingLossDb(1.0, hpbw);
    expect(lPoint).toBeCloseTo(0.79, 1);
  });

  it('verifies atmospheric loss cosecant model (zenith vs 5-deg horizon)', () => {
    const zenithLoss = atmosphericLossDb(90.0, 0.35);
    expect(zenithLoss).toBeCloseTo(0.35, 2);

    const horizonLoss = atmosphericLossDb(5.0, 0.35);
    // sin(5 deg) ≈ 0.087155 => 0.35 / 0.087155 ≈ 4.01 dB
    expect(horizonLoss).toBeCloseTo(4.01, 1);
  });

  it('validates link budget verdict and margins for standard CubeSat and S-band presets', () => {
    // 1. UHF CubeSat at 850 km range, 45 deg elevation
    const uhfResult = computeLinkBudget({
      ...LINK_BUDGET_PRESETS.UHF_CUBESAT,
      slantRangeKm: 850.0,
      elevationDeg: 45.0,
    });
    expect(uhfResult.fsplDb).toBeGreaterThan(140);
    expect(uhfResult.marginDb).toBeGreaterThan(0);
    expect(uhfResult.verdict).toBe('CLOSED');

    // 2. S-Band SmallSat at 1200 km range
    const sbandResult = computeLinkBudget({
      ...LINK_BUDGET_PRESETS.SBAND_LEO,
      slantRangeKm: 1200.0,
      elevationDeg: 25.0,
    });
    expect(sbandResult.verdict).toBe('CLOSED');
    expect(sbandResult.maxSupportableDataRateBps).toBeGreaterThan(100000); // Supports > 100 kbps
  });
});
