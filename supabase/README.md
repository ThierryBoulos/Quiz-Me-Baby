# Supabase — Party mode backend

Project: **Quiz Me Baby** (`ryefabglqhdobqtlmkfx`, eu-west-1).
URL: https://ryefabglqhdobqtlmkfx.supabase.co

The migrations in `migrations/` are applied in name order. They create:

| Table | What | Who can read | Who can write |
|---|---|---|---|
| `rooms` | 4-letter code, mode, public game state | anyone signed in (to join by code) | the room's TV |
| `members` | name, team, role (player / captain / host) | everyone in the room | yourself via `qmb_update_me` / `qmb_claim`; the TV and host directly |
| `secrets` | the current answers | **the TV and the host only** | the TV |
| `actions` | buzzes, answers, suggestions… stamped with the server clock | TV + host; captains see their team's suggestions; you see your own | members, as themselves |

RPCs: `qmb_create_room()` → code, `qmb_claim(room, 'captain'|'host'|'player')`, `qmb_update_me(room, name, team)`.
One captain per team and one host per room are enforced by unique indexes.

Everyone signs in **anonymously** — the "Allow anonymous sign-ins" switch must be on
(Dashboard → Authentication → Sign In / Providers).

Checked on 12 Oct 2026 with simulated users: a captain and players cannot read the
answers, the host can; a second "Make me captain" on the same team gets "Rami is your
captain"; a player cannot make themselves host by writing to the table; someone outside
the room sees nobody in it.
