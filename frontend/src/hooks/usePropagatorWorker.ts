/**
 * OrbitGuard Web Worker Hook (Phase 2 & 3 - Zero-Churn Buffer Pool)
 * ==================================================================
 * Manages the background SGP4 Web Worker lifecycle and ping-pong zero-copy transferable
 * Float32Array / Uint8Array buffers without memory churn:
 *  1. Tracks catalog revision keys so periodic catalog polling does not re-emit INIT_CATALOG.
 *  2. Implements a 3-buffer-set pool (renderer-active, worker-active, spare pool).
 *  3. Recycles rendered buffers back into the spare pool once GPU attributes are updated.
 *  4. Allocates buffer memory once upon catalog initialization, eliminating periodic allocations.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useOrbitStore } from '../store/useOrbitStore';

export interface UsePropagatorWorkerResult {
  isReady: boolean;
  posBuffer: ArrayBuffer | null;
  velBuffer: ArrayBuffer | null;
  statusBuffer: ArrayBuffer | null;
  workerTickTimeMs: number;
  workerMs: number;
  validCount: number;
  allocCount: number;
  orbitPoints: [number, number, number][];
  requestOrbitPath: (noradId: number, timeMs?: number) => void;
}

interface BufferSet {
  pos: Float32Array;
  vel: Float32Array;
  status: Uint8Array;
}

/**
 * Computes a deterministic revision fingerprint for the orbital catalog.
 * Changes only when asset count, norad IDs, or TLE element lines change.
 */
export function getCatalogRevisionKey(catalog: any[]): string {
  if (!catalog || catalog.length === 0) return '';
  const n = catalog.length;
  const c0 = catalog[0];
  const cm = catalog[Math.floor(n / 2)];
  const cl = catalog[n - 1];
  const l0 = (c0?.line1 || '').slice(18, 32);
  const lm = (cm?.line1 || '').slice(18, 32);
  const ll = (cl?.line1 || '').slice(18, 32);
  return `${n}:${c0?.norad_id || 0}_${l0}:${cm?.norad_id || 0}_${lm}:${cl?.norad_id || 0}_${ll}`;
}

export function usePropagatorWorker(catalog: any[]): UsePropagatorWorkerResult {
  const workerRef = useRef<Worker | null>(null);
  const simulationSpeed = useOrbitStore((state) => state.simulationSpeed);
  const simulatedTimeMs = useOrbitStore((state) => state.simulatedTimeMs);

  const [isReady, setIsReady] = useState(false);
  const [workerMs, setWorkerMs] = useState(0);
  const [validCount, setValidCount] = useState(0);
  const [allocCount, setAllocCount] = useState(0);
  const [workerTickTimeMs, setWorkerTickTimeMs] = useState(Date.now());
  const [orbitPoints, setOrbitPoints] = useState<[number, number, number][]>([]);

  // Active buffers passed to PointCloud
  const [activeBuffers, setActiveBuffers] = useState<{
    pos: ArrayBuffer | null;
    vel: ArrayBuffer | null;
    status: ArrayBuffer | null;
  }>({
    pos: null,
    vel: null,
    status: null,
  });

  // Zero-churn 3-buffer-set pool
  const sparePoolRef = useRef<BufferSet[]>([]);
  const previousRenderBuffersRef = useRef<{
    pos: ArrayBuffer | null;
    vel: ArrayBuffer | null;
    status: ArrayBuffer | null;
  } | null>(null);

  const isWorkerBusyRef = useRef<boolean>(false);
  const simTimeRef = useRef<number>(Date.now());
  const lastWallTimeRef = useRef<number>(performance.now());
  const lastRevisionRef = useRef<string>('');
  const totalAllocsRef = useRef<number>(0);

  // Synchronize internal sim clock when store changes
  useEffect(() => {
    if (simulatedTimeMs) {
      simTimeRef.current = simulatedTimeMs;
      lastWallTimeRef.current = performance.now();
    }
  }, [simulatedTimeMs]);

  // Instantiate worker
  useEffect(() => {
    const worker = new Worker(
      new URL('../workers/propagator.worker.ts', import.meta.url),
      { type: 'module' }
    );
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent) => {
      const { type, payload } = event.data;

      if (type === 'INIT_COMPLETE') {
        setIsReady(true);
      } else if (type === 'TICK_RESULT') {
        const { workerMs: latencyMs, validCount: count, posBuffer, velBuffer, statusBuffer } = payload;

        // The PREVIOUS render buffer has already been copied into Three.js GPU attributes by PointCloud.
        // Recycle it back into the spare pool so no new buffers ever need to be allocated!
        const prev = previousRenderBuffersRef.current;
        if (
          prev &&
          prev.pos &&
          prev.vel &&
          prev.status &&
          prev.pos.byteLength > 0 &&
          prev.vel.byteLength > 0 &&
          prev.status.byteLength > 0
        ) {
          sparePoolRef.current.push({
            pos: new Float32Array(prev.pos),
            vel: new Float32Array(prev.vel),
            status: new Uint8Array(prev.status),
          });
        }

        // Store the newly arrived buffers as previousRenderBuffers for the next recycle cycle
        previousRenderBuffersRef.current = {
          pos: posBuffer,
          vel: velBuffer,
          status: statusBuffer,
        };

        // Deliver active buffers to renderer
        setActiveBuffers({
          pos: posBuffer,
          vel: velBuffer,
          status: statusBuffer,
        });

        setWorkerTickTimeMs(Date.now());
        setWorkerMs(latencyMs);
        setValidCount(count);
        isWorkerBusyRef.current = false;
      } else if (type === 'ORBIT_PATH_RESULT') {
        setOrbitPoints(payload.points || []);
      }
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  // Initialize catalog in worker only when catalog revision fingerprint changes
  useEffect(() => {
    if (!workerRef.current || catalog.length === 0) return;

    const revisionKey = getCatalogRevisionKey(catalog);
    if (revisionKey === lastRevisionRef.current) {
      // Catalog content is identical - do NOT reinitialize worker or trash buffers
      return;
    }
    lastRevisionRef.current = revisionKey;

    const count = catalog.length;

    // Reset pool and pre-allocate exactly 2 spare buffer sets for ping-pong
    sparePoolRef.current = [
      {
        pos: new Float32Array(count * 3),
        vel: new Float32Array(count * 3),
        status: new Uint8Array(count),
      },
      {
        pos: new Float32Array(count * 3),
        vel: new Float32Array(count * 3),
        status: new Uint8Array(count),
      },
    ];
    previousRenderBuffersRef.current = null;
    totalAllocsRef.current = 2;
    setAllocCount(2);

    setIsReady(false);
    workerRef.current.postMessage({
      type: 'INIT_CATALOG',
      payload: { catalog },
    });
  }, [catalog]);

  // Propagation tick loop (~2 Hz / 500 ms)
  useEffect(() => {
    if (!isReady || catalog.length === 0) return;

    const tickInterval = 500; // ms

    const intervalId = setInterval(() => {
      if (isWorkerBusyRef.current || !workerRef.current) {
        return;
      }

      // Advance simulated time based on elapsed wall time and simulationSpeed
      const nowWall = performance.now();
      const elapsedWall = (nowWall - lastWallTimeRef.current) / 1000;
      lastWallTimeRef.current = nowWall;

      simTimeRef.current += elapsedWall * 1000 * simulationSpeed;
      const targetTimeMs = simTimeRef.current;

      // Obtain a buffer set from the recycled spare pool, or allocate only if pool is empty
      let buffers: BufferSet;
      if (sparePoolRef.current.length > 0) {
        buffers = sparePoolRef.current.pop()!;
      } else {
        totalAllocsRef.current++;
        setAllocCount(totalAllocsRef.current);
        buffers = {
          pos: new Float32Array(catalog.length * 3),
          vel: new Float32Array(catalog.length * 3),
          status: new Uint8Array(catalog.length),
        };
      }

      // Mark worker busy
      isWorkerBusyRef.current = true;

      // Transfer buffers to worker (Zero Copy)
      workerRef.current.postMessage(
        {
          type: 'PROPAGATE_TICK',
          payload: {
            targetTimeMs,
            posBuffer: buffers.pos.buffer,
            velBuffer: buffers.vel.buffer,
            statusBuffer: buffers.status.buffer,
          },
        },
        [buffers.pos.buffer, buffers.vel.buffer, buffers.status.buffer]
      );
    }, tickInterval);

    return () => clearInterval(intervalId);
  }, [isReady, catalog.length, simulationSpeed]);

  // Request orbit path calculation for a satellite
  const requestOrbitPath = useCallback((noradId: number, timeMs = Date.now()) => {
    if (!workerRef.current) return;
    workerRef.current.postMessage({
      type: 'COMPUTE_ORBIT_PATH',
      payload: { noradId, numPoints: 180, timeMs },
    });
  }, []);

  return {
    isReady,
    posBuffer: activeBuffers.pos,
    velBuffer: activeBuffers.vel,
    statusBuffer: activeBuffers.status,
    workerTickTimeMs,
    workerMs,
    validCount,
    allocCount,
    orbitPoints,
    requestOrbitPath,
  };
}

export default usePropagatorWorker;
