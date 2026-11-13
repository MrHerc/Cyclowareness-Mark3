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
  retention in months (0 to 120, 0 keeps everything and is the default; audit retention is 0 or at
  least 12 months). The daily clean-up deletes that
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
  `docs/build/OPEN-QUESTIONS.en.md`. The whitepaper was updated after step-up, key rotation and
  retention settings were merged and describes them as the code does.
- **Cross-organisation test suite.** `portal/scripts/inventory-surface.ts` lists every exported server
  action and API route method with its guard (`portal/tests/fixtures/surface.json`), and
  `tests/cross-tenant.test.ts` calls each one with another organisation's ids and with a lower role and
  checks that the other organisation's rows stay unchanged; an entry point without a row fails the suite.
- **Read-only reporting API.** Settings → Integrations → API tokens mints bearer tokens holding
  `reports.read` or `people.read`, shown once and stored as SHA-256, at most 20 per organisation. A token
  acts as its creator limited to its own permissions, opens only the report downloads and the people
  export, never a write route, and is refused without the `integrations` plan feature (it can still be
  revoked). Each token has its own rate limit; a creator's tokens share one quota apart from the console.
  `docs/API.md` section 11. Whether a token should act as its creator is still an owner decision
  (OPEN-QUESTIONS 60). (`portal/src/server/auth/api.ts`, `portal/src/server/auth/viewer.ts`, test:
  `tests/api-tokens.test.ts`)
- **Inbound report address.** Settings → Integrations creates a per-organisation secret (shown once,
  stored as SHA-256) for `POST /api/inbound/{slug}`: a forwarded suspicious mail from an active employee
  becomes an email threat report, and every other sender gets the same empty 202. 120 messages a minute,
  the body read is capped at 1 MB, and only `APP_URL` tracking links count (Safe Links wrappers decoded
  once). `docs/API.md` section 10. The mail provider per customer and forged From addresses are owner
  items (OPEN-QUESTIONS 61). (`portal/src/app/api/inbound/[tenant]/route.ts`, test: `tests/secops-flows.test.ts`)
- **Studio: edit after save, AI translation on publish, swipe and hotspot exercises.** One scene builder
  serves save and edit; only a lesson it rebuilds exactly can be edited, and an edit that changes no text
  keeps the translations. Publishing translates each lesson into the organisation's missing languages
  (parity-checked, 200 calls per organisation per day, no per-language human review); a language that was
  not translated shows the source text and the author is told. Sending customer lessons to the AI
  provider for translation is an owner decision (OPEN-QUESTIONS 62).
  (`portal/src/lib/content/studio.ts`, test: `tests/secops-flows.test.ts`)
- **Market packs for German, French and Arabic.** `portal/scripts/apply-market.ts` applies
  `content/market/<lang>.json` (Germany, France and Saudi Arabia; tr, ro, ka, uk and ru are skeletons) to
  the committed de, fr and ar lesson files: local people, places, currency (amounts keep their value),
  phones, IBANs, authorities, fictional brand analogues and addresses mapped from the English cast,
  deterministic per lesson and idempotent. The lesson checker fails a market language that keeps an
  Azerbaijani-world token. The packs were reviewed by AI only; native reviewers, the target countries and
  the analogue names and domains are owner items (OPEN-QUESTIONS 66, 67).
  (`portal/src/lib/content/market.ts`, test: `tests/market.test.ts`)
- **Teachable-moment loop.** Within the hour after a simulation click, the person gets a hidden 90-second
  micro-lesson built from the template's own texts (no AI, due in 7 days; completing it closes the click's
  risk), then one harder e-mail or SMS re-simulation to that person only: 14 days after the lesson (21
  after the assignment if it is not done), at 10:00 local time, at most one per person per 7 days. A
  refused re-simulation launch cancels the campaign and closes the loop without a result; each click and
  due loop is isolated, so one failure does not stop the others; the monthly refresher never picks a
  micro-lesson. On by default (Settings → Learning, every plan), with a home card; the loops are in
  "Download my data". The delays and the plan placement are owner items (OPEN-QUESTIONS 68).
  (`portal/src/server/services/teachable.ts`, tests: `tests/teachable-loop.test.ts`, `tests/jobs-ops.test.ts`)
- **A mini-lab for every module.** `content/library/labs/<module>.en.json` (`formatVersion` 1, 3 to 5
  decisions from the module's own lesson artifacts) runs at `/lab/mini/<slug>` in the VM lab engine. The
  chosen options are replayed on the server against the English file (10 to 15 XP); a mini-lab is optional
  and never counts toward completion or certificates. Only shipped scenario files are read, so slugs from
  requests never reach the cache. English only so far (0 of 477 translations), and 52 of the 53 scenarios
  were drafted by a script and spot-reviewed. (`portal/src/lib/content/lab-scenario.ts`, test:
  `tests/mini-labs.test.ts`)
- **Narration clips with any provider.** `npm run narration -- --lang <lang> --provider
  piper|azure|elevenlabs` makes clips and word timings with the build machine's ffmpeg. The 106 English
  manifests (3,778 clips, made with Piper) are committed; the clips are git-ignored and made on the build
  machine before `docker build` (`docs/OPERATIONS.md`). The player plays a clip first, reads a line whose
  clip fails with the browser voice and notes the synthetic voice. Azerbaijani and Russian clips are not
  made: they need the owner's Azure Speech key (`AZURE_SPEECH_KEY`, OPEN-QUESTIONS 2); the other seven
  languages keep the browser voice. (`portal/scripts/generate-narration.ts`,
  `portal/src/components/player/narrator.ts`, tests: `tests/narration-providers.test.ts`,
  `tests/narration-manifests.test.ts`, `tests/narrator-audio.test.ts`)

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
- **Database migration `portal/drizzle/0005_wave_c.sql` (additive).** Tables `api_tokens` (reporting-API
  tokens) and `job_runs` (when each hourly job last ran per organisation).
- **Database migration `portal/drizzle/0006_wave_d.sql` (additive).** Table `teachable_loops` (one row per
  clicked recipient) and the nullable `campaigns.user_id` of one-person re-simulations (set to null when
  the person is deleted).
- **Database migration `portal/drizzle/0007_phase5.sql`.** `api_tokens.expires_at` is added nullable,
  filled with `created_at` + 365 days and then set NOT NULL, so existing tokens expire a year after their
  creation; five indexes for clicked recipients, one-person campaigns, drill runs by campaign and the
  teachable loops' campaigns. No migration renames re-simulations made before this release: no deployed
  database holds them.
- **Lesson format version 1 and strict scene schemas.** Every lesson file starts with `formatVersion: 1`,
  which the schema requires and every writer stamps, Studio included; scene schemas list every key and
  drop unknown ones. The library import writes only changed rows. (`portal/src/lib/content/validate.ts`,
  `portal/scripts/add-format-version.ts`, tests: `tests/studio-lesson-format.test.ts`,
  `tests/library-sync.test.ts`)
- **Background jobs at scale.** Risk scores are written in one row-locked statement per 500 people;
  reminders, manager alerts and refreshers run at most once an hour per organisation, so they can go out
  up to 59 minutes later; launches insert recipients in chunks of 500; an assignment change rescores only
  the people it affects (over 2,000 on the next tick). The k6 load test has not been run (OPEN-QUESTIONS
  58). (`portal/src/server/jobs.ts`, `portal/src/server/services/risk.ts`, test: `tests/jobs-scale.test.ts`)
- **Smaller pages.** Each route group ships only the message namespaces its client code reads, and the
  mascot engine loads after mount: the first load of `/sign-in` is 42 KB and of `/app` 40 KB smaller
  (gzip), while `/admin` carries about 2 % more message JSON. Profile photos reach the browser only through
  `GET /api/avatar/{userId}` within the viewer's organisation, no longer as data URLs (they are still stored
  as data URLs, OPEN-QUESTIONS 59). (`portal/src/i18n/messages.ts`, `portal/src/components/intl-scope.tsx`,
  tests: `tests/client-messages.test.ts`, `tests/avatar-route.test.ts`)
- **One result shape for server actions.** Forms report refusals through `useAction`, with a toast and a
  Retry that repeats the exact call; a toast with an action stays until dismissed; the learner, admin and
  operator segments have error boundaries that retry with a refetch. (`portal/src/components/ui/use-action.ts`,
  `portal/src/lib/action-result.ts`, tests: `tests/use-action.test.ts`, `tests/toast.test.ts`)
- **Lesson player and campaign wizard.** Scene callbacks keep one identity and no `exhaustive-deps`
  suppression is left; campaign templates are resolved and previewed on the server; the refresher and
  blocked-campaign texts moved out of code into `admin.json`. (`portal/src/components/player/player.tsx`,
  tests: `tests/scenes-render.test.ts`, `tests/campaign-wizard.test.ts`)
- **Legal texts name only the sign-in and integrations that exist.** LDAP, Active Directory, SAML and the
  directory-report retention row are gone in ten languages; section 9 describes the per-organisation
  checks instead of row-level security; AI Sel questions and answers are kept up to 12 months; Terms 4.2
  states the 10-character password minimum. The editions stay Privacy v3 and Terms v2, still subject to the
  lawyer's review (OPEN-QUESTIONS 63). (test: `tests/legal-content.test.ts`)
- **The leadership risk trend compares one population.** Both ends average today's people in scope, today's
  chart point reads the live scores, and only published modules are recommended.
  (`portal/src/server/queries/risk-story.ts`, test: `tests/risk-story.test.ts`)
- **Key ring follow-ups.** The key id is labelled (first 8 hex of `sha256("kid:" + secret)`);
  `APP_SECRET_PREVIOUS` equal to `APP_SECRET` is refused by the app and by the rotation script, which also
  runs as `npm run secret:rotate` and skips an organisation deleted mid-run; month cut-offs clamp to the
  month's end. (`portal/src/server/crypto.ts`, `portal/src/server/env.ts`, tests: `tests/crypto.test.ts`,
  `tests/env.test.ts`)
- **Copy and accessibility.** Change-password refusals appear on their own field; the Support access text
  says "password reset link" in ten languages; the simulation landing page announces its loading state to
  screen readers; saving an unproven simulation sender names the sender field.
  (tests: `tests/change-password-errors.test.ts`, `tests/teachable-beacon.test.ts`, `tests/simulation-sender.test.ts`)
- **Learning-data retention covers simulation results.** When learning retention is set, the daily
  clean-up also deletes closed teachable loops, the recipient rows of finished or cancelled campaigns,
  daily risk snapshots and sandbox analyses (not an unresolved incident's evidence or the latest
  analysis), and clears the forwarded text of handled threat reports (the report and its number stay). Progress, XP, attestations, certificates, lab
  attempts and earned badges are never deleted. The setting's label says so in ten languages and
  `docs/OPERATIONS.md` follows; the matching Privacy §8 sentence waits for the lawyer (OPEN-QUESTIONS 72).
  (`portal/src/server/jobs.ts`, test: `tests/jobs-ops.test.ts`)

### Fixed

- **The offline page said "You're offline" when only the server was down.** The service worker's
  cached page now tells no network from a server that does not answer, reloads itself as soon as
  `/api/health` answers, and its retry button works without hydration; worker version `cy-v4`. In
  development a worker left by a production build is removed. (`src/app/offline/script.ts`, test:
  `tests/offline-page.test.ts`)
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
- **Large organisations could pass PostgreSQL's limit of 65,535 parameters per statement.** The daily risk
  snapshot bound four values per person, and risk scoring, KPIs, the department league, the reports, the
  compliance pack, the monthly refresher and targeted training bound one id per person. They now use
  subqueries or one `INSERT … SELECT`; `notifyUsers`, `recomputeRisk` and `targetTraining` work in slices
  of 1,000; campaign funnels are summed in SQL. An empty report scope now resolves nobody. Tests count the
  bound parameters (1,200 people) and run the code at scale (8,200 to 70,000 rows).
  (`portal/src/server/services/risk.ts`, `portal/src/server/reports/build.ts`, tests: `tests/jobs-scale.test.ts`, `tests/risk-story.test.ts`,
  `tests/secops-flows.test.ts`, `tests/platform-metrics.test.ts`)
- **A campaign launch that failed part-way left recipients behind**, and one failing campaign kept
  `campaignTick` from launching the others; `launchCampaign` is one transaction and each campaign is
  isolated with `logFailure`. (`portal/src/server/services/campaigns.ts`, test: `tests/campaign-flows.test.ts`)
- **A drill could leave a campaign without its run**; `startDrill` creates the campaign, recipients and run
  in one transaction, and two lease holders applying the same step file one report.
  (`portal/src/server/services/drill.ts`, test: `tests/drill-service.test.ts`)
- **A lesson completion or a Studio save that failed part-way left partial rows**; each is one transaction,
  so nothing is stored and the same attempt can finish. (tests: `tests/learning-actions.test.ts`,
  `tests/secops-flows.test.ts`)
- **A branding colour change and a logo upload at the same moment lost one of them**; branding saves under a
  row lock. (test: `tests/branding-settings.test.ts`)
- **The simulation-sender domain check could fail a correct setup after a key change**; it checks the same
  record the screen shows. (`portal/src/server/auth/domain-proof.ts`, test: `tests/simulation-sender.test.ts`)
- **The person dialog's password field took the focus from the phone input**, and a refused invite or reset
  link that was not about the password did nothing; it is now reported. (test: `tests/person-dialogs.test.ts`)
- **A created invite or reset link was lost when the clipboard refused it**; a dialog shows it in a
  read-only field with a copy button. (test: `tests/created-link.test.ts`)
- **A lost lesson-attempt start was not sent again**; the player sends it with the next scene report.
  (test: `tests/player-attempt.test.ts`)
- **Drill pages**: the drill history chevron was mirrored twice on right-to-left pages, and the live drill's
  reconnecting notice was not announced. (tests: `tests/rtl-logical.test.ts`, `tests/live-drill.test.ts`)
- **The Georgian admin overview was 7 px wider than a 375 px screen**; the quick-action labels break long
  words.
- **The platform operator's CSV import silently demoted administrator rows**; it keeps their role, as the
  add dialog does. (test: `tests/people-import.test.ts`)
- **The English whaling-board lesson's legitimate sender wrote from another person's mailbox**, a false cue;
  fixed in English and the six translations that copied it (az, ru, tr, ro, ka, uk).

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
- **Security audit of 2026-11-10.** Seven areas were audited and every finding was challenged by two
  verifiers: the 16 confirmed findings were closed with tests, 5 were kept as intended and 229 controls
  were verified present, complete and tested. Report: `docs/SECURITY-AUDIT-2026-11.md`; the entries below
  list the changes. Plain-HTTP production, an idle timeout for administrators and the other kept items are
  owner decisions (OPEN-QUESTIONS 53 to 57).
- **More actions ask for the actor's own password.** Giving a person a new phone number (they get an in-app
  notice), unlinking their single sign-on and re-pointing the organisation's sign-in (issuer, client id,
  email claim, auto-create, the SSO switch, dropping the administrators' two-step rule). Console
  permissions used inside self-service actions follow the administrators' two-step rule, and the SSO
  settings test needs a session past two-step verification. (`portal/src/server/actions/people.ts`,
  `portal/src/server/actions/settings.ts`, tests: `tests/step-up.test.ts`, `tests/viewer-gates.test.ts`,
  `tests/sso-routes.test.ts`)
- **Per-organisation ceilings.** Sign-in codes by SMS are capped at 500 per organisation and hour, without
  telling the requester; AI Sel (2,000 calls), AI trainings (50) and AI lesson drafts (100) have daily
  budgets per organisation, and cached answers stay free; an anonymous SSO start opens a rate-limit bucket
  only for an organisation that exists. (tests: `tests/auth-security.test.ts`,
  `tests/ai-tenant-budget.test.ts`, `tests/sso-routes.test.ts`)
- **Audit trail.** Audit retention is 0 or at least 12 months, in the settings and in the clean-up job; the
  entries that record a retention change or a purge are never purged; downloading the USB drop kit and
  viewing a certificate while signed in are audited (`campaign.usb_kit_downloaded`,
  `certificate.downloaded`), anonymous verifications are not. (tests: `tests/retention-settings.test.ts`,
  `tests/jobs-ops.test.ts`, `tests/export-audit.test.ts`)
- **SVG logos are read three ways.** The check compares the raw text, the XML parser's reading and the CSS
  reading of that, and refuses whatever makes them differ: SMIL animation, refused names under any prefix,
  a DOCTYPE beyond the plain form, unknown entity references, `xml:base`, the XHTML and MathML namespaces,
  CSS `image-set(`, `image(` and `src(`. It runs in linear time. Some legitimate files are refused on
  purpose (embedded raster images, old Illustrator exports, logos inside a link, embedded fonts;
  OPEN-QUESTIONS 55). (`portal/src/server/svg-safety.ts`, tests: `tests/svg-sanitize.test.ts`,
  `tests/regex-dos.test.ts`)
- **Sandbox e-mail indicators are capped at 254 characters**, and **Markdown renders a protocol-relative
  link disguised as a path as text**. (`portal/src/server/sandbox/analyze.ts`, `portal/src/lib/markdown.tsx`,
  tests: `tests/sandbox.test.ts`, `tests/rendering.test.ts`)
- **Security regression tests prove the guard they name.** Cross-organisation rows pass the earlier gates,
  so a refusal can only come from the organisation check; the department-head scope, the production CSP,
  the client-header override and the build-time headers are pinned. (tests: `tests/cross-tenant.test.ts`,
  `tests/proxy-hsts.test.ts`)
- **Phase 5 follow-up review of 2026-11-11.** Seven reviewers looked at the branch after wave D, and
  verifiers who tried to refute each finding checked it: 44 findings were confirmed and closed with tests,
  and 6 were refuted. Report: `docs/SECURITY-AUDIT-2026-11.md`, section "Phase 5 follow-up review
  (2026-11-11)"; the entries below list the changes. The owner decisions are OPEN-QUESTIONS 70 to 74.
- **Reporting-API tokens expire and end with their creator's sessions.** A lifetime of 30, 90, 180 or 365
  days is chosen in the settings (any whole number up to 365 through the action; 90 by default); an
  expired token gets 401 `expired`, is audited and frees its slot. Minting asks for the actor's password, so an administrator who signs in only by SSO cannot mint,
  and notifies the other active administrators. A password change or reset, a two-step reset, signing out
  other devices, a suspension or a role change revokes the creator's live tokens, each with an
  `api_token.revoked` entry and its reason; turning on two-step verification keeps them, and restoring the
  role or reactivating the account does not revive them. The revocation scope and the default lifetime are
  owner decisions (OPEN-QUESTIONS 70). (`portal/src/lib/api-tokens.ts`, `portal/src/server/auth/session.ts`,
  tests: `tests/api-tokens.test.ts`, `tests/step-up.test.ts`)
- **One-person re-simulations carry no name.** A re-simulation is named "{template}: re-simulation" in the
  organisation's language and linked to the person only through `campaigns.user_id`, so its name, audit
  entry, click risk and webhook payload name no one. The leadership risk story and the campaigns list leave
  re-simulations out, while the page's totals still count them. Payloads already delivered cannot be
  recalled. The campaigns-page totals and the cancelled page's missing reason are owner items
  (OPEN-QUESTIONS 74). (`portal/src/server/services/teachable.ts`, tests: `tests/teachable-loop.test.ts`,
  `tests/campaigns-index.test.ts`, `tests/risk-story.test.ts`)
- **Account deletion removes more.** `anonymise()` also renames the person's one-person campaigns to "—",
  scrubs that name from click-risk titles and their audit entries, deletes the manager and deletion notices
  and the queued manager-alert e-mails that link to the person (mail already sent stays until the 90-day
  outbox retention) and nulls the IP of the audit entries the person made. Takeover security notices stay
  as a trace. Manager alerts lock the person's row `FOR SHARE`, so a deletion commits first or removes the
  notice afterwards; PGlite cannot test this against a real concurrent deletion. An administrator cannot
  decide their own deletion request. The takeover notices and the IP nulling are owner decisions
  (OPEN-QUESTIONS 71). (`portal/src/server/actions/people.ts`, tests: `tests/people-operator.test.ts`,
  `tests/manager-alerts.test.ts`)
- **Backups are for the owner only and can be encrypted.** `backup.sh` sets `umask 077` and `chmod 700`;
  with `BACKUP_AGE_RECIPIENT` set, each dump is encrypted with age on its way to disk. `restore.sh` needs
  `BACKUP_AGE_IDENTITY` for such a dump and stops before emptying the database if decryption fails. Keep
  `APP_SECRET` and the age identity apart from the dumps. Encryption at rest is a hosting decision
  (OPEN-QUESTIONS 73). (`portal/scripts/backup.sh`, `portal/scripts/restore.sh`, test:
  `tests/backup-script.test.ts`, whose shell tests skip on Windows without `sh`)
- **SMTP failure logs carry no address**, only `<address>` and the nodemailer error codes (`code`,
  `responseCode`). (`portal/src/server/mail.ts`, test: `tests/outbox-redact.test.ts`)
- **A CSV import commit that reports problems is rate-limited too** (a clean commit stays free) and no
  longer reveals which addresses exist, **webhook and syslog destination changes are audited** (a webhook
  by its origin only), and **a draft module's mini-lab counts only for an author who meets the
  administrators' two-step rule**.
  (tests: `tests/people-import.test.ts`, `tests/secops-flows.test.ts`, `tests/mini-labs.test.ts`)

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
