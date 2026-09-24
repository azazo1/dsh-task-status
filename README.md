<p align="center"><a href="README.zh.md">中文</a> | English</p>

<h1 align="center">task-status</h1>

<p align="center">Background task status bar: task-progress UI above the chat input area — running count + expandable details + live output tail</p>

<p align="center">
  <img src="https://badgen.net/badge/license/MIT/green" alt="license">
</p>

A background-task status bar above the chat input box: running-task count + click-to-expand per-task details + **live output tail** (auto-polling, 10-line scrolling area). Registered through the official `conversation.input.dock` slot (same family as queue/todo/goal). Ships as an official **bundle plugin** (`dsh.bundle` + dshClient channel), 0 patches.

## Preview

![task-status (real run screenshot: task rows + expanded output tail)](docs/preview/task-status.png)

## Features

**UI** (chat-page dock slot):

| Feature | Description |
|---|---|
| Status bar | Dock card above the chat input box: `⚙ N background tasks running` |
| Expandable details | Click a task row to expand: status / duration / details + output tail |
| Command hover | Hovering a task row label pops a bubble with the full command line, repeated spaces / tabs / newlines kept verbatim (no whitespace collapsing) |
| Live tail | Polls the output route every 1s while expanded and appends by cursor (official `jobs.readAt`, a non-consuming read that never contends with the `task_output` tool) |
| Manual stop | Click the stop icon on a running task, confirm in the native DSH dialog, and the agent sees the user-cancellation reason in the next job result |
| Scrolling area | Output area capped at 10 lines (160px); overflow becomes a scrollbar (tail keeps the end, scrollable to review) |
| Chat page only | Automatically hidden on non-Chat views (trajectory / taskboard, etc.) |

**Routes** (Node half):

| Route | Description |
|---|---|
| `/plugins/dsh-task-status/tasks` | Task list (read-only; needs `sessionId`; returns that session's own tasks) |
| `/plugins/dsh-task-status/output` | Task output tail (needs `id`/`sessionId` and an optional `from`; returns incremental `chunks` + resume offset `next` + retention-loss flag `lossy`) |
| `/plugins/dsh-task-status/kill` | Stop a task the session owns (`POST { id, sessionId }`); the user-cancellation reason goes to the official `jobs.kill`, which writes it into the task detail |

**Output tail data channel** (dsh 0.1.7 jobs API): the plugin reads the job's retained ring through the official `jobs.readAt(id, from, sessionId)` (256 KiB while running / 16 KiB once settled) — a non-consuming read that never advances the `task_output` tool's model cursor, so no patching is involved and both sides see the complete stream. The client resumes from `next` and keeps the last 64 KiB locally; a `lossy` read inserts one truncation notice into the output.

> Before dsh 0.1.7 the jobs API only had the consumptive `read` (`{ text, snapshot }`), and this plugin worked around cursor contention by patching `ctx.jobs.read` with a mirror read. 0.1.7 replaced the jobs service with a ring and two cursors, where that patch throws `Cannot read properties of undefined (reading 'id')`. This version targets 0.1.7 and removes the patch, so it **requires dsh >= 0.1.7** (use v0.3.1 for 0.1.6 and earlier).

## Installation

**Recommended: one-line install from a git source** (build artifacts are committed; a git source doesn't trigger a build):

```sh
dsh plugin add --profile web azazo1/dsh-task-status
```

After installing, restart web for it to take effect; you can disable or enable it in the Plugins panel on the settings page.

## Usage

Run a background task and the status bar appears (e.g. the model-side `bash` tool with `run_in_background: true`):

```
⚙ 1 background task running
  ● bash-1  for i in $(seq 1 20)…   started 21:30:15   running
```

Click a task row to expand → the output tail scrolls live (a scrollbar appears once it exceeds 10 lines). The status bar disappears automatically when the task finishes.

## Development

```sh
pnpm install
pnpm run build      # tsdown: Node half (lib/index.mjs) + client bundle (lib/client.js)
```

- Node half: `src/index.mjs` (three jobs routes: `/tasks` `/output` `/kill`)
- client: `src/client/task-status.tsx` (dock-slot status bar)

## License

MIT License (example plugin in the DSH ecosystem).
