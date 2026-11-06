/**
 * OrbitGuard Desktop Main Process (Phase W1, W2, W3, W4, W6)
 * =============================================================
 * Orchestrates native window lifecycle, security guards, offline data layer,
 * native COM serial rotator management, and Windows system integrations.
 */

import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import log from 'electron-log';
import {
  IPC_CHANNELS,
  SerialOpenOptionsSchema,
  SerialWriteSchema,
  RotctldConnectOptionsSchema,
  RotctldCommandSchema,
  PassReminderSchema,
  SaveFileDialogSchema,
  SystemInfo,
} from '../../frontend/src/shared/ipc';
import {
  setupSessionSecurity,
  setupWindowNavigationSecurity,
  validateIpcSender,
} from './security';
import { DataManager } from './dataManager';
import { SerialManager } from './serialManager';
import { RotctldClient } from './rotctldClient';
import { NotificationManager } from './notifications';
import { UpdaterManager } from './updater';
import { createApplicationMenu } from './menu';

// Configure logging to %APPDATA%/OrbitGuard/logs/main.log
const logsDir = path.join(app.getPath('userData'), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}
log.transports.file.resolvePathFn = () => path.join(logsDir, 'main.log');
log.transports.file.maxSize = 5 * 1024 * 1024; // 5MB rotation
log.info('[OrbitGuard Desktop] Initializing application process...');

// Register Windows AppUserModelID for notifications and taskbar grouping
app.setAppUserModelId('com.orbitguard.app');

// Register deep link protocol: orbitguard://sat/<noradId>
if (!app.isDefaultProtocolClient('orbitguard')) {
  app.setAsDefaultProtocolClient('orbitguard');
}

// Enforce single-instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  log.warn('[OrbitGuard Desktop] Another instance is already running. Quitting.');
  app.quit();
  process.exit(0);
}

let mainWindow: BrowserWindow | null = null;
const dataManager = new DataManager();
const serialManager = new SerialManager();
const rotctldClient = new RotctldClient();
const notificationManager = new NotificationManager();
const updaterManager = new UpdaterManager();

// Window geometry state storage
interface WindowState {
  width: number;
  height: number;
  x?: number;
  y?: number;
  isMaximized: boolean;
}

function loadWindowState(): WindowState {
  const defaultState: WindowState = { width: 1440, height: 900, isMaximized: false };
  try {
    const stateFile = path.join(app.getPath('userData'), 'window-state.json');
    if (fs.existsSync(stateFile)) {
      return { ...defaultState, ...JSON.parse(fs.readFileSync(stateFile, 'utf8')) };
    }
  } catch (e) {}
  return defaultState;
}

function saveWindowState(win: BrowserWindow) {
  try {
    const stateFile = path.join(app.getPath('userData'), 'window-state.json');
    const isMax = win.isMaximized();
    const bounds = win.getBounds();
    const state: WindowState = {
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      isMaximized: isMax,
    };
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), 'utf8');
  } catch (e) {}
}

async function createWindow() {
  const windowState = loadWindowState();

  mainWindow = new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    x: windowState.x,
    y: windowState.y,
    minWidth: 1080,
    minHeight: 700,
    backgroundColor: '#030712', // Pure dark theme; prevents white startup flashes
    show: false,
    title: 'OrbitGuard — Real-Time SSA & RF Ground Station',
    icon: path.join(__dirname, '../../resources/icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      spellcheck: false,
    },
  });

  if (windowState.isMaximized) {
    mainWindow.maximize();
  }

  // Security Guards (CSP, navigation & window.open interception)
  setupSessionSecurity();
  setupWindowNavigationSecurity(mainWindow.webContents);

  // Application Menu
  const menu = createApplicationMenu(mainWindow, dataManager, () => updaterManager.checkForUpdates());
  mainWindow.setMenu(menu);

  // Wire DataManager background refresh events to Renderer
  dataManager.setOnUpdateListener((meta) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_CHANNELS.DATA_ON_UPDATED, meta);
    }
  });

  // Wire SerialManager streams to Renderer
  serialManager.setListeners(
    (data) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(IPC_CHANNELS.SERIAL_ON_DATA, data);
      }
    },
    (err) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(IPC_CHANNELS.SERIAL_ON_ERROR, err);
      }
    },
    () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(IPC_CHANNELS.SERIAL_ON_DISCONNECT);
      }
    }
  );

  // Wire rotctld streams to Renderer
  rotctldClient.setListeners(
    (data) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(IPC_CHANNELS.ROTCTLD_ON_DATA, data);
      }
    },
    (err) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(IPC_CHANNELS.ROTCTLD_ON_ERROR, err);
      }
    }
  );

  // Wire AutoUpdater status to Renderer
  updaterManager.setStatusCallback((status) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_CHANNELS.UPDATER_ON_STATUS, status);
    }
  });

  // System Tray setup
  notificationManager.setupTray(mainWindow, path.join(__dirname, '../../resources/icon.ico'));

  // Window lifecycle events
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    log.info('[OrbitGuard Desktop] Main window rendered and visible.');
  });

  mainWindow.on('close', () => {
    if (mainWindow) {
      saveWindowState(mainWindow);
      serialManager.closePort();
      rotctldClient.disconnect();
    }
  });

  // Crash Recovery Listeners
  mainWindow.webContents.on('render-process-gone', (_, details) => {
    log.error('[OrbitGuard Desktop] Render process crash detected:', details);
    dialog.showMessageBox(mainWindow!, {
      type: 'error',
      title: 'OrbitGuard Graphics Process Interrupted',
      message: `The 3D rendering viewport encountered a graphics issue (${details.reason}).`,
      buttons: ['Reload OrbitGuard', 'Exit'],
    }).then((res) => {
      if (res.response === 0) {
        mainWindow?.reload();
      } else {
        app.quit();
      }
    });
  });

  // Load URL: dev server vs production bundled Vite assets
  const devServerUrl = process.env.VITE_DEV_SERVER_URL || (process.env.NODE_ENV === 'development' ? 'http://localhost:5173' : null);
  if (devServerUrl) {
    await mainWindow.loadURL(devServerUrl);
  } else {
    const indexPath = path.join(__dirname, '../../frontend/dist/index.html');
    await mainWindow.loadFile(indexPath);
  }
}

// Handle second instance launches and deep-linking
app.on('second-instance', (_, commandLine) => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();

    // Check for deep link: orbitguard://sat/<noradId>
    const deepLink = commandLine.find((arg) => arg.startsWith('orbitguard://'));
    if (deepLink) {
      const match = deepLink.match(/orbitguard:\/\/sat\/(\d+)/i);
      if (match && match[1]) {
        mainWindow.webContents.executeJavaScript(
          `window.dispatchEvent(new CustomEvent('orbitguard:select-satellite', { detail: '${match[1]}' }));`
        );
      }
    }
  }
});

// App Startup
app.whenReady().then(async () => {
  log.info('[OrbitGuard Desktop] Electron app ready. Initializing subsystems...');
  await dataManager.initialize();
  registerIpcHandlers();
  await createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  await serialManager.closePort();
  rotctldClient.disconnect();
  notificationManager.cleanup();
});

// ==========================================
// Allow-listed IPC Handlers (Zod Validated)
// ==========================================

function registerIpcHandlers() {
  // System Info
  ipcMain.handle(IPC_CHANNELS.SYSTEM_GET_INFO, (event): SystemInfo => {
    if (!validateIpcSender(event, IPC_CHANNELS.SYSTEM_GET_INFO)) throw new Error('Forbidden');
    return {
      appVersion: app.getVersion(),
      electronVersion: process.versions.electron || 'N/A',
      chromiumVersion: process.versions.chrome || 'N/A',
      nodeVersion: process.versions.node || 'N/A',
      platform: 'win32',
      arch: process.arch,
      isPackaged: app.isPackaged,
      userDataPath: app.getPath('userData'),
    };
  });

  // Offline Data Cache Handlers
  ipcMain.handle(IPC_CHANNELS.DATA_GET_CATALOG, (event) => {
    if (!validateIpcSender(event, IPC_CHANNELS.DATA_GET_CATALOG)) throw new Error('Forbidden');
    return dataManager.getCachedCatalog();
  });

  ipcMain.handle(IPC_CHANNELS.DATA_GET_CONJUNCTIONS, (event) => {
    if (!validateIpcSender(event, IPC_CHANNELS.DATA_GET_CONJUNCTIONS)) throw new Error('Forbidden');
    return dataManager.getCachedConjunctions();
  });

  ipcMain.handle(IPC_CHANNELS.DATA_GET_METADATA, (event) => {
    if (!validateIpcSender(event, IPC_CHANNELS.DATA_GET_METADATA)) throw new Error('Forbidden');
    return dataManager.getCachedMetadata();
  });

  ipcMain.handle(IPC_CHANNELS.DATA_REFRESH, async (event) => {
    if (!validateIpcSender(event, IPC_CHANNELS.DATA_REFRESH)) throw new Error('Forbidden');
    return dataManager.refreshDataInBackground(true);
  });

  ipcMain.handle(IPC_CHANNELS.DATA_CLEAR_CACHE, async (event) => {
    if (!validateIpcSender(event, IPC_CHANNELS.DATA_CLEAR_CACHE)) throw new Error('Forbidden');
    await dataManager.clearCache();
  });

  // Native Serial COM Port Handlers
  ipcMain.handle(IPC_CHANNELS.SERIAL_LIST, async (event) => {
    if (!validateIpcSender(event, IPC_CHANNELS.SERIAL_LIST)) throw new Error('Forbidden');
    return serialManager.listPorts();
  });

  ipcMain.handle(IPC_CHANNELS.SERIAL_OPEN, async (event, rawOpts) => {
    if (!validateIpcSender(event, IPC_CHANNELS.SERIAL_OPEN)) throw new Error('Forbidden');
    const parsed = SerialOpenOptionsSchema.safeParse(rawOpts);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message };
    }
    const res = await serialManager.openPort(parsed.data);
    updaterManager.setTrackingActive(res.success);
    return res;
  });

  ipcMain.handle(IPC_CHANNELS.SERIAL_WRITE, async (event, rawPayload) => {
    if (!validateIpcSender(event, IPC_CHANNELS.SERIAL_WRITE)) throw new Error('Forbidden');
    const parsed = SerialWriteSchema.safeParse(rawPayload);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message };
    }
    return serialManager.write(parsed.data.data);
  });

  ipcMain.handle(IPC_CHANNELS.SERIAL_CLOSE, async (event) => {
    if (!validateIpcSender(event, IPC_CHANNELS.SERIAL_CLOSE)) throw new Error('Forbidden');
    const res = await serialManager.closePort();
    updaterManager.setTrackingActive(false);
    return res;
  });

  ipcMain.handle(IPC_CHANNELS.SERIAL_STATUS, (event) => {
    if (!validateIpcSender(event, IPC_CHANNELS.SERIAL_STATUS)) throw new Error('Forbidden');
    return serialManager.getStatus();
  });

  // rotctld TCP Client Handlers
  ipcMain.handle(IPC_CHANNELS.ROTCTLD_CONNECT, async (event, rawOpts) => {
    if (!validateIpcSender(event, IPC_CHANNELS.ROTCTLD_CONNECT)) throw new Error('Forbidden');
    const parsed = RotctldConnectOptionsSchema.safeParse(rawOpts);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message };
    }
    const res = await rotctldClient.connect(parsed.data);
    updaterManager.setTrackingActive(res.success);
    return res;
  });

  ipcMain.handle(IPC_CHANNELS.ROTCTLD_COMMAND, async (event, rawCmd) => {
    if (!validateIpcSender(event, IPC_CHANNELS.ROTCTLD_COMMAND)) throw new Error('Forbidden');
    const parsed = RotctldCommandSchema.safeParse(rawCmd);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message };
    }
    return rotctldClient.sendCommand(parsed.data.command);
  });

  ipcMain.handle(IPC_CHANNELS.ROTCTLD_DISCONNECT, async (event) => {
    if (!validateIpcSender(event, IPC_CHANNELS.ROTCTLD_DISCONNECT)) throw new Error('Forbidden');
    rotctldClient.disconnect();
    updaterManager.setTrackingActive(false);
  });

  // Windows Toast Pass Reminders
  ipcMain.handle(IPC_CHANNELS.NOTIFY_PASS_REMINDER, (event, rawReminder) => {
    if (!validateIpcSender(event, IPC_CHANNELS.NOTIFY_PASS_REMINDER)) throw new Error('Forbidden');
    const parsed = PassReminderSchema.safeParse(rawReminder);
    if (!parsed.success) return false;
    return notificationManager.schedulePassReminder(parsed.data);
  });

  // Native Save File Dialog
  ipcMain.handle(IPC_CHANNELS.DIALOG_SAVE_FILE, async (event, rawOpts) => {
    if (!validateIpcSender(event, IPC_CHANNELS.DIALOG_SAVE_FILE)) throw new Error('Forbidden');
    const parsed = SaveFileDialogSchema.safeParse(rawOpts);
    if (!parsed.success) return { success: false, error: 'Invalid parameters' };

    const win = BrowserWindow.fromWebContents(event.sender);
    const saveRes = await dialog.showSaveDialog(win || mainWindow!, {
      defaultPath: parsed.data.defaultPath,
      filters: parsed.data.filters,
    });

    if (saveRes.canceled || !saveRes.filePath) {
      return { success: false, canceled: true };
    }

    try {
      fs.writeFileSync(saveRes.filePath, parsed.data.content, parsed.data.encoding);
      return { success: true, filePath: saveRes.filePath };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // System Folder Openers
  ipcMain.handle(IPC_CHANNELS.DIALOG_OPEN_DATA_FOLDER, async (event) => {
    if (!validateIpcSender(event, IPC_CHANNELS.DIALOG_OPEN_DATA_FOLDER)) throw new Error('Forbidden');
    const dataDir = path.join(app.getPath('userData'), 'data');
    await shell.openPath(dataDir);
  });

  ipcMain.handle(IPC_CHANNELS.DIALOG_OPEN_LOGS_FOLDER, async (event) => {
    if (!validateIpcSender(event, IPC_CHANNELS.DIALOG_OPEN_LOGS_FOLDER)) throw new Error('Forbidden');
    const logsDir = path.join(app.getPath('userData'), 'logs');
    await shell.openPath(logsDir);
  });

  // Auto-Update Trigger
  ipcMain.handle(IPC_CHANNELS.UPDATER_CHECK, async (event) => {
    if (!validateIpcSender(event, IPC_CHANNELS.UPDATER_CHECK)) throw new Error('Forbidden');
    updaterManager.checkForUpdates();
  });

  ipcMain.handle(IPC_CHANNELS.UPDATER_INSTALL, async (event) => {
    if (!validateIpcSender(event, IPC_CHANNELS.UPDATER_INSTALL)) throw new Error('Forbidden');
    updaterManager.installUpdateNow();
  });
}
