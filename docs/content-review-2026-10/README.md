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
