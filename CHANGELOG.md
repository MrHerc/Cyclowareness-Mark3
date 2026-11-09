# Changelog

All notable changes to this project are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased] - 2026-11-05 closure run

### Added

- **Certificates show how their evidence was obtained.** Attestations and certificates carry
  `evidence` (`server_verified`, or `self_reported` for rows from before this release), shown as a
  fourth "Evidence" cell on the public verification page `/c/{token}`, as a column of the
  compliance pack's confirmations table and in the personal data export.
  (`portal/src/app/(public)/c/[token]/page.tsx`, test: `tests/reports-build.test.ts`)
- **Per-organisation time zone.** Settings → Languages has a "Time zone" picker (IANA zones, `UTC`
  included, default `Asia/Baku`). Due dates end at 23:59:59 local time, streak days turn over at
  local midnight, scheduled reports go out at 08:00 local time, and CSV/XLSX cells, date labels
  and the public certificate page use the organisation's zone, correct across daylight-saving
  changes. (`portal/src/lib/time.ts`, test: `tests/time-zone.test.ts`)
- **Password change for signed-in people.** Profile → Security has a "Change password" dialog
  (current password, the same rules as the reset link); other sessions are signed out and the
  change is audited. Shown only for accounts that have a password. (test: `tests/auth-security.test.ts`)
- **Unlink single sign-on.** An administrator can unlink a person's identity-provider account from
  the person page; the next SSO sign-in binds it again (audit `sso.unlinked`).
  (test: `tests/people-operator.test.ts`)
- **`risk.threshold_crossed` webhook event.** Emitted once when a person's risk score rises from
  below the organisation's risk threshold to at or above it, with `{ userId, score, threshold }`.
  (`portal/src/server/services/risk.ts`, test: `tests/risk-threshold-event.test.ts`)
- **Health check with details.** `/api/health` answers JSON: database state, the job runner's last
  tick and whether it is stale (over 5 minutes), and the queued mail and webhook backlog. A signed-in
  platform operator also sees the client address the server derived, to validate `TRUST_PROXY`.
  (`portal/src/app/api/health/route.ts`, test: `tests/health-route.test.ts`)
- **Backups and an operations runbook.** `portal/scripts/backup.sh` (nightly `pg_dump`, 14 days kept)
  and `portal/scripts/restore.sh` for the compose stack; `docs/OPERATIONS.md` covers monitoring,
  incident response, backups (RPO 24 h), `TRUST_PROXY` and the quarterly access review.
- **Legal documents for buyers.** `docs/legal/SUBPROCESSORS.md` (the single list of sub-processors)
  and a data processing agreement template in English and Azerbaijani
  (`docs/legal/DPA-template.md`, `docs/legal/DPA-template.az.md`), marked for counsel.
- **Repository paperwork.** A proprietary `LICENSE`, `SECURITY.md`, `CONTRIBUTING.md`, a root
  `CODEOWNERS` and `docs/build/CHAIN-OF-TITLE.md` listing every inherited asset (106 lessons in 53
  modules, the mascot, tokens, landing copy, legal texts, policies) with evidence still to be supplied.
- **Browser smoke tests.** A Playwright suite (`portal/e2e/smoke.spec.ts`, `npm run e2e`) signs in as
  learner, administrator and platform operator in English and Arabic and runs against the production
  build in CI.
- **CI checks migrations on PostgreSQL 16.** A new job applies every migration twice to a
  PostgreSQL 16 service (the second run must change nothing) and fails when `schema.ts` has changes
  without a migration. The checks job reports coverage with a 60 % line floor; a Docker build job
  and an e2e job were added. (`.github/workflows/ci.yml`)
- **Live drill endpoint documented.** `GET` and `POST /api/admin/drill/{id}` in `docs/API.md`.
- **Support access needs the organisation's consent.** Settings → Security lets an organisation
  administrator allow Safarov Industries support for 72 hours and revoke it (audit
  `support.access_granted` / `support.access_revoked`); the operator console shows the state per
  organisation. Without an open window the operator cannot create a link for an administrator.
  (`portal/src/server/actions/settings.ts`, `portal/src/server/actions/platform.ts`, test: `tests/step-up.test.ts`)
- **Per-organisation data retention.** Settings → Protection → Data retention sets audit and learning
  retention in months (0 to 120, 0 keeps everything and is the default). The daily clean-up deletes that
  organisation's older audit entries, answers and closed behaviour risks within its time budget and
  records each purge as `retention.purged`; lesson progress, XP, attestations, certificates and open
  risks are never deleted. `docs/OPERATIONS.md` has a retention and residency section.
  (`portal/src/server/jobs.ts`, tests: `tests/jobs-ops.test.ts`, `tests/retention-settings.test.ts`)
- **Simulation sender on a proven look-alike domain.** Settings → Email → Simulation sender: after the
  organisation publishes its domain-proof TXT record on a look-alike domain and checks it, simulation
  mail (only) can go out from an address on that domain. `docs/SIMULATION-DELIVERY.md` covers SPF, DKIM,
  DMARC and allow-listing in Microsoft 365 and Google Workspace.
  (`portal/src/server/mail.ts`, test: `tests/simulation-sender.test.ts`)
- **SCORM 1.2 export.** Studio → "Export for an LMS" downloads a module as a SCORM 1.2 zip (manifest,
  launcher, an offline player and the lessons in one language) through
  `GET /api/admin/modules/{id}/scorm`, rate limited and audited as `module.exported`. The package
  reports status, score (mastery 80) and session time to the LMS and nothing back to the portal.
  (`portal/src/server/scorm/`, `portal/src/scorm/`, `portal/scripts/build-scorm-player.ts`, tests:
  `tests/scorm-export.test.ts`, `tests/scorm-api.test.ts`, `tests/scorm-player.test.ts`,
  `tests/scorm-player-cache.test.ts`)
- **Leadership risk story.** The Leadership page opens with four to six sentences built from the
  organisation's data (risk trend, most exposed department and its weakest category, the campaign that
  moved most, the top training, certificates this quarter) and a recommended assignment; the same
  sentences are the first section of the compliance pack, titled with the date of printing. Template
  text in ten languages, no AI. (`portal/src/server/queries/risk-story.ts`, test: `tests/risk-story.test.ts`)
- **Operator usage metrics and seat export.** `/super/metrics` shows per-organisation aggregates (active,
  invited, weekly and monthly active people, lessons, modules, campaign funnel, server-verified
  certificates); `GET /api/super/seats` returns a seat CSV per organisation for the month, for platform
  operators only, audited as `seats.exported`. (`portal/src/server/queries/platform-metrics.ts`, test:
  `tests/platform-metrics.test.ts`)
- **Customer and English engineering documents.** `docs/ADMIN-GUIDE.md`, `docs/LEARNER-QUICKSTART.md`,
  `docs/SECURITY-WHITEPAPER.md`, an English index at the top of `docs/build/DECISIONS.md` and
  `docs/build/OPEN-QUESTIONS.en.md`. The whitepaper was written before step-up, key rotation and
  retention settings were merged and still lists them as not provided.
- **Cross-organisation test suite.** `portal/scripts/inventory-surface.ts` lists every exported server
  action and API route method with its guard (`portal/tests/fixtures/surface.json`), and
  `tests/cross-tenant.test.ts` calls each one with another organisation's ids and with a lower role and
  checks that the other organisation's rows stay unchanged; an entry point without a row fails the suite.

### Changed

- **Database migration `portal/drizzle/0003_wave_a.sql` (additive).** New table `job_ticks`
  (job runner heartbeat); `evidence` columns on `attestations` and `certificates`, with unique keys
  per person and module (`attestations_user_module_idx`, `certificates_user_module_idx`) and per
  person and learning path (`certificates_user_path_idx`); `lesson_progress.started_at` and `reached`;
  `users.sso_subject` and `users.totp_last_step`. A database that already holds duplicate
  attestations or module/path certificates must be deduplicated (or reseeded) before it migrates.
- **Lesson completion is verified on the server.** The player sends what was picked in each scored
  scene; the server scores it from the stored lesson, checks that the attempt was started, that the
  last scene was reached and that at least max(20 s, 25 % of the lesson's minutes) passed, and
  refuses otherwise with a message to the learner and an audit entry
  (`learning.completion_refused`). Time trained is measured by the server, capped at three times the
  lesson's nominal length. A Studio draft preview earns nothing.
  (`portal/src/lib/content/scoring.ts`, tests: `tests/lesson-scoring.test.ts`,
  `tests/learning-actions.test.ts`)
- **The seed has no published password.** `SEED_PASSWORD` ships empty in `portal/.env.example`; the
  seed takes it from the environment or `portal/.env.local` (12 characters or more) or generates a
  random one and prints it once. (`portal/scripts/seed.ts`, test: `tests/seed-guard.test.ts`)
- **`npm run demo` keeps the demo organisation between runs** and applies pending migrations;
  `--reset` rebuilds it (replaces `--keep-data`). The Docker demo needs `portal/.env.demo`
  (from `portal/.env.demo.example`) and `--env-file portal/.env.demo`.
- **The live drill dashboard polls with `POST`**, behind the same-origin check; `GET` only reads.
  A drill whose campaign was completed or cancelled stops where it is, and the job runner now plays
  unwatched drills to their end. (tests: `tests/drill-route.test.ts`, `tests/drill-service.test.ts`)
- **The live drill feature can no longer be switched on from the operator console**; only the demo
  seed enables it.
- **The offer matches the software.** The SAML option, the LDAP card and the Android screen-block
  switch are no longer shown in Settings (stored values are kept), LDAP is out of the Professional
  plan, and the sales pages (`docs/business/plans.html`, `Cyclowareness-Pricing.html`) no longer sell
  voice-call simulations, SAML or directory sync.
- **Voice campaigns refuse to launch in every environment**; the wizard no longer offers the voice
  channel and `VOICE_PROVIDER` is gone. (test: `tests/voice-launch.test.ts`)
- **Refresher wording in ten languages** now describes what the monthly job does (the next open
  module, due in 14 days, no XP lost); the task is titled "Monthly follow-up training".
- **Privacy Policy v3 and Terms v2 (effective 2026-11-05, ten languages).** They name Anthropic for
  AI Sel, AI subtitles and Studio drafts, the browser's own speech engine and a text-to-speech
  provider that receives lesson text only; they no longer promise masking the code does not do; the
  demo form and retention clauses match the code. Landing `consentVersion` and the "ai-data" FAQ
  follow. Still subject to the lawyer's review.
- **Server logs are one JSON line per event in production** (`portal/src/server/log.ts`); errors never
  include messages or query parameters. (test: `tests/db-errors.test.ts`)
- **Retention.** The daily clean-up deletes demo requests after 730 days and stored AI Sel answers
  after 365 days. (test: `tests/jobs-ops.test.ts`)
- **The Docker image build runs the lesson translation check** before `next build`.
- **Node.js 24 is required** (`engines`, `portal/.nvmrc`, README, `docs/DEMO.md` and the demo launcher).
- **Machine-specific paths removed** from the workflow scripts, glossaries and build notes;
  `.claude/launch.json` holds only the repository-relative `portal` entry.
- **The admin guide no longer opens by itself on the live drill page**, and number count-ups and tour
  scrolling follow the Calm motion setting. (test: `tests/motion.test.ts`)
- **Database migration `portal/drizzle/0004_wave_b.sql` (additive).** Index `answers_tenant_at_idx` on
  `answers (tenant_id, at)` and the partial unique index `tenants_domain_verified_idx` on
  `tenants (domain)` where `domain_verified_at` is set. A database in which two organisations already
  share a verified domain must be cleaned up before it migrates. Support access and retention live in
  the `settings` JSON column (no table change).
- **Simulation clicks are counted by a beacon, not by the page render.** `/t` and `/q` only look the
  token up; the browser sends one click beacon and then shows the fake sign-in, and a submit counts only
  after a recorded click. A browser without JavaScript is not counted and gets a link to the lesson.
  (`portal/src/components/site/teachable.tsx`, test: `tests/simulation-tracking.test.ts`)
- **Base images are pinned by digest** (`node:24-trixie-slim` in the Dockerfile, `postgres:16-alpine` in
  both compose files); Dependabot proposes the digest updates.
- **Scheduled report emails say what the link opens**: the report as CSV or XLSX after sign-in, with
  the print-ready version on the console's Reports page (ten languages).
- **The operator overview's people count leaves out platform operator accounts**, the same count the
  seat export uses.
- **The Azerbaijani quick-start block was removed from `portal/README.md`**; its English equivalents remain.

### Fixed

- **Two lesson completions of one attempt stored two sets of answers**; the attempt is now consumed by
  one conditional statement. (test: `tests/learning-actions.test.ts`)
- **Concurrent attestations and path certificates could duplicate**; attestation, module completion
  and certificate are one transaction backed by unique keys. (test: `tests/learning-actions.test.ts`)
- **Simultaneous threat reports could exceed the daily report bonus**, **a campaign could be both
  cancelled and completed**, and **two people could take the last seat of a live session**; each is
  now a row lock or one conditional update. (tests: `tests/secops-flows.test.ts`,
  `tests/campaign-flows.test.ts`, `tests/engage-sessions.test.ts`)
- **A second Launch click said the campaign was empty**; it now says the campaign was already
  launched. (test: `tests/sms-queue.test.ts`)
- **Internationalised sender domains were refused** in branding settings; they are stored in their
  ASCII (`xn--`) form, and `xn--` email addresses are recognised as indicators in incidents and the
  sandbox. (test: `tests/idn-domains.test.ts`)
- **AI Sel answered from its cache after the lesson text changed**; the cache key includes a hash of
  the lesson. (test: `tests/tutor.test.ts`)
- **A malformed tutor checkpoint passed lesson validation**; checkpoints are schema-checked and need a
  correct option. (test: `tests/content.test.ts`)
- **Saving the Languages tab wrote a "Time zone changed" audit entry** even when the zone was unchanged.
  (test: `tests/time-zone.test.ts`)
- **CSV imports over 1 MB failed with an error page** after the Server Action limit was lowered; files
  over 900 KB are now refused with a message. (test: `tests/people-import.test.ts`)
- **Mail scanners and link prefetches recorded simulation clicks** because opening the page counted;
  known scanner user agents are now refused at the click beacon. (test: `tests/simulation-tracking.test.ts`)

### Security

- **Server Actions accept 1 MB bodies again** (the global 11 MB limit is gone); sandbox files go
  through `POST /api/sandbox/upload` with its own declared-length and streamed 10 MB cap.
  (test: `tests/sandbox-upload.test.ts`)
- **SSO requires a proven domain** at start and callback, and **binds each account to the identity
  provider's subject** at its first SSO sign-in; a different subject for the same address is refused.
  (test: `tests/sso-routes.test.ts`)
- **A TOTP code is accepted only once**; the same or an older time step is refused.
  (test: `tests/auth-security.test.ts`)
- **Cross-organisation existence checks are neutral.** An address or phone number held by another
  organisation answers "cannot be added", and an address on another organisation's proven domain
  answers the same whether or not it exists; domain checks, test emails, people imports and additions
  are rate limited. (tests: `tests/people-import.test.ts`, `tests/settings-rate-limit.test.ts`)
- **The seed refuses to run in production**, needs `ALLOW_SEED=1` for an external database and refuses
  to empty a database that holds organisations other than the demo ones unless `SEED_FORCE=1`.
- **No secret in compose files**: the demo compose file requires its database password, `APP_SECRET`
  and seed password from the environment.
- **Every GitHub Action is pinned to a commit SHA** and checkout no longer keeps credentials.
- **Account-takeover actions ask for the administrator's own password.** Resetting someone's two-step
  verification, creating a password-reset link, changing a role and the operator's administrator link
  require the actor's password again (10 attempts per actor per 15 minutes, every refusal audited as
  `security.step_up_failed` with the target). The affected person gets an in-app notice and an email,
  even when suspended, and when the target is an administrator the other administrators are notified.
  (`portal/src/server/auth/step-up.ts`, `portal/src/server/services/notify.ts`, test: `tests/step-up.test.ts`)
- **Invite links only for accounts that were never activated.** An invite link could be created for an
  active account and used to set its password without any re-authentication; the server now refuses it,
  and an invite token for an active account is treated as expired.
  (tests: `tests/step-up.test.ts`, `tests/auth-security.test.ts`)
- **`APP_SECRET` can be rotated.** Stored secrets carry the id of the key that sealed them; the new
  optional `APP_SECRET_PREVIOUS` keeps the old key readable while `npx tsx scripts/rotate-secret.ts`
  re-encrypts SSO, LDAP, SMTP and webhook secrets and TOTP keys. The new optional
  `APP_DOMAIN_PROOF_SECRET` fixes the key of the domain-proof TXT values (default `APP_SECRET`; set it
  once, before the first rotation). Backup codes issued before a rotation stop working once
  `APP_SECRET_PREVIOUS` is removed. Runbook: `docs/OPERATIONS.md`, "Rotating APP_SECRET".
  (`portal/src/server/crypto.ts`, `portal/src/server/services/secret-rotation.ts`,
  `portal/.env.example`, tests: `tests/crypto.test.ts`, `tests/auth-security.test.ts`)
- **A domain can be verified by one organisation only**; a second organisation gets "domain taken".
  (test: `tests/crypto.test.ts`)
- **AI Sel's cached answers are kept per organisation**, so an answer given in one organisation is never
  served to another. (`portal/src/server/tutor.ts`, test: `tests/tutor-cache.test.ts`)
- **Lesson slugs and keys over 100 characters are refused** before any query, and **the sign-off CSV
  shows IP addresses only to roles with audit access**.
  (tests: `tests/learning-actions.test.ts`, `tests/signoffs-route.test.ts`)

## Phase 0 - CI, tests and ten fixes (merged 2026-11-05, unreleased)

### Added

- Continuous integration (`.github/workflows/ci.yml`): every push and pull request runs ESLint,
  the TypeScript check, the lesson translation check, the Vitest suite and the production build.
- Unit and integration tests for the parts of the portal that had none (see `portal/tests/`).

### Fixed

- **Passwords made from the person's own name or email were accepted.** The password rule passed
  the full email and full name to zxcvbn, which only recognises a personal detail as a whole
  token, so "aysel.mammadova" scored 4 out of 4 for Aysel Mammadova and was accepted. Personal
  details are now split into their words (email local part, domain name, each name) before
  scoring, on the server, in the set-password meter and in the Password Forge lab alike.
  (`portal/src/lib/password-strength.ts`, test: `tests/password-domain.test.ts`)
- **Internationalised domains could not be proven.** Domain proof refused every domain under an
  internationalised top-level domain, such as .рф, .укр, .გე and .السعودية, in the markets the
  product is sold in, whether typed in Unicode or in their ASCII (`xn--`) form. They are now
  accepted and stored in their ASCII form. (`portal/src/server/auth/domain-proof.ts`, test:
  `tests/password-domain.test.ts`)
- **A lesson completion sent twice awarded its XP twice.** `completeLesson` read the lesson's
  progress and then wrote it, so two requests at the same moment (a double submit, a network
  retry) both saw the lesson as new. The first completion is now claimed by one conditional
  statement, so only one request awards the XP. (`portal/src/server/services/progress.ts`, test:
  `tests/learner-progress.test.ts`)
- **An attestation sent twice stored two attestations and issued two certificates.** The module
  is now moved out of "awaiting attestation" by a conditional update, and only the request that
  does so stores the attestation and issues the certificate. The completion and its attestation
  text are written in one transaction, so compliance evidence never shows one without the other.
  (`portal/src/server/services/progress.ts`, test: `tests/learner-progress.test.ts`)
- **The lesson XP split went wrong for Studio and SecOps modules.** The split used the stored
  lesson position as the lesson's index, but those modules number their lessons from 1, so the
  remainder went to the second-to-last lesson, and a gap in the positions lost XP (99 of 100). The
  split now uses the lesson's place among its siblings. (`portal/src/server/services/progress.ts`,
  test: `tests/learner-progress.test.ts`)
- **Pressing Launch twice sent the phishing simulation twice.** `launchCampaign` checked the
  campaign's status and then set it to running, so two requests at the same moment (a double
  click, or the scheduler firing while someone launches by hand) both created recipients and
  queued a second email to every person. Only the request whose conditional update moves the
  campaign out of draft or scheduled now sends it. (`portal/src/server/services/campaigns.ts`,
  test: `tests/campaign-flows.test.ts`)
- **A simulation link opened twice at the same moment recorded two clicks.** Each request opened
  its own "phishing click" risk, sent its own integration event and counted twice against the
  person. The click is now claimed by one conditional update, so it is recorded once
  (`recordClick` in `portal/src/server/services/campaigns.ts`, test: `tests/campaign-flows.test.ts`)
- **A fake sign-in form sent twice at the same moment raised the risk twice.** Each request
  escalated the person's risk and sent its own integration event. The submission is now claimed by
  one conditional update, as the click is, so it is recorded once (`recordSubmit` in
  `portal/src/server/services/campaigns.ts`, test: `tests/campaign-flows.test.ts`)
- **The device limit could leave one session too many.** When a new sign-in pushed a person over
  the organisation's device limit, the oldest sessions were removed, skipping the new one if it
  sorted among them. The new session's last-seen time comes from the database clock and the
  others' from the app server, so with the clocks out of step the new one could be "oldest" and
  nothing was removed. The new session is now left out before the oldest of the others are signed
  out. (`portal/src/server/auth/session.ts`, test: `tests/sessions-viewer.test.ts`)
- **The Modules report could show a completion above 100 %.** "Completion %" divided everyone who
  completed a module by the number of people it is assigned to, so a module assigned to two
  people and also taken by others on their own showed 150 %. It is now the share of the assigned
  people who completed it; "Completed" still counts everyone. (`portal/src/server/reports/build.ts`,
  test: `tests/reports-build.test.ts`)
