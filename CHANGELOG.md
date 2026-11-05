# Changelog

All notable changes to this project are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased] - 2026-11-05 closure run

Entries for this run's work packages are added here as they merge.

## Phase 0 - CI, tests and ten fixes (merged 2026-11-05, unreleased)

### Added

- Continuous integration (`.github/workflows/ci.yml`): every push and pull request runs ESLint,
  the TypeScript check, the lesson translation check, the Vitest suite and the production build.
- Unit and integration tests for the parts of the portal that had none (see `portal/tests/`).

### Fixed

- **Passwords made from the person's own name or email were accepted.** The password rule passed
  the full email and full name to zxcvbn, which only recognises a personal detail as a whole
  token, so "aysel.mammadova" scored 4 out of 4 for Aysel Mammadova and was accepted. Personal
  details are now split into their words (email local part, domain name, each name) before
  scoring, on the server, in the set-password meter and in the Password Forge lab alike.
  (`portal/src/lib/password-strength.ts`, test: `tests/password-domain.test.ts`)
- **Internationalised domains could not be proven.** Domain proof refused every domain under an
  internationalised top-level domain, such as .рф, .укр, .გე and .السعودية, in the markets the
  product is sold in, whether typed in Unicode or in their ASCII (`xn--`) form. They are now
  accepted and stored in their ASCII form. (`portal/src/server/auth/domain-proof.ts`, test:
  `tests/password-domain.test.ts`)
- **A lesson completion sent twice awarded its XP twice.** `completeLesson` read the lesson's
  progress and then wrote it, so two requests at the same moment (a double submit, a network
  retry) both saw the lesson as new. The first completion is now claimed by one conditional
  statement, so only one request awards the XP. (`portal/src/server/services/progress.ts`, test:
  `tests/learner-progress.test.ts`)
- **An attestation sent twice stored two attestations and issued two certificates.** The module
  is now moved out of "awaiting attestation" by a conditional update, and only the request that
  does so stores the attestation and issues the certificate. The completion and its attestation
  text are written in one transaction, so compliance evidence never shows one without the other.
  (`portal/src/server/services/progress.ts`, test: `tests/learner-progress.test.ts`)
- **The lesson XP split went wrong for Studio and SecOps modules.** The split used the stored
  lesson position as the lesson's index, but those modules number their lessons from 1, so the
  remainder went to the second-to-last lesson, and a gap in the positions lost XP (99 of 100). The
  split now uses the lesson's place among its siblings. (`portal/src/server/services/progress.ts`,
  test: `tests/learner-progress.test.ts`)
- **Pressing Launch twice sent the phishing simulation twice.** `launchCampaign` checked the
  campaign's status and then set it to running, so two requests at the same moment (a double
  click, or the scheduler firing while someone launches by hand) both created recipients and
  queued a second email to every person. Only the request whose conditional update moves the
  campaign out of draft or scheduled now sends it. (`portal/src/server/services/campaigns.ts`,
  test: `tests/campaign-flows.test.ts`)
- **A simulation link opened twice at the same moment recorded two clicks.** Each request opened
  its own "phishing click" risk, sent its own integration event and counted twice against the
  person. The click is now claimed by one conditional update, so it is recorded once
  (`recordClick` in `portal/src/server/services/campaigns.ts`, test: `tests/campaign-flows.test.ts`)
- **A fake sign-in form sent twice at the same moment raised the risk twice.** Each request
  escalated the person's risk and sent its own integration event. The submission is now claimed by
  one conditional update, as the click is, so it is recorded once (`recordSubmit` in
  `portal/src/server/services/campaigns.ts`, test: `tests/campaign-flows.test.ts`)
- **The device limit could leave one session too many.** When a new sign-in pushed a person over
  the organisation's device limit, the oldest sessions were removed, skipping the new one if it
  sorted among them. The new session's last-seen time comes from the database clock and the
  others' from the app server, so with the clocks out of step the new one could be "oldest" and
  nothing was removed. The new session is now left out before the oldest of the others are signed
  out. (`portal/src/server/auth/session.ts`, test: `tests/sessions-viewer.test.ts`)
- **The Modules report could show a completion above 100 %.** "Completion %" divided everyone who
  completed a module by the number of people it is assigned to, so a module assigned to two
  people and also taken by others on their own showed 150 %. It is now the share of the assigned
  people who completed it; "Completed" still counts everyone. (`portal/src/server/reports/build.ts`,
  test: `tests/reports-build.test.ts`)
