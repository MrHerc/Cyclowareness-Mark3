---
name: cyclowareness-experience
description: >
  Deep reference for the Cyclowareness portal's learner experience, rebuilt from the lost cylosof.com:
  the Rive mascot "AI Sel", the motion and animation system (the original admin panel and learner app
  animations, the full/calm/still motion preference), and the complete training system (lesson JSON
  format, the 11 scene types, the player, voice narration with karaoke highlighting, the AI tutor,
  illustrations, artifacts and brands, the 53-module catalog, content sync, Studio authoring and
  approvals, learning paths, assignments and reminders, progress, XP, streaks, league, risk score,
  certificates and attestations). Use this skill for ANY task in this repo that touches the mascot,
  animations, lessons, trainings, modules, narration, voice, TTS, materials, Studio, quizzes,
  simulations, certificates, learning paths or learner progress, including requests written in
  Azerbaijani (maskot, animasiya, hərəkət, təlim, dərs, modul, səsli oxuma, səsləndirmə, material,
  studiya, sertifikat, tapşırıq, yol, liqa, risk), and whenever the user says "like the original"
  (orijinaldakı kimi). Read the matching reference before planning or editing anything.
---

# Cyclowareness experience: mascot, motion, training

## Why this skill exists

The user's security-awareness SaaS (cylosof.com) lost its source code. The portal in `portal/` is a
rebuild that must match the original and then exceed it. The only record of the original is the
audit in `docs/audit/` (spec text in Azerbaijani, 57 screenshots in `docs/audit/screens/`, the 106
extracted lesson JSON files and the script book `docs/audit/content/lessons/SCRIPTS.en.md`, the
narration manifest sample, the brand registry, the mascot `.riv`). Every task in this area is a
three-way comparison: what the original did (spec), what the portal does now (code), what the user
wants next. The references below hold all three so you do not rediscover them each time. The user
will keep sending tasks in this area; most of them close one of the gaps listed at the end.

## Where to look

| Task is about | Read first | Spec to compare with |
|---|---|---|
| Mascot: moods, gestures, idle acts, pointing, reactions, placement, Rive inputs, `.riv` swaps | [references/mascot.md](references/mascot.md) | `docs/audit/06-lesson-engine.md` §3, `02-learner-app.md` |
| Anything that moves: tokens, keyframes, skeletons, count-ups, charts, transitions, reduced motion, "animate it like the original" | [references/animations.md](references/animations.md) | `docs/audit/01-design-tokens.md` "Hərəkət" |
| Lesson content format, scene types, player, narration/TTS/karaoke, AI Sel tutor, illustrations, artifacts, brands, timers, recap, attestation in the player | [references/lesson-engine.md](references/lesson-engine.md) | `docs/audit/06-lesson-engine.md`, `02-learner-app.md` §4 |
| Catalog, modules, content sync, Studio, materials, approvals, paths, assignments, reminders, XP, streak, league, risk, certificates, policies | [references/training-pipeline.md](references/training-pipeline.md) | `docs/audit/04-training-catalog.md`, `03-admin-panel.md` |

Each reference has the same shape: what the original did, the current implementation (file map and
APIs with exact identifiers), conventions and gotchas, recipes for likely tasks, and the gaps still
open versus the original. Read the recipe for your task before touching code; it names the files and
the tests. A task that spans two areas (a mascot reaction inside a scene, an animated KPI fed by the
risk score) needs both references.

## Ground rules that apply to every task here

- `docs/audit/` is the spec of the original. Never edit it. Quote it when you explain a decision.
- Three UI languages, az/en/ru, in `portal/messages/{az,en,ru}/*.json`. Every new string goes into
  all three, translated by meaning, not word for word; keys without dots; ICU braces escaped with
  quotes; `tests/i18n.test.ts` checks parity. Edit these JSON files with the Edit tool (shell heredocs
  corrupt backslashes and Unicode). Landing copy is in `portal/content/landing/*.json` for ten
  languages and `tests/landing.test.ts` fails on a missing key.
- Lesson content lives in `portal/content/library/` (106 English lesson files, az/ru titles in
  `i18n.az.json` / `i18n.ru.json`). `tests/content.test.ts` validates every file and pins the counts
  (53 modules, 106 lessons, 14 multi-answer scenes): run it after any content change and update the
  counts when they legitimately change.
- The tutor is called **AI Sel** everywhere (UI strings, landing, legal texts). The vendor brand is
  **Safarov Industries** and is never translated. The product is **Cyclowareness**; only `docs/audit`
  keeps the name Cylosof.
- Azerbaijani dates and relative times: Chromium ships no `az` ICU data, so never call
  `Intl.DateTimeFormat("az")`, `useFormatter` or `toLocale*` on the client. Use `src/lib/az-format.ts`,
  `useClientFormat()` from `src/lib/client-format.ts` and `<RelativeTime>`; format on the server when
  you can (ADR-017). Every "day" in the pipeline is `Asia/Baku`.
- Respect the learner's motion preference (`users.motion` = `full | calm | still`, exposed as
  `<html data-motion>`) and `prefers-reduced-motion` in every animation, including the mascot. CSS
  animations are covered globally; JS timers, rAF and Rive must check it themselves (animations.md §3).
- Respect plan features from `PLAN_FEATURES` in `src/lib/tenant-defaults.ts` (`learning`, `league`,
  `certificates`, `policies`, `paths`, `ai_tutor`, `tutor_voice`, `studio`, `approvals`, ...): a UI
  that ignores a disabled feature is a bug. Timers and the daily goal are tenant *settings*
  (`settings.learning.timeLimits`, `dailyGoalXp`) plus the learner's `timerPref`, not features; the
  original's `time_limits` / `teachable_moment` flags have no counterpart in code.
- Hydration safety: the player, mascot, tour and landing tour are client components that render on
  the server first. No `Date.now()`, `Math.random()`, `window` or locale formatting in render paths;
  read browser state through `useSyncExternalStore` with a server snapshot (patterns in the references).
- Database: PGlite locally is single-process. Stop the dev server before `npm run db:reset`,
  `db:migrate`, `db:seed` or `content:sync`. Schema changes mean regenerating `drizzle/0000_init.sql`
  from scratch (`rm -rf drizzle && npx drizzle-kit generate --name init`) and reseeding while nothing
  is deployed; never hand-edit the SQL. Content changes reach the database through
  `npm run content:sync` (`scripts/sync-content.ts`, a full overwrite of library rows) or the seed.
- Narration today is the browser's Web Speech API behind `useNarrator().speak()` (ADR-007); the
  original played pre-generated clips keyed by sentence text with word timings. Any voice work must
  keep the `speak()` contract (lesson-engine.md §3.4, recipe 6.6).
- Commit only when the user asks. Never push. The demo server on port 3100 (a separate copy under the
  scratchpad) is the user's presentation copy: do not stop or rebuild it unless they say so.
- Seed sign-in accounts are listed in `portal/scripts/seed-data.ts`; the password is `SEED_PASSWORD`
  in `portal/.env.example`. Scripts may read it from the file; never paste it into chat, docs or logs.

## Working method for a task in this area

1. Read the relevant reference section and its recipe. If the user says "like the original", open the
   spec file and the screenshot the reference cites, and state in one line what the original did.
2. Locate the code from the file map; confirm the files still exist (the map can drift).
3. Implement with the conventions above. Keep changes surgical; the portal is production-bound and
   sold globally, so every string, date and layout must work in az, en and ru at 375 px.
4. Verify, in this order, from `portal/`:

```bash
npm run typecheck
```

```bash
npx eslint src tests --max-warnings=0
```

```bash
npx vitest run
```

   For UI work also load the page on the dev server (`preview_start "portal"`, port 3000) as a learner
   and as an admin, in az and ru as well as en, and at 375 px width; the original was mobile-first.
   For mascot or motion work also check Profile → Motion set to Still and the OS reduced-motion setting.
5. When the task settles a design question, add an ADR to `docs/build/DECISIONS.md` and a line to
   `docs/build/PROGRESS.md`; if it needs the user's decision (provider keys, legal text, content in
   az/ru, anything that changes the live tenant), add it to `docs/build/OPEN-QUESTIONS.md` instead of
   guessing.

## Open gaps versus the original (where the next tasks usually land)

Details and suggested approaches are in each reference's last section.

- **Voice**: no pre-generated TTS clips or word-timing manifest; Web Speech instead, so Azerbaijani
  voice quality depends on the device and the mascot's mouth is a boolean (`talking`), not amplitude.
  Needs a provider decision (OPEN-QUESTIONS 2). lesson-engine.md §7, recipe 6.6; mascot.md §5.
- **AZ/RU lesson text**: only `.en.json` files exist; az/ru learners read English scenes under
  translated titles. `syncLibrary` reads only `.en.json`. lesson-engine.md recipe 6.3 (needs the
  user's OK to extract from the live tenant, OPEN-QUESTIONS 6).
- **Illustrations**: the 29 ids render as Lucide icon compositions; the spec says the two-tone SVG
  scenes must be redrawn. lesson-engine.md recipe 6.4.
- **Mascot pointing and staging**: only tutor beats with a `highlight` aim at a spot; intro/recap
  moods, scenario node visuals, beat `stage`, several Rive inputs and moods are unused. mascot.md §5.
- **Animations**: the landing "stage" keyframes, lens travel, simulation frame glow, chart draw-in,
  fill-on-load, celebration particles and a `calm` level in JS are missing. animations.md §7.
- **Studio depth**: one four-scene micro-lesson per module, no editing after save, no versions, no
  rich scene types; library modules cannot be customised per tenant from the UI. training-pipeline.md §9.
- **Exports**: no SCORM/xAPI, no server-side PDF (certificates and the compliance pack print from the
  browser). OPEN-QUESTIONS 11 and 15.

## Vocabulary (the user writes in Azerbaijani)

| User says | Means | Where |
|---|---|---|
| maskot, Sel, AI Sel | the Rive character and the tutor persona | mascot.md; lesson-engine.md §4 |
| animasiya, hərəkət, Full/Calm/Still | motion system and the motion preference | animations.md |
| təlim, dərs, modul, kataloq | training, lesson, module, catalog | training-pipeline.md §2, §6; lesson-engine.md §2 |
| səsli oxuma, səsləndirmə, karaoke | narration, TTS clips, word highlighting | lesson-engine.md §1.6, §3.4, recipe 6.6 |
| beat, səhnə, addım | a tutor beat / a scene / a step in the player | lesson-engine.md §1.2, §3.3 |
| material, studiya, təsdiq | Studio authoring, materials, approvals | training-pipeline.md §3 |
| tapşırıq, yol, xatırlatma | assignment, learning path, reminder | training-pipeline.md §4 |
| XP, seriya (streak), liqa, risk balı | gamification and risk score | training-pipeline.md §5 |
| sertifikat, təsdiq mətni (attestasiya) | certificate, attestation text | training-pipeline.md §5.3 |
| illüstrasiya, artefakt, brend | lesson visuals, email/sms/call mock-ups, fictional brands | lesson-engine.md §1.5, §2.4 |
| orijinaldakı kimi | as in cylosof.com: check docs/audit first | every reference §1 |
