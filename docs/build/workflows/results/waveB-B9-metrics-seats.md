# B9-metrics-seats

branch: worktree-wf_42496c94-3d0-9
worktree: <repo>\.claude\worktrees\wf_42496c94-3d0-9
commits: 0dadd07 Operator usage metrics page and seat export ; be22967 Seats leave out operator accounts; lesson note says started or completed
fix commits: e9931d4 Metrics leave operator usage out; note says modules and certificates are all time
reviews: 2 (approve, approve)

## summary
This retry found the package already committed on this branch by the previous attempt, on top of 1a45970 (the merge-base check passes). I reviewed it against the brief and reran all checks. Nothing new needed committing and the tree is clean.

File by file:
- portal/src/server/queries/platform-metrics.ts (new):
  - peopleCounts(now): one grouped query on users giving active, invited, weekly (last 7 days) and monthly (last 30 days) per tenant. It leaves out super_admin accounts, because vendor operators are not billable seats.
  - platformMetrics(now): one query per metric group, run in parallel: tenants; people; lessons started vs completed in 30 days; modules completed; certificates with evidence = server_verified. The campaign funnel (sent, opened, clicked, reported) is summed per tenant from the existing campaignStats. Aggregates only, no rows per person.
  - Decision: weekly/monthly active use users.last_active_at, not session rows, because sessions are deleted on sign-out and expiry and would forget people who signed out.
  - Decision: started_at is cleared when a lesson is completed, so "started" counts any progress row started in the window or completed (lastCompletedAt or completedAt) in the window. A replay in the window counts too.
  - No indexes were needed.
- portal/src/app/(admin)/super/metrics/page.tsx (new): an operator tab protected by requirePermission("platform.manage"). It shows one table row per organisation with 11 numeric columns formatted with getFormatter, inside a ScrollRegion, using logical CSS. The header has a "Seat export" ButtonAnchor that links to /api/super/seats.
- portal/src/app/(admin)/super/page.tsx and super/demo/page.tsx: a Metrics tab added to the TabsNav. The overview now takes its people count from peopleCounts(), the same count query the seat export uses.
- portal/src/app/api/super/seats/route.ts (new):
  - GET is protected by apiViewer("platform.manage"), like super/demo-requests.
  - It returns CSV built with lib/csv toCsv: organisation, plan, active_people, invited_people, month (YYYY-MM in the operator tenant's time zone).
  - Download headers: content-disposition attachment seats-<date>.csv, cache-control no-store.
  - Each export is audited as seats.exported.
- portal/src/server/services/audit.ts: "seats.exported" added to AUDIT_ACTIONS.
- portal/messages/{az,en,ru,tr,ro,ka,uk,de,fr,ar}/admin.json: platform.tabs.metrics, platform.metrics.{export, table, note, col.*}, and the audit label seats_exported, all ten locales.
- portal/tests/platform-metrics.test.ts (new):
  - Two seeded organisations, checked for every metric. This covers operator exclusion, suspended and invited people, 7/30-day windows, a replay counted by last_completed_at, self-reported certificates being left out, and no leakage between tenants.
  - The seats route returns 401 with no viewer and 403 for a tenant_admin, with no audit entry. An operator gets 200 with the exact CSV rows, and an audit entry is recorded.

Checks rerun now: typecheck pass, eslint pass, vitest pass (platform-metrics, rtl-logical, i18n, in-code-locales).

PROGRESS line: "B9-metrics-seats: /super/metrics operator usage tab (per-organisation aggregates, campaign funnel, server-verified certificates) and GET /api/super/seats seat CSV (operators only, audited); closes M-08 and the counting half of M-05/D-05."

ADR (seat counting now, memberships later): We count seats now as users rows per tenant: one users row belongs to exactly one tenant (users.tenant_id), and a seat is a non-operator user with status active (invited is reported separately). peopleCounts() in src/server/queries/platform-metrics.ts is the single place that counts them. The operator overview, the metrics page and the seat export all read from it, so a billing rule changes in one place. We do not build memberships or trials before the first pilots. The planned model after the pilots splits identity from tenancy:
- users becomes the identity only (email, name, credentials, 2FA).
- A new memberships(user_id, tenant_id, role, status, department_id) table carries everything that is per tenant today. One person can then belong to several organisations (holding companies, consultants, vendor staff) without duplicate accounts.
- Seats then count memberships, not users.

The migration is a backfill of one membership per existing user, then a rewrite of the predicates that scope people to a tenant. Today these are the 54 eq(t.users.tenantId, ...) predicates in 33 files under portal/src:
- people.ts 8, workspace.ts 9, jobs.ts 4, secops actions 3
- admin queries 2, campaigns service 2, risk 2, departments page 2, drill page 2
- one each in: assignments page, campaigns index, campaign wizard, leadership, policies index and [id], users/[id]/person.ts, api/admin/people/[kind], api policies signoffs, admin-overview, platform.ts, profile.ts, secops-options, secops queries, reports/build, services assignments, league, notify, secops, threats
- plus the users.tenant_id groupings and joins in platform-metrics.ts

Role, status and department_id reads on users move to the membership in the same pass. Session and viewer resolution gain an active-membership choice.

## left_open
Nothing from the brief is left undone.

Questions for the owner:
- Should invited people count as billable seats? Right now active and invited are exported side by side and only active is labelled as seats.
- Should suspended people ever count as seats? Right now they are excluded.

Not checked: the full suite (the orchestrator runs it) and the page in a browser (no server may be started).

Weekly and monthly active come from users.last_active_at, not from session rows as the brief wrote, because session rows are deleted on sign-out; the brief may want to note that.

No schema change and no new dependency.

## migrations


## tests_added
portal/tests/platform-metrics.test.ts

## reviews
approve
I reviewed commits 0dadd07 and be22967 in <repo>\.claude\worktrees\wf_42496c94-3d0-9. The branch contains 1a45970 and the tree is clean, with nothing under portal/drizzle committed and no schema change. I reran the checks there: typecheck passes, eslint on the touched files passes, and vitest passes on platform-metrics, server-helpers (audit labels), i18n and rtl-logical (213 tests).

Every acceptance item holds:
- /super/metrics is protected by requirePermission("platform.manage") and shows per-organisation aggregates only. The table has scope=col/row headers, logical CSS and getFormatter numbers inside a ScrollRegion. The tab appears in all three super pages.
- The strings are in all ten locales with key parity and contain no ICU braces and no "Aİ". The seats_exported audit label is present in every locale.
- GET /api/super/seats uses apiViewer("platform.manage", request) exactly like demo-requests: it handles the RSC probe, 2FA and 401/403, sends no-store and attachment headers, and audits seats.exported.
- Tests cover 401 and 403 with no audit entry, and the operator's 200 with the exact CSV rows and an audit entry.
- The metrics query test checks two seeded tenants on every column, including operator exclusion, invited and suspended people, the 7/30-day windows, a replay counted by last_completed_at, self-reported certificates left out, and no leakage between tenants.
- The ADR paragraph is present.

Using users.last_active_at instead of session rows is reasonable and matches src/server/queries/admin.ts (active7). The overview now leaves super_admin accounts out of its people count; this is a deliberate change of behaviour and consistent with the seat export.

Not checked: the page in a browser (no server may be started) and the full test suite.
- [minor] portal/src/server/queries/platform-metrics.ts:56 The lessons-started/completed and modules-completed queries join users with no role filter, so lesson and module progress by super_admin operators counts toward their organisation. peopleCounts() leaves operators out on purpose, so the page's columns use two different populations. -> Add ne(t.users.role, "super_admin") to the where clauses of the lessons and modules queries, or accept the mismatch and say so in the note.
- [minor] portal/messages/en/admin.json:1063 modulesCompleted is all-time while the lesson columns cover 30 days. The metrics note gives the window for lessons, campaigns and certificates but says nothing about modules, so an operator could read the modules column as 30 days too. -> Add 'Modules: all time' (translated by meaning) to platform.metrics.note in all ten locales, or limit the query to modules completed in the window.
- [nit] portal/src/server/queries/platform-metrics.ts:67 campaignStats gets every campaign id on the platform in a single inArray. This is fine at pilot scale but grows without limit. -> Leave it for now. When campaign counts grow, add a comment in the form 'shortcut: <the limit>, <when to upgrade>' or group by tenant directly in SQL.
- [nit] portal/src/server/queries/platform-metrics.ts:1 The ADR in the implementer's summary says there are 54 eq(t.users.tenantId, ...) predicates in 33 files. A grep of portal/src finds 54 occurrences in 29 files. -> The orchestrator should write '54 predicates in 29 files' in the ADR.

approve
Reviewed commits 0dadd07 and be22967 (worktree wf_42496c94-3d0-9, which contains 1a45970). The change does what the brief asks. /super/metrics shows per-organisation aggregates only and is protected by requirePermission("platform.manage"). The tab was added to all three TabsNav lists. The table sits in a ScrollRegion using logical classes (pe/px, text-start/end), so at 375 px it scrolls instead of breaking the layout. GET /api/super/seats follows the demo-requests route line for line: same apiViewer("platform.manage"), toCsv, todayIn, no-store and an audit entry. The new "seats.exported" action is in AUDIT_ACTIONS, and its label resolves through the audit page's replace(".", "_"). peopleCounts() is the single seat-count query, now shared by the overview, the metrics page and the export. One side effect: the overview people count no longer includes super_admin accounts, which is intended and documented. Using users.last_active_at instead of session rows is justified, since viewer.ts updates it and sessions are deleted on sign-out. All ten locales have the 12 col keys, the tab, export and audit labels. The az wording matches the existing "Fişinq simulyasiyaları", and no "Aİ" appears. Translations are by meaning: non-English locales say "user counts" where English says "seats", which reads naturally. Tests cover two organisations, operator, invited and suspended exclusion, both time windows, a replay, self-reported certificates, tenant isolation, and the seats route at 401, 403 and 200 with the audit check. I reran vitest on platform-metrics and rtl-logical: 7 tests pass. ESLint on the touched files is clean and the tree is clean. Typecheck I did not rerun, the implementer reports it passing. Not checked: the page in a browser (no server allowed). As the brief requires, docs/build files were not touched; the PROGRESS line and ADR are in the implementer's summary for the orchestrator. Owner questions carried by the implementer: whether invited and suspended people count as billable seats.
- [minor] portal/src/server/queries/platform-metrics.ts:54 Seat counts leave out super_admin accounts, but the lesson and module queries join users without any role filter. If an operator plays lessons inside a tenant, those plays still raise that tenant's lessonsStarted, lessonsCompleted and modulesCompleted. The certificates query has no role filter either. The page then shows usage from people who are not counted as seats. -> Add the same ne(t.users.role, "super_admin") predicate to the lesson and module queries (and join users for certificates), or state in the ADR that usage includes operators. The test can cover this with one operator lesson_progress row.
- [minor] portal/messages/en/admin.json:1062 The note says lessons are counted over the last 30 days and campaigns over all time. It never says that 'Modules completed' and 'Verified certificates' are also all-time totals. An administrator reading the row can assume these two share the 30-day window of the lesson columns next to them. -> Extend the note in all ten locales, for example 'Modules and certificates: all time, server-verified certificates only.'
- [nit] portal/src/server/queries/platform-metrics.ts:66 campaignStats is given the id of every campaign on the platform in a single inArray. This is fine at pilot scale but grows without bound. -> Add the comment 'shortcut: one IN list of every campaign, group by tenant in SQL once campaigns reach thousands'. A per-tenant SQL aggregate would replace it later.
- [nit] portal/src/server/queries/platform-metrics.ts:1 The ADR text in the summary says there are 54 eq(t.users.tenantId, ...) predicates in 33 files. A grep of portal/src finds 54 occurrences in 29 files. -> The orchestrator should correct the file count to 29 when it writes the ADR into DECISIONS.md.

## fix
fixed:
platform-metrics.ts: the lesson, module and certificate queries now filter on ne(users.role, 'super_admin'). The certificates query now joins users to do this. These counts now use the same population as peopleCounts(). (Findings 1 and 3.)
tests/platform-metrics.test.ts: the operator in Alpha now has a lesson_progress row completed in the window, a completed module_progress row and a server_verified certificate. The expected Alpha totals do not change, which proves that operator usage is left out.
messages/{az,en,ru,tr,ro,ka,uk,de,fr,ar}/admin.json: platform.metrics.note now says that completed modules and verified certificates are all-time totals and that operator accounts are not counted anywhere. Each locale was translated by meaning; keys are unchanged. (Findings 2 and 4.)
rejected:

