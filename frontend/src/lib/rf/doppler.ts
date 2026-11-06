/**
 * OrbitGuard RF Doppler & Topocentric Range Rate Engine
 * ====================================================
 * High-precision astrodynamic Doppler shift and Doppler rate calculations
 * accounting for satellite motion in TEME/ECI and observer tangential velocity
 * caused by Earth's diurnal rotation.
 *
 * Mathematical Framework:
 * -----------------------
 * Range Rate:
 *   ρ = r_sat - r_obs
 *   v_rel = v_sat - v_obs
 *   v_obs = [-ω_E * y_obs, ω_E * x_obs, 0]  (TEME/ECI frame)
 *   ρ̇ = (ρ · v_rel) / ||ρ||
 *
 * Downlink Doppler Shift:
 *   f_rx = f_0 * (1 - ρ̇ / c)
 *   Δf = -f_0 * (ρ̇ / c)
 *   (Approaching: ρ̇ < 0 => Δf > 0, Receding: ρ̇ > 0 => Δf < 0)
 *
 * Uplink Pre-Compensation:
 *   f_tx = f_0 / (1 - ρ̇ / c)
 *
 * Doppler Rate (Hz/s):
 *   d(Δf)/dt ≈ (Δf(t + h) - Δf(t - h)) / (2h)
 */

export type Vec3 = [number, number, number];

/** Earth rotation rate (rad/s) */
export const OMEGA_E = 7.2921150e-5;

/** Speed of light in vacuum (km/s) */
export const C_KM_S = 299792.458;

/** Vector subtract: a - b */
export function sub3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

/** Vector dot product: a · b */
export function dot3(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/** Vector Euclidean norm: ||a|| */
export function norm3(a: Vec3): number {
  return Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
}

/**
 * Computes topocentric range rate (km/s) between satellite and observer in ECI/TEME frame.
 * Explicitly accounts for observer tangential velocity due to Earth rotation.
 *
 * @param rSat Satellite position in TEME/ECI (km)
 * @param vSat Satellite velocity in TEME/ECI (km/s)
 * @param rObsEci Observer ground station position in TEME/ECI (km)
 * @returns Range rate ρ̇ in km/s (positive = receding, negative = approaching)
 */
export function rangeRateKmS(rSat: Vec3, vSat: Vec3, rObsEci: Vec3): number {
  // Observer tangential velocity in inertial frame from Earth rotation
  const vObs: Vec3 = [-OMEGA_E * rObsEci[1], OMEGA_E * rObsEci[0], 0];

  // Topocentric relative slant range vector
  const rho = sub3(rSat, rObsEci);
  const distance = norm3(rho);

  if (distance < 1e-6) {
    return 0.0;
  }

  // Relative velocity vector in inertial frame
  const vRel = sub3(vSat, vObs);

  // Line-of-sight projection: (ρ · v_rel) / ||ρ||
  return dot3(rho, vRel) / distance;
}

/**
 * Calculates received downlink Doppler shift in Hz.
 *
 * @param f0Hz Nominal carrier frequency in Hz
 * @param rrKmS Range rate in km/s (positive = receding)
 * @returns Frequency shift Δf in Hz (positive when approaching, negative when receding)
 */
export function dopplerShiftHz(f0Hz: number, rrKmS: number): number {
  const val = (-f0Hz * rrKmS) / C_KM_S;
  return Object.is(val, -0) ? 0.0 : val;
}

/**
 * Calculates pre-compensated ground station uplink transmission frequency.
 * Ensures the spacecraft receiver receives exactly f0Hz.
 *
 * @param f0Hz Nominal satellite receiver center frequency in Hz
 * @param rrKmS Range rate in km/s
 * @returns Ground station transmit frequency f_tx in Hz
 */
export function uplinkTxHz(f0Hz: number, rrKmS: number): number {
  return f0Hz / (1.0 - rrKmS / C_KM_S);
}

/**
 * Calculates Doppler rate (Hz/s) via central difference.
 * Critical parameter for Phase-Locked Loop (PLL) loop filter bandwidth selection.
 *
 * @param f0Hz Nominal carrier frequency in Hz
 * @param rrKmS_prev Range rate at (t - dt) in km/s
 * @param rrKmS_next Range rate at (t + dt) in km/s
 * @param dtSeconds Half-step duration dt in seconds
 * @returns Doppler rate in Hz/s
 */
export function dopplerRateHzS(
  f0Hz: number,
  rrKmS_prev: number,
  rrKmS_next: number,
  dtSeconds: number
): number {
  if (dtSeconds <= 0) return 0.0;
  const dfPrev = dopplerShiftHz(f0Hz, rrKmS_prev);
  const dfNext = dopplerShiftHz(f0Hz, rrKmS_next);
  return (dfNext - dfPrev) / (2.0 * dtSeconds);
}
