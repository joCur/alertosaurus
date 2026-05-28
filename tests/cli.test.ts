import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { parseArgs, readRuntimeFile } from '../src/cli/index';

describe('CLI', () => {
  describe('parseArgs', () => {
    it('parses message as positional argument', () => {
      const result = parseArgs(['agent finished']);
      expect(result.message).toBe('agent finished');
    });

    it('parses --from flag', () => {
      const result = parseArgs(['--from', 'refactor-agent', 'done']);
      expect(result.from).toBe('refactor-agent');
      expect(result.message).toBe('done');
    });

    it('parses --duration flag', () => {
      const result = parseArgs(['--duration', '10000', 'tests failed']);
      expect(result.duration).toBe(10000);
      expect(result.message).toBe('tests failed');
    });

    it('parses all flags together', () => {
      const result = parseArgs(['--from', 'deploy', '--duration', '0', 'stuck']);
      expect(result.from).toBe('deploy');
      expect(result.duration).toBe(0);
      expect(result.message).toBe('stuck');
    });

    it('returns null message when no positional args', () => {
      const result = parseArgs([]);
      expect(result.message).toBeNull();
    });

    it('defaults from to cwd basename', () => {
      const result = parseArgs(['hello']);
      expect(result.from).toBe(path.basename(process.cwd()));
    });
  });

  describe('readRuntimeFile', () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'roar-test-'));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('returns runtime info when file exists', () => {
      const runtimePath = path.join(tmpDir, 'runtime.json');
      fs.writeFileSync(runtimePath, JSON.stringify({ host: '127.0.0.1', port: 4174, pid: 1, started_at: '' }));
      const info = readRuntimeFile(runtimePath);
      expect(info).not.toBeNull();
      expect(info!.port).toBe(4174);
    });

    it('returns null when file does not exist', () => {
      const info = readRuntimeFile(path.join(tmpDir, 'nope.json'));
      expect(info).toBeNull();
    });
  });
});
