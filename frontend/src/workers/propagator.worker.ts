/**
 * OrbitGuard High-Performance Web Worker Propagator (Phase 2)
 * ============================================================
 * Offloads SGP4 orbital propagation of 25,000+ objects from the main thread.
 * Uses ping-pong zero-copy transferable TypedArrays (Float32Array) for maximum throughput.
 *
 * All coordinates are computed in TEME (Earth-Centered Inertial) and normalized to scene units
 * (Earth radius = 1.0 unit, scale = 1.0 / 6378.137 km).
 */

import * as satellite from 'satellite.js';

const KM_TO_SCENE = 1.0 / 6378.137;

interface CatalogItem {
  norad_id: number;
  name: string;
  line1: string;
  line2: string;
  object_type?: string;
  country?: string;
  is_isro?: boolean;
  regime?: string;
  risk_level?: string;
}

interface WorkerState {
  catalog: CatalogItem[];
  satrecs: (satellite.SatRec | null)[];
  count: number;
}

const state: WorkerState = {
  catalog: [],
  satrecs: [],
  count: 0,
};

self.onmessage = (event: MessageEvent) => {
  const { type, payload } = event.data;

  switch (type) {
    case 'INIT_CATALOG': {
      const items: CatalogItem[] = payload.catalog || [];
      state.catalog = items;
      state.count = items.length;
      state.satrecs = new Array(state.count);

      for (let i = 0; i < state.count; i++) {
        const item = items[i];
        try {
          if (item.line1 && item.line2) {
            const satrec = satellite.twoline2satrec(item.line1, item.line2);
            state.satrecs[i] = satrec.error ? null : satrec;
          } else {
            state.satrecs[i] = null;
          }
        } catch {
          state.satrecs[i] = null;
        }
      }

      self.postMessage({
        type: 'INIT_COMPLETE',
        payload: { count: state.count },
      });
      break;
    }

    case 'PROPAGATE_TICK': {
      const { targetTimeMs, posBuffer, velBuffer, statusBuffer } = payload;
      const t0 = performance.now();
      const date = new Date(targetTimeMs);

      const positions = new Float32Array(posBuffer);
      const velocities = new Float32Array(velBuffer);
      const statuses = new Uint8Array(statusBuffer);

      let validCount = 0;

      for (let i = 0; i < state.count; i++) {
        const satrec = state.satrecs[i];
        const idx3 = i * 3;

        if (!satrec) {
          positions[idx3] = NaN;
          positions[idx3 + 1] = NaN;
          positions[idx3 + 2] = NaN;
          velocities[idx3] = 0;
          velocities[idx3 + 1] = 0;
          velocities[idx3 + 2] = 0;
          statuses[i] = 0;
          continue;
        }

        try {
          const pv = satellite.propagate(satrec, date);

          if (!pv.position || typeof pv.position === 'boolean' || isNaN((pv.position as any).x)) {
            positions[idx3] = NaN;
            positions[idx3 + 1] = NaN;
            positions[idx3 + 2] = NaN;
            velocities[idx3] = 0;
            velocities[idx3 + 1] = 0;
            velocities[idx3 + 2] = 0;
            statuses[i] = 0;
            continue;
          }

          const pos = pv.position as { x: number; y: number; z: number };
          const vel = pv.velocity as { x: number; y: number; z: number } | undefined;

          // Native TEME Coordinates mapped to Three.js Frame (+Y is North, +X is vernal equinox, -Y_TEME is +Z)
          const px = pos.x * KM_TO_SCENE;
          const py = pos.z * KM_TO_SCENE; // North pole
          const pz = -pos.y * KM_TO_SCENE;

          const vx = (vel ? vel.x : 0) * KM_TO_SCENE;
          const vy = (vel ? vel.z : 0) * KM_TO_SCENE;
          const vz = (vel ? -vel.y : 0) * KM_TO_SCENE;

          positions[idx3] = px;
          positions[idx3 + 1] = py;
          positions[idx3 + 2] = pz;

          velocities[idx3] = vx;
          velocities[idx3 + 1] = vy;
          velocities[idx3 + 2] = vz;

          statuses[i] = 1; // Valid operational state
          validCount++;
        } catch {
          positions[idx3] = NaN;
          positions[idx3 + 1] = NaN;
          positions[idx3 + 2] = NaN;
          statuses[i] = 0;
        }
      }

      const workerMs = performance.now() - t0;

      // Transfer buffers back to main thread with ZERO COPY
      (self as any).postMessage(
        {
          type: 'TICK_RESULT',
          payload: {
            targetTimeMs,
            workerMs: Number(workerMs.toFixed(2)),
            validCount,
            posBuffer: positions.buffer,
            velBuffer: velocities.buffer,
            statusBuffer: statuses.buffer,
          },
        },
        [positions.buffer, velocities.buffer, statuses.buffer]
      );
      break;
    }

    case 'COMPUTE_ORBIT_PATH': {
      const { noradId, numPoints = 180, timeMs = Date.now(), line1, line2 } = payload;
      const targetStr = String(noradId);
      const targetNum = Number(noradId);

      let satrec: satellite.SatRec | null = null;
      const idx = state.catalog.findIndex((c) => {
        if (c.norad_id === targetNum || String(c.norad_id) === targetStr) return true;
        if ((c as any).alt_alias_id && (c as any).alt_alias_id === targetNum) return true;
        if (Array.isArray((c as any).alt_alias_ids) && (c as any).alt_alias_ids.includes(targetNum)) return true;
        return false;
      });

      if (idx !== -1 && state.satrecs[idx]) {
        satrec = state.satrecs[idx];
      } else if (line1 && line2) {
        try {
          const s = satellite.twoline2satrec(line1, line2);
          if (!s.error) satrec = s;
        } catch {
          satrec = null;
        }
      }

      if (!satrec) {
        self.postMessage({
          type: 'ORBIT_PATH_RESULT',
          payload: { noradId, points: [] },
        });
        return;
      }
      const meanMotionRevDay = (satrec.no * 1440.0) / (2.0 * Math.PI);
      const periodMinutes = meanMotionRevDay > 0 ? 1440.0 / meanMotionRevDay : 96.0;

      const points: [number, number, number][] = [];

      for (let i = 0; i <= numPoints; i++) {
        const stepMs = timeMs + (i / numPoints) * periodMinutes * 60 * 1000;
        const d = new Date(stepMs);
        const pv = satellite.propagate(satrec, d);

        if (pv.position && typeof pv.position !== 'boolean') {
          const pos = pv.position as { x: number; y: number; z: number };
          // Native TEME to Three.js Frame
          const px = pos.x * KM_TO_SCENE;
          const py = pos.z * KM_TO_SCENE;
          const pz = -pos.y * KM_TO_SCENE;
          points.push([px, py, pz]);
        }
      }

      self.postMessage({
        type: 'ORBIT_PATH_RESULT',
        payload: { noradId, points },
      });
      break;
    }

    default:
      break;
  }
};
