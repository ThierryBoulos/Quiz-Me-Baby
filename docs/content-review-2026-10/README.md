# Content review, October 2026

Suggested additions to the question bank, waiting for Thierry's picks on the review page
(https://claude.ai/artifact/XmmQzGPMGX1hYJg6aTcFzi). Nothing in this folder is read by the app.

- `suggestions.json`: the 586 suggestions, numbered as on the page (standard questions for every theme
  and four new themes, Know the Host, Closest To Wins, Don't Say the Same as Me, Auction, dish,
  cocktail and map ideas, and sample legs for the two new game ideas).
- `numbers.json`: how each suggestion got its number, so a rebuild of the page never renumbers it.
- `new-games.md`, `new-games-legs.json`: the feasibility study for Drop the Pin and Guess the Airport,
  and their 40 sample legs.

Once the picks are in, the kept questions go into Classic's built-in bank (`index.html`), then
`node scripts/export-bank.js`, as the runbook says.

## Next, after the picks: four difficulty levels (agreed 22 Oct)

- Levels: Easy (everyone, kids included: "What does ASAP stand for?"), Medium (a normal adult),
  Hard (the well-read guest), Expert (the real buffs: "What does HARIBO stand for?"), named as in Guess the Flag.
- Setup: Easy, Medium and Hard ticked by default; "Mixed" means a mix of all four.
- Both teams always get the same level in a round, Change question included (done 22 Oct: a swap stays
  at the other team's level, or the nearest one when that level is used up).
- Expert comes last: the game uses up Easy, Medium and Hard in a theme before it deals Expert.
- Re-grade the whole bank (the current one and the kept suggestions) on the four levels; show Thierry
  only the questions that change level; use his "too hard / too easy" notes from the review page.
