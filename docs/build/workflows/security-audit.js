export const meta = {
  name: 'security-audit',
  description: 'Defensive security audit of the merged tree: Mythos auditors check each security control area of the code, two independent verifiers confirm every gap, confirmed gaps are closed in isolated worktrees with regression tests, and an independent re-check confirms each closure',
  phases: [
    { title: 'Audit', detail: 'one Mythos auditor per control area, read-only, findings with file:line and the test that would pin the fix' },
    { title: 'Verify', detail: 'two independent verifiers per finding; a finding both reject is dropped' },
    { title: 'Fix', detail: 'one Mythos fixer per confirmed finding group, in its own worktree, with a regression test' },
    { title: 'Recheck', detail: 'an independent verifier reads each fix branch and confirms the control now holds' },
  ],
}

// args: { repo, base }
const REPO = args.repo
const MYTHOS = 'claude-mythos-5-1'

async function retrying(prompt, opts) {
  for (let attempt = 1; attempt <= 40; attempt++) {
    const r = await agent(prompt, opts)
    if (r) return r
    log(`${opts.label}: no result (attempt ${attempt}), retrying in 10 minutes`)
    await new Promise((done) => setTimeout(done, 10 * 60 * 1000))
  }
  return null
}

// Workflow worktrees are cut from the last pushed commit, not from args.base: every reader must move first.
const PIN = `FIRST STEP, before you read any file: the worktree you were given was cut from an OLDER commit, not from the code under audit. From the worktree root run "git checkout --detach ${args.base}" and then "git rev-parse HEAD": it must print ${args.base}. If it does not, stop and say so in notes instead of auditing. Read, cite and test only that commit; anything you saw before the checkout is stale.`

const CONTEXT = `PROJECT: Cyclowareness (vendor Safarov Industries), a multi-tenant security-awareness platform sold to banks and governments. Repository "${REPO}"; the app is portal/ (Next.js 16 App Router, React 19, TypeScript strict, Server Actions under portal/src/server/actions, route handlers under portal/src/app/api, Drizzle, PGlite in tests). The security review of 2026-10-27 (docs/SECURITY_REVIEW.md, ADR-033), the verified gap register (docs/build/REGISTER-2026-11-05.md, the S-, SEC-, I-, L- ids) and waves A and B of the closure run (docs/build/PROGRESS.md cycles 12-13, ADR-035 onward) describe the controls that are supposed to exist. This is a defensive audit of the owner's own code at commit ${args.base}: the question for every control is "is it present, complete and tested", not "how would one break in".
RULES: your worktree is a read-only copy for the Audit and Verify phases: read any file, run "npm run typecheck", "npx vitest run <file>" and throwaway test cases you write under portal/tests (never commit them, delete them before you finish), never start or stop servers, never run db:*/demo/setup/content:sync scripts, never touch the main checkout "${REPO}", never edit docs/audit/. Give your worktree dependencies first: from the worktree root run powershell -NoProfile -Command "New-Item -ItemType Junction -Path 'portal\\node_modules' -Target '${REPO.replace(/\//g, '\\\\')}\\portal\\node_modules'" (skip if portal/node_modules exists). Your final text is machine-read: return the structured output only.`

const AREAS = [
  { key: 'authn-session', scope: 'Authentication and sessions: sign-in (password, phone, SSO/OIDC callback, subject binding, domain proof), two-step verification and backup codes (replay protection), session creation/rotation/expiry/revocation, cookies (flags, SameSite, Secure), password policy and change, account links (invite/reset) and their lifetimes, lockout and rate limits on every sign-in path, the step-up checks added in wave B.' },
  { key: 'authz-actions', scope: 'Authorisation and organisation scoping of every Server Action under portal/src/server/actions: each action resolves the viewer, checks the permission the register expects, scopes every query and write to the viewer\'s organisation (tenant_id in every WHERE, ids re-checked against the organisation), handles lower roles (learner, department head, analyst, content creator, campaign manager) correctly, and the generated cross-tenant suite from wave B (tests/cross-tenant.test.ts, tests/fixtures/surface.json) really covers it.' },
  { key: 'authz-routes', scope: 'Authorisation and scoping of every route handler under portal/src/app/api (admin, super, sso, tracking, tutor, subtitles, sandbox upload, drill, health, me/export, qr, inbound/reporting if present): viewer or bearer resolution, permission checks, organisation scoping, method handling, Origin/same-origin checks on state-changing routes, caching headers on private data, error responses that do not leak existence of other organisations\' data.' },
  { key: 'input-parsers', scope: 'Input validation and parsers: every zod schema and manual validation at the trust boundary (sizes, enums, URLs, e-mail, phone, IDN hosts, tokens), file uploads and the sandbox analysers (size caps, type sniffing, archive handling), outbound fetches and DNS lookups (SSRF guards in net-guard.ts: private ranges, redirects, pinned lookups), HTML rendering of user or template text (escaping in mail, notifications, reports, print pages), CSV/XLSX injection, and the lesson/content validators.' },
  { key: 'crypto-secrets-limits', scope: 'Cryptography, secrets and resource limits: APP_SECRET usage and the wave B key ring (encryption of integration secrets, TOTP secrets, signing of cookies and links, domain-proof derivation, rotation script), randomness for tokens/serials, password hashing parameters, secret handling in logs and error messages, rate limits (per actor/organisation/token) and their keys, job budgets, body-size limits, and anything that could exhaust the database or mail queue.' },
  { key: 'client-headers', scope: 'Browser-side controls: the security headers in next.config.ts (CSP, frame, referrer, permissions), the service worker and caching of private pages, client components that render HTML or URLs from data, open redirects (next= parameters, sign-in redirects, tracking links), the public pages (certificate, teachable landing, QR, legal) and what they reveal, localStorage/sessionStorage contents, and the admin tour/drill pages.' },
  { key: 'evidence-integrity', scope: 'Integrity of compliance evidence and simulations: the server-verified lesson completion path (started_at, reached, re-scoring, dwell, refusals, audit), attestation and certificate uniqueness and the evidence column, XP/streak/league anti-abuse, campaign tracking (open pixel, click beacon, submit, scanner detection), the live drill\'s isolation (feature flag, lease, replay safety), report and export scoping, audit log completeness for privileged actions, retention/clean-up jobs deleting only what they should.' },
]

const FINDINGS_SCHEMA = { type: 'object', properties: {
  findings: { type: 'array', items: { type: 'object', properties: {
    title: { type: 'string' }, severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'info'] }, area: { type: 'string' },
    file: { type: 'string' }, line: { type: 'integer' }, control: { type: 'string', description: 'the control that is missing or incomplete' },
    evidence: { type: 'string', description: 'the code path that proves the gap, or the throwaway test you ran and its result' },
    impact: { type: 'string' }, fix: { type: 'string', description: 'smallest complete fix' }, test: { type: 'string', description: 'the regression test that would pin it' },
  }, required: ['title', 'severity', 'area', 'file', 'control', 'evidence', 'impact', 'fix', 'test'] } },
  controls_verified: { type: 'array', items: { type: 'string' }, description: 'controls you checked that hold, one line each with file:line' },
  notes: { type: 'string' },
}, required: ['findings', 'controls_verified', 'notes'] }

const VERDICT_SCHEMA = { type: 'object', properties: { confirmed: { type: 'boolean' }, reason: { type: 'string' }, severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'info'] } }, required: ['confirmed', 'reason', 'severity'] }

const FIX_SCHEMA = { type: 'object', properties: {
  branch: { type: 'string' }, worktree: { type: 'string' }, commits: { type: 'array', items: { type: 'string' } },
  fixed: { type: 'array', items: { type: 'string' } }, not_fixed: { type: 'array', items: { type: 'string' }, description: 'findings you could not close, with the reason' },
  tests_added: { type: 'array', items: { type: 'string' } }, summary: { type: 'string' }, migrations: { type: 'array', items: { type: 'string' } },
  checks: { type: 'object', properties: { typecheck: { type: 'boolean' }, lint: { type: 'boolean' }, vitest: { type: 'boolean' } }, required: ['typecheck', 'lint', 'vitest'] },
}, required: ['branch', 'worktree', 'commits', 'fixed', 'not_fixed', 'tests_added', 'summary', 'migrations', 'checks'] }

const RECHECK_SCHEMA = { type: 'object', properties: { verdicts: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, closed: { type: 'boolean' }, reason: { type: 'string' } }, required: ['title', 'closed', 'reason'] } }, new_findings: { type: 'array', items: { type: 'string' } }, notes: { type: 'string' } }, required: ['verdicts', 'new_findings', 'notes'] }

phase('Audit')
const audits = await parallel(AREAS.map((a) => () => retrying(`${CONTEXT}

${PIN}

AREA: ${a.key}. ${a.scope}
Work through the whole area systematically (list the files first, then every control in each file). For each control decide: present and complete (put it in controls_verified with file:line), incomplete, or missing. A finding needs the code path (file:line) that proves the gap and, where a throwaway vitest can show it cheaply, the test and its result. Severity by consequence for a bank or government customer: critical = data of another organisation readable or writable, authentication bypass, server-side request to internal networks, arbitrary code; high = account takeover path, forged compliance evidence, stored script injection, significant data exposure; medium/low/info otherwise. Do not report style issues or theoretical concerns without a code path; put those in notes.`,
  { label: `audit:${a.key}`, phase: 'Audit', schema: FINDINGS_SCHEMA, model: MYTHOS, isolation: 'worktree', effort: 'high' })))

const raw = audits.filter(Boolean).flatMap((r, i) => r.findings.map((f) => ({ ...f, area: f.area || AREAS[i].key })))
const seen = new Map()
for (const f of raw) {
  const key = `${f.file.toLowerCase()}|${f.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()}`
  if (!seen.has(key)) seen.set(key, f)
}
const findings = [...seen.values()]
log(`Audit: ${raw.length} raw findings, ${findings.length} after dedup; ${audits.filter(Boolean).reduce((n, r) => n + r.controls_verified.length, 0)} controls verified as holding`)

phase('Verify')
const verified = await parallel(findings.map((f, i) => () =>
  parallel([0, 1].map((k) => () => retrying(`${CONTEXT}

${PIN}

You VERIFY one reported finding independently (verifier ${k + 1} of 2). Read the code path yourself; run a throwaway test if that settles it. Confirm only if the control is demonstrably missing or incomplete at the cited place in the current code; reject if the control exists elsewhere on the same path, if the register or an ADR records the behaviour as intended, or if the report rests on an assumption the code does not support. Default to rejected when uncertain. Also give the severity you would assign.
FINDING:
${JSON.stringify(f, null, 1)}`, { label: `verify:${i}:${k}`, phase: 'Verify', schema: VERDICT_SCHEMA, model: MYTHOS, isolation: 'worktree', effort: 'high' })))
    .then((votes) => ({ finding: f, votes: votes.filter(Boolean) }))))

const confirmed = verified.filter((v) => v.votes.some((x) => x.confirmed)).map((v) => ({ ...v.finding, severity: v.votes.find((x) => x.confirmed).severity, votes: v.votes }))
const rejected = verified.filter((v) => !v.votes.some((x) => x.confirmed))
log(`Verify: ${confirmed.length} confirmed, ${rejected.length} rejected`)

phase('Fix')
const groups = new Map()
for (const f of confirmed) {
  const g = f.file.split(/[\\/]/).slice(0, 4).join('/')
  if (!groups.has(g)) groups.set(g, [])
  groups.get(g).push(f)
}
const fixes = await parallel([...groups.entries()].map(([g, fs], i) => () => retrying(`${CONTEXT.replace('read-only copy for the Audit and Verify phases', 'your own working copy for this Fix phase')}

You CLOSE these confirmed findings (group ${g}) in your worktree: start from commit ${args.base} ("git merge-base --is-ancestor ${args.base} HEAD" must hold; otherwise "git reset --hard ${args.base}"). For each finding: the smallest complete fix at the root cause, keeping validation, error handling and audit() entries; a regression test in portal/tests (vitest) that fails before and passes after; every UI string in all ten locales (az en ru tr ro ka uk de fr ar; never "Aİ" in Azerbaijani). Schema changes are ADDITIVE in portal/src/server/db/schema.ts only (generate a local migration for your tests but commit nothing under portal/drizzle; list them in migrations). Run from portal/: "npm run typecheck", "npx eslint src tests scripts --max-warnings=0", "npx vitest run <touched test files>"; all must pass. Commit on your worktree branch (message in English, ending with "Co-Authored-By: Claude <noreply@anthropic.com>"). Do not edit docs/build/DECISIONS.md, PROGRESS.md or OPEN-QUESTIONS.md: put ADR text in summary.
FINDINGS:
${JSON.stringify(fs.map(({ votes, ...rest }) => rest), null, 1)}`, { label: `fix:${i}:${g}`, phase: 'Fix', schema: FIX_SCHEMA, model: MYTHOS, isolation: 'worktree', effort: 'high' })
  .then((fix) => ({ group: g, findings: fs, fix }))))

phase('Recheck')
const rechecks = await parallel(fixes.filter((x) => x.fix).map((x, i) => () => retrying(`${CONTEXT}

You RE-CHECK a fix independently. The directory you start in does NOT contain the fix: work only inside the fixer's worktree (cd there first; "git rev-parse --abbrev-ref HEAD" must print ${x.fix.branch} and "git merge-base --is-ancestor ${args.base} HEAD" must hold; if either fails, say so in notes and mark every finding not closed). The fix lives in the worktree "${x.fix.worktree}" on branch ${x.fix.branch} (commits ${x.fix.commits.join(', ')}); run "git log -p --stat -${Math.max(1, x.fix.commits.length)}" there and read the surrounding code; run its tests. For each finding below decide whether the control now holds completely (closed) or a gap remains (not closed: say exactly where). List any new gap the fix introduced. Do not edit anything.
FINDINGS: ${JSON.stringify(x.findings.map(({ votes, ...rest }) => rest), null, 1)}
FIXER'S SUMMARY: ${x.fix.summary}
NOT FIXED BY THE FIXER: ${x.fix.not_fixed.join(' | ') || 'nothing'}`, { label: `recheck:${i}`, phase: 'Recheck', schema: RECHECK_SCHEMA, model: MYTHOS, effort: 'high' })
  .then((r) => ({ ...x, recheck: r }))))

const out = { base: args.base, areas: AREAS.map((a) => a.key), raw: raw.length, findings, confirmed: confirmed.map(({ votes, ...f }) => ({ ...f, votes: votes.map((v) => v.reason) })), rejected: rejected.map((v) => ({ title: v.finding.title, file: v.finding.file, reasons: v.votes.map((x) => x.reason) })), controls_verified: audits.filter(Boolean).flatMap((r) => r.controls_verified), notes: audits.filter(Boolean).map((r) => r.notes), fixes: rechecks }
log(`Done: ${confirmed.length} confirmed findings, ${rechecks.length} fix branches: ${rechecks.map((x) => x.fix.branch).join(', ')}`)
return out
