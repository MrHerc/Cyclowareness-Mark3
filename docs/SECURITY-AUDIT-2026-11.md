# Security audit, November 2026

| | |
|---|---|
| Date | 2026-11-10 |
| Scope | `portal/` at the audited base `a139d56`, plus the closure commits up to `fad3df2` on the local branch `final-pass-2026-10-21` (not pushed) |
| Method | Defensive control audit, workflow run `wf_f6b9b25f-95a` of `docs/build/workflows/security-audit.js`: seven control areas, two independent verifiers per finding, grouped fixes in isolated worktrees, an independent recheck of every fix, four rounds for the SVG logo check, and a browser pass of the two new step-up dialogs |
| Result | 16 confirmed findings (3 medium, 11 low, 2 info), all closed with regression tests; 5 reviewed as intended; 229 controls verified present, complete and tested |
| Not covered | External penetration testing, the production infrastructure and hosting, and live runs of every browser for the SVG parser claims (see "Limits of this audit") |

Previous review: `docs/SECURITY_REVIEW.md` (2026-11-05). Decisions: ADR-052 to ADR-058 in `docs/build/DECISIONS.md`. Owner questions: items 53 to 57 in `docs/build/OPEN-QUESTIONS.md` (English mirror `OPEN-QUESTIONS.en.md`).

Follow-up: the section "Phase 5 follow-up review (2026-11-11)" at the end of this file (44 confirmed findings, all closed; ADR-075 to ADR-081; OPEN-QUESTIONS 70 to 74).

## Summary

This was a defensive control audit of the portal after wave B. Seven areas of security controls were read against the code at `a139d56`. For each control the auditors asked three things: is it present, is it complete, and is it tested. 229 controls passed all three (Appendix A). The auditor for Server Actions found no cross-tenant read or write and no action without its permission check; findings 1 to 3 were missing step-up and two-step checks on actions an administrator is allowed to take.

The audit raised 21 raw findings. Two independent verifiers tried to refute each one. 16 were confirmed and 5 were rejected because the project records the behaviour as intended (see "Reviewed and intended").

| Severity | Confirmed | Closed | Open |
|---|---|---|---|
| Medium | 3 | 3 | 0 |
| Low | 11 | 11 | 0 |
| Info | 2 | 2 | 0 |
| Total | 16 | 16 | 0 |

The three medium findings were missing controls around sign-in. An administrator session alone could give a learner a new phone number, or re-point the organisation's identity provider, and so decide who signs in as that learner. Sign-in SMS codes had no per-organisation ceiling. All three are now enforced and tested (ADR-053, ADR-054).

All 16 findings are closed, each with a regression test (see "Findings register"; how the tests were shown to fail without the fix is under "Checks at the end"). The SVG logo check (finding 8) took four rounds before an independent recheck found no remaining gap. A browser pass of the two new step-up dialogs found one defect in the identity form, fixed in `fad3df2`. At HEAD `fad3df2` typecheck, lint, 3275 unit tests, the lesson translation check, the production build and the Playwright smoke suite all pass.

What remains are owner decisions, not code gaps. They are not closed:

- OPEN-QUESTIONS 53: production over plain HTTP (sign-in needs HTTPS).
- OPEN-QUESTIONS 54: a shorter idle timeout for administrators.
- OPEN-QUESTIONS 55: SVG logos with embedded rasters or from old Illustrator versions.
- OPEN-QUESTIONS 56: an author approving their own Studio material.
- OPEN-QUESTIONS 57: the open-tracking pixel and mail scanners.
- Carried over: the audit retention default and the rest of OPEN-QUESTIONS 48 (the code now answers only the floor), and whether successful step-ups count against the step-up limit (OPEN-QUESTIONS 42).

## Method

### Control areas

| Area | What was checked |
|---|---|
| Authentication and sessions (`authn-session`) | Sign-in by password, phone and SSO/OIDC, subject binding, domain proof, two-step verification and backup codes, session creation, renewal, expiry and revocation, cookie flags, password policy and change, invite and reset links, lockouts and rate limits on every sign-in path, the wave B step-up |
| Authorisation in Server Actions (`authz-actions`) | Every action under `portal/src/server/actions`: viewer, permission, organisation scope of every query and write, lower roles, and whether the generated cross-tenant suite really covers it |
| Authorisation in route handlers (`authz-routes`) | Every handler under `portal/src/app/api`: viewer resolution, permissions, organisation scope, methods, same-origin checks, caching of private data, error answers |
| Input validation and parsers (`input-parsers`) | Schemas at the trust boundary, file uploads and the sandbox analysers, outbound fetches and DNS (SSRF), HTML rendering of user or template text, CSV and XLSX injection, content validators |
| Cryptography, secrets and limits (`crypto-secrets-limits`) | `APP_SECRET` and the key ring, randomness, password hashing, secrets in logs, rate limits and their keys, job budgets, body limits, anything that could exhaust the database or the mail queue |
| Browser-side controls (`client-headers`) | Security headers and CSP, the service worker and caching, client components that render HTML or URLs, open redirects, the public pages, browser storage, the admin tour and drill pages |
| Evidence integrity (`evidence-integrity`) | Server-verified lesson completion, attestations and certificates, XP and streak rules, campaign tracking, the live drill, report and export scope, audit log completeness, retention and clean-up |

### Phases

1. **Audit.** One auditor per area, read-only. Each finding names the control, the file and line, the evidence, and the test that would pin the fix. Each auditor also lists the controls it verified as present, complete and tested, with file, line and test.
2. **Verify.** Two independent verifiers per finding. Each reads the code path and may run a throwaway test (deleted afterwards). A verifier rejects when the control exists elsewhere on the same path, when the register or an ADR records the behaviour as intended, or when the report rests on an assumption the code does not support, and rejects when uncertain. A finding is confirmed when at least one verifier confirms it, and dropped when both reject it.
3. **Fix.** Confirmed findings were grouped by code area (seven groups). One fixer per group, in its own git worktree, which it had to reset to `a139d56` when the worktree did not descend from it, made the smallest fix at the root cause, added a regression test meant to fail before and pass after, and ran typecheck, lint and the touched tests.
4. **Recheck.** An independent agent read each fix in the fixer's worktree, ran its tests, and decided per finding whether the control now holds. A recheck refuses to close a finding when the fix branch does not descend from `a139d56`.

The run used 63 agents with 0 errors, about 7.9 million tokens and about 81 minutes. Every phase ran on Claude Mythos 5.1 (`claude-mythos-5-1`) at high effort. The follow-up SVG rechecks (see "The SVG logo check") were also done by independent Mythos reviewers.

**Worktree pinning.** Workflow worktrees are cut from the last pushed commit, not from the local HEAD, so the first run read a stale tree and was stopped; every Audit and Verify agent now checks out and verifies the audited commit before reading anything, and the rechecker works inside the fixer's worktree and refuses to close a finding unless `a139d56` is an ancestor of it (`40c7256`). Two fix groups (findings 13 and 14) were still cut from the older `683f272` and failed the ancestry gate although their fixes were correct; both fixes were brought onto the audited branch as separate commits (`fd069ef`, `1aa5840`).

## Findings register

File and line are at the audited base `a139d56`. Every finding is closed.

| # | Severity | Area | File:line at `a139d56` | Missing or incomplete control | Status | Fixing commit(s) | ADR |
|---|---|---|---|---|---|---|---|
| 1 | Medium | authn-session | `portal/src/server/actions/people.ts:221` | Giving a person a new phone number, which then signs them in by SMS code, needed no step-up and did not tell the person. | Closed | `f003861` | ADR-053 |
| 2 | Medium | authn-session | `portal/src/server/actions/settings.ts:242` | Re-pointing the organisation's identity provider (issuer, client id, email claim, auto-create, SSO switch) or dropping the administrators' two-step rule needed no step-up; neither did SSO unlink. | Closed | `f003861`, form fix `fad3df2` | ADR-053 |
| 3 | Low | authn-session | `portal/src/server/actions/security.ts:68` | A few self-service actions checked a console permission without the organisation's "administrators use two-step verification" rule. | Closed | `f003861` | ADR-053 |
| 4 | Low | authz-actions (tests) | `portal/tests/cross-tenant.test.ts:284` | The cross-tenant rows for the reset link and the two-step reset were refused at the step-up gate, so the tenant check they name was never reached. | Closed | `170e795` | ADR-058 |
| 5 | Low | authz-actions (tests) | `portal/tests/cross-tenant.test.ts:470` | Department-head scoping of reminders and report schedules had no test. | Closed | `170e795` | ADR-058 |
| 6 | Info | authz-actions (people) | `portal/src/server/actions/people.ts:622` | The CSV import turned administrator rows into learners when the platform operator imported, unlike the add dialog. | Closed | `f003861` | ADR-053 |
| 7 | Low | authz-routes | `portal/src/app/api/sso/start/route.ts:37` | The administrator-only SSO settings test resolved the caller with `getSession()`, so it skipped the two-step verified flag and the administrators' two-step rule. | Closed | `d299525` | ADR-053 |
| 8 | Low | input-parsers (uploads) | `portal/src/server/svg-safety.ts:8` | The SVG logo check read only the raw text, so constructs that the XML or CSS parser decodes (animation elements, character references, namespace prefixes) could mean something other than what the check saw. | Closed after four rounds | `c6ccd01`, `0923938` | ADR-056 |
| 9 | Low | input-parsers (sandbox) | `portal/src/server/sandbox/analyze.ts:290` | E-mail indicator values from the sandbox analyser had no length cap, unlike the other indicator kinds. | Closed | `510aad0`, line endings `e07b3d8` | ADR-057 |
| 10 | Medium | crypto-secrets-limits (rate limits) | `portal/src/server/actions/auth.ts:366` | Sign-in SMS codes had no per-organisation ceiling, while reset mails had one. | Closed | `f003861` | ADR-054 |
| 11 | Low | crypto-secrets-limits (model budgets) | `portal/src/app/api/tutor/route.ts:26` | Paid model calls (AI tutor, AI trainings, AI lesson drafts) were capped per person only, never per organisation. | Closed | `d299525` | ADR-054 |
| 12 | Low | crypto-secrets-limits (rate-limit keys) | `portal/src/app/api/sso/start/route.ts:27` | The anonymous SSO start opened a rate-limit bucket for any slug before the organisation was looked up. | Closed | `d299525` | ADR-054 |
| 13 | Low | client-headers | `portal/src/lib/markdown.tsx:23` | The Markdown renderer accepted protocol-relative destinations as same-site paths, although `safePath` treats them as another origin. | Closed | `fd069ef` | ADR-057 |
| 14 | Info | client-headers | `portal/src/proxy.ts:50` | The CSP directives, the client-header override and the build-time headers were present but had no regression test beyond `default-src 'self'`. | Closed | `1aa5840` | ADR-058 |
| 15 | Low | evidence-integrity (retention) | `portal/src/server/actions/settings.ts:478` | Audit-log retention had no floor, and the purge also deleted the entries that record retention changes and earlier purges. | Closed | `f003861` | ADR-055 |
| 16 | Low | evidence-integrity (exports) | `portal/src/app/api/admin/campaigns/[id]/usb-kit/route.ts:15` | The USB drop-kit export and signed-in certificate views wrote no audit entry; `certificate.downloaded` was declared but never written. | Closed | `d299525` | ADR-055 |

**Commits of the closure** (local branch `final-pass-2026-10-21`, never pushed): `40c7256` pins the audit worktrees; the fix commits `f003861`, `170e795`, `d299525`, `c6ccd01` and `510aad0` came in through the merges `a739720`, `a825151`, `de9f6a7`, `c5b4ae1` and `9dbe83e`; `e07b3d8` restores the CRLF line endings of `sandbox/analyze.ts`; `fd069ef` (Markdown) and `1aa5840` (header tests) are the two fixes brought over from the stale base; `50dd5ec` removes two stray blank lines from the admin message files and restores their CRLF line endings; `0923938` is the final SVG check; `fad3df2` is the identity form fix from the browser pass.

### Finding 1: phone change without step-up (medium)

**Expected control.** Since wave B (ADR-044) every action that lets an administrator take over another person's account (two-step reset, reset link, role change, operator link) asks for the actor's own password again (step-up) and tells the person.

**What was missing.** `updatePersonAction` wrote a new phone number for any person of the organisation with no step-up and no notice; only `person.changed` was audited. A learner can sign in with a code texted to the number on file, so a new number was a takeover path equivalent to a reset link. Phone numbers are entered by administrators and have no verification step of their own.

**Impact.** An administrator with `people.write`, or whoever held a stolen administrator session, could sign in as a learner and complete trainings, attestations and policy sign-offs in that learner's name, without the trail and notice the reset-link path leaves.

**How it is enforced now.** A new number on a live account calls `stepUp(v, password, "person.phone_changed", u.id)` (`people.ts:232-236` at HEAD), with the same 10 tries per 15 minutes and the same `security.step_up_failed` audit on refusal. The `person.changed` entry carries `meta.phoneChanged`, and the person gets the new `phoneChanged` notice in the app and by mail (other administrators too when the person is an administrator). Renaming and removing a number need no password. Tests: `tests/step-up.test.ts` (refusal keeps the number and is audited, the right password saves the normalised number and sends the notice, no notice when the number is kept).

### Finding 2: identity provider re-pointing without step-up (medium)

**Expected control.** The same step-up rule (ADR-044): a session alone must not be enough to take over other accounts.

**What was missing.** `saveIdentityAction` changed the SSO issuer, client id, client secret, email claim, auto-create and the SSO switch with `settings.write` alone. The SSO callback trusts whatever the configured issuer asserts for the organisation's proven domain. `unlinkSsoAction` cleared a person's provider binding with no step-up either.

**Impact.** Whoever held an administrator session could point sign-in at a provider of their choosing and then sign in as learners on the proven domain, without knowing the administrator's password.

**How it is enforced now.** The rule is "anything that changes whom the system will sign in as a person takes the actor's password", not a list of buttons. `saveIdentityAction` calls `stepUp(v, password, "settings.identity")` when the issuer, client id, email claim, auto-create or SSO switch differs from the stored value, or when the administrators' two-step rule is dropped (`settings.ts:258-272` at HEAD). Other fields, such as the device limit, and re-saving the same values need no password. The `settings.identity` entry records `issuerChanged`, and the issuer before and after when it changes. `unlinkSsoAction` takes the step-up as `sso.unlinked`. The browser pass found that the identity form kept asking for the password after a saved change; `fad3df2` makes a successful save the new baseline (see "Browser verification of the step-up dialogs"). Tests: `tests/step-up.test.ts`.

### Finding 10: sign-in SMS without a per-organisation ceiling (medium)

**Expected control.** A per-organisation ceiling on outbound sign-in codes, as reset mails have (`RESET_MAILS_PER_TENANT_HOUR`, 1000 per organisation and hour).

**What was missing.** Sign-in codes were limited only per number and per client address. A throwaway test at `a139d56` confirmed that the number of codes sent grew with the number of enrolled learners, with no organisation-level stop.

**Impact.** For an organisation with many enrolled phone numbers, the SMS gateway bill and the number of unsolicited codes reaching staff had no ceiling other than the gateway itself. Unsolicited codes also teach staff to expect them.

**How it is enforced now.** `sendPhoneCode` counts each code against `sms-tenant:<tenantId>` with `SMS_PER_TENANT_HOUR = 500` (`actions/auth.ts:49`, `:372-375` at HEAD). The count runs after the answer and only for a real learner's number, so the answer to the requester is the same whether or not a code is sent. When the ceiling is reached, no code is sent and one warning per organisation and hour goes to the log. Test: `tests/auth-security.test.ts` (an organisation with 498 of 500 used, six requests, all answered the same way, exactly two SMS sent).

## The SVG logo check (finding 8)

`svgLogoProblem()` in `portal/src/server/svg-safety.ts` is the only check on an uploaded SVG logo (`setLogoAction`), and the logo is shown to every learner. At `a139d56` it looked for literal tokens in the raw text and inspected only `href` and `xlink:href`. The XML parser decodes character references after such a check has run, and the CSS parser decodes backslash escapes, so the browser could read a construct differently from the check. The final state is commit `0923938` (ADR-056).

### Four rounds

1. **Round 1** (fix group 4, `c6ccd01`). SMIL animation elements refused: a logo never animates, and animation can change an attribute after the document has loaded. The recheck kept the finding open, because the same class was wider: element names under a namespace prefix, `href` under another prefix, and character-encoded values.
2. **Round 2** (follow-up workflow `wf_e13e6c36-24d`, two fix-and-recheck passes). Three readings of the file, names under any namespace prefix, first-character-only checks for `href` and `url(`, the DOCTYPE internal subset and `<!ENTITY>`/`<!ATTLIST>` refused, control characters refused, `xml:base` and the XHTML namespace refused. Recheck: P1 to P4 and P6 to P8 held, P5 stayed open.
3. **Round 3** (main session). Any element inside a `<style>` element refused, only the plain DOCTYPE accepted, CSS `image-set(` refused, the MathML namespace refused. An independent recheck by two Mythos reviewers found two more gap classes: (a) a DOCTYPE naming an XHTML or MathML public identifier makes Chromium, WebKit and Firefox decode HTML named entities, which the parsed reading did not decode; (b) JavaScript's `\s` matches some characters that XML allows inside names, so a name prefix could hide a refused name, and an `href` or `url(` value starting with such a character was taken for a fragment although the URL parser keeps it.
4. **Round 4** (main session). Any `&` that does not start a numeric reference or one of the five predefined XML entities is refused; every name class, delimiter and whitespace skip uses XML whitespace (tab, LF, CR, space) instead of `\s`; CSS `image()` and `src()` are refused like `image-set(`. An independent recheck by two Mythos reviewers (read-only, on the main checkout, one reading as a parser model and one for regressions and cost) found P1 to P8 holding with 0 gaps.

Rounds 2 to 4 landed together in `0923938`.

### How the check works now

- **Three readings, first refusal wins.** The rules run on the raw text; on the text as the XML parser reads it (comments and processing instructions dropped, CDATA markers removed with CDATA content kept as character data, character references decoded once, a reference to `<`, `>`, `"` or `'` left as written); and on that text as the CSS parser reads it (backslash escapes decoded). A token hidden from one reading is seen in another. Decoding more than a browser would can only add refusals.
- **Names.** Element and attribute names are checked under any namespace prefix and in any case, with XML whitespace only.
- **Refused.** `script`, `foreignObject`, `iframe`, `embed`, `object` and the SMIL elements (`set`, `animate`, `animateTransform`, `animateMotion`, `animateColor`); `javascript:` and `vbscript:`; `on*` event attributes; `<?xml-stylesheet`; the XHTML and MathML namespaces wherever they are bound; `xml:base`; `@import`; CSS `image-set(`, `image(` and `src(`.
- **References inside the file only.** Every `href` and every `url(` must point inside the document (`#`). Only the first character after optional whitespace is read, which keeps the check linear.
- **Refused outright because they only make the readings differ.** Control characters XML forbids (the NUL bytes of a UTF-16 file read as UTF-8, the ESC of an ISO-2022-JP declaration); a DOCTYPE internal subset, `<!ENTITY>` and `<!ATTLIST>`; any DOCTYPE beyond the plain form (a name and optional PUBLIC/SYSTEM literals without `<` or `>`); any `&` that is not one of the five predefined entities or a numeric reference; any element inside `<style>` (the browser joins the split text back together). A logo never needs any of these.

### Gap classes closed

Each row is a construct the browser read differently from the check at some point in the four rounds. Each is now refused or read the way the browser reads it.

| Construct | How the readings differed | Now |
|---|---|---|
| SMIL animation | Could change an attribute after load, with a value the check had not decoded | Refused (round 1) |
| Names under a namespace prefix | The check matched unprefixed names and `xlink:href` only | Matched under any prefix and case (round 2) |
| Character references and CSS escapes | Decoded by the XML or CSS parser after the check had read the raw text | Decoded once in the second and third readings (round 2) |
| DOCTYPE internal subset, entity and attribute-list declarations | Declare entities and attribute defaults the check never saw | Refused (round 2) |
| Control characters that switch the byte encoding | The browser decoded bytes the check could not read | Refused (round 2) |
| `xml:base`, the XHTML and MathML namespaces | Change where `#` resolves, or make elements live outside `foreignObject` | Refused (rounds 2 and 3) |
| An element inside `<style>` | The browser joins the split text back together | Refused (round 3) |
| DOCTYPE literals holding `<` or `>` | Could open a section the parsed reading dropped while the parser read on | Only the plain DOCTYPE accepted (round 3) |
| HTML named entities turned on by an XHTML or MathML DOCTYPE | Decoded by the browser, not by the check | Any non-predefined `&` refused (round 4) |
| Characters JavaScript treats as whitespace but XML allows in names | Could hide a name behind a prefix, or make a value look like a fragment | XML whitespace only (round 4) |
| CSS `image()` and `src()` | Take a plain string URL with no `url(` token | Refused (round 4) |

### Properties and their final state

| | Property | Final state |
|---|---|---|
| P1 | Refused elements are refused under any prefix and in any case | Holds |
| P2 | Every `href` and `url(` value is a fragment (`#`) | Holds |
| P3 | References are judged by what they decode to, decoded once | Holds |
| P4 | The internal subset is refused, the plain DOCTYPE is accepted | Holds |
| P5 | No remaining difference between what browsers assemble and the three readings | Holds (open after round 2, closed in rounds 3 and 4) |
| P6 | Real Illustrator, Inkscape, Figma and Sketch exports are accepted (9 realistic export files, plus more from the reviewers) | Holds |
| P7 | Linear time | Holds |
| P8 | The function's signature is unchanged | Holds |

Tests: `portal/tests/svg-sanitize.test.ts` (every closed case and P1 to P6) and `portal/tests/regex-dos.test.ts` (timing).

### Deliberate over-refusals

The check refuses when in doubt. These logos are refused although they would be harmless under `<img>`. Administrators should be told; the list can be reused in the admin guide. On a refusal the administrator sees the general `logoUnsafe` message (error `unsafeSvg`), which names a script, event attribute or outside reference rather than the actual cause, and can upload a PNG or JPEG instead.

- Raster images embedded as `data:` URIs: Figma image fills, bitmaps embedded by Illustrator, Inkscape or Canva.
- Illustrator 10 to CS3 "Save As SVG" and "Preserve Illustrator editing capabilities" exports (an internal DTD subset with `ns_svg`/`ns_ai` entities).
- Figma layers with a background blur (they export a `foreignObject` with XHTML).
- A logo wrapped in a hyperlink.
- Embedded web fonts (`url(data:font…)`).
- Any `&` that is not a predefined or numeric reference, even in a comment or CDATA section (CSS nesting `&`, "Q&A" in a comment).
- Fragments written with character references, such as an encoded `#` or an encoded space before it (design tools write `#a` literally).
- Text that merely contains a rule token: `url(`, `image(`, `src(`, `@import` or `href=` in a description or title, or an attribute value such as a layer name that looks like an event attribute ("online=1").
- Upper- or mixed-case names that are not live in XML (`<SCRIPT>`, `HREF=`).

Whether to accept embedded PNG and JPEG rasters in `<image>` (which needs a decoder-level check) is OPEN-QUESTIONS 55.

### Judged out of scope

No shipping browser does these, so they were not changed:

- XML 1.1 line-end normalisation of U+0085 and U+2028 after a CSS hex escape (libxml2 normalises only CR, expat has no XML 1.1 support). Refusing those two characters after an escape would close it cheaply if an XML 1.1-aware parser ever ships.
- CSS `attr()` with a `url` type (the CSS Values specification forbids `<url>` in `attr()`).
- The plain-DOCTYPE pattern still uses JavaScript `\s`. This only accepts DOCTYPEs that every XML parser rejects, so nothing renders.

### Second layer (unchanged)

The upload check is the first layer. The second did not change in this audit:

- Every place that shows a logo renders `<img src=/api/assets/...>`. Inside `<img>`, browsers load no external resources from an SVG and run no script.
- `/api/assets/[id]` sends `x-content-type-options: nosniff` and `content-security-policy: default-src 'none'; style-src 'unsafe-inline'; sandbox`, with no charset on the content type (`portal/src/app/api/assets/[id]/route.ts:11-18` at HEAD). If the asset URL is opened directly, the policy blocks `@import` and `url()` fetches and `sandbox` blocks script.

### Cost

The three readings roughly triple the CPU of each upload. Uploads are capped at 512 KB and every regex is linear. The slowest input found was 319 ms at the 512 KB cap (one CDATA section full of `<`, which the parsed reading expands about four times).

## Reviewed and intended

### The five rejected items

Both verifiers rejected each of these because the project records the behaviour as intended. The code is unchanged. Items a, b and e wait for an owner decision.

| | Item | Why it is intended | Owner question |
|---|---|---|---|
| a | Production over plain HTTP: with `ALLOW_HTTP_APP_URL=1` the server still issues `Secure` `__Host-` cookies, which browsers discard over plain HTTP, so sign-in and SSO do not complete | The flag is for an intranet or local test stack; `portal/README.md` states that the session cookie needs HTTPS except on `localhost`, and the production cookie attributes are the chosen, tested control | 53 |
| b | A material's author can approve their own Studio material | The documented gate is that a person approves material before employees see it, with optional dual approval; a second approver must differ from the first (`sameApprover`); a mandatory second approver was deliberately not built | 56 (and 42) |
| c | The scene-reached gate accepts a scene index beyond the lesson's scene count | ADR-035 §2 defines the gate as "furthest scene only, it only moves forward", not a per-scene check; that scene reports come from the browser is a recorded limit (ADR-035, `docs/ARCHITECTURE.md` known limitations) | None new |
| d | Drill and seed rows carry the evidence value `server_verified` | ADR-035 item 1 treats seed, the live drill and tests as server-internal; OPEN-QUESTIONS 27 already offers a separate "seeded" kind; the live drill is limited to seeded demo organisations (ADR-036) | 27 (existing) |
| e | The open-tracking pixel does not filter mail scanners, while clicks and fake sign-ins do | `docs/SIMULATION-DELIVERY.md` states that opens are informational, appear in the funnel and carry no risk score; ADR-047 scopes the scanner filter to clicks and submits | 57 |

The audit also recorded the absence of an idle timeout shorter than the 30-day sliding session (ADR-033) as a design choice; it is OPEN-QUESTIONS 54.

### Audit notes (observations without a finding)

Each auditor confirmed it read `a139d56` (by `git rev-parse`) and left its worktree clean, with any throwaway test deleted. The observations below have no security code path at the audited commit, or are recorded design choices.

- **Authentication and sessions.** The register items for SSO subject binding, TOTP replay, password change and takeover notices are implemented and tested. A successful step-up also uses one of the 10 tries per 15 minutes (functional, not security; OPEN-QUESTIONS 42). Signing in while another session cookie exists leaves the earlier session row valid until it expires, unusable without its token. Phone numbers have no verification step of their own, which is the root of finding 1. The OIDC verifier does not check `nbf` or `auth_time`, acceptable for the code flow used. Without `TRUST_PROXY`, an account locks after 5 failures from any client; this is documented and warned at start-up.
- **Server Actions.** `resetTourAction` uses `getSession()`, but it only resets the caller's own tour flag. The `tenant_admin` branch of `changeRoleAction` is unreachable. `setAttendanceAction` and `remindAwaitingAction` accept a foreign id, but their writes are bound to the organisation's own rows. The generated suite counts any refusal as refused; only the two step-up rows were found to be refused by an earlier gate (finding 4, ADR-058).
- **Route handlers.** `POST /api/tutor` lets Studio authors reach library modules in draft (vendor content, no customer data). `GET /api/health` shows job and backlog counts without sign-in, by design for uptime monitors. The QR and open-pixel routes have no rate limit; the token space makes enumeration impractical. The sandbox upload answer has no `no-store` (POST answers are not cached), and the people CSV template has no `cache-control` (it holds no private data). `policies.read` includes the content creator role, which can download the sign-off CSV with active employees' names and e-mail addresses although `people.read` excludes that role; the IP column is already withheld.
- **Input validation.** The lesson file schema has unbounded strings, but it validates seed files, lesson scripts and model output, not request bodies; Studio authoring uses the bounded draft schema. The SMS gateway call uses the operator's `SMS_WEBHOOK_URL`, already tracked (SECURITY_REVIEW L-4). OIDC fetches skip address vetting outside `NODE_ENV=production`, by design for local identity providers. LDAP settings are checked by shape only and nothing connects to them yet. CSV cells that start with a space or a pipe are left as they are; spreadsheets treat both as text. Same-origin checks accept a request without an `Origin` header, the documented CSRF design.
- **Cryptography, secrets and limits.** The key id has no purpose label (ADR-045). Key derivation is a single SHA-256, acceptable with the enforced 32-character minimum. Signed values verify with the current key only, so an SSO sign-in in flight during step 2 of a rotation fails once (documented). The fixed-window limiter allows up to twice the limit across a window boundary. The rate limiter takes its in-memory path whenever `VITEST` is set, so a production process with that variable would stop sharing counters. The bootstrap writes the operator's 14-day invitation link to the server log by design, so log access is part of the trust boundary. Phone code hashes could be guessed from a database copy within their 5-minute validity, mitigated by the attempt counter and expiry. Without `TRUST_PROXY`, the e-mail step and the forgot-password form have no per-client limit (warned at start-up). Not covered by tests at the audited commit: the per-organisation reset-mail ceiling itself, webhook signature headers, and decryption with a tampered key id.
- **Browser-side controls.** `/api/assets/[id]` is public by UUID and cached for a year; only logos are stored there, but any future asset kind would inherit the public route. `style-src 'unsafe-inline'` is the accepted I-3. There is no `Cross-Origin-Resource-Policy` or COEP header, which no current feature needs. The certificate page is public by default (`certificate.publicLink`), the verification feature by design. The CSP header is left off prefetch requests by design; they are data payloads, never rendered as documents.
- **Evidence integrity.** Completion still relies on the start, scene reports and picks sent by the browser, the limit recorded in ADR-035; the first-try flag affects the weak-areas statistics, not completion. A scenario scene counts as answered after any one step. Skipping a drill writes no audit entry of its own. A drill lease takeover can apply the same step twice; every step is idempotent (the report step claims the recipient before it files the report), so only attempts and time of a training step can double (tested, also with two lease holders). Scheduled-report mails may go to outside addresses, but carry only a link that requires sign-in.

### Recheck observations (not findings)

- In `updatePersonAction` the step-up try is spent before the "number taken" check, so a taken number still costs one try. The person dialog decides in the browser whether to send the password; the server decides on its own.
- The tutor's per-organisation daily bucket is spent before the model stream is known to succeed, so a question answered by the offline fallback still counts (the per-person bucket behaves the same way).
- `sso-callback:t:<slug>` is keyed before the organisation lookup, but it is bounded by the signed state cookie.
- The certificate audit row is written during the server render, so a signed-in prefetch of `/c/<token>` could record a view. Next does not prefetch that dynamic route today, because there is no loading boundary on it.
- The `demo:email:` and `reset:` rate-limit keys were not hashed. Hashing would change no behaviour: while `TRUST_PROXY=0` there is still one row per distinct recipient, which `env.ts` already warns about.
- LDAP exists only as a settings object (`settings.ts` 220-308). No sync service or job writes people or phone numbers, so there is no second phone-write path to guard.
- The department-head test block adds data to organisation A after the generated table has run, so a future row that takes a snapshot of A must run before it. The other generated rows still have no positive control (the ADR-046 limit stands), and that pages use `x-nonce` is not tested (it is in the layout).
- Housekeeping found by the rechecks and fixed: `510aad0` had converted `sandbox/analyze.ts` to LF line endings (restored in `e07b3d8`), and the audit merges left two stray blank lines and some LF line endings in the ten `admin.json` message files (fixed in `50dd5ec`).

## Browser verification of the step-up dialogs

The two new dialogs were checked by hand on the local development server (port 3000), in Azerbaijani, as the demo tenant administrator. The administrator's password was set to a throw-away value by a one-off script, and the database was reseeded afterwards.

- **Identity settings** (Admin, Settings, the sign-in tab). Changing the email claim shows the password field and disables Save until a password is typed. A wrong password is refused inline and in a toast, and audited as `security.step_up_failed`. The right password saves, and the value is still there after a reload.
- **Person phone** (Admin, Employees, a person, Edit). The password field appears only when the number changes, with a hint that the action is logged and the person is told. A wrong password is refused inline and audited. The right password saves. The person receives an in-app `phoneChanged` notice in Azerbaijani with a link to `/profile` (two changes, two notices).

**Defect found and fixed (`fad3df2`).** The identity form compared the fields with the values it was opened with. After a saved trust change it kept asking for the password, and blocked the next unrelated save until the page was reloaded. A successful save is now the new baseline.

**Not checked in the browser.** The step-up dialogs for role change, reset link, two-step reset and SSO unlink (they use the same `ConfirmPasswordField` component and the same `stepUp` server function, and are covered by tests); languages other than Azerbaijani; the 375 px width.

## Checks at the end

At HEAD `fad3df2`:

| Check | Result |
|---|---|
| Typecheck (`npm --prefix portal run typecheck`) | Clean |
| Lint (`npx eslint src tests scripts --max-warnings=0`) | Clean, 0 warnings |
| Unit tests (`npx vitest run`) | 125 files, 3275 tests pass |
| Lesson translations (`scripts/check-lesson-locales.ts --coverage`) | 954 of 954 |
| Production build | Passes, with the post-build check |
| Playwright smoke suite (6 tests, `en` and `ar` projects; reseeds the local database) | 6 passed in 4.7 minutes |

Each fix group also ran typecheck, lint and its touched tests in its own worktree. How the regression tests were shown to fail without their fix:

- Run against the code before the fix: findings 7, 11, 12 and 16 (8 failures before, all passing after), 9, 13, and round 1 of finding 8.
- Breakage runs that remove the guard, for the test-only findings: 4 (password hash removed), 5 (department scope returning nothing; the "own schedule only" rule comes from `createdBy`, so that one test is pinned against the administrator's schedule instead) and 14 (`frame-ancestors` and the `x-nonce` override removed).
- Fail by construction, not run against the old code: findings 1, 2, 3, 6, 10 and 15 (the actions had no password parameter, `privileged()` did not exist, the operator's import made administrator rows learners, one month of retention was accepted, every requested code was texted).

## Limits of this audit

- It is a defensive code review of the repository: controls were read, traced and tested in code, with throwaway tests where needed. It is not an external penetration test, and no attack was run against a deployed instance.
- The production infrastructure, hosting, TLS proxy, mail and SMS providers, and the owner's demo machines were not reviewed.
- The browser-parser claims behind the SVG check (how Chromium, WebKit and Firefox decode entities, names and URLs in SVG) were reasoned from the behaviour of libxml2, expat and CSS Syntax Level 3 and pinned with unit tests. They were not run in every browser.
- Severity reflects a multi-tenant SaaS with untrusted tenant administrators, as in `docs/SECURITY_REVIEW.md`.
- Owner-only items are not closed by this audit: keys and their storage, the legal identity, the lawyer's review, hosting, the native-speaker reviewers, and OPEN-QUESTIONS 53 to 57.

## Appendix A: verified controls

The 229 controls the auditors verified as present, complete and tested, in the order the run returned them, grouped by audit area. Wording is shortened; every file and line reference and every test reference is kept. Paths are under `portal/src/` unless they start with `portal/`; some keep only their last folders, as the auditors wrote them (`api/...` is `app/api/...`, `services/` and `queries/` are under `server/`, page paths are under `app/`); `tests/` means `portal/tests/`. References are at the audited base `a139d56`, so some lines have moved since. Where a later finding changed, extended or added a test to a control, the finding is named in brackets.

### A.1 Authentication and sessions

1. Session tokens: 24 random bytes (192 bits), only the SHA-256 stored, token length capped at lookup — server/auth/session.ts:17-32, server/auth/viewer.ts:58-59 (tests/sessions-viewer.test.ts)
2. Session cookie HttpOnly, SameSite=Lax, Path=/, Secure and `__Host-` in production; deletion carries the same attributes — server/auth/session.ts:63-76 (tests/sessions-viewer.test.ts "the session cookie")
3. Session expiry checked on every read and expired rows deleted; suspended and non-active users refused — server/auth/viewer.ts:68-72 (tests/sessions-viewer.test.ts)
4. Sliding renewal only inside the 90-day absolute lifetime, never without createdAt — server/auth/session.ts:93-108, viewer.ts:75-80 (tests/auth-security.test.ts "session lifetime")
5. Device limit evicts the least recently seen sessions and audits each — server/auth/session.ts:34-48 (tests/sessions-viewer.test.ts)
6. A fresh session token on every sign-in (password, phone, SSO), so no fixation; the cookie is set only after the credential passes — server/actions/auth.ts:190-202, 284-288, 425-430; SSO callback route.ts:140-148
7. Sign-out deletes the session row and clears the cookie — server/actions/auth.ts:499-509
8. Sessions revoked on: password set from a link (auth.ts:494), password change (profile.ts:62), 2FA enabled (profile.ts:46-47), admin 2FA reset (people.ts:273), role change (people.ts:256), suspension (people.ts:344), deletion in one transaction (people.ts:363-364)
9. Second-factor gate: getViewer is null and requireViewer/apiViewer redirect until twoFactorVerified; the verify page redirects when not needed — viewer.ts:125-146, api.ts:12-20, sign-in/verify/page.tsx:16-18 (tests/sessions-viewer.test.ts, tests/api-viewer.test.ts)
10. Mandatory 2FA for the operator always, and for console roles by organisation default (requireAdmin2fa true), on pages, permissioned actions and routes — permissions.ts:84-86, viewer.ts:158-185, tenant-defaults.ts:271 (tests/viewer-gates.test.ts, tests/auth.test.ts) [see finding 3]
11. TOTP replay protection: the matched step is recorded by one conditional UPDATE (totp_last_step), timing-safe compare, one step of drift either way — server/auth/totp.ts:24-48 (tests/auth-security.test.ts "time-based codes")
12. Backup codes: 10 random codes, HMAC(APP_SECRET)-hashed, spent atomically with jsonb containment, previous-key and legacy hashes honoured — totp.ts:50-77, auth.ts:296-306 (tests/auth-security.test.ts)
13. Second-factor lockout: 5 wrong codes per account per 15 minutes, race-safe claim — auth.ts:316-318, 123-135 (tests/auth-security.test.ts "second factor under a parallel burst")
14. 2FA enrolment and disabling need the password (10 per 15 minutes); disabling refused when the role requires 2FA; enrolment signs other sessions out — profile.ts:18-21, 24-49, 67-75
15. Password hashing Argon2id 19 MiB, t=2, p=1; a dummy hash for unknown accounts — password.ts:5-19, auth.ts:48-53, 275-276
16. Password policy: 10 to 256 characters, zxcvbn score 3 or more with personal words (email parts, name), not equal to the email, on link set-up and on change — password.ts:21-29, lib/password-strength.ts:12-34, auth.ts:481-485, profile.ts:55-59 (tests/auth-security.test.ts, tests/password-domain.test.ts)
17. Password change needs the current password and signs other devices out — profile.ts:52-65 (tests/auth-security.test.ts "changing the password")
18. Password sign-in lockout: 5 failures per account and client (/64 for IPv6), 30 per client, an account ceiling of 50 per hour with owner protection, anonymous slowdown without TRUST_PROXY, claims written before the check — auth.ts:35-41, 94-161, 271-273 (tests/auth-security.test.ts "password sign-in lockout")
19. Sign-in refusals audited; SSO-domain users and non-active users refused at the password step — auth.ts:277-283
20. Neutral answers: the email step answers per domain only; reset mail and phone code are decided after the answer; the same rate-limit answer for every address — auth.ts:84-87, 211-257, 344-362, 433-444 (tests/auth-security.test.ts "password reset mail", "phone codes")
21. Phone codes: 6 random digits, 5 minutes, 5 guesses in all through a conditional UPDATE, single use, learners only, a new code replaces the pending one, per-number and per-client send caps with owner protection — auth.ts:163-182, 336-431 (tests/auth-security.test.ts "phone codes") [ceiling added by finding 10]
22. Account links: 24 random bytes, SHA-256 stored, invite 14 days and reset 60 minutes, a reset link replaces the previous one, used and expired links refused, invite only while the status is invited, every invite retired on first use, all sessions revoked — links.ts:13-28, auth.ts:468-497, account/[kind]/[token]/page.tsx:17-31 (tests/auth-security.test.ts "setting a password from a link")
23. The account-link page sends Referrer-Policy no-referrer and noindex — app/(auth)/account/[kind]/[token]/page.tsx:14
24. Reset mail throttled per address, client and organisation, and only for active password users; the link is redacted from the outbox after delivery — auth.ts:166-182, 447-462
25. Step-up (the actor's password, 10 per 15 minutes per actor, refusals audited with the target) on 2FA reset, reset link, role change and the operator admin link; invite link only for never-activated accounts; the target and peer administrators notified — step-up.ts:17-29, people.ts:195-209, 246-278, platform.ts:148-165, notify.ts:127-134 (tests/step-up.test.ts) [extended by findings 1 and 2]
26. Operator support link limited to a tenant_admin of the organisation and to the 72-hour window the organisation granted — platform.ts:152-161, settings.ts:502-512 (tests/step-up.test.ts "the operator")
27. Tenant administrators cannot act on super_admin accounts; targets scoped to the own organisation and not deleted — people.ts:40-48 (tests/people-operator.test.ts)
28. super_admin never assignable; tenant_admin role changes only by tenant_admin or super_admin; nobody changes their own role — permissions.ts:66, people.ts:246-250 (tests/auth.test.ts)
29. OIDC: discovery issuer match, https-only endpoints, authorization endpoint on the issuer host, cached 5 minutes, size-capped SSRF-guarded fetches — oidc.ts:18-76 (tests/oidc-fetch.test.ts)
30. OIDC: PKCE S256, random state and nonce in a signed 10-minute HttpOnly state cookie deleted on first use; the callback checks state, organisation slug, nonce, signature (RS256 or ES256 only, kty matched), iss, aud, azp, exp and iat — oidc.ts:79-151, sso/start/route.ts:45-77, callback route.ts:35-40, 76 (tests/sso.test.ts, tests/sso-routes.test.ts)
31. SSO sign-in only for a proven domain with SSO on and the plan feature; privileged roles, other organisations and suspended people refused; email_verified required for the standard claim; the subject bound in one conditional write and a subject change refused; auto-create only on the proven domain — callback route.ts:104-138, sso-routing.ts:44-52 (tests/sso-routes.test.ts, tests/auth.test.ts "sso routing")
32. SSO start and callback rate-limited per client and per organisation; the test mode needs settings.write in that organisation — sso/start/route.ts:26-39, callback route.ts:42-45, 94-98 [see findings 7 and 12]
33. Domain proof: HMAC of the organisation id with a non-rotating secret, TXT on the domain or the _cyclowareness subdomain, one proven organisation per domain (unique index), daily re-check with a 7-day grace, operator override audited — domain-proof.ts:33-61, schema.ts:150, jobs.ts:298-335, platform.ts:97-142
34. Return-to paths validated (same-site, no //, no sign-in loop, normalised) — lib/safe-path.ts:10-15 (tests/safe-path.test.ts)
35. Client IP taken only from trusted proxy hops, ports stripped, IPv6 keyed by /64, IPv4-mapped addresses unwrapped; same-origin check for POST routes — request.ts:11-81 (tests/request.test.ts)
36. Stored TOTP keys and SSO client secrets encrypted with AES-256-GCM, with a key id and rotation support; signed values compared timing-safe — crypto.ts:30-85 (tests/crypto.test.ts)
37. The development-only code display and the development APP_SECRET fallback refused in production — env.ts:94-98, 130, crypto.ts:8-13
38. Clean-up jobs for expired sessions, login attempts (2 days), rate-limit windows and auth tokens (1 day after expiry) — jobs.ts:379-384
39. The proxy re-issues the cookie once a day so it slides with the row, never on API or asset responses — proxy.ts:17-19, 133-140 (tests/proxy-hsts.test.ts)

### A.2 Authorisation in Server Actions

40. Viewer gate for every action: actionViewer() resolves the session, refuses the unauthenticated, and checks permission and plan feature (allowed) and the organisation's 2FA rule — server/auth/viewer.ts:186-192; permission matrix server/auth/permissions.ts:10-38; super_admin not assignable, permissions.ts:69 [see finding 3]
41. The inventory covers every 'use server' file and API route; no inline 'use server' directive exists outside file heads (grep); surface.json matches the inventory and every entry has a row — portal/scripts/inventory-surface.ts:78-104, portal/tests/cross-tenant.test.ts:453-461; the suite passes at a139d56 (161 tests) [see finding 4]
42. people.target(): id shape, organisation, not deleted, super_admin out of reach for tenant administrators — server/actions/people.ts:41-48; used by createLinkAction :198, updatePersonAction :223, changeRoleAction :247, resetTwoFactorAction :266, unlinkSsoAction :278, deletePersonAction :380, decideDeletionAction :388
43. addPersonAction: people.write, the tenant_admin grant limited, foreign-domain and taken answers neutral (S-08), the department re-checked against the organisation — people.ts:126-141
44. emailInvitesAction scoped to the organisation, invited status and not super_admin — people.ts:181-186
45. Step-up (S-06, ADR-044) on reset link, 2FA reset, role change and operator link; invite link only for never-activated accounts — people.ts:196-201, :251, :264; server/actions/platform.ts:148; server/auth/step-up.ts:17-23 [extended by findings 1 and 2]
46. changeRoleAction: nobody changes their own role, only ASSIGNABLE_ROLES, sessions invalidated, peers notified — people.ts:245-258
47. moveDepartmentAction: department and users both checked against the organisation, the transaction keyed on the organisation — people.ts:287-311
48. setStatusAction: organisation, not deleted and reachable, in the UPDATE's WHERE — people.ts:338
49. anonymise(): every cross-table write keyed on the organisation or the user id — people.ts:345-375
50. remindPeopleAction: assignments.read, department-head scope through scopeDepartmentIds — people.ts:400-409; server/queries/admin.ts:22-31 (confirmed by a throwaway test) [test added by finding 5]
51. importPeopleAction: people.write, every insert carries the viewer's organisation, departments resolved from the organisation's own list, the manager looked up within the organisation — people.ts:518-646 [see finding 6]
52. workspace.saveDepartmentAction: parent and current department from the organisation's list, the head user checked against the organisation, cycle check — server/actions/workspace.ts:29-45
53. deleteDepartmentAction and mergeDepartmentAction: department checked against the organisation, every cascading write carries tenant_id — workspace.ts:89-110, :125-158
54. createAssignmentAction: module or path from the library or the organisation's own, department and user checked against the organisation — workspace.ts:187-208; updateDueAction :268 and removeAssignmentAction :281 scope their WHERE
55. publishVersionAction, archivePolicyAction and remindPolicyAction: policy or version joined to the organisation — workspace.ts:319, :366, :377-384; setProblemStatusAction with the organisation in its WHERE, :405-409
56. secops ownReport(): organisation predicate for triage, dismiss, convert and analyse — server/actions/secops.ts:31-35; loop service scoping, server/services/secops.ts:38, :55; setLoopVerdictAction WHERE :126
57. decideMaterialAction and editMaterialAction checked against the organisation, sameApprover for the second approval — secops.ts:160, :175, :222
58. createMaterialAction, createIncidentAction, setIncidentTrainingAction and convertThreatIntelAction: module from the library or own, sandbox, department audience and chosen users all filtered by organisation — secops.ts:247, :288-297, :354-363, :401-404; audienceUserIds :142-151; assignIncidentTraining service :192; targetTraining filters users by organisation, server/services/secops.ts:93-96
59. setIntelStatusAction narrows intel.read to policies.write or secops.write; convertPolicyIntelAction needs policies.write and the organisation — secops.ts:387-390, :421
60. ownModule() checks the organisation and non-library status for setModuleStatusAction and deleteModuleAction; deleteModuleAction refuses modules in use — secops.ts:512-516, :541-548
61. savePathAction: slugs from the library or own, an edited base must be own, a duplicate source from the library or own; deletePathAction only own paths without certificates — secops.ts:584-595, :634-639
62. saveSessionAction, deleteSessionAction, setAttendanceAction, setTicketStatusAction and reviewFeedbackAction scope their WHERE to the organisation — secops.ts:671, :686, :704, :719, :743
63. settings saveSettings(): read-modify-write locked on the organisation; resendFailedMailAction through resendableMail(organisation); lookupWatermarkAction joined to the organisation; setLogoAction assets by organisation — server/actions/settings.ts:41-48, :401, :509, :90-99
64. Campaigns: department and campaign checked against the organisation, template on the plan; the setCampaignStatus service has the organisation in its WHERE — server/actions/campaigns.ts:29-38, :77; server/services/campaigns.ts:264-268
65. Drill: department checked against the organisation, skipDrill with the organisation in its WHERE — server/actions/drill.ts:28-29; server/services/drill.ts:303-304
66. reports.saveScheduleAction: the secops kind needs secops.read, department-head scope, department checked against the organisation; removeScheduleAction removes only own schedules for scoped roles — server/actions/reports.ts:37-43, :54-57 (confirmed by a throwaway test) [test added by finding 5]
67. policies.signPolicyAction: version joined to the organisation, latest published only, password or SSO — server/actions/policies.ts:48-59
68. admin-overview: settings.write for the set-up flags; remindAwaitingAction with organisation and department-head scope — server/actions/admin-overview.ts:14, :25, :41-48 [test added by finding 5]
69. engage.toggleSessionAction checked against the organisation; replyTicketAction for the requester or staff, with an organisation check — server/actions/engage.ts:49, :94-96 [see finding 3]
70. security.escalateAnalysisAction: organisation, and the submitter or secops.read — server/actions/security.ts:67-71 [see finding 3]
71. learning.moduleBySlug: library or own, published unless studio.write; lessonOf length-bounded — server/actions/learning.ts:25-37, :94-101; loadCaptionsAction through reachableModules — app/(focus)/learn/[slug]/[lessonId]/actions.ts:23-33, server/queries/catalog.ts:39-44 [see finding 3]
72. Platform actions all need platform.manage; adminLinkAction needs step-up, the organisation's 72-hour grant and a tenant_admin of that organisation — server/actions/platform.ts:146-159
73. Profile, preference and notification actions write only the viewer's own user — server/actions/profile.ts (all), preferences.ts:23, notifications.ts:9-13
74. AI training actions need studio.write, and drafts are inserted with the viewer's organisation — server/actions/ai-training.ts:37, :60, :130-160; vm-action is self-service — server/lab/vm-action.ts:21-29 [see finding 11]
75. Audit check: `npm run typecheck` passes at a139d56
76. Audit check: `git rev-parse HEAD` is a139d56ebc617563fbbdb96e010a8e456f20137d (the audited commit); the worktree was clean after the throwaway test was deleted

### A.3 Authorisation in route handlers

77. apiViewer: RSC probe, then getViewer (session and TOTP verified), twoFactorGap, and allowed (role and plan feature) — server/auth/api.ts:12-20; deniedResponse keeps a bare 401 or 403 for fetches and redirects navigations — api.ts:45-54 (tests/api-viewer.test.ts)
78. Permission matrix and feature gating: allowed() is can(role) and the plan feature — server/auth/viewer.ts:152-155; PERMISSIONS and PERMISSION_FEATURE — server/auth/permissions.ts:9-63
79. Same-origin check: a null or malformed Origin refused; APP_URL, Host and X-Forwarded-Host (TRUST_PROXY>0) accepted — server/request.ts:68-81 (tests/request.test.ts)
80. Body cap for route handlers (a declared length refused up front, a chunked body cut off) — server/request-body.ts:9-39
81. The rate limiter is database-backed and shared across instances — server/rate-limit.ts:29-38
82. GET /api/admin/campaigns/[id]/usb-kit: apiViewer(campaigns.write), isUuid, campaign scoped by organisation, 404 for another organisation, no-store — route.ts:17-21, 39; cross-tenant row tests/cross-tenant.test.ts:431 [audit entry added by finding 16]
83. GET and POST /api/admin/drill/[id]: apiViewer(campaigns.write), sameOrigin on POST, live_drill feature, drillById and advanceDrill filter by organisation (services/drill.ts:207, 409), 404 for another organisation, no-store — route.ts:24-32 (tests/drill-route.test.ts, cross-tenant rows :432-433)
84. GET /api/admin/modules/[id]/scorm: apiViewer(studio.write), studio feature, isUuid, locale validated, per-user rate limit, scormData only for a library or own module (scorm/package.ts:23), audit, no-store — route.ts:15-30 (tests/scorm-export.test.ts:105, 161)
85. GET /api/admin/people/[kind]: rscProbe, getViewer, twoFactorGap; the export needs people.read, a rate limit, and listPeople scoped by organisation and department-head scope (queries/admin.ts:22-31, 60-82); invite-links on GET answers 405; no-store — route.ts:30-54. POST invite-links: sameOrigin before apiViewer(people.write), scoped to the organisation, excludes super_admin, audit — route.ts:68-85; cross-tenant rows :435-436
86. GET /api/admin/policies/[id]/signoffs: apiViewer(policies.read), isUuid, policy and people scoped by organisation, the IP column only with audit.read, audit, no-store — route.ts:17-41 (tests/signoffs-route.test.ts, cross-tenant row :437)
87. GET /api/admin/reports/[kind]: apiViewer(reports.read), reports feature, kind allow-list, the secops kind needs secops.read, from, to and d validated (400), rate limit, scopedPeople filters by organisation and department-head scope and a foreign or unknown department narrows to nobody (reports/build.ts:44-56, queries/admin.ts:37-39), audit, no-store — route.ts:18-52 (tests/reports-build.test.ts:55-73, tests/feature-gates.test.ts:55, cross-tenant rows :438-447)
88. GET /api/assets/[id]: public by design (logos on certificates and mails); isUuid; only the kind logo is ever inserted, with the MIME type allow-listed and SVG checked at upload (actions/settings.ts:94-101); nosniff and a sandboxed CSP — route.ts:8-18 [see finding 8]
89. GET /api/health: unauthenticated liveness; client-address diagnostics only for platform.manage without twoFactorGap; a session failure never fails the check; no-store — route.ts:32-35, 49 (tests/health-route.test.ts:67)
90. GET /api/me/export: rscProbe, getViewer, per-user rate limit, every query keyed by the viewer's own user id (sandbox also by organisation), audit, no-store — route.ts:12-16, 34-78, 109-115 (tests/me-export.test.ts)
91. GET /api/qr/[token]: token format check, recipient looked up by token only, private cache — route.ts:9-13
92. GET /api/sandbox/[id]/stix: rscProbe, getViewer, isUuid, analysis scoped by organisation, the owner or secops.read without twoFactorGap, 404 otherwise, no-store — route.ts:12-24; cross-tenant row :452
93. POST /api/sandbox/upload: sameOrigin, getViewer, sandbox feature, Content-Length required and capped, readBytesCapped, and analyzeUpload re-checks the feature and the per-user rate limit (sandbox/upload.ts:30-31) — route.ts:17-33 (tests/sandbox-upload.test.ts:41-82)
94. GET /api/sso/start: per-IP and per-organisation rate limits, slug regex before the database, the sso feature, ssoEnabled and domainVerifiedAt required unless it is an administrator test, PKCE, state and nonce sealed in an HttpOnly SameSite=Lax cookie, outbound discovery through guardedRequest (oidc.ts:20) — route.ts:26-77 (tests/sso-routes.test.ts:76) [see findings 7 and 12]
95. GET /api/sso/callback/[tenant]: the one-shot state cookie deleted first, state, organisation and slug matched, rate limits, email_verified required for the standard claim, domain proof required, accounts of other organisations and privileged roles refused, iss and sub bound to the account by a conditional update, auto-create only on the proven domain, a generic /sign-in?error=sso to the browser with the reason only in the audit log — route.ts:35-45, 83, 104-138 (tests/sso-routes.test.ts:85-140)
96. POST /api/subtitles: sameOrigin, getViewer, ai_tutor feature, per-user volume limit, 1 KB body cap, zod schema, reachableModules limits lessons to library or own published modules, or own drafts for Studio authors (queries/catalog.ts:39-44), model-call limits per user and per organisation, no-store — route.ts:33-85 (tests/subtitles.test.ts:376-444, cross-tenant row :456)
97. GET /api/super/demo-requests and /api/super/seats: apiViewer(platform.manage), audit, no-store — demo-requests/route.ts:10-23, seats/route.ts:11-26; cross-tenant rows :457-458
98. GET /api/t/[token]/open: token format check, recordOpen only for campaigns that are not cancelled, no-store — route.ts:9-10, services/campaigns.ts:121-132
99. POST /api/tutor: sameOrigin, getViewer, ai_tutor feature, per-user rate limit, body cap and zod schema, modules limited to the library or the own organisation and to published unless studio.write, an own module overrides a library slug, cache keyed per organisation, no-store — route.ts:22-66, 113-116 (tests/tutor-cache.test.ts, cross-tenant row :460) [see finding 11]
100. The inventory test pins every route handler to a guard string and runs each as another organisation's administrator and as a lower role, asserting refusal and no change to the other organisation — tests/cross-tenant.test.ts:503-535 with tests/fixtures/surface.json
101. Audit check: the existing route suites pass at a139d56, 14 files and 250 tests (cross-tenant, sso-routes, drill-route, sandbox-upload, api-viewer, signoffs-route, scorm-export, tutor-cache, subtitles, me-export, health-route, feature-gates, reports-build, request)

### A.4 Input validation and parsers

102. SSRF: private and reserved IPv4 ranges, including 0/8, 10/8, 127/8, 100.64/10, 169.254/16, 172.16/12, 192.0.0/24, 192.0.2/24, 192.168/16, 198.18/15, 198.51.100/24, 203.0.113/24 and 224 and above — server/net-guard.ts:22-41
103. SSRF: IPv6 ::/96, IPv4-mapped, translated and NAT64 (including 64:ff9b:1::/48), ULA, link-local, site-local and multicast; fail-closed on anything that is not valid IPv6 — net-guard.ts:47-66 (confirmed by a throwaway test)
104. SSRF: vetDestination refuses malformed hosts, names over 253 characters, localhost, .localhost, .local and .internal, and disallowed ports before DNS, and requires every resolved address to be public (rebinding) — net-guard.ts:77-94; numeric and metadata spellings of private addresses all refused (throwaway test)
105. SSRF: pinnedLookup answers only with vetted addresses; guardedRequest requires https when vetted, reuses no pooled socket, follows no redirect, does no decompression, caps Content-Length and the streamed body, and times out after 10 s — net-guard.ts:105-155 (tests/oidc-fetch.test.ts, tests/outbound-guard.test.ts)
106. SSRF: port allow-list per destination kind (smtp 25/465/587/2525, webhook 443/8443, syslog 514/601/6514, https 443/8443) — lib/destination-ports.ts:5
107. SSRF: the SMTP host is vetted at save (settings.ts:348-350) and again at send; nodemailer connects to the vetted IP with servername for TLS — server/mail.ts:117-129
108. SSRF: the webhook URL must start with https:// and pass destinationProblem at save — settings.ts:531, 546-549; re-vetted and pinned at delivery, response body not read — server/jobs.ts:184-199
109. SSRF: the syslog host is vetted at save (settings.ts:550-553) and before each delivery; TCP and TLS sockets use pinnedLookup, UDP sends to the vetted address — jobs.ts:203-207, 262-289 (tests/outbound-guard.test.ts)
110. SSRF: OIDC discovery, token and JWKS fetched through guardedRequest (vetted in production), https-only endpoints, 256 KB response cap, JSON content-type check, issuer match, the authorization endpoint on the issuer host — server/auth/oidc.ts:16-76
111. DNS: the domain proof uses a dedicated resolver with a 5 s timeout and one try; errors count as missing — server/auth/domain-proof.ts:48-61
112. IDN hosts: normaliseHost converts Unicode names with domainToASCII only when they match the Unicode host class, then enforces the ASCII host regex — domain-proof.ts:16-30 (tests/idn-domains.test.ts)
113. Body size: route handlers read bodies with readBodyCapped or readBytesCapped (a declared length refused up front, the stream cut past the limit) — server/request-body.ts:9-39; used at api/tutor/route.ts:29 (8 KB), api/subtitles/route.ts:41 (1 KB), api/sandbox/upload/route.ts:24 (10 MiB + 4 KB)
114. Upload: the sandbox route requires same-origin, a session, the feature and a positive declared Content-Length within BODY_LIMIT, and re-parses the multipart body from the capped bytes — app/api/sandbox/upload/route.ts:17-31; the shared analyzeUpload enforces the feature, 30 per 10 minutes, a File instance, a size above 0 and within MAX_FILE_BYTES, URL input cut to 2000 characters, and never stores the bytes — server/sandbox/upload.ts:30-44 (tests/sandbox-upload.test.ts)
115. Sandbox analyser: type sniffing by magic bytes with padded header reads — server/sandbox/analyze.ts:221-239; the zip central directory walk bounded (5000 entries, bounds checks) — :175-204; per-entry inflate capped at 4 MB of output, encrypted and large entries skipped — :206-219; at most 12 text entries read — :412; the indicator scan limited to 200 k characters, 25 URLs and 10 e-mails — :260, :281-290; regexes written to avoid quadratic scans — :266-277, :372-379 (tests/sandbox.test.ts, tests/regex-dos.test.ts) [e-mail value cap added by finding 9]
116. Sandbox: submitted URLs are never fetched (analyzeUrl is pure string analysis) — analyze.ts:94-169; the only fetch( in src/server is in sms.ts (grep)
117. CSV injection: cells starting with = + - @, a tab or a CR get a leading apostrophe (international phone numbers excepted by design), quoting of commas, semicolons, quotes and newlines, UTF-8 BOM — lib/csv.ts:57-68 (tests/exports.test.ts, tests/csv-phone.test.ts; confirmed by a throwaway run)
118. CSV import: 900 KB cap on the JSON-escaped form, 5000-row cap, header required, email through z.email().max(254), phone through cleanPhone and PHONE_PATTERN, role and language looked up with Object.hasOwn (no prototype keys), name, department and job title cut to 120, manager e-mail cut to 254, departments matched by folded key, all-or-nothing transaction — server/actions/people.ts:514-600 (tests/people-import.test.ts)
119. XLSX: inline strings only (never formulas), XML escaping of the markup characters and removal of XML-illegal characters, non-finite numbers written as text, the sheet name stripped of forbidden characters and cut to 31 — server/reports/xlsx.ts:11-19, 40-46, 58 (tests/exports.test.ts)
120. HTML in mail: escapeHtml on every text token, link hrefs restricted to http(s) by the markup grammar and attribute-escaped, template values escaped with escapeEmailMarkup so names cannot become links, user-typed text never becomes a button — server/mail.ts:26-66, lib/email-markup.ts:9-22, server/services/notify.ts:88-100, server/actions/learning.ts:221-227 (tests/email-escapes.test.ts; confirmed by a throwaway run)
121. The brand colour injected into mail styles is validated as #rrggbb — server/actions/settings.ts:57-58, lib/color.ts:1-5
122. Campaign simulation mail escapes the template text, and its links are server-built tracking URLs only — server/services/campaigns.ts:49-69; the USB beacon HTML escapes the shown name — app/api/admin/campaigns/[id]/usb-kit/route.ts:32-34
123. Syslog and CEF: header and extension escaping (backslash, pipe, equals, line breaks), event name sanitised, extension keys reduced to letters and digits — jobs.ts:226-253 (tests/syslog.test.ts)
124. SCORM export: XML-escaped manifest and launcher, a sanitised identifier, lesson data emitted as a separate JSON script file — server/scorm/package.ts:47-107; the download filename slug sanitised — app/api/admin/modules/[id]/scorm/route.ts:28 (tests/scorm-export.test.ts)
125. The Markdown renderer (policies, legal texts) emits React elements only; links limited to http(s) or site-relative paths; external links get rel=noopener noreferrer — lib/markdown.tsx:19-44 [tightened by finding 13]
126. No dangerouslySetInnerHTML with user data: the two uses render a server-generated QR SVG (profile.ts:32) and a static nonce script (grep of src)
127. Logo upload: the data-URL regex restricts the MIME type to png, jpeg and svg+xml and the base64 alphabet, 512 KB cap, SVG check, served with nosniff and a `default-src 'none'; sandbox` CSP — settings.ts:85-102, app/api/assets/[id]/route.ts:11-18 [see finding 8]
128. Notification templates: subject up to 200 characters, body up to 5000 and must keep {{link}}, kinds and locales enum-keyed — server/schemas/notifications.ts:8-31
129. Tutor and subtitles requests: zod schemas with a regex-bounded slug and lesson key, a 100-character sceneId without control characters, a 2 to 500 character question (server/tutor.ts:15-27); lessonId through z.uuid() and the target limited to SUBTITLE_LANGUAGES before it reaches the model prompt — app/api/subtitles/route.ts:16, lib/content/subtitle-languages.ts:20-22
130. Tokens: tracking, QR, certificate and open-pixel tokens validated against `/^[a-z2-7]{10,40}$/` before any query — server/tracking.ts:22, api/qr/[token]/route.ts:9, api/t/[token]/open/route.ts:9, app/(public)/c/[token]/page.tsx:21; the account-link token length-capped before hashing — app/(auth)/account/[kind]/[token]/page.tsx:21; the session token up to 100 characters — server/auth/viewer.ts:58
131. Route params and query filters: isUuid for ids (lib/ids.ts:31), parseDay for dates, malformed filters refused with 400 — api/admin/reports/[kind]/route.ts:25-33; the report kind checked against REPORT_KINDS — :20; locale through isLocale — api/admin/modules/[id]/scorm/route.ts:19
132. Organisation slugs validated by TENANT_SLUG_RE before database queries in SSO start and callback — server/services/tenants.ts:13, api/sso/start/route.ts:27-34, api/sso/callback/[tenant]/route.ts:40
133. SSO callback: the email claim through z.email().max(254), email_verified required for the standard claim, sub length-capped, the provider error string regex-limited, the display name cut to 120 — api/sso/callback/[tenant]/route.ts:20, 66, 77-89
134. ID token verification: algorithm allow-list (RS256, ES256), JWKS key match, signature, iss, aud and azp, exp, iat and nonce — oidc.ts:116-151
135. Redirect targets: safePath keeps only same-site paths and refuses //, backslash, control characters, dot-segment tricks and sign-in loops — lib/safe-path.ts:10-15 (tests/safe-path.test.ts); no redirect() in app/api or the actions takes raw user input (grep)
136. Settings schemas: every free-text field has a maximum length; ports 1 to 65535; PEM envelope check; the certificate pin normalised to 64 hex characters; URLs must start with https:// — settings.ts:55-66, 195-240, 328-338, 441-445, 529-537
137. Studio lesson authoring bounded by lessonDraftSchema (title 120, intro 1200, 2 to 8 points of up to 400, 2 to 4 options, recap up to 300 each) and enums for locale, category and difficulty, minutes 1 to 30 — server/ai.ts:14-27, server/actions/secops.ts:464-468
138. Public demo form: honeypot, zod schema, per-IP, per-email and site-wide rate ceilings — server/actions/site.ts:67-95
139. Password inputs bounded (8 to 256 characters) before argon2 — server/auth/password.ts:25-26
140. Phone numbers: one cleanPhone and PHONE_PATTERN rule for sign-in, dialogs and import — lib/phone.ts:2-11, people.ts:51-55, 582-583
141. The zip writer used for XLSX and SCORM is write-only (no archive parsing on this path); the only archive reader is the sandbox analyser, with the caps above — server/zip.ts:4-44

### A.5 Cryptography, secrets and limits

142. Encryption at rest of integration and TOTP secrets: AES-256-GCM with a random 12-byte IV and the key sha256("enc:" + APP_SECRET) — server/crypto.ts:21-36
143. Production refuses a missing or short APP_SECRET at module load and at start-up (exit 1); the development fallback only outside production — server/crypto.ts:8-13, server/env.ts:20, 96-98, instrumentation.ts:14-20
144. Key ring: v2 ciphertext carries the key id; decryption tries the named key and then every configured key; v1 is tried with all; APP_SECRET_PREVIOUS counts only with 32 or more characters — crypto.ts:16-19, 47-66 (tests/crypto.test.ts:84-120)
145. The rotation script re-seals the organisation's `*Enc` fields under a row lock and users.totp_secret with a conditional update, is idempotent and counts unreadable values; it refuses the development key, a short previous key and a missing domain-proof key — server/services/secret-rotation.ts:41-92, 12-28, portal/scripts/rotate-secret.ts:11-16 (tests/crypto.test.ts:122-178)
146. Domain-proof TXT value: HMAC(organisation id, APP_DOMAIN_PROOF_SECRET or APP_SECRET) truncated to 96 bits; the previous key accepted during rotation; DNS errors count as missing — server/auth/domain-proof.ts:33-45, 48-61, server/env.ts:24, 129
147. TOTP key of 160 random bits, stored encrypted; the code check is timingSafeEqual over steps n-1 to n+1; replay blocked by a conditional totp_last_step update — server/auth/totp.ts:12-17, 24-33, 39-48 (tests/auth-security.test.ts:283-294)
148. Backup codes: 10 codes of about 49.5 bits from crypto.getRandomValues, stored as an HMAC keyed from APP_SECRET, previous-key and legacy forms accepted, spent by one conditional jsonb update — totp.ts:51-77, server/actions/auth.ts:297-306 (tests/auth-security.test.ts:103-132)
149. Password hashing Argon2id m=19456 t=2 p=1 (OWASP baseline); verification swallows malformed hashes; length 10 to 256 and zxcvbn score 3 — server/auth/password.ts:6-29
150. Session token of 192 random bits stored as SHA-256, a `__Host-` cookie in production, HttpOnly, Secure and Lax, sliding renewal capped at 90 days, device limit — server/auth/session.ts:13-32, 63-76, 93-108, server/auth/viewer.ts:56-82
151. Invite and reset tokens of 192 random bits stored hashed, reset 60 minutes and invite 14 days, single use, other invites retired on first use — server/auth/links.ts:13-28, server/actions/auth.ts:473-494
152. Phone codes: 6 digits from crypto.getRandomValues, stored as sha256(otp:userId:code), 5 minutes, 5 guesses through one conditional update, replaced on resend, sent after the answer — server/actions/auth.ts:366-383, 413-425 (tests/auth-security.test.ts:139-191) [ceiling added by finding 10]
153. SSO state cookie signed with HMAC-SHA256 (timingSafeEqual), 10-minute validity, state, nonce and PKCE verifier of 256 random bits, one attempt per cookie — server/crypto.ts:73-85, server/auth/oidc.ts:79-103, app/api/sso/callback/[tenant]/route.ts:35-40 (tests/sso.test.ts:49)
154. Webhook secret of 192 random bits, shown once and stored encrypted; deliveries signed with an HMAC and a timestamped HMAC — server/actions/settings.ts:567-573, server/jobs.ts:178-196
155. Stored secrets never reach the client: the settings page turns clientSecretEnc, passwordEnc and webhookSecretEnc into `has*` booleans — app/(admin)/admin/settings/page.tsx:50-58, components/admin/settings-tabs.tsx:81-85
156. Secrets in logs: logFailure drops error messages (keeps name, code and frames), Server Function logging is off, invite and reset links are redacted from the outbox after delivery, the SMTP password and API key are never logged — server/db/errors.ts:38-43, portal/next.config.ts:24, server/mail.ts:141-143, 252-255 (tests/outbox-redact.test.ts)
157. The sign-in lockout claims a failure row before the check: 5 per account and client and 30 per client per 15 minutes, an hourly ceiling of 50 that holds only clients that already failed, a dummy Argon2 hash for unknown accounts, anonymous slowdown without TRUST_PROXY — server/actions/auth.ts:38-53, 107-161, 272-283 (tests/auth-security.test.ts:193-214)
158. Second-factor guesses 5 per account per 15 minutes through claim(); step-up 10 per actor per 15 minutes with audit; password confirmation 10 per 15 minutes — server/actions/auth.ts:317-319, server/auth/step-up.ts:17-23, server/actions/profile.ts:19 (tests/step-up.test.ts:111)
159. Reset mails: per recipient, client and ceiling throttle, plus 1000 per organisation per hour counted only for real accounts, sent after the answer — server/actions/auth.ts:167, 175-182, 438-462 (tests/auth-security.test.ts:215-248)
160. Shared database rate limiter: an atomic upsert per key and window, windows capped at 24 hours, the in-memory path only under VITEST, daily clean-up of ended windows — server/rate-limit.ts:16-57, server/jobs.ts:380-383 (tests/rate-limit.test.ts)
161. Client address: X-Forwarded-For hops counted from the right only when TRUST_PROXY>0, IPv6 keyed by /64, mapped and NAT64 addresses by the embedded IPv4 — server/request.ts:11-53 (tests/request.test.ts)
162. Body limits: Server Actions keep Next's 1 MB default; route handlers read bodies through readBodyCapped or readBytesCapped (a declared length refused up front, the stream cut past the cap): tutor 8 KiB, subtitles 1 KiB, sandbox upload 10 MiB + 4 KiB with a declared length required; proxy buffer 11 MB — server/request-body.ts:9-39, app/api/tutor/route.ts:29, app/api/subtitles/route.ts:41, app/api/sandbox/upload/route.ts:9, 22-25, portal/next.config.ts:37-40 (tests/tutor.test.ts:63-98, tests/sandbox-upload.test.ts:51-82)
163. Per-user limits on every abuse-prone action (captions, exports, reports, SCORM, tickets, feedback, problems, lab, sandbox, threat reports, signing, deletion requests) and per-organisation limits on domain checks, test mails and drills — call sites by grep of rateLimit( in src/server/actions and src/app/api, for example server/actions/settings.ts:127, 313, 393 and server/actions/drill.ts:32
164. Demo form: 5 per client and 3 per e-mail per hour, a site-wide ceiling of 100 mails and then 400 stored requests per hour, honeypot; demo_requests cannot exceed 500 rows per hour — server/actions/site.ts:67-73, 78 (tests/demo-action.test.ts)
165. Subtitle model calls capped per person per 10 minutes and per person and organisation per day; source text capped at 30 000 characters — app/api/subtitles/route.ts:74-84, server/subtitles.ts:131 (tests/subtitles.test.ts:418)
166. Job budgets: 20 s per delivery step (mail, SMS, webhooks, syslog), 200 rows per tick, exponential backoff with 6 attempts (8 for mail), an unreachable receiver skips its other rows for the tick, clean-up within 30 s in batches of 5000 rows, one tick at a time under an advisory lock — server/jobs.ts:42, 95-153, 349-364, 376, server/mail.ts:187-188, 276-318, server/services/campaigns.ts:295-322, server/jobs-runner.ts:23-81 (tests/jobs-ops.test.ts:94)
167. Outbound SMTP, webhook and syslog destinations vetted (public address, allowed ports) at save and at send with a pinned lookup; responses capped (OIDC 256 KiB, webhook body not read); SMTP timeouts bounded — server/net-guard.ts:77-155, server/mail.ts:82, 117-131, server/auth/oidc.ts:16-20
168. Randomness: every token, public certificate token, code digit, IV, nonce and webhook secret uses crypto.getRandomValues, randomBytes or randomUUID; the only Math.random is a retry jitter in portal/scripts/generate-narration.ts:116 — server/services/progress.ts:14-18, server/auth/oidc.ts:97-99, proxy.ts:116
169. The health endpoint shows only the database status, tick age and backlog counts; client-address diagnostics only to a signed-in platform operator with 2FA — app/api/health/route.ts:21-37
170. Certificate serials taken from the highest issued serial with a unique-index retry, never from a row count — server/services/progress.ts:198-241

### A.6 Browser-side controls

171. Nonce-based CSP with 'strict-dynamic', object-src 'none', base-uri 'self', form-action 'self', frame-ancestors 'none', connect-src 'self', worker-src 'self' blob:, 'unsafe-eval' only outside production, upgrade-insecure-requests on HTTPS — proxy.ts:50-66; applied to every page response at :119-121 and :143; the per-request nonce and policy overwrite any client-sent x-nonce, content-security-policy and x-pathname headers at :119-121 [tests added by finding 14]
172. Static security headers on `/:path*`: X-Content-Type-Options nosniff, X-Frame-Options DENY, Referrer-Policy strict-origin-when-cross-origin, COOP same-origin, Permissions-Policy (camera, geolocation, payment and usb denied, microphone self); poweredByHeader off — portal/next.config.ts:6-13, :21, :46 [tests added by finding 14]
173. HSTS per request, with includeSubDomains and preload only when the operator opts in, on pages, redirects, API, assets and prefetches, only on HTTPS production — proxy.ts:31-42, :74, :83, :95, :112, :144 (tests/proxy-hsts.test.ts:23-45)
174. Server Function arguments are not logged in development (step-up passwords) — portal/next.config.ts:25
175. The service worker caches only /offline, icons, /_next/static, /icons and /rive; pages and API responses are never cached (navigations are network-only with the offline fallback); cross-origin and non-GET requests are left alone — portal/public/sw.js:24-50; registered in production only — components/sw-register.tsx:8-9; /sw.js served no-cache with a JavaScript content type — portal/next.config.ts:52
176. The offline page's inline script carries the request's CSP nonce and reads only the locale cookie — app/offline/page.tsx:15, :40
177. Private API responses (exports, reports, drill, health, me/export, STIX, subtitles, super, tutor, sign-in redirect) are sent with cache-control no-store — app/api/admin/people/[kind]/route.ts:50, :84; api/admin/reports/[kind]/route.ts:46, :51; api/admin/drill/[id]/route.ts:32; api/me/export/route.ts:113; api/sandbox/[id]/stix/route.ts:23; api/health/route.ts:18; server/auth/api.ts:50; narration clips cached as immutable never carry a session cookie — proxy.ts:23-24 (tests/proxy-hsts.test.ts:62-66)
178. Open-redirect guard safePath (same-site only; refuses //host, backslash, control characters, dot-segment collapse, the sign-in loop and the bare root) — lib/safe-path.ts:10-15; used on the sign-in pages (app/(auth)/sign-in/page.tsx:15-16, phone/page.tsx:15-16, verify/page.tsx:15-18), in server actions (server/actions/auth.ts:90-91, :267, :288, :313, :327, :392, :430), for the policies from= parameter (app/(focus)/policies/[id]/page.tsx:58) and the learn from= parameter (app/(learner)/learn/[slug]/page.tsx:87) (tests/safe-path.test.ts)
179. The proxy's sign-in redirect builds next= from the request path only, and every other proxy redirect uses a fixed same-host path — proxy.ts:78-83, :88-96, :99-113; /start redirects to fixed paths — app/start/route.ts:7; the API's denied redirect uses the request's own path — server/auth/api.ts:49
180. SSO start: the redirect target is the discovered provider's authorization endpoint for a validated organisation slug, with state, nonce and PKCE sealed in an HttpOnly cookie and fixed failure paths; the test mode needs a settings.write session of the same organisation — app/api/sso/start/route.ts:21-78; the callback redirects only to fixed paths — app/api/sso/callback/[tenant]/route.ts:40, :53, :151 [see finding 7]
181. Only two dangerouslySetInnerHTML uses: the constant offline script (app/offline/page.tsx:40) and the TOTP QR SVG made on the server by the qrcode library from the otpauth URI (server/actions/profile.ts:32, rendered in app/(learner)/profile/profile-client.tsx:361); no innerHTML anywhere else
182. The Markdown renderer produces React elements only; javascript: and other schemes stay text; https links get target=_blank rel=noopener noreferrer — lib/markdown.tsx:23-32 (the protocol-relative gap was reported as finding 13)
183. Email-template preview links restricted to https?:// and opened with noopener noreferrer — lib/email-markup.ts:9-10, components/admin/settings-tabs.tsx:867
184. Intel source links: sourceUrl is written only by portal/scripts/seed.ts:769-778 (https constants), no server action writes it (server/actions/secops.ts:402-440 update the status only), rendered with target=_blank rel=noopener noreferrer — app/(admin)/admin/intel/[kind]/page.tsx:70
185. In-app notification hrefs are server-built relative paths (/learn/…, /profile, /admin/users/…), the invite link stripped of its origin — server/services/notify.ts:120, :135, :147; server/actions/people.ts:175; rendered through next/link — components/shell/notifications.tsx:86
186. Avatar: only `data:image/(jpeg|png|webp);base64` up to 300 000 characters accepted — server/actions/profile.ts:96-100; rendered as an image source under img-src 'self' blob: data:
187. Tenant logo: a MIME allow-listed data URL, 512 KiB cap, SVG refused on script, handler, foreignObject or external reference (server/svg-safety.ts:7-24, tests/svg-sanitize.test.ts), stored as an asset and referenced only as /api/assets/{id}?v=sha — server/actions/settings.ts:95-102; served with nosniff and a sandboxing CSP with default-src 'none' — app/api/assets/[id]/route.ts:11-18 [see finding 8]
188. Certificate page /c/[token]: token format checked, deleted users hidden, shown publicly only when the organisation's certificate.publicLink is on or the viewer is the holder or an administrator of that organisation, robots noindex, referrer no-referrer; it reveals only name, organisation, subject, date, serial and evidence kind — app/(public)/c/[token]/page.tsx:16, :21-33 [audit entry added by finding 16]
189. Teachable landing /t and /q: token format checked; reveals only the organisation name, the template's red flags, the brand name and the module slug (never the recipient); the click is counted by a beacon, not by rendering; the fake sign-in is hidden from scanners and for cancelled campaigns; the fake inputs carry no name, so nothing typed is sent; robots noindex and referrer no-referrer — server/tracking.ts:22-39; components/site/teachable.tsx:38-45, :70-78; app/(public)/t/[token]/page.tsx:8, q/[token]/page.tsx:8 (tests/simulation-tracking.test.ts:110-167)
190. The tracking pixel and QR image routes validate the base32 token, the QR links only to the app's own /q/{token}, responses are no-store or private — app/api/t/[token]/open/route.ts:8-10; app/api/qr/[token]/route.ts:9-13; tokens are 16 random bytes in base32 — server/services/campaigns.ts:101, server/services/progress.ts:14-18
191. Legal pages: doc limited to privacy or terms (dynamicParams false), ?lang validated with isLocale, text read from the content/legal files, Markdown rendered as React — app/(site)/legal/[doc]/page.tsx:11-16, :40-45; the landing and OG routes validate the lang parameter — app/(site)/[lang]/page.tsx:24, app/og/[lang]/route.tsx:33
192. Account invite and reset page: token hashed before lookup and length-capped, used or expired tokens refused, noindex and referrer no-referrer — app/(auth)/account/[kind]/[token]/page.tsx:14, :20-27
193. robots.txt disallows /admin, /super, /learn, /api/, /t/, /q/, /c/, /account/ and /print/; the sitemap lists only the public site and legal pages — app/robots.ts:14-17, app/sitemap.ts:11-17; token pages also set robots noindex
194. localStorage holds only non-personal preferences: the admin tour done flag (components/admin/admin-tour.tsx:42, :114, :200), player control preferences (components/player/controls.ts:15-33), the haptics flag (lib/haptics.ts:15, :23), and the public-site guide's memory of visits, quiz score, role and quiet flag (components/site/guide.tsx:19, :206, :235); sessionStorage holds the lesson position and result keyed by user id, slug and lesson key, with version and size caps, in the tab only — components/player/resume.ts:19-28, components/player/player.tsx:93-104
195. Admin tour anchors are constant data-tour names, with no data rendered as HTML — components/admin/admin-tour.tsx:29-40, :50-56; the drill page requires campaigns.write and the live_drill feature, validates the UUID, and its GET never applies events; the dashboard's advancing POST is same-origin checked — app/(admin)/admin/drill/[id]/page.tsx:17-23, app/api/admin/drill/[id]/route.ts:26
196. The player's done state uses history.replaceState on the current same-origin URL only — components/player/player.tsx:113-118; the SCORM app reads only a lesson key from the hash through a strict regex — scorm/app.tsx:42-46
197. The development database is kept out of the standalone build, and content is included — portal/next.config.ts:32-33

### A.7 Evidence integrity and audit

198. A lesson attempt starts on the server (started_at, 4-hour sitting rule) — server/services/progress.ts:165-175, called from server/actions/learning.ts:101-107
199. Completion refused when not started, too fast (minDwellMs is the larger of 20 s and 25 %), with a scored scene unanswered, or with an invalid submission, with a learning.completion_refused audit row carrying the reason — server/actions/learning.ts:166-180; lib/content/scoring.ts:18-20, 117-134
200. Answers re-scored from the stored lesson content; correct, firstTry and outcome never taken from the browser (the schema accepts only sceneId, itemId and picked) — server/actions/learning.ts:119-129, 167; lib/content/scoring.ts:31-89 (tests/learning-actions.test.ts:103, the "forged" case)
201. The attempt is consumed by one conditional update before any write; a duplicate completion stores nothing — server/actions/learning.ts:183-188 (tests/learning-actions.test.ts:124)
202. Time trained is taken from the server clock, capped at the lesson's minutes times 180 — server/actions/learning.ts:198 (tests/learning-actions.test.ts:137)
203. Draft modules: learners never reach them; Studio authors preview them but earn nothing — server/actions/learning.ts:24-36, 156 (tests/learning-actions.test.ts:156)
204. First-completion XP claimed by a single insert-on-conflict statement; replays add attempts and time only — server/services/progress.ts:72-97 (tests/learner-progress.test.ts:97, 107)
205. The streak moves only through awardXp, never backwards, with freezes capped — server/services/progress.ts:31-46; lib/domain/gamification.ts:56-74
206. Report bonus XP capped at 5 per day under a users row lock — server/services/threats.ts:95-109; lab XP once per exercise per day under the same lock, VM labs scored on the server from the event log — server/lab/attempts.ts:14-31, server/lab/vm-action.ts:20-31, server/actions/engage.ts:19-41
207. Attestation only from awaiting_attestation, written in one transaction with the completion and the certificate; one attestation and one certificate per person and module or path, backed by unique indexes — server/services/progress.ts:247-271; server/db/schema.ts:513, 532-533; the path certificate catches certificates_user_path_idx — server/actions/learning.ts:65-72
208. Certificate serials per organisation and year from the highest issued, a serial collision retried in a savepoint — server/services/progress.ts:198-241
209. Module-linked risks close on attestation, and on a full replay only after the risk opened — server/services/progress.ts:130-156, 265-268 (tests/simulation-tracking.test.ts:184-230)
210. Public certificate page: token format check, deleted users hidden, the publicLink setting honoured (owner and staff only otherwise), noindex and no-referrer — app/(public)/c/[token]/page.tsx:21-34, 16
211. Campaign tracking: open, click and submit each claimed once by conditional updates; a submit needs a prior click; nothing is recorded once cancelled; a click opens a phishing_click risk and recomputes the risk — server/services/campaigns.ts:121-205
212. The landing page records nothing; the click is a JavaScript beacon refused for known scanners and prefetch; the token format is enforced — server/tracking.ts:12-38; server/actions/campaigns.ts:101-110
213. Tracking tokens are 128-bit random (randomToken(16)) and unique — server/services/campaigns.ts:99; server/db/schema.ts:880
214. Campaign launch claimed once (draft or scheduled to running), plan and channel re-checked at every launch, blocked launches audited; status changes only to cancelled or completed, one end state — server/services/campaigns.ts:73-120, 264-271; server/actions/campaigns.ts:84-93
215. A threat report matches only the reporter's own recipients, by tracking link first — server/services/threats.ts:59-75
216. The live drill feature is seed-only: in no plan, operator override refused, action and route check the feature — lib/tenant-defaults.ts:354-362; server/actions/platform.ts:68; server/actions/drill.ts:25, 51; app/api/admin/drill/[id]/route.ts:28
217. Live drill lease: a compare-and-set claim on applied_until with takeover of an expired lease, a per-step compare-and-set, release only by the holder; lookups scoped to the organisation; a cancelled or completed campaign ends it; GET read-only, POST same-origin; skip ignores other organisations' ids — server/services/drill.ts:204-262, 300-306; app/api/admin/drill/[id]/route.ts:14-33
218. Drill replay safety through idempotent services (the report step checks reportedAt; XP and certificate once) — server/services/drill.ts:163-166 (tests/drill-service.test.ts:131, 150)
219. The drill starter is left out of the audience, starts are limited to 20 per hour per organisation, drill.started and drill.finished are audited — server/services/drill.ts:63, 118, 283-292; server/actions/drill.ts:32
220. Report downloads: permission and feature, the secops kind needs secops.read, malformed filters refused, rate limit 60 per hour, report.downloaded audited with the filters; the printed and compliance-pack versions are audited too — app/api/admin/reports/[kind]/route.ts:18-38; app/(print)/print/report/[kind]/page.tsx:24-42; app/(print)/print/compliance/page.tsx:24-25, 73
221. Report rows scoped to the viewer's organisation and, for department heads, to their department closure; a department filter never widens the scope — server/reports/build.ts:44-56; server/queries/admin.ts:22-39 (tests/reports-build.test.ts:56-70)
222. Scheduled reports: the department must be in scope and the organisation's; scoped roles remove only their own schedules; the mail carries a link that goes through sign-in — server/actions/reports.ts:36-43, 54-57; server/jobs.ts:712-716 [test added by finding 5]
223. CSV formula injection neutralised, XLSX text XML-escaped — lib/csv.ts:57-64; server/reports/xlsx.ts:11-19 (tests/exports.test.ts:21-27)
224. The people export is scoped by listPeople and audited; the sign-off CSV shows IPs only to audit.read roles and is audited; the personal data export is rate-limited, own rows only, without tracking tokens, and audited — app/api/admin/people/[kind]/route.ts:39-50; server/queries/admin.ts:59-82; app/api/admin/policies/[id]/signoffs/route.ts:30-38; app/api/me/export/route.ts:16, 58-63, 79
225. Retention clean-up deletes, per organisation, only answers (by date), closed risks (closed before the cut-off; open ones kept) and audit rows; lesson progress, XP, attestations and certificates are never touched; a purge leaves a retention.purged entry; bounded batches and a time budget — server/jobs.ts:356-427 (tests/jobs-ops.test.ts:43, 94) [floor and kept entries added by finding 15]
226. Platform-wide clean-up limited to expired or finished operational rows (login attempts, rate buckets, expired sessions and tokens, old watermark codes, sent mail, deliveries, read notifications, tutor cache, demo requests) — server/jobs.ts:379-396
227. Audit entries written for every privileged mutation reviewed: people (`person.*`, people.imported and exported, invite links, 2fa_reset, sso.unlinked), platform (tenant.created and changed, platform.admin_link), settings through saveSettings (`settings.*`), workspace (`department.*`, `assignment.*`, `policy.*`), campaigns, drill, reports, secops, incidents and loops, Studio modules, paths and sessions — server/actions/people.ts:166-393, platform.ts:50-183, settings.ts:45-586, workspace.ts:67-411, secops.ts:43-744; server/services/secops.ts:49-224 [export entries added by finding 16]
228. Audit meta sanitised (U+0000 removed), so no entry fails to write — server/services/audit.ts:143-174
229. Risk recomputation emits risk.threshold_crossed once, through a conditional update — server/services/risk.ts:126-133

## Phase 5 follow-up review (2026-11-11)

A final review of the branch after wave D, on `3eccb2c`. Like the audit above, it was defensive: controls were read, traced and tested in code. Decisions: ADR-075 to ADR-081 in `docs/build/DECISIONS.md`. Owner questions: items 70 to 74 in `docs/build/OPEN-QUESTIONS.md` (English mirror `OPEN-QUESTIONS.en.md`).

### Method

Workflow `wf_71af126a-b7f` ran seven independent reviewers. Each is an installed agent type with its own lens. All ran on Claude Opus, as the owner chose when Mythos was not available.

| Reviewer | Lens | Finding ids |
|---|---|---|
| `ecc:security-reviewer` | Security | SEC |
| `agent-skills:security-auditor` | Threat model and hardening | TM |
| `ecc:code-reviewer` | Code | F |
| `ecc:react-reviewer` | React | R |
| `ecc:typescript-reviewer` | TypeScript | TS |
| `ecc:database-reviewer` | Database | DB |
| `agent-skills:test-engineer` | Test coverage | T |

Each finding of severity minor or above then went to verifiers told to refute it: one verifier for a minor, two for a major or blocker. A finding counted only when every verifier confirmed it. The run used 77 agents with 0 errors. 50 findings were verified: 44 were confirmed (12 major and 32 minor, by the verifiers' own ratings) and 6 were refuted (SEC-03, SEC-04, TM-05, TM-09, TM-10, TS-09). 7 nits were not verified. A second-model review with Codex CLI was tried once, but `codex exec` still crashes on this computer (exit 139, OPEN-QUESTIONS 24), so the review rests on the seven reviewers.

### Security-relevant findings and how they are closed

Severity is the verifiers' rating. Every confirmed finding is closed with a test.

| Id | Severity | Missing or incomplete control | How it is enforced now | Commit(s) | ADR |
|---|---|---|---|---|---|
| SEC-01, SEC-02, TM-07 | Minor | A reporting-API token outlived every credential reset of its creator. It was minted with a session alone, nobody was told, and it never expired. | A lifetime is chosen at minting: 30, 90, 180 or 365 days in the settings (the action accepts any whole number of days up to 365), 90 by default (`api_tokens.expires_at`). An expired token gets 401, is audited as `api_token.refused` with reason `expired`, and frees its slot under the 20-token cap. Minting takes the actor's password (step-up), so an SSO-only administrator cannot mint, and the other active administrators get an in-app security notice. Revocation: see below. | `821ceda`, `ec3365f`, `a420aec` | ADR-075 |
| TM-03 | Major | Account deletion left the person's name in re-simulation campaigns, click risks, audit meta and manager alerts, and kept the IP of the person's own audit entries. | Deletion scope: see below. | `6dfb243`, `8f5a5c4`, `32ead44`, `a420aec` | ADR-076 |
| TM-01, TM-02 | Major | A one-person re-simulation carried the person's full name in its campaign name, and so in webhooks, syslog, audit entries, reports and the leadership risk story. | The name is neutral (`{template}: re-simulation` in the organisation's language). The person is linked only through `campaigns.user_id` and shown on the campaign page at render. Re-simulations are left out of the risk story's campaign comparison. | `475b2b6`, `32ead44` | ADR-079 |
| TM-04 | Major | The learning-data retention did not cover per-person simulation results, teachable loops, daily risk snapshots, reported mail text or sandbox analyses. | Retention: see below. | `b96f6e7`, `304dd4c`, `a420aec` | ADR-077 |
| TS-01 | Major | The simulation-sender domain proof checked a TXT value derived from `APP_SECRET`, not the one the screen shows. A correct setup failed after a key change (the check failed closed). | `verifySimulationDomainAction` checks `domainProofRecords()`, the same records as the other domain-proof checks, the previous key included during a rotation. | `821ceda` | — |
| TS-02 | Major | A CSV import called with `commit=true` skipped the import rate limit but still answered which addresses exist. | A commit that reports problems is charged against the same limit as a check (20 per hour per administrator). Once the limit is used up, the answer is `rateLimited` with no problem list. A clean commit stays free. | `6dfb243` | — |
| SEC-07 | Minor | Learner-side pages showed draft Studio modules to authors who did not meet the administrators' two-step rule. | The module, lesson and mini-lab pages and the VM-lab action show drafts only when `privileged(v, "studio.write")` holds, which applies the two-step rule. | `821ceda` | — |
| SEC-05, F2 | Major | The mini-lab scenario cache kept an entry for every slug a request supplied, misses included, before any rate limit or catalog check. | Only shipped scenario files are looked up. The file list is read once at start, and an unknown slug never reaches the file system or the cache. | `a6cbc53` | — |
| SEC-06 | Minor | A change of the webhook or syslog destination was audited without the destination. | The change is audited with the destination, a webhook by its origin only (hook URLs often carry a token). | `821ceda` | — |
| TM-06 | Minor | Backups held every organisation in plain text with default file permissions, and the script comment said to copy them together with `APP_SECRET`. | Backups: see below. | `b96f6e7` | ADR-080 |
| TM-08 | Minor | SMTP failure messages with recipient addresses went to the production log. | Addresses in the logged message are replaced by `<address>`; the nodemailer codes stay. | `b96f6e7` | ADR-080 |

**Token revocation (SEC-01).** `invalidateUserSessions` (`src/server/auth/session.ts`) takes a reason and has no default. With a reason, it also revokes the creator's live tokens and writes one `api_token.revoked` entry per token, with no actor and `meta.reason`: `password_change`, `password_reset`, `2fa_reset`, `other_devices_signed_out`, `suspended` or `role_changed`. Turning on two-step verification signs the other sessions out but keeps the tokens (reason `null`). A restored role or a reactivation does not revive a revoked token. ADR-064 item 3 now applies only to a demotion that ends no sessions. Migration `0007_phase5` gave existing tokens an expiry one year after their creation (ADR-081).

**Deletion scope (TM-03).** `anonymise()` (`src/server/actions/people.ts`) runs in one transaction. Besides the users row, sessions, sign-in links, mail to the person and sign-off IPs, it now also:

- scrubs the stored campaign name from click-risk titles, renames the person's one-person campaigns to "—" and drops `meta.name` from their audit entries;
- deletes the manager and deletion notices that link to the person, and any queued manager-alert e-mails;
- sets to null the IP of every audit entry the person made as actor (one reading of Privacy §8).

Mail already sent stays until the 90-day outbox retention. Security notices about a takeover-level action (`notifyTakeover`, kind `security`) stay as a trace. Manager alerts check the person and write their notice in one transaction, with the person's row locked `FOR SHARE`, so a deletion either commits first or removes the notice afterwards. An administrator cannot decide their own deletion request (`decideDeletionAction`, `8f5a5c4`).

**Retention (TM-04).** The per-organisation learning-data period (`learningMonths`, `cleanup()` in `src/server/jobs.ts`) now also deletes closed teachable loops, the recipient rows of finished or cancelled campaigns (their loops cascade), daily per-person risk snapshots, and sandbox analyses. The evidence of an unresolved incident and the analysis with the highest SB number stay. A handled threat report loses only its forwarded text and link; the row and its TR number stay. Progress, XP, attestations, certificates, lab attempts and earned badges are never deleted. The first version also deleted lab attempts, which badges and path progress are earned from; `304dd4c` reverted that. Each new kind is counted in `retention.purged`. The setting's label and hint were updated in ten languages, and so was `docs/OPERATIONS.md`.

**Backups (TM-06).** `scripts/backup.sh` sets `umask 077` and `chmod 700` on the backup folder. With `BACKUP_AGE_RECIPIENT` set, it encrypts each dump with age on its way to disk, so no plain-text copy is written. A marker file makes up for `sh` having no `pipefail`, and pruning covers both file extensions. `scripts/restore.sh` needs `BACKUP_AGE_IDENTITY` for an encrypted dump and stops before emptying the database if decryption fails. The header comment now says to keep `APP_SECRET` apart from the dumps; the age identity is kept apart the same way. Without `BACKUP_AGE_RECIPIENT`, the dumps are plain text, as before.

The other 29 confirmed findings were code, React, TypeScript, database and test findings. Among them: bind-parameter limits at organisation scale (ADR-078), an atomic campaign launch and isolated failures in the campaign and teachable ticks (ADR-079), an atomic drill start, a branding save under a row lock (TS-07), and the step-up password field that took focus from the phone input (R1).

### Fixes, merges and recheck

- **Fix run.** Workflow `wf_b7730449-a42`: five packages, each in its own worktree reset to `3eccb2c`, all on Opus, 20 agents, 0 errors. P1 accounts and tokens, P2 people and privacy, P3 teachable loop and campaigns, P4 scale, retention and operations, P5 drill, lab and player. Two lenses reviewed each package. P1, P2 and P5 were approved by both. P3 (line endings of the admin message files) and P4 (retention deleted lab attempts) got a major each, fixed in their fix round (`32ead44`, `304dd4c`).
- **Merges.** In the order P1, P4, P2, P3, P5 (`99b496b`, `156d7c1`, `3bda8f2`, `d2e1d35`, `fba4bec`). Migration `0007_phase5.sql` (`61e53f1`) adds `api_tokens.expires_at` as nullable, fills it with `created_at` + 365 days, then sets it NOT NULL; this was checked on an in-memory database holding a token. The same file adds five indexes (ADR-081).
- **Recheck.** Workflow `wf_3ec78853-ecb`: six read-only rechecks on Opus. All 44 findings were found closed with tests, and every package was approved. The merges lens found that P1 and P2 treated role changes and tokens differently, plus minors. A new fixer and checker (`wf_f20ec4d4-3c6`) and a last pass (`wf_bdc2235b-fae`) closed them, and the orchestrator added the scrub of queued manager-alert e-mails. Result: a role change revokes the creator's tokens, and `invalidateUserSessions` has no default reason. Commit `a420aec`.

### Checks at `a420aec`

| Check | Result |
|---|---|
| Typecheck (`npm --prefix portal run typecheck`) | Clean |
| Lint (`npx eslint src tests scripts --max-warnings=0`) | Clean, 0 warnings |
| Unit tests (`npx vitest run`) | 151 files, 3708 tests pass |
| Lesson translations (`scripts/check-lesson-locales.ts --coverage`) | 954 of 954 |
| Production build | Passes, with the post-build check (at `61e53f1`) |
| Playwright smoke suite | 6 of 6 pass (at `85e475c`) |

### Limits of this review

- PGlite runs one connection, so no test runs the `FOR SHARE` lock against a real concurrent deletion. The reasoning holds for PostgreSQL READ COMMITTED.
- The bind-parameter test helper sees only queries outside a transaction.
- Webhook or syslog payloads already delivered with a person's name cannot be recalled.
- On Windows the backup-script shell tests skip when `sh` is not on PATH, and the permission checks run only on POSIX. The scripts have not been run on a live compose stack.
- The limits of the audit above still apply: no external penetration test, and no attack against a deployed instance.

### What remains for the owner

These are owner decisions. They are not closed:

- OPEN-QUESTIONS 70: the token revocation scope (a role change revokes, turning on two-step verification keeps) and the default lifetime of 90 days. Whose identity a token carries stays question 60.
- OPEN-QUESTIONS 71: after a deletion, the takeover security notices kept as a trace, and the nulled actor IPs (Privacy §8).
- OPEN-QUESTIONS 72: a Privacy §8 sentence for the extended learning-data retention, for the lawyer (with question 65).
- OPEN-QUESTIONS 73: encryption of backups at rest as a hosting decision, and where the age identity is kept (with questions 12 and 33).
- OPEN-QUESTIONS 74: re-simulations in the campaigns-page totals, and the missing refusal reason on a cancelled re-simulation's page.
- OPEN-QUESTIONS 24 (the Codex CLI crash) and 69 (a DOM test environment for component tests) stay open.
- Every commit is local and the branch has not been pushed; the push is the owner's step.
