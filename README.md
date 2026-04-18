# Webster Backend

NestJS REST + WebSocket backend for a collaborative canvas editor. Uses PostgreSQL (TypeORM) for user/project data and Apache Cassandra (event sourcing) for canvas history.

## Stack

- **NestJS** — HTTP + WebSocket (Socket.IO)
- **PostgreSQL 17** — accounts, projects, canvases metadata
- **Cassandra 5** — canvas commits and snapshots
- **JWT** in cookies (access + refresh)
- **S3** — avatar uploads

---

## Prerequisites

- Docker + Docker Compose
- Node.js 20+ (for running migrations locally or outside Docker)
- A GitHub Personal Access Token with `read:packages` scope (to install `@paranoideed/drawebster` from GitHub Packages)

---

## Setup

### 1. Environment file

Copy the example and fill in the required values:

```bash
cp .env.example .env
```

Key variables to configure:

| Variable | Required | Notes |
|---|---|---|
| `PORT` | yes | HTTP port exposed on host (e.g. `6767`) |
| `DOCS_PORT` | yes | Swagger UI port (e.g. `6969`) |
| `DB_*` | yes | PostgreSQL credentials |
| `JWT_SECRET` | yes | Any random secret string |
| `JWT_ACCESS_TTL_SEC` | yes | Access token lifetime in seconds |
| `JWT_REFRESH_TTL_SEC` | yes | Refresh token lifetime in seconds |
| `FRONTEND_URL` | yes | CORS origin (e.g. `http://localhost:5173`) |
| `GOOGLE_CLIENT_ID/SECRET` | optional | Google OAuth (leave empty to disable) |
| `GOOGLE_REDIRECT_URI` | optional | Must match Google Console config |
| `AWS_*` / `BUCKET_NAME` | optional | S3 avatar uploads |
| `SMTP_*` | optional | Email (verification, invites) |
| `CASSANDRA_*` | yes | Defaults work with Docker Compose |
| `SNAPSHOT_INTERVAL` | yes | Commits between snapshots (e.g. `5`) |
| `ASYNC_DOCS_PORT` | optional | AsyncAPI viewer port (default `3001`) |

### 2. npm auth for GitHub Packages

The project depends on `@paranoideed/drawebster` published to GitHub Packages. Set your token before installing:

```bash
export GITHUB_TOKEN=ghp_your_token_here
```

The `.npmrc` file already points `@paranoideed` to `npm.pkg.github.com` and reads the token from `$GITHUB_TOKEN`.

---

## Running with Docker Compose

### Start everything

```bash
docker-compose up
```

This starts:
- `webster-backend` — NestJS app in watch mode on `$PORT`
- `webster-postgres` — PostgreSQL 17 on `$DB_PORT`
- `webster-cassandra` — Cassandra 5 on `$CASSANDRA_PORT` (default 9042)
- `webster-docs` — Swagger UI on `$DOCS_PORT`
- `webster-docs-async` — AsyncAPI viewer on `$ASYNC_DOCS_PORT` (default 3001)

> Cassandra takes ~60 seconds to become healthy on first start. The backend waits for the health check before starting.

### Start only the databases

```bash
docker-compose up db cassandra
```

Then run the backend locally:

```bash
npm install
npm run start:dev
```

---

## Migrations

### PostgreSQL (TypeORM)

Run after the Postgres container is up:

```bash
npm run sql:migrate:up
```

Revert the last migration:

```bash
npm run sql:migrate:down
```

Migrations live in `src/db/migrations/`. The TypeORM CLI is invoked via `ts-node` with `dotenv` so it reads your `.env` automatically.

### Cassandra

Run after Cassandra is healthy (wait for the health check or ~60s on first start):

```bash
npm run cassandra:migrate:up
```

This creates the `webster` keyspace (if it doesn't exist) and runs pending CQL migrations.

Revert the last migration:

```bash
npm run cassandra:migrate:down
```

Cassandra migrations live in `src/db/cassandra/migrations/`.

---

## API Documentation

### REST (OpenAPI / Swagger)

After `docker-compose up`, open:

```
http://localhost:<DOCS_PORT>
```

To regenerate the bundled spec after editing `docs/rest/`:

```bash
npm run docs:bundle:rest
```

### WebSocket (AsyncAPI)

After `docker-compose up`, open:

```
http://localhost:<ASYNC_DOCS_PORT>
```

To regenerate the bundled spec after editing `docs/async/`:

```bash
npm run docs:bundle:async
```

---

## Local Development (without Docker)

```bash
# Install dependencies
export GITHUB_TOKEN=ghp_your_token_here
npm install

# Start in watch mode
npm run start:dev

# Lint & format
npm run lint
npm run format

# Tests
npm run test
npm run test:e2e
```

---

## WebSocket Flow

Connect to `ws://localhost:<PORT>` with Socket.IO.

1. **Join canvas** — emit `join` with `{ canva_id }` to enter a room and load canvas state.
2. **Commit changes** — emit `commit` with `{ previous, changes }`. Server validates, stores, and broadcasts the commit to all room members.
3. **Undo / Redo** — emit `undo` or `redo` with `{ head }`. Server validates the head and broadcasts it to the room.

Error events: `commit:error`, `undo:error`, `redo:error`.

Full event reference: see the AsyncAPI docs.
