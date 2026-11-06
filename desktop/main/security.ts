/**
 * OrbitGuard Desktop Security Guard & IPC Origin Validator (Phase W2)
 * ====================================================================
 * Enforces strict origin checking, CSP headers, external navigation allow-lists,
 * and DPAPI safeStorage for credentials.
 */

import { session, shell, WebContents, safeStorage } from 'electron';
import { IpcChannel, IPC_CHANNELS } from '../../frontend/src/shared/ipc';

const ALLOWED_IPC_CHANNELS = new Set<string>(Object.values(IPC_CHANNELS));

/**
 * Validates that an IPC message originated from the application's legitimate window frame.
 */
export function validateIpcSender(event: Electron.IpcMainInvokeEvent, channel: string): boolean {
  if (!ALLOWED_IPC_CHANNELS.has(channel)) {
    console.error(`[Security] Blocked unauthorized IPC channel access: ${channel}`);
    return false;
  }

  const senderUrl = event.senderFrame?.url || '';
  // In development, Vite runs on localhost:5173. In production, files load from app:// or file://
  const isDevOrigin = senderUrl.startsWith('http://localhost:5173') || senderUrl.startsWith('http://127.0.0.1:5173');
  const isProdOrigin = senderUrl.startsWith('file://') || senderUrl.startsWith('app://');

  if (!isDevOrigin && !isProdOrigin) {
    console.error(`[Security] Blocked IPC from untrusted frame origin: ${senderUrl}`);
    return false;
  }

  return true;
}

/**
 * Installs Content Security Policy and network guards onto the Electron session.
 */
export function setupSessionSecurity(ses: Electron.Session = session.defaultSession) {
  // Enforce Content-Security-Policy
  ses.webRequest.onHeadersReceived((details, callback) => {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' blob:",
      "worker-src 'self' blob:",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' https://celestrak.org https://raw.githubusercontent.com ws://127.0.0.1:* ws://localhost:* wss:",
      "frame-ancestors 'none'",
    ].join('; ');

    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
        'X-Content-Type-Options': ['nosniff'],
        'X-Frame-Options': ['DENY'],
      },
    });
  });

  // Deny all permission requests by default except notifications and geolocation
  ses.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'notifications' || permission === 'geolocation') {
      callback(true);
      return;
    }
    console.warn(`[Security] Denied permission request: ${permission}`);
    callback(false);
  });
}

/**
 * Configures window-level navigation guards and forces external links to open in the system browser.
 */
export function setupWindowNavigationSecurity(contents: WebContents) {
  // Prevent in-app navigation away from OrbitGuard
  contents.on('will-navigate', (event, navigationUrl) => {
    const parsed = new URL(navigationUrl);
    const isAllowed =
      parsed.origin === 'http://localhost:5173' ||
      parsed.origin === 'http://127.0.0.1:5173' ||
      navigationUrl.startsWith('file://');

    if (!isAllowed) {
      event.preventDefault();
      if (parsed.protocol === 'https:') {
        shell.openExternal(navigationUrl);
      }
    }
  });

  // Deny window.open and open external HTTPS URLs safely
  contents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        shell.openExternal(url);
      }
    } catch (e) {
      console.warn(`[Security] Ignored invalid window.open target: ${url}`);
    }
    return { action: 'deny' };
  });
}

/**
 * Windows DPAPI Credential Storage using safeStorage
 */
export const CredentialVault = {
  isAvailable(): boolean {
    return safeStorage.isEncryptionAvailable();
  },

  encrypt(plainText: string): string {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('DPAPI encryption unavailable on this system');
    }
    const encrypted = safeStorage.encryptString(plainText);
    return encrypted.toString('base64');
  },

  decrypt(base64Cipher: string): string {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('DPAPI encryption unavailable on this system');
    }
    const buffer = Buffer.from(base64Cipher, 'base64');
    return safeStorage.decryptString(buffer);
  },
};
