/**
 * OrbitGuard Hamlib rotctld TCP Client (Phase W6)
 * ================================================
 * Enables direct TCP network control of rotators via Hamlib rotctld daemon (default 127.0.0.1:4533).
 */

import net from 'net';
import { RotctldConnectOptions } from '../../frontend/src/shared/ipc';

export class RotctldClient {
  private socket: net.Socket | null = null;
  private isConnected = false;
  private onDataListener?: (data: string) => void;
  private onErrorListener?: (error: string) => void;

  constructor() {}

  public setListeners(onData: (data: string) => void, onError: (error: string) => void) {
    this.onDataListener = onData;
    this.onErrorListener = onError;
  }

  public connect(options: RotctldConnectOptions = { host: '127.0.0.1', port: 4533 }): Promise<{ success: boolean; error?: string }> {
    if (this.socket) {
      this.disconnect();
    }

    return new Promise((resolve) => {
      const socket = new net.Socket();
      const host = options.host ?? '127.0.0.1';
      const port = options.port ?? 4533;

      socket.connect(port, host, () => {
        this.socket = socket;
        this.isConnected = true;
        console.log(`[rotctldClient] Connected to rotctld at ${host}:${port}`);
        resolve({ success: true });
      });

      socket.on('data', (data) => {
        const text = data.toString('utf8');
        if (this.onDataListener) {
          this.onDataListener(text);
        }
      });

      socket.on('error', (err) => {
        console.warn(`[rotctldClient] TCP error:`, err.message);
        if (this.onErrorListener) {
          this.onErrorListener(err.message);
        }
        if (!this.isConnected) {
          resolve({ success: false, error: `Could not connect to rotctld at ${options.host}:${options.port}` });
        }
      });

      socket.on('close', () => {
        this.isConnected = false;
        this.socket = null;
        console.log('[rotctldClient] TCP connection closed.');
      });
    });
  }

  public sendCommand(cmd: string): Promise<{ success: boolean; response?: string; error?: string }> {
    if (!this.socket || !this.isConnected) {
      return Promise.resolve({ success: false, error: 'rotctld socket not connected' });
    }

    const formatted = cmd.endsWith('\n') ? cmd : `${cmd}\n`;
    return new Promise((resolve) => {
      this.socket!.write(formatted, 'utf8', (err) => {
        if (err) {
          resolve({ success: false, error: err.message });
        } else {
          resolve({ success: true });
        }
      });
    });
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
      this.isConnected = false;
    }
  }
}
