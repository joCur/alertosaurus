import { app } from 'electron';
import { autoUpdater } from 'electron-updater';
import { log } from './logger';

const CHECK_INTERVAL_MS = 30 * 60 * 1000;

let updateReady = false;
let intervalHandle: ReturnType<typeof setInterval> | null = null;

export function initAutoUpdater(onUpdateReady: (version: string) => void): void {
  if (!app.isPackaged) return;
  if (intervalHandle !== null) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    log('updater', `update available: ${info.version}`);
  });

  autoUpdater.on('update-downloaded', (info) => {
    log('updater', `update downloaded: ${info.version}`);
    if (updateReady) return;
    updateReady = true;
    onUpdateReady(info.version);
  });

  autoUpdater.on('error', (err) => {
    log('updater', `error: ${err.message}`);
  });

  autoUpdater.checkForUpdates().catch(() => {});
  intervalHandle = setInterval(() => { autoUpdater.checkForUpdates().catch(() => {}); }, CHECK_INTERVAL_MS);
}

export function installUpdate(): void {
  log('updater', `installUpdate called, updateReady=${updateReady}`);
  if (!updateReady) return;
  autoUpdater.quitAndInstall(true, true);
}

/** Reset module-level state. For testing only. */
export function _resetForTesting(): void {
  updateReady = false;
  if (intervalHandle !== null) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
  autoUpdater.removeAllListeners();
}
