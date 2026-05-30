# Alertosaurus — Spec (v1)

> A local notification hub for developers running many agents at once. A pixel-art dinosaur lives on your desktop and alerts you when something wants your attention.

---

## 1. Why

When you're running multiple Claude Code agents (or any long-running background processes), the signal that "something needs you" gets lost. Terminal bells are ignored, OS notifications get swallowed by Do Not Disturb or buried under Slack, and tailing logs is not a workflow.

The hub solves this by giving notifications a **persistent, friendly, hard-to-miss home**: a small character on your desktop that speaks up when something happens, and remembers what was said so you can scroll back through it later. It accepts notifications from anything that can make an HTTP call — a CLI on your machine today, a script on another machine tomorrow.

The success criterion is selfish and simple: **the author uses it daily and stops missing agent completions.**

---

## 2. Who it's for (v1)

One user: a developer on their own machine, running multiple terminal-based agents. Not multi-user, not networked beyond LAN, not hardened for hostile input.

---

## 3. What it does

### 3.1 The pet

A pixel-art T-rex (or similar iconic dinosaur — final art is a design decision, not a spec decision) lives in a small, frameless, always-on-top, transparent, click-through-except-on-the-sprite window on the user's desktop. The user can drag it to reposition; position persists across restarts.

**Personality.** The pet is the *Alertosaurus* — its job is to alert, and that should come through in the animation. Attentive, ears-up, a little theatrical. It's not a sleepy companion that occasionally wakes up; it's a small dramatic creature that takes its job of getting your attention seriously. The art and animation should lean into that brief.

The pet has a few visible states, each a short looping sprite animation:

- **Idle** — default; subtle breathing, occasional blink.
- **Talking** — plays while a toast is visible.
- **Happy** — brief animation when a new notification arrives.
- **Sleeping** — after a configurable idle period (default: 10 minutes with no notifications), the pet curls up. Wakes on next notification.

The pet has personality but is not a game. No interaction beyond drag, click, and right-click.

### 3.2 Toasts (the "speaking")

When a notification arrives, a speech-bubble toast appears anchored to the pet, containing:

- **Caller name** — who sent it (e.g. `claude-code: refactor-agent`).
- **Message** — the body.
- **Timestamp** — relative (`just now`, `2m ago`).

The toast is visible for the duration specified in the payload, or a default (5 seconds) if none was given. Multiple notifications arriving in quick succession queue rather than overlap; the pet works through them one at a time. If the queue exceeds a small bound (say 5), older queued toasts collapse into a "+3 more" indicator the user can click to jump to the hub.

Clicking a toast dismisses it early. Clicking the pet (not a toast) opens the hub.

### 3.3 The hub (history view)

A separate, normal window opened by clicking the pet. Scrollable, reverse-chronological list of every notification ever received, grouped by day. Each row shows caller, message, and full timestamp. Search/filter by caller is a nice-to-have but not required for v1.

The hub is also where the user can:

- See the HTTP endpoint URL and port (so they know where to point clients).
- Clear history (with confirmation).
- Quit the app.

### 3.4 The HTTP endpoint

A local HTTP server runs as part of the app, bound by default to `127.0.0.1` on a default port (suggest `4174`, but configurable). On startup the app writes the chosen `{host, port}` to a known runtime file (e.g. `~/.config/alertosaurus/runtime.json` or the platform equivalent) so clients can discover it without configuration.

**Endpoint:** `POST /notify`

**Request body (JSON):**

```json
{
  "caller": "string, required, max 64 chars",
  "message": "string, required, max 2000 chars",
  "duration_ms": "integer, optional, 500..30000, default 5000"
}
```

**Responses:**

- `200 OK` with `{ "id": "...", "received_at": "..." }` on success.
- `400 Bad Request` with `{ "error": "..." }` on validation failure.
- `429 Too Many Requests` if the user has flooded (basic rate limit, e.g. 20/sec from one IP).

**Health check:** `GET /health` → `200 OK` with `{ "status": "ok", "version": "..." }`. Used by the CLI to verify the hub is running.

There is no auth in v1 because the server only listens on loopback. Authentication is on the v2 roadmap, gated on whether the user opts to bind to a non-loopback address.

### 3.5 The CLI

A small command-line tool, installable globally, that POSTs to the local hub. The CLI command is **`alert`** — short, fast to type, and distinct from the app binary. The desktop app itself is launched with `alertosaurus`.

**Primary usage:**

```
alert "agent finished refactoring"
alert --from "refactor-agent" "done, 14 files changed"
alert --from "test-runner" --duration 10000 "tests failed: see logs"
```

If `--from` is omitted, the caller defaults to the parent process name, the current working directory's basename, or `cli` — whichever is most useful (implementation choice).

**Behavior:**

- Reads the runtime file to find the hub's address. If it doesn't exist or the hub doesn't respond on `/health`, the CLI prints a clear error: `"alertosaurus is not running. Start it with: alertosaurus"` and exits non-zero.
- Exits `0` on `200`, non-zero with the server's error message on `4xx`/`5xx`.
- Should be fast enough to use in a tight loop — no startup ceremony, no analytics.

**Secondary commands (nice to have, not required for v1):**

- `alert status` — is the hub running, where, since when.
- `alert tail` — stream new notifications to stdout (useful for debugging).

If `alert` collides with an existing tool on the user's system, `alrt` is an acceptable fallback. This is an installation-time concern, not a spec concern.

---

## 4. What it deliberately does *not* do (v1)

- No accounts, no auth, no cloud sync.
- No notifications to phones or other devices.
- No integrations with specific tools (Slack, Discord, hooks into Claude Code). Those are user space — the user wires their own scripts to call `alert`.
- No notification grouping, threading, or replies. A notification is fire-and-forget.
- No do-not-disturb scheduling. If the user doesn't want toasts, they quit the app.
- No sound by default. (May be added later as a per-notification flag.)
- No rich content — no markdown, no images, no links. Plain text.

---

## 5. Constraints and qualities

- **Cross-platform.** macOS, Linux, Windows. Same binary behavior on all three; appearance may differ where the OS forces it (window chrome on the hub window, for instance).
- **Stack.** Electron with a Node HTTP server in the main process. SQLite (via `better-sqlite3` or similar) for history persistence. Sprite sheets rendered in the renderer process with CSS `image-rendering: pixelated` and `steps()` animations.
- **Always-on-top transparency must work on all three OSes.** This is the highest technical risk in v1 — verify early.
- **Lightweight at rest.** Idle CPU should be effectively zero; the pet animates with CSS, not a render loop. Memory should be reasonable for an Electron app (one main process, two renderer windows).
- **Resilient to a flood.** If 500 notifications arrive in a second, the app does not freeze, lose data, or pop 500 toasts. Queue + collapse behavior covers this.
- **Local-first persistence.** History survives app restart and machine reboot.

---

## 6. Open questions for implementation

These are real decisions the implementing agent should make and surface, not pre-decided in this spec:

- Exact pet position behavior on multi-monitor setups (which screen does it default to? what happens if the screen it was on disconnects?).
- Whether the toast and pet share one window or are two coupled windows. One window is simpler; two may be needed if the OS makes click-through on the toast tricky.
- Whether to ship the CLI as a separate npm package, a bundled binary, or both.
- Sprite sheet format and animation FPS — design decision, should look good, not specified here.
- Whether `duration_ms: 0` should mean "sticky until clicked." Probably yes, but confirm during build.

---

## 7. Acceptance — when is v1 done

The author can do this on their own machine, end to end, on at least one of the three OSes, with the other two functional but possibly rougher:

1. Launch the app. A dinosaur appears on the desktop and is idle.
2. From a terminal, run `alert --from "test" "hello"`. Within ~200ms, the dinosaur reacts, a speech bubble appears with the message, and disappears after 5 seconds.
3. Send 10 notifications in a loop. They queue and play through; none are lost.
4. Click the dinosaur. The hub opens and shows all 11 messages in reverse chronological order with correct timestamps.
5. Quit the app. Relaunch. The history is still there. The dinosaur reappears in the position it was last dragged to.
6. From a second machine on the same LAN (after manually rebinding the server to `0.0.0.0` — config flag is fine), `curl -X POST http://<host>:4174/notify -d '...'` produces a toast on the first machine.

Hitting all six = ship it.

---

## 8. Roadmap (post-v1, not in scope)

Three directions, in rough order of likelihood. Each is deferred deliberately — v1 ships first, gets used, and informs whether any of these earn the work.

- **Streaming endpoint and multi-client support.** A `GET /stream` (Server-Sent Events) that any client can subscribe to. The desktop app becomes one subscriber among potentially many.
- **A terminal UI.** A TUI client (`alert ui` or similar) that consumes the streaming endpoint — live toasts in the terminal plus a scrollable history view. For users who live in the CLI and don't want a desktop pet.
- **Auth and non-loopback binding.** Bearer tokens on the HTTP endpoints, so the server can safely bind to LAN-accessible addresses and accept notifications from other machines.

These three fit together — the streaming endpoint is the foundation, the TUI is one client that needs it, and auth is what makes any non-loopback use case responsible. They'd likely be designed and built as one coherent v2.
