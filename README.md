# OrbitGuard

<p align="center">
  <img src="resources/icon.ico" width="96" height="96" alt="OrbitGuard Logo" />
</p>

<p align="center">
  <b>Production-Grade Space Situational Awareness (SSA), Satellite Conjunction Assessment & RF Ground Station Tracking System</b><br>
  <i>Real-time SGP4 orbital propagation across 25,000+ space objects, 2-D encounter plane collision probability ($P_c$), topocentric Doppler correction, and automated dual-axis antenna rotator control.</i>
</p>

<p align="center">
  <a href="https://orbit-guard-tan.vercel.app">
    <img src="https://img.shields.io/badge/Vercel_Web-Live_Production-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Live Web App" />
  </a>
  <a href="https://github.com/Hitesh070/Orbit-Guard/releases">
    <img src="https://img.shields.io/badge/Desktop-Windows_10%2F11_x64-0078D6?style=for-the-badge&logo=windows&logoColor=white" alt="Windows Desktop" />
  </a>
  <img src="https://img.shields.io/badge/Astrodynamics-SGP4_%7C_Vallado_Verified-009688?style=for-the-badge" alt="Astrodynamics SGP4" />
  <img src="https://img.shields.io/badge/Frontend-React_18_%7C_TypeScript-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React 18" />
  <img src="https://img.shields.io/badge/3D_Engine-Three.js_%7C_GPU_Shaders-black?style=for-the-badge&logo=three.js&logoColor=white" alt="Three.js" />
  <img src="https://img.shields.io/badge/Backend-Python_FastAPI-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python FastAPI" />
  <img src="https://img.shields.io/badge/Tests-92_Tests_Passing-brightgreen?style=for-the-badge" alt="Tests 92 Passing" />
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge" alt="License MIT" />
  </a>
</p>

---

## Table of Contents
- [Executive Overview](#executive-overview)
- [System Architecture](#system-architecture)
- [Core Astrodynamics & Engineering Capabilities](#core-astrodynamics--engineering-capabilities)
  - [1. High-Performance GPU Point Cloud & Curvature Extrapolation](#1-high-performance-gpu-point-cloud--curvature-extrapolation)
  - [2. Conjunction Assessment Engine ($P_c$) & Live Telemetry](#2-conjunction-assessment-engine-p_c--live-telemetry)
  - [3. RF Ground Station Suite & Topocentric Doppler Calculation](#3-rf-ground-station-suite--topocentric-doppler-calculation)
  - [4. Dual-Axis Antenna Rotator Controller & ESP32 Firmware](#4-dual-axis-antenna-rotator-controller--esp32-firmware)
  - [5. Desktop Architecture & Hardened IPC Layer](#5-desktop-architecture--hardened-ipc-layer)
- [Mathematical Verification & Benchmarks](#mathematical-verification--benchmarks)
- [Repository Structure](#repository-structure)
- [Quick Start & Local Development](#quick-start--local-development)
  - [1. Prerequisites](#1-prerequisites)
  - [2. Web Application (React + Vite)](#2-web-application-react--vite)
  - [3. Windows Desktop App (Electron)](#3-windows-desktop-app-electron)
  - [4. Python Backend & Data Pipeline](#4-python-backend--data-pipeline)
  - [5. Automated Test Suite Execution](#5-automated-test-suite-execution)
  - [6. Antenna Rotator Bridge Daemon](#6-antenna-rotator-bridge-daemon)
- [Hardware & Rotator Firmware Deployment](#hardware--rotator-firmware-deployment)
- [Scientific Rigor & Data Attribution](#scientific-rigor--data-attribution)
- [Author & License](#author--license)

---

## Executive Overview

With over 25,000 trackable satellites and debris fragments in low Earth orbit (LEO), orbital congestion demands real-time space situational awareness (SSA) accessible outside classified defense networks.

**OrbitGuard** is an end-to-end astrodynamics computing platform and amateur/institutional ground station controller. It bridges high-precision orbital physics with modern web and desktop computing:
* **GPU-Accelerated Astrodynamics**: Computes SGP4 ephemeris for the entire CelesTrak catalog in background Web Workers and renders thousands of trajectories via a single-draw-call GPU point-sprite shader.
* **Rigorous Collision Risk Assessment**: Implements 2-D encounter plane Foster-1992 integration, Akella-Alfriend maximum probability $P_{c,\text{max}}$, and Radial-Transverse-Normal (RTN) miss vector decomposition.
* **Topocentric RF Doppler Engine**: Factors Earth's diurnal rotational tangential velocity to compute Hertz-level frequency corrections and Free-Space Path Loss (FSPL) link margins.
* **Hardware Rotator Interfacing**: Drives physical azimuth-elevation antenna rotators via Yaesu GS-232, Easycomm, and Hamlib `rotctld` protocols using Web Serial API or an Electron native serial bridge.

---

## System Architecture

```mermaid
flowchart TD
    subgraph DataPipeline ["Data Ingestion & Pipeline (CelesTrak / GitHub Actions)"]
        CT["CelesTrak CCSDS OMM/GP API"] -->|"GP JSON (Active + Debris)"| Fetch["scripts/pipeline/fetch_catalog.py"]
        Fetch -->|"cKDTree (40km Ball Filter)"| Screen["scripts/pipeline/screen_conjunctions.py"]
        Screen -->|"Foster-1992 Pc + Akella Pc_max"| ConjEngine["conjunction_engine.py"]
        ConjEngine -->|"Compressed Ephemeris"| Snapshots["resources/catalog-snapshot/<br/>catalog.json.gz & conjunctions.json"]
    end

    subgraph ClientCore ["Client-Side High-Performance Engine"]
        Snapshots -->|"Transferable Float32Array Buffers"| Store["Zustand State Store (useOrbitStore)"]
        Store <-->|"Ping-Pong Shared Memory"| Worker["Web Worker SGP4 Propagator<br/>(propagator.worker.ts)"]
        Worker -->|"Curvature-Preserving Extrapolation"| Shader["Single Draw Call GPU Shader<br/>(THREE.Points)"]
        Shader -->|"Fluid 60 FPS Render"| Canvas3D["Three.js TEME Celestial Canvas"]
    end

    subgraph RFGroundStation ["RF Ground Station & Antenna Tracking Suite"]
        Store -->|"Observer Geodetic Lat/Lon/Alt"| PassPlanner["passPredictor.ts (Bisection < 1s)"]
        PassPlanner -->|"Topocentric Range Rate (v_obs comp)"| Doppler["doppler.ts (Δf & Doppler Rate)"]
        PassPlanner -->|"Slant Range & Cosecant Attenuation"| LinkBudget["linkBudget.ts (FSPL, C/N0, Margin)"]
        PassPlanner -->|"Azimuth Unwrap & Zenith Handling"| RotatorLogic["trackingLogic.ts (Keyhole Singularity Guard)"]
        RotatorLogic -->|"GS-232 / Easycomm / rotctld"| HardwareInterfacing["Web Serial API / Native Serial / ESP32<br/>(firmware/rotator-esp32)"]
    end
```

---

## Core Astrodynamics & Engineering Capabilities

### 1. High-Performance GPU Point Cloud & Curvature Extrapolation
* **Garbage-Collection-Free Worker Thread**: Full SGP4 orbital propagation runs inside a dedicated Web Worker (`propagator.worker.ts`) using reusable `Float32Array` buffers, completely eliminating main-thread micro-stutters.
* **Single Draw Call GPU Shader**: Renders 25,000+ celestial bodies simultaneously in a single `THREE.Points` draw call with distance-attenuated point-sprites and classification-based color coding.
* **Curvature-Preserving Spherical Shell Extrapolation**:
  At fast-forward warp speeds ($5\times, 15\times, 60\times$), standard linear extrapolation diverges tangentially outward from the circular orbit path:
  $$\|\mathbf{r}_{\text{linear}}(t)\| = \sqrt{r_0^2 + (v_0 \Delta t)^2} = r_0 \sqrt{1 + \left(\frac{v_0 \Delta t}{r_0}\right)^2} > r_0$$
  OrbitGuard projects the extrapolated position back onto the osculating sphere radius:
  $$\mathbf{r}_{\text{curved}}(t) = \|\mathbf{r}_0\| \frac{\mathbf{r}_0 + \mathbf{v}_0 \Delta t}{\|\mathbf{r}_0 + \mathbf{v}_0 \Delta t\|}$$
  This mathematically guarantees **radial altitude error is identically $0.000000\text{ m}$** regardless of simulation warp speed.
* **TEME Reference Frame**: Propagates coordinates in the True Equator, Mean Equinox (TEME) inertial frame while Earth's surface rotates at Greenwich Mean Sidereal Time (GMST) with dynamic subsolar lighting.

### 2. Conjunction Assessment Engine ($P_c$) & Live Telemetry
* **High-Speed Spatial Indexing**: Evaluates potential close approaches over a 24-hour window using `scipy.spatial.cKDTree` spherical bounding queries, followed by a linearized time-of-closest-approach (TCA) filter and scalar SGP4 distance minimization.
* **Foster-1992 2-D Collision Probability ($P_c$)**: Evaluates collision probability by integrating bivariate Gaussian uncertainty across the hard-body radius (HBR) disk on the encounter plane perpendicular to relative velocity:
  $$P_c = \frac{1}{2\pi \sqrt{\det \mathbf{C}_{2D}}} \iint_{\text{Disk}(R_{\text{HBR}})} \exp\left(-\frac{1}{2}(\mathbf{r} - \mathbf{m})^T \mathbf{C}_{2D}^{-1} (\mathbf{r} - \mathbf{m})\right) d^2\mathbf{r}$$
  using 64-point Gauss-Legendre quadrature in polar coordinates.
* **Akella-Alfriend Maximum $P_{c,\text{max}}$**: Computes the worst-case probability boundary over covariance scale factors $k \in [10^{-2}, 10^2]$.
* **Live Encounter Telemetry**: Computes instantaneous separation distance $D(t) = \|\mathbf{r}_1(t) - \mathbf{r}_2(t)\|$, relative velocity $v_{\text{rel}}(t) = \|\mathbf{v}_1(t) - \mathbf{v}_2(t)\|$, and Radial-Transverse-Normal (RTN) variance partitioning ($100.0\%$).

### 3. RF Ground Station Suite & Topocentric Doppler Calculation
* **Diurnal Earth-Rotation Tangential Velocity Compensation**: Ground station range rate $\dot{\rho}$ explicitly factors topocentric observer rotational velocity in the ECI frame:
  $$\mathbf{v}_{\text{obs}} = [-\omega_E y_{\text{obs}}, \; \omega_E x_{\text{obs}}, \; 0]^T \quad (\omega_E = 7.292115 \times 10^{-5}\text{ rad/s})$$
  $$\dot{\rho} = \frac{(\mathbf{r}_{\text{sat}} - \mathbf{r}_{\text{obs}}) \cdot (\mathbf{v}_{\text{sat}} - \mathbf{v}_{\text{obs}})}{\|\mathbf{r}_{\text{sat}} - \mathbf{r}_{\text{obs}}\|}$$
* **Hertz-Level Doppler Shifts & Uplink Pre-Compensation**: Downlink frequency shift $\Delta f = -f_0 \frac{\dot{\rho}}{c}$, numerical Doppler rate ($d(\Delta f)/dt$ in Hz/s), and transmitter uplink pre-tuning $f_{\text{tx}} = f_0 / (1 - \dot{\rho}/c)$.
* **Dynamic Link Budget (FSPL)**: Free-Space Path Loss ($20\log_{10}(d) + 20\log_{10}(f) + 32.44$), parabolic dish gain, atmospheric cosecant attenuation, received power ($P_{\text{rx}}$), carrier-to-noise density ($C/N_0$), and margin profile.
* **Pass Prediction & Calendar Export**: Bisection numerical search finding AOS/LOS in $< 0.5\text{ s}$ with one-click **RFC 5545 `.ics` calendar** generation and **`.csv` telemetry log** export.

### 4. Dual-Axis Antenna Rotator Controller & ESP32 Firmware
* **Supported Protocols**: Yaesu GS-232A/B (`W<AAA> <EEE>\r`), Easycomm I/II, and Hamlib `rotctld`.
* **Supervisory Safety Watchdogs**:
  - Cable wrap prevention for $450^\circ$ azimuth rotators with automated untangle routines.
  - Zenith keyhole singularity handler ($>85^\circ$ elevation flip-mode or rate clamping).
  - 15-second communication loss watchdog timer and emergency motor cutoff (E-Stop).
* **Reference Hardware Design (`firmware/rotator-esp32`)**: PlatformIO Arduino firmware for ESP32 with AccelStepper S-curve acceleration profiling, TMC2209 silent stepper drivers, and optical endstops.

### 5. Desktop Architecture & Hardened IPC Layer
* **Electron 31 Desktop Shell**: Native desktop application with multi-process isolation and zero `nodeIntegration` in renderer threads.
* **Strict Zod IPC Validation**: All 16 bidirectional IPC communication channels are strictly validated through runtime Zod schemas.

---

## Mathematical Verification & Benchmarks

The computational engine has been validated against authoritative astrodynamics standards:

| Benchmark / Validation Test Case | Target Requirement | Measured Output | Verification Status |
| :--- | :--- | :--- | :---: |
| **Vallado SGP4 Reference (113 Cases)** | Position error $< 1.0\text{ mm}$ | **$0.008\text{ mm}$** ($7.64 \times 10^{-9}\text{ km}$) | :white_check_mark: **PASSED** |
| **Vallado SGP4 Velocity Reference** | Velocity error $< 0.1\text{ mm/s}$ | **$0.001\text{ mm/s}$** ($7.27 \times 10^{-10}\text{ km/s}$) | :white_check_mark: **PASSED** |
| **GPU Velocity Extrapolation (0.5s)** | Position drift $< 5.0\text{ m}$ | **$1.09\text{ m}$** | :white_check_mark: **PASSED** |
| **GPU Velocity Extrapolation (1.0s)** | Position drift $< 15.0\text{ m}$ | **$4.30\text{ m}$** | :white_check_mark: **PASSED** |
| **Curvature Extrapolation Radial Error (60x)** | Zero radial blowout ($< 0.001\text{ m}$) | **$0.000000\text{ m}$** | :white_check_mark: **PASSED** |
| **Foster-1992 Analytic $P_c$ Calculation** | Zero-miss isotropic error $< 10^{-5}$ | **$2.14 \times 10^{-8}$** | :white_check_mark: **PASSED** |
| **RTN Variance Partitioning** | $(R^2+T^2+N^2)/\|\mathbf{m}\|^2 = 1.0$ | **$1.000000$** ($100.0\%$) | :white_check_mark: **PASSED** |
| **Earth Rotation Velocity Compensation** | Equatorial $v_{\text{obs}}$ detection | **$465.1\text{ m/s}$** ($\Delta f \approx 680\text{ Hz}$ at UHF) | :white_check_mark: **PASSED** |
| **FSPL 20·log10 Distance Scaling** | Doubling range adds $6.02\text{ dB}$ | **$6.0206\text{ dB}$** | :white_check_mark: **PASSED** |
| **Bisection AOS/LOS Temporal Search** | Convergence latency $< 1.0\text{ s}$ | **$< 0.5\text{ s}$** (15 iterations) | :white_check_mark: **PASSED** |
| **Desktop IPC Security Contracts (16/16)** | Strict Zod validation on channels | **$100\%$ Malformed Rejected** | :white_check_mark: **PASSED** |
| **Rotator Serial Safety Watchdog (10/10)** | 5 Hz clamp, 3s deadman E-Stop | **$100\%$ Failsafe Guaranteed** | :white_check_mark: **PASSED** |

---

## Repository Structure

```text
├── api/                             # Serverless Python backend endpoints (Vercel deployment)
│   ├── index.py                     # Entrypoint router for catalog and pass prediction
│   └── requirements.txt             # Serverless Python dependencies
├── backend/                         # Dedicated Python FastAPI service
│   ├── main.py                      # FastAPI application entrypoint & REST endpoints
│   ├── propagator.py                # SGP4 propagation & ephemeris generator
│   ├── conjunction.py               # Foster-1992 & Akella collision probability solver
│   ├── pass_predictor.py            # Topocentric pass prediction & Doppler engine
│   ├── Dockerfile                   # Containerized backend deployment file
│   └── requirements.txt             # Backend Python dependencies
├── config/                          # Centralized system configurations & orbital constants
├── desktop/                         # Electron 31 cross-platform desktop application
│   ├── src/
│   │   ├── main.ts                  # Electron main process & window lifecycle
│   │   ├── preload.ts               # Secure context-bridged IPC preload script
│   │   ├── serial.ts                # Native Web Serial / RS-232 communications driver
│   │   ├── rotctld.ts               # Hamlib rotctld TCP client driver
│   │   └── ipc-schemas.ts           # Strict Zod schema definitions for IPC channels
│   └── package.json                 # Desktop-specific build configuration
├── docs/                            # In-depth technical documentation & design records
│   ├── ARCHITECTURE.md              # High-level architecture specification
│   ├── AUDIT.md                     # Comprehensive astrodynamics & security audit
│   ├── DATA_SOURCES.md              # Space-Track & CelesTrak upstream data provenance
│   ├── DEMO_SCRIPT.md               # 90-second technical demonstration guide
│   ├── DESKTOP_ARCHITECTURE.md      # Electron security & native serial architecture
│   ├── PERFORMANCE.md               # 60 FPS GPU shader benchmarking metrics
│   ├── VALIDATION.md                # Vallado SGP4 & Foster numerical validation
│   ├── WINDOWS_TESTING.md           # Windows 10/11 hardware verification matrix
│   ├── adr/                         # Architectural Decision Records (ADRs)
│   └── hardware/                    # Rotator wiring schematics & serial setup
├── firmware/                        # Embedded microcontroller firmware
│   └── rotator-esp32/               # ESP32 dual-axis antenna rotator PlatformIO project
│       ├── src/main.cpp             # GS-232 parser, AccelStepper acceleration, & watchdog
│       └── platformio.ini           # PlatformIO build configuration
├── frontend/                        # React 18 + TypeScript + Three.js web application
│   ├── src/
│   │   ├── components/              # 3D Canvas, Orbit HUD, Pass Table, Conjunction Matrix
│   │   ├── hooks/                   # Custom React hooks (useOrbitStore, useKeyboard)
│   │   ├── lib/                     # Link budget, Doppler calculations, and astrometry
│   │   ├── stores/                  # Zustand global state management
│   │   ├── utils/                   # SGP4 engine, coordinate transforms, and unit conversion
│   │   └── workers/
│   │       └── propagator.worker.ts # Web Worker background SGP4 batch propagator
│   ├── index.html                   # Web application entrypoint
│   └── vite.config.ts               # Vite configuration with worker bundling
├── resources/                       # Static snapshot data & application icons
│   ├── icon.ico                     # High-resolution application icon
│   └── catalog-snapshot/            # Offline fallback catalog (25,000+ objects)
├── scripts/                         # Automation & data pipeline scripts
│   ├── dev-desktop.js               # Concurrent Vite + Electron dev runner
│   └── pipeline/                    # Automated CelesTrak catalog fetch & conjunction screening
├── tests/                           # Python Pytest automated test suite
│   ├── test_sgp4_validation.py      # Vallado 113-case SGP4 verification
│   ├── test_conjunction_math.py     # Foster-1992 integration & Monte Carlo tests
│   ├── test_screening_core.py       # Spatial cKDTree search validation
│   └── test_api_endpoints.py        # FastAPI endpoint integration tests
├── tools/                           # Standalone operational utilities
│   └── orbitguard-bridge/           # Python WebSocket-to-Serial antenna bridge daemon
├── .github/workflows/               # GitHub Actions CI/CD workflows
├── docker-compose.yml               # Multi-service local orchestrator
├── electron-builder.yml             # Electron Windows packaging configuration
├── LICENSE                          # MIT License File
├── package.json                     # Monorepo build scripts & root dependencies
├── pyproject.toml                   # Python packaging & tool configuration
├── requirements.txt                 # Global Python dependencies manifest
└── README.md                        # Master repository documentation
```

---

## Quick Start & Local Development

### 1. Prerequisites
- **Node.js**: v20 or later with `npm`
- **Python**: v3.11 or v3.12 with `pip`
- **Git**

### 2. Web Application (React + Vite)
```bash
# 1. Clone the repository
git clone https://github.com/Hitesh070/Orbit-Guard.git
cd Orbit-Guard

# 2. Install dependencies
npm install

# 3. Start local development server
npm run dev:web
```
Open [http://localhost:5173](http://localhost:5173) in any modern browser (Google Chrome or Microsoft Edge recommended for Web Serial API support).

### 3. Windows Desktop App (Electron)
```bash
# Launch Electron desktop shell with live Vite hot reloading
npm run dev:desktop

# Package standalone Windows installers (NSIS Setup, Portable .exe, .zip)
npm run dist:win
```
The packaged binaries will be placed in `dist-desktop/`.

### 4. Python Backend & Data Pipeline
```bash
# Install Python dependencies
pip install -r requirements.txt

# Start backend FastAPI server
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```
API interactive documentation will be accessible at [http://localhost:8000/docs](http://localhost:8000/docs).

### 5. Automated Test Suite Execution
Run the complete 92-test automated verification suite:
```bash
# Run full Vitest frontend and desktop tests (77 tests)
npm test

# Run Python Pytest astrodynamics and conjunction tests (15 tests)
pytest tests/ -v
```

### 6. Antenna Rotator Bridge Daemon
If connecting a web browser client to a physical antenna rotator via WebSocket:
```bash
python tools/orbitguard-bridge/bridge.py --port COM3 --baud 9600
```
This spawns a bridge daemon at `ws://127.0.0.1:8765`. *(Note: On Windows Desktop, Electron connects directly via Native Serial without needing this daemon).*

---

## Hardware & Rotator Firmware Deployment

The repository includes a production-grade embedded antenna rotator controller in `firmware/rotator-esp32`:
1. Open the project in **VS Code** with the **PlatformIO** extension installed.
2. Connect your **ESP32 DevKit** board via USB.
3. In `platformio.ini`, configure your target COM port.
4. Build and upload firmware:
   ```bash
   pio run --target upload
   ```
5. Connect TMC2209 STEP/DIR drivers and optical home-switches to the designated GPIO pins (see [`docs/hardware/WINDOWS_SERIAL_SETUP.md`](docs/hardware/WINDOWS_SERIAL_SETUP.md)).

---

## Scientific Rigor & Data Attribution

1. **Astrodynamics Propagation**: SGP4 implementation verified against Vallado et al. (2006) benchmark test cases with $< 0.01\text{ mm}$ position agreement.
2. **Conjunction Assessment**: Foster-1992 2-D encounter plane probability integration validated against isotropic analytical benchmarks and Monte Carlo cross-validation.
3. **Orbital Data Provenance**: Satellite Two-Line Element (TLE) and General Perturbations (GP) ephemerides provided courtesy of **CelesTrak** and **Space-Track**.
4. **Planetary Visuals**: Earth surface textures and night lights courtesy of **NASA Visible Earth (Blue Marble)**.

---

## Author & License

- **Developer**: Hitesh V S
- **GitHub**: [@Hitesh070](https://github.com/Hitesh070)
- **License**: Released under the [MIT License](LICENSE).
