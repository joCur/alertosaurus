# Auto-Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add automatic update support to Alertosaurus across macOS, Windows, and Linux using `electron-updater` with GitHub Releases, announced via dino toast.

**Architecture:** A new `src/main/updater.ts` module wraps `electron-updater`, checks for updates every 30 minutes, and invokes a callback when an update is downloaded. The main process sends an IPC event to the pet renderer which shows an update-specific toast. The macOS build target switches from `pkg` to `dmg`+`zip` to support auto-update, with CLI symlink creation moved into the app itself.

**Tech Stack:** electron-updater, electron-builder (existing), Electron IPC (existing), Vitest (existing)

---

### Task 1: Install electron-updater and update build config

**Files:**
- Modify: `package.json` (add dependency)
- Modify: `electron-builder.yml` (change mac target, add publish config, remove pkg section)
- Delete: `build/pkg-scripts/postinstall`

- [ ] **Step 1: Install electron-updater**

```bash
npm install electron-updater
```

- [ ] **Step 2: Update electron-builder.yml**

Replace the entire file with:

```yaml
appId: com.alertosaurus.app
productName: Alertosaurus
directories:
  output: release

asarUnpack:
  - "**/node_modules/better-sqlite3/**"
  - "**/node_modules/sharp/**"
  - "**/node_modules/@img/**"
  - "dist/cli/**/*"

publish:
  provider: github
  owner: joCur
  repo: alertosaurus

mac:
  target:
    - dmg
    - zip
  category: public.app-category.developer-tools

linux:
  target:
    - AppImage
    - deb
  category: Development
  executableName: alertosaurus

deb:
  afterInstall: build/linux-after-install.sh
  afterRemove: build/linux-after-remove.sh

win:
  target: nsis

nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  include: build/installer.nsh

files:
  - dist/**/*
  - assets/**/*
  - "!**/*.ts"
  - "!tests/**"

extraMetadata:
  main: dist/main/index.js
```

Key changes from original: removed `pkg` and `pkg:` sections, changed `mac.target` from `pkg` to `[dmg, zip]`, added top-level `publish` block.

- [ ] **Step 3: Delete pkg-scripts directory**

```bash
rm -rf build/pkg-scripts
```

- [ ] **Step 4: Verify build still works**

```bash
npm run build
```

Expected: clean build, no errors.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json electron-builder.yml
git rm -r build/pkg-scripts
git commit -m "feat: switch to electron-updater with dmg+zip on macOS

- Add electron-updater dependency
- Change macOS target from pkg to dmg+zip for auto-update support
- Add GitHub Releases publish config
- Remove pkg-scripts (symlink handled at app startup)"
```

---

### Task 2: Create the auto-updater module with tests

**Files:**
- Create: `src/main/updater.ts`
- Create: `tests/updater.test.ts`

- [ ] **Step 1: Write the test file**

Create `tests/updater.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockAutoUpdater = {
  autoDownload: false,
  autoInstallOnAppQuit: false,
  on: vi.fn(),
  checkForUpdates: vi.fn(),
  quitAndInstall: vi.fn(),
};

vi.mock('electron-updater', () => ({
  autoUpdater: mockAutoUpdater,
}));

vi.mock('electron', () => ({
  app: { isPackaged: true },
}));

import { initAutoUpdater, installUpdate } from '../src/main/updater';

describe('updater', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockAutoUpdater.autoDownload = false;
    mockAutoUpdater.autoInstallOnAppQuit = false;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('configures autoUpdater settings', () => {
    initAutoUpdater(vi.fn());
    expect(mockAutoUpdater.autoDownload).toBe(true);
    expect(mockAutoUpdater.autoInstallOnAppQuit).toBe(true);
  });

  it('checks for updates immediately on init', () => {
    initAutoUpdater(vi.fn());
    expect(mockAutoUpdater.checkForUpdates).toHaveBeenCalledTimes(1);
  });

  it('checks for updates every 30 minutes', () => {
    initAutoUpdater(vi.fn());
    mockAutoUpdater.checkForUpdates.mockClear();

    vi.advanceTimersByTime(30 * 60 * 1000);
    expect(mockAutoUpdater.checkForUpdates).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(30 * 60 * 1000);
    expect(mockAutoUpdater.checkForUpdates).toHaveBeenCalledTimes(2);
  });

  it('registers event listeners for update-available, update-downloaded, and error', () => {
    initAutoUpdater(vi.fn());
    const events = mockAutoUpdater.on.mock.calls.map((c: any[]) => c[0]);
    expect(events).toContain('update-downloaded');
    expect(events).toContain('error');
  });

  it('calls onUpdateReady with version when update is downloaded', () => {
    const onUpdateReady = vi.fn();
    initAutoUpdater(onUpdateReady);

    const downloadedHandler = mockAutoUpdater.on.mock.calls.find(
      (c: any[]) => c[0] === 'update-downloaded'
    )![1];

    downloadedHandler({ version: '2.0.0' });
    expect(onUpdateReady).toHaveBeenCalledWith('2.0.0');
  });

  it('does not throw when error event fires', () => {
    initAutoUpdater(vi.fn());

    const errorHandler = mockAutoUpdater.on.mock.calls.find(
      (c: any[]) => c[0] === 'error'
    )![1];

    expect(() => errorHandler(new Error('network error'))).not.toThrow();
  });

  it('installUpdate calls quitAndInstall', () => {
    installUpdate();
    expect(mockAutoUpdater.quitAndInstall).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/updater.test.ts
```

Expected: FAIL — `../src/main/updater` module does not exist.

- [ ] **Step 3: Write the updater module**

Create `src/main/updater.ts`:

```typescript
import { app } from 'electron';
import { autoUpdater } from 'electron-updater';

const CHECK_INTERVAL_MS = 30 * 60 * 1000;

export function initAutoUpdater(onUpdateReady: (version: string) => void): void {
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-downloaded', (info) => {
    onUpdateReady(info.version);
  });

  autoUpdater.on('error', (err) => {
    console.error('Auto-update error:', err.message);
  });

  autoUpdater.checkForUpdates();
  setInterval(() => autoUpdater.checkForUpdates(), CHECK_INTERVAL_MS);
}

export function installUpdate(): void {
  autoUpdater.quitAndInstall();
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/updater.test.ts
```

Expected: all 7 tests PASS.

- [ ] **Step 5: Run the full test suite to check for regressions**

```bash
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/main/updater.ts tests/updater.test.ts
git commit -m "feat: add auto-updater module with 30-min check interval

Wraps electron-updater with a simple init/install API.
Checks for updates immediately and every 30 minutes.
Skips update checks in dev mode."
```

---

### Task 3: Add preload bridge for update IPC

**Files:**
- Modify: `src/preload/index.ts:8-34` (add two new methods to the exposed API)

- [ ] **Step 1: Add update methods to the preload bridge**

In `src/preload/index.ts`, add two new entries to the `contextBridge.exposeInMainWorld` object, after the `quit` entry (line 32) and before `onNotificationsUpdated`:

```typescript
  onUpdateReady: (cb: (version: string) => void) => onChannel('pet:show-update-toast', cb),
  installUpdate: () => ipcRenderer.send('pet:install-update'),
```

The full `contextBridge.exposeInMainWorld('alertosaurus', { ... })` block will now include these two new lines between `quit` and `onNotificationsUpdated`.

- [ ] **Step 2: Commit**

```bash
git add src/preload/index.ts
git commit -m "feat: expose update IPC channels in preload bridge"
```

---

### Task 4: Wire updater into main process

**Files:**
- Modify: `src/main/index.ts:1-9` (add import)
- Modify: `src/main/index.ts:334-417` (add IPC handler in `setupIPC`)
- Modify: `src/main/index.ts:420-443` (call `initAutoUpdater` in `app.whenReady`)

- [ ] **Step 1: Add import**

At the top of `src/main/index.ts`, add after the existing imports (after line 9):

```typescript
import { initAutoUpdater, installUpdate } from './updater';
```

- [ ] **Step 2: Add IPC handler in setupIPC()**

In the `setupIPC()` function, add before the closing brace (before the `hub:quit` handler is fine, or after it):

```typescript
  ipcMain.on('pet:install-update', () => {
    installUpdate();
  });
```

- [ ] **Step 3: Call initAutoUpdater in app.whenReady()**

In the `app.whenReady().then(async () => { ... })` block, after the `resetIdleTimer()` call (line 442), add:

```typescript
  initAutoUpdater((version) => {
    petWindow?.webContents.send('pet:show-update-toast', version);
  });
```

- [ ] **Step 4: Verify build**

```bash
npm run build
```

Expected: clean build, no errors.

- [ ] **Step 5: Run all tests**

```bash
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/main/index.ts
git commit -m "feat: wire auto-updater into main process

- Init updater after windows are created
- Send update-ready event to pet window
- Handle install-update IPC from renderer"
```

---

### Task 5: Add update toast to pet renderer

**Files:**
- Modify: `src/pet/index.html:9-17` (add update toast DOM element)
- Modify: `src/pet/pet.css:37-106` (add update toast styles)
- Modify: `src/pet/pet.ts:279-307` (add update toast logic)

- [ ] **Step 1: Add update toast HTML**

In `src/pet/index.html`, add the update toast container after the existing `toast-container` div (after line 16, before the `overflow` div):

```html
  <div id="update-toast" class="hidden">
    <div id="update-toast-bubble">
      <div id="update-toast-title">Update ready!</div>
      <div id="update-toast-message"></div>
    </div>
    <div id="update-toast-pointer"></div>
  </div>
```

- [ ] **Step 2: Add update toast CSS**

In `src/pet/pet.css`, add at the end of the file (after the `.squish-settle` rule):

```css
/* Update toast */
#update-toast {
  position: relative;
  margin-bottom: 4px;
  z-index: 3;
}

#update-toast.hidden {
  display: none;
}

#update-toast-bubble {
  background: #1e1e2e;
  border: 2px solid #a6e3a1;
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

#update-toast-pointer {
  width: 0;
  height: 0;
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
  border-top: 8px solid #a6e3a1;
  margin: 0 auto;
  position: relative;
}

#update-toast-pointer::after {
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

#update-toast-title {
  font-weight: bold;
  color: #a6e3a1;
  margin-bottom: 4px;
}

#update-toast-message {
  color: #cdd6f4;
  line-height: 1.4;
}
```

The update toast uses a green border (`#a6e3a1`) instead of the notification toast's grey (`#45475a`) to visually distinguish it.

- [ ] **Step 3: Add update toast logic to pet.ts**

In `src/pet/pet.ts`, add DOM element references after the existing ones (after line 8):

```typescript
const updateToast = document.getElementById('update-toast')!;
const updateToastMessage = document.getElementById('update-toast-message')!;
```

Then add the update toast section after the existing `// --- Toast ---` section (after line 307, after the `toastContainer` click listener). Add before the `// --- Overflow ---` comment:

```typescript
// --- Update toast ---

api.onUpdateReady((version: string) => {
  updateToastMessage.textContent = `v${version} — click to restart!`;
  updateToast.classList.remove('hidden');
});

updateToast.addEventListener('click', () => {
  api.installUpdate();
});
```

- [ ] **Step 4: Update click-through logic**

In the `mousemove` handler for click-through (around line 322-337), the `document.elementFromPoint` check needs to also handle `#update-toast`. Update the condition that checks for interactive elements:

Find:
```typescript
    if (el && (el.closest('#toast-container') || el.closest('#overflow'))) {
```

Replace with:
```typescript
    if (el && (el.closest('#toast-container') || el.closest('#overflow') || el.closest('#update-toast'))) {
```

- [ ] **Step 5: Verify build**

```bash
npm run build
```

Expected: clean build, no errors.

- [ ] **Step 6: Commit**

```bash
git add src/pet/index.html src/pet/pet.css src/pet/pet.ts
git commit -m "feat: add update toast to pet renderer

Shows a green-bordered toast when an update is downloaded.
Clicking it triggers quit-and-install via preload bridge.
Separate from notification toasts — does not use the queue."
```

---

### Task 6: Add macOS CLI symlink at app startup

**Files:**
- Create: `src/main/cli-symlink.ts`
- Create: `tests/cli-symlink.test.ts`
- Modify: `src/main/index.ts` (import and call)

- [ ] **Step 1: Write the test file**

Create `tests/cli-symlink.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/cli-symlink.test.ts
```

Expected: FAIL — `../src/main/cli-symlink` module does not exist.

- [ ] **Step 3: Write the cli-symlink module**

Create `src/main/cli-symlink.ts`:

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/cli-symlink.test.ts
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Wire into main process**

In `src/main/index.ts`, add the import after the other local imports:

```typescript
import { ensureCliSymlink } from './cli-symlink';
```

In the `app.whenReady().then(async () => { ... })` block, add after the `resetIdleTimer()` call and before the `initAutoUpdater` call:

```typescript
  if (process.platform === 'darwin' && app.isPackaged) {
    const roarBinary = path.join(process.resourcesPath, 'app.asar.unpacked/dist/cli/roar');
    ensureCliSymlink(roarBinary, '/usr/local/bin/roar');
  }
```

- [ ] **Step 6: Run all tests**

```bash
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/main/cli-symlink.ts tests/cli-symlink.test.ts src/main/index.ts
git commit -m "feat: create roar CLI symlink at app startup on macOS

Replaces the pkg postinstall script. Runs on every launch
so it self-heals after auto-updates move the binary."
```

---

### Task 7: Update CI release workflow

**Files:**
- Modify: `.github/workflows/release-please.yml:60-89` (replace upload steps with electron-builder publish)

- [ ] **Step 1: Update release-please.yml**

In `.github/workflows/release-please.yml`, replace the Package step and the Upload steps (lines 63-89) with a single step:

Find and replace the two steps:
```yaml
      - name: Package
        run: npx electron-builder --${{ matrix.platform }}
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: alertosaurus-${{ matrix.platform }}
          path: |
            release/*.dmg
            release/*.pkg
            release/*.exe
            release/*.AppImage
            release/*.deb
          if-no-files-found: ignore

      - name: Upload to GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          tag_name: ${{ needs.release-please.outputs.tag_name }}
          files: |
            release/*.dmg
            release/*.pkg
            release/*.exe
            release/*.AppImage
            release/*.deb
```

Replace with:
```yaml
      - name: Package and publish
        run: npx electron-builder --${{ matrix.platform }} --publish always
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          EP_GH_IGNORE_TIME: true

      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: alertosaurus-${{ matrix.platform }}
          path: |
            release/*.dmg
            release/*.zip
            release/*.exe
            release/*.AppImage
            release/*.deb
            release/*.yml
          if-no-files-found: ignore
```

Notes:
- `--publish always` tells electron-builder to upload artifacts AND generate `latest*.yml` files to the GitHub Release
- `EP_GH_IGNORE_TIME` prevents electron-builder from skipping upload when the release already exists (created by release-please)
- The upload-artifact step is kept for CI visibility but now includes `*.zip` and `*.yml` (no more `*.pkg`)
- The `softprops/action-gh-release` step is removed — electron-builder handles the upload

- [ ] **Step 2: Also update build.yml artifact paths**

In `.github/workflows/build.yml`, update the artifact upload paths to match (replace `*.pkg` with `*.zip`, add `*.yml`):

Find:
```yaml
          path: |
            release/*.dmg
            release/*.pkg
            release/*.exe
            release/*.AppImage
            release/*.deb
```

Replace with:
```yaml
          path: |
            release/*.dmg
            release/*.zip
            release/*.exe
            release/*.AppImage
            release/*.deb
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/release-please.yml .github/workflows/build.yml
git commit -m "ci: use electron-builder --publish for releases

- Replace softprops/action-gh-release with electron-builder publish
- Generates latest*.yml metadata files for auto-update
- Update artifact paths: pkg → zip"
```

---

### Task 8: Final verification

- [ ] **Step 1: Run full test suite**

```bash
npm test
```

Expected: all TypeScript and Go tests pass.

- [ ] **Step 2: Build the app**

```bash
npm run build
```

Expected: clean build.

- [ ] **Step 3: Verify electron-builder config is valid**

```bash
npx electron-builder --mac --dry-run 2>&1 | head -20
```

Expected: no configuration errors. (Will not actually package without full macOS build environment, but validates the config.)

- [ ] **Step 4: Review all changes**

```bash
git diff main --stat
```

Verify:
- `build/pkg-scripts/postinstall` deleted
- `electron-builder.yml` updated (no more pkg references)
- `src/main/updater.ts` created
- `src/main/cli-symlink.ts` created
- `src/main/index.ts` modified (imports + IPC + init calls)
- `src/preload/index.ts` modified (two new API methods)
- `src/pet/index.html` modified (update toast DOM)
- `src/pet/pet.css` modified (update toast styles)
- `src/pet/pet.ts` modified (update toast logic + click-through)
- `tests/updater.test.ts` created
- `tests/cli-symlink.test.ts` created
- `.github/workflows/release-please.yml` modified
- `.github/workflows/build.yml` modified
