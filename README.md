# QUIZ ME BABY

A party trivia game. The TV is the show, the phones are the controllers: two teams or 3 to 8, with a host or
without, with a TV or with phones only ("Play without TV" in the TV's lobby).

**Where it lives:** <https://quiz-me-baby-eta.vercel.app/>

## What's where

| | |
|---|---|
| `party/` | The game: Next.js on Vercel, Supabase for the rooms. How to run, test and deploy it: [`party/README.md`](party/README.md) |
| `engine/` | The rules: dealing, every move of the night, answer checking. Tests in `engine/*.test.js` |
| `classic.html` | The old one-screen app, retired as a game on 3 Nov 2026 (`/classic` lands on the home screen). It stays only as the source of the question bank, maps and pins: `scripts/export-bank.js`, `scripts/export-maps.js`, `party/scripts/fetch-pins.mjs` |
| `maps-geo.js`, `flags/`, `version.json`, the icons | Classic's files, read by its exports (and `flags/` by `party/scripts/hash-flags.mjs`) |
| `index.html` | The old GitHub Pages address: a "Legacy" notice |
| `supabase/migrations/` | The database, one file per change; `docs/sql/` holds paste-ready copies |
| `docs/RUNBOOK.md` | Rebuilding the whole setup from scratch, and the everyday jobs (a question, a database change, the tests, the screen check) |
| `docs/CONTENT-RULES.md` | How questions, answers and every game's content are written |
| `docs/COMMERCIAL.md` | What to do before selling it, security included |
| `docs/V4-PLAN.md` | The October plan for Party (history) |
| `CLAUDE.md` | The standing rules for Claude |

Classic's old manual (its rules, phone layout and bank screen) is in the git history:
`git show f1fefc2:README.md`.
