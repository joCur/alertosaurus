import { app } from 'electron';
import { autoUpdater } from 'electron-updater';

const CHECK_INTERVAL_MS = 30 * 60 * 1000;

let updateReady = false;
let intervalHandle: ReturnType<typeof setInterval> | null = null;

export function initAutoUpdater(onUpdateReady: (version: string) => void): void {
  if (!app.isPackaged) return;
  if (intervalHandle !== null) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-downloaded', (info) => {
    updateReady = true;
    onUpdateReady(info.version);
  });

  autoUpdater.on('error', (err) => {
    console.error('Auto-update error:', err.message);
  });

  autoUpdater.checkForUpdates();
  intervalHandle = setInterval(() => autoUpdater.checkForUpdates(), CHECK_INTERVAL_MS);
}

export function installUpdate(): void {
  if (!updateReady) return;
  autoUpdater.quitAndInstall();
}

/** Reset module-level state. For testing only. */
export function _resetForTesting(): void {
  updateReady = false;
  if (intervalHandle !== null) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}
