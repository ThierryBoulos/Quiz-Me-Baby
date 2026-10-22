# Quiz Me Baby — Party (v4, in progress)

The TV is the show, phones are the controllers. Next.js + Supabase, deployed on Vercel.
The plan is in [`../docs/V4-PLAN.md`](../docs/V4-PLAN.md); the shared rules are in [`../engine/core.js`](../engine/core.js).

## Run it

```
cd party
npm install
npm run dev        # http://localhost:3000
```

The Supabase address and publishable key are built in (`lib/supabase.ts`); set
`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_KEY` to point at another project.

## Deploy on Vercel

Import the GitHub repo and set **Root Directory: `party`**. Nothing else is needed.

## What works so far (step 2a: the lobby)

- **PLAY** on the device facing the room opens a room: a 4-character code (no 0/O/1/I/L) and a QR code on the TV.
- **Join** on a phone (SNAKED's screen): room code, name (12 max, unique — a taken name offers "Rami 2?"), a face.
- **Pick your side** — Team A or B — or **I'm the host** (one per room; taken → "Thierry is the host").
- **Make me captain** — one per team; teammates then see "Rami is your captain". The captain **names the team**, and the name shows on the TV and every phone.
- **The host's phone** lists both teams with faces and captains, and can move a player across.
- **Start the game**: the host's phone, or with no host Team A's captain, once each team has a captain. The TV decides the mode from who joined: hosted, or no host.
- Your phone remembers you: reopen the page and you're back in your seat.

Done: the hosted game on the TV (step 2b); captains type, buzz and lock in numbers, players suggest, and Closest To Wins, Guess the Flag and Cocktail or Dish run in Party (step 3); Party with no host, where the app checks and the other captain can overrule, plus Guess the Map and The Auction (step 4); Classic's sound effects on the TV (no voice), rejoining from a new phone with the same name, joining mid-game, changing captain mid-game, and Don't Say the Same as Me and Battle of the Captains (step 5). Every Classic mini-game now runs in Party. Party has two of its own (22 Oct): **Drop the Pin** (a landmark's photo; each captain drops a pin on a world map on their phone, zooming in as far as a street in Paris; the nearer pin by the great circle takes the leg) and **Guess the Airport** (a drawn departures board; captains type the airport, and the app checks it as it does flags). Their photos and map are ours, in `public/pins/` (`scripts/fetch-pins.mjs`, `scripts/export-pin-world.mjs`; credits in `public/pins/CREDITS.md`).

## Deploying

Vercel builds this folder (Root Directory `party`). Pushes to `main` are
meant to deploy automatically through Vercel's GitHub app; if a push doesn't
show up, redeploy from the Vercel dashboard (Deployments → Redeploy) or
use a Deploy Hook.
