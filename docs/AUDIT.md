# Cyclowareness — Technical Due Diligence Audit

| | |
|---|---|
| **Prepared for** | Seed-stage investor (CTO-level technical due diligence) |
| **Repository** | `MrHerc/Cyclowareness-Mark3`, branch `main` at commit `b5c935a` (2026-11-04) |
| **Audit date** | 2026-11-05 |
| **Method** | Read-only review of the whole repository plus execution of the project's own checks. No source code was modified. |
| **Companion document** | [`docs/ROADMAP.md`](ROADMAP.md) — prioritised 30/60/90-day plan to an investor-ready MVP |

Severity scale used throughout: **Critical** (blocks a sale, a deployment or a financing; fix before anything else), **High** (material risk to customers, revenue or the next release), **Medium** (should be fixed in the next quarter), **Low** (hygiene, cheap to fix). Every finding links to the file(s) it was observed in; paths are relative to the repository root.

---

## 1. Executive summary

*(See section 9 for the full findings register. This summary is written last and reflects all findings below.)*

## 2. Scope, method and verification results

### 2.1 What was reviewed

- All application code in `portal/src` (468 files, ~56,000 lines: 67 pages, 51 layouts, 50 loading skeletons, 17 route handlers, 126 exported Server Actions, 94 client components).
- The test suite `portal/tests` (83 files, ~10,100 lines), the operational scripts in `portal/scripts`, the single SQL migration in `portal/drizzle`, the Docker packaging, and the content tree `portal/content` (1,060 lesson files = 106 lessons × 10 languages, plus modules, paths, brands, legal texts and policies).
- The build documentation in `docs/build` (plan, 33 architecture decision records, progress log, open questions, resume notes, agent workflow scripts), the specification of the original product in `docs/audit`, the business model in `docs/business`, the mascot designs in `design/` and the project skill in `.claude/skills`.
- Git history: 8 commits between 2026-10-19 and 2026-11-04, one author.

### 2.2 What was executed (results reproduced in this environment)

| Check | Command | Result |
|---|---|---|
| Dependency install | `npm ci` | Clean install, lockfile honoured |
| Type check | `npm run typecheck` (`next typegen && tsc --noEmit`) | **Pass**, 0 errors |
| Lint | `npx eslint src tests scripts --max-warnings=0` | **Pass**, 0 warnings |
| Unit tests | `npx vitest run` | **Pass**: 82 files, 2,697 tests, 36 s |
| Dependency audit | `npm audit` | 0 critical / 0 high / **8 moderate**, all in dev-only lint tooling (`minimatch` via `typescript-eslint`); no production-dependency advisories |
| Outdated packages | `npm outdated` | 15 behind latest; notable: `@anthropic-ai/sdk` 0.135 → 1.5 (major), `next` 16.4.3 → 16.4.5 (patch) |
| Production build | `npm run build` | See section 2.3 |
| Docker image | `docker build` | **Not executed** (no Docker daemon in the audit environment) |
| Browser / end-to-end | — | **Not executed**; no end-to-end suite exists in the repository (see finding T-01) |
| Live integrations (SMTP, SMS, OIDC provider, Anthropic, ElevenLabs) | — | **Not executed**; none of these has ever been exercised against a real provider by the team either (`docs/build/PROGRESS.md`, "Hələ yoxlanılmayıb") |

### 2.3 Build

The production build result is recorded in section 9 (finding B-01) once the background build finishes; the build needs outbound access to Google Fonts (`next/font/google` in `portal/src/app/layout.tsx:3`), which is itself a supply-chain and air-gap consideration for on-premise customers.

### 2.4 Independent review passes

Besides the author's own line-by-line reading of the server layer, three focused review passes were run and their verified results folded into section 9: (a) tenant isolation and authorisation across every Server Action, query and route handler; (b) test-suite quality and the demo seed; (c) client-side code quality, accessibility, performance and the content pipeline.

---

## 3. What the product does

Cyclowareness is a **multi-tenant security-awareness and human-risk-management platform** for organisations (the stated target segments are banks, government agencies and enterprises; the ten interface languages map to Azerbaijan, Turkey, Georgia, Ukraine, Romania/Moldova, Germany, France, Saudi Arabia and Russian-speaking markets). It is a rebuild of the founder's earlier product *cylosof.com*, whose source code was lost; the rebuild follows a specification reverse-engineered from the live site (`docs/audit/`) and then extends it with a security-operations layer (`docs/build/PLAN.md`).

### 3.1 Learner application (`/app`, `/learn`, `/paths`, `/league`, `/progress`, `/profile`, `/lab`, `/security`, `/sessions`, `/help`)

- **Training catalogue**: 53 modules / 106 micro-lessons in 9 categories (Email, Accounts, Social engineering, Devices, AI threats, Physical security, Data, Workplace, Incidents), 3 minutes each, shipped as JSON in `portal/content/library` and available in all ten languages.
- **Lesson player** (`portal/src/components/player`): 11 scene types (tutor beats, multiple/multi-answer choice, hotspot, swipe, order, match, branching scenario, mailbox/SMS/call simulations, recap, intro), rich "artifacts" (fake emails, SMS, chats, login pages, dialogs, files, calls) built from a brand registry, syllabus, captions in ten languages plus AI-translated subtitles in 65 more, transcript, keyboard shortcuts, speed/volume, Full/Calm/Still motion modes.
- **Mascot "AI Sel"**: a Canvas-2D storybook cat (14 moods, gestures, idle behaviours, play card on Home) replacing the original Rive robot, which is kept as a one-line fallback (ADR-022, ADR-031).
- **Narration**: word-by-word karaoke highlighting; browser speech synthesis today, with a ready ElevenLabs clip pipeline (`portal/scripts/generate-narration.ts`) that has not yet been run (ADR-028).
- **AI tutor**: Claude-backed in-lesson Q&A with PII-free lesson context, prompt caching, per-user rate limits and an offline fallback that answers from the lesson text (`portal/src/app/api/tutor/route.ts`).
- **Gamification and evidence**: XP, 16 levels, streaks with freezes, 8 badges, department league (60 % completion / 40 % reporting), attestations with stored wording, certificates with serials and public verification links (`/c/{token}`), policy sign-off with IP and timestamp.
- **Practice labs**: 4 server-scored games (inbox triage, link detective, password forge, MFA fatigue) and 3 simulated-desktop labs (phishing anatomy, process hunt, fake sign-in) whose event logs are replayed and scored on the server (`portal/src/server/lab`).
- **Learning paths**: 5 shipped paths (core, new hire, finance/BEC, technical, leaders) mapped to ISO/IEC 27001:2022, NIST CSF 2.0, CIS Controls, PCI DSS 4.0.1 and NIS2 articles, with labs unlocked after the lessons.
- **Personal security centre**: own risk score with breakdown, threat reporting (which also scores phishing simulations), static URL/file sandbox, tickets, feedback, data export and account-deletion request (GDPR-style self-service).

### 3.2 Administration console (`/admin`)

People (CSV import/export, invitations, roles, 2FA reset, anonymising deletion), department tree (merge, move, heads), assignments (everyone / department / person; fixed or "N days after joining" due dates), phishing simulation campaigns (email, SMS, voice, USB drop kit, QR; 12 templates; 5-step wizard; open/click/submit/report funnel; teachable-moment landing page), policies with versions, translations and sign-off reports, reports (CSV/XLSX, print-to-PDF compliance pack, weekly/monthly scheduled reports), league TV mode, audit log (120 action types), and a ten-tab settings area: branding with DNS-TXT domain proof, languages, identity (mandatory admin 2FA, device limit, OIDC SSO, SAML and LDAP fields), SMTP with connection test and mail journal, notification templates, attestation text, certificate wording, learning rules, content protection (blur on focus loss, watermark codes, Android screen block flag), integrations (HMAC-signed webhooks, syslog CEF/JSON).

### 3.3 Security-operations layer (the differentiator; Professional/Enterprise plans)

Operations centre, threat intake → closed loops with seven stages, an approval gate with optional dual approval for training material, incidents with IOCs, MITRE ATT&CK tags and automatic targeted training with a pass mark, a static sandbox with STIX 2.1 export, threat and policy intelligence feeds that convert into loops or policy drafts, a leadership board, a support desk with SLA timers, a content studio that drafts lessons or whole trainings with Claude and runs a three-step verification (schema, safety rules, AI review) before a human publishes.

### 3.4 Platform operator console (`/super`) and public site

Tenant creation with plans (`essentials`, `professional`, `enterprise_hrm`) and per-tenant feature overrides, forced domain proof for government domains, one-time admin reset links for support, demo-request pipeline; a ten-language public landing page with a mascot-guided tour and demo form, legal pages, PWA manifest and offline service worker.

### 3.5 Commercial model as documented

`docs/business/pricing_model.py` and `docs/business/plans.html` set list prices of **USD 2 / 3 / 4 per user per month** for the three plans, a 35 % volume band at 2,501–5,000 seats, a modelled 15-person team and a break-even analysis. Pricing is not yet confirmed by the owner (`docs/build/OPEN-QUESTIONS.md` 13).

---

## 4. Architecture

### 4.1 Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 16.4 App Router with webpack (Turbopack disabled, ADR-003), React 19.3, TypeScript strict | `portal/next.config.ts`, `portal/tsconfig.json` |
| Styling | Tailwind CSS v4 with design tokens ported from the original (`portal/src/app/globals.css`) | Logical CSS properties for RTL Arabic |
| i18n | next-intl, 10 locales × 9 message namespaces (`portal/messages`), Azerbaijani default | Lesson translations as sibling JSON files |
| Data | Drizzle ORM 0.45 on PostgreSQL 14+; embedded PGlite for local development (ADR-004) | One schema file (`portal/src/server/db/schema.ts`, 51 tables, 53 indexes), one migration |
| Validation | Zod 4 on every action input and on lesson content | |
| Auth | Own implementation: Argon2id, hashed DB sessions, TOTP + backup codes, phone OTP, OIDC relying party with PKCE (ADR-005) | `portal/src/server/auth` |
| AI | `@anthropic-ai/sdk` 0.135; tutor on Haiku 5.5, course generation on Opus 5.5, structured output via tools/JSON schema | `portal/src/server/tutor.ts`, `ai.ts`, `ai-verify.ts`, `subtitles.ts` |
| Mail / SMS / voice | nodemailer through a DB outbox with retry schedule; SMS via generic webhook provider; voice provider is a placeholder string | `portal/src/server/mail.ts`, `sms.ts` |
| Background work | In-process minute tick guarded by a Postgres advisory lock, or a separate worker (`portal/scripts/jobs.ts`); no queue or Redis (ADR-012) | `portal/src/server/jobs.ts`, `jobs-runner.ts` |
| Packaging | Multi-stage Dockerfile on `node:24-trixie-slim`, non-root, healthcheck, migrations in the entrypoint; docker-compose with PostgreSQL 16 | `portal/Dockerfile`, `portal/docker-compose.yml` |

### 4.2 Request flow

```
Browser ──► src/proxy.ts (every request)
            • per-request CSP nonce, strict-dynamic; HSTS; security headers
            • /login alias, / → /{locale} by cookie/Accept-Language/CF-IPCountry
            • optimistic redirect to /sign-in when an app path has no session cookie
        ──► App Router (RSC pages, 67)            ──► src/server/queries/*  ──► Drizzle ──► PostgreSQL
            │  data access layer: getViewer()/requirePermission()
            │  (session row + user + tenant, plan features, 2FA gate)
        ──► Server Actions ("use server", 126)   ──► actionViewer(permission) ──► services/* ──► Drizzle
            │  zod validation, tenant-scoped WHERE, audit() entry, refresh()
        ──► Route handlers (17)                   ──► apiViewer() / token checks
            exports (CSV/XLSX/STIX), tutor + subtitles streaming, SSO start/callback,
            tracking pixel + QR, public assets, /api/health
Job runner (instrumentation.ts, every 60 s, pg advisory lock)
            campaigns → mail outbox → SMS → webhooks/syslog → domain re-check → retention →
            per tenant: risk snapshot, reminders, manager alerts, refreshers, scheduled reports
```

### 4.3 Data model (51 tables)

Tenancy & identity (`tenants` with JSONB `settings`/`branding`/`features`, `departments`, `users`, `sessions`, `auth_tokens`, `login_attempts`, `rate_limit_buckets`, `audit_log`, `notifications`, `watermark_codes`); content (`modules`, `lessons`, `lesson_contents` per locale, `learning_paths`); learning (`assignments`, `module_progress`, `lesson_progress`, `answers`, `xp_events`, `attestations`, `certificates`, `policies`, `policy_versions`, `policy_signoffs`, `live_sessions`, `session_registrations`, `lab_attempts`); risk and SecOps (`behavior_risks`, `risk_snapshots`, `user_risk_snapshots`, `threat_reports`, `sandbox_analyses`, `incidents`, `loops`, `loop_events`, `materials`, `material_decisions`, `intel_items`); simulations (`campaigns`, `campaign_recipients`); support (`problem_reports`, `support_tickets`, `ticket_messages`, `feedback`); platform (`demo_requests`); delivery (`outbox`, `report_schedules`, `webhook_deliveries`, `tutor_cache`, `ai_cache`, `assets`).

Every tenant-owned table carries `tenant_id` with `ON DELETE CASCADE`; isolation is enforced in application code, not by PostgreSQL row-level security (see finding S-03). Tenant configuration (SMTP, SSO, LDAP, integrations, templates) lives in one JSONB column, read through `withDefaults()` so older rows pick up new defaults (`portal/src/lib/tenant-defaults.ts:262`).

### 4.4 Content pipeline

`content/library/modules.json` → per-lesson `*.{locale}.json` validated by `lessonFileSchema` + integrity rules + locale-parity rules (`portal/src/lib/content/validate.ts`, `locale-parity.ts`) → `syncLibrary()` upserts modules/lessons/`lesson_contents` under an advisory lock at every production start (`portal/src/server/services/library.ts`, `bootstrap.ts`). Studio-authored and AI-generated trainings live only in the database. Narration manifests (`content/narration`, not yet generated) are read server-side; clips would be served as immutable static files.

### 4.5 Security controls present

Strict CSP with nonces and `strict-dynamic`, HSTS, frame denial, Permissions-Policy; Argon2id with OWASP parameters; sessions stored as SHA-256 of a 192-bit token with sliding and absolute expiry; mandatory 2FA for console roles by default; atomic lockout counters per account × client network (IPv6 /64) and per IP; database-backed fixed-window rate limits on 20+ abuse-prone actions; SSRF guard with private-range checks, DNS pinning and port allow-lists for every tenant-configured outbound destination; response-size caps on OIDC fetches; SVG logo sanitiser; ReDoS-hardened regexes with tests; AES-256-GCM encryption of stored secrets keyed from `APP_SECRET`; HMAC-signed webhooks with timestamp; `__Host-` cookies in production; audit log with 120 action types and NUL-byte scrubbing; outbox redaction of one-time links after sending; anonymising deletion.

### 4.6 Build provenance

The whole codebase (~56k lines, 106 lessons × 10 languages, 33 ADRs) was produced between 2026-10-19 and 2026-11-04 by one founder orchestrating AI coding agents (the agent workflow scripts are committed in `docs/build/workflows/`, the resume notes in `docs/build/RESUME.md` and `OVERNIGHT-STATE.md`). Code quality is unusually consistent for that pace, but the team, process and institutional knowledge behind it are a single person plus tooling (see finding O-01).
