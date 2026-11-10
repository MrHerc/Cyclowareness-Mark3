# Training pipeline: catalog, studio, paths, assignments, progress, risk, certificates

Reference for everything *around* the lessons in the Cyclowareness portal (`portal/`). The lesson
player and the scene DSL are documented in `references/lesson-engine.md`; this file only says how a
lesson gets into the database, who has to take it, what happens when it is finished, and what the
admin and learner surfaces around it look like. All paths below are relative to the repo root
unless they start with `src/`, `content/`, `scripts/`, `tests/` or `messages/`, which live under
`portal/`. Anything not confirmed in code or spec is marked "(verify)".

## Table of contents

1. [What the original did](#1-what-the-original-did)
2. [Catalog and content pipeline](#2-catalog-and-content-pipeline)
3. [Studio, materials and approvals](#3-studio-materials-and-approvals)
4. [Paths, assignments and reminders](#4-paths-assignments-and-reminders)
5. [Progress, gamification and risk](#5-progress-gamification-and-risk)
6. [Learner surfaces](#6-learner-surfaces)
7. [Conventions and gotchas](#7-conventions-and-gotchas)
8. [Recipes](#8-recipes)
9. [Gaps vs the original](#9-gaps-vs-the-original)

---

## 1. What the original did

Source: `docs/audit/` (read-only, never edit; ADR-016 in `docs/build/DECISIONS.md`).

### Catalog and taxonomy (`docs/audit/04-training-catalog.md`, `docs/audit/data/modules.json`)

- 53 modules, 106 lessons, 319 minutes, 11 630 XP in total. Module texts captured in EN; the
  tenant had AZ (default), EN, RU active.
- `/learn` page: title `Learn` + `51 modules` (count follows the audience filter), search
  (`Search a topic...`, aria `Search modules`), view segment `My path | Catalog`, audience segment
  `Everyone | Leaders | IT`, category chips `All, Email, Accounts, Social engineering, Devices,
  AI threats, Physical security, Data, Workplace, Incidents`.
- Card: icon square (brand-50), title, subtitle, status pill (`For you` / `66% complete` /
  `0% complete`), meta `9 min`, `3 lessons`, `300 XP` (orange), chevron. `My path` order:
  "For you" (by department) → in progress → rest; `Catalog` order = the audit table order.
- Taxonomy counts: Social engineering 10, Devices 10, Accounts 8, Workplace 7, Email 5, Data 5,
  AI threats 3, Physical security 3, Incidents 2. Difficulty: Medium 29, Easy 21, Hard 3.
  Audiences: Everyone 51; Leaders 8 (`executive-threats` leaders-only); IT 4 (`it-admin-risks`
  IT-only). The audit table lists slug, lessons, minutes, XP, difficulty and lesson ids per module.
- Module page `/learn/[slug]`: `‹ Catalog` back link, category pill, H1, subtitle; left `Lessons`
  list (number circle, green check when done, orange circle + frame on the current one, `3 min`,
  `Completed`); right sticky card with illustration, four stat tiles (`Minutes`, `Lessons`, `XP`,
  `Difficulty`), orange progress bar + %, `▶ Continue` / `Start`, `↻ Start module over`,
  `Certificate` block "Finish the module to earn your certificate."
  Screenshots: `docs/audit/screens/learner-learn-catalog.jpg`, `learner-module-detail.jpg`.

### Home, Progress, policy reader, gamification (`docs/audit/02-learner-app.md` §2, §6, §8, §9)

- Home: greeting + mascot; **policies block** when unsigned policies exist (`2 policies to sign`,
  rows link to `/policies/{id}?from=%2F`); **Continue hero** (module name, meta, white progress
  bar + `66%`, orange `Continue ›`); league row (`Place 4 of 5`, `6 points to the next place`);
  right column `Daily goal` ring (`0 / 50 XP`), `Streak`, `Total XP` + `Level 2`, `Risk score`;
  **Your path** vertical timeline (`0 of 51 done`, current node orange, `⌄ Show all (51)`).
- Progress (`learner-progress.jpg`): level ring (`50% to next level`), XP / Streak / Risk cards
  (`Low risk. Lower is better.`), `Modules` + `0 of 53 completed` with started modules.
- Policy reader: `Version 1` pill + `Published 03.10.2026`, numbered sections (40rem reading
  width), `Your signature` block: checkbox "I have read this policy, I understand it and I will
  follow it.", account password, sign button; date/time/version recorded; a new version must be
  signed again.
- Gamification rules (observed): module XP split across its lessons; daily goal 50 XP; level
  progress 0.5 at 175 XP = level 2; streak and `streakFreezes`; `riskScore` 0–100 (lower is better,
  bands 0–33 Low, 34–66 Medium, 67–100 High); automatic refresher threshold default 67; monthly
  department league, points = 60 % completion + 40 % phishing reporting; +5 XP per report
  (`report_bonus`); certificate issued when module + attestation are done, text per tenant with
  `{name}`, `{module}`, `{date}`.

### Admin (`docs/audit/03-admin-panel.md` §3, §5, §7, §8, §11)

- Assignments: `4 assignments`, `+ Assign module`; row = icon, name, `🌐 Everyone`, `📅 No due
  date`, `9 of 34 completed` + bar + `26%`, `✎ Edit due date`, `🗑 Remove`. Dialog "Assign a
  module": `Module` (search + radio list), `Who`: `Everyone | Department | Person`, `Due date`:
  `Fixed date | After joining`. (`admin-assignments.jpg`)
- Policies: tabs `Active | Archived | All`; `Version 1`, `Published …`, `1 of 34 signed`; policy
  page tabs `Versions | Sign-offs`, "A new version asks everyone to sign again." (`admin-policies.jpg`)
- Reports: `Completion`, `Risk`, `People`, `Modules`, `Module feedback`, `Confirmations` (who
  confirmed which module, when, language, text), `Compliance pack` (PDF); scheduled reports
  "Sent by email on the chosen day at 08:00, Baku time." League page: `16 days left`, full screen.
- Settings → Confirmation text (`attestation`): per-language textarea (`69 / 600`), default AZ
  "Bu modulu özüm keçdim, qaydaları başa düşdüm və onlara əməl edəcəyəm.", default EN "I went
  through this module myself, I understand the rules and I will follow them."
- Settings → Certificate: `Title`, `Text` (400 chars, placeholders), `Signer name`, `Signer
  title`, `Public verification link` switch; preview with serial `DEMO-2026-000123` and
  `cylosof.com/c/…`. (`admin-settings-certificate.jpg`)
- Settings → Learning: `Time limits on questions` switch, `Automatic refresher lesson` switch +
  `Risk threshold` slider 50–90 (default 67). (`admin-settings-learning.jpg`)
- Feature flags seen on `/api/me.features` (`docs/audit/00-overview.md`): `time_limits`,
  `teachable_moment`, `league`, `report_bonus`, `certificates`, `custom_attestation_text`,
  `custom_certificate`, `spaced_review`, `nudges`, `compliance_pack`, `policies`, … (the rebuild
  uses its own plan-based list, see §3).

---

## 2. Catalog and content pipeline

### 2.1 Files on disk (`content/library/`)

| File | Shape | Consumer |
|---|---|---|
| `modules.json` | array of `ModuleFile` (below) | `syncLibrary` |
| `lessons/<slug>/<lessonId>.en.json` | `{ id, title, minutes, scenes[] }`, validated by `lessonFileSchema` | `syncLibrary` |
| `lessons/<slug>/<lessonId>.<locale>.json` (az ru tr ro ka uk de fr ar) | the same lesson translated; must keep the English structure (`localeParityErrors`, lesson-engine.md §5); all 106 lessons have all nine (954 files) | `syncLibrary` (`readLibraryLesson`) |
| `i18n.<locale>.json` (the same nine) | `{ modules: { [slug]: [title, subtitle] }, lessons: { "slug/lessonId": title } }` | `syncLibrary` (titles only) |
| `paths.json` | array of `PathFile` (below) | `syncPaths` |
| `brands.json` | `{ [id]: { id, name, kind, color, glyph, monogram?, fake?, imitates? } }` | read at request time by the player (see lesson-engine.md) |

`modules.json` entry (exact keys; `category` is the *display label*, `audience` is lowercase):

```json
{
  "slug": "phishing-email",
  "category": "Email",
  "audience": ["everyone"],
  "title": "Phishing emails",
  "subtitle": "Spot a fake email at first glance",
  "minutes": 9,
  "lessonCount": 3,
  "xp": 300,
  "difficulty": "Easy",
  "lessons": [
    { "id": "spot-the-phish", "title": "Spot the phish", "minutes": 3 },
    { "id": "links-attachments", "title": "Links and attachments", "minutes": 3 },
    { "id": "ceo-fraud", "title": "The fake director", "minutes": 3 }
  ]
}
```

`paths.json` entry (five global paths: `core`, `new-hire`, `finance-bec`, `technical`, `leaders`; texts in
all ten UI languages, shortened here to three):

```json
{
  "key": "core",
  "mandatory": true,
  "title": { "az": "…", "en": "Cyber security essentials", "ru": "…" },
  "description": { "az": "…", "en": "…", "ru": "…" },
  "audience": { "az": "…", "en": "All employees", "ru": "…" },
  "recurrence": { "az": "…", "en": "Every year", "ru": "…" },
  "standards": ["ISO/IEC 27001:2022 A.6.3", "NIST CSF 2.0 PR.AT-01", "CIS Control 14"],
  "modules": ["phishing-email", "passwords-mfa", "social-engineering", "safe-browsing", "personal-data", "incident-reporting"],
  "labs": ["inbox-triage", "phishing-anatomy", "password-forge", "mfa-fatigue", "link-detective", "fake-signin"]
}
```

Types: `ModuleFile` in `src/lib/content/types.ts`; the scene union, `lessonFileSchema` and
`lessonIntegrityErrors` (scenario/simulation `next` targets, choice has a correct option,
hotspot `minToFind <= spots`) in `src/lib/content/validate.ts`. Category labels map to stable keys
through `CATEGORY_FROM_LABEL` in `src/lib/domain/catalog.ts` (`Email → email`, `Accounts →
accounts`, `Social engineering → social`, `Devices → devices`, `AI threats → ai`, `Physical
security → physical`, `Data → data`, `Workplace → work`, `Incidents → incident`); `AUDIENCES =
["everyone", "leaders", "it"]`; `CATEGORY_TOPIC` gives the mascot topic.

### 2.2 Sync flow (`src/server/services/library.ts`)

`syncLibrary(db)` and `syncPaths(db)` are the only writers of library content. They are called by:

| Entry point | When | Notes |
|---|---|---|
| `npm run content:sync` → `scripts/sync-content.ts` | after editing `content/library` | PostgreSQL: one transaction under `pg_advisory_xact_lock(CONTENT_SYNC_LOCK_KEY = 7_281_940)`. PGlite: plain run; **stop `next dev` first** |
| `npm run db:seed` → `scripts/seed.ts` | fresh local demo | **TRUNCATEs every table** first; refuses when `DATABASE_URL` or `NODE_ENV=production` is set unless `ALLOW_SEED=1`; demo password `SEED_PASSWORD` |
| `npm run db:reset` | local | deletes `.data/pg`, then `db:migrate` + `db:seed` |
| `src/server/bootstrap.ts` via `src/instrumentation.ts` | every **production** server start (`NODE_ENV=production` only) | same lock; a failed import exits the process |

What `syncLibrary` does per module, in `modules.json` order:

```ts
const values = { slug: m.slug, category, audiences: m.audience, title, subtitle,
  minutes: m.minutes, xp: m.xp, difficulty: m.difficulty,
  origin: "library" as const, status: "published" as const, sortOrder: order };
const [existing] = await db.select({ id: t.modules.id }).from(t.modules)
  .where(and(eq(t.modules.slug, m.slug), isNull(t.modules.tenantId)));
if (existing) await db.update(t.modules).set(values).where(eq(t.modules.id, existing.id));
else [{ id: moduleId }] = await db.insert(t.modules).values(values).returning({ id: t.modules.id });
// per lesson: readLibraryLesson(slug, id) → { en, translations: { az?, ru?, tr?, … } } (schema, integrity, parity);
// match (moduleId, key); update title/minutes/position or insert;
for (const locale of ["en", ...LESSON_TRANSLATIONS] as const) {          // LESSON_TRANSLATIONS = LOCALES without "en"
  const lesson = texts[locale];
  if (!lesson) { await db.delete(t.lessonContents).where(/* lessonId + locale */); continue; }   // file removed
  await db.insert(t.lessonContents)
    .values({ lessonId, locale, scenes: lesson.scenes })
    .onConflictDoUpdate({ target: [t.lessonContents.lessonId, t.lessonContents.locale],
                          set: { scenes: lesson.scenes, updatedAt: new Date() } });
}
// returns { modules, lessons, locales: { az, en, ru, tr, … } }, logged as "texts: az 106, en 106, ru 106, …, ar 106"
```

- Matching keys: global module = `(slug, tenant_id IS NULL)`; lesson = `(module_id, key)`;
  content = `(lesson_id, locale)`. Ids are stable across runs, so `lesson_progress`,
  `module_progress`, `assignments`, `attestations`, `certificates` keep pointing at the same rows.
- Titles: `{ en: m.title, az: i18n.az.modules[slug][0] ?? en, ru: …, … }` for every translation
  locale; lesson titles from `i18n.*.lessons["slug/id"]`.
- **No content hashes or revision numbers.** Every run rewrites `lesson_contents.scenes` for
  every language file present (bumping `updated_at`), deletes the row of a translation whose file is
  gone, and overwrites module `title/subtitle/xp/minutes/sort_order/status`. Idempotency is "same
  input → same rows". Readers pick a row with `pickLessonContent` (viewer's language, then `en`, then
  the only row of a single-language studio/AI-trainer lesson; lesson-engine.md §2.2).
- An unknown category label or an invalid lesson file (English, or a translation that breaks the
  parity rules) throws and aborts the import; `syncPaths` throws on unknown module slugs and unknown
  lab ids (`isLabId`), then upserts `(key, tenant_id IS NULL)` with `labIds: p.labs ?? []`.

`tests/content.test.ts` runs the same validation over the 106 English files, asserts 53/106 counts
(`.en.json` only), 14 multi-answer choice scenes, and titles in every translation locale for every module and lesson;
`tests/content-locales.test.ts` checks every translation present, and
`npx tsx scripts/check-lesson-locales.ts --coverage` also fails on a missing one. Run only those files:
`npx vitest run tests/content.test.ts tests/content-locales.test.ts` (from `portal/`).

### 2.3 Tables (`src/server/db/schema.ts`)

```ts
export const modules = pgTable("modules", {
  id, tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }), // null = global library
  slug: text("slug").notNull(), category: text("category").notNull(),
  audiences: jsonb("audiences").$type<string[]>().notNull(),
  title: jsonb("title").$type<Record<string, string>>().notNull(), subtitle: …,
  minutes: integer("minutes").notNull(), xp: integer("xp").notNull(),
  difficulty: text("difficulty", { enum: DIFFICULTY }).notNull(),            // Easy | Medium | Hard
  origin: text("origin", { enum: ["library", "custom", "ai"] }).notNull().default("library"),
  status: text("status", { enum: ["published", "draft"] }).notNull().default("published"),
  sortOrder: integer("sort_order").notNull().default(0), createdBy, createdAt,
}, (t) => [unique("modules_slug_tenant_idx").on(t.slug, t.tenantId).nullsNotDistinct()]);
```

- `lessons`: `id, module_id (cascade), key, title jsonb, minutes, position`; unique
  `lessons_module_key_idx (module_id, key)`.
- `lesson_contents`: PK `(lesson_id, locale)`, `scenes jsonb`, `updated_at`.
- `learning_paths`: `id, tenant_id (null = global), key, title/description/audience/recurrence
  jsonb, mandatory, standards jsonb, module_slugs jsonb, lab_ids jsonb (default `[]`, since 2026-10-27),
  created_at`; unique
  `learning_paths_key_tenant_idx (key, tenant_id) NULLS NOT DISTINCT`. Paths reference modules
  **by slug**, not id, so a tenant copy of a module slides into a path automatically.
- Both `NULLS NOT DISTINCT` constraints are in `drizzle/0000_init.sql` (lines ~232 and ~360).

### 2.4 How a lesson becomes visible to a tenant

`getCatalog(v, locale, drafts)` in `src/server/queries/catalog.ts` (React `cache`d per request):

```ts
.where(or(
  and(or(isNull(t.modules.tenantId), eq(t.modules.tenantId, v.tenant.id)), eq(t.modules.status, "published")),
  drafts ? and(eq(t.modules.tenantId, v.tenant.id), eq(t.modules.status, "draft")) : undefined,
)).orderBy(asc(t.modules.sortOrder))
// A tenant's own module with the same slug replaces the library one.
for (const m of mods) if (!bySlug.has(m.slug) || m.tenantId) bySlug.set(m.slug, m);
```

So: global `published` modules are visible to every tenant; a tenant's own `published` module
wins over a global one with the same slug; `draft` modules are visible only when `drafts = true`,
which `moduleForPage` (`src/app/(learner)/learn/[slug]/module.ts`) passes for viewers with
`studio.write`. The same override rule is duplicated in `moduleIdsBySlug`
(`src/server/services/assignments.ts`), `moduleBySlug` (`src/server/actions/learning.ts`),
`src/app/api/tutor/route.ts` and the refresher fallback in `src/server/jobs.ts`. The player route
`src/app/(focus)/learn/[slug]/[lessonId]/page.tsx` reads `lesson_contents` for the locale (see
lesson-engine.md). `audiences` are lower-cased on read because older studio rows stored
`"Everyone"`.

---

## 3. Studio, materials and approvals

### 3.1 Gates

- Permissions (`src/server/auth/permissions.ts`): `studio.write` → `content_creator, analyst,
  tenant_admin, super_admin`; `approvals.decide` → `analyst, tenant_admin, super_admin`;
  `paths.write` → `content_creator, tenant_admin, super_admin`; `assignments.write` →
  `content_creator, tenant_admin, super_admin`; `assignments.read` adds `department_head`;
  `policies.read/write` → `content_creator, tenant_admin, super_admin`; `settings.write` →
  `tenant_admin, super_admin`.
- Features (`PLAN_FEATURES` in `src/lib/tenant-defaults.ts`): `essentials` = `learning, league,
  certificates, policies, campaigns, reports, lab, paths, support, feedback, live_sessions`;
  `professional` adds `ai_tutor, tutor_voice, …, compliance_pack, studio`; `enterprise_hrm` adds
  `closed_loops, approvals, threat_intel, policy_intel, leadership, ops_center`. Per-tenant
  overrides live in `tenants.features` jsonb; `featuresFor(plan, overrides)` resolves them.
  Pages call `requirePermission(...)` then `hasFeature(v, "studio")` / `"approvals"` / `"paths"`
  and `notFound()` otherwise.

### 3.2 Studio page (`src/app/(admin)/admin/studio/page.tsx`)

Tabs `lessons | materials` (`?tab=`). The lessons tab lists the tenant's own modules
(`tenantId = tenant, origin != "library"`), newest first, with origin pill (`custom` brand /
`ai` violet), status pill, and `ModuleRowActions` (publish/unpublish, preview, delete). The
header shows `StudioLessonForm` and, with feature `approvals`, `MaterialForm`
(`src/components/secops/studio.tsx`).

**What an author can create with the form**: exactly one micro-lesson per module (the AI trainer,
§3.3, drafts up to three), written in one language, with the fixed scene sequence
`intro → tutor (beats) → [swipe] → [hotspot] → choice (one correct) → recap`. Form fields
(i18n `secops.studio.form.*`): `aiTopic`, `language`, `category`, `difficulty`, `minutes`
(1–30), `title`, `subtitle`, `intro`, `points` (one per line, 2–8), optional `swipe` (prompt +
SMS cards `from/text/verdict/explain`, at least one `threat`), optional `hotspot` (prompt, e-mail
`from/subject/body` + targets `text/label/explain`, each target's text found on one line of the
body without overlapping another: `markTargets` in `src/lib/content/studio.ts`, the same check in
the form and on the server), `question` + `options` (2–4, radio for the correct one, per-option
`feedback`), `recap` (2–5 lines). `studioScenes(draft)` (`src/lib/content/studio.ts`) builds the
scenes; `studioDraft(scenes, subtitle)` reads them back for the form.

**Scene ids are fixed** (`intro`, `steps`, `swipe`, `hotspot`, `check`, `recap`; items `b1…`,
`c1…`, `s1…`, `o1…` by position), so an edited lesson keeps the ids its `answers` and progress rows
point to.

**Editing**: a one-lesson module the form wrote (its source scenes read back with `studioDraft`)
gets an Edit button in the Studio list that prefills the form. `updateStudioLessonAction(id, input)`
(`ownModule()` + `studioScenes`) rewrites modules/lessons title, subtitle and settings, deletes
every `lesson_contents` row and inserts the source row again, audits `module.updated`; a published
module stays published and is translated again at once. AI-trainer modules (other scene ids) are
refused. Library modules are not editable from the UI. Other rich scene types (simulation, …) are
only authorable as JSON files in `content/library`, or arrive through an AI-trainer draft (§3.3).

**Translations on publish**: `setModuleStatusAction(id, "published")` (and an edit of a published
module) runs `translateModule`: for every language in `settings.locales` a lesson has no row in, it
calls `translateScenes()` (`src/server/ai.ts`: one streamed tool-use call per language and lesson,
`validTranslation` + `localeParityErrors`, outer whitespace of every span kept from the source,
2-minute timeout) and inserts the row, and merges the translated module title/subtitle and
`lessons.title`. The **source language is the lesson's oldest `lesson_contents` row** (every writer
inserts the source before any translation; an edit deletes and reinserts it), never the keys of
`lessons.title`. Gated on `aiEnabled()` and a per-organisation daily cap
(`ai-translate-day:t:<tenant>`, 200); without a key the module publishes in its source language and
the toast says so (`secops.studio.sourceOnly`); failed languages are listed (`untranslated`). The
call runs inside the server action (no job queue); the UI shows `secops.studio.translating` meanwhile.

`saveStudioLessonAction` (`src/server/actions/secops.ts`):

```ts
const slug = `own-${slugify(d.title)}-${Date.now().toString(36).slice(-4)}`;
await db().insert(t.modules).values({ tenantId: v.tenant.id, slug, category: d.category,
  audiences: [AUDIENCES[0]], title: label, subtitle: { [d.locale]: d.subtitle }, minutes: d.minutes,
  xp: 40 + d.minutes * 5, difficulty: d.difficulty, origin: d.ai ? "ai" : "custom",
  status: "draft", sortOrder: 1000, createdBy: v.user.id });
await db().insert(t.lessons).values({ moduleId: mod.id, key: "lesson-1", title: label, minutes: d.minutes, position: 1 });
const scenes = studioScenes(d); // null (→ "invalid") unless one correct option, a threat card, every target placed
await db().insert(t.lessonContents).values({ lessonId: lesson.id, locale: d.locale, scenes });
await audit(db(), { …, action: "module.created", targetType: "module", targetId: mod.id, meta: { title, origin } });
```

Always saved as `status: "draft"`; XP = `40 + minutes × 5`; audience always `everyone`; preview
link `/learn/<slug>/lesson-1` works for `studio.write` viewers (drafts are included in their
catalog and the tutor API). Publishing audits `module.published` (meta carries `translated` /
`untranslated` / `offline`). Deleting is refused with
`error: "in_use"` when any `certificates`, `attestations`, `module_progress`, open
`behavior_risks` or `incidents.training_module_id` reference the module ("unpublish instead");
`modules.id` cascades to `lessons`/`lesson_contents` and `assignments.module_id` (cascade) but is
`NO ACTION` from `attestations`/`certificates` (compliance evidence).

### 3.3 AI drafting (`src/server/ai.ts`)

- `aiEnabled()` = `!!env.ANTHROPIC_API_KEY`; model `env.ANTHROPIC_MODEL` (default
  `"claude-opus-5-5"`, `src/server/env.ts`; OPEN-QUESTIONS item 1 mentions
  `claude-haiku-5-5` as the cheaper option). The tutor does not use it: it has its own
  `ANTHROPIC_TUTOR_MODEL` (default `"claude-haiku-5-5"`, lesson-engine.md, Model).
- `draftLesson(topic, locale)` calls `client.messages.create` with the tool `save_lesson_draft`
  (`tool_choice: { type: "auto" }`: a forced tool is rejected while thinking is on, so the system
  prompt asks for the tool and no `tool_use` block means no draft), `max_tokens: 4000`, a system prompt
  that forbids real PII/live links and demands exactly one correct option; output is validated by
  `lessonDraftSchema` (zod) and rejected when the correct-option count ≠ 1. Language from
  `TUTOR_LANGUAGE[locale]` plus `languageStyle(locale)` (`src/server/tutor.ts`: the portal's terms,
  form of address and quotes per language).
- `draftLessonAction(topic, locale)` (`src/server/actions/secops.ts`): permission `studio.write`,
  topic ≥ 5 chars (else `"failed"`), rate limit `ai-draft:<userId>` 20/hour (`"rateLimited"`),
  unknown locale falls back to the tenant `defaultLocale`; returns `error: "offline"` when no key
  (UI shows `secops.studio.form.aiOffline`), `"failed"` otherwise. The draft only fills the form;
  saving still goes through `saveStudioLessonAction` with `ai: true` → `origin: "ai"`.
  ADR-008: AI output is always a draft and never reaches learners without a human publishing it.

**AI trainer** (the `<AiTrainer>` section mounted on the Studio page,
`src/components/admin/ai-trainer/ai-trainer.tsx`, i18n `secops.aiTrainer.*`; actions in
`src/server/actions/ai-training.ts`, verification in `src/server/ai-verify.ts`). Form: prompt
(10–4000 chars), language (`TRAINING_LOCALES = ["az", "en", "ru"]` filtered by the tenant's stored
`settings.locales`), category, difficulty, minutes (2–45), lessons (1–3). Two paths, both
`studio.write`:

- `generateTrainingAction` (needs `ANTHROPIC_API_KEY`, else `error: "offline"`; rate limit
  `ai-training:<userId>` 10/hour): `generateVerified()` asks the model (`generateTraining` in
  `src/server/ai.ts`, "Write a training in `TUTOR_LANGUAGE[locale]`") for
  `{ title, subtitle, lessons }` and runs `verifyDraft()`: step 1 `schema` (`trainingDraftSchema`:
  1–3 lessons, each a full `lessonFileSchema` lesson, so any scene type), step 2 `safety`
  (`safetyIssues`), step 3 `review` (a second model call whose findings are written in the Studio
  user's UI language). On blocking issues it regenerates once with them as feedback; the verdict is
  `verified` or `needs_review`.
- `libraryTrainingAction` (no key needed; rate limit `ai-library:<userId>` 60/hour): `matchLibrary()`
  picks the global library module whose title and subtitle (chosen language and English) share the
  most word stems with the prompt (a category match adds a little; `noMatch` otherwise), takes its
  first N lessons and one content language for all of them with `sharedContentLocale` (the chosen
  one when every picked lesson has it, else `en`). Lesson and module titles and the subtitle come from
  that language too; only the source label (`source.title`) uses the chosen one. Steps 1–2 run, step
  3 is skipped. The trainer then shows `secops.aiTrainer.contentLanguage`.
- `saveTrainingDraftAction({ draft, contentLocale, category, difficulty, origin, verdict })` re-checks
  the draft (`schemaCheck`) and inserts a tenant module: `status: "draft"`, slug `ai-…` with
  `origin: "ai"` for AI output or `own-…` with `origin: "custom"` for a library copy, minutes = the
  lessons' sum clamped to 1–60, `xp = 40 + minutes × 5`; lessons `lesson-1…n` at positions 1…n with
  titles `{ [contentLocale]: … }`, and one `lesson_contents` row per lesson in `contentLocale` (the
  request language on the AI path, `source.contentLocale` on the library path). It audits
  `module.created` with `source`, `verdict` (forced to `needs_review` when safety fails) and
  `lessons`. Publishing stays a human step in the Studio list (ADR-008).

### 3.4 Materials and the approval gate

`materials` (`src/server/db/schema.ts`): `id, tenant_id, title, body, origin ∈ ai | template |
analyst, status ∈ MATERIAL_STATUS = pending | second_approval | approved | rejected,
requires_two, source_ref, loop_id, module_id (set null), target_user_ids jsonb, created_by,
created_at`. `material_decisions`: `id, material_id (cascade), actor_id, decision ∈ approve |
reject | edit, reason, at`.

Creation paths:
- `createMaterialAction` (studio `MaterialForm`: `title`, `body`, `module`, `audience`
  department, `requiresTwo`) → `origin: "analyst"`, targets = `audienceUserIds(v, departmentId)`;
  audit `material.created`.
- `convertThreatIntelAction` (`/admin/intel`) → `origin: "template"`, `sourceRef: INT-…`, linked
  loop at stage `approval`.
- `origin: "ai"` rows exist only in the seed (`scripts/seed.ts`); no code under `src/server`
  inserts one (grep-confirmed: only the two inserts above write `materials`).

Decision state machine, `decideMaterialAction(id, "approve" | "reject", reason?)`
(`src/server/actions/secops.ts`, permission `approvals.decide`):

```
pending ──reject(reason required)──▶ rejected            audit material.rejected
pending ──approve, requiresTwo──────▶ second_approval     audit material.approved {step:1}
second_approval ──approve by a DIFFERENT actor──▶ approved   (same actor → error "sameApprover")
pending ──approve, !requiresTwo─────▶ approved            audit material.approved
approved + moduleId + targets ──▶ targetTraining(...)     behaviour risks + notifications
approved + loopId ──▶ advanceLoop(to: "training"), loops.trained_count += count
```

`editMaterialAction` (same permission) rewrites title/body while pending/second_approval and
records a decision row `edit` (audit `material.edited`). The approvals page
`src/app/(admin)/admin/approvals/page.tsx` has tabs `pending | second | decided` and renders
`MaterialDecision` from `src/components/secops/intake.tsx`.

`targetTraining` (`src/server/services/secops.ts`) is the shared "give these people this
module" primitive used by approvals, incidents and the refresher job: it skips people who already
have an open risk with the same `sourceRef` or completed the module, inserts one `behavior_risks`
row per person (`kind`, `severity`, `title`: given as a function of the locale it is stored in every UI
language as JSON text, `encodeRiskTitle` in `src/lib/risk-title.ts`, read back with
`riskTitle(stored, locale)`; `module_id`, `due_date` default +7 days),
sends `notifyUsers(..., "assignment", ...)` deferred, and `recomputeRisk`. Approval uses
`kind: sourceRef.startsWith("POL-") ? "policy" : "incident"`, severity from the linked `IR-n`
incident else `medium`, `sourceRef ?? MAT-<id8>`.

### 3.5 Policies as versioned training material

Tables: `policies (id, tenant_id, title, archived_at, created_by, created_at)`,
`policy_versions (id, policy_id, version, title, summary, body_md, translations jsonb
{ [locale]: { title, summary?, bodyMd, base? } }, published_at, created_at)`,
`policy_signoffs (id, version_id, user_id, ip, signed_at)` unique `(version_id, user_id)`.
The `title/summary/body_md` columns hold the base text, written in the tenant's default language;
since the per-language editor a copy of it marked `base: true` sits in `translations` under that
language and records it (no extra column). `src/lib/policy-text.ts`: `policyBaseLocale(translations,
fallback)` (the `base` entry, else the tenant default, for older versions) and
`policyTextFor(version, locale, fallbackBase)` (the reader's language when the version has it, else
the base text, plus the language shown).

Actions in `src/server/actions/workspace.ts`: `createPolicyAction(title)` (audit
`policy.created`), `publishVersionAction({ policyId, title, summary?, bodyMd, translations? })` →
next `version = max + 1`, `publishedAt = now`, `translations` = the `base: true` copy plus each other
`LOCALES` language whose body is filled (under 20 characters refuses; an empty title takes the base
title), an in-app notification for every active user in their language (that translation's title,
`admin.policies.notifyBody`; kind `policy`, href `/policies/<id>?from=%2F`) (audit `policy.version_published`), `archivePolicyAction(id, archived)` (audit `policy.archived` /
`policy.restored`), `remindPolicyAction(versionId)` → `notifyUsers(..., "policy_reminder", ...)`
using `FIXED_MESSAGES.policy_reminder`, with the policy title in each person's language (audit
`policy.reminder`). Admin UI: `src/app/(admin)/admin/policies/(index)/page.tsx`, `policies/[id]/page.tsx` (`VersionEditor`,
`PolicyHeaderActions` from `src/components/admin/policy-client.tsx`), sign-off CSV at
`src/app/api/admin/policies/[id]/signoffs/route.ts`. `VersionEditor` gets the `base` language and,
in a collapsible "Translations (optional)" section, one fieldset per other language the tenant has
switched on (`settings.locales`), prefilled from the current version; a language left empty shows its
readers the base text with a notice. The base text is the tenant's default language (AZ in the demo); seed
policies come from `content/policies/acceptable-use.{locale}.md` and `passwords.{locale}.md`, ten languages each
(`scripts/seed.ts`: az is the base, the others are translations, each only when its file exists;
seed versions carry no `base` copy, so `policyBaseLocale` falls back to the tenant default).
`acceptable-use.az.md`, `acceptable-use.ru.md` and `passwords.ru.md` are translations; a legal review
is recommended (OPEN-QUESTIONS 9).
`convertPolicyIntelAction` creates an empty policy from a policy-intel item.

### 3.6 Audit events touching training

`assignment.created`, `assignment.due_changed`, `assignment.removed`, `path.created`,
`path.changed` (also `{deleted: true}`), `module.created`, `module.published`, `module.deleted`,
`material.created`, `material.edited`, `material.approved`, `material.rejected`,
`policy.created`, `policy.version_published`, `policy.archived`, `policy.restored`,
`policy.signed`, `policy.reminder`, `attestation.reminder` (`remindAwaitingAction` in
`src/server/actions/admin-overview.ts`, mail kind `confirmation_reminder`),
`settings.attestation`, `settings.certificate`, `settings.learning`. Labels: `admin.auditActions`
in `messages/*/admin.json`. Webhook/syslog event `attestation.completed` is emitted by
`attestModuleAction` (`WEBHOOK_EVENTS` in `src/lib/tenant-defaults.ts`).

---

## 4. Paths, assignments and reminders

### 4.1 Learning paths

- Global paths come from `paths.json` (§2). Tenant paths: `src/app/(admin)/admin/paths/page.tsx`
  with `PathEditor` (`src/components/secops/studio.tsx`): `title, description, audience,
  recurrence, standards` (comma list, max 12), `mandatory`, ordered module picker, then the practice
  labs (shown only when the tenant has the `lab` feature; a path keeps the labs it has).
  `savePathAction` (`paths.write`) stores texts under the tenant `defaultLocale` key only, key
  `own-<slug>-<base36>`, and keeps only slugs visible to the tenant. Library paths can be
  **duplicated** (`id: null`) but not edited; own paths are editable and deletable, except
  `deletePathAction` refuses (`in_use`) once a path certificate exists (NO ACTION FK).
- Learner side: `getPaths` (`src/server/queries/paths.ts`) joins each path's slugs onto the
  viewer's catalog, counts `done`, flags `assigned` (any assignment targets the path *and* the
  viewer is a target of one of its modules), attaches a path `certificateToken` and, with the `lab`
  feature, the path's `labs` (`PathLab`: `id, best, passed, unlocked, after`). Pages
  `src/app/(learner)/paths/(index)/page.tsx` and `paths/[key]/page.tsx` (feature `paths`), i18n
  `learner.paths.*`.
- **Labs after the lessons** (ADR-027, since 2026-10-27). `learning_paths.lab_ids` lists practice labs
  shown after the path's modules (lessons first, then practice). Rules in `src/lib/domain/labs.ts`
  (pure, `tests/paths.test.ts`, `tests/paths-query.test.ts`): `LAB_IDS` (the four games
  `inbox-triage, link-detective, password-forge, mfa-fatigue`, then the VM labs `phishing-anatomy,
  process-hunt, fake-signin`), `LAB_MODULES` (the modules each lab practises), `labWaitsFor(lab,
  pathSlugs, statusBySlug)`: the lab's own modules that are in the path, or every path module when it
  practises none of them, minus those whose lessons are done (`lessonsDone`: `awaiting_attestation` or
  `completed`); `labUnlocked` = nothing left. A lab counts as passed from `LAB_PASS = 0.7` of its
  maximum on the best attempt (`labBestShares`); a lab passed before its lessons is not shown locked.
  This is a display rule only: `/lab` stays a free practice area and no server path refuses a lab.
  Labs never count toward the path's `done`, its completion or its certificate (certificates still
  follow the modules only).
- Standards (`paths.json` `standards`, a tenant path's comma list) are stored once for every language
  as written (`NIS2 Art. 21(2)(g)`, `ISO/IEC 27001:2022 A.8.2`). The admin paths page and both learner
  path pages show them through `localizeStandard(ref, locale)` (`src/lib/standards.ts`,
  `tests/standards.test.ts`), which changes only `Art.` to «maddə» (az) or «ст.» (ru); identifiers
  and clause numbers never change (ADR-024).

### 4.2 Assignments data model

```ts
export const assignments = pgTable("assignments", {
  id, tenantId, moduleId: uuid("module_id").references(() => modules.id, { onDelete: "cascade" }),
  pathId: uuid("path_id").references(() => learningPaths.id, { onDelete: "cascade" }),
  scope: text("scope", { enum: ASSIGN_SCOPE }).notNull(),         // everyone | department | user
  departmentId, userId,
  dueKind: text("due_kind", { enum: ["none", "fixed", "after_joining"] }).notNull().default("none"),
  dueDate: date("due_date"), dueDays: integer("due_days"), reason: text("reason"), createdBy, createdAt,
});
```

Exactly one of `module_id` / `path_id` is set. `createAssignmentAction` (`src/server/actions/
workspace.ts`, `assignments.write`) validates `target ∈ module | path`, scope-specific ids belong
to the tenant, `dueDate` is a real calendar day (`parseDay`; `tests/due-date-actions.test.ts`
proves `2026-02-31` is refused before any query), `dueDays` 1–365, `reason` ≤ 300; then audits
`assignment.created`, notifies every target with template kind `assignment` (deferred) and
`recomputeRisk` for them. `updateDueAction` and `removeAssignmentAction` audit
`assignment.due_changed` / `assignment.removed` and recompute the whole tenant. UI:
`src/components/admin/assign-dialog.tsx` (`target`, searchable radio list, `scope`, department /
person select, `dueKind` with date or days input, `reason`),
`src/components/admin/assignment-row-actions.tsx`, page
`src/app/(admin)/admin/assignments/page.tsx` (i18n `admin.assignments.*`). Department heads see
only rows that reach their people and completion counts over their people only
(`scopeDepartmentIds` in `src/server/queries/admin.ts`).

### 4.3 Resolution (`src/server/services/assignments.ts`)

`resolveAssignments(db, tenantId, onlyUserIds?)` → `Map<userId, Map<moduleId, AssignedModule>>`:

- `targetsOf`: `everyone` → all non-deleted users; `user` → that id; `department` → the
  department **and its sub-departments** (`departmentClosure`).
- Path assignments expand to module ids through `moduleIdsBySlug` (tenant copy wins).
- `due` = `dueDate` for `fixed`; `addDays(personStart(u), dueDays)` (UTC date arithmetic) for
  `after_joining`, where `personStart` is the account's `createdAt` or its `activatedAt` when an
  invite was accepted later (`tests/assignment-since.test.ts`: "counts an 'after joining' due date
  from the activation, not the invite"); `null` otherwise. Several assignments for one module keep
  the **earliest** due.
- `assignedAt` = `assignedSince(a, u)` = latest of assignment `createdAt`, user `createdAt`,
  `activatedAt` (invite accepted) and, for department scope, `departmentChangedAt`. This is the
  start of the reminder clock. Tests: `tests/assignments.test.ts` (closure, targets, overlap,
  `assignedSince` cases) and `tests/assignment-since.test.ts` (PGlite end-to-end).
- `assignmentTargets` returns the audience per assignment for "9 of 34 completed".

### 4.4 Reminder, manager and refresher jobs (`src/server/jobs.ts`)

Runner: `src/server/jobs-runner.ts`, started from `src/instrumentation.ts` when
`JOBS_ENABLED=1` (default), first tick after 15 s then every 60 s, PostgreSQL session advisory lock
`LOCK_KEY = 7_281_939` so one replica runs; `npm run jobs` runs a separate worker. `runJobs` runs
per tenant `dailySnapshot`, `reminders`, `managerAlerts`, `refreshers`, `scheduledReports`
(ADR-012: every step idempotent).

`reminders(db, tenant, now)` with `settings.notifications` (defaults `firstReminderDays: 3`,
`urgentReminderHours: 24`, `overdueNotice: true`, `managerAlerts: true`, `failedSimulations: 2`,
`overdueDays: 7`):

```ts
/** End of a YYYY-MM-DD due day, Baku time. */
const dueEnd = (due: string) => new Date(`${due}T23:59:59+04:00`);
// pending = assigned modules not completed + open behaviour risks with a module (earlier due wins)
if (dueAt && now > dueAt) {
  if (n.overdueNotice && !since(dueAt).some((h) => h.kind === "overdue")) kind = "overdue";
} else if (dueAt && dueAt.getTime() - now.getTime() <= n.urgentReminderHours * HOUR) {
  if (!since(new Date(dueAt.getTime() - n.urgentReminderHours * HOUR)).some((h) => h.kind === "reminder")) kind = "reminder";
} else if (now.getTime() - p.since.getTime() >= n.firstReminderDays * DAY) {
  if (!since(p.since).some((h) => h.kind === "reminder")) kind = "reminder";
}
```

Dedupe is done against the `notifications` table (kinds `reminder | overdue | assignment`, href
`/learn/<slug>`, window ≤ 400 days), so running a tick twice sends nothing twice. Mail is queued
with `defer: true` and sent by the `mail` step. Templates: `TEMPLATE_KINDS = assignment |
reminder | overdue | manager | welcome` with per-language `DEFAULT_TEMPLATES`
(`{{name}}, {{module}}, {{dueDate}}, {{link}}`), overridable per tenant in
`settings.notifications.templates` (validated by `notificationsSchema`,
`tests/settings-schema.test.ts`). `managerAlerts` tells `departments.head_user_id` about people
with ≥ `failedSimulations` risky simulation actions in 30 days or training more than
`overdueDays` past `dueEnd`, at most weekly per person and reason. A manual "remind" exists in
`remindPeopleAction` (`src/server/actions/people.ts`).

`refreshers`: when `settings.learning.refresher` is on, every active user with `riskScore >=
riskThreshold` who has not had this month's `REFRESH-YYYY-MM` risk gets `targetTraining(kind:
"path", severity "medium", due +14 days)` for their next open assigned module (earliest due) or
the tenant/library `phishing-email` module, never a module they completed.

---

## 5. Progress, gamification and risk

### 5.1 Lesson and module completion (`src/server/services/progress.ts`)

Tables: `lesson_progress` PK `(user_id, lesson_id)`: `completed_at` (first completion),
`last_completed_at` (latest), `xp_awarded`, `attempts`, `seconds_spent`. `module_progress` PK
`(user_id, module_id)`: `status ∈ not_started | in_progress | awaiting_attestation | completed`,
`percent`, `last_lesson_key`, `started_at`, `completed_at`. `answers`: per scene/item
`correct`, `first_try`, `outcome ∈ safe | risky | compromised`, `category`. `xp_events`:
`amount, reason (lesson | report | lab | …), ref, at`.

`completeLessonAction` (`src/server/actions/learning.ts`) stores the answers, emits
`simulation.risky` when any outcome ≠ safe, calls `completeLesson`, then `recomputeRisk` for the
user and returns `{ xp, moduleStatus, nextKey }`. `completeLesson`:

```ts
const firstTime = !existing?.completedAt;
const xp = firstTime ? lessonXp(mod.xp, siblings.length, lesson.position) : 0;
// upsert lesson_progress: completedAt = coalesce(old, now), lastCompletedAt = greatest(old, now),
//                         xpAwarded += xp, attempts += 1, secondsSpent += seconds
if (xp > 0) await awardXp(db, { …, amount: xp, reason: "lesson", ref: lessonId, at });
const percent = Math.round((done / siblings.length) * 100);
const status = mp?.status === "completed" ? "completed" : percent >= 100 ? "awaiting_attestation" : "in_progress";
```

Retake rules: a repeated lesson earns **no XP**, increments `attempts`, and only moves
`last_completed_at`. A completed module stays `completed` (no second attestation). An open
`behavior_risks` row for that module closes once **every** lesson's `last_completed_at` is at or
after the risk's `created_at` (`lte(behaviorRisks.createdAt, min(lastCompletedAt))`), which is
how "train again after a phishing click" is proven. `touchModule` (from `startLessonAction`)
marks a module `in_progress` with `lastLessonKey` when a lesson is opened; the Home "Continue"
and the orange marker on the module page follow it. "Start module over" on the module page is
just a link to the first lesson; nothing is reset.

There is no pass mark for lessons: finishing the last scene completes the lesson. The only score
threshold in the pipeline is `incidents.min_score` (first-try accuracy from `moduleScores`),
which belongs to the SecOps incident flow.

### 5.2 XP, levels, streaks, badges (`src/lib/domain/gamification.ts`)

- `LEVEL_THRESHOLDS = [0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200, 4000, 5000, 6200,
  7600, 9200, 11000]`; `levelFor(175)` = level 2 at 50 % (matches the original).
- `lessonXp(moduleXp, lessonCount, position)`: `floor(xp / n)` per lesson, remainder to the last.
- `REPORT_BONUS_XP = 5`, `REPORT_BONUS_DAILY_CAP = 5`: enforced in
  `src/server/services/threats.ts` (`if (Number(n) < REPORT_BONUS_DAILY_CAP) awardXp(..., reason:
  "report", ref: "TR-<number>")`), constants pinned in `tests/domain.test.ts`.
  `LAB_XP = { "inbox-triage": 20, "link-detective": 15, "password-forge": 15, "mfa-fatigue": 15 }`.
- `dayKey(date, "Asia/Baku")`; `nextStreak` extends on consecutive Baku days, a single missed day
  spends one freeze (`frozen`), every `FREEZE_EVERY_DAYS = 7` consecutive days earn one, at most
  `MAX_STREAK_FREEZES = 2`; `liveStreak` shows 0 once the streak is actually broken. `awardXp`
  writes `xp_events`, bumps `users.xp`, `streak_current/longest/last_day/freezes`,
  `last_active_at`, and never moves a streak backwards when the seed replays history.
- Daily goal: `settings.learning.dailyGoalXp` (default 50) vs `todayXp` (`src/server/queries/
  learner.ts`, Baku day via `to_char(... at time zone 'Asia/Baku')`).
- Badges: `BADGES = first_step, module_master, sharp_eye (5 reports), streak_7, policy_keeper,
  lab_explorer (4 games), certified_5, path_finisher`; facts in `src/server/queries/badges.ts`.
- Tests: `tests/domain.test.ts` covers `levelFor`, `lessonXp`, XP constants, `dayKey`,
  `nextStreak` (with freezes), `liveStreak`, `earnedBadges`, league maths, catalog constants.

### 5.3 Attestation and certificates

`attestModule` (service) requires `module_progress.status = "awaiting_attestation"`, inserts
`attestations (tenant_id, user_id, module_id (NO ACTION), text, locale, at)` with the **verbatim
text shown**, sets the module `completed` (`completed_at`, `percent 100`), issues a module
certificate and closes every open risk linked to the module. `attestModuleAction` picks
`settings.attestationText[locale] ?? pick(DEFAULT_ATTESTATION, locale)`, emits `attestation.completed`,
then `issuePathCertificates` (one certificate per path whose every slug is now completed, never
twice) and `recomputeRisk`. Admin can nudge people stuck in `awaiting_attestation` with
`remindAwaitingAction` (`confirmation_reminder` fixed message).

`issueCertificate` writes `certificates (tenant_id, user_id, module_id | path_id, serial,
public_token, issued_at)`:

```ts
// Next serial of the organisation for the year: SLUG-2026-000042 (highest issued + 1, not row count)
// The year is that of the Baku day (as the certificate shows it), not the server's time zone.
const prefix = `${tenant.slug.toUpperCase()}-${dayKey(at).slice(0, 4)}-`;
return `${prefix}${String(Number(row?.n ?? 0) + 1).padStart(6, "0")}`;
// publicToken = randomToken(16) (base32, lower case); a unique-violation on serial retries up to 7 times
```

Rendering: `src/app/(public)/c/[token]/page.tsx` — public route, `robots: noindex`, token regex
`^[a-z2-7]{10,40}$`; hidden (`notFound`) when `settings.certificate.publicLink` is off unless the
viewer is the owner or a non-learner of the same tenant. It applies the tenant brand
(`brandStyle`), logo, `certificate.title[locale]` (fallback `learner.certificate.title`), the text
template `certificate.text[locale]` (fallback `DEFAULT_CERTIFICATE_TEXT`, or
`DEFAULT_PATH_CERTIFICATE_TEXT` for a path, in that language) with `{name}`, `{module}` (module or
path title in the viewer's locale) and `{date}` (`dateStyle: "long"`), serial, verify URL, optional `signerName`/`signerTitle`, and a browser
`PrintButton` (ADR-006: no server-side PDF). Links appear on the module page
(`CertificateLink` → `/c/<token>`), the path page, `src/app/(learner)/profile/page.tsx`
("My certificates"), and the admin person page counts them. Settings:
`src/components/admin/settings-tabs.tsx` `CertificateTab` → `saveCertificateAction`
(`certSchema`: `title ≤ 60` and `text ≤ 400` per language of `LOCALES`, only filled languages
stored; `signerName/Title ≤ 120`, `publicLink`; the tab switches between the tenant's
`settings.locales`), audit
`settings.certificate`; `AttestationTab` → `saveAttestationAction(locale, text)` per language.
The original's 600-character limit is enforced on both sides: `<Textarea maxLength={600}>` +
`{value.length} / 600` counter in the tab, and `saveAttestationAction` refuses (`field: "text"`)
a text shorter than 10 characters after trimming or longer than 600, or an unknown locale.

### 5.4 Risk score (`src/lib/domain/risk.ts`, `src/server/services/risk.ts`)

```ts
const training    = i.assignedCompletion === null ? 8 : Math.round((1 - i.assignedCompletion) * 30);
const overdue     = Math.min(i.overdueAssignments * 5, 10);
const simulations = Math.max(0, Math.min(35, i.simClicks * 12 + i.simSubmits * 18 + i.lessonRiskyChoices * 2 - i.simReports * 6));
const openRisks   = Math.min(30, sum(SEVERITY_WEIGHT[s]));   // low 4, medium 8, high 14, critical 20
const knowledge   = i.firstTryRate === null ? 8 : Math.round((1 - i.firstTryRate) * 16);
const score       = clamp(training + overdue + simulations + openRisks + knowledge, 0, 100);
```

Inputs from `computeTenantRisk`: assigned lessons completed / assigned lessons (via
`resolveAssignments`), overdue = due day `< today` (Baku `dayKey`) and module not completed,
simulation clicks/submits/reports from `campaign_recipients` sent in the last **90 days**,
risky/compromised lesson answers in 90 days, open `behavior_risks` by severity, first-try rate over
**180 days** with at least 5 answers. There is no exponential decay: "decay" is these rolling
windows plus risks closing. `riskBand`: `<= 33 low`, `<= 66 medium`, else `high`.
`recomputeRisk` persists `users.risk_score` and runs after lesson completion, attestation,
assignment create/update/remove, `targetTraining`, department merges, and once a day in
`dailySnapshot` (which also writes `user_risk_snapshots` per person and `risk_snapshots` per
tenant for the 30-day trends). Every part is kept (`RiskBreakdown.parts`) so the person page can
explain the score; `tests/domain.test.ts` pins each weight.

### 5.5 Department league (`src/lib/domain/league.ts`, `src/server/services/league.ts`)

`leagueScore = round(completion × 0.6 + reportRate × 0.4)`; `rankLeague` drops departments with
no learners, orders by points → completion → name, computes `toNext`; `withTrend` compares with
the ranking `TREND_DAYS = 7` earlier; reporting counts simulations sent in `REPORT_WINDOW_DAYS =
90`; completion is assigned-lesson completion as of the cut-off. `daysLeftInMonth` feeds the
"16 days left" pill. Feature flag `league` gates the Home row and `/league`.

---

## 6. Learner surfaces

| Surface | Route / file | Data | Notes |
|---|---|---|---|
| Learn catalog | `src/app/(learner)/learn/(catalog)/page.tsx` + `catalog-view.tsx` | `getCatalog`, `yourPath` | Client filters: search, `view ∈ path | catalog`, `audience ∈ everyone | leaders | it` (`m.audiences.includes`), category chips from `CATEGORIES`. `pathRank` tiers: for-you & not started → 0, in progress/awaiting → 1000, rest → 2000, plus personal path order; `catalogRank = sortOrder`. Pills: `completed`, `awaiting`, `complete {percent}`, `forYou`, `custom` (non-library). i18n `learner.learn.*` |
| Module page | `src/app/(learner)/learn/[slug]/page.tsx`, `module.ts`, `module-actions.tsx` | `moduleForPage` (404 for unknown slug), `nextLesson`, the recap points of every stored language (`jsonb_path_query_array` over `lesson_contents`, not the whole scenes), `getPaths`, `labBestShares` | Rebuilt 2026-10-27 (ADR-027). Main column: «What you will learn» (`learningPoints` in `src/lib/content/learning-points.ts`: up to 5 recap points, in the viewer's language with its `lang`), the lesson list with the orange marker on `lastLessonKey` (else next), «Practise it» (`labsForModule(slug)` with the `lab` feature; locked until the module's lessons are done, `practiceLocked`; best score shown), «In learning paths» (the viewer's paths containing the module, `assigned` pill). Aside: stat tiles, progress bar, `Start / Continue / Review` → `/learn/<slug>/<key>`, `Start over` link, `AttestCard` (dialog, opens with `?confirm=1`, text from settings) → `attestModuleAction`, certificate block + `CertificateLink`, `RateModule` (anonymous `feedback` row, 20/hour). Path context: arriving with `?from=/paths/<key>` (`safePath`) links back to that path and on to its next module; without it the next module comes from a path assigned to the viewer. Due pill turns `risk` when overdue. i18n `learner.module.*` (`learn`, `practice`, `practiceHint`, `practiceLocked`, `inPaths`, `nextInPath`…), `learner.attest.*` |
| Home | `src/app/(learner)/app/page.tsx` (route `/app`) | `getCatalog`, `continueModule`, `yourPath`, `getPolicies`, `myLeagueRow`, `todayXp`, `openRiskCount` | Policies-to-sign card (`/policies/<id>?from=%2F`), awaiting-attestation banner (`?confirm=1`), Continue hero (`continueModule`: most recently started in-progress/awaiting, else first unfinished path item), open-risks link, league row, **Your path** via `PathTimeline` (`src/components/learner/path-timeline.tsx`, `VISIBLE = 4`, "Show all"), daily goal ring, streak, XP/level, risk score. i18n `learner.home.*` |
| Your path order | `yourPath` in `src/server/queries/catalog.ts` | | assigned (by due date, then `sortOrder`) → recommended (`forYou` = assigned to everyone/department/person; today identical to `assigned`) → remaining `everyone` modules |
| Progress | `src/app/(learner)/progress/page.tsx` | `getCatalog`, `xpByDay`, `badgesFor` | Level ring, XP, streak + freezes, risk card → `/security`, started modules sorted by percent, `completedOf` over the whole catalog, 30-day XP bar chart + heatmap, 8 badges. i18n `learner.progress.*` |
| Paths | `src/app/(learner)/paths/(index)/page.tsx`, `paths/[key]/page.tsx` | `getPaths` | Feature `paths`; roadmap with current node (modules, then the path's labs with locked / open / passed state and the modules they wait for, §4.1), audience/recurrence, standards chips (`localizeStandard`, §4.1), path certificate card |
| Policy reader | `src/app/(focus)/policies/[id]/page.tsx`, `sign-form.tsx` | latest published version, own sign-off | `(focus)` layout (no shell), `?from=` back link (must start with `/`), `policyTextFor` (`src/lib/policy-text.ts`) shows the reader's language, else the base text with its own `lang` and the `player.policy.otherLanguage` notice, TOC from H2s, `SignForm` posts `signPolicyAction` (checkbox `agree`, password unless the account has no local hash, rate limit 10 / 15 min, only the newest published version is signable) |
| Profile | `src/app/(learner)/profile/page.tsx` | certificates join modules/paths | "My certificates" list → `/c/<token>` |
| Icons | `src/components/learner/module-icon.tsx` | | `moduleIcon(slug, category)` = `BY_SLUG[slug] ?? BY_CATEGORY[category] ?? Mail` (lucide), `ModuleIcon` (sm/md/lg tile), `ModuleArt` (hero illustration, `tone onBrand | light`) |

Shared helper: `pick(map, locale)` (`src/i18n/config.ts`) → `locale → en → az → first value`.

**Module mini-lab (wave D3).** The module page's «Practise it» lists the module's mini-lab first
(`modulePractice` in `src/components/lab/model/labs.ts`, id `mini:<slug>`, href `/lab/mini/<slug>`), then the
module's labs; all wait until the module's lessons are done (`lessonsDone`), and neither completion nor
attestation waits for them. A finished run goes to `completeVmLabAction` (`src/server/lab/vm-action.ts`): it
needs the `lab` feature and the module in the viewer's catalog, replays only the chosen option ids against the
English scenario (`miniLabDef`, `replay`, `scoreRun`) and stores one `lab_attempts` row with XP scaled by the
score on the first run of the organisation's day (`recordLabAttempt`; full XP `miniLabXp`: 10 for three
decisions, 15 for five). Content format: lesson-engine.md §3.10.

---

## 7. Conventions and gotchas

- **PGlite is single-process.** `.data/pg` opens in one process only: stop `next dev` before
  `db:migrate`, `db:seed`, `db:reset`, `content:sync` (README "PGlite is single-process";
  ADR-004). The dev server on :3000 and the presentation copies on :3100/:3200 must not be
  restarted by a reference-writing task.
- **Schema changes and `drizzle/`.** `drizzle/0000_init.sql` is frozen (ADR-034, 2026-11-05) and
  every schema change is an additive `drizzle/000N_<name>.sql` written by `npm run db:generate`
  (the live drill added `0001_live_drill.sql` and `0002_drill_risk_trail.sql`). Commit the SQL and
  `drizzle/meta` together; never edit a pushed migration. `tests/helpers/db.ts` and
  `tests/assignment-since.test.ts` migrate a throw-away PGlite from that folder, so every migration
  must apply cleanly in order. Upgrade a local database with `db:migrate` (stop `next dev` first).
- **`content:sync` is a full overwrite** for library rows: module metadata, lesson titles,
  positions and the scenes of every language. Do not hand-edit library rows in the database. Tenant studio
  rows (`origin != "library"`, slug prefix `own-` or, for AI-trainer output, `ai-`) are never
  touched by sync.
- **Per-tenant override by slug** exists in every reader (`tenantId` row wins), but no UI creates
  a tenant row with a *library* slug (studio slugs are `own-…`; AI-trainer drafts are `ai-…` or
  `own-…`); a hand-made one would shadow the
  library module for that tenant, and the unique index allows it.
- **`audiences` are lowercase** on disk and in `CatalogView`; `getCatalog` lower-cases stored
  values because early studio rows had `"Everyone"`. **Lesson positions:** library 0-based,
  studio `position: 1`, AI-trainer drafts `1…n` (harmless for a single lesson; mind it for
  multi-lesson studio modules).
- **Due dates are calendar days.** Store `YYYY-MM-DD` only; validate with `parseDay` (impossible
  days throw at the `date` column, `tests/due-date-actions.test.ts`). The end of a due day is
  `T23:59:59+04:00` (Baku) in jobs; `after_joining` adds days (UTC) to the person's start:
  `users.created_at`, or `activated_at` when that is later.
- **Time zone:** every "day" (`dayKey`, XP by day, snapshots, due, 08:00 report mails) is computed in the organisation's time zone (`settings.timeZone`, IANA, default `Asia/Baku`; Settings → Languages; `tenantTimeZone(db, tenantId)` in `src/server/services/tenants.ts`; ADR-039). The Baku names in this reference are the defaults, not fixed zones.
- **i18n:** `messages/{locale}/{learner,admin,secops,settings,common}.json` for the ten UI languages; keys without dots,
  ICU braces escaped with quotes, `tests/i18n.test.ts` checks parity and placeholders. Edit the
  JSON with the Edit tool (never regenerate whole files); add every key to all ten locales, using the
  language's glossary (`references/glossaries/`).
  Training groups: `learner.home/learn/module/attest/progress/paths/policy/certificate`,
  `admin.assignments/policies/reports/auditActions`, `secops.studio/approvals/paths`,
  `settings.attestation/certificate/learning`, `common.categories/audiences/difficulty/units`.
- **AZ formatting on the client:** no `Intl`/`useFormatter`/`toLocale*` in client components; use
  `useClientFormat()` (`src/lib/client-format.ts`: dates, relative times and `number`, ADR-017). ICU
  numbers in az messages rely on `<AzNumbersGate>` and its lazy polyfill (SKILL.md ground rules).
  Server components use `getFormatter`, or `getAppFormatter()` (`src/i18n/server-format.ts`) when
  they print a relative time (az «… əvvəl» / «… sonra», ADR-024). `PathTimeline` and the catalog
  follow this.
- **Never edit `docs/audit/`** (spec of the lost original, ADR-016). Rebuild decisions go to
  `docs/build/DECISIONS.md`, open items to `docs/build/OPEN-QUESTIONS.md`.
- **Server actions** start with `actionViewer(permission)`; nothing else is exported from
  `"use server"` files (ADR-001); call `refresh()` from `next/cache` after writes (ADR-002).
  Mail from actions is deferred (`notifyUsers(..., { defer: true })`) and sent by the job runner;
  without SMTP it stays `logged` in the outbox.
- **Deletion guards:** modules/paths with certificates, attestations, progress, open risks or
  incident training cannot be deleted; unpublish instead.
- **While another workflow owns the dev server,** do not run `db:*`, `npm run build`, `tsc` or
  the full vitest suite; single files (`npx vitest run tests/domain.test.ts`) are fine.

---

## 8. Recipes

### 8.1 Add a library module with lessons (end to end)

1. Append the module to `content/library/modules.json` (keys exactly as in §2.1; `category` must
   be one of the `CATEGORY_FROM_LABEL` labels, `audience` ⊆ `everyone | leaders | it`,
   `lessonCount` = number of lessons, `minutes` = sum of lesson minutes). Order in the file is the
   catalog order (`sortOrder`).
2. Create `content/library/lessons/<slug>/<lessonId>.en.json` per lesson (`{ id, title, minutes,
   scenes }`; scene DSL in `references/lesson-engine.md`; must satisfy `lessonFileSchema` and
   `lessonIntegrityErrors`), plus one `<lessonId>.<locale>.json` translation per other UI language next
   to it (lesson-engine.md recipe 6.3; without one, learners in that language get the English text and
   `--coverage` fails).
3. Add entries to every `i18n.<locale>.json`: `modules[slug] = [title, subtitle]` and
   `lessons["slug/lessonId"] = title` (the content test fails without them).
4. Optionally add the slug to a path in `content/library/paths.json`.
5. If the module needs its own icon, add it to `BY_SLUG` in
   `src/components/learner/module-icon.tsx`; otherwise `BY_CATEGORY` supplies one.
6. Validate: `cd portal && npx vitest run tests/content.test.ts tests/content-locales.test.ts` and
   `npx tsx scripts/check-lesson-locales.ts --coverage` (update the `53` / `106` / `14` counts in
   `tests/content.test.ts`, which counts English files, when they change).
7. Import: stop the dev server, `npm run content:sync` (or `npm run db:reset` for a fresh demo),
   restart. Production picks it up on the next container start (bootstrap).
8. Do not touch `docs/audit/04-training-catalog.md`; if the catalog diverges from the original,
   note it in `docs/build/`.

### 8.2 Add or modify a learning path

- Global: edit `content/library/paths.json` (new `key`, `title/description/audience/recurrence` in all
  ten UI languages, `standards` written once for every language (§4.1), ordered `modules` slugs that
  exist in `modules.json`, optional `labs` from `LAB_IDS` in the order they should appear after the
  modules), then `npm run content:sync`. `syncPaths` throws on unknown slugs and unknown lab ids.
  A new lab needs its id in `LAB_IDS`, its modules in `LAB_MODULES` and its XP in `LAB_XP` (`src/lib/domain/gamification.ts`).
- Tenant: Admin → Paths → New (or Duplicate a library path), `savePathAction`. Texts are stored in
  the tenant default locale only.
- Tests: `tests/paths.test.ts` (the lab rules and the shipped `paths.json`), `tests/paths-query.test.ts`
  (`getPaths` with labs), `tests/assignment-since.test.ts` (path-less assignments).

### 8.3 Change XP, level or "pass" rules

- Lesson XP split / levels / streak / report bonus: `src/lib/domain/gamification.ts`
  (`lessonXp`, `LEVEL_THRESHOLDS`, `nextStreak`, `REPORT_BONUS_*`, `LAB_XP`) + `tests/domain.test.ts`.
- Module XP: `content/library/modules.json` `xp` (library) or the formula `40 + minutes * 5` in
  `saveStudioLessonAction` (studio).
- When a module counts as complete / attestation gate: `completeLesson` and `attestModule` in
  `src/server/services/progress.ts`; the `awaiting_attestation` status is read by Home, catalog,
  module page and `remindAwaitingAction`.
- A real pass mark would need a new column on `lessons` or `modules`, a check in
  `completeLessonAction` using the submitted `answers`, and an additive migration.
- Risk weights: `src/lib/domain/risk.ts` + `tests/domain.test.ts` (every weight is pinned).

### 8.4 Add a studio material type (new `origin`)

1. `materials.origin` enum in `src/server/db/schema.ts`; add a migration (`npm run db:generate`).
2. Creation path: a branch in `createMaterialAction` or a new action in
   `src/server/actions/secops.ts` (permission `studio.write`, audit `material.created`).
3. Pill tones in `src/app/(admin)/admin/studio/page.tsx` and `approvals/page.tsx`; i18n
   `secops.approvals.origin.<kind>` in all three `messages/*/secops.json`; seed example if wanted.

### 8.5 Add an approval step

1. Extend `MATERIAL_STATUS` (and `material_decisions.decision` if needed) in
   `src/server/db/schema.ts`; add a migration (`npm run db:generate`).
2. Update the state machine in `decideMaterialAction` (`src/server/actions/secops.ts`), keeping
   the "different actor" rule and the audit meta (`step`).
3. Add the tab to `TABS` in `src/app/(admin)/admin/approvals/page.tsx`, the `?tab=` mapping in
   `src/app/(admin)/admin/studio/page.tsx`, and the button/dialog in `MaterialDecision`
   (`src/components/secops/intake.tsx`); i18n `secops.approvals.tabs/status/decision.*`.
4. No unit test covers the material flow; add one modelled on `tests/due-date-actions.test.ts`.

### 8.6 Add a reminder job

1. Write `async function myJob(db, tenant: TenantLite, now): Promise<number>` in
   `src/server/jobs.ts`; register it in `runJobs` with `await step(\`myjob:${tenant.id}\`, …)`.
2. Dedupe through the `notifications` table (kind + href + window) exactly like `reminders`, so a
   repeated tick sends nothing twice.
3. Send with `notifyUsers(db, tenantId, userIds, kind, vars, inApp, { defer: true })`
   (`src/server/services/notify.ts`). A new mail kind needs either a new `TEMPLATE_KINDS` entry
   with `DEFAULT_TEMPLATES` texts (editable by admins; keep `{{link}}` mandatory per
   `notificationsSchema`) or a `FIXED_MESSAGES` entry in `src/lib/tenant-defaults.ts`.
4. New tunables: `TenantSettings.notifications` + `defaultSettings`/`withDefaults`
   (`tests/tenant-settings.test.ts`), `notificationsSchema` (`tests/settings-schema.test.ts`),
   Notifications tab in `src/components/admin/settings-tabs.tsx`. Day logic via `dueEnd`/`dayKey`.

### 8.7 Add a certificate field

1. `TenantSettings.certificate` type in `src/server/db/schema.ts` (jsonb; no migration —
   `withDefaults` fills missing keys), `defaultSettings`/`withDefaults` in
   `src/lib/tenant-defaults.ts` + `tests/tenant-settings.test.ts`.
2. `certSchema` + `saveCertificateAction` in `src/server/actions/settings.ts`; `CertificateTab`
   (form + preview) in `src/components/admin/settings-tabs.tsx`.
3. Render in `src/app/(public)/c/[token]/page.tsx`; a new text placeholder is documented next to
   `{name}/{module}/{date}` (`settings.certificate.ph*`). i18n `settings.certificate.*`,
   `learner.certificate.*`.

### 8.8 Expose a new learning setting

1. `TenantSettings.learning` in `src/server/db/schema.ts`; `defaultSettings().learning` and
   `withDefaults` in `src/lib/tenant-defaults.ts` (`tests/tenant-settings.test.ts`).
2. `learningSchema` + `saveLearningAction` in `src/server/actions/settings.ts` (audit
   `settings.learning`); `LearningTab` in `src/components/admin/settings-tabs.tsx`; i18n
   `settings.learning.*`.
3. Consume it: jobs (`refreshers` reads `riskThreshold`/`refresher`), Home (`dailyGoalXp`), the
   player (`timeLimits` with `users.timer_pref`, see lesson-engine.md). Pages read
   `v.tenant.settings` (already `withDefaults`).

---

## 9. Gaps vs the original

- **SCORM / xAPI export:** none (OPEN-QUESTIONS item 11). Lessons exist only as the portal's JSON
  DSL in `lesson_contents`; there is no package export or LMS launch.
- **Lesson languages:** all 106 library lessons ship in the ten UI languages (one `lesson_contents`
  row per language), but every translation was made from English in this rebuild by agents, not
  taken from the original (OPEN-QUESTIONS items 6 and 7; a native speaker's final read before release
  is still recommended, ADR-026). Studio lessons and AI-trainer drafts are written in one language
  and machine-translated on publish into the organisation's other languages when an AI key is set
  (§3.2); without a key they stay single-language (lesson-engine.md §7).
- **PDF:** certificates and the compliance pack are browser-print pages (ADR-006,
  OPEN-QUESTIONS item 15); scheduled report mails carry a sign-in link, not an attachment.
- **Studio depth:** the original Studio is not in the audit (the rebuild added it). Today the
  Studio form authors one micro-lesson per module (intro, tutor, optional swipe and hotspot,
  choice, recap), editable after save with stable scene ids, and the AI trainer (§3.3) saves 1–3
  lessons per draft (generated, or copied from a library module); both are translated on publish
  (§3.2). There are no versions/revision history and no hand authoring of the other rich scene
  types; publishing is a `draft | published` flag. Library modules cannot be customised per tenant
  through the UI.
- **Materials with `origin: "ai"`** appear only in the seed; no server code generates AI
  materials (only `createMaterialAction` and `convertThreatIntelAction` insert `materials`).
- **Automatic refresher** is implemented as a targeted `behavior_risks` row pointing at the
  learner's next open assigned module (or `phishing-email`), not as a dedicated "one short
  refresher lesson" as the original's settings copy says.
- **Feature flags** differ from the original list (`time_limits`, `teachable_moment`,
  `report_bonus`, `custom_attestation_text`, `custom_certificate`, `spaced_review`, `nudges`,
  `hub`, …): the rebuild gates by `PLAN_FEATURES`. Time limits and the report bonus are plain
  settings/constants; `spaced_review`, `nudges`, `teachable_moment` have no implementation.
- **"Start module over"** only links to lesson 1 (no reset); the original's behaviour beyond the
  label is unknown. **"My path"** reduces the original's department-based "For you" to
  "assigned to me" (`forYou === assigned`).
- **Catalog counts:** the original showed `51 modules` for Everyone; the rebuild shows the live
  count after the audience filter (`learner.learn.count`), which gives 51 with the shipped data.
