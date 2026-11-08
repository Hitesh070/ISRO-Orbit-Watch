# OrbitGuard Performance & Rendering Notes

## Current architecture

- SGP4 catalog propagation runs in a Web Worker.
- Propagated positions and velocities are transferred to the renderer through typed-array buffers.
- The globe renders available catalog points with a Three.js point cloud and custom shader.
- Between propagation updates, the shader extrapolates positions for display. The application projects extrapolated positions to the original radial magnitude to avoid radial drift. This improves visual continuity but does not replace SGP4 or guarantee exact future positions.
- Render frame rate depends on the user's CPU, GPU, display, catalog size, and power state. No fixed FPS or latency guarantee is made by this document.

## Verified numerical checks

The frontend unit suite checks the official Vallado SGP4 verification cases and the short-interval extrapolation error bounds. See [`RELEASE_V5.0.md`](RELEASE_V5.0.md) for the run associated with v5.0. These are correctness tests, not a system-wide performance benchmark.

## Measurements required for a performance claim

Record the device and OS, CPU/GPU, display resolution/scale, catalog snapshot size, browser/Electron version, warm-up period, test duration, and raw profiler output. Report median and percentile frame time and worker duration. Do not infer 60 FPS, zero allocations, one draw call across all render paths, or large-catalog capacity from source inspection alone.

## Coordinate handling

Orbital states are propagated in the frame defined by their element/propagator implementation. The Earth model and ground-track computations apply their own time/frame conversions. A visual frame alignment is not evidence that every display value is transformed to a common high-precision frame; consult the relevant implementation and tests before using outputs operationally.
