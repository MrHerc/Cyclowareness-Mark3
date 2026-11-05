export const meta = {
  name: 'player-and-mascot',
  description: 'Main tree, after the 10-locale phase and the workspace merges: lesson player with collapsible syllabus, volume, speed, subtitles (10 shipped + AI), transcript, shortcuts, natural-voice clips; mascot page integration (toys, laser, running, decorative auto); then Codex and ECC reviews',
  phases: [
    { title: 'Build', detail: 'player experience and mascot integration in parallel (file-disjoint)' },
    { title: 'Integrate', detail: 'typecheck, lint, tests, build' },
    { title: 'Review', detail: 'Codex (Claudex Loop) and ECC React reviewer' },
    { title: 'Fix', detail: 'confirmed findings' },
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
const R = '<repo>'
const P = `${R}/portal`
const SP = '<scratchpad>'
const LOG = `${SP}/player-mascot`

const COMMON = `PROJECT: Cyclowareness (vendor Safarov Industries), a security-awareness LMS sold to banks and governments. App: ${P} (Next.js 16 App Router, React 19, TypeScript strict, Tailwind 4.3, next-intl). Read ${R}/CLAUDE.md, ${P}/AGENTS.md and the project skill ${R}/.claude/skills/cyclowareness-experience/SKILL.md with the reference your task needs (lesson-engine.md for the player, mascot.md and animations.md for the mascot).
STATE: the portal now runs in 10 interface languages (az en ru tr ro ka uk de fr ar; ar is right-to-left; helpers dirOf/langAttrs in src/i18n/config.ts; logical CSS only: ms/me/ps/pe/start/end/text-start…, a regression test tests/rtl-logical.test.ts forbids physical classes; directional icons are mirrored by a CSS rule; the @custom-variant rtl exists). Lessons exist in all 10 languages. Also merged: learning paths with labs and a richer module page; the TTS clip pipeline (src/lib/tts/*, scripts/generate-narration.ts, src/server/narration.ts loadNarrationClips, useNarrator({clips, volume}) in src/components/player/narrator.ts); the AI subtitles API (POST /api/subtitles, src/server/subtitles.ts, the language allowlist module); the light/motion foundation (globals.css light tokens and keyframes, useMotion, Burst, CountUp in ui/, spotlight utilities); the new mascot engine with acts and imperative methods (src/components/mascot/cat/engine.d.ts: run, play('mouse'|'yarn'), laser(point|null), setAuto, MascotAct values in mapping.ts). Read the code of these before using them; their notes: ${SP}/merge-notes.md.
MAPS: ${SP}/maps/player.md (player structure, narrator contract, the syllabus/volume/subtitles/TTS plan with exact files), ${SP}/maps/mascot.md, ${SP}/maps/design.md.
NAVIGATION: from ${R}: graphify query "<question>" --budget 1500.
SKILLS (Skill tool): agent-skills:frontend-ui-engineering, ecc:frontend-a11y, ecc:react-patterns, design-taste-frontend (taste-skill), ecc:motion-patterns, agent-skills:test-driven-development.
RULES: smallest complete change (ponytail), match the code style, comment only the why; every UI string in messages/en, az and ru (keys without dots, ICU valid; the 7 other languages are filled by a later step, so tests/i18n.test.ts will report those keys missing: that is expected and must be the only failure); never "Aİ"; respect the motion preference (full/calm/still + reduced motion) in every JS animation; hydration-safe (no Date.now/Math.random/window in render; useSyncExternalStore with server snapshots); accessible (labels, focus management, keyboard, aria-current, no keyboard traps); mobile-first at 375 px; RTL-correct. Never commit, never run db:* or content:sync, never start/stop servers on 3000/3100/3200.
CHECKS (from ${P}): npm run typecheck; npx eslint src tests scripts --max-warnings=0; npx vitest run.`

const SCHEMA = { type: 'object', properties: { summary: { type: 'string' }, files: { type: 'array', items: { type: 'string' } }, checks: { type: 'string' }, notes: { type: 'array', items: { type: 'string' } } }, required: ['summary', 'files', 'checks', 'notes'] }

phase('Build')
const build = await parallel([
  () => retrying(`${COMMON}

YOUR TASK: the lesson player experience. The owner: "on the training page the structure is thin; there should be a syllabus at the side for trainings that can be opened and closed, and the language must work without errors. Volume up/down, subtitles in different languages (for example a language we have not added, shown as subtitles under an English training), and every other function a training needs." Files you own: src/components/player/** (player.tsx, scenes.tsx, narrator.ts only for wiring, tutor-panel.tsx, voice-notice.tsx, resume.ts, new files), src/app/(focus)/learn/[slug]/[lessonId]/** and messages/{en,az,ru}/player.json, plus tests for them.
Build, following ${SP}/maps/player.md (1)-(3) and the gaps it lists:
1) Collapsible syllabus: lg+ an inline-start aside (~20rem) that collapses to a slim rail (state persisted in localStorage like cy:speed); below lg a drawer opened from a header button (focus trap, Escape, return focus; slide-in that respects RTL and motion). Content: module title and progress, lessons of the module (done / current / not started, minutes, links), and the current lesson's scenes (type label from a new player.sceneType.* group, a short title: intro/simulation/scenario titles or the prompt or first beat cut short), with the current scene highlighted; jumping only to scenes already reached (add maxIndex to SavedLesson with tests), never past the furthest scene, so completeLessonAction cannot be gamed.
2) Controls in the header (compact, grouped, keyboard reachable): play/pause for narration everywhere it applies, volume slider + mute (persist cy:volume; Web Speech utterance volume and audio element volume), speed menu 0.75-2 with an Intl-formatted label, subtitles on/off and a subtitle-language menu: "Same as narration", the 10 shipped languages (from the lesson's lesson_contents rows, passed from the page as caption scenes for the chosen language only, changed via a server action or a small route without reloading the lesson), and "More languages…" (the allowlist from the subtitles module, only when the ai_tutor feature is on; calls POST /api/subtitles, shows loading/errors; caches per lesson+language in memory). Captions render as a bar above the scene's bottom row with langAttrs(captionLang); progress through the caption by word fraction. Transcript panel: all spoken lines of the current lesson in the narration language (and the subtitle language side by side when chosen), current line highlighted, click to replay a line. Fullscreen toggle (reuse the FullscreenButton pattern). Keyboard shortcuts: Space play/pause, ArrowLeft/ArrowRight previous/next (mirrored in RTL), M mute, C captions, T transcript, S syllabus, ? shows a shortcuts dialog; never steal keys from inputs, sliders or the tutor panel.
3) Natural voice: in page.tsx call loadNarrationClips(lessonKey, contentLocale) and pass clips to the player; useNarrator gets clips and volume; when no clip and no device voice exists for the language, keep the VoiceNotice (its text names Edge's natural voices for every language, not only az/ru).
4) Small light touches that belong to the player (use the foundation, honour still/calm): a glowing leading edge on the top progress bar, a celebratory Burst plus XP fly-up toward the header XP pill on the done screen, a safe-tone glow on a correct answer feedback card and correct choice, a one-shot pulse on the simulation frame.
5) Fix the gaps listed in the map's "Other UX gaps" (closing the tutor stops its reading; narrator not used for UI strings when the voice is missing; RTL swipe already handled by the RTL phase: verify).
Test what has logic (resume maxIndex, caption map building from two locale rows, shortcut mapping incl. RTL, volume persistence). Return summary, files, checks, notes.`, { label: 'player', phase: 'Build', schema: SCHEMA }),

  () => retrying(`${COMMON}

YOUR TASK: bring the new cat to life on the pages. The owner: "In the portal the mascot must do many different animations, for example sleeping, running, playing with a mouse, with a laser and so on, and show many cat traits." Files you own: src/components/mascot/mascot.tsx (keep the RTL gesture swap that is already there), src/components/learner/home-mascot.tsx and the Home page section that hosts it (src/app/(learner)/app/page.tsx: only the mascot block), src/app/(auth)/brand-panel.tsx (mascot only), src/app/(learner)/security/(overview)/page.tsx (mascot only), src/components/site/scroll-cat.tsx and landing mascot placements (mascot only), messages/{en,az,ru}/learner.json keys you add, tests.
Build: (1) decorative placements (Home, landing, auth panel, security overview) call setAuto(true) so the cat lives on its own with the new acts (sleep after long idle, stretch, groom, knead, yawn, tail flick, occasional play), calm uses the calm weights, still stays frozen; narration placements (player, tours, tutor) never auto. (2) On Home: a small "Play with Sel" control next to the cat (a compact menu or three icon buttons with labels): toy mouse, yarn ball, laser pointer. Laser is opt-in: when on, the pointer over the Home mascot card shows a small red dot (no flashing, contained to the card, off under calm/still, Escape or a button turns it off) and the cat chases it via cat.laser(point); the choice is not persisted beyond the session. Touch devices: tap to place the dot. (3) Running: now and then (decorative, full motion only, not more often than every few minutes) the cat runs across the Home mascot card using cat.run() while the host box translates with the Web Animations API (direction-aware in RTL), then sits again; hover/click still pets. (4) Make sure nothing on the canvas is text and everything respects the motion preference; check the 15 call sites still work (the map lists them). Screenshot Home at 1366 and 375 px in az and ar with Playwright (installed in ${SP}/e2e; start nothing on the reserved ports: if you need a server, use a production build already running on 3200 only if it exists, otherwise skip screenshots and say so). Return summary, files, checks, notes.`, { label: 'mascot-pages', phase: 'Build', schema: SCHEMA }),
])

phase('Integrate')
const notes = (r) => r ? `${r.summary.slice(0, 1500)}\nNOTES: ${r.notes.join(' | ').slice(0, 2500)}` : '(failed)'
const integrate = await retrying(`${COMMON}

YOU ARE THE INTEGRATOR. Reports:
[player] ${notes(build[0])}
[mascot-pages] ${notes(build[1])}
Run typecheck, eslint (zero warnings), the full vitest suite (the only acceptable failure: tests/i18n.test.ts reporting new player/learner keys missing in tr ro ka uk de fr ar) and npm run build; fix everything else. Write the list of new message keys (namespace.path) added in this phase to ${LOG}/new-keys.txt (create the folder). Return summary, files, checks, notes.`, { label: 'integrate', phase: 'Integrate', schema: SCHEMA })

phase('Review')
const REVIEW_SCHEMA = { type: 'object', properties: { findings: { type: 'array', items: { type: 'object', properties: { file: { type: 'string' }, line: { type: 'number' }, severity: { type: 'string', enum: ['high', 'medium', 'low'] }, problem: { type: 'string' }, fix: { type: 'string' } }, required: ['file', 'severity', 'problem', 'fix'] } }, summary: { type: 'string' } }, required: ['findings', 'summary'] }
const FOCUS = `Scope: the player (src/components/player/**, the lesson route) and the mascot page integration changed in this phase (git diff). Look for real bugs: broken narration/caption sync, stale closures, leaked timers/listeners/audio elements, hydration mismatches, keyboard traps, focus loss, shortcuts firing inside inputs, RTL mistakes, scene jumping that skips unanswered scenes, XSS through captions or AI subtitles (they must render as text), unbounded AI calls, memory growth, motion preference not honoured. Verified, concrete findings only, with file and line.`
const reviews = await parallel([
  () => retrying(`${COMMON}

YOU ARE A REVIEW COORDINATOR FOR CODEX (Claudex Loop). Do not edit files. Write the brief to ${LOG}/codex-brief.md (${FOCUS}) and run: codex.cmd exec -s read-only --skip-git-repo-check -C "${R}" "$(cat '${LOG}/codex-brief.md')" > "${LOG}/codex-review.txt" 2>&1 (up to 20 minutes; background and check). Verify each finding yourself; return confirmed ones and a summary with raised vs confirmed counts.`, { label: 'review:codex', phase: 'Review', schema: REVIEW_SCHEMA, model: 'sonnet' }),
  () => retrying(`${COMMON}

YOU ARE AN INDEPENDENT REACT REVIEWER. Do not edit files. ${FOCUS}`, { label: 'review:react', phase: 'Review', schema: REVIEW_SCHEMA, agentType: 'ecc:react-reviewer', model: 'sonnet' }),
])
const findings = reviews.filter(Boolean).flatMap((r) => r.findings)
phase('Fix')
const fix = findings.length ? await retrying(`${COMMON}

FIX THE REVIEW FINDINGS (verify each first; skip false ones with a reason): ${JSON.stringify(findings).slice(0, 14000)}
Re-run typecheck, eslint, vitest and npm run build. Return summary, files, checks, notes.`, { label: 'fix', phase: 'Fix', schema: SCHEMA }) : null
return { build, integrate, findings: findings.length, fix }
