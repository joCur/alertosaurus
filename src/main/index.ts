import { app, BrowserWindow, desktopCapturer, ipcMain, screen, systemPreferences } from 'electron';
import path from 'path';
import { ConfigManager } from './config';
import { NotificationDb } from './db';
import { ToastQueue } from './queue';
import { PetStateMachine } from './state-machine';
import { createApp } from './server';
import http from 'http';
import sharp from 'sharp';
import {
  findLandingSurface,
  scanX as computeScanX,
  createGravityLoop,
  SPRITE_DISPLAY_WIDTH,
  BODY_PADDING,
  SPRITE_GROUND_OFFSET,
  PET_WINDOW_WIDTH,
  PET_WINDOW_HEIGHT,
} from './gravity';

let petWindow: BrowserWindow | null = null;
let hubWindow: BrowserWindow | null = null;
let isQuitting = false;

const configManager = new ConfigManager();
const config = configManager.load();
const db = new NotificationDb(path.join(ConfigManager.defaultDir(), 'notifications.db'));
const queue = new ToastQueue();
const stateMachine = new PetStateMachine();

let idleTimer: ReturnType<typeof setTimeout> | null = null;
let toastTimer: ReturnType<typeof setTimeout> | null = null;
let cancelGravity: (() => void) | null = null;

function sendPetState(state: string) {
  if (cancelGravity) return;
  petWindow?.webContents.send('pet:set-state', state);
}

function resetIdleTimer() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    stateMachine.idleTimeout();
    sendPetState('sleeping');
  }, config.idle_timeout_ms);
}

function showToast(toast: { caller: string; message: string; duration_ms: number; received_at: string }) {
  petWindow?.webContents.send('pet:show-toast', toast);

  if (toastTimer) clearTimeout(toastTimer);

  if (toast.duration_ms > 0) {
    toastTimer = setTimeout(() => {
      dismissToast();
    }, toast.duration_ms);
  }
}

function dismissToast() {
  if (toastTimer) clearTimeout(toastTimer);
  petWindow?.webContents.send('pet:hide-toast');

  const next = queue.next();
  if (next) {
    stateMachine.toastFinished(true);
    showToast(next);

    if (queue.overflowCount > 0) {
      petWindow?.webContents.send('pet:show-overflow', queue.overflowCount);
    }
  } else {
    stateMachine.toastFinished(false);
    sendPetState('idle');
    resetIdleTimer();
  }

  hubWindow?.webContents.send('hub:updated');
}

function onNotify() {
  if (idleTimer) clearTimeout(idleTimer);

  const prevState = stateMachine.state;
  const state = stateMachine.notificationArrived();

  if (state === 'roaring' && prevState !== 'roaring') {
    sendPetState('roaring');
  }

  if (queue.overflowCount > 0) {
    petWindow?.webContents.send('pet:show-overflow', queue.overflowCount);
  }

  hubWindow?.webContents.send('hub:updated');
}

const expressApp = createApp(db, queue, onNotify);
let httpServer: http.Server;

function isPositionOnScreen(x: number, y: number): boolean {
  const displays = screen.getAllDisplays();
  for (const display of displays) {
    const { x: dx, y: dy, width, height } = display.workArea;
    if (x >= dx && x < dx + width && y >= dy && y < dy + height) {
      return true;
    }
  }
  return false;
}

function createPetWindow() {
  let { x, y } = config.pet_position;

  if (!isPositionOnScreen(x, y)) {
    const primary = screen.getPrimaryDisplay().workArea;
    x = primary.x + Math.floor((primary.width - PET_WINDOW_WIDTH) / 2);
    y = primary.y + Math.floor((primary.height - PET_WINDOW_HEIGHT) / 2);
  }

  const safeX = x;
  const safeY = y;

  petWindow = new BrowserWindow({
    width: 320,
    height: 300,
    x: safeX,
    y: safeY,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  petWindow.setIgnoreMouseEvents(true, { forward: true });
  petWindow.loadFile(path.join(__dirname, '../pet/index.html'));
  petWindow.on('closed', () => { petWindow = null; });
}

function createHubWindow() {
  hubWindow = new BrowserWindow({
    width: 480,
    height: 600,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  hubWindow.loadFile(path.join(__dirname, '../hub/index.html'));
  hubWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      hubWindow?.hide();
    }
  });
}

async function captureAndFall() {
  if (!petWindow) return;

  const bounds = petWindow.getBounds();
  const winX = bounds.x;
  const winY = bounds.y;
  const winH = bounds.height;
  const centerX = winX + Math.floor(bounds.width / 2);
  const centerY = winY + Math.floor(bounds.height / 2);
  const currentDisplay = screen.getDisplayNearestPoint({ x: centerX, y: centerY });
  const workArea = currentDisplay.workArea;
  const displaySize = currentDisplay.size;
  const screenBottom = workArea.y + workArea.height;

  const feetY = winY + winH - BODY_PADDING - SPRITE_GROUND_OFFSET;
  const stripX = computeScanX(winX);
  const stripHeight = screenBottom - feetY;

  if (stripHeight <= 1) {
    const bottomY = screenBottom - winH + BODY_PADDING + SPRITE_GROUND_OFFSET;
    const clampedY = Math.min(winY, bottomY);
    petWindow.setBounds({ x: winX, y: clampedY, width: bounds.width, height: bounds.height });
    config.pet_position = { x: winX, y: clampedY };
    configManager.save(config);
    petWindow.webContents.send('pet:landed');
    return;
  }

  let landingScreenY = screenBottom;

  if (process.platform !== 'darwin' ||
      systemPreferences.getMediaAccessStatus('screen') === 'granted') {
    try {
      petWindow.setContentProtection(true);
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: displaySize.width, height: displaySize.height },
      });
      petWindow.setContentProtection(false);

      const displayId = String(currentDisplay.id);
      const source = sources.find(s => s.display_id === displayId) || sources[0];
      if (source) {
        const thumbnail = source.thumbnail.toPNG();
        const imgMeta = await sharp(thumbnail).metadata();
        const imgW = imgMeta.width!;
        const imgH = imgMeta.height!;
        const scaleX = imgW / displaySize.width;
        const scaleY = imgH / displaySize.height;

        const relStripX = stripX - currentDisplay.bounds.x;
        const relFeetY = feetY - currentDisplay.bounds.y;
        const cropLeft = Math.round(Math.max(0, Math.min(relStripX, displaySize.width - SPRITE_DISPLAY_WIDTH)) * scaleX);
        const cropTop = Math.round(relFeetY * scaleY);
        const cropWidth = Math.min(Math.round(SPRITE_DISPLAY_WIDTH * scaleX), imgW - cropLeft);
        const cropHeight = Math.min(Math.round(stripHeight * scaleY), imgH - cropTop);

        if (cropWidth > 0 && cropHeight > 0) {
          const { data, info } = await sharp(thumbnail)
            .extract({
              left: cropLeft,
              top: cropTop,
              width: cropWidth,
              height: cropHeight,
            })
            .raw()
            .toBuffer({ resolveWithObject: true });

          const edgeRow = findLandingSurface(data, info.width, info.height, info.channels, config.edge_threshold);
          if (edgeRow !== null) {
            landingScreenY = feetY + Math.round(edgeRow / scaleY);
          }
        }
      }
    } catch {
      petWindow.setContentProtection(false);
    }
  }

  const targetWinY = landingScreenY - winH + BODY_PADDING + SPRITE_GROUND_OFFSET;

  if (targetWinY <= winY) {
    config.pet_position = { x: winX, y: winY };
    configManager.save(config);
    petWindow.webContents.send('pet:landed');
    return;
  }

  petWindow.webContents.send('pet:falling');

  cancelGravity = createGravityLoop(
    winY,
    targetWinY,
    (y) => {
      petWindow?.setBounds({ x: winX, y, width: bounds.width, height: bounds.height });
    },
    (y) => {
      cancelGravity = null;
      petWindow?.webContents.send('pet:landed');
      if (stateMachine.state === 'roaring') {
        sendPetState('roaring');
      }
      config.pet_position = { x: winX, y };
      configManager.save(config);
    },
  );
}

function setupIPC() {
  ipcMain.on('pet:state-reached', (_e: Electron.IpcMainEvent, state: string) => {
    if (state === 'roaring') {
      const active = queue.active;
      if (active) {
        showToast(active);
      }
    }
  });

  ipcMain.on('pet:toast-dismissed', () => {
    dismissToast();
  });

  ipcMain.on('pet:clicked', () => {
    hubWindow?.show();
    hubWindow?.focus();
  });

  ipcMain.on('pet:overflow-clicked', () => {
    hubWindow?.show();
    hubWindow?.focus();
  });

  ipcMain.on('pet:dragging', (_e: Electron.IpcMainEvent, dx: number, dy: number) => {
    if (!petWindow) return;
    if (cancelGravity) {
      cancelGravity();
      cancelGravity = null;
    }
    const [x, y] = petWindow.getPosition();
    petWindow.setPosition(x + dx, y + dy);
  });

  ipcMain.on('pet:drag-end', () => {
    if (!petWindow) return;
    if (config.gravity_enabled) {
      captureAndFall();
    } else {
      const [x, y] = petWindow.getPosition();
      config.pet_position = { x, y };
      configManager.save(config);
      petWindow.webContents.send('pet:landed');
    }
  });

  ipcMain.on('set-ignore-mouse-events', (_e: Electron.IpcMainEvent, ignore: boolean, opts?: { forward: boolean }) => {
    petWindow?.setIgnoreMouseEvents(ignore, opts);
  });

  ipcMain.handle('hub:get-notifications', () => {
    return db.getAll();
  });

  ipcMain.handle('hub:get-endpoint-info', () => {
    return { host: config.host, port: config.port };
  });

  ipcMain.handle('hub:delete-notification', (_e: Electron.IpcMainInvokeEvent, id: string) => {
    return db.delete(id);
  });

  ipcMain.handle('hub:clear-history', () => {
    db.clear();
    return true;
  });

  ipcMain.handle('hub:get-config', () => {
    return { gravity_enabled: config.gravity_enabled };
  });

  ipcMain.handle('hub:set-config-value', (_e: Electron.IpcMainInvokeEvent, key: string, value: unknown) => {
    if (key === 'gravity_enabled' && typeof value === 'boolean') {
      config.gravity_enabled = value;
      configManager.save(config);
      return true;
    }
    return false;
  });

  ipcMain.on('hub:quit', () => {
    app.quit();
  });
}

app.on('before-quit', () => { isQuitting = true; });

app.whenReady().then(() => {
  setupIPC();
  createPetWindow();
  createHubWindow();

  httpServer = expressApp.listen(config.port, config.host, () => {
    configManager.writeRuntime({
      host: config.host,
      port: config.port,
      pid: process.pid,
      started_at: new Date().toISOString(),
    });
  });

  resetIdleTimer();
});

app.on('will-quit', () => {
  if (cancelGravity) { cancelGravity(); cancelGravity = null; }
  configManager.removeRuntime();
  httpServer?.close();
  db.close();
  if (idleTimer) clearTimeout(idleTimer);
  if (toastTimer) clearTimeout(toastTimer);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
