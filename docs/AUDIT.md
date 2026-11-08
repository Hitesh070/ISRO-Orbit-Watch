# OrbitGuard Accuracy Audit — v5.0

**Status date:** 2026-11-08

This document replaces the old v2.1 architecture/roadmap audit, whose release state and several implementation claims no longer describe this repository. The current manual and automated checks are recorded in [`RELEASE_V5.0.md`](RELEASE_V5.0.md).

## Current product behavior

- The globe displays SGP4 predictions derived from a timestamped CelesTrak CCSDS OMM/GP catalog snapshot. It is not live sensor tracking.
- The snapshot observed during the v5.0 manual review was generated at 2026-11-08 04:16:07 UTC and marked stale after six hours. It contained 3,782 records: 1,109 active satellites and 2,673 debris/rocket bodies. Seven records were excluded by the current TLE propagator.
- Analytics counts describe the currently loaded records and selected filters. They are not a census guarantee or a physical collision-risk estimate.
- The bundled conjunction data is withdrawn because previous probabilities used synthetic covariance. The application shows screening unavailable when no verified event snapshot is loaded. Missing results do not mean a clear orbit.
- Collision probability requires measured covariance and physical hard-body data from an authoritative CDM. The application must not synthesize these values.
- RF calculations need a site location, usable pass, and verified frequency/mission inputs. Rotator telemetry requires a connected compatible device.

## Validation status

See [`RELEASE_V5.0.md`](RELEASE_V5.0.md) for manual section coverage and actual test/build results. Historical proposals and measurements in the former audit document are not acceptance evidence for v5.0.
