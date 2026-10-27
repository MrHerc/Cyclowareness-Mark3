export const meta = {
  name: 'light-polish',
  description: 'In an isolated workspace: portal-wide light (glow, sweeps, aurora, shimmer, spotlight) and celebratory motion that respects full/calm/still, checked visually by a fresh-eyes design critic and an accessibility/performance reviewer',
  phases: [
    { title: 'Foundation', detail: 'motion and light tokens, keyframes, shared hooks' },
    { title: 'Apply', detail: 'learner side and admin/landing side in parallel' },
    { title: 'Critique', detail: 'screenshots at desktop and 375 px, full/calm/still, design critic' },
    { title: 'Refine', detail: 'apply critique; a11y and performance review' },
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
const R = `${SP}/lightws`
const P = `${R}/portal`
const OUT = `${SP}/light-shots`

const COMMON = `NOTE: an earlier run of exactly this task was cut off by a usage limit; its partial edits may already be in the files. Inspect the current state first (git diff, the files you own) and continue from there instead of redoing or duplicating work.
WORKSPACE: ${R} is an ISOLATED COPY of the repository (node_modules is a junction to the real one). Other agents are converting the real tree to 10 languages/right-to-left and building other features; your changes will be 3-way merged into it afterwards. Work ONLY inside ${R}; never touch C:/Users/Safar/Desktop/Cyclowareness- Vol2. Keep diffs tight (add classes and small wrappers; do not reformat or restructure code you do not need to change), so the merge stays clean.
PROJECT: Cyclowareness (vendor Safarov Industries), a security-awareness LMS for employees. App: ${P} (Next.js 16, React 19, Tailwind 4.3 CSS-first in src/app/globals.css, next-intl). Read ${R}/CLAUDE.md, ${P}/AGENTS.md, ${SP}/maps/design.md (current tokens, motion plumbing, the 22 places to add light with exact files, and the constraints) and ${R}/.claude/skills/cyclowareness-experience/references/animations.md.
THE OWNER'S REQUEST: "Add very beautiful animations and luminous (bright, glowing) parts to the portal." Tasteful, premium, calm confidence: light as a reward and a guide, never noise; a security product for banks and governments must still feel trustworthy.
RULES (from the map; non-negotiable): animate transform/opacity only (pre-blurred blobs that move; never animate filter/backdrop-filter); no new rAF loops; every glow colour from var(--brand)/var(--accent)/var(--brand-on) via color-mix (tenants can rebrand); motion preference: data-motion full|calm|still and prefers-reduced-motion: still users see no motion (the global still rule stops loops at their 100% keyframe, so the 100% frame must be the resting state: sweeps end off-element at opacity 0), calm users get no looping light (add new loops to the calm rule), bursts/fly-ups need a JS still/calm check and must not render; do not use motion-safe:/motion-reduce: (they ignore data-motion); decorative layers aria-hidden + pointer-events-none + print:hidden; nothing under body text that hurts contrast; z-order below the watermark/shield (z-80/z-90); RTL: use logical CSS only (ms/me/ps/pe/start/end/text-start; no physical left/right classes) and direction-aware sweeps (a CSS var flipped under [dir=rtl]); the lab VM (src/components/lab/**) keeps its own look (only vm/debrief.tsx may celebrate). Do NOT edit: src/components/player/** and the player route (a later step), src/components/mascot/** (another workflow), the learning-path pages and src/app/(learner)/learn/[slug]/** (another workflow), messages/** except adding a key in en/az/ru if you truly need text (you should not).
SKILLS: load with the Skill tool: design-taste-frontend (taste-skill), high-end-visual-design (soft-skill), ecc:motion-foundations, ecc:motion-patterns, ecc:make-interfaces-feel-better, agent-skills:frontend-ui-engineering, ecc:frontend-a11y.
VISUAL CHECK: you may run a dev server for this workspace ONLY on port 3410: from ${P} run once "npm run db:migrate && npm run db:seed" (this workspace has its own .data; never the real one), then start "npx next dev -p 3410" in the background with APP_URL=http://localhost:3410, sign in with the seed accounts in ${P}/scripts/seed-data.ts and SEED_PASSWORD from ${P}/.env.example (read it in scripts only; never print it), and take screenshots with Playwright (installed in ${SP}/e2e; reuse its node_modules) into ${OUT}. Stop your dev server when you finish. Never use ports 3000, 3100, 3200.
CHECKS (from ${P}): npm run typecheck; npx eslint src tests --max-warnings=0; npx vitest run.`

const SCHEMA = { type: 'object', properties: {
  summary: { type: 'string' }, files: { type: 'array', items: { type: 'string' } }, shots: { type: 'array', items: { type: 'string' } },
  checks: { type: 'string' }, notes: { type: 'array', items: { type: 'string' } },
}, required: ['summary', 'files', 'shots', 'checks', 'notes'] }

phase('Foundation')
const base = await retrying(`${COMMON}

YOUR TASK (foundation, alone): in globals.css add the light/motion tokens and keyframes (--animate-sweep, --animate-glow, --animate-aurora, --animate-burst, --animate-fly-up, a shimmer that respects direction, a soft "breathe" glow for current/active items), a @custom-variant for "motion allowed" keyed on html:not([data-motion=still]) and not reduced motion (and one for calm), the calm/still rules for every new loop, utility classes for a reusable aurora backdrop (2-3 pre-blurred brand/accent blobs that drift with transform), a light sweep (one-shot on mount), a spotlight-hover (radial following --mx/--my, pointer-fine only) and a glow ring. Move CountUp from admin/overview-client.tsx to src/components/ui/ (it imports admin actions there) and add a tiny shared hook useMotion() returning "full" | "calm" | "still" (data-motion + reduced motion, via useSyncExternalStore with a server snapshot, MutationObserver like cat-mascot.tsx) unless an equivalent exists (src/components/lab/vm/hooks.ts useStill: generalise rather than duplicate). Add a small Burst component (CSS particles, renders nothing under calm/still) and a SpotlightCard wrapper if useful. Tests for useMotion and the calm/still behaviour of Burst. Return summary, files, shots (none yet), checks, notes (the exact class names and components the next agents must use).`, { label: 'foundation', phase: 'Foundation', schema: SCHEMA })

phase('Apply')
const API = base ? `Foundation API (use it, do not reinvent): ${base.summary.slice(0, 1500)} | ${base.notes.join(' | ').slice(0, 2500)}` : '(foundation failed: build what you need minimally)'
const applied = await parallel([
  () => retrying(`${COMMON}
${API}

YOUR TASK (learner side): items 1, 2, 4, 5, 11, 12, 13, 15, 16, 19 of the map's "Top places to add light" plus the cheap extras (EmptyState halo, success toast edge glow, active nav pill glow): Home Continue hero (aurora + one-time sweep), ProgressBar opt-in shimmer, Ring fill-on-load and glow at 100%, streak flame glow with a gentle flicker when streak > 0, badges glow + hover sheen, level card aurora, learner league podium (laurel glow on first, reward glow on my row), path timeline current-node halo and spine gradient, catalog/lab card spotlight hover, brand-tinted skeleton. Files: src/app/(learner)/app/**, (learner)/layout.tsx, progress, league, lab index, catalog-view.tsx (only the card markup; another agent changes its filter logic), learner/path-timeline.tsx, ui/progress.tsx, ui/skeleton.tsx, ui/layout.tsx EmptyState, ui/toast.tsx, shell/learner-nav.tsx. Take screenshots (desktop 1366 and mobile 375, full and still) of Home, Progress, League, Learn catalog, Lab into ${OUT}/learner and look at them. Return summary, files, shots, checks, notes.`, { label: 'apply-learner', phase: 'Apply', schema: SCHEMA }),
  () => retrying(`${COMMON}
${API}

YOUR TASK (admin, landing, auth): items 14, 17, 18, 20, 21, 22 of the map plus anything equivalent in the admin dashboard that clearly benefits: admin league TV first-place glow and sweep, admin KPI strip top-edge light line and one sweep after CountUp, AreaChart draw-in and a glowing last point (keep HiddenTable), landing hero aurora behind the phone and a scan line across the grid floor and the phone screen glint/sheen from the spec (docs/audit/01-design-tokens.md stage keyframes), the landing demo CTA brand hover shadow (no extra motion on buttons in general), auth brand panel blob drift. Files: src/app/(admin)/** (not paths pages), src/components/admin/**, src/components/ui/charts.tsx, src/components/site/** (landing; not scroll-cat.tsx or perch.ts), src/app/(auth)/** (brand panel only). Take screenshots (desktop and 375 px, full and still) of the admin overview, admin league, landing (az and en) and sign-in into ${OUT}/admin and look at them. Return summary, files, shots, checks, notes.`, { label: 'apply-admin-landing', phase: 'Apply', schema: SCHEMA }),
])

const CRIT = { type: 'object', properties: { verdict: { type: 'string' }, score: { type: 'number' }, fixes: { type: 'array', items: { type: 'object', properties: { where: { type: 'string' }, problem: { type: 'string' }, fix: { type: 'string' }, priority: { type: 'string', enum: ['must', 'should', 'nice'] } }, required: ['where', 'problem', 'fix', 'priority'] } } }, required: ['verdict', 'score', 'fixes'] }
phase('Critique')
const crit = await retrying(`${COMMON}

YOU ARE A FRESH-EYES SENIOR PRODUCT DESIGNER (premium SaaS, motion design) and an accessibility/performance reviewer. Do not edit files. Start the workspace dev server on 3410 if it is not running, and shoot fresh screenshots (desktop 1366 and 375 px; data-motion full and still; also a short sequence of 4 frames over 1.5 s on Home and the landing hero to judge motion) into ${OUT}/critique. Judge against the request (beautiful animations, luminous parts) and taste: is the light tasteful and coherent, does it guide attention, any cheap/gimmicky effect, banding, muddy colours on a light/dark brand, contrast loss on text, layout shift, jank risk (animating layout or filters), anything still moving under still/calm, anything visible in print, RTL problems (look at the CSS: physical directions)? Check git-style diffs against ${SP}/featws-base for animation of non-composited properties. Return a verdict, a 1-10 score and prioritised concrete fixes.`, { label: 'critique', phase: 'Critique', schema: CRIT, model: 'sonnet' })

phase('Refine')
const refine = crit && crit.fixes.length ? await retrying(`${COMMON}

REFINE: a fresh-eyes designer scored the light pass ${crit.score}/10: ${crit.verdict}
Fixes (do every must and should, cheap nice ones too): ${JSON.stringify(crit.fixes).slice(0, 12000)}
Re-shoot the affected screens into ${OUT}/refine, run the checks, stop the dev server on 3410 at the end. Then write ${SP}/light-polish/changed-files.txt (create the folder): every file this workspace changed or added relative to ${SP}/featws-base (compare contents; one relative path per line like portal/src/app/globals.css; exclude node_modules, .next, .data, graphify-out). Return summary, files, shots, checks, notes.`, { label: 'refine', phase: 'Refine', schema: SCHEMA }) : null
return { base, applied, crit, refine }
