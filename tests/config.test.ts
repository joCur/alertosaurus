import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { ConfigManager } from '../src/main/config';
import { DEFAULT_CONFIG } from '../src/shared/types';

describe('ConfigManager', () => {
  let tmpDir: string;
  let manager: ConfigManager;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'alertosaurus-test-'));
    manager = new ConfigManager(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns default config when no file exists', () => {
    const config = manager.load();
    expect(config).toEqual(DEFAULT_CONFIG);
  });

  it('includes gravity defaults', () => {
    const config = manager.load();
    expect(config.gravity_enabled).toBe(true);
    expect(config.edge_threshold).toBe(30);
  });

  it('saves and loads config', () => {
    const config = { ...DEFAULT_CONFIG, port: 9999 };
    manager.save(config);
    const loaded = manager.load();
    expect(loaded.port).toBe(9999);
  });

  it('merges partial saves with defaults', () => {
    manager.save({ ...DEFAULT_CONFIG, port: 8080 });
    const loaded = manager.load();
    expect(loaded.port).toBe(8080);
    expect(loaded.host).toBe('127.0.0.1');
    expect(loaded.idle_timeout_ms).toBe(30_000);
  });

  it('writes runtime file', () => {
    manager.writeRuntime({ host: '127.0.0.1', port: 4174, pid: 12345, started_at: '2026-01-01T00:00:00Z' });
    const runtimePath = path.join(tmpDir, 'runtime.json');
    expect(fs.existsSync(runtimePath)).toBe(true);
    const data = JSON.parse(fs.readFileSync(runtimePath, 'utf-8'));
    expect(data.port).toBe(4174);
    expect(data.pid).toBe(12345);
  });

  it('removes runtime file', () => {
    manager.writeRuntime({ host: '127.0.0.1', port: 4174, pid: 12345, started_at: '2026-01-01T00:00:00Z' });
    manager.removeRuntime();
    const runtimePath = path.join(tmpDir, 'runtime.json');
    expect(fs.existsSync(runtimePath)).toBe(false);
  });

  it('removeRuntime does not throw if file missing', () => {
    expect(() => manager.removeRuntime()).not.toThrow();
  });

  it('readRuntime returns null if no runtime file', () => {
    expect(manager.readRuntime()).toBeNull();
  });

  it('readRuntime returns data if runtime file exists', () => {
    manager.writeRuntime({ host: '127.0.0.1', port: 4174, pid: 99, started_at: '2026-01-01T00:00:00Z' });
    const info = manager.readRuntime();
    expect(info).not.toBeNull();
    expect(info!.pid).toBe(99);
  });
});
