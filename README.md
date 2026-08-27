# QUIZ ME BABY — Host Control

One file: `index.html`. Double-click it. That's the whole install. (It is named `index.html` because that is the name GitHub Pages serves at the root of the site — upload it as-is, no renaming.)

Your host stands on the left of the home screen. He's baked into the HTML as a data URI, so he travels with the file and there is no image folder to forget. (`host-imad.png` is the cut-out on its own, kept only in case you want to reuse it elsewhere — the app does not read it.) He's positioned out of the layout flow, so the logo and the menu stay dead centre on screen whether he's there or not, and he hides himself on windows narrower than 920px rather than squeeze them.

No server, no internet (the Google Fonts link and `.xlsx` import are the only online bits — both degrade gracefully). Works in Chrome, Edge, Firefox, Safari, on a laptop, a tablet or a phone.

## Phone vs laptop

There is only one file and one set of code — there is no separate mobile build. What changes is which CSS rules switch on, and that is decided by how wide the browser window is. A phone reports its **CSS width**, not its pixel count: an iPhone 13 screen is 1170 pixels across but at 3× density reports **390**. Every iPhone in portrait lands between 375 and 430; a laptop is 1280 or more.

So there is one block near the bottom of the stylesheet, marked **PHONE ONLY**, wrapped in `@media(max-width:640px),(max-height:560px) and (pointer:coarse)`. The width test catches portrait phones with a wide margin either side — every iPhone ever made is between 320 and 440 CSS pixels wide, and 640 sits safely above all of them, so it keeps working for whatever Apple ships next. The second clause catches a phone turned sideways (844+ wide, so the width test misses it) — `pointer:coarse` means the primary input is a finger, and a laptop reports `pointer:fine` even with a touchscreen, so it can never fire on one however small you drag the window.

**Width is only half of it.** How much room there is to *fit* something depends on the height, and height varies far more than width: an SE is 667 points tall, a 17 Pro Max is 956, and Safari draws its address bar and toolbar over the viewport, taking roughly 90 off whatever the number is. A 390×844 iPhone 13 is really about 750 while you can see the toolbar. So the screens that have to fit are sized in `vh` against three height steps — 780, 760 and 640 — rather than in fixed pixels against one device. Two of those steps are not width-tested at all, because a 1366×640 laptop window dragged small is exactly as short as a phone and wants the same answer.

Tested across the full range: SE 3 · 13 mini · 13 / 14 / 16e · 15 / 16 · 16 Pro / 17 · 16 Plus / 15 Pro Max · 17 Pro Max, each both at full height and with the Safari toolbar showing, plus iPad in both orientations and laptops from 640 to 1080 tall. Every Battle and mini-game screen holds without scrolling, checked against **all 287 questions** the Battle can draw, not just a sample.

Inside that block the phone gets:

- **A solid header bar.** On a laptop the tracker is frosted glass over a slowly drifting background. iOS has to re-composite that every frame and it strobes, so on a phone the bar is opaque and the background holds still.
- **Exit pinned to the top-right corner.** The laptop reserves a strip on the right of the whole tracker for it, which pushed the score-and-round display 29px off-centre on a narrow screen. On a phone only the Team B cell reserves that space, so the tracker centres properly.
- **No blur in the answer entrance.** The reveal animation starts at `blur(6px)`; iOS rasterises the element to apply it and can leave the note text permanently soft. Same fade, no blur.
- **Room for the Anton glyphs** in the Call a Friend dialog, which were spilling out of their boxes and colliding with the line below.
- **Stacked cards instead of the recap tables.** On a laptop those screens lock to the window height and let the table scroll inside itself. On a phone that gave nine rows an 85px window, 640px wide, on a 390px screen. There, the height unlocks, the page scrolls normally, and each leg or round is drawn as its own card with the column headings moved onto the cells.
- **A tighter Battle of the Captains.** The counter stays three-across — seeing both captains at once is the whole point of it — so everything inside it shrinks instead, and the tie-breaker's two captain buttons sit side by side rather than stacking. On the shortest screens, expendable things go before load-bearing ones: the flavour line under a title, then the team name under each captain's name. The score, the question and the buttons never move.

Everything above is invisible on a laptop, which renders exactly as it always did.

**No pinch-zoom.** A stray two-finger drag used to leave you panning around a magnified board hunting for the buttons. Three things stop it now: `maximum-scale=1, user-scalable=no` on the viewport, `touch-action: pan-x pan-y` in the stylesheet (scroll, and nothing else), and a `gesturestart` handler for iOS Safari, which ignores the first and only patchily honours the second. Nothing there can fire from a mouse, so a laptop is untouched — and normal scrolling is unaffected on both.

**Safe to project.** The answer is never on screen while it could still be worth points to someone — it stays behind a discreet *Peek at the answer — host only* toggle for as long as anyone can still answer, and comes out the moment the question is finished. So you can run this on a TV or a projector, or keep it on your laptop. Your call.

---

## Version

Bottom of the home screen, deliberately faint:

> Built by Thierry Boulos · © 2026 · v1.5 · 27 Aug 2026

Hover it on a laptop or tap it on a phone and it comes up to legible, so you can check which build you are on without it shouting at the room the rest of the time.

Both the version and the date come from **one constant** at the very top of the file:

```js
const BUILD = { v:'1.5', date:'27 Aug 2026', author:'Thierry Boulos', year:2026 };
```

**Bump both fields whenever the app changes.** There is no build step in a single HTML file, so nothing updates that date on its own, and a date that has quietly gone stale is worse than no date at all. Deriving it from `document.lastModified` was the obvious alternative and is a trap: copying the file to another laptop resets the timestamp, so a build from months ago would announce itself as updated today.

On copyright — it attaches automatically the moment the thing is written; there is nothing to register or file. The © line is not what creates the right, it just states plainly who owns it.

---

## Moving it between browsers and laptops

The file itself is portable — copy it anywhere. But each browser keeps its own **question bank, game history and played-question memory** (they live in that browser's local storage).

To carry your data across: **Settings → Export everything (JSON)**, then **Import a backup** on the other machine.

---

## The rules the app enforces

There's a full **Rules** screen on the home page — read it out to the room before you start. Short version:

**Format** — 2 teams, one captain each. Only the captain's answer counts. No phones.

**Before you start** — settle who goes first by chance, not argument: coin toss, rock paper scissors, highest card. The winner is Team A and answers first every round; the loser is Team B and gets the first steal.

**Setup** — you pick the number of rounds and then exactly that many themes. One theme per round, so 4 rounds = 4 themes, 9 rounds = 9 themes. The setup screen counts them for you and won't let you start until they match. Changing the round count adds or trims themes automatically. Timers are **not** on this screen — they live in Settings and hold for every game.

The theme chips **don't carry a question count** any more. On a phone that badge was the difference between two chips per row and three or four, and it answered a question you weren't asking — the capacity warning underneath already stops you starting a game the bank can't fill. A theme too thin to field a round at the difficulty it's on is **dimmed** instead, which reads at a glance and costs no width.

**Advanced Game Configuration** — one button near the bottom of the setup screen, collapsed by default, holding the three things you won't touch on a normal Tuesday: hand-picked questions, a difficulty per theme, and tonight's rules. The line under the button says what's configured in there, so nothing you've set can hide behind a closed drawer.

**Difficulty per theme** — inside that drawer. The difficulty you pick in section 02 is the house setting for the night; any theme can override it. Each theme gets a row of three pills — **Easy / Medium / Hard**. The one that's **outlined** is the house setting it inherited; the one that's **filled gold** is a choice you made. Tap whichever is lit to hand that theme back. A row outlined in amber can't field a round at the difficulty it's on; the capacity warning at the foot of the screen says so in words.

**There is no per-theme Mixed, deliberately.** Mixed describes a *spread across rounds* — some easy, some hard, over the course of a night. A theme is one round, and one round is one difficulty, so "mixed" has nothing to describe at that level. Mixed can still be the house setting, and a theme nobody has touched inherits it — that's the case where none of the three pills is lit.

**On Mixed generally:** it never means the two teams in a round get different questions. Pairs only ever form *within* a single difficulty, so both teams always face the same difficulty as each other; Mixed just lets round 3 be hard while round 4 is easy. Verified across 320 generated rounds — zero mismatches.

Everything downstream obeys the per-theme setting: the capacity count, the question picker, the round build, and *Swap this question* mid-game.

**Hand-picking questions** — optional, inside the same drawer. *Choose questions* opens a picker over the top of it listing only tonight's themes, each at **its own** difficulty (minus anything already played, if "never reuse" is on), with a theme filter across the top. Every theme heading carries the difficulty its list is running at, so an overridden theme is obvious while you're picking. That filter scrolls away with the rest of the list rather than staying pinned — pinned, a fourteen-theme game wrapped it to ten rows of chips covering most of the dialog. On a phone it is a single row you swipe sideways, and the per-theme lists run at full height so the whole dialog is one scroll surface instead of scroll boxes inside a scroll box. Tick **exactly two** in a theme — one for each team — and that round is locked to the pair you chose. Two is the cap; the rest of the theme greys out once you've got them. Leave a theme alone and the app matches a pair for it as usual, so you can hand-pick one round and let it fill in the other eight. A theme with only one question ticked is ignored, and the setup screen tells you so. Picks are dropped automatically if you drop the theme, change difficulty, or the question stops qualifying.

**Standard round** — one theme, one question per team.
1. Team A gets their question. 60s (adjustable).
2. Timer ends → the app asks *"Did Team A get it right?"* Yes / No. **The answer is not shown yet** — if you don't know it, open the *Peek at the answer — host only* toggle, which stays collapsed otherwise.
3. **No** → Team B may steal. 30s, answer still hidden while they think.
4. *"Did Team B steal it?"* — and here **the answer is on screen**. Nobody can win points off it any more, so there is nothing left to hide and nothing for you to dig for.
5. Then the full reveal screen with who got it, and Team B's own question, with Team A stealing.
6. One point per correct answer, whoever gets it.

Both questions in a round come from the same theme, the same pairing ticker **and the same difficulty** — so on Mixed nobody ever gets an easy one against a hard one.

**Lifelines** — three per team, once each, for the whole game.

| Lifeline | Rule |
|---|---|
| Call a Friend | 30s, pausable. The app shows you the question and the script: no ChatGPT, no Google, no asking the room. |
| Double Dip | Two attempts at the answer. Burned either way, even if the first attempt is right. |
| Double Points | **Declared before the round starts**, at the round-intro screen. The star fills gold when it's armed. |

If a team arms Double Points, they may use **only one** of the other two lifelines that round.
If a team arms Double Points and *misses*, the other team can steal it — and if they get it right it is worth **2 points** to them, even though they didn't spend a lifeline.
No lifelines on a steal. No lifelines at all in Closest To Wins.

**Closest To Wins** — the mini-game, 7 legs, dropped in **after the midpoint, rounded up** (7 standard rounds → after round 4).
- 90s per leg, both teams write one number, closest wins the leg.
- Tie on a leg → a point each.
- **Neither tonight's themes nor the difficulty apply here.** A number is a number, so Closest To ignores both and draws from the whole bank.
- **The legs are dealt round-robin across themes** — one Geography, one Food & Drink, one Music, and so on, in a fresh random order every game. Seven legs means seven different themes; you will never get the same theme twice in a row, tie-breakers included. If a theme runs out of numbers it simply drops out of the rotation.
- Winner takes **2 points**, or **3** if the game has 8+ standard rounds.
- **Tie after 7 legs → an extra tie-breaker question is pulled automatically**, and again if it is still tied. Six spares are held back for exactly this.
- Optional calculator on the answer screen — type both guesses, it shows who's off by how much.

**Battle of the Captains** — optional, and deliberately not on the Rules screen. After the last round a pop-up asks **Activate Battle of the Captains — Y / N**. Say no and you go straight to the results exactly as before. Say yes and it plays as though it was always on the card: no "would you like to", nothing that reads as the host fishing for a way to rescue the losing team.

- **10 questions each, 7 seconds a shot, captains only.** Team A's captain does all ten, then Team B's.
- **Both captains get the same difficulty shape** — five easy and five medium in an identical order — but never the same question. Different sets, same shape, so nobody can claim they drew the harder ten.
- **Three themes are barred**: Know the Host, Sexy Time and Lebanon. Under a seven-second clock a captain deserves something anyone at the table could know.
- Nothing already played tonight comes back — not the rounds, not the mini-game, not its unplayed spares.
- The clock **runs itself out into the answer** and asks *"Did [captain] get it?"* — Yes / No, or the `Y` / `N` keys. *Show the answer* jumps there early; *Change this question* pulls another at the same difficulty.
- Best score takes **2 points**. A running counter shows both captains throughout.
- **Level after twenty questions → a tie-breaker.** Medium difficulty, **no clock**, first captain in takes it. Nobody got it? Another question, and another, until someone does.

Because the Battle is worth 2 points it can *create* a tie as easily as break one — 10–8 with the trailing captain winning is 10–10 — so it hands back to the normal ending, and a level game still goes to sudden death.

**End of the game** — highest score wins. Tie → **sudden death**: one fresh question from tonight's themes (it widens only if those run dry), both captains, first right answer takes the night. There's a *Change question* button if the one it pulls doesn't suit the room.

---

## During the game

- **Tracker across the top** — scores, round number, theme, and a row of pips: `● ● ▬ ● ●` (dot = standard round, bar = Closest To Wins). Current one glows gold. A second bar appears on the end **only once the Battle has been accepted** — it's a surprise, so it must not show up on the schedule before then.
- **Every screen fits one screen** — no scrolling mid-round, and none on the results screens either. The question screens, every *Battle of the Captains* screen, the *Closest To Wins* final and the *Winner of the night* screen all scale their type to the window height. On a 14-round game the round-by-round table is the one thing that scrolls, inside its own box, so the page itself never moves.
  - The one exception is the **Battle tie-breaker on an iPhone SE**, which carries the most in a single screen — question, answer, source note, counter and three verdict buttons. One question in the bank of 287 nudges 22px past a full-height SE, and seven do at the absolute floor (an SE *with* the Safari toolbar, 375×570 — the smallest viewport iOS can produce). Everything from an iPhone 13 upward is clean on all 287. If it ever bites, *Change question* pulls another.
- **Swap this question** — on any standard question screen, if the question doesn't fit the room. It walks the theme **in bank order, one press at a time**, and will not offer the same question twice until every other one in that theme and difficulty has been through. The list is shared across both teams' slots in the round, so a question you skipped past on Team A won't reappear on Team B. Once the theme is exhausted it quietly starts again from the top. The pairing ticker is deliberately **ignored** here — it exists to match the two teams when the round is built, and honouring it on a swap left a pool of one or two that just bounced between the same questions.
- **Change this question** — the same escape hatch on a Closest To Wins leg. Pulls another number question, preferring a theme this mini-game hasn't used yet so the one-per-theme spread survives. The clock restarts.
- **Pause / +10s / Time is up** — under every timer.
- **Round scoreboard** after each round with a *Next round* button, so you can break whenever. On the last round it reads *Scores tied — tie breaker* if you're heading for sudden death.
- **Keyboard**: `Y` / `N` to judge — including the Battle, where seven seconds is no time to be hunting for a button — `Space` to pause the timer, `Enter` for the main gold button, `Esc` to close a dialog.
- **Sound**: on by default at **75%**. The theme plays **once when you open the app** — not every time you come back to the home screen — then a calm 5-second sting at the top of each round, three soft descending bells when a timer ends, and a quiet tick over the last 10 seconds. All synthesised in the browser, no files. Volume and on/off in Settings.
  - Browsers won't let a page make noise before you've touched it, so the theme can't always fire the instant the file loads. When it can't, it waits — but only for an *idle* gesture: a tap on dead space, a scroll, a key. A tap that lands on a **control** unlocks the audio and cancels the theme instead of triggering it, because a five-second sting starting on top of *Start a new game* is a startup sound arriving at the worst possible moment. It also gives up after 12 seconds: a theme that begins a minute into setup doesn't read as the app opening, it reads as a fault. Nothing to press, and no button for it — that's deliberate.

---

## Loading your own questions

**Settings → Open the question bank → Import file.** CSV, TSV or XLSX. Header row required; columns in any order.

| Column | Required | Notes |
|---|---|---|
| `question` | yes | |
| `answer` | yes | For `closest` questions, put the raw number — `277500000`, not `277.5 million`. |
| `notes` | no | Shown to you underneath the answer. Use it for the year, the source, and any scope caveat ("population including refugees"). |
| `theme` | no | Unknown themes are added automatically. Defaults to `General`. |
| `type` | no | `standard` or `closest`. Anything matching *clos / estim / numb / guess / mini* counts as closest. Defaults to standard. |
| `difficulty` | no | `easy` / `medium` / `hard`, or `1` / `2` / `3`. Defaults to medium. |
| `use_question_with` | no | Your pairing ticker. |

**The pairing ticker** is the important one. Two standard questions **in the same theme at the same difficulty** sharing a ticker get asked as a pair, one to each team. `capital-of`, `highest-mountain`, `who-directed` — whatever you like, as long as it's identical on both rows. Rows with a blank ticker still work; they pair loosely within the same difficulty, and the app flags that round as "loosely matched".

Import merges — a question with identical text updates the existing row instead of duplicating it. **Download CSV template** in the bank screen gives you a correctly-shaped starter file.

`.xlsx` pulls a reader library from a CDN the first time, so it needs internet at that moment. **Save As → CSV** in Excel always works offline.

---

## What's in the box

**491 questions** — 441 standard and 50 Closest To Wins, across 19 themes:

Acronyms · Disney & Pixar · Food & Drink · Friends · Geek & Gamer · Geography · History · Internet & Memes · Know the Host · Lebanon · Movies · Music · Nature · Pop Culture · Rave Culture · Science · Sexy Time · Sports · Tech

This is the bank from `quiz-me-baby-bank-v5.csv`, baked in as the official set for everyone. It replaced the previous bank outright — if you open this file in a browser that ran an earlier version, the old questions are cleared out rather than merged, every time the bank is replaced. Your game history and played-question memory carry over.

Closest To Wins questions carry their caveats in the notes — which year the figure is from, whether the number is disputed.

**How changes to the built-in bank reach a browser that already has one.** Your saved bank lives in local storage, so a new copy of the file does not overwrite it — otherwise every update would wipe questions you had imported. `SEED_VERSION` near the top of the file is what unlocks a merge: **bump it whenever you touch the built-in bank**, or nothing you changed will ever appear on a browser that has run the app before. On the next open, that browser then does two things:

- **Adds** built-in questions it has never seen. Ones you deleted stay deleted.
- **Refreshes** built-in questions it already has, where the built-in copy has changed — a corrected answer, a question moved to a different theme. This matters because the question id is a hash of the *question text*, so a fix to any other field arrives under an id the browser already holds; add-only would drop it silently and you would keep reading the old answer off your own screen.

Only rows marked `src: 'seed'` are refreshed. Anything you **imported or typed yourself is never touched**, even where it sits on top of a built-in id. The startup toast reports both numbers — *"1 new built-in question added, 3 corrected in your bank."*

**Two themes work differently:**

- **Sexy Time** is explicit adult trivia. It's a real theme with real answers, but deselect it at setup for a tamer room.
- **Know the Host** has no real answers in the bank — every one reads *"Host knows this one."* You supply the truth on the spot. If you'd rather have them written down, open the bank, filter to that theme, and type your real answers in.

**Restore starter bank** in the bank screen puts all 488 back if you ever overwrite them.
