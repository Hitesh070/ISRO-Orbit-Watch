# OrbitGuard Changelog

All notable changes to the OrbitGuard project are documented in this file.
The project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [v4.1] - 2026-11-06 (Phase 6: Release & Technical Polish)
### Added
- **Global In-App Help & Shortcuts Modal** (`HelpModal.tsx`): Keyboard shortcuts (`~`, `?`, `Esc`, `1`, `5`, `6`), astrodynamics architecture summary, and operational scientific assumptions.
- **Technical Interview Defense Guide** (`docs/INTERVIEW_NOTES.md`): Module-by-module equations, assumptions, limitations, validation records, and 15 model interview questions for ISRO Scientist/Engineer 'SC' and HAL positions.
- **Security & Content Protection**: Content-Security-Policy headers in `vercel.json` and responsible disclosure guidelines in `SECURITY.md`.
- **Global Keyboard Hotkeys**: Integrated listeners across all routes.

### Fixed
- **Site-Wide Scroll Lock**: Eliminated `overflow: hidden` on `body` in `index.css` and removed global `select-none` from root layout, enabling natural page scrolling and text selection.
- **Probability Formatter Safety**: Replaced unprotected `.toExponential()` calls in `RiskTable`, `ConjunctionPanel`, and `EncounterPlanePlot` with a safe `formatPc(val, digits)` helper.

---

## [v4.0] - 2026-11-06 (Phase 5: Antenna Rotator Controller & Embedded Firmware)
### Added
- **Unified Rotator Transport Layer** (`rotatorTransport.ts`):
  - `SimulatorTransport`: Virtual dual-axis rotator with realistic motor acceleration and slew dynamics.
  - `WebSerialTransport`: Direct USB-CDC communication via Web Serial API (`navigator.serial`).
  - `LocalBridgeTransport`: Connects to local daemon on `ws://127.0.0.1:8765`.
- **Protocol Encoders & Decoders** (`protocolEncoders.ts`):
  - Yaesu GS-232A/B (`W<AAA> <EEE>\r`, `S\r`, `C2\r`) with dual ASCII/binary reply parsing.
  - Easycomm I/II (`AZ<deg> EL<deg>\n`).
  - Hamlib `rotctld` (`P <az> <el>\n`, `p\n`).
- **Tracking Supervisor & Kinematics** (`trackingLogic.ts`):
  - 1–2 Hz command loop with lookahead latency compensation.
  - Azimuth cable wrap resolution for $450^\circ$ rotators.
  - Zenith keyhole singularity handler ($>85^\circ$ elevation flip-mode or rate clamp).
  - True 3D spherical pointing error calculation $\theta_{\text{err}}$.
  - Safety watchdog with 15-second timeout and Emergency Stop (E-Stop).
- **Interactive Rotator Dashboard** (`RotatorPanel.tsx`): Azimuth/Elevation dials, manual nudge, auto-tracking toggle, and live protocol transaction terminal.
- **Embedded ESP32 Firmware Reference Design** (`firmware/rotator-esp32/`): PlatformIO setup, AccelStepper integration, TMC2209 driver step/dir control, and hardware architecture documentation (`docs/hardware/rotator.md`).

---

## [v3.2] - 2026-11-06 (Phase 4: EEE/RF Ground Station Suite)
### Added
- **Astrodynamic Doppler Engine** (`doppler.ts`): Range rate calculation compensating for observer diurnal tangential velocity ($\mathbf{v}_{\text{obs}} = [-\omega_E y, \omega_E x, 0]^T$), central difference Doppler rate (Hz/s), and uplink pre-compensation.
- **RF Link Budget & Free Space Path Loss** (`linkBudget.ts`): FSPL ($20\log_{10} d + 20\log_{10} f + 32.44$), parabolic antenna gain, pointing loss, atmospheric cosecant attenuation, $C/N_0$, $E_b/N_0$, and link margin along the entire pass.
- **Sub-Second Pass Planner** (`passPlanner.ts`): Bisection elevation crossing refinement to $<1\text{ s}$, golden section TCA search, and standard `.ics` calendar and `.csv` export.
- **Polar Sky Plot** (`PolarSkyPlot.tsx`): North-up circular SVG topocentric sky track.
- **Dynamic Doppler & Link Charts** (`DopplerCurveChart.tsx`, `LinkBudgetPanel.tsx`).
- **Frequency Database** (`frequencies.json`): User-editable frequencies with verified status badges.

---

## [v3.1] - 2026-11-06 (Phase 3: Conjunction Assessment Engine)
### Added
- **Foster-1992 2-D Integral**: Gauss-Legendre 64-point quadrature on encounter plane.
- **Akella-Alfriend $P_{c,\text{max}}$**: Covariance-scaled maximum probability bound.
- **cKDTree Screening Pipeline**: 40 km ball radius screening across 1,440 time steps.
- **Encounter Plane Drawer** (`EncounterPlanePlot.tsx`): $1\sigma, 2\sigma, 3\sigma$ error ellipses, miss vector, hard-body disk, and RTN bars.
- **CelesTrak SOCRATES Cross-Validation Engine** (`cross_validate_socrates.py`).

---

## [v3.0] - 2026-11-06 (Phase 2: High-Performance GPU Point Cloud)
### Added
- **Web Worker SGP4 Propagator** (`propagator.worker.ts`): Transferable double-buffered `Float32Array` coordinates.
- **GPU Point-Sprite Shader** (`PointCloud.jsx`): Single draw call particle system with vertex velocity extrapolation.
- **TEME Inertial Frame Alignment** (`EarthGlobe.tsx`): GMST rotation with astronomical solar lighting.
- **Performance Telemetry HUD** (`PerformanceHUD.tsx`): FPS, frame time, worker latency, and memory monitoring.

---

## [v1.0 - v2.1] - 2026-11-06 (Foundations)
- Initial release, FastAPI backend, CelesTrak OMM/GP API ingestion, and Vercel cloud deployment.
