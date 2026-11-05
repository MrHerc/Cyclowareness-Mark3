# Security review

| | |
|---|---|
| Date | 2026-11-05 |
| Scope | The whole repository: `portal/` (Next.js 16, React 19, Drizzle, PostgreSQL/PGlite), Docker and compose files, scripts, docs, and the full git history (9 commits, all branches) |
| Standard | OWASP Top 10 (2021) and OWASP ASVS 4.0.3 Level 1 |
| Method | Manual code review of every server action, route handler, auth module and outbound integration; pattern and entropy scans of every blob in the git history; `npm audit` of the lockfile; configuration review of `next.config.ts`, `src/proxy.ts`, `Dockerfile`, `docker-compose.yml` and `.env.example` |
| Not covered | Dynamic testing against a running deployment, the hosting infrastructure, the TLS proxy, and the owner's local demo machines |

## Summary

The portal's security engineering is strong. Authentication, sessions, tenant isolation, output encoding, SSRF protection and production configuration checks are all deliberate and mostly tested. No cross-tenant data access, injection, XSS or authentication bypass was found.

The one serious problem is operational. **The repository is public, and it publishes the password of every demo account**, including a platform operator with full control of the installation. Any seeded instance that someone else can reach must have its passwords rotated.

| Severity | Found | Fixed in code | Mitigated | Open |
|---|---|---|---|---|
| High | 1 | | 1 | |
| Medium | 1 | 1 | | |
| Low | 9 | 3 | 1 | 5 |
| Info | 7 | 1 | | 6 |

## Exposed secrets that must be rotated

**No live credential was ever committed.** The current tree and every blob in the history were scanned for API keys (Anthropic, OpenAI, AWS, Google, GitHub, Slack, SendGrid), private keys, JWTs, credentials in connection strings, `.env` files and high-entropy strings. The only matches are the test placeholders in `portal/tests/` and the documented development fallback secret. No `.env`, `.pem` or key file was ever committed.

Two published values still need action:

1. **Demo password (rotate now).** `SEED_PASSWORD` in `portal/.env.example` is public, and the seed gives it to about 37 accounts. Those include the platform operator `operator@cyclowareness.com` (`super_admin`) and the demo tenant administrator. Rotate it on every seeded instance that anyone else can reach: the owner's presentation copy, any preview or throwaway Docker stack, and any demo shown to customers.
   - Re-seed with your own `SEED_PASSWORD` of 12 or more characters, or reset each account's password.
   - Check the audit log of those instances for `auth.sign_in` entries from unknown addresses.
   - The code fix (H-1) stops new non-local stacks from using the published value.
2. **Development fallback `APP_SECRET` (rotate if it was ever used with real data).** Without `APP_SECRET`, development mode encrypts stored secrets with a key that is printed in `portal/src/server/crypto.ts`. Production refuses to start without its own key. If a local or demo database holds real SMTP passwords, SSO client secrets, webhook secrets or real people's authenticator keys, treat them as exposed.
   - Set a random `APP_SECRET` for that instance.
   - Re-enter the SMTP, SSO and webhook secrets in Settings, and have affected people set up two-step verification again.

## Findings

| ID | Severity | Finding | OWASP / ASVS | Status |
|---|---|---|---|---|
| H-1 | High | Published demo password opens every seeded account, including the platform operator | A07, ASVS 2.1, 14.1 | Mitigated in code; rotation required |
| M-1 | Medium | No automated dependency or secret scanning | A06, ASVS 14.2.1 | Fixed |
| L-1 | Low | Vulnerable `minimatch` in the ESLint toolchain (8 npm audit entries) | A06 | Fixed |
| L-2 | Low | People CSV import stores unbounded field lengths | A04, ASVS 5.1.4 | Fixed |
| L-3 | Low | Studio training draft accepted any amount of extra JSON | A04, ASVS 5.1.4 | Fixed |
| L-4 | Low | SMS gateway over plain HTTP accepted silently | A02, ASVS 9.2.1 | Mitigated |
| L-5 | Low | Tenant admins can tell whether an email or phone has an account in any tenant | A01, ASVS 2.2 | Open |
| L-6 | Low | Developer machine paths, user name and agent session IDs published | A05 | Open |
| L-7 | Low | A tenant admin can take over a peer tenant admin's account | A01, A07 | Open (design) |
| L-8 | Low | Signed-in people cannot change their password | ASVS 2.1.5, 2.1.6 | Open |
| L-9 | Low | No rate limit on domain verification and test email | A04, ASVS 11.1.4 | Open |
| I-1 | Info | Notification placeholders could print inherited object members | A03 | Fixed |
| I-2 | Info | A TOTP code can be reused within its 90-second window | ASVS 2.8.4 (L2) | Open |
| I-3 | Info | CSP allows inline styles | A05 | Accepted |
| I-4 | Info | Docker base image pinned by tag, not digest | A08 | Open |
| I-5 | Info | Development mode uses a public fallback secret and relaxes outbound checks | A05 | Accepted |
| I-6 | Info | LDAP settings are stored without destination checks | A10 | Open |
| I-7 | Info | Framework patch releases are available | A06 | Open |

### H-1 Published demo password opens every seeded account (High)

**Evidence.** `portal/.env.example:89` sets `SEED_PASSWORD`, and `portal/scripts/seed.ts` used the same value as its fallback. The seed hashes it into every demo account, including a `super_admin` platform operator (`seed.ts`, "platform operator" block). The repository is public on GitHub.

**Impact.** Anyone who has read the repository can sign in to any seeded instance they can reach. The operator account has no second factor yet: the portal forces two-step setup after sign-in, so an attacker would simply enrol their own authenticator. From the operator console they control every tenant on that instance. The data is fictional, but a demo instance is often shown to prospects and may later receive real users or real SMTP credentials.

**Remediation.**
- Done: the published password is gone from the repository. The seed uses `SEED_PASSWORD` (12 or more characters, environment or `.env.local`) or generates a random one and prints it once; it never runs with `NODE_ENV=production`, needs `ALLOW_SEED=1` for a `DATABASE_URL` and refuses a database holding organisations other than the demo's unless `SEED_FORCE=1` (`seedRefusal` and `foreignTenants` in `portal/scripts/seed-data.ts`, test `portal/tests/seed-guard.test.ts`).
- To do: rotate passwords on reachable instances (see the rotation section). Never expose a seeded instance to the internet with the default password, including through a tunnel for a presentation.

### M-1 No automated dependency or secret scanning (Medium)

**Evidence.** The repository had no `.github/` directory, no CI and no Dependabot configuration.

**Impact.** New advisories against the 38 direct dependencies, and any secret committed by mistake, would go unnoticed until someone ran a manual check.

**Remediation (done).**
- `.github/workflows/security.yml` runs on pushes to `main`, every pull request, weekly and on demand, with read-only permissions. It runs `npm audit` (production dependencies fail at moderate, all dependencies at high), `npm audit signatures`, GitHub's dependency review on pull requests, and gitleaks over the whole history with redacted output.
- Every action in both workflows (`security.yml` and `ci.yml`) is pinned to a commit SHA, and the gitleaks binary is verified against its release checksums before it runs. The pinned SHAs were checked against the release tags with `git ls-remote` on 2026-11-05 (checkout v7.0.1, setup-node v7.1.0, dependency-review-action v4.9.0, upload-artifact v4.6.2, cache v6.1.0).
- `.gitleaks.toml` keeps the default rules and allows only the public placeholders listed in it.
- `.github/dependabot.yml` proposes weekly grouped updates for npm, GitHub Actions, the Dockerfile base image and the compose images. Node and PostgreSQL majors are excluded because they need a planned upgrade.
- Also turn on, in the repository settings: Dependabot alerts and security updates, secret scanning with push protection (free for public repositories), and a branch protection rule that requires the Security and CI workflows.

### L-1 Vulnerable `minimatch` in the ESLint toolchain (Low)

**Evidence.** `npm audit` reported 8 moderate entries with one root cause: `@typescript-eslint/typescript-estree` resolved `minimatch` 10.2.6, affected by [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) (denial of service through glob amplification). npm's suggested fix downgrades `eslint-config-next` to 15.x, which does not match Next 16.

**Impact.** Development tooling only. It does not ship in the server image.

**Remediation (done).** An `overrides` entry in `portal/package.json` lifts only that nested copy to `minimatch` 11.0.4. `npm audit` now reports no vulnerabilities, and lint passes. Remove the override once `eslint-config-next` depends on a fixed version.

### L-2 People CSV import stores unbounded field lengths (Low)

**Evidence.** `importPeopleAction` in `portal/src/server/actions/people.ts` capped only the whole file (5 MB, 5000 rows). Name, job title and department name were stored as typed, and email had no 254-character limit. The add and edit dialogs allow 120 characters.

**Impact.** A `people.write` administrator could store a multi-megabyte value that then appears in every people list, certificate, notification, email and export of the tenant.

**Remediation (done).** The import cuts these fields at 120 characters and reports an email over 254 characters as the existing "email is not valid" problem. Tests: `portal/tests/people-import.test.ts`.

### L-3 Studio training draft accepted any amount of extra JSON (Low)

**Evidence.** `saveTrainingDraftAction` in `portal/src/server/actions/ai-training.ts` validated the draft as `z.unknown()`, then with the lesson schema, which passes unknown keys through. The only bound was the 11 MB server action body limit.

**Impact.** A `studio.write` user could store megabytes of extra data in a lesson, which is sent to every learner who opens it.

**Remediation (done).** A draft must serialise to at most 512 KB (`draftWithinLimit` in `portal/src/server/ai-verify.ts`). The largest shipped lesson is about 32 KB. Test: `portal/tests/ai-training.test.ts`.

### L-4 SMS gateway over plain HTTP accepted silently (Low)

**Evidence.** `SMS_WEBHOOK_URL` in `portal/src/server/env.ts` accepts any URL. `portal/src/server/sms.ts` sends each sign-in code and `SMS_WEBHOOK_TOKEN` as a bearer header to it.

**Impact.** With an `http://` gateway, sign-in codes and the token cross the network unencrypted.

**Remediation.**
- Done: production now logs a start-up warning for an `http://` gateway, and `.env.example` says to use `https://`. Test: `portal/tests/env.test.ts`.
- To do: once no installation depends on a plain-HTTP gateway, refuse `http://` in production unless an explicit opt-out is set, as `ALLOW_HTTP_APP_URL` does for `APP_URL`.

### L-5 Tenant admins can tell whether an email or phone has an account in any tenant (Low)

**Evidence.** Email and phone are unique across the platform (`users_email_idx` and `users_phone_active_idx` in `portal/src/server/db/schema.ts`). `addPersonAction` answers `emailTaken` and the import preview reports `exists` or `phoneTaken` for an address or number used in any tenant (`people.ts:122` and `people.ts:533`). The preview writes nothing and takes up to 5000 rows per call.

**Impact.** A tenant administrator can learn which addresses or numbers from a list have an account somewhere on the platform. No tenant name or profile data is revealed.

**Remediation.**
- Rate-limit the import preview and the add dialog per administrator.
- Consider a neutral message such as "this address cannot be added" that does not say why.
- In the long run, decide whether email must stay unique across tenants. That is a product decision, because sign-in by email depends on it.

### L-6 Developer machine paths, user name and agent session IDs published (Low)

**Evidence.** Absolute Windows paths with the developer's user name and local agent session folders appear in `.claude/launch.json`, `docs/build/RESUME.md`, eleven scripts under `docs/build/workflows/`, and five glossaries under `.claude/skills/cyclowareness-experience/references/glossaries/`. The scripts also describe how the owner's demo server is started and which seed accounts it uses.

**Impact.** Information disclosure that helps targeted phishing or reconnaissance of the developer's machine. No credential is included.

**Remediation (not done, to avoid breaking the owner's local tooling).**
- Replace the absolute paths in `.claude/launch.json` with paths relative to the repository, or keep machine-specific launch entries in an untracked file.
- Replace the absolute paths in the scripts and notes with a placeholder or a path relative to the repository.
- Git history keeps the old values. That is acceptable for this low-sensitivity data, so rewriting history is not recommended.

### L-7 A tenant admin can take over a peer tenant admin's account (Low, design)

**Evidence.** `createLinkAction` (`people.ts:183`) lets a `people.write` administrator create a 60-minute password reset link for any person of their tenant, including another `tenant_admin`. `resetTwoFactorAction` (`people.ts:239`) removes that person's authenticator. Both are audited. A two-step reset leaves the affected person an in-app notice, which they see only after signing in. A reset link leaves them no notice at all.

**Impact.** One rogue or compromised administrator can sign in as any other administrator of the same tenant. Platform operators are protected: `super_admin` accounts are out of reach. This is normal for many admin consoles, but customers in banking and government may expect separation of duties.

**Remediation.**
- Email the affected person immediately when an administrator resets their two-step verification or creates a reset link for them.
- Optionally require a second administrator's approval, or require the target to be a lower role, for these actions on privileged accounts.

### L-8 Signed-in people cannot change their password (Low)

**Evidence.** No server action changes the password of a signed-in user. Passwords are set only through invitation and reset links (`setPasswordAction` in `portal/src/server/actions/auth.ts`).

**Impact.** ASVS Level 1 gap (2.1.5 and 2.1.6). Someone who suspects their password is known must use "forgot password", which depends on email delivery.

**Remediation.** Add a password change form in Profile → Security. It should ask for the current and the new password, apply `passwordProblem`, and sign out the other sessions. The texts must be added in all ten interface languages.

### L-9 No rate limit on domain verification and test email (Low)

**Evidence.** `verifyDomainAction` (`portal/src/server/actions/settings.ts:118`) makes two DNS TXT lookups per call. `testEmailAction` (`settings.ts:328`) sends a message to any address through the tenant's mail server. Both are limited to `settings.write` administrators.

**Impact.** An administrator could drive DNS queries or mail through the platform in a loop. The mail goes through the tenant's own server, which limits abuse to their own reputation.

**Remediation.** Add per-tenant limits with the existing `rateLimit` helper, for example 20 per hour each, with a translated "try again later" message.

### I-1 Notification placeholders could print inherited object members (Info)

**Evidence.** `fill()` in `portal/src/server/services/notify.ts` looked up `{{name}}` placeholders on a plain object, so `{{constructor}}` printed the source text of `Object`.

**Remediation (done).** Only keys that were actually supplied are filled. Test: `portal/tests/email-escapes.test.ts`.

### I-2 A TOTP code can be reused within its window (Info)

**Evidence.** `verifyTotp` in `portal/src/server/auth/totp.ts` accepts the current code and one step either side, and does not remember used codes.

**Impact.** A code seen over someone's shoulder works for up to about 90 seconds, but the attacker also needs the password. ASVS lists this at Level 2 (2.8.4).

**Remediation.** Store the time step of the last accepted code per user and refuse codes from that step or earlier.

### I-3 CSP allows inline styles (Info, accepted)

`style-src 'self' 'unsafe-inline'` in `portal/src/proxy.ts:48` is needed for dynamic widths and tenant brand colours. Scripts are locked down with a per-request nonce and `strict-dynamic`, so the remaining risk is limited to CSS-based data exfiltration, which also requires an HTML injection that was not found.

### I-4 Docker base image pinned by tag (Info)

`portal/Dockerfile:4` uses `node:24-trixie-slim`. A tag can be re-pointed. Pin it by digest (`node:24-trixie-slim@sha256:…`) and let Dependabot, now configured for the Dockerfile, propose digest updates.

### I-5 Development mode is not hardened (Info, accepted)

Outside `NODE_ENV=production`, the portal uses the public fallback `APP_SECRET`, shows one-time codes on screen when `DEV_SHOW_OTP=1`, and lets the SSO client reach any host, loopback included. Production refuses to start without its own secret and enforces every check. Never expose `npm run dev` or a non-production server to other people.

### I-6 LDAP settings are stored without destination checks (Info)

The LDAP URL, bind DN and filter in Settings (`settings.ts:192`) are saved without host vetting. No LDAP client exists yet, so nothing connects to them. When directory sync is built, route it through `vetDestination` and `pinnedLookup` in `portal/src/server/net-guard.ts`, and escape the login in the search filter.

### I-7 Framework patch releases are available (Info)

`next` 16.4.5 and `nodemailer` 10.3.1 are available. No advisory affects the installed 16.4.3 and 10.2.1. Dependabot now groups `next` with `eslint-config-next` so they move together.

## What was checked and found sound

| Area | Result |
|---|---|
| Passwords | Argon2id with OWASP parameters, zxcvbn score 3 and a 10-character minimum, a dummy hash for unknown accounts, sessions revoked on reset |
| Sign-in throttling | Failures claimed before checking, per account and address and per address; per-recipient limits on SMS codes and reset mails; answers do not reveal whether an account exists |
| Sessions | 192-bit random tokens, only SHA-256 stored, `__Host-` cookies with HttpOnly, Secure and SameSite=Lax, 30-day sliding expiry within 90 days, device limit, sign-out of other devices |
| Two-step verification | Mandatory for the operator and, by default, every console role; encrypted keys; single-use HMAC-hashed backup codes; atomic code spending |
| Single sign-on | Authorization code flow with PKCE, state and nonce, signed short-lived state cookie, ID token signature, issuer, audience, expiry and nonce checks, verified email claim, privileged roles excluded |
| Access control | Every server action, route handler and admin page checks the session, the permission and the plan feature first; every query on tenant data is bound to the viewer's tenant; department heads are scoped; nobody can grant `super_admin` or change their own role |
| Injection | All SQL goes through Drizzle parameters; the single `sql.raw` uses a constant; every client input is validated with zod or explicit checks |
| XSS and output | React escaping everywhere; the two `dangerouslySetInnerHTML` uses are a constant script and QR code markup; emails escape every value; uploaded SVG logos are scanned and served with a sandboxing CSP; CSV exports neutralise formula cells; XLSX cells are never formulas |
| SSRF | Tenant-configured SMTP, webhook, syslog and OIDC hosts must be public and on allowed ports, are re-checked before each connection, and are pinned to the vetted addresses against DNS rebinding; redirects are not followed and responses are size-capped |
| CSRF | Server actions use Next.js's origin check; POST route handlers check `Origin`; state-changing work is never done on GET |
| Headers | Nonce-based CSP with `strict-dynamic`, `frame-ancestors 'none'`, X-Frame-Options, nosniff, Referrer-Policy, COOP, Permissions-Policy, and HSTS for HTTPS installations |
| Configuration | Production refuses to start without `APP_SECRET`, with a loopback or plain-HTTP `APP_URL`, or with the embedded database; proxy headers are trusted only for a configured number of hops |
| Container | Multi-stage build, non-root user, all Linux capabilities dropped, `no-new-privileges`, port published on loopback only, no secrets in the image, the development database kept out of the build |
| Privacy | Invitation and reset links are redacted from the stored mail log after delivery; tracking tokens are left out of personal data exports; the AI tutor receives lesson text only |

## OWASP Top 10 (2021) overview

| Category | Result |
|---|---|
| A01 Broken Access Control | No cross-tenant access or escalation found; L-5 and L-7 are design notes |
| A02 Cryptographic Failures | AES-256-GCM for stored secrets, Argon2id, HSTS; L-4 for the SMS gateway |
| A03 Injection | None found; I-1 fixed |
| A04 Insecure Design | L-2 and L-3 fixed; L-9 open |
| A05 Security Misconfiguration | Strong production defaults; L-6 open; I-5 accepted |
| A06 Vulnerable and Outdated Components | L-1 fixed; scanning and updates added (M-1) |
| A07 Identification and Authentication Failures | H-1 mitigated, rotation required; L-8 open |
| A08 Software and Data Integrity Failures | Actions pinned by SHA, lockfile signatures checked in CI; I-4 open |
| A09 Security Logging and Monitoring Failures | Sign-ins, refusals, exports, role and 2FA changes are audited with the client address |
| A10 Server-Side Request Forgery | Guarded and pinned; I-6 for the future LDAP client |

## Assumptions and limits of this review

- The demo instances run the code in this repository. The owner's local demo launcher is outside the repository and was not reviewed.
- gitleaks could not be run in the review environment, which blocks downloading external binaries. The history was scanned with equivalent patterns instead, and the first CI run is the first gitleaks run. If it reports a false positive, add the value to `.gitleaks.toml` only after confirming it is not a secret.
- `npm audit signatures` could not reach the Sigstore trust root from the review environment. It runs in CI.
- Neither workflow has run on GitHub yet, and GitHub validates the `cooldown` and `docker-compose` keys of `.github/dependabot.yml` only on the default branch. After the first merge to `main`: run Security once with workflow_dispatch and read the three job logs; check Insights → Dependency graph → Dependabot for a configuration error (if a key is refused, remove the `cooldown` blocks or the `docker-compose` entry); then mark the jobs of both workflows as required checks.
- Severity reflects a multi-tenant SaaS deployment with untrusted tenant administrators.

## Next steps, in order

1. Rotate the demo passwords on every reachable seeded instance (H-1).
2. Turn on secret scanning with push protection, Dependabot alerts and security updates, and require the Security and CI workflows on `main` (M-1).
3. Email people when an administrator resets their two-step verification or creates a reset link for them (L-7).
4. Add password change in Profile → Security (L-8).
5. Add rate limits to the import preview, the add dialog, domain verification and test email (L-5, L-9).
6. Remove machine-specific paths from tracked files (L-6), and pin the base image by digest (I-4).
