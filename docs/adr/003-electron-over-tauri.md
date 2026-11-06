# ADR 003: Selection of Electron over Tauri for OrbitGuard Desktop

## Status
Accepted

## Context
OrbitGuard requires a native desktop application for Windows operators that bridges high-performance WebGL 3D astrodynamics visualization with physical hardware interfaces (serial COM ports for antenna rotators, Hamlib TCP rotctld, and background toast notifications).

The architecture was evaluated against key criteria:
1. **Single Codebase**: Must preserve 100% compatibility with the existing React 18, Vite, Three.js, and Web Worker codebase deployed to Vercel.
2. **Serial Hardware Interfacing**: Direct Windows COM port communications requiring native C++ bindings for deterministic 5 Hz motor control and sub-millisecond I/O latency.
3. **WebGL & Shader Performance**: Heavy 3D orbital rendering (3,789 active satellites and space debris objects with custom GLSL shaders, instancing, and bloom passes).
4. **Offline Resilience & Data Integrity**: High-throughput file system access with atomic writes, ETag caching, and DPAPI credential protection.

Two primary desktop frameworks were evaluated: **Electron** and **Tauri v2**.

---

## Evaluation & Trade-off Analysis

| Evaluation Criterion | Electron 31+ | Tauri v2 | Architectural Impact on OrbitGuard |
| :--- | :--- | :--- | :--- |
| **Codebase Unification** | **Direct**: Same Chromium runtime as web browsers. WebGL/GLSL shaders execute identically. | **Variable**: Relies on Microsoft WebView2 (Edge runtime). Shader extensions and canvas sizing can differ across Windows OS patches. | Electron eliminates cross-browser WebGL rendering quirks. |
| **Serial Communication** | **Mature Node.js C++ Addon**: `serialport` with `@serialport/bindings-cpp` provides proven Win32 COM port handling, custom baud rates, and RTS/CTS flow control. | **Rust Crates**: Requires maintaining custom Rust IPC commands and `serialport-rs` bindings, creating two divergent languages. | Electron preserves a single TypeScript language stack across frontend, IPC contracts, and main process. |
| **Worker Threads & OffscreenCanvas** | Native support for Web Workers, SharedArrayBuffer, and background compute loops. | Supported, but requires specialized WebView2 flags on older Windows builds. | OrbitGuard's SGP4 worker runs with zero modification. |
| **Hardware Safety Watchdog** | Main process event loop provides deterministic `NodeJS.Timeout` watchdog and rate-limiting independent of UI render cycles. | Excellent in Rust, but requires duplicate domain logic. | Electron allows shared TypeScript type contracts (`ipc.ts`) across UI and supervisor. |
| **Distribution Size** | ~80 MB compressed installer (bundles Chromium + Node.js runtime). | ~15 MB installer (leverages system WebView2). | Acceptable trade-off for mission-critical aerospace tools where runtime determinism outweighs bundle size. |

---

## Decision

We chose **Electron 31+** with:
- `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`
- Allow-listed IPC with runtime Zod schema validation
- Native `serialport` unpacked from ASAR (`asarUnpack`)
- `electron-builder` producing NSIS installer, portable `.exe`, and `.zip`

## Consequences

### Positive
- **Zero Divergence**: 100% of the React UI, Three.js shaders, and Web Worker SGP4 propagation logic is shared without alteration between the web deployment and desktop installer.
- **Unified TypeScript Contracts**: Shared IPC channels, Zod schemas, and data types (`frontend/src/shared/ipc.ts`) provide end-to-end compile-time and runtime safety across processes.
- **Enterprise Hardware Stability**: The battle-tested `serialport` native addon provides reliable COM port handling on Windows 10/11 including high-numbered ports (`COM10+`).

### Negative
- Installer download size is ~80 MB (due to bundled Chromium and Node runtime) compared to a ~15 MB WebView2 package.
- Requires ASAR unpacking for native C++ binaries (`.node` files).
