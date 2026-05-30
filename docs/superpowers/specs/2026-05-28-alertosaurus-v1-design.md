# Alertosaurus v1 — Design Spec

> A local notification hub for developers running many agents at once. A pixel-art dinosaur lives on your desktop and alerts you when something wants your attention.

---

## 1. Naming

- **`alertosaurus`** — desktop app launcher
- **`roar`** — CLI command to send notifications

## 2. Target User

One developer on their own machine, running multiple terminal-based agents. Not multi-user, not networked beyond LAN, not hardened for hostile input.

## 3. Stack

- **Electron** with a Node HTTP server in the main process
- **SQLite** via `better-sqlite3` for history persistence
- **TypeScript** throughout
- Sprite sheets rendered with CSS `image-rendering: pixelated` and `steps()` animations

---

## 4. Architecture

### 4.1 Three Processes

**Main process (Node):**
- HTTP server on `127.0.0.1:4174` (configurable). Two routes: `POST /notify`, `GET /health`. Rate limited at 20 req/s.
- SQLite database for notification persistence.
- In-memory toast queue. Max 5 queued; overflow collapses to "+N more" indicator. Drains one toast at a time via IPC to pet renderer.
- Writes runtime file on startup, deletes on clean exit.
- Reads/writes config file for pet position, idle timeout, port override.

**Pet renderer window:**
- Frameless, transparent, always-on-top `BrowserWindow`.
- Renders sprite sheet via CSS `steps()` animation + `image-rendering: pixelated`.
- Toast speech bubble anchored above sprite.
- Click-through on transparent areas (`setIgnoreMouseEvents` with forwarding).
- Draggable on sprite. Position saved via IPC → config.

**Hub renderer window:**
- Normal `BrowserWindow`, hidden by default.
- Opens on pet click. Reverse-chronological notification list grouped by day.
- Displays endpoint URL + port.
- Clear history (with confirm dialog) and Quit buttons.

### 4.2 Data Flow

```
roar CLI / curl / script
  → POST /notify
    → validate → SQLite write → enqueue toast
      → IPC → pet renderer → show toast + animation
        → pet click → IPC → hub renderer → history list
```

---

## 5. API

### 5.1 POST /notify

**Request body (JSON):**
```json
{
  "caller": "string, required, max 64 chars",
  "message": "string, required, max 2000 chars",
  "duration_ms": "integer, optional, 0..30000, default 5000"
}
```

- `duration_ms: 0` means sticky until clicked.

**Responses:**
- `200 OK` — `{ "id": "uuid", "received_at": "ISO 8601" }`
- `400 Bad Request` — `{ "error": "..." }`
- `429 Too Many Requests` — `{ "error": "rate limit exceeded" }`

### 5.2 GET /health

**Response:**
```json
{ "status": "ok", "version": "1.0.0", "uptime_s": 3600 }
```

No auth in v1 — server only listens on loopback.

---

## 6. Data Model

### 6.1 SQLite Schema

```sql
CREATE TABLE notifications (
  id          TEXT PRIMARY KEY,
  caller      TEXT NOT NULL,
  message     TEXT NOT NULL,
  duration_ms INTEGER NOT NULL DEFAULT 5000,
  received_at TEXT NOT NULL
);

CREATE INDEX idx_received_at ON notifications(received_at DESC);
```

### 6.2 Config File

Location: `~/.config/alertosaurus/config.json` (macOS: `~/Library/Application Support/alertosaurus/config.json`, Windows: `%APPDATA%/alertosaurus/config.json`)

```json
{
  "port": 4174,
  "host": "127.0.0.1",
  "idle_timeout_ms": 600000,
  "pet_position": { "x": 100, "y": 100 }
}
```

### 6.3 Runtime File

Location: same directory as config, `runtime.json`. Written on startup, deleted on clean exit.

```json
{
  "host": "127.0.0.1",
  "port": 4174,
  "pid": 12345,
  "started_at": "2026-05-28T10:00:00Z"
}
```

---

## 7. Pet Visuals

### 7.1 Art Assets

Existing pixel art sprite sheets in `assets/base/` — orange/amber dinosaur, micro-resolution (~24×24 per frame). All art is used as-is with no recoloring.

### 7.2 Animation States (v1)

| State | Sprite | Frames | Behavior |
|---|---|---|---|
| **Idle** | `idle.png` | 2, loop | Default. Subtle breathing. Transitions to sleeping after idle timeout. |
| **Talking** | `bite.png` | 2, loop | Plays while a toast is visible. Mouth open/close as "speaking." |
| **Happy** | `jump.png` | 4, play once | Brief celebration when notification arrives. Transitions to talking. |
| **Sleeping** | `sleep.png` | 3, loop | After configurable idle period (default 10 min). To be created. |

Additional sprites (`scan.png`, `move.png`, `dash.png`, `hurt.png`, `dead.png`, `kick.png`, `avoid.png`) are reserved for future use.

### 7.3 State Machine

```
                 notification           10min idle
    SLEEPING ──────────────► HAPPY ◄──────────── IDLE
       ▲                      │                    ▲
       │                      │ animation ends     │
       │                      ▼                    │
       │                   TALKING ────────────────┘
       │                  (while toast visible)
       │                                           │
       └───────────────────────────────────────────┘
                     10min idle (from IDLE)
```

- Notification arrives while IDLE → HAPPY (play once) → TALKING (loop while toast visible) → IDLE
- Notification arrives while SLEEPING → HAPPY → TALKING → IDLE
- Between queued toasts: no repeat HAPPY, just next toast with TALKING
- Queue hits 5: oldest queued collapse to "+N more" indicator, click opens hub

### 7.4 Sleep Sprite (To Create)

Create `sleep.png` in the same style as existing assets:
- Dino curled up, tail wrapped around body, eyes closed
- 3 frames: slow breathing cycle
- Match existing color palette (orange/amber body)

---

## 8. Toast Mechanics

### 8.1 Speech Bubble

- Anchored above the sprite, pointing down with a small CSS triangle
- Content: **caller** (bold, truncated ~20 chars), **message** (max 2 lines, ellipsis overflow), **timestamp** (relative: "just now", "2m ago")
- Click toast → dismiss early
- Click pet (not toast) → open hub

### 8.2 Queue Behavior

1. Notification arrives → enqueued
2. If queue was empty: HAPPY animation (play once), then show toast + TALKING
3. If already talking: current toast finishes, next starts (no HAPPY between queued)
4. Toast visible for `duration_ms` (or until clicked if 0)
5. Toast dismissed → queue empty? → IDLE. More queued? → next toast.
6. Queue exceeds 5: oldest queued collapse to "+N more" click target → opens hub

---

## 9. CLI (`roar`)

### 9.1 Usage

```bash
roar "agent finished refactoring"
roar --from "refactor-agent" "done, 14 files changed"
roar --from "test-runner" --duration 10000 "tests failed"
roar --from "deploy" --duration 0 "stuck — needs approval"
```

Default `--from`: parent process name > cwd basename > `"cli"`.

### 9.2 Behavior

1. Read runtime file to discover hub address
2. If missing → `"alertosaurus is not running. Start it with: alertosaurus"`, exit 1
3. `GET /health` to verify hub is up
4. If no response → same error, exit 1
5. `POST /notify` with payload
6. Exit 0 on 200, exit 1 with error message on 4xx/5xx

Arg parsing: minimal (`mri` or hand-rolled). No startup overhead.

### 9.3 Distribution

Bundled with the desktop app. Symlinked binary on macOS/Linux, shim script on Windows.

---

## 10. Platform Concerns

| Concern | macOS | Linux | Windows |
|---|---|---|---|
| Transparent always-on-top | `vibrancy` + `alwaysOnTop` | Compositor required | `transparent: true` on Win10+ |
| Click-through | `setIgnoreMouseEvents(true, {forward: true})` | Same, compositor-dependent | Same, works reliably |
| Config path | `~/Library/Application Support/alertosaurus/` | `~/.config/alertosaurus/` | `%APPDATA%/alertosaurus/` |
| Tray icon | Menu bar | System tray (DE-dependent) | System tray |

**Build targets:** `.dmg` (macOS), `.AppImage` + `.deb` (Linux), `.nsis` (Windows).

**Highest risk:** transparent always-on-top click-through on Linux. Validate this first with a minimal Electron window before building anything else.

---

## 11. Pet Window Details

- Single transparent `BrowserWindow` for pet + toast (not two windows)
- Drag: mouse down on sprite starts drag, window follows cursor, mouse up saves position via IPC
- If saved position is off-screen on launch (monitor disconnected): reset to bottom-right of primary display
- Pet window resizes dynamically when toast appears/disappears

---

## 12. What v1 Deliberately Does Not Do

- No accounts, auth, or cloud sync
- No phone/device notifications
- No integrations with specific tools
- No notification grouping, threading, or replies
- No DND scheduling
- No sound
- No rich content (markdown, images, links)
- No bonus animation states beyond the core four

---

## 13. Acceptance Criteria

1. Launch `alertosaurus`. A dinosaur appears on the desktop and is idle.
2. Run `roar --from "test" "hello"`. Within ~200ms, the dinosaur reacts, a speech bubble appears, disappears after 5s.
3. Send 10 notifications in a loop. They queue and play through; none are lost.
4. Click the dinosaur. The hub opens with all 11 messages in reverse chronological order.
5. Quit and relaunch. History persists. Dinosaur reappears at last dragged position.
6. From a second machine on LAN (after rebinding to `0.0.0.0`), `curl POST` produces a toast.

---

## 14. Project Structure

```
alertosaurus/
├── assets/
│   └── base/               ← existing sprite sheets + sleep.png
├── src/
│   ├── main/                ← Electron main process
│   │   ├── index.ts              app entry, window management
│   │   ├── server.ts             HTTP server (notify, health)
│   │   ├── db.ts                 SQLite setup + queries
│   │   ├── queue.ts              toast queue + drain logic
│   │   └── config.ts             config read/write, runtime file
│   ├── pet/                 ← pet renderer
│   │   ├── index.html
│   │   ├── pet.ts                sprite state machine, drag
│   │   ├── toast.ts              speech bubble rendering
│   │   └── pet.css               sprite animation, bubble styles
│   ├── hub/                 ← hub renderer
│   │   ├── index.html
│   │   ├── hub.ts                list rendering
│   │   └── hub.css
│   └── shared/
│       └── types.ts              Notification, Config interfaces
├── cli/
│   └── index.ts             ← roar CLI
├── package.json
├── electron-builder.yml
└── tsconfig.json
```
