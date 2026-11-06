# OrbitGuard Windows Testing & Verification Matrix

This document outlines the testing procedures and verification matrix for OrbitGuard on Windows systems (Windows 10 and Windows 11 x64).

---

## Verification Matrix

| Test Suite / Area | Environment | Test Objective | Status |
| :--- | :--- | :--- | :--- |
| **SGP4 Astrodynamics** | Node / Web Worker | Vallado AIAA 2006-6753 official benchmark (113 cases) | Passed (Max error $< 0.008$ mm) |
| **Doppler & Tracking** | Vitest | Doppler shift calculation, $435\text{ MHz}$ / $145\text{ MHz}$ amateur bands | Passed |
| **Pass Predictor** | Vitest | Elevation rise/set, AOS/TCA/LOS detection, 24-hour horizon | Passed |
| **Zod IPC Contracts** | Vitest (Desktop) | Runtime validation of COM port options, baud rates, reminders | Passed (16/16) |
| **Serial Safety Failsafe** | Vitest (Desktop) | 5 Hz rate limiter, 3s deadman watchdog, Az/El clamping | Passed (10/10) |
| **Offline Cache & Seeding** | Vitest (Desktop) | Atomic write resilience, bundled fallback seeding, clean wipe | Passed (5/5) |
| **High-DPI Display Scaling** | Windows 10/11 | UI layout integrity across 100%, 125%, 150%, 200% DPI | Verified |
| **Offline Launch (No Internet)** | Windows 10/11 | Boots from bundled snapshot with zero network connectivity | Verified |

---

## Manual Test Procedures

### 1. High-DPI Display Scaling Test
1. On Windows 10 or 11, open **Settings** -> **System** -> **Display**.
2. Under **Scale**, test scaling factors:
   - **100% (Standard 1080p / 1440p)**
   - **125%**
   - **150% (Standard for 4K displays or 14-inch laptops)**
   - **200% (High-density displays)**
3. Verify:
   - Three.js WebGL canvas maintains crisp 1:1 pixel rendering (`window.devicePixelRatio`).
   - Font sizes, control cards, telemetry dials, and buttons remain cleanly aligned without clipping or overlapping.
   - Modal dialogs remain centered and within screen boundaries.

### 2. Cold Offline Launch Test
1. Disconnect Ethernet and turn off Wi-Fi on the test machine.
2. Launch OrbitGuard.
3. Verify:
   - The application starts up immediately without a blank white screen.
   - The notification pill displays `Screening-Grade (Bundled Snapshot)` or cached epoch.
   - 3,789 satellites and debris items load and propagate on the 3D globe.
   - Rotator control and RF calculations function completely offline.

### 3. Hardware Serial & COM Port Testing
1. Plug in a USB-UART adapter (CP2102, FT232R, or CH340).
2. Launch OrbitGuard -> **RF Ground Station** -> **Rotator Control**.
3. Verify that the port appears in the COM dropdown with its friendly hardware name.
4. Test connecting and sending position commands:
   - Open a serial terminal on the other end or an Arduino loopback.
   - Confirm commands are formatted as `W<AAA> <EEE>\r`.
   - Disconnect USB cable during connection; verify UI reflects disconnect without crashing.

---

## Windows SmartScreen & Code Signing

When launching an unsigned `.exe` or installer on Windows 10/11:
- Windows Defender SmartScreen may display: *"Windows protected your PC - Microsoft Defender SmartScreen prevented an unrecognized app from starting."*

### Why This Occurs
SmartScreen displays this prompt for any newly compiled executable that does not have an EV (Extended Validation) code signing certificate or has not yet built community reputation on Microsoft servers.

### Bypassing for Development / Internal Verification
1. Click **More info**.
2. Click **Run anyway**.

### Production Signing Recommendation
For production distribution:
- Utilize Microsoft **Trusted Signing** (formerly Azure Code Signing) or a DigiCert/Sectigo EV Code Signing Certificate in GitHub Actions using `signtool.exe`.
