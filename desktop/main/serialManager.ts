/**
 * OrbitGuard Native Serial Port Manager (Phase W6 & Phase 5 Amendment)
 * =====================================================================
 * Drives antenna rotator controllers over native Windows COM ports using `serialport`.
 *
 * Implements safety supervision directly in the Main Process:
 * - 5 Hz command rate limiting to prevent buffer overrun
 * - 3-second watchdog timer (auto-sends emergency stop 'S\r' if renderer freezes)
 * - Azimuth / Elevation range clamping (Az: 0°-450°, El: 0°-180°)
 * - COM port name normalization (\\.\COM10+ syntax for high-numbered ports)
 * - Auto-cleanup on window close, port error, disconnect, or app quit
 */

import { SerialPort } from 'serialport';
import {
  SerialPortInfo,
  SerialOpenOptions,
  SerialStatus,
} from '../../frontend/src/shared/ipc';

export class SerialManager {
  private currentPort: SerialPort | null = null;
  private currentPath: string | null = null;
  private currentBaudRate: number | null = null;

  // Listeners
  private onDataListener?: (data: string) => void;
  private onErrorListener?: (error: string) => void;
  private onDisconnectListener?: () => void;

  // Main process safety watchdog
  private watchdogTimer: NodeJS.Timeout | null = null;
  private isTrackingActive = false;
  private lastCommandTime = 0;
  private readonly MIN_COMMAND_INTERVAL_MS = 150; // Max ~6.6 Hz rate limit

  constructor() {}

  public setListeners(
    onData: (data: string) => void,
    onError: (error: string) => void,
    onDisconnect: () => void
  ) {
    this.onDataListener = onData;
    this.onErrorListener = onError;
    this.onDisconnectListener = onDisconnect;
  }

  /**
   * Lists available serial COM ports with friendly labels and vendor IDs.
   */
  public async listPorts(): Promise<SerialPortInfo[]> {
    try {
      const ports = await SerialPort.list();
      return ports.map((p) => {
        let friendlyName = (p as any).friendlyName || p.path;
        if (p.manufacturer) {
          friendlyName += ` (${p.manufacturer})`;
        }
        return {
          path: p.path,
          friendlyName,
          manufacturer: p.manufacturer,
          vendorId: p.vendorId,
          productId: p.productId,
        };
      });
    } catch (err: any) {
      console.error('[SerialManager] Failed to list COM ports:', err.message);
      return [];
    }
  }

  /**
   * Normalizes Windows COM port names. Double-digit ports (COM10+) require \\.\COM10.
   */
  public normalizePortPath(portPath: string): string {
    const trimmed = portPath.trim();
    if (/^COM\d+$/i.test(trimmed)) {
      const portNum = parseInt(trimmed.substring(3), 10);
      if (portNum >= 10 && !trimmed.startsWith('\\\\.\\')) {
        return `\\\\.\\${trimmed.toUpperCase()}`;
      }
      return trimmed.toUpperCase();
    }
    return trimmed;
  }

  /**
   * Opens a native serial connection.
   */
  public async openPort(options: SerialOpenOptions): Promise<{ success: boolean; error?: string }> {
    if (this.currentPort && this.currentPort.isOpen) {
      await this.closePort();
    }

    const normalizedPath = this.normalizePortPath(options.path);

    return new Promise((resolve) => {
      try {
        const port = new SerialPort({
          path: normalizedPath,
          baudRate: options.baudRate || 9600,
          dataBits: options.dataBits || 8,
          stopBits: options.stopBits || 1,
          parity: options.parity || 'none',
          autoOpen: false,
        });

        port.open((err) => {
          if (err) {
            let errorMsg = err.message;
            if (errorMsg.includes('Access is denied') || errorMsg.includes('File not found')) {
              errorMsg = `Cannot open ${options.path}: Port may be in use by another application or USB driver is missing.`;
            }
            console.error(`[SerialManager] Open error on ${options.path}:`, errorMsg);
            resolve({ success: false, error: errorMsg });
            return;
          }

          this.currentPort = port;
          this.currentPath = options.path;
          this.currentBaudRate = options.baudRate ?? 9600;

          // Wire incoming data stream
          port.on('data', (chunk: Buffer) => {
            const str = chunk.toString('utf8');
            if (this.onDataListener) {
              this.onDataListener(str);
            }
          });

          port.on('error', (portErr) => {
            console.error(`[SerialManager] Runtime port error:`, portErr.message);
            if (this.onErrorListener) {
              this.onErrorListener(portErr.message);
            }
          });

          port.on('close', () => {
            console.log(`[SerialManager] Port ${options.path} closed or disconnected.`);
            this.stopWatchdog();
            this.currentPort = null;
            this.currentPath = null;
            this.currentBaudRate = null;
            if (this.onDisconnectListener) {
              this.onDisconnectListener();
            }
          });

          console.log(`[SerialManager] Connected to ${options.path} @ ${options.baudRate} baud.`);
          resolve({ success: true });
        });
      } catch (err: any) {
        resolve({ success: false, error: err.message });
      }
    });
  }

  /**
   * Writes command line to rotator controller with rate limiting and safety clamping.
   */
  public async write(rawCommand: string): Promise<{ success: boolean; error?: string }> {
    if (!this.currentPort || !this.currentPort.isOpen) {
      return { success: false, error: 'COM port is not open' };
    }

    // Rate-limit check
    const now = Date.now();
    if (now - this.lastCommandTime < this.MIN_COMMAND_INTERVAL_MS) {
      // Drop excess rapid commands to protect motor controller FIFO
      return { success: false, error: 'Command dropped by 5Hz rate limiter' };
    }
    this.lastCommandTime = now;

    // Safety range clamp: inspect position commands like 'W<AAA> <EEE>' or 'AZ<deg> EL<deg>'
    const sanitizedCommand = this.sanitizeRotatorCommand(rawCommand);

    return new Promise((resolve) => {
      this.currentPort!.write(sanitizedCommand, 'utf8', (err) => {
        if (err) {
          resolve({ success: false, error: err.message });
          return;
        }

        // Reset the 3-second watchdog timer on every successful position command
        this.resetWatchdog();
        resolve({ success: true });
      });
    });
  }

  /**
   * Clamps physical az/el values in command string to prevent mast over-rotation.
   */
  public sanitizeRotatorCommand(cmd: string): string {
    // Yaesu GS-232: W<AAA> <EEE>
    const gs232Match = cmd.match(/^W\s*(\d{1,3})\s+(\d{1,3})/i);
    if (gs232Match) {
      let az = parseInt(gs232Match[1], 10);
      let el = parseInt(gs232Match[2], 10);
      az = Math.max(0, Math.min(450, az));
      el = Math.max(0, Math.min(180, el));
      const azStr = String(az).padStart(3, '0');
      const elStr = String(el).padStart(3, '0');
      return `W${azStr} ${elStr}\r`;
    }

    // Easycomm: AZ<deg> EL<deg>
    const easyMatch = cmd.match(/^AZ([\d.]+)\s+EL([\d.]+)/i);
    if (easyMatch) {
      let az = parseFloat(easyMatch[1]);
      let el = parseFloat(easyMatch[2]);
      az = Math.max(0, Math.min(450, az));
      el = Math.max(0, Math.min(180, el));
      return `AZ${az.toFixed(1)} EL${el.toFixed(1)}\n`;
    }

    return cmd;
  }

  /**
   * Resets the 3-second watchdog timer. If no command arrives, sends emergency stop.
   */
  private resetWatchdog() {
    this.isTrackingActive = true;
    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer);
    }

    this.watchdogTimer = setTimeout(() => {
      if (this.isTrackingActive && this.currentPort && this.currentPort.isOpen) {
        console.warn('[SerialManager] Safety Watchdog Triggered: No commands for 3s. Sending Emergency Stop.');
        this.currentPort.write('S\r', 'utf8', () => {});
        this.isTrackingActive = false;
      }
    }, 3000);
  }

  private stopWatchdog() {
    this.isTrackingActive = false;
    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }
  }

  /**
   * Closes the active port cleanly and halts any moving motors.
   */
  public async closePort(): Promise<{ success: boolean; error?: string }> {
    this.stopWatchdog();
    if (!this.currentPort) {
      return { success: true };
    }

    return new Promise((resolve) => {
      try {
        if (this.currentPort!.isOpen) {
          // Send safety stop before closing
          this.currentPort!.write('S\r', 'utf8', () => {
            this.currentPort!.close((err) => {
              this.currentPort = null;
              this.currentPath = null;
              this.currentBaudRate = null;
              resolve({ success: !err, error: err?.message });
            });
          });
        } else {
          this.currentPort = null;
          this.currentPath = null;
          this.currentBaudRate = null;
          resolve({ success: true });
        }
      } catch (err: any) {
        resolve({ success: false, error: err.message });
      }
    });
  }

  public getStatus(): SerialStatus {
    return {
      isOpen: Boolean(this.currentPort && this.currentPort.isOpen),
      port: this.currentPath,
      baudRate: this.currentBaudRate,
    };
  }
}
