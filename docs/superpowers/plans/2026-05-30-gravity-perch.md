# Gravity Perch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the user drags and releases the pet, it falls with cartoon gravity until it lands on a detected horizontal surface (via screen-capture edge detection) or the screen bottom.

**Architecture:** Main-process driven. A new `gravity.ts` module handles edge detection (pure functions) and physics (interval-based loop). The main process orchestrates screen capture via `desktopCapturer`, crops with `sharp`, and calls `petWindow.setPosition()` each tick. The renderer only receives `pet:falling`/`pet:landed` IPC events for sprite and squish animation.

**Tech Stack:** Electron (`desktopCapturer`, `screen`), `sharp` (image crop + raw pixels), TypeScript, vitest

**Spec:** `docs/superpowers/specs/2026-05-30-gravity-perch-design.md`

---

## File Structure

| File | Role |
|------|------|
| **Create:** `src/main/gravity.ts` | Edge detection (pure), physics loop, coordinate math, constants |
| **Create:** `tests/gravity.test.ts` | Tests for edge detection and physics logic |
| **Modify:** `src/shared/types.ts` | Add `gravity_enabled`, `edge_threshold` to `Config` |
| **Modify:** `src/main/index.ts` | Wire gravity system into drag-end, add IPC, integrate screen capture |
| **Modify:** `src/preload/index.ts` | Expose `pet:falling` and `pet:landed` IPC channels |
| **Modify:** `src/pet/pet.ts` | Handle falling/landed events, squish animation |
| **Modify:** `src/pet/pet.css` | Squish transform styles |
| **Modify:** `package.json` | Add `sharp` dependency |

---

### Task 1: Add config types and `sharp` dependency

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `tests/config.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Update Config type and defaults**

In `src/shared/types.ts`, add `gravity_enabled` and `edge_threshold` to the `Config` interface and `DEFAULT_CONFIG`:

```typescript
export interface Config {
  port: number;
  host: string;
  idle_timeout_ms: number;
  pet_position: { x: number; y: number };
  gravity_enabled: boolean;
  edge_threshold: number;
}

export const DEFAULT_CONFIG: Config = {
  port: 4174,
  host: '127.0.0.1',
  idle_timeout_ms: 30_000,
  pet_position: { x: 100, y: 100 },
  gravity_enabled: true,
  edge_threshold: 30,
};
```

- [ ] **Step 2: Update config test for new defaults**

In `tests/config.test.ts`, add a test after the existing `returns default config when no file exists` test:

```typescript
it('includes gravity defaults', () => {
  const config = manager.load();
  expect(config.gravity_enabled).toBe(true);
  expect(config.edge_threshold).toBe(30);
});
```

- [ ] **Step 3: Run tests to verify**

Run: `npx vitest run tests/config.test.ts`
Expected: All tests PASS including the new one.

- [ ] **Step 4: Install sharp**

Run: `npm install sharp`

Then run `npm install` to make sure everything resolves, and verify with:
Run: `node -e "require('sharp')"`
Expected: No error output.

- [ ] **Step 5: Commit**

```bash
git add src/shared/types.ts tests/config.test.ts package.json package-lock.json
git commit -m "feat(gravity): add gravity config fields and sharp dependency"
```

---

### Task 2: Edge detection — pure functions

**Files:**
- Create: `src/main/gravity.ts`
- Create: `tests/gravity.test.ts`

The edge detection logic is a pure function that takes a raw RGBA pixel buffer and returns the row index of the first strong horizontal edge, or `null` if none found. This is fully testable without Electron.

- [ ] **Step 1: Write failing tests for luminance and edge detection**

Create `tests/gravity.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { luminance, findLandingSurface } from '../src/main/gravity';

describe('luminance', () => {
  it('returns 0 for black', () => {
    expect(luminance(0, 0, 0)).toBe(0);
  });

  it('returns 255 for white', () => {
    expect(luminance(255, 255, 255)).toBe(255);
  });

  it('weights green highest', () => {
    const r = luminance(255, 0, 0);
    const g = luminance(0, 255, 0);
    const b = luminance(0, 0, 255);
    expect(g).toBeGreaterThan(r);
    expect(r).toBeGreaterThan(b);
  });
});

describe('findLandingSurface', () => {
  function makeBuffer(rows: number[][]): Buffer {
    // Each row is [r, g, b] — we expand to RGBA across 4 columns (width=4)
    const width = 4;
    const buf = Buffer.alloc(rows.length * width * 4);
    for (let y = 0; y < rows.length; y++) {
      const [r, g, b] = rows[y];
      for (let x = 0; x < width; x++) {
        const offset = (y * width + x) * 4;
        buf[offset] = r;
        buf[offset + 1] = g;
        buf[offset + 2] = b;
        buf[offset + 3] = 255; // alpha
      }
    }
    return buf;
  }

  it('returns null for uniform buffer', () => {
    const buf = makeBuffer([
      [100, 100, 100],
      [100, 100, 100],
      [100, 100, 100],
      [100, 100, 100],
    ]);
    expect(findLandingSurface(buf, 4, 4, 4, 30)).toBeNull();
  });

  it('detects a strong horizontal edge', () => {
    const buf = makeBuffer([
      [50, 50, 50],
      [50, 50, 50],
      [200, 200, 200],  // strong edge at row 2
      [200, 200, 200],
    ]);
    expect(findLandingSurface(buf, 4, 4, 4, 30)).toBe(2);
  });

  it('ignores edges below threshold', () => {
    const buf = makeBuffer([
      [100, 100, 100],
      [110, 110, 110],  // diff = 10, below threshold of 30
      [120, 120, 120],
      [130, 130, 130],
    ]);
    expect(findLandingSurface(buf, 4, 4, 4, 30)).toBeNull();
  });

  it('finds the first edge, not later ones', () => {
    const buf = makeBuffer([
      [50, 50, 50],
      [200, 200, 200],   // edge at row 1
      [200, 200, 200],
      [50, 50, 50],      // edge at row 3
    ]);
    expect(findLandingSurface(buf, 4, 4, 4, 30)).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/gravity.test.ts`
Expected: FAIL — `luminance` and `findLandingSurface` are not exported from `gravity.ts` (file doesn't exist).

- [ ] **Step 3: Implement gravity.ts with constants and edge detection**

Create `src/main/gravity.ts`:

```typescript
export const SPRITE_GROUND_OFFSET = 13;
export const BODY_PADDING = 8;
export const PET_WINDOW_WIDTH = 320;
export const PET_WINDOW_HEIGHT = 300;
export const SPRITE_DISPLAY_WIDTH = 225;
export const GRAVITY = 1.5;
export const MAX_FALL_SPEED = 25;
export const TICK_INTERVAL = 33;

export function luminance(r: number, g: number, b: number): number {
  return Math.round(0.299 * r + 0.587 * g + 0.114 * b);
}

export function feetScreenY(windowY: number): number {
  return windowY + PET_WINDOW_HEIGHT - BODY_PADDING - SPRITE_GROUND_OFFSET;
}

export function targetWindowY(landingY: number): number {
  return landingY - PET_WINDOW_HEIGHT + BODY_PADDING + SPRITE_GROUND_OFFSET;
}

export function scanX(windowX: number): number {
  return windowX + Math.floor((PET_WINDOW_WIDTH - SPRITE_DISPLAY_WIDTH) / 2);
}

export function findLandingSurface(
  buffer: Buffer,
  width: number,
  height: number,
  channels: number,
  threshold: number,
): number | null {
  if (height < 2) return null;

  const sampleCols = [
    Math.floor(width * 0.25),
    Math.floor(width * 0.5),
    Math.floor(width * 0.75),
  ];

  for (let y = 1; y < height; y++) {
    let edgeCount = 0;
    for (const col of sampleCols) {
      const prevIdx = ((y - 1) * width + col) * channels;
      const currIdx = (y * width + col) * channels;
      const prevLum = luminance(buffer[prevIdx], buffer[prevIdx + 1], buffer[prevIdx + 2]);
      const currLum = luminance(buffer[currIdx], buffer[currIdx + 1], buffer[currIdx + 2]);
      if (Math.abs(currLum - prevLum) > threshold) {
        edgeCount++;
      }
    }
    if (edgeCount >= 2) {
      return y;
    }
  }

  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/gravity.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/gravity.ts tests/gravity.test.ts
git commit -m "feat(gravity): add edge detection and coordinate helpers"
```

---

### Task 3: Gravity physics loop

**Files:**
- Modify: `src/main/gravity.ts`
- Modify: `tests/gravity.test.ts`

Add the physics loop as a function that returns a cancel handle. Test it by advancing ticks manually with a fake timer.

- [ ] **Step 1: Write failing tests for the gravity loop**

Append to `tests/gravity.test.ts`:

```typescript
import { luminance, findLandingSurface, createGravityLoop, GRAVITY, MAX_FALL_SPEED, TICK_INTERVAL } from '../src/main/gravity';
import { vi, beforeEach, afterEach } from 'vitest';

describe('createGravityLoop', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('calls onTick with increasing y positions', () => {
    const ticks: number[] = [];
    createGravityLoop(100, 300, (y) => ticks.push(y), () => {});
    vi.advanceTimersByTime(TICK_INTERVAL * 3);
    expect(ticks.length).toBe(3);
    expect(ticks[0]).toBeGreaterThan(100);
    expect(ticks[1]).toBeGreaterThan(ticks[0]);
    expect(ticks[2]).toBeGreaterThan(ticks[1]);
  });

  it('calls onLand and stops when reaching target', () => {
    const landed = vi.fn();
    const ticks: number[] = [];
    createGravityLoop(100, 110, (y) => ticks.push(y), landed);
    vi.advanceTimersByTime(TICK_INTERVAL * 50);
    expect(landed).toHaveBeenCalledOnce();
    expect(landed).toHaveBeenCalledWith(110);
    const tickCountAtLanding = ticks.length;
    vi.advanceTimersByTime(TICK_INTERVAL * 10);
    expect(ticks.length).toBe(tickCountAtLanding);
  });

  it('respects terminal velocity', () => {
    const ticks: number[] = [];
    createGravityLoop(0, 10000, (y) => ticks.push(y), () => {});
    vi.advanceTimersByTime(TICK_INTERVAL * 100);
    for (let i = 2; i < ticks.length; i++) {
      const delta = ticks[i] - ticks[i - 1];
      expect(delta).toBeLessThanOrEqual(MAX_FALL_SPEED + 0.01);
    }
  });

  it('can be cancelled', () => {
    const ticks: number[] = [];
    const cancel = createGravityLoop(100, 500, (y) => ticks.push(y), () => {});
    vi.advanceTimersByTime(TICK_INTERVAL * 2);
    const countBefore = ticks.length;
    cancel();
    vi.advanceTimersByTime(TICK_INTERVAL * 10);
    expect(ticks.length).toBe(countBefore);
  });
});
```

Update the import at the top of the file to include all needed symbols (replace the existing import line):

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { luminance, findLandingSurface, createGravityLoop, GRAVITY, MAX_FALL_SPEED, TICK_INTERVAL } from '../src/main/gravity';
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/gravity.test.ts`
Expected: FAIL — `createGravityLoop` is not exported.

- [ ] **Step 3: Implement createGravityLoop**

Append to `src/main/gravity.ts`:

```typescript
export function createGravityLoop(
  startY: number,
  targetY: number,
  onTick: (y: number) => void,
  onLand: (y: number) => void,
): () => void {
  let y = startY;
  let vy = 0;

  const timer = setInterval(() => {
    vy = Math.min(vy + GRAVITY, MAX_FALL_SPEED);
    y += vy;

    if (y >= targetY) {
      y = targetY;
      clearInterval(timer);
      onTick(y);
      onLand(y);
      return;
    }

    onTick(Math.round(y));
  }, TICK_INTERVAL);

  return () => clearInterval(timer);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/gravity.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/main/gravity.ts tests/gravity.test.ts
git commit -m "feat(gravity): add physics loop with cartoon gravity"
```

---

### Task 4: Screen capture and gravity integration in main process

**Files:**
- Modify: `src/main/index.ts`

This wires the gravity system into the main process. On `pet:drag-end`, if gravity is enabled, capture the screen, detect the landing surface, and start the gravity loop. If gravity is disabled, save position immediately (current behavior).

- [ ] **Step 1: Add imports to index.ts**

At the top of `src/main/index.ts`, add:

```typescript
import { desktopCapturer, systemPreferences } from 'electron';
import sharp from 'sharp';
import {
  findLandingSurface,
  feetScreenY,
  targetWindowY as computeTargetWindowY,
  scanX as computeScanX,
  createGravityLoop,
  SPRITE_DISPLAY_WIDTH,
  PET_WINDOW_HEIGHT,
} from './gravity';
```

Update the existing electron import to include `desktopCapturer` and `systemPreferences`:

```typescript
import { app, BrowserWindow, desktopCapturer, ipcMain, screen, systemPreferences } from 'electron';
```

And add the sharp import:

```typescript
import sharp from 'sharp';
```

- [ ] **Step 2: Add gravity state variable**

After the existing `let toastTimer` line (line 21), add:

```typescript
let cancelGravity: (() => void) | null = null;
```

- [ ] **Step 3: Add the captureAndFall function**

Before `setupIPC()`, add:

```typescript
async function captureAndFall() {
  if (!petWindow) return;

  const [winX, winY] = petWindow.getPosition();
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenW, height: screenH } = primaryDisplay.workAreaSize;
  const displaySize = primaryDisplay.size;

  const feetY = feetScreenY(winY);
  const stripX = computeScanX(winX);
  const stripHeight = screenH - feetY;

  if (stripHeight <= 1) {
    config.pet_position = { x: winX, y: winY };
    configManager.save(config);
    petWindow.webContents.send('pet:landed');
    return;
  }

  let landingScreenY = screenH;

  if (process.platform !== 'darwin' ||
      systemPreferences.getMediaAccessStatus('screen') === 'granted') {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: displaySize.width, height: displaySize.height },
      });

      if (sources.length > 0) {
        const thumbnail = sources[0].thumbnail.toPNG();
        const clampedX = Math.max(0, Math.min(stripX, displaySize.width - SPRITE_DISPLAY_WIDTH));
        const clampedWidth = Math.min(SPRITE_DISPLAY_WIDTH, displaySize.width - clampedX);
        const clampedHeight = Math.min(stripHeight, displaySize.height - feetY);

        if (clampedWidth > 0 && clampedHeight > 0) {
          const { data, info } = await sharp(thumbnail)
            .extract({
              left: clampedX,
              top: feetY,
              width: clampedWidth,
              height: clampedHeight,
            })
            .raw()
            .toBuffer({ resolveWithObject: true });

          const edgeRow = findLandingSurface(data, info.width, info.height, info.channels, config.edge_threshold);
          if (edgeRow !== null) {
            landingScreenY = feetY + edgeRow;
          }
        }
      }
    } catch {
      // Capture failed — fall to screen bottom
    }
  }

  const targetWinY = computeTargetWindowY(landingScreenY);

  if (targetWinY <= winY) {
    config.pet_position = { x: winX, y: winY };
    configManager.save(config);
    petWindow.webContents.send('pet:landed');
    return;
  }

  petWindow.webContents.send('pet:falling');

  cancelGravity = createGravityLoop(
    winY,
    targetWinY,
    (y) => {
      petWindow?.setPosition(winX, y);
    },
    (y) => {
      cancelGravity = null;
      petWindow?.webContents.send('pet:landed');
      config.pet_position = { x: winX, y };
      configManager.save(config);
    },
  );
}
```

- [ ] **Step 4: Modify the pet:drag-end handler**

Replace the existing `pet:drag-end` handler in `setupIPC()`:

```typescript
  ipcMain.on('pet:drag-end', () => {
    if (!petWindow) return;
    if (config.gravity_enabled) {
      captureAndFall();
    } else {
      const [x, y] = petWindow.getPosition();
      config.pet_position = { x, y };
      configManager.save(config);
    }
  });
```

- [ ] **Step 5: Modify the pet:dragging handler to cancel active gravity**

Replace the existing `pet:dragging` handler in `setupIPC()`:

```typescript
  ipcMain.on('pet:dragging', (_e: Electron.IpcMainEvent, dx: number, dy: number) => {
    if (!petWindow) return;
    if (cancelGravity) {
      cancelGravity();
      cancelGravity = null;
    }
    const [x, y] = petWindow.getPosition();
    petWindow.setPosition(x + dx, y + dy);
  });
```

- [ ] **Step 6: Guard sendPetState during fall**

If a notification arrives while the pet is falling, `sendPetState('roaring')` would override the dragging sprite. Add a guard to defer state changes during gravity:

In `sendPetState`, add the gravity check:

```typescript
function sendPetState(state: string) {
  if (cancelGravity) return;
  petWindow?.webContents.send('pet:set-state', state);
}
```

In the `onLand` callback inside `captureAndFall`, after sending `pet:landed`, sync any state changes that arrived during the fall:

```typescript
    (y) => {
      cancelGravity = null;
      petWindow?.webContents.send('pet:landed');
      if (stateMachine.state === 'roaring') {
        sendPetState('roaring');
      }
      config.pet_position = { x: winX, y };
      configManager.save(config);
    },
```

- [ ] **Step 7: Clean up gravity on quit**

In the `app.on('will-quit', ...)` handler, add gravity cleanup:

```typescript
app.on('will-quit', () => {
  if (cancelGravity) { cancelGravity(); cancelGravity = null; }
  configManager.removeRuntime();
  httpServer?.close();
  db.close();
  if (idleTimer) clearTimeout(idleTimer);
  if (toastTimer) clearTimeout(toastTimer);
});
```

- [ ] **Step 8: Build to verify compilation**

Run: `npm run build:main`
Expected: Compiles without errors.

- [ ] **Step 9: Commit**

```bash
git add src/main/index.ts
git commit -m "feat(gravity): integrate screen capture and gravity loop on drag-end"
```

---

### Task 5: Preload — expose new IPC channels

**Files:**
- Modify: `src/preload/index.ts`

- [ ] **Step 1: Add falling and landed listeners**

In `src/preload/index.ts`, add these two lines inside the `contextBridge.exposeInMainWorld` object, after the `onSetState` line:

```typescript
  onFalling: (cb: () => void) => onChannel('pet:falling', cb),
  onLanded: (cb: () => void) => onChannel('pet:landed', cb),
```

- [ ] **Step 2: Build to verify**

Run: `npm run build:main`
Expected: Compiles without errors.

- [ ] **Step 3: Commit**

```bash
git add src/preload/index.ts
git commit -m "feat(gravity): expose falling/landed IPC channels in preload"
```

---

### Task 6: Renderer — falling state and squish animation

**Files:**
- Modify: `src/pet/pet.ts`
- Modify: `src/pet/pet.css`

- [ ] **Step 1: Add squish CSS**

Append to `src/pet/pet.css`:

```css
#sprite-container {
  transform-origin: bottom center;
}

.squish-impact {
  transform: scaleX(1.2) scaleY(0.7);
  transition: transform 80ms ease-out;
}

.squish-stretch {
  transform: scaleX(0.9) scaleY(1.1);
  transition: transform 100ms ease-in-out;
}

.squish-settle {
  transform: scale(1.0);
  transition: transform 120ms ease-out;
}
```

- [ ] **Step 2: Add falling/landed handlers in pet.ts**

Add the following after the `api.onSetState` handler (around line 251) in `src/pet/pet.ts`:

```typescript
let isFalling = false;

api.onFalling(() => {
  isFalling = true;
  playSegments([], { sheetKey: 'dragging', frames: range(0, 15) });
});

api.onLanded(() => {
  isFalling = false;

  spriteContainer.classList.add('squish-impact');
  setTimeout(() => {
    spriteContainer.classList.remove('squish-impact');
    spriteContainer.classList.add('squish-stretch');
    setTimeout(() => {
      spriteContainer.classList.remove('squish-stretch');
      spriteContainer.classList.add('squish-settle');
      setTimeout(() => {
        spriteContainer.classList.remove('squish-settle');
        goToState(stateBeforeDrag ?? 'idle');
        stateBeforeDrag = null;
      }, 120);
    }, 100);
  }, 80);
});
```

- [ ] **Step 3: Modify mouseup to not restore state when gravity is active**

In the `mouseup` handler, the renderer currently calls `goToState(stateBeforeDrag)` immediately on drag end. When gravity is enabled, the main process will send `pet:falling` instead, and the renderer should wait for `pet:landed` before restoring state.

Replace the existing `mouseup` handler:

```typescript
document.addEventListener('mouseup', () => {
  if (!isDragging) return;
  isDragging = false;
  if (didDrag) {
    stateBeforeDrag = visualPose === 'sitting' ? 'idle' : visualPose === 'sleeping' ? 'sleeping' : visualPose === 'roaring' ? 'roaring' : 'idle';
  }
  api.dragEnd();
  // Don't restore state here — wait for either:
  // - pet:landed (gravity enabled) → squish then goToState
  // - pet:drag-end saving position (gravity disabled) → need to restore here
});
```

Wait — this changes behavior when gravity is disabled. We need to handle both cases. The renderer doesn't know if gravity is enabled. The simplest approach: the main process always sends either `pet:falling` (gravity on) or a new `pet:drag-settled` (gravity off) event. But that's more IPC surface than needed.

Simpler: keep `stateBeforeDrag` captured on drag start (which it already is). On mouseup, just call `api.dragEnd()` and don't restore state. If gravity is off, the main process sends nothing — the renderer needs to restore state itself. If gravity is on, `pet:falling` arrives, then `pet:landed` restores.

To handle the gravity-off case without adding more IPC: have the main process send `pet:landed` immediately when gravity is disabled too (since the pet "lands" where it was dropped).

Update the `pet:drag-end` handler in `src/main/index.ts` to send `pet:landed` when gravity is off:

```typescript
  ipcMain.on('pet:drag-end', () => {
    if (!petWindow) return;
    if (config.gravity_enabled) {
      captureAndFall();
    } else {
      const [x, y] = petWindow.getPosition();
      config.pet_position = { x, y };
      configManager.save(config);
      petWindow.webContents.send('pet:landed');
    }
  });
```

And replace the `mouseup` handler in `src/pet/pet.ts`:

```typescript
document.addEventListener('mouseup', () => {
  if (!isDragging) return;
  isDragging = false;
  if (didDrag) {
    api.dragEnd();
    // State restoration happens in onLanded handler
  }
});
```

This ensures clicks don't trigger `pet:drag-end` (and thus gravity). The click handler already handles the click case independently.

The `stateBeforeDrag` is already captured in the `mousemove` handler when `didDrag` first becomes true — no change needed there.

- [ ] **Step 4: Build renderer to verify**

Run: `npm run build:renderer`
Expected: Compiles without errors.

- [ ] **Step 5: Build everything**

Run: `npm run build`
Expected: Compiles without errors.

- [ ] **Step 6: Commit**

```bash
git add src/pet/pet.ts src/pet/pet.css src/main/index.ts
git commit -m "feat(gravity): add falling/landed renderer handling with squish animation"
```

---

### Task 7: Integration test — run and verify

**Files:** None (manual testing)

- [ ] **Step 1: Start the app**

Run: `npm run start`

- [ ] **Step 2: Test gravity fall to screen bottom**

1. Drag the pet to the top of the screen
2. Release it
3. Expected: pet falls with accelerating speed, lands at screen bottom with a squish animation, then transitions to idle

- [ ] **Step 3: Test perching on a window edge**

1. Open a browser or terminal window so it has a clear horizontal toolbar/title bar
2. Drag the pet above that window's top edge
3. Release it
4. Expected: pet falls and lands on the window's top edge (if the contrast is strong enough)

- [ ] **Step 4: Test drag during fall**

1. Drag the pet high up and release
2. While it's falling, grab it again
3. Expected: fall cancels, drag works normally

- [ ] **Step 5: Test gravity disabled**

1. Edit `~/Library/Application Support/alertosaurus/config.json`, set `"gravity_enabled": false`
2. Restart the app
3. Drag and release the pet
4. Expected: pet stays where dropped (original behavior)

- [ ] **Step 6: Test edge threshold tuning**

1. Edit config, set `"edge_threshold": 10` (more sensitive)
2. Restart and test — should land on more subtle edges
3. Set `"edge_threshold": 80` (less sensitive)
4. Test — should only land on very strong contrast edges

- [ ] **Step 7: Test macOS Screen Recording permission**

1. If Screen Recording permission is not granted, the pet should still fall — just to the screen bottom instead of perching
2. Check System Preferences > Privacy > Screen Recording

- [ ] **Step 8: Commit any fixes from testing**

```bash
git add -A
git commit -m "fix(gravity): adjustments from integration testing"
```

---

## Summary of changes

| Component | What changes |
|-----------|-------------|
| `src/shared/types.ts` | `Config` gets `gravity_enabled` (bool) and `edge_threshold` (number) |
| `src/main/gravity.ts` | New module: constants, `luminance()`, `findLandingSurface()`, coordinate helpers, `createGravityLoop()` |
| `src/main/index.ts` | `captureAndFall()` orchestrator, modified `pet:drag-end`/`pet:dragging` handlers, gravity cleanup on quit |
| `src/preload/index.ts` | `onFalling` and `onLanded` channel listeners |
| `src/pet/pet.ts` | `onFalling`/`onLanded` handlers, squish sequence, modified mouseup to defer state restore |
| `src/pet/pet.css` | `.squish-impact`, `.squish-stretch`, `.squish-settle` classes with `transform-origin: bottom center` |
| `tests/gravity.test.ts` | Tests for luminance, edge detection, and physics loop |
| `package.json` | `sharp` added to dependencies |
