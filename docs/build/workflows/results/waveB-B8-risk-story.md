# B8-risk-story

branch: worktree-wf_42496c94-3d0-8
worktree: C:\Users\Safar\Desktop\Cyclowareness- Vol2\.claude\worktrees\wf_42496c94-3d0-8
commits: aced5b2 Leadership risk story: data-driven sentences in ten languages, also in the compliance pack ; 3bfc60d Risk story: share the department-filter narrowing with the reports, wrap long tile labels
fix commits: 036fb0f Risk story: as-of title in the compliance pack, skip modules already assigned, wrap department name
reviews: 2 (changes_required, approve)

## summary
This is a retry. The earlier run had already committed the main work (aced5b2), but it left a small refactor uncommitted, and those files had been rewritten with CRLF line endings. I changed them back to LF (the index uses LF), checked the work again and committed it (3bfc60d).

File by file:
- portal/src/server/queries/risk-story.ts (new): `riskStory(viewer, locale, departmentId?)` returns either an empty state `{ empty: true, days }` or the story:
  - **Trend:** average score on the first and last day of `user_risk_snapshots` over the last 21 days.
  - **Most exposed department:** highest average current risk, among departments with at least 3 active members.
  - **Weakest category:** the module category with the most open `behavior_risks` in that department. Its module with the most open risks is the next step.
  - **Campaign:** the campaign launched in the window whose click rate changed most against the campaign launched before it.
  - **Training:** the module most people completed in the window.
  - **Certificates:** share of people in scope with a `server_verified` certificate since the start of the quarter, using the organisation's time zone.
  - The empty state applies when there are fewer than STORY_MIN_DAYS = 7 snapshot days.
  - `storySentences(story, locale)` turns this into 4–6 sentences. Each sentence is one ICU message (plural, select, date). Nothing is concatenated and no AI is used.
- portal/messages/{az,en,ru,tr,ro,ka,uk,de,fr,ar}/admin.json: new `riskStory` namespace in all ten locales, same keys everywhere (title, subtitle, empty, weakest, weakestCategory, trend, campaign, training, certified, next, assign, finding, tiles.*).
- portal/src/app/(admin)/admin/leadership/page.tsx: a 'Risk story' card at the top of the page (server component).
  - Shows the sentences, then the numbers as small tiles: average risk, change since a date, certified this quarter, most exposed department. Values sit in `<bdi>` so they read correctly in Arabic.
  - Dates are formatted on the server in the tenant time zone (the next-intl request config sets the tenant's timeZone).
  - The recommended step opens AssignDialog already set to that module and department. It only appears for viewers with `assignments.write`.
  - leadership/loading.tsx was updated to match the new layout.
- portal/src/components/admin/assign-dialog.tsx: new optional `preset` and `label` props, so the dialog can open pre-filled.
- portal/src/server/reports/build.ts: `buildRiskStory(viewer, filters, locale)` returns the same sentences as a 'Risk story' table. portal/src/app/(print)/print/compliance/page.tsx prints it as the first section of the compliance pack.
- portal/src/server/queries/admin.ts: `narrowToDepartment` is now the single rule for department filters: a deleted, merged, foreign or out-of-scope department matches nobody. Both the risk story and `scopedPeople` in the reports use it instead of two copies.
- portal/tests/risk-story.test.ts: tests listed under tests_added.

Proposed ADR: "Leadership risk story is template-based." The sentences are ICU messages filled from tenant data (snapshots, behaviour risks, campaigns, progress, certificates). There is no AI dependency, so the text is the same every time and can be audited. Below 7 snapshot days the story is an explicit empty state. A department needs at least 3 members to be named the most exposed.

Progress line: "B8 risk story: leadership panel plus compliance-pack section, 10 locales, tests."

Checks: `npm run typecheck`, `npx eslint src tests scripts --max-warnings=0`, and `npx vitest run` on tests/risk-story, reports-build, rtl-logical, i18n, in-code-locales, auth and route-status all pass (725 tests). The Azerbaijani files contain no "Aİ".

## left_open
Decision for the owner: the thresholds (7 snapshot days before a story appears, 3 members before a department can be named, a 21-day window) are constants in risk-story.ts and not organisation settings. Change them if your customers need other values. Not done: I did not open the page in a browser, since the brief forbids starting or stopping servers. The Arabic layout is covered only by the rtl-logical test and the `<bdi>` tags, not by looking at it. No new dependencies and no schema changes.

## migrations


## tests_added
portal/tests/risk-story.test.ts: returns the empty state for a new organisation and while there are fewer than 7 snapshot days
portal/tests/risk-story.test.ts: on a seeded in-memory organisation, finds the right department (Finance), weakest category, a falling trend (52 to 45), the campaign that moved most, the top training, the certified share and the next step
portal/tests/risk-story.test.ts: a department filter narrows the story; a filter outside the viewer's scope or from another organisation matches nobody
portal/tests/risk-story.test.ts: the compliance-pack section (buildRiskStory) carries the same sentences
portal/tests/risk-story.test.ts: in each of the ten locales, the full, sparse, steady and empty stories and the tile labels render with no missing argument (the translator throws on any error)

## reviews
changes_required
I reviewed commits aced5b2 and 3bfc60d in the worktree .claude/worktrees/wf_42496c94-3d0-8; it has 1a45970 as an ancestor and the working tree is clean. I re-ran the checks: typecheck passes, eslint passes with zero warnings, and vitest on tests/risk-story, reports-build and rtl-logical passes (28 tests).

What holds:
- The riskStory query covers the weakest department (at least 3 members) and its weakest category, the 21-day trend from user_risk_snapshots, the campaign that moved the click rate most and the most-completed training, server-verified certificates since the start of the quarter in the tenant time zone, and the next step.
- The empty state for a new organisation or fewer than 7 snapshot days is tested.
- The riskStory key set is the same in all ten locales, and there is no "Aİ" in az.
- Every locale renders through createTranslator with onError set to throw, so a missing argument fails the test.
- The plural forms for ru, uk, ro, fr and ar look right.
- Dates use {since, date}, and the next-intl request config supplies the tenant time zone even when a locale is passed explicitly.
- The page is a server component; the tile values are in <bdi> and the CSS is logical.
- AssignDialog presets the module and department, and createAssignmentAction still checks server-side that the module and department belong to the organisation.
- The compliance pack calls buildRiskStory with the same department narrowing as scopedPeople, and a test asserts the section.

The one major finding is the time frame of the compliance-pack section. The rest is minor polish.

Not checked: the page in a real browser, in Arabic or any other locale.
- [major] portal/src/server/reports/build.ts:59 buildRiskStory uses only f.departmentId and ignores the pack's period (f.from/f.to). The compliance print page documents the rule "Every section, the period header and the audit entry use the filters the reports apply" (print/compliance/page.tsx:29-30). The new section breaks that rule. A pack printed today for an earlier period (say ?from=2026-01-01&to=2026-03-31) puts this week's story under that period's header: the 21-day trend, campaigns and trainings from the last three weeks, and 'This quarter ... certificate' for the current quarter, not Q1. This is a document for auditors at banks and governments, so it misleads them. -> Make the section honest about its time frame, either way with a test in tests/risk-story.test.ts. Option 1: when a period is given and f.to is before today, leave the section out (return no rows, or have the print page skip it). Option 2: give the section an as-of title, a new ICU key such as riskStory.titleAsOf "Risk story (as of {date, date, long})" in all ten locales, so a past-period pack shows plainly that the story is current. Do not compute the story inside a period it does not cover.
- [minor] portal/src/app/(admin)/admin/leadership/page.tsx:115 The 'most exposed department' tile shows the department name as a truncated <dd> with no title or other way to read the full text. Long department names (common in government tenants, and in de/ka/ru) get cut off. The tile labels were made to wrap (break-words), but this value was not. -> Let the note wrap like the label (break-words instead of truncate), or add title={x.note}.
- [minor] portal/src/server/queries/risk-story.ts:105 The recommended next step is the module with the most open behaviour risks in the weakest category. It does not check whether that department already has an active assignment of the module, so the panel can keep suggesting 'assign X to Finance' after X was assigned. Assigning it again creates a duplicate. -> Optional: skip modules with an active assignment for that department when choosing toAssign, or note the limit in a shortcut comment and as an open question.
- [nit] portal/src/server/queries/admin.ts:99 The summary says narrowToDepartment is now the single rule for department filters. overviewData still has its own copy (lines 99-100), and that copy falls back to the whole scope for a deleted or foreign filter instead of matching nobody. This code existed before the package, but the claim that the root cause was fixed once in shared code is incomplete. -> Use narrowToDepartment in overviewData too, or say that it was left out on purpose.
- [nit] portal/messages/ar/admin.json:1187 In the RTL sentences, interpolated department names and module titles (often Latin script) are not bidi-isolated. Only the tile values use <bdi>. With guillemets this is mostly fine, but a Latin name next to Arabic digits or a percent sign can be reordered. -> Optional: wrap the interpolated names in U+2068/U+2069 (FSI/PDI) when formatting the RTL sentences, or check the layout in a browser in Arabic.

approve
I reviewed the diff from 1a45970 to 3bfc60d in .claude/worktrees/wf_42496c94-3d0-8. The worktree descends from 1a45970.

What the change does:
- risk-story.ts is a small template-based query with no AI.
- Every sentence is a single ICU message, using select, plural (with the Arabic and Slavic forms) and date arguments. The riskStory keys are the same in all ten locales.
- The test checks every locale, with onError set to throw. I spot-read az, ar, de, ru, tr, fr, ka, uk and ro: the meaning is right, there is no 'Aİ', and Turkish puts the percent sign first (%{x}).
- The leadership panel is a server component. Its values sit in <bdi> and its CSS is logical, and dates are formatted in the request's tenant time zone.
- The recommended step appears only for viewers with assignments.write.
- narrowToDepartment replaced the duplicate rule in scopedPeople without changing behaviour, and the 'nobody' cases (out of scope, foreign department) are tested.
- The empty state below 7 snapshot days is tested.
- The compliance pack section is tested.

I ran tests/risk-story.test.ts and tests/rtl-logical.test.ts in the worktree: 16 tests passed. I did not rerun typecheck or lint; the implementer reports both green.

Docs: as the brief says, nothing under docs/build was edited. The ADR and progress line are in the implementer's summary.

Not checked:
- The page was not rendered in a browser, so the 375 px and Arabic layout checks come from reading the code only.
- Every query passes the people in scope as an inArray list of ids. That copies the existing listPeople pattern, but it would hit Postgres's parameter limit in a tenant with more than about 65,000 users.
- [minor] portal/src/server/reports/build.ts:59 buildRiskStory passes only f.departmentId and ignores the pack's from/to period. The compliance page comment says every section uses the filters the reports apply, but this section always describes the last 21 days and the current quarter. An auditor reading a pack for Q1 gets a 'Risk story' that describes November, under a header that names Q1. The trend and training sentences carry their own 'since' date, so this is not silent, but the weakest-department and campaign sentences have no date at all. -> Keep the brief's 'same sentences'. Make the section say that it reflects the state on the day the pack was generated, for example a title such as 'Risk story (as of {date})' added to the riskStory namespace in all ten locales. Alternatively, record in the ADR that this section ignores the period.
- [minor] portal/src/app/(admin)/admin/leadership/page.tsx:97 The recommended-step AssignDialog gets paths=[] and people=[], but it still shows the Path and Person segments. Picking either one gives an empty list or select, and an administrator may not understand why. The 'Everyone' segment also stays one click away from the preset department. -> Acceptable as is. If you want it tighter, pass the real paths and people lists, as the assignments page does, so that every segment works.
- [nit] portal/src/app/(admin)/admin/leadership/page.tsx:72 The 'Most exposed department' tile shows the department's average risk number as its main value and puts the department name in a small truncated note. A reader expects the name to be the value. At 375 px, with two columns, a long department name is cut off. -> Label the tile with the department name, or relabel it 'Risk in most exposed department', and let the note wrap instead of using truncate.
- [nit] portal/messages/de/admin.json: In riskStory.training the verb 'haben' is outside the plural ('...haben sie {people, plural, one {# Person} ...} abgeschlossen'). For one person this reads 'haben sie 1 Person abgeschlossen', which is wrong grammar; it should be 'hat'. -> Move the verb inside the plural: '{people, plural, one {hat sie # Person} other {haben sie # Personen}} abgeschlossen'.
- [nit] portal/src/server/queries/risk-story.ts:76 The module chosen for the next step comes from the behaviour_risks join. Nothing checks that the module is published, or that it is not already assigned to that department, so the story can keep recommending a step that has already been taken. -> Optional: filter on modules.status = 'published'. Already-assigned modules can be left for a later pass.

## fix
fixed:
major (reports/build.ts:59, period ignored): buildRiskStory now titles the section with a new ICU key riskStory.titleAsOf "Risk story (as of {date, date, long})" in all ten locales, dated requestNow(), so a pack printed for an earlier period shows that the story describes the day of printing. The compliance page comment now names this one exception. Test: a Q1-filtered pack gets the as-of title, and titleAsOf renders in every locale.
minor (reports/build.ts:59, duplicate of the major finding): fixed by the same as-of title.
minor (leadership/page.tsx:115): the most-exposed-department tile note now wraps (break-words hyphens-auto) instead of truncating.
minor (risk-story.ts:105): the recommended module skips modules whose assignment already reaches the department (scope everyone, or a department assignment whose closure contains it, parent departments included). Test: an assignment to IT leaves the Finance recommendation in place; an assignment to Finance clears it (module null, so no next-step sentence).
rejected:
minor (leadership/page.tsx:97, AssignDialog gets empty paths/people): the reviewer marked this acceptable as is. Loading every path and person on the leadership page only to fill segments the preset does not use is extra queries for no part of the brief; the dialog opens with the department and module preset.
