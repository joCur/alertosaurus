import { app, BrowserWindow, ipcMain, screen } from 'electron';
import path from 'path';
import { ConfigManager } from './config';
import { NotificationDb } from './db';
import { ToastQueue } from './queue';
import { PetStateMachine } from './state-machine';
import { createApp } from './server';
import http from 'http';

let petWindow: BrowserWindow | null = null;
let hubWindow: BrowserWindow | null = null;

const configManager = new ConfigManager();
const config = configManager.load();
const db = new NotificationDb(path.join(ConfigManager.defaultDir(), 'notifications.db'));
const queue = new ToastQueue();
const stateMachine = new PetStateMachine();

let idleTimer: ReturnType<typeof setTimeout> | null = null;
let toastTimer: ReturnType<typeof setTimeout> | null = null;

function sendPetState(state: string) {
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
    // Toast will be shown when renderer fires 'pet:state-reached' with 'roaring'
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
    e.preventDefault();
    hubWindow?.hide();
  });
}

function setupIPC() {
  ipcMain.on('pet:state-reached', (_e, state: string) => {
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

  ipcMain.on('pet:dragging', (_e, dx: number, dy: number) => {
    if (!petWindow) return;
    const [x, y] = petWindow.getPosition();
    petWindow.setPosition(x + dx, y + dy);
  });

  ipcMain.on('pet:drag-end', () => {
    if (!petWindow) return;
    const [x, y] = petWindow.getPosition();
    const current = configManager.load();
    configManager.save({ ...current, pet_position: { x, y } });
  });

  ipcMain.on('set-ignore-mouse-events', (_e, ignore: boolean, opts?: { forward: boolean }) => {
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
  configManager.removeRuntime();
  httpServer?.close();
  db.close();
  if (idleTimer) clearTimeout(idleTimer);
  if (toastTimer) clearTimeout(toastTimer);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
