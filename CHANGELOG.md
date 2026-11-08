# OrbitGuard Changelog

All notable changes to the OrbitGuard project are documented in this file.
The project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [v5.0] - 2026-11-08 (Data Integrity, Screening Safety & Verification)
### Added
- A release audit covering manual review of the 3D Globe, Analytics & Risk, Conjunctions, and RF Station sections, plus automated verification results in `docs/RELEASE_V5.0.md`.
- Explicit snapshot provenance and stale-data reporting for the catalog and conjunction data.

### Changed
- Versioned the desktop package and in-app About/preferences surfaces as 5.0.0 / v5.0.
- Corrected current documentation to distinguish SGP4 model predictions and cached catalog snapshots from live sensor telemetry.
- Corrected desktop refresh throttling so a missing screening snapshot does not force a full catalog download on every application restart.

### Fixed
- Withdrew bundled conjunction results whose former collision probability values used synthetic covariance. With no verified screening event snapshot, OrbitGuard now reports screening unavailable and explicitly says that this is not orbit-clearance evidence.
- Removed unsupported current-release claims about synthetic covariance, live conjunction probabilities, measured performance, and offline data freshness from user and technical documentation.

### Verified
- Frontend: 46 tests passed; desktop: 33 tests passed.
- Frontend and desktop TypeScript checks passed.
- 10 backend numerical/screening tests passed; the 5 TestClient endpoint tests remain inconclusive because the installed FastAPI/Starlette/httpx versions differ from the pinned backend requirements and the first request stalled.

> The v4.3 entry below is historical. Its synthetic-covariance and real-time conjunction claims are superseded by this release and must not be used to describe v5.0 behavior.

## [v4.3] - 2026-11-08 (Release: 4K NASA Globe, Curvature-Preserving Extrapolation, Dynamic Conjunction Telemetry & Hardened Desktop)
### Added
- **Curvature-Preserving Spherical Shell Extrapolation**:
  - Replaced naive linear extrapolation in `PointCloud.jsx` and `SelectedSatelliteReticle.tsx` with spherical projection onto the orbital shell:
    $$\mathbf{r}_{\text{curved}}(t) = \|\mathbf{r}_0\| \frac{\mathbf{r}_0 + \mathbf{v}_0 \Delta t}{\|\mathbf{r}_0 + \mathbf{v}_0 \Delta t\|}$$
  - Eliminates tangential blowout during time-acceleration ($5\times, 15\times, 60\times$) with mathematically proven **$0.000000\text{ m}$ radial error** at $60\times$.
- **Adaptive Worker Tick Rate**:
  - Dynamically scales propagation refresh intervals based on simulation speed ($60\text{ms}$ at $60\times$, $100\text{ms}$ at $15\times$, $150\text{ms}$ at $5\times$, $500\text{ms}$ at $1\times$) in `usePropagatorWorker.ts`.
- **Dynamic Real-Time Conjunction & Risk Telemetry**:
  - `ConjunctionPanel.tsx` and `RiskTable.tsx` dynamically compute live encounter metrics in real time:
    - Live separation distance: $D(t) = \|\mathbf{r}_1(t) - \mathbf{r}_2(t)\|$
    - Live relative velocity: $v_{\text{rel}}(t) = \|\mathbf{v}_1(t) - \mathbf{v}_2(t)\|$
    - Dynamic Akella-Alfriend maximum probability: $P_{c,\text{max}}(t) = \frac{1}{e}\left(\frac{R_{\text{HBR}}}{D(t)}\right)^2$
    - Smooth live Foster $P_c(t)$ animation and numeric sanitization (`< 1e-9` for raw infinitesimals).
- **Portal-Mounted Share Modal (`ShareModal.tsx`)**:
  - Mounts to `document.body` via React `createPortal` with `z-[9999]`, escaping parent header `glass-panel` clipping.
  - Added responsive viewport centering (`my-auto`, `overflow-y-auto`), keyboard Escape dismissal, and multi-tier clipboard fallbacks.
- **4K Ultra-HD NASA Blue Marble & Google Earth Textures**: 4096x2048 high-resolution day map, night city lights, specular ocean reflection, and 96x96 sphere geometry.
- **Continuous Alpha Cloud Deck**: True continuous opacity cloud layer with smooth feathered edges, eliminating chunky 8-bit staircase artifacts.
- **4K Google Earth Cosmic Skybox**: Panoramic deep-space Milky Way background with anti-aliased Gaussian Airy disc pinpoint stars.
- **Spacecraft vs Debris Distinct Visuals**: Crisp high-tech diamond reticles with solar diffraction spikes and telemetry beacons for satellites, compact dots for debris.
- **Autonomous Desktop Risk Engine**: Client-side synthesis of the 4x4 Altitude x Inclination risk density matrix and LEO/MEO/GEO shell breakdown.
- **Comprehensive Subproject Documentation**: Added dedicated `README.md` files for `frontend/`, `desktop/`, and `backend/`.
- **Expanded Automated Test Suite**: Expanded to **92 total automated tests** (46 frontend Vitest + 31 desktop Vitest + 15 backend Pytest).

### Fixed
- **Simulation Time Warp Jitter & Stutter**: Unified the master simulation clock ticker in `App.jsx` and removed competing store updates from `EarthGlobe.tsx`.
- **RF Doppler S-Curve & Pass Planning**: Fixed chart axis formatting, S-curve zero-crossing labels, and proper UTC hour/minute display.
- **RTN Decomposition Variance Partitioning**: Normalized RTN decomposition ensuring $(R^2 + T^2 + N^2) / \|\mathbf{m}\|^2 = 1.000$ geometric consistency.
- **Terminator Smear**: Removed artificial dark orange streak, rendering physical solar twilight.
- **Night-Side Violet Wash**: Replaced indexed night texture with pure #000000 velvet oceans/land and warm golden city emitters.
- **Pass Predictor Topocentric SGP4**: Reliable client-side propagation for custom GPS coordinates.

---

## [v4.2.0] - 2026-11-06 (Phase W: Native Windows Desktop App & Phase 5 Hardware Extension)
### Added
- **Native Windows Desktop Application (Electron 31 + Node.js 20)**:
  - Single unified codebase sharing 100% of the React 18, Three.js/R3F, and Web Worker astrodynamics engine between web (Vercel) and desktop.
  - Native Windows packaging using `electron-builder` producing:
    - Customizable NSIS x64 installer (`OrbitGuard-Setup-4.2.0.exe`, 75.9 MB).
    - Zero-install standalone portable executable (`OrbitGuard-Portable-4.2.0.exe`, 75.6 MB).
    - Portable application archive (`OrbitGuard-4.2.0-win.zip`, 102.3 MB).
  - Background auto-updater integration (`electron-updater`) with active rotator motion locking.
  - Single-instance application lock, deep-linking protocol registration (`orbitguard://`), and persistent window geometry.
- **Direct Serial (COM Port) Rotator Control**:
  - Direct hardware access via native C++ bindings (`serialport` / `@serialport/bindings-cpp`) without external bridge daemons or Web Serial permissions.
  - Automatic Windows Win32 COM port name normalization (`\\.\COM10+` for double-digit ports).
  - Main process safety supervision: 5 Hz command rate limiting, physical Az/El range clamping ($0^\circ\text{--}450^\circ$ Az, $0^\circ\text{--}180^\circ$ El), and 3-second motor deadman watchdog (auto-transmits emergency stop `S\r` on renderer freeze).
  - Integrated "Test Link (C2)" transaction verification button and real-time baud rate selector (1200 to 115200 baud).
- **Hamlib TCP rotctld Daemon Client**:
  - Direct TCP socket client (`net.Socket`) in the Main process connecting to `127.0.0.1:4533`.
- **Offline-First Data Storage & Direct CelesTrak Fetching**:
  - Local atomic caching in `%APPDATA%/OrbitGuard/data/` (`.tmp` write followed by atomic rename).
  - 2-hour refresh throttling with HTTPS ETag / `If-Modified-Since` conditional headers.
  - Bundled fallback catalog snapshot (3,789 tracked space objects) seeded on clean installs for offline field operation.
- **Native Windows Notifications & Tray**:
  - Windows Toast Notifications for upcoming satellite passes with customizable lead time.
  - System Tray integration with minimization and quick-action menu.
- **Comprehensive Desktop Documentation**:
  - `docs/DESKTOP_ARCHITECTURE.md`: Process isolation, IPC router, and Mermaid architecture diagram.
  - `docs/hardware/WINDOWS_SERIAL_SETUP.md`: COM port troubleshooting, CH340/CP2102/FTDI drivers, and wiring guide.
  - `docs/WINDOWS_TESTING.md`: High-DPI display matrix (100% to 200%), offline launch, and SmartScreen disclaimer.
  - `docs/adr/003-electron-over-tauri.md`: Architecture Decision Record detailing selection of Electron over Tauri.
- **Desktop CI/CD Workflows**:
  - `.github/workflows/ci.yml`: Desktop typecheck and full verification suite on Windows.
  - `.github/workflows/release-desktop.yml`: Automated tag-triggered release packaging with SHA-256 checksum generation.

---

## [v4.2] - 2026-11-06 (Phase 6 Final: Deep-Linking, Settings Drawer, Offline PWA)
### Added
- **State Deep-Linking & Share System**: URL query synchronization (`?norad=<id>&speed=<warp>`) with automatic state restoration on load, history push/replace, and one-click "Share State" button in the Navbar.
- **Persistent Settings Drawer** (`SettingsDrawer.tsx`):
  - Physical unit toggling (Metric km, km/s vs Imperial miles, mi/s).
  - Mission clock priority switch (Local primary vs UTC primary).
  - 3D graphics quality presets (High, Medium, Low, Auto) and WCAG AA Reduced Motion support.
  - Custom elevation mask angle slider ($0^\circ$ to $20^\circ$).
  - Synthetic covariance scaling multiplier ($k$).
  - LocalStorage persistence under `orbitguard_settings_v1`.
- **Spacecraft Favourites & Starred Filter**: 1-click starring of satellites in the telemetry dossier, persistent storage in `orbitguard_favourites`, and dedicated "Starred Favourites Only" filter in the 3D viewport.
  - Keyboard shortcut `I` for instantaneous launch.
- **First-Visit Onboarding Tour** (`OnboardingModal.tsx`): 5-slide guided walkthrough of OrbitGuard's features, architecture, and controls for new visitors.
- **90-Second Technical Demo Script** (`docs/DEMO_SCRIPT.md`): Professional timestamped script for portfolio video demonstrations and panel defense.
- **Offline PWA & Service Worker** (`sw.js` & `manifest.json`): Pre-caching of app shell, NASA textures, and offline catalog fallback for connection loss resilience.
- **Unit Conversion Utility & Test Suite** (`unitConversion.ts` & `unitConversion.test.ts`): 4 new unit tests verifying metric-to-imperial precision.

---

## [v4.1] - 2026-11-06 (Phase 6: Release & Technical Polish)
### Added
- **Global In-App Help & Shortcuts Modal** (`HelpModal.tsx`): Keyboard shortcuts (`~`, `?`, `Esc`, `1`, `5`, `6`), astrodynamics architecture summary, and operational scientific assumptions.
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
