import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useOrbitStore } from '../store/useOrbitStore';

describe('Simulation Clock & Speed State Machine', () => {
  beforeEach(() => {
    useOrbitStore.setState({
      simulationSpeed: 1,
      simulatedTimeMs: Date.now(),
    });
  });

  it('initializes in 1x real-time mode', () => {
    const state = useOrbitStore.getState();
    expect(state.simulationSpeed).toBe(1);
    expect(Math.abs(state.simulatedTimeMs - Date.now())).toBeLessThan(100);
  });

  it('allows fast-forward simulation speeds (5x, 15x, 60x)', () => {
    const { setSimulationSpeed } = useOrbitStore.getState();

    setSimulationSpeed(5);
    expect(useOrbitStore.getState().simulationSpeed).toBe(5);

    setSimulationSpeed(60);
    expect(useOrbitStore.getState().simulationSpeed).toBe(60);
  });

  it('snaps simulatedTimeMs back to true real-time when returning from fast-forward to 1x', () => {
    const { setSimulationSpeed } = useOrbitStore.getState();

    // Simulate fast-forwarding 2 hours into the future
    const futureTime = Date.now() + 2 * 3600 * 1000;
    useOrbitStore.setState({
      simulationSpeed: 60,
      simulatedTimeMs: futureTime,
    });

    expect(useOrbitStore.getState().simulationSpeed).toBe(60);
    expect(useOrbitStore.getState().simulatedTimeMs).toBe(futureTime);

    // User clicks 1x (Live)
    const beforeSwitch = Date.now();
    setSimulationSpeed(1);
    const afterSwitch = Date.now();

    const state = useOrbitStore.getState();
    expect(state.simulationSpeed).toBe(1);
    // simulatedTimeMs MUST be snapped back to current real-time, NOT the future time!
    expect(state.simulatedTimeMs).toBeGreaterThanOrEqual(beforeSwitch);
    expect(state.simulatedTimeMs).toBeLessThanOrEqual(afterSwitch + 50);
  });

  it('resetToRealTime snaps to Date.now() and sets speed to 1', () => {
    const { resetToRealTime } = useOrbitStore.getState();

    // Put into future
    useOrbitStore.setState({
      simulationSpeed: 15,
      simulatedTimeMs: Date.now() + 500000,
    });

    const now = Date.now();
    resetToRealTime();

    const state = useOrbitStore.getState();
    expect(state.simulationSpeed).toBe(1);
    expect(Math.abs(state.simulatedTimeMs - now)).toBeLessThan(50);
  });
});
