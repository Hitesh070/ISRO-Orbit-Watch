# OrbitGuard Windows Serial & Antenna Hardware Setup Guide

This guide describes how to configure, connect, and troubleshoot antenna rotator controllers and serial interfaces on Windows 10 and Windows 11.

---

## Supported Antenna Rotator Protocols

OrbitGuard natively supports industry-standard ground station antenna controllers without requiring external bridges or third-party middleware:

| Protocol | Typical Hardware | Default Baud | Stop Command | Query Command | Range Limits |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Yaesu GS-232A / B** | Yaesu G-5500, G-5400, FoxDelta, Idiom Press, K3NG | 9600 | `S\r` | `C2\r` | Az: $0^\circ\text{--}450^\circ$, El: $0^\circ\text{--}180^\circ$ |
| **Easycomm I / II** | K3NG Arduino Rotator, SARtek, AMSAT Ground Stations | 9600 | `VE\n` | `AZ EL\n` | Az: $0^\circ\text{--}450^\circ$, El: $0^\circ\text{--}180^\circ$ |
| **Hamlib rotctld** | Any rotator supported by Hamlib via TCP daemon | 4533 (TCP) | `S\n` | `p\n` | Protocol specific |

---

## USB-to-Serial Driver Installation

Before connecting your rotator controller to a Windows PC, ensure the appropriate USB-UART bridge drivers are installed. Windows 10/11 will often install these automatically via Windows Update, but official vendor drivers are recommended for field reliability:

1. **FTDI FT232R / FT2232 / FT232H**:
   - Official VCP (Virtual COM Port) driver: [FTDI Drivers](https://ftdichip.com/drivers/vcp-drivers/)
2. **Silicon Labs CP2102 / CP2104 / CP2108**:
   - Official driver: [Silicon Labs CP210x VCP](https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers)
3. **WCH CH340 / CH341 (common on low-cost Arduino controllers)**:
   - Official driver: [WCH CH341SER.EXE](http://www.wch-ic.com/downloads/CH341SER_EXE.html)
4. **Prolific PL2303**:
   - Official driver: [Prolific PL2303 Windows Driver](https://www.prolific.com.tw)

---

## Identifying Your COM Port in Windows

1. Press `Win + X` and select **Device Manager** (or press `Win + R` and run `devmgmt.msc`).
2. Expand the **Ports (COM & LPT)** category.
3. Locate your adapter (e.g., `USB Serial Port (COM3)` or `Silicon Labs CP210x USB to UART Bridge (COM14)`).
4. Take note of the assigned port number (`COM3`, `COM14`, etc.).

### Double-Digit COM Ports (COM10+)

Windows Win32 API requires extended path syntax (`\\.\COM10`) for ports numbered 10 and above. OrbitGuard's `SerialManager` automatically normalizes all port numbers so you can select `COM14` directly in the UI without manual path formatting.

---

## Connecting via OrbitGuard UI

1. Open OrbitGuard and navigate to **RF Ground Station** -> **Rotator Control**.
2. Select **Native Serial (COM)** as the Transport Type.
3. The port dropdown will list all detected hardware ports with vendor names. Select your rotator's COM port.
4. Set the **Baud Rate** matching your controller (typically `9600` for Yaesu GS-232).
5. Click **Connect Rotator**.
6. Click **Test Link (C2)**:
   - OrbitGuard sends a position query (`C2\r`).
   - The controller replies with its current azimuth and elevation (e.g., `+0120+0045`), which updates the live telemetry dial.

---

## Hardware Safety Supervision & Failsafes

Antenna masts and directional yagis are heavy and vulnerable to physical damage from cable wrapping or high-speed driving. OrbitGuard implements hardware safety checks directly inside the Electron Main process:

- **Command Rate Limiter (5 Hz)**: OrbitGuard throttles commands to 150 ms intervals. Even if the tracking loop produces updates at 60 FPS, the serial transmitter buffers and rate-limits commands to protect the controller's FIFO.
- **Physical Angle Clamping**:
  - Azimuth is clamped to $[0^\circ, 450^\circ]$.
  - Elevation is clamped to $[0^\circ, 180^\circ]$ (or $[0^\circ, 90^\circ]$ in standard mode).
- **Deadman Watchdog (3 Seconds)**: If OrbitGuard loses connection to the UI or the application is closed during an active satellite pass, the Main process watchdog detects the silence after 3 seconds and automatically transmits the emergency stop command (`S\r`) before releasing the port.

---

## Troubleshooting & Diagnostics

### Issue 1: "Cannot open COMx: Port may be in use or Access Denied"
- **Cause**: Another program (PuTTY, Arduino IDE Serial Monitor, SDR#, WSJT-X, or Hamlib) currently holds an exclusive lock on the COM port.
- **Fix**: Close all other terminal or radio software and reconnect in OrbitGuard.

### Issue 2: Rotator Does Not Move on Command
- Verify TX and RX wiring (TX from PC must connect to RX on controller).
- Verify ground connection between PC interface and controller.
- Check baud rate in Device Manager (`Port Settings` tab -> `Bits per second`).

### Issue 3: Using Hamlib rotctld Instead of Direct Serial
If you prefer running Hamlib's daemon:
1. Start `rotctld` from PowerShell:
   ```powershell
   rotctld.exe -m 601 -r COM3 -s 9600 -T 127.0.0.1 -t 4533
   ```
2. In OrbitGuard, select **TCP rotctld** and connect to `127.0.0.1:4533`.
