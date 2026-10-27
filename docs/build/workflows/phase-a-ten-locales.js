export const meta = {
  name: 'phase-a-ten-locales',
  description: 'Ten interface locales with Arabic right-to-left: logical-CSS codemod, locale infrastructure, RTL and bidi fixes, in-code texts in 10 languages, then integration and independent Codex and ECC reviews',
  phases: [
    { title: 'Codemod', detail: 'physical to logical Tailwind classes, dir helpers, regression test' },
    { title: 'Build', detail: 'locale core, RTL/bidi hand fixes, in-code texts in 10 languages (parallel, file-disjoint)' },
    { title: 'Integrate', detail: 'typecheck, lint, tests, build; fix' },
    { title: 'Review', detail: 'Codex (Claudex Loop) and ECC reviewers, read-only' },
    { title: 'Fix', detail: 'apply confirmed review findings, re-run checks' },
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
const SP = args.scratchpad
const LOG = `${SP}/phase-a`

const COMMON = `PROJECT: Cyclowareness (vendor Safarov Industries), a multi-tenant security-awareness SaaS (LMS) sold to banks and government bodies. App: ${P} (Next.js 16 App Router with webpack, React 19, TypeScript strict, Tailwind 4.3 CSS-first config in src/app/globals.css, next-intl, Drizzle with PGlite locally). Read ${R}/CLAUDE.md and ${P}/AGENTS.md first (this Next.js differs from older versions; read node_modules/next/dist/docs when unsure).
THE GOAL OF THIS PHASE: the whole portal works in 10 interface languages: az en ru tr ro ka uk de fr ar. Arabic (ar, for Saudi Arabia) is right-to-left and replaces Italian (it), which is removed everywhere (also from the public landing). A learner or admin picks any of the 10 inside the portal and everything follows: layout direction, fonts, numbers, dates, emails, certificates, AI tutor answers, narration voice language.
DECISIONS (fixed, do not re-decide):
- LOCALES = ["az","en","ru","tr","ro","ka","uk","de","fr","ar"], DEFAULT_LOCALE "az", SITE_LOCALES is the same list. LOCALE_NAMES.ar = "العربية".
- Use the locale code "ar" (not "ar-SA") for Intl formatting: Western digits 0-9 and the Gregorian calendar. Use "ar-SA" only as the BCP-47 speech tag (speechSynthesis / speech recognition / TTS).
- dir: "rtl" only for ar. Helpers in src/i18n/config.ts: dirOf(locale) and langAttrs(locale) returning { lang, dir } for elements whose content language can differ from the page.
- New tenants and the demo seed enable all 10 locales (defaultSettings().locales). Nothing is deployed yet, so no data migration for existing tenants; the local DB will be reseeded later.
- UI_ALIAS keeps be/kk/ky/uz -> ru; tr and uk are real locales now.
- The lab VM desktop (src/components/lab/**) stays a left-to-right simulated OS (dir="ltr" on its root); translated text inside it still shows, and content panes (mail body, web page body) take dir from their content language. Code, terminal, addresses, URLs, e-mail addresses, phone numbers, IBANs, hashes, IPs and OTP inputs are always LTR (dir="ltr" or <bdi>).
- Mascot internals (src/components/mascot/cat/**, scroll-cat, perch) are physical on purpose; never CSS-mirror the mascot.
WORK HAPPENING IN PARALLEL (do not touch these files): translators are writing messages/{tr,ro,ka,uk,de,fr,ar}/*.json, content/library/lessons/**/*.{tr,ro,ka,uk,de,fr,ar}.json, content/library/i18n.*.json, content/legal/*.{tr,ro,ka,uk,de,fr,ar}.md, content/policies/*.{tr,ro,ka,uk,de,fr,ar}.md and content/landing/ar.json. Until they finish, tests that fail ONLY because those files are missing or still being written are expected: report them, never weaken or skip a test to hide that.
MAPS (read the ones for your task; they list exact files and line numbers, verified read-only an hour ago): ${SP}/maps/i18n.md (locale infrastructure), ${SP}/maps/rtl.md (RTL readiness), ${SP}/maps/player.md, ${SP}/maps/design.md.
NAVIGATION: a code knowledge graph exists. From ${R} run: graphify query "<question>" --budget 1500, graphify explain "<Symbol>", graphify path "<A>" "<B>". Use it before broad greps.
SKILLS: load with the Skill tool when relevant: agent-skills:frontend-ui-engineering (UI work), ecc:frontend-a11y (RTL, bidi, accessibility), agent-skills:security-and-hardening (anything on a trust boundary), agent-skills:test-driven-development (new logic gets a test).
HOW TO WORK (ponytail: smallest complete change): reuse what exists, no speculative options or abstractions, match the surrounding code style, comment only the why. Every UI string goes through messages/{az,en,ru} (keys without dots, ICU valid); the 7 new languages' message files are being written by translators, so when you add or change a UI key add it to messages/en, az and ru only. Never write "Aİ" in Azerbaijani. Edit JSON/TS with the Edit/Write tools, never shell heredocs. Never commit, never push, never run db:* / seed / content:sync, never start or stop servers on ports 3000, 3100, 3200.
CHECKS (from ${P}): npm run typecheck; npx eslint src tests scripts --max-warnings=0; npx vitest run <relevant tests> (full suite: npx vitest run).`

const SCHEMA = { type: 'object', properties: {
  summary: { type: 'string' },
  files: { type: 'array', items: { type: 'string' } },
  checks: { type: 'string', description: 'which checks you ran and their exact results' },
  notes: { type: 'array', items: { type: 'string' }, description: 'decisions, leftovers, risks, anything the next agent must know' },
}, required: ['summary', 'files', 'checks', 'notes'] }

phase('Codemod')
const codemod = await retrying(`${COMMON}

YOUR TASK (stage 1, alone in the tree): make the layout direction-agnostic mechanically, before the others start.
1) In src/i18n/config.ts add: export const RTL_LOCALES = ["ar"] as const (or a Set), export function dirOf(locale: string): "rtl" | "ltr", export function langAttrs(locale: string): { lang: string; dir: "rtl" | "ltr" }. Do not change LOCALES yet (another agent does that next).
2) Write a codemod script in ${LOG}/codemod.mjs (create the folder) that rewrites physical Tailwind direction classes inside className strings, template literals, cn()/clsx args and class-string constants across src/**/*.{tsx,ts}, keeping variant prefixes (sm:, lg:, group-hover:, peer-checked:, focus:, rtl:/ltr: must not be produced by the script) and negative signs: ml->ms, mr->me, pl->ps, pr->pe, left-->start-, right-->end-, text-left->text-start, text-right->text-end, border-l->border-s, border-r->border-e (with widths and colours), rounded-l->rounded-s, rounded-r->rounded-e, rounded-tl->rounded-ss, rounded-tr->rounded-se, rounded-bl->rounded-es, rounded-br->rounded-ee. Be careful with tokens that only look similar (e.g. "left" inside words, "text-right" vs "text-rightish", arbitrary values like left-[9999px] are still converted, "inset-x" stays). Exclude exactly the "Do NOT convert" list of ${SP}/maps/rtl.md section 4 (scroll-cat, perch, mascot/**, rive-mascot, lab/model/wm.ts, vm-shell window positioning, centring pairs left-1/2 -translate-x-1/2, SVG coordinates, tour spotlight inline styles) and anything in src/components/lab/** (it stays LTR). Run it, then review git diff for every touched file: undo any conversion that is wrong (e.g. something physical on purpose).
3) Convert the inline-style cases that are logical by nature: departments-client paddingLeft -> paddingInlineStart; leave tour/chart/gauge/swipe inline positioning for the hand-fix stage (note them).
4) Add a regression test tests/rtl-logical.test.ts that scans src for physical direction utility classes (the same patterns) and fails on any hit outside an explicit allowlist (the do-not-convert files with a one-line reason each).
5) Run typecheck, eslint and npx vitest run tests/rtl-logical.test.ts tests/rendering.test.ts (and any test that asserts class names; find them with grep for 'ml-|pl-|text-left' in tests/) and fix.
Return: summary (counts per class family and number of files), files, checks, notes (every place the regex could not handle and that the hand-fix stage must do).`, { label: 'codemod', phase: 'Codemod', schema: SCHEMA })

phase('Build')
const build = await parallel([
  () => retrying(`${COMMON}

NOTE: an earlier run of exactly this task was cut off by a usage limit; its partial edits may already be in the files. Inspect the current state first (git diff, the files you own) and continue from there instead of redoing or duplicating work.
YOUR TASK: the locale core (other agents own other files at the same time: you own ONLY the files listed here; ask nothing, decide within the decisions).
Files you own: src/i18n/** (config.ts: the codemod agent already added dirOf/langAttrs; you change LOCALES, SITE_LOCALES, LOCALE_NAMES, UI_ALIAS, comments), src/app/layout.tsx (dir on <html>, Noto Sans Arabic via next/font/google with the variable --font-arabic, preload:false for the script fonts if sensible), src/app/global-error.tsx (dir + TEXT for all 10 locales: translate the few strings well), src/app/offline/page.tsx, src/app/manifest.ts, src/proxy.ts (COUNTRY_LOCALE: remove IT, add SA:"ar"; check CSP is unaffected), src/app/og/[lang]/route.tsx (ar: Satori does not shape Arabic reliably, so serve the en card or a static fallback for ar; ka keeps DejaVu), src/i18n/az-numbers-polyfill.ts (add the @formatjs locale data for tr ro ka uk de fr ar), src/lib/client-format.ts and src/i18n/server-format.ts (verify ka and ar formatting in Node 24 ICU; force numberingSystem latn for ar where a helper builds Intl objects), src/server/services/library.ts (readLibrary/syncLibrary/LESSON_TRANSLATIONS over all non-en LOCALES; titles from every i18n.<lang>.json; tolerate a missing i18n file with a clear error), scripts/sync-content.ts (log lines), src/components/player/narrator.ts and src/components/player/tutor-panel.tsx ONLY their LANG_TAG maps (10 BCP-47 tags: az-AZ en-US ru-RU tr-TR ro-RO ka-GE uk-UA de-DE fr-FR ar-SA), src/components/player/voice-notice.tsx text keys if language-specific, settings-tabs.tsx ONLY the language section (remove the dead siteOnly/lessonsInterface branch and its keys in messages/en|az|ru/settings.json) and PREVIEW_VARS, src/components/admin/template-preview.tsx (quotes per locale), src/components/player/player.tsx ONLY the speed label (Intl.NumberFormat instead of the en/comma hack), content/landing/{az,en,ru,tr,ro,ka,uk,de,fr}.json ONLY the languages-scene entry for "it" (becomes ar / Arabic, written in each file's language) and any sentence that lists Italian (FAQ in en.json ~line 886 and its equivalents), delete content/landing/it.json (git keeps it), and the tests that pin locales: tests/auth.test.ts, tests/tenant-settings.test.ts, tests/i18n-request.test.ts (tr, uk, de become real locales; it now falls back like any unknown language), tests/content.test.ts (all i18n files), tests/content-locales.test.ts (stray-file regex over LOCALES), tests/legal-content.test.ts (all non-az LOCALES), tests/lab-vm.test.ts and tests/ai-training.test.ts loops (only the locale lists).
Also: src/lib/tenant-defaults.ts ONLY defaultSettings().locales (all 10; the text maps in that file belong to another agent). Use the exact file/line list in ${SP}/maps/i18n.md and do every item that falls in your files; for items outside your files, note them.
Return summary, files, checks, notes.`, { label: 'locale-core', phase: 'Build', schema: SCHEMA }),

  () => retrying(`${COMMON}

NOTE: an earlier run of exactly this task was cut off by a usage limit; its partial edits may already be in the files. Inspect the current state first (git diff, the files you own) and continue from there instead of redoing or duplicating work.
YOUR TASK: right-to-left and bidi hand fixes (the codemod already converted plain classes; its notes: ${codemod ? codemod.notes.join(' | ').slice(0, 3000) : '(codemod failed: do the conversions yourself first)'}).
You own every src file EXCEPT: src/i18n/**, src/app/layout.tsx, global-error.tsx, offline, manifest, proxy.ts, og route, library.ts, scripts/**, src/lib/tenant-defaults.ts, src/lib/campaigns/**, src/server/lab/games.ts, src/server/services/campaigns.ts, src/server/jobs.ts, src/server/tutor.ts, src/server/ai-verify.ts, src/lib/standards.ts, src/app/(public)/c/[token]/page.tsx, settings-tabs.tsx language section, template-preview.tsx, narrator.ts/tutor-panel.tsx LANG_TAG lines, player.tsx speed label, and the content/ and messages/ trees (other agents own those right now).
Do everything in ${SP}/maps/rtl.md sections 3 (hand fixes), 5 (icons: one CSS mirror rule in globals.css plus the help page exception), 6 (mascot gestures: swap point-left/point-right centrally in src/components/mascot/mascot.tsx when the document is rtl, flip default facing; scroll-cat facing in rtl), 7 (shell, drawers, menus that the codemod could not do), 8 (bidi: dir={...} next to every lang={...} on DOM elements via langAttrs/dirOf, Input default dir="ltr" for email/url/tel/OTP types and their icon wrappers, <bdi>/dir="ltr" around displayed emails, URLs, hosts, codes, IPs, phones, the address span in player/rich.tsx; e-mail HTML in src/server/mail.ts gets dir and text-align for ar), plus: in globals.css add @custom-variant rtl (&:where(:dir(rtl))); and ltr likewise, var(--font-arabic) in the --font-sans and --font-display stacks (the locale-core agent adds the font variable in layout.tsx), :lang(ar){letter-spacing:0} and safe line-heights for Arabic display text, a direction-aware shimmer keyframe, tours (tour.tsx, admin-tour.tsx: mirrored side branch and swapped arrow keys in rtl), the swipe card in player/scenes.tsx (drag sign in rtl, verdict badge sides), keyboard arrows in player scenes, charts (mirror with rtl:-scale-x-100 and fix labels, or keep the plot LTR: choose and be consistent), score-gauge marker, field.tsx toggle and select chevron, catalog hover nudge, brand.tsx logo, the site/scenes honeypot (-start-[9999px]), VM root dir="ltr" with content panes taking their content's dir, font-mono containers dir="ltr". Keep the tests/rtl-logical.test.ts allowlist accurate. The player copy "item on the left… match on the right" is fixed by translators, not you.
Return summary, files, checks, notes.`, { label: 'rtl-bidi', phase: 'Build', schema: SCHEMA }),

  () => retrying(`${COMMON}

NOTE: an earlier run of exactly this task was cut off by a usage limit; its partial edits may already be in the files. Inspect the current state first (git diff, the files you own) and continue from there instead of redoing or duplicating work.
YOUR TASK: texts that live in code (not in messages) must exist in all 10 languages, written by a native-level localiser, not machine-literal. Glossaries and style rules for the 7 new languages (terminology, register, quotes, names) are in ${SP}/glossaries/<lang>.md (tr ro ka uk de fr ar): read each before writing that language; az/ru/en wording already in the code is the reference for meaning.
Files you own (nobody else touches them now): src/lib/campaigns/templates.ts (the L10n {az,en,ru} type and positional l(az,en,ru) helper, 88 calls in 12 phishing-simulation templates: widen to all 10 locales and write every text: realistic, natural phishing simulation emails/SMS in each language with the same red flags; keep links, placeholders and HTML exactly), src/server/lab/games.ts (same L pattern, 36 calls), src/lib/tenant-defaults.ts text maps (DEFAULT_ATTESTATION, DEFAULT_CERTIFICATE_TEXT, DEFAULT_TEMPLATES, DEFAULT_TEMPLATES_NO_DUE, FIXED_MESSAGES, EMAIL_BUTTON_LABEL, EMAIL_BUTTON_BY_KIND; NOT defaultSettings().locales, which another agent edits: coordinate by editing only the maps), src/server/services/campaigns.ts (clickTitle, BLOCKED_TITLE, BLOCKED_REASON, and the e-mail <html lang> at ~line 63 gets dir and text-align for ar), src/server/jobs.ts REFRESHER_TITLE, src/app/(public)/c/[token]/page.tsx DEFAULT_PATH_CERTIFICATE_TEXT, src/lib/standards.ts ARTICLE (tr "md.", uk "ст.", ro/fr "art.", ka "მუხლი", ar "المادة", de "Art."), src/server/tutor.ts (tutorRequestSchema locale z.enum(LOCALES); TUTOR_LANGUAGE and LANGUAGE_STYLE for all 10: formal address Sie/vous/siz/ви/dumneavoastră/თქვენ, Modern Standard Arabic for Saudi Arabia, quote style per glossary), src/server/ai-verify.ts (TRAINING_LOCALES -> LOCALES; STOP words and PROFANITY lists for the new languages, short and safe), scripts/seed.ts (risk titles at ~428/463/485 in all 10 via the existing risk-title JSON pattern; generalise ruPolicy() at ~307-316 to load content/policies/<name>.<locale>.md for every non-en/az locale that exists, skipping missing files so the seed keeps working while translators finish). Make the TypeScript types require all 10 locales where the data is product-owned (so a future missing translation is a type error), keeping an en fallback only where the map is tenant-extensible. Add or extend a unit test that every such map has all 10 locales and that ICU/HTML placeholders match the en text.
Return summary, files, checks, notes (strings you were unsure about per language).`, { label: 'code-texts', phase: 'Build', schema: SCHEMA }),
])

phase('Integrate')
const notes = (r) => r ? `${r.summary.slice(0, 1200)}\nNOTES: ${r.notes.join(' | ').slice(0, 2500)}` : '(failed)'
const integrate = await retrying(`${COMMON}

YOU ARE THE INTEGRATOR of this phase. Three agents just worked in parallel; their reports:
[locale-core] ${notes(build[0])}
[rtl-bidi] ${notes(build[1])}
[code-texts] ${notes(build[2])}
1) Read the whole diff of this phase (git diff for src, tests, scripts, content/landing; compare with ${SP}/maps/i18n.md and rtl.md) and finish anything a report lists as left for another agent or that fell between the three file sets.
2) Run typecheck, eslint (zero warnings) and the full vitest suite; fix every failure that is not caused only by the translators' files still being missing or incomplete (list those separately with the exact test names).
3) Run npm run build (from ${P}); it must pass (no server is running on 3000; never touch 3100 or 3200).
4) Grep for leftovers: "Italiano", "it.json", '"it"' as a locale, hard-coded ["az","en","ru"] lists, Record<"az"|"en"|"ru", ...> types, LANG_TAG gaps.
Return summary, files, checks (exact counts), notes.`, { label: 'integrate', phase: 'Integrate', schema: SCHEMA })

phase('Review')
const REVIEW_SCHEMA = { type: 'object', properties: {
  findings: { type: 'array', items: { type: 'object', properties: {
    file: { type: 'string' }, line: { type: 'number' }, severity: { type: 'string', enum: ['high', 'medium', 'low'] }, problem: { type: 'string' }, fix: { type: 'string' },
  }, required: ['file', 'severity', 'problem', 'fix'] } },
  summary: { type: 'string' },
}, required: ['findings', 'summary'] }
const FOCUS = `Scope: the changes of this phase (10 locales, Arabic RTL, bidi, logical CSS, in-code texts in 10 languages). Look for: real bugs (wrong dir/lang, broken layout logic in RTL, a physical class or inline left/right that now breaks, swapped semantics such as swipe or arrow keys, missing locale in a map that silently falls back, hydration mismatches, Intl differences server vs client for ar/ka), security issues (XSS through translated HTML in e-mail templates or dangerouslySetInnerHTML, placeholder injection, open redirects through locale switching, CSP), accessibility (lang/dir on mixed content, focus order, aria labels), and test gaps. Report only concrete, verified problems with file and line; no style nits.`
const reviews = await parallel([
  () => retrying(`${COMMON}

YOU ARE A REVIEW COORDINATOR FOR CODEX (the Claudex Loop independent second model). Do not edit project files. 1) Write the review brief to ${LOG}/codex-brief.md: ${FOCUS} List the changed files of this phase (git diff --name-only, minus messages/ and content/ translation files). 2) Run Codex non-interactively and read-only from ${R}: codex.cmd exec -s read-only --skip-git-repo-check -C "${R}" "$(cat '${LOG}/codex-brief.md')" > "${LOG}/codex-review.txt" 2>&1 (on Windows use the codex.cmd shim found on PATH; if exec fails, try: codex.cmd review --uncommitted "<the brief text>"). Give it up to 20 minutes (run in the background and wait with short checks if needed). 3) Read its output and verify every finding yourself against the code: keep only findings you confirmed. Return them (with your own verification in fix) and a summary that says how many Codex raised and how many you confirmed.`, { label: 'review:codex', phase: 'Review', schema: REVIEW_SCHEMA }),
  () => retrying(`${COMMON}

YOU ARE AN INDEPENDENT REVIEWER (ECC TypeScript/React and security review). Do not edit files. ${FOCUS} Use git diff to see the changes. Return verified findings only.`, { label: 'review:ecc', phase: 'Review', schema: REVIEW_SCHEMA, agentType: 'ecc:typescript-reviewer', model: 'sonnet' }),
])
const findings = reviews.filter(Boolean).flatMap((r) => r.findings)
log(`review: ${findings.length} findings (${findings.filter((f) => f.severity === 'high').length} high)`)

phase('Fix')
const fix = findings.length ? await retrying(`${COMMON}

YOU FIX THE REVIEW FINDINGS of this phase. Verify each before changing anything (reviewers can be wrong; skip and explain the false ones). Findings:
${JSON.stringify(findings).slice(0, 14000)}
Then run typecheck, eslint, the full vitest suite and npm run build again. Return summary, files, checks, notes (each finding: fixed / not a bug and why).`, { label: 'fix-findings', phase: 'Fix', schema: SCHEMA }) : null

return { codemod, build, integrate, reviews: reviews.map((r) => r && r.summary), findings: findings.length, fix }
