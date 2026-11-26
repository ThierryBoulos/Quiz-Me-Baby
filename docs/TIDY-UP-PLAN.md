# The tidy-up: the plan, written as a prompt for Claude Code

The owner's item 14 (21 Nov). Paste the prompt below into a new Claude Code session, one phase per session.
Phase 1 first; then Phase 2, one game per session.

---


## Where it stands (26 Nov)

- **Phase 1: done** (21 Nov): `classic.html` is gone; the maps are drawn by `bank/maps.js`; old comments that still
  described it as live were corrected on 26 Nov.
- **Phase 2, the screens and the words: done** for every mini-game (flag, closest, see, pin, airport, map, say, dish,
  majority, roulette, stakes, fool, comeback): one copy in `party/lib/minis/*`, `party/lib/{roulette,stakes,comeback,see}.ts`
  and the shared components. Still twice: the question rounds and sudden death, the two published views
  (`lib/tv/view.ts`, `lib/many/view.ts`), the 2-team result tables, and the Cocktail or Dish phones.
- **Phase 2, the running of each game** (answers, reveal, calls, contest, pause, Change question, time's up): still in
  both `lib/tvGame.ts` and `lib/many/logic.ts`. Next, one game per session, Secret Stakes first. Shared so far: the
  "is this tap for the screen still up?" rule (`lib/tapOn.ts`) and the scores' limit, 999 in both (26 Nov, the owner).
- Sizes on 26 Nov: `lib/tvGame.ts` about 1,900 lines, `components/PhoneGame.tsx` about 1,860.

## The prompt

You're tidying the code of Quiz Me Baby, a live party trivia game. Read `CLAUDE.md` first: its rules bind this work
(push only on the owner's "push", every setup every time, reports end with one testing line).

**The one rule that matters most: players must see no difference.** This is moving code, not changing the game. No
screen, wording, timing, score or rule may change. If you find a bug or something you'd improve on the way, don't
fix it: write it down and tell the owner at the end. A tidy-up that also "improves" things can't be checked.

Why it's worth doing: the game is built twice, once for 2 teams (`party/lib/tvGame.ts`, 1,800 lines when this was written;
`party/components/PhoneGame.tsx`, 1,800; `TvGame.tsx`) and once for 3 to 8 teams (`party/lib/many/logic.ts`,
`useTvMany.ts`, `party/components/many/`). Every change has to be made in both, and several past bugs came from one
side being missed. The owner's standing rule is that every change lands in every setup; one copy of each game makes
that automatic.

### How you prove nothing changed

These are your safety net. Run them before you start (they must pass on the untouched code) and after every step.

1. `cd party && npm test`. It replays about 85 whole simulated nights and compares each to a saved result in
   `party/sim/golden/`, line by line, plus 1,446 checks for 3 to 8 teams. **A golden file must not change in this
   work.** If a night "DIFFERS", your change altered the game: undo it and find out why. Never run
   `node sim/run.mjs --update` here; that would hide exactly the mistake the files exist to catch.
2. Screens, pixel by pixel. Before touching a game, take its screens on the untouched code and keep a copy:
   `npm run screens -- tv stakes` and `npm run screens -- phones stakes` (the pictures land in
   `party/sim/.out/screens/`; copy that folder aside). After your change, take them again and compare each picture
   to its copy. They must be identical, except where a picture shows a random simulated night (scores differ);
   those were always different between runs, so compare the layout by eye. Run `git checkout party/tsconfig.json`
   after each screen run, and never run two screen runs at once.
3. `npx tsc --noEmit -p party` and `npx eslint` on the files you touched.

If a step can't be proven identical by these, stop and ask the owner before going on.

### How to work

- One small step at a time: move one thing, run the tests, commit locally with a message saying what moved. A
  failed step is then one `git revert` away. Don't batch.
- Move code as it is. Don't rename, reorder, reformat or "clean" what you move; a reviewer should be able to see the
  moved block is the same text.
- Keep every comment that carries a date and "the owner": they're the record of why the game behaves as it does.
- Don't touch `party/components/Rules.tsx` (the owner's own text), the bank (`bank/bank.js`), the database, or
  `LIVE_LINES`.
- A room's saved game must still load: the TV keeps the game in the browser (`qmb.tv.<code>.game`) and in the
  room's backup, so a refresh mid-night picks it up. Don't change the shape of the saved state. The simulated
  nights with a refresh or a takeover (nights 72 to 83) check this; they must stay the same.

### Phase 1: the maps out of `classic.html`, then delete it (about half a day)

`classic.html` is the retired one-screen app. The bank already moved out (`bank/bank.js`, 21 Nov). Its last job:
`scripts/export-maps.js` opens it in a headless browser to draw the 38 maps (`loadMapGeo`, `mapSpec`, `mapSVG`,
`mapLegend` and what they call, around lines 2030 to 2300; the borders come from `maps-geo.js`, the night-lights
picture from `maps-night.png`).

1. Before anything: run `node scripts/export-maps.js` and confirm `git status` shows no change under
   `party/public/maps/` and `party/data/maps-r/`. That's your reference.
2. Move the map-drawing functions, and only what they need, into a file of their own (say `bank/maps.js`), as they
   are. Find what they need by running them, not by guessing: anything missing throws.
3. Make `scripts/export-maps.js` use that file. Keeping the headless browser is fine if the drawing needs the DOM;
   a minimal page that loads `engine/core.js`, `bank/bank.js`, `maps-geo.js` and `bank/maps.js` replaces
   `classic.html`. Don't rewrite the drawing to avoid the browser.
4. The proof: run the export again. **Every file under `party/public/maps/` and `party/data/maps-r/` must be byte
   for byte the same** (`git status` shows nothing). Also `cd party && npm test` (it includes `check-maps`).
5. Only then delete `classic.html`, and what only it used. Check each before deleting, with a search for who reads
   it: `index.html` (the old address's "Legacy" notice; ask the owner whether to keep it), `version.json`,
   `manifest.webmanifest`, the root icons, `host-imad.png`, the root `flags/` folder
   (`party/scripts/hash-flags.mjs` reads it: keep it). Leave the `/classic` redirect in `party/next.config.mjs`.
6. Update what says where things live: `CLAUDE.md` (its first paragraph), `README.md`, `docs/RUNBOOK.md`,
   `docs/CONTENT-RULES.md`, and the "bump the version" instructions if `version.json` goes.

Done when: the maps export is identical, the tests pass, and nothing in the repo mentions `classic.html` except
history.

### Phase 2: one copy of each game (about a day per game, one game per session)

Order: **Secret Stakes first, then Russian Roulette**, then ask the owner which is next. These two are the best
start because their screens are already shared (`party/components/Stakes.tsx`, `Roulette.tsx`) and their rules
already live in the engine (`engine/core.js`: `stakesBet`, `stakesResult`, `rouletteSpin`, `roulettePts`...).
What's doubled is the part in between: how each setup runs the game (start, bets or spin, answers, reveal, points,
next), in `party/lib/tvGame.ts` and in `party/lib/many/logic.ts`.

For each game:

1. **Read both copies fully before writing anything**, and write down every difference between them. Some are
   mistakes waiting to happen; many are deliberate (2 teams: the winner takes 2 points and a tie is settled; 3 to 8:
   places pay 10, 8, 6...; a new barrel every spin with 3 to 8 teams, one barrel all game with 2). Show the owner
   this list before changing code. Each deliberate difference stays, as a named option of the shared code, never as
   an "if 2 teams" buried in it.
2. Take the game's screens on the untouched code and keep them (above).
3. Write the shared piece next to the game's existing file (`party/lib/stakes.ts`, `party/lib/roulette.ts`): plain
   functions that take the game's state and a move and return what changed. No React, no database, no clocks read
   inside (the time is passed in), so the simulated nights can run them.
4. Switch **one** setup to the shared piece. Run everything. Commit. Then switch the other. Run everything. Commit.
   Then delete the two old copies. Run everything. Commit.
5. The proof, each time: `npm test` with no golden file changed, the game's screens identical to the copies you
   kept, types and lint clean.

Not in scope, even if tempting: merging `tvGame.ts` and `useTvMany.ts` themselves, merging `PhoneGame.tsx` and
`PhoneMany.tsx`, changing the saved state's shape, splitting `engine/core.js`. Those may come later, one at a time,
on the owner's word.

### When to stop and ask

- A golden night differs and you can't explain it in one sentence.
- The two copies disagree and you can't tell which behaviour the owner wants.
- A step needs a change to the database, the saved game's shape, How to Play, or anything players read.
- You've spent more than an hour on one failing step: revert it and report.

### The report

Short. What moved, where it lives now, the list of differences you found between the two copies (and which you
kept as options), anything you noticed but didn't fix. End with the one testing line `CLAUDE.md` asks for. Commit
locally; push only when the owner says "push".
