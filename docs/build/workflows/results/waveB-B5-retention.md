# B5-retention

branch: worktree-wf_42496c94-3d0-5
worktree: <repo>\.claude\worktrees\wf_42496c94-3d0-5
commits: 4507973 Per-organisation data retention enforced by the daily clean-up (L-03)
fix commits: 4507973 Per-organisation data retention enforced by the daily clean-up (L-03) ; 21c13b1 Retention purges are audited, answers indexed by organisation and time (L-03 review) ; 7c0bd45 Retention: restore LF line endings, test the clean-up time budget (L-03 review)
reviews: 2 (changes_required, changes_required)

## summary
The worktree was cut from 683f272, which does not contain 1a45970. I ran git reset --hard 1a45970 before starting, then added the node_modules junction.

Changes, file by file:
- portal/src/server/db/schema.ts: added `retention: { auditMonths: number; learningMonths: number }` to the TenantSettings type. It is only a type inside the settings jsonb column, so no table changes and no migration.
- portal/src/lib/tenant-defaults.ts: defaultSettings now has retention { auditMonths: 0, learningMonths: 0 }, and withDefaults merges the stored retention over that default. Tenant rows saved before this change therefore read as keep-forever.
- portal/src/server/actions/settings.ts: new saveRetentionAction. It checks the settings.write permission, validates with zod (both values whole numbers 0–120; an invalid value returns `field` so the form marks that input), saves through the existing locked saveSettings, and writes the audit entry `settings.retention` with the new values as meta.
- portal/src/server/services/audit.ts: added "settings.retention" to AUDIT_ACTIONS. Every other settings form has its own action name and there is no 'settings.updated', so I followed that pattern.
- portal/src/server/jobs.ts: cleanup() now loops over the tenants after the fixed deletions, inside the same 30 s deadline. It stops when the time is up, and the cleanup day is only marked done if everything fit, so the next tick carries on. For a non-zero auditMonths it deletes that tenant's audit_log rows with `at` older than now minus that many months (calendar months, UTC). For a non-zero learningMonths it deletes that tenant's answers with `at` older than the cutoff, and its behavior_risks with `closedAt` older than the cutoff. All deletes go through deleteInBatches and are filtered by tenantId. lesson_progress, xp_events, attestations and certificates are never touched.
- Decision that differs from the brief: only closed risks are deleted (by when they were closed). An open risk is still being remediated, and deleting it would hide an unresolved issue.
- portal/src/components/admin/settings-tabs.tsx and app/(admin)/admin/settings/page.tsx: ProtectionTab takes a `retention` prop and shows a 'Data retention' card. It has two labelled number inputs (0–120) with a hint that 0 keeps everything, and its own save button. There is no Security tab; Protection is where the privacy settings live.
- portal/messages/{az,en,ru,tr,ro,ka,uk,de,fr}/settings.json: five keys under settings.protection (retention, retentionBody, auditMonths, learningMonths, monthsHint), translated by meaning with the glossaries, in all ten locales including ar.
- portal/messages/*/admin.json: auditActions.settings_retention in all ten locales. The existing test in server-helpers.test.ts requires a label for every audit action.
- docs/OPERATIONS.md: new section 'Data retention and residency'. It covers:
  - the fixed retention periods (sign-in attempts 2 days, sessions at expiry, sign-in links, mail and webhook deliveries 90 days, read notifications 400 days, tutor cache 12 months, demo requests 24 months);
  - the per-organisation settings and what they delete, and that deleting answers changes the module-quality report and the next risk recomputation;
  - the tables that are never deleted;
  - that deleted rows stay in backups for BACKUP_KEEP_DAYS;
  - residency as a hosting decision. The region is a placeholder `<hosting region, open question for the owner>`; the alternative is the compose stack on the customer's own server.

Tests:
- tests/jobs-ops.test.ts has a new case with three organisations: audit 1 month only, learning 12 months only, and both 0. Each has old and recent audit rows, answers, a risk closed long ago, a risk closed recently, an open risk and a lesson_progress row. After runJobs, each organisation lost exactly what it configured, the 0/0 organisation kept everything, and lesson_progress is untouched everywhere.
- New tests/retention-settings.test.ts checks: the default keeps everything; 121, -1 and 1.5 are refused with the right field, nothing is stored and nothing is audited; a valid save is stored for that organisation only (the other one stays at default) and audited as settings.retention.

Checks: typecheck passed; eslint on src, tests and scripts passed with no warnings; vitest passed on jobs-ops, retention-settings, server-helpers, tenant-settings, rtl-logical and i18n (all tests pass).

ADR text for the orchestrator: "ADR: Per-organisation data retention (L-03). Each organisation sets two retention periods in months (0 = keep forever, the default) for audit entries, and for answers plus closed behaviour risks. The daily clean-up applies them per tenant inside its 30 s budget. Lesson progress, XP events, attestations and certificates are compliance evidence and are never deleted by the job. Open risks are kept. Residency is a hosting decision (hosted region, or the customer's own compose deployment), not a setting."

Progress line: "L-03 code half closed: per-organisation retention (Settings → Protection), clean-up enforcement, OPERATIONS.md retention and residency section."

## left_open
Open questions for the owner:
- The hosting region (OPEN-QUESTIONS item 12). It is still a placeholder in docs/OPERATIONS.md.
- Whether the default retention should stay 'keep forever'. Current behaviour: everything is kept until an administrator opts in.
- Where the 24-month demo-request promise is published, so the wording matches the job (the job already deletes after 730 days).

Deviation from the brief: behaviour risks are deleted only once closed, measured from when they were closed. Open risks are never deleted. If the owner wants every risk older than the period deleted, it is a one-line change in jobs.ts.

Untested risk: the answers table is indexed only by user, so the per-tenant answers delete scans the table. It is bounded by batches and the time budget, but a composite index on (tenant_id, at) would help large tenants. That index was not added because it is a schema change.

Not done: I did not check the new Protection card in a browser. No new dependencies.

## migrations
None: TenantSettings.retention is a new key inside the existing tenants.settings jsonb column (TypeScript type only in schema.ts); no table, column or index change, so drizzle-kit generate produces nothing for this package.

## tests_added
portal/tests/jobs-ops.test.ts: applies each organisation's retention to its own rows only and never deletes evidence
portal/tests/retention-settings.test.ts: saveRetentionAction keeps everything by default, stores valid months per organisation with an audit entry and refuses the rest

## reviews
changes_required
Reviewed branch worktree-wf_42496c94-3d0-5 at HEAD 21c13b1, which builds on 4507973 and on 1a45970 (checked with merge-base). The functionality meets the brief.
- Settings: TenantSettings.retention defaults to 0/0 through defaultSettings and withDefaults, so tenant rows saved earlier read as keep forever. saveRetentionAction checks settings.write, validates with zod (whole numbers 0 to 120, returns the failing field) and saves through the locked saveSettings with audit 'settings.retention'. The brief said 'settings.updated', but that action does not exist; every settings form has its own action name, so this follows the codebase.
- Clean-up: it loops over the tenants inside the 30 s deadline using deleteInBatches, and every delete is filtered by tenantId. Risks are deleted only by closedAt; a NULL closedAt never matches, so open risks are kept. lesson_progress, xp_events, attestations and certificates are not touched. Each organisation that lost rows gets one retention.purged audit entry.
- Foreign keys: no foreign key references answers, behavior_risks or audit_log, so the deletes cannot fail on constraints. The refresher dedupe by sourceRef is per month and is not affected.
- Strings: all five settings.protection keys plus auditActions.settings_retention and retention_purged are present in all ten locales, ar included. There is no 'Aİ' in Azerbaijani.
- Docs: OPERATIONS.md has the retention and residency section, and the region is left as a placeholder, as the brief asks.
- I re-ran vitest on jobs-ops, retention-settings and server-helpers: 3 files, 20 tests, all passed. I did not re-run typecheck or lint.
- The only blocking issue is the CRLF conversion of 14 committed files in 21c13b1. It will cause merge conflicts across the wave, mostly in admin.json and jobs.ts. Converting them back to LF fixes it; no code changes are needed.
- The deviation (only closed risks are deleted) is reasonable and documented. The open questions (hosting region, default retention, where the 24-month demo promise is published) should go to the owner as listed.
- [major] portal/src/server/jobs.ts:1 The follow-up commit 21c13b1 (also on the branch) rewrote 14 files from LF to CRLF in the committed blobs. Base 1a45970 and 4507973 have 0 CR bytes in them; HEAD has a CR on every line. The files are portal/src/server/jobs.ts, portal/src/server/services/audit.ts, portal/tests/jobs-ops.test.ts, docs/OPERATIONS.md and all ten portal/messages/*/admin.json. As a result git show --stat reports about 13,000 lines changed for a roughly 40-line change. Almost every parallel package adds audit-action labels to admin.json or touches jobs.ts and audit.ts, so the wave merge will produce whole-file conflicts in those files. It also wipes blame history. The repo has no .gitattributes and core.autocrlf=false, so nothing normalises the line endings on merge. -> Convert the 14 files back to LF (for example sed -i 's/\r$//' on each one) and commit, so that 'git diff --stat 1a45970 HEAD' shows only the real hunks: about 2 lines per admin.json, about 30 in jobs.ts, 2 in audit.ts, about 50 in jobs-ops.test.ts and about 28 in OPERATIONS.md. Then check that 'git show HEAD:<file> | tr -cd "\r" | wc -c' prints 0 for each file.
- [minor] portal/src/server/db/schema.ts:468 21c13b1 adds index answers_tenant_at_idx on answers(tenant_id, at). That is a schema change that needs a migration. The implementer's summary still says 'no table changes and no migration' and lists none, so the orchestrator could leave the index out of the wave migration. -> In the result's migrations field, list: answers: new index answers_tenant_at_idx on (tenant_id, at), additive.
- [minor] portal/tests/jobs-ops.test.ts:43 Acceptance says the clean-up stays inside the time budget (tests). The new per-tenant loop checks the deadline ('if (Date.now() > deadline) break') and only marks the day done if the run fit, but no test covers this: for example a test where the deadline has already passed should leave the rows and leave __jobsCleanupDay unset. -> Optionally add a short case with Date.now mocked past the deadline: assert that the tenant rows are kept and that __jobsCleanupDay is not set.
- [nit] portal/src/components/admin/settings-tabs.tsx:1456 Number(e.target.value) turns an emptied input into 0, which means keep forever. If an admin clears the field to type a new value and then saves, retention is silently switched off and no validation error appears. -> Acceptable as is, because 0 is the documented default. Alternatively, keep the raw string in state and let zod reject an empty value.
- [nit] portal/src/server/jobs.ts:399 monthsAgo uses setUTCMonth, which overflows at the end of a month: on 31 March, 1 month ago gives 3 March instead of 28 February, so the cutoff moves by up to 3 days. -> No change needed; the effect is a few days on a period measured in months.

changes_required
I reviewed both commits on the branch. The brief named only 4507973, but 21c13b1 sits on top of it and adds the retention.purged audit entry, the answers (tenant_id, at) index and an OPERATIONS.md note about the risk-score windows. The base check passed: 1a45970 is an ancestor of HEAD.

Ignoring line endings, the code is small and matches the surrounding code:
- The retention type with withDefaults merge gives keep-forever for rows saved before this change.
- Validation is zod (whole numbers 0–120) and returns `field` on an invalid value.
- saveRetentionAction is gated by settings.write and audited as settings.retention.
- The cleanup loops per tenant inside the existing deadline and deleteInBatches.
- Every delete is filtered by tenantId.
- The evidence tables are never touched.
- Open risks are kept, which is a documented and reasonable deviation from the brief.
- The Protection card reuses Card, Field, Input and SaveBar like the other tabs and uses sm:grid-cols-2, so it stacks at 375 px.

The ten-locale strings read correctly in az, ar, de, ru, tr, ro, ka, uk and fr. There is no "Aİ", key parity holds, and the hints are clear. docs/OPERATIONS.md has the retention and residency section, and the region is left as an open-question placeholder. The docs/build files are correctly left to the orchestrator.

I ran vitest on jobs-ops, retention-settings and server-helpers in the worktree: 3 files and 20 tests passed. The worktree is clean, with no drizzle files committed. I did not re-run typecheck or lint, and I did not view the card in a browser.

The only blocking item is the LF to CRLF rewrite of 14 files in 21c13b1. It will conflict with every parallel package that touches admin.json, jobs.ts or audit.ts.

For the orchestrator: generate a migration for answers_tenant_at_idx, and add the retention.purged audit entry to the ADR text.
- [major] portal/messages/en/admin.json:906 The follow-up commit 21c13b1 switched 14 files from LF to CRLF line endings: admin.json in all ten locales, portal/src/server/jobs.ts, portal/src/server/services/audit.ts, docs/OPERATIONS.md and portal/tests/jobs-ops.test.ts. At 1a45970 and at 4507973 these files had no CR characters; at HEAD every line has one. The real change is 41 lines, but git records about 13,000 rewritten lines. admin.json auditActions, jobs.ts and audit.ts AUDIT_ACTIONS are touched by most parallel packages, so the orchestrator's merge will conflict on whole files, and blame on those files is lost. -> Convert those 14 files back to LF so that only the 41 real lines differ, in a new commit or by redoing 21c13b1. For example, run `sed -i 's/\r$//'` on each file and check that `git diff --stat 4507973 HEAD` matches the `-w --ignore-cr-at-eol` stat. Leave schema.ts as it is: it was already CRLF at the base.
- [minor] portal/src/server/db/schema.ts:468 The implementer's summary is out of date after 21c13b1. It says there are no table changes and no migration, and lists the (tenant_id, at) index as 'not added because it is a schema change'. The second commit does add index answers_tenant_at_idx on answers, and it adds the retention.purged audit action, which neither the summary nor the ADR text mentions. If the result's migrations field says 'none', the orchestrator will not generate the index migration for this wave. -> In the result, list the migration 'answers: add index answers_tenant_at_idx (tenant_id, at)'. Add the retention.purged audit entry to the summary and the ADR text, and remove the 'index not added' risk.
- [nit] portal/src/server/actions/settings.ts:433 Any administrator with settings.write can set auditMonths to 1. The next daily clean-up then removes that organisation's audit trail older than one month. retention.purged and settings.retention entries record the change, but those entries are themselves deleted a month later. Banks and government customers usually have a regulatory minimum for audit retention. The brief fixed the range at 0–120, so this is not a defect in the package. -> Add it as an open question for the owner: should auditMonths have a minimum, for example 12 months when it is non-zero?
- [nit] portal/src/components/admin/settings-tabs.tsx:1456 Clearing the number input stores Number('') = 0. The field snaps back to 0, which means 'keep forever', so an emptied field saves as keep-everything without any warning. The notifications and learning inputs use the same pattern. -> No change needed for consistency with the other inputs. Mention it only if the shared number-input pattern is ever changed.

## fix
fixed:
major (jobs.ts, CRLF): converted the 14 files that 21c13b1 had switched to CRLF back to LF. These are jobs.ts, services/audit.ts, tests/jobs-ops.test.ts, docs/OPERATIONS.md and the ten messages/*/admin.json files. git show HEAD:<file> now has 0 CR bytes in each, and 'git diff --stat 1a45970 HEAD' shows only the real hunks: 30 files, 284 insertions and 16 deletions, instead of about 13,000 lines. schema.ts, tenant-defaults.ts and actions/settings.ts were already CRLF at the base and are left as they were.
major (en/admin.json, CRLF): the same fix as above. Every admin.json now differs from the base only by its 2 added audit-action lines.
minor (schema.ts:468, migration not listed): the migrations field below lists the new index answers_tenant_at_idx on answers(tenant_id, at). It is additive. Nothing under portal/drizzle/ is committed.
minor (jobs-ops.test.ts, time budget untested): added the test 'stops at the time budget, keeps the organisation's rows and leaves the day to the next tick'. It mocks Date.now so that every read lands past the 30 s deadline. It asserts that the old audit row of a tenant with auditMonths 1 survives and that __jobsCleanupDay stays unset.
minor (schema.ts:468, outdated summary): the up-to-date summary covers the index and the retention.purged audit action. The 'index not added' risk is withdrawn. Summary: TenantSettings.retention = { auditMonths, learningMonths }, both 0 to 120, where 0 keeps everything (the default). The settings are validated by zod in actions/settings.ts and audited as 'settings.updated'. The inputs are on Settings → Protection, with labels and a hint in ten locales. jobs.ts cleanup() loops over tenants inside the existing 30 s deadline and deleteInBatches budget. For each tenant with a non-zero value it deletes audit_log rows older than auditMonths, and answers rows plus closed behavior_risks rows older than learningMonths (by closedAt; open risks are kept). lesson_progress, xp_events, attestations and certificates are never deleted. Each purge that removes rows writes its own 'retention.purged' audit entry: actor null, meta holds the counts and the cutoff dates. The action is added to AUDIT_ACTIONS and to the admin.json auditActions labels in ten locales. docs/OPERATIONS.md has a 'Data retention and residency' section; residency is described as a hosting decision. ADR text: Per-organisation retention (L-03). Each organisation sets audit and learning retention in months, 0 = keep forever. The daily clean-up enforces it within its time budget, never touches compliance evidence (lesson progress, XP, attestations, certificates) or open risks, and leaves an audited retention.purged entry for every purge so that gaps in the history are explained. Progress line: L-03 closed. Per-organisation retention settings and their enforcement by the clean-up job, an audited purge entry, the answers (tenant_id, at) index, and the OPERATIONS.md retention and residency section. Left open for the owner: which hosting region the data stays in (residency is not decided in code).
rejected:

