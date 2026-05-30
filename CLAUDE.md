# Alertosaurus

Desktop notification hub with a pixel-art dinosaur pet. Electron + TypeScript + SQLite.

## Quick Start

```bash
npm install
npx electron-rebuild    # required for better-sqlite3
npm run build
npx electron .
```

Send a test notification using the CLI (built to `dist/cli/roar`):

```bash
dist/cli/roar "build finished"
dist/cli/roar --from deploy "staging is live"
dist/cli/roar --duration 10000 "tests failed"
```

Or via HTTP directly: `curl -X POST http://127.0.0.1:4174/notify -H 'Content-Type: application/json' -d '{"caller":"test","message":"hello","duration_ms":3000}'`

## Development Notes

- **Native modules**: After `npm install`, run `npx electron-rebuild` to recompile `better-sqlite3` for Electron's Node version. Without this you get `NODE_MODULE_VERSION` mismatch errors at launch.
- **Single instance**: The app binds to port 4174 (configurable). If an old instance is running, the new one will fail silently. Quit the running instance first (hub footer > Quit) before launching a dev build.
- **Worktrees**: `.env*` files are gitignored. When using git worktrees, symlink them from the repo root.

## Architecture

```
src/main/       Electron main process (IPC, DB, HTTP server, physics)
src/pet/        Pet window renderer (sprite animation, toasts, dragging)
src/hub/        Hub window renderer (notification list, settings)
src/preload/    contextBridge API between main and renderers
src/shared/     Shared TypeScript types
cli/            Go CLI binary (roar command)
```

## Testing

```bash
npm test              # Vitest + Go tests
npx vitest run        # TypeScript tests only
cd cli && go test     # Go CLI tests only
```

## Stack

- **Database**: SQLite via `better-sqlite3`, WAL mode. Stored at `~/.config/alertosaurus/notifications.db` (macOS: `~/Library/Application Support/`)
- **HTTP API**: Express on `127.0.0.1:4174` (`POST /notify`, `GET /health`)
- **IPC**: Electron contextBridge in preload, `ipcMain.handle` / `ipcRenderer.invoke` for request/response, `.send` / `.on` for fire-and-forget
