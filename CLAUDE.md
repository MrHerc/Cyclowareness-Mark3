# Cyclowareness

- The app is in `portal/`: Next.js 16 App Router (webpack), React 19, TypeScript strict, next-intl (az, en, ru), Drizzle with PGlite locally. Read `portal/AGENTS.md` before writing Next.js code; this Next.js differs from older versions.
- `docs/audit/` is the spec of the original product (never edit it). Build state and decisions: `docs/build/` (PROGRESS, DECISIONS, OPEN-QUESTIONS).
- Mascot, animations, lessons, translations and trainings: load the `cyclowareness-experience` skill first.

## Commands (from the repo root)

- Typecheck: `npm --prefix portal run typecheck`
- Lint: `cd portal && npx eslint src tests scripts --max-warnings=0`
- Tests: `cd portal && npx vitest run`
- Lesson translations: `cd portal && npx tsx scripts/check-lesson-locales.ts --coverage`
- Build: `npm --prefix portal run build`
- Dev server: port 3000 (`.claude/launch.json`). Stop it before `npm run db:*` or `npm run content:sync`: PGlite is single-process.

## Rules

- Commit only when asked; never push.
- Every UI string goes into `portal/messages/{az,en,ru}`; never write "Aİ" (Azerbaijani for AI is Sİ).
- The demo server on port 3100 is the owner's presentation copy: do not stop or rebuild it unless asked.
