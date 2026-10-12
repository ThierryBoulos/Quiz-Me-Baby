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

Next: the game itself on the TV, driven by the engine, with the host's phone judging (step 2b), then captains' answers and the buzzer (step 3).
