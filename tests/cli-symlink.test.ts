import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

vi.mock('electron', () => ({
  app: { isPackaged: true },
}));

import { ensureCliSymlink } from '../src/main/cli-symlink';

describe('ensureCliSymlink', () => {
  const tmpDir = path.join(os.tmpdir(), `cli-symlink-test-${Date.now()}`);
  const binDir = path.join(tmpDir, 'bin');
  const roarSource = path.join(tmpDir, 'roar');

  beforeEach(() => {
    fs.mkdirSync(binDir, { recursive: true });
    fs.writeFileSync(roarSource, '#!/bin/bash\necho roar', { mode: 0o755 });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates symlink when none exists', () => {
    const linkPath = path.join(binDir, 'roar');
    ensureCliSymlink(roarSource, linkPath);
    expect(fs.lstatSync(linkPath).isSymbolicLink()).toBe(true);
    expect(fs.readlinkSync(linkPath)).toBe(roarSource);
  });

  it('updates symlink when pointing to wrong target', () => {
    const linkPath = path.join(binDir, 'roar');
    fs.symlinkSync('/old/path/roar', linkPath);
    ensureCliSymlink(roarSource, linkPath);
    expect(fs.readlinkSync(linkPath)).toBe(roarSource);
  });

  it('does nothing when symlink already correct', () => {
    const linkPath = path.join(binDir, 'roar');
    fs.symlinkSync(roarSource, linkPath);
    ensureCliSymlink(roarSource, linkPath);
    expect(fs.readlinkSync(linkPath)).toBe(roarSource);
  });

  it('does not throw when target directory is unwritable', () => {
    const linkPath = '/nonexistent/dir/roar';
    expect(() => ensureCliSymlink(roarSource, linkPath)).not.toThrow();
  });
});
