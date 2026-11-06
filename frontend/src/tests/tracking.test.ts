/**
 * OrbitGuard Antenna Tracking & Protocol Encoders Unit Tests
 * ===========================================================
 * Verifies GS-232, Easycomm, and rotctld protocol framing, azimuth cable wrap,
 * spherical pointing error geometry, and kinematic limits.
 */

import { describe, it, expect } from 'vitest';
import {
  encodeGS232Position,
  encodeGS232Stop,
  encodeGS232Query,
  parseGS232Reply,
  encodeEasycommPosition,
  parseEasycommReply,
  encodeRotctldPosition,
  parseRotctldReply,
} from '../lib/tracking/protocolEncoders';
import {
  sphericalPointingErrorDeg,
  resolveAzimuthWrap,
} from '../lib/tracking/trackingLogic';

describe('Antenna Tracking Protocol Encoders (Phase 5)', () => {
  it('encodes Yaesu GS-232 position command with 3-digit zero-padding', () => {
    // Target Az: 45°, El: 12°
    const cmd1 = encodeGS232Position(45.2, 12.4);
    expect(cmd1).toBe('W045 012\r');

    // Target Az: 180°, El: 85°
    const cmd2 = encodeGS232Position(180, 85);
    expect(cmd2).toBe('W180 085\r');

    // Clamps negative elevation to 0
    const cmd3 = encodeGS232Position(90, -5);
    expect(cmd3).toBe('W090 000\r');
  });

  it('parses both standard binary-style and ASCII Yaesu GS-232 replies', () => {
    // Style 1: +0180+0045\r
    const res1 = parseGS232Reply('+0180+0045\r');
    expect(res1).not.toBeNull();
    expect(res1?.azDeg).toBe(180);
    expect(res1?.elDeg).toBe(45);

    // Style 2: AZ=210 EL=65
    const res2 = parseGS232Reply('AZ=210 EL=65\r\n');
    expect(res2).not.toBeNull();
    expect(res2?.azDeg).toBe(210);
    expect(res2?.elDeg).toBe(65);
  });

  it('encodes and decodes Easycomm I commands with 1 decimal precision', () => {
    const cmd = encodeEasycommPosition(124.56, 42.12);
    expect(cmd).toBe('AZ124.6 EL42.1\n');

    const parsed = parseEasycommReply('AZ124.6 EL42.1\n');
    expect(parsed?.azDeg).toBe(124.6);
    expect(parsed?.elDeg).toBe(42.1);
  });

  it('encodes and decodes Hamlib rotctld protocol packets', () => {
    const cmd = encodeRotctldPosition(245.3, 56.7);
    expect(cmd).toBe('P 245.3 56.7\n');

    const parsed = parseRotctldReply('245.3 56.7\n');
    expect(parsed?.azDeg).toBe(245.3);
    expect(parsed?.elDeg).toBe(56.7);
  });

  it('resolves azimuth cable wrap avoidance in 450-degree rotator mode', () => {
    // In standard 360 mode, 15 deg is commanded as 15
    const standardWrap = resolveAzimuthWrap(15, 340, 360);
    expect(standardWrap).toBe(15);

    // In 450 mode, when current is at 340 deg and target is 15 deg:
    // (15 + 360) = 375 <= 450, avoiding 325-degree reverse unwinding slew!
    const wrap450 = resolveAzimuthWrap(15, 340, 450);
    expect(wrap450).toBe(375);
  });

  it('computes spherical angular pointing error accurately', () => {
    // Exactly aligned: error = 0°
    const errZero = sphericalPointingErrorDeg(180, 45, 180, 45);
    expect(errZero).toBeCloseTo(0, 2);

    // Orthogonal: Az difference 90° on horizon
    const err90 = sphericalPointingErrorDeg(0, 0, 90, 0);
    expect(err90).toBeCloseTo(90, 1);

    // At zenith (El = 90°), any azimuth produces 0 pointing error relative to another zenith point
    const errZenith = sphericalPointingErrorDeg(0, 90, 180, 90);
    expect(errZenith).toBeCloseTo(0, 1);
  });
});
