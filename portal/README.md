# Cyclowareness portal

The Cyclowareness security-awareness portal by Safarov Industries: the learner and admin interface (lessons with the AI Sel mascot, league, certificates, policies, phishing simulations), in ten interface languages including right-to-left Arabic plus security operations (operations centre, threat intake and approvals, incident risk, sandbox, labs, leadership view, support desk). It was rebuilt from an earlier product, following the audit in `../docs/audit/`. Built with Next.js 16 (App Router, webpack), React 19, TypeScript strict, Tailwind CSS v4, Drizzle ORM and PostgreSQL; locally it runs on an embedded database with no services to install.

## Tez başlanğıc

```bash
npm install
cp .env.example .env.local        # PowerShell: Copy-Item .env.example .env.local
npm run setup                     # miqrasiyalar + demo məlumatlar (.data/pg, Docker lazım deyil)
npm run dev                       # http://localhost:3000
```

Demo hesablar: `admin@safarovindustries.com` (tenant admin), `learner@safarovindustries.com` (işçi) və aşağıdakı cədvəldəki digər rollar. Parol: `npm run setup` / `npm run demo` təşkilatı quranda bir dəfə çap edir, ya da `.env.local` faylında öz `SEED_PASSWORD` dəyəriniz. Dev server işləyərkən `db:*` skriptlərini çalışdırmayın: lokal baza (PGlite) eyni anda yalnız bir prosesə açılır, əvvəlcə serveri dayandırın. Production üçün Docker bölməsinə baxın. Sənədin qalanı ingiliscədir.

**Three-minute demo:** `npm --prefix portal run demo` from the repository root, then follow [docs/DEMO.md](../docs/DEMO.md) (the Live drill: a phishing attack on the demo organisation, compressed into 90 seconds).

## Contents

- [What is in the box](#what-is-in-the-box)
- [Quick start](#quick-start)
- [Demo accounts](#demo-accounts)
- [Scripts](#scripts)
- [Environment variables](#environment-variables)
- [Project layout](#project-layout)
- [Production with Docker](#production-with-docker)
- [Languages](#languages)
- [Legal texts](#legal-texts)
- [Narration voice](#narration-voice)
- [Operations notes](#operations-notes)
- [Tests and checks](#tests-and-checks)
- [Documentation](#documentation)

## What is in the box

| Area | Where | What |
|---|---|---|
| Public site | `/{lang}` (10 languages), `/legal/privacy`, `/legal/terms`, `/sign-in` | Mascot-guided landing tour, demo request form, legal pages, PWA manifest, service worker |
| Learner app | `/`, `/learn`, `/paths`, `/league`, `/progress`, `/profile`, `/lab`, `/security`, `/sessions`, `/help` | 53 modules and 106 lessons (scenes, simulations, Lens, AI tutor), XP, levels, streaks, league, certificates, policy sign-off, labs, personal risk |
| Admin console | `/admin/...` | People, departments, assignments, campaigns (email / SMS / USB / QR simulations; voice calls are not built, so voice campaigns never launch), policies, problem reports, reports and compliance pack, league TV mode, audit log, settings (branding, languages, SSO, SMTP, notifications, attestation, certificate, learning, protection, integrations) |
| Security operations | `/admin/ops`, `/admin/threats`, `/admin/approvals`, `/admin/incidents`, `/admin/sandbox`, `/admin/loops`, `/admin/intel`, `/admin/leadership`, `/admin/support`, `/admin/feedback`, `/admin/studio` | Operations centre, closed loops, threat intake, approval stage, incident risk, static sandbox analysis (URL and file), threat and policy intelligence, leadership board, support desk, content studio |
| Operator console | `/super` | Tenants and plans, demo requests |
| Service routes | `/t/{token}`, `/q/{token}`, `/c/{token}`, `/start`, `/api/...` | Simulation click tracking, QR traps, public certificate check, PWA start URL, exports and uploads |

Roles: `learner`, `department_head`, `executive`, `analyst`, `campaign_manager`, `content_creator`, `tenant_admin`, plus `super_admin` for the operator console. Every table carries a `tenant_id`; every query is filtered by tenant and role on the server.

## Quick start

Requirements: Node.js 24 (the version of the Docker image and CI) and npm. No database server is needed locally; the app uses an embedded PostgreSQL (PGlite) in `.data/pg`.

```bash
npm install
cp .env.example .env.local      # keep the defaults for local work; APP_SECRET may stay empty in development
npm run setup                   # = npm run db:migrate && npm run db:seed
npm run dev                     # http://localhost:3000
```

`npm run db:migrate` applies the SQL in `drizzle/`; `npm run db:seed` loads the demo organisation "Safarov Industries" (fictional people and departments) with a month of history: progress, campaigns, incidents, sandbox verdicts, risk trend. The seed truncates every table first, so it can be re-run on the local embedded database; against a `DATABASE_URL` it refuses to run unless `ALLOW_SEED=1` is set, it never runs with `NODE_ENV=production`, and it refuses a database that holds organisations other than the demo's unless `SEED_FORCE=1`. The demo data is for development and throwaway demos only, never for a customer installation (see [Production with Docker](#production-with-docker) for a real first start).

Open http://localhost:3000. Anonymous visitors get the public site in their language; sign in to reach the learner app or the admin console.

## Demo accounts

All demo users belong to the demo organisation Safarov Industries (`safarovindustries.com`). The password for every account is printed once by `npm run setup` / `npm run demo` when the organisation is built (a random value; nothing in the repository holds it), or it is your own `SEED_PASSWORD` of 12 or more characters, set in the environment or in `.env.local` before seeding. The accounts are defined in `scripts/seed-data.ts`; the operator account is created in `scripts/seed.ts`.

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
| `npm run start` | Serves the production build outside Docker: copies `public/`, `.next/static` and `content/` next to the standalone `server.js` and starts it (`scripts/start-standalone.mjs`). `next start` does not work with standalone output |
| `npm run lint` | ESLint (`eslint-config-next`) |
| `npm run typecheck` | `next typegen && tsc --noEmit` (route types first, so it works on a fresh clone) |
| `npm test` | Vitest, `tests/**/*.test.ts` |
| `npm run db:generate` | `drizzle-kit generate`: writes a new SQL migration from `src/server/db/schema.ts` into `drizzle/` |
| `npm run db:migrate` | Applies `drizzle/` to the database: PGlite locally, `DATABASE_URL` when set |
| `npm run db:seed` | Loads the demo organisation (truncates all tables first; needs `ALLOW_SEED=1` with a `DATABASE_URL`, never runs with `NODE_ENV=production`, refuses a non-demo database unless `SEED_FORCE=1`) |
| `npm run db:reset` | Deletes `.data/pg`, then migrates and seeds |
| `npm run setup` | `db:migrate` followed by `db:seed` |
| `npm run demo` | One command to a ready-to-present demo: installs dependencies if missing, creates `.env.local`, builds the demo organisation (kept on later runs; `-- --reset` rebuilds it), starts the portal and pre-compiles the walkthrough's pages (`-- --prod` for a production build, `-- --port N`; it answers on this computer only). See `../docs/DEMO.md` |
| `npm run content:sync` | Imports `content/library` (modules, lessons, learning paths) into the configured database. Idempotent: modules and lessons are matched by slug/key and updated in place, progress and assignments stay. The production server does the same on every start. Locally, stop `next dev` first (PGlite is single-process) |
| `npm run jobs` | Background worker for servers running with `JOBS_ENABLED=0`: the same advisory-locked tick every minute; `npm run jobs -- --once` runs one tick (for cron). Needs `DATABASE_URL` (PostgreSQL) and exits otherwise: the embedded database is single-process, so locally keep `JOBS_ENABLED=1`. On SIGTERM it finishes the tick in progress before exiting |

## Environment variables

Copy `.env.example` to `.env.local` (development) or provide the values to the container (production). `src/server/env.ts` validates them at startup; an empty value counts as "not set". In production an invalid value stops the server with exit code 1 (the container restarts and the log names the variable) instead of serving errors. Missing optional integrations degrade to safe local behaviour.

| Variable | Default | Meaning |
|---|---|---|
| `APP_URL` | `http://localhost:3000` (development only) | Public base URL. Used in emails, SMS, certificate links, phishing simulation links, report links, sign-in (OIDC) redirects and page metadata. **Required in production:** the server refuses to start when it is unset, uses plain `http://` or points to a loopback host (`localhost`, `127.0.0.1`, `[::1]`). HSTS is only sent for an `https://` address |
| `ALLOW_HTTP_APP_URL` | `0` | `1` lets a production server start with a plain-HTTP or loopback `APP_URL`: a plain-HTTP intranet or a local test stack only. The session cookie needs HTTPS except on `localhost` |
| `APP_SECRET` | development fallback | 32+ random characters. AES-256-GCM key for stored secrets (SMTP, SSO, TOTP keys, webhook secrets) and token signing. **Required in production.** Rotating it makes already stored secrets unreadable. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |
| `DATABASE_URL` | empty | PostgreSQL connection string. Empty means the embedded PGlite database in `.data/pg` (development) |
| `DATABASE_POOL_MAX` | `10` | node-postgres pool size, 2–100 (only with `DATABASE_URL`; the job runner holds one connection for its lock) |
| `ALLOW_EMBEDDED_DB` | `0` | `1` lets a production server use the embedded database when `DATABASE_URL` is missing. Single-process demos only; without it the server refuses to start |
| `BOOTSTRAP_OPERATOR_EMAIL` | empty | First start of a new installation: creates the platform organisation and its operator (status invited) and prints a one-time invitation link to the server log. Ignored once an operator exists |
| `ANTHROPIC_API_KEY` | empty | AI tutor, AI course generation and AI-translated lesson captions. Without a key the tutor answers from the lesson content only, course generation is off and the AI caption languages report that no captions are available (the ten shipped languages still work) |
| `ANTHROPIC_MODEL` | `claude-opus-5-5` | Model for AI course generation in the studio |
| `ANTHROPIC_TUTOR_MODEL` | `claude-haiku-5-5` | Model for the AI tutor and the AI captions. The tutor request turns thinking off at medium effort and caches the system prompt and lesson context; a model that rejects disabled thinking (`claude-opus-5-5`, `claude-sonnet-5-5`) or effort (`claude-haiku-4-5`) makes every answer fall back to the lesson text |
| `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `ELEVENLABS_VOICE_<LOCALE>` | empty | Natural lesson narration, read only by `scripts/generate-narration.ts` (see [Narration voice](#narration-voice)); the server only serves the generated files. Set them in `.env.local` only, never in the compose `.env`, whose `env_file` would hand the key to the container |
| `SMS_PROVIDER` | empty | Text messages for phone sign-in and SMS simulations. `webhook` posts `{to, text}` to `SMS_WEBHOOK_URL`. Empty: logged to the console in development, reported as unavailable in production |
| `SMS_WEBHOOK_URL` | empty | Endpoint for the `webhook` provider (required with it; the server refuses to start without) |
| `SMS_WEBHOOK_TOKEN` | empty | Sent as `Authorization: Bearer ...` to the webhook |
| `DEV_SHOW_OTP` | `1` in the example, `0` otherwise | Development only: show one-time sign-in codes on screen instead of sending an SMS. Ignored in production |
| `JOBS_ENABLED` | `1` | In-process job runner (see Operations notes). `0` on servers that should not run jobs; then run the worker (`npm run jobs`, compose profile `worker`, PostgreSQL only) somewhere, or nothing is sent |
| `TRUST_PROXY` | `0` | Number of reverse proxies in front that append to `X-Forwarded-For` (`1` for one nginx/Caddy/Traefik). The client address is taken that many entries from the right, so a value sent by the client is never used. `0` ignores proxy headers. Used for the sign-in lockout, rate limits and audit IPs. **Required behind a proxy in production:** with `0` the per-address lockout and audit IPs are off, and the public demo form can only limit per email (beyond 100 anonymous requests an hour it still stores them but stops emailing `SALES_EMAIL`) |
| `CLIENT_IP_HEADER` | `x-forwarded-for` | `x-real-ip` only when the proxy overwrites that header with the peer address |
| `HSTS_INCLUDE_SUBDOMAINS`, `HSTS_PRELOAD` | `0` | Production sends `Strict-Transport-Security: max-age=63072000`. These add `includeSubDomains` and `preload` (preload needs both): only when every host of the domain is HTTPS for good |
| `SEED_PASSWORD` | empty | Password of every account created by `npm run db:seed`. Empty: the seed generates a random one and prints it once at the end. Your own value needs 12+ characters; the seed also reads this one variable (and nothing else) from `.env.local` |
| `ALLOW_SEED` | unset | Lets `db:seed` run against a `DATABASE_URL` or with `NODE_ENV=production`. The seed empties every table: only for fresh or throwaway databases |
| `SALES_EMAIL` | empty | Demo requests from the public site are emailed here (they are always stored for the operator console). Needs the platform mail server below |
| `PLATFORM_SMTP_HOST`, `PLATFORM_SMTP_PORT` (`587`), `PLATFORM_SMTP_SECURE` (`0`), `PLATFORM_SMTP_USER`, `PLATFORM_SMTP_PASSWORD`, `PLATFORM_MAIL_FROM` | empty | Mail server for platform mail that belongs to no organisation (demo requests). `SECURE=1` for implicit TLS (465), otherwise STARTTLS is required. `PLATFORM_MAIL_FROM` is required with a host. A start-up warning names `SALES_EMAIL` without a platform server |

The standalone server also honours `PORT` and `HOSTNAME` (the Docker image sets `3000` and `0.0.0.0`). SMTP, SSO and the other tenant integrations are not environment variables: admins configure them in Settings and they are stored encrypted with `APP_SECRET`.

## Project layout

```
portal/
├─ src/
│  ├─ app/                    App Router. Route groups share layouts, not URL segments
│  │  ├─ (site)/              public site: /[lang] landing tour (az en ru tr ro ka uk de fr ar), /legal/[doc]
│  │  ├─ (auth)/              /sign-in and /account/* (password reset, invitations, 2FA)
│  │  ├─ (learner)/           learner shell: Home, learn, paths, league, progress, profile, lab, security, sessions, help
│  │  ├─ (focus)/             full-screen lesson player (/learn/[slug]/[lessonId]) and policy reader (/policies)
│  │  ├─ (admin)/             /admin console (sidebar shell) and /super operator console
│  │  ├─ (public)/            token routes without a session: /c certificates, /q QR traps, /t tracking links
│  │  ├─ (print)/             printable compliance pack and reports
│  │  ├─ api/                 JSON and file endpoints: admin exports, assets, me/export, qr, sandbox, subtitles, super, t, tutor
│  │  ├─ start/               PWA start URL (session -> Home, otherwise /sign-in)
│  │  └─ layout.tsx, error.tsx, not-found.tsx, manifest.ts, robots.ts, sitemap.ts, offline/
│  ├─ server/                 server-only code
│  │  ├─ db/                  Drizzle schema, client (pg or PGlite), per-process handle
│  │  ├─ auth/                sessions, passwords (Argon2id), TOTP, sign-in links, permissions, viewer
│  │  ├─ actions/, queries/   Server Actions and read models used by the pages
│  │  ├─ services/            domain services (library sync, progress, risk, campaigns, audit, notify, secops, ...)
│  │  ├─ jobs.ts              the minute tick: campaigns, mail retries, webhooks/syslog, reminders, risk snapshots, reports
│  │  ├─ mail.ts, sms.ts, tutor.ts, ai.ts, narration.ts, subtitles.ts, sandbox/, reports/, lab/
│  │  └─ env.ts, crypto.ts, rate-limit.ts, request.ts, tracking.ts, landing.ts
│  ├─ components/             UI by area: shell, ui, learner, player, mascot, admin, secops, sandbox, site, support
│  ├─ lib/                    pure shared logic: domain rules, content validation, campaign templates, markdown, csv, colours, tts/, motion
│  ├─ i18n/                   next-intl: the ten languages (az default) for the app and the public site; dirOf/langAttrs
│  ├─ proxy.ts                runs before every page: CSP nonce, public-site language, optimistic sign-in redirect
│  └─ instrumentation.ts      starts the job runner with the Node.js server
├─ content/                   read from disk at runtime via process.cwd(); must ship next to the server
│  ├─ landing/{lang}.json     landing copy and mascot lines, 10 languages
│  ├─ legal/{doc}.{lang}.md   privacy policy and terms, ten languages
│  ├─ library/                modules.json, paths.json, brands.json, i18n.{lang}.json, lessons/{module}/{id}.{lang}.json (53 modules, 106 lessons, 10 languages)
│  ├─ narration/{lang}/       narration manifests (word timings) written by scripts/generate-narration.ts, read by the server only
│  └─ policies/*.{lang}.md    policy texts loaded by the seed, ten languages
├─ messages/{lang}/           UI strings for the ten languages, 9 namespaces each (bundled at build time)
├─ drizzle/                   SQL migrations and drizzle-kit metadata
├─ public/                    icons, brand/, rive/ (Rive mascot + wasm), generated/tts/{lang}/ (narration clips), sw.js, favicon
├─ scripts/                   migrate.ts, seed.ts, seed-data.ts, sync-content.ts, check-lesson-locales.ts, generate-narration.ts (development); migrate.mjs, docker-entrypoint.sh (container); start-standalone.mjs, jobs.ts (other hosts, worker)
├─ tests/                     Vitest (content library, i18n, ...)
├─ Dockerfile, docker-compose.yml, .dockerignore
└─ .data/pg/                  local PGlite database (do not commit)
```

Fonts come from `next/font/google` (Geologica, Noto Sans Georgian and Noto Sans Arabic) and are downloaded at build time; the build machine needs network access.

## Production with Docker

The image is a multi-stage build (`deps` -> `builder` -> `runner`) on `node:24-trixie-slim`, pinned by its multi-arch index digest so builds are reproducible (Dependabot proposes the digest bump weekly; merge it to pick up Node security releases; `postgres:16-alpine` in the compose files is pinned the same way). The runner contains the Next.js standalone server, `.next/static`, `public/`, `drizzle/`, `content/` and the migration script, runs as the non-root `node` user, listens on `0.0.0.0:3000` and has a `HEALTHCHECK` against `/api/health` (200 only when the database answers a query, 503 otherwise; usable by load balancers too). The builder stage runs `scripts/check-lesson-locales.ts --coverage` before `next build`, so a broken lesson file or translation fails the image build, not a deployment. On every start:

1. the entrypoint checks `DATABASE_URL` and `APP_SECRET` (32+ characters) and applies pending migrations (`scripts/migrate.mjs`, node-postgres); a failure stops the container;
2. the server (`src/server/bootstrap.ts`, before it takes requests) imports the lesson library and learning paths from `content/` — idempotent, matched by slug/key, progress and assignments are never touched, so a new image brings its content changes with it; several replicas take turns on an advisory lock;
3. with `BOOTSTRAP_OPERATOR_EMAIL` set and no platform operator yet, it creates the platform organisation and the operator (invited, no password) and prints a one-time invitation link to the log, once. While that link is unused and valid (14 days), later starts print only its expiry date; after it expires, the next start prints a new one.

An invalid environment or a failed import ends the server with exit code 1 instead of a process that answers 500.

### With Docker Compose (PostgreSQL included)

Needs Docker Compose v2.24 or newer (for the optional `env_file`).

```bash
cp .env.example .env
# edit .env: APP_SECRET (32+ random characters, required), APP_URL=https://your.host (required),
#            POSTGRES_PASSWORD (required), TRUST_PROXY=1 when one reverse proxy sits in front,
#            BOOTSTRAP_OPERATOR_EMAIL=you@your-company.com for the first operator
docker compose up -d --build
docker compose logs app | grep bootstrap     # the operator's one-time invitation link
```

Open the link, set the operator password, then create the customer organisations in the operator console (`/super`): each gets its first administrator with an invitation link. The `app` service reads `.env`, overrides `DATABASE_URL` so it points at the `db` service, and waits for PostgreSQL to be healthy. Data lives in the named volume `pgdata`. The app is published on `127.0.0.1:3000` only, for the TLS proxy on the same host (Docker-published ports bypass ufw/firewalld); change the mapping to `3000:3000` only if it must be reachable directly.

Demo data is for development and throwaway demo stacks only: it **truncates every table** and loads the fictional "Safarov Industries" with ~37 accounts, the platform operator included, that all share one `SEED_PASSWORD`. Set `SEED_PASSWORD` (12 or more characters) in `.env` first, or leave it unset and the seed prints a random one once in this terminal. Never run it on a customer installation:

```bash
docker compose --profile tools run --rm seed
```

The `seed` service is built from the `builder` stage because the seed is TypeScript and uses the app's own services; it runs `npx tsx scripts/seed.ts` against the same database with `ALLOW_SEED=1` (the seed refuses any `DATABASE_URL` without it).

To run background jobs outside the web containers, set `JOBS_ENABLED=0` for `app` and start the worker: `docker compose --profile worker up -d worker`. On `docker compose stop` the worker finishes the tick in progress first; the service has `stop_grace_period: 90s` for that (keep a similar grace period on other orchestrators, for example `terminationGracePeriodSeconds` on Kubernetes).

### Image only

```bash
docker build -t portal .
docker run --rm -p 127.0.0.1:3000:3000 \
  -e DATABASE_URL='postgres://user:pass@db.example.internal:5432/portal?sslmode=verify-full' \
  -e APP_SECRET=... -e APP_URL=https://your.host -e TRUST_PROXY=1 \
  portal
```

The port is published on `127.0.0.1` only, for a TLS proxy on the same host. `TRUST_PROXY=1` is safe only when every request reaches the container through that proxy: a client that can reach port 3000 directly could otherwise send its own `X-Forwarded-For` and pick the address that the sign-in lockout, the rate limits and the audit log see. If the port must be reachable without the proxy, publish it as `3000:3000` and set `TRUST_PROXY=0`.

A database on another host must be reached over TLS: add `sslmode=verify-full` to `DATABASE_URL` (the server certificate is checked against the system CAs; add `sslrootcert=/path/to/ca.pem` for a private CA). Without `sslmode` node-postgres connects unencrypted.

Any PostgreSQL 14+ works (15+ recommended). `JOBS_ENABLED=1` is the default; with several replicas a PostgreSQL advisory lock makes sure only one of them runs a job tick at a time.

### In front of the container

Serve the portal over HTTPS. In production the session cookie is `__Host-cy_session` with the `Secure` flag, so browsers drop it on plain HTTP (http://localhost is the one exception browsers allow). Put nginx, Caddy or Traefik with TLS in front, forward to port 3000 and set `APP_URL` to the public HTTPS origin.

Client addresses (sign-in lockout per address, demo-form rate limit, audit IPs) come from `X-Forwarded-For`. Set `TRUST_PROXY` to the number of proxies that append to it: `1` for a single nginx, `2` for a CDN or load balancer in front of nginx, and so on. The address is read that many entries from the right, because everything further left was sent by the client and can be anything. For nginx:

```nginx
proxy_set_header Host $host;                                   # keep the public host (see below)
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;   # appends the real peer: TRUST_PROXY=1
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-Host $host;
# or, overwriting instead of appending:
# proxy_set_header X-Real-IP $remote_addr;                     # with CLIENT_IP_HEADER=x-real-ip
```

Without `TRUST_PROXY` the demo form can only limit per email: beyond 100 anonymous requests an hour it still stores every request for the operator console but stops emailing `SALES_EMAIL`, and the per-address sign-in lockout is off. The POST API routes (invite-link download, AI tutor) accept a browser request when its `Origin` matches `APP_URL`, the forwarded `X-Forwarded-Host` (with `TRUST_PROXY` set) or the `Host` header, so a proxy that rewrites `Host` to the upstream name (nginx's default `proxy_set_header Host $proxy_host`) still works as long as `APP_URL` is the public origin.

The app sends CSP and the other security headers itself (`next.config.ts`, `src/proxy.ts`), including `Strict-Transport-Security: max-age=63072000` on every production response (pages, API routes and static files alike). `includeSubDomains` and `preload` are opt-in (`HSTS_INCLUDE_SUBDOMAINS=1`, `HSTS_PRELOAD=1`): they force HTTPS on every host of the organisation's domain for two years, so only enable them when that is intended.

### Other hosts

The job runner is an in-process interval, so the app expects a long-running Node.js server: Docker, a VM or any Node host. Outside Docker:

```bash
npm ci && npm run build
DATABASE_URL=postgres://... node scripts/migrate.mjs     # pending migrations
npm start                                                # copies public/, .next/static, content/ next to .next/standalone/server.js and starts it
```

with the same environment as the container (`DATABASE_URL`, `APP_SECRET`, `APP_URL`, ...). The standalone build never contains the local `.data/` database: the database path is kept out of the build's file tracing, `outputFileTracingExcludes` drops it as well, and the `postbuild` script removes `.next/standalone/.data` if anything still got there. `outputFileTracingRoot` pins the layout to `.next/standalone/server.js` even when a folder above the app has its own lockfile. A production server without `DATABASE_URL` refuses to start rather than open an embedded database. Serverless platforms (for example Vercel) would need `JOBS_ENABLED=0` and `npm run jobs -- --once` from an external scheduler every minute. See the [Next.js deployment documentation](https://nextjs.org/docs/app/getting-started/deploying) for platform specifics.

## Languages

The whole portal (public site, learner app, admin console, emails, certificates, legal texts, policies and all 106 lessons) is in ten languages:

| Code | Language | Notes |
|---|---|---|
| `az` | Azerbaijani | default; the base language of seed data and policies |
| `en` | English | the original lesson files (`*.en.json`) |
| `ru` | Russian | |
| `tr` | Turkish | |
| `ro` | Romanian | |
| `ka` | Georgian | Noto Sans Georgian, loaded only on pages that show Georgian |
| `uk` | Ukrainian | |
| `de` | German | |
| `fr` | French | |
| `ar` | Arabic (Saudi Arabia) | right to left; formatted as `ar` (Western digits 0-9, Gregorian calendar), `ar-SA` only as the speech tag; Noto Sans Arabic |

- **Where the language comes from.** A signed-in person gets their profile language (among the languages the organisation switched on in Settings → Languages), otherwise the `locale` cookie, otherwise the browser's language; an unsupported browser language falls back to English outside Azerbaijan (`be`, `kk`, `ky`, `uz` read Russian). Emails and notifications go out in the recipient's language. The list is `LOCALES` in `src/i18n/config.ts`.
- **Right to left.** `dirOf()` / `langAttrs()` (`src/i18n/config.ts`) set `dir` on `<html>` and on any element whose content language differs from the page. Layout uses logical Tailwind classes only (`ms-`, `pe-`, `start-`, `text-start`); `tests/rtl-logical.test.ts` fails on a physical one outside its short allow-list. Code, URLs, addresses, phone numbers and IBANs stay left to right.
- **Interface strings** live in `messages/{locale}/*.json` (9 namespaces each). A new string goes into all ten files, translated by meaning; keys contain no dots; `tests/i18n.test.ts` checks key parity and ICU placeholders. Texts kept in code (campaign templates, lab games, certificate and attestation defaults, risk titles) are covered by `tests/in-code-locales.test.ts`.
- **Lessons** are one file per language next to the English original: `content/library/lessons/{module}/{lesson}.{locale}.json`, with the translated catalogue titles in `content/library/i18n.{locale}.json`. A translation keeps every id, answer, address and link and changes only learner-facing text; check with `npx tsx scripts/check-lesson-locales.ts --coverage` (954 of 954 translations) and load them with `npm run content:sync`. The stories stay in the fictional Azerbaijani company world in every language. Glossaries and the translation recipe: `../.claude/skills/cyclowareness-experience/references/glossaries/` and `lesson-engine.md` recipe 6.3.
- **Lesson captions in more languages.** In the lesson player, captions can show any of the ten languages from the stored translations, and, with the `ai_tutor` feature and `ANTHROPIC_API_KEY`, 65 further languages translated by AI (`POST /api/subtitles`, cached in the `ai_cache` table and shared by every learner; marked as machine translated).
- **Time zone per organisation.** Settings → Languages → Time zone (`TenantSettings.timeZone`, an IANA name such as `Europe/Berlin`, the picker lists `Intl.supportedValuesOf("timeZone")` plus `UTC`, with `Europe/Kyiv` for ICU's old `Europe/Kiev`; any named zone the runtime can format is accepted, so a saved alias survives an ICU rename, and numeric offsets are refused; `Asia/Baku` when never set, `DEFAULT_TIME_ZONE` in `src/lib/day.ts`). It decides "today" for overdue and streak and daily-XP days, the end of a due day (23:59:59 there), when scheduled reports go out (08:00 there), the times in CSV and XLSX exports, certificate years, campaign and live-session times as entered and shown, and the zone next-intl formats every page in (`src/i18n/request.ts`). Daylight saving comes from Intl (`offsetAt`/`zonedTime` in `src/lib/time.ts`), never from fixed offsets. Changing the zone moves "today" for everyone at once, so a streak can gain or lose a day on the switch.
- **Not yet reviewed by people.** The translations were made and edited by AI agents; have a native speaker read each language, and a lawyer the legal texts, before a release in that market (`../docs/build/OPEN-QUESTIONS.md` 7, 8).

## Legal texts

The Privacy Policy and the Terms of Use are `content/legal/{privacy,terms}.{lang}.md` in all ten languages, served at `/legal/privacy` and `/legal/terms`; the Azerbaijani text is binding, and `tests/legal-content.test.ts` keeps every translation on the same edition and clause numbers. The header comment `<!-- version: N; effective: YYYY-MM-DD -->` is shown on the page; when the privacy edition changes, set the same date as `consentVersion` in `content/landing/{lang}.json`, so each demo request records the edition it consented to. The Provider's identity is still `[to be provided]`. For counsel and customers:

- `../docs/legal/SUBPROCESSORS.md` — who processes what, for which purpose and where (Anthropic, ElevenLabs, hosting, mail, text messages), with the code that backs each line.
- `../docs/legal/DPA-template.md` (English) and `../docs/legal/DPA-template.az.md` (Azerbaijani) — a controller–processor data processing agreement skeleton with annexes; a template for counsel, not a signed or reviewed text.

## Narration voice

Lessons are read aloud with word-by-word highlighting. A sentence with a pre-generated clip plays in a natural ElevenLabs voice (`eleven_v3`, the model that reads all ten languages, Azerbaijani and Georgian included) with exact word timings; every other sentence, and every lesson without clips, is read by the browser's own voice (Web Speech), and nothing is read when the browser has no voice for the language.

```bash
npx tsx --env-file=.env.local scripts/generate-narration.ts --dry-run                 # characters and cost, no key needed
npx tsx --env-file=.env.local scripts/generate-narration.ts --locales az,ru --only <module>[/<lesson>] --concurrency 4
```

- **Output.** One clip per spoken sentence and language in `public/generated/tts/<locale>/<sha256>.mp3` (served with `Cache-Control: immutable`; the name hashes language, model, voice, text and `TTS_REVISION` in `src/lib/tts/key.ts`, so changed text is a new file; to remake a clip whose text did not change, such as a bad take, raise `TTS_REVISION` and rerun: every clip then gets a new name and seed, so this costs a full run of the languages generated) and one manifest per lesson in `content/narration/<locale>/<module>__<lesson>.json` with the word timings. Manifests are read by the server and handed to the player of a signed-in learner; they are never public files, because they contain the lesson text. Run the script before building the image so both folders ship with it.
- **Reruns are cheap.** Clips already on disk are reused; only new or changed sentences are sent. Failed clips are listed and retried on the next run (429 and 5xx answers are retried with backoff; a wrong key or a used-up quota stops the run).
- **Cost.** The dry run prints the exact figure. On 2026-11-04 it gave 37,724 clips and 4.01 million characters for the ten languages (from about 324,000 for Arabic to 470,000 for German per language; choose-all questions count every feedback combination): about 321 USD at about 0.08 USD per 1,000 characters, 26 to 38 USD per language. The ElevenLabs plan decides the real price.
- **Voices.** ElevenLabs is retiring its default voices on 2026-12-31, so no voice is built in: set `ELEVENLABS_VOICE_ID` (every language) and optionally `ELEVENLABS_VOICE_<LOCALE>` (`ELEVENLABS_VOICE_AZ`, `_KA`, `_AR`...). Have a native speaker of each language choose its voice from the Voice Library (Azerbaijani, Georgian and Arabic first) and listen to a sample lesson (`--only`) before generating the rest. Changing a voice regenerates that language's clips.

To generate the narration:

1. Put `ELEVENLABS_API_KEY` and the voice ids in `.env.local`.
2. `--dry-run` for the cost, then one sample lesson per language, for example `--locales az --only phishing-email/spot-the-phish`, and listen to it in the lesson player with sound on (a name read wrongly is fixed in the lesson's `spoken` text, not in what learners see).
3. Generate the languages you need: `--locales az,ru,tr,ro,ka,uk,de,fr,ar,en --concurrency 4`. Rerun after any lesson text change; only new or changed sentences are sent.
4. Ship `public/generated/tts/` and `content/narration/` with the build (`docker build` copies both). In development the player picks up new clips without a restart.

## Operations notes

- **Job runner.** `src/instrumentation.ts` starts it with the Node.js server (never during the build). First tick 15 s after start, then every 60 s: campaign launches, live drills nobody is watching (played to their end), mail retries, webhook and syslog delivery, domain re-checks, a daily retention clean-up, reminders, manager alerts, refreshers, daily risk snapshots, scheduled reports. Every step is idempotent. With PostgreSQL a session-level advisory lock on one dedicated connection serialises ticks across replicas and workers; set `JOBS_ENABLED=0` on instances that should not run jobs and run `npm run jobs` (compose profile `worker`) instead. Mail created during a tick (reminders, manager alerts, refreshers, scheduled reports, campaign simulations) is queued and sent by the mail step, never inline. Mail and webhook delivery each stop after 20 s per tick, and a mail server or receiver that is unreachable (or, for mail, refuses the sign-in) is skipped for the rest of the tick without using up the attempts of its other messages, so one dead server cannot hold up campaigns, reminders or other organisations' mail.
- **Mail retries.** A message that cannot be sent (including a DNS failure on the mail server's name) is retried 1, 2, 5, 15, 60, 240, 720 and 1440 minutes after it was queued and is then marked failed. A mail server that may not be used (private address, port not allowed) fails the message at once with `blocked_destination`. Settings → Email lists failed messages of the last week with **Resend** (one, or all). A simulation whose campaign was cancelled in the meantime is never sent, and is not offered for resending.
- **Retention.** Once a day the runner deletes sign-in attempts older than two days, expired sessions and sign-in links, watermark codes of ended sessions after 90 days, sent/failed mail and webhook/syslog deliveries after 90 days, read notifications after 400 days, cached AI tutor answers after a year and demo requests after 24 months.
- **Rate limits are shared by all instances.** The limits on the AI tutor, threat reports, sandbox checks, exports, problem reports, ratings and the demo form (`src/server/rate-limit.ts`) are counted in the `rate_limit_buckets` table with one atomic upsert per request, so they hold across replicas and restarts, like the sign-in lockout. The job runner deletes ended windows once a day.
- **Scheduled campaigns that cannot launch** (empty audience, no mail or SMS provider, a voice campaign) go back to drafts once, with the reason on the campaign page and an in-app notice to its creator and the campaign managers; they are not retried every minute.
- **Migrations.** Change `src/server/db/schema.ts`, run `npm run db:generate` to produce the next SQL file in `drizzle/`, apply it with `npm run db:migrate`. Commit the SQL and `drizzle/meta`. The Docker entrypoint applies pending migrations on each start; `scripts/migrate.ts` stays the development entrypoint because it also knows PGlite.
- **Migrations are additive.** `drizzle/0000_init.sql` is frozen (2026-11-05, ADR-034): every schema change is a new `drizzle/000N_<name>.sql` written by `npm run db:generate`, and a pushed migration is never edited. An existing local database is upgraded with `npm run db:migrate` (stop `next dev` first); `npm run db:reset` is only for starting over.
- **PGlite is single-process.** The local database in `.data/pg` can be open in one process only. Stop `next dev` before `db:migrate`, `db:seed` or `db:reset`, and do not run two dev servers on the same folder. Delete `.data/pg` (or run `db:reset`) to start over.
- **Webpack, not Turbopack.** `next dev --turbopack` crashes on some Windows machines, so both `dev` and `build` pass `--webpack`. Keep the flag when adding scripts.
- **`APP_SECRET` is data.** Stored integration secrets are encrypted with it; losing or rotating it means re-entering SMTP, SSO and webhook secrets and re-enrolling TOTP. Back it up together with the database (see Backups below).
- **Seed safety.** `db:seed` truncates every table. It runs without asking only on the local embedded database; with a `DATABASE_URL` (whatever `NODE_ENV` is) or with `NODE_ENV=production` it refuses unless `ALLOW_SEED=1`, and it prints the target host before truncating. The compose `seed` service sets `ALLOW_SEED=1` because it is meant for throwaway stacks; never point it at real data.
- **Content lives on disk.** `content/landing`, `content/legal` and `content/library/brands.json` are read at request time from the working directory; lessons, modules and learning paths are imported into the database by `syncLibrary`/`syncPaths` on every production start, by `npm run content:sync` and by the seed. After changing `content/`, rebuild the image; the next start imports the changes.
- **Mail and SMS.** Outgoing email goes through the outbox table (status `logged` when no SMTP is configured, visible to admins); SMS without a provider is logged in development and reported as unavailable in production. Platform mail without an organisation (demo requests to `SALES_EMAIL`) uses `PLATFORM_SMTP_*`.
- **Health.** `GET /api/health` answers 200 with JSON when the server can query the database and 503 `{"db":"unavailable"}` otherwise; the Docker healthcheck uses only the status. The body also says when the job runner last finished a tick (`jobs.stale` after 5 minutes) and how much mail and webhook delivery is queued (`backlog`): point an external uptime monitor at it and alert on `stale` or a growing backlog. Format: `../docs/API.md`.
- **Logs.** The server writes one line per event to stdout/stderr: JSON (`ts`, `level`, `msg`, plus `tenantId`, `userId` and other fields where known) in production, readable text in development (`src/server/log.ts`). Failed queries are logged by error name, code and stack frames only, never with their parameters.
- **Backups and recovery.** With the compose stack, `sh scripts/backup.sh` (from this folder) writes a `pg_dump -Fc` file to `backups/` and deletes dumps older than 14 days (`BACKUP_KEEP_DAYS`, `BACKUP_DIR`). Run it nightly from cron: `15 2 * * * cd /srv/portal && mkdir -p backups && sh scripts/backup.sh >> backups/backup.log 2>&1`. Copy `backups/` off the host every day (another provider or storage account), and keep `APP_SECRET` from `.env` in a separate safe place: a restored database is useless without it. `sh scripts/restore.sh backups/<file>.dump` asks for confirmation, stops `app` (and `worker`), empties the database and loads the dump in one transaction (a failed restore changes nothing; tables from migrations newer than the dump are dropped, so the next start re-applies them) and starts `app` again. Restore the latest dump into a throwaway stack once a quarter and write down how long it took. Objectives: RPO 24 h (nightly dumps), RTO the measured restore time (measure it once before the first customer goes live). Managed PostgreSQL uses the provider's backups instead; the `APP_SECRET` escrow still applies. Incident response and the other runbooks: `../docs/OPERATIONS.md`.

## Tests and checks

```bash
npm test                                   # all Vitest suites
npx vitest run tests/content.test.ts       # one file
npm run typecheck
npm run lint
npx tsx scripts/check-lesson-locales.ts --coverage   # every lesson translation: schema, parity, addresses
npx vitest run --coverage                  # with the line-coverage floor of vitest.config.ts (report in coverage/)
npx playwright install chromium            # once: the browser for the smoke suite
npm run e2e                                # browser smoke suite (e2e/), English and Arabic
CI=1 npm run e2e                           # the same against the production build (run `npm run build` first)
```

`npm run e2e` (`playwright test`) starts its own server on port 3400 (`E2E_PORT` changes it) through `e2e/server.mjs`: like `npm run demo` it rebuilds the demo organisation in the embedded database `.data/pg`, so stop `npm run dev` in the same folder first. It signs in with `SEED_PASSWORD` from the environment, else from `.env.local`, else from `.env.example`. The journeys: a learner opens Home, a module and a lesson scene; the admin opens the console, People and the campaign wizard; the operator is sent to set up two-step verification before `/super`. Failed tests keep a trace in `test-results/` (`npx playwright show-trace <file>`). CI runs the same suite against the production build in the `e2e` job, applies the migrations twice to PostgreSQL 16, checks that `drizzle/` matches the schema and builds the Docker image.

`vitest.config.ts` aliases `@` to `src`, stubs `server-only` and uses the node environment. The content suite validates all 106 lessons against the schema in `src/lib/content/validate.ts`; `tests/content-locales.test.ts` checks every translation against its English file, `tests/i18n.test.ts` the ten message catalogues and `tests/rtl-logical.test.ts` the logical CSS.

## Documentation

- `../docs/audit/` — the audit of the earlier portal that this rebuild follows: overview and routes, design tokens, learner app, admin panel, training catalogue (53 modules, 106 lessons), landing, lesson engine and mascot, screenshots, extracted content.
- `../docs/OPERATIONS.md` — incident response, post-mortem template, on-call, quarterly access review, backups, checking `TRUST_PROXY`.
- `../docs/SIMULATION-DELIVERY.md` — getting phishing simulations into the inbox: the look-alike sending domain and its proof, SPF/DKIM/DMARC, allow-listing in Microsoft 365 (Defender advanced delivery) and Google Workspace, and how clicks are counted so mail scanners do not create false ones.
- `../docs/DEMO.md` — the three-minute demo: how to run it, the talk track, what the Live drill simulates and what is real, the calibration sources.
- `../docs/build/PLAN.md` — the build phases of the hybrid portal; `DECISIONS.md` (ADRs, including the ten languages, translation, narration, captions, player, mascot, light/motion and security hardening), `PROGRESS.md`, `OPEN-QUESTIONS.md` (what still needs the owner's decision or a key).
- `../.claude/skills/cyclowareness-experience/` — the working reference for the mascot, motion, lessons, translations and the training pipeline, with the per-language glossaries.
- Next.js itself: [documentation](https://nextjs.org/docs) and the version-specific guides shipped in `node_modules/next/dist/docs/` (this Next.js version has breaking changes compared with older tutorials; `AGENTS.md` says the same).
