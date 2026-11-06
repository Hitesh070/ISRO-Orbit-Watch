/**
 * OrbitGuard Windows Native Notifications & Tray Manager (Phase W5)
 * ==================================================================
 * Issues Windows toast notifications for upcoming passes of favorite satellites
 * and provides system tray integration.
 */

import { Notification, app, Tray, Menu, nativeImage, BrowserWindow } from 'electron';
import path from 'path';
import { PassReminder } from '../../frontend/src/shared/ipc';

export class NotificationManager {
  private scheduledTimers: Map<number, NodeJS.Timeout> = new Map();
  private tray: Tray | null = null;

  constructor() {}

  public schedulePassReminder(reminder: PassReminder): boolean {
    if (!Notification.isSupported()) {
      return false;
    }

    const aosDate = new Date(reminder.aosTimeUtc);
    const leadMinutes = reminder.leadMinutes ?? 10;
    const triggerTime = aosDate.getTime() - leadMinutes * 60 * 1000;
    const delayMs = triggerTime - Date.now();

    // Cancel existing reminder for this satellite if any
    if (this.scheduledTimers.has(reminder.noradId)) {
      clearTimeout(this.scheduledTimers.get(reminder.noradId)!);
      this.scheduledTimers.delete(reminder.noradId);
    }

    if (delayMs <= 0) {
      // Pass is already starting or past
      return false;
    }

    const timer = setTimeout(() => {
      this.showPassNotification(reminder);
      this.scheduledTimers.delete(reminder.noradId);
    }, delayMs);

    this.scheduledTimers.set(reminder.noradId, timer);
    console.log(
      `[Notifications] Scheduled reminder for ${reminder.satelliteName} in ${(delayMs / 60000).toFixed(1)} minutes.`
    );
    return true;
  }

  private showPassNotification(reminder: PassReminder) {
    const notif = new Notification({
      title: `🛰️ Upcoming Pass: ${reminder.satelliteName}`,
      body: `Rising in ${reminder.leadMinutes ?? 10} minutes! Peak Elevation: ${reminder.maxElevationDeg.toFixed(1)}°`,
      urgency: 'normal',
      timeoutType: 'default',
    });

    notif.on('click', () => {
      const windows = BrowserWindow.getAllWindows();
      if (windows.length > 0) {
        if (windows[0].isMinimized()) windows[0].restore();
        windows[0].show();
        windows[0].focus();
      }
    });

    notif.show();
  }

  public setupTray(mainWindow: BrowserWindow, iconPath: string) {
    try {
      let icon = nativeImage.createFromPath(iconPath);
      if (icon.isEmpty()) {
        icon = nativeImage.createEmpty();
      }

      this.tray = new Tray(icon);
      this.tray.setToolTip('OrbitGuard SSA & RF Ground Station');

      const contextMenu = Menu.buildFromTemplate([
        {
          label: 'Show OrbitGuard',
          click: () => {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
          },
        },
        { type: 'separator' },
        {
          label: 'Quit',
          click: () => {
            app.quit();
          },
        },
      ]);

      this.tray.setContextMenu(contextMenu);
      this.tray.on('double-click', () => {
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      });
    } catch (err: any) {
      console.warn('[Notifications] Could not create system tray icon:', err.message);
    }
  }

  public cleanup() {
    for (const timer of this.scheduledTimers.values()) {
      clearTimeout(timer);
    }
    this.scheduledTimers.clear();
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }
}
