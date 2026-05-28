#!/usr/bin/env node

import mri from 'mri';
import path from 'path';
import fs from 'fs';
import os from 'os';
import http from 'http';

export interface ParsedArgs {
  from: string;
  message: string | null;
  duration: number | undefined;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const args = mri(argv, {
    string: ['from'],
    default: {
      from: path.basename(process.cwd()),
    },
  });

  return {
    from: args.from,
    message: args._.length > 0 ? args._.join(' ') : null,
    duration: args.duration !== undefined ? Number(args.duration) : undefined,
  };
}

export interface RuntimeInfo {
  host: string;
  port: number;
  pid: number;
  started_at: string;
}

export function readRuntimeFile(filePath: string): RuntimeInfo | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getDefaultRuntimePath(): string {
  switch (process.platform) {
    case 'darwin':
      return path.join(os.homedir(), 'Library', 'Application Support', 'alertosaurus', 'runtime.json');
    case 'win32':
      return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'alertosaurus', 'runtime.json');
    default:
      return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'alertosaurus', 'runtime.json');
  }
}

function post(host: string, port: number, body: object): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request({
      hostname: host,
      port,
      path: '/notify',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      timeout: 3000,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode!, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode!, data }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(payload);
    req.end();
  });
}

function healthCheck(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get({ hostname: host, port, path: '/health', timeout: 2000 }, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

const NOT_RUNNING = 'alertosaurus is not running. Start it with: alertosaurus';

async function main() {
  const parsed = parseArgs(process.argv.slice(2));

  if (!parsed.message) {
    console.error('Usage: roar [--from <name>] [--duration <ms>] <message>');
    process.exit(1);
  }

  const runtime = readRuntimeFile(getDefaultRuntimePath());
  if (!runtime) {
    console.error(NOT_RUNNING);
    process.exit(1);
  }

  const healthy = await healthCheck(runtime.host, runtime.port);
  if (!healthy) {
    console.error(NOT_RUNNING);
    process.exit(1);
  }

  const body: Record<string, unknown> = {
    caller: parsed.from,
    message: parsed.message,
  };
  if (parsed.duration !== undefined) {
    body.duration_ms = parsed.duration;
  }

  try {
    const { status, data } = await post(runtime.host, runtime.port, body);
    if (status === 200) {
      process.exit(0);
    } else {
      console.error(data.error || `Server returned ${status}`);
      process.exit(1);
    }
  } catch (err: any) {
    console.error(`Failed to reach alertosaurus: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
