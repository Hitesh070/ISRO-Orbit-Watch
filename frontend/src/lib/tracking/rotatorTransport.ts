/**
 * OrbitGuard Antenna Rotator Transport Abstraction Layer
 * ========================================================
 * Provides a unified asynchronous hardware transport interface for:
 * 1. Virtual Simulator (Default - runs in any browser with realistic motor slew dynamics)
 * 2. Web Serial API (Direct USB connection to Arduino/ESP32 rotator controllers)
 * 3. Local WebSocket Bridge (Connects to tools/orbitguard-bridge or Hamlib rotctld)
 */

import {
  encodeGS232Position,
  encodeGS232Stop,
  encodeGS232Query,
  parseGS232Reply,
} from './protocolEncoders';

export type TransportType = 'SIMULATOR' | 'WEB_SERIAL' | 'LOCAL_BRIDGE';

export interface RotatorStatus {
  connected: boolean;
  transportType: TransportType;
  actualAz: number;
  actualEl: number;
  commandedAz: number;
  commandedEl: number;
  isMoving: boolean;
  pointingErrorDeg: number;
  error: string | null;
  lastUpdatedMs: number;
}

export interface CommandLogEntry {
  time: string;
  command: string;
  direction: 'TX' | 'RX';
}

export interface RotatorTransport {
  type: TransportType;
  connect(options?: any): Promise<boolean>;
  disconnect(): Promise<void>;
  setTarget(azDeg: number, elDeg: number): Promise<void>;
  stop(): Promise<void>;
  getStatus(): RotatorStatus;
  onStatusUpdate(listener: (status: RotatorStatus) => void): () => void;
  onCommandLog(listener: (entry: CommandLogEntry) => void): () => void;
}

// ==========================================
// 1. SIMULATOR TRANSPORT (Default)
// ==========================================

export class SimulatorTransport implements RotatorTransport {
  public type: TransportType = 'SIMULATOR';

  private status: RotatorStatus = {
    connected: false,
    transportType: 'SIMULATOR',
    actualAz: 0.0,
    actualEl: 0.0,
    commandedAz: 0.0,
    commandedEl: 0.0,
    isMoving: false,
    pointingErrorDeg: 0.0,
    error: null,
    lastUpdatedMs: Date.now(),
  };

  private statusListeners = new Set<(status: RotatorStatus) => void>();
  private logListeners = new Set<(entry: CommandLogEntry) => void>();
  private simTimer: any = null;

  // Mechanical parameters (typical Yaesu G-5500 rotator)
  private azSlewRateDegS = 6.0; // 6 degrees/sec (60s for 360)
  private elSlewRateDegS = 3.5; // 3.5 degrees/sec (50s for 180)

  async connect(): Promise<boolean> {
    this.status.connected = true;
    this.status.error = null;
    this.emitLog('SIMULATOR: Connected to Virtual Dual-Axis Rotator (Yaesu GS-232 Emulation)', 'RX');
    this.startSimLoop();
    this.notifyStatus();
    return true;
  }

  async disconnect(): Promise<void> {
    this.status.connected = false;
    this.stopSimLoop();
    this.emitLog('SIMULATOR: Disconnected.', 'RX');
    this.notifyStatus();
  }

  async setTarget(azDeg: number, elDeg: number): Promise<void> {
    if (!this.status.connected) return;
    this.status.commandedAz = Number(azDeg.toFixed(1));
    this.status.commandedEl = Number(Math.max(0, elDeg).toFixed(1));
    this.status.isMoving = true;

    const cmd = encodeGS232Position(azDeg, elDeg);
    this.emitLog(cmd.trim(), 'TX');
  }

  async stop(): Promise<void> {
    this.status.commandedAz = this.status.actualAz;
    this.status.commandedEl = this.status.actualEl;
    this.status.isMoving = false;
    this.emitLog(encodeGS232Stop().trim(), 'TX');
    this.notifyStatus();
  }

  getStatus(): RotatorStatus {
    return { ...this.status };
  }

  onStatusUpdate(listener: (status: RotatorStatus) => void): () => void {
    this.statusListeners.add(listener);
    listener(this.getStatus());
    return () => this.statusListeners.delete(listener);
  }

  onCommandLog(listener: (entry: CommandLogEntry) => void): () => void {
    this.logListeners.add(listener);
    return () => this.logListeners.delete(listener);
  }

  private emitLog(command: string, direction: 'TX' | 'RX') {
    const entry: CommandLogEntry = {
      time: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      command,
      direction,
    };
    this.logListeners.forEach((cb) => cb(entry));
  }

  private notifyStatus() {
    const s = this.getStatus();
    this.statusListeners.forEach((cb) => cb(s));
  }

  private startSimLoop() {
    this.stopSimLoop();
    let lastTick = performance.now();

    this.simTimer = setInterval(() => {
      const now = performance.now();
      const dtSec = (now - lastTick) / 1000.0;
      lastTick = now;

      const dAz = this.status.commandedAz - this.status.actualAz;
      const dEl = this.status.commandedEl - this.status.actualEl;

      const azStep = Math.sign(dAz) * Math.min(Math.abs(dAz), this.azSlewRateDegS * dtSec);
      const elStep = Math.sign(dEl) * Math.min(Math.abs(dEl), this.elSlewRateDegS * dtSec);

      this.status.actualAz = Number((this.status.actualAz + azStep).toFixed(1));
      this.status.actualEl = Number((this.status.actualEl + elStep).toFixed(1));

      // Calculate instantaneous pointing error
      const errAz = Math.abs(this.status.commandedAz - this.status.actualAz);
      const errEl = Math.abs(this.status.commandedEl - this.status.actualEl);
      this.status.pointingErrorDeg = Number(Math.hypot(errAz, errEl).toFixed(2));

      this.status.isMoving = Math.abs(dAz) > 0.2 || Math.abs(dEl) > 0.2;
      this.status.lastUpdatedMs = Date.now();
      this.notifyStatus();
    }, 100);
  }

  private stopSimLoop() {
    if (this.simTimer) {
      clearInterval(this.simTimer);
      this.simTimer = null;
    }
  }
}

// ==========================================
// 2. WEB SERIAL API TRANSPORT (Chrome / Edge)
// ==========================================

export class WebSerialTransport implements RotatorTransport {
  public type: TransportType = 'WEB_SERIAL';

  private port: any = null;
  private writer: any = null;
  private reader: any = null;
  private status: RotatorStatus = {
    connected: false,
    transportType: 'WEB_SERIAL',
    actualAz: 0.0,
    actualEl: 0.0,
    commandedAz: 0.0,
    commandedEl: 0.0,
    isMoving: false,
    pointingErrorDeg: 0.0,
    error: null,
    lastUpdatedMs: Date.now(),
  };

  private statusListeners = new Set<(status: RotatorStatus) => void>();
  private logListeners = new Set<(entry: CommandLogEntry) => void>();

  async connect(options = { baudRate: 9600 }): Promise<boolean> {
    if (typeof navigator === 'undefined' || !('serial' in navigator)) {
      this.status.error = 'Web Serial API is not supported in this browser. Please use Chrome/Edge or the Local Bridge.';
      this.notifyStatus();
      return false;
    }

    try {
      this.port = await (navigator as any).serial.requestPort();
      await this.port.open({ baudRate: options.baudRate });

      this.writer = this.port.writable.getWriter();
      this.status.connected = true;
      this.status.error = null;
      this.emitLog(`SERIAL: Connected at ${options.baudRate} baud`, 'RX');
      this.notifyStatus();
      this.startReadLoop();
      return true;
    } catch (err: any) {
      this.status.error = err.message || 'Failed opening serial port';
      this.emitLog(`SERIAL ERROR: ${this.status.error}`, 'RX');
      this.notifyStatus();
      return false;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.writer) {
        await this.writer.close();
        this.writer = null;
      }
      if (this.port) {
        await this.port.close();
        this.port = null;
      }
    } catch {}
    this.status.connected = false;
    this.emitLog('SERIAL: Disconnected', 'RX');
    this.notifyStatus();
  }

  async setTarget(azDeg: number, elDeg: number): Promise<void> {
    if (!this.writer || !this.status.connected) return;
    this.status.commandedAz = azDeg;
    this.status.commandedEl = elDeg;

    const cmd = encodeGS232Position(azDeg, elDeg);
    const encoder = new TextEncoder();
    await this.writer.write(encoder.encode(cmd));
    this.emitLog(cmd.trim(), 'TX');
  }

  async stop(): Promise<void> {
    if (!this.writer || !this.status.connected) return;
    const cmd = encodeGS232Stop();
    const encoder = new TextEncoder();
    await this.writer.write(encoder.encode(cmd));
    this.emitLog(cmd.trim(), 'TX');
  }

  getStatus(): RotatorStatus {
    return { ...this.status };
  }

  onStatusUpdate(listener: (status: RotatorStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  onCommandLog(listener: (entry: CommandLogEntry) => void): () => void {
    this.logListeners.add(listener);
    return () => this.logListeners.delete(listener);
  }

  private emitLog(command: string, direction: 'TX' | 'RX') {
    const entry: CommandLogEntry = {
      time: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      command,
      direction,
    };
    this.logListeners.forEach((cb) => cb(entry));
  }

  private notifyStatus() {
    const s = this.getStatus();
    this.statusListeners.forEach((cb) => cb(s));
  }

  private async startReadLoop() {
    const textDecoder = new TextDecoder();
    while (this.port && this.port.readable && this.status.connected) {
      try {
        this.reader = this.port.readable.getReader();
        let buffer = '';
        while (true) {
          const { value, done } = await this.reader.read();
          if (done) break;
          buffer += textDecoder.decode(value);
          const lines = buffer.split('\r');
          if (lines.length > 1) {
            for (let i = 0; i < lines.length - 1; i++) {
              const line = lines[i].trim();
              if (line) {
                this.emitLog(line, 'RX');
                const pos = parseGS232Reply(line);
                if (pos) {
                  this.status.actualAz = pos.azDeg;
                  this.status.actualEl = pos.elDeg;
                  this.status.lastUpdatedMs = Date.now();
                  this.notifyStatus();
                }
              }
            }
            buffer = lines[lines.length - 1];
          }
        }
      } catch (err: any) {
        break;
      } finally {
        if (this.reader) {
          this.reader.releaseLock();
          this.reader = null;
        }
      }
    }
  }
}

// ==========================================
// 3. LOCAL BRIDGE WEBSOCKET TRANSPORT
// ==========================================

export class LocalBridgeTransport implements RotatorTransport {
  public type: TransportType = 'LOCAL_BRIDGE';

  private ws: WebSocket | null = null;
  private bridgeUrl = 'ws://127.0.0.1:8765';
  private status: RotatorStatus = {
    connected: false,
    transportType: 'LOCAL_BRIDGE',
    actualAz: 0.0,
    actualEl: 0.0,
    commandedAz: 0.0,
    commandedEl: 0.0,
    isMoving: false,
    pointingErrorDeg: 0.0,
    error: null,
    lastUpdatedMs: Date.now(),
  };

  private statusListeners = new Set<(status: RotatorStatus) => void>();
  private logListeners = new Set<(entry: CommandLogEntry) => void>();

  async connect(options = { url: 'ws://127.0.0.1:8765' }): Promise<boolean> {
    this.bridgeUrl = options.url || this.bridgeUrl;

    return new Promise((resolve) => {
      try {
        this.ws = new WebSocket(this.bridgeUrl);

        this.ws.onopen = () => {
          this.status.connected = true;
          this.status.error = null;
          this.emitLog(`BRIDGE: Connected to daemon at ${this.bridgeUrl}`, 'RX');
          this.notifyStatus();
          resolve(true);
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'STATUS') {
              this.status.actualAz = data.actualAz;
              this.status.actualEl = data.actualEl;
              this.status.isMoving = data.isMoving;
              this.status.lastUpdatedMs = Date.now();
              this.notifyStatus();
            } else if (data.type === 'LOG') {
              this.emitLog(data.text, data.direction || 'RX');
            }
          } catch {
            this.emitLog(String(event.data), 'RX');
          }
        };

        this.ws.onerror = () => {
          this.status.error = 'Could not connect to OrbitGuard local rotator bridge on ws://127.0.0.1:8765. Is bridge.py running?';
          this.emitLog('BRIDGE ERROR: Connection failed', 'RX');
          this.notifyStatus();
          resolve(false);
        };

        this.ws.onclose = () => {
          this.status.connected = false;
          this.notifyStatus();
        };
      } catch (err: any) {
        this.status.error = err.message;
        resolve(false);
      }
    });
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.status.connected = false;
    this.notifyStatus();
  }

  async setTarget(azDeg: number, elDeg: number): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.status.commandedAz = azDeg;
    this.status.commandedEl = elDeg;

    const payload = JSON.stringify({
      action: 'SET_POSITION',
      azDeg,
      elDeg,
    });
    this.ws.send(payload);
    this.emitLog(`W${String(Math.round(azDeg)).padStart(3, '0')} ${String(Math.round(elDeg)).padStart(3, '0')}`, 'TX');
  }

  async stop(): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ action: 'STOP' }));
    this.emitLog('S', 'TX');
  }

  getStatus(): RotatorStatus {
    return { ...this.status };
  }

  onStatusUpdate(listener: (status: RotatorStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  onCommandLog(listener: (entry: CommandLogEntry) => void): () => void {
    this.logListeners.add(listener);
    return () => this.logListeners.delete(listener);
  }

  private emitLog(command: string, direction: 'TX' | 'RX') {
    const entry: CommandLogEntry = {
      time: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      command,
      direction,
    };
    this.logListeners.forEach((cb) => cb(entry));
  }

  private notifyStatus() {
    const s = this.getStatus();
    this.statusListeners.forEach((cb) => cb(s));
  }
}
