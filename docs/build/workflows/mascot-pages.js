export const meta = {
  name: 'mascot-pages',
  description: 'Bring the new storybook cat to life on the pages: decorative auto acts, Play with Sel (toy mouse, yarn, laser), occasional run across Home; motion and RTL safe; checks',
  phases: [{ title: 'Build', detail: 'mascot page integration in the main tree' }],
}

// A usage limit ends an agent with no result: wait and retry instead of failing (limits reset within about 5 hours).
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
const SCHEMA = { type: 'object', properties: { summary: { type: 'string' }, files: { type: 'array', items: { type: 'string' } }, checks: { type: 'string' }, notes: { type: 'array', items: { type: 'string' } } }, required: ['summary', 'files', 'checks', 'notes'] }

phase('Build')
const result = await retrying(`PROJECT: Cyclowareness (security-awareness LMS). App: ${P} (Next.js 16, React 19, TypeScript strict, Tailwind 4.3 with logical CSS only, next-intl in 10 languages az en ru tr ro ka uk de fr ar; ar is right-to-left). Read ${R}/CLAUDE.md, ${P}/AGENTS.md, ${R}/.claude/skills/cyclowareness-experience/references/mascot.md and animations.md, and ${SP}/maps/mascot.md (call sites, motion handling).
STATE: the mascot engine was just rebuilt (cozy storybook art, better joints, new acts: sleep, stretch, yawn, groom, knead, slow blink, run with cat.run(), toy mouse cat.play('mouse'), yarn cat.play('yarn'), laser cat.laser(point|null), tail chase, roll, pounce, purr on stroke; scheduler with setAuto(true) and calm weights; MascotAct values extended in src/components/mascot/mapping.ts; the exact API is in src/components/mascot/cat/engine.d.ts and cat-mascot.tsx; its notes: ${SP}/mascot-notes.md). Read those first.
THE OWNER: "In the portal the mascot must do many different animations, for example sleeping, running, playing with a mouse, with a laser and so on, and show many cat traits. Finish the mascot."
YOUR TASK (files you own: src/components/mascot/mascot.tsx (keep its RTL gesture swap if present), src/components/learner/home-mascot.tsx and the Home page mascot block in src/app/(learner)/app/page.tsx, src/app/(auth)/brand-panel.tsx mascot only, src/app/(learner)/security/(overview)/page.tsx mascot only, src/components/site/scroll-cat.tsx and the landing mascot placements (mascot only), messages/{en,az,ru}/learner.json keys you add (the 7 other languages are filled later; tests/i18n.test.ts reporting only those new keys missing is expected), tests):
1) Decorative placements (Home, landing, auth panel, security overview) turn on the engine's own life (setAuto(true)): sleep after a long idle, stretch, groom, knead, yawn, tail flick, occasional play; calm uses calm weights; still stays frozen. Narration placements (player, tours, tutor panel) never auto.
2) Home: a compact "Play with Sel" control next to the cat (three labelled icon buttons or a small menu): toy mouse, yarn ball, laser pointer. Laser is opt-in: while on, the pointer over the Home mascot card shows a small red dot (no flashing, contained to the card, hidden under calm/still, Escape or the button turns it off; touch: tap to place the dot) and the cat chases it via cat.laser(point in the cat container's coordinates); not persisted beyond the page session.
3) Running: occasionally (decorative, full motion only, at most every few minutes) the cat runs across the Home mascot card with cat.run() while the host box translates with the Web Animations API, direction-aware in RTL, then sits; hover/click still pets.
4) Nothing drawn on the canvas is text; every JS animation honours the motion preference (data-motion full|calm|still and prefers-reduced-motion); hydration-safe; accessible (buttons labelled, canvas aria-hidden, focus visible); logical CSS only (tests/rtl-logical.test.ts).
5) Check all 15 <Mascot> call sites still compile and behave (the map lists them).
CHECKS (from ${P}): npm run typecheck; npx eslint src tests scripts --max-warnings=0; npx vitest run tests/mascot-cat.test.ts tests/rtl-logical.test.ts and any test you add. Never commit, never run db:* or content:sync, never start or stop servers on 3000/3100/3200. Return summary, files, checks, notes.`, { label: 'mascot-pages', phase: 'Build', schema: SCHEMA })
return result
