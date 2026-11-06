export const meta = {
  name: 'implement-wps',
  description: 'Implement a list of work packages in isolated worktrees (Mythos/Opus), review each with two lenses, apply the fixes, return the branches for Fable to merge',
  phases: [
    { title: 'Implement', detail: 'one agent per work package in its own git worktree' },
    { title: 'Review', detail: 'two independent reviewers per package (correctness, security or product lens)' },
    { title: 'Fix', detail: 'the reviewed defects are fixed in the same worktree' },
  ],
}

// args: { repo, phase, wps: [{ id, title, model: 'mythos'|'opus'|'sonnet', brief, files: [], acceptance: [], security: bool }] }
const REPO = args.repo
const MODELS = { mythos: 'claude-mythos-5-1', opus: 'claude-opus-5-5', sonnet: 'claude-sonnet-5-5' }
const modelOf = (m) => MODELS[m] || MODELS.opus

// Resilience: a null result (usage limit, network, API error) waits 10 minutes and retries, up to 40 times.
async function retrying(prompt, opts) {
  for (let attempt = 1; attempt <= 40; attempt++) {
    const r = await agent(prompt, opts)
    if (r) return r
    log(`${opts.label}: no result (attempt ${attempt}), retrying in 10 minutes`)
    await new Promise((done) => setTimeout(done, 10 * 60 * 1000))
  }
  return null
}

const RULES = `PROJECT: Cyclowareness (vendor Safarov Industries), a multi-tenant security-awareness platform sold to banks and governments. Repository: "${REPO}"; the app is portal/ (Next.js 16 App Router with webpack, React 19, TypeScript strict, Tailwind 4 CSS-first, next-intl with ten locales az en ru tr ro ka uk de fr ar — ar is right-to-left, Drizzle + PGlite locally, vitest). Read CLAUDE.md, portal/AGENTS.md and .claude/skills/cyclowareness-experience/SKILL.md first; the skill's references/ folder explains the lesson engine, training pipeline, mascot and motion.
HARD RULES
- FIRST, before anything else: your worktree must start from commit ${args.base || 'the orchestrator\'s HEAD'} of branch final-pass-2026-10-21 (the merged state of every earlier wave). Run "git merge-base --is-ancestor ${args.base || 'HEAD'} HEAD"; if it fails (the worktree was cut from an older commit), run "git reset --hard ${args.base || 'HEAD'}" and only then start. Never work on a tree that lacks that commit.
- You work in YOUR OWN git worktree (your current directory). Never touch the main checkout "${REPO}", never start or stop servers (a dev server runs on :3000 and the owner's copy on :3100), never run npm scripts that touch a database file (db:reset, db:seed, db:migrate, content:sync, demo, setup) — tests use an in-memory database. Never print the value of SEED_PASSWORD. Never edit docs/audit/. Never push.
- Before running any npm/npx command, give your worktree the dependencies by junction (Windows; cmd mklink is refused here, PowerShell works): from the worktree root run: powershell -NoProfile -Command "New-Item -ItemType Junction -Path 'portal\\node_modules' -Target '${REPO.replace(/\//g, '\\\\')}\\portal\\node_modules'" (skip if portal/node_modules already exists; it is ignored by git). Do not run npm install; if you truly need a new dependency, say so in your result instead of adding it.
- Smallest complete change that fully solves the package (no extra features, options or abstractions); match the surrounding style; comment only the why; fix a root cause once in shared code; keep validation, error handling and audit() entries; every UI string goes into portal/messages/{az,en,ru,tr,ro,ka,uk,de,fr,ar}/<ns>.json, translated by meaning with the glossaries in .claude/skills/cyclowareness-experience/references/glossaries/ (never "Aİ" in Azerbaijani; keys without dots; ICU braces escaped); logical CSS only (tests/rtl-logical.test.ts); hydration-safe client components; motion preference honoured; accessible.
- Schema changes are ADDITIVE: edit portal/src/server/db/schema.ts only. To run your tests, generate the migration locally from portal/ with "npx drizzle-kit generate --name <snake_name>" (tests/helpers/db.ts migrates an in-memory PGlite from drizzle/), but DO NOT COMMIT anything under portal/drizzle/: several packages change the schema in parallel and the orchestrator generates one migration per wave after the merge (never edit 0000_init.sql or a pushed migration). List your schema changes in the "migrations" field of your result.
- Do NOT edit docs/build/DECISIONS.md, docs/build/PROGRESS.md or docs/build/OPEN-QUESTIONS.md (many packages would conflict there): put the ADR text, the progress line and any open question for the owner in your result's "summary"/"left_open" fields; the orchestrator writes them. Other docs (README, docs/*.md, the skill references) you may edit when the brief says so.
- The verified gap register is at docs/build/REGISTER-2026-11-05.md: read the entries your brief names (evidence, verified smallest fix, files, risks) before you start.
- Every new branch of logic gets a test in portal/tests (vitest). Run, from portal/: "npm run typecheck", "npx eslint src tests scripts --max-warnings=0", and "npx vitest run <the test files you touched or added>" (the full suite is run by the orchestrator after the merge). All three must pass before you finish.
- Commit on your worktree's branch when done (git add the files you changed; one or a few commits; message in English; end the message with "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"). Do not commit node_modules or .next.
- Your final text is machine-read: return the structured output only.`

const IMPL_SCHEMA = { type: 'object', properties: {
  wp: { type: 'string' }, branch: { type: 'string', description: 'git branch name of your worktree (git rev-parse --abbrev-ref HEAD)' }, worktree: { type: 'string', description: 'absolute path of your worktree' },
  commits: { type: 'array', items: { type: 'string' } }, summary: { type: 'string', description: 'what you changed, file by file, and the decisions you took' },
  tests_added: { type: 'array', items: { type: 'string' } }, checks: { type: 'object', properties: { typecheck: { type: 'boolean' }, lint: { type: 'boolean' }, vitest: { type: 'boolean' } }, required: ['typecheck', 'lint', 'vitest'] },
  left_open: { type: 'string', description: 'anything in the brief you could not do, and why; needs for the owner (keys, decisions); new dependency requests' },
  migrations: { type: 'array', items: { type: 'string' } },
}, required: ['wp', 'branch', 'worktree', 'commits', 'summary', 'tests_added', 'checks', 'left_open', 'migrations'] }

const REVIEW_SCHEMA = { type: 'object', properties: { verdict: { type: 'string', enum: ['approve', 'changes_required'] }, findings: { type: 'array', items: { type: 'object', properties: { severity: { type: 'string', enum: ['blocker', 'major', 'minor', 'nit'] }, file: { type: 'string' }, line: { type: 'integer' }, problem: { type: 'string' }, fix: { type: 'string' } }, required: ['severity', 'file', 'problem', 'fix'] } }, notes: { type: 'string' } }, required: ['verdict', 'findings', 'notes'] }

const FIX_SCHEMA = { type: 'object', properties: { fixed: { type: 'array', items: { type: 'string' } }, rejected: { type: 'array', items: { type: 'string' }, description: 'findings you did not apply, each with the reason' }, commits: { type: 'array', items: { type: 'string' } }, checks: { type: 'object', properties: { typecheck: { type: 'boolean' }, lint: { type: 'boolean' }, vitest: { type: 'boolean' } }, required: ['typecheck', 'lint', 'vitest'] } }, required: ['fixed', 'rejected', 'commits', 'checks'] }

// A package may name its own reviewers ({ key, model: 'mythos'|'opus', prompt }); otherwise the two default lenses apply.
const LENSES = (wp) => Array.isArray(wp.lenses) && wp.lenses.length ? wp.lenses : wp.security
  ? [
    { key: 'security', model: 'mythos', prompt: 'Lens: attacker. Try to break what was built: bypass the check, forge the evidence, reach another tenant, replay, race two requests, exceed a limit, inject through every input, abuse the migration or the default. Every finding must have file:line and a concrete attack.' },
    { key: 'correctness', model: 'opus', prompt: 'Lens: correctness and completeness against the brief. Does every acceptance item hold? Edge cases, error paths, transactions, i18n (all ten locales, key parity, ICU), RTL, hydration, tests that actually assert the behaviour.' },
  ]
  : [
    { key: 'correctness', model: 'opus', prompt: 'Lens: correctness and completeness against the brief. Does every acceptance item hold? Edge cases, error paths, transactions, callers that break, i18n (all ten locales, key parity, ICU), RTL, hydration, accessibility, tests that actually assert the behaviour.' },
    { key: 'product', model: 'opus', prompt: 'Lens: product and code quality. Is this the smallest complete change (no speculative abstraction, no dead option)? Does it match the surrounding code and the skill\'s conventions? Would a learner or administrator in az, ar or de find a wrong string, a broken layout at 375 px, or a confusing state? Are docs/build (PROGRESS, DECISIONS, OPEN-QUESTIONS) updated where the brief asks?' },
  ]

const results = await pipeline(args.wps,
  (wp) => retrying(`${RULES}

WORK PACKAGE ${wp.id} — ${wp.title}
${wp.brief}

FILES / ANCHORS: ${(wp.files || []).join(', ') || 'find them'}
ACCEPTANCE (all must hold):
${(wp.acceptance || []).map((a, i) => `${i + 1}. ${a}`).join('\n')}

Work in your worktree until every acceptance item holds and the three checks pass, then commit and return the structured result.`,
    { label: `impl:${wp.id}`, phase: 'Implement', schema: IMPL_SCHEMA, model: modelOf(wp.model), isolation: 'worktree', effort: wp.model === 'sonnet' ? 'medium' : 'high' }),

  async (impl, wp) => {
    if (!impl) return null
    const reviews = await parallel(LENSES(wp).map((l) => () => retrying(`${RULES}

You REVIEW work package ${wp.id} — ${wp.title}, implemented in the worktree "${impl.worktree}" on branch ${impl.branch} (commits: ${impl.commits.join(', ')}). Read-only: do not edit anything, do not commit. Run "git log -p --stat -${Math.max(1, impl.commits.length)}" in that worktree to see the change, then read the surrounding code as needed.
BRIEF the implementer had:
${wp.brief}
ACCEPTANCE: ${(wp.acceptance || []).join(' | ')}
IMPLEMENTER'S SUMMARY: ${impl.summary}
LEFT OPEN BY THE IMPLEMENTER: ${impl.left_open}
${l.prompt}
Return approve only if nothing of severity blocker or major remains.`, { label: `review:${wp.id}:${l.key}`, phase: 'Review', schema: REVIEW_SCHEMA, model: modelOf(l.model), effort: 'high' })))
    return { impl, reviews: reviews.filter(Boolean) }
  },

  async (r, wp) => {
    if (!r) return null
    const findings = r.reviews.flatMap((rv) => rv.findings.filter((f) => f.severity === 'blocker' || f.severity === 'major'))
    const minors = r.reviews.flatMap((rv) => rv.findings.filter((f) => f.severity === 'minor'))
    if (!findings.length && !minors.length) return { wp: wp.id, impl: r.impl, reviews: r.reviews, fix: null }
    const fix = await retrying(`${RULES}

You FIX the reviewed defects of work package ${wp.id} — ${wp.title} in the existing worktree "${r.impl.worktree}" on branch ${r.impl.branch} (cd there first; the junction for node_modules already exists). Apply every blocker/major finding; apply minor findings when they are cheap; reject a finding only with a reason. Re-run the three checks, commit, return the structured result.
BRIEF: ${wp.brief}
ACCEPTANCE: ${(wp.acceptance || []).join(' | ')}
FINDINGS:
${JSON.stringify(findings.concat(minors), null, 1)}`, { label: `fix:${wp.id}`, phase: 'Fix', schema: FIX_SCHEMA, model: modelOf(wp.model), effort: 'high' })
    return { wp: wp.id, impl: r.impl, reviews: r.reviews, fix }
  },
)

const out = results.filter(Boolean)
log(`Done: ${out.length}/${args.wps.length} packages; branches: ${out.map((o) => o.impl.branch).join(', ')}`)
return { phase: args.phase, packages: out, failed: args.wps.filter((wp) => !out.find((o) => o.wp === wp.id)).map((wp) => wp.id) }
