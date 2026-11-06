/**
 * OrbitGuard Desktop Auto-Updater (Phase W8)
 * ==========================================
 * Manages background update checks using `electron-updater` via GitHub Releases.
 * Enforces non-intrusive notification: never restarts mid-tracking or while a rotator is open.
 */

import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import { UpdateStatus } from '../../frontend/src/shared/ipc';

export class UpdaterManager {
  private statusCallback?: (status: UpdateStatus) => void;
  private isTrackingOrConnected = false;

  constructor() {
    autoUpdater.logger = log;
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    this.setupListeners();
  }

  public setStatusCallback(cb: (status: UpdateStatus) => void) {
    this.statusCallback = cb;
  }

  public setTrackingActive(active: boolean) {
    this.isTrackingOrConnected = active;
  }

  private setupListeners() {
    autoUpdater.on('checking-for-update', () => {
      this.emitStatus({ status: 'checking' });
    });

    autoUpdater.on('update-available', (info) => {
      this.emitStatus({
        status: 'available',
        info: {
          version: info.version,
          releaseDate: info.releaseDate,
          releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined,
        },
      });
    });

    autoUpdater.on('update-not-available', () => {
      this.emitStatus({ status: 'not-available' });
    });

    autoUpdater.on('download-progress', (progressObj) => {
      this.emitStatus({
        status: 'downloading',
        progressPercent: progressObj.percent,
      });
    });

    autoUpdater.on('update-downloaded', (info) => {
      this.emitStatus({
        status: 'downloaded',
        info: {
          version: info.version,
        },
      });
    });

    autoUpdater.on('error', (err) => {
      log.warn('[Updater] Auto-update error (non-fatal):', err.message);
      this.emitStatus({ status: 'error', error: err.message });
    });
  }

  private emitStatus(status: UpdateStatus) {
    if (this.statusCallback) {
      this.statusCallback(status);
    }
  }

  public checkForUpdates() {
    try {
      autoUpdater.checkForUpdatesAndNotify().catch((err) => {
        log.warn('[Updater] Check error:', err.message);
      });
    } catch (e: any) {
      log.warn('[Updater] Check exception:', e.message);
    }
  }

  public installUpdateNow(): boolean {
    if (this.isTrackingOrConnected) {
      log.warn('[Updater] Delayed update install: Antenna rotator tracking is currently active.');
      return false;
    }
    autoUpdater.quitAndInstall();
    return true;
  }
}
