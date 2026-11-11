# Quiz Me Baby: Party

The game. The TV is the show (`/tv/CODE`) and the phones are the controllers (`/join`, `/room/CODE`); with
"Play without TV" one phone runs the game and everyone plays on their phones. Two teams with a host or without,
or 3 to 8 teams with a host. Next.js on Vercel, Supabase for the rooms; the rules are in
[`../engine/core.js`](../engine/core.js).

## Run it

```
cd party
npm install
npm run dev        # http://localhost:3000
```

The Supabase address and publishable key are built in (`lib/supabase.ts`); set
`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_KEY` to point at another project.

## Test it

```
npm test           # engine tests, bank/type/map checks, simulated nights (2 teams, 3 to 8, the lobby, chaos)
npm run screens    # every screen on the TV and on phones: off the edge, cut off, text on text
npm run typecheck && npm run lint
```

What each one covers, and how to save new traces: [`../docs/RUNBOOK.md`](../docs/RUNBOOK.md), "Everyday jobs".

## Deploy

Vercel builds this folder (Root Directory `party`); every push to `main` deploys. Setting everything up from
scratch (Supabase, Vercel, GitHub): [`../docs/RUNBOOK.md`](../docs/RUNBOOK.md).

## Where things are

- `app/`: the pages (home, `tv`, `join`, `room`, `settings`, `how-to-play`, `take-over`) and `api/` (`health`, `bank`)
- `components/`: the screens; `components/many/` for 3 to 8 teams
- `lib/`: the game on the TV (`tvGame.ts`, `tv/`), `lib/many/` for 3 to 8 teams
- `data/bank.json`: the bank with its answers (server only); `public/bank.json` has none
- `sim/`: the simulated nights and their saved traces (`golden/`); `sim/screens/`: the screen check
- `scripts/`: flag file names, the bank, type and map checks, the pins
