# B7-scorm

branch: worktree-wf_42496c94-3d0-7
worktree: C:\Users\Safar\Desktop\Cyclowareness- Vol2\.claude\worktrees\wf_42496c94-3d0-7
commits: c645aba B7-scorm: SCORM 1.2 export of a module with an offline player
fix commits: 53a835d B7-scorm review fixes: stable lesson on finish, export list and errors, stale bundle
reviews: 2 (changes_required, changes_required)

## summary
The previous attempt had left uncommitted work in this worktree. I checked it against the brief (base 1a45970 is confirmed), re-ran all three checks and committed it.

Files:
- src/server/zip.ts (new): the zip writer moved out of src/server/reports/xlsx.ts, which now imports it. Its behaviour is unchanged.
- src/server/brands.ts (new): brandsFor() moved here from learn/[slug]/[lessonId]/page.tsx so the export can reuse it. The page now imports it.
- src/server/scorm/package.ts (new):
  - scormData() loads a module the tenant can reach (library or its own; otherwise null).
  - It loads every lesson in the chosen locale with pickLessonContent (falls back to en), plus the brands the lessons reference and the player's message namespaces (common, player, part of learner).
  - manifestXml() writes SCORM 1.2 / IMS CP 1.1.2: metadata, one default organization, one SCO item, adlcp:masteryscore 80 only when a scene is scored, and one resource with the file list.
  - scormFiles() returns imsmanifest.xml, launcher.html, lessons.js, player.js and player.css, all with relative paths.
- src/server/scorm/player.ts (new): reads the bundle from .data/scorm/. If it is missing, it builds it once via `node --import tsx scripts/build-scorm-player.ts`, shared by concurrent requests.
- src/app/api/admin/modules/[id]/scorm/route.ts (new), GET:
  - Uses apiViewer('studio.write') and the studio feature, the same gate as the Studio page.
  - Answers 400 for a bad locale, 404 for a non-uuid id, an unreachable module or one with no lessons.
  - Rate limit: 30 per person per hour.
  - Writes audit entry 'module.exported' (meta: format and locale), sends Content-Disposition attachment and no-store.
- src/scorm/entry.tsx, app.tsx, scorm-api.ts, next-shim.tsx, no-server.ts (new), the offline bundle:
  - LessonPlayer runs inside NextIntlClientProvider with the bundled messages; lessons are chosen by hash route or the first unfinished one.
  - next/link and next/navigation map to a hash shim; every `@/server/*` import maps to stubs that throw.
  - The API is found by the standard walk (this window, up to 7 parents, then the opener).
  - connect() calls LMSInitialize and sets status 'incomplete' on the first launch. Finished lessons go into cmi.suspend_data, with cmi.core.exit 'suspend' while some remain.
  - When the module is done it sets score.min/max/raw (scoreLesson from src/lib/content/scoring.ts, run in the browser) and passed/failed against the mastery score, or 'completed' when nothing is scored.
  - session_time and LMSCommit run on every finish; LMSFinish runs on pagehide.
  - The tutor is off; narration uses Web Speech only (clips null).
- scripts/build-scorm-player.ts (new): esbuild (imported directly; it resolves) builds one IIFE player.js. @tailwindcss/postcss compiles src/app/globals.css into player.css, with system font fallbacks for the next/font variables.
- components/player/player.tsx: new optional `onComplete(answers)` prop. When it is set, it replaces completeLessonAction and every other server action (start, reachScene, preferences, problem report, done URL param).
- Admin UI:
  - components/admin/scorm-export.tsx (new): module and locale selects, plus a download link styled as a button.
  - It is mounted on admin/studio/page.tsx over library and own modules.
  - Strings are in admin.scorm.* and admin audit label module_exported, in all ten locales.
  - services/audit.ts: new action 'module.exported'.
- Dockerfile: the builder stage runs build-scorm-player.ts and the runtime image copies .data/scorm.
- docs/API.md: the endpoint, the package layout, the SCORM runtime behaviour and the rate-limit row.

Decisions (ADR text for the orchestrator):
1. The data file is lessons.js (sets window.CYCLOWARENESS_SCORM) instead of lessons.json, because browsers refuse fetch() from file:// pages.
2. The built bundle is not committed. In dev it is built on demand and cached in .data/scorm (delete the folder after changing the player); the Docker builder stage prebuilds it.
3. Mastery score is fixed at 80. Raw score = share of first-try correct answers across all lessons.
4. Permission is studio.write plus the studio feature, matching the Studio page.
5. No AzNumbersGate in the bundle, to avoid a 1.4 MB polyfill. The player's numbers stay below 1000.
6. Nothing is reported back to the portal; completions stay in the LMS.

Progress line: B7-scorm done. A module exports as a SCORM 1.2 zip (manifest, launcher, offline player, lessons in the chosen locale), with an Export SCORM 1.2 card in Studio in ten locales, audited, and documented in docs/API.md.

## left_open
No new dependency was needed: esbuild and @tailwindcss/postcss were already installed.

Not tested:
- Not tried in a real LMS such as SCORM Cloud or Moodle.
- Opening launcher.html from file:// was not tried in a real browser. The tests check only that the launcher uses relative paths and that player.js is a single non-module script.
- The Docker image build was not run.

Open questions for the owner:
- Should the mastery score (fixed at 80) be set per module or per export?
- Should LMS completions ever flow back into portal progress? Today they do not.

Known limits:
- In dev the cached bundle in .data/scorm goes stale after player changes until the folder is deleted.
- cmi.suspend_data is capped at 4096 characters in SCORM 1.2. The progress JSON is about 20 characters per lesson, so it is fine for current modules but would overflow for a module with about 200 lessons.

Tests run: the three SCORM test files plus the related ones (i18n, in-code-locales, rtl-logical, player-controls, player-resume, reports-build, day-and-audit): 10 files, 698 tests, all passing.

## migrations


## tests_added
portal/tests/scorm-export.test.ts
portal/tests/scorm-api.test.ts
portal/tests/scorm-player.test.ts

## reviews
changes_required
Base 1a45970 is an ancestor of HEAD. The three SCORM test files pass when re-run here (28 tests). I did not re-run typecheck or lint.

Checked and fine:
- Route gate: studio.write plus the studio feature, the same as the Studio page. Bad locale answers 400; non-uuid, unknown or another organisation's module answers 404. Rate limit and the module.exported audit entry are in place.
- Manifest structure: identifiers, masteryscore position, scormtype spelling, resource file list.
- The zip writer move; reports tests ran.
- Lesson locale fallback through pickLessonContent.
- Every useTranslations namespace the player uses is in the bundled messages (common, player, learner.profile/attest/problem).
- Every server action is guarded or unreachable offline: attest only runs for awaiting_attestation, which never happens offline; the problem section is hidden.
- Captions never fetch /api/subtitles because captionLocales and moreLanguages are empty. The tutor is hidden by tutorEnabled=false.
- Scenes and the cat mascot reference no absolute-URL assets. The Rive robot, with its /rive path, is not used.
- Docker: .data is in .dockerignore, but the builder generates the bundle and the runtime copies it, and no volume shadows /app/.data.
- ScormExport strings are present in all ten locales.

The UI is a Studio card with a module select, not a button on a module page. That is acceptable given the brief's 'catalog/studio'.

Not checked: a real LMS or a file:// run, the Docker build, and the full test suite. The major finding comes from reading the code (key/index logic in ScormApp); I did not reproduce it in a browser.
- [major] portal/src/scorm/app.tsx:484 In a module with more than one lesson, the learner never sees the done screen. With no hash in the URL (the normal first launch), the lesson index is the first unfinished lesson in the `done` state. onComplete calls setDone(session.done()) before the player's own setResult/setPhase('done'), so the index moves on and the `key={`${hash}|${lesson.key}`}` changes. LessonPlayer then remounts on the next lesson's intro, and the result, recap and 'Next lesson' button for the finished lesson are thrown away. After the last lesson every lesson is done, findIndex returns -1, Math.max(0, -1) gives 0, and the learner lands on lesson 1's intro with no sign that the module is complete. The done screen survives only when the learner arrived through a hash link (syllabus or next-lesson button) or when the module has one lesson. The 'offline app wiring' test calls onComplete on the captured props but never re-renders, so it misses this. -> Keep the lesson shown stable across a completion. Pick the fallback 'first unfinished' lesson once at mount (for example `const [start] = useState(() => Math.max(0, data.lessons.findIndex((l) => !session.done().has(l.key))))`) and use it when the hash names no lesson. Keep `done` live only for the syllabus and completedBefore. Add a test: render ScormApp, call the captured onComplete for the first of two lessons, re-render, and check that the LessonPlayer key and lesson stay the same.
- [minor] portal/src/components/admin/scorm-export.tsx:325 The export is a plain `<a download>`. Any error response (429 rate limit, 404 for an own module with no lessons, 500 when the dev build fails) is saved as a file holding 'Not found' or 'Too many requests', with no message in the UI. The select also lists own modules that have no lessons yet, and those always answer 404. -> List only modules that have at least one lesson in `exportable`, by joining or filtering on lessons. Optionally show errors with a toast instead of downloading them.
- [minor] portal/src/server/scorm/player.ts:867 The cached bundle in .data/scorm is never invalidated in development. After any change to the player, scenes or messages code, exports keep shipping the stale player.js until someone deletes the folder by hand. This is documented, but easy to miss, and it can produce a package that does not match the server's lesson data shape. -> Acceptable as documented. Cheap hardening: also rebuild when the bundle is older than the newest file under src/components/player or src/scorm, or say in OPEN-QUESTIONS that the cache must be cleared.
- [nit] portal/src/components/player/player.tsx:700 Offline, the done screen still shows the 'Home' link (it becomes '#/app', which just reopens the first unfinished lesson) and the 'no XP' line, which mean nothing inside an LMS. -> Hide the Home link and the XP line when `offline` is true.

changes_required
The review ran on commit c645aba in .claude/worktrees/wf_42496c94-3d0-7; base 1a45970 is confirmed. tests/scorm-api.test.ts, tests/scorm-export.test.ts and tests/scorm-player.test.ts all pass (28 tests). I built the offline bundle into the scratchpad. player.js is 1.06 MB and its only reference to process is a typeof-guarded process.emit. It contains no /_next or absolute asset URLs. /api/subtitles and /api/tutor appear in it, but they are unreachable with the tutor off and moreLanguages empty. In the lessons, mascot and globals.css I found no absolute asset paths; Rive is imported for types only.

What is sound:
- The route checks studio.write and the studio feature, validates the uuid and the locale, rate-limits, and audits module.exported after the zip is built.
- The manifest's identifiers are xs:ID-safe, and lessons.js is a separate script, so </script> injection is not an issue.
- The answer de-duplication in player.tsx (line 302) makes `correct` equal to first-try correctness, so the score matches the portal's first-try metric.
- Exporting an own draft does not bypass any approval, because the same studio.write holder can publish it.
- OS reduced motion is still honoured through motionLevel and globals.css.
- Strings are in all ten locales (I spot-checked az, ar and de; no "Aİ"). docs/API.md documents the endpoint and the rate-limit row. docs/build was left alone, as the hard rules require.

One finding blocks approval, the major one: the lesson remounts when it is finished, so the done screen is never shown and the last lesson sends the learner back to lesson 1.

Not checked: a real LMS, opening the package from file:// in a browser, the Docker build, and the 375 px layout in a browser.
- [major] portal/src/scorm/app.tsx:484 The learner never sees a lesson's done screen in the default LMS launch, and the last lesson drops them back to lesson 1. On launch the hash is empty, so the lesson shown is the first unfinished one, computed from the `done` state, and the player's key is `${hash}|${lesson.key}`. onComplete calls setDone(session.done()) before the player gets to setResult/setPhase('done'). The re-render then picks the next unfinished lesson, the key changes and the LessonPlayer remounts on the next lesson's start screen, so the done screen is lost. After the module's last lesson, findIndex returns -1 and Math.max(0, -1) shows lesson 1 again as if nothing happened. Only a launch that already has a #/learn/... hash avoids this. The test in scorm-api.test.ts only renders statically, so it does not catch it. -> Choose the lesson only when the hash changes, not when `done` changes. For example, compute the index in a useMemo keyed on `hash` that reads session.done() directly, and keep the `done` state only for the syllabus flags. The finished lesson then stays mounted and shows its done screen, and its 'Next lesson' or 'Back to the module' link moves on. Add a test that calls onComplete on the last lesson and checks that the shown lesson key does not change.
- [minor] portal/src/components/admin/scorm-export.tsx:325 The export is a plain `<a download>`. A 404 (for example a custom module with no lessons), a 429 (rate limit) or a 500 (the on-demand build failed in dev) is saved as a small text file instead of showing an error. The administrator gets a junk download and no message in any of the ten languages. -> Acceptable for now. If it matters: fetch the zip, show a toast on an error status using an admin.scorm.error string in ten locales, and save the blob with an object URL. Or at least note the behaviour in docs/API.md.
- [minor] portal/src/app/(admin)/admin/studio/page.tsx:179 The exportable list takes every library module and every own module with no de-duplication. When a tenant has its own module with the same slug as a library one (the catalog keeps the tenant's copy, see queries/catalog.ts bySlug), the select shows two options with the same title. Own drafts are listed alongside published modules with nothing to tell them apart. -> Optional: de-duplicate by slug the way getCatalog does (prefer the tenant's row), or append a draft marker to draft titles.
- [nit] portal/src/components/player/player.tsx:649 In the package the done screen always says player.done.noXp ('Lesson reviewed') because xp is 0. It also offers a 'Home' button whose /app link becomes #/app, which just reopens the first unfinished lesson (or lesson 1). In an LMS both read oddly to a learner. -> Optionally hide the Home button and the XP pill when offline, using the existing `offline` flag.
- [nit] portal/src/server/scorm/player.ts:870 The dev cache in .data/scorm is never invalidated, so after a player change exports silently ship a stale player until someone deletes the folder by hand. This is documented, but easy to miss. -> Optional: also mention it in the cyclowareness-experience lesson-engine reference next to the player, or rebuild when the cached player.js is older than src/components/player/player.tsx.

## fix
fixed:
major (both duplicate findings), portal/src/scorm/app.tsx: the lesson shown is now picked in a useMemo keyed on the hash, which reads session.done() through the new exported lessonIndex(lessons, hash, done). When a lesson finishes, setDone only updates the syllabus and completedBefore. The hash and the lesson key stay the same, so the LessonPlayer is not remounted and its done screen, recap and Next lesson link stay on screen. Finishing the last lesson no longer jumps back to lesson 1; lesson 1 is shown again only when the learner navigates away. Added a lessonIndex test in tests/scorm-api.test.ts (lesson named by the hash, first unfinished lesson, all lessons done goes to 0).
minor, scorm-export.tsx (both duplicate findings): the export is fetched instead of linked through <a download>, using the same pattern as invite-links-button.tsx. An error response shows a toast with the existing common.errors.rateLimited (on 429) or common.errors.generic string, which are already in all ten locales, so no file holding the error text is saved. A good response is saved as a blob under the name from Content-Disposition.
minor, studio/page.tsx: the export list now holds only modules that have at least one lesson (an inArray subquery on lessons). It keeps one module per slug and prefers the tenant's own copy, as queries/catalog.ts does. Draft modules get the existing secops.studio status.draft label after their title.
minor, src/server/scorm/player.ts: in development the cached bundle in .data/scorm is rebuilt when any file under src/scorm, src/components/player, src/lib/content or messages is newer than player.js. In the Docker image these folders do not exist, so the bundle there is never rebuilt. The script header and docs/API.md now say this. New test tests/scorm-player-cache.test.ts covers it with a mocked execFile: the bundle is built once when missing, reused while current, rebuilt when a source is newer, and never rebuilt when the sources are absent.
rejected:
Only part of the suggested test for the majors was added: no test re-renders ScormApp after onComplete and checks that the LessonPlayer key stays the same. The vitest environment is node, and no DOM renderer is installed (no jsdom, happy-dom, react-test-renderer or @testing-library). renderToStaticMarkup cannot apply a state update after the first render. The fix makes the stability come from the code's structure instead: the index depends only on the hash, and the hash is the only input that remounts the player. The selection logic itself is tested through lessonIndex. A real re-render test needs jsdom as a devDependency, which I did not install.
