export const meta = {
  name: 'features-early',
  description: 'In an isolated workspace: learning paths with labs after lessons and a better module page, natural TTS clip pipeline with word timings, AI subtitle server; then Codex and ECC security reviews and fixes',
  phases: [
    { title: 'Build', detail: 'paths+module page, TTS pipeline, subtitles server (parallel, file-disjoint)' },
    { title: 'Integrate', detail: 'typecheck, lint, tests in the workspace' },
    { title: 'Review', detail: 'Codex (Claudex Loop) and ECC security reviewer' },
    { title: 'Fix', detail: 'apply confirmed findings' },
  ],
}

// A usage limit ends an agent with no result: wait and retry instead of failing the stage (limits reset within about 5 hours).
async function retrying(prompt, opts) {
  for (let attempt = 1; attempt <= 40; attempt++) {
    const r = await agent(prompt, opts)
    if (r) return r
    log(`${opts.label}: no result (attempt ${attempt}), retrying in 10 minutes`)
    await new Promise((done) => setTimeout(done, 10 * 60 * 1000))
  }
  return null
}
const SP = 'C:/Users/Safar/AppData/Local/Temp/claude/C--Users-Safar-Desktop-Cyclowareness--Vol2/66e61158-c161-4119-a251-69c6013bc3e9/scratchpad'
const R = `${SP}/featws`
const P = `${R}/portal`
const LOG = `${SP}/features-early`

const COMMON = `NOTE: an earlier run of exactly this task was cut off by a usage limit; its partial edits may already be in the files. Inspect the current state first (git diff, the files you own) and continue from there instead of redoing or duplicating work.
WORKSPACE: ${R} is an ISOLATED COPY of the repository (node_modules is a junction to the real one). Other agents are converting the real tree to 10 languages and right-to-left right now; your changes will be 3-way merged into it afterwards. Work ONLY inside ${R}; never touch C:/Users/Safar/Desktop/Cyclowareness- Vol2. Keep diffs focused so the merge stays clean: do not reformat or reorder code you do not change.
PROJECT: Cyclowareness (vendor Safarov Industries), a multi-tenant security-awareness SaaS (LMS) sold to banks and government bodies; it must be secure itself. App: ${P} (Next.js 16 App Router with webpack, React 19, TypeScript strict, Tailwind 4.3, next-intl, Drizzle + PGlite locally). Read ${R}/CLAUDE.md and ${P}/AGENTS.md first.
CONTEXT: the portal is becoming 10-language (az en ru tr ro ka uk de fr ar; ar is right-to-left). Use logical CSS only (ms/me/ps/pe/start/end/text-start/border-s/rounded-s…), never physical left/right classes; mirror directional icons with the existing CSS rule or rtl: variants; dir="ltr" for codes/URLs. Add UI strings to messages/en, az and ru only (keys without dots, valid ICU; another step translates the 7 other languages later). Never write "Aİ" in Azerbaijani.
ALREADY DONE in the schema (src/server/db/schema.ts, migration regenerated): learning_paths.lab_ids jsonb not null default [] (Drizzle field labIds), and a table ai_cache (aiCache: id text pk = sha256 of kind and inputs, kind "subtitles", lessonId -> lessons.id cascade, locale, payload jsonb, model, createdAt). Do not change the schema further without a very good reason; if you must, regenerate with: rm -rf drizzle && npx drizzle-kit generate --name init (from ${P}).
MAPS (read for your task): ${SP}/maps/paths.md, ${SP}/maps/player.md, ${SP}/maps/design.md. Glossaries for translations: ${SP}/glossaries/<lang>.md.
NAVIGATION: from ${R} run graphify query "<question>" --budget 1500 (the graph describes the real tree, which is nearly identical).
SKILLS (load with the Skill tool when relevant): agent-skills:frontend-ui-engineering, agent-skills:api-and-interface-design, agent-skills:security-and-hardening, agent-skills:test-driven-development, ecc:frontend-a11y, claude-api (for any Anthropic API call: read it before writing the call).
HOW TO WORK (ponytail: smallest complete change): reuse what exists, match surrounding style, comment only the why, every new non-trivial logic gets a test. Never commit, never run db:* / seed / content:sync, never start servers.
CHECKS (from ${P}): npm run typecheck; npx eslint src tests scripts --max-warnings=0; npx vitest run <your tests>, then the full suite.`

const SCHEMA = { type: 'object', properties: {
  summary: { type: 'string' }, files: { type: 'array', items: { type: 'string' } },
  checks: { type: 'string' }, notes: { type: 'array', items: { type: 'string' } },
}, required: ['summary', 'files', 'checks', 'notes'] }

phase('Build')
const build = await parallel([
  () => retrying(`${COMMON}

CONTINUATION (read first): a previous run of this task already finished, in this workspace: paths.json labs lists and their tr/ro/ka/uk/de/fr/ar translations, src/lib/domain/labs.ts, syncPaths, the viewer-assigned path fix (pathsAssignedTo/assignedPathsForUser), getPaths labs/due/ordering, the learner path page (Trainings then Practice labs), its loading skeleton, index card lab counts, src/components/learner/lab-visual.ts, admin PathEditor labs, pathSchema/savePathAction/draftOf, admin chips, the catalog "My path" audience bypass. STILL TO DO: (1) src/lib/content/learning-points.ts ("What you will learn" from each lesson's recap points in the viewer's language via pickLessonContent, 3-5 points, no AI) with a test; (2) the module page rework in src/app/(learner)/learn/[slug]/page.tsx and its loading.tsx as described below; (3) the en/az/ru message keys the new code references (learner.paths.lessonsHeading, labsHeading, labsHint, labsProgress, labsCount, labLocked, labPassed, labBest, confirmHint, dueLabel, totals; secops.paths.labs, form.labs, form.labsHint; and the module page keys); (4) tests/paths.test.ts; (5) typecheck, eslint, the targeted and full vitest runs. Verify the finished parts compile and fix them if needed.
YOUR TASK: learning paths with labs after lessons, and a clearer training (module) page. The owner said: "in learning paths it is more appropriate that the training is taken first and then the labs are given" and "on the training page give the structure of the trainings more correctly; functionality is thin".
Do the change plan of ${SP}/maps/paths.md sections 1-9 and 11 exactly (labs in paths.json after modules with the suggested lists; src/lib/domain/labs.ts with LAB_IDS, LAB_MODULES, LAB_PASS = 0.7 on the best score share and the pure labUnlocked(); syncPaths; getPaths with labs {id, best, passed, unlocked} only when the lab feature is on; learner path page with a "Trainings" list then a numbered "Practice labs" list with unlocked/locked ("Unlocks after: …")/passed rows; sidebar "Labs n of m"; loading skeleton; index cards "N labs"; admin PathEditor labs checkbox group, pathSchema labIds z.array(z.enum(LAB_IDS)).max(7).default([]), savePathAction, draftOf, admin chips; module page "Practise it" block, locked until the module's lessons are done), plus the learner-facing fixes from "Other thin or illogical spots" 1 (the wrong "Assigned to you" pill: compute the viewer's own assigned path ids), 2 (orderBy: assigned, mandatory, rest, createdAt), 3 (richer roadmap rows: minutes, lesson count, XP, due date, the awaiting-attestation "Confirm" hint, path totals and due date), 4 (path context: ?from=/paths/<key> back link and a "Next in path" button on the module page; validate from with the existing safePath helper), 5 (assigned modules bypass the audience filter in "My path").
TRAINING (MODULE) PAGE STRUCTURE (src/app/(learner)/learn/[slug]/page.tsx and its parts): make it a proper course page: header with module title, subtitle, category, difficulty, total minutes, lesson count, XP and status/progress; a primary "Start / Continue / Review" action that resumes at the right lesson; a "What you will learn" block (derive 3-5 points from the module's lessons: lesson titles and, if available, each lesson's intro/recap from lesson_contents in the viewer's language via pickLessonContent; no AI calls); a numbered syllabus of lessons with minutes, completed/in-progress state and a link each; the attestation/confirm step when applicable; the "Practise it" labs block; the learning paths this module belongs to; the next module in path. Keep it fast (one query batch), accessible (headings, lists, aria-current), mobile-first at 375 px, logical CSS, and consistent with the existing design language (src/components/ui/*).
paths.json title/description/audience/recurrence maps: add tr ro ka uk de fr ar to every path (5 paths x 4 fields), translated by meaning per ${SP}/glossaries/<lang>.md. Messages: en/az/ru only.
Tests: tests/paths.test.ts (paths.json slugs and lab ids valid; labUnlocked cases; viewer-assigned path ids; ordering).
Return summary, files, checks, notes.`, { label: 'paths-module', phase: 'Build', schema: SCHEMA }),

  () => retrying(`${COMMON}

CONTINUATION (read first): a previous run of this task already built, in this workspace: src/lib/tts/* helpers, scripts/generate-narration.ts (dry run works), clip playback + volume + pickVoice fixes in narrator.ts, src/server/narration.ts, cache header and proxy pass-through for /generated/tts/, optional ELEVENLABS_* env vars and .env.example. Manifests live in content/narration/ (not public/) so lesson text is never a public file: keep that. STILL TO DO: the README TTS section; the voiceMissing wording and voiceLanguage names in messages en/az/ru for all 10 languages; the voice-notice.tsx comment; a proxy test for the /generated/tts pass-through; pickVoice unit tests (incl. the German/Romanian MALE-regex bug and Edge natural names); then typecheck, eslint, the targeted and full vitest runs, fixing what fails.
YOUR TASK: natural narration voice for every language, with word timings for karaoke highlighting. Decision (researched): ElevenLabs text-to-speech with timestamps, pre-generating one clip per spoken sentence per locale, cached as static files; Web Speech stays as the fallback when there is no clip.
API facts (verify against the official docs with WebFetch if unsure): POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/with-timestamps?output_format=mp3_44100_128 with header xi-api-key and JSON { text, model_id: "eleven_v3", language_code: "<ISO 639-1: az en ru tr ro ka uk de fr ar>", seed?, previous_text?, next_text? }; the response has audio_base64 and alignment { characters[], character_start_times_seconds[], character_end_times_seconds[] } relative to the original text. Only eleven_v3 (and the dialogue-only v4) support az and ka. Default voices are being retired on 2026-12-31, so voice ids come from configuration: ELEVENLABS_VOICE_ID (default for all locales) and optional per-locale overrides ELEVENLABS_VOICE_<LOCALE> (e.g. ELEVENLABS_VOICE_AZ); document that a native speaker should pick az/ka/ar voices from the Voice Library.
Build:
1) src/lib/tts/ (pure, tested): text normalisation exactly as the player's speak() receives text (reuse speechText/cleanSpeech; find them via the map), a stable clip key (sha256 of locale, model, voice and text), alignment -> word timings that match the player's wordsOf() word split (character offsets -> {w, startMs, endMs}[] per word; robust for Arabic, Georgian, Cyrillic, punctuation), manifest types (lesson-engine.md §1.6: Record<text,{url,durationMs,words}>).
2) scripts/generate-narration.ts: walks content/library/lessons/*/*.<locale>.json for the chosen locales (args: --locales az,ru --only <module/lesson> --dry-run --concurrency 4), extracts EVERY string the player speaks (beat say lines, spoken, the composed intro "title. body", recap points joined, choice prompt + multi hint, feedback/explain lines the player narrates: derive the list from the 20 narrator.speak( call sites in src/components/player/scenes.tsx and the tutor panel), skips clips already on disk, calls the API with retry/backoff on 429/5xx and a request timeout, writes public/generated/tts/<locale>/<key>.mp3 and one manifest per locale+lesson public/generated/tts/<locale>/<module>__<lesson>.json, prints the character count and estimated cost first and refuses to run without ELEVENLABS_API_KEY (dry-run works without it). Never log the key.
3) src/server/narration.ts: loadNarrationClips(lessonKey, locale) reading the manifest from disk (cached), returning null when absent; safe against path traversal (lesson keys and locales validated against the library/LOCALES).
4) src/components/player/narrator.ts: optional clips map and volume in useNarrator({ enabled, rate, lang, clips?, volume? }); when clips[speechText(text)] exists play it with an HTMLAudioElement (volume, playbackRate = rate, pause/resume, stop() bumps the token), drive onWord(i) by requestAnimationFrame against words[i].startMs, ended -> onWord(n) then onEnd; report voice "available" when clips exist; otherwise the existing Web Speech path. Keep the existing speak() contract (lesson-engine.md and the map). Fix pickVoice: the MALE regex matches "German"/"Romanian" (word-boundary it), add the Edge natural voice names per locale to FEMALE/MALE (az Banu/Babek, ka Eka/Giorgi, ar Zariyah/Hamed, tr Emel/Ahmet, ro Alina/Emil, uk Polina/Ostap, ru Svetlana/Dariya/Dmitry, de Katja/Seraphina/Amala/Conrad/Florian, fr Denise/Vivienne/Eloise/Henri/Remy, en Ava/Emma/Jenny/Andrew/Guy), prefer the ar-SA region for ar, keep the natural/online ranking; unit tests for pickVoice. DO NOT edit player.tsx, scenes.tsx or the player page: a later step wires clips and volume into the player using your API; describe that API precisely in notes.
5) next.config.ts: immutable cache headers for /generated/tts/:path*; check the CSP media-src allows same-origin audio. src/server/env.ts: optional ELEVENLABS_* vars. .env.example and README: a short TTS section (how to generate, cost estimate: about 2.9M characters for 10 languages at about 0.08 USD per 1k characters, voice choice). voice-notice: the "voice missing" text must not name only az/ru; messages en/az/ru.
Return summary, files, checks, notes (the exact player-wiring API).`, { label: 'tts', phase: 'Build', schema: SCHEMA }),

  () => retrying(`${COMMON}

YOUR TASK: the server side of subtitles in languages the library does not ship (the owner: "subtitles in different languages, for example a language we have not added, shown as subtitles under an English training"). The 10 shipped languages come straight from lesson_contents (a later UI step reads them); you build the AI path for any other language.
1) src/server/subtitles.ts: extract the spoken lines of a lesson content row in a stable order (the same strings the player speaks; mirror the TRANSLATABLE walk of src/lib/content/locale-parity.ts and the speak() call sites, see ${SP}/maps/player.md "Subtitles in another language"); translate them with ONE Anthropic call on env ANTHROPIC_TUTOR_MODEL (claude-haiku-5-5 by default) using a strict tool schema {lines: string[]} (pattern: LESSON_TOOL in src/server/ai.ts; read the claude-api skill first), system prompt: subtitle translator, keep names/addresses/URLs/codes unchanged, natural spoken style, same number of lines; validate lines.length and each line non-empty and bounded; cache in ai_cache with id = sha256("subtitles", lessonId, sourceLocale, target, sha256(source lines joined)) so a content change invalidates it; return {lang, lines} keyed by the source text (Record<sourceText, translated>).
2) src/app/api/subtitles/route.ts (POST {lessonId, target}): same guards as src/app/api/tutor/route.ts (same-origin, viewer, the lesson must be visible to the viewer's tenant (library or own tenant), ai_tutor feature, rateLimit per user e.g. 6 per 10 minutes and a daily cap), target validated against an allowlist of about 60 ISO 639-1 codes of widely spoken languages (export the list with names via Intl.DisplayNames for the UI), never the 10 shipped locales (those come from lesson_contents), JSON errors without internals, 503 with a clear code when no API key.
3) tests: line extraction is stable and matches the player's spoken strings for a few real lessons; the cache key changes when the source changes; the route rejects bad targets, other tenants' lessons, missing feature, and rate limits (mock the Anthropic client).
Return summary, files, checks, notes (the API the UI step will call).`, { label: 'subtitles-api', phase: 'Build', schema: SCHEMA }),
])

phase('Integrate')
const notes = (r) => r ? `${r.summary.slice(0, 1500)}\nNOTES: ${r.notes.join(' | ').slice(0, 2500)}` : '(failed)'
const integrate = await retrying(`${COMMON}

YOU ARE THE INTEGRATOR of this workspace. Reports:
[paths-module] ${notes(build[0])}
[tts] ${notes(build[1])}
[subtitles-api] ${notes(build[2])}
Run typecheck, eslint (zero warnings) and the full vitest suite in ${P}; fix every failure (tests that fail only because translations of the 7 new languages are missing in this snapshot are expected: list them). Then write ${LOG}/changed-files.txt (create the folder) listing every file this workspace changed or added relative to ${SP}/featws-base (compare file contents; one relative path per line, e.g. portal/src/lib/domain/labs.ts), excluding node_modules, .next, graphify-out and generated audio. Return summary, files, checks, notes.`, { label: 'integrate', phase: 'Integrate', schema: SCHEMA })

phase('Review')
const REVIEW_SCHEMA = { type: 'object', properties: {
  findings: { type: 'array', items: { type: 'object', properties: { file: { type: 'string' }, line: { type: 'number' }, severity: { type: 'string', enum: ['high', 'medium', 'low'] }, problem: { type: 'string' }, fix: { type: 'string' } }, required: ['file', 'severity', 'problem', 'fix'] } },
  summary: { type: 'string' },
}, required: ['findings', 'summary'] }
const FOCUS = `Scope: the files listed in ${LOG}/changed-files.txt inside ${R} (compare with ${SP}/featws-base to see the diff: e.g. git diff --no-index). Look for real bugs and security issues: authorization and tenant isolation (paths, labs, subtitles route: can a user read another tenant's lesson or path?), rate limiting and cost abuse of the AI route, prompt injection risks, path traversal in narration manifests, secrets in logs, SSRF, XSS, unsafe JSON handling, race conditions, wrong unlock logic, broken resume, a11y regressions, missing tests. Report only verified, concrete problems with file and line.`
const reviews = await parallel([
  () => retrying(`${COMMON}

YOU ARE A REVIEW COORDINATOR FOR CODEX (Claudex Loop: an independent second model). Do not edit project files. Write the brief to ${LOG}/codex-brief.md (${FOCUS}), then run Codex read-only in the workspace: codex.cmd exec -s read-only --skip-git-repo-check -C "${R}" "$(cat '${LOG}/codex-brief.md')" > "${LOG}/codex-review.txt" 2>&1 (allow up to 20 minutes; run it in the background and check back). Verify every finding yourself; return only confirmed ones and a summary with how many Codex raised vs confirmed.`, { label: 'review:codex', phase: 'Review', schema: REVIEW_SCHEMA, model: 'sonnet' }),
  () => retrying(`${COMMON}

YOU ARE AN INDEPENDENT SECURITY REVIEWER. Do not edit files. ${FOCUS}`, { label: 'review:ecc-security', phase: 'Review', schema: REVIEW_SCHEMA, agentType: 'ecc:security-reviewer', model: 'sonnet' }),
])
const findings = reviews.filter(Boolean).flatMap((r) => r.findings)
log(`features-early review: ${findings.length} findings`)
phase('Fix')
const fix = findings.length ? await retrying(`${COMMON}

FIX THE REVIEW FINDINGS (verify each first; skip false ones with a reason):
${JSON.stringify(findings).slice(0, 14000)}
Re-run typecheck, eslint, the full vitest suite; update ${LOG}/changed-files.txt if you add files. Return summary, files, checks, notes.`, { label: 'fix', phase: 'Fix', schema: SCHEMA }) : null
return { build, integrate, findings: findings.length, reviews: reviews.map((r) => r && r.summary), fix }
