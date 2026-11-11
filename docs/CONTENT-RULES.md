# Content rules: how to write for Quiz Me Baby

The owner's rulings from the content reviews (October rounds 1–2, the 4–5 Nov 2026 review), written down so new
content follows them the first time. Read this before writing or changing anything in the bank (`classic.html`).
When the owner rules on something new, add it here.

---

## 0. How to show the owner new content (always)

The owner's ruling, 5 Nov 2026: new or changed content is **never** given as a summary or a table. Every item is
shown **numbered and written out exactly as it will appear**, so the owner can accept, reject or comment by number:

- the level (and theme or game);
- the question, word for word;
- the answer;
- the accepted answers (everything added in `accept.json`; for a map, the ideas that count);
- the notes, word for word (or "none");
- for Majority Rules, **all four options** and which one is right;
- for a map: title, answer, notes, and the categories with their colours;
- any "never on the same night" group it joins.

Then wait for the owner's verdict; rejected items come out, comments are applied, and only then is it final.

## 1. Questions

- **Quote style: single quotes** for a named word or title inside a question: `What does 'ATM' stand for?`,
  `Which dog is the 'Doge' meme?`. (Double quotes were the minority; all questions were changed to single, 5 Nov.)
  Notes may quote speech with double quotes.
- **End every question with its mark**: `?` for a question, `.` for an instruction ("Name the four cities…").
- **No spaced hyphen inside a sentence** (`… Units - How many…`): two sentences, or a full stop.
- **Never name the answer, or another name for it, in the question.** "Which country was known as Burma until
  1989?" must not accept "Burma" (the checker now refuses a name the question itself says, `givesItAway`). Watch
  for give-away words: "toy for anal play" → "designed for the back door"; "Ash Ketchum's name" is fine when the
  answer is the Japanese one.
- **Say exactly what's wanted.** Ask for the thing the answer is: "What is the medical term for a foot fetish?",
  not "What is the fetish for feet called?". "The host's school" → "the host's secondary school". "To play or to
  watch" invites two answers → "(playing or watching)".
- **Anything that changes goes in the question with its year**: "As of 2025, …", "The members of ASEAN in 2026",
  "Which 2018 game … became a lockdown hit in 2020?". Prefer wording that stays true: "Michelin-starred", not
  "two-Michelin-star" (stars come and go).
- **Records: say which record.** "fastest serve ever recorded, ratified or not", "heaviest blue whale ever
  recorded", "official language" only (no "most speakers" side facts unless asked).
- **No question without a source.** If it can't be sourced, it goes (Lebanon's "national dish" was deleted).
- **Disputed counts follow the owner's own check**: My Humps "hump" 37, Boom Boom Pow "boom" 111, Human
  "human" 9. Notes then say "Counted from the album version." (never "by the owner": notes are shown on the TV).
- **A trick question can stay a trick** when it's fair and the notes explain it (first animal in space: fruit
  flies).

## 2. Answers and what else counts

- **One answer per row, alternatives written `X / Y`**, never `X or Y` (the checker splits on ` / `):
  `Ping / Hua Jun`, `Liechtenstein / Uzbekistan`.
- **Accept the forms people really type**, in `party/data/accept.json`:
  - common short forms and spellings: "Polyam", "Glute max", "Gluteal", "Jbeil", "O-", "AB+", "Montaigu"
    (Romeo's family in French), "Stabiae" (also destroyed by Vesuvius);
  - slang written out in full: "Grandma I would like to fuck", "Mother I would like to fuck";
  - the city for an airport whose city has only that airport (JFK → "New York").
- **Don't accept what's too loose**: "O" for O negative, "Weasley" for one Weasley, "Burger" for Cheeseburger,
  a different acronym (GMILF for GILF). Keep the original-language answer when that is the answer (RSVP is French:
  no English additions).
- **Where the stored answers live** (all keyed by question id, see §8):
  - `byId[id]`: extra answers for one question;
  - `byAnswer[answer]`: other names of an answer, shared by every question with that answer (countries, flags);
  - `notById[id]`: a shared name that must *not* count here ("Tony Stark" isn't the film Iron Man);
  - `byPool[sayPromptId][word]`: a Say list's own other names, so a shared one doesn't leak ("Purple" isn't the
    flower Violet; "Remus" isn't the flower Lupin);
  - `rankById[id]`: a ranking's items in the right order, each with its names;
  - `someOf[id]`: "any N of these" ("Name at least two of the colours": any two of blue, black, white, gold);
  - `mapKeys[answer]`: the ideas a map answer needs.
- **The checker already handles** (no need to add these): typos by length, number words ("twelve" = 12), ordinals
  and small Roman numerals ("6th" = "sixth", "the Second" = "II"), "Mount / River / Lake / Mountains / Range"
  optional, "the" at the start, blood types (O-, AB+), symbols read as words (÷ divide, € euro, + plus), two-part
  answers in any order ("Canada and USA"), an airport with its city in front or behind ("Paris CDG").
  It refuses: one country for another, a number for a different number, letters for an answer that has a number.

## 3. Levels (Easy, Medium, Hard, Expert)

- The level is how many people at a party would know it, not how obscure it feels to write.
- The owner rates famous names and famous facts lower than a writer tends to: The Scream, Lady Gaga, Rihanna's
  real name, the Mayflower, Lee Harvey Oswald, Carter before Reagan → Hard, not Expert; Nirvana, the crab
  (Cancer), miso → Medium; Vatican and Egypt flags → Easy; Texas flag → Hard. When unsure, go one level easier.
- In a theme, a pair (`use_with`) is dealt at one level: changing one question's level can leave it without a
  partner (it then pairs loosely at its level, which is fine).

## 4. Guess the Cocktail or Dish

- **The give-away comes last.** The ingredient that names it (tomato juice for a Bloody Mary, cheddar for a
  cheeseburger, coconut cream for a piña colada, grenadine for a tequila sunrise) is the final step.
- **No step prints the answer**: not "(or biryani masala)", not "rolled inside out" for a California *roll*.
- **No brand names** in ingredients ("Vodka", not "Smirnoff vodka"); prefer the generic ("Sparkling wine", not
  "Prosecco", so nobody argues).
- **No empty steps** ("Garnish — None") and no serving notes as a step ("To serve — …").
- **Two near-twins never both in the bank** if one reads like the other (Black and White Russian: keep the one at
  the level with fewer drinks).
- If the answer contains a word the steps show ("Cheeseburger"), only the full answer counts.

## 5. Don't Say the Same as Me (Say lists)

- **Order = how common**: the most-given answer first. The app's secret word is drawn from the **top six**, so
  only famous answers go there; regional or tricky ones (England, Scotland… in "a country in Europe") sit below.
- **Look-alike words**: put the less common one *before* the one it could be read as, or it is never found
  ("Lute" before "Flute", "Chery" before "Chevrolet").
- **Make every list complete enough** for eight teams: add the obvious ones people type (Pluto for planets, Green
  for primary colours, Patty and Selma, the Chinese car makes, Dave's Hot Chicken…).
- **Name the prompt so the list is right**: "Name a cardinal direction" (four), not "compass direction".
- Nothing on a list that isn't one (Bruce the shark isn't a villain); borderline ones are the owner's call
  (Jumba stays).
- Other names for one list only go in `byPool`, never in `byAnswer` (§2).

## 6. Never on the same night

- Two questions **never in one night** when one gives the other away, both ask the same fact (Google's BackRub),
  one answers another's ranking, or the same answer comes up too often (paella and Manchego: Spain). Sister
  airports (CDG/ORY, LHR/LGW, IST/SAW, JNB/CPT), a map and the pins it shows, a family of Majority Rules questions
  (the Michelin ones, the stock tickers) all count.
- **Same fact, two questions: delete one, don't pair them.** Before writing, search the bank for the subject. If
  a new question asks what an old one asks (only the way round differs: "Which producer made 'Children'?" /
  "Which Robert Miles track…?"), the new one replaces the old one, and say so when showing it (owner, 6 Nov).
  Never-together is only for questions that are different facts but give each other away (the Sandstorm meme and
  "Which producer made 'Sandstorm'?").
- They go in `SEED_NEVER` in `classic.html` (groups of ids); the dealer deals at most one of each group.
- **Better still, don't write the overlap**: a ranking shares no item with another ranking (the trend rankings:
  Rickrolling → KONY 2012 → Ice Bucket; Gangnam → Harlem Shake → Mannequin).

## 7. The other games

- **Majority Rules**: every question has a one-line fact in its notes (it's shown at the reveal); names written
  one way in every option list ("USA", not "The USA"); the app shuffles the options each night. The bank needs
  plenty of **easy** ones (a game can use 15).
- **Closest To Wins**: a note with the source and the real figure; Sexy Time and Lebanon only when they're the
  night's own themes.
- **Guess the Map**: a source in the notes; the year in the title when membership changes; labels readable on a
  phone (`fs` on the map, `callout` to put a label on its country); every map has test answers in
  `party/scripts/check-maps.mjs`; a region far from the world view gets its own view (Asia: `scripts/geo-view.mjs`).
- **Guess the Airport**: only **real routes** (the airline really flies there from that airport; no MEA to
  Amsterdam); local-language words checked; the city names on the board in the board's language; notes explain
  the clue (airline, language, the missing hub). Accept the city spellings people use (Lisboa, New Delhi).
- **Drop the Pin**: a photo people can recognise (not an aerial ridge only experts know), the pin on the actual
  spot, the place line capitalised ("Near Homs, Syria").
- **Russian Roulette** (9 and 10 Nov, the owner): it deals standard questions from the broad themes, everyone's
  ground: General Knowledge, Geography, History, Science, Nature, Sports, Music, Movies, TV Series, Food & Drink,
  Art & Books, Tech & Business, Celebrities, Quotes, Acronyms (`ROULETTE_THEMES` in `engine/core.js`). A fandom
  theme (Friends, Rave Culture, Geek & Gamer…), Sexy Time or Lebanon only on a night that picked it; never Know the
  Host or the host's own themes. Each barrel is 6 chambers (8 with 7 or 8 teams), each its own theme: one bullet
  (an **Expert** question: +5 right, −3 wrong) and the rest **Medium** (+2) and **Hard** (+3). So every broad theme
  needs Medium, Hard and Expert questions, and enough of them for several barrels; a theme short of a level gets
  the nearest one instead (Expert → Hard, Hard → Medium, Medium → Hard). The level is shown on the chamber before
  the spin, so it has to be right.
- **Flags**: only flags whose name isn't written on the flag.
- **Know the Host**: only with a host; wording leaves one answer ("secondary school").

## 8. Mechanics (do these every time)

- A question's **id is its wording**: change a word and the id changes. Then move its `accept.json` entries
  (`byId`, `rankById`, `someOf`, `notById`) and its `SEED_NEVER` groups to the new id; ids in code
  (`HOST_ONLY_IDS` in `party/lib/engine.ts`) too. `npm run check-bank` says when a never-together id is gone.
- Map ideas (`mapKeys`) are keyed by the map's **answer text**: change the answer, move the key.
- After any bank change: bump `BUILD.v` and `SEED_VERSION` in `classic.html` and `version.json`; run
  `node scripts/export-bank.js`; after a map change also `node scripts/export-maps.js`; after new pins
  `node party/scripts/fetch-pins.mjs`; then `cd party && npm test` (refresh goldens with `node sim/run.mjs --update`
  and `node sim/many.mjs --update` only when the change is meant to alter the deal).
- Commit; push only when the owner says "push".
