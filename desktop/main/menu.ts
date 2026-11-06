/**
 * OrbitGuard Windows Native Application Menu (Phase W3)
 * =====================================================
 * Native Windows menu with keyboard shortcuts, tools, data folder links,
 * and technical diagnostic dialogs.
 */

import { Menu, MenuItemConstructorOptions, app, shell, BrowserWindow, dialog } from 'electron';
import path from 'path';
import { DataManager } from './dataManager';

export function createApplicationMenu(
  mainWindow: BrowserWindow,
  dataManager: DataManager,
  onCheckUpdates: () => void
): Menu {
  const isDev = !app.isPackaged;
  const dataDir = path.join(app.getPath('userData'), 'data');
  const logsDir = path.join(app.getPath('userData'), 'logs');

  const template: MenuItemConstructorOptions[] = [
    {
      label: '&File',
      submenu: [
        {
          label: 'Open &Data Folder',
          accelerator: 'CmdOrCtrl+D',
          click: () => {
            shell.openPath(dataDir);
          },
        },
        {
          label: 'Open &Logs Folder',
          click: () => {
            shell.openPath(logsDir);
          },
        },
        { type: 'separator' },
        {
          label: 'E&xit',
          accelerator: 'Alt+F4',
          click: () => {
            app.quit();
          },
        },
      ],
    },
    {
      label: '&View',
      submenu: [
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(isDev
          ? [
              { type: 'separator' as const },
              { role: 'reload' as const },
              { role: 'forceReload' as const },
              { role: 'toggleDevTools' as const },
            ]
          : []),
      ],
    },
    {
      label: '&Tools',
      submenu: [
        {
          label: '&Refresh Space Catalog (CelesTrak)',
          accelerator: 'CmdOrCtrl+R',
          click: async () => {
            await dataManager.refreshDataInBackground(true);
          },
        },
        {
          label: 'Clear Offline &Cache',
          click: async () => {
            const res = await dialog.showMessageBox(mainWindow, {
              type: 'question',
              buttons: ['Cancel', 'Clear & Re-seed'],
              defaultId: 1,
              title: 'Clear OrbitGuard Data Cache',
              message: 'Are you sure you want to clear cached orbital data? The application will re-seed from bundled snapshots.',
            });
            if (res.response === 1) {
              await dataManager.clearCache();
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Toggle Performance &HUD',
          accelerator: '`',
          click: () => {
            mainWindow.webContents.sendInputEvent({ type: 'keyDown', keyCode: '`' });
            mainWindow.webContents.sendInputEvent({ type: 'keyUp', keyCode: '`' });
          },
        },
        {
          label: '&ISRO / HAL Technical Interview Simulator',
          accelerator: 'CmdOrCtrl+I',
          click: () => {
            mainWindow.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'i' });
            mainWindow.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'i' });
          },
        },
        {
          label: 'System &Settings',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            mainWindow.webContents.sendInputEvent({ type: 'keyDown', keyCode: ',' });
            mainWindow.webContents.sendInputEvent({ type: 'keyUp', keyCode: ',' });
          },
        },
      ],
    },
    {
      label: '&Help',
      submenu: [
        {
          label: 'Documentation & Keyboard &Shortcuts',
          accelerator: 'F1',
          click: () => {
            mainWindow.webContents.sendInputEvent({ type: 'keyDown', keyCode: '?' });
            mainWindow.webContents.sendInputEvent({ type: 'keyUp', keyCode: '?' });
          },
        },
        {
          label: 'Visit &GitHub Repository',
          click: () => {
            shell.openExternal('https://github.com/Hitesh070/Orbit-Guard');
          },
        },
        {
          label: '&Check for Updates...',
          click: () => {
            onCheckUpdates();
          },
        },
        { type: 'separator' },
        {
          label: '&About OrbitGuard',
          click: () => {
            const meta = dataManager.getCachedMetadata();
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About OrbitGuard',
              message: `OrbitGuard SSA & RF Ground Station v4.2.0`,
              detail: [
                `Electron: ${process.versions.electron}`,
                `Chromium: ${process.versions.chrome}`,
                `Node.js: ${process.versions.node}`,
                `OS Platform: Windows (${process.arch})`,
                `Catalog Source: ${meta?.source || 'Bundled Snapshot'}`,
                `Active Spacecraft: ${meta?.satellitesCount || '---'} | Tracked Debris: ${meta?.debrisCount || '---'}`,
                `Data Freshness: ${meta?.fetchTime ? new Date(meta.fetchTime).toLocaleString() : 'Offline Snapshot'}`,
                `\nAuthor: EEE Student / Space Systems Candidate`,
              ].join('\n'),
            });
          },
        },
      ],
    },
  ];

  return Menu.buildFromTemplate(template);
}
