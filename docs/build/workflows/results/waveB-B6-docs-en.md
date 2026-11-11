# B6-docs-en

branch: worktree-wf_42496c94-3d0-6
worktree: <repo>\.claude\worktrees\wf_42496c94-3d0-6
commits: 324b8aa English engineering index, customer guides and whitepaper, report-mail copy
fix commits: 2d1c463 Whitepaper and quickstart: narrow the GET claim, state who must use 2FA
reviews: 2 (approve, approve)

## summary
The worktree started on 683f272, so it was reset hard to 1a45970 before any work began. Closes O-02, O-05 and M-11 (1). No code or schema changes.

O-02:
- docs/build/DECISIONS.md: added an "## English index" table at the top covering every ADR in the file, ADR-001 to ADR-043 including wave A's 035-043. Each row has the number, an English title and a one-line decision, and amended or superseded ADRs are flagged. A short note says the Azerbaijani text is the source. The Azerbaijani intro line now sits under a new "## Qərarlar" heading. The ADR bodies are untouched.
- New docs/build/OPEN-QUESTIONS.en.md: a full English rendering of OPEN-QUESTIONS.md with the same sections and numbering, items 1-41, including the 2026-11-05 wave A section. Its header says the Azerbaijani file wins when the two differ.
- portal/README.md: removed the Azerbaijani "Tez başlanğıc" block (the old lines 5-15). Its English equivalents already exist: Quick start, Demo accounts, and the PGlite single-process note in Operations notes. Added the three new docs to the Documentation list, plus a line that DECISIONS.md has an English index and OPEN-QUESTIONS.en.md exists. docs/README.md does not exist, so nothing was linked there.

O-05:
- docs/ADMIN-GUIDE.md: every page in the console, in nav order, plus the platform operator console and a "not yet" list. It covers roles, plan gates, the 2FA gate, the overview checklist, people (CSV import limits, the neutral cross-tenant answer), departments, assignments, paths with labs, Studio (AI trainer and offline fallback), the two-person approval gate, policies, sessions, problems, campaigns (wizard, channels, launch blocks, statuses), the Live drill (synthetic and seed-only), the SecOps pages, reports (8 kinds, CSV/XLSX, print-to-PDF, compliance pack, schedules), league, leadership, audit, support, feedback and all 10 settings tabs. SAML, LDAP and Android are left out because ADR-040 hides them in the UI.
  - Checked against: src/app/(admin)/admin/layout.tsx (GROUPS, permission and feature gates), src/server/auth/permissions.ts, src/server/auth/viewer.ts (requirePermission returns notFound), admin/settings/page.tsx (TABS), admin/reports/page.tsx, src/app/(print)/print/compliance/page.tsx, src/server/actions/secops.ts (decideMaterialAction, sameApprover), src/server/db/schema.ts (ROLES, CAMPAIGN_STATUS, REPORT_KINDS, the report_schedules format enum), src/lib/campaigns/templates.ts, campaigns/new/wizard.tsx, and the en messages in admin, secops and settings.
- docs/LEARNER-QUICKSTART.md: one page covering sign-in (email first, password, SSO or phone), the menu, the player and its shortcuts, the question timer, module confirmation and certificates, the Report button and the sandbox, XP, streaks, freezes and risk, policies, and the account options (2FA, password change, sign out other devices, data download, deletion request, motion, sound).
  - Checked against: the learner, player, security, common and auth messages; src/app/(learner)/layout.tsx (ReportButton is in the header); profile-client.tsx (TIMER_KEYS).
- docs/SECURITY-WHITEPAPER.md: a customer-facing extract that names only controls present in this tree. It ends with a "does not provide yet" list.
  - Checked against: src/proxy.ts (CSP nonce, strict-dynamic, frame-ancestors, HSTS max-age 63072000); next.config.ts (headers, a single action body limit and proxyClientMaxBodySize 11mb for the proxy only); src/server/auth/password.ts (Argon2 19456/2/1, minimum length 10, score 3); src/server/auth/session.ts (__Host- cookie, 30/90 days); src/server/actions/auth.ts (15-minute lock window); src/server/auth/totp.ts and schema totp_last_step (replay protection); src/app/api/sso/callback (domain_unproven, subject_changed); src/server/crypto.ts (aes-256-gcm); src/server/mail.ts (link redaction); src/server/services/campaigns.ts recordSubmit (only the fact is stored); src/server/sandbox/analyze.ts (MAX_FILE_BYTES 10 MB) and api/sandbox/upload (sameOrigin); src/lib/csv.ts (formula neutralising); src/server/jobs.ts (365/730-day clean-up); schema EVIDENCE (server_verified, self_reported) and src/lib/content/scoring.ts (minDwellMs); src/server/env.ts (APP_URL https rule); docker-compose.yml (cap_drop, no-new-privileges, 127.0.0.1 port); Dockerfile (USER node); scripts/backup.sh and restore.sh; .github/workflows (ci.yml, security.yml); and the closed items of SECURITY_REVIEW.md and ADR-033/035/038/041.
  - Step-up re-authentication (S-06) and key rotation (S-07) do not exist in this tree: grep found no step-up code, and the only "rotate" hits are the webhook secret and a comment. Both are listed as not provided. createLinkAction and the 2FA reset send no email to the person, which is also stated.
  - Also listed as not provided: database RLS (S-03), SAML and LDAP, configurable retention and residency (L-03), any independent pentest or certification, error tracking, live-integration tests, and the service terms.

M-11 (1):
- admin.reports.mail.body in all ten locales: the middle paragraph now says the file is not attached; after sign-in, the link opens the report as a CSV or XLSX file; and a print-ready version you can save as PDF is on the console's Reports page. This matches jobs.ts, where the link is /api/admin/reports/{kind}?format=csv|xlsx, and /print/report/[kind] reached from the Reports page.
- The placeholders ({report}, {link}) and the first and last paragraphs are unchanged. Each locale reuses its existing terms: console, its nav label for Reports, and its own word for link. French keeps the U+202F narrow spaces inside the guillemets. Sandbox was not renamed.

Progress line for PROGRESS.md: "B6-docs-en: English ADR index (001-043) in DECISIONS.md, OPEN-QUESTIONS.en.md (1-41), ADMIN-GUIDE, LEARNER-QUICKSTART and SECURITY-WHITEPAPER written against the code and linked from portal/README; scheduled report mail copy in ten locales says the link opens CSV/XLSX and the print-ready page is on Reports (O-02, O-05, M-11 part 1)." No ADR is needed.

## left_open
Not done, and why:
- No new test: this package changes only copy and docs, so there is no new logic branch to test. The existing tests/i18n.test.ts and tests/landing.test.ts pass, 220 tests in all.
- The root README.md Documentation table was not changed. It was not in the brief's file list, and other packages may edit it. The three new docs should probably be added there at merge time.
- docs/ARCHITECTURE.md was not edited, but parts are stale after wave A. Section 14 says every organisation runs on Baku time; section 5 says SSO accounts are matched by email only; section 17 still lists the 11 MB action limit, SSO domain proof, email-only matching and the Baku time zone as open. The whitepaper follows the code instead. A follow-up should update ARCHITECTURE.md.
- The Azerbaijani, Russian and other non-English mail copy was written by an AI agent, not a native editor.
- The English renderings drift whenever OPEN-QUESTIONS.md or DECISIONS.md change. Whoever adds a question or an ADR must also update OPEN-QUESTIONS.en.md and the index row.

Questions for the owner:
1. Keep the engineering docs bilingual, with the Azerbaijani file as the source and the English file as a mirror, or switch to English only? (Register O-02.)
2. The whitepaper and admin guide need legal and owner review before going to customers. The whitepaper deliberately names no SLA, support hours, status page, hosting region or vulnerability-reporting address; these are owner-provided texts (register O-05). Is the "does not provide yet" list acceptable to publish as written?

No new dependencies.

## migrations


## tests_added


## reviews
approve
I recommend approving this package: no blockers or major problems remain, and every acceptance item holds.

**What I checked**
- **Starting commit.** The worktree's HEAD 6fc2e5b contains 1a45970, and the diff against 1a45970 holds both package commits, 324b8aa and 6fc2e5b. The 6fc2e5b follow-up tightens the 2FA wording to match twoFactorRequired and narrows the log claim to logFailure.
- **O-02, ADR index.** DECISIONS.md has 43 ADR headings, 001 to 043, and the English index has a row for each. The amended and superseded flags match the bodies (036 replaces items 6-7 of 034; 039 supersedes 021; 035 amends 030; 043 amends item 4 of 032). Outside the index and the new "## Qərarlar" heading, the ADR bodies are unchanged.
- **O-02, open questions.** OPEN-QUESTIONS.en.md has the same sections and items 1-41 as the Azerbaijani file. I compared items 22-27 in full, including every sub-bullet of item 26; they are faithful renderings.
- **O-02, portal README.** The Azerbaijani "Tez başlanğıc" block is removed. Its English equivalents remain (Quick start, Demo accounts, and the PGlite single-process note), and nothing pointed at the removed block.
- **O-05, admin guide.** I checked the guide against the code:
  - layout.tsx GROUPS: order, permissions and feature gates
  - settings TABS: 10 tabs
  - PLAN_FEATURES for the three plans
  - the CSV import limits: 5,000 rows (from the tooMany message) and 900 KB (IMPORT_MAX_BYTES)
  - the logo limit (512 KB)
  - drill speeds (90 s and 180 s)
  - the 20-row outbox list
  - twoFactorRequired, which covers every console role
- **O-05, whitepaper.** I checked these claims against the code:
  - the 8 roles and 27 permissions
  - Argon2 at 19456/2/1 and the password rules (length 10, score 3)
  - sessions of 30 and 90 days
  - invitations at 14 days and reset links at 1 hour
  - the DESTINATION_PORTS list
  - the security headers in next.config.ts and HSTS 63072000 in proxy.ts
  - the Dockerfile base image node:24-trixie-slim with USER node
  - backup.sh keeping 14 days
  - redactAccountLinks
  - evidence labels on the /c/[token] page, in reports/build.ts and in the data export
  - PRIVILEGED_ROLES

  The "not provided yet" list correctly includes RLS (S-03), step-up (S-06), key rotation (S-07), SAML and LDAP, residency, pentest and certification, and error tracking. Self-service password change and the cross-tenant enumeration risk named in O-05 are handled the way ADR-041 records.
- **O-05, links.** The three docs are linked from portal/README.md. docs/README.md does not exist. Every relative link in the new docs resolves: API.md, OPERATIONS.md, ARCHITECTURE.md and legal/SUBPROCESSORS.md.
- **M-11 (1), mail copy.** admin.reports.mail.body changed in all ten locales. The {report} and {link} placeholders are intact, and the ar text keeps its isolates. The text matches jobs.ts, which sends a link to /api/admin/reports/{kind}?format=csv|xlsx. It also matches the Reports page, which links to /print/report/{kind}. Each locale uses its own nav label for Reports, and Sandbox was not renamed.

**Tests**
- tests/i18n.test.ts and tests/landing.test.ts pass: 2 files, 220 tests.
- I did not run lint or typecheck. The package changes only .md and .json message values, and neither is in the lint or typecheck scope beyond the JSON parity the tests already cover.

**Not checked:** I did not read every row of the ADR index against its Azerbaijani body; I spot-checked the amended and superseded rows. I did not compare items 1-21 and 28-41 of OPEN-QUESTIONS.en.md beyond their titles. The non-English mail copy was not reviewed by a native editor, as the implementer noted.
- [minor] docs/SECURITY-WHITEPAPER.md:60 The customer-facing CSRF row says "no GET request changes state". That is not true in this tree. GET /api/t/[token]/open (portal/src/app/api/t/[token]/open/route.ts) calls recordOpen and writes the simulation open event, and GET /api/sso/callback/[tenant] signs people in and can create an account on first sign-in. The paper also says every statement was checked against the source, so a procurement reviewer could fault this line. -> Narrow the clause. For example: "no GET request changes account or organisation data, apart from the simulation open-tracking pixel and the single sign-on callback, which is protected by state, nonce and PKCE". Or drop the clause.
- [nit] docs/LEARNER-QUICKSTART.md:57 "Some organisations require it" suggests a learner can be forced to use two-step verification. twoFactorRequired (portal/src/server/auth/permissions.ts:84) applies only to super_admin and to console roles, so a learner is never required to use it. -> Say that organisations may require it for console (administrator) roles, or drop the sentence.
- [nit] README.md:323 The Documentation table in the root README does not link ADMIN-GUIDE, LEARNER-QUICKSTART or SECURITY-WHITEPAPER. It still describes docs/build as only "in Azerbaijani", without the new English index or OPEN-QUESTIONS.en.md. The brief did not require this change, and the implementer flagged it. -> At merge time, add the three docs and the English mirrors to the root README Documentation table.
- [nit] portal/messages/en/admin.json:696 The mail body says the link opens the report "as a CSV or XLSX file". Each schedule has one fixed format (report_schedules.format), which jobs.ts puts into the link, so a given email only ever opens one of the two. This is accurate as general copy and matches the register's suggested wording. -> Optional: pass {format} into mail.body in jobs.ts and name the actual format. That is a code change outside this copy-only package, so leave it as is unless the owner asks.

approve
I recommend approving: there are no blockers or majors, only one minor and two nits, all in the docs.

**Base and scope**
- Commit 1a45970 is an ancestor of HEAD.
- The branch has two commits: 324b8aa and a follow-up, 6fc2e5b, which tightens the whitepaper and admin guide.
- No code or schema changes.

**O-02**
- DECISIONS.md: only 52 lines were added and none removed, so the ADR bodies are untouched.
- The index has 43 rows, matching the 43 ADR headings (ADR-001 to ADR-043, with 035-043 from wave A).
- OPEN-QUESTIONS.en.md has the same 7 headings and the same 41 numbered items in order. I spot-checked items 23, 25, 38 and 41 against the Azerbaijani source, and they are faithful.
- portal/README.md: the Azerbaijani quick-start block is gone. The English Quick start, Demo accounts and the PGlite note remain. The three new docs are linked. docs/README.md does not exist.

**O-05: whitepaper claims checked against the code; all match**
- 27 permissions and 8 roles (permissions.ts, schema ROLES).
- Argon2 settings 19456/2/1 (password.ts).
- 1 MB Server Action limit; proxyClientMaxBodySize 11mb applies to the proxy only (next.config.ts).
- Invitations expire after 14 days (auth/links.ts).
- Daily domain re-check (jobs.ts recheckDomains).
- email_verified is checked (sso callback route).
- The sandboxing CSP on assets (api/assets/[id]).
- Server-verified evidence:
  - minDwellMs and the learning.completion_refused audit entry (learning.ts).
  - The evidence label appears on the public certificate, in exports, in the confirmations report and in the compliance pack.
- Two-step verification for console roles, on by default (twoFactorRequired, tenant-defaults).
- Step-up re-authentication (S-06), key rotation (S-07), RLS (S-03) and SAML are correctly listed as not provided.
- The register shows S-01, S-02, S-05 and S-09 as open, but the 2026-11-05 snapshot predates wave A, and the code in this tree implements all four. Mentioning them is correct.

**O-05: admin guide checked against the code; all match**
- Nav groups, order and feature gates (admin/layout.tsx).
- Plan feature lists (PLAN_FEATURES).
- live_drill as a seed-only feature.

**M-11 (1)**
- The mail body changed in all ten locales; the placeholders are unchanged.
- The Reports label quoted in each locale matches nav.reports.
- The link and format match jobs.ts.
- In the HTML mail, the {link} line renders as a button below the text, so "the link below" reads correctly.
- Sandbox was not renamed.

**Tests:** I re-ran tests/i18n.test.ts and tests/landing.test.ts: 220 passed. Lint and typecheck do not apply; only Markdown and JSON changed.

**Merge-time items (not defects):**
- The root README.md Documentation table could also link the three new docs.
- docs/ARCHITECTURE.md is stale after wave A, as the implementer noted.

I did not check every item of OPEN-QUESTIONS.en.md line by line, nor every row of the ADR index against its body (only the first rows and the last two). I did not review the non-English mail translations with native speakers.
- [minor] docs/LEARNER-QUICKSTART.md:58 The quickstart says of two-step verification that "Some organisations require it". In the code, twoFactorRequired (portal/src/server/auth/permissions.ts:84-86) is only ever true for super_admin, or for console roles while requireAdmin2fa is on. The learner role, which this page is written for, is never required to set it up, so a learner may think their organisation can force it on them. -> Reword to "Optional for employees; people with admin-console access may be required to set it up by their organisation", or drop the sentence.
- [nit] docs/ADMIN-GUIDE.md:170 The Security operations intro says the pages are for security analysts and tenant administrators. Threat intelligence and Policy intelligence are gated by intel.read, which also includes content_creator (permissions.ts). The role table at the top also does not list intelligence under content creator. -> Add "(Threat and Policy intelligence: also content creators)" next to the Risk profiles exception.
- [nit] docs/ADMIN-GUIDE.md:222 The Sign-in tab row says "Administrators always sign in with their own password, never through SSO". PRIVILEGED_ROLES also covers analysts and campaign managers. The whitepaper states this correctly, so the two customer documents differ slightly. -> Say "Administrators, security analysts and campaign managers always sign in with their own password...".

## fix
fixed:
docs/SECURITY-WHITEPAPER.md: the CSRF row now reads 'no GET request changes account or organisation data, apart from the simulation open-tracking pixel and the single sign-on callback, which is protected by state, nonce and PKCE'. Checked against portal/src/app/api/sso/callback/[tenant]/route.ts (state cookie compared at line 40, PKCE verifier at line 74, ID-token nonce at line 76) and portal/src/app/api/t/[token]/open/route.ts. Other GET routes (qr image, report/people/export downloads) only read data, apart from audit and rate-limit rows.
docs/LEARNER-QUICKSTART.md: 'Some organisations require it' replaced with 'It is optional for employees; people with admin-console access may be required by their organisation to set it up.', which matches twoFactorRequired in portal/src/server/auth/permissions.ts:84-86.
rejected:

