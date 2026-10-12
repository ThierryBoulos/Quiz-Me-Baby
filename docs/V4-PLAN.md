# Quiz Me Baby v4: Party mode (phones as controllers)

Status: **plan agreed, not built**. Decisions from 12 Oct 2026 are folded in (section 8).

---

## 1. The idea in one paragraph

The TV becomes **the show**: it shows the questions, maps, flags, timers, scores and reveals, and it has no buttons. Everyone else uses their phone:
- the **host** sees the answers and runs the night;
- each **captain** types the team's answers and taps the buzzer;
- **players** see the question close-up and nothing else.

With no host, the game runs itself: the app checks typed answers, and the other captain can overrule it.

The current single-screen game stays as **Classic**, so nothing is lost.

---

## 2. One button: the mode picks itself

The home screen has **one big button: PLAY**. Nobody chooses "Classic", "with host" or "no host"; the app works it out from who joins.

1. Tap **PLAY** on the device facing the room (laptop, smart TV, tablet). It becomes **the TV** and shows a room code + QR.
2. Then one of three things happens:

| What happens | The game becomes |
|---|---|
| Nobody joins. Somebody taps the small **"Just play on this screen"** link under the QR. | **Classic**: today's game, one screen |
| Phones join, and one of them taps **"I'm the host"** | **Party with host** |
| Phones join, but nobody takes the host role | **Party, no host**: the app checks the answers |

3. Whoever sets the game up (the host, or Team A's captain with no host) taps **Start** on their phone. The mode is fixed at that moment and shown once on the TV: "Hosted by Thierry" or "No host tonight — the app is checking answers".

A phone that opens the site without scanning sees PLAY plus a **"Got a code? Type it here"** box, so nobody ends up making a second room by mistake.

"With host" and "no host" are still the same Party mode with one switch. There are no separate builds and no separate code paths per game.

---

## 3. Joining (as few taps as possible)

1. **On each phone**: scan the QR on the TV (or type the code), type your **name**, then tap **Team A**, **Team B** or **I'm the host**.
2. **Captain:** every player sees a **"Make me captain"** button. **One captain per team:** once somebody takes it, the button greys out for their teammates and says **"Rami is your captain"**. A captain can hand it back ("Step down").
3. **The captain names the team:** a "Team name" box on the captain's phone. The new name shows instantly on the TV and on every phone.
4. **One host only.** Once taken, "I'm the host" greys out and the TV shows "Host: Thierry", so everyone can see who it is. (A PIN wouldn't help: anything the TV shows, the whole room can see.)
5. **The host's phone shows the lobby:** both teams, every player's name and who the captains are. The host can move a player to the other team or make someone captain.
6. **Setup** (themes, rounds, mini-games) happens on the host's phone, or on Team A's captain's phone with no host. It's today's Setup screen. The TV shows the two teams filling up while it happens.
7. **Start** on that phone, and the TV takes over.

Phones that lock or drop come back on their own: the room, team and role are remembered on the phone, so reopening the page puts you straight back in.

---

## 4. The rules every screen follows

- **TV:** no buttons, ever. Big, readable from the sofa. It never shows an answer before the reveal. Imad's bubbles, sounds and animations play here only.
- **Host phone:** the answer is always visible, top of screen. **One main button** at the bottom that does the obvious next thing (Start, Reveal, Next…), plus judging buttons only when there's something to judge.
- **Captain phone:** shows **what you can do right now**, and nothing when it's not your turn. Typing box + Send, the buzzer, lifelines. Your team's colour fills the screen so you can't confuse teams.
- **Player phone:** the question (or map, flag or ingredient list), your team's score, and a **"Suggest to the captain"** box: type an answer, tap **Send**. Between questions it shows the scoreboard.
- **Suggestions on the captain's phone:** a list under the answer box, each with the player's name ("Maya: *Paris*"). **Tap one to put it in the answer box**, edit it if needed, then **Send**. The captain always sends; players never answer directly.
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

### 6.5 Answer checking (kept deliberately simple)
- **Several accepted answers per question.** The bank gets a list: "UK / United Kingdom / Britain / Great Britain"; "The Beatles / Beatles".
- **Tidy before comparing:** lower-case, drop accents, punctuation and a leading "the".
- **Typos allowed:** 1 wrong letter in short words, 2 in long ones. "yelephant" still counts as *elephant*, but "elegant" doesn't.
- **Numbers** (Closest To Wins) are compared as numbers, never as text.
- **Flags and cocktails/dishes** get their accepted lists generated once (they're fixed names). The **491 standard questions** start with just their main answer plus the typo allowance; extra accepted answers get added over time. The **overrule** button (host, or with no host the other captain) covers anything the app misses.

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

## 8. Decisions (12 Oct 2026)

1. **TV shows the question text:** yes.
2. **No host = the app checks answers**, with a typo allowance and several accepted answers per question. Simple, with an overrule for anything it gets wrong.
3. **Players suggest to their captain:** yes. The captain sees each player's suggestion with their name and can pick one.
4. **No accounts:** just the room code.
5. **Move everything to Vercel.**
6. **One PLAY button:** the mode (Classic / with host / no host) picks itself from who joins (section 2).

**Next:** step 1 (the engine refactor) needs nothing external and can start now. Step 2 needs the Supabase project: Thierry is creating a new organisation on Supabase. Once it exists, this session can create the project, tables, security rules and functions through the Supabase connection.

---

## 9. Look and feel: copy SNAKED (12 Oct 2026)

Joining, the lobby, the TV code screen and the phone controllers **follow SNAKED**. Yelephant already uses the same lobby layout in its paper style. SNAKED is the reference (`/home/user/snaked`).

**Join (one screen):** `/join?code=ABCD`
- Room code box: big display font, letter-spaced, upper-cased as you type, 4 characters. Placeholder "Enter 4-letter code".
- **Name** (max 12).
- **Pick a face**: emoji grid, with faces already taken greyed out.
- Then **team** (A / B) and **"Make me captain"** / **"I'm the host"**.
- One big pill button: "Take my seat".
- Errors in SNAKED's tone: "Room not found"; a taken name offers "Rami is already at this table — Rami 2?".

**Codes:** 4 characters from `23456789ABCDEFGHJKMNPQRSTUVWXYZ` (no 0/O/1/I/L), the same alphabet as SNAKED. Already applied in Supabase.

**Phone lobby:**
- "Your room" eyebrow + the code in the display font with a hard offset shadow.
- QR tile + "Send the link" (share sheet).
- Connection dot: "{here} of {n} here".
- Players as chips (face + name) under each team, the captain marked.
- **One loud button** for whoever starts. Everyone else sees "You're in. {host} starts the game."

**TV:**
- A fixed 1280×720 stage scaled to fit the screen.
- Huge code + 220px QR, player cards. No buttons.
- **Unlike SNAKED, the PLAY screen links to it directly.** In SNAKED the TV address is only in the README.

**Phone controller:**
- Full-width stacked answer buttons (≥60px, 18px radius).
- "Locked" state after sending.
- **Haptic buzz** on your turn and when buzzing in.
- The whole screen glows in the phase / team colour, instead of popping up dialogs.
- A door button to leave, and a "Connection lost — your seat is being held" screen that recovers on its own.

**Rejoin:** your identity is the anonymous Supabase session. Coming back with the same phone gives you the same seat.

**Kicking:** a visible "Remove" on the host's player list. SNAKED's long-press is hidden; Quiz Me Baby makes it visible.

**Tech, same stack as SNAKED:**
- Next.js + Tailwind v4 + `@supabase/ssr` + `qrcode.react`, hosted on Vercel.
- Realtime by `postgres_changes` on a `room:{code}` channel, with a short polling safety net and a heartbeat.
- Countdowns on the server clock.

This replaces "plain JS + Vite" in 6.4. The game engine (step 1) is still written framework-free, so Classic and Party share it.

**Colours (decided):** Quiz Me Baby's own: navy, gold, cyan Team A, pink Team B. SNAKED supplies the layouts and components, not the palette.

---

## 10. Mechanics checklist: every v3 feature has a home in Party

Checked against every screen and every button handler in v3.13 (12 Oct 2026). Nothing in v3 is dropped. "Host" means the host's phone; "no host" means what replaces it.

### Before the game
| v3 mechanic | Party |
|---|---|
| Rounds count, themes, difficulty per theme ("diff", "themeDiff") | Setup on the host's phone (no host: Team A captain's) |
| Standard rounds on/off: mini-games-only nights | Setup, same switch |
| Mini-games on/off + levels: map 3 levels, flags 5, cocktail/dish 6 | Setup, same buttons |
| Hand-picking questions ("Pick tonight's questions", per theme and per mini-game) | Setup → Advanced, same picker |
| Team names, captains, players | **Lobby** (captain names the team; players join themselves) instead of typed lists |
| Settings: timers (question, steal, Closest, call-a-friend), sound, tick, volume, "never reuse", alternate who goes first | Host's phone → Settings. Sound and volume play on the **TV** |
| Question bank: add, delete, import/export CSV, template, reset | **Classic only**, on the TV device. The TV's bank is the bank Party deals from |
| Game history, export result, "reset played" | Classic only (history is saved on the TV device) |
| Solo practice | Classic only |
| Rules screen | On every phone ("How it works", SNAKED-style) and the TV home |
| Self-updater (version.json) | All devices; a phone that updates mid-game rejoins its seat |

### Standard rounds
| v3 mechanic | Party |
|---|---|
| Double points armed at round intro, then max one other lifeline | Captain phone at round intro; same rule enforced |
| Call a Friend (warning card, its own countdown, pause/+time) | Captain's phone shows the card and the friend timer; TV shows "Calling a friend…" |
| Double Dip (two answers) | Captain gets two answer boxes |
| Change this question ("swapQ") | Host. No host: the answering captain, once per question, before sending |
| Timer pause / +10s / "Time is up" | Host. No host: either captain can pause; +10s and "time up" are host-only |
| Steal (other team, own timer) | Other captain's phone opens when the first answer is wrong. No host: **no steal**, same as v3 |
| Right / wrong judging, peek at answer | Host (answer always visible). No host: app check + the other captain's overrule |
| Alternate who goes first | Engine, unchanged |
| Imad's bubbles, title slam, count-up, lead banner, drumroll, shake, confetti | **TV only** |

### Mini-games
| v3 mechanic | Party |
|---|---|
| Points per mini-game (0.35·N/M, 2–4 points); order and slot between rounds | Engine, unchanged |
| **Closest To Wins:** 7 numbers, closest wins, change question, tie → tie-breaker legs, host's call if they run out | Captains type numbers; app decides; host Change/Next. No host: Team A captain taps Next |
| **Auction:** bid / pass, leg count, +1 / undo counter, skip, legs and result | Captains bid; host counts (no host: the other captain counts) |
| **Don't Say the Same:** 10s, hidden word drawn at deal time, vast→tight order, change prompt, tie-breakers | Captains type; app compares; overrule as above |
| **Guess the Map:** 60s, **one hint per map**, **enlarge/zoom**, change map, retry loading, levels, "another map or 1 point each" on a tie | Hint: host or no host either captain (one per map, both see it). Zoom: pinch on every phone. Tie choice: host / both captains agree |
| **Guess the Flag:** 15s, change flag, both-right = point each, tie-breakers until somebody gets one, best of 10 | Captains type with suggestions; app check |
| **Cocktail or Dish:** 3s per ingredient, +8s, buzz → one go each, change, best of 7, tie → one more or 1 point each | Real buzzer, server clock decides; app check |
| **Battle of the Captains:** 10 each, 7s, same shape for both, change question, tie-breaker, "done" | Answering captain's phone; host judges / no host: app + other captain |
| Mini-game result screens, host's split/award when level and nothing left | TV shows; host taps (no host: both captains tap the same choice) |

### End of the night
| v3 mechanic | Party |
|---|---|
| Final scores, round-by-round table (only mini-games played) | TV; phones show the summary |
| Sudden death: rules screen + Go, captains only, change question, first right wins, "neither → next question" | Rules on TV, **Go** on host (no host: both captains tap Ready). Buzzers on captains' phones |
| End game / quit confirmation | Host (no host: TV's small exit, with confirm) |

### New in Party (not in v3)
- Buzzers with server time
- Player suggestions to the captain
- App answer checking with typo allowance and several accepted answers
- Lobby with faces
- Rejoin
- Kicking (visible "Remove" on the host's list)
- Captain hand-over

