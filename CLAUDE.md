# Quiz Me Baby

Party trivia game. The live app is `party/` (Next.js, Supabase); `classic.html` is the original one-screen app and
the home of the question bank; `engine/core.js` is the game engine both share.

- **Writing or changing content?** Read `docs/CONTENT-RULES.md` first and follow it; add the owner's new rulings
  there.
- **Commercial-phase and security to-dos**: `docs/COMMERCIAL.md`.
- **Push only when the owner says "push".** Commit locally meanwhile.
- **Database changes need the owner's approval**: write the SQL to `supabase/migrations/` and a paste-ready copy to
  `docs/sql/`; the owner runs it.
- Tests: `cd party && npm test` (engine tests, bank/map/type checks, simulated nights).
