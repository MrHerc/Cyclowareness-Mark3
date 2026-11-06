# Cyclowareness administrator guide

For the people who run Cyclowareness inside a customer organisation: tenant administrators, department heads, security analysts, campaign managers, content creators and executives. It describes every page of the admin console at `/admin` as the code builds it today. Page names are the English labels; the console shows them in your interface language.

Engineers will find the design in [ARCHITECTURE.md](ARCHITECTURE.md), and integrators the webhook, syslog, SMS and SSO contracts in [API.md](API.md).

## Contents

- [Before you start](#before-you-start)
- [Finding your way](#finding-your-way)
- [Overview](#overview)
- [People and training](#people-and-training)
- [Phishing simulations](#phishing-simulations)
- [Security operations](#security-operations)
- [Insights](#insights)
- [Service](#service)
- [Settings](#settings)
- [Platform operator](#platform-operator)
- [What the console does not do yet](#what-the-console-does-not-do-yet)

## Before you start

**Who sees what.** The console opens for every role except `learner`. Each page checks a permission, and many also need a feature of your organisation's plan. A page you cannot use is left out of the menu, and opening its address answers "not found".

| Role | Works on |
|---|---|
| Tenant administrator | Everything in the organisation, including Settings |
| Department head | People, assignments and reports for their own departments and the departments below them |
| Executive | Leadership panel and reports |
| Security analyst | Security operations: threats, sandbox, incidents, closed loops, approvals, audit log |
| Campaign manager | Phishing simulations |
| Content creator | Assignments, policies, the training studio, learning paths, live sessions, feedback |

**Plans.** Essentials, Professional and Enterprise HRM add features in that order. Professional adds, among others, the AI tutor, SMS simulations, QR traps, the sandbox, threat intake, incidents, risk profiles, single sign-on, integrations, the compliance pack and the studio. Enterprise HRM adds closed loops, the approval gate, threat and policy intelligence, the leadership panel and the operations center.

**Two-step verification.** When the organisation requires it (Settings → Sign-in; new organisations have it on), everyone with console access must turn it on before the console opens. Without it, the console sends you to Profile to set it up.

**Guide.** The Guide button in the header replays a one-minute tour of the console.

## Finding your way

The menu is grouped by job, in this order. Headed groups fold away, and the console remembers that per device.

| Group | Pages |
|---|---|
| (top) | Overview |
| People & training | People, Departments, Assignments, Learning paths, Training studio, Approval gate, Policies, Live sessions, Problem reports |
| Phishing simulations | Campaigns, Live drill |
| Security operations | Incident risks, Threat intake, Threat intelligence, Policy intelligence, Sandbox, Closed loops, Risk profiles, Operations center |
| Insights | Reports, League, Leadership panel, Audit log |
| Service | Support desk, Employee feedback |
| (bottom) | Settings |
| Platform | Organisations (platform operator only) |

The header carries the language switcher, the Guide button and your notifications. **Learner view** at the foot of the menu opens the learner app.

## Overview

`/admin`. The organisation at a glance: average risk, completion, learners, people active in the last 7 days and the phishing report rate, each with its 30-day change and charts. "Show data for" narrows it to a department.

- **Insights** point at what needs action: high-risk people, overdue modules, a low report rate, people who finished a module but have not confirmed it, and missing policy signatures. You can remind everyone waiting to confirm a module from here.
- **Quick actions:** add a person, assign training, create a training with AI, launch a campaign, open reports.
- **Setup checklist:** create departments, add people, set up email, add your logo, assign a module, publish a policy, require two-step verification. Each step is ticked when it is done; a step can be marked "not needed".

## People and training

### People

`/admin/users`. Everyone in the organisation, with search and bulk actions (select people to remind or change them together).

- **Add a person.** They get the assignments of their department at once, and a welcome email once sending is on.
- **Import a CSV.** Columns: `name, email, department, job_title, role, manager_email, phone, language`. The file is checked first and every problem is shown before anything is saved. Limits: 5,000 rows and 900 KB. Unknown departments are created. An address on a domain another organisation has proven cannot be added, and an address or phone that belongs to an account elsewhere gets a neutral "can't be added here".
- **Invite links.** Download the invitation links as CSV, or copy one person's link (each works once).
- **Person page** (`/admin/users/{id}`): risk score and trend, XP, level, streak, learning progress, confirmations, certificates, simulation and QR-scan history, weak areas, open risks and recent activity. Actions: edit, change role, move department, create a password reset link, reset two-step verification (their sessions are signed out), unlink single sign-on, suspend or reactivate, delete. When a learner asks for their account to be deleted, the request shows here for you to review.

### Departments

`/admin/departments`. The organisation's tree of departments and sub-departments, with people counts.

- **Delete:** people keep their accounts and move to "No department"; sub-departments move up one level; assignments and scheduled reports for the department are removed.
- **Merge:** people, sub-departments, assignments, campaign audiences and scheduled reports move to the target department, and the merged one is deleted.

### Assignments

`/admin/assignments`. What people must learn. **Assign module** picks a module or a learning path, then who: everyone, a department or one person. The due date is a fixed date, a number of days after joining, or none. People in scope see the assignment at the top of their path. Removing an assignment keeps progress.

### Learning paths

`/admin/paths` (feature: paths). Ordered sets of lessons for roles and regulations. On plans with the lab, a path can also list practice labs, which open for a learner after the path's lessons. A path for which certificates were issued cannot be deleted: the certificates and their public links are compliance evidence.

### Training studio

`/admin/studio` (feature: studio). Your own short lessons and support materials.

- **Create a training with AI:** describe the topic, audience and tone in a sentence or two. AI writes the lessons and checks them automatically; you review the draft before anyone sees it. Without an AI key on the server, the studio builds the draft from the closest library lesson through the same checks.
- Saving creates a draft. Employees do not see it until you publish it from the list.
- A lesson can be deleted only while nobody has progress, a confirmation or a certificate for it, and nothing (an open risk or an incident) trains with it.

### Approval gate

`/admin/approvals` (feature: approvals). No AI or template material reaches employees before a person approves it. Rejecting needs a reason. A material that needs two approvals goes to a second approver, who must be a different person; once approved, the lesson goes to its target people.

### Policies

`/admin/policies`. Policies people read and sign.

- **New policy:** give it a name people recognise, then write the text (Markdown: `##` headings, `-` lists, `**bold**`).
- **Translations:** the main text is in the organisation's default language; add a translation for any switched-on language. People whose language has no translation read the main text.
- **Publish a version:** everyone is asked to sign it. A new version asks everyone to sign again.
- **Remind** the people who have not signed. The list shows "signed of total" per policy.

### Live sessions

`/admin/sessions` (feature: live_sessions). Live demonstrations, briefings and Q&A sessions that learners register for. Deleting a session notifies the people registered for it.

### Problem reports

`/admin/problems`. What learners reported from inside the app, with where it happened (the lesson and module, or the page). Statuses: New, In progress, Resolved, Not a problem.

## Phishing simulations

### Campaigns

`/admin/campaigns`. Each campaign shows how many recipients reported the simulation, with results as a share of messages sent.

- **New campaign** (`/admin/campaigns/new`) is a wizard: the channel, the template, the audience (the whole organisation or one department with its sub-departments), when (keep it as a draft, or plan a date and time) and a name only admins see.
- **Channels:** email; SMS on plans with SMS simulations; QR-code traps on plans with QR traps; a USB drop kit (one file per drive; opening it records the event and shows the lesson). Voice-call campaigns cannot be launched: no telephony provider is connected.
- **Launch:** the simulation goes out at once, or at the planned time. People who click see a short explanation and get a training. A launch does not go ahead, and the campaign says why, when email or SMS sending is not set up, when the channel or template is not part of your plan, or when the campaign was already launched. A scheduled campaign that cannot launch goes back to drafts and is not retried automatically.
- **Campaign page:** sent, opened, clicked, entered data and reported, per recipient. Statuses: draft, scheduled, running, completed, cancelled.
- Employee reports of a simulation are matched to it automatically in Threat intake.

### Live drill

`/admin/drill` (feature: live_drill). A phishing attack on your organisation compressed into minutes, for demonstrations. Pick the lure, the audience and the speed (90 seconds or 3 minutes); either way it plays back the first 4 hours after delivery. You are left out of the audience because you are watching.

- Each person's reaction is simulated from their risk profile, and **no email or SMS leaves the platform**. Everything that follows is real: tracking, risk scores, assigned trainings, certificates and audit entries, as for a normal campaign. Webhook and syslog events and reminder emails that follow are real too.
- The drill page shows a simulated clock, one tile per person, a live feed (clicks, typed passwords, reports, finished trainings), the race between the first click and the first report, the average risk curve and a summary against an untrained baseline (KnowBe4 2026).
- Cancelling the drill's campaign stops the drill.
- This feature is switched on only for the seeded demo organisation; it is not part of any plan, and it is not meant for organisations with real employees.

## Security operations

These pages are for security analysts and tenant administrators (Risk profiles: everyone who may read people), and each needs its plan feature.

| Page | What it does |
|---|---|
| **Operations center** `/admin/ops` | Everything that needs a security decision today, in one place. Live incidents stay at the top until resolved. |
| **Threat intake** `/admin/threats` | Everything employees reported with the Report button, ready for triage (New, Triaged, Converted, Dismissed). Reports that match a phishing simulation are marked: the employee did the right thing. **Convert** starts a closed loop so the report ends in training; **Dismiss** keeps it in the history. |
| **Incident risks** `/admin/incidents` | Real incidents (Open, Investigating, Resolved) and the training that follows them. Add IOCs (domains, URLs, IPs, hashes, file names; shown defanged as `example[.]com`) and MITRE ATT&CK techniques, and assign training to the people involved. Employees see only the incident number, never the details, and webhooks get no details. |
| **Threat intelligence** `/admin/intel/threat` | Current attacks from public sources. **Convert** opens a closed loop and drafts a support material for the approval gate. Items are not fetched from a live feed yet. |
| **Policy intelligence** `/admin/intel/policy` | New rules and standards that change what people must learn or sign. **Convert** creates a policy draft to complete and publish. |
| **Sandbox** `/admin/sandbox` | Static analysis of files and links: nothing is opened or run. Files up to 10 MB are analysed in memory and not stored (only the SHA-256 hash and the findings are kept). Verdicts: Malicious, Suspicious, Pending, Benign. |
| **Closed loops** `/admin/loops` | Each real threat followed from the first report to the training it produced, through seven stages: Intake, Analysis, Conversion, Approval, Targeting, Training, Feedback. Closing a loop records the result. |
| **Risk profiles** `/admin/risk` | Human risk per person, with the evidence behind every score. Lower is better: the score adds unfinished training, overdue work, risky simulation actions, open risks and first-try answer accuracy. |

## Insights

### Reports

`/admin/reports` (feature: reports). Downloads for audits and leadership, in your interface language, filtered by period and department.

| Report | Contents |
|---|---|
| Completion | Who finished which assigned modules, and who is overdue |
| Risk | Risk score per person and department, with the 30-day change |
| People | Everyone with role, department, status and last activity |
| Modules | Assigned, completed and average score for each module |
| Module feedback | Anonymous ratings, reasons and comments for each module |
| Confirmations | Who confirmed each module, when, in which language, with which text and with which evidence, and who is still waiting |
| Phishing simulations | Every recipient of every campaign: sent, opened, clicked, reported |
| Security operations | Threat reports, incidents, sandbox verdicts and closed loops (analysts and administrators only) |

- Each report downloads as **CSV** or **Excel (XLSX)**, or opens as a **print-ready page** that your browser saves as PDF ("Print or save as PDF"). PDFs are not generated on the server.
- **Compliance pack** (feature: compliance_pack): one print-ready document for auditors with training completion, module confirmations, simulations, human risk, the security settings and a cross-check of completed modules without a confirmation.
- **Scheduled reports:** a report by email every week or every month, as CSV or XLSX, to the addresses you list, at 08:00 in the organisation's time zone. The email carries a link, not an attachment: after signing in, the link opens the report file. Scheduled reports need email sending (Settings → Email).
- Every download is written to the audit log.

### League

`/admin/league` (feature: league). The department league of the month, ranking departments that have active people. **Full screen** shows the board on a wall screen.

### Leadership panel

`/admin/leadership` (feature: leadership). The security picture for management in plain numbers, with 30-day changes.

### Audit log

`/admin/audit`. Every change made in the admin console, with time, who did it, the event code and the IP address. Filter by action.

## Service

### Support desk

`/admin/support` (feature: support). Questions and problems employees send from Help. Tickets are Open, In progress, Answered or Closed; open one to reply.

### Employee feedback

`/admin/feedback` (feature: feedback). What employees think of the lessons and the platform, including anonymous ratings.

## Settings

`/admin/settings` (tenant administrators). Ten tabs. Stored secrets are encrypted and never sent back to the browser: a tab only shows that a secret is set.

| Tab | What you set |
|---|---|
| **Branding** | Organisation name and logo (PNG, SVG or JPEG up to 512 KB; an SVG with scripts, event attributes or external references is refused), primary and accent colours, the sender domain, and the **domain proof**: publish the shown DNS TXT record on the domain or its `_cyclowareness` subdomain and check it. The proof is re-checked every day and ends if the record is missing for 7 days. Only a proven domain allows single sign-on and automatic joining. |
| **Languages** | Your own interface language; the organisation's default language for new learners; the languages learners may pick from; the organisation's **time zone** (due dates end at 23:59 there, streak days and daily XP turn over at its midnight, scheduled reports go out at 08:00). |
| **Sign-in** | Single sign-on with OpenID Connect (Entra ID, Keycloak, Okta, Google): issuer URL, client ID and secret, the redirect URI to register, a test sign-in, an organisation sign-in link, and whether to create learners on first sign-in. Administrators always sign in with their own password, never through SSO; while **Require two-step verification for admins** is on they must also set up and use a two-step code (the rule is on by default). The tab also sets the maximum number of devices signed in at once. |
| **Email** | Your own mail server (SMTP). Sending becomes active only after a successful test email. The outbox shows the last 20 messages (without a mail server they stay "logged") and resends failed ones. |
| **Notifications** | One template per message and language (a training message must contain the link token), and manager alerts when someone in a team needs attention. Nothing is emailed until email is set up and a test succeeds. |
| **Confirmation text** | The statement learners confirm after a module's last lesson; only then does the module count as completed. |
| **Certificate** | The certificate's title and text (empty fields use the defaults), and the public verification link, which shows the name, module and date to anyone who has it. |
| **Learning** | Timed questions in medium and hard modules, the automatic monthly follow-up training while a learner's risk is at or above the threshold (default 67), and the daily XP goal. |
| **Protection** | Copying, printing and screen blur (text cannot be selected, printing gives a blank page, the screen blurs when the window is left); the invisible per-session **watermark**; and the leak check: drop a picture of a leaked screen and the code tells whose session it came from (processed in your browser only). |
| **Integrations** | Webhooks: signed JSON events to your SIEM or ticket system over HTTPS (create the signing secret first; it is shown once). Syslog forwarding to your SIEM. Both can be tested from the tab. The headers and payloads are in [API.md](API.md). |

## Platform operator

`/super` is for the platform operator (`super_admin`), who always signs in with two-step verification.

- **Organisations:** every organisation with its plan, people count and feature overrides (plan default, on or off); create an organisation with its first administrator; create a one-hour admin access link; rename; verify an email domain (or record the proof without the DNS record).
- **Demo requests** (`/super/demo`): requests from the public site's form, with statuses New, Contacted, Won and Lost, CSV export and delete.

## What the console does not do yet

- No SAML sign-in and no directory (LDAP or Active Directory) synchronisation; single sign-on is OpenID Connect only.
- Voice-call simulations cannot be launched.
- No server-generated PDF and no report attachments: PDFs come from the browser's print dialog.
- Threat intelligence has no live feed.
- No native mobile app; the learner app installs as a web app (PWA).
