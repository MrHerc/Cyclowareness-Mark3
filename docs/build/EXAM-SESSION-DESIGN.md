# Exam session (imtahan sessiyası): design

Status: proposal, nothing built. Written for the owner and the engineers, 2026-11-13.

## 1. Summary

**Yes, we can add it.** Most of the parts already exist: server-side scoring of lesson questions (`src/lib/content/scoring.ts`), scope-based assignment, notifications and reminders, certificates, the report pipeline (CSV, XLSX, print, schedules) and the audit log. Two things are new: a timed attempt split into sections that the server controls, and a question view that never sends answers to the browser.

This is not a copy of LogiPass. LogiPass tests the aptitude of outside job candidates against a norm group. Ours tests the security knowledge of an organisation's own staff and links each result back to training.

**Size (rough estimate):** one additive migration (`0008_exams.sql`: 7 new tables and 1 new column), a new `exams` plan feature, and about 5 to 7 engineer-weeks for v1 (packages P1 to P5). S is about 1 to 2 days, M about 3 to 5 days, L about 1.5 to 2 weeks.

## 2. What we take from LogiPass and what we leave out

| LogiPass | Ours, v1 |
|---|---|
| A session is a battery of tests, each with its own time limit | Yes. An exam is an ordered list of sections, each with its own minutes and item count |
| 19 to 50 items, randomly generated | Partly. Items are drawn per person from a topic pool using a stored seed. Counts are limited by pool size (typically 10 to 20) |
| Single or multiple choice, true/false, matching | Yes: `choice` (single and `multi`), `swipe` cards as true/false, `match`, `order`, tutor checkpoints |
| Typed answers, graphs and tables, reading passages | No. Lessons have no such scored items yet. Possible with custom items in P7 |
| An interrupted session resumes from the same link | Yes, restored from the server |
| 25% extra time | Yes, 25% or 50% per person, set by an admin |
| Score, accuracy and pace per test | Yes, per section and overall, plus per topic |
| Summary, per-test cards, "show mistakes", PDF | Yes. The PDF comes from the browser print view (ADR-006) |
| Flags irregular work patterns | Yes, as neutral signals that never change the score |
| 1 to 9 percentile against a norm group | No: we have no norm data and tenants are small |
| Candidate photos | No: privacy law, works councils and culture |
| External candidates without accounts | No: signed-in staff only |
| Priced per completed test | No: included in a plan (proposed: professional) |

## 3. Flows

**Admin** (`/admin/exams`, gated by feature `exams`)
1. **Build.** Set the title in each language, then add ordered sections. Each section has a topic (`modules.category`), an optional list of modules, an item count and minutes. The exam also has a pass mark (default 70%, as `LAB_PASS`), max attempts (default 1), an availability window (`opens_at` to `closes_at`, which is also the due date) and an optional certificate on pass. The builder shows the pool size per section and per language, so nobody can ask for 15 items from a pool of 8. The status moves draft → published → archived. An exam that has attempts can only be archived, never deleted.
2. **Assign.** Use the scopes everyone, department or user, resolved by `targetsOf` and `departmentClosure` (`services/assignments.ts`), with the `assign-dialog.tsx` picker. Send notifications with `notifyUsers(..., "assignment", ..., { defer: true })`. Reminders are a new exam step in the `jobs.ts` reminders and dedupe against `notifications`, as module reminders do.
3. **Adjust.** Grant extra time per person, grant a retake or void an attempt. Every one of these is audited.
4. **Review.** A results table for each exam, a page for each attempt, and exports.

**Learner** (`/exams`, `/exams/[id]`)
1. **Intro.** Shows the sections, item counts, minutes (with any extra time), attempts left, the back-navigation rule and exactly what is recorded.
2. **Start.** One transaction draws the items with a crypto seed, stores a snapshot of each scene and locks the locale. Only items that exist in the learner's locale are drawn.
3. **Section.** One item per screen, plus a question map to jump between and flag items inside the section. Each answer is saved when it is picked, with a "not saved, retrying" state on failure. No feedback is shown during the exam.
4. **Section end.** The learner submits (after an `alertdialog` confirmation) or the time runs out. A closed section never reopens. A break screen follows, and the clock is stopped between sections.
5. **Finish.** Pass or fail, overall and per-section scores, per-topic bars, and links to the modules for the topics to revisit.
6. **Resume.** The same link reopens the open section with its remaining time. Opening the exam in a second tab or on another device takes the session over, and the old tab shows "continued elsewhere".

## 4. Integrity

- **No answers in the browser (critical).** Lesson scenes carry `correct`, `verdict`, `feedback` and `explain`. `order` items are stored in the correct order, and `match` scoring compares equal left and right ids. A pure function `toClientItem` therefore builds an allow-list view: only the prompt and the options, with opaque per-attempt ids. It shuffles `order` and `match` items on the server and keeps the id mapping in `client_map`. The lesson player cannot be reused as it is, because it receives whole scenes. The `hotspot`, `scenario`, `simulation` and `password` scenes stay out, because their answers are in the markup or they branch.
- **Grading on the server.** Answers are graded with `score()` from `scoring.ts`, which is private to that module today and gets exported as `scoreScene`. Correctness is stored with each answer and never sent to the browser before the learner finishes.
- **Server clock.** When a section starts, the server sets `deadline = now + minutes × (1 + extra/100)`, rounded up. The client only displays `deadline − serverNow`, which comes with the page, so a wrong device clock does not matter. `saveExamAnswerAction` checks the tenant, the owner and the session nonce, and refuses answers that arrive more than 5 seconds after the deadline. It is rate-limited with `rateLimit("exam-answer:<user>")`. An expired section is closed lazily on the next request, and an idempotent `closeExpiredExams` step in `runJobs` (ADR-012) closes the rest.
- **Concurrency.** A unique index on `(exam_id, user_id, number)` and a partial unique index on `(exam_id, user_id) where status = 'in_progress'` prevent duplicate attempts. Start and finish are each one status-changing statement with `returning`, as in `completeLessonAction`, so a double submit counts once. A stale `session_nonce` refuses writes from a tab that was taken over.
- **Signals, not verdicts.** The system records when the page is hidden (and for how long), takeovers, copy events, answers that come too fast (judged from `answered_at` gaps, with `minDwellMs` as the model) and sections that expire with nothing answered. Signals arrive in batches, at most 200 per attempt, and unknown kinds are refused. They never change the score, the pass or `recomputeRisk`. Admins see neutral counts, together with a note that screen readers, notifications and switching apps on a phone also cause them. A tenant setting turns signals off, for example where a German works council requires it.
- **Copy limits are deterrents only.** Item text cannot be selected or copied, and the exam is hidden when printed. Paste, right-click and assistive technology are never blocked.
- **No caching.** Exam routes are `no-store` and excluded from `public/sw.js`.

## 5. Privacy

- **No camera or photos.** Photo proctoring would need a lawful basis (employee consent is rarely "free" under GDPR, and the Azerbaijani Law on Personal Data applies), a DPIA, works-council co-determination in Germany, an alternative for people who decline, short-retention encrypted storage and a lawyer's sign-off. For a low-stakes awareness check it costs more trust than it buys.
- **Transparency.** The intro screen tells learners exactly what is recorded, and `/api/me/export` includes their attempts, answers and signals.
- **Retention.** In the `jobs.ts` purge, answers follow `retention.learningMonths`. Raw signals are deleted 90 days after the attempt closes, and the summary counts stay on the attempt. Both purges are added to the `retention.purged` meta. The Phase 5 user-deletion scrubs must cover every new table.

## 6. Data model (`0008_exams.sql`, additive)

Every table uses `tenantRef()`. Rows tied to a user are deleted with the user (cascade), as `answers` rows are.

- `exams`: id, tenant_id, title jsonb, description jsonb, status, pass_pct, max_attempts, opens_at, closes_at, certificate bool, created_by, created_at.
- `exam_sections`: id, exam_id → exams (cascade), position, title jsonb, topic, module_ids uuid[] (nullable), item_count, minutes; unique (exam_id, position).
- `exam_assignments`: id, tenant_id, exam_id, scope, department_id, user_id, created_by, created_at.
- `exam_accommodations`: (exam_id, user_id) PK, extra_pct, set_by, at.
- `exam_attempts`: id, tenant_id, exam_id → exams (no action), user_id, number, locale, seed, status (in_progress, submitted, expired or voided), extra_pct, section_index, section_deadline, sections jsonb (start, deadline and close time for each section), session_nonce, started_at, submitted_at, score, accuracy, pace, passed, topic_scores jsonb, flags jsonb. It has the two unique indexes above, an index on (tenant_id, exam_id), and a partial index on section_deadline where the status is in_progress, for the expiry job.
- `exam_attempt_items`: (attempt_id, item_key) PK, section_id, position, scene jsonb (the snapshot), client_map jsonb, picked jsonb, correct bool, answered_at. `item_key` is the lesson id, the scene id and the card or checkpoint id combined. The snapshot keeps resume, review and evidence stable if a lesson is edited later.
- `exam_signals`: id, attempt_id (cascade), kind, at, ms; index on attempt_id.
- `certificates.exam_id` → exams (no action), with a partial unique index on (user_id, exam_id), like the existing module and path indexes.
- There is no item table in v1. The pool is computed from the scored scenes of the published modules the tenant can see. A real `exam_items` table arrives with custom items in P7.
- `REPORT_KINDS` is a TypeScript enum with no CHECK constraint in the database, so adding `"exams"` needs no SQL.

## 7. Reports

- **Metrics.** Score = correct / total. Accuracy = correct / attempted (null, not NaN, when nothing was attempted). Pace = attempted / total. Passed = score ≥ pass mark. Topic results are grouped by `category` and labelled with `common.categories.*`, as in the weak-areas report. All of these are computed once at finish and stored on the attempt.
- **Admin view.** A results table per exam (person, department, best attempt, score, accuracy, pace, topics, signals, attempts), limited by `scopeDepartmentIds` for department heads. An attempt page with section cards, topic bars, a signals timeline and "show mistakes" (audited as `exam.mistakes_viewed`). Exam rows on the person page.
- **Learner view.** The result page plus a print view (`PrintButton`, ADR-006). When item-level mistakes appear is an owner decision (section 11).
- **Export.** Add `"exams"` to `REPORT_KINDS` and a `case "exams"` in `src/server/reports/build.ts`. The existing `/api/admin/reports/[kind]` route, `/print/report/[kind]` and `report_schedules` then provide CSV, XLSX, print and scheduled sends.
- **Certificate on pass.** `issueCertificate` gets an `examId` parameter (it takes only `moduleId` and `pathId` today). It keeps `evidence: "server_verified"` and the public `/c/[token]` page. Add a `DEFAULT_EXAM_CERTIFICATE_TEXT` in `tenant-defaults.ts`.
- **Audit.** Add these to `AUDIT_ACTIONS`, with labels in all ten `admin.json` files: `exam.created`, `exam.changed`, `exam.published`, `exam.archived`, `exam.assigned`, `exam.time_extended`, `exam.retake_granted`, `exam.attempt_voided`, `exam.mistakes_viewed`. Learner starts and answers are stored in the attempts, not in the audit log.

## 8. UX and accessibility

- **Timer.** Reuse `useCountdown` and `TimerPill` from `components/player/scenes.tsx` (both are private to that file today, so export them), fed with the remaining seconds from the server. The visible pill is not a live region. A separate `sr-only` polite live region announces 5 minutes, 1 minute and 30 seconds left. Under one minute the text changes too, so colour is not the only cue. Learners can hide the timer. Extra time is the accommodation WCAG 2.2.1 calls for.
- **Keyboard.** Reuse `ChoiceOptions` (radiogroup, roving tabindex, arrow keys follow the reading direction) and the order and match buttons. Focus moves to the item heading on each new item. There are no single-letter shortcuts.
- **Motion and languages.** Respect `data-motion`, with no mascot celebration and no timer pulse inside the exam. UI strings go in `learner.json` (`exam.*`) and `admin.json` (`exams.*`) for all ten languages, with parity checked by `tests/i18n.test.ts`. Use ICU messages for "{n} of {total}", `Intl.NumberFormat` for percentages and logical CSS properties. In ar the question map runs right to left.
- **375 px.** A sticky bottom action row using `--safe-bottom`, the question map in `drawer.tsx`, touch targets of at least 44 px, and matching by tapping.

## 9. Build packages (in order)

| # | Size | Content |
|---|---|---|
| P1 | S | Migration and schema; `exams` in `PLAN_FEATURES`; export `scoreScene`; pure pool extraction, seeded draw and `toClientItem` with unit tests. The security-critical part comes first |
| P2 | M | Admin builder (sections, pool size per language, publish and archive), audit actions, admin strings in 10 languages |
| P3 | M | Assignment, notifications, reminder step, `closeExpiredExams` job, extra time, retake grant, void |
| P4 | L | Learner session: list, intro, start/draw/snapshot, server deadline, autosave, resume and takeover, section submit, finish, signals, copy limits, service-worker exclusion; RTL, keyboard and 375 px checks. The largest package and the most likely to slip; if it does, match and order can move to a P4b |
| P5 | M | Result computation, learner result and print view, admin table and attempt page, `exams` report kind, certificate on pass, retention purge, personal export |
| P6 (later) | S | A fail assigns modules for weak topics via `targetTraining` (secops.ts); `exam.completed` webhook; optional organisation percentile (admins only, at least 20 attempts); optional risk input |
| P7 (later) | L | Custom exam items in Studio (`exam_items`) with AI drafting, approvals and translations; typed-answer and passage formats |

## 10. Tests (Vitest)

1. `exam-paper.test.ts`: the draw is the same for the same seed and different for different seeds; no duplicates; correct counts and topic mix; only items in the learner's locale. `JSON.stringify` of the client view must contain only allow-listed keys (no `correct`, `verdict`, `feedback` or `explain`), and match ids must be remapped.
2. `exam-scoring.test.ts`: score, accuracy and pace, including zero attempted; an exact multi-choice set is required; an unknown option id is refused; an answer after the deadline is refused, both inside and outside the grace period.
3. `exam-timing.test.ts`: the extra-time deadline rounds up; a resume returns the remaining time; an expired section closes; the next section's clock starts only when that section opens.
4. `exam-attempts.test.ts` (PGlite, like `assignment-since.test.ts`): two concurrent starts leave one active row; a double finish counts once; a stale nonce is refused; `max_attempts` holds; a granted retake is audited; another tenant's attempt is refused; a department head sees only their own people.
5. `exam-signals.test.ts`: the cap holds, unknown kinds are refused, and signals change neither the score nor the risk score.
6. `exam-report.test.ts`: `buildReport("exams")` headers and rows, the department filter and CSV safety.
7. The retention purge and `/api/me/export` include the exam data.

## 11. Owner decisions (recommended default in bold)

1. Audience: **the organisation's own signed-in staff only.** External candidates would bring anonymous access, personal data of non-employees and seat counting (ADR-051).
2. Item source: **reuse the lesson questions in v1.** They are already in ten languages, but learners have seen them with feedback. An exam-only bank comes later in Studio.
3. Plan: **professional**, next to `compliance_pack`. No per-attempt billing.
4. Dropped connection: **the clock keeps running inside the current section and stops between sections.** Admins can extend time.
5. Attempts: **1 per exam, and admins grant retakes.** When there are several attempts, **the best one counts**.
6. Mistakes review for learners: **after the availability window closes** (the alternatives are right after finishing, or never). Admins can always see them, and each view is audited.
7. Pass mark: **70% overall**, with no minimum per section.
8. Extra time: **25% or 50% per person per exam**, set by an admin before the start.
9. Integrity signals: **on, with a notice on the intro screen and a tenant switch to turn them off.**
10. Camera or photos: **not built.**
11. Percentile: **not in v1.** Later for admins only, with a minimum of 20 attempts.
12. Certificate on pass: **a per-exam toggle, off by default.** Passing does not mark modules as completed.
13. Exam results in the risk score: **not in v1.**
14. Signal retention: **90 days.** Answers follow `retention.learningMonths`.

## 12. Risks

- **Answer leak** if `toClientItem` is bypassed or a new scene field is not stripped. Mitigation: build P1 first and test against an allow-list, not a deny-list.
- **Pool exposure.** Items are visible with explanations in the lessons, so with small pools and retakes the exam measures memory more than understanding. The builder shows pool sizes, and per-person papers only differ when the pools are large.
- **Uneven pools by language.** Not every lesson exists in all ten locales. Check with `check-lesson-locales --coverage`.
- **False-positive signals** can lead to unfair HR action. The neutral wording and the rule that signals never change the score are load-bearing.
- **Monitoring law.** Even page-visibility logging can need a works-council agreement or a GDPR or Azerbaijani-law notice.
- **Timer fairness.** The job can close a section up to 60 seconds late. This is harmless only because saves are refused at the deadline.
- **Retention and deletion** must reach every new table, or personal results outlive the tenant's policy.
- **Scope.** One write per answer, and every string in ten locales including RTL. P4 is the package most likely to slip.

## 13. Checked in the code

- **Checked:** `score()` in `scoring.ts` is not exported (only `minDwellMs` and `scoreLesson` are). `targetsOf` and `departmentClosure` are exported. `REPORT_KINDS` is a TypeScript const used as `text("kind", { enum })`, with no CHECK in any migration. `useCountdown`, `TimerPill` and `ChoiceOptions` are private to `scenes.tsx`. `issueCertificate` accepts only `moduleId` and `pathId`. The certificate module and path FKs are NO ACTION, with partial unique indexes. `PLAN_FEATURES.professional` contains `compliance_pack`.
- **Not checked:** whether lesson option ids reveal correctness, how the `jobs.ts` reminder keys would take an exam, whether audit-label parity has its own test, and the real item counts per category and locale.
