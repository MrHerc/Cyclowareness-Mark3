# Cyclowareness security whitepaper

For the security, risk and procurement teams of organisations evaluating Cyclowareness, the security-awareness platform by Safarov Industries.

This paper describes the controls that exist in the platform's code today. It is drawn from the engineering documentation ([ARCHITECTURE.md](ARCHITECTURE.md)) and the internal security review of 2026-11-05 ([SECURITY_REVIEW.md](SECURITY_REVIEW.md)), and every statement was checked against the source. It is not a certification and not a contract: where a commitment is needed (hosting region, service levels, data processing terms), it belongs in the agreement with your organisation. The [last section](#what-the-platform-does-not-provide-yet) lists what is not in place yet.

## Contents

- [The platform in brief](#the-platform-in-brief)
- [Separation between organisations](#separation-between-organisations)
- [Roles and permissions](#roles-and-permissions)
- [Sign-in and sessions](#sign-in-and-sessions)
- [Application protections](#application-protections)
- [Connections to your systems](#connections-to-your-systems)
- [Data protection and privacy](#data-protection-and-privacy)
- [Training evidence](#training-evidence)
- [Audit trail and monitoring](#audit-trail-and-monitoring)
- [Deployment and operations](#deployment-and-operations)
- [How the platform is checked](#how-the-platform-is-checked)
- [What the platform does not provide yet](#what-the-platform-does-not-provide-yet)

## The platform in brief

- One web application (Next.js on Node.js) and one PostgreSQL database, shipped as a Docker image. It runs in a cloud environment or on the customer's own servers with the supplied Docker Compose file.
- Multi-tenant: each customer is an organisation inside the platform. A separate installation per customer is possible with the same image.
- Interfaces: the learner app, the admin console, and an operator console for the platform operator.

## Separation between organisations

- Every organisation's data carries the organisation's identifier, on the row itself or on its parent row, with a cascading foreign key.
- Every page, server action and API route identifies the signed-in person first; every query on organisation data is bound to that person's organisation on the server. The security review found no cross-organisation data access.
- Shared content (the lesson library) has no owner organisation and is read-only to customers; lessons and paths an organisation creates belong to that organisation only.
- The separation is enforced in the application layer. The database itself does not apply row-level security (see the last section).

## Roles and permissions

- Eight roles: learner, department head, executive, security analyst, campaign manager, content creator, organisation administrator, and the platform operator.
- 27 permissions map to these roles, and many also require a feature of the organisation's plan. Both are checked on the server for every page, action and API route; a page a person may not use answers "not found".
- Department heads see only their own departments and the departments below them.
- Nobody can change their own role or grant the platform-operator role, and an organisation administrator cannot act on the platform operator.

## Sign-in and sessions

| Control | How it works |
|---|---|
| Passwords | Argon2id (19 MiB memory, 2 iterations), at least 10 characters and a zxcvbn strength score of 3, checked against the person's name and email. Signed-in people can change their password; other devices are then signed out. |
| Brute-force protection | Failed attempts are counted per account and client address within 15 minutes; codes sent by SMS and password-reset mails are limited per recipient. Sign-in, phone sign-in, SSO domain lookup and password reset answer the same way whether or not an account exists. |
| Two-step verification | TOTP authenticator apps with single-use backup codes (stored as keyed hashes). A code that was accepted cannot be used again. Mandatory for the platform operator; mandatory for every console role while the organisation's rule is on, which is the default for new organisations. |
| Privileged roles | Organisation administrators, security analysts, campaign managers and the platform operator always sign in with a password and their second step, never with single sign-on or a text-message code. No console role can sign in with a text-message code. |
| Single sign-on | OpenID Connect authorization code flow with PKCE, state and nonce, over HTTPS. The ID token's signature, issuer, audience, expiry and nonce are checked, and the email claim counts only when the provider marks it verified. SSO works only for a domain the organisation has proven with a DNS TXT record (re-checked daily). On first sign-in the account is bound to the provider's issuer and subject identifier, and a different subject is refused later. |
| Sessions | A random 192-bit token in a `__Host-` cookie (HttpOnly, Secure, SameSite=Lax). The database stores only its SHA-256 hash. The session slides to 30 days on use and ends at most 90 days after sign-in. An organisation can limit the number of devices signed in at once; people can sign out their other devices. |
| Account links | Invitation and password-reset tokens are stored as hashes, work once, and invitations expire after 14 days. |

## Application protections

| Control | How it works |
|---|---|
| Content Security Policy | A fresh nonce on every request with `strict-dynamic`, and `frame-ancestors 'none'` |
| Security headers | `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Cross-Origin-Opener-Policy: same-origin`, a restrictive `Permissions-Policy`, and HSTS for two years on HTTPS |
| Cross-site request forgery | Server actions use the framework's origin check, POST API routes check `Origin`, cookies are SameSite=Lax, and no GET request changes state |
| Input validation | Schemas on every action and request body, strict identifier checks on route parameters, a 1 MB body limit for server actions, and a separate upload route for sandbox files with its own size cap |
| Rate limits | Fixed windows kept in the database and shared by every application instance, on sign-in, account actions, imports, domain checks, test emails, downloads and AI features |
| Output encoding | The interface escapes all values; emails escape every value; CSV exports neutralise spreadsheet formulas and XLSX cells are never formulas |
| Uploaded logos | SVG logos with scripts, event attributes or external references are refused, and uploaded assets are served under a sandboxing CSP |
| Denial of service | Text parsing in the sandbox, policy rendering and logo checks uses linear-time patterns, with regression tests |

## Connections to your systems

Organisation administrators can point the platform at their own mail server (SMTP), webhook receiver, syslog server and OpenID Connect provider. These connections are guarded so they cannot be used to probe the platform's own network:

- The destination is resolved and checked when it is saved and again before every connection. Loopback, private, link-local, carrier-grade NAT, multicast and reserved addresses (IPv4 and IPv6, including embedded IPv4 forms) and internal names such as `.local` and `.internal` are refused.
- The connection is pinned to the address that was checked, which defeats DNS rebinding.
- Only the expected ports are allowed: SMTP 25, 465, 587, 2525; HTTPS 443, 8443; syslog 514, 601, 6514.
- Redirects are not followed, responses are size-capped, and errors are reported in broad categories.
- Webhooks are signed with HMAC-SHA256 (with and without a timestamp) and carry a delivery id for de-duplication. The signing secret is shown once. Syslog uses RFC 5424 with CEF or JSON, over TLS, TCP or UDP. The contracts are in [API.md](API.md).

## Data protection and privacy

- **Secrets at rest.** Mail-server passwords, SSO client secrets, webhook secrets and authenticator keys are encrypted with AES-256-GCM under a key derived from the installation's application secret. They are never sent back to the browser.
- **Mail log.** Every message passes through an outbox that is also the delivery log. Invitation and password-reset links are redacted from it after delivery.
- **Simulations.** When someone types a password into a simulated phishing page, only the fact is recorded, never the password. The password exercise inside lessons never leaves the learner's browser.
- **Sandbox.** Files are analysed in memory and not stored: only the SHA-256 hash and the findings are kept. Links are checked, not opened.
- **Personal data rights.** A learner can download their profile and learning history. A deletion request goes to the organisation's administrator; on approval, name, email, photo and sign-in data are removed and learning results stay without the name.
- **Retention clean-up.** A daily job deletes stored AI tutor answers after 365 days and demo requests after 730 days.
- **AI features.** The AI tutor, AI subtitles and Studio drafts use the Anthropic API. The tutor receives the lesson context and the learner's question; no account identifier is sent. Questions are not filtered, so learners are told not to write personal data. Narration audio is generated in advance from lesson text only (ElevenLabs), never from personal data. Subprocessors are listed in [legal/SUBPROCESSORS.md](legal/SUBPROCESSORS.md).
- **Content protection.** Optional per organisation: lesson text cannot be copied, printing gives a blank page, the screen blurs when the window loses focus, and an invisible per-session watermark lets an administrator trace a leaked screenshot to the session it came from.

## Training evidence

Certificates and the compliance pack are used as evidence for regulators and auditors, so lesson completion is verified on the server:

- An attempt starts on the server, the player reports the scenes reached, and the server re-scores every graded answer from the stored lesson content.
- An attempt is refused when it was not started, is shorter than the minimum duration, did not reach the last scene, or left a graded scene unanswered. Refusals are written to the audit log.
- Each confirmation and certificate is labelled `server_verified` or, for records made before this check existed, `self_reported`. The label appears on the public certificate page, in the compliance pack and in exports.
- Every certificate has a serial number and a public verification link.

## Audit trail and monitoring

- Sign-ins, refused actions, exports and downloads, role and two-step changes and every administrative change are written to the organisation's audit log with the actor and client address, and shown in the admin console.
- Events can be forwarded to your SIEM by signed webhook or syslog.
- The server writes structured JSON log lines; error records carry the error's name, code and stack but never its message or request parameters.
- `/api/health` reports the database state, whether the background job runner is current, and the delivery backlog.

## Deployment and operations

- **Image.** Multi-stage build on `node:24-trixie-slim`, running as the non-root `node` user, with a health check. The Compose file drops all Linux capabilities, sets `no-new-privileges` and publishes the application port on the loopback interface only, for a TLS proxy in front.
- **Safe defaults.** In production the application refuses to start without its application secret, with a plain-HTTP or loopback public address (unless explicitly allowed for an intranet), or with the embedded development database. Client addresses are taken from proxy headers only behind a configured number of trusted proxies.
- **Demo data.** The demo seed never runs in production and refuses a database that holds other organisations; no demo password is published.
- **Backups.** Scripts for a nightly `pg_dump` kept for 14 days and for a verified restore are included, with a runbook ([OPERATIONS.md](OPERATIONS.md)). The target recovery point is 24 hours; the recovery time is measured at the first restore drill.

## How the platform is checked

- An automated test suite with regression tests for every security fix (authentication, permissions and plan features, outbound guards, SSO, rate limits, regex denial of service, outbox redaction, data export, lesson evidence).
- An internal code review on 2026-11-05 against the OWASP Top 10 (2021) and OWASP ASVS 4.0.3 Level 1, covering every server action, route handler, authentication module and outbound integration and the full code history. It found no cross-tenant access, injection, cross-site scripting or authentication bypass. Its findings and their status are tracked in the repository.
- Dependency audit, dependency review and secret scanning are configured as continuous-integration workflows.

## What the platform does not provide yet

These are not in place at the time of writing. Do not rely on them until the platform's documentation says otherwise.

- **Database row-level security.** Separation between organisations is enforced by the application only.
- **Key rotation.** One application secret protects stored secrets; there is no key versioning or rotation procedure.
- **Step-up re-authentication.** Sensitive administrator actions (resetting someone's two-step verification, creating a password-reset link) do not ask for the administrator's password or code again, and the affected person is not emailed.
- **SAML and directory sync.** Single sign-on is OpenID Connect only; there is no SAML and no LDAP or Active Directory synchronisation.
- **Configurable retention and residency.** Retention periods are fixed in the code, and the hosting region is agreed per contract, not selected in the product.
- **Independent assurance.** No third-party penetration test, dynamic test of a running installation, or certification (such as ISO 27001 or SOC 2) has been completed.
- **Error tracking and metrics.** There is no hosted error tracker, metrics or tracing yet.
- **Live integrations.** Mail, SMS, Anthropic and identity-provider integrations have not yet been tested against live customer accounts.
- **Service terms.** Service levels, support hours and channels, the status page and the vulnerability-reporting address are to be provided by Safarov Industries.
