/**
 * OrbitGuard Web Worker Hook (Phase 2)
 * =====================================
 * Manages the background SGP4 Web Worker lifecycle and ping-pong zero-copy transferable
 * Float32Array / Uint8Array buffers.
 *
 * Runs SGP4 orbital propagation at ~1-2 Hz off the main thread.
 * Coordinates are output in TEME scene units (R_E = 1.0).
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
  orbitPoints: [number, number, number][];
  requestOrbitPath: (noradId: number, timeMs?: number) => void;
}

interface BufferPair {
  pos: Float32Array;
  vel: Float32Array;
  status: Uint8Array;
}

export function usePropagatorWorker(catalog: any[]): UsePropagatorWorkerResult {
  const workerRef = useRef<Worker | null>(null);
  const simulationSpeed = useOrbitStore((state) => state.simulationSpeed);

  const [isReady, setIsReady] = useState(false);
  const [workerMs, setWorkerMs] = useState(0);
  const [validCount, setValidCount] = useState(0);
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

  // Spare buffer set for ping-pong transfers
  const spareBufferRef = useRef<BufferPair | null>(null);
  const isWorkerBusyRef = useRef<boolean>(false);
  const simTimeRef = useRef<number>(Date.now());
  const lastWallTimeRef = useRef<number>(performance.now());

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
        const { targetTimeMs, workerMs: latencyMs, validCount: count, posBuffer, velBuffer, statusBuffer } = payload;

        // The returned buffers become the new active buffers
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

  // Initialize catalog in worker & allocate ping-pong buffers
  useEffect(() => {
    if (!workerRef.current || catalog.length === 0) return;

    const count = catalog.length;

    // Allocate spare buffers for ping-pong
    spareBufferRef.current = {
      pos: new Float32Array(count * 3),
      vel: new Float32Array(count * 3),
      status: new Uint8Array(count),
    };

    setIsReady(false);
    workerRef.current.postMessage({
      type: 'INIT_CATALOG',
      payload: { catalog },
    });
  }, [catalog]);

  // Propagation tick loop (~2 Hz or every 500 ms)
  useEffect(() => {
    if (!isReady || catalog.length === 0) return;

    const tickInterval = 500; // ms

    const intervalId = setInterval(() => {
      if (isWorkerBusyRef.current || !workerRef.current || !spareBufferRef.current) {
        return;
      }

      // Advance simulated time based on elapsed wall time and simulationSpeed
      const nowWall = performance.now();
      const elapsedWall = (nowWall - lastWallTimeRef.current) / 1000;
      lastWallTimeRef.current = nowWall;

      simTimeRef.current += elapsedWall * 1000 * simulationSpeed;
      const targetTimeMs = simTimeRef.current;

      const buffers = spareBufferRef.current;
      // Mark worker busy
      isWorkerBusyRef.current = true;

      // Transfer spare buffers to worker
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

      // Re-allocate spare buffers for the NEXT tick (or wait for returned buffers)
      // Since ArrayBuffers were transferred, we allocate a fresh holder for the next outgoing tick
      spareBufferRef.current = {
        pos: new Float32Array(catalog.length * 3),
        vel: new Float32Array(catalog.length * 3),
        status: new Uint8Array(catalog.length),
      };
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
    orbitPoints,
    requestOrbitPath,
  };
}

export default usePropagatorWorker;
