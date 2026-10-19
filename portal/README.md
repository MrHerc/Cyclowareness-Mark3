# Cyclowareness portal

The Cyclowareness security-awareness portal by Safarov Industries: the learner and admin interface (lessons with the Rive mascot, league, certificates, policies, phishing simulations) plus security operations (operations centre, threat intake and approvals, incident risk, sandbox, labs, leadership view, support desk). It was rebuilt from an earlier product, following the audit in `../docs/audit/`. Built with Next.js 16 (App Router, webpack), React 19, TypeScript strict, Tailwind CSS v4, Drizzle ORM and PostgreSQL; locally it runs on an embedded database with no services to install.

## Tez başlanğıc

```bash
npm install
cp .env.example .env.local        # PowerShell: Copy-Item .env.example .env.local
npm run setup                     # miqrasiyalar + demo məlumatlar (.data/pg, Docker lazım deyil)
npm run dev                       # http://localhost:3000
```

Demo hesablar: `admin@safarovindustries.com` (tenant admin), `learner@safarovindustries.com` (işçi) və aşağıdakı cədvəldəki digər rollar. Parol: `.env.example` faylındakı `SEED_PASSWORD` dəyəri. Dev server işləyərkən `db:*` skriptlərini çalışdırmayın: lokal baza (PGlite) eyni anda yalnız bir prosesə açılır, əvvəlcə serveri dayandırın. Production üçün Docker bölməsinə baxın. Sənədin qalanı ingiliscədir.

## Contents

- [What is in the box](#what-is-in-the-box)
- [Quick start](#quick-start)
- [Demo accounts](#demo-accounts)
- [Scripts](#scripts)
- [Environment variables](#environment-variables)
- [Project layout](#project-layout)
- [Production with Docker](#production-with-docker)
- [Operations notes](#operations-notes)
- [Tests and checks](#tests-and-checks)
- [Documentation](#documentation)

## What is in the box

| Area | Where | What |
|---|---|---|
| Public site | `/{lang}` (10 languages), `/legal/privacy`, `/legal/terms`, `/sign-in` | Mascot-guided landing tour, demo request form, legal pages, PWA manifest, service worker |
| Learner app | `/`, `/learn`, `/paths`, `/league`, `/progress`, `/profile`, `/lab`, `/security`, `/sessions`, `/help` | 53 modules and 106 lessons (scenes, simulations, Lens, AI tutor), XP, levels, streaks, league, certificates, policy sign-off, labs, personal risk |
| Admin console | `/admin/...` | People, departments, assignments, campaigns (email / SMS / voice / USB simulations), policies, problem reports, reports and compliance pack, league TV mode, audit log, settings (branding, languages, SSO, SMTP, notifications, attestation, certificate, learning, protection, integrations) |
| Security operations | `/admin/ops`, `/admin/threats`, `/admin/approvals`, `/admin/incidents`, `/admin/sandbox`, `/admin/loops`, `/admin/intel`, `/admin/leadership`, `/admin/support`, `/admin/feedback`, `/admin/studio` | Operations centre, closed loops, threat intake, approval stage, incident risk, static sandbox analysis (URL and file), threat and policy intelligence, leadership board, support desk, content studio |
| Operator console | `/super` | Tenants and plans, demo requests |
| Service routes | `/t/{token}`, `/q/{token}`, `/c/{token}`, `/start`, `/api/...` | Simulation click tracking, QR traps, public certificate check, PWA start URL, exports and uploads |

Roles: `learner`, `department_head`, `executive`, `analyst`, `campaign_manager`, `content_creator`, `tenant_admin`, plus `super_admin` for the operator console. Every table carries a `tenant_id`; every query is filtered by tenant and role on the server.

## Quick start

Requirements: Node.js 22 or newer and npm. No database server is needed locally; the app uses an embedded PostgreSQL (PGlite) in `.data/pg`.

```bash
npm install
cp .env.example .env.local      # keep the defaults for local work; APP_SECRET may stay empty in development
npm run setup                   # = npm run db:migrate && npm run db:seed
npm run dev                     # http://localhost:3000
```

`npm run db:migrate` applies the SQL in `drizzle/`; `npm run db:seed` loads the demo organisation "Safarov Industries" (fictional people and departments) with a month of history: progress, campaigns, incidents, sandbox verdicts, risk trend. The seed truncates every table first, so it is safe to re-run.

Open http://localhost:3000. Anonymous visitors get the public site in their language; sign in to reach the learner app or the admin console.

## Demo accounts

All demo users belong to the demo organisation Safarov Industries (`safarovindustries.com`). The password for every account is the value of `SEED_PASSWORD` in `.env.example` (set your own `SEED_PASSWORD` before seeding to change it). The accounts are defined in `scripts/seed-data.ts`; the operator account is created in `scripts/seed.ts`.

| Email | Role | Notes |
|---|---|---|
| `admin@safarovindustries.com` | `tenant_admin` | Full admin console |
| `leader@safarovindustries.com` | `executive` | Chief executive; leadership view |
| `head@safarovindustries.com` | `department_head` | Head of the IT department |
| `analyst@safarovindustries.com` | `analyst` | Security analyst; operations centre, threats, sandbox |
| `campaigns@safarovindustries.com` | `campaign_manager` | Awareness programme manager; simulations and campaigns |
| `content@safarovindustries.com` | `content_creator` | Training and development manager; studio and policies |
| `learner@safarovindustries.com` | `learner` | Chief accountant; also has the phone number `+994 50 000 01 01` for phone sign-in (codes are shown on screen when `DEV_SHOW_OTP=1`) |
| `operator@cyclowareness.com` | `super_admin` | Operator console `/super` (platform tenant "Cyclowareness Platform") |

The other ~30 seeded people have `firstname.lastname@safarovindustries.com` addresses and the same password; they exist to make the dashboards and the league look real. Departments: Rəhbərlik, İT (with Kibertəhlükəsizlik), Maliyyə, İnsan resursları, Hüquq, İstehsalat.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Development server with webpack (`next dev --webpack`). Turbopack crashes on some Windows machines, hence the flag |
| `npm run build` | Production build (`next build --webpack`), standalone output in `.next/standalone` |
| `npm run start` | Serves the production build with `next start`. The Docker image runs the standalone `server.js` instead |
| `npm run lint` | ESLint (`eslint-config-next`) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest, `tests/**/*.test.ts` |
| `npm run db:generate` | `drizzle-kit generate`: writes a new SQL migration from `src/server/db/schema.ts` into `drizzle/` |
| `npm run db:migrate` | Applies `drizzle/` to the database: PGlite locally, `DATABASE_URL` when set |
| `npm run db:seed` | Loads the demo organisation (truncates all tables first; refuses with `NODE_ENV=production` unless `ALLOW_SEED=1`) |
| `npm run db:reset` | Deletes `.data/pg`, then migrates and seeds |
| `npm run setup` | `db:migrate` followed by `db:seed` |
| `npm run content:sync` | Meant to import `content/library` into the database on deploy. `scripts/sync-content.ts` is not in the repository yet, so the command currently fails; the seed performs the same import (`syncLibrary`) |

## Environment variables

Copy `.env.example` to `.env.local` (development) or provide the values to the container (production). `src/server/env.ts` validates them at startup; an empty value counts as "not set". Missing optional integrations degrade to safe local behaviour.

| Variable | Default | Meaning |
|---|---|---|
| `APP_URL` | `http://localhost:3000` | Public base URL. Used in emails, certificate links, phishing simulation links and page metadata |
| `APP_SECRET` | development fallback | 32+ random characters. AES-256-GCM key for stored secrets (SMTP, SSO, TOTP keys, webhook secrets) and token signing. **Required in production.** Rotating it makes already stored secrets unreadable. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |
| `DATABASE_URL` | empty | PostgreSQL connection string. Empty means the embedded PGlite database in `.data/pg` |
| `DATABASE_POOL_MAX` | `10` | node-postgres pool size (only with `DATABASE_URL`) |
| `ANTHROPIC_API_KEY` | empty | AI tutor. Without a key the tutor answers from the lesson content only |
| `ANTHROPIC_MODEL` | `claude-opus-5-5` | Model used by the tutor |
| `SMS_PROVIDER` | empty | Text messages for phone sign-in and SMS simulations. `webhook` posts `{to, text}` to `SMS_WEBHOOK_URL`. Empty: logged to the console in development, reported as unavailable in production |
| `SMS_WEBHOOK_URL` | empty | Endpoint for the `webhook` provider |
| `SMS_WEBHOOK_TOKEN` | empty | Sent as `Authorization: Bearer ...` to the webhook |
| `DEV_SHOW_OTP` | `1` in the example, `0` otherwise | Development only: show one-time sign-in codes on screen instead of sending an SMS. Ignored in production |
| `JOBS_ENABLED` | `1` | In-process job runner (see Operations notes). `0` to run jobs elsewhere |
| `TRUST_PROXY` | `0` | `1` behind a reverse proxy that sets `X-Forwarded-For` / `X-Real-IP`; used for rate limits and audit IPs |
| `SEED_PASSWORD` | see `.env.example` | Password of every account created by `npm run db:seed` |
| `SALES_EMAIL` | empty | Demo requests from the public site are emailed here (they are always stored for the operator console) |
| `ALLOW_SEED` | unset | Lets `db:seed` run with `NODE_ENV=production`. Only for throwaway environments |

The standalone server also honours `PORT` and `HOSTNAME` (the Docker image sets `3000` and `0.0.0.0`). SMTP, SSO and the other tenant integrations are not environment variables: admins configure them in Settings and they are stored encrypted with `APP_SECRET`.

## Project layout

```
portal/
├─ src/
│  ├─ app/                    App Router. Route groups share layouts, not URL segments
│  │  ├─ (site)/              public site: /[lang] landing tour (az en ru tr ro ka uk de fr it), /legal/[doc]
│  │  ├─ (auth)/              /sign-in and /account/* (password reset, invitations, 2FA)
│  │  ├─ (learner)/           learner shell: Home, learn, paths, league, progress, profile, lab, security, sessions, help
│  │  ├─ (focus)/             full-screen lesson player (/learn/[slug]/[lessonId]) and policy reader (/policies)
│  │  ├─ (admin)/             /admin console (sidebar shell) and /super operator console
│  │  ├─ (public)/            token routes without a session: /c certificates, /q QR traps, /t tracking links
│  │  ├─ (print)/             printable compliance pack and reports
│  │  ├─ api/                 JSON and file endpoints: admin exports, assets, me/export, qr, sandbox, super, t, tutor
│  │  ├─ start/               PWA start URL (session -> Home, otherwise /sign-in)
│  │  └─ layout.tsx, error.tsx, not-found.tsx, manifest.ts, robots.ts, sitemap.ts, offline/
│  ├─ server/                 server-only code
│  │  ├─ db/                  Drizzle schema, client (pg or PGlite), per-process handle
│  │  ├─ auth/                sessions, passwords (Argon2id), TOTP, sign-in links, permissions, viewer
│  │  ├─ actions/, queries/   Server Actions and read models used by the pages
│  │  ├─ services/            domain services (library sync, progress, risk, campaigns, audit, notify, secops, ...)
│  │  ├─ jobs.ts              the minute tick: campaigns, mail retries, webhooks/syslog, reminders, risk snapshots, reports
│  │  ├─ mail.ts, sms.ts, tutor.ts, ai.ts, sandbox/, reports/, lab/
│  │  └─ env.ts, crypto.ts, rate-limit.ts, request.ts, tracking.ts, landing.ts
│  ├─ components/             UI by area: shell, ui, learner, player, mascot, admin, secops, sandbox, site, support
│  ├─ lib/                    pure shared logic: domain rules, content validation, campaign templates, markdown, csv, colours
│  ├─ i18n/                   next-intl: az (default), en, ru for the app; 10 languages for the public site
│  ├─ proxy.ts                runs before every page: CSP nonce, public-site language, optimistic sign-in redirect
│  └─ instrumentation.ts      starts the job runner with the Node.js server
├─ content/                   read from disk at runtime via process.cwd(); must ship next to the server
│  ├─ landing/{lang}.json     landing copy and mascot lines, 10 languages
│  ├─ legal/{doc}.{lang}.md   privacy policy and terms (az; other languages are added as files)
│  ├─ library/                modules.json, paths.json, brands.json, i18n.az/ru.json, lessons/{module}/{id}.en.json (53 modules, 106 lessons)
│  └─ policies/*.md           policy texts loaded by the seed
├─ messages/{az,en,ru}/       UI strings in 9 namespaces (bundled at build time)
├─ drizzle/                   SQL migrations and drizzle-kit metadata
├─ public/                    icons, brand/, rive/ (mascot + wasm), sw.js, favicon
├─ scripts/                   migrate.ts, seed.ts, seed-data.ts (development); migrate.mjs, docker-entrypoint.sh (container)
├─ tests/                     Vitest (content library, i18n, ...)
├─ Dockerfile, docker-compose.yml, .dockerignore
└─ .data/pg/                  local PGlite database (do not commit)
```

Fonts come from `next/font/google` (Geologica and Noto Sans Georgian) and are downloaded at build time; the build machine needs network access.

## Production with Docker

The image is a multi-stage build (`deps` -> `builder` -> `runner`) on `node:22-bookworm-slim`. The runner contains the Next.js standalone server, `.next/static`, `public/`, `drizzle/`, `content/` and the migration script, runs as the non-root `node` user, listens on `0.0.0.0:3000` and has a `HEALTHCHECK` against `/sign-in`. On every start the entrypoint applies pending migrations (`scripts/migrate.mjs`, node-postgres) and then runs `node server.js`; a failed migration stops the container.

### With Docker Compose (PostgreSQL included)

Needs Docker Compose v2.24 or newer (for the optional `env_file`).

```bash
cp .env.example .env
# edit .env: APP_SECRET (32+ random characters, required), APP_URL=https://your.host,
#            TRUST_PROXY=1 when a reverse proxy sits in front, optionally POSTGRES_PASSWORD
docker compose up -d --build
docker compose logs -f app
```

The `app` service reads `.env`, overrides `DATABASE_URL` so it points at the `db` service, and waits for PostgreSQL to be healthy. Data lives in the named volume `pgdata`.

Demo data (optional; it truncates the database first, so only on a fresh or throwaway stack):

```bash
docker compose --profile tools run --rm seed
```

The `seed` service is built from the `builder` stage because the seed is TypeScript and uses the app's own services; it runs `npx tsx scripts/seed.ts` against the same database.

### Image only

```bash
docker build -t portal .
docker run --rm -p 3000:3000 \
  -e DATABASE_URL=postgres://user:pass@host:5432/portal \
  -e APP_SECRET=... -e APP_URL=https://your.host -e TRUST_PROXY=1 \
  portal
```

Any PostgreSQL 14+ works. `JOBS_ENABLED=1` is the default; with several replicas a PostgreSQL advisory lock makes sure only one of them runs a job tick at a time.

### In front of the container

Serve the portal over HTTPS. In production the session cookie is `__Host-cy_session` with the `Secure` flag, so browsers drop it on plain HTTP (http://localhost is the one exception browsers allow). Put nginx, Caddy or Traefik with TLS in front, forward to port 3000, set `TRUST_PROXY=1` and `APP_URL` to the public HTTPS origin. The app already sends CSP, HSTS and the other security headers itself (`next.config.ts`, `src/proxy.ts`).

### Other hosts

The job runner is an in-process interval, so the app expects a long-running Node.js server: Docker, a VM or any Node host running `npm run build && npm run start` with `DATABASE_URL` set. Serverless platforms (for example Vercel) would need `JOBS_ENABLED=0` and an external scheduler for the job tick; that is not set up here. See the [Next.js deployment documentation](https://nextjs.org/docs/app/getting-started/deploying) for platform specifics.

## Operations notes

- **Job runner.** `src/instrumentation.ts` starts it with the Node.js server (never during the build). First tick 15 s after start, then every 60 s: campaign launches, mail retries, webhook and syslog delivery, reminders, manager alerts, daily risk snapshots, scheduled reports. Every step is idempotent. With PostgreSQL a transaction-level advisory lock serialises ticks across replicas; set `JOBS_ENABLED=0` on instances that should not run jobs.
- **Migrations.** Change `src/server/db/schema.ts`, run `npm run db:generate` to produce the next SQL file in `drizzle/`, apply it with `npm run db:migrate`. Commit the SQL and `drizzle/meta`. The Docker entrypoint applies pending migrations on each start; `scripts/migrate.ts` stays the development entrypoint because it also knows PGlite.
- **PGlite is single-process.** The local database in `.data/pg` can be open in one process only. Stop `next dev` before `db:migrate`, `db:seed` or `db:reset`, and do not run two dev servers on the same folder. Delete `.data/pg` (or run `db:reset`) to start over.
- **Webpack, not Turbopack.** `next dev --turbopack` crashes on some Windows machines, so both `dev` and `build` pass `--webpack`. Keep the flag when adding scripts.
- **`APP_SECRET` is data.** Stored integration secrets are encrypted with it; losing or rotating it means re-entering SMTP, SSO and webhook secrets and re-enrolling TOTP. Back it up together with the database.
- **Seed safety.** `db:seed` truncates every table and refuses to run with `NODE_ENV=production` unless `ALLOW_SEED=1`. The compose `seed` service runs without `NODE_ENV=production`, which is why it works; never point it at real data.
- **Content lives on disk.** `content/landing`, `content/legal` and `content/library/brands.json` are read at request time from the working directory; lessons and modules are imported into the database by `syncLibrary` (today only through the seed; see `content:sync` above). After changing `content/`, rebuild the image.
- **Mail and SMS.** Outgoing email goes through the outbox table (status `logged` when no SMTP is configured, visible to admins); SMS without a provider is logged in development and reported as unavailable in production.

## Tests and checks

```bash
npm test                                   # all Vitest suites
npx vitest run tests/content.test.ts       # one file
npm run typecheck
npm run lint
```

`vitest.config.ts` aliases `@` to `src`, stubs `server-only` and uses the node environment. The content suite validates all 106 lessons against the schema in `src/lib/content/validate.ts`.

## Documentation

- `../docs/audit/` — the audit of the earlier portal that this rebuild follows: overview and routes, design tokens, learner app, admin panel, training catalogue (53 modules, 106 lessons), landing, lesson engine and mascot, screenshots, extracted content.
- `../docs/build/PLAN.md` — architecture decisions and the build phases of the hybrid portal.
- Next.js itself: [documentation](https://nextjs.org/docs) and the version-specific guides shipped in `node_modules/next/dist/docs/` (this Next.js version has breaking changes compared with older tutorials; `AGENTS.md` says the same).
