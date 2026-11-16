# Live lines and the server clock (16 Nov 2026)

The owner's yes, 16 Nov: make taps and screens arrive sooner, and make every timer in the room show the same
second. Keep the old way handy, in case it breaks or uses too much of Supabase for nothing.

## What changed

**Before:** a tap went phone → database (Ireland) → TV, and the TV's new screen went TV → database → phones. Both
trips go through the database, about a second in all from the Gulf.

**Now:** the same, plus a faster copy on two "live lines" per room (Supabase Realtime, private channels):

- **The screen line** (`pub:<code>`): the TV, or the phone running a game with no TV, sends each new screen straight
  to the phones. Only that device may send on it; only the room's players and its TV hear it.
- **The tap line** (`act:<code>`): the database sends each tap to the TV as it's written, so who sent it is always
  the signed-in phone. No phone sends on it; only the room's TV hears it.
- **The server's clock** (`qmb_now()`): the TV and every phone ask the server its time and set their timers by it.

Whichever copy of a screen or a tap lands first is used; the second is nothing. If a line is slow or down, the
database's copy comes as before. Every setup: 2 teams with and without a host, 3 to 8 teams, a TV or none.

## The files

- Database: `supabase/migrations/20261116_live_lines.sql` (run 16 Nov), copy in `docs/sql/2026-11-16-apply.sql`.
- Game: `party/lib/liveLines.ts` (the lines and the count), `party/lib/room.ts` (phones hear the screen line),
  `party/lib/tv/useInbox.ts` (the TV hears the tap line), `party/lib/tvGame.ts` and `party/lib/many/useTvMany.ts`
  (the TVs send each screen, and their clock), `party/components/Clock.tsx` (the server clock).
- Tests: the simulator has the lines (`sim/fakeSupabase.js`), with nights that lose half the line's copies or make
  the database's copies 3 s late (`sim/weird.mjs`, 11 to 13).

## Going back

1. **Game only, in a minute:** set `LIVE_LINES = false` in `party/lib/liveLines.ts`, test, push. The game is then
   exactly as it was before 16 Nov (database only, the old clock).
2. **The database too:** paste `docs/sql/2026-11-16-rollback.sql` into Supabase > SQL editor and run it. Do step 1
   first (or together): the game copes without the lines, but there's no point leaving it asking for them.

## Is it worth it? (the count)

Each game counts how much sooner the line was than the database:

- the TV writes its count for the taps into the room (`rooms.state.lines`: `n` taps matched, `ms` the median ms
  the line was sooner, `p10`/`p90`, and how many came first by each way);
- each phone sends its count for the screens once, at the end of a game (the room's log, kind `count`, `lines`).

Read them after a real game. Rough rule: if the screens' median is under about 150 ms sooner, the line isn't worth
its extra realtime use; go back (above). The extra use is noted in `docs/COMMERCIAL.md`, to check before launch.
