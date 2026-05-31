# Auto-Update for Alertosaurus

## Overview

Add automatic update support to Alertosaurus across all platforms (macOS, Windows, Linux) using `electron-updater` with GitHub Releases as the update source. Updates download silently in the background and are announced via the dinosaur's toast system.

## Constraints

- No code signing on any platform
- macOS `pkg` target does not support auto-update — must switch to `dmg` + `zip`
- The `roar` CLI symlink currently created by the `pkg` postinstall must be handled by the app itself

## Dependencies & Build Config

### New dependency

- `electron-updater` (production dependency) — the electron-builder companion for auto-update, works without code signing

### electron-builder.yml changes

- **macOS target**: change from `pkg` to `dmg` + `zip` (dmg for first-time install, zip for delta updates consumed by electron-updater)
- **Remove** `pkg` and `pkg-scripts` config sections
- **Add `publish` config**:
  ```yaml
  publish:
    provider: github
    owner: joCur
    repo: alertosaurus
  ```
  This tells electron-builder to generate `latest.yml` / `latest-mac.yml` / `latest-linux.yml` metadata files that electron-updater uses to detect new versions.

### Files to remove

- `build/pkg-scripts/postinstall` — replaced by in-app symlink logic

## Auto-Update Module (`src/main/updater.ts`)

A new module encapsulating all update logic.

### Exports

- `initAutoUpdater(onUpdateReady: (version: string) => void): void` — starts update checking
- `installUpdate(): void` — quits and installs the downloaded update

### Behavior

- **Dev guard**: if `app.isPackaged === false`, skip all update logic
- **Check schedule**: check immediately on call, then every 30 minutes via `setInterval`
- **Event handling**:
  - `update-available`: log, download starts automatically (electron-updater default)
  - `update-downloaded`: invoke the `onUpdateReady` callback with the new version string
  - `error`: log silently, no user-facing error for failed checks
- `installUpdate()` calls `autoUpdater.quitAndInstall()`

### Configuration

- `autoUpdater.autoDownload = true` — download without prompting
- `autoUpdater.autoInstallOnAppQuit = true` — install pending update on quit even if user doesn't click the toast

## Main Process Integration (`src/main/index.ts`)

- Import `initAutoUpdater` and `installUpdate` from `./updater`
- In `app.whenReady()`, after windows are created, call:
  ```ts
  initAutoUpdater((version) => {
    petWindow?.webContents.send('pet:show-update-toast', version);
  });
  ```
- Add IPC listener:
  ```ts
  ipcMain.on('pet:install-update', () => {
    installUpdate();
  });
  ```

## Preload Bridge Changes (`src/preload/index.ts`)

- Expose `onUpdateReady(callback: (version: string) => void)` — listens for `pet:show-update-toast`
- Expose `installUpdate()` — sends `pet:install-update` to main

## Pet Renderer Update Toast

- Listen for update-ready via the preload bridge
- Render a toast visually similar to notification toasts but with update-specific text, e.g. **"v1.5.0 ready — click to restart!"**
- Clicking the update toast calls `installUpdate()` via preload (triggers quit + install)
- The update toast is a **separate overlay** from the notification queue — it does not go through `ToastQueue` and does not compete with regular notifications
- If a notification toast is already showing, the update toast renders alongside it (separate DOM element, positioned above or below the notification toast)

## CLI Symlink on macOS (`src/main/index.ts`)

On app startup, macOS only:

1. Determine the expected symlink target: `path.join(process.resourcesPath, 'app.asar.unpacked/dist/cli/roar')`
2. Check if `/usr/local/bin/roar` exists and points to the correct target
3. If not, create/update the symlink
4. If symlink creation fails (e.g. permissions), log and continue silently

This runs on every launch, so it self-heals after auto-updates move the binary.

## CI / Release Workflow Changes

### `release-please.yml`

- Replace the `softprops/action-gh-release` upload step with electron-builder's built-in publish:
  ```yaml
  - name: Package and publish
    run: npx electron-builder --${{ matrix.platform }} --publish always
    env:
      GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  ```
- This uploads build artifacts **and** generates the `latest*.yml` metadata files in a single step
- Remove the separate "Upload to GitHub Release" step

### `build.yml`

- No changes — PR builds don't publish

### Cleanup

- Delete `build/pkg-scripts/` directory

## Platform Summary

| Platform | Install format | Update format | CLI setup |
|----------|---------------|---------------|-----------|
| macOS | dmg | zip (auto) | Symlink at app startup |
| Windows | nsis | nsis (auto) | Unchanged (installer.nsh) |
| Linux | AppImage, deb | AppImage (auto) | Unchanged (after-install.sh) |

## Testing

- Unit test for `updater.ts`: mock `electron-updater`'s `autoUpdater`, verify check schedule and callback wiring
- Manual test: build a low version number, install it, publish a higher version to GitHub Releases, verify the toast appears and click-to-restart works
- Verify CLI symlink is created on macOS after fresh dmg install
