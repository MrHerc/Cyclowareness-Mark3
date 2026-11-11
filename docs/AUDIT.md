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

**Verdict.** Cyclowareness is a substantial, well-engineered product built in about two and a half weeks by one founder directing AI coding agents. Feature scope is closer to a Series-A product than a seed MVP: a ten-language learner app with 106 interactive lessons, an admin console, phishing simulations, a security-operations layer that turns reported threats into targeted training, and a platform operator console. The code is strict, linted, consistently validated, and, according to an independent review of every action, query and route, free of cross-tenant data access. **The risks are not in what was built but in what has not yet happened:** the platform has never been deployed, never sent a real email or signed anyone in through a real identity provider, has no CI, no end-to-end tests, no observability or backups, one engineer, legal texts that name the wrong AI provider, and no documented ownership of the training content and mascot carried over from the founder's earlier product. All of these are closable within 90 days (see [`ROADMAP.md`](ROADMAP.md)); none requires re-architecting.

| Area | Assessment | Basis |
|---|---|---|
| Product scope and UX | **Strong** | Complete learner, admin, SecOps and operator surfaces; 10 languages with RTL; accessibility foundations (section 3, section 5) |
| Architecture | **Sound for an MVP** | Modular Next.js monolith on PostgreSQL, advisory-locked job runner, Docker packaging; Baku-only time zone and per-minute whole-tenant jobs need work before scale (D-02, D-03) |
| Code quality | **Good** | Strict TypeScript, 0 lint warnings, Zod everywhere; hot spots in the lesson player and settings screens (Q-01 to Q-04) |
| Application security | **Good, one integrity gap** | Strong controls (section 4.5); training evidence is browser-asserted (S-01); demo seed exposes a shared operator password (S-04) |
| Tenant isolation | **Strong, single layer** | No cross-tenant read or write found; no database-level backstop (S-03) |
| Testing and delivery | **Weak** | 2,697 passing unit tests, 65 % of them content-parity checks; no CI, no integration or end-to-end tests (T-01 to T-03) |
| Operational readiness | **Weak** | Never deployed or run against real providers; no observability, backups or recovery plan (M-01, O-03, O-04) |
| Team and process | **Key-person risk** | One author, AI-generated code without human review, documentation mostly in Azerbaijani (O-01, O-02) |
| Legal and IP | **Blocking until documented** | Legal texts misstate the AI processor and lack the provider identity (L-01); ownership of content and mascot copied from cylosof.com is undocumented (L-02) |

**Findings by severity** (49 in total, register in section 7):

| Critical | High | Medium | Low |
|---|---|---|---|
| 2 | 12 | 24 | 11 |

**No Critical finding is a code defect.** The two Critical items are paperwork: correct the legal texts and document the chain of title.

**What to fix first** (detail and effort in the roadmap):

1. Document ownership of the inherited content and mascot, and correct the legal texts and processor list (L-02, L-01).
2. Make training evidence server-verified, as the practice labs already are (S-01).
3. Add CI with integration tests on PostgreSQL and a Playwright smoke suite; freeze the migration baseline (T-01, T-02, D-01).
4. Stand up staging against real mail, SMS, identity and AI providers; add observability and backups (M-01, O-03, O-04).
5. Align the plans with what is built and add a tenant time zone before selling outside Azerbaijan (M-02, D-02).

**Investment view.** The technical asset is real and above seed-stage norms, and the founder's AI-assisted throughput is itself a capability worth noting. Underwrite it on three conditions: chain-of-title evidence before closing, a second senior engineer hired within the first 30 days, and the 90-day roadmap's exit criteria (live design partners with measured outcomes) as a milestone for the next tranche.

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
| Browser / end-to-end | — | **Not executed**; no end-to-end suite exists in the repository (see finding T-02) |
| Live integrations (SMTP, SMS, OIDC provider, Anthropic, ElevenLabs) | — | **Not executed**; none of these has ever been exercised against a real provider by the team either (`docs/build/PROGRESS.md`, "Hələ yoxlanılmayıb") |

### 2.3 Build

`npm run build` (`next build --webpack`) **passes with no warnings**: 67 routes, all dynamic except the ten pre-rendered Open Graph images; the `postbuild` guard confirms no pre-rendered file embeds the build-time fallback URL. Standalone output is 139 MB plus 5.8 MB of static assets. The build needs outbound access to Google Fonts ([`layout.tsx:3`](../portal/src/app/layout.tsx#L3)), which matters for air-gapped on-premise customers (finding D-08).

### 2.4 Independent review passes

Besides the author's own line-by-line reading of the server layer, three focused review passes were run and their verified results folded into section 6: (a) tenant isolation and authorisation across every Server Action, query and route handler; (b) test-suite quality and the demo seed; (c) client-side code quality, accessibility, performance and the content pipeline.

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

---

## 5. Strengths (what an investor is buying)

The findings in section 6 should be read against an unusually strong base for a pre-revenue, single-founder product:

1. **Feature completeness.** Learner app, admin console, security-operations layer, operator console and public site are all implemented end to end, not mocked; 67 pages, 126 Server Actions and a minute-tick job runner cover the full lifecycle from invitation to certificate.
2. **Disciplined authorisation.** An independent review of all 18 action files, 7 query modules, 12 services, 15 route handlers and 52 admin/learner pages found **no cross-tenant read or write and no role escalation**. Tenant predicates sit in the `WHERE` clause of essentially every id-keyed query; department-head scoping is applied on every surface including CSV/XLSX/PDF exports.
3. **Security engineering above seed-stage norms** (section 4.5): strict nonce CSP, Argon2id, hashed sessions with absolute lifetime, mandatory admin 2FA by default, atomic lockouts, DB-backed rate limits, SSRF guard with DNS pinning on every tenant-configured destination, encrypted secrets, signed webhooks, CSV-formula and ReDoS hardening, outbox redaction of one-time links, anonymising deletion.
4. **Code hygiene.** TypeScript strict with 0 errors, ESLint with 0 warnings, Zod validation on every structured input, 0 `console.log` in application code, explanatory comments on almost every non-obvious decision, 33 written architecture decision records.
5. **Server-trusted where it was designed to be.** Practice labs keep their answer keys on the server and replay the learner's event log through the lab's own state machine (`portal/src/server/lab/games.ts`, `vm-action.ts`); this is the right model and shows the team knows how to keep trust server-side.
6. **Internationalisation as a moat.** Ten languages including right-to-left Arabic, enforced by tests (key parity, ICU placeholders, logical CSS, in-code text tables); 1,060 validated lesson files; no untranslated UI string was found in JSX.
7. **Accessibility foundations.** Native `<dialog>` primitives, roving-tabindex answer groups, keyboard alternatives to every drag gesture, switchable letter shortcuts (WCAG 2.1.4), 44 px touch targets enforced by a test, Full/Calm/Still motion modes that honour OS reduced-motion.
8. **Deployable artefact.** A clean production build, a hardened multi-stage Docker image (non-root, healthcheck, no capabilities), migrations in the entrypoint, an advisory-locked job runner safe for several replicas, and fail-fast environment validation.
9. **AI used with guard rails.** PII-free tutor context, prompt caching, per-user/day/tenant cost caps, offline fallbacks, and a three-step verification (schema, safety rules, AI review) before any AI-written training reaches a human approver.
10. **Clear product vision beyond compliance training**: the closed loop from reported threat to incident to targeted training to closed behaviour risk is a credible "human risk management" positioning.

---

## 6. Findings by area

Each finding gives its ID, severity, the files where it was observed, the evidence, the impact and the recommendation. The consolidated register is in section 7. IDs are referenced from [`ROADMAP.md`](ROADMAP.md).

### 6.1 Security

#### S-01 · High · Training evidence and risk inputs are asserted by the browser
- **Where:** [`learning.ts` L91–L148](../portal/src/server/actions/learning.ts#L91-L148) (`completeLessonAction`), [`progress.ts` L53–L148 and L207–L228](../portal/src/server/services/progress.ts#L53-L148) (`completeLesson`, `attestModule`), caller [`player.tsx` L255](../portal/src/components/player/player.tsx#L255), risk inputs [`risk.ts` L55–L71](../portal/src/server/services/risk.ts#L55-L71).
- **Evidence:** the server receives `answers[]` whose `correct`, `firstTry` and `outcome` are set by the browser, plus a client-supplied `seconds` (0 is accepted). It checks only that the module and lesson exist, then awards first-time XP, advances the module to `awaiting_attestation` at 100 % and, on `attestModuleAction`, stores the attestation ("I went through this module myself…"), issues a certificate with a public verification link and closes the learner's open behaviour risks, including phishing-click risks. The "furthest scene reached" gate lives only in `sessionStorage` (ADR-030). Nine scene types report `firstTry: true` unconditionally ([`scenes.tsx` L447, L670, L1001, …](../portal/src/components/player/scenes.tsx#L447)). The team has recorded the gap (`docs/build/OPEN-QUESTIONS.md` item 25).
- **Impact:** any employee can generate compliance evidence and clear their own risk flags from the browser console in seconds, and lower their personal risk score with all-correct answers. Client-reported completion is common in SCORM-based LMSs, but this product sells evidence and risk scoring to regulated buyers, whose security reviews will ask exactly this question.
- **Recommendation:** follow the labs model: open a server-side attempt when a lesson starts, record scene progress server-side, score answers on the server from `lesson_contents`, enforce a minimum dwell time, and mark evidence produced before the fix as "self-reported" in compliance exports.

#### S-02 · Medium · SSO accounts are linked by email address only
- **Where:** [`sso/callback/[tenant]/route.ts` L75–L104](../portal/src/app/api/sso/callback/%5Btenant%5D/route.ts#L75-L104).
- **Evidence:** the user is found by `users.email`; the identity provider's `iss`/`sub` pair is never stored or compared. When an administrator names a custom `emailClaim`, the `email_verified` check is skipped by design.
- **Impact:** an identity provider that lets users change the mapped claim, or a mail alias reassigned to someone else, lets that person sign in as another learner of the same organisation (privileged roles and other organisations are refused). Acknowledged in ADR-033 "open items".
- **Recommendation:** bind `iss`+`sub` at first SSO sign-in and require it afterwards; treat a changed email as a relinking event an administrator approves; allow only claims the IdP marks as verified.

#### S-03 · Medium · Tenant isolation has a single layer
- **Where:** [`schema.ts`](../portal/src/server/db/schema.ts) (51 tables, `tenant_id` on every tenant-owned table), [`0000_init.sql`](../portal/drizzle/0000_init.sql) (0 row-level-security policies).
- **Evidence:** isolation is enforced by application predicates only. The review found them correct everywhere today (section 5, item 2), but there is no automated cross-tenant test and no database-level backstop.
- **Impact:** one missed predicate in a future change becomes a cross-customer data breach; banks and agencies commonly ask for defence in depth here.
- **Recommendation:** PostgreSQL RLS with a per-transaction `app.tenant_id`, or at minimum a generated test suite that calls every action and route with another tenant's ids.

#### S-04 · High · Demo seed publishes a shared password, including for the platform operator
- **Where:** [`seed.ts` L56](../portal/scripts/seed.ts#L56), [L109–L117](../portal/scripts/seed.ts#L109-L117), [L127](../portal/scripts/seed.ts#L127); [`.env.example`](../portal/.env.example); [`docker-compose.yml`](../portal/docker-compose.yml) `seed` service; `README.md` demo-account table.
- **Evidence:** every seeded account, including `operator@cyclowareness.com` with role `super_admin`, gets the same published password, which is printed in `.env.example` and the README. The demo tenant switches mandatory admin 2FA off. The operator role always requires 2FA, but because the seeded operator has none yet, whoever knows the password is sent to enrol their own authenticator ([`profile.ts` L24–L34](../portal/src/server/actions/profile.ts#L24-L34) needs only the password).
- **Impact:** any seeded instance reachable from the internet (demo, sales or presentation copies; `CLAUDE.md` mentions one on port 3100) can be taken over at platform-operator level: every tenant, plan switches and admin reset links. The seed also truncates every table when `ALLOW_SEED=1`, which the compose service sets unconditionally.
- **Recommendation:** generate a random seed password and print it once; never seed a `super_admin`; refuse to seed when `NODE_ENV=production`; add a non-empty-database check before truncating.

#### S-05 · Medium · 11 MB request bodies are accepted by every Server Action
- **Where:** [`next.config.ts` L37](../portal/next.config.ts#L37).
- **Evidence:** the limit exists for the sandbox file upload but applies globally, including to unauthenticated actions (sign-in, password reset, demo form). Acknowledged in ADR-033 and `OPEN-QUESTIONS.md` item 23.
- **Impact:** cheap memory-pressure amplification against the public sign-in and landing pages.
- **Recommendation:** 1 MB default; move the sandbox upload to a dedicated route handler with a streaming cap (the pattern already exists in [`request-body.ts`](../portal/src/server/request-body.ts)).

#### S-06 · Medium · Account-takeover tooling without step-up authentication
- **Where:** [`people.ts` L183–L191 and L239–L250](../portal/src/server/actions/people.ts#L183-L250) (`createLinkAction`, `resetTwoFactorAction`); [`platform.ts` L136–L147](../portal/src/server/actions/platform.ts#L136-L147) (`adminLinkAction`).
- **Evidence:** a tenant administrator can clear a fellow administrator's authenticator and mint a one-hour password-reset link for them; the platform operator can mint a reset link for any administrator of any organisation. Both are audited, neither needs re-authentication, a second approver or prior notice to the target.
- **Impact:** insider and session-hijack risk; enterprise buyers expect "break-glass" governance for support access.
- **Recommendation:** step-up (password + TOTP) on these actions, notify the target and the other administrators, require a second administrator for peer administrators, and replace the operator link with a consented, time-boxed support-access grant.

#### S-07 · Medium · One application secret, no key versioning or rotation
- **Where:** [`crypto.ts` L8–L17](../portal/src/server/crypto.ts#L8-L17), [`domain-proof.ts` L22–L24](../portal/src/server/auth/domain-proof.ts#L22-L24), [`totp.ts` L42–L44](../portal/src/server/auth/totp.ts#L42-L44).
- **Evidence:** `APP_SECRET` derives the AES-GCM key for every stored secret (SMTP, SSO, LDAP, webhook, TOTP), the backup-code HMAC and each tenant's DNS proof value. Ciphertexts carry a `v1` prefix but no key id.
- **Impact:** a leaked secret cannot be rotated without re-entering every integration secret, re-enrolling every authenticator and re-publishing every customer's DNS TXT record (proofs lapse after 7 days); losing it is a data-loss event (README "APP_SECRET is data").
- **Recommendation:** envelope encryption with a key id per ciphertext and a key ring (or a KMS); derive domain-proof values from a separate, stable key.

#### S-08 · Low · Cross-tenant account-existence oracle for tenant administrators
- **Where:** [`people.ts` L70–L122 and L475–L545](../portal/src/server/actions/people.ts#L475-L545).
- **Evidence:** addresses and phone numbers are unique across the platform, and the CSV import's "check" mode reports `exists`/`phoneTaken` per row for up to 5,000 rows, writes nothing and is not rate limited.
- **Impact:** a tenant administrator can learn which addresses hold accounts at other customers.
- **Recommendation:** rate-limit previews and report addresses outside the tenant with a generic reason.

#### S-09 · Low · TOTP codes can be replayed inside their validity window
- **Where:** [`totp.ts` L21–L25](../portal/src/server/auth/totp.ts#L21-L25).
- **Evidence:** the last accepted time step is not stored, so an observed code works again for up to about 90 seconds (the 5-guess lockout still applies).
- **Recommendation:** store the last used step per user and reject reuse.

#### S-10 · Low · AI tutor answers are cached across organisations by question text
- **Where:** [`api/tutor/route.ts` L64–L70 and L116–L121](../portal/src/app/api/tutor/route.ts#L64-L121).
- **Evidence:** the cache key is locale + lesson + scene + normalised question, without the tenant; library lessons are shared, so an answer produced for one organisation is served to all.
- **Impact:** a prompt-injected or embarrassing answer obtained once is replayed to anyone asking the identical question, in every organisation.
- **Recommendation:** scope the cache per tenant or moderate answers before caching; add an operator purge view.

#### S-11 · Low · Smaller hardening items
- Inline styles are allowed by the CSP ([`proxy.ts` L48](../portal/src/proxy.ts#L48)); scripts are correctly locked down.
- `tenants.domain` has no uniqueness constraint and sign-in routing picks the first verified tenant ([`schema.ts` L135](../portal/src/server/db/schema.ts#L135), [`auth.ts` L210–L236](../portal/src/server/actions/auth.ts#L210-L236)).
- `startLessonAction` stores an unvalidated, unbounded `lessonKey` ([`learning.ts` L84–L89](../portal/src/server/actions/learning.ts#L84-L89)).
- The policy sign-off CSV, which includes every employee's sign-off IP address, is available to the `content_creator` role ([`signoffs/route.ts`](../portal/src/app/api/admin/policies/%5Bid%5D/signoffs/route.ts)).
- `npm audit`: 8 moderate advisories, all in development-only lint tooling (`minimatch` through `typescript-eslint`).

### 6.2 Code quality

#### Q-01 · Medium · Oversized modules in the product core, without component tests
- **Where:** [`scenes.tsx`](../portal/src/components/player/scenes.tsx) (1,685 lines: 11 scene components, 44 `useState`, 21 `useEffect`, 17 `react-hooks/exhaustive-deps` suppressions; `SimulationScene` alone is ~350 lines across five simulated environments), [`player.tsx`](../portal/src/components/player/player.tsx) (698 lines, 21 `useState`, a `SceneEnv` object rebuilt on every render, which is why scenes suppress effect dependencies), [`settings-tabs.tsx`](../portal/src/components/admin/settings-tabs.tsx) (1,761 lines: ten settings tabs, validation feedback applied by querying the DOM, an `as never` cast on templates), [`templates.ts`](../portal/src/lib/campaigns/templates.ts) (1,062 lines of ten-language phishing templates in TypeScript, bundled into the client-side campaign wizard).
- **Impact:** the lesson player is the product; stale-closure effects plus zero component tests mean behaviour changes there are the riskiest edits in the codebase.
- **Recommendation:** split one file per scene and per settings tab, pass a memoised scene context, move campaign templates to content JSON, and add component tests (Testing Library) for every scene type before refactoring.

#### Q-02 · Medium · 3,182-line vendored mascot engine outside lint and type checking
- **Where:** [`cat/engine.js`](../portal/src/components/mascot/cat/engine.js), excluded at [`eslint.config.mjs` L17](../portal/eslint.config.mjs#L17), typed only at its surface by `engine.d.ts`; statically imported by `cat-mascot.tsx`, so it ships on the public landing page and the sign-in page.
- **Evidence:** the file header says it is now the single source of the cat, while the ESLint comment says design changes must be re-ported from `design/mascot-cat/source/`, which still holds a 136 KB fork.
- **Impact:** single-author animation code with contradictory maintenance rules, on every first page load; regressions are visible only by eye.
- **Recommendation:** pick one source of truth, convert it to TypeScript incrementally, lazy-load it with `next/dynamic`, and add visual regression snapshots.

#### Q-03 · Medium · Inconsistent error handling and non-transactional multi-step writes
- **Where:** client: [`settings-tabs.tsx` L95–L113](../portal/src/components/admin/settings-tabs.tsx#L95-L113), [`people-client.tsx` L161–L181](../portal/src/components/admin/people-client.tsx#L161-L181), [`studio.tsx` L72–L76](../portal/src/components/secops/studio.tsx#L72-L76); only one error boundary ([`app/error.tsx`](../portal/src/app/error.tsx)). Server: [`campaigns.ts` L71–L107](../portal/src/server/services/campaigns.ts#L71-L107) (`launchCampaign`), [`progress.ts` L207–L228](../portal/src/server/services/progress.ts#L207-L228) (`attestModule`), [`workspace.ts` L184–L260](../portal/src/server/actions/workspace.ts#L184-L260) (`createAssignmentAction`); [`schema.ts` L476–L503](../portal/src/server/db/schema.ts#L476-L503).
- **Evidence:** two form patterns coexist (`useActionState` in 11 files, `useTransition` + direct call in 36) with about 15 different result shapes; only 4 client files catch a rejected action, so bulk actions and settings saves fail silently on a network or server error; a render error anywhere replaces everything below the root layout. On the server only 10 call sites use transactions: a campaign is set to `running` before its recipients are inserted one by one, and an attestation, the module status and the certificate are three separate writes; `attestations` and `certificates` have no unique key per user and module, so two concurrent attest calls can issue two certificates.
- **Impact:** partial states after failures (a running campaign with half its recipients and no way to relaunch), duplicate evidence, and silent failures for administrators.
- **Recommendation:** one `ActionResult` type and a shared client helper with toast + retry; segment-level `error.tsx` files; wrap multi-step writes in transactions; add unique indexes on `(user_id, module_id)` for attestations and module certificates.

#### Q-04 · Medium · Lesson format is unversioned and loosely validated at the edges
- **Where:** [`types.ts` L86–L87](../portal/src/lib/content/types.ts#L86-L87), [`validate.ts`](../portal/src/lib/content/validate.ts), [`scenes.tsx` L377](../portal/src/components/player/scenes.tsx#L377), reads cast without validation at [`api/tutor/route.ts` L62](../portal/src/app/api/tutor/route.ts#L62) and [`api/subtitles/route.ts` L62](../portal/src/app/api/subtitles/route.ts#L62).
- **Evidence:** no schema version anywhere in the content files; 8 of 11 scene schemas use `.passthrough()`; tutor `checkpoint` and `stage` are typed `unknown`, are not validated, and are cast and dereferenced by the player (11 English lessons use checkpoints); stored `lesson_contents.scenes` are cast to `Scene[]` on read.
- **Impact:** a malformed checkpoint passes tests, the import and the AI schema check, then crashes the player for every learner of that lesson; a future format change cannot be detected or migrated per file.
- **Recommendation:** add `formatVersion` to every lesson, validate checkpoints and remove `passthrough`, validate on read for studio and AI content.

#### Q-05 · Low · Smaller code-quality items
- Product texts in ten languages live in TypeScript maps across many modules (campaign templates, lab games, refresher and blocked-campaign notices in [`jobs.ts` L571](../portal/src/server/jobs.ts#L571) and [`campaigns.ts` L176–L199](../portal/src/server/services/campaigns.ts#L176-L199), tutor language styles), so adding an eleventh language touches code in many places (a test enforces completeness).
- 38 ESLint suppressions (23 `exhaustive-deps`, 15 `no-img-element`), 11 `as unknown as` and 8 `as never` casts.
- A test-only branch in production code: rate limits use process memory under Vitest ([`rate-limit.ts` L40–L56](../portal/src/server/rate-limit.ts#L40-L56)).
- Two known shortcuts are marked in code: SMTP connects to the first vetted address only ([`mail.ts` L122](../portal/src/server/mail.ts#L122)), and AI subtitles can be generated twice across replicas ([`subtitles.ts` L212](../portal/src/server/subtitles.ts#L212)).

### 6.3 Technical debt, scalability and performance

#### D-01 · High · The migration history is regenerated from scratch
- **Where:** [`drizzle/`](../portal/drizzle) (one migration), README "Until the first release there is one migration", ADR-019.
- **Evidence:** every schema change so far deleted and regenerated `0000_init.sql` and required `db:reset`. The container entrypoint applies migrations on every start ([`docker-entrypoint.sh`](../portal/scripts/docker-entrypoint.sh)); a regenerated init carries a newer timestamp, so on an existing database it would be re-applied, fail on existing tables and leave the container in a restart loop. Migrations have never been applied to a real PostgreSQL in tests (only PGlite).
- **Impact:** harmless today, a production outage the first time the habit continues after a customer goes live.
- **Recommendation:** freeze `0000_init.sql` now; additive migrations only; CI applies all migrations to PostgreSQL 16 and runs the smoke tests on top.

#### D-02 · High · Every organisation runs on Baku time
- **Where:** 22 files, e.g. [`time.ts`](../portal/src/lib/time.ts), [`baku-clock.ts`](../portal/src/lib/baku-clock.ts), [`gamification.ts` L28](../portal/src/lib/domain/gamification.ts#L28), [`jobs.ts` L42](../portal/src/server/jobs.ts#L42), [`xlsx.ts` L30–L33](../portal/src/server/reports/xlsx.ts#L30-L33), [`i18n/request.ts`](../portal/src/i18n/request.ts); ADR-021.
- **Evidence:** due dates end at `23:59:59+04:00`, streak and daily-XP days, scheduled reports (08:00 Baku), CSV and XLSX times, certificate years and the interface's `timeZone` are all fixed to UTC+4 without daylight saving.
- **Impact:** for the stated target markets (Saudi Arabia UTC+3; Germany, France, Romania, Ukraine with daylight saving) due dates, reminders, streaks and reports are off by one to three hours and cross day boundaries.
- **Recommendation:** an IANA `timeZone` in tenant settings (default `Asia/Baku`), routed through the existing helpers.

#### D-03 · Medium · Background work and risk recomputation will not scale linearly
- **Where:** [`jobs.ts` L44–L70](../portal/src/server/jobs.ts#L44-L70), [`risk.ts` L117–L124](../portal/src/server/services/risk.ts#L117-L124), [`workspace.ts` L274 and L285](../portal/src/server/actions/workspace.ts#L274), [`campaigns.ts` L71–L107](../portal/src/server/services/campaigns.ts#L71-L107).
- **Evidence:** every 60 seconds, for every tenant and in one serial tick, reminders, manager alerts and refreshers each resolve the tenant's full assignment graph. `recomputeRisk` issues one `UPDATE` per person; changing or removing an assignment recomputes the whole tenant inside the administrator's request; a campaign launch inserts two rows per recipient sequentially inside the request. No load test exists.
- **Impact:** fine for the 35-person demo; request timeouts and overrunning ticks are likely at tens of thousands of learners or a few dozen tenants.
- **Recommendation:** run per-tenant work hourly/daily with a `job_runs` ledger, batch risk updates in one statement, move launches and whole-tenant recomputes to the job queue, and load-test with k6 at 10 tenants × 5,000 users.

#### D-04 · Medium · Avoidable page weight
- **Where:** [`layout.tsx` L50](../portal/src/app/layout.tsx#L50) with [`i18n/messages.ts` L26–L33](../portal/src/i18n/messages.ts#L26-L33); `cat-mascot.tsx` (static import of the engine); [`profile.ts` L78–L87](../portal/src/server/actions/profile.ts#L78-L87) with [`people-client.tsx` L238](../portal/src/components/admin/people-client.tsx#L238).
- **Evidence:** `NextIntlClientProvider` has no `messages` prop, so next-intl serialises all nine namespaces (162 KB for English, 338 KB for Georgian) into every full page load, including admin and SecOps strings on the sign-in page; the 234 KB mascot engine is bundled on every surface; profile photos are stored as base64 data URLs of up to 300 KB in the `users` row, loaded with every session lookup and inlined for every person on the People page.
- **Recommendation:** pass per-route namespaces (the pattern already exists in `teachable-locale.tsx`), lazy-load the mascot, move avatars to object storage or the existing `assets` table with cached URLs.

#### D-05 · Medium · One email address can belong to only one organisation
- **Where:** [`schema.ts` L198](../portal/src/server/db/schema.ts#L198) (`users_email_idx` on `email` alone), [`people.ts` L121–L122](../portal/src/server/actions/people.ts#L121-L122).
- **Impact:** no consultants, group-company staff or managed-service partners across tenants; a tenant can squat addresses of a company that has not yet proven its domain; blocks a reseller/MSSP channel, which the pricing model counts on (25 % partner share).
- **Recommendation:** separate global identities from tenant memberships before the first partner deal.

#### D-06 · Medium · The content library is imported at every start and a single bad file stops the server
- **Where:** [`bootstrap.ts` L90–L112](../portal/src/server/bootstrap.ts#L90-L112), [`library.ts` L67–L101](../portal/src/server/services/library.ts#L67-L101), [`instrumentation.ts` L21–L28](../portal/src/instrumentation.ts#L21-L28).
- **Evidence:** 1,060 lesson files are read, validated and upserted in one advisory-locked transaction on each production start; any schema, integrity or parity error exits the process. Content changes require a new image.
- **Impact:** safe for data (atomic), but a typo in one translation becomes a crash loop at deploy, and start-up time grows with the library.
- **Recommendation:** validate content in CI (it already can), import only when a content hash changes, and skip-and-alert on a single bad lesson instead of exiting.

#### D-07 · Low · Dependency currency
- 15 packages behind their latest release, including `@anthropic-ai/sdk` 0.135 → 1.5 (major) and `next` 16.4.3 → 16.4.5; no Renovate or Dependabot; no `engines` field or `.nvmrc` (README says Node 22+, the Docker image uses Node 24).

#### D-08 · Low · Development-environment coupling
- [`.claude/launch.json`](../.claude/launch.json) and the agent workflow scripts in [`docs/build/workflows`](build/workflows) contain absolute Windows paths of the founder's machine; webpack is forced because Turbopack crashed on that machine (ADR-003); the build downloads Google Fonts, which fails in air-gapped on-premise builds.

#### D-09 · Low · Dead weight in the repository and image
- [`public/rive`](../portal/public/rive) ships 4.1 MB (two wasm runtimes and `mascot.riv`) for the inactive Rive mascot, plus the `@rive-app/react-canvas` dependency; `design/` holds about 10 MB of PNG sheets; [`public/fonts/DejaVuSans.ttf`](../portal/public/fonts) (740 KB) serves only the Open Graph route.

#### D-10 · Low · Platform-wide lookups per request
- All modules and lessons of every tenant are read as lookup maps on the admin overview and catalogue ([`queries/admin.ts` L111–L115](../portal/src/server/queries/admin.ts#L111-L115), [`queries/catalog.ts`](../portal/src/server/queries/catalog.ts)); correct today because only tenant-derived ids are looked up, but O(platform) per request and one refactor away from a leak.

### 6.4 Testing and delivery

#### T-01 · High · No continuous integration
- **Evidence:** no `.github/workflows`, GitLab, Jenkins, CircleCI or pre-commit configuration exists; the [`Dockerfile`](../portal/Dockerfile) builds without running tests; checks run only when someone runs them by hand. The history has eight commits, the largest adding 387,000 lines at once, so changes cannot be reviewed commit by commit either.
- **Impact:** nothing prevents a broken build, a failing test or a broken migration from reaching an image.
- **Recommendation:** GitHub Actions on every pull request (section 1.2 of the roadmap), branch protection and required checks.

#### T-02 · High · No integration or end-to-end tests of the running application
- **Evidence:** the suite is unit-level: of 2,697 tests, about 1,760 (65 %) are generated translation and content-parity checks; 89 run against an in-memory PGlite with the real migration; 45 exercise Server Actions through hand-written database fakes; none starts the app, drives a browser, or uses node-postgres against PostgreSQL. Untested paths include the SSO start and callback routes, the job runner (`runJobs`, webhook delivery, scheduled launches), 13 of 16 route handlers, every page and every admin client component. The "browser verification in ten languages" in `docs/build/PROGRESS.md` was performed by one-off agent sessions on the founder's machine and is not reproducible from the repository.
- **Impact:** regressions in the flows customers pay for are found by customers.
- **Recommendation:** integration tests on real PostgreSQL (testcontainers) for the critical flows and a Playwright smoke suite, both in CI.

#### T-03 · Medium · The headline test count overstates behavioural coverage
- **Where:** [`tests/content-locales.test.ts`](../portal/tests/content-locales.test.ts), [`tests/in-code-locales.test.ts`](../portal/tests/in-code-locales.test.ts), [`tests/auth-actions-session.test.ts`](../portal/tests/auth-actions-session.test.ts), [`tests/demo-action.test.ts`](../portal/tests/demo-action.test.ts).
- **Evidence:** 834 `it`/`test` declarations expand to 2,697 cases through loops; there is no coverage measurement; some fakes depend on the exact order of queries; one demo-form test passes while the action throws internally; a missing translation file does not fail Vitest (only the manual checker reports coverage). The behavioural tests that do exist are precise and well targeted at concurrency, lockouts, SSRF and ReDoS.
- **Recommendation:** report behavioural and content tests separately, add coverage reporting with a floor, and replace order-coupled fakes with PGlite-backed tests.

### 6.5 Missing components and product readiness

#### M-01 · High · Never exercised against real providers or a real deployment
- **Evidence:** by the team's own record ([`PROGRESS.md` L61](build/PROGRESS.md)) the product has not sent real email, SMS or calls, has not signed anyone in through a real identity provider, has not called the Anthropic API for the tutor, subtitles or studio, has not generated narration, and the Docker image has not been built. There is no staging or production environment and no customer.
- **Impact:** the core simulation channel (email) and enterprise sign-in are unproven in practice; deliverability, provider quirks and operational issues are all still ahead.
- **Recommendation:** a staging environment with real SMTP, one SMS gateway, Entra ID and Keycloak, and the Anthropic key, before the first pilot.

#### M-02 · High · Plans include features that are not built, and some settings do nothing
- **Where:** [`tenant-defaults.ts` L286–L291](../portal/src/lib/tenant-defaults.ts#L286-L291), [`settings.ts` L178–L214](../portal/src/server/actions/settings.ts#L178-L214), [`campaigns.ts` L43 and L89–L104](../portal/src/server/services/campaigns.ts#L89-L104), [`sso/start/route.ts` L17](../portal/src/app/api/sso/start/route.ts#L17), [`sms.ts`](../portal/src/server/sms.ts).
- **Evidence:** the Professional plan lists `sso`, `ldap` and `sms_voice`. Only OpenID Connect is implemented: SAML fields are stored but no SAML flow exists; LDAP settings (including a bind password and certificate pin) are saved but no LDAP client exists; voice campaigns have no telephony code, and once `VOICE_PROVIDER` is set to any value they record every recipient as "sent" without placing a call; SMS supports only a generic webhook; the "Android screen block" protection setting has no Android app to act on. There is no SCIM.
- **Impact:** a customer buying Professional for directory sync or voice phishing gets settings screens and delivery records for features that do not exist; this is a misrepresentation and refund risk.
- **Recommendation:** hide unbuilt options and remove them from plan descriptions until implemented; make voice campaigns refuse to launch without a real adapter.

#### M-03 · High · Seven of ten languages, including the legal texts, have not been reviewed by people
- **Evidence:** the interface, 742 lesson files and the legal texts in tr, ro, ka, uk, de, fr and ar were translated and edited by AI agents; native review and legal review are open (`OPEN-QUESTIONS.md` items 7, 8 and 22).
- **Impact:** errors in a new market undermine a product whose credibility rests on precise security guidance; legal texts in an unreviewed translation may not be enforceable.
- **Recommendation:** launch with az, en and ru; add each further language only after native and legal review.

#### M-04 · Medium · Natural-voice narration has not been generated
- **Evidence:** the ElevenLabs pipeline exists but no clips or manifests are in the repository (ADR-028, about USD 321 for all ten languages); without them lessons rely on the browser's voice, and Chrome on Windows has no Azerbaijani voice, so the home-market language is silent there.
- **Recommendation:** generate az, en and ru after native voice selection; document the pre-build step in CI.

#### M-05 · Medium · No billing, seat metering or self-serve trial
- **Evidence:** plans and overrides are set by hand in the operator console; nothing counts seats, invoices, takes payment or expires a trial.
- **Recommendation:** seat counting per tenant first (needed for invoicing pilots), payment provider for the self-serve Essentials plan later.

#### M-06 · Medium · No "Report phishing" button in the mail client
- **Evidence:** reporting is 40 % of the league score and the entry point of the SecOps loop, but learners must type a report into a web form; the original product had an `outlook_addin` flag (`docs/audit/00-overview.md`). Reports of simulations are matched only when the learner pastes the tracking link.
- **Recommendation:** an Outlook/Gmail add-in, or a per-tenant inbound address that files a report and matches the simulation token from the forwarded message.

#### M-07 · Medium · No interoperability with customers' existing systems
- **Evidence:** no SCORM/xAPI export for LMSs (`OPEN-QUESTIONS.md` item 11), no SCIM provisioning, no LDAP sync (M-02), no public REST API; integrations are outbound only (webhooks and syslog).
- **Recommendation:** SCIM 2.0 and a read-only reporting API first; SCORM/xAPI on demand from pilots.

#### M-08 · Medium · No product analytics or usage telemetry
- **Evidence:** nothing measures activation, weekly active learners, lesson drop-off or campaign funnels across tenants.
- **Impact:** pilots will not produce investor-grade evidence of engagement or outcome.
- **Recommendation:** self-hosted, privacy-respecting analytics (PostHog or Plausible) plus an operator metrics page.

#### M-09 · Medium · Simulation accuracy and deliverability
- **Where:** [`tracking.ts` L12–L18](../portal/src/server/tracking.ts#L12-L18), [`campaigns.ts` L128–L157](../portal/src/server/services/campaigns.ts#L128-L157), `OPEN-QUESTIONS.md` item 18.
- **Evidence:** a click is recorded on a plain GET of `/t/{token}` and mail-security scanners are recognised only by user-agent keywords; a scanner that detonates links with a browser user agent creates a "phishing click" risk against an innocent employee. Simulations are sent from the organisation's own proven domain with only the display name changed; there are no look-alike sending domains, SPF/DKIM guidance or allow-listing instructions for Microsoft 365 and Google Workspace.
- **Impact:** false positives in the risk score and simulations that are either blocked or unrealistic.
- **Recommendation:** require a human interaction (JavaScript beacon or a second request) before counting a click; dedicated simulation domains with documented allow-listing.

#### M-10 · Medium · Customers can author only a minimal lesson type
- **Where:** [`secops.ts` L486–L510](../portal/src/server/actions/secops.ts#L486-L510).
- **Evidence:** Studio lessons are a fixed four-scene template (intro, tutor, one single-answer question, recap) in one language, without narration or edit history; the interactive scene types that differentiate the product (simulation, hotspot, swipe, scenario) are available only to the AI trainer and to library lessons shipped in the image.
- **Recommendation:** a structured editor for at least choice, swipe and hotspot scenes, with translation and versioning.

#### M-11 · Low · Smaller product gaps
- PDFs come from the browser's print dialog; scheduled reports email a link, not an attachment (ADR-006).
- The "sandbox" is static heuristics without detonation (ADR-009); the name may over-promise to security buyers.
- No native mobile app (PWA only; `OPEN-QUESTIONS.md` item 17).
- The operator console has no landing-page CMS (`OPEN-QUESTIONS.md` item 19).

### 6.6 Operations, organisation, legal and intellectual property

#### O-01 · High · Key-person risk and an AI-generated codebase without human review
- **Evidence:** one author in the Git history; about 56,000 lines of application code, 1,060 lesson files and 33 ADRs were produced in about two and a half weeks (2026-10-19 to 2026-11-04) by AI agents orchestrated by the founder (scripts in [`docs/build/workflows`](build/workflows), state in [`RESUME.md`](build/RESUME.md) and [`OVERNIGHT-STATE.md`](build/workflows/OVERNIGHT-STATE.md)); code review was done by further AI reviewers (`OPEN-QUESTIONS.md` item 24). Much of the working knowledge sits in a Claude Code skill (`.claude/skills/cyclowareness-experience`).
- **Impact:** the quality is real, but no second human has read most of the code; onboarding, accountability for security decisions and continuity all depend on one person and their tooling.
- **Recommendation:** hire or contract a senior engineer to own review and operations; adopt pull requests with mandatory human review from now on.

#### O-02 · Medium · Engineering documentation is mostly in Azerbaijani
- **Evidence:** `PLAN.md`, `PROGRESS.md`, `DECISIONS.md` (33 ADRs), `OPEN-QUESTIONS.md`, `RESUME.md`, the original-product spec in `docs/audit` and half of the portal README's opening are in Azerbaijani; the root [`README.md`](../README.md) is a single title line.
- **Impact:** slows international hiring, external auditors and investors' technical advisers.
- **Recommendation:** English summaries of the ADRs and an English architecture overview (this audit's section 4 can seed it).

#### O-03 · High · No observability
- **Evidence:** logging is unstructured `console.*` with no request or tenant id; no error tracking, metrics, tracing or alerting; [`/api/health`](../portal/src/app/api/health/route.ts) checks only the database, not the job runner, mail backlog or webhook backlog.
- **Impact:** in production the first signal of a stuck job runner or a failing mail server would be a customer complaint.
- **Recommendation:** structured logs, Sentry or OpenTelemetry, backlog and tick-duration metrics, and a job-runner heartbeat in the health check.

#### O-04 · High · No backup, restore or disaster-recovery procedure
- **Evidence:** the compose stack keeps data in a named volume; there is no backup job, restore runbook or recovery objective; `APP_SECRET` must be backed up with the database or every stored secret and authenticator is lost (S-07).
- **Recommendation:** nightly dumps plus WAL archiving, a tested restore, documented RPO/RTO, and secret escrow.

#### O-05 · Medium · No customer-facing operating documentation
- **Evidence:** there is no administrator guide, integration guide for webhooks and syslog, security whitepaper, SLA, support policy or status page; support exists only as an in-app ticket desk inside each tenant.
- **Recommendation:** produce these before the first paid contract (roadmap 3.6).

#### O-06 · Low · Repository hygiene
- No `LICENSE`, `SECURITY.md`, `CONTRIBUTING.md` or `CODEOWNERS`; a government agency's tenant logo and screenshots of its demo tenant are committed under [`docs/audit`](audit) ([`tenant-logo-rida.png`](audit/assets/tenant-logo-rida.png)).

#### L-01 · Critical · Legal texts name the wrong AI processor and lack the provider's identity
- **Where:** all 20 files in [`portal/content/legal`](../portal/content/legal), e.g. [`privacy.en.md` L8, L57, L70, L79, L163–L164](../portal/content/legal/privacy.en.md#L57), [`terms.en.md` L8, L43, L58, L93](../portal/content/legal/terms.en.md#L93).
- **Evidence:** the privacy policy and terms state that AI Sel's answers are generated by Google Gemini through Google Cloud Vertex AI and processed in Google data centres; the code sends lesson text and questions to Anthropic (tutor, subtitles, studio) and, for narration, to ElevenLabs. The provider's legal name, registration number, address and privacy contact are `[to be provided]`. The policy also describes data the demo form does not collect (role, source, test score) and promises deletion of demo requests after 24 months, which no job implements. There is no data processing agreement template or sub-processor list.
- **Impact:** a customer cannot sign a contract or a DPA on these texts; going live with them would misstate international data transfers to every user. Flagged by the team (`OPEN-QUESTIONS.md` items 8 and 20) but unresolved.
- **Recommendation:** correct processors and transfers, fill the provider identity, align the stated retention with the code, add a DPA and sub-processor list, and have counsel review the launch languages.

#### L-02 · Critical · Intellectual-property chain of title is undocumented
- **Where:** [`docs/audit/README.md`](audit/README.md), [`portal/content/library/lessons`](../portal/content/library/lessons), [`public/rive/mascot.riv`](../portal/public/rive/mascot.riv), [`types.ts` L3](../portal/src/lib/content/types.ts#L3).
- **Evidence:** the specification states that everything in `docs/audit` was extracted from the live cylosof.com portal through a demo tenant of a government agency. The scenes of all 106 English lessons shipped in `portal/content/library` are identical to the extracted originals (verified file by file; only the file wrapper differs), `mascot.riv` is byte-identical to the extracted asset, and the design tokens, landing copy and legal texts were carried over. The project skill describes cylosof.com as the founder's own earlier product, but the repository contains no assignment, licence or ownership record, and no `LICENSE` file.
- **Impact:** if any part of the cylosof.com content, mascot or design belonged to a company, an employer, a co-founder or a contractor, the core training library would be encumbered; investors will not close without this resolved. This is a documentation gap that is resolved by proof of ownership, not by code.
- **Recommendation:** collect evidence of ownership (company records, IP assignment from any contributors to cylosof.com, contractor agreements for content and the original mascot), record it in the data room, and add a proprietary `LICENSE` notice.

#### L-03 · Medium · Data retention and residency are not configurable
- **Where:** [`jobs.ts` L351–L376](../portal/src/server/jobs.ts#L351-L376).
- **Evidence:** the daily clean-up deletes sessions, sign-in attempts, old mail and deliveries, but answers, XP events, audit entries, behaviour risks, lesson progress and demo requests are kept indefinitely; there is no per-tenant retention setting and no hosting-region choice (`OPEN-QUESTIONS.md` item 12).
- **Impact:** GDPR storage-limitation and customer data-residency requirements (EU, Saudi PDPL) cannot be met contractually.
- **Recommendation:** per-tenant retention policies enforced by the clean-up job, and documented regional deployments.

---

## 7. Findings register

Sorted by severity, then by area. "Roadmap" names the work item in [`ROADMAP.md`](ROADMAP.md) that closes the finding.

The "Closure status" column was filled on 2026-11-11 at commit `85e475c` (branch `final-pass-2026-10-21`, local, not pushed). Each status comes from the code at that commit, read together with [`REGISTER-2026-11-05.md`](build/REGISTER-2026-11-05.md), [`PROGRESS.md`](build/PROGRESS.md) and [`DECISIONS.md`](build/DECISIONS.md). The other columns, sections 1 to 6 and the appendix (section 8) still describe the audited commit `b5c935a`. "Closed" names the ADR or commit that closed the finding. "Partly closed" says what remains. "Owner decision" names the item in [`OPEN-QUESTIONS.md`](build/OPEN-QUESTIONS.md). Nothing has been deployed or run against real providers yet (M-01).

| ID | Severity | Area | Finding | Primary location | Roadmap | Closure status |
|---|---|---|---|---|---|---|
| L-01 | Critical | Legal | Legal texts name Google Vertex AI instead of Anthropic/ElevenLabs; provider identity `[to be provided]`; no DPA | [`content/legal`](../portal/content/legal) | 1.1 | Partly closed: processors, the sub-processor list and the DPA template match the code (ADR-037, ADR-067); Privacy §8 does not yet match the audit and learning-data retention (OPEN-QUESTIONS 65, 72); the provider identity is still `[to be provided]` and the lawyer's review is open (OPEN-QUESTIONS 8, 26, 63) |
| L-02 | Critical | IP | Chain of title for lessons, mascot and design inherited from cylosof.com is undocumented | [`docs/audit/README.md`](audit/README.md), [`content/library`](../portal/content/library) | 1.1 | Owner decision (OPEN-QUESTIONS 35): `LICENSE` and the `CHAIN-OF-TITLE.md` register exist (ADR-037), but every row still needs evidence and the licence holder is a placeholder |
| S-01 | High | Security | Lesson completion, answers, attestation and certificates are asserted by the browser | [`learning.ts`](../portal/src/server/actions/learning.ts#L91-L148) | 1.2 | Closed (ADR-035); the evidence parameters wait for confirmation (OPEN-QUESTIONS 27) |
| S-04 | High | Security | Demo seed gives a published shared password to every account, including `super_admin` | [`seed.ts`](../portal/scripts/seed.ts#L56) | 1.3 | Partly closed: no published demo password, and the seed refuses production (ADR-036); re-seeding the copy on port 3100 with the owner's own `SEED_PASSWORD`, or changing its passwords, is the owner's step (OPEN-QUESTIONS 28) |
| D-01 | High | Tech debt | Migration history regenerated from scratch; would crash-loop an upgraded production database | [`drizzle/`](../portal/drizzle) | 1.5 | Closed: `0000_init.sql` frozen, additive migrations 0001 to 0007 (ADR-019 note of 2026-11-05, ADR-081), CI migrates PostgreSQL 16 twice (ADR-042); that job has not run on GitHub yet (OPEN-QUESTIONS 31) |
| D-02 | High | Tech debt | All dates, reminders and reports fixed to Baku time (UTC+4, no DST) | [`time.ts`](../portal/src/lib/time.ts) | 2.1 | Closed (ADR-039) |
| T-01 | High | Delivery | No continuous integration of any kind | repository root | 1.4 | Partly closed: `ci.yml` and `security.yml` with Dependabot (ADR-042); no run on GitHub yet, and required checks need the push (OPEN-QUESTIONS 31) |
| T-02 | High | Testing | No integration or end-to-end tests; SSO routes, jobs, pages and PostgreSQL untested | [`tests/`](../portal/tests) | 1.4 | Partly closed: Playwright smoke suite (three journeys in en and ar), SSO route and job-runner tests, migrations on PostgreSQL 16 in CI (ADR-042); the other tests still run on PGlite, and there are no DOM component tests (OPEN-QUESTIONS 69) |
| M-01 | High | Readiness | Never run against real email, SMS, identity or AI providers; never deployed | [`PROGRESS.md`](build/PROGRESS.md) | 1.6 | Owner decision (OPEN-QUESTIONS 1, 2, 3, 4, 12, 14): no deployment and no live provider run yet |
| M-02 | High | Product | Plans include SAML, LDAP and voice, which are not built; voice campaigns record fake "sent" | [`tenant-defaults.ts`](../portal/src/lib/tenant-defaults.ts#L286-L291) | 2.2 | Partly closed: SAML, LDAP, Android block and voice are hidden, and voice launches are refused (ADR-040); the Professional card still lists "spaced review and nudges" (OPEN-QUESTIONS 37) |
| M-03 | High | Product | Seven languages and the legal texts translated by AI without human review | [`messages/`](../portal/messages) | 2.8 | Owner decision (OPEN-QUESTIONS 7, 22, 66; legal texts 8, 26): no native or legal review yet |
| O-01 | High | Organisation | One author; AI-generated code without human review | Git history | 1.8, 3.7 | Owner decision: a second engineer and human review are the owner's; `CONTRIBUTING.md` and `CODEOWNERS` exist (ADR-037), branch protection is OPEN-QUESTIONS 31; the closure run was reviewed by AI agents only |
| O-03 | High | Operations | No structured logging, error tracking, metrics or alerting | [`api/health`](../portal/src/app/api/health/route.ts) | 1.7 | Partly closed: JSON log lines and `/api/health` with the job heartbeat and backlog (ADR-038); no request ids, error tracking or alerting (OPEN-QUESTIONS 34) |
| O-04 | High | Operations | No backup, restore or disaster-recovery procedure | [`docker-compose.yml`](../portal/docker-compose.yml) | 2.6 | Partly closed: nightly `pg_dump` and a restore script, owner-only files, optional age encryption (ADR-038, ADR-080); never run on a live host, no restore drill or RPO/RTO (OPEN-QUESTIONS 33, 73) |
| S-02 | Medium | Security | SSO accounts linked by email only; no `iss`/`sub` binding | [`sso/callback`](../portal/src/app/api/sso/callback/%5Btenant%5D/route.ts#L75-L104) | 2.3 | Closed (ADR-041): issuer and `sub` are bound at the first sign-in; re-pointing the provider takes a password (ADR-053) |
| S-03 | Medium | Security | Tenant isolation enforced only in application code; no RLS or cross-tenant tests | [`schema.ts`](../portal/src/server/db/schema.ts) | 2.4 | Partly closed: a generated cross-tenant suite covers every action and route (ADR-046, ADR-058); RLS is not built (OPEN-QUESTIONS 45) |
| S-05 | Medium | Security | 11 MB body limit applies to every Server Action, including anonymous ones | [`next.config.ts`](../portal/next.config.ts#L37) | 1.9 | Closed (ADR-041) |
| S-06 | Medium | Security | Admin and operator account-takeover tools without step-up or consent | [`people.ts`](../portal/src/server/actions/people.ts#L183-L250) | 2.9 | Partly closed: password step-up, notices and a consented 72-hour support window (ADR-044, ADR-053); no second approver, and the step-up asks no TOTP code (OPEN-QUESTIONS 42) |
| S-07 | Medium | Security | Single `APP_SECRET`, no key id or rotation path | [`crypto.ts`](../portal/src/server/crypto.ts#L8-L17) | 2.6 | Closed (ADR-045, ADR-069) |
| Q-01 | Medium | Code quality | Oversized player and settings modules with effect suppressions and no component tests | [`scenes.tsx`](../portal/src/components/player/scenes.tsx) | 3.5 | Partly closed: stable scene environment with no `exhaustive-deps` suppression in the scenes, scene render tests, templates previewed on the server (ADR-063); `scenes.tsx` (1,701 lines) and `settings-tabs.tsx` (1,964 lines) are not split, and there are no DOM component tests (OPEN-QUESTIONS 69) |
| Q-02 | Medium | Code quality | 3,182-line vendored mascot engine outside lint, bundled on every page | [`engine.js`](../portal/src/components/mascot/cat/engine.js) | 3.5 | Partly closed: the engine loads after mount (ADR-061) and is named the single source; it is still outside lint and type checking |
| Q-03 | Medium | Code quality | Inconsistent client error handling; multi-step writes without transactions; duplicate certificates possible | [`campaigns.ts`](../portal/src/server/services/campaigns.ts#L71-L107) | 1.2, 3.5 | Partly closed: `ActionResult`, `useAction` and segment error boundaries (ADR-062), unique attestation and certificate indexes, `launchCampaign` in one transaction (ADR-079); the lesson player, the campaign wizard, the person actions, the operator console and five calls in `settings-tabs.tsx` still call actions without `useAction` |
| Q-04 | Medium | Code quality | Lesson format unversioned; tutor checkpoints unvalidated yet dereferenced | [`types.ts`](../portal/src/lib/content/types.ts#L86-L87) | 1.4 | Closed (ADR-043, ADR-059) |
| D-03 | Medium | Scalability | Per-minute whole-tenant jobs and per-user risk updates inside requests | [`jobs.ts`](../portal/src/server/jobs.ts#L44-L70) | 2.5 | Partly closed: batched writes, an hourly ledger, affected-only rescoring, subqueries and slices of 1,000 (ADR-060, ADR-078); the k6 load test has not run (OPEN-QUESTIONS 58) |
| D-04 | Medium | Performance | Full message catalogue, mascot engine and base64 avatars on every page | [`layout.tsx`](../portal/src/app/layout.tsx#L50) | 2.5 | Partly closed: per-route message bundles, a lazily loaded mascot engine and an avatar route (ADR-061); photos are still stored as data URLs in `users.avatar_url` (OPEN-QUESTIONS 59) |
| D-05 | Medium | Tech debt | Email unique across the platform; blocks multi-organisation users and partner channel | [`schema.ts`](../portal/src/server/db/schema.ts#L198) | 3.2 | Owner decision (OPEN-QUESTIONS 51): memberships are planned after the pilots (ADR-051) |
| D-06 | Medium | Tech debt | Library imported at every start; one bad lesson file stops the server | [`bootstrap.ts`](../portal/src/server/bootstrap.ts#L90-L112) | 1.4 | Partly closed: content is checked in CI and the import writes only changed rows (ADR-059); every start still reads the whole library, and one bad file still stops it |
| T-03 | Medium | Testing | Test count dominated by generated parity checks; no coverage; brittle fakes | [`tests/`](../portal/tests) | 1.4 | Partly closed: a 60 % line-coverage floor, and CI fails on a missing lesson translation (ADR-042); parity and behavioural tests are still counted together, and order-coupled fakes remain |
| M-04 | Medium | Product | Natural-voice narration not generated; Azerbaijani silent on Chrome/Windows | [`generate-narration.ts`](../portal/scripts/generate-narration.ts) | 2.8 | Partly closed: English clips made with Piper on the build machine (ADR-074); az and ru wait for the Azure key (OPEN-QUESTIONS 2), and seven languages keep the browser voice |
| M-05 | Medium | Product | No billing, seat metering or self-serve trial | — | 3.2 | Partly closed: seat counting and a seat CSV (ADR-051); billing is by hand, with no payment or trial (OPEN-QUESTIONS 51) |
| M-06 | Medium | Product | No "Report phishing" mail add-in or inbound report address | — | 3.3 | Partly closed: an inbound report address (ADR-065); no mail-client add-in, and the mail provider is not chosen (OPEN-QUESTIONS 61) |
| M-07 | Medium | Product | No SCIM, SCORM/xAPI or public API | — | 3.4 | Partly closed: a read-only reporting API (ADR-064, ADR-075) and a SCORM 1.2 export (ADR-049); no SCIM or xAPI (OPEN-QUESTIONS 49, 60) |
| M-08 | Medium | Product | No product analytics or usage telemetry | — | 2.10 | Closed (ADR-051): operator metrics page per organisation |
| M-09 | Medium | Product | Click tracking prone to scanner false positives; simulation sending domains undefined | [`tracking.ts`](../portal/src/server/tracking.ts#L12-L18) | 2.7 | Partly closed: clicks by beacon, a proven look-alike sender and an allow-listing guide (ADR-047); sending domains and their SPF/DKIM are the owner's (OPEN-QUESTIONS 18, 47) |
| M-10 | Medium | Product | Customer authoring limited to one fixed four-scene, single-language template | [`secops.ts`](../portal/src/server/actions/secops.ts#L486-L510) | 3.4 | Partly closed: edit after save, AI translation on publish, swipe and hotspot scenes (ADR-066); no version history and no simulation or scenario scenes |
| O-02 | Medium | Organisation | Engineering documentation mostly in Azerbaijani | [`docs/build`](build) | 1.8 | Partly closed: an English ADR index and `OPEN-QUESTIONS.en.md`; the ADR bodies, `PLAN.md` and `PROGRESS.md` are still in Azerbaijani (OPEN-QUESTIONS 52) |
| O-05 | Medium | Operations | No admin guide, integration guide, SLA, support policy or status page | — | 3.6 | Partly closed: admin guide, learner quick start, security whitepaper, `API.md` and `OPERATIONS.md`; the SLA, support hours and status page are still to be provided (OPEN-QUESTIONS 52) |
| L-03 | Medium | Legal | No configurable retention or hosting region; several tables kept forever | [`jobs.ts`](../portal/src/server/jobs.ts#L351-L376) | 2.6 | Partly closed: per-organisation audit and learning-data retention (ADR-048, ADR-055, ADR-069, ADR-077); residency is a hosting decision (OPEN-QUESTIONS 12, 48), and the Privacy §8 wording is with the lawyer (OPEN-QUESTIONS 65, 72) |
| S-08 | Low | Security | Cross-tenant account-existence oracle in CSV import preview | [`people.ts`](../portal/src/server/actions/people.ts#L475-L545) | 2.4 | Closed (ADR-041; an import commit that reports problems is rate-limited too since `6dfb243`) |
| S-09 | Low | Security | TOTP codes replayable within their window | [`totp.ts`](../portal/src/server/auth/totp.ts#L21-L25) | 2.3 | Closed (ADR-041) |
| S-10 | Low | Security | Tutor answer cache shared across organisations | [`api/tutor`](../portal/src/app/api/tutor/route.ts#L64-L70) | 2.7 | Closed (ADR-046): the cache is keyed per organisation; there is no operator purge view, and the extra cost is OPEN-QUESTIONS 46 |
| S-11 | Low | Security | Inline-style CSP, non-unique tenant domain, unvalidated `lessonKey`, sign-off IPs visible to content creators, dev-only audit advisories | section 6.1 | 2.4 | Closed: one verified domain per organisation (ADR-045), `lessonKey` checked and sign-off IPs only for `audit.read` roles (ADR-046), a `minimatch` override; inline styles stay as an accepted risk (ADR-067) |
| Q-05 | Low | Code quality | Ten-language texts in code, lint suppressions and casts, test-only branch, two marked shortcuts | section 6.2 | 3.5 | Partly closed: refresher and blocked-campaign texts left the code, and `rateLimit` always counts in the database (ADR-063); campaign templates are still in TypeScript, 21 lint suppressions and 22 such casts remain, and both marked shortcuts stay |
| D-07 | Low | Tech debt | 15 outdated dependencies, no automated updates, no `engines` | [`package.json`](../portal/package.json) | 1.4 | Partly closed: Dependabot, `.nvmrc` and `engines` set to Node 24; the major updates (for example `@anthropic-ai/sdk` 0.135) are not done, and Dependabot has not run (OPEN-QUESTIONS 31) |
| D-08 | Low | Tech debt | Founder-machine paths in config and scripts; build needs Google Fonts | [`.claude/launch.json`](../.claude/launch.json) | 1.8 | Partly closed: `launch.json` keeps only the relative entry (OPEN-QUESTIONS 29); the build still downloads Google Fonts, webpack stays forced (ADR-003); the later workflow args and results files use the `<repo>` placeholder since 2026-11-11 |
| D-09 | Low | Tech debt | 4.1 MB unused Rive assets, 10 MB design PNGs in the repository | [`public/rive`](../portal/public/rive) | 3.5 | Open: `public/rive` (4.1 MB), the Rive dependency, `design/` (10 MB) and the Open Graph font are still in the repository |
| D-10 | Low | Tech debt | Platform-wide module and lesson lookups per request | [`queries/admin.ts`](../portal/src/server/queries/admin.ts#L111-L115) | 2.5 | Closed (ADR-060): `tenantModules` scopes the lookups |
| M-11 | Low | Product | Print-to-PDF only, static-only sandbox naming, no native app, no landing CMS | section 6.5 | 3.4 | Owner decision (OPEN-QUESTIONS 15, 17, 19); the sandbox is still static analysis under that name (ADR-009) |
| O-06 | Low | Organisation | No LICENSE, SECURITY.md or CODEOWNERS; third-party logo and screenshots committed | [`docs/audit`](audit) | 1.8 | Partly closed: `LICENSE`, `SECURITY.md`, `CONTRIBUTING.md` and `CODEOWNERS` exist (ADR-037); their entity and reporting address are placeholders, and the agency logo and screenshots stay in `docs/audit` (OPEN-QUESTIONS 35, 36) |

---

## 8. Appendix: measured facts

| Measure | Value |
|---|---|
| Application code (`portal/src`) | 468 files, ~55,900 lines (app 14,254; components 24,437; server 13,339; lib 3,447; i18n 259) |
| Routes | 67 pages, 51 layouts, 50 loading skeletons, 1 error boundary, 17 route handlers, 126 exported Server Actions in 20 `"use server"` files |
| Client components | 94 files with `"use client"` |
| Database | 51 tables, 53 indexes, 1 migration (`0000_init.sql`, 776 lines), 0 row-level-security policies |
| Content | 53 modules, 106 lessons × 10 languages = 1,060 lesson files (18 MB), 5 learning paths, 169 brands, legal texts and 2 policies in 10 languages |
| Interface strings | 9 namespaces × 10 languages (2.3 MB) |
| Tests | 83 files, ~10,100 lines; 834 test declarations expanding to 2,697 cases; 82 files / 2,697 tests pass in 36 s |
| Static checks | `tsc --noEmit` 0 errors; ESLint 0 warnings with `--max-warnings=0`; 38 inline lint suppressions |
| Dependencies | 23 runtime, 15 development; `npm audit`: 0 critical, 0 high, 8 moderate (dev-only); 15 outdated |
| Build | Passes; standalone output 139 MB + 5.8 MB static assets |
| Repository | 8 commits (2026-10-19 to 2026-11-04), 1 author; 19.8 MB packed; no CI configuration, no LICENSE |
| Documentation | 33 ADRs, progress log, 25 open questions (mostly Azerbaijani); original-product spec with 57 screenshots |

Commands used to reproduce the checks, from the repository root:

```bash
npm --prefix portal ci
npm --prefix portal run typecheck
cd portal && npx eslint src tests scripts --max-warnings=0
cd portal && npx vitest run
cd portal && npm audit && npm outdated
npm --prefix portal run build
```
