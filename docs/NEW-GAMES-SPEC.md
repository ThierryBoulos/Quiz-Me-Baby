# Two new mini-games: Secret Stakes and What Do You See?

The owner's brief of 11 Nov 2026, written up as build instructions. Read `CLAUDE.md` first: everything in it
applies (every setup, the owner's wording, content rules, push only on "push", screens fit, tests).

**Order of work:** Part A complete (built, tested, committed), then Part B's game with 12 pictures, then Part B's
full content. Commit after each. Do not push. If something here can't work as written, don't guess: build the
rest, and say exactly what and why in the report.

**The model to copy is Russian Roulette.** It is the newest game, it runs in every setup, and both new games
share its shape (every team answers at once on its own phone). `git show --stat d542441` lists every file a new
game touches; `party/lib/roulette.ts` and `party/components/Roulette.tsx` are the pattern for a game's own
module and screens.

---

## Part A. Secret Stakes

Working name "Secret Stakes" (key `stakes`). The night's last game: teams bet on themselves, in secret.

### A1. Rules (the same for 2 teams and 3 to 8, host or no host, TV or no TV)

1. **Always the last game of the night**, after the last round and after the Battle of the Captains (which stays
   the last game before it). It isn't a best-of: no "decided early" question, no tie-break of its own. A night
   still level after it goes to sudden death, as always.
2. **Three rounds.** Each round shows **3 themes**; the three rounds use 9 different themes.
3. **The pick (20 s, secret).** Each captain picks one theme and one level on their phone, then locks it in:
   - Easy: the safe bet. Right or wrong, 0 points.
   - Medium: win or lose **U** points. Hard: **2U**. Expert: **3U**.
   - No pick by time-up: Easy on the first theme.
   - Nobody else sees a pick. The TV and the other phones only show who has locked in.
4. **U, the size of a bet,** is worked out once, when the game starts, from the scoreboard, so it is in
   proportion in every setup: `U = max(1, round(top total / 10))`, and from 10 up, rounded to the nearest 5.
   Two teams at 12 and 9: 1, 2, 3. Eight teams with the leader on 84: 8, 16, 24. A leader on 130: 15, 30, 45.
   The buttons show the real numbers ("Easy 0", "Hard ±16"). Keep the 10 as one named number in the engine, so
   the owner can make the bets bigger or smaller later.
5. **The question (45 s).** Each team gets the question of its theme and level, on its phones only, and the
   captain types the answer (teammates suggest, as in a round). Two teams that picked the same theme and level
   get the same question. The TV shows no theme, level or question yet: only the clock and who has answered.
6. **The reveal, one team at a time, from last place up** (by total before the round): its theme, its bet, its
   answer, RIGHT or WRONG, and the points going on or off its **night total**. Right: plus the bet. Wrong or no
   answer: minus the bet. A total never goes below 0.
7. **Points go straight to the night's totals.** There is no "this game" tally, no winner's bonus (2 teams), no
   place points (3 to 8). After round 3: a summary of what each team won or lost, then the final.
8. **Who judges:** exactly as Russian Roulette in each setup. No host: the app checks the typed answer, and a
   captain can contest a call. With a host: the app's call is shown and the host can change it before Next.
9. **Who moves it on:** as every game (the host; with no host, the lead captain).
10. **Change question** (before anyone has answered): a new set of three themes for the round, picks cleared.
11. **Pause** freezes the pick clock and the answer clock.

### A2. Dealing (engine/core.js)

- For each round: 3 themes, and for each theme one question at each of the four levels (12 a round, 36 a game,
  plus one spare round for Change question).
- Themes: the broad ones (`ROULETTE_THEMES`) and any other theme the night picked; never Know the Host, never the
  host's own themes. Sexy Time and Lebanon only if the night picked them.
- Follow the dealing rules of 11 Nov: unplayed first, then played; never a question already in the night or one
  that clashes with it (never-together). A level's question is always of that level (a bet must be honest): pick
  themes that can fill all four levels; only when none can, a played question of that level.
- **Only questions a team actually got count as played** (a theme or level nobody picked isn't used up).

### A3. Screens

- **Intro:** the rules card, as every game. **Pick:** TV: the three themes large, "Place your bets", the clock, a
  tick per team as it locks in. Captain's phone: the three themes, then the four levels with their numbers, then
  Lock in (no changing after). Other players: the three themes and "Your captain is choosing".
- **Question:** phones: the team's own question, its bet, the clock, the answer box. TV: "Bets are in", the clock,
  a tick per team.
- **Reveal:** one row per team, appearing one by one from last place up; the points fly to the totals in the top
  bar. 7 or 8 teams: two columns, as Roulette's reveal. Rows all the same size.
- **Summary:** each team's result for the game ("+16", "−8", "0"), then Next to the final.
- The top bar shows the night's totals throughout (there is no game tally to show).
- Picks are hidden in the interface only (they travel in the room's public state, and other teams' phones never
  draw them). Add a todo to `docs/COMMERCIAL.md`, section 2: "Secret Stakes picks: keep them off other teams'
  phones entirely (a private row per team)".

### A4. Setup, timers, rules text

- A toggle in both Setups (2 teams, 3 to 8), listed last, with one line under it: "The night's last game."
- Timers (Settings and the no-host Timers sheet): pick 20 s, answer 45 s.
- **How to Play** (`party/components/Rules.tsx`) is the owner's text. **Change it only if the prompt that started
  you says "How to Play wording: approved".** If it doesn't, leave the file alone and list these in the report.
  1. A new entry, after Battle of the Captains:
     > **Secret Stakes** Always the last game of the night, played in 3 rounds. Each round shows 3 themes. Each
     > captain has 20 seconds to secretly pick a theme and a level. Easy is the safe bet: it wins nothing and
     > loses nothing. Medium, Hard and Expert are worth more, and your phone shows how much. You then have 45
     > seconds to type your answer. Get it right and you win your bet; get it wrong and you lose it, straight
     > from your total score. Nobody sees what the others bet until the reveal.
  2. As it is: "Each mini-game is worth 2 points to the winner." To: "Each mini-game is worth 2 points to the
     winner, except Secret Stakes."
  3. In Battle of the Captains, as it is: "This is always the last mini-game." To: "This is always the last
     mini-game before Secret Stakes."

---

## Part B. What Do You See?

The owner's name (key `see`). One picture at a time, unreadable at first and clearing as the clock runs.

### B1. Rules (the same in every setup unless said)

> **Changed 12 Nov (the owner): it's a buzzer game.** Rules 3 and 4 below are as first built; this is how it plays
> now, in every setup. **Anyone on a team hits BUZZ** (the players too; the TV says who): the picture and its clock
> stop where they are, and the team has 10 seconds, fixed, to **say the answer out loud while its captain types it**
> (the app checks what's typed, so nobody has to judge; with a host, they can still change the call at the reveal). Right: the picture is theirs and it ends. Wrong, or nothing
> typed in the 10 seconds: that team is out of this picture, the clock goes on and another team can buzz. Everyone
> out, or the clock run out: nobody gets it. 2 teams: best of 7, as before. 3 to 8 teams: one team gets a picture
> and scores what a 1st place scores there (as many points as there are teams), so teams level on pictures share a
> place, as in every 3 to 8 game. The 10 seconds are `SEE_TYPE` in `party/lib/see.ts`. Guess the Cocktail or Dish
> keeps its own system with 3 to 8 teams (every team types, the faster right answer scores more): the owner, 12 Nov.

1. **One game, three kinds of picture mixed together**, no choosing between them in Setup:
   - **Faces** (famous people) and **Logos**: start blurred and sharpen.
   - **Close-ups** (dishes and food, animals, objects, places): start zoomed right in and zoom out.
2. **20 seconds a picture.** The picture is fully clear for the last 3 seconds.
3. **One guess per team per picture,** typed by the captain (teammates suggest). A wrong guess and the team is out
   of that picture. So: guess early while it's a blur, or wait and risk being beaten.
4. **Scoring. 7 pictures in every setup.** 2 teams: the fastest right answer takes the picture; the team with
   more pictures wins the game's 2 points, with the same "decided early" question and tie handling as Guess the
   Flag (add it to `LEGGED` in `engine/core.js`). 3 to 8 teams: the fastest right answer scores most and a wrong
   one nothing, exactly as the Cocktail or Dish scores there, then the game's places pay the night as every 3 to
   8 game does.
5. **Who judges, who moves on, contests, Change question, Pause:** exactly as Guess the Flag in each setup. Pause
   freezes the picture where it is.
6. **Where the picture shows:** wherever Guess the Flag shows the flag in that setup (TV; phones with no TV).
   Every screen clears the picture at the same moment: drive it from the TV's clock (the question's deadline),
   as Roulette's spin is.
7. When the answer is in or the clock is out: the clear picture, the answer, who got it and how fast.
8. With animations switched off in Settings the picture still clears (it is the game, as the Roulette spin is):
   in 5 plain steps.
9. **How it clears.** In steps (about 12 over the clock, each easing into the next), never a heavy continuous
   effect: it has to run smoothly on a phone. The blur is sized from the picture's width, so the TV and a phone
   show the same thing at the same moment. If the browser's blur is slow on a phone-size screen, draw the picture
   small and scale it up instead. The zoom starts on the picture's focus point and ends on the whole picture.
   The first step must be a real puzzle: check a few of each kind by eye.

### B2. Setup

- One toggle in both Setups, and one **Level** row (Easy, Medium, Hard; all three on by default), as the other
  picture games have. Nothing else.
- For the host only, inside Advanced: "Pictures: Faces · Logos · Close-ups", all on, so a kind can be left out.
- A game's pictures: the kinds that are on in near-equal shares (7 pictures: 2 faces, 2 logos, 3 close-ups),
  shuffled, no two of the same kind in a row where it can be helped, an easiest one first (as flags).
  Unplayed first, then played; never-together respected.
- **How to Play**, the owner's text: the same condition as A4 (only if the prompt says "How to Play wording:
  approved"). A new entry, after Guess the Cocktail or Dish:
  > **What Do You See?** A picture appears blurred or zoomed right in, and gets clearer over 20 seconds: a famous
  > face, a logo, or a close-up of a dish, an animal, an object or a place. Type who or what it is. Each team
  > gets one guess per picture. The fastest team to answer wins. Best of 7.

### B3. Pictures: how they're stored

Copy Drop the Pin's way end to end (`const PINS` in `classic.html`, `scripts/export-bank.js`,
`party/scripts/fetch-pins.mjs`, `party/public/pins/CREDITS.md`):

- A catalogue `const SEES` in `classic.html`, one row a picture: key, answer, kind (`face`, `logo`, `close`),
  level, effect (`blur` or `zoom`), for a zoom its focus point (x and y in %, and the starting zoom, 4 to 8
  times), the file's hashed name, the author, the licence, the source page. Ids `see:<key>`.
- `party/scripts/fetch-sees.mjs`: downloads each file, writes a TV size (1280 wide; close-ups 1920 wide, from an
  original at least 3000 wide, so the zoomed-in start stays sharp) and a phone size (640 wide; close-ups 960)
  under names that don't say what they show, into `party/public/see/`, and writes `CREDITS.md` beside them. One
  file every 3 seconds, the same User-Agent as `fetch-pins.mjs`. Logos: on a plain light card, the symbol only.
- Accepted answers in `party/data/accept.json` (short names, usual spellings: "Messi", "Leo Messi", "CR7",
  "McDonalds", "Mercedes").
- The checker (`party/scripts/check-bank.mjs`) knows the new type: every row has its two files, a level, a kind.
- Bump the bank's version as `docs/CONTENT-RULES.md` section 8 says; add a "What Do You See?" entry to its
  section 7 (the rules below).

### B4. Pictures: what to make (120)

The owner's ruling, 11 Nov: any picture or logo may be used; one credit and removal line covers them (B5).
Take each file from Wikimedia Commons first, so it has an author and a licence to credit; a logo Commons doesn't
have, from its English Wikipedia file page, credited to the brand. If the network refuses Wikimedia, don't look
for another source: build and test the game with a dozen of the Drop the Pin photos as stand-ins (marked as
test pictures, not for players), and say so in the report.

**Rules for every picture**
- Nothing in the picture gives the answer away in writing: no name on a shirt, a caption, a sign or a logo's
  wordmark. Logos: the symbol with no name (the Apple apple, the Nike swoosh), never a wordmark.
- Faces: one person, face clear, a recent well-known look, in their public role (on stage, at a match, on a red
  carpet). Close-ups: the starting view must be a real puzzle and the full picture unmistakable.
- Level is how many people at a party would get it (rule 3 of the content rules): when unsure, one level easier.
- Don't use something that is already an answer elsewhere in the bank without a never-together group: a dish
  that is a recipe in the Cocktail or Dish game, a landmark in Drop the Pin, a car badge asked in a question.

**40 faces** (swap any with no good free photo for someone as famous; keep the spread):
Lionel Messi, Cristiano Ronaldo, Zinedine Zidane, Mohamed Salah, Michael Jordan, LeBron James, Roger Federer,
Serena Williams, Usain Bolt, Beyoncé, Rihanna, Shakira, Taylor Swift, Adele, Lady Gaga, Ed Sheeran, Drake,
Eminem, Fairuz, Nancy Ajram, Leonardo DiCaprio, Brad Pitt, Angelina Jolie, Tom Cruise, Dwayne Johnson,
Will Smith, Keanu Reeves, Morgan Freeman, Margot Robbie, Zendaya, Emma Watson, Jackie Chan, Barack Obama,
Donald Trump, Queen Elizabeth II, Elon Musk, Bill Gates, Steve Jobs, Oprah Winfrey, Albert Einstein.

**40 logos** (symbol only): Apple, Nike, McDonald's, Starbucks, Mercedes-Benz, BMW, Audi, Toyota, Volkswagen,
Ferrari, Tesla, Renault, Peugeot, Mitsubishi, Adidas, Puma, Lacoste, Chanel, Rolex, Shell, Pepsi, Red Bull,
Instagram, WhatsApp, Snapchat, TikTok, Spotify, Netflix, YouTube, Twitter (the bird), Airbnb, Amazon, Google,
Windows, PlayStation, Xbox, Android, Mastercard, Michelin, the Olympic rings.

**40 close-ups:** 10 food (pizza, sushi, croissant, popcorn, strawberry, kiwi, pineapple, pomegranate, broccoli,
coffee beans); 12 animals (zebra, giraffe, peacock, chameleon, flamingo, tiger, elephant, octopus, owl,
hedgehog, parrot, butterfly); 12 objects (toothbrush, zip, tennis ball, piano keys, guitar strings, matchstick,
pencil, keyboard, honeycomb, dice, CD, bubble wrap); 6 places not in Drop the Pin (a few famous ones; add a
never-together group if any is).

Aim for about a third at each level in every kind.

**Showing them to the owner** (rule 0 of the content rules): publish a review page with every picture, numbered:
the picture as it ends (clear), how it starts, its answer, the accepted answers, its kind and level, its credit,
with Keep / Leave out on each, as the Open Trivia Picks page does (the phone-size files, inside the page). The pictures go into the game now so it can be
played and tested; say in the report that they wait for the owner's verdict by number.

### B5. The credit line

In the Copyright window (`party/components/Privacy.tsx`), after the Drop the Pin credits, add:

> **What Do You See? pictures** from Wikimedia Commons, each under the licence named in the picture credits.
> Quiz Me Baby isn't associated with any brand, celebrity or person shown. To have a picture removed, write to
> Thierryboulos@hotmail.com.

with "picture credits" linking to `/see/CREDITS.md`. In the same window add one sentence: "Some questions are
adapted from Open Trivia DB (opentdb.com)."

---

## Part C. For both games: the checklist

1. **Every setup:** 2 teams with a host, 2 teams with no host, 3 to 8 teams; each with a TV and with no TV. Say
   in the report anything that differs between them.
2. **Engine tests** (`engine/*.test.js`): the deal, every move, the scoring, the edge cases (no pick, no answer,
   a total that would go below 0, same theme and level picked twice, one guess then out, both right).
3. **Simulated nights:** teach the simulator's bots both games (`party/sim/night.jsx`, `party/sim/many.mjs`); add
   nights with and without a host; save their traces. `cd party && npm test` must pass.
4. **The room bots** (`party/sim/bots/run.mjs`): captains pick and answer, the bot host runs both games. Don't
   test on the live site.
5. **The screen check:** add both games to its nights (`party/sim/screens/two.mjs`, `many.ts`) and run only their
   screens: `npm run screens -- tv "stakes|see"` and `npm run screens -- phones "stakes|see"`. Fix what it flags;
   look at the pictures yourself (8 teams on the TV, a 360-wide phone, a phone held sideways).
6. **Also touched by a new game:** the night's intro, the end's chart and awards, the Timers sheets, the thin-bank
   note, the host's question picker, `docs/CONTENT-RULES.md`.
7. Commit after each part with a plain message. **Do not push.**
8. **The report**, in plain words, short: what was built, how it was tested and what the tests showed, anything
   that differs between setups, anything not done and why, whether How to Play was changed, and what the owner
   has to decide (the pictures by number, the size of the bets).
