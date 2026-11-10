# Interfaces and API

This document lists every interface Cyclowareness exposes to other systems, based on the code in `portal/`. It covers HTTP endpoints under `/api`, the public token pages, and the outbound integrations: signed webhooks, syslog, the SMS gateway and OpenID Connect sign-in.

## Contents

1. [Scope](#1-scope)
2. [Conventions](#2-conventions)
3. [Endpoint index](#3-endpoint-index)
4. [Endpoints](#4-endpoints)
5. [Public pages with tokens](#5-public-pages-with-tokens)
6. [Outbound webhooks](#6-outbound-webhooks)
7. [Syslog and SIEM](#7-syslog-and-siem)
8. [SMS gateway contract](#8-sms-gateway-contract)
9. [Single sign-on contract](#9-single-sign-on-contract)
10. [Inbound report address](#10-inbound-report-address)
11. [Reporting API](#11-reporting-api)
12. [Rate limits](#rate-limits)

## 1. Scope

**The only API for machine clients is the read-only Reporting API** (section 11): the report and people-list downloads, called with a scoped bearer token that an administrator mints under Settings, Integrations. The inbound report address (section 10) takes a per-organisation secret from the mail provider. Every other authenticated endpoint uses the browser session cookie that sign-in sets; there are no OAuth client credentials or service accounts, and no endpoint writes data for a token.

| Interface | Who uses it | Stable for integration |
|---|---|---|
| Route handlers under `/api` | The web app, and administrators' browsers for downloads | Yes, as documented here |
| Reporting API (bearer tokens) | The organisation's HR, BI or GRC system, pulling reports and the people list | Yes |
| Server Actions | The web app's forms and buttons; every write in the product | No. They are internal and change with the interface |
| Token pages `/t`, `/q`, `/c` | Simulation recipients and certificate verifiers | Yes |
| Outbound webhooks and syslog | The organisation's SIEM, SOAR or ticketing system | Yes |
| SMS webhook | The platform's SMS gateway | Yes |
| OpenID Connect | The organisation's identity provider | Yes |
| Inbound report address | The organisation's mail provider | Yes |

Server Actions are POST requests that Next.js routes by an internal action id. Do not call them from other systems.

## 2. Conventions

**Base URL.** All paths are relative to the installation's public address, the `APP_URL` setting. Links in emails, QR codes and webhooks use that address.

**Authentication.** Endpoints marked "session" read the cookie `__Host-cy_session` in production and `cy_session` in development. The server resolves it to a person, their organisation, role and plan features (`src/server/auth/viewer.ts`). Endpoints marked "session or token" also accept `Authorization: Bearer <token>` with a Reporting API token (section 11); the header, when present, is used instead of the cookie.

**Authorisation.** An endpoint that names a permission requires two things:

- the person's role holds that permission, as listed in `src/server/auth/permissions.ts`;
- the organisation's plan includes the feature the permission depends on.

Every query is limited to the person's organisation. A department head is further limited to their departments.

**Refusals.** Endpoints built on `apiViewer` (`src/server/auth/api.ts`) answer in two ways, depending on how the request was made.

| Situation | Request from the app (`fetch`) | Link opened in the browser |
|---|---|---|
| Not signed in | `401 Unauthorized` | `303` to `/sign-in?next=<this URL>`, back here after sign-in |
| Must set up two-step verification first | `403 Forbidden` | `303` to the security section of the profile |
| Role or plan does not allow it | `403 Forbidden` | `403` with a message in the person's language |

A browser navigation is recognised by `Sec-Fetch-Mode: navigate`, or by `Accept: text/html` when that header is missing. The other endpoints, such as the tutor and subtitles, always return the bare status.

**RSC probes.** A request with the header `rsc: 1` to a download endpoint gets `204 No Content` and nothing else. This keeps a framework prefetch from triggering a download, an audit entry or a rate-limit count.

**Cross-site protection.** POST endpoints accept a request only when one of these holds (`sameOrigin` in `src/server/request.ts`):

- the `Origin` header is missing, as from non-browser clients, which still need the session cookie;
- the `Origin` host matches `APP_URL`, the `Host` header, or `X-Forwarded-Host` when `TRUST_PROXY` is set.

A malformed or `null` Origin is refused with `403`.

**Validation.**

- Ids in paths must be UUIDs, and tokens must match `^[a-z2-7]{10,40}$`. Anything else returns `404`, except the open-tracking pixel, which always answers with its image.
- JSON bodies are read with a byte cap before parsing. An oversized body returns `413`.

**Caching.** Exports, reports and personal answers carry `Cache-Control: no-store`.

**Errors.** Most endpoints return a short plain-text body with the status. `/api/subtitles` returns JSON, `{"error": "<code>"}`.

## 3. Endpoint index

| Method | Path | Access | Returns |
|---|---|---|---|
| GET | `/api/health` | Public (client address: platform operator) | JSON: database, job runner, delivery backlog |
| GET | `/api/assets/{id}` | Public | Organisation logo image |
| GET | `/api/qr/{token}` | Public, token | QR code PNG for a simulation |
| GET | `/api/t/{token}/open` | Public, token | 1×1 GIF, records an open |
| GET | `/api/sso/start` | Public | Redirect to the identity provider |
| GET | `/api/sso/callback/{tenant}` | Public, state cookie | Session cookie and redirect |
| POST | `/api/tutor` | Session, plan feature `ai_tutor` | Streamed text answer |
| POST | `/api/subtitles` | Session, plan feature `ai_tutor` | JSON subtitle map |
| GET | `/api/me/export` | Session | JSON file with the person's own data |
| GET | `/api/sandbox/{id}/stix` | Session: the submitter, or `secops.read` | STIX 2.1 bundle |
| GET | `/api/admin/reports/{kind}` | `reports.read`, session or token | CSV or XLSX report |
| GET | `/api/admin/people/export` | `people.read`, session or token | CSV of people |
| GET | `/api/admin/people/template` | Session | CSV import template |
| POST | `/api/admin/people/invite-links` | `people.write` | CSV of fresh invitation links |
| GET | `/api/admin/policies/{id}/signoffs` | `policies.read` | CSV of policy sign-offs |
| GET | `/api/admin/campaigns/{id}/usb-kit` | `campaigns.write` | CSV kit for a USB simulation |
| GET | `/api/admin/modules/{id}/scorm` | `studio.write`, feature `studio` | SCORM 1.2 zip of a module |
| GET | `/api/admin/drill/{id}` | `campaigns.write`, feature `live_drill` | JSON state of a live drill |
| POST | `/api/admin/drill/{id}` | `campaigns.write`, feature `live_drill`, same origin | JSON state after applying the due drill events |
| GET | `/api/super/demo-requests` | `platform.manage` | CSV of demo requests |
| POST | `/api/inbound/{tenant}` | Organisation's inbound secret, feature `integrations` | `202`; files a threat report (section 10) |

## 4. Endpoints

### GET /api/health

Liveness and readiness check for the container health check, load balancers and an external uptime monitor. The server runs `select 1` against the database, then reads the job runner's heartbeat and the delivery queues, all within a 3-second timeout. `Cache-Control: no-store`.

| Status | Body |
|---|---|
| `200` | `{"db":"ok","jobs":{"lastTickAt":"2026-11-05T10:00:00.000Z","stale":false},"backlog":{"mail":0,"webhooks":0}}` |
| `503` | `{"db":"unavailable"}`: the database did not answer within 3 seconds, or a query failed |

- **`jobs.lastTickAt`** is the start time of the last job-runner tick that ran to its end (table `job_ticks`), or `null` before the first one. **`jobs.stale`** is `true` when there is none or it is older than 5 minutes; ticks run every minute. A stale runner keeps the status at 200, so the container healthcheck and load balancers never take a web server out of rotation because the worker is down: a monitor alerts on the field instead.
- **`backlog.mail`** counts outbox messages with status `queued` (waiting for their first attempt or a retry). **`backlog.webhooks`** counts queued webhook and syslog deliveries. Both are usually 0. A number that keeps growing means a mail server, a receiver or the runner is down.
- **`client`** is added only for a signed-in platform operator who has two-step verification: `{"address": "<the client address the server derives>", "forwardedFor": "<raw X-Forwarded-For>", "realIp": "<raw X-Real-IP>", "trustProxy": <TRUST_PROXY>}`. Operators use it to check `TRUST_PROXY` ([`OPERATIONS.md`](OPERATIONS.md)). Other callers never see request details.

### GET /api/assets/{id}

Serves an uploaded organisation logo, so that logos can appear on certificates and in emails. Public.

- **Response.** The stored image with its MIME type, `Cache-Control: public, max-age=31536000, immutable`, and `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; sandbox`. An SVG therefore cannot run scripts.
- **Errors.** `404` when the id is not a UUID or the asset does not exist.

### GET /api/qr/{token}

A 360-pixel PNG QR code that points to `/q/{token}`. Simulation emails that ask the reader to scan a code embed it.

- **Caching.** `Cache-Control: private, max-age=86400`.
- **Errors.** `404` for an unknown or malformed token.

### GET /api/t/{token}/open

The open-tracking pixel in simulation emails. It records the first open of a recipient, unless the campaign was cancelled, and always answers with a transparent 1×1 GIF and `no-store`.

### GET /api/sso/start

Starts OpenID Connect sign-in for an organisation.

| Query parameter | Meaning |
|---|---|
| `tenant` | The organisation's slug |
| `test` | `1` lets a signed-in administrator with `settings.write` test the saved settings, even while SSO is switched off |

The endpoint does the following:

1. Discovers the provider from the saved issuer.
2. Stores a sealed state cookie for 10 minutes, holding state, nonce, PKCE verifier and tenant.
3. Redirects to the provider's authorization endpoint with:
   - `response_type=code`,
   - `scope=openid email profile`,
   - `code_challenge_method=S256`,
   - `ui_locales` set to the person's language.

It redirects to `/sign-in?error=sso` when the organisation has no complete OIDC configuration, lacks the `sso` plan feature or has SSO switched off. Requests are limited per client address and per organisation, and answer `429` with `Retry-After: 60`.

### GET /api/sso/callback/{tenant}

The return leg from the identity provider. Register this address as the redirect URI:

```text
{APP_URL}/api/sso/callback/{tenant-slug}
```

The callback then:

1. Checks the state cookie and the `state` parameter. The cookie works for one attempt.
2. Exchanges the code with the PKCE verifier and verifies the ID token, including the nonce.
3. Reads the email claim.
4. Signs the person in, as described in [section 9](#9-single-sign-on-contract).

On success it sets the session cookie and redirects to `/app`, or to the two-step code page when the person uses TOTP. A missing or mismatched state, or an incomplete OIDC configuration, goes back to `/sign-in?error=sso` without an audit entry. A failed code exchange, or a person who may not sign in, writes a `sso.sign_in_refused` audit entry with the reason before the same redirect. A test run writes `sso.tested` instead and returns to Settings.

### POST /api/tutor

Asks the AI tutor a question about the current lesson. Requires a session, the same-origin check and the `ai_tutor` plan feature.

Request body, JSON, at most 8 KiB:

| Field | Type | Rule |
|---|---|---|
| `slug` | string | Module slug, `^[a-z0-9-]{1,100}$` |
| `lessonKey` | string | Lesson key, same pattern |
| `sceneId` | string, optional | The current scene, at most 100 characters |
| `question` | string | 2 to 500 characters after trimming, no control characters |
| `locale` | string | One of `az en ru tr ro ka uk de fr ar` |

```json
{ "slug": "phishing-email", "lessonKey": "spot-the-phish", "sceneId": "s3", "question": "Why is the sender address suspicious?", "locale": "en" }
```

**Response.** `200` with `text/plain; charset=utf-8`, streamed as the model writes. The `x-tutor-mode` header says where the answer came from.

| `x-tutor-mode` | Meaning |
|---|---|
| `cache` | A stored answer to the same question on the same lesson, scene and language |
| `ai` | A new answer from the model; complete answers are stored for the next learner |
| `offline` | No API key, or the model failed before its first word: an answer assembled from the lesson text |

Only the lesson's text and the question go to the model, never the learner's name, email or job title.

| Status | Body | Cause |
|---|---|---|
| `400` | `Bad request` | The body is not valid JSON or fails the rules above |
| `401` | `Unauthorized` | No session |
| `403` | `Forbidden` | Cross-site request |
| `404` | `Not available` | The plan lacks `ai_tutor` |
| `404` | `Not found` | Unknown lesson, or a draft the person may not preview |
| `413` | `Payload too large` | Body over 8 KiB |
| `429` | `Too many questions` | Rate limit |

### POST /api/subtitles

AI-translated subtitles for a lesson, in a language the library does not ship. The ten shipped languages come from stored translations and never use this endpoint. Requires a session, the same-origin check and the `ai_tutor` plan feature.

Request body, JSON, at most 1 KiB:

```json
{ "lessonId": "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed", "target": "es" }
```

`target` is one of 65 ISO 639-1 codes listed in `src/lib/content/subtitle-languages.ts`, such as `es`, `it`, `hi`, `zh`, `ja`, `pt` or `fa`.

**Response.** `200` with a map from each line the player speaks, in the language it narrates for this person, to its translation:

```json
{ "lang": "es", "source": "en", "lines": { "Look at the sender first.": "Mira primero el remitente." } }
```

Translations are stored in the `ai_cache` table and shared by every learner, so a second request costs no model call.

| Status | `error` | Cause |
|---|---|---|
| `400` | `bad_request` | Invalid body or unknown target language |
| `401` | `unauthorized` | No session |
| `403` | `forbidden` | Cross-site request |
| `404` | `not_available` | The plan lacks `ai_tutor` |
| `404` | `not_found` | The lesson does not exist or is not reachable for this person |
| `413` | `too_large` | Body over 1 KiB |
| `422` | `too_long` | Lesson text over 30,000 characters |
| `429` | `rate_limited` | Rate limit; `Retry-After` gives the seconds |
| `502` | `ai_failed` | The model call failed |
| `503` | `ai_unavailable` | No Anthropic API key is configured |

### GET /api/me/export

"Download my data": the signed-in person's own records as one JSON file, `my-data-YYYY-MM-DD.json`. Any signed-in person may use it.

The file contains:

- the profile;
- module and lesson progress, answers and XP events;
- attestations, certificates and policy sign-offs;
- threat reports and risks, with the risk history;
- lab attempts and simulation results;
- sandbox submissions;
- support tickets with their messages, problem reports and feedback;
- live-session registrations, notifications and sign-in sessions.

Tracking tokens and the names of staff who answered tickets are left out. Each download writes an audit entry.

### GET /api/sandbox/{id}/stix

A STIX 2.1 bundle of one sandbox analysis, `application/stix+json`, saved as `SB-<number>.stix.json`.

- **Access.** The person who submitted the object may download it. So may anyone with `secops.read`, unless they still have to set up two-step verification.
- **Errors.** Everyone else gets `404`, so the existence of an analysis is not revealed.

### GET /api/admin/reports/{kind}

Report download. Requires `reports.read` and the `reports` plan feature.

`kind` is one of the following; anything else returns `404`.

| `kind` | Notes |
|---|---|
| `completion` | |
| `risk` | |
| `people` | |
| `modules` | |
| `feedback` | |
| `confirmations` | |
| `simulations` | |
| `secops` | Also needs `secops.read` |

| Query parameter | Meaning |
|---|---|
| `format` | `xlsx`, or CSV by default |
| `from`, `to` | Days as `YYYY-MM-DD`; empty means no limit |
| `d` | Department UUID; the report covers that department and its sub-departments |

- **Errors.** An impossible day, a start after the end or a malformed department id returns `400`; the report is never widened silently.
- **Scope.** A department filter outside the person's scope matches nobody.
- **Response.** Column headers are in the person's language. The file is named `<kind>-YYYY-MM-DD.csv` or `.xlsx`. Each download writes an audit entry.

### GET /api/admin/people/export

CSV of the people the viewer may see. Requires `people.read`.

Columns:

```text
name, email, department, job_title, role, status, risk_score, xp, last_active, joined
```

Each download writes an audit entry. A GET to `/api/admin/people/invite-links` returns `405`, because creating links changes data.

### GET /api/admin/people/template

The CSV template for importing people, for any signed-in person. The column names are fixed, because the import reads them:

```text
name, email, department, job_title, role, manager_email, phone, language
```

The sample row is in the person's language.

### POST /api/admin/people/invite-links

Creates a fresh 14-day invitation link for every person still in the `invited` status and returns them as CSV, with columns `name, email, invite_link`. Requires `people.write` and the same-origin check. It writes an audit entry.

### GET /api/admin/policies/{id}/signoffs

The sign-off list of a policy's current version, for auditors. Requires `policies.read`. There is one row per active person:

- name, email and department;
- policy and version;
- whether they signed, when, and from which IP address.

Each download writes an audit entry.

### GET /api/admin/campaigns/{id}/usb-kit

For a USB-drop campaign: one CSV row per drive. Requires `campaigns.write`.

Each row holds the drive label, the person it is labelled for, the bait file name and the content of a small HTML beacon file. Opening the file leads to that person's tracking link. Other channels return `404`.

### GET /api/admin/modules/{id}/scorm

A module as a SCORM 1.2 package for a customer's LMS, from Studio → "Export for an LMS". Requires `studio.write` and the feature `studio`. The query parameter `locale` is one of the ten interface languages (`az en ru tr ro ka uk de fr ar`); anything else answers `400`. The module must be a library module or one of the organisation's own; another organisation's module, an unknown id or a module without lessons answers `404`. Each download writes the audit entry `module.exported` (meta: `format`, `locale`) and answers with `Content-Disposition: attachment; filename="<module>-scorm12-<locale>.zip"` and `Cache-Control: no-store`.

The zip holds:

- `imsmanifest.xml`: one organization with one SCO item for the module (`adlcp:scormtype="sco"`, launched by `launcher.html`), `adlcp:masteryscore` 80 when the module has scored scenes, and the resource's file list;
- `launcher.html`, `player.css`, `player.js`: the app's own lesson player built for offline use (`scripts/build-scorm-player.ts`, `src/scorm/`); relative paths only, so it also opens from `file://`;
- `lessons.js`: every lesson of the module in the chosen language (English where a lesson has no text in it), the fictional brands they use and the player's interface strings. It is a script rather than JSON because browsers refuse fetches from `file://` pages.

The package finds the LMS's `API` object by the standard walk (this window and up to seven parents, then the opener). It sets `cmi.core.lesson_status` to `incomplete` on the first launch, keeps the finished lessons in `cmi.suspend_data` (with `cmi.core.exit` `suspend` while some remain), and when every lesson is done sets `cmi.core.score.raw` (min 0, max 100: the share of first-try correct answers, scored in the browser by `src/lib/content/scoring.ts`) and `passed` or `failed` against the mastery score, or `completed` for a module without scored scenes. Each finish and the page's close set `cmi.core.session_time` and call `LMSCommit`; the close calls `LMSFinish`. Narration uses the browser's voices only, AI Sel's tutor and problem reports are off, and nothing is reported back to the portal: completions stay in the LMS.

The player files are built on first use into `.data/scorm/` (development, rebuilt when `src/scorm`, `src/components/player`, `src/lib/content` or `messages` is newer) or in the Docker image's builder stage.

### GET and POST /api/admin/drill/{id}

The state of a live drill (docs/DEMO.md) for the dashboard: funnel, feed, risk curve and report. Requires `campaigns.write` and the feature `live_drill`, which only the demo seed sets; otherwise, or for an unknown id or another organisation's drill, `404`.

The dashboard polls the `POST` once a second: it applies the drill events that are due (openings, clicks, reports, trainings, through the same services a real campaign uses) and answers with the state afterwards. It changes data, so it passes the same-origin check and answers `403` to a cross-site request. The `GET` returns the same state without applying anything. Both answer with `Cache-Control: no-store`.

### GET /api/super/demo-requests

All demo requests from the public website as CSV, for platform operators with `platform.manage`. Each download writes an audit entry.

## 5. Public pages with tokens

These pages need no session. Tokens are random base32 strings, and the pages are excluded from search engines.

| Path | Purpose |
|---|---|
| `/t/{token}` | Link in a simulation message or USB beacon |
| `/q/{token}` | Target of a simulation QR code |
| `/c/{token}` | Public certificate verification |
| `/start` | Start address of the installed PWA |
| `/login` | Short address of the sign-in page |
| `/og/{lang}` | 1200×630 OpenGraph image of the public site |
| `/manifest.webmanifest`, `/robots.txt`, `/sitemap.xml` | Standard metadata |

**`/t/{token}` and `/q/{token}`.**

- **Recorded click.** Rendering the page records nothing. Once the page runs in a browser it sends a beacon (a server action with the token and `link` or `qr`); the first beacon records the click or scan, opens a risk for the recipient and emits the webhook event `phishing.clicked` or `qr.scanned`. Later beacons change nothing.
- **Mail scanners.** A gateway, sandbox or link preview that only fetches the page therefore never counts, whatever user agent it uses; a beacon from a request whose user agent names a known scanner or that is a browser prefetch is refused as well. Allow-listing the simulations in Microsoft 365 and Google Workspace, and what detonation sandboxes still count: [SIMULATION-DELIVERY.md](SIMULATION-DELIVERY.md).
- **Teachable moment.** The page shows the message's red flags in the recipient's language, with a link to the related lesson.
- **Fake sign-in.** For credential-harvest templates a look-alike sign-in form comes first. Its inputs have no names, so nothing typed is sent; only the fact of submission is recorded.

**`/c/{token}`.** The page shows the person's name, the module or path, the date and the serial number. It is visible to everyone only when the organisation allows public certificate links, which is the default. Otherwise only the holder and console users of the same organisation can open it.

**`/start`.** Redirects with `303` to `/app` when signed in, otherwise to `/sign-in`.

**`/login`.** Redirects with `308` to `/sign-in`, keeping `?next=`.

**`/og/{lang}`.** One image per language of the public site.

## 6. Outbound webhooks

An organisation on a plan with the `integrations` feature can send events to its own HTTPS endpoint. The administrator configures it under Settings, Integrations:

- an HTTPS URL on port 443 or 8443 whose host resolves to public addresses only;
- the events to send;
- a signing secret, created by the server as `whsec_…`, shown once and stored encrypted.

### Envelope

Each delivery is one `POST` with a JSON body:

```json
{
  "id": "6f1c2b9e-3d4a-4f5b-8c6d-7e8f9a0b1c2d",
  "event": "incident.created",
  "occurredAt": "2026-11-05T09:12:44.120Z",
  "tenantId": "0b7e1f0c-5a4d-4c3b-9a2e-1f0d9c8b7a6e",
  "data": { "number": "IR-1042", "title": "Invoice lure with macro", "severity": "high", "source": "sandbox", "iocs": [], "mitre": ["T1566.001"] }
}
```

### Headers

| Header | Value |
|---|---|
| `Content-Type` | `application/json` |
| `User-Agent` | `Cyclowareness-Webhooks/1.0` |
| `X-Cyclowareness-Event` | The event name |
| `X-Cyclowareness-Delivery` | The delivery id, also `id` in the body; stable across retries |
| `X-Cyclowareness-Timestamp` | Unix time in seconds, set when the request is sent |
| `X-Cyclowareness-Signature` | `sha256=` + hex HMAC-SHA256 of the raw body with the secret |
| `X-Cyclowareness-Signature-Timestamped` | `sha256=` + hex HMAC-SHA256 of `<timestamp>.<raw body>` with the secret |

### Verifying a delivery

Verify the timestamped signature over the raw bytes of the body. Reject old timestamps, and use the delivery id to drop duplicates. Example in Node.js:

```js
import { createHmac, timingSafeEqual } from "node:crypto";

export function verify(rawBody, headers, secret) {
  const ts = headers["x-cyclowareness-timestamp"];
  if (!ts || Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const expected = "sha256=" + createHmac("sha256", secret).update(`${ts}.${rawBody}`).digest("hex");
  const given = String(headers["x-cyclowareness-signature-timestamped"] ?? "");
  return given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}
```

### Delivery rules

- **Success.** Any `2xx` answer counts as delivered. The response body is not read.
- **Retries.** A delivery gets six attempts in total. The first runs on the next job tick, and the retries fall due 1, 4, 9, 16 and 25 minutes after the event was queued. After the sixth failure it is marked failed.
- **At least once.** A receiver can get the same delivery twice, for example after a timeout on its side, so it should deduplicate on `X-Cyclowareness-Delivery`.
- **Switching off.** Events queued before an administrator switched the integration off, or before the plan lost the feature, are not sent.
- **Destination checks.** The address is re-checked before each attempt, and the connection goes to the checked addresses only.
- **Test event.** The Settings page can send a test event, `admin.audit` with `data: { "test": true, "by": "<admin email>" }`.

### Event catalogue

These are the events the code emits (`src/server/services`, `src/server/actions`):

| Event | When | `data` fields |
|---|---|---|
| `phishing.clicked` | A recipient opens a simulation link | `campaign`, `userId` |
| `qr.scanned` | A recipient scans a simulation QR code | `campaign`, `userId` |
| `simulation.risky` | A recipient submits a fake sign-in form | `campaign`, `userId`, `stage` (`"submitted"`) |
| `simulation.risky` | A learner makes risky choices in a lesson simulation | `module`, `lesson`, `choices` (count) |
| `simulation.reported` | An employee reports a message that matches a simulation sent to them in the last 30 days | `number`, `channel`, `simulation` (`true`) |
| `threat.reported` | An employee reports a real suspicious message, call, link or file | `number`, `channel`, `simulation` (`false`) |
| `attestation.completed` | A learner confirms a module and receives its certificate | `module`, `userId` |
| `issue.reported` | A learner reports a problem with a lesson | `context` |
| `incident.created` | An incident is opened | `number` (`IR-…`), `title`, `severity`, `source`, `iocs`, `mitre`; a confidential incident sends only `number`, `severity` and `confidential: true` |
| `sandbox.malicious` | A sandbox analysis returns a malicious verdict | `number` (`SB-…`), `kind`, `iocs`; plus `sha256` when the object was submitted on the sandbox page rather than checked from a threat report |
| `admin.audit` | Only the test event from Settings | `test`, `by` |
| `risk.threshold_crossed` | A person's risk score rises from below the organisation's learning risk threshold (Settings → Learning, default 67) to at or above it; sent once per crossing, never on the way down | `userId`, `score`, `threshold` |__ROW__

`userId` is the person's UUID in Cyclowareness, not their email.


## 7. Syslog and SIEM

The same events can go to a syslog server instead of, or next to, a webhook.

- **Transport.** TLS (default port 6514), TCP or UDP (default port 514). Allowed ports are 514, 601 and 6514.
- **Framing.** TCP and TLS use octet counting, as in RFC 6587. UDP sends one datagram.
- **Header.** RFC 5424, facility `local0`, host name of the server, app name `cyclowareness`, message id = event name. The timestamp is the time the event happened, not the delivery time, so retries do not move events in the SIEM.
- **Retries.** Deliveries follow the same retry rules as webhooks.

**CEF format**, the default:

```text
<132>1 2026-11-05T09:12:44.120Z portal-1 cyclowareness - sandbox.malicious - CEF:0|Cyclowareness|Portal|1.0|sandbox.malicious|sandbox.malicious|7|rt=1793869964120 cs1Label=tenant cs1=<tenant uuid> cs2Label=deliveredAt cs2=2026-11-05T09:13:01.004Z cs_number=SB-311 cs_kind=file cs_iocs=[...]
```

- **Extension fields.** Each field of `data` becomes `cs_<name>`. Objects are written as JSON.
- **CEF severity.** It comes from `data.severity` when present: low 3, medium 5, high 8, critical 10. Otherwise it is 7 for events with `malicious` or `risky` in the name, and 4 for the rest.
- **Syslog severity.** Critical for CEF 8 and above, warning for 6 and 7, informational below.

**JSON format**: the RFC 5424 header followed by the envelope without `id`:

```json
{"event":"…","occurredAt":"…","tenantId":"…","data":{…}}
```

## 8. SMS gateway contract

Phone sign-in codes and SMS simulations go through one provider, which the platform operator sets with environment variables. The only provider type is `webhook`:

```text
SMS_PROVIDER=webhook
SMS_WEBHOOK_URL=https://sms-gateway.example.com/send
SMS_WEBHOOK_TOKEN=<optional bearer token>
```

Each message is one request with a 10-second timeout:

```http
POST {SMS_WEBHOOK_URL}
Content-Type: application/json
Authorization: Bearer {SMS_WEBHOOK_TOKEN}

{"to": "+994501234567", "text": "…"}
```

The gateway answers as follows:

| Answer | Meaning to the platform |
|---|---|
| `2xx` | Sent |
| `5xx`, `401`, `403`, `429`, or no answer | The gateway is down; the remaining messages wait for the next job tick |
| Any other status | This message failed |

Without a provider, development logs the message, and production reports SMS as unavailable. SMS campaigns then cannot launch.

## 9. Single sign-on contract

Cyclowareness acts as an OpenID Connect relying party (`src/server/auth/oidc.ts`). The administrator enters these values under Settings, Sign-in:

- the issuer URL;
- the client id and client secret;
- optionally, a claim other than `email`;
- whether to create learners on their first sign-in.

**Provider requirements.**

- A discovery document at `{issuer}/.well-known/openid-configuration` whose `issuer` matches the configured one.
- HTTPS endpoints that resolve to public addresses.
- An authorization endpoint on the issuer's host. Amazon Cognito's `amazoncognito.com` domain is accepted as an exception.
- The authorization code flow with PKCE S256.
- Client authentication by `client_secret_basic`, or `client_secret_post` when the provider offers only that.
- Answers no larger than 256 KiB.

**Sign-in rules.**

- When the standard `email` claim is used, `email_verified` must be `true`.
- The person is found by email. An account that belongs to another organisation is refused.
- `tenant_admin`, `super_admin`, `analyst` and `campaign_manager` accounts are refused, because they always sign in with a password.
- An unknown person is created as a learner only when automatic creation is on and the address is on the organisation's saved domain. The callback does not re-check that the domain proof is still valid.
- An invited person becomes active on their first SSO sign-in.
- Claims used: `email` or the configured claim, `email_verified`, `name`, `given_name`, `family_name` and `locale`.

SAML is not connected; only OpenID Connect works.

## 10. Inbound report address

People report suspicious mail by forwarding it to the organisation's report address (for example `report@bank.az`). The organisation's mail provider receives that mail, parses it and posts each message to Cyclowareness, where it becomes a threat report of the person who forwarded it (`src/app/api/inbound/[tenant]/route.ts`). It needs the plan feature `integrations`.

**Setup** (Settings, Integrations, Report address):

1. Type the report address. Once the secret exists, the report dialog tells learners to forward suspicious mail there; leave it empty to hide the hint.
2. Create the access secret and copy it: only its SHA-256 hash is stored, so it is shown once. Creating a new one stops the old one at once.
3. In the mail provider, route the report address to the endpoint shown on the card, `{APP_URL}/api/inbound/{tenant slug}`, with the secret as a bearer token. Mailgun routes, Amazon SES receipt rules and Postmark inbound webhooks each send their own format: put a small adapter in front that maps it to the generic JSON below. Only that generic format is built in.

**Request.**

```http
POST {APP_URL}/api/inbound/{tenant slug}
Content-Type: application/json
Authorization: Bearer {inbound secret}

{
  "from": "Aysel Məmmədova <aysel@bank.az>",
  "to": "report@bank.az",
  "subject": "Fwd: Your payslip is ready",
  "text": "---------- Forwarded message ----------\n…",
  "html": "<div>…</div>"
}
```

| Field | Required | Use |
|---|---|---|
| `from` | Yes | The person who forwarded the mail, a bare address or `Name <address>`. Matched without regard to case against the active people of the organisation |
| `to` | No | Not used; accepted so the provider can send it |
| `subject` | No | The report's subject. Simulations are also matched by their template subject, `Fwd:` included |
| `text` | No | The plain-text body. Stored as the report's details, at most 4,000 characters |
| `html` | No | Searched for a simulation link only; never stored |

**Processing.**

- The first simulation tracking link (`{APP_URL}/t/{token}`) in `text`, then `html`, is passed as the report's link, so a forwarded simulation is matched to that exact recipient, counted as reported and the person's risk score is recomputed. Links on other hosts are skipped. A link that a mail gateway wrapped percent-encoded (Microsoft Defender Safe Links) is found too; a wrapper with its own encoding (Proofpoint URL Defense v2) is not, and the report is then matched by the template subject only, without the exact recipient.
- The report is filed exactly as from the report form: channel `email`, the daily report bonus, the `threat.reported` audit entry and the `threat.reported` or `simulation.reported` event.
- A sender who is not an active person of this organisation is ignored: nothing is filed and no XP is given. A person over the report form's own limit is ignored the same way.

**Answers.**

| Status | Meaning |
|---|---|
| `202 Accepted` | Filed, or ignored (unknown sender). The two are not told apart, so the endpoint does not reveal who works at the organisation |
| `400 Bad Request` | The body is not JSON or `from` is missing |
| `401 Unauthorized` | Missing or wrong secret, unknown organisation, no secret created, or the plan has no `integrations` |
| `413 Payload Too Large` | Body (or its declared `Content-Length`) over 1 MB. Send the parsed text, not the attachments |
| `429 Too Many Requests` | Over the organisation's limit; `Retry-After: 60`. Providers retry later |

**Trust.** The secret proves the request comes from your mail provider; it cannot prove who wrote the forwarded mail. Let the provider reject mail to the report address that fails SPF, DKIM or DMARC for your own domain, so a forged `From` cannot file a report, or earn XP, in another person's name.

## 11. Reporting API

Read-only access for the organisation's own systems (HR, BI, GRC) to the downloads that administrators already have: the reports and the people list. There is no write endpoint for tokens.

**Tokens.** A tenant administrator creates a token under Settings, Integrations, API tokens: a name, the permissions it may hold and how long it is valid (30, 90, 180 or 365 days; 90 unless chosen, a year at most). Creating one takes the administrator's own password, like the other account-takeover-grade actions (so an administrator who signs in only through SSO, and has no password, cannot create one), and every other administrator of the organisation gets an in-app security notice. The secret is shown once, in the form `cyk_<32 url-safe characters>`, and never again; the database keeps only its SHA-256 (`api_tokens`, `src/server/db/schema.ts`). An organisation holds at most 20 active tokens; a revoked or expired token does not count. A token can be revoked at any time; a revoked token is refused from the next request on, and an expired one from the moment it expires (Settings still lists it, marked as expired, until it is revoked). The token acts for the administrator who created it, limited to the token's permissions: it stops working while that account is suspended and when it is deleted, and when the account's role loses a permission the token also loses it. Whenever the system signs the creator out for a security reason, their tokens are revoked as well: a password change, a password set from a reset link, an administrator's reset of two-step verification, signing out other devices and a suspension. Turning on two-step verification and a role change also sign the account out but keep its tokens (a token follows the role, as above). A token minted from a stolen session therefore does not survive the account's recovery. Settings shows when each token was last used: any request that presents it counts, refused and rate-limited ones included, and the time is updated at most every five minutes.

**Permissions.** A token holds one or more of these; nothing else can be granted.

| Permission | Opens |
|---|---|
| `reports.read` | `GET /api/admin/reports/{kind}` (the `secops` report also needs the creator to hold `secops.read`) |
| `people.read` | `GET /api/admin/people/export` |
| `audit.read` | Reserved for an audit-log export; no endpoint yet |

The organisation's plan still applies: a token works only while the plan has the `integrations` feature that minting needs (it can still be revoked without it), and a report needs the `reports` feature, as for a person.

**Request.** Send the token in the `Authorization` header. The endpoints and their query parameters are those of section 4.

```bash
# Completion report for October as CSV
curl -sS -H "Authorization: Bearer cyk_..." \
  "https://portal.example.az/api/admin/reports/completion?from=2026-10-01&to=2026-10-31" -o completion.csv

# Risk report as XLSX, one department and its sub-departments
curl -sS -H "Authorization: Bearer cyk_..." \
  "https://portal.example.az/api/admin/reports/risk?format=xlsx&d=4f2c...-uuid" -o risk.xlsx

# People list
curl -sS -H "Authorization: Bearer cyk_..." "https://portal.example.az/api/admin/people/export" -o people.csv
```

Column headers follow the `Accept-Language` header; without one they are in English.

**Errors.** Token requests always get the bare status, never a redirect to sign-in.

| Status | Meaning |
|---|---|
| `401 Unauthorized` | Unknown, revoked or expired token, or the creator's account is no longer active |
| `403 Forbidden` | The token does not hold the permission the endpoint needs, the endpoint is a write (`POST`) or not listed above (such as the import template), or the plan no longer has the `integrations` feature |
| `404 Not found` | Unknown report kind, or the plan lacks the feature |
| `400 Bad request` | Malformed `from`, `to` or `d` (section 4) |
| `429 Too many requests` | Rate limit, see below; `Retry-After` names the seconds to wait |

**Audit.** Creating and revoking a token write `api_token.created` (with `meta.expiresAt`) and `api_token.revoked`; a token revoked because its creator was signed out has no actor and names the cause in `meta.reason` (`password_change`, `password_reset`, `other_devices_signed_out`, or `sessions_ended` for an administrator's 2FA reset or a suspension). A wrong password when creating one writes `security.step_up_failed` with `meta.action` `api_token.created`. Every download made with a token writes the usual `report.downloaded` or `people.exported` entry with the creator as actor and the token's id in `meta.apiToken`. A refused request with a known token writes `api_token.refused` with the reason (`revoked`, `expired`, `creator_inactive`, `plan` or `forbidden`); an unknown token belongs to no organisation and leaves no entry. The per-token rate limit applies before the refusal is written, so a revoked token leaves at most 60 entries a minute.

## Rate limits

Limits are fixed windows counted in the database and shared by every server instance (`src/server/rate-limit.ts`).

| Endpoint | Limit |
|---|---|
| `POST /api/tutor` | 20 questions per person per 10 minutes |
| `POST /api/subtitles`, requests | 60 per person per 10 minutes |
| `POST /api/subtitles`, model calls | 6 per person per 10 minutes, 30 per person per day, 300 per organisation per day |
| `GET /api/admin/reports/{kind}` | 60 per person per hour, and a separate 60 per hour shared by all the tokens that person created |
| People export and invitation links, combined | 20 per person per hour, and a separate 20 exports per hour shared by all the tokens that person created |
| Reporting API token, any endpoint | 60 requests per token per minute, revoked tokens included, on top of the endpoint's own limit |
| `GET /api/admin/modules/{id}/scorm` | 30 per person per hour |
| `GET /api/me/export` | 5 per person per hour |
| `GET /api/sso/start`, `GET /api/sso/callback/{tenant}` | 60 per client address per minute and 600 per organisation per minute, each |
| Start a drill (server action) | 20 drills per organisation per hour |
| `POST /api/inbound/{tenant}` | 120 messages per organisation per minute; each person's reports share the report form's 20 per hour |

Cached tutor answers and cached subtitles still count against the request limits. Client addresses are known only when `TRUST_PROXY` matches the number of reverse proxies in front of the server.
