# Quiz Me Baby v4: Party mode (phones as controllers)

Status: **plan, not built**. Nothing here changes v3 until we agree on it.

---

## 1. The idea in one paragraph

The TV becomes **the show**: it shows the questions, maps, flags, timers, scores and reveals, and it has no buttons. Everyone else uses their phone:
- the **host** sees the answers and runs the night;
- each **captain** types the team's answers and taps the buzzer;
- **players** see the question close-up and nothing else.

With no host, the game runs itself: the app checks typed answers, and the other captain can overrule it.

The current single-screen game stays as **Classic**, so nothing is lost.

---

## 2. Picking a version (the first screen)

On the home screen, three big choices:

| Choice | What it is | Who needs a phone |
|---|---|---|
| **Classic** | Today's game. One screen, someone taps. | Nobody |
| **Party — with host** | TV + host phone + captain phones (+ any players) | Host, 2 captains |
| **Party — no host** | TV + captain phones (+ any players) | 2 captains |

"With host" and "no host" are the same Party mode with one switch. There are no separate builds and no separate code paths per game.

---

## 3. Joining (as few taps as possible)

1. **On the TV** (laptop or smart-TV browser): tap **Party → New room**. The TV shows a big **4-letter room code** and a **QR code**.
2. **On each phone**: scan the QR (or open the site and type the code). Then:
   - type your **name**;
   - tap a **team**: big Team A / Team B buttons;
   - the **first person on each team becomes captain**, and anyone can tap "Make me captain" later.
3. **The host** (if there is one) taps **"I'm the host"** instead of a team. To stop a player opening the answers, the host role is locked with a **PIN that only the TV operator sees** when the room is made: a tap-to-reveal, then it hides.
4. **Setup** (themes, rounds, mini-games) happens **on the host's phone**, or on Team A's captain's phone with no host. It's today's Setup screen, unchanged. The TV shows "Waiting for the host to set up…" with the joined players listed under each team.
5. **Start** on the host's (or captain's) phone, and the TV takes over.

Phones that lock or drop come back on their own: the room and role are remembered on the phone, so reopening the page puts you straight back in.

---

## 4. The rules every screen follows

- **TV:** no buttons, ever. Big, readable from the sofa. It never shows an answer before the reveal. Imad's bubbles, sounds and animations play here only.
- **Host phone:** the answer is always visible, top of screen. **One main button** at the bottom that does the obvious next thing (Start, Reveal, Next…), plus judging buttons only when there's something to judge.
- **Captain phone:** shows **what you can do right now**, and nothing when it's not your turn. Typing box + Send, the buzzer, lifelines. Your team's colour fills the screen so you can't confuse teams.
- **Player phone:** the question (or map, flag or ingredient list) and your team's score. **No buttons.** Between questions it shows the scoreboard.
- **No host:** the jobs the host's buttons did are done by the app (timers and auto-checking) or by the captains, one tap each.

---

## 5. Screen by screen, per game

Layout of each table: what the **TV**, the **host**, the **captain** and the **players** see, and what changes with **no host**.

### 5.1 Standard rounds (question for one team, steal for the other)

| | TV | Host phone | Captain phone | Player phone |
|---|---|---|---|---|
| Round intro | Theme title slams in, "Team A answers first" | Theme + **Start** | Arm **Double points?** (Yes / No) | Theme |
| Question | Question + timer + whose turn | Question + **answer** + **Right / Wrong** | *Answering team:* text box + **Send**, lifeline chips. *Other team:* "Get ready to steal" | Question + timer |
| Answer sent | "Team A has answered…" | Their typed answer under the real one → **Right / Wrong** | "Sent ✓" | Question |
| Steal | "STEAL — Team B" + timer | Same, for the stealer | *Stealing team:* text box + **Send** | Question |
| Reveal | Answer + fact, points fly to the score | **Next** | Result | Answer + result |

**No host:**
- The typed answer is **checked by the app**, using the answer, accepted spellings and a small typo allowance.
- The TV shows both the typed and the real answer and the app's verdict. The **other captain** gets **Agree / Overrule** for 5 seconds; no tap means the verdict stands.
- The steal works the same way.

**Lifelines** (captain's phone):
- **Double Dip:** two boxes instead of one.
- **Call a Friend:** a full-screen card with the question and the warning to read out. The timer pauses on every screen.
- **Double points:** armed at the round intro, as today.

### 5.2 Closest To Wins (numbers)
- **TV:** question + timer, then the reveal: both guesses on a number line with the real answer and the gap.
- **Captains:** a **number pad** + **Lock in**. Guesses stay hidden until both are in or time is up.
- **Host:** sees the answer and both guesses as they arrive, then **Next**. **The app decides who's closer**, so no judging is needed.
- **Players:** the question.
- **No host:** works exactly the same; this game never needed a judge.

### 5.3 The Auction
- **Bidding:**
  - **TV:** the category and the current bid, big.
  - **Captains:** **Raise** (+1 / custom) or **Pass**, on their turn only.
- **Delivering:**
  - **TV:** the count going up, the timer, and the names given so far (if typed).
  - **Bidding captain:** says the answers out loud (or types them in a list).
  - **Host:** a big **+1** counter and **Undo**.
- **No host:** the **other captain** holds the +1 counter. They have every reason to be strict.

### 5.4 Don't Say the Same as Me
- **Captains:** type an answer + **Send**, both at once and hidden from each other.
- **TV:** reveals both answers next to the app's hidden word.
- **The app checks matches by itself.** The host (or, with no host, the other captain) can overrule a near-miss like "colour" / "color".

### 5.5 Guess the Map
- **TV:** the map, legend and timer.
- **Players:** the map on their phone, pinch-zoomable.
- **Captains:** a text box + **Send**.
- **Host:** the answer + both typed answers → **Team A ✓ / Team B ✓ / Both / Nobody**.
- **No host:** the answers are fuzzy ideas, not names ("drives on the left"), so the app can't check them reliably. Both typed answers show on the TV next to the real one, and **each captain rules on the other team's** with ✓ / ✗.

### 5.6 Guess the Flag
- **TV:** the flag + timer.
- **Captains:** a text box with **suggestions as you type** (country names), + **Send**.
- **Players:** the flag.
- **The app checks the answer**, because country names are a fixed list. The host can overrule.
- **No host:** the same, and the other captain can overrule.

### 5.7 Guess the Cocktail or Dish (where phones help most)
- **TV:** the ingredients appear one at a time with the timer, and shows **"TEAM A BUZZED"** when it happens.
- **Captains:** a giant **BUZZ** button.
  - **The server stamps who was first**, so there are no arguments.
  - The buzzer opens a text box with suggestions (the 60 names).
  - A wrong answer locks that team out, and the list resumes for the other team.
- **Host:** sees the answer and the typed guess → **Right / Wrong**.
- **No host:** the app checks the answer against the 60 names, so the written-answers workaround from v3.10 isn't needed.
- **Players:** the ingredient list.

### 5.8 Battle of the Captains
- **The captain answering:**
  - Their phone shows the question with a text box.
  - The other captain's phone shows "Your turn is next".
- **TV:** question, timer and running scores.
- **Host:** **Right / Wrong** per question.
- **No host:** the app checks first; the waiting captain can overrule.

### 5.9 Sudden death
- **TV:** the rules card, then the question.
- **Both captains:** a **BUZZ** button. First buzz answers (text box). A wrong answer gives the other captain a go.
- **Judging:** host Right/Wrong. With no host, the app checks and the other captain can overrule.

### 5.10 Between screens
- **Round scores and mini-game results** show on the TV.
- **Phones** show the scoreboard plus "Next up: …".
- **The host's phone** has **Next** (no host: the TV moves on by itself after 8 seconds, and either captain can tap **Next** sooner).

---

## 6. What changes under the hood

### 6.1 The big refactor: one game engine
Today the game logic and the screen drawing are mixed together in `index.html`. For v4 the **rules move into a pure "engine"**:
- it takes the game state and an action ("Team A answered X", "host said right") and returns the new state;
- it doesn't touch the screen.

**Classic** runs the engine on one device, as now. **Party** runs the same engine on the TV, with phones sending actions. **This is the main piece of work, and it's done first.** Classic keeps working throughout, so it can ship as v3.x before any networking exists.

### 6.2 Who's in charge
**The TV runs the engine.** It's always on and never sleeps, unlike a phone.
- Phones send actions to it.
- It sends back the updated state, filtered per role:
  - players and captains never receive the answers;
  - the host does.

### 6.3 Supabase (live connection and storage)
- **Rooms table:** code, mode (host / no host), the public game state, a version number. If the TV refreshes, it reloads from here and carries on.
- **Secrets table:** answers for the current question. **Only the host can read it**, enforced by the database (row-level security), not by hiding it in the page. Players can't peek, even with developer tools.
- **Members:** who's in the room, their role and team.
- **Buzzes and answers:** stamped with the **server's clock**, which decides who was first.
- **Live updates** use Supabase Realtime.
- **Sign-in:** anonymous (no accounts, no emails); a phone just gets an id.

### 6.4 Vercel (hosting)
- The site moves from GitHub Pages to Vercel, with a small build step (Vite) so the code can be split into files: engine, TV views, phone views, network.
- Still no framework: plain JavaScript and the same styles, so today's screens are reused, not rewritten.
- The questions bank, flags and maps come along unchanged.

### 6.5 Answer checking (for no host and for typed answers)
- **The app's check:** lower-case, strip "the" / punctuation / accents, then allow small typos (1 letter in short words, 2 in long ones).
- **Accepted spellings per question:** the bank gets a new field. For flags and cocktails/dishes these are easy to generate. For the 491 standard questions we'd add them over time, while the overrule button covers the gaps.

---

## 7. Build order

1. **Engine refactor**, inside today's app (no network). Classic plays exactly as now. Ship as v3.x.
2. **Rooms + TV + players**:
   - join by code / QR, team picking, the TV as a display;
   - players' phones mirror the question;
   - **host phone** runs standard rounds (Right / Wrong / Next).
3. **Captain phones:**
   - typed answers, lifelines, steals;
   - the buzzer (Cocktail or Dish, sudden death);
   - Closest To Wins and Flags with app checking.
4. **No-host Party mode:** app checking + the other captain's overrule, captain-run Auction and Map.
5. **Polish:**
   - reconnecting;
   - swapping captain mid-game;
   - "make the TV also the host's screen" for small groups;
   - QR printing.

Each step is playable on its own, and Classic is never broken along the way.

---

## 8. Decisions needed from you

1. **TV shows the question text?** Recommended: **yes**. Everyone looks at the TV; the phones just repeat it close-up for players. Otherwise the TV shows only the theme, the timer and the reveal.
2. **App checking + overrule with no host?** Recommended: **yes**. The alternative is captains judging every answer by hand.
3. **Players' phones: nothing to tap at all**, or a small "suggest to my captain" box (shows on the captain's phone)? Recommended: **nothing at first**; add the suggest box later if the teams want it.
4. **Accounts:** none (room code only)? Recommended: **none**.
5. **Domain:** keep the GitHub Pages address for Classic and give Party a Vercel address, or move everything to Vercel? Recommended: **move everything** once step 2 works.

To start step 2 I'll need you to create a free Supabase project and give me its URL and its public (publishable) key. I'll set up the tables, security rules and functions. The Vercel connection to the GitHub repo is a one-click import on your side.
