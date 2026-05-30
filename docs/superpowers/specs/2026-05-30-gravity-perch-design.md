# Gravity Perch — Design Spec

When the user drags and releases the pet, it falls with cartoon gravity until it lands on a detected horizontal surface or the screen bottom. Surfaces are found via screen-capture edge detection, allowing the pet to perch on toolbars, window borders, tab bars — anything that looks like a horizontal ledge.

## Architecture

**Main-process driven.** The main process owns the entire gravity pipeline: screen capture, edge detection, physics loop, and window positioning. The renderer handles sprite animation only, receiving `pet:falling` and `pet:landed` IPC events.

This matches the established pattern from other Electron desktop pets (clawd-on-desk, openpets) where `requestAnimationFrame` in renderers gets throttled for unfocused windows, making main-process `setInterval` the only reliable animation driver.

### Sequence

1. User releases mouse → `pet:drag-end` fires
2. Main process captures screen via `desktopCapturer.getSources()`
3. Crop vertical strip below pet's feet using `sharp`
4. Scan strip for horizontal contrast edges → determine landing Y (or screen bottom)
5. Send `pet:falling` to renderer → plays dragging sprite
6. Run gravity loop at ~30fps via `setInterval`, calling `petWindow.setPosition()` each tick
7. When pet reaches landing Y → send `pet:landed` to renderer → CSS squish animation → idle state
8. Save final position to config

## Screen Capture & Edge Detection

### Scan Region

The scan starts from the pet's feet position in screen coordinates:

```
feetY = windowY + windowHeight - BODY_PADDING - SPRITE_GROUND_OFFSET
      = windowY + 300 - 8 - 13
      = windowY + 279
```

The scan strip is 225px wide (sprite width), horizontally centered on the pet window, extending from `feetY` to the screen bottom.

### Constants

```
SPRITE_GROUND_OFFSET = 13    // px — distance from sprite frame bottom to dino's feet
BODY_PADDING         = 8     // px — CSS padding below sprite container
```

`SPRITE_GROUND_OFFSET` is a named constant in the main process, tied to the current sprite art. Update it if the sprite set changes.

### Detection Algorithm

1. Capture full screen thumbnail via `desktopCapturer.getSources({ types: ['screen'], thumbnailSize })` where `thumbnailSize` matches the display's actual pixel dimensions (`screen.getPrimaryDisplay().size`) so pixel coordinates map 1:1
2. Crop to scan region using `sharp.extract({ left: scanX, top: feetY, width: 225, height: screenBottom - feetY })`
3. Get raw pixel buffer via `.raw().toBuffer()`
4. Sample 3 columns across the strip width (at 25%, 50%, 75%)
5. For each row top-to-bottom, compare luminance (`0.299R + 0.587G + 0.114B`) to the row above
6. If 2 out of 3 sample columns show a contrast difference exceeding the threshold → that row is the landing surface
7. If no edge found → landing Y is the screen bottom (`workAreaSize.height`)

### macOS Screen Recording Permission

Screen capture requires the Screen Recording permission on macOS. Check on startup with:

```
systemPreferences.getMediaAccessStatus('screen')
```

If not granted, `desktopCapturer.getSources()` returns blank thumbnails. Graceful degradation: skip edge detection, fall to screen bottom. Gravity still works, just no perching on surfaces.

## Physics

### Constants

```
GRAVITY        = 1.5    // px/tick² — cartoon acceleration
MAX_FALL_SPEED = 25     // px/tick — terminal velocity
TICK_INTERVAL  = 33     // ms (~30fps)
```

### Gravity Loop

```
targetWindowY = landingY - windowHeight + BODY_PADDING + SPRITE_GROUND_OFFSET

let vy = 0
setInterval(() => {
  vy = min(vy + GRAVITY, MAX_FALL_SPEED)
  y += vy
  if (y >= targetWindowY):
    y = targetWindowY
    → stop loop
    → send 'pet:landed'
    → save position to config
  petWindow.setPosition(x, round(y))
}, TICK_INTERVAL)
```

## Landing Animation

CSS transform on the sprite container, anchored at `transform-origin: bottom center`:

| Phase   | Transform                    | Duration |
|---------|------------------------------|----------|
| Impact  | `scaleX(1.2) scaleY(0.7)`   | 80ms     |
| Stretch | `scaleX(0.9) scaleY(1.1)`   | 100ms    |
| Settle  | `scale(1.0)`                 | 120ms    |

After settle, transition to idle animation state.

## Sprite

Reuse the existing `dragging` sprite sheet (4x4, 18fps) for the fall animation. A dedicated falling sprite will be added later.

## IPC Surface

### New Channels (Main → Renderer)

- `pet:falling` — pet is entering gravity fall; play dragging sprite
- `pet:landed` — pet has reached a surface; trigger squish, then idle

### Modified Channels

- `pet:drag-end` — now triggers gravity fall instead of immediately saving position (when gravity is enabled)

## Config

Two new fields in `config.json`:

| Field              | Type    | Default | Description                                         |
|--------------------|---------|---------|-----------------------------------------------------|
| `gravity_enabled`  | boolean | `true`  | Master toggle. When false, pet stays where dropped.  |
| `edge_threshold`   | number  | `30`    | Luminance difference (0-255) for edge detection.     |

## Edge Cases

- **Pet near screen bottom**: scan region is tiny or zero. Minimal fall distance, quick land.
- **No edge detected**: fall to screen bottom (`workAreaSize.height`, above dock/taskbar).
- **Screen Recording denied (macOS)**: fall to screen bottom (graceful degradation, no perching).
- **Drag during fall**: cancel the gravity loop, enter normal drag mode.
- **Notification during fall**: let the fall complete first, then show toast.
- **Gravity disabled**: current behavior — pet stays where dropped.

## Dependencies

New runtime dependency:

- `sharp` — for screenshot cropping and raw pixel access. Native module (libvips), fast, well-maintained. No pure-JS alternative is performant enough for image operations.

No other new dependencies. `desktopCapturer` is built into Electron.

## Files to Change

| File | Change |
|------|--------|
| `src/main/index.ts` | Gravity system: capture, edge detection, physics loop, new IPC handlers |
| `src/pet/pet.ts` | Handle `pet:falling` and `pet:landed` events, squish animation |
| `src/pet/pet.css` | Squish transition styles, transform-origin |
| `src/preload/index.ts` | Expose new IPC channels |
| `src/shared/types.ts` | Add `gravity_enabled` and `edge_threshold` to Config |
| `package.json` | Add `sharp` dependency |

Optionally, the gravity system (`capture + edge detection + physics loop`) could be extracted to its own module `src/main/gravity.ts` to keep `index.ts` from growing too large.
