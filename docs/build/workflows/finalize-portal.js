export const meta = {
  name: 'finalize-portal',
  description: 'Opus: end-to-end functional sweep of the whole portal in 10 languages (learner, admin, public/auth, RTL/i18n) on :3000, fix every confirmed defect, verify again; documentation (ADRs, progress, open questions, skill references) in parallel',
  phases: [
    { title: 'Sweep', detail: 'four finders with Playwright, plus the docs writer' },
    { title: 'Fix', detail: 'two fixers split by file ownership' },
    { title: 'Verify', detail: 'smoke in 10 languages and full checks' },
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
const OUT = `${SP}/finalize`

const COMMON = `PROJECT: Cyclowareness (vendor Safarov Industries), a multi-tenant security-awareness LMS sold to banks and governments. App: ${P} (Next.js 16 App Router, React 19, TypeScript strict, Tailwind 4.3, next-intl). Read ${R}/CLAUDE.md, ${P}/AGENTS.md and ${R}/.claude/skills/cyclowareness-experience/SKILL.md.
STATE: the portal runs in 10 interface languages az en ru tr ro ka uk de fr ar (ar right-to-left), all 106 lessons exist and were verified in every language, learning paths list labs after the lessons, the module page and the lesson player were rebuilt (collapsible syllabus, volume, speed, captions in 10 languages plus AI subtitles, transcript, shortcuts, natural-voice clips with Web Speech fallback), the cat mascot got new art and acts and a Home "Play with Sel" card, and portal-wide light/motion was added. Full suite: 81 files / 2621 tests pass. The owner wants the portal functionally finished and flawless in every language.
A DEV SERVER with seeded demo data runs on http://localhost:3000 (slow under load: allow long timeouts). Playwright is installed in ${SP}/e2e (reuse its node_modules). Sign-in accounts: ${P}/scripts/seed-data.ts (role e-mails admin@, leader@, head@, analyst@, campaigns@, content@, learner@safarovindustries.com; learner leyla.ismayilova@safarovindustries.com); the password is SEED_PASSWORD in ${P}/.env.example (read it inside scripts only, never print it). The interface language is switched in Profile (learner) or the account menu/settings (admin); restore each account's language to az when you finish. Sign-in is two steps (e-mail, then password). Two-step verification is off for the demo tenant. Never run db:* / seed / content:sync / npm run build, never start or stop servers, never commit.
RULES for fixes: smallest complete change (ponytail), match the code style, logical CSS only (tests/rtl-logical.test.ts), every UI string in messages for ALL 10 languages (translate new strings by meaning with ${SP}/glossaries/<lang>.md; keys without dots; ICU valid; never "Aİ" in Azerbaijani), motion preference honoured, hydration-safe, accessible. CHECKS (from ${P}): npm run typecheck; npx eslint src tests scripts --max-warnings=0; node "${SP}/check-messages.mjs" <lang> for tr ro ka uk de fr ar; npx vitest run.`

const FIND = { type: 'object', properties: {
  defects: { type: 'array', items: { type: 'object', properties: {
    where: { type: 'string', description: 'URL/page and language' }, file: { type: 'string', description: 'best guess of the source file' },
    severity: { type: 'string', enum: ['high', 'medium', 'low'] }, problem: { type: 'string' }, evidence: { type: 'string', description: 'what you saw: screenshot path, console error, text' }, fix: { type: 'string' },
  }, required: ['where', 'severity', 'problem', 'evidence', 'fix'] } },
  summary: { type: 'string' },
}, required: ['defects', 'summary'] }
const SCHEMA = { type: 'object', properties: { summary: { type: 'string' }, files: { type: 'array', items: { type: 'string' } }, checks: { type: 'string' }, notes: { type: 'array', items: { type: 'string' } } }, required: ['summary', 'files', 'checks', 'notes'] }

const FINDER = (area) => `${COMMON}

YOU ARE AN END-TO-END QA ENGINEER. Do not edit project files (scripts and screenshots go to ${OUT}/<your area>). ${area}
For every page: watch the browser console and failed network requests, look for untranslated strings (English or Azerbaijani text in another language's UI), broken layout at 1366 px and 375 px, RTL problems in ar (mirroring, misplaced icons, overlapping text, wrong reading order of mixed Arabic/Latin), Georgian text rendered in Mtavruli capitals (forbidden), wrong number/date formats, dead buttons or links, errors on submit, missing focus states, and anything that looks broken or unfinished. Report only concrete, reproduced defects with evidence and the likely source file; no style opinions.`

phase('Sweep')
const [learner, admin, pub, rtl, docs] = await parallel([
  () => retrying(FINDER(`AREA: the learner journey, in az, en, ar and ka (sign in as leyla.ismayilova@ and learner@): Home (the Continue card, the cat card and its Play with Sel buttons, toy mouse, yarn, laser), the Learn catalog and its filters, a module page (What you will learn, syllabus, Practise it labs, path context), the lesson player end to end for at least two lessons of different scene types (syllabus open/close and drawer at 375 px, play/pause, volume, speed, captions in another shipped language, the transcript, the shortcuts dialog, every answer type, the done screen with XP), Learning paths (trainings then practice labs, locked/unlocked labs, Continue), the Lab (one game and one VM lab), Progress, League, Profile (switch through all 10 languages and back, motion Full/Calm/Still), certificates, policies sign-off, notifications, report a suspicious message, help.`), { label: 'find:learner', phase: 'Sweep', schema: FIND }),
  () => retrying(FINDER(`AREA: the admin console, in az, en and de (sign in as admin@; also briefly as head@ and content@): overview dashboard with KPIs and charts, people (list, filters, a person page, import/export dialogs), departments, assignments, learning paths editor (labs checkbox group, save), campaigns (wizard to the review step, without launching), reports (each kind, print view), risk, league TV, policies (open, translations), Studio/AI trainer (open, no AI calls), settings (every tab, especially Languages with all 10 and the notification templates in several languages), audit log, support.`), { label: 'find:admin', phase: 'Sweep', schema: FIND }),
  () => retrying(FINDER(`AREA: public and sign-in pages in ALL 10 languages: the landing /<lang> for az en ru tr ro ka uk de fr ar (the guided tour, language picker, FAQ, demo request form without submitting, the scroll cat), /legal/terms and /legal/privacy in each language (translation notice, structure), sign-in (both steps, error states with a wrong password once), forgot password page (do not submit), the offline page, robots/sitemap, /og/<lang> images (ar must not be broken), 404 and the error page.`), { label: 'find:public', phase: 'Sweep', schema: FIND }),
  () => retrying(FINDER(`AREA: language and right-to-left quality across the whole app: as leyla.ismayilova@ and admin@, switch to ar, then ka, uk and fr, and walk every main learner and admin page quickly. Find English or Azerbaijani leftovers (hard-coded strings in code, untranslated seed/demo content that should be translated, e-mail/notification previews), RTL layout bugs (anything physical: arrows pointing the wrong way, progress bars, charts, drawers, tooltips, the tour), bidi problems with Latin names, e-mails, URLs and numbers inside Arabic text, Georgian uppercase (Mtavruli) from CSS text-transform, Intl date/number formatting differences (Arabic digits must be 0-9), and the dropdown arrow of the house Select (src/components/ui/field.tsx: reported missing everywhere because its arbitrary bg-[url(...)] class is never generated).`), { label: 'find:i18n-rtl', phase: 'Sweep', schema: FIND }),
  () => retrying(`${COMMON}

YOU ARE THE TECHNICAL WRITER for this release. Edit only ${R}/docs/build/** (never docs/audit) and ${R}/.claude/skills/cyclowareness-experience/** and ${P}/README.md. Read docs/build/DECISIONS.md, PROGRESS.md, OPEN-QUESTIONS.md, RESUME.md and the workflow state ${SP}/OVERNIGHT-STATE.md (what was built since a7990d3 and before: 10 languages, RTL, translations and glossaries, security hardening, labs after lessons, module page, TTS pipeline, AI subtitles, player controls, mascot, light/motion), then read the code for facts (git diff --stat a7990d3; src/i18n/config.ts, src/lib/tts/*, scripts/generate-narration.ts, src/server/subtitles.ts, src/lib/domain/labs.ts, src/components/player/*, src/components/mascot/*, src/lib/motion.ts, src/components/ui/light.tsx).
Write, in the documents' existing language and style (Azerbaijani prose, concise): ADRs in DECISIONS.md for (1) ten interface languages with Arabic for Saudi Arabia replacing Italian, the locale code ar with Western digits and Gregorian dates, dirOf/langAttrs and logical CSS with its regression test; (2) the translation process (terminologist + native reviewer glossaries, translator + independent editor per batch, consistency passes, checker) and the decision to keep the stories in the Azerbaijani company world; (3) labs after lessons in learning paths (lab_ids, unlock rule, labs do not count toward certificates); (4) natural narration: ElevenLabs with-timestamps clips per sentence, manifests in content/narration, Web Speech fallback, cost estimate, voice choice by a native speaker; (5) AI subtitles for unshipped languages with ai_cache; (6) the lesson player structure (syllabus, controls, shortcuts, captions, transcript; maxIndex client-side only); (7) the storybook cat and decorative auto acts; (8) the light/motion foundation (tokens, variants, useMotion, Burst, Spotlight, flyToXp) and its still/calm rules; (9) the security hardening of 2026-10-27 (summarise the findings fixed and what was left open). A PROGRESS.md cycle entry. OPEN-QUESTIONS.md: the ElevenLabs key and native voice choice per language, the AI subtitles need ANTHROPIC_API_KEY, the legal texts still name Google Vertex AI (all 10 languages now), legal translations need a lawyer, native review of the new languages, Codex CLI crashing on this machine, the Turkish/Romanian/Ukrainian open terminology choices the editors listed in ${SP}/OVERNIGHT-STATE.md if any, server-side lesson completion check. Mark RESUME.md as finished (keep it as history like the earlier one). Update the skill references (lesson-engine.md: 10 languages, translation recipe 6.3 with the glossaries folder, narration/TTS recipe 6.6, captions/subtitles; mascot.md: new acts, auto, Home card, API; animations.md: the light/motion foundation; training-pipeline.md: labs in paths, module page) where they are now wrong. README: TTS section exists; add the 10 languages and how to generate narration. Return summary, files, checks ('docs only'), notes.`, { label: 'docs', phase: 'Sweep', schema: SCHEMA }),
])
const all = [learner, admin, pub, rtl].filter(Boolean).flatMap((r) => r.defects)
log(`sweep: ${all.length} defects (${all.filter((d) => d.severity === 'high').length} high)`)

phase('Fix')
const isAdminSide = (d) => /admin|super|settings|secops|report|campaign|people|studio|landing|site\/|\(site\)|legal|sign-in|auth|offline|og\/|sitemap|robots/i.test(`${d.file || ''} ${d.where}`)
const groups = [all.filter((d) => !isAdminSide(d)), all.filter(isAdminSide)]
const fixes = await parallel(groups.map((list, i) => () => list.length ? retrying(`${COMMON}

YOU FIX CONFIRMED DEFECTS FROM THE END-TO-END SWEEP (${i === 0 ? 'learner side, player, shared UI, CSS and i18n' : 'admin console, public site, legal, sign-in'}). Another fixer works on the ${i === 0 ? 'admin/public' : 'learner/shared'} list at the same time: stay in files that belong to your side; for a shared file (globals.css, ui/*, i18n config, messages) only fixer 1 edits it, and fixer 2 notes what it needs. Verify each defect first (QA can be wrong), fix the root cause once, add a small test where logic changed, re-check the page on :3000. Defects:
${JSON.stringify(list).slice(0, 24000)}
Run typecheck, eslint, the message check for the 7 translated languages and the vitest suites you touched. Return summary, files, checks, notes (each defect: fixed / not a defect and why / needs the other fixer).`, { label: `fix:${i === 0 ? 'learner-shared' : 'admin-public'}`, phase: 'Fix', schema: SCHEMA }) : Promise.resolve(null)))

phase('Verify')
const verify = await retrying(`${COMMON}

YOU ARE THE FINAL VERIFIER. Fix reports:
${fixes.filter(Boolean).map((f) => `${f.summary.slice(0, 1500)} NOTES: ${f.notes.join(' | ').slice(0, 2500)}`).join('\n')}
1) Finish anything a fixer left for the other side. 2) Run typecheck, eslint (zero warnings), node "${SP}/check-messages.mjs" <lang> for tr ro ka uk de fr ar, npx tsx scripts/check-lesson-locales.ts --coverage, and the full vitest suite; everything must pass. 3) Smoke-test on :3000 in each of the 10 languages: sign-in page, learner Home, a module page, one lesson's first scenes with the syllabus and captions, Learning paths, and the admin overview (screenshots at 1366 and 375 px into ${OUT}/verify); fix anything broken. Return summary, files, checks (exact counts), notes (anything not verified).`, { label: 'verify', phase: 'Verify', schema: SCHEMA })
return { found: all.length, high: all.filter((d) => d.severity === 'high').length, docs, fixes, verify }
