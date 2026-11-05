# Changelog

All notable changes to this project are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

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
