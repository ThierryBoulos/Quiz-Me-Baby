# Quiz Me Baby

Party trivia game. The live app is `party/` (Next.js, Supabase); `engine/core.js` is its game engine. `classic.html`
is the old one-screen app, **retired as a game on 3 Nov** (nobody can reach it; `/classic` redirects home): it is
only where the question bank lives. Don't change its screens or rules text; only its bank data.

- **It's one game.** Two teams, 3 to 8 teams, with a TV or without, with a host or without: every change the owner
  asks for, and every change made, applies to all of them unless the owner says otherwise. Where something can't work
  the same way in one of them, say so and say what happens there instead (8 Nov, the owner).
- **Writing or changing content?** Read `docs/CONTENT-RULES.md` first and follow it; add the owner's new rulings
  there.
- **Showing the owner new content**: never a summary or table. Each item numbered and written out exactly: question,
  answer, accepted answers, notes, and the 4 options for Majority Rules (rulebook §0). The owner accepts, rejects or
  comments by number.
- **Commercial-phase and security to-dos**: `docs/COMMERCIAL.md`.
- **Push only when the owner says "push".** Commit locally meanwhile.
- **Database changes need the owner's approval**: write the SQL to `supabase/migrations/` and a paste-ready copy to
  `docs/sql/`; the owner runs it.
- Tests: `cd party && npm test` (engine tests, bank/map/type checks, simulated nights).
