# OrbitGuard Desktop Architecture & Native Windows Runtime 🖥️

The **OrbitGuard Desktop Application** packages OrbitGuard as a hardened, native Windows x64 executable powered by **Electron 31**, **Node.js 20**, and **TypeScript**. It gives mission operators direct access to physical hardware interfaces while maintaining the complete 60 FPS 3D Three.js astrodynamic experience.

---

## 🔒 Security & Sandboxing Architecture

1. **Context Isolation & Zero Direct Node.js Exposure**:
   - `contextIsolation: true`
   - `sandbox: true`
   - `nodeIntegration: false`
   - The Renderer process executes in a pure web sandbox with zero access to native filesystem, child processes, or raw TCP sockets.
2. **Allow-Listed IPC with Strict Zod Validation**:
   - Every IPC message exchanged between the Preload bridge and the Main process is rigorously validated against strict Zod schemas (`desktop/preload/index.ts` and `desktop/main/index.ts`). Malformed or oversized payloads are rejected immediately.
3. **Safe Storage & DPAPI Encryption**:
   - Sensitive operator credentials and tokens are encrypted at rest using the Windows Data Protection API (DPAPI) via Electron's `safeStorage`.

---

## 🛰️ Direct Hardware & Offline Operations

1. **Native Serial (COM Port) Communication**:
   - Interfaces directly with USB-CDC and hardware UART serial ports using native C++ bindings (`serialport` / `@serialport/bindings-cpp`).
   - Supports baud rates from 1200 to 115200 with automatic Windows COM port name normalization (`\\.\COM10+`).
   - Integrated hardware safety supervision:
     - 5 Hz command rate limiter (prevents microcontroller buffer overruns).
     - Azimuth and Elevation mechanical limits clamping ($0^\circ\text{--}450^\circ$ Az, $0^\circ\text{--}180^\circ$ El).
     - 3-second motor freeze deadman watchdog (auto-transmits emergency stop `S\r` on renderer inactivity).
2. **Hamlib TCP rotctld Daemon**:
   - Built-in TCP socket client connecting to local or network rotctld daemons (`127.0.0.1:4533`).
3. **Offline-First Data Storage (`dataManager.ts`)**:
   - Atomic cache writes in `%APPDATA%/OrbitGuard/data/` (`.tmp` write followed by atomic rename).
   - Bundled fallback catalog snapshot (3,789 tracked space objects) seeded on clean installs for field operation with zero internet access.
4. **Native Windows Notifications & System Tray**:
   - Background pass reminders via Windows Toast Notifications.
   - System tray minimization and quick action menu.

---

## 📂 Directory Structure

```
desktop/
├── main/                   # Electron Main Process (Node.js runtime)
│   ├── dataManager.ts      # Offline caching, atomic storage, CelesTrak fetching
│   ├── index.ts            # Application lifecycle, BrowserWindow creation, IPC routing
│   ├── menu.ts             # Application menu configuration
│   ├── notifications.ts    # Windows Toast notification engine & tray manager
│   ├── rotctldClient.ts    # TCP socket client for Hamlib rotctld daemon
│   ├── security.ts         # CSP enforcement, navigation blocker, DPAPI safeStorage
│   ├── serialManager.ts    # Direct COM port controller with 5Hz rate limit & watchdog
│   └── updater.ts          # Auto-updater with motion safety lock
├── preload/                # Security bridge
│   └── index.ts            # contextBridge.exposeInMainWorld('orbitguardPlatform', api)
├── tests/                  # 31 Vitest automated security & hardware tests
│   ├── dataManager.test.ts # Offline seeding, atomic writes, cache wipes
│   ├── ipcSecurity.test.ts # Zod schema validation, reject malformed payloads
│   └── serialSafety.test.ts# Rate limiter, deadman watchdog, angle clamping
└── tsconfig.json           # Desktop TypeScript compiler settings
```

---

## 🛠️ Build & Verification Commands

```bash
# Launch Electron development environment with live hot reload
npm run dev:desktop

# Run desktop unit test suite (31 Vitest tests)
npm run test:desktop

# Compile Main and Preload bundles via tsup
npm run build:electron

# Package full Windows installers (NSIS Setup, Portable .exe, .zip) into dist-desktop/
npm run dist:win
```
