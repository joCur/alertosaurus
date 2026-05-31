import fs from 'fs';
import path from 'path';
import { ConfigManager } from './config';

const MAX_SIZE = 512 * 1024; // 512 KB
const logPath = path.join(ConfigManager.defaultDir(), 'alertosaurus.log');

function timestamp(): string {
  return new Date().toISOString();
}

function rotateIfNeeded() {
  try {
    const stat = fs.statSync(logPath);
    if (stat.size > MAX_SIZE) {
      const prev = logPath + '.1';
      try { fs.unlinkSync(prev); } catch {}
      fs.renameSync(logPath, prev);
    }
  } catch {}
}

export function log(category: string, message: string) {
  try {
    rotateIfNeeded();
    fs.appendFileSync(logPath, `${timestamp()} [${category}] ${message}\n`);
  } catch {}
}
