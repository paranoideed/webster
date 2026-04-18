# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run start:dev       # watch mode
npm run start:debug     # debug + watch

# Build & lint
npm run build           # compile via nest build
npm run lint            # eslint --fix
npm run format          # prettier --write

# Tests
npm run test            # unit tests (jest, rootDir: src, *.spec.ts)
npm run test:watch      # jest --watch
npm run test:cov        # coverage
npm run test:e2e        # jest --config ./test/jest-e2e.json

# Database migrations (TypeORM CLI via ts-node + dotenv)
npm run migrate:up      # run pending migrations
npm run migrate:down    # revert last migration

# Cassandra migrations
npm run cassandra:migrate:up     # create keyspace + run pending migrations
npm run cassandra:migrate:down   # revert last migration

# API docs
npm run docs:bundle        # bundle docs/rest/api.yaml → docs/rest/api-bundled.yaml
npm run docs:bundle:async  # bundle docs/async/canvas.yaml → docs/async/canvas-bundled.yaml
```

To run a single test file:
```bash
npx jest src/modules/auth/auth.service.spec.ts
```

Docker Compose starts the app, a Postgres 17 container, Swagger UI, and AsyncAPI viewer:
```bash
docker-compose up
```

AsyncAPI docs (WebSocket) live in `docs/async/`. Before serving, bundle first:
```bash
npm run docs:bundle:async   # generates docs/async/canvas-bundled.yaml
docker-compose up docs-async  # serves on ASYNC_DOCS_PORT (default 3001)
```

## Environment Variables

Required in `.env`:
| Variable | Purpose |
|---|---|
| `PORT` | HTTP port (default 3000) |
| `DB_HOST / DB_PORT / DB_USERNAME / DB_PASSWORD / DB_NAME` | PostgreSQL connection |
| `JWT_SECRET` | Signing key for both access and refresh tokens |
| `JWT_ACCESS_TTL_SEC` | Access token lifetime in seconds (default 300) |
| `JWT_REFRESH_TTL_SEC` | Refresh token lifetime in seconds (default 900) |
| `FRONTEND_URL` | CORS origin + redirect target after Google OAuth |
| `GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI` | Google OAuth |
| `SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / SMTP_FROM` | Nodemailer |
| `BUCKET_NAME / AWS_REGION / AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY` | S3 uploads |
| `CASSANDRA_CONTACT_POINTS` | Comma-separated Cassandra hosts (default `localhost`; in Docker: `cassandra`) |
| `CASSANDRA_LOCAL_DC` | Cassandra local datacenter name (default `dc1`) |
| `CASSANDRA_KEYSPACE` | Cassandra keyspace (default `webster`) |
| `CASSANDRA_PORT` | Cassandra native transport port (default `9042`) |
| `SNAPSHOT_INTERVAL` | Commits between snapshots (default `10`) |
| `DOCS_PORT` | Swagger UI port |

## Architecture

### Global setup (`src/main.ts`)
- Global prefix: `webster/v1`
- CORS restricted to `FRONTEND_URL` with credentials
- JWT tokens live in **cookies** (`access` / `refresh`), not headers
- Global `ValidationPipe` with `whitelist: true, transform: true`
- `GlobalExceptionFilter` normalises all errors to `{ errors: [{ status, detail }] }`

### Database (`src/db/`)
TypeORM with PostgreSQL. The `database` singleton in `data-source.ts` is initialised once in `AppModule.onModuleInit()`. Entities use `BaseEntity` so they support Active Record (`Entity.findOneBy(...)`, `instance.save()`). Soft-deletes are used everywhere (`@DeleteDateColumn`). Migrations live in `src/db/migrations/`.

### Modules (`src/modules/`)

**auth** — accounts, authentication  
- Email/password registration creates an `Account` + `Profile` in a transaction.  
- Passwords are stored as `salt$hash$keylen` (custom `Hasher`).  
- Google OAuth: redirect → Google → callback exchanges `code` for `id_token`; auto-creates account if new.  
- `JwtAccessStrategy` (`jwt-access`) and `JwtRefreshStrategy` (`jwt-refresh`) both extract tokens from cookies. `req.user` is `{ id, role }` (access) or `{ id }` (refresh).  
- Guards: `JwtGuard`, `JwtRefreshGuard`, `OptionalJwtGuard` (in `shared/jwt.guard.ts`).  
- Email verification uses a 6-digit OTP stored in `email_verifications`, expires in 5 min.

**profile** — user profiles  
- 1-to-1 with `Account` (created in the same transaction as the account).  
- Avatar stored in S3 (`user/{accountId}/avatar_{timestamp}`); old key deleted on update.

**project** — projects and members  
- Members have roles: `owner`, `editor`, `viewer`.  
- Project creation atomically adds the creator as `owner`.  
- Invites (`ProjectInvite`) are 64-char hex tokens, expire in 24 h, sent by email.  
- Accepting an invite checks the invitee email matches the authenticated account email.

**canva** — canvas metadata + commit validation  
- Canvases are nested under projects: `/projects/:projectId/canvases`.  
- Access: any member can read; `owner` / `editor` can create, update, delete.  
- `canva.dto.ts` contains both CRUD DTOs and `CommitDto` with discriminated union validation via `class-transformer` discriminator on `op` field.  
- Canvas content (snapshots + commits) lives in Cassandra — not yet wired (next task).

**mail** (`src/modules/mail/`)  
- Nodemailer transporter, HTML emails via a private `wrap()` helper.  
- Called fire-and-forget (`void this.mail.*`) so email failures never break the main flow.

**shared** (`src/modules/shared/`)  
- `S3Service` — lazy S3Client init, `putObject`, `putProfileAvatar`, `deleteObject`.  
- `GlobalExceptionFilter` — catches all exceptions, logs 5xx with stack trace, returns JSON:API-style error body.  
- `CurrentUser` decorator — extracts `req.user` from the execution context.  
- `NullIfEmpty` transformer — converts empty strings to `null` in DTOs.
- `AppLogger` — custom logger wrapping NestJS Logger.

### DTO / Response pattern
Each module has:
- `*.dto.ts` — class-validator DTOs (JSON:API envelope: `{ data: { type, attributes, id? } }`)
- `*.response.ts` — plain functions that map entities to the API response shape
- `*.types.ts` — shared TypeScript types / enums

### Draw library (`src/draw/`)
Pure TypeScript library for canvas state management — shared logic between backend and frontend:
- `operation.ts` — `Op` constants (`as const`) + `Operation` discriminated union type
- `commit.ts` — `Commit` interface `{ number, previous, changes: Operation[] }`
- `build-snapshot.ts` — `buildSnapshot(snapshot, commits[]) → newSnapshot`; uses handler-map pattern (one function per op), deep-clones input, never mutates. Also exports `KonvaStageConfig`, `KonvaLayerConfig`, `KonvaNodeConfig`.

Undo/redo are **not commits** — they are separate WebSocket events (`undo`, `redo`) with `{ head: number }`. Each client keeps a local `head` pointer and re-renders via `buildSnapshot(snapshot, commits.slice(0, head))`. Server broadcasts the event to all room members.

### API docs
REST (OpenAPI) specs live in `docs/rest/` (split by domain), bundled into `docs/rest/api-bundled.yaml` with Redocly CLI. The Swagger UI container serves the bundled file.

AsyncAPI (WebSocket) spec lives in `docs/async/canvas.yaml` (split into spec/messages and spec/schemas). Bundle with `npm run docs:bundle:async` → `docs/async/canvas-bundled.yaml`. Served via nginx on `ASYNC_DOCS_PORT` (default 3001).

## Canvas Architecture (Cassandra + Event Sourcing)

### Overview
Canvas history is stored in Apache Cassandra using event sourcing. The driver is **cassandra-driver** (no ORM). Communication with the frontend is over **WebSocket**.

### Cassandra Tables

```cql
CREATE TABLE snapshots (
  canva_id   UUID,
  version    INT,
  body       TEXT,
  created_at TIMESTAMP,
  PRIMARY KEY (canva_id, version)
) WITH CLUSTERING ORDER BY (version DESC);

CREATE TABLE commits (
  canva_id   UUID,
  number     INT,
  previous   INT,
  changes    TEXT,
  created_at TIMESTAMP,
  PRIMARY KEY (canva_id, number)
) WITH CLUSTERING ORDER BY (number DESC);
```

### Key design decisions

- `canva_id` is the **partition key** — all data for one canvas lives on one node.
- `number` / `version` are **clustering keys** — data is sorted on disk, `LIMIT 1 DESC` is fast.
- **No foreign keys, no joins, no transactions** — all business logic in the NestJS service.
- **No UPDATE ever** — only INSERT. `IF NOT EXISTS` is used for optimistic concurrency on commits.
- `previous` in commits is a regular field (not CK) forming a **linked list** for undo/redo traversal.

### Snapshot strategy

`n` is a constant (e.g. 10).

| Event | Action |
|---|---|
| Canvas created | Insert snapshot version 0 (empty body) |
| commit `number == 2n` | Compute snapshot at commit `n`: `applyChanges(snapshot[v-1].body, commits[1..n])` → insert snapshot version 1 |
| commit `number == k*n` (k ≥ 3) | Compute snapshot at commit `(k-1)*n` → insert snapshot version k-1 |

- Snapshot version `k` always covers state at commit `(k+1) * n` for k=0, then `k * n` for k≥1.
- Frontend can undo only back to the latest snapshot — it is the hard boundary.
- The snapshot is always `n` commits behind the current HEAD.
- After creating a new snapshot, backend pushes `{ snapshot, commits[] }` to the frontend over WebSocket. `commits[]` contains only the `n` commits after the new snapshot.

### Commit flow (WebSocket)

1. Frontend sends `{ previous: number, changes: TEXT }`.
2. Backend reads `MAX(number)` for `canva_id`, sets `next = MAX + 1`.
3. `INSERT INTO commits ... IF NOT EXISTS` — if `[applied] = false`, retry from step 2.
4. Backend echoes the stored commit back to frontend.
5. If `next == 2n` or (`next > 2n` and `next % n == 0`) → compute and store new snapshot, push `{ snapshot, commits[] }` to frontend.

### Canvas load flow

1. Read latest snapshot: `SELECT * FROM snapshots WHERE canva_id = ? LIMIT 1`.
2. Derive `commit_number = (version + 1) * n` (or 0 for version 0).
3. Read commits after snapshot: `SELECT * FROM commits WHERE canva_id = ? AND number > :commit_number`.
4. Return `{ snapshot, commits[] }` to frontend.

### Frontend responsibilities

- Holds full Konva state in memory.
- Applies commits on top of snapshot to render canvas.
- Traverses `previous` links to build undo/redo tree.
- Never sends full canvas state — only diffs in `changes`.
- On WebSocket reconnect, sends current `snapshot.version` and `MAX(number)` so backend can re-sync if needed.
