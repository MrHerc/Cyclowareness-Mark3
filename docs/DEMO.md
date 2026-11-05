# Cyclowareness: the three-minute demo

**Live drill** is the one capability to show a customer or an investor. In about 90 seconds it plays a
phishing attack on the demo organisation (Safarov Industries, 35 people). It shows the platform doing
what a security-awareness product is bought for:

1. People open, click and report a realistic lure.
2. Every click turns into a teachable moment and an assigned training, with no human involved.
3. Every report is matched to the simulation, so no analyst has to triage it.
4. Finished trainings close the risks the clicks opened, and certificates are issued.
5. The organisation's risk score moves while you watch, against an industry benchmark.

Other products show a campaign report two weeks later. This shows the whole closed loop live, on one screen.

## Run it

You need Node.js 22 or newer and npm. Docker and PostgreSQL are not needed. From the repository root:

```bash
npm --prefix portal run demo
```

The command does the following, in about two minutes on a laptop:

1. It installs the dependencies if `portal/node_modules` is missing.
2. It creates `portal/.env.local` from `portal/.env.example` if the file does not exist.
3. It rebuilds the demo organisation in the embedded database at `portal/.data/pg`, with 60 days of history.
4. It starts the portal on port 3000 and pre-compiles every page of the walkthrough.
5. It prints the sign-in address.

Then:

1. Open http://localhost:3000/sign-in?next=/admin/drill
2. Sign in as `admin@safarovindustries.com`. The password is the `SEED_PASSWORD` value in `portal/.env.example`.
3. If the admin guide opens over the page, close it with Esc.

| Option | Effect |
|---|---|
| `npm --prefix portal run demo -- --prod` | Production build, then the standalone server. Pages are fastest, but the build takes a few minutes. Use it for a recorded demo. |
| `npm --prefix portal run demo -- --port 3005` | Another port. |
| `npm --prefix portal run demo -- --keep-data` | Keep the current demo database, including earlier drills, instead of rebuilding it. |

Ctrl+C stops the server. Running the command again gives a fresh organisation. The demo answers on this
computer only, because every demo account shares a published password. To show it on a big screen, mirror
or share this screen.

### With Docker instead

This starts PostgreSQL 16, loads the demo organisation and serves the production image on port 3000:

```bash
docker compose -f portal/docker-compose.demo.yml up --build
```

The stack uses fixed demo secrets and empties the database on every start, so it is for demos only.
Remove it, including the database volume, with:

```bash
docker compose -f portal/docker-compose.demo.yml down -v
```

## The talk track (3 minutes)

| Time | Screen | Do | Say |
|---|---|---|---|
| 0:00 | Live drill setup | Leave the default lure, "Two-step verification renewal (QR)", the whole organisation and 90 seconds. Press **Start the drill**. | "This is a real phishing lure our customers run. We'll send it to all 32 people at Safarov Industries and watch the first four hours of a working day in 90 seconds." |
| 0:10 | Live dashboard, top | Point at the funnel and the tiles lighting up by department. | "Delivered, opened, clicked. That orange tile is someone who just clicked. Most clicks come within a minute of opening; the industry median is 21 seconds." |
| 0:30 | Feed and AI Sel | Point at the feed. | "Here is what the platform did on its own. The moment someone clicks, they see what gave the email away, and the matching training is assigned with a due date. Nobody on the security team lifted a finger." |
| 0:50 | Click-vs-report card | Point at first click and first report. | "This is the race that matters: how fast the first person reports it compared with the first click. Reports are matched to the simulation automatically and earn XP." |
| 1:10 | Risk card | Point at the curve. | "Average risk jumps with every click, and more with every password typed into the fake page. Reports and finished trainings pull it back down. The click itself stays on the person's record for 90 days, which is the evidence an auditor asks for." |
| 1:35 | Drill report | Wait for the report, or press **Skip to the end**. | "Their click rate against the untrained baseline of 33 percent. The resilience ratio: reports per click. How many trainings were assigned and finished, and where risk peaked." |
| 2:15 | Campaign page | Press **Open the campaign**. | "None of that was a slideshow. This is the campaign record, with per-person timestamps for opened, clicked, entered a password and reported." |
| 2:35 | Leadership panel | Press **Leadership panel** on the report. | "The board view already includes today's drill: risk trend, report rate, training completion, policy coverage." |
| 2:50 | Close | | "Phish, teach, measure, repeat, automatically, in ten languages including right-to-left Arabic." |

If someone asks for proof that it is real, open **Threat intake** (the reports appear as triaged and matched to
the simulation) or **People** → a person who clicked (the risk, the training and the certificate are on
their record).

## What is simulated and what is real

**Simulated:** each person's decision and its timing. The planner in `portal/src/lib/drill/plan.ts` decides,
from the person's risk score and the lure's difficulty, whether they open, click, type a password, report,
and finish the training. It also decides when. No email or SMS leaves the platform.

**Real:** everything after that decision. The drill calls the same server code a real recipient triggers:

| Step | Service |
|---|---|
| Opened (tracking pixel) | `recordOpen` |
| Clicked (teachable moment, risk tied to the training module) | `recordClick` |
| Typed a password (risk raised to high; only the fact is stored) | `recordSubmit` |
| Reported (threat report matched to the simulation, XP) | `submitThreatReport` |
| Finished the training (lessons, attestation, certificate, risk closed) | `completeLesson`, `attestModule` |
| Risk score | `recomputeRisk`, then the organisation snapshot when the drill ends |

The campaign, its recipients, threat reports, risks, certificates, XP and audit entries ("Live drill
started" and "Live drill finished") stay in the database like any campaign's.

## Calibration and sources

- **Untrained baseline click rate: 33%.** KnowBe4's
  [Phishing by Industry Benchmarking Report 2026](https://www.knowbe4.com/resources/reports/2026-phishing-industry-benchmarking-report)
  gives 33.2% before any training. The dashboard shows it as a marker on the click bar.
- **Speed.** The [Verizon 2024 DBIR](https://www.verizon.com/business/resources/reports/dbir/2024/summary-of-findings/)
  gives a median of 21 seconds from opening to clicking, then 28 seconds to enter data. The planner uses
  delays of that size.
- **Behaviour model.** About 86% open an email and 95% open an SMS. The chance of a click scales with the
  lure (easy 0.22, medium 0.32, hard 0.44 for an average person) and with the person's risk score.
  Low-risk people report more often, and about 30% of those who click report it afterwards. Over 300
  simulated drills on the demo organisation, the click rate is about 19% for easy lures, 27% for medium
  and 37% for hard ones (`portal/tests/drill-plan.test.ts`).
- **Every drill tells the whole story.** The planner guarantees at least one click, one report and one
  finished training when the audience allows it.
- **Time.** A drill covers the first 4 hours after delivery. The playback clock is warped: the first
  minutes, when clicks and reports happen, play slower than the later hours, so the 90 seconds stay busy.

Risk can end above where it started: a click and, more so, a typed password stay in the 90-day risk
model, while a finished training removes only the open risk the click created. The dashboard shows
before, peak and now, and the report says which happened, instead of claiming a reduction.

## Safety

- The drill is the operator-only feature `live_drill`. No plan includes it. Only the demo seed switches it
  on, for the fictional demo organisation. An operator can switch it for an organisation in `/super` →
  Features. Never switch it on for real employees: their records would show clicks they never made.
- The person who starts a drill is left out of its audience.
- A drill never sends anything. Its recipients are kept out of the job that sends queued SMS simulations, and no email is queued.
- Cancelling the drill's campaign on the campaign page ends the drill where it is.
- Only campaign managers and administrators can start one (`campaigns.write`), and at most 20 per
  organisation per hour.

## Troubleshooting

| Problem | Fix |
|---|---|
| `Port 3000 is in use` | If it is `npm run dev` or an earlier demo from this folder, stop it first: both use the embedded database in `portal/.data/pg`, which only one process may open. Use `--port 3005` only when an unrelated program holds port 3000. |
| The first page is slow | The development server compiles a page on first use. The script pre-compiles the walkthrough. For a recorded demo use `--prod`. |
| The interface is in Azerbaijani | The demo administrator's language is az. Use the language picker at the top. All ten languages are complete. |
| A drill shows very few clicks | That happens with "Easy to spot" lures, and it is realistic. For a livelier story pick a "Hard to spot" lure, such as "Changed bank details" or "Keynote invitation (executives)". |

## Where the code is

| Path | What |
|---|---|
| `portal/scripts/demo.mjs`, `portal/scripts/demo-session.ts` | The one-command runner and its warm-up session |
| `portal/docker-compose.demo.yml` | The Docker demo stack |
| `portal/src/lib/drill/plan.ts` | The behaviour planner, clock and progress (pure, tested) |
| `portal/src/server/services/drill.ts` | Start, apply due events under a lease, finish, skip, dashboard view |
| `portal/src/app/(admin)/admin/drill/` | Setup page, history and live page |
| `portal/src/app/api/admin/drill/[id]/route.ts` | The endpoint the dashboard polls once a second |
| `portal/src/components/admin/drill/` | Setup form and live dashboard |
| `portal/drizzle/0001_live_drill.sql`, `0002_drill_risk_trail.sql` | The `drill_runs` table and its risk curve column |
| `portal/tests/drill-plan.test.ts`, `portal/tests/drill-service.test.ts` | Planner unit tests, and an end-to-end test on an in-memory database |
