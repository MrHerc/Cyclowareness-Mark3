# Cyclowareness: operations

How the hosted portal is watched, how an incident is handled, how backups are restored and what is
reviewed every quarter. It is written for the compose stack in `portal/docker-compose.yml`.
Placeholders in angle brackets are for the owner to fill in.

## Contacts and on-call

| Role | Who | Channel |
|---|---|---|
| On call (primary) | `<name>` (today: the founder alone) | `<phone>`, `<messenger>` |
| Backup on call | `<name, or "none yet">` | `<phone>` |
| Hosting console | `<provider, account>` | `<URL>` |
| Security contact for customers | `<address>` | |

**On-call note.** One person is on call at a time. The uptime monitor and the provider's alerts go to
the on-call phone. Acknowledge an alert within `<30 minutes>` during business hours (Baku time) and
within `<2 hours>` outside them. With one person on call, a holiday needs a named stand-in who has the
hosting console, the server's SSH key and this document. Until a second engineer is hired, customers
are told the response times above, not 24/7 cover.

## What to watch

- **`GET /api/health`** (format in [`API.md`](API.md#get-apihealth)). Point an external uptime monitor
  at `https://<host>/api/health` every minute and alert on: status 503 or no answer (the database or the
  server is down), `jobs.stale: true` (no job-runner tick for 5 minutes: nothing is sent, no campaign
  launches), and `backlog.mail` or `backlog.webhooks` growing over three checks in a row (a mail server
  or a customer's webhook receiver is down).
- **Logs.** `docker compose logs app` (and `worker`). In production every line is one JSON object with
  `ts`, `level`, `msg` and, where known, `tenantId` and `userId`; ship them to a log store if the host
  offers one and alert on `"level":"error"`.
- **Unhealthy container.** When `/api/health` answers 503 the Docker healthcheck marks the container
  unhealthy, which a load balancer or the uptime monitor sees. Docker and compose do not restart it for
  that (`restart: unless-stopped` acts only when the process exits): restart it by hand
  (`docker compose restart app`), or let an orchestrator or an autoheal container do it.
  A container that exits at start has a failed migration or start-up import: `docker compose logs app`.
- **Audit log.** Every organisation's administrators see their audit log in the console; the operator
  checks it after any security incident.

## Incident response

An incident is anything that stops customers from using the portal, exposes or may expose data, or
sends something nobody meant to send (a simulation to the wrong people, a wrong reminder).

1. **Detect and declare.** Alert, customer report or log line. Write down the time, open a timeline
   (the post-mortem template below) and say in `<channel>` that an incident is open and who leads it.
2. **Contain.**
   - A person's account is compromised: the organisation's administrator suspends the person
     (People, then Suspend), which ends all their sessions. When no administrator of that organisation
     can act, the operator issues a one-time password link for one of them from `/super` (support
     access, audited as `platform.admin_link`). There is no organisation-wide suspend switch yet.
   - An integration secret leaked (SMTP, SSO, webhook signing secret): replace it in that organisation's
     Settings. A leaked `APP_SECRET` is rotated with the four steps under "Rotating APP_SECRET"
     below, never by replacing the value alone: every stored secret and authenticator key is
     encrypted with it.
   - A plan feature misbehaves for one organisation: switch it off in `/super` (feature override).
   - A wrong campaign is running: cancel it on its campaign page; queued mail of a cancelled campaign
     is never sent.
   - The server itself is compromised: take it off the network (`docker compose stop app worker`),
     keep the volume for analysis, rebuild on a new host from the image and the last good backup.
3. **Communicate.** The on-call person tells each affected organisation's administrators within
   `<24 hours>` of declaring, by email from `<address>`:
   > We are handling an incident that affects Cyclowareness for your organisation since `<time>`.
   > `<What happened, what data or function is affected, as far as we know.>` `<What we have done.>`
   > `<What you should do, if anything.>` We will update you by `<time>`.

   A personal-data breach is reported to the customer (the controller) without undue delay, so they
   can meet their own notification duty; `<the DPA's deadline, e.g. 48 hours>`.
4. **Recover.** Fix the cause, or restore the last good backup (below) with the same `APP_SECRET`.
   Check `/api/health` shows `db: ok`, `stale: false` and a backlog that drains.
5. **Review.** Within five working days, write the post-mortem and track its actions to the end.

## Post-mortem template

```markdown
# Post-mortem: <short title>, <date>

- Lead: <name>. Status: draft / final.
- Impact: <who was affected, how many organisations and people, for how long, what data>.

## Timeline (Baku time)
- <hh:mm> <what happened, who noticed, what was done>

## Root cause
<What made it possible, not who did it. Ask "why" until the answer is something we can change.>

## What went well, what did not
- <...>

## Actions
| Action | Owner | Due |
|---|---|---|
| <prevent it: code, test, alert, runbook> | <name> | <date> |
```

## Narration clips

The recorded lesson voice is not in git and not made by the Dockerfile or CI: an image built the usual way
plays the browser's voice (Web Speech) only. Nothing breaks without the clips, but the recorded voice is
lost, so make them on the build machine before every release image. Details: `portal/README.md`,
"Narration voice".

1. **Tools, once per build machine.** Python 3.9+ with `piper-tts[alignment]`, ffmpeg with libmp3lame
   (on PATH, or `FFMPEG=<path>`), and the voice `en_US-ljspeech-high` downloaded into `portal/.voices`
   (the generator checks its SHA-256).
2. **Generate before `docker build`.** `cd portal && npm run narration -- --lang en --provider piper --concurrency 3`.
   A full run takes about 5.5 to 9 hours; it resumes where it stopped and stops after 10 failed clips in a row.
3. **Check.** `portal/public/generated/tts/en` holds about 3,778 MP3 files (about 140 MB); `COPY public`
   puts them in the image.
4. **Manifests.** The run rewrites `portal/content/narration/en/*.json`; leave them uncommitted unless the
   lesson text changed.
5. **Azerbaijani and Russian** wait for an Azure Speech S0 key: `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION`
   go in `portal/.env.local` on the build machine only, never in the compose `.env`. Then
   `npm run narration -- --lang az,ru --provider azure`.
6. **Missing clips** fall back to Web Speech sentence by sentence; a manifest whose clips are missing is ignored.

## Backups and recovery

- **Nightly dump.** From the `portal` folder: `sh scripts/backup.sh` writes
  `backups/portal-<UTC time>.dump` (`pg_dump -Fc`) and deletes dumps older than `BACKUP_KEEP_DAYS`
  (14). Cron: `15 2 * * * cd /srv/portal && mkdir -p backups && sh scripts/backup.sh >> backups/backup.log 2>&1`.
  The script runs with `umask 077` and sets the folder to `700`, so only the account that runs it can
  read the dumps (every organisation's personal data).
- **Encrypted dumps (recommended for banks and government).** Install [age](https://age-encryption.org)
  on the host, make a key pair once on another machine (`age-keygen -o backup-identity.txt`) and set
  `BACKUP_AGE_RECIPIENT=<its public key, age1…>` in the cron line's environment. The script then writes
  `backups/portal-<UTC time>.dump.age`, encrypted on its way to disk, so neither the host's disk nor the
  off-host storage holds a plaintext dump. Keep `backup-identity.txt` in
  `<password manager / sealed escrow>` next to `APP_SECRET`, never on this host or with the dumps.
- **Off-host copy.** Copy `backups/` every day to `<storage account at another provider>`. Keep
  `APP_SECRET` (from `.env`) in `<password manager / sealed escrow>`, apart from the dumps: a dump is
  useless without it, and it must not travel with them.
- **Restore.** `sh scripts/restore.sh backups/<file>.dump` (an encrypted dump:
  `BACKUP_AGE_IDENTITY=<path to backup-identity.txt> sh scripts/restore.sh backups/<file>.dump.age`,
  which decrypts it with age; a wrong identity stops before anything changes): asks for confirmation, stops `app` and
  `worker`, empties the database and loads the dump in one transaction (a failed restore changes
  nothing; tables from migrations newer than the dump are dropped, so the next start re-applies them)
  and starts `app`. `.env` must hold the `APP_SECRET` that was in use when the dump was made.
- **Quarterly restore drill.** Restore the latest dump into a throwaway stack (another folder, another
  `POSTGRES_PASSWORD`), sign in, open one organisation's dashboard, and note the time it took.
- **Objectives.** RPO 24 hours (nightly dumps). RTO: the restore time measured in the first drill,
  `<to be measured>`, plus the time to start a new host.

## Rotating APP_SECRET

`APP_SECRET` seals every stored secret (SMTP, SSO and LDAP passwords, webhook signing secrets,
authenticator keys) and keys the hashes of TOTP backup codes. Each ciphertext carries the id of the
key that sealed it, and `APP_SECRET_PREVIOUS` keeps the old key readable while the stored values are
re-encrypted, so nothing has to be re-entered. Every instance (`app`, `worker`) gets the same values.

1. **Generate** the new secret: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.
   Put it in the escrow next to the old one (Backups above): a dump made before step 3 still needs
   the old key. If `APP_DOMAIN_PROOF_SECRET` is not set yet, set it now to the *current* `APP_SECRET`
   (see below) and keep it for good.
2. **Deploy both keys.** `APP_SECRET=<new>` and `APP_SECRET_PREVIOUS=<old>` on every instance, then
   restart them. New secrets are sealed with the new key, old ones still open, backup codes still
   verify and domain proofs still resolve.
3. **Re-encrypt.** The runtime image ships neither `tsx` nor the TypeScript scripts, so run it from a
   checkout of the deployed version (`portal` folder, `npm ci`) with the server's environment
   (`DATABASE_URL`, `APP_SECRET=<new>`, `APP_SECRET_PREVIOUS=<old>`, `APP_DOMAIN_PROOF_SECRET`):
   `npm run secret:rotate`. With Docker Compose, the `seed` service is built from the
   builder stage and reads `.env`, so once the keys are there:
   `docker compose --profile tools run --rm seed npm run secret:rotate`. It aborts
   when `DATABASE_URL` is set and `APP_SECRET` is missing or shorter than 32 characters (it would
   otherwise seal everything with the development key), when `APP_SECRET_PREVIOUS` is set but too
   short to count, and when `APP_DOMAIN_PROOF_SECRET` is not set while an organisation has a verified
   domain (go back to step 1). It prints how many organisations' settings and how many
   authenticator keys it re-encrypted, nothing else, and is safe to run again (the second run reports
   zero). A value that opens with neither key is left as it is and counted; that organisation then
   re-enters the secret in Settings. An organisation deleted while the script runs is skipped and
   its id printed; the others are still re-encrypted.
4. **Remove the old key.** Take `APP_SECRET_PREVIOUS` out of the environment and restart. Write the
   rotation down in the timeline of the incident that caused it.

What a rotation does not carry over:

- **Signed values are not re-signed.** The signed state of a single sign-on that is in progress
  across the restart of step 2 is refused once; the person starts the sign-in again.
- **Backup codes made before the rotation** are hashed with the old key. They verify while
  `APP_SECRET_PREVIOUS` is set and stop working at step 4; authenticator (TOTP) codes are unaffected.
  Tell administrators to have people with backup codes generate new ones (Security) before step 4,
  or leave step 4 until they have.
- **Domain proofs.** Without `APP_DOMAIN_PROOF_SECRET`, the TXT value every organisation published is
  derived from `APP_SECRET`: it is still accepted while the old key is set, and after step 4 every
  organisation would have to publish a new record within the 7-day grace period. Setting
  `APP_DOMAIN_PROOF_SECRET` to the `APP_SECRET` in use when the records were published (step 1), and
  never changing it, keeps every record valid: the value proves nothing to someone who does not
  control the domain's DNS, so it need not rotate with `APP_SECRET`.

## Data retention and residency

The job worker runs a clean-up once a day (`cleanup()` in `portal/src/server/jobs.ts`, at most 30 s
per run; whatever is left is picked up by the next tick).

- **Fixed platform retention.** Sign-in attempts after 2 days; rate-limit windows once they end;
  sessions once they expire; sign-in links one day after they expire; watermark codes of ended
  sessions after 90 days; sent, logged or failed mail and delivered or failed integration deliveries
  after 90 days; read notifications after 400 days; cached AI Sel answers after 12 months; demo
  requests from the public site after 24 months.
- **Per-organisation retention.** Settings → Protection → Data retention, two values in months
  (0 to 120, 0 = keep forever, the default). *Audit log* deletes that organisation's audit entries
  older than the value. *Learning and simulation results* deletes, older than the value:
  - lesson answers;
  - behaviour risks closed before the cutoff (open risks stay);
  - the per-person results (sent, opened, clicked, submitted, reported) of campaigns that are completed
    or cancelled and ended before the cutoff, with their teachable-moment loops. The campaigns themselves
    stay, but no totals are stored: their figures (sent, opened, clicked, reported) on the campaign list,
    the campaign page and in reports count the results that remain, so such a campaign shows none;
  - closed teachable-moment loops assigned before the cutoff;
  - the daily per-person risk scores (the person page sparkline and the leadership risk story);
  - the forwarded mail text and link of threat reports that were converted or dismissed (the report
    itself stays, so its TR number and the reporter's sharp-eye badge stay; reports still new or
    triaged keep their text);
  - sandbox analyses, except each organisation's highest-numbered one, so an SB number is never reused.

  Every change is in the audit log as `settings.retention`. Deleting answers lowers the figures of the
  module-quality report for that period. The risk score reads simulation results and risky answers of
  the last 90 days and first-try accuracy of the last 180 days, so a value under 6 months shortens
  those windows and changes that organisation's risk scores; campaign reports and the person page lose
  the deleted results too. Each run that deletes something writes one `retention.purged` entry to that
  organisation's audit log with the counts per kind and the cutoff dates, so the gap in its history is
  explained.
- **Never deleted by the job.** Lesson progress, XP events, attestations and certificates: they are
  the organisation's compliance evidence and feed XP and league totals. Lab attempts stay too: a
  learning path's lab counts as passed, and the lab-explorer badge is earned, from them. Open
  behaviour risks, open threat reports and campaigns that are still running stay as well.
- **Backups.** Deleted rows stay in the nightly dumps until those age out (`BACKUP_KEEP_DAYS`, 14,
  plus the off-host copy's own retention). Say so when a customer asks how long deleted data lasts.
- **Residency.** Where the data lives is a hosting decision, not a setting: the hosted portal keeps
  every organisation in one database in the region the platform is hosted in
  (`<hosting region, open question for the owner>`); a customer that needs its data in its own
  country or data centre runs the same compose stack (`portal/docker-compose.yml`) on its own server.

## Checking TRUST_PROXY

The sign-in lockout, the rate limits and the audit log use the client address. Behind reverse proxies
the server takes it from `X-Forwarded-For`, and `TRUST_PROXY` says how many proxies in front of the
server append to that header: the address is the entry that many places from the right. Everything
further left was sent by the client and can be anything.

- `0`: no proxy headers are read (no proxy, or the port is reachable directly).
- `1`: one proxy on the same host (nginx, Caddy, Traefik), the compose default.
- `2`: a load balancer or CDN in front of that proxy, and so on.

Too low a value makes every visitor look like the nearest outer proxy's address, so they all share
one lockout and one person's failed sign-ins can lock everyone out. Too high a value makes the server
take an entry the client sent, so an attacker can choose the address and sidestep the lockout and the
rate limits. With `CLIENT_IP_HEADER=x-real-ip` the address is that header, which the proxy next to the server
must overwrite with the peer it saw; `TRUST_PROXY` then only has to be at least `1`. The server logs the value it uses at start
(`[env] TRUST_PROXY=…`).

**Validate it once per deployment** and after any change in front of the server: sign in as the
platform operator from a known network, open `https://<host>/api/health` in the same browser and
compare `client.address` with your public address (for example from `<what-is-my-ip service>`).
`client.forwardedFor` shows the raw header: with the right value, `address` is your address and
everything to its right is your proxies. If `address` is a proxy's address, `TRUST_PROXY` is too low:
raise it; if it is something you could have sent yourself, it is too high: lower it. Only a signed-in platform operator sees
the `client` field.

## Secret scan and dependency updates

**Weekly cadence.** The Security workflow (`.github/workflows/security.yml`) runs on every pull
request, on every push to `main`, by hand (Actions > Security > Run workflow) and every Monday at
04:23 UTC (08:23 Baku). Dependabot (`.github/dependabot.yml`) checks every Monday at 05:17 Baku time
for npm (`portal/`), the workflow actions, the Docker base image and the compose images; npm versions
must be 5 days old (14 for a major version) before a pull request opens, and a security update opens
as soon as GitHub knows the advisory once "Dependabot security updates" is on in Settings > Code
security. Each Monday the on-call person reads the Security run and the Dependabot pull requests.

**What the first gitleaks run over the whole history reports.** On a pull request gitleaks scans only
the commits the pull request adds; on a push to `main`, on the weekly run and by hand it scans every
commit (`--log-opts=--all`). `.gitleaks.toml` adds to gitleaks' default rules:

- two placeholder values that are public on purpose: `test-only-app-secret` (tests) and
  `dev-only-secret-change-me` (the development fallback of `APP_SECRET`, refused in production);
- five commits, allowlisted by SHA, that carried the former demo seed password, which is no longer in
  the tree: `3c2367d` (initial commit, 2026-10-19) and `a4ed78a`, `6cd9ea3`, `97d4d94`, `f9771ee`
  (2026-11-05).

So the expected first result is no finding. A commit allowlist skips every finding in that commit,
so those five commits are not scanned at all; and a rebase or squash that rewrites them changes their
SHAs and brings their findings back. If the run fails, download the `gitleaks-report` artifact (a
redacted SARIF, kept 7 days) and look at each finding: a real secret is rotated first and never
allowlisted; a value that is not a secret is added to `.gitleaks.toml` with a comment naming the file
(by commit SHA when it is only in old history). Never put a removed literal back into the tree to
match a rule.

## Quarterly access review

Once a quarter (`<month>` 1st week), the owner and one other person go through this list, remove what
is no longer needed and record the date and the result in `<where>`:

- [ ] Platform operator accounts (`super_admin`) in `/super`: each is a current person, with two-step
      verification. Remove leavers.
- [ ] Each customer's administrators: send each organisation its list of `tenant_admin` accounts to
      confirm (they own it; we only ask).
- [ ] GitHub: collaborators, deploy keys, Actions secrets, Dependabot settings, branch protection.
- [ ] Hosting console: users, API tokens, SSH keys on the server (`~/.ssh/authorized_keys`).
- [ ] Third-party keys: SMTP accounts (platform), SMS gateway, Anthropic, ElevenLabs. Rotate any that a
      leaver had seen; remove unused ones.
- [ ] Off-host backup storage: who can read it; one restore drill done this quarter.
- [ ] The presentation and demo copies (ports 3100 and 3200 on the owner's machine) hold demo data only,
      and their `SEED_PASSWORD` is not used anywhere else.
