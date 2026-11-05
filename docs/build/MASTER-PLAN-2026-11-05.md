# Master plan — closing every reported gap and the six strategic items (2026-11-05)

> **Az.** Bu plan beş bulud sessiyasının hesabatlarındakı (audit, təhlükəsizlik baxışı, test/CI, sənədlər, demo) bütün tapıntıları, repoda qeyd olunmuş açıq məsələləri və sahibin altı strateji maddəsini bağlamaq üçündür. Orkestrasiya Fable 5.1 ilə, icra agentləri: kritik/təhlükəsizlik işləri **Mythos 5.1**, adi işlər **Opus 5.5**, çox xırda mexaniki işlər **Sonnet 5.5** (lazım olmadıqca yox). Hər fazanın sonunda lokal commit; push yalnız sahib deyəndə. Vəziyyət `docs/build/workflows/RUN-STATE-2026-11-05.md`-də saxlanır ki, kəsilmə (limit, internet) olanda qaldığı yerdən davam etmək mümkün olsun.

## 0. Sources this plan closes

| Source | Where | What it holds |
|---|---|---|
| PR #1 Technical due diligence audit | branch `origin/claude/vibrant-mccarthy-5czs8y` → `docs/AUDIT.md`, `docs/ROADMAP.md` | 49 findings (L-01…L-03, S-01…S-11, Q-01…Q-05, D-01…D-10, T-01…T-03, M-01…M-11, O-01…O-06) + 30/60/90 roadmap |
| PR #2 Security review | `origin/claude/cool-lamport-9zzv8z` → `docs/SECURITY_REVIEW.md` + 8 fix commits | H-1, M-1, L-1…L-9, I-1…I-7; fixed: seed guard, minimatch override, CSV/Studio size caps, notify placeholders, SMS http warning, security CI + Dependabot + gitleaks |
| PR #3 Test suite and CI | `origin/claude/adoring-mccarthy-pq07g0` → `.github/workflows/ci.yml`, `CHANGELOG.md`, 13 test files | 10 bug fixes (password strength, IDN domains, double XP, double attestation, XP split, double launch, double click, double fake sign-in, device limit, completion > 100 %) |
| PR #4 README and documentation | `origin/claude/adoring-cray-j0yjis` → `README.md`, `docs/ARCHITECTURE.md`, `docs/API.md` | known limitations list; SSO domain-proof bug; no licence; README roadmap |
| PR #5 Demo-ready MVP | `origin/claude/ecstatic-newton-02zp8b` → live drill (`/admin/drill`), `npm run demo`, `docs/DEMO.md`, migrations 0001/0002, ADR-034 | follow-ups: embedded-DB lock, drill is operator-only, nine machine-translated admin.json languages |
| Repository | `docs/build/OPEN-QUESTIONS.md` (1–25), skill references "open gaps", `portal/README.md` | owner decisions, provider keys, known shortcuts |
| Owner's six strategic items | this session, 2026-11-05 | market packs (de/fr/ar), teachable-moment loop, server-side completion + legal texts, SCORM 1.2, mini-lab per module, CISO risk story |
| Owner's additions | 2026-11-05 | pentest-style security pass with Mythos until "fully secure"; resilience against limits and network loss |

The verified register (every finding with its verdict on the code: open / fixed on a branch / partial / not an issue) is appended in section 9 once the verification workflow finishes; the phases below reference finding ids.

## 1. Operating rules for this run

1. **Models.** Orchestration: Fable 5.1 (this session). Implementation and review agents in workflows: `claude-mythos-5-1` for anything that touches authentication, sessions, SSO, tenant isolation, evidence integrity, secrets, rate limits, uploads, outbound connections, or that reviews security; `claude-opus-5-5` for every other implementation, translation and review task; `claude-sonnet-5-5` only for mechanical, low-judgement steps (running a checker and reporting, copying a message block into nine locale files from a prepared payload). Reviews of security work use a *different* Mythos agent than the one that wrote it.
2. **Resilience.** Every workflow script wraps `agent()` in `retrying()` (null result → wait 10 min → retry, up to 40 times). Every workflow is journaled; after a process death it is resumed with `scriptPath` + `resumeFromRunId`. `RUN-STATE-2026-11-05.md` records phase, run ids, branches, last commit and the next step after every checkpoint. Nothing is ever "terminated" because of a usage limit: wait and continue.
3. **Repository rules (from CLAUDE.md and the skill).** Never edit `docs/audit/`. Every UI string in all ten message folders, translated by meaning; never "Aİ". Logical CSS only; RTL tested. Hydration-safe client components. Motion preference honoured. Stop the dev server before `db:*` / `content:sync` (PGlite single-process). The owner's :3100 copy is not touched. `SEED_PASSWORD` never printed. Legal texts: factual corrections only (processors, retention, sub-processors); company identity stays `[to be provided]` and every change is listed for the lawyer in OPEN-QUESTIONS.
4. **Change discipline.** Smallest complete change per finding; root cause fixed once in shared code; every new branch, loop, parser, money or security logic leaves a test. Migrations are **additive from now on** (`drizzle/000N_*.sql`; `0000_init.sql` is frozen — the demo branch set the precedent and D-01 demands it).
5. **Parallel editing.** Implementers run in isolated git worktrees (one per work package); each worktree gets `portal/node_modules` as a junction to the main checkout's `node_modules` (`cmd /c mklink /J`), runs typecheck, lint and the targeted tests, and commits on its branch. Fable merges the branches into `final-pass-2026-10-21` in the order given per phase, re-runs the full suite, commits. Two implementers never own the same file in the same wave.
6. **Checks after every merge** (from `portal/`): `npm run typecheck`; `npx eslint src tests scripts --max-warnings=0`; `npx vitest run`; `npx tsx scripts/check-lesson-locales.ts --coverage`; `node <scratchpad>/check-messages.mjs <lang>` for the nine non-default locales; `npm run build` at phase ends. Browser verification on :3000 as learner and admin in az, en, ar (RTL) and one more language, at 1366 and 375 px.
7. **Commits.** Local commit at the end of every phase and after every merged work package wave, message in English, `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. No push unless the owner asks.
8. **Owner-only items** are not guessed: they go to `docs/build/OPEN-QUESTIONS.md` with what is needed (keys, legal identity, hiring, hosting, chain-of-title evidence) and the code is prepared so that supplying the item is the only remaining step.

## 2. Phase 0 — Land the five branches (Fable + one Opus conflict helper)

Goal: `final-pass-2026-10-21` (= `main`) contains all five branches; suite green; local database migrated.

1. Order: PR #3 tests → PR #2 security → PR #4 docs → PR #1 audit → PR #5 demo. Only one textual conflict exists (`README.md` between #4 and #5): keep the #4 README and graft the demo section from #5 into its quick start. `package.json`/lockfile: #2 adds the `minimatch` override, #5 adds the `demo` script; `npm install` afterwards.
2. Migrations: keep #5's `0001_live_drill.sql` and `0002_drill_risk_trail.sql`; update `portal/README.md`, `CLAUDE.md`/skill text and ADR-019's note from "regenerate 0000" to "additive migrations" (closes D-01's process half; the CI half is Phase 1).
3. Stop the :3000 dev server, `npm run db:migrate`, restart. (`db:reset` is not needed; the demo seed's `live_drill` flag is applied on next seed — document.)
4. Full checks; fix anything the union breaks (the tests branch and the demo branch both edit `campaigns.ts` and `seed.ts` without textual conflict, but semantic overlap must be run through the suite).
5. Commit "Merge the five review branches: audit, security fixes, test suite and CI, documentation, live drill".
6. Write `RUN-STATE` checkpoint.

## 3. Phase 1 — Critical and High (paper, evidence, delivery, offer)

Work packages (WP), each one worktree agent unless marked Fable/owner. Model in brackets.

| WP | Closes | Content | Model |
|---|---|---|---|
| 1.1 Legal texts | L-01, OPEN-Q 8/20, owner item 3 | In all 20 `portal/content/legal/{privacy,terms}.<lang>.md`: Google Vertex AI → Anthropic (tutor, subtitles, studio) and ElevenLabs (narration clips) and the browser's own speech engine; add a sub-processor section; align stated retention with the code (demo requests: implement the 24-month deletion in the daily clean-up job so the text is true; drop the data the demo form does not collect); keep `[to be provided]` identity placeholders; add `docs/legal/DPA-template.md` (en, az) and `docs/legal/SUBPROCESSORS.md`; list every changed sentence for the lawyer in OPEN-QUESTIONS 8/20. Translations by meaning with the glossaries. | Opus (legal wording), Fable review |
| 1.2 Chain of title and repo hygiene | L-02, O-06, D-08 part, SEC L-6 | `LICENSE` (proprietary, Safarov Industries, all rights reserved), `SECURITY.md` (disclosure address placeholder), `CONTRIBUTING.md`, `CODEOWNERS`; `docs/build/CHAIN-OF-TITLE.md` template listing every inherited asset (106 lessons, mascot.riv, tokens, landing copy, legal texts) with "evidence needed" rows for the owner; remove absolute machine paths from `.claude/launch.json` (relative), from the workflow scripts in `docs/build/workflows/` and glossaries (placeholders); the third-party logo under `docs/audit/assets` cannot be edited (rule) → OPEN-QUESTIONS entry asking the owner to decide. | Opus |
| 1.3 Server-verified training evidence | S-01, OPEN-Q 25, Q-03 server part, owner item 3, DOC known limitation | New table `lesson_attempts` (additive migration): opened at `startLessonAction` (server time, lesson key validated against `lesson_contents`), scene progress posted by the player (`reachScene` action, monotonic, server-timed), answers scored on the server from `lesson_contents` (correct/firstTry computed server-side; client values ignored), minimum dwell = max(30 s, 35 % of the lesson's `durationMin`), completion requires every scene reached and the attempt open; attestation + module status + certificate in one transaction with unique indexes `(user_id, module_id)` on `attestations` and module certificates (the tests branch added the conditional update; keep it and add the indexes); evidence created before the migration is flagged `self_reported=true` and shown as "self-reported" in compliance exports and the certificate verification page; the live drill (which calls `completeLesson` directly) gets a server-side "synthetic" path that creates a complete attempt. Tests: forged completion refused, dwell refused, double attest, drill path. | **Mythos** |
| 1.4 Demo seed hardening | S-04, SEC H-1 | Seed: random password generated and printed once (or `SEED_PASSWORD` if set and not the published value), `super_admin` seeded only with `SEED_OPERATOR=1`, refuse when `NODE_ENV=production`, refuse to truncate a database that holds non-demo tenants; `.env.example` keeps a *local-only* documented default (the security branch's guard already refuses it elsewhere) — decide: keep for local convenience, but README/DEMO say "local only"; `docker-compose.yml` seed service gated. Rotation instructions in SECURITY_REVIEW stay. | **Mythos** |
| 1.5 CI: PostgreSQL migrations + Playwright smoke | T-01, T-02, D-01 CI half, D-07, T-03 | Extend `ci.yml`: job with PostgreSQL 16 service that applies all migrations (upgrade test from the previous tag's schema once a tag exists), runs the PGlite-free integration tests against it (`DATABASE_URL`); Playwright smoke suite (`portal/e2e/`): sign-in, Home, lesson → attestation → certificate, people import, campaign wizard, settings save, report export, threat report → loop, operator creates a tenant, drill start — in az, en, ar; coverage report with a floor; `engines` + `.nvmrc` (Node 24); separate "behavioural" and "content" test counts in CI summary; nightly `npm audit` already in security.yml. | Opus |
| 1.6 Tenant time zone | D-02 | `settings.timeZone` (IANA, default `Asia/Baku`, validated with `Intl.supportedValuesOf('timeZone')`), routed through `src/lib/time.ts`, `baku-clock.ts` (renamed helpers keep old names as aliases), due dates, streak day key, scheduled reports (08:00 local), CSV/XLSX, certificate dates, `i18n/request.ts` timeZone; DST correct; Settings → Learning gets the picker (ten languages). Tests for Riyadh, Berlin (DST) and Baku. | Opus |
| 1.7 The offer matches the software | M-02, OPEN-Q 14/17 | Hide SAML, LDAP, Android-block and voice settings behind `UNBUILT_FEATURES` (shown only with an operator flag), voice campaigns refuse to launch without a real adapter (and never record "sent"), `PLAN_FEATURES` and the pricing page/landing plans updated, plan descriptions in ten languages. | Opus |
| 1.8 Observability, health, backups | O-03, O-04 | Structured JSON logger (`src/server/log.ts`) with request/tenant/user ids used by the job runner, mail, webhooks and actions' error paths; `/api/health` reports job-runner heartbeat (last tick time), outbox and webhook backlog; metrics endpoint (Prometheus text) behind an operator token; `scripts/backup.sh` + `restore.sh` for compose (pg_dump nightly, WAL note), `docs/OPERATIONS.md` runbook with RPO/RTO and `APP_SECRET` escrow. | Opus |
| 1.9 Request body limit | S-05, OPEN-Q 23a | `serverActions.bodySizeLimit` → 1 MB; sandbox upload moved to `app/api/sandbox/upload/route.ts` with the streaming cap from `request-body.ts` (10 MB); client updated; tests. | **Mythos** |
| 1.10 Staging and providers | M-01, OPEN-Q 1–5, 12 | Code can only prepare: `docker-compose.staging.yml` with TLS proxy (Caddy) and managed-PG variables, provider adapters' env documented, `docs/STAGING.md` runbook; the actual accounts/keys are owner items → OPEN-QUESTIONS. | Opus |
| 1.11 Native review and narration | M-03, M-04, OPEN-Q 2/7/22 | Owner items (reviewers, voices, ElevenLabs key). Prepare: `docs/build/NATIVE-REVIEW-PACK.md` per language (what to read, where), narration generation documented for CI as a manual step. | Fable |
| 1.12 Team | O-01 | Owner item (hiring); PR template + mandatory review documented in CONTRIBUTING. | Fable |

Merge order within Phase 1: 1.4 → 1.3 → 1.9 → 1.6 → 1.7 → 1.8 → 1.5 → 1.1 → 1.2 → 1.10. Checks, browser pass, commit, RUN-STATE.

## 4. Phase 2 — Security hardening and pentest (Mythos)

| WP | Closes | Content |
|---|---|---|
| 2.1 Identity | S-02, S-09, SEC I-2, ADR-033 (b), SSO domain-proof bug (DOC) | Bind `iss`+`sub` on first SSO sign-in (`users.sso_subject` additive migration), reject a different subject for the same email unless an administrator relinks; only verified claims; SSO callback re-checks the domain proof's validity before creating a learner; TOTP last-step stored per user, replay refused. |
| 2.2 Admin takeover controls | S-06, SEC L-7 | Step-up (password + TOTP) for 2FA reset, reset link, role change; email + in-app notice to the target and other administrators; peer-admin actions need a second administrator (or lower-role target); operator reset link becomes a consented, time-boxed support grant. |
| 2.3 Oracles and limits | S-08, SEC L-5, L-9, S-11 | Rate limits (existing `rateLimit` helper) on import preview, add dialog, domain verification, test email; neutral "cannot be added" reason for addresses outside the tenant; `tenants.domain` unique among verified; `lessonKey` validated; sign-off CSV restricted to admin/auditor roles. |
| 2.4 Password self-service | SEC L-8 | Profile → Security: change password (current + new, `passwordProblem`, other sessions signed out), ten languages, tests. |
| 2.5 Secrets and keys | S-07 | Envelope encryption with key id per ciphertext and `APP_SECRET_KEYS` ring (old key decrypts, new key encrypts); domain-proof values from a separate stable derived key; rotation runbook. |
| 2.6 Tutor cache and CSP | S-10, SEC I-3 | Tutor cache keyed per tenant; operator purge view; CSP left as is (accepted) but documented. |
| 2.7 Isolation in depth | S-03 | Generated cross-tenant test suite: every Server Action and route handler called with another tenant's ids and a lower role, asserting refusal (`tests/cross-tenant.generated.test.ts` built from an inventory script); RLS evaluated and, if feasible with Drizzle + per-transaction `SET LOCAL app.tenant_id`, applied to the ten largest tables in an additive migration. |
| 2.8 Supply chain | SEC I-4, I-6, I-7 | Dockerfile base pinned by digest; LDAP settings routed through `vetDestination` when saved; `next`/`nodemailer` patch updates. |
| 2.9 Simulation integrity | M-09, OPEN-Q 18 | Click counted only after a JavaScript beacon (second request) from the landing page; scanner detections kept; documented allow-listing guides for Microsoft 365 / Google Workspace in `docs/SIMULATION-DELIVERY.md`; dedicated sending domain = owner item. |
| 2.10 Pentest pass | owner's addition | Three independent Mythos attackers (lenses: authz/tenant isolation, injection/XSS/SSRF/upload, auth/session/SSO/2FA/rate limits) attack the running dev server and the code; every confirmed finding gets a fix WP (Mythos) and a regression test; then a second, independent Mythos verifier re-attacks the fixed build. Report: `docs/PENTEST-2026-11.md`. |

## 5. Phase 3 — Medium and Low findings, repository open items

| WP | Closes | Content | Model |
|---|---|---|---|
| 3.1 Lesson format | Q-04, D-06 | `formatVersion: 1` in every lesson file (script), checkpoint/stage schemas validated, `passthrough` removed where safe, content validated in CI, library import skipped when the content hash is unchanged, one bad lesson skip-and-alert instead of exit. | Opus |
| 3.2 Jobs and scale | D-03, D-10 | `job_runs` ledger table; per-tenant reminders/alerts/refreshers hourly, risk snapshot daily; batched risk `UPDATE … FROM VALUES`; campaign launch and whole-tenant recompute moved to the job queue with progress; platform-wide lookups scoped by tenant. k6 script in `portal/load/`. | Opus |
| 3.3 Page weight | D-04, Q-02 part, D-09 | Per-route message namespaces; `next/dynamic` mascot; avatars moved to the `assets` table with cached URLs (migration + backfill); Rive runtime and `mascot.riv` removed from `public/` (kept in `design/`); `@rive-app/react-canvas` dropped if the fallback is retired (ADR). | Opus |
| 3.4 Error handling | Q-03 client part | One `ActionResult<T>` type + `useAction()` client helper with toast and retry; segment `error.tsx` for learner, admin, super; the 36 `useTransition` call sites migrated in waves. | Opus |
| 3.5 Player and settings split | Q-01, Q-05 | One file per scene and per settings tab; memoised `SceneEnv`; component tests per scene type (Testing Library); campaign templates moved to `content/campaigns/templates.<lang>.json`; `rate-limit.ts` test branch replaced by an injectable store. | Opus |
| 3.6 Identity model and billing | D-05, M-05 | Seat counting per tenant + invoice export (CSV) in `/super`; memberships table design ADR (global identity ↔ tenant membership) — implement only the counting now, the model change is scheduled after pilots (ADR). | Opus |
| 3.7 Reporting channel and interoperability | M-06, M-07 | Per-tenant inbound report address (IMAP/webhook ingest adapter) that files a threat report and matches the simulation token; read-only reporting API with API keys (`/api/v1/reports/*`, scoped tokens, rate limited); SCIM is deferred (ADR) — SCORM is Phase 4. | Opus (API keys: **Mythos**) |
| 3.8 Analytics | M-08 | Operator metrics page: activation, weekly active learners, lesson drop-off, campaign funnels, per tenant; computed from existing tables; no third-party script. | Opus |
| 3.9 Studio editor | M-10 | Structured editor for choice, swipe and hotspot scenes with versions (`lesson_versions`) and per-language fields. | Opus |
| 3.10 Retention | L-03 | Per-tenant retention settings (answers, XP events, audit, risks, progress) enforced by the clean-up job; demo-request 24-month deletion (from 1.1). | Opus |
| 3.11 Docs | O-02, O-05, M-11 | English summaries of all ADRs (`docs/build/DECISIONS.en.md`), admin guide, learner quick start, integration guide (webhooks/syslog/API), security whitepaper outline, SLA/support policy templates. | Opus |
| 3.12 Smaller items | S-11 rest, D-07, SEC "not verified" | Dependabot options verified against GitHub docs, gitleaks first run expectations documented, `npm outdated` majors scheduled (Anthropic SDK 1.x migration via the claude-api skill). | Sonnet (mechanical) / Opus |

## 6. Phase 4 — The six strategic items

| WP | Item | Content | Model |
|---|---|---|---|
| 4.1 Market packs | owner item 1 | `portal/content/market/<lang>.json`: people names, currency and amounts, cities, government bodies, bank/courier/tax/cloud brand analogues; `brands.json` gains per-language `name` map; lesson text layer: a `market` substitution pass over the localized lesson files (names, amounts, cities, brands) producing committed files (no runtime cost), guarded by `locale-parity`; de, fr, ar first, then tr, ro, ka, uk, ru; a market reviewer agent per language checks that scenarios read local (Sparkasse-like bank, DHL-like courier, Elster-like tax notice for de). ADR-035. | Opus (translator + editor per language) |
| 4.2 Teachable-moment loop | owner item 2 | On `recordClick`/`recordSubmit`: within the hour (job) a 90-second micro-lesson built from the campaign template's red flags (AI Sel scene set, ten languages, offline fallback from template text), assigned with due date; completion feeds risk; two weeks later a harder re-simulation (same category, next difficulty) scheduled for the person; admin "loop" view shows click → micro-lesson → re-sim per person; settings toggle per tenant. Tests. ADR-036. | Opus; risk/evidence hooks **Mythos** review |
| 4.3 SCORM 1.2 export | owner item 4, OPEN-Q 11, M-07 part | `/admin/modules/:id/export/scorm` → zip with `imsmanifest.xml`, a self-contained player build (static lesson JSON + offline player bundle), `cmi.core.lesson_status` and score set on completion, ten languages selectable; tested with an open SCORM test harness in CI (scorm-again or a manifest validator). ADR-037. | Opus |
| 4.4 Mini-lab per module | owner item 5 | A generic "inbox moment" mini-lab in the VM lab engine driven by data: each of the 53 modules gets a `labs/<module>.json` scenario (artifacts from the module's own lesson scenes, 3–5 decisions, server-scored), listed after the module's lessons in paths; ten languages via the existing lesson translation pipeline; `LAB_IDS`/`labUnlocked` extended. | Opus |
| 4.5 CISO risk story | owner item 6 | Leadership panel "Risk story": sentences generated from data (department X weakest category, trend over 3 weeks, which campaign/training moved it), with the numbers underneath; ten languages via ICU messages, no AI dependency; export to the compliance pack. | Opus |
| 4.6 Server-side completion + legal | owner item 3 | done in 1.3 and 1.1 | — |
| 4.7 Narration in every browser (open-source voices) | owner addition 2026-11-05, M-04, OPEN-Q 2 | The only playback that works identically in every browser is a pre-generated clip played by `<audio>` — the pipeline exists (`scripts/generate-narration.ts`, manifests, `useNarrator`), it only lacks a provider that needs no paid key. Make the generator provider-agnostic (`--provider elevenlabs|piper|azure`): **Piper** (MIT, offline, CPU) for ka, ar, ro, tr, uk, ru, de, fr, en with its published voices; Azerbaijani has no Piper voice, so a short research step picks the best option whose licence allows commercial use (Azure Neural `az-AZ` Babek/Banu on the free tier is the practical candidate; Meta MMS-TTS is CC-BY-NC and excluded; a trained Piper voice from an open az corpus is the long-term open-source route) and the result goes to OPEN-QUESTIONS 2 with the exact ask. Clips as MP3 mono 48 kbps (universal: Safari, Firefox, Chrome, Samsung, iOS) via a static ffmpeg, served immutable from `public/narration/<lang>/`; word timings exact when the provider returns them (ElevenLabs, Azure word boundaries), otherwise proportional per sentence so karaoke still moves; the player unlocks audio on the first user gesture (iOS), preloads the next clip, and falls back to Web Speech only when no clip exists. Generation is a build step (`npm run narration`), clips are not committed; Dockerfile and CI run it for the shipped languages. **Scope now (owner, 2026-11-05): generate clips for az, en and ru only; the other seven languages keep the browser default (Web Speech) until the owner widens the scope** — the pipeline supports all ten so widening is one command. Tests for the manifest, the timing estimator and the fallback order. ADR-038. | Opus (research + pipeline), Fable (decision) |

## 7. Phase 5 — Reviews, final checks, documentation, commit

1. Independent reviews on the final tree: `ecc:security-reviewer` + `agent-skills:security-auditor` (Mythos), `ecc:code-reviewer` + `ecc:react-reviewer` + `ecc:typescript-reviewer` + `ecc:database-reviewer` (Opus), `agent-skills:test-engineer` on coverage; Codex: try `claudex-loop:codex-review` once — if the CLI still exits 139 (OPEN-Q 24) record it and rely on ECC.
2. Fix every confirmed finding (same model rule), re-run reviews on the diff.
3. Full checks + production build + browser pass in ten languages (screenshots), RTL, 375 px, motion Still.
4. Docs: `PROGRESS.md` cycle 11, ADR-035…, `OPEN-QUESTIONS.md` (owner items with exact asks), `CHANGELOG.md`, `README.md`/`docs/*` updated, `docs/AUDIT.md` gets a "closure status" column, `docs/SECURITY_REVIEW.md` statuses updated.
5. Final local commit; ask the owner before pushing.

## 8. Agent pattern for every phase

```
scout (Fable) → per-WP implementer in worktree (Mythos | Opus) → two reviewers on its diff (different lens; security → Mythos)
→ fixes by the implementer → Fable merges in order → full suite → browser check → commit → RUN-STATE
```
Workflow scripts live in `docs/build/workflows/` (copied from the scratchpad) so the run can be resumed from any session.

## 9. Verified register (summary)

Full detail per finding: [REGISTER-2026-11-05.md](REGISTER-2026-11-05.md). 178 findings; verdicts {"open":101,"partial":22,"needs_owner_decision":31,"fixed_on_branch":17,"not_an_issue":7}.

### auth-sso-session (14)

| id | sev | verdict | effort | title | needs owner |
|---|---|---|---|---|---|
| S-04 | high | partial (security) | S | Demo seed publishes a shared password, including for the platform operator | Rotate the :3100 presentation copy now (re-seed it with an own SEED_PASSWORD of  |
| TST-1 | high | fixed_on_branch (tests) | S | Passwords built from the person's own name or email were accepted |  |
| S-02 | medium | open | M | SSO accounts are linked by email address only | A real IdP test tenant (Entra ID or Google Workspace) to run the end-to-end SSO  |
| S-05 | medium | open | M | 11 MB request bodies are accepted by every Server Action |  |
| TST-2 | medium | fixed_on_branch (tests) | S | Internationalised domains (.рф .укр .გე .السعودية) could not be proven |  |
| TST-9 | medium | fixed_on_branch (tests) | S | Device limit could leave one session too many when the app clock runs ahead of the database clock |  |
| DOC-1 | medium | open | S | SSO callback and start ignore the domain proof; learners are auto-created for an unproven saved domain |  |
| MIS-1 | medium | not_an_issue | M | IDN tenant domain is stored in ASCII but every e-mail-domain comparison uses the raw Unicode domain (sibling of TST-2) | Whether IDN e-mail addresses (user@пример.рф) must be accepted at all; today the |
| S-09 | low | open | S | TOTP codes can be replayed inside their validity window |  |
| L-8 | low | open | M | Signed-in people cannot change their password |  |
| DMO-10 | low | open | S | Warm-up script inserts a 2FA-verified admin session straight into the DB and never removes it |  |
| MIS-5 | low | open | S | Owner action after rotation: check seeded instances' audit logs for unknown sign-ins; never expose a seeded instance even through a tunnel | Nothing; the first CI run (which only the owner can trigger by pushing) tells wh |
| I-6 | info | not_an_issue | S | LDAP settings are stored without destination checks |  |
| MIS-7 | info | needs_owner_decision | S | Development mode relaxes controls (public fallback key, DEV_SHOW_OTP, SSO may reach any host); npm run demo starts a dev server by default | Choose Dependabot (already configured and reviewed) or Renovate; if Renovate, de |

### campaigns-threats-drill (17)

| id | sev | verdict | effort | title | needs owner |
|---|---|---|---|---|---|
| TST-6 | high | fixed_on_branch (tests) | S | Pressing Launch twice (or scheduler racing a manual launch) sent the phishing simulation twice |  |
| DMO-3 | high | needs_owner_decision | S | live_drill gate is policy-only: any operator can switch it on for a real organisation | Whether operators may enable drills from /super for prospects' tenants (then Opt |
| M-09 | medium | open | M | Simulation accuracy and deliverability: scanner false positives, no dedicated sending domains | Registers the look-alike simulation domain(s) (Q18: which?), configures SPF/DKIM |
| M-06 | medium | open | M | No 'Report phishing' button in the mail client | Chooses the inbound mail provider (Mailgun/SES/Postmark inbound or an M365 conne |
| TST-7 | medium | fixed_on_branch (tests) | S | A simulation link opened twice at the same moment recorded two clicks (two risks, two events) |  |
| TST-8 | medium | fixed_on_branch (tests) | S | A fake sign-in submitted twice raised the risk and emitted 'simulation.risky' twice |  |
| DMO-4 | medium | open | S | 'A drill never sends anything' is true for the lure only: webhook/syslog deliveries, notifications and reminder-eligible risks are still produced | Decide: document only (recommended, live_drill is operator-only and DEMO.md alre |
| DMO-5 | medium | partial (demo) | S | No timer and a 20 s lease: a drill freezes when nobody polls, and a crash replays one step whose safety depends on the tests branch | Nothing. |
| TST-15 | low | open | S | Threat-report daily XP cap is count-then-award without a lock (sibling of the lesson-XP fix) |  |
| TST-18 | low | open | S | Cancel/complete by hand still reads status then writes unconditionally |  |
| DOC-19 | low | open | M | Closed loops can start only from a threat report or intel item; sandbox, incident and simulation sources exist only in schema and seed | The shape of the teachable-moment loop (delay before the micro-lesson, difficult |
| DMO-12 | low | fixed_on_branch (demo) | S | Shared threat-report matching changed for every real report: tracking link now beats subject across all candidates | Nothing. |
| DMO-18 | low | not_an_issue (demo) | S | Drill campaign is created as 'running' with unsent recipients and bypasses launchCampaign's checks | Nothing. |
| MIS-2 | low | fixed_on_branch (tests) | S | admin.audit integration event is selectable but only the Settings test event emits it |  |
| MIS-4 | low | open | S | Drill poll is a state-changing GET with no Origin check, contradicting the security review's CSRF claim and API.md's own convention |  |
| MIS-9 | low | open | S | An abandoned drill resumes on a completed campaign instead of ending | Nothing. |
| MIS-13 | info | open | S | A drill can end with organisation risk above its starting value |  |

### ci-testing (18)

| id | sev | verdict | effort | title | needs owner |
|---|---|---|---|---|---|
| T-02 | high | open | L | No integration or end-to-end tests of the running application | Merge order (tests branch first); GitHub Actions minutes; decide whether the smo |
| T-01 | high | fixed_on_branch (tests) | S | No continuous integration | Turn on branch protection and required checks; Actions minutes on the GitHub pla |
| T-03 | medium | open (tests) | M | The headline test count overstates behavioural coverage | The coverage floor value (take the first run's number minus a margin). |
| M-1 | medium | fixed_on_branch (security) | S | No automated dependency or secret scanning | Repository settings (Dependabot alerts, secret scanning, required checks); confi |
| TST-22 | medium | open | S | Flakiness risks: 23 PGlite boots per run, no per-test timeout, time-dependent and order-coupled tests | Open the Actions tab for the tests branch's push run (573f788) and report whethe |
| DMO-13 | medium | partial | M | Drill test coverage: good service/planner tests, but actions, route, lease takeover, train replay and UI are untested | Decide whether a deterministic lease-takeover test is worth adding a test seam t |
| D-07 | low | partial (security) | S | Dependency currency: 15 outdated packages, no automated updates, no engines field | Confirm Node 24 is the only supported version (drop the 'Node 22' promise). |
| SEC-3 | low | open (security) | S | CI pieces never executed in the review environment: gitleaks, npm audit signatures, the workflow, two Dependabot options | Merge, trigger the first run, read the Dependabot tab; network access for the SH |
| TST-19 | low | open | S | Every pull request from an in-repo branch runs the whole workflow twice |  |
| TST-21 | low | open | S | Build job has no Next.js build cache and no dependency on the checks job |  |
| REP-39 | low | open | S | tests/tutor.test.ts sweeps only English lessons; offlineAnswer over translations covered by small fixtures only |  |
| MIS-5 | low | open | S | Demo compose secrets will probably trip the security branch's gitleaks scan | Nothing; the first CI run (which only the owner can trigger by pushing) tells wh |
| MIS-6 | low | open | S | ci.yml uses unpinned action tags, so the security review's 'every action is pinned to a commit SHA' claim becomes false after merge | Turn on the branch protection rule requiring both workflows in the GitHub reposi |
| MIS-12 | low | open | S | PGlite-from-journal tests cannot catch the regenerated-0000 upgrade failure that D-01 warns about | Confirm that 0000_init.sql is frozen from now on (ADR-034 point 5 and ROADMAP 1. |
| AUD-9 | info | needs_owner_decision | S | No external penetration test has been done | Vendor choice, budget (USD 8-15k), a staging deployment with a real domain, the  |
| SEC-5 | info | partial (security) | S | Seed-guard test covers the predicate, not the script; local and demo paths keep the published password by design | Rotate the published demo password on every reachable instance (security H-1) an |
| TST-23 | info | not_an_issue (tests) | S | ci.yml verified consistent with the repo; nothing in it will fail on its face | Confirm the tests branch's GitHub run is green before merging; the report never  |
| MIS-9 | info | open | S | Follow-ups from the security fixes: remove the minimatch override later; Node and PostgreSQL majors are excluded from Dependabot | Nothing. |

### data-migrations-ops-deploy (25)

| id | sev | verdict | effort | title | needs owner |
|---|---|---|---|---|---|
| D-01 | high | partial (demo) | S | The migration history is regenerated from scratch | Nothing; the cut-over date in README/DECISIONS is the merge day of the demo bran |
| M-01 | high | needs_owner_decision | L | Never exercised against real providers or a real deployment | ANTHROPIC_API_KEY and the two model choices (Q1); the SMTP account and sending d |
| O-03 | high | open | M | No observability | Only if a hosted error tracker is wanted: the Sentry (or other) DSN and where al |
| O-04 | high | open | S | No backup, restore or disaster-recovery procedure | Where off-host copies go (which storage account) and the acceptable RPO/RTO; not |
| DMO-1 | high | needs_owner_decision (demo) | S | Incremental migrations 0001/0002 vs repo convention of regenerating 0000_init.sql: incremental must win | Confirm the policy flip (ADR-034 §5) now rather than at first release, and say w |
| AUD-1 | medium | open | S | Docker image build not executed by the audit (nor by the team) | Nothing; GitHub-hosted runners have Docker. If the repository stays private and  |
| SEC-1 | medium | needs_owner_decision | S | Development fallback APP_SECRET is public: rotate stored secrets if any local or demo database ever held real ones | The decision: did the local database, the :3100 presentation copy or any shared  |
| S-07 | medium | open | M | One application secret, no key versioning or rotation | Nothing to build it; a rotation itself needs the owner to set APP_SECRET_PREVIOU |
| D-03 | medium | open | L | Background work and risk recomputation will not scale linearly | Nothing for the code; a target scale (tenants x learners) to size the load test. |
| D-06 | medium | partial (tests) | S | The content library is imported at every start and a single bad file stops the server | Nothing. |
| TST-13 | medium | open (tests) | S | CI never touches real PostgreSQL, the pg driver, the migrate scripts or the Docker image | Nothing; optionally a Docker Hub token as a repository secret if pulls get rate- |
| DMO-8 | medium | open | S | Docker demo compose will stop seeding once the security branch's SEED_PASSWORD guard is merged | Pick the demo value (12+ characters, not the published one) or choose the requir |
| DMO-9 | medium | open | S | npm run demo wipes the local database by default and, on Windows, probably orphans next dev on Ctrl+C | Which default matters more: fresh organisation each run (presenter) or never del |
| REP-10 | medium | needs_owner_decision | S | Real product domain and sending domain unknown; code uses cyclowareness.com as example | The real product domain and the email sending domain (and who controls their DNS |
| REP-12 | medium | needs_owner_decision | M | Hosting choice and region (cloud like the original vs customer server) undecided | Hosting provider, region/data-residency requirement, a server or account to depl |
| L-4 | low | partial (security) | S | SMS gateway over plain HTTP accepted silently | Decide warn vs refuse now (nothing is deployed, so refusing costs nothing today) |
| DMO-17 | low | partial (demo) | S | Session-stated follow-ups: embedded-DB lock out of scope, Docker Hub workaround unexplained, sixth session unknown | Nothing for the lock. For the Docker Hub note, only the original session owner k |
| REP-5 | low | needs_owner_decision | S | SALES_EMAIL for demo requests not set | The sales inbox address, and the SMTP server/credentials for platform mail (or a |
| REP-24 | low | needs_owner_decision | S | Local Node 24.18.0 is below 24.22.1 needed for the Brotli CVE | The local Node upgrade itself and the decision to restart the presentation copy  |
| MIS-3 | low | open | S | docker-compose.demo.yml ships a fixed APP_SECRET and database password in the public repository |  |
| MIS-6 | low | open | S | Seed still creates a super_admin, truncates every table under ALLOW_SEED=1 and has no non-empty-database guard after the password fix | Turn on the branch protection rule requiring both workflows in the GitHub reposi |
| MIS-8 | low | open | S | Every per-address control depends on TRUST_PROXY matching the reverse-proxy hop count, which no deployment has validated | The merge itself (commit only when asked) and which text leads README.md: the do |
| AUD-15 | info | open | S | No incident-response plan, post-mortem template, on-call rota or quarterly access review | Who is on call (today: the founder alone), the contact channel and phone, the ho |
| I-4 | info | open | S | Docker base image pinned by tag, not digest | The policy choice above (reproducible digest + merge Dependabot weekly, versus ` |
| SEC-4 | info | needs_owner_decision | S | Review scope limits: no dynamic testing, hosting, TLS proxy, demo machines or demo launcher reviewed | Hosting provider, domain and TLS proxy choice (Caddy/nginx/Traefik), the staging |

### docs-process-repo (26)

| id | sev | verdict | effort | title | needs owner |
|---|---|---|---|---|---|
| O-01 | high | open (tests) | S | Key-person risk and an AI-generated codebase without human review | Hire or contract the second engineer; turn on branch protection and required che |
| O-06 | medium | partial (docs) | S | Repository hygiene: no LICENSE, SECURITY.md, CONTRIBUTING.md or CODEOWNERS; third-party logo and screenshots committed | Licence choice (proprietary vs open source) and the exact notice text, the legal |
| O-02 | medium | partial (docs) | M | Engineering documentation is mostly in Azerbaijani | Choose English-only vs bilingual engineering docs going forward; nothing else. |
| O-05 | medium | partial (docs) | M | No customer-facing operating documentation | SLA terms, support hours and channels, status-page provider; legal review of the |
| SEC-2 | medium | needs_owner_decision | S | Repository settings to turn on: secret scanning with push protection, Dependabot alerts and security updates, required Security workflow | Repository admin rights on GitHub; confirmation that the repository is public (p |
| DMO-2 | medium | open | S | schema.ts rewritten wholesale: 45 real lines hidden in a 1,032-line reformat | Nothing; the owner should know the sixth session may hit the renormalise commit. |
| MIS-1 | medium | not_an_issue | M | ARCHITECTURE.md claims mail-scanner detonations never create false clicks, contradicting audit M-09 | Whether IDN e-mail addresses (user@пример.рф) must be accepted at all; today the |
| MIS-3 | medium | open | S | Docs branch states the regenerate-0000 convention, 51 tables and no drill endpoint; the demo branch contradicts all three |  |
| D-08 | low | open | S | Development-environment coupling: founder-machine paths, forced webpack, Google Fonts at build | Decide whether the three machine-specific launch entries stay local (skip-worktr |
| D-09 | low | open | S | Dead weight in the repository and image: unused Rive assets, design PNGs, Open Graph font | Confirm the Rive robot and the duck design sheets may be deleted (the skill and  |
| DMO-15 | low | partial | S | Documentation inconsistencies and guaranteed merge conflicts with sibling branches | Whether cloud sessions may push branches at all (the CLAUDE.md rule) and the fin |
| AUD-4 | info | not_an_issue (audit) | S | Audit baseline is commit b5c935a, one commit behind current main |  |
| AUD-6 | info | needs_owner_decision (audit) | XL | Investment conditions: chain-of-title before closing, second engineer within 30 days, 90-day exit criteria as tranche milestone | Ownership evidence for content, mascot and brand; the hiring decision; pilot cus |
| AUD-7 | info | needs_owner_decision (audit) | S | Roadmap capacity assumption: founder plus one contract senior engineer from day 1 | Decide hire-now vs founder-alone timeline and budget; nothing else. |
| AUD-8 | info | needs_owner_decision | S | Plan start date assumed to be Monday 2026-11-09 | The start date (and whether the second engineer is contracted by then, L19 capac |
| AUD-10 | info | open | M | SOC 2 / ISO 27001 readiness gap list not started | Which framework first (SOC 2 Type 1 is the usual ask from US/UK buyers, ISO 2700 |
| AUD-11 | info | needs_owner_decision | S | Roadmap budget figures are estimates to be confirmed with vendors | Vendor quotes (law firm for az/en, pen-test firm, native reviewers per language, |
| AUD-16 | info | needs_owner_decision | S | Feature freeze until day 60 against scope creep from the 25 open questions | The commitment itself, and the ruling on the six strategic items versus the free |
| TST-24 | info | open | S | CHANGELOG lists 9 fixes while the session report says 10; CHANGELOG sits at repo root | Whether an ADR for the pattern is wanted at all. |
| DOC-22 | info | open | S | ARCHITECTURE understates voice launches and omits domainProofForced and VOICE_PROVIDER | Nothing. |
| REP-25 | info | needs_owner_decision | S | Codex CLI crashes on this machine (0xC0000005 / exit 139); Codex/Claudex Loop reviews replaced by ECC and agent-skills reviewers | The decision itself (keep Codex in the review loop or not). If kept: upgrading/r |
| REP-28 | info | open | S | PROGRESS.md status lines are stale (header dated 2026-10-19; 'commit and push not yet done' while main is at 683f272) |  |
| MIS-10 | info | open | S | Security severities assume a multi-tenant SaaS with untrusted tenant administrators | Nothing. |
| MIS-14 | info | needs_owner_decision | S | Cloud session pushed its branch despite CLAUDE.md's 'never push' rule | Whether cloud sessions are allowed to push branches/PRs. |
| MIS-7 | info | needs_owner_decision | S | Roadmap prescribes Renovate while the security branch ships Dependabot | Choose Dependabot (already configured and reviewed) or Renovate; if Renovate, de |
| MIS-8 | info | open | S | Merge surface verified: one textual conflict (README.md); lockfile and migration metadata exist but are absent from the .diff files | The merge itself (commit only when asked) and which text leads README.md: the do |

### frontend-ux-a11y-perf (17)

| id | sev | verdict | effort | title | needs owner |
|---|---|---|---|---|---|
| Q-01 | medium | open | M | Oversized modules in the product core, without component tests |  |
| Q-02 | medium | open | M | 3,182-line vendored mascot engine outside lint and type checking | Whether the design/mascot-cat/source fork may be deleted (README calls it histor |
| D-04 | medium | open | L | Avoidable page weight: full message catalogue, mascot engine and base64 avatars on every page | Whether avatars should move to object storage at all (none is configured; PGlite |
| TST-17 | low | open | S | A second Launch click is told 'the audience is empty' | Nothing; the ten translations can be reviewed by the owner after the fact. |
| DMO-6 | low | open | S | Polling cost and GET-with-side-effects: one request per second per open dashboard, each one applying events and running five queries | Nothing. |
| REP-20 | low | needs_owner_decision | S | Final mascot choice (duck vs cat) still with the owner; returning to Rive now needs `auto`/`onCat` handling | The final mascot choice (cat vs Rive robot vs duck), OPEN-QUESTIONS item 21. |
| REP-30 | low | open | S | Light/motion leftovers: flyToXp has no caller; CountUp and tour scrolling ignore Calm | Only if the owner wants flyToXp kept for a future Home-page XP animation instead |
| REP-31 | low | open | M | Mascot narration gaps: intro mood ignored, pointing only in TutorScene, many gestures/moods with no code path, talkbody amplitude never driven | Whether lesson authors will add highlight targets to choice/hotspot scenes (othe |
| REP-32 | low | partial | S | Mascot: public pages cannot honour a learner's Still preference, no mapping tests, inferred Rive tables unverified, Calm's effect on the mascot unknown | What Calm did to the original mascot (not in docs/audit; only the owner saw it). |
| REP-34 | low | partial | M | Animation gaps vs original: landing stage keyframes absent, Lens does not travel between details, no simulation frame glow, confetti layer unconfirmed | Whether the original had a full-screen confetti/celebrate layer and what the nin |
| REP-35 | low | partial | S | Animation polish left open: admin page transitions, ProgressBar fill-on-load, admin skeleton coverage, dialog exit, hotspot pulse, timer ring, unused blink token | Nothing. |
| REP-40 | low | needs_owner_decision | XL | Illustrations are Lucide icon compositions, not the redrawn two-tone scenes the spec requires | The art itself: who draws or approves 29 scenes (commission budget or acceptance |
| REP-41 | low | open | S | Scenario staging: node visual and character ignored; the 13 characters have no avatars or own voices | 13 character portraits (or approval of generated ones) and ElevenLabs clips/keys |
| REP-43 | low | needs_owner_decision | S | Simulation environments are stylised frames, not full mock apps; `order` drag and hotspot miss rules unverified | Screenshots or recollection of the original browser/desktop/phone/call environme |
| MIS-12 | low | open | S | First-visit admin tour overlay covers the drill setup page | Confirm that 0000_init.sql is frozen from now on (ADR-034 point 5 and ROADMAP 1. |
| DMO-14 | info | open | S | RTL, logical CSS, hydration and hard-coded strings in the new UI: checked, only cosmetic remarks | Nothing. |
| REP-33 | info | needs_owner_decision | S | Home 'Talk to the tutor' opens text+mic panel instead of the original's voice tutor; rail logo is the static shield, not the mascot | Whether the home tutor must be voice-first like the original (and whether the ra |

### i18n-locale-time (9)

| id | sev | verdict | effort | title | needs owner |
|---|---|---|---|---|---|
| D-02 | high | open | XL | Every organisation runs on Baku time (UTC+4, no DST) | Nothing to build it; the owner only confirms that the zone is per organisation ( |
| M-03 | high | open | L | Seven of ten languages, including the legal texts, have not been reviewed by people | Company name, registration number, address and contact for 16.1/16.2; a lawyer p |
| AUD-18 | medium | needs_owner_decision | M | Open terminology choices for the launch languages unresolved; next-language order is a recommendation | The decision itself (keep vs delegate) and the language order; the native review |
| TST-16 | medium | partial (tests) | S | senderDomain still rejects internationalised domains, so the IDN proof cannot be used for branded mail | Nothing. |
| DMO-7 | medium | open (demo) | S | Nine admin.json locales (az ar de fr ka ro ru tr uk) are machine-translated with no native-speaker review | Reading the az block; native reviewers for de/fr/ar (same people as M-03). |
| REP-6 | medium | partial | S | az/ru lessons: native-speaker final read still recommended; az voice quality device-dependent | A native az and ru reader; voice selection and ELEVENLABS_API_KEY/plan for clips |
| REP-29 | medium | open | S | AI subtitles are unchecked machine translations and may be translated twice across replicas | ANTHROPIC_API_KEY for the live run; whether more than one replica is planned (if |
| REP-36 | medium | partial | S | No check that a translated app/brand name keeps one form within a lesson; two lessons already mix forms | Nothing; the editor's choice of Latin vs Cyrillic for the ru name is a one-line  |
| Q-05 | low | open | M | Smaller code-quality items: ten-language texts in code, lint suppressions and casts, test-only branch, two marked shortcuts | Nothing. |

### learning-completion-xp-certs (17)

| id | sev | verdict | effort | title | needs owner |
|---|---|---|---|---|---|
| S-01 | high | open | M | Training evidence and risk inputs are asserted by the browser | FRACTION of lessons.minutes used as the minimum dwell (suggest 0.25); whether pr |
| Q-03 | high | partial (tests) | S | Inconsistent error handling and non-transactional multi-step writes; duplicate certificates possible | Merge order of the five branches; running the migration. |
| TST-3 | high | fixed_on_branch (tests) | S | A lesson completion sent twice at the same moment awarded its XP twice |  |
| DMO-11 | high | not_an_issue (demo) | S | The drill's training step relies on the missing server-side lesson completion check and will silently stop working when that check lands |  |
| Q-04 | medium | open | S | Lesson format is unversioned and loosely validated at the edges | Whether formatVersion is wanted now (touches ~1060 content files and the Studio  |
| TST-5 | medium | fixed_on_branch (tests) | S | Lesson XP split wrong for Studio/SecOps modules (lessons numbered from 1; a gap loses XP) |  |
| REP-42 | medium | needs_owner_decision | S | Original feature flags missing: time_limits, teachable_moment, custom_attestation_text, custom_certificate, spaced_review, nudges; timers hard-coded to Medium/Hard choice scenes | Which original flags are plan tiers (pricing) vs plain settings; what the origin |
| REP-46 | medium | open | S | Automatic refresher is a monthly behavior_risks row pointing at the next open module, not the 'one short refresher lesson' the settings copy promises | Choose A (correct the copy now, S) or B (the OWN-2 micro-lesson as the refresher |
| L-3 | low | fixed_on_branch (security) | S | Studio training draft accepted any amount of extra JSON |  |
| TST-10 | low | fixed_on_branch (tests) | S | Modules report 'Completion %' could exceed 100 % (counted unassigned takers) |  |
| TST-14 | low | open | S | Learning-path certificate is still issued by check-then-insert (sibling of the attestation fix) | Running db:generate/db:migrate; merge order. |
| REP-38 | low | open | S | tutor_cache rows are not tied to lesson text; stale answers survive a re-translation |  |
| REP-47 | low | open | M | 'Start module over' only links to lesson 1 (no reset); 'My path' reduced to 'assigned to me' | What 'Start module over' should actually do (the original's behaviour is unrecor |
| MIS-2 | low | fixed_on_branch (tests) | S | Attestation double-submit fix (tests branch bug 4) is not in the register; certificate issue stays outside the transaction |  |
| MIS-10 | low | open | S | Live-session registration capacity is check-then-insert (sibling of the tests branch's claim fixes) | Nothing. |
| MIS-11 | low | open | M | Client-asserted learning inputs beyond lesson completion that S-01 implies but does not enumerate | Whether a studio author's draft preview should record any progress at all, and t |
| MIS-11 | info | open | M | Module attestation double-submit fix on the tests branch is not recorded as a partial closure of Q-03 | Whether a studio author's draft preview should record any progress at all, and t |

### legal-content-ownership (5)

| id | sev | verdict | effort | title | needs owner |
|---|---|---|---|---|---|
| L-01 | critical | open | M | Legal texts name the wrong AI processor and lack the provider's identity | Legal entity name, registration number, address, privacy contact and security co |
| L-02 | critical | partial (docs) | S | Intellectual-property chain of title for inherited lessons, mascot and design is undocumented | Who built cylosof.com and under which entity; IP assignment or employment/contra |
| MIS-4 | medium | open | S | The repository is public: proprietary code, 1,060 lesson files and the mascot are readable by anyone, with no licence |  |
| REP-9 | low | needs_owner_decision | S | Acceptable-use and password policies need legal review | The lawyer (shared with L-01) and the decision template-vs-binding; the original |
| AUD-14 | info | open | S | No data room; trademark and domain status undocumented | Trademark filings (or the decision to file) for the product and mascot names; re |

### product-gap-strategic (19)

| id | sev | verdict | effort | title | needs owner |
|---|---|---|---|---|---|
| M-02 | high | open | M | Plans include features that are not built, and some settings do nothing | Whether the two voice templates stay visible with a 'coming' label or are hidden |
| M-04 | high | open | S | Natural-voice narration has not been generated | ELEVENLABS_API_KEY and plan; a native speaker per language to pick the voice (az |
| M-07 | high | open | XL | No interoperability with customers' existing systems | Which LMS (SAP SuccessFactors, Cornerstone) to test the package in; whether LMS  |
| OWN-1 | high | open | L | Market packs for de, fr, ar: local names, currency, government bodies and brand analogues | Target markets per language (de: DE/AT/CH; fr: FR/BE/CH/CA; ar: which country an |
| OWN-2 | high | open | M | Teachable-moment loop: click -> 90-second AI Sel micro-lesson within an hour -> harder re-simulation two weeks later | Plan placement (professional vs enterprise) and pricing copy; the notification w |
| OWN-5 | high | open | XL | A mini-lab per module (53 modules, 3 VM labs today) | Which modules get a lab first, lab copy and red-flag design per scenario, and th |
| OWN-6 | high | open | M | CISO 'risk story' panel: answers instead of numbers | Which attack-category grain to name in the sentence: the 12 template names (fine |
| M-10 | medium | open | L | Customers can author only a minimal lesson type | Which scene types the first customers need; approval of AI translation of custom |
| M-05 | medium | open | M | No billing, seat metering or self-serve trial | How pilots are invoiced (manual, which currency), trial length, whether self-ser |
| M-08 | medium | open | M | No product analytics or usage telemetry | Whether cross-tenant aggregate metrics are acceptable under the privacy texts (Q |
| DOC-10 | medium | open | M | Threat and policy intelligence have no feed ingestion; items exist only from the demo seed | Decide manual entry (recommended now) versus a feed connector, and if a feed, wh |
| M-11 | low | open | S | Smaller product gaps: print-to-PDF only, static-only sandbox naming, no native app, no landing CMS | Whether a pilot needs PDF attachments; whether 'Sandbox' may be renamed; whether |
| AUD-5 | low | needs_owner_decision | S | Pricing (USD 2/3/4 per user per month) not confirmed by the owner | The price per plan, the volume bands, and confirmation of the three plan names. |
| DOC-14 | low | open | S | risk.threshold_crossed is offered in Settings and translated in ten languages but never emitted | None. |
| REP-45 | low | open | S | Materials with origin 'ai' exist only in the seed; no server code generates AI materials | Which option (generate on conversion, or drop the 'ai' origin). An ANTHROPIC_API |
| AUD-12 | info | needs_owner_decision | L | Decision deferred: build SAML (vetted library) or SCIM in days 61-90, per pilot | The pilot's identity provider and whether they need provisioning (SCIM) or sign- |
| AUD-13 | info | needs_owner_decision | S | No customers or design-partner pilots; no outcome evidence yet | Everything: the partner organisations (at least one regulated), a free-pilot-for |
| AUD-17 | info | open | S | On-premise readiness: self-hosted fonts and an offline AI mode | Only the decision that on-premise is a target before a customer asks; the fonts  |
| DMO-16 | info | open (demo) | S | Calibration figures are external citations not verified here; two metric semantics are debatable | Confirm the KnowBe4 report edition, figure and URL; decide whether the dashboard |

### tenant-admin-privacy (11)

| id | sev | verdict | effort | title | needs owner |
|---|---|---|---|---|---|
| S-06 | medium | open | M | Account-takeover tooling without step-up authentication | Whether peer-administrator actions need a second approver (separation of duties) |
| S-03 | medium | open | M | Tenant isolation has a single layer | Whether enterprise buyers require database-level RLS contractually (drives the X |
| D-05 | medium | needs_owner_decision | XL | One email address can belong to only one organisation | Decide whether one person may belong to several organisations before the first p |
| L-03 | medium | open | M | Data retention and residency are not configurable | Where the 24-month demo-request promise is published (so the job matches it), th |
| S-08 | low | open | S | Cross-tenant account-existence oracle for tenant administrators | Whether the preview may replace 'exists' with a neutral reason for addresses out |
| S-11 | low | partial (security) | M | Smaller hardening items: inline-style CSP, non-unique tenant domain, unbounded lessonKey, sign-off IPs visible to content creators, dev-only audit advisories | Which roles count as auditors for sign-off IPs (audit.read is the obvious set);  |
| S-10 | low | open | S | AI tutor answers are cached across organisations by question text | Accept the higher tutor spend per tenant, or keep sharing and instead moderate a |
| D-10 | low | open | S | Platform-wide module and lesson lookups per request |  |
| L-2 | low | fixed_on_branch (security) | S | People CSV import stored unbounded field lengths |  |
| L-9 | low | open | S | No rate limit on domain verification and test email |  |
| I-1 | info | fixed_on_branch (security) | S | Notification placeholders could print inherited object members |  |
