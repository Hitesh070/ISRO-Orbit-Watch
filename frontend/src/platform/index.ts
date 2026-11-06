/**
 * OrbitGuard Unified Platform Adapter
 * ===================================
 * Seamlessly abstracts desktop native capabilities vs web browser environment.
 * The UI consumes features through `platform.*` and never calls scattered `window.*` checks.
 */

import {
  SerialPortInfo,
  SerialOpenOptions,
  SerialStatus,
  RotctldConnectOptions,
  DataCacheMetadata,
  PassReminder,
  SaveFileDialogOptions,
  SystemInfo,
  UpdateStatus,
} from '../shared/ipc';

// Declare preload bridge type on window
declare global {
  interface Window {
    orbitguardPlatform?: {
      isDesktop: boolean;
      system: {
        getInfo: () => Promise<SystemInfo>;
        openDataFolder: () => Promise<void>;
        openLogsFolder: () => Promise<void>;
        checkForUpdates: () => Promise<void>;
        installUpdate: () => Promise<void>;
        onUpdateStatus: (cb: (status: UpdateStatus) => void) => () => void;
      };
      serial: {
        listPorts: () => Promise<SerialPortInfo[]>;
        open: (opts: SerialOpenOptions) => Promise<{ success: boolean; error?: string }>;
        write: (data: string) => Promise<{ success: boolean; error?: string }>;
        close: () => Promise<{ success: boolean; error?: string }>;
        getStatus: () => Promise<SerialStatus>;
        onData: (cb: (data: string) => void) => () => void;
        onError: (cb: (err: string) => void) => () => void;
        onDisconnect: (cb: () => void) => () => void;
      };
      rotctld: {
        connect: (opts: RotctldConnectOptions) => Promise<{ success: boolean; error?: string }>;
        sendCommand: (cmd: string) => Promise<{ success: boolean; response?: string; error?: string }>;
        disconnect: () => Promise<void>;
        onData: (cb: (data: string) => void) => () => void;
        onError: (cb: (err: string) => void) => () => void;
      };
      data: {
        getCachedCatalog: () => Promise<any[] | null>;
        getCachedConjunctions: () => Promise<any | null>;
        getMetadata: () => Promise<DataCacheMetadata | null>;
        refreshData: () => Promise<{ success: boolean; error?: string }>;
        clearCache: () => Promise<void>;
        onCatalogUpdated: (cb: (meta: DataCacheMetadata) => void) => () => void;
      };
      notifications: {
        schedulePassReminder: (reminder: PassReminder) => Promise<boolean>;
      };
      dialog: {
        saveFile: (opts: SaveFileDialogOptions) => Promise<{ success: boolean; filePath?: string; canceled?: boolean }>;
      };
    };
  }
}

const isDesktop = typeof window !== 'undefined' && Boolean(window.orbitguardPlatform?.isDesktop);
const desktopApi = typeof window !== 'undefined' ? window.orbitguardPlatform : undefined;

export const platform = {
  isDesktop,

  serial: {
    isAvailable: Boolean(isDesktop || (typeof navigator !== 'undefined' && 'serial' in navigator)),

    async listPorts(): Promise<SerialPortInfo[]> {
      if (isDesktop && desktopApi?.serial) {
        return desktopApi.serial.listPorts();
      }
      return [];
    },

    async open(opts: SerialOpenOptions): Promise<{ success: boolean; error?: string }> {
      if (isDesktop && desktopApi?.serial) {
        return desktopApi.serial.open(opts);
      }
      return { success: false, error: 'Native COM ports require OrbitGuard Windows Desktop App' };
    },

    async write(data: string): Promise<{ success: boolean; error?: string }> {
      if (isDesktop && desktopApi?.serial) {
        return desktopApi.serial.write(data);
      }
      return { success: false, error: 'Serial not connected' };
    },

    async close(): Promise<{ success: boolean; error?: string }> {
      if (isDesktop && desktopApi?.serial) {
        return desktopApi.serial.close();
      }
      return { success: true };
    },

    async getStatus(): Promise<SerialStatus> {
      if (isDesktop && desktopApi?.serial) {
        return desktopApi.serial.getStatus();
      }
      return { isOpen: false, port: null, baudRate: null };
    },

    onData(cb: (data: string) => void): () => void {
      if (isDesktop && desktopApi?.serial) {
        return desktopApi.serial.onData(cb);
      }
      return () => {};
    },

    onError(cb: (err: string) => void): () => void {
      if (isDesktop && desktopApi?.serial) {
        return desktopApi.serial.onError(cb);
      }
      return () => {};
    },

    onDisconnect(cb: () => void): () => void {
      if (isDesktop && desktopApi?.serial) {
        return desktopApi.serial.onDisconnect(cb);
      }
      return () => {};
    },
  },

  rotctld: {
    isAvailable: isDesktop,

    async connect(opts: RotctldConnectOptions = { host: '127.0.0.1', port: 4533 }): Promise<{ success: boolean; error?: string }> {
      if (isDesktop && desktopApi?.rotctld) {
        return desktopApi.rotctld.connect(opts);
      }
      return { success: false, error: 'rotctld TCP client requires desktop app' };
    },

    async sendCommand(cmd: string): Promise<{ success: boolean; response?: string; error?: string }> {
      if (isDesktop && desktopApi?.rotctld) {
        return desktopApi.rotctld.sendCommand(cmd);
      }
      return { success: false, error: 'rotctld TCP client requires desktop app' };
    },

    async disconnect(): Promise<void> {
      if (isDesktop && desktopApi?.rotctld) {
        await desktopApi.rotctld.disconnect();
      }
    },

    onData(cb: (data: string) => void): () => void {
      if (isDesktop && desktopApi?.rotctld) {
        return desktopApi.rotctld.onData(cb);
      }
      return () => {};
    },

    onError(cb: (err: string) => void): () => void {
      if (isDesktop && desktopApi?.rotctld) {
        return desktopApi.rotctld.onError(cb);
      }
      return () => {};
    },
  },

  data: {
    isOfflineFirst: isDesktop,

    async getCachedCatalog(): Promise<any[] | null> {
      if (isDesktop && desktopApi?.data) {
        return desktopApi.data.getCachedCatalog();
      }
      return null;
    },

    async getCachedConjunctions(): Promise<any | null> {
      if (isDesktop && desktopApi?.data) {
        return desktopApi.data.getCachedConjunctions();
      }
      return null;
    },

    async getMetadata(): Promise<DataCacheMetadata | null> {
      if (isDesktop && desktopApi?.data) {
        return desktopApi.data.getMetadata();
      }
      return null;
    },

    async refreshData(): Promise<{ success: boolean; error?: string }> {
      if (isDesktop && desktopApi?.data) {
        return desktopApi.data.refreshData();
      }
      return { success: true };
    },

    async clearCache(): Promise<void> {
      if (isDesktop && desktopApi?.data) {
        await desktopApi.data.clearCache();
      }
    },

    onCatalogUpdated(cb: (meta: DataCacheMetadata) => void): () => void {
      if (isDesktop && desktopApi?.data) {
        return desktopApi.data.onCatalogUpdated(cb);
      }
      return () => {};
    },
  },

  notifications: {
    async schedulePassReminder(reminder: PassReminder): Promise<boolean> {
      if (isDesktop && desktopApi?.notifications) {
        return desktopApi.notifications.schedulePassReminder(reminder);
      }

      // Web Notification fallback
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'default') {
          await Notification.requestPermission();
        }
        if (Notification.permission === 'granted') {
          const passDate = new Date(reminder.aosTimeUtc);
          const leadMinutes = reminder.leadMinutes ?? 10;
          const timeUntil = passDate.getTime() - Date.now() - leadMinutes * 60 * 1000;
          if (timeUntil > 0 && timeUntil < 24 * 3600 * 1000) {
            setTimeout(() => {
              new Notification(`🛰️ ${reminder.satelliteName} Pass in ${leadMinutes}m`, {
                body: `Max Elevation: ${reminder.maxElevationDeg.toFixed(1)}° | AOS: ${passDate.toLocaleTimeString()}`,
                icon: '/favicon.ico',
              });
            }, timeUntil);
            return true;
          }
        }
      }
      return false;
    },
  },

  dialog: {
    async saveFile(opts: SaveFileDialogOptions): Promise<{ success: boolean; filePath?: string; canceled?: boolean }> {
      if (isDesktop && desktopApi?.dialog) {
        return desktopApi.dialog.saveFile(opts);
      }

      // Web browser blob download fallback
      try {
        const blob = new Blob([opts.content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = opts.defaultPath || 'download.txt';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        return { success: true };
      } catch (err: any) {
        return { success: false, canceled: false };
      }
    },

    async openDataFolder(): Promise<void> {
      if (isDesktop && desktopApi?.system) {
        await desktopApi.system.openDataFolder();
      }
    },

    async openLogsFolder(): Promise<void> {
      if (isDesktop && desktopApi?.system) {
        await desktopApi.system.openLogsFolder();
      }
    },
  },

  system: {
    async getInfo(): Promise<SystemInfo> {
      if (isDesktop && desktopApi?.system) {
        return desktopApi.system.getInfo();
      }
      return {
        appVersion: '4.2.0-web',
        electronVersion: 'N/A',
        chromiumVersion: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A',
        nodeVersion: 'N/A',
        platform: 'web',
        arch: 'browser',
        isPackaged: true,
        userDataPath: 'localStorage',
      };
    },

    async checkForUpdates(): Promise<void> {
      if (isDesktop && desktopApi?.system) {
        await desktopApi.system.checkForUpdates();
      }
    },

    async installUpdate(): Promise<void> {
      if (isDesktop && desktopApi?.system) {
        await desktopApi.system.installUpdate();
      }
    },

    onUpdateStatus(cb: (status: UpdateStatus) => void): () => void {
      if (isDesktop && desktopApi?.system) {
        return desktopApi.system.onUpdateStatus(cb);
      }
      return () => {};
    },
  },
};
