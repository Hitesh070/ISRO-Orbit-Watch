# OrbitGuard System Architecture & Astrodynamics Pipeline

> **v5.0 accuracy note:** This document includes historical frame-conversion and conjunction-analysis design notes. It is not evidence that collision probability is available in the current app. See [`VALIDATION.md`](VALIDATION.md) and [`RELEASE_V5.0.md`](RELEASE_V5.0.md) for current data and screening status. Public GP/TLE data does not supply measured covariance or physical hard-body data; probability must remain unavailable unless authoritative inputs are provided.

## 1. System Topology Overview

OrbitGuard is structured as an end-to-end Space Situational Awareness (SSA) system that decouples scheduled heavy astrodynamic ingestion from low-latency interactive client rendering.

```mermaid
flowchart TD
    subgraph ExternalSources["External Astrodynamics Sources"]
        CT["CelesTrak CCSDS OMM/GP API\n(Public Element Sets)"]
        ST["Space-Track.org GP Class\n(Authenticated Secondary Feed)"]
        NASA["NASA Visible Earth\n(Blue Marble Textures)"]
    end

    subgraph IngestionPipeline["Automated Ingestion Pipeline (scripts/pipeline/)"]
        CRON["GitHub Actions Cron\n(.github/workflows/refresh-data.yml @ 6h)"]
        FC["fetch_catalog.py\n(OMM Normalizer & Validator)"]
        VAL["Vallado SGP4 Verifier\n(Perigee & Eccentricity Sanity)"]
        COMP["GZIP Artifact Serializer\n(catalog.json.gz & meta.json)"]
    end

    subgraph StorageDistribution["Distribution & Storage"]
        CDN["Static CDN / Public Directory\n(frontend/public/data/)"]
        META["Data Provenance Dossier\n(meta.json)"]
    end

    subgraph ClientCore["Frontend Client Runtime (React 18 + R3F + Vite)"]
        API["orbitApi.ts\n(Typed Client + Offline Fallback)"]
        ZST["Zustand Store\n(useOrbitStore: UI Selection & Filters)"]
        
        subgraph ComputeEngine["Offloaded Astrodynamic Execution"]
            WW["Web Worker Propagator\n(propagator.worker.ts @ 1-2 Hz)"]
            BUFF["Transferable Float32Array\nPing-Pong Buffers (Pos/Vel/Status)"]
            SGP4["satellite.js SGP4 Engine\n(TEME Inertial Frame)"]
        end

        subgraph GraphicEngine["Three.js / R3F Viewport"]
            SHADER["THREE.Points Custom Shader\n(Velocity Extrapolation @ 60 FPS)"]
            EARTH["WGS84 Earth Sphere\n(Rotated by GMST(t))"]
            ORBIT["Focused Orbit Path\n(Planar Keplerian Ellipse)"]
        end

        subgraph OperationSuite["Ground Operations Modules"]
            PP["passPredictor.ts\n(Topocentric AOS/Culmination/LOS)"]
            RF["Doppler & Link Budget Engine\n(Range-Rate Delta-f & Eb/N0)"]
            ROT["Antenna Rotator Bridge\n(GS-232 / Easycomm / rotctld)"]
        end
    end

    CT -->|HTTP GET| FC
    ST -.->|Authenticated JSON| FC
    CRON -->|Trigger| FC
    FC --> VAL
    VAL --> COMP
    COMP --> CDN
    COMP --> META

    CDN -->|Fetch catalog.json.gz| API
    META -->|Provenance Banner| ZST
    API --> WW
    WW --> SGP4
    SGP4 --> BUFF
    BUFF --> SHADER
    ZST --> SHADER
    ZST --> EARTH
    ZST --> ORBIT
    SGP4 --> PP
    PP --> RF
    RF --> ROT
```

---

## 2. Component Architecture Breakdown

### 2.1 Data Pipeline (Offline / GitHub Actions)
* **Location:** `scripts/pipeline/fetch_catalog.py`
* **Trigger:** Scheduled cron (`0 */6 * * *`) via GitHub Actions plus manual `workflow_dispatch`.
* **Execution:**
  1. Ingests normalized OMM JSON sets across operational satellite regimes and debris fields (Cosmos-2251, Iridium-33, Fengyun-1C).
  2. Runs physical validation: flags decayed objects ($r_p < -200\text{ km}$, $e \ge 1$), calculates TLE age in days, and tags stale elements ($>14\text{ days}$).
  3. Emits compressed artifacts: `catalog.json.gz` (456 KB) and provenance metadata `meta.json`.

### 2.2 Client-Side Astrodynamic Engine
* **Location:** `src/workers/propagator.worker.ts` & `src/utils/sgp4Engine.ts`
* **Coordinate Frame:** True Equator, Mean Equinox (TEME), native Earth-Centered Inertial (ECI).
* **Buffer Architecture:**
  - Memory is allocated upfront using contiguous typed arrays (`Float32Array(3 * N)` for positions, `Float32Array(3 * N)` for velocities, `Uint8Array(N)` for status/regime).
  - Uses zero-copy transferable objects to ping-pong data between worker and main thread without garbage collection overhead.

### 2.3 Graphical Rendering Engine
* **Technology:** Three.js / React Three Fiber with custom GLSL ShaderMaterial.
* **Draw Call Count:** Exactly **1 draw call** for 25,000+ points (THREE.Points).
* **Curvature-Preserving Spherical Shell Extrapolation:**
  \mathbf{r}_{\text{curved}}(t) = \|\mathbf{r}_0\| \frac{\mathbf{r}_0 + \mathbf{v}_0 \cdot \Delta t}{\|\mathbf{r}_0 + \mathbf{v}_0 \cdot \Delta t\|}
  The GPU vertex shader and client reticles project extrapolated positions back onto the orbital sphere radius. This mathematically eliminates tangential blowout at accelerated warp speeds (\times, 15\times, 60\times$), achieving **.000000\text{ m}$ radial error** while rendering completely fluid 60 FPS tangential motion.
* **Adaptive Worker Tick Scaling:** The Web Worker propagation frequency scales adaptively with simulation warp (\text{ms}$ at \times$, \text{ms}$ at \times$, \text{ms}$ at \times$, \text{ms}$ at \times$).
* **Earth Rotation:** The 3D Earth mesh rotates according to Greenwich Mean Sidereal Time ($\theta_{\text{GMST}}$):
  \theta_{\text{Earth}} = \text{GMST}(t)
  This maintains physical accuracy, avoids per-point trigonometric conversions, and renders planar, closed orbital ellipses.

### 2.4 UI & Interaction Architecture
* **Portal-Mounted Share Modal:** Uses React createPortal to mount directly into document.body at z-[9999], breaking out of backdrop-blur and glass-panel containing blocks. Features responsive clamping and multi-tier clipboard fallbacks.
* **Unified Master Clock Loop:** Clock state ticks once per frame in App.jsx, removing store update race conditions and eliminating time warp stutter.

---

## 3. Reference Frame Conversions

| Source Frame | Target Frame | Mathematical Operation | Purpose |
| :--- | :--- | :--- | :--- |
| **TEME** | **ECEF** | Rotation by Greenwich Mean Sidereal Time $\mathbf{R}_z(\theta_{\text{GMST}})$ | Ground subpoints (lat/lon/alt) |
| **ECEF** | **Topocentric SEZ** | Coordinate transformation via observer geodetic position $(\phi, \lambda, h)$ | Look angles (Azimuth, Elevation, Slant Range) |
| **ECI** | **Encounter Plane (B-Plane)** | Projection perpendicular to relative velocity vector $\mathbf{v}_{\text{rel}}$ | 2-D Conjunction Assessment & Foster $P_c$ |
| **ECI** | **RTN** | Basis: $\hat{\mathbf{r}}=\mathbf{r}/\|\mathbf{r}\|$, $\hat{\mathbf{n}}=(\mathbf{r}\times\mathbf{v})/\|\mathbf{r}\times\mathbf{v}\|$, $\hat{\mathbf{t}}=\hat{\mathbf{n}}\times\hat{\mathbf{r}}$ | Orbital uncertainty & covariance propagation |
