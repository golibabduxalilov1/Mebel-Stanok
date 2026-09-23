# StankoBase Pro — Backend API

PostgreSQL-backed REST API for the `StankoBase Pro` frontend (`../frontend/src`),
which consumes it directly — there is no Firebase/Firestore anywhere in this repo.
Node.js + TypeScript + Express + Prisma + JWT auth + Socket.io for real-time updates.
See `../MIGRATION_REPORT.md` for how this maps onto the app's old Firestore-based
behavior.

## Prerequisites

- Node.js 20+
- A PostgreSQL 14+ database (local install, Docker, or a managed instance)

## 1. Install dependencies

```bash
cd server
npm install
```

## 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

- `DATABASE_URL` — point it at your Postgres instance, e.g.
  `postgresql://stankobase:stankobase@localhost:5432/stankobase?schema=public`
- `JWT_SECRET` / `JWT_REFRESH_SECRET` — generate real secrets, e.g. `openssl rand -hex 32`
- `FRONTEND_ORIGIN` — the URL the Vite frontend runs on (defaults to `http://localhost:3000`, matching this repo's `npm run dev`)

If you don't have Postgres running yet, the quickest local option is Docker:

```bash
docker run --name stankobase-pg -e POSTGRES_USER=stankobase -e POSTGRES_PASSWORD=stankobase \
  -e POSTGRES_DB=stankobase -p 5432:5432 -d postgres:16
```

## 3. Run migrations

A hand-authored initial migration already lives at
`prisma/migrations/20260923075757_init/` (generated from `prisma/schema.prisma` via
`prisma migrate diff --from-empty`, since this schema was built without a live
database attached to this session). Apply it:

```bash
npx prisma migrate deploy
```

If you later change `schema.prisma`, generate the next migration the normal way:

```bash
npx prisma migrate dev --name <change-description>
```

## 4. Seed starter data

Seeds the units-of-measure reference data plus exactly one bootstrap account: a
superadmin (full-permission "Администратор" role), sourced entirely from
`SUPERADMIN_USERNAME` / `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` /
`SUPERADMIN_FULL_NAME` in `.env` (see `.env.example`). No other roles or users
are seeded — the superadmin creates them from the Users & Roles screen after
logging in.

```bash
npm run seed
```

Change `SUPERADMIN_PASSWORD` after first login in a real deployment.

## 5. Run the API

```bash
npm run dev      # tsx watch, auto-restarts on file changes
# or
npm run build && npm start
```

The API listens on `http://localhost:4000` (or `PORT` from `.env`) at the
`/api/v1` prefix, plus `GET /health`. Socket.io shares the same HTTP server and
requires the same JWT access token via `socket.handshake.auth.token`.

## Project layout

```
src/
  env.ts                zod-validated process.env
  app.ts / index.ts      Express app wiring + HTTP/Socket.io bootstrap
  lib/                    Prisma client, Socket.io emitter, local-disk storage
  middleware/              auth (JWT), permissions (RBAC), validation, error handling
  utils/                  activity log / diff, JWT signing, atomic stock adjustment
  config/permissions.ts    server-side port of the frontend's PERMISSION_TABS matrix
  modules/<name>/          routes.ts, controller.ts, service.ts, schema.ts per resource
prisma/
  schema.prisma
  migrations/
  seed.ts
uploads/                  local-disk storage root for machine_attachments (gitignored)
```

## Authentication

- `POST /api/v1/auth/login` — `{ usernameOrEmail, password }` → `{ accessToken, user }`, sets an httpOnly refresh cookie scoped to `/api/v1/auth`.
- `POST /api/v1/auth/refresh` — rotates the refresh cookie, returns a new `accessToken`.
- `POST /api/v1/auth/logout` — revokes the current refresh token.
- `GET /api/v1/auth/me` — current user profile (requires `Authorization: Bearer <accessToken>`).

Every other route requires `Authorization: Bearer <accessToken>`. Write routes additionally
require the caller's role to grant the relevant permission — see `src/config/permissions.ts`
and `src/middleware/permissions.ts`. Role permissions are baked into the access token at
login/refresh time, so a role edited mid-session takes effect on that user's next token
refresh (≤ `JWT_ACCESS_TTL`, 15 minutes by default), not instantly.

## Destructive admin action

`POST /api/v1/admin/clear-database` wipes machines, spare parts, schedules, transfers,
logs and activity history (users/roles/units of measure are preserved). It requires an
admin-role JWT **and** `{ password }` in the body matching that admin's current password —
there is no hardcoded bypass.

## Verification

```bash
npm run lint          # tsc --noEmit
curl -s -X POST localhost:4000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"usernameOrEmail":"<SUPERADMIN_USERNAME>","password":"<SUPERADMIN_PASSWORD>"}'
```
