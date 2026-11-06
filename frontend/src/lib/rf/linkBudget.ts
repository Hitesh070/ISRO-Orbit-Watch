/**
 * OrbitGuard RF Link Budget & Free Space Path Loss (FSPL) Engine
 * ==============================================================
 * Professional radio frequency link budget evaluator for satellite downlinks.
 * Evaluates EIRP, FSPL, atmospheric/pointing/polarization losses, received power,
 * carrier-to-noise density (C/N0), energy per bit to noise power density (Eb/N0),
 * and link margin along the entire pass trajectory.
 *
 * Mathematical Foundations:
 * -------------------------
 * 1. Free Space Path Loss:
 *    FSPL (dB) = 20*log10(d_km) + 20*log10(f_MHz) + 32.44
 * 2. Parabolic Antenna Gain:
 *    G (dBi) = 10*log10(η * (π * d * f / c)²)
 * 3. Half-Power Beamwidth:
 *    HPBW (deg) ≈ 70 * (c / f) / d
 * 4. Antenna Pointing Loss:
 *    L_point (dB) = 12 * (θ_err / HPBW)²
 * 5. Atmospheric Loss (Cosecant Model):
 *    L_atm (dB) = L_zenith / sin(max(el, 5°))
 * 6. Carrier-to-Noise Density:
 *    C/N0 (dB-Hz) = EIRP - FSPL - L_losses + (G/T) + 228.6
 * 7. Bit Energy-to-Noise:
 *    Eb/N0 (dB) = C/N0 - 10*log10(Rb)
 * 8. Link Margin:
 *    Margin (dB) = Eb/N0 - Eb/N0_req - L_impl
 */

export const SPEED_OF_LIGHT_M_S = 299792458;
export const BOLTZMANN_DB = -228.6; // dBW / (Hz·K)

/**
 * Free-Space Path Loss in dB
 * @param dKm Slant range distance in kilometers (> 0)
 * @param fMHz Carrier frequency in MHz (> 0)
 */
export function fsplDb(dKm: number, fMHz: number): number {
  if (dKm <= 0 || fMHz <= 0) return 0.0;
  return 20.0 * Math.log10(dKm) + 20.0 * Math.log10(fMHz) + 32.44;
}

/**
 * Parabolic Dish Antenna Gain in dBi
 * @param dM Dish aperture diameter in meters
 * @param fHz Center frequency in Hz
 * @param eta Aperture efficiency (default 0.55 = 55%)
 */
export function parabolicGainDbi(dM: number, fHz: number, eta = 0.55): number {
  if (dM <= 0 || fHz <= 0 || eta <= 0) return 0.0;
  const factor = (Math.PI * dM * fHz) / SPEED_OF_LIGHT_M_S;
  return 10.0 * Math.log10(eta * Math.pow(factor, 2));
}

/**
 * Approximate Half-Power Beamwidth (HPBW) in degrees for circular aperture
 * @param dM Dish aperture diameter in meters
 * @param fHz Center frequency in Hz
 */
export function hpbwDeg(dM: number, fHz: number): number {
  if (dM <= 0 || fHz <= 0) return 360.0;
  const wavelengthM = SPEED_OF_LIGHT_M_S / fHz;
  return 70.0 * (wavelengthM / dM);
}

/**
 * Off-boresight antenna pointing loss in dB
 * @param errDeg Off-axis pointing error in degrees
 * @param hpbwDegrees Half-power beamwidth in degrees
 */
export function pointingLossDb(errDeg: number, hpbwDegrees: number): number {
  if (hpbwDegrees <= 0) return 0.0;
  return 12.0 * Math.pow(errDeg / hpbwDegrees, 2);
}

/**
 * Simplified atmospheric cosecant attenuation model in dB
 * @param elevationDeg Satellite topocentric elevation in degrees
 * @param zenithLossDb Attenuation at zenith (default 0.35 dB for clear sky)
 */
export function atmosphericLossDb(elevationDeg: number, zenithLossDb = 0.35): number {
  const rad = (Math.max(elevationDeg, 5.0) * Math.PI) / 180.0;
  return zenithLossDb / Math.sin(rad);
}

export interface LinkBudgetInputs {
  // Transceiver parameters
  carrierFreqHz: number;          // e.g. 437e6, 2.2e9, 8.2e9
  txPowerWatts: number;           // Spacecraft RF output power (Watts)
  txAntennaGainDbi: number;       // Satellite antenna gain (dBi)
  txCableLossDb: number;          // Satellite transmitter line loss (dB)

  // Ground station parameters
  rxAntennaGainDbi: number;       // Ground station antenna gain (dBi)
  rxCableLossDb: number;          // Ground receiver feeder loss (dB)
  rxSystemNoiseTempK: number;     // Ground receiver system noise temperature (Kelvin)
  pointingErrorDeg: number;       // Ground tracking alignment error (deg)
  groundDishDiameterM?: number;   // Optional dish diameter for HPBW pointing loss calculation

  // Link & modulation parameters
  dataRateBps: number;            // Transmission bit rate (bits per second)
  requiredEbN0Db: number;         // Minimum required Eb/N0 for target BER (e.g. 9.6 dB for BPSK @ 1e-5)
  implementationLossDb: number;   // Demodulator implementation degradation (dB)
  polarizationLossDb: number;     // Polarization mismatch (dB, e.g. 0.3 dB)

  // Topocentric geometry
  slantRangeKm: number;           // Range from observer to satellite (km)
  elevationDeg: number;           // Look elevation angle (deg)
}

export interface LinkBudgetResult {
  fsplDb: number;
  eirpDbw: number;
  totalLossesDb: number;
  prDbw: number;
  prDbm: number;
  gOverTDbK: number;
  cNoDbHz: number;
  ebNoDb: number;
  marginDb: number;
  verdict: 'CLOSED' | 'MARGINAL' | 'FAILED';
  maxSupportableDataRateBps: number;
}

/**
 * Computes end-to-end space-to-ground downlink RF link budget
 */
export function computeLinkBudget(inputs: LinkBudgetInputs): LinkBudgetResult {
  const fMHz = inputs.carrierFreqHz / 1e6;
  const dKm = Math.max(inputs.slantRangeKm, 1.0);

  // 1. Path Loss
  const fspl = fsplDb(dKm, fMHz);

  // 2. Transmitter EIRP
  const txPowerDbw = 10.0 * Math.log10(Math.max(inputs.txPowerWatts, 1e-4));
  const eirp = txPowerDbw + inputs.txAntennaGainDbi - Math.max(inputs.txCableLossDb, 0);

  // 3. Propagation & Pointing Losses
  const lAtm = atmosphericLossDb(inputs.elevationDeg);
  const hpbw = inputs.groundDishDiameterM && inputs.groundDishDiameterM > 0
    ? hpbwDeg(inputs.groundDishDiameterM, inputs.carrierFreqHz)
    : 30.0;
  const lPoint = pointingLossDb(inputs.pointingErrorDeg || 0, hpbw);
  const lPol = inputs.polarizationLossDb || 0.3;
  const lTotal = fspl + lAtm + lPoint + lPol + (inputs.rxCableLossDb || 0);

  // 4. Received Power
  const prDbw = eirp - lTotal + inputs.rxAntennaGainDbi;
  const prDbm = prDbw + 30.0;

  // 5. Ground Station Figure of Merit (G/T in dB/K)
  const gOverT = inputs.rxAntennaGainDbi - 10.0 * Math.log10(Math.max(inputs.rxSystemNoiseTempK, 20.0));

  // 6. Carrier-to-Noise Spectral Density (C/N0 in dB-Hz)
  // C/N0 = EIRP - L_total + G/T - 10*log10(k_B) = EIRP - L_total + G/T + 228.6
  const cNo = eirp - (fspl + lAtm + lPoint + lPol) + gOverT + 228.6;

  // 7. Energy per Bit to Noise Power Density (Eb/N0 in dB)
  const rateDb = 10.0 * Math.log10(Math.max(inputs.dataRateBps, 1.0));
  const ebNo = cNo - rateDb;

  // 8. Link Margin (dB)
  const margin = ebNo - inputs.requiredEbN0Db - (inputs.implementationLossDb || 1.5);

  // 9. Verdict: Closed (>= 3 dB), Marginal (0 to 3 dB), Failed (< 0 dB)
  let verdict: 'CLOSED' | 'MARGINAL' | 'FAILED' = 'FAILED';
  if (margin >= 3.0) {
    verdict = 'CLOSED';
  } else if (margin >= 0.0) {
    verdict = 'MARGINAL';
  }

  // 10. Maximum Supportable Data Rate for 3 dB margin
  const maxRateDb = cNo - (inputs.requiredEbN0Db + (inputs.implementationLossDb || 1.5) + 3.0);
  const maxSupportableDataRateBps = Math.max(0, Math.floor(Math.pow(10, maxRateDb / 10.0)));

  return {
    fsplDb: Number(fspl.toFixed(2)),
    eirpDbw: Number(eirp.toFixed(2)),
    totalLossesDb: Number(lTotal.toFixed(2)),
    prDbw: Number(prDbw.toFixed(2)),
    prDbm: Number(prDbm.toFixed(2)),
    gOverTDbK: Number(gOverT.toFixed(2)),
    cNoDbHz: Number(cNo.toFixed(2)),
    ebNoDb: Number(ebNo.toFixed(2)),
    marginDb: Number(margin.toFixed(2)),
    verdict,
    maxSupportableDataRateBps,
  };
}

/**
 * Standard Space Mission Link Presets (Illustrative engineering configurations)
 */
export const LINK_BUDGET_PRESETS = {
  UHF_CUBESAT: {
    name: 'Amateur UHF CubeSat (437 MHz)',
    carrierFreqHz: 437.5e6,
    txPowerWatts: 1.0,         // 1 Watt (0 dBW)
    txAntennaGainDbi: 2.15,    // Monopole/dipole
    txCableLossDb: 0.5,
    rxAntennaGainDbi: 14.5,    // 10-element Yagi antenna
    rxCableLossDb: 1.0,
    rxSystemNoiseTempK: 250.0, // Preamp LNA
    pointingErrorDeg: 3.0,
    groundDishDiameterM: 0.0,
    dataRateBps: 9600,         // 9.6 kbps GFSK
    requiredEbN0Db: 9.6,
    implementationLossDb: 1.5,
    polarizationLossDb: 0.5,
  },
  SBAND_LEO: {
    name: 'S-Band LEO SmallSat Telemetry (2.2 GHz)',
    carrierFreqHz: 2.24e9,
    txPowerWatts: 5.0,         // 5 Watts (7 dBW)
    txAntennaGainDbi: 6.0,     // Patch array antenna
    txCableLossDb: 1.0,
    rxAntennaGainDbi: 25.0,    // 2.4-meter ground dish
    rxCableLossDb: 0.8,
    rxSystemNoiseTempK: 150.0,
    pointingErrorDeg: 1.2,
    groundDishDiameterM: 2.4,
    dataRateBps: 2000000,      // 2 Mbps QPSK
    requiredEbN0Db: 10.5,
    implementationLossDb: 2.0,
    polarizationLossDb: 0.3,
  },
  XBAND_PAYLOAD: {
    name: 'X-Band High-Rate Payload Downlink (8.2 GHz)',
    carrierFreqHz: 8.2e9,
    txPowerWatts: 10.0,        // 10 Watts (10 dBW)
    txAntennaGainDbi: 14.0,    // Horn / steerable patch
    txCableLossDb: 1.5,
    rxAntennaGainDbi: 46.0,    // 3.7-meter deep dish
    rxCableLossDb: 0.5,
    rxSystemNoiseTempK: 110.0, // Cryo-cooled/low-noise LNA
    pointingErrorDeg: 0.25,
    groundDishDiameterM: 3.7,
    dataRateBps: 150000000,    // 150 Mbps 8PSK Rate 3/4
    requiredEbN0Db: 8.5,
    implementationLossDb: 2.5,
    polarizationLossDb: 0.2,
  },
};
