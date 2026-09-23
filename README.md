# StankoBase Pro

Industrial machine / TOiR (maintenance) management system, split into two independent
projects:

- **[frontend/](frontend/)** — React 19 + TypeScript + Vite app. Talks to `backend/`
  over REST + Socket.io.
- **[backend/](backend/)** — Node.js + TypeScript + Express + Prisma/PostgreSQL API,
  the sole source of truth (no Firebase/Firestore anywhere in this repo). See
  [backend/README.md](backend/README.md) for setup (env, migrations, seed, running it).

Each has its own `package.json`, `node_modules`, and lock file — install and run them
separately:

```bash
cd backend  && npm install && cp .env.example .env   # edit DATABASE_URL, then:
              npx prisma migrate deploy && npm run seed && npm run dev   # :4000
cd frontend && npm install && npm run dev                                # :3000
```

[MIGRATION_REPORT.md](MIGRATION_REPORT.md), at this root level because it concerns both
projects, is a record of how the app used to work on Firestore and what replaced each
piece when the frontend was rewired onto the Postgres backend.
