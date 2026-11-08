# OrbitGuard Frontend Architecture & Web Runtime 🌐

The **OrbitGuard Frontend** is a high-performance, responsive Single-Page Application (SPA) built with **React 18**, **Three.js / React Three Fiber (R3F)**, **TypeScript**, and **Tailwind CSS**. It powers both the live web deployment on Vercel and the client renderer within the native Windows Desktop Electron app.

---

## 🚀 Key Highlights & v4.3 Features

1. **Curvature-Preserving Spherical Shell Extrapolation**:
   - Eliminates tangential blowout during time-acceleration ($5\times, 15\times, 60\times$) by projecting linear velocity steps back onto the sphere radius:
     $$\mathbf{r}_{\text{curved}}(t) = \|\mathbf{r}_0\| \frac{\mathbf{r}_0 + \mathbf{v}_0 \Delta t}{\|\mathbf{r}_0 + \mathbf{v}_0 \Delta t\|}$$
   - Proven **$0.000000\text{ m}$ radial error** at $60\times$ speed across continuous motion.
2. **Adaptive Worker Tick Rate**:
   - Dynamically scales propagation refresh intervals based on simulation speed ($60\text{ms}$ at $60\times$, $100\text{ms}$ at $15\times$, $150\text{ms}$ at $5\times$, $500\text{ms}$ at $1\times$) to prevent temporal lag or GC pauses.
3. **Dynamic Real-Time Conjunction Telemetry**:
   - `ConjunctionPanel.tsx` and `RiskTable.tsx` compute live separation $D(t)$, real-time relative velocity $v_{\text{rel}}(t)$, and dynamic Akella-Alfriend $P_{c,\text{max}}(t)$ on every frame with smooth animations and numerical sanitization (`< 1e-9`).
4. **4K Ultra-HD NASA Blue Marble & Continuous Alpha Clouds**:
   - 4096×2048 high-resolution day map, golden night lights, specular ocean reflection, and smooth feathered cloud deck.
5. **Portal-Mounted Share Modal (`ShareModal.tsx`)**:
   - Uses React `createPortal` to mount directly into `document.body` at `z-[9999]`, preventing clipping from header `glass-panel` containers. Includes responsive viewport clamping and multi-tier clipboard fallbacks.
6. **Zero-Allocation Typed Array Web Worker (`propagator.worker.ts`)**:
   - Offloads SGP4 propagation to a background thread using transferable `Float32Array` buffers (positions, velocities, regimes).
7. **Single Draw Call GPU Point-Sprite Shader (`PointCloud.jsx`)**:
   - Renders 25,000+ satellites and debris items in exactly **1 draw call** via custom GLSL vertex and fragment shaders.

---

## 📂 Directory Structure

```
frontend/
├── public/                 # Static assets, 4K textures, PWA manifest, and service worker
│   ├── data/               # Bundled catalog snapshot (catalog.json, meta.json, etc.)
│   ├── textures/           # 4K Blue Marble day/night, specular, clouds_hd, skybox
│   ├── manifest.json       # Progressive Web App manifest
│   └── sw.js               # Service Worker with offline caching (v4.3)
├── src/
│   ├── api/                # Data fetching and offline fallback client
│   ├── components/
│   │   ├── common/         # Modals (Help, Onboarding, Share, Settings, PerformanceHUD)
│   │   ├── Dashboard/      # ConjunctionPanel, RiskTable, EncounterPlanePlot, DebrisStats
│   │   ├── Globe/          # Three.js Canvas, PointCloud, EarthGlobe, CelestialBackground
│   │   ├── Layout/         # Responsive Navbar, Clock, Global Search
│   │   └── Sidebar/        # Telemetry dossier, orbital elements, filters
│   ├── features/
│   │   ├── rf/             # PolarSkyPlot, DopplerCurveChart, LinkBudgetPanel
│   │   └── tracking/       # RotatorPanel, manual slewing, protocol transaction log
│   ├── hooks/              # usePropagatorWorker, simulation clock sync
│   ├── lib/                # Astrodynamics math (doppler, linkBudget, passPlanner, tracking)
│   ├── platform/           # Electron IPC bridge / Web runtime detection
│   ├── store/              # Zustand global state (useOrbitStore)
│   ├── tests/              # 46 Vitest automated unit tests & math verifications
│   └── workers/            # propagator.worker.ts (SGP4 Web Worker)
├── index.html              # Entry HTML template
├── tailwind.config.js      # Sci-fi neon aesthetic color palette & typography
├── tsconfig.json           # TypeScript configuration
└── vite.config.js          # Vite build config with manual chunking & worker bundling
```

---

## 🛠️ Development & Testing

```bash
# Start Vite development server
npm run dev

# Run full frontend test suite (46 Vitest unit tests)
npm test

# Run TypeScript typecheck
npm run typecheck

# Production build
npm run build
```
