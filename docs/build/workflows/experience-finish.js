export const meta = {
  name: 'experience-finish',
  description: 'Main tree, Opus: light and motion foundation, then portal-wide light, the full lesson player (syllabus, volume, speed, subtitles, transcript, shortcuts, natural-voice clips) in parallel, visual critique on :3000, refine, new keys in 7 languages, then independent code, security and React reviews and fixes',
  phases: [
    { title: 'Foundation', detail: 'light/motion tokens, keyframes, useMotion, Burst' },
    { title: 'Build', detail: 'learner light, admin/landing light, lesson player (parallel, file-disjoint)' },
    { title: 'Critique', detail: 'fresh-eyes designer on screenshots from :3000' },
    { title: 'Refine', detail: 'apply the critique' },
    { title: 'Integrate', detail: 'typecheck, lint, tests; new keys in 7 languages' },
    { title: 'Review', detail: 'independent code reviewer, ECC security, ECC React' },
    { title: 'Fix', detail: 'confirmed findings, final checks' },
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

const R = 'C:/Users/Safar/Desktop/Cyclowareness- Vol2'
const P = `${R}/portal`
const SP = 'C:/Users/Safar/AppData/Local/Temp/claude/C--Users-Safar-Desktop-Cyclowareness--Vol2/66e61158-c161-4119-a251-69c6013bc3e9/scratchpad'
const OUT = `${SP}/experience`

const COMMON = `PROJECT: Cyclowareness (vendor Safarov Industries), a multi-tenant security-awareness LMS sold to banks and governments; it must look premium and be secure. App: ${P} (Next.js 16 App Router with webpack, React 19, TypeScript strict, Tailwind 4.3 CSS-first in src/app/globals.css, next-intl). Read ${R}/CLAUDE.md, ${P}/AGENTS.md (this Next.js differs from older versions) and the project skill ${R}/.claude/skills/cyclowareness-experience/SKILL.md plus the reference your task needs (animations.md for motion, lesson-engine.md for the player).
STATE (committed in a7990d3): 10 interface languages az en ru tr ro ka uk de fr ar (ar is right-to-left; helpers dirOf/langAttrs in src/i18n/config.ts; logical CSS only: ms/me/ps/pe/start/end/text-start…, enforced by tests/rtl-logical.test.ts; directional icons are mirrored by a CSS rule; @custom-variant rtl exists). Lessons exist in all 10 languages. Learning paths list labs after lessons; the module page was rebuilt. TTS clip pipeline exists (src/lib/tts/*, scripts/generate-narration.ts, src/server/narration.ts loadNarrationClips, useNarrator({ clips, volume }) in src/components/player/narrator.ts) but the player does not use it yet. AI subtitles API exists (POST /api/subtitles, src/server/subtitles.ts, src/lib/content/subtitle-languages.ts) but nothing in the UI calls it. The new cat mascot is integrated (Home "Play with Sel" card, decorative auto acts).
WORK IN PARALLEL: translators are editing messages/{tr,ro,ka,uk,de,fr,ar}/*.json and content/** right now; do not edit those. New UI strings go into messages/en, az and ru only (keys without dots, valid ICU; never write "Aİ" in Azerbaijani); a later stage of this workflow translates them into the 7 other languages.
MAPS (exact files and lines from an earlier read-only audit; the code has moved a little since): ${SP}/maps/design.md (tokens, motion plumbing, 22 places to add light, constraints), ${SP}/maps/player.md (player structure, narrator contract, the syllabus/volume/subtitles/TTS plan), ${SP}/maps/rtl.md.
NAVIGATION: from ${R}: graphify query "<question>" --budget 1500, graphify explain "<Symbol>".
SKILLS (Skill tool): design-taste-frontend (taste-skill), high-end-visual-design (soft-skill), ecc:motion-foundations, ecc:motion-patterns, ecc:make-interfaces-feel-better, agent-skills:frontend-ui-engineering, ecc:frontend-a11y, ecc:react-patterns, agent-skills:test-driven-development.
RULES (ponytail: smallest complete change): reuse what exists, match the surrounding code style, comment only the why; animate transform/opacity only (never filter/backdrop-filter; pre-blurred blobs that move); no new rAF loops except where a feature truly needs one; every glow colour from var(--brand)/var(--accent)/var(--brand-on) via color-mix (tenants rebrand); motion preference everywhere: data-motion full|calm|still and prefers-reduced-motion (still: nothing moves, the 100% keyframe is the resting state; calm: no looping light; bursts and fly-ups need a JS check and must not render); never motion-safe:/motion-reduce: (they ignore data-motion); decorative layers aria-hidden + pointer-events-none + print:hidden; nothing behind body text that hurts contrast; stay below the watermark/shield z-80/z-90; logical CSS only and direction-aware sweeps; hydration-safe (no Date.now/Math.random/window in render; useSyncExternalStore with server snapshots); accessible (labels, focus management, keyboard, no traps); mobile-first at 375 px; the lab VM (src/components/lab/**) keeps its own look. Never commit, never run db:* / seed / content:sync / npm run build, never start or stop a server: a dev server with seeded data is already running on http://localhost:3000 for screenshots (Playwright is installed in ${SP}/e2e: reuse its node_modules; sign in with the seed accounts of ${P}/scripts/seed-data.ts and SEED_PASSWORD from ${P}/.env.example, read in scripts only, never print it; the profile page has the language switcher; restore the account's language to az when you finish). The dev server is slow under load: allow long timeouts.
CHECKS (from ${P}): npm run typecheck; npx eslint src tests scripts --max-warnings=0; npx vitest run <your tests> (the full suite only where asked).`

const SCHEMA = { type: 'object', properties: {
  summary: { type: 'string' }, files: { type: 'array', items: { type: 'string' } }, shots: { type: 'array', items: { type: 'string' } },
  checks: { type: 'string' }, notes: { type: 'array', items: { type: 'string' } },
}, required: ['summary', 'files', 'shots', 'checks', 'notes'] }
const notes = (r) => r ? `${r.summary.slice(0, 1500)}\nNOTES: ${r.notes.join(' | ').slice(0, 2500)}` : '(failed)'

phase('Foundation')
const base = await retrying(`${COMMON}

YOUR TASK (foundation, alone): in globals.css add the light/motion tokens and keyframes (--animate-sweep, --animate-glow, --animate-aurora, --animate-burst, --animate-fly-up, a direction-aware shimmer, a soft "breathe" glow for current/active items), a @custom-variant for "motion allowed" keyed on html:not([data-motion=still]) and no reduced motion (and one for calm), the calm/still rules for every new loop, utility classes for a reusable aurora backdrop (2-3 pre-blurred brand/accent blobs that drift with transform), a one-shot light sweep, a spotlight hover (radial following --mx/--my, pointer-fine only) and a glow ring. Move CountUp from src/components/admin/overview-client.tsx to src/components/ui/ if it is still there (src/components/ui/count-up.tsx may already exist from an earlier partial run: check), and add one shared hook useMotion() returning "full" | "calm" | "still" (data-motion + reduced motion via useSyncExternalStore with a server snapshot and a MutationObserver like src/components/mascot/cat-mascot.tsx; generalise src/components/lab/vm/hooks.ts useStill instead of duplicating, keep its callers working). Add a small Burst component (CSS particles; renders nothing under calm/still) and an XP fly-up helper (Web Animations API from a source element to the header XP pill [data-tour="xp"]; no-op under calm/still). Tests for useMotion's snapshot logic and Burst's calm/still behaviour. Return summary, files, shots ([]), checks, notes (the exact class names, components and hooks the next agents must use).`, { label: 'foundation', phase: 'Foundation', schema: SCHEMA })
const API = base ? `FOUNDATION API (use it, do not reinvent): ${base.summary.slice(0, 1500)} | ${base.notes.join(' | ').slice(0, 2500)}` : '(foundation failed: build the minimum you need)'

phase('Build')
const build = await parallel([
  () => retrying(`${COMMON}
${API}

YOUR TASK (learner-side light): the owner asked for "very beautiful animations and luminous parts" in the portal. Do items 1, 2, 4, 5, 11, 12, 13, 15, 16 and 19 of the map's "Top places to add light" plus the cheap extras (EmptyState halo, success-toast edge glow, active nav pill glow): Home Continue hero (aurora + one-time sweep; do not touch the mascot card), ProgressBar opt-in shimmer, Ring fill-on-load and glow at 100%, streak flame glow with a gentle flicker when streak > 0, badges glow + hover sheen, level card aurora, learner league podium (laurel glow on first place, reward glow on my row), path timeline current-node halo and spine gradient, catalog and lab card spotlight hover, brand-tinted skeleton. Files you own: src/app/(learner)/app/page.tsx (not the HomeMascot block), (learner)/layout.tsx, (learner)/progress/**, (learner)/league/**, (learner)/lab/(index)/**, (learner)/learn/(catalog)/catalog-view.tsx (card markup only), src/components/learner/path-timeline.tsx, src/components/ui/{progress,skeleton,layout,toast}.tsx, src/components/shell/learner-nav.tsx. Screenshot Home, Progress, League, Learn catalog and Lab at 1366 and 375 px with data-motion full and still (in az and in ar) into ${OUT}/learner and look at them; fix what looks wrong. Return summary, files, shots, checks, notes.`, { label: 'light-learner', phase: 'Build', schema: SCHEMA }),

  () => retrying(`${COMMON}
${API}

YOUR TASK (admin, landing and sign-in light): items 14, 17, 18, 20, 21 and 22 of the map plus anything equivalent in the admin dashboard that clearly benefits: admin league TV first-place glow and sweep, admin KPI strip top-edge light line and one sweep after CountUp, AreaChart draw-in and a glowing last point (keep HiddenTable; RTL-correct), landing hero aurora behind the phone, a scan line across the grid floor and the phone-screen glint/sheen from docs/audit/01-design-tokens.md (stage keyframes), the landing demo CTA brand hover shadow (no extra motion on buttons in general), auth brand panel blob drift. Files you own: src/app/(admin)/** except the learning-path pages, src/components/admin/**, src/components/ui/charts.tsx, src/components/site/** except scroll-cat.tsx and perch.ts, src/app/(auth)/brand-panel.tsx (not the mascot). Screenshot the admin overview, admin league, the landing (az, en and ar) and sign-in at 1366 and 375 px, full and still, into ${OUT}/admin and look at them; fix what looks wrong. Return summary, files, shots, checks, notes.`, { label: 'light-admin-landing', phase: 'Build', schema: SCHEMA }),

  () => retrying(`${COMMON}
${API}

YOUR TASK: the lesson player experience. The owner: "On the training page the structure is thin: there should be a syllabus at the side that opens and closes, and the language must work without errors. Volume up and down, subtitles in different languages (for example a language we have not added, shown as subtitles under an English training), and every other function a training needs." Files you own: src/components/player/** (player.tsx, scenes.tsx, narrator.ts only for wiring, tutor-panel.tsx, voice-notice.tsx, resume.ts and new files), src/app/(focus)/learn/[slug]/[lessonId]/**, messages/{en,az,ru}/player.json, tests for them.
Build, following ${SP}/maps/player.md (1)-(3) and the UX gaps it lists:
1) Collapsible syllabus: from lg up an inline-start aside (about 20rem) that collapses to a slim rail (state persisted in localStorage like cy:speed); below lg a drawer opened from a header button (focus trap, Escape, return focus; a slide-in that respects RTL and motion). Content: module title and progress, the module's lessons (done, current, not started; minutes; links), the current lesson's scenes (type label from a new player.sceneType.* group plus a short title: intro/simulation/scenario titles, or the prompt, or the first beat cut short) with the current scene highlighted; jumping only to scenes already reached (add maxIndex to SavedLesson with tests), never past the furthest scene, so completeLessonAction cannot be gamed.
2) Header controls (compact, grouped, keyboard reachable): play/pause for narration wherever it applies; volume slider + mute (persist cy:volume; Web Speech utterance volume and the audio element volume); a speed menu 0.75-2 with an Intl-formatted label; subtitles on/off and a subtitle-language menu: "Same as narration", the 10 shipped languages (from the lesson's lesson_contents rows: pass the chosen row's caption map from the page or fetch it through a small server action when the learner changes it, without reloading the lesson), and "More languages…" (the allowlist from src/lib/content/subtitle-languages.ts, shown only when the ai_tutor feature is on; calls POST /api/subtitles with loading and error states; cache per lesson+language in memory). Captions render as a bar above the scene's bottom row with langAttrs(captionLang); progress through the caption by word fraction; they render as text only. A transcript panel: every spoken line of the current lesson in the narration language (and the subtitle language beside it when chosen), the current line highlighted, click to replay that line. A fullscreen toggle (reuse the pattern of src/components/admin/fullscreen-button.tsx). Keyboard shortcuts: Space play/pause, ArrowLeft/ArrowRight previous/next (mirrored in RTL), M mute, C captions, T transcript, S syllabus, ? opens a shortcuts dialog; never steal keys from inputs, sliders, menus or the tutor panel.
3) Natural voice: in the lesson page call loadNarrationClips(lessonKey, contentLocale) and pass the clips to the player; useNarrator gets clips and volume; when there is neither a clip nor a device voice for the language keep the VoiceNotice (its text names Edge's natural voices for every language, not only az/ru).
4) Player light touches using the foundation (honour still/calm): a glowing leading edge on the top progress bar, a Burst plus the XP fly-up toward the header XP pill on the done screen, a safe-tone glow on a correct-answer feedback card and correct choice, a one-shot pulse on the simulation frame.
5) The map's "Other UX gaps": closing the tutor stops its reading; no narration of UI strings when the voice is missing; verify the RTL swipe and arrow-key behaviour.
Test what has logic (resume maxIndex, caption map building from two locale rows, shortcut mapping incl. RTL, volume persistence). Then open a lesson on the :3000 dev server as a learner in az, ar and de (desktop and 375 px): use the syllabus, change volume, speed, subtitles (a shipped language and, if the AI key is configured, one other), open the transcript and the shortcuts dialog; screenshot into ${OUT}/player and fix what is wrong. Return summary, files, shots, checks, notes.`, { label: 'player', phase: 'Build', schema: SCHEMA }),
])

const CRIT = { type: 'object', properties: { verdict: { type: 'string' }, score: { type: 'number' }, fixes: { type: 'array', items: { type: 'object', properties: { where: { type: 'string' }, problem: { type: 'string' }, fix: { type: 'string' }, priority: { type: 'string', enum: ['must', 'should', 'nice'] } }, required: ['where', 'problem', 'fix', 'priority'] } } }, required: ['verdict', 'score', 'fixes'] }
phase('Critique')
const crit = await retrying(`${COMMON}

YOU ARE A FRESH-EYES SENIOR PRODUCT DESIGNER (premium SaaS, motion) AND ACCESSIBILITY/PERFORMANCE REVIEWER; you did not build this. Do not edit project files. Reports of the three builders:
[light-learner] ${notes(build[0])}
[light-admin-landing] ${notes(build[1])}
[player] ${notes(build[2])}
Shoot fresh screenshots from the :3000 dev server (1366 and 375 px; az and ar; data-motion full and still; for motion, 4 frames over 1.5 s on Home and the landing hero; the lesson player with the syllabus open, captions on and the transcript open) into ${OUT}/critique and look at them. Judge against the request (beautiful animations, luminous parts; a complete, clear lesson player with syllabus, volume, subtitles) and taste: is the light tasteful and coherent, does it guide attention, anything cheap or gimmicky, banding, muddy colours, contrast loss on text, layout shift, anything moving under still/calm, anything visible in print, RTL problems, player controls that are confusing, cramped at 375 px, unlabelled or unreachable by keyboard? Read the diffs (git diff) for animation of non-composited properties. Return a verdict, a 1-10 score and prioritised concrete fixes with the file for each.`, { label: 'critique', phase: 'Critique', schema: CRIT })

phase('Refine')
const refine = crit && crit.fixes.length ? await retrying(`${COMMON}

REFINE: a fresh-eyes designer scored the work ${crit.score}/10: ${crit.verdict}
Fixes (do every must and should, and the cheap nice ones): ${JSON.stringify(crit.fixes).slice(0, 14000)}
Re-shoot the affected screens into ${OUT}/refine and look at them. Run typecheck, eslint and the tests for the files you touch. Return summary, files, shots, checks, notes.`, { label: 'refine', phase: 'Refine', schema: SCHEMA }) : null

phase('Integrate')
const integrate = await retrying(`${COMMON}

YOU ARE THE INTEGRATOR. Reports:
[foundation] ${notes(base)}
[light-learner] ${notes(build[0])}
[light-admin-landing] ${notes(build[1])}
[player] ${notes(build[2])}
[refine] ${notes(refine)}
1) Run typecheck, eslint (zero warnings) and the full vitest suite; fix every failure except the i18n parity tests for the new keys in the 7 translated languages.
2) Then translate every message key that exists in messages/en but is missing in messages/{tr,ro,ka,uk,de,fr,ar} (find them with node "${SP}/check-messages.mjs" <lang>) into those 7 languages yourself, as a senior native localiser of each language would: by meaning, natural and concise UI text, the register and terms of the rest of that file and ${SP}/glossaries/<lang>.md, the same ICU placeholders and tags, CLDR plural categories (tr one other; ro one few other; ka one other; uk one few many other; de one other; fr one many other; ar zero one two few many other), typographic apostrophes next to ICU syntax, French no-break spaces as in the file, Arabic placeholders holding Latin text wrapped in U+2068…U+2069 like the rest of the ar file; keep each file's formatting and line endings and the key order of en. Translators may be editing other keys in these files right now: Edit only the lines you add.
3) Run node "${SP}/check-messages.mjs" <lang> for all 7 and the full vitest suite again; everything must pass. Return summary, files, shots ([]), checks (exact counts), notes.`, { label: 'integrate', phase: 'Integrate', schema: SCHEMA })

phase('Review')
const REVIEW = { type: 'object', properties: { findings: { type: 'array', items: { type: 'object', properties: { file: { type: 'string' }, line: { type: 'number' }, severity: { type: 'string', enum: ['high', 'medium', 'low'] }, problem: { type: 'string' }, fix: { type: 'string' } }, required: ['file', 'severity', 'problem', 'fix'] } }, summary: { type: 'string' } }, required: ['findings', 'summary'] }
const FOCUS = `Scope: everything this workflow changed (git diff against HEAD a7990d3, excluding messages/{tr,ro,ka,uk,de,fr,ar} and content/** which translators own): the light/motion foundation and its uses, the lesson player (syllabus, controls, captions, AI subtitles UI, transcript, shortcuts, clips wiring), and the gap-fill keys. Look for real bugs: broken narration/caption sync, stale closures, leaked timers/listeners/audio elements, hydration mismatches, keyboard traps, focus loss, shortcuts firing inside inputs, RTL mistakes, scene jumping past unanswered scenes, XSS through captions or AI subtitles (must render as text), unbounded AI calls or cost abuse, authorization gaps (another tenant's lesson, the ai_tutor feature), memory growth, animation of non-composited properties, anything moving under still/calm, missing tests. Verified, concrete findings only, with file and line; no style nits.`
const reviews = await parallel([
  () => retrying(`${COMMON}

YOU ARE AN INDEPENDENT SENIOR CODE REVIEWER (second opinion in place of Codex, whose CLI crashes on this machine). Do not edit files. ${FOCUS}`, { label: 'review:code', phase: 'Review', schema: REVIEW, agentType: 'agent-skills:code-reviewer' }),
  () => retrying(`${COMMON}

YOU ARE AN INDEPENDENT SECURITY REVIEWER. Do not edit files. ${FOCUS}`, { label: 'review:security', phase: 'Review', schema: REVIEW, agentType: 'ecc:security-reviewer' }),
  () => retrying(`${COMMON}

YOU ARE AN INDEPENDENT REACT REVIEWER. Do not edit files. ${FOCUS}`, { label: 'review:react', phase: 'Review', schema: REVIEW, agentType: 'ecc:react-reviewer' }),
])
const findings = reviews.filter(Boolean).flatMap((r) => r.findings)
log(`review: ${findings.length} findings (${findings.filter((f) => f.severity === 'high').length} high)`)

phase('Fix')
const fix = await retrying(`${COMMON}

FIX THE REVIEW FINDINGS (verify each first; reviewers can be wrong; skip false ones with a reason). Findings:
${JSON.stringify(findings).slice(0, 16000) || '(none)'}
Then run typecheck, eslint (zero warnings), node "${SP}/check-messages.mjs" <lang> for the 7 translated languages, and the full vitest suite; everything must pass. Return summary, files, shots ([]), checks (exact counts), notes (each finding: fixed / not a bug and why).`, { label: 'fix', phase: 'Fix', schema: SCHEMA })
return { base, build, crit, refine, integrate, reviews: reviews.map((r) => r && r.summary), findings: findings.length, fix }
