# QUIZ ME BABY

A party trivia game. The TV is the show, the phones are the controllers: two teams or 3 to 8, with a host or
without, with a TV or with phones only ("Play without TV" in the TV's lobby).

**Where it lives:** <https://quiz-me-baby-eta.vercel.app/>

## What's where

| | |
|---|---|
| `party/` | The game: Next.js on Vercel, Supabase for the rooms. How to run, test and deploy it: [`party/README.md`](party/README.md) |
| `engine/` | The rules: dealing, every move of the night, answer checking. Tests in `engine/*.test.js` |
| `bank/bank.js` | The question bank: every question, picture, map, flag, dish, airport, fact. `scripts/export-bank.js` writes Party's two bank files from it; `party/scripts/fetch-pins.mjs` and `fetch-sees.mjs` read their pictures' lists from it. Out of `classic.html` since 21 Nov 2026 |
| `bank/maps.js` | Draws the maps (`scripts/export-maps.js`, in a headless browser, from `scripts/maps-page.html`) |
| `maps-geo.js`, `maps-night.png`, `flags/` | The maps' borders and night lights (read by the maps export), the flags (read by `party/scripts/hash-flags.mjs`). The old one-screen app, `classic.html`, was deleted on 21 Nov 2026 (`/classic` lands on the home screen); it's in the git history |
| `index.html` | The old GitHub Pages address: a "Legacy" notice |
| `supabase/migrations/` | The database, one file per change; `docs/sql/` holds paste-ready copies |
| `docs/RUNBOOK.md` | Rebuilding the whole setup from scratch, and the everyday jobs (a question, a database change, the tests, the screen check) |
| `docs/CONTENT-RULES.md` | How questions, answers and every game's content are written |
| `docs/COMMERCIAL.md` | What to do before selling it, security included |
| `docs/V4-PLAN.md` | The October plan for Party (history) |
| `CLAUDE.md` | The standing rules for Claude |

Classic's old manual (its rules, phone layout and bank screen) is in the git history:
`git show f1fefc2:README.md`.
