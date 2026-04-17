# Canvas WebSocket Implementation

## Overview

Implemented real-time canvas collaboration over Socket.IO (NestJS WebSocket gateway).
Canvas history is stored in Cassandra using event sourcing (snapshots + commits).
`n = 20` — a new snapshot is computed every 20 commits.

---

## New files

### `src/draw/constants.ts`
Defines `SNAPSHOT_INTERVAL = 20`. Single source of truth for the snapshot cadence used by
both the Cassandra service and the WS service.

### `src/db/cassandra/cassandra.service.ts`
Injectable NestJS service wrapping all Cassandra I/O. Methods:

| Method | Description |
|--------|-------------|
| `initCanvas(canvaId)` | Inserts empty snapshot (version 0) when a canvas is created |
| `getLatestSnapshot(canvaId)` | Reads the most recent snapshot row |
| `getCommitsAfter(canvaId, afterNumber)` | Reads commits with number > afterNumber, ascending |
| `getCommitRange(canvaId, from, to)` | Reads commits in [from, to], ascending |
| `getMaxCommitNumber(canvaId)` | Returns MAX(number) for the canvas, or 0 if no commits exist |
| `insertCommit(canvaId, commit)` | INSERT IF NOT EXISTS; returns true if applied, false on conflict |
| `insertSnapshot(canvaId, version, body)` | Stores a pre-computed snapshot |
| `computeAndStoreSnapshot(canvaId, newVersion, interval)` | Replays commits onto the previous snapshot, stores the result, returns new state |

### `src/modules/canva/canva.ws.service.ts`
Business logic layer for the WebSocket gateway. Decoupled from Socket.IO so it is
independently testable.

| Method | Description |
|--------|-------------|
| `checkAccess(accountId, canvaId)` | Verifies the account is a project member (any role) |
| `checkWriteAccess(accountId, canvaId)` | Verifies the account is owner or editor |
| `getCanvasState(canvaId)` | Returns `{ snapshot, commits[] }` for the current canvas state |
| `processCommit(canvaId, payload)` | Stores commit with retry loop; returns commit + optional new state |

`processCommit` uses an optimistic-concurrency loop (up to 5 retries):
1. Read `MAX(number)` → set `next = MAX + 1`
2. `INSERT IF NOT EXISTS`
3. On `[applied] = false`, retry
4. If `next >= 2n && next % n === 0`, compute and store new snapshot

### `src/modules/canva/canva.gateway.ts`
Socket.IO gateway on namespace `/canvas`.

**Authentication**: `afterInit` middleware extracts the JWT `access` cookie, verifies it
with `JwtService`, and attaches `accountId` to `socket.data`. Unauthenticated sockets
are rejected before any handler runs.

| Event (inbound) | Handler | Description |
|-----------------|---------|-------------|
| `join` | `handleJoin` | Joins room `canva:<canvaId>`, emits `joined` with canvas state to sender |
| `commit` | `handleCommit` | Stores commit, broadcasts `commit:ack`; broadcasts `snapshot` if new snapshot |
| `undo` | `handleUndo` | Broadcasts `undo` with `{ head }` to all room members |
| `redo` | `handleRedo` | Broadcasts `redo` with `{ head }` to all room members |

`undo` and `redo` are **not** commits — they are broadcast-only events. The server
stores nothing; each client independently calls `buildSnapshot(snapshot, commits.slice(0, head))`.

---

## Modified files

### `src/modules/canva/canva.module.ts`
Added providers: `CanvaGateway`, `CanvaWsService`, `CassandraService`.

### `src/main.ts`
Added `app.useWebSocketAdapter(new IoAdapter(app))` to wire Socket.IO.

---

## Dependencies added

```
@nestjs/websockets
@nestjs/platform-socket.io
socket.io
```
