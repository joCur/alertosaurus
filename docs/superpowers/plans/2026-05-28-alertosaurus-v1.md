# Alertosaurus v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a desktop notification hub where a pixel-art dinosaur alerts developers when background agents need attention, with an HTTP API and a CLI (`roar`) for sending notifications.

**Architecture:** Electron app with three processes — main (HTTP server + SQLite + queue + state machine), pet renderer (sprite animation + toast speech bubble), hub renderer (notification history). A bundled CLI (`roar`) discovers the running app via a runtime file and POSTs notifications.

**Tech Stack:** Electron, TypeScript, better-sqlite3, Express, express-rate-limit, mri, Vitest, supertest, electron-builder

**Spec:** `docs/superpowers/specs/2026-05-28-alertosaurus-v1-design.md`

**Sprite assets:** `assets/base/` — all frames are 24×24px. idle.png (3 frames, 72×24), bite.png (3 frames, 72×24), jump.png (4 frames, 96×24). Sleep sprite (3 frames, 72×24) to be created. Display scale: 4× (96×96 on screen).

---

## File Map

```
alertosaurus/
├── assets/base/                    ← existing sprite sheets (untouched)
├── src/
│   ├── main/
│   │   ├── index.ts                app entry, window creation, IPC wiring, lifecycle
│   │   ├── server.ts               Express app factory (POST /notify, GET /health)
│   │   ├── db.ts                   NotificationDb class (better-sqlite3 wrapper)
│   │   ├── queue.ts                ToastQueue class (active + pending management)
│   │   ├── state-machine.ts        PetStateMachine class (pure state transitions)
│   │   └── config.ts               Config + RuntimeFile (read/write JSON, platform paths)
│   ├── preload/
│   │   └── index.ts                contextBridge API for both pet and hub renderers
│   ├── pet/
│   │   ├── index.html              pet window markup
│   │   ├── pet.ts                  sprite state switching, drag, click-through, toast render
│   │   └── pet.css                 sprite animation keyframes, toast speech bubble styles
│   ├── hub/
│   │   ├── index.html              hub window markup
│   │   ├── hub.ts                  notification list rendering, actions
│   │   └── hub.css                 hub styles
│   └── shared/
│       └── types.ts                Notification, Config, ToastData interfaces
├── cli/
│   └── index.ts                    roar CLI entry (arg parse, HTTP POST)
├── tests/
│   ├── config.test.ts
│   ├── db.test.ts
│   ├── queue.test.ts
│   ├── state-machine.test.ts
│   ├── server.test.ts
│   └── cli.test.ts
├── package.json
├── tsconfig.json
├── tsconfig.renderer.json
├── vitest.config.ts
├── electron-builder.yml
└── .gitignore
```

---

### Task 1: Project Scaffolding & Shared Types

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.renderer.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `src/shared/types.ts`

- [ ] **Step 1: Initialize project and install dependencies**

```bash
cd /path/to/alertosaurus
npm init -y
npm install electron better-sqlite3 express express-rate-limit mri
npm install -D typescript @types/node @types/express @types/better-sqlite3 vitest supertest @types/supertest electron-builder
```

Then edit `package.json` to set the entry point and scripts:

```json
{
  "name": "alertosaurus",
  "version": "1.0.0",
  "description": "Desktop notification hub with a pixel-art dinosaur",
  "main": "dist/main/index.js",
  "bin": {
    "roar": "./dist/cli/index.js"
  },
  "scripts": {
    "build:main": "tsc -p tsconfig.json",
    "build:renderer": "tsc -p tsconfig.renderer.json",
    "build:copy": "cp src/pet/index.html src/pet/pet.css dist/pet/ && cp src/hub/index.html src/hub/hub.css dist/hub/",
    "build": "npm run build:main && npm run build:renderer && npm run build:copy",
    "start": "npm run build && electron .",
    "test": "vitest run",
    "test:watch": "vitest",
    "dist": "npm run build && electron-builder"
  }
}
```

- [ ] **Step 2: Create tsconfig.json for main process, preload, CLI, and tests**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "declaration": false,
    "sourceMap": true,
    "types": ["node"]
  },
  "include": ["src/main/**/*", "src/preload/**/*", "src/shared/**/*", "cli/**/*"]
}
```

- [ ] **Step 3: Create tsconfig.renderer.json for pet and hub renderers**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "lib": ["ES2022", "DOM"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "skipLibCheck": true,
    "declaration": false,
    "sourceMap": true
  },
  "include": ["src/pet/**/*", "src/hub/**/*"]
}
```

- [ ] **Step 4: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
```

- [ ] **Step 5: Create .gitignore**

```
node_modules/
dist/
*.db
.superpowers/
release/
```

- [ ] **Step 6: Create src/shared/types.ts**

```typescript
export interface Notification {
  id: string;
  caller: string;
  message: string;
  duration_ms: number;
  received_at: string;
}

export interface ToastData {
  id: string;
  caller: string;
  message: string;
  duration_ms: number;
  received_at: string;
}

export interface Config {
  port: number;
  host: string;
  idle_timeout_ms: number;
  pet_position: { x: number; y: number };
}

export interface RuntimeInfo {
  host: string;
  port: number;
  pid: number;
  started_at: string;
}

export const DEFAULT_CONFIG: Config = {
  port: 4174,
  host: '127.0.0.1',
  idle_timeout_ms: 600_000,
  pet_position: { x: 100, y: 100 },
};
```

- [ ] **Step 7: Create directory structure and verify build**

```bash
mkdir -p src/main src/preload src/pet src/hub src/shared cli tests
npm run build:main
```

Expected: compiles with no errors, creates `dist/` with `shared/types.js`.

- [ ] **Step 8: Commit**

```bash
git init
git add package.json tsconfig.json tsconfig.renderer.json vitest.config.ts .gitignore src/shared/types.ts
git commit -m "feat: scaffold project with types, build config, and test setup"
```

---

### Task 2: Config Module (TDD)

**Files:**
- Create: `tests/config.test.ts`
- Create: `src/main/config.ts`

- [ ] **Step 1: Write failing tests for config module**

```typescript
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
    expect(loaded.idle_timeout_ms).toBe(600_000);
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/config.test.ts
```

Expected: FAIL — `ConfigManager` not found.

- [ ] **Step 3: Implement config module**

```typescript
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Config, RuntimeInfo, DEFAULT_CONFIG } from '../shared/types';

export class ConfigManager {
  private readonly configPath: string;
  private readonly runtimePath: string;

  constructor(configDir?: string) {
    const dir = configDir ?? ConfigManager.defaultDir();
    fs.mkdirSync(dir, { recursive: true });
    this.configPath = path.join(dir, 'config.json');
    this.runtimePath = path.join(dir, 'runtime.json');
  }

  static defaultDir(): string {
    switch (process.platform) {
      case 'darwin':
        return path.join(os.homedir(), 'Library', 'Application Support', 'alertosaurus');
      case 'win32':
        return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'alertosaurus');
      default:
        return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'alertosaurus');
    }
  }

  load(): Config {
    try {
      const raw = fs.readFileSync(this.configPath, 'utf-8');
      return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  }

  save(config: Config): void {
    fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
  }

  writeRuntime(info: RuntimeInfo): void {
    fs.writeFileSync(this.runtimePath, JSON.stringify(info, null, 2));
  }

  readRuntime(): RuntimeInfo | null {
    try {
      const raw = fs.readFileSync(this.runtimePath, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  removeRuntime(): void {
    try {
      fs.unlinkSync(this.runtimePath);
    } catch {}
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/config.test.ts
```

Expected: all 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/config.ts tests/config.test.ts
git commit -m "feat: add config module with runtime file support"
```

---

### Task 3: Database Module (TDD)

**Files:**
- Create: `tests/db.test.ts`
- Create: `src/main/db.ts`

- [ ] **Step 1: Write failing tests for database module**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { NotificationDb } from '../src/main/db';

describe('NotificationDb', () => {
  let db: NotificationDb;
  let dbPath: string;

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `alertosaurus-test-${Date.now()}.db`);
    db = new NotificationDb(dbPath);
  });

  afterEach(() => {
    db.close();
    try { fs.unlinkSync(dbPath); } catch {}
  });

  it('inserts a notification and returns id + timestamp', () => {
    const result = db.insert({ caller: 'test', message: 'hello', duration_ms: 5000 });
    expect(result.id).toBeTruthy();
    expect(result.received_at).toBeTruthy();
    expect(new Date(result.received_at).getTime()).not.toBeNaN();
  });

  it('getAll returns notifications in reverse chronological order', () => {
    db.insert({ caller: 'a', message: 'first', duration_ms: 5000 });
    db.insert({ caller: 'b', message: 'second', duration_ms: 5000 });
    db.insert({ caller: 'c', message: 'third', duration_ms: 5000 });

    const all = db.getAll();
    expect(all).toHaveLength(3);
    expect(all[0].caller).toBe('c');
    expect(all[1].caller).toBe('b');
    expect(all[2].caller).toBe('a');
  });

  it('getAll returns full notification objects', () => {
    db.insert({ caller: 'test', message: 'hello world', duration_ms: 3000 });
    const [n] = db.getAll();
    expect(n.id).toBeTruthy();
    expect(n.caller).toBe('test');
    expect(n.message).toBe('hello world');
    expect(n.duration_ms).toBe(3000);
    expect(n.received_at).toBeTruthy();
  });

  it('clear removes all notifications', () => {
    db.insert({ caller: 'a', message: 'one', duration_ms: 5000 });
    db.insert({ caller: 'b', message: 'two', duration_ms: 5000 });
    expect(db.getAll()).toHaveLength(2);

    db.clear();
    expect(db.getAll()).toHaveLength(0);
  });

  it('handles empty database', () => {
    expect(db.getAll()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/db.test.ts
```

Expected: FAIL — `NotificationDb` not found.

- [ ] **Step 3: Implement database module**

```typescript
import Database from 'better-sqlite3';
import crypto from 'crypto';
import { Notification } from '../shared/types';

export class NotificationDb {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS notifications (
        id          TEXT PRIMARY KEY,
        caller      TEXT NOT NULL,
        message     TEXT NOT NULL,
        duration_ms INTEGER NOT NULL DEFAULT 5000,
        received_at TEXT NOT NULL
      )
    `);
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_received_at ON notifications(received_at DESC)
    `);
  }

  insert(data: { caller: string; message: string; duration_ms: number }): { id: string; received_at: string } {
    const id = crypto.randomUUID();
    const received_at = new Date().toISOString();
    this.db.prepare(
      'INSERT INTO notifications (id, caller, message, duration_ms, received_at) VALUES (?, ?, ?, ?, ?)'
    ).run(id, data.caller, data.message, data.duration_ms, received_at);
    return { id, received_at };
  }

  getAll(): Notification[] {
    return this.db.prepare('SELECT * FROM notifications ORDER BY received_at DESC').all() as Notification[];
  }

  clear(): void {
    this.db.exec('DELETE FROM notifications');
  }

  close(): void {
    this.db.close();
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/db.test.ts
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/db.ts tests/db.test.ts
git commit -m "feat: add SQLite notification database module"
```

---

### Task 4: Toast Queue (TDD)

**Files:**
- Create: `tests/queue.test.ts`
- Create: `src/main/queue.ts`

- [ ] **Step 1: Write failing tests for toast queue**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { ToastQueue } from '../src/main/queue';
import { ToastData } from '../src/shared/types';

function makeToast(id: string): ToastData {
  return { id, caller: 'test', message: `msg-${id}`, duration_ms: 5000, received_at: new Date().toISOString() };
}

describe('ToastQueue', () => {
  let queue: ToastQueue;

  beforeEach(() => {
    queue = new ToastQueue(5);
  });

  it('push returns the toast when queue is empty (show immediately)', () => {
    const toast = makeToast('1');
    const result = queue.push(toast);
    expect(result).toEqual(toast);
  });

  it('push returns null when a toast is already active (queued)', () => {
    queue.push(makeToast('1'));
    const result = queue.push(makeToast('2'));
    expect(result).toBeNull();
  });

  it('next returns the next queued toast after dismissal', () => {
    queue.push(makeToast('1'));
    queue.push(makeToast('2'));
    queue.push(makeToast('3'));

    const next = queue.next();
    expect(next).not.toBeNull();
    expect(next!.id).toBe('2');
  });

  it('next returns null when no more queued', () => {
    queue.push(makeToast('1'));
    const next = queue.next();
    expect(next).toBeNull();
  });

  it('tracks pending count', () => {
    queue.push(makeToast('1'));
    expect(queue.pendingCount).toBe(0);

    queue.push(makeToast('2'));
    expect(queue.pendingCount).toBe(1);

    queue.push(makeToast('3'));
    expect(queue.pendingCount).toBe(2);

    queue.next();
    expect(queue.pendingCount).toBe(1);
  });

  it('reports overflow when pending exceeds max', () => {
    queue.push(makeToast('active'));
    for (let i = 1; i <= 5; i++) {
      queue.push(makeToast(`q${i}`));
    }
    expect(queue.pendingCount).toBe(5);
    expect(queue.overflowCount).toBe(0);

    queue.push(makeToast('q6'));
    expect(queue.pendingCount).toBe(6);
    expect(queue.overflowCount).toBe(1);
  });

  it('isActive reflects whether a toast is being shown', () => {
    expect(queue.isActive).toBe(false);
    queue.push(makeToast('1'));
    expect(queue.isActive).toBe(true);
    queue.next();
    expect(queue.isActive).toBe(false);
  });

  it('clear removes everything', () => {
    queue.push(makeToast('1'));
    queue.push(makeToast('2'));
    queue.push(makeToast('3'));
    queue.clear();
    expect(queue.isActive).toBe(false);
    expect(queue.pendingCount).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/queue.test.ts
```

Expected: FAIL — `ToastQueue` not found.

- [ ] **Step 3: Implement toast queue**

```typescript
import { ToastData } from '../shared/types';

export class ToastQueue {
  private pending: ToastData[] = [];
  private _active: ToastData | null = null;
  private readonly maxPending: number;

  constructor(maxPending = 5) {
    this.maxPending = maxPending;
  }

  push(toast: ToastData): ToastData | null {
    if (!this._active) {
      this._active = toast;
      return toast;
    }
    this.pending.push(toast);
    return null;
  }

  next(): ToastData | null {
    if (this.pending.length > 0) {
      this._active = this.pending.shift()!;
      return this._active;
    }
    this._active = null;
    return null;
  }

  get active(): ToastData | null {
    return this._active;
  }

  get isActive(): boolean {
    return this._active !== null;
  }

  get pendingCount(): number {
    return this.pending.length;
  }

  get overflowCount(): number {
    return Math.max(0, this.pending.length - this.maxPending);
  }

  clear(): void {
    this.pending = [];
    this._active = null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/queue.test.ts
```

Expected: all 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/queue.ts tests/queue.test.ts
git commit -m "feat: add toast queue with overflow tracking"
```

---

### Task 5: Pet State Machine (TDD)

**Files:**
- Create: `tests/state-machine.test.ts`
- Create: `src/main/state-machine.ts`

- [ ] **Step 1: Write failing tests for state machine**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { PetStateMachine } from '../src/main/state-machine';

describe('PetStateMachine', () => {
  let sm: PetStateMachine;

  beforeEach(() => {
    sm = new PetStateMachine();
  });

  it('starts in idle state', () => {
    expect(sm.state).toBe('idle');
  });

  it('transitions to happy on notification', () => {
    sm.notificationArrived();
    expect(sm.state).toBe('happy');
  });

  it('transitions happy → talking on happyComplete', () => {
    sm.notificationArrived();
    sm.happyComplete();
    expect(sm.state).toBe('talking');
  });

  it('transitions talking → idle when toast finished with no more queued', () => {
    sm.notificationArrived();
    sm.happyComplete();
    sm.toastFinished(false);
    expect(sm.state).toBe('idle');
  });

  it('stays talking when toast finished but more are queued', () => {
    sm.notificationArrived();
    sm.happyComplete();
    sm.toastFinished(true);
    expect(sm.state).toBe('talking');
  });

  it('transitions idle → sleeping on idle timeout', () => {
    sm.idleTimeout();
    expect(sm.state).toBe('sleeping');
  });

  it('does not sleep if not idle', () => {
    sm.notificationArrived();
    sm.idleTimeout();
    expect(sm.state).toBe('happy');
  });

  it('wakes from sleeping on notification', () => {
    sm.idleTimeout();
    expect(sm.state).toBe('sleeping');
    sm.notificationArrived();
    expect(sm.state).toBe('happy');
  });

  it('stays talking if notification arrives while talking', () => {
    sm.notificationArrived();
    sm.happyComplete();
    expect(sm.state).toBe('talking');
    sm.notificationArrived();
    expect(sm.state).toBe('talking');
  });

  it('full cycle: idle → happy → talking → idle → sleeping → happy → talking → idle', () => {
    expect(sm.state).toBe('idle');
    sm.notificationArrived();
    expect(sm.state).toBe('happy');
    sm.happyComplete();
    expect(sm.state).toBe('talking');
    sm.toastFinished(false);
    expect(sm.state).toBe('idle');
    sm.idleTimeout();
    expect(sm.state).toBe('sleeping');
    sm.notificationArrived();
    expect(sm.state).toBe('happy');
    sm.happyComplete();
    expect(sm.state).toBe('talking');
    sm.toastFinished(false);
    expect(sm.state).toBe('idle');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/state-machine.test.ts
```

Expected: FAIL — `PetStateMachine` not found.

- [ ] **Step 3: Implement state machine**

```typescript
export type PetState = 'idle' | 'happy' | 'talking' | 'sleeping';

export class PetStateMachine {
  private _state: PetState = 'idle';

  get state(): PetState {
    return this._state;
  }

  notificationArrived(): PetState {
    if (this._state !== 'talking') {
      this._state = 'happy';
    }
    return this._state;
  }

  happyComplete(): PetState {
    if (this._state === 'happy') {
      this._state = 'talking';
    }
    return this._state;
  }

  toastFinished(moreQueued: boolean): PetState {
    this._state = moreQueued ? 'talking' : 'idle';
    return this._state;
  }

  idleTimeout(): PetState {
    if (this._state === 'idle') {
      this._state = 'sleeping';
    }
    return this._state;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/state-machine.test.ts
```

Expected: all 10 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/state-machine.ts tests/state-machine.test.ts
git commit -m "feat: add pet state machine with full lifecycle transitions"
```

---

### Task 6: HTTP Server (TDD)

**Files:**
- Create: `tests/server.test.ts`
- Create: `src/main/server.ts`

- [ ] **Step 1: Write failing tests for the HTTP server**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { createApp } from '../src/main/server';
import { NotificationDb } from '../src/main/db';
import { ToastQueue } from '../src/main/queue';

describe('HTTP Server', () => {
  let db: NotificationDb;
  let queue: ToastQueue;
  let app: ReturnType<typeof createApp>;
  let dbPath: string;

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `alertosaurus-server-test-${Date.now()}.db`);
    db = new NotificationDb(dbPath);
    queue = new ToastQueue();
    app = createApp(db, queue);
  });

  afterEach(() => {
    db.close();
    try { fs.unlinkSync(dbPath); } catch {}
  });

  describe('POST /notify', () => {
    it('returns 200 with id and received_at for valid request', async () => {
      const res = await request(app)
        .post('/notify')
        .send({ caller: 'test-agent', message: 'build complete' })
        .expect(200);

      expect(res.body.id).toBeTruthy();
      expect(res.body.received_at).toBeTruthy();
    });

    it('stores notification in database', async () => {
      await request(app)
        .post('/notify')
        .send({ caller: 'agent', message: 'done' });

      const all = db.getAll();
      expect(all).toHaveLength(1);
      expect(all[0].caller).toBe('agent');
      expect(all[0].message).toBe('done');
    });

    it('enqueues toast in queue', async () => {
      await request(app)
        .post('/notify')
        .send({ caller: 'agent', message: 'done' });

      expect(queue.isActive).toBe(true);
    });

    it('uses default duration_ms of 5000', async () => {
      await request(app)
        .post('/notify')
        .send({ caller: 'agent', message: 'done' });

      const all = db.getAll();
      expect(all[0].duration_ms).toBe(5000);
    });

    it('accepts custom duration_ms', async () => {
      await request(app)
        .post('/notify')
        .send({ caller: 'agent', message: 'done', duration_ms: 10000 });

      const all = db.getAll();
      expect(all[0].duration_ms).toBe(10000);
    });

    it('accepts duration_ms of 0 (sticky)', async () => {
      await request(app)
        .post('/notify')
        .send({ caller: 'agent', message: 'stuck', duration_ms: 0 });

      const all = db.getAll();
      expect(all[0].duration_ms).toBe(0);
    });

    it('returns 400 when caller is missing', async () => {
      const res = await request(app)
        .post('/notify')
        .send({ message: 'hello' })
        .expect(400);

      expect(res.body.error).toContain('caller');
    });

    it('returns 400 when message is missing', async () => {
      const res = await request(app)
        .post('/notify')
        .send({ caller: 'test' })
        .expect(400);

      expect(res.body.error).toContain('message');
    });

    it('returns 400 when caller exceeds 64 chars', async () => {
      const res = await request(app)
        .post('/notify')
        .send({ caller: 'x'.repeat(65), message: 'hi' })
        .expect(400);

      expect(res.body.error).toContain('64');
    });

    it('returns 400 when message exceeds 2000 chars', async () => {
      const res = await request(app)
        .post('/notify')
        .send({ caller: 'test', message: 'x'.repeat(2001) })
        .expect(400);

      expect(res.body.error).toContain('2000');
    });

    it('returns 400 when duration_ms exceeds 30000', async () => {
      const res = await request(app)
        .post('/notify')
        .send({ caller: 'test', message: 'hi', duration_ms: 30001 })
        .expect(400);

      expect(res.body.error).toContain('duration_ms');
    });
  });

  describe('GET /health', () => {
    it('returns 200 with status ok', async () => {
      const res = await request(app)
        .get('/health')
        .expect(200);

      expect(res.body.status).toBe('ok');
      expect(res.body.version).toBe('1.0.0');
      expect(typeof res.body.uptime_s).toBe('number');
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/server.test.ts
```

Expected: FAIL — `createApp` not found.

- [ ] **Step 3: Implement HTTP server**

```typescript
import express, { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { NotificationDb } from './db';
import { ToastQueue } from './queue';
import { ToastData } from '../shared/types';

export type NotifyCallback = (toast: ToastData) => void;

export function createApp(db: NotificationDb, queue: ToastQueue, onNotify?: NotifyCallback) {
  const app = express();
  app.use(express.json());

  app.use(rateLimit({
    windowMs: 1000,
    max: 20,
    standardHeaders: false,
    legacyHeaders: false,
    message: { error: 'rate limit exceeded' },
  }));

  app.post('/notify', (req: Request, res: Response) => {
    const { caller, message, duration_ms } = req.body;

    if (!caller || typeof caller !== 'string') {
      res.status(400).json({ error: 'caller is required and must be a string' });
      return;
    }
    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'message is required and must be a string' });
      return;
    }
    if (caller.length > 64) {
      res.status(400).json({ error: 'caller must be 64 characters or fewer' });
      return;
    }
    if (message.length > 2000) {
      res.status(400).json({ error: 'message must be 2000 characters or fewer' });
      return;
    }

    const dur = duration_ms !== undefined ? Number(duration_ms) : 5000;
    if (isNaN(dur) || dur < 0 || dur > 30000) {
      res.status(400).json({ error: 'duration_ms must be between 0 and 30000' });
      return;
    }

    const result = db.insert({ caller, message, duration_ms: dur });
    const toast: ToastData = { ...result, caller, message, duration_ms: dur };
    queue.push(toast);
    onNotify?.(toast);

    res.json({ id: result.id, received_at: result.received_at });
  });

  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      version: '1.0.0',
      uptime_s: Math.floor(process.uptime()),
    });
  });

  return app;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/server.test.ts
```

Expected: all 12 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/server.ts tests/server.test.ts
git commit -m "feat: add HTTP server with /notify and /health endpoints"
```

---

### Task 7: Electron Shell & IPC

**Files:**
- Create: `src/main/index.ts`
- Create: `src/preload/index.ts`

This task wires together all the backend modules (config, db, queue, state machine, server) inside the Electron main process, creates the two windows, and sets up IPC channels. No automated tests — verify manually by launching the app.

- [ ] **Step 1: Create the preload script**

```typescript
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('alertosaurus', {
  onSetState: (cb: (state: string) => void) => {
    ipcRenderer.on('pet:set-state', (_e, state) => cb(state));
  },
  onShowToast: (cb: (data: { caller: string; message: string; duration_ms: number; received_at: string }) => void) => {
    ipcRenderer.on('pet:show-toast', (_e, data) => cb(data));
  },
  onHideToast: (cb: () => void) => {
    ipcRenderer.on('pet:hide-toast', () => cb());
  },
  onShowOverflow: (cb: (count: number) => void) => {
    ipcRenderer.on('pet:show-overflow', (_e, count) => cb(count));
  },
  toastDismissed: () => ipcRenderer.send('pet:toast-dismissed'),
  animationComplete: () => ipcRenderer.send('pet:animation-complete'),
  petClicked: () => ipcRenderer.send('pet:clicked'),
  overflowClicked: () => ipcRenderer.send('pet:overflow-clicked'),
  dragging: (dx: number, dy: number) => ipcRenderer.send('pet:dragging', dx, dy),
  dragEnd: () => ipcRenderer.send('pet:drag-end'),
  setIgnoreMouseEvents: (ignore: boolean, opts?: { forward: boolean }) =>
    ipcRenderer.send('set-ignore-mouse-events', ignore, opts),

  getNotifications: () => ipcRenderer.invoke('hub:get-notifications'),
  getEndpointInfo: () => ipcRenderer.invoke('hub:get-endpoint-info'),
  clearHistory: () => ipcRenderer.invoke('hub:clear-history'),
  quit: () => ipcRenderer.send('hub:quit'),
  onNotificationsUpdated: (cb: () => void) => {
    ipcRenderer.on('hub:updated', () => cb());
  },
});
```

- [ ] **Step 2: Create the main process entry point**

```typescript
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

function resetIdleTimer() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    const state = stateMachine.idleTimeout();
    petWindow?.webContents.send('pet:set-state', state);
  }, config.idle_timeout_ms);
}

function showToast(toast: { caller: string; message: string; duration_ms: number; received_at: string }) {
  petWindow?.webContents.send('pet:show-toast', toast);
  petWindow?.webContents.send('pet:set-state', 'talking');

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
    const state = stateMachine.toastFinished(true);
    petWindow?.webContents.send('pet:set-state', state);
    showToast(next);

    if (queue.overflowCount > 0) {
      petWindow?.webContents.send('pet:show-overflow', queue.overflowCount);
    }
  } else {
    const state = stateMachine.toastFinished(false);
    petWindow?.webContents.send('pet:set-state', state);
    resetIdleTimer();
  }

  hubWindow?.webContents.send('hub:updated');
}

function onNotify(toast: { caller: string; message: string; duration_ms: number; received_at: string; id: string }) {
  if (idleTimer) clearTimeout(idleTimer);

  const state = stateMachine.notificationArrived();

  if (state === 'happy') {
    petWindow?.webContents.send('pet:set-state', state);
    // Renderer plays happy animation, then sends 'pet:animation-complete'
    // which triggers happyComplete() → talking → showToast(queue.active)
  }
  // If state is 'talking', the toast is queued — it will be shown
  // when the current toast finishes via dismissToast() → queue.next()

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
    height: 220,
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
  ipcMain.on('pet:animation-complete', () => {
    stateMachine.happyComplete();
    const active = queue.active;
    if (active) {
      showToast(active);
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
```

- [ ] **Step 3: Build and run the app to verify it launches**

```bash
npm run build:main
npx electron .
```

Expected: app launches (windows may be blank since renderers aren't built yet), no crashes. The HTTP server should be listening — test with:

```bash
curl http://127.0.0.1:4174/health
```

Expected: `{"status":"ok","version":"1.0.0","uptime_s":...}`

- [ ] **Step 4: Commit**

```bash
git add src/main/index.ts src/preload/index.ts
git commit -m "feat: add Electron main process with IPC, windows, and server lifecycle"
```

---

### Task 8: Pet Renderer

**Files:**
- Create: `src/pet/index.html`
- Create: `src/pet/pet.css`
- Create: `src/pet/pet.ts`

No automated tests — this is UI code. Verify manually.

- [ ] **Step 1: Create pet renderer HTML**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="pet.css">
</head>
<body>
  <div id="toast-container" class="hidden">
    <div id="toast">
      <div id="toast-caller"></div>
      <div id="toast-message"></div>
      <div id="toast-time"></div>
    </div>
    <div id="toast-pointer"></div>
  </div>
  <div id="overflow" class="hidden"></div>
  <div id="sprite" data-state="idle"></div>
  <script type="module" src="pet.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create pet renderer CSS**

Sprite frames are 24×24px. Display at 4× scale = 96×96px.

```css
* { margin: 0; padding: 0; box-sizing: border-box; }

html, body {
  background: transparent;
  overflow: hidden;
  user-select: none;
  -webkit-app-region: no-drag;
}

body {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  height: 100vh;
  padding-bottom: 8px;
}

#sprite {
  width: 96px;
  height: 96px;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
  background-repeat: no-repeat;
  cursor: pointer;
  position: relative;
  z-index: 1;
}

#sprite[data-state="idle"] {
  background-image: url('../../assets/base/idle.png');
  background-size: 288px 96px;
  animation: frames-3 0.6s steps(3) infinite;
}

#sprite[data-state="talking"] {
  background-image: url('../../assets/base/bite.png');
  background-size: 288px 96px;
  animation: frames-3 0.4s steps(3) infinite;
}

#sprite[data-state="happy"] {
  background-image: url('../../assets/base/jump.png');
  background-size: 384px 96px;
  animation: frames-4 0.6s steps(4) 1;
}

#sprite[data-state="sleeping"] {
  background-image: url('../../assets/base/sleep.png');
  background-size: 288px 96px;
  animation: frames-3 1.5s steps(3) infinite;
}

@keyframes frames-3 {
  to { background-position: -288px 0; }
}

@keyframes frames-4 {
  to { background-position: -384px 0; }
}

/* Toast speech bubble */
#toast-container {
  position: relative;
  margin-bottom: 4px;
  z-index: 2;
}

#toast-container.hidden {
  display: none;
}

#toast {
  background: #1e1e2e;
  border: 2px solid #45475a;
  border-radius: 10px;
  padding: 10px 14px;
  color: #cdd6f4;
  font-family: 'SF Mono', 'Consolas', 'Courier New', monospace;
  font-size: 12px;
  min-width: 160px;
  max-width: 260px;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

#toast-pointer {
  width: 0;
  height: 0;
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
  border-top: 8px solid #45475a;
  margin: 0 auto;
  position: relative;
}

#toast-pointer::after {
  content: '';
  position: absolute;
  top: -10px;
  left: -6px;
  width: 0;
  height: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-top: 6px solid #1e1e2e;
}

#toast-caller {
  font-weight: bold;
  color: #f9e2af;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

#toast-message {
  color: #cdd6f4;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

#toast-time {
  color: #6c7086;
  font-size: 10px;
  margin-top: 4px;
}

#overflow {
  background: #45475a;
  color: #cdd6f4;
  font-family: 'SF Mono', 'Consolas', monospace;
  font-size: 11px;
  padding: 4px 10px;
  border-radius: 10px;
  cursor: pointer;
  margin-bottom: 4px;
  text-align: center;
}

#overflow.hidden {
  display: none;
}
```

- [ ] **Step 3: Create pet renderer script**

```typescript
const sprite = document.getElementById('sprite')!;
const toastContainer = document.getElementById('toast-container')!;
const toastCaller = document.getElementById('toast-caller')!;
const toastMessage = document.getElementById('toast-message')!;
const toastTime = document.getElementById('toast-time')!;
const overflow = document.getElementById('overflow')!;

const api = (window as any).alertosaurus;

// --- State management ---

api.onSetState((state: string) => {
  sprite.dataset.state = state;
});

sprite.addEventListener('animationend', () => {
  if (sprite.dataset.state === 'happy') {
    api.animationComplete();
  }
});

// --- Toast ---

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

api.onShowToast((data: { caller: string; message: string; received_at: string }) => {
  toastCaller.textContent = data.caller;
  toastMessage.textContent = data.message;
  toastTime.textContent = relativeTime(data.received_at);
  toastContainer.classList.remove('hidden');
});

api.onHideToast(() => {
  toastContainer.classList.add('hidden');
});

toastContainer.addEventListener('click', () => {
  toastContainer.classList.add('hidden');
  api.toastDismissed();
});

// --- Overflow ---

api.onShowOverflow((count: number) => {
  overflow.textContent = `+${count} more`;
  overflow.classList.remove('hidden');
});

api.onHideToast(() => {
  overflow.classList.add('hidden');
});

overflow.addEventListener('click', () => {
  api.overflowClicked();
});

// --- Click-through ---

document.addEventListener('mousemove', (e) => {
  const el = document.elementFromPoint(e.clientX, e.clientY);
  if (el && (el.closest('#sprite') || el.closest('#toast-container') || el.closest('#overflow'))) {
    api.setIgnoreMouseEvents(false);
  } else {
    api.setIgnoreMouseEvents(true, { forward: true });
  }
});

// --- Drag ---

let isDragging = false;
let lastScreenX = 0;
let lastScreenY = 0;

sprite.addEventListener('mousedown', (e) => {
  isDragging = true;
  lastScreenX = e.screenX;
  lastScreenY = e.screenY;
  api.setIgnoreMouseEvents(false);
  e.preventDefault();
});

document.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  const dx = e.screenX - lastScreenX;
  const dy = e.screenY - lastScreenY;
  lastScreenX = e.screenX;
  lastScreenY = e.screenY;
  api.dragging(dx, dy);
});

document.addEventListener('mouseup', () => {
  if (!isDragging) return;
  isDragging = false;
  api.dragEnd();
});

// --- Pet click (open hub) ---

sprite.addEventListener('click', (e) => {
  if (isDragging) return;
  if (!toastContainer.classList.contains('hidden')) return;
  api.petClicked();
});
```

- [ ] **Step 4: Build and test the pet renderer**

```bash
npm run build
npx electron .
```

Expected: the app launches with the dinosaur sprite visible. It should be animating (idle breathing). Test by sending a notification:

```bash
curl -X POST http://127.0.0.1:4174/notify \
  -H 'Content-Type: application/json' \
  -d '{"caller":"test","message":"hello from curl"}'
```

Expected: the dinosaur plays the happy animation, then shows a speech bubble with "test" and "hello from curl." The bubble disappears after 5 seconds.

- [ ] **Step 5: Commit**

```bash
git add src/pet/
git commit -m "feat: add pet renderer with sprite animation, toast, and drag"
```

---

### Task 9: Hub Renderer

**Files:**
- Create: `src/hub/index.html`
- Create: `src/hub/hub.css`
- Create: `src/hub/hub.ts`

- [ ] **Step 1: Create hub window HTML**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="hub.css">
</head>
<body>
  <header>
    <h1>Alertosaurus</h1>
    <div id="endpoint-info"></div>
  </header>
  <main>
    <div id="notification-list"></div>
    <div id="empty-state" class="hidden">No notifications yet. Send one with <code>roar "hello"</code></div>
  </main>
  <footer>
    <button id="clear-btn">Clear History</button>
    <button id="quit-btn">Quit</button>
  </footer>
  <script type="module" src="hub.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create hub CSS**

```css
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  background: #1e1e2e;
  color: #cdd6f4;
  display: flex;
  flex-direction: column;
  height: 100vh;
}

header {
  padding: 16px 20px;
  border-bottom: 1px solid #313244;
}

header h1 {
  font-size: 18px;
  color: #f9e2af;
  margin-bottom: 4px;
}

#endpoint-info {
  font-size: 12px;
  color: #6c7086;
  font-family: 'SF Mono', 'Consolas', monospace;
}

main {
  flex: 1;
  overflow-y: auto;
  padding: 0;
}

#empty-state {
  text-align: center;
  color: #6c7086;
  padding: 40px 20px;
  font-size: 14px;
}

#empty-state.hidden { display: none; }

#empty-state code {
  background: #313244;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'SF Mono', 'Consolas', monospace;
}

.day-group {
  padding: 0 20px;
}

.day-label {
  font-size: 11px;
  color: #6c7086;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 12px 0 6px;
  border-bottom: 1px solid #313244;
  position: sticky;
  top: 0;
  background: #1e1e2e;
}

.notification-row {
  padding: 10px 0;
  border-bottom: 1px solid #181825;
  display: flex;
  gap: 12px;
  align-items: baseline;
}

.notification-caller {
  font-weight: 600;
  color: #f9e2af;
  font-size: 13px;
  min-width: 100px;
  flex-shrink: 0;
}

.notification-message {
  flex: 1;
  font-size: 13px;
  color: #cdd6f4;
  word-break: break-word;
}

.notification-time {
  font-size: 11px;
  color: #6c7086;
  white-space: nowrap;
  flex-shrink: 0;
}

footer {
  padding: 12px 20px;
  border-top: 1px solid #313244;
  display: flex;
  justify-content: space-between;
}

footer button {
  background: #313244;
  border: 1px solid #45475a;
  color: #cdd6f4;
  padding: 6px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}

footer button:hover {
  background: #45475a;
}

#quit-btn {
  color: #f38ba8;
  border-color: #f38ba8;
}

#quit-btn:hover {
  background: #f38ba8;
  color: #1e1e2e;
}
```

- [ ] **Step 3: Create hub renderer script**

```typescript
const api = (window as any).alertosaurus;
const listEl = document.getElementById('notification-list')!;
const emptyEl = document.getElementById('empty-state')!;
const endpointEl = document.getElementById('endpoint-info')!;
const clearBtn = document.getElementById('clear-btn')!;
const quitBtn = document.getElementById('quit-btn')!;

interface Notification {
  id: string;
  caller: string;
  message: string;
  duration_ms: number;
  received_at: string;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDay(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

function render(notifications: Notification[]) {
  listEl.innerHTML = '';

  if (notifications.length === 0) {
    emptyEl.classList.remove('hidden');
    return;
  }

  emptyEl.classList.add('hidden');

  const grouped = new Map<string, Notification[]>();
  for (const n of notifications) {
    const day = new Date(n.received_at).toDateString();
    if (!grouped.has(day)) grouped.set(day, []);
    grouped.get(day)!.push(n);
  }

  for (const [_day, items] of grouped) {
    const group = document.createElement('div');
    group.className = 'day-group';

    const label = document.createElement('div');
    label.className = 'day-label';
    label.textContent = formatDay(items[0].received_at);
    group.appendChild(label);

    for (const n of items) {
      const row = document.createElement('div');
      row.className = 'notification-row';
      row.innerHTML = `
        <span class="notification-caller">${escapeHtml(n.caller)}</span>
        <span class="notification-message">${escapeHtml(n.message)}</span>
        <span class="notification-time">${formatTime(n.received_at)}</span>
      `;
      group.appendChild(row);
    }

    listEl.appendChild(group);
  }
}

function escapeHtml(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

async function loadNotifications() {
  const notifications = await api.getNotifications();
  render(notifications);
}

async function loadEndpoint() {
  const info = await api.getEndpointInfo();
  endpointEl.textContent = `Listening on ${info.host}:${info.port}`;
}

clearBtn.addEventListener('click', async () => {
  if (!confirm('Clear all notification history?')) return;
  await api.clearHistory();
  await loadNotifications();
});

quitBtn.addEventListener('click', () => {
  api.quit();
});

api.onNotificationsUpdated(() => {
  loadNotifications();
});

loadNotifications();
loadEndpoint();
```

- [ ] **Step 4: Build and test the hub**

```bash
npm run build
npx electron .
```

Send a few notifications, then click the dinosaur to open the hub.

```bash
curl -X POST http://127.0.0.1:4174/notify -H 'Content-Type: application/json' -d '{"caller":"agent-1","message":"build complete"}'
curl -X POST http://127.0.0.1:4174/notify -H 'Content-Type: application/json' -d '{"caller":"agent-2","message":"tests passed, 42 specs"}'
curl -X POST http://127.0.0.1:4174/notify -H 'Content-Type: application/json' -d '{"caller":"deploy","message":"deployed to staging"}'
```

Expected: clicking the dino opens the hub window showing all 3 notifications with callers, messages, and timestamps, grouped under "Today."

- [ ] **Step 5: Commit**

```bash
git add src/hub/
git commit -m "feat: add hub renderer with notification history and day grouping"
```

---

### Task 10: CLI — roar (TDD)

**Files:**
- Create: `tests/cli.test.ts`
- Create: `cli/index.ts`

- [ ] **Step 1: Write failing tests for CLI arg parsing and runtime file reading**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { parseArgs, readRuntimeFile } from '../cli/index';

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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/cli.test.ts
```

Expected: FAIL — `parseArgs` and `readRuntimeFile` not found.

- [ ] **Step 3: Implement CLI**

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/cli.test.ts
```

Expected: all 7 tests PASS.

- [ ] **Step 5: Build and manually test the CLI**

With the Electron app running:

```bash
npm run build
node dist/cli/index.js "hello from roar"
node dist/cli/index.js --from "test-agent" "build finished"
node dist/cli/index.js --from "deploy" --duration 0 "needs approval"
```

Expected: each command exits 0, and the dinosaur shows a toast for each message. The sticky message (duration 0) stays until clicked.

- [ ] **Step 6: Commit**

```bash
git add cli/ tests/cli.test.ts
git commit -m "feat: add roar CLI for sending notifications"
```

---

### Task 11: Build Configuration & Acceptance Testing

**Files:**
- Create: `electron-builder.yml`

- [ ] **Step 1: Create electron-builder config**

```yaml
appId: com.alertosaurus.app
productName: Alertosaurus
directories:
  output: release

mac:
  target: dmg
  category: public.app-category.developer-tools

linux:
  target:
    - AppImage
    - deb
  category: Development

win:
  target: nsis

files:
  - dist/**/*
  - assets/**/*
  - "!**/*.ts"
  - "!tests/**"

extraMetadata:
  main: dist/main/index.js
```

- [ ] **Step 2: Run the full test suite**

```bash
npx vitest run
```

Expected: all tests pass (config: 7, db: 5, queue: 8, state-machine: 10, server: 12, cli: 7 = ~49 tests total).

- [ ] **Step 3: Run acceptance criteria manually**

Launch the app:
```bash
npm run build && npx electron .
```

**Criterion 1:** App launches, dinosaur appears and is idle. ✓/✗

**Criterion 2:** Send a notification:
```bash
node dist/cli/index.js --from "test" "hello"
```
Dinosaur reacts within ~200ms, speech bubble appears, disappears after 5s. ✓/✗

**Criterion 3:** Send 10 notifications in a loop:
```bash
for i in $(seq 1 10); do node dist/cli/index.js --from "loop" "message $i"; done
```
They queue and play through; none are lost. ✓/✗

**Criterion 4:** Click the dinosaur. Hub opens with all 11 messages in reverse chronological order. ✓/✗

**Criterion 5:** Quit and relaunch. History persists. Dinosaur reappears at last position. ✓/✗

**Criterion 6:** (Optional — requires rebinding to 0.0.0.0 in config.json):
```bash
curl -X POST http://<host>:4174/notify -H 'Content-Type: application/json' -d '{"caller":"remote","message":"from LAN"}'
```
Toast appears on the desktop. ✓/✗

- [ ] **Step 4: Commit**

```bash
git add electron-builder.yml
git commit -m "feat: add electron-builder config and complete v1 acceptance"
```

---

## Open Items (not blocking v1)

- **Sleep sprite creation:** `assets/base/sleep.png` needs to be created (3 frames at 24×24, matching existing art style). Until created, the sleeping state will show a broken image. A placeholder can be created by duplicating `idle.png` as `sleep.png`.
- **CLI distribution in production builds:** The `roar` binary is available via `node dist/cli/index.js` during development. For packaged builds, a symlink or shell shim needs to be created during installation. This is a packaging concern for post-v1.
- **Rate limit testing:** The rate limit test is omitted from the automated suite because `express-rate-limit` state carries across tests. It can be verified manually by sending 21 rapid requests.
