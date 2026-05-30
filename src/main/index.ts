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

function createPetWindow() {
  const { x, y } = config.pet_position;

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenW, height: screenH } = primaryDisplay.workAreaSize;
  const safeX = Math.min(Math.max(0, x), screenW - 100);
  const safeY = Math.min(Math.max(0, y), screenH - 100);

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
  const primaryDisplay = screen.getPrimaryDisplay();
  const workArea = primaryDisplay.workArea;
  const displaySize = primaryDisplay.size;
  const screenBottom = workArea.y + workArea.height;

  const feetY = winY + winH - BODY_PADDING - SPRITE_GROUND_OFFSET;
  const stripX = computeScanX(winX);
  const stripHeight = screenBottom - feetY;

  if (stripHeight <= 1) {
    config.pet_position = { x: winX, y: winY };
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

      if (sources.length > 0) {
        const thumbnail = sources[0].thumbnail.toPNG();
        const imgMeta = await sharp(thumbnail).metadata();
        const imgW = imgMeta.width!;
        const imgH = imgMeta.height!;
        const scaleX = imgW / displaySize.width;
        const scaleY = imgH / displaySize.height;

        const cropLeft = Math.round(Math.max(0, Math.min(stripX, displaySize.width - SPRITE_DISPLAY_WIDTH)) * scaleX);
        const cropTop = Math.round(feetY * scaleY);
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

  ipcMain.handle('hub:clear-history', () => {
    db.clear();
    return true;
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
