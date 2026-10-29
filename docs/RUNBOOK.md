# Quiz Me Baby: rebuilding the setup from scratch

About an hour, start to finish. Everything the game needs is in this repository
plus three free accounts: GitHub, Vercel and Supabase.

## What runs where

| Piece | Where | What it is |
|---|---|---|
| Classic | `index.html` at the root (one screen, a host runs it) | Also served at `/classic` on the Party site |
| Party | `party/` (Next.js) on Vercel | The TV (`/tv/CODE`), the phones (`/join`, `/room/CODE`), `/api/health`, `/api/bank` |
| Game server | Supabase project (EU, Ireland) | Rooms, members, the action log, secrets; anonymous sign-ins |
| Shared rules | `engine/core.js` | Used by Classic and Party alike; tests in `engine/*.test.js` |
| Question bank | Built into Classic (`index.html`); exported to `party/data/bank.json` (full, server only) and `party/public/bank.json` (no answers) by `node scripts/export-bank.js` | |

## 1. Supabase (15 min)

1. Create a project (region: EU West / Ireland). Free plan is fine.
2. **Authentication → Sign In / Providers → Anonymous sign-ins: on.**
3. **Authentication → Rate limits → Anonymous sign-ins: 300 per hour** (everyone at a
   party shares one internet address; the default 30 locks people out).
4. **SQL Editor**: run every file in `supabase/migrations/` in name order:
   `20261012_party_rooms.sql`, `20261012b_party_helpers_private.sql`,
   `20261012c_party_snaked_conventions.sql`, `20261012d_party_join.sql`,
   `20261012e_party_rejoin_cleanup.sql`, `20261016_wave1_join.sql`,
   `20261016b_wave1_cleanup.sql` (it turns on pg_cron and schedules the nightly
   clean-up at 04:17 UTC), `20261016c_wave2_privacy.sql`,
   `20261016d_wave2_lobby_rejoin.sql`.
5. **Database → Publications → supabase_realtime**: the tables `rooms`, `members`,
   `actions` and `secrets` must be in it (the first migration adds them; check).
6. Copy the project URL and the publishable key (Settings → API).

## 2. The code (5 min)

If the Supabase project is new, put its URL and publishable key in
`party/lib/supabase.ts` (the fallbacks at the top) and in `party/app/api/bank/route.ts`,
or set them on Vercel as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_KEY`.
Classic needs nothing: it runs on its own.

## 3. Vercel (10 min)

1. New project from the GitHub repository. **Root directory: `party`.** Framework: Next.js
   (detected). Build command and output: the defaults.
2. Environment variables (all optional):
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_KEY`: a different Supabase project.
   - `NEXT_PUBLIC_SITE_URL`: the site's address, for the WhatsApp preview picture
     (defaults to `https://quiz-me-baby-eta.vercel.app`).
   - `QMB_FLAG_KEY`: the key that hides flag file names (any string). If you set it,
     every deploy uses it for both the files and `/api/bank`.
3. Deploy. Every push to `main` deploys again. A TV or phone left open across a
   deploy reloads itself at the next calm screen.
4. Check `https://<site>/api/health` answers `{"ok":true,"supabase":"ok",…}`.

## 4. GitHub (5 min)

- `.github/workflows/check.yml` runs the types, the lint rules, the engine tests and
  the question-bank checker on every push.
- `.github/workflows/ping.yml` calls `/api/health` every 30 minutes, which keeps a
  Free Supabase project from pausing after a quiet week, and once a day asks for
  `?deep=1` (a sign-in and one RPC, as a phone does). **Change the URL in it** if
  the site's address changes. A red run emails the repository owner. GitHub switches
  a schedule off after 60 days without a push, so `party/vercel.json` runs the deep
  check once a day from Vercel as well.
- `party/deploy.json`: `"urgent": true` makes open TVs and phones reload at the next
  calm moment even mid-night (a changed save format); otherwise a new build waits for
  the night to end. Set it back to false in the next commit.
- The TV leaves its last errors in `rooms.state.errs`; rooms are kept 3 days.

## 5. Try it (10 min)

1. Open the site on a laptop or TV: **Create game**.
2. Two phones: scan the QR, pick Team A and Team B, **Make me captain** on each.
3. Team A's captain taps **Start the game**.
4. Play a round; check the TV moves on, scores, and the end screen's **Exit**.

## Everyday jobs

- **Change a question:** edit Classic's built-in bank in `index.html`, bump `BUILD.v`
  and `SEED_VERSION` (and `version.json`), then `node scripts/export-bank.js`
  (needs Playwright's Chromium) and `cd party && npm test`. Commit all of it.
- **Something broke on the night:** `/api/health` first. Then Supabase → Logs.
  A paused Free project: Supabase dashboard → the project → **Resume**.
- **Database change:** add a new file in `supabase/migrations/` (never edit an old one)
  and run it in the SQL editor.
- **Change how the TV plays (`party/lib/tvGame.ts`, `party/lib/tv/`):** `cd party && npm run sim`
  plays twelve whole nights in a second and compares each with its saved trace in
  `party/sim/golden`. A night that differs when it shouldn't is a bug; when the change is
  meant to alter play, look at the difference (`node sim/run.mjs <n>` prints a night) and
  save the new traces with `node sim/run.mjs --update`. Commit them with the change.
