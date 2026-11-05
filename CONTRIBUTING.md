# Contributing

The code is proprietary ([LICENSE](LICENSE)); contributions are accepted only from people working for the owner. Read [CLAUDE.md](CLAUDE.md) and [portal/AGENTS.md](portal/AGENTS.md) first: the Next.js in `portal/` differs from older versions.

## Pull requests

- Work on a branch and open a pull request against `main`. Nobody pushes to `main` directly.
- Every pull request needs the approval of one human reviewer ([CODEOWNERS](CODEOWNERS)) before it merges.
- Keep a pull request to one change, and add a test in `portal/tests` for every new branch of logic.
- Record decisions in `docs/build/DECISIONS.md` and open questions in `docs/build/OPEN-QUESTIONS.md`. Never edit `docs/audit/`: it is the specification of the original product.

## Checks

All of these must pass before review (CI runs them too). From `portal/`:

```sh
npm run typecheck
npx eslint src tests scripts --max-warnings=0
npx vitest run
npx tsx scripts/check-lesson-locales.ts --coverage
npm run build
```

## Database migrations

Migrations are additive (ADR-034). Change `portal/src/server/db/schema.ts`, run `npm run db:generate` in `portal/` to write the next `drizzle/000N_<name>.sql`, and commit the SQL with `drizzle/meta`. Never edit `drizzle/0000_init.sql` or any migration that has been pushed.

## Languages

The interface runs in ten languages: az, en, ru, tr, ro, ka, uk, de, fr and ar (Arabic, right to left).

- Every interface string goes into `portal/messages/{az,en,ru,tr,ro,ka,uk,de,fr,ar}/<namespace>.json`, in all ten languages, translated by meaning with the glossaries in `.claude/skills/cyclowareness-experience/references/glossaries/`. Keys contain no dots, and literal ICU braces are escaped.
- Never write "Aİ" in Azerbaijani: the Azerbaijani for AI is "Sİ".
- Use logical CSS properties (start/end, not left/right) so Arabic lays out correctly; `portal/tests/rtl-logical.test.ts` checks this.
