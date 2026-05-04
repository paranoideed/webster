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
npm run docs:bundle:rest   # bundle docs/rest/api.yaml → docs/rest/api-bundled.yaml
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

**canva** — canvas metadata (HTTP CRUD)
- Canvases are nested under projects: `/projects/:projectId/canvases`.
- Access: any member can read; `owner` / `editor` can create, update, delete.
- On create, `cassandra.initCanvas(canva.id)` inserts snapshot version 0 (empty stage).
- Canvas content (snapshots + commits) lives in Cassandra, accessed via the `draw` WebSocket module.

**draw** — WebSocket gateway for real-time canvas editing
- Socket.IO namespace `/canvas`. JWT auth via cookie parsed in `afterInit` middleware.
- `join` → verify member access → emit `joined` with `{ snapshot, commits[] }`.
- `commit` → verify editor/owner → validate ops → INSERT IF NOT EXISTS (up to 5 retries) → broadcast `commit:ack`; if snapshot boundary hit, broadcast `snapshot`.
- `undo` / `redo` → validate head is within snapshot boundary → broadcast `{ head }` to all in room.
- Operation DTOs use discriminated union on `op` field (`draw.dto.ts`).

**images** — image asset library (TO BE BUILT — see plan below)

**templates** — canvas templates
- `GET /templates` — paginated list of public (system) + user's private templates.
- `GET /templates/:id` — single template (public accessible to all, private only to owner).
- `POST /templates` — create private template; body accepts a `KonvaStageConfig` object (stored as `jsonb`).
- `PATCH /templates/:id` — rename own template.
- `DELETE /templates/:id` — soft-delete own template.
- Public templates are seeded in migration `1774300000000-AddTemplates.ts` (`public = true`, `account_id = NULL`); no user can create public templates.
- CHECK constraint enforces `NOT (public = true AND account_id IS NOT NULL)`.

**mail** (`src/modules/mail/`)
- Nodemailer transporter, HTML emails via a private `wrap()` helper.
- Called fire-and-forget (`void this.mail.*`) so email failures never break the main flow.

**shared** (`src/modules/shared/`)
- `S3Service` — lazy S3Client init, `putObject`, `putProfileAvatar`, `deleteObject`. `putObject(buffer, contentType, destination)` returns `{ url }`.
- `GlobalExceptionFilter` — catches all exceptions, logs 5xx with stack trace, returns JSON:API-style error body.
- `WsExceptionFilter` — maps WS exceptions to typed error events (`commit:error`, `undo:error`, `redo:error`).
- `CurrentUser` decorator — extracts `req.user` from the execution context.
- `NullIfEmpty` transformer — converts empty strings to `null` in DTOs.
- `AppLogger` — custom logger wrapping NestJS Logger.

### DTO / Response pattern
Each module has:
- `*.dto.ts` — class-validator DTOs (JSON:API envelope: `{ data: { type, attributes, id? } }`)
- `*.response.ts` — plain functions that map entities to the API response shape
- `*.types.ts` — shared TypeScript types / enums

### Draw library (`@paranoideed/drawebster`)
npm package shared between backend and frontend. Source lives outside this repo.
- `Op` constants + `Operation` discriminated union type (10 op types)
- `Commit` interface `{ number, previous, changes: Operation[] }`
- `buildSnapshot(snapshot, commits[]) → newSnapshot` — handler-map pattern, deep-clones, never mutates
- `KonvaStageConfig`, `KonvaLayerConfig`, `KonvaNodeConfig` interfaces
- `validateCommitChanges(changes) → { valid, errors[] }` — used in gateway before persisting

Undo/redo are **not commits** — separate WS events with `{ head: number }`. Each client keeps a local `head` pointer and re-renders via `buildSnapshot(snapshot, commits.slice(0, head))`. Server broadcasts to all room members.

### Canvas storage (Cassandra + Event Sourcing)

Cassandra tables (keyspace `webster`):
```cql
snapshots: PRIMARY KEY (canva_id, version DESC)  -- body is full Konva stage JSON
commits:   PRIMARY KEY (canva_id, number DESC)   -- changes is Operation[] JSON, previous forms linked list
```

Key rules:
- **Never UPDATE** — only INSERT. `IF NOT EXISTS` for optimistic concurrency on commits.
- `canva_id` = partition key, all canvas data on one node.
- Snapshot version `k` covers canvas state at commit `k * n` (n = `SNAPSHOT_INTERVAL`).
- New snapshot triggered at commit `2n`, `3n`, `4n`, … (always `n` commits behind HEAD).
- `CassandraService` (`src/db/cassandra/cassandra.service.ts`) owns all Cassandra logic.

### Naming conventions
- REST request/response bodies: **snake_case**
- WebSocket payloads: **snake_case**
- OpenAPI and AsyncAPI schemas: **snake_case**

### API docs
REST (OpenAPI) specs live in `docs/rest/` (split by domain), bundled into `docs/rest/api-bundled.yaml` with Redocly CLI. The Swagger UI container serves the bundled file.

AsyncAPI (WebSocket) spec lives in `docs/async/canvas.yaml` (split into spec/messages and spec/schemas). Bundle with `npm run docs:bundle:async` → `docs/async/canvas-bundled.yaml`. Served via nginx on `ASYNC_DOCS_PORT` (default 3001).

---

## Implementation Plan: Images Module

Images work exactly like templates: public preset images (seeded, no owner) + user's private uploaded images. The key difference — content lives in S3, not jsonb. PostgreSQL stores only metadata + S3 key.

### Supported formats
- Upload: JPEG (`image/jpeg`), PNG (`image/png`), WebP (`image/webp`), SVG (`image/svg+xml`)
- Export: frontend-only, no backend changes needed (see Export section below)

### Step 1 — Migration `src/db/migrations/1774400000000-AddImages.ts`

```sql
CREATE TABLE images (
  id          uuid NOT NULL DEFAULT uuid_generate_v4(),
  account_id  uuid,
  name        character varying(255) NOT NULL,
  s3_key      character varying(512) NOT NULL,
  mime_type   character varying(100) NOT NULL,
  public      boolean NOT NULL DEFAULT false,
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMP WITH TIME ZONE,
  CONSTRAINT PK_images PRIMARY KEY (id),
  CONSTRAINT CHK_images_public_no_account
    CHECK (NOT (public = true AND account_id IS NOT NULL))
);

ALTER TABLE images ADD CONSTRAINT FK_images_account_id
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;
```

Public preset images are seeded in this migration with hardcoded S3 keys pointing to files that must be uploaded to S3 beforehand. S3 key pattern for presets: `images/public/{name}.{ext}`. At minimum seed 5–10 diverse stock images (landscape, portrait, abstract, etc.) — ask the user what images to seed or just create the table without seed data and add presets manually later.

### Step 2 — Entity `src/db/entity/image.entity.ts`

Mirror `template.entity.ts` structure. Fields: `id`, `accountId` (nullable), `name`, `s3Key`, `mimeType`, `public`, `createdAt`, `deletedAt`. Column names: `account_id`, `s3_key`, `mime_type`. Entity name: `images`.

### Step 3 — Module files `src/modules/images/`

**`image.service.ts`** — methods:
- `getImages(accountId, limit, offset, sort)` — query: `public = true OR account_id = accountId`, same pattern as `template.service.ts`
- `getImage(accountId, imageId)` — public accessible to all authenticated users; private only to owner
- `uploadImage(accountId, file: Express.Multer.File, name?: string)`:
  1. Validate MIME type against allowed list — throw `BadRequestException` if not allowed
  2. Validate file size ≤ 10 MB — throw `BadRequestException` if exceeded
  3. Generate S3 key: `images/{accountId}/{uuid}.{ext}` where ext derived from mimeType
  4. Call `s3.putObject(file.buffer, file.mimetype, s3Key)` — returns `{ url }`
  5. Create and save Image entity with `public: false`
  6. Return saved entity
- `deleteImage(accountId, imageId)`:
  1. Find image, verify ownership (throw `ForbiddenException` if public or wrong owner)
  2. `image.softRemove()` — soft delete in DB
  3. `s3.deleteObject(image.s3Key)` — fire-and-forget (don't await, don't throw)

**`image.controller.ts`** — endpoints:
- `GET /images` — query params: `page[limit]` (1–100, default 20), `page[offset]` (default 0), `sort` (newest|oldest, default newest). `@UseGuards(JwtGuard)`.
- `GET /images/:id` — `@UseGuards(JwtGuard)`, `@Param('id', ParseUUIDPipe)`.
- `POST /images` — `@UseGuards(JwtGuard)`, `@UseInterceptors(FileInterceptor('file'))`. Body: multipart with `file` field + optional `name` field. Use `@UploadedFile()` decorator.
- `DELETE /images/:id` — `@UseGuards(JwtGuard)`, `@HttpCode(204)`.

**`image.dto.ts`** — only `GetImagesQueryDto` (same shape as `GetTemplatesQueryDto`). No JSON:API body DTOs needed — upload uses multipart, delete has no body.

**`image.response.ts`** — `imageResponse(image: Image): object` and `imagesResponse(images, total, limit, offset, sort, baseUrl)`. Include `url` field built from S3 key using `buildFileUrl(image.s3Key)` from `s3.uploader.ts`. Response shape:
```json
{
  "data": {
    "type": "image",
    "id": "uuid",
    "attributes": {
      "name": "...",
      "url": "https://bucket.s3.region.amazonaws.com/images/...",
      "mime_type": "image/png",
      "public": false,
      "created_at": "..."
    }
  }
}
```

**`image.module.ts`** — import `PassportModule`, `JwtModule`, `MulterModule.register({ limits: { fileSize: 10 * 1024 * 1024 } })`. Providers: `ImageService`, `S3Service`, `JwtAccessStrategy`.

### Step 4 — Wire into AppModule

Add `ImagesModule` to the `imports` array in `app.module.ts`.

### Step 5 — Install multer types if missing

Check if `@types/multer` is in devDependencies. If not: `npm install --save-dev @types/multer`.

### Step 6 — OpenAPI docs `docs/rest/spec/images/`

Create `images.yaml` with all 4 endpoints following the same split-file pattern as `docs/rest/spec/template/`. Add `$ref` to `docs/rest/api.yaml`. Then `npm run docs:bundle`.

---

## Export (frontend-only, no backend work)

Canvas export is 100% frontend. Document for reference:
- **PNG**: `stage.toDataURL('image/png')` → download
- **JPEG**: `stage.toDataURL('image/jpeg', quality)` → download
- **WebP**: `stage.toDataURL('image/webp')` → download
- **SVG**: `stage.toSVG()` → download as `.svg` file

No backend endpoint needed. The backend's only responsibility is that S3 image URLs are publicly readable (CORS configured on S3 bucket) so Konva can draw cross-origin images onto the canvas without tainting it.

**Important S3 CORS note**: if S3 bucket is not configured for CORS, `stage.toDataURL()` will throw a security error when the canvas contains images from S3. The bucket must have a CORS rule allowing `GET` from `FRONTEND_URL`.
