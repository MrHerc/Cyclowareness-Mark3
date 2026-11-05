export const meta = {
  name: 'mascot-storybook-cat',
  description: 'Cozy storybook cat: art pass and better joints, many new acts (sleep, run, toy mouse, laser, yarn, tail chase, roll, stretch, purr), scheduler; rendered and critiqued by a fresh-eyes art director, refined twice',
  phases: [
    { title: 'Art', detail: 'palette, line, light, fur, joints' },
    { title: 'Acts', detail: 'new behaviours, toys, laser, running, scheduler, API' },
    { title: 'Critique', detail: 'fresh-eyes art director on rendered sheets' },
    { title: 'Refine', detail: 'apply the critique, re-render, tests' },
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
const SP = '<scratchpad>'
const R = `${SP}/mascot-ws`
const P = `${R}/portal`
const OUT = `${SP}/cat-v2`

const COMMON = `NOTE: an earlier run of exactly this task was cut off by a usage limit; its partial edits may already be in the files. Inspect the current state first (git diff, the files you own) and continue from there instead of redoing or duplicating work.
WORKSPACE: ${R} is an ISOLATED COPY of the repository made for the mascot work only (node_modules is a junction to the real one); the real tree is being converted by other agents and your mascot files will be copied back afterwards. Work only inside ${R}; never touch <repo>.
PROJECT: Cyclowareness, a security-awareness LMS. Its mascot "AI Sel" is a cat drawn procedurally on Canvas 2D: ${P}/src/components/mascot/cat/engine.js (2139 lines, typed by engine.d.ts), cat/props.ts, mapping.ts, cat-mascot.tsx (the React wrapper). Design history and the owner's photo of their own cat (the model): ${R}/design/mascot-cat/ (README.md, reference.jpg, sheets, cat-shoot.mjs frame shooter, source/ = an older design copy).
READ FIRST: ${SP}/maps/mascot.md (a precise map of the rig, behaviours, scheduler, motion handling, call sites and an honest quality assessment, written an hour ago) and ${R}/.claude/skills/cyclowareness-experience/references/mascot.md and animations.md.
THE OWNER'S REQUEST (translated): "In the portal the mascot must do many different animations, for example sleeping, running, playing with a mouse, with a laser and so on; make the cat's joints more beautiful, specifically a cozy, realistic cat like one in a fairy tale, and let the cat show many of its cat traits."
ART DIRECTION: a cozy storybook cat, like a warm illustrated children's book: realistic cat anatomy and movement (believable joints: shoulder blade, elbow, wrist, paw with toe lobes; hips, hock; a neck that connects; soft fur silhouette with tufts on cheeks, chest ruff, tail), warm palette faithful to the owner's grey-white tabby (reference.jpg), soft key light and rim light, gentle ambient occlusion and a contact shadow, a coloured variable-width outline in a darker fur tone instead of a uniform slate stroke, subtle fur texture baked once (not drawn per stroke per frame). Keep the identity: AI Sel's indigo collar with the shield tag, expressive eyes and readable moods from 64 px to 200 px.
HARD CONSTRAINTS: keep the public prop API of <Mascot> and the engine API (createCat, do, setMood, play, lookAt, poke, setStill, renderAt, jump, ...) backward compatible: 15 call sites use it (list in the map). Performance on a low-end laptop: one shared rAF (exists), offscreen pause (exists), no per-frame allocations you can avoid, limited shadowBlur, a fur pattern cached in an offscreen canvas. Motion preference: still/prefers-reduced-motion = frozen pose with blinks only; calm = only sit, blink, groom, knead, sleep, slow tail; everything new must respect setStill and calm. Hydration: nothing at module load. Accessibility: the canvas stays aria-hidden. No text drawn on the canvas (replace 'mrr…' and 'z' with small non-verbal glyphs: hearts, a sleeping "z" shape drawn as a glyph is fine but not a font letter; or musical-note/bubble shapes), because the UI is in 10 languages including Arabic.
FILES YOU OWN: src/components/mascot/cat/** (engine.js, engine.d.ts, props.ts), src/components/mascot/mapping.ts, src/components/mascot/cat-mascot.tsx, tests/mascot-cat.test.ts, ${R}/design/mascot-cat/** (update README to say engine.js is now the single source of truth and the source/ copy is historical), and new files under src/components/mascot/. DO NOT edit src/components/mascot/mascot.tsx, home-mascot.tsx, the player, tours, landing or any other file: other agents are converting the whole app to right-to-left-safe CSS and 10 languages right now; page integration of the new acts happens in a later phase. Never commit, never start or stop the servers on 3000/3100/3200.
RENDERING FOR REVIEW: build a small harness in ${OUT} (create it) that loads the engine in a plain HTML page through a local static server or file URL with an ESM import (or bundle with esbuild from portal/node_modules) and uses renderAt(name, t, opts) to shoot PNG contact sheets with Playwright (Playwright is installed in ${SP}/e2e: reuse its node_modules; see design/mascot-cat/cat-shoot.mjs for the pattern): one sheet per behaviour (6-8 frames across its cycle), a moods sheet, a sizes sheet (64, 96, 160, 240 px) on light and dark backgrounds. Look at the PNGs yourself with the Read tool (it shows images) and judge them honestly against the art direction.
CHECKS: from ${P}: npx vitest run tests/mascot-cat.test.ts; npm run typecheck; npx eslint src/components/mascot tests/mascot-cat.test.ts --max-warnings=0 (engine.js is excluded from lint by config).`

const SCHEMA = { type: 'object', properties: {
  summary: { type: 'string' },
  files: { type: 'array', items: { type: 'string' } },
  sheets: { type: 'array', items: { type: 'string' }, description: 'absolute paths of the PNG sheets you rendered' },
  checks: { type: 'string' },
  notes: { type: 'array', items: { type: 'string' } },
}, required: ['summary', 'files', 'sheets', 'checks', 'notes'] }

phase('Art')
const art = await retrying(`${COMMON}

YOUR TASK (art and joints pass, draw code and rig only, no new behaviours yet): first shoot a BEFORE set of sheets into ${OUT}/before. Then implement the art direction and the rig upgrades from section 7 b and c of the map: warm palette from the reference photo; coloured variable-width outline; key/rim light; AO at chin, armpit, haunch, tail root; contact shadow; cached fur texture clipped to the body; lobed fur edges on chest ruff, cheeks, tail; a 3-bone front leg (humerus, radius, metacarpus) with a wrist and a paw with 4 toe lobes (claws only during swats); scapula bulge driven by the leg angle; neck ruff over the neck; a two-segment spine and a bodyRoll parameter (needed later for rolling on the back); a jaw hinge for yawn/meow; ear fold and swivel showing the outer ear; a slightly more realistic head-to-body ratio while staying cute. Shoot an AFTER set into ${OUT}/art, compare with BEFORE, iterate until the AFTER is clearly better at every size. Return summary, files, sheets, checks, notes.`, { label: 'art', phase: 'Art', schema: SCHEMA })

phase('Acts')
const acts = await retrying(`${COMMON}
The art pass is done: ${art ? art.summary.slice(0, 2500) : '(the art agent failed: do the art pass first)'}

YOUR TASK (behaviours): add these acts in the engine, each with BEH entry, poses, BEHAVIOUR_NAMES, CatBehaviour in engine.d.ts, a renderAt-able cycle, still/calm handling and a unit test where logic exists:
1. sleep: curled C-shape with visible slow breathing, occasional dreaming paw twitch and ear flick, a drawn "z" glyph rising (not a font letter); a deeper "loaf doze" variant.
2. stretch (front stretch with raised rear, then back stretch), yawn with the new jaw, groom (lick paw then wipe face), knead with alternating paws and half-closed eyes, slow blink, ear twitch, head tilt.
3. run across: a gallop gait added to GAITS (distance-driven footfalls) running in place while the host moves the box; expose cat.run({ dir, distancePx, onDone }) returning timings like jump(), so a page can translate the host box (pattern: ScrollCat + jump()).
4. toy mouse: a small grey toy mouse prop (drawToy-style, with a tiny 1D physics state: it skitters, the cat stalks, wiggles, pounces, bats it with the new paws); expose cat.play('mouse').
5. yarn ball: a red-wool yarn ball that rolls and unravels a little; the cat bats it; cat.play('yarn').
6. laser dot: cat.laser(target | null) where target is a point in the cat's container coordinates (page code will feed pointer positions); the cat tracks it with head and eyes, crouches, wiggles, pounces at it; when the target disappears it looks around puzzled. Respect calm (no pounce) and still (eyes only). Never flash.
7. tail chase (spin via theta), roll on the back (bodyRoll, belly up, paws curled, playful), pounce, purr when petted (existing pet) plus purr on a slow hover stroke over the body (hitTest).
8. scheduler: decorative placements will call setAuto(true): define mascot-mode auto weights that use the new acts (sit, groom, yawn, knead, stretch, slow blink, look, tail flick, sleep after a long idle, occasionally play with the mouse or yarn when the box is wide enough), calm weights (only sit, blink, groom, knead, sleep), never auto in narration placements (they never call setAuto). Box framing: acts that need more room (stretch, roll, run, toys) must fit the container (a "stage" aspect when the container is wider than tall; otherwise a compact version).
9. mapping.ts: extend MascotAct (e.g. "sleep" | "stretch" | "groom" | "knead" | "play-mouse" | "play-yarn" | "laser" | "chase-tail" | "roll" | "run"), ACT_INDEX and ACT_TO_CAT together; cat-mascot.tsx: pass new acts through the existing act prop and expose the new imperative methods via onCat (the type in engine.d.ts).
Shoot sheets for every new act into ${OUT}/acts and look at them; fix anything that looks wrong. Run the checks. Return summary, files, sheets, checks, notes (the exact API a page needs to use for running, toys and laser).`, { label: 'acts', phase: 'Acts', schema: SCHEMA })

const CRIT_SCHEMA = { type: 'object', properties: {
  verdict: { type: 'string' }, score: { type: 'number', description: '1-10 against the art direction' },
  fixes: { type: 'array', items: { type: 'object', properties: { act: { type: 'string' }, problem: { type: 'string' }, fix: { type: 'string' }, priority: { type: 'string', enum: ['must', 'should', 'nice'] } }, required: ['act', 'problem', 'fix', 'priority'] } },
}, required: ['verdict', 'score', 'fixes'] }

let last = acts
for (let round = 1; round <= 1; round++) {
  phase('Critique')
  const crit = await retrying(`${COMMON}

YOU ARE A FRESH-EYES ART DIRECTOR AND ANIMATOR (children's book illustration and character animation; you did not build this). Do not edit project files. Re-shoot fresh sheets yourself into ${OUT}/critique-${round} (every behaviour incl. the new ones, moods, sizes on light and dark), compare with the BEFORE sheets in ${OUT}/before and with the owner's cat photo ${R}/design/mascot-cat/reference.jpg, and judge honestly against the art direction and the owner's request: does it read as a cozy, realistic storybook cat? are the joints believable (shoulder, elbow, wrist, paw, hip, hock, neck, spine)? do the acts read instantly (sleeping, running, playing with a mouse, chasing a laser, yarn, tail chase, rolling, stretching, grooming, kneading, purring)? are there glitches (limb popping, intersecting parts, sliding feet, jitter, tail artefacts, wrong layering, text on canvas), weak timing or spacing, or anything that would look cheap at 64-96 px? Return a verdict, a 1-10 score and a prioritised list of concrete fixes (what, where in the cycle, how).`, { label: `critique-${round}`, phase: 'Critique', schema: CRIT_SCHEMA, model: 'sonnet' })
  if (!crit || (crit.score >= 9 && !crit.fixes.some((f) => f.priority === 'must'))) { log(`critique ${round}: ${crit ? crit.score : 'failed'}; stopping`); break }
  phase('Refine')
  last = await retrying(`${COMMON}

YOUR TASK (refine round ${round}): an independent art director reviewed the cat (score ${crit.score}/10): ${crit.verdict}
Fixes to make (do every "must" and "should", and the "nice" ones that are cheap):
${JSON.stringify(crit.fixes).slice(0, 12000)}
Re-shoot the affected sheets into ${OUT}/refine-${round}, look at them, iterate, run the checks. Return summary, files, sheets, checks, notes (keep the page-integration API notes from before: ${last ? last.notes.join(' | ').slice(0, 2000) : ''}).`, { label: `refine-${round}`, phase: 'Refine', schema: SCHEMA })
}
return { art, acts, final: last }
