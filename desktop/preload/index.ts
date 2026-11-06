/**
 * OrbitGuard Desktop Preload Bridge (Phase W1 & W2)
 * =================================================
 * Secure context bridge connecting isolated renderer to allow-listed IPC channels.
 * Runs in an isolated sandbox with nodeIntegration disabled.
 */

import { contextBridge, ipcRenderer } from 'electron';
import {
  IPC_CHANNELS,
  SerialOpenOptions,
  RotctldConnectOptions,
  PassReminder,
  SaveFileDialogOptions,
  DataCacheMetadata,
  UpdateStatus,
} from '../../frontend/src/shared/ipc';

const api = {
  isDesktop: true,

  system: {
    getInfo: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_GET_INFO),
    openDataFolder: () => ipcRenderer.invoke(IPC_CHANNELS.DIALOG_OPEN_DATA_FOLDER),
    openLogsFolder: () => ipcRenderer.invoke(IPC_CHANNELS.DIALOG_OPEN_LOGS_FOLDER),
    checkForUpdates: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATER_CHECK),
    installUpdate: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATER_INSTALL),
    onUpdateStatus: (cb: (status: UpdateStatus) => void) => {
      const listener = (_: any, status: UpdateStatus) => cb(status);
      ipcRenderer.on(IPC_CHANNELS.UPDATER_ON_STATUS, listener);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.UPDATER_ON_STATUS, listener);
      };
    },
  },

  serial: {
    listPorts: () => ipcRenderer.invoke(IPC_CHANNELS.SERIAL_LIST),
    open: (opts: SerialOpenOptions) => ipcRenderer.invoke(IPC_CHANNELS.SERIAL_OPEN, opts),
    write: (data: string) => ipcRenderer.invoke(IPC_CHANNELS.SERIAL_WRITE, { data }),
    close: () => ipcRenderer.invoke(IPC_CHANNELS.SERIAL_CLOSE),
    getStatus: () => ipcRenderer.invoke(IPC_CHANNELS.SERIAL_STATUS),
    onData: (cb: (data: string) => void) => {
      const listener = (_: any, data: string) => cb(data);
      ipcRenderer.on(IPC_CHANNELS.SERIAL_ON_DATA, listener);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.SERIAL_ON_DATA, listener);
      };
    },
    onError: (cb: (err: string) => void) => {
      const listener = (_: any, err: string) => cb(err);
      ipcRenderer.on(IPC_CHANNELS.SERIAL_ON_ERROR, listener);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.SERIAL_ON_ERROR, listener);
      };
    },
    onDisconnect: (cb: () => void) => {
      const listener = () => cb();
      ipcRenderer.on(IPC_CHANNELS.SERIAL_ON_DISCONNECT, listener);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.SERIAL_ON_DISCONNECT, listener);
      };
    },
  },

  rotctld: {
    connect: (opts: RotctldConnectOptions) => ipcRenderer.invoke(IPC_CHANNELS.ROTCTLD_CONNECT, opts),
    sendCommand: (cmd: string) => ipcRenderer.invoke(IPC_CHANNELS.ROTCTLD_COMMAND, { command: cmd }),
    disconnect: () => ipcRenderer.invoke(IPC_CHANNELS.ROTCTLD_DISCONNECT),
    onData: (cb: (data: string) => void) => {
      const listener = (_: any, data: string) => cb(data);
      ipcRenderer.on(IPC_CHANNELS.ROTCTLD_ON_DATA, listener);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.ROTCTLD_ON_DATA, listener);
      };
    },
    onError: (cb: (err: string) => void) => {
      const listener = (_: any, err: string) => cb(err);
      ipcRenderer.on(IPC_CHANNELS.ROTCTLD_ON_ERROR, listener);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.ROTCTLD_ON_ERROR, listener);
      };
    },
  },

  data: {
    getCachedCatalog: () => ipcRenderer.invoke(IPC_CHANNELS.DATA_GET_CATALOG),
    getCachedConjunctions: () => ipcRenderer.invoke(IPC_CHANNELS.DATA_GET_CONJUNCTIONS),
    getMetadata: () => ipcRenderer.invoke(IPC_CHANNELS.DATA_GET_METADATA),
    refreshData: () => ipcRenderer.invoke(IPC_CHANNELS.DATA_REFRESH),
    clearCache: () => ipcRenderer.invoke(IPC_CHANNELS.DATA_CLEAR_CACHE),
    onCatalogUpdated: (cb: (meta: DataCacheMetadata) => void) => {
      const listener = (_: any, meta: DataCacheMetadata) => cb(meta);
      ipcRenderer.on(IPC_CHANNELS.DATA_ON_UPDATED, listener);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.DATA_ON_UPDATED, listener);
      };
    },
  },

  notifications: {
    schedulePassReminder: (reminder: PassReminder) =>
      ipcRenderer.invoke(IPC_CHANNELS.NOTIFY_PASS_REMINDER, reminder),
  },

  dialog: {
    saveFile: (opts: SaveFileDialogOptions) => ipcRenderer.invoke(IPC_CHANNELS.DIALOG_SAVE_FILE, opts),
  },
};

contextBridge.exposeInMainWorld('orbitguardPlatform', api);
