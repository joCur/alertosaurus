import { app } from 'electron';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';

const SYMLINK_PATH = '/usr/local/bin/roar';

export function getCliBinaryPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app.asar.unpacked', 'dist', 'cli', 'roar');
  }
  return path.join(app.getAppPath(), 'dist', 'cli', 'roar');
}

export function isCliInstalled(): boolean {
  if (process.platform === 'win32') return true;

  try {
    const target = fs.readlinkSync(SYMLINK_PATH);
    return target === getCliBinaryPath() && fs.existsSync(target);
  } catch {
    return false;
  }
}

export function installCli(): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      resolve({ success: true });
      return;
    }

    const binaryPath = getCliBinaryPath();
    if (!fs.existsSync(binaryPath)) {
      resolve({ success: false, error: `CLI binary not found at ${binaryPath}` });
      return;
    }

    const cmd = `mkdir -p /usr/local/bin && ln -sf '${binaryPath}' '${SYMLINK_PATH}' && chmod +x '${binaryPath}'`;

    if (process.platform === 'darwin') {
      const escaped = cmd.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      exec(`osascript -e 'do shell script "${escaped}" with administrator privileges'`, (err) => {
        if (err) {
          resolve({ success: false, error: err.message });
        } else {
          resolve({ success: true });
        }
      });
    } else {
      exec(cmd, (err) => {
        if (!err) {
          resolve({ success: true });
          return;
        }
        exec(`pkexec sh -c "${cmd}"`, (err2) => {
          if (err2) {
            resolve({ success: false, error: err2.message });
          } else {
            resolve({ success: true });
          }
        });
      });
    }
  });
}
