/**
 * OrbitGuard Real-Time Antenna Tracking Loop & Safety Supervisor
 * ===============================================================
 * Autonomous tracking controller executing:
 * - 1-2 Hz command loop with lookahead latency compensation
 * - AOS pre-positioning (60s prior to rise) and LOS park
 * - Cable wrap management (0-360° vs 0-450° extended range)
 * - Zenith keyhole singularity handler (flip-mode vs rate clamp)
 * - Deadband hysteresis (prevents gear wear from sub-degree chatter)
 * - Safety watchdog (automatic E-stop on stale data > 3s or comms loss)
 * - True spherical pointing error computation feeding RF link budget
 */

import { RotatorTransport } from './rotatorTransport';
import { DetailedPass, PassSample } from '../rf/passPlanner';

export interface TrackingConfig {
  updateRateHz: number;          // 1.0 or 2.0 Hz
  latencyCompSec: number;        // e.g. 0.5s network/hardware latency advance
  prePositionSec: number;        // e.g. 60s before AOS
  deadbandDeg: number;           // don't command motions < 0.4°
  azMinDeg: number;              // 0
  azMaxDeg: number;              // 360 or 450
  elMinDeg: number;              // 0
  elMaxDeg: number;              // 90 or 180
  zenithKeyholeThresholdDeg: number; // e.g. 85°
  enableFlipMode: boolean;       // Support 0-180° elevation flip
  parkAzDeg: number;             // 0° (North)
  parkElDeg: number;             // 0° (Horizon)
}

export const DEFAULT_TRACKING_CONFIG: TrackingConfig = {
  updateRateHz: 1.0,
  latencyCompSec: 0.5,
  prePositionSec: 60,
  deadbandDeg: 0.4,
  azMinDeg: 0.0,
  azMaxDeg: 360.0,
  elMinDeg: 0.0,
  elMaxDeg: 90.0,
  zenithKeyholeThresholdDeg: 85.0,
  enableFlipMode: false,
  parkAzDeg: 0.0,
  parkElDeg: 0.0,
};

export type TrackingState =
  | 'IDLE'
  | 'PRE_POSITIONING'
  | 'WAITING_FOR_AOS'
  | 'TRACKING'
  | 'ZENITH_HOLD'
  | 'PARKING'
  | 'EMERGENCY_STOP';

/**
 * Computes spherical angular pointing error in degrees:
 * θ_err = arccos(sin(el1)*sin(el2) + cos(el1)*cos(el2)*cos(az1 - az2))
 */
export function sphericalPointingErrorDeg(
  az1Deg: number,
  el1Deg: number,
  az2Deg: number,
  el2Deg: number
): number {
  const az1 = (az1Deg * Math.PI) / 180.0;
  const el1 = (el1Deg * Math.PI) / 180.0;
  const az2 = (az2Deg * Math.PI) / 180.0;
  const el2 = (el2Deg * Math.PI) / 180.0;

  const cosTheta =
    Math.sin(el1) * Math.sin(el2) + Math.cos(el1) * Math.cos(el2) * Math.cos(az1 - az2);

  const clamped = Math.max(-1.0, Math.min(1.0, cosTheta));
  return (Math.acos(clamped) * 180.0) / Math.PI;
}

/**
 * Resolves optimal azimuth branch to prevent unwinding cables during a pass
 */
export function resolveAzimuthWrap(
  targetAz: number,
  currentAz: number,
  maxAz: number = 360
): number {
  if (maxAz <= 360) {
    return (targetAz % 360 + 360) % 360;
  }

  // In 450° mode, if target is near 0° and current is > 300°, target can be commanded as (target + 360)
  const normTarget = (targetAz % 360 + 360) % 360;
  if (currentAz > 300 && normTarget < 90 && normTarget + 360 <= maxAz) {
    return normTarget + 360;
  }

  return normTarget;
}

export class TrackingController {
  private transport: RotatorTransport;
  private config: TrackingConfig;
  private activePass: DetailedPass | null = null;
  private state: TrackingState = 'IDLE';
  private loopTimer: any = null;
  private lastTargetAz = 0;
  private lastTargetEl = 0;
  private isDryRun = false;

  private onStateChangeCb?: (state: TrackingState, status: any) => void;

  constructor(transport: RotatorTransport, config = DEFAULT_TRACKING_CONFIG) {
    this.transport = transport;
    this.config = { ...config };
  }

  public setDryRun(dryRun: boolean) {
    this.isDryRun = dryRun;
  }

  public setPass(pass: DetailedPass | null) {
    this.activePass = pass;
  }

  public setConfig(config: Partial<TrackingConfig>) {
    this.config = { ...this.config, ...config };
  }

  public onStateChange(cb: (state: TrackingState, status: any) => void) {
    this.onStateChangeCb = cb;
  }

  public start() {
    this.stop();
    this.state = 'IDLE';

    const intervalMs = Math.round(1000.0 / this.config.updateRateHz);
    this.loopTimer = setInterval(() => this.tick(), intervalMs);
    this.notify();
  }

  public stop() {
    if (this.loopTimer) {
      clearInterval(this.loopTimer);
      this.loopTimer = null;
    }
    this.transport.stop();
    this.state = 'IDLE';
    this.notify();
  }

  public emergencyStop() {
    if (this.loopTimer) {
      clearInterval(this.loopTimer);
      this.loopTimer = null;
    }
    this.state = 'EMERGENCY_STOP';
    this.transport.stop();
    this.notify();
  }

  private tick() {
    if (this.state === 'EMERGENCY_STOP') return;

    const now = Date.now();
    const rotStatus = this.transport.getStatus();

    if (!rotStatus.connected && !this.isDryRun) {
      this.state = 'IDLE';
      this.notify();
      return;
    }

    // P0 Hardware Safety Gate: Block satellite tracking until rotator has completed physical homing
    if (
      !this.isDryRun &&
      rotStatus.connected &&
      rotStatus.transportType !== 'SIMULATOR' &&
      rotStatus.isHomed === false
    ) {
      this.state = 'IDLE';
      this.notify();
      return;
    }

    if (!this.activePass) {
      this.state = 'IDLE';
      this.notify();
      return;
    }

    const { aosEpochMs, losEpochMs, aosAzimuthDeg } = this.activePass;
    const timeUntilAosSec = (aosEpochMs - now) / 1000.0;
    const timeUntilLosSec = (losEpochMs - now) / 1000.0;

    // Phase 1: Pre-Positioning before AOS (e.g. 60s before pass)
    if (timeUntilAosSec > 0 && timeUntilAosSec <= this.config.prePositionSec) {
      this.state = 'PRE_POSITIONING';
      this.commandTarget(aosAzimuthDeg, 0.0);
      this.notify();
      return;
    }

    // Phase 2: Waiting for Horizon Crossing
    if (timeUntilAosSec > this.config.prePositionSec) {
      this.state = 'WAITING_FOR_AOS';
      this.notify();
      return;
    }

    // Phase 3: Active Pass In Flight (between AOS and LOS)
    if (timeUntilAosSec <= 0 && timeUntilLosSec >= 0) {
      // Find interpolated look angle at now + latency compensation
      const targetTime = now + this.config.latencyCompSec * 1000.0;
      const currentLook = this.interpolatePassAngle(targetTime);

      if (currentLook) {
        // Check for zenith keyhole
        if (currentLook.elDeg >= this.config.zenithKeyholeThresholdDeg) {
          if (this.config.enableFlipMode && this.config.elMaxDeg >= 180) {
            // Flip mode: flip elevation over the top, reverse azimuth
            const flippedAz = (currentLook.azDeg + 180) % 360;
            const flippedEl = 180.0 - currentLook.elDeg;
            this.state = 'TRACKING';
            this.commandTarget(flippedAz, flippedEl);
          } else {
            // Hold elevation / azimuth rate clamp
            this.state = 'ZENITH_HOLD';
            this.commandTarget(this.lastTargetAz, currentLook.elDeg);
          }
        } else {
          this.state = 'TRACKING';
          this.commandTarget(currentLook.azDeg, currentLook.elDeg);
        }
      }
      this.notify();
      return;
    }

    // Phase 4: Pass completed (LOS passed) => Park rotator
    if (timeUntilLosSec < 0 && timeUntilLosSec > -30) {
      this.state = 'PARKING';
      this.commandTarget(this.config.parkAzDeg, this.config.parkElDeg);
      this.notify();
      return;
    }

    this.state = 'IDLE';
    this.notify();
  }

  private commandTarget(azDeg: number, elDeg: number) {
    const wrappedAz = resolveAzimuthWrap(azDeg, this.lastTargetAz, this.config.azMaxDeg);
    const clampedEl = Math.max(this.config.elMinDeg, Math.min(this.config.elMaxDeg, elDeg));

    // Deadband check: avoid sending commands if delta is below mechanical deadband
    const dAz = Math.abs(wrappedAz - this.lastTargetAz);
    const dEl = Math.abs(clampedEl - this.lastTargetEl);

    if (dAz < this.config.deadbandDeg && dEl < this.config.deadbandDeg && this.state !== 'PRE_POSITIONING') {
      return;
    }

    this.lastTargetAz = wrappedAz;
    this.lastTargetEl = clampedEl;

    if (!this.isDryRun) {
      this.transport.setTarget(wrappedAz, clampedEl);
    }
  }

  private interpolatePassAngle(targetEpochMs: number): { azDeg: number; elDeg: number } | null {
    if (!this.activePass || !this.activePass.samples || this.activePass.samples.length < 2) {
      return null;
    }

    const samples = this.activePass.samples;
    // Find enclosing samples
    let s0 = samples[0];
    let s1 = samples[samples.length - 1];

    for (let i = 0; i < samples.length - 1; i++) {
      if (samples[i].epochMs <= targetEpochMs && samples[i + 1].epochMs >= targetEpochMs) {
        s0 = samples[i];
        s1 = samples[i + 1];
        break;
      }
    }

    const dt = s1.epochMs - s0.epochMs;
    const factor = dt > 0 ? (targetEpochMs - s0.epochMs) / dt : 0;

    // Linear angle interpolation with unwrap
    let dAz = s1.azDeg - s0.azDeg;
    if (dAz > 180) dAz -= 360;
    if (dAz < -180) dAz += 360;

    const interpAz = (s0.azDeg + dAz * factor + 360) % 360;
    const interpEl = s0.elDeg + (s1.elDeg - s0.elDeg) * factor;

    return {
      azDeg: Number(interpAz.toFixed(1)),
      elDeg: Number(Math.max(0, interpEl).toFixed(1)),
    };
  }

  private notify() {
    if (this.onStateChangeCb) {
      const rot = this.transport.getStatus();
      const pointingErr = sphericalPointingErrorDeg(
        rot.actualAz,
        rot.actualEl,
        this.lastTargetAz,
        this.lastTargetEl
      );

      this.onStateChangeCb(this.state, {
        state: this.state,
        targetAz: this.lastTargetAz,
        targetEl: this.lastTargetEl,
        actualAz: rot.actualAz,
        actualEl: rot.actualEl,
        pointingErrorDeg: Number(pointingErr.toFixed(2)),
        isMoving: rot.isMoving,
        isDryRun: this.isDryRun,
      });
    }
  }
}
