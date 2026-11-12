# Quiz Me Baby

Party trivia game. The live app is `party/` (Next.js, Supabase); `engine/core.js` is its game engine. `classic.html`
is the old one-screen app, **retired as a game on 3 Nov** (nobody can reach it; `/classic` redirects home): it is
only where the question bank lives. Don't change its screens or rules text; only its bank data.

- **Every setup, every time (the owner, 8 and 11 Nov).** It's one game. Whatever the owner asks for (a feature, a
  setting, a fix, a test, a change to a mini-game or a theme) and every change made is done and checked in every setup:
  2 teams with a host, 2 teams with no host, 3 to 8 teams (they always have a host), each with a TV and with no TV.
  The checks cover them too: simulated nights and screen checks in each setup it touches. Where something doesn't
  apply (the Auction is 2 teams only), say so; where it can't work the same way, say what happens there instead.
- **The owner's wording (8 Nov).** How to Play (`party/components/Rules.tsx`) is the owner's own text: never reword
  it. When a change to the game makes it wrong, or it looks wrong, tell the owner exactly how you'd change it (the
  sentence as it is, the sentence you'd write) and wait for a yes. In everything else written for players, follow the
  owner's style: their words, their tone; don't invent new phrasing of your own. **Ties are "tied" (12 Nov):** "tied
  teams", "Tied at 3 each", never "level", "levelled" or "level teams"; "level" only ever means Easy, Medium, Hard,
  Expert. Keep it simple.
- **Writing or changing content?** Read `docs/CONTENT-RULES.md` first and follow it; add the owner's new rulings
  there.
- **Showing the owner new content**: never a summary or table. Each item numbered and written out exactly: question,
  answer, accepted answers, notes, and the 4 options for Majority Rules (rulebook §0). The owner accepts, rejects or
  comments by number.
- **Commercial-phase and security to-dos**: `docs/COMMERCIAL.md`.
- **Push only when the owner says "push".** Commit locally meanwhile.
- **Database changes need the owner's approval**: write the SQL to `supabase/migrations/` and a paste-ready copy to
  `docs/sql/`, and ask. Once the owner says yes, run it yourself with the Supabase tool; if the tool fails, the owner
  pastes the `docs/sql/` copy into Supabase's SQL Editor.
- **Every screen fits (11 Nov).** The TV on any screen shape (16:9, 16:10, a laptop's browser window); phones from
  360 wide (Galaxy) to 440 (iPhone Pro Max), and held sideways. Nothing off the edge, nothing cut off, no text on top
  of text, no sideways scroll. After changing a screen, check just those screens (`cd party && npm run screens -- tv
  roulette`, a part and a filter); the whole check (about an hour) only when the owner asks.
- **A room full of bots, on request (11 Nov).** When the owner asks for bot captains, players or a bot host in a
  room: `cd party && npm run bots -- CODE` (`--host`, `--teams 3-8`, `--players n`; docs/RUNBOOK.md). It's the live
  site: a few games at a time (the owner's yes), and only in rooms the owner opened. Just start it: no reading its
  code or testing it first, unless the owner asks (11 Nov).
- Tests: `cd party && npm test` (engine tests, bank/map/type checks, simulated nights: 2 teams with and without a
  host, 3 to 8 teams, the lobby). Screens: `npm run screens` (docs/RUNBOOK.md, "Everyday jobs").
