import fs from 'fs';

export function ensureCliSymlink(target: string, linkPath: string): void {
  try {
    const existing = fs.readlinkSync(linkPath);
    if (existing === target) return;
    fs.unlinkSync(linkPath);
  } catch (err: any) {
    if (err.code !== 'ENOENT') {
      try { fs.unlinkSync(linkPath); } catch {}
    }
  }

  try {
    fs.symlinkSync(target, linkPath);
  } catch {
    // Silently fail — user may not have write permission to /usr/local/bin
  }
}
