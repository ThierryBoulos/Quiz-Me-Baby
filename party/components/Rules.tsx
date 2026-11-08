import type { ReactNode } from "react";

/* HOW TO PLAY, in two parts (29 Oct review): the game, short enough to read before the
   first question, and FIXING A CALL, the manual for when something needs changing
   (contests, agreements, corrections, dead phones). The lobby shows both; the
   How to Play page shows the game and links to the second. */
function Rule({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <section className="card flex flex-col gap-3">
      <div className="flex items-baseline gap-3"><span className="eyebrow" style={{ color: "var(--color-gold)" }}>{n}</span><h2 className="display text-26">{title}</h2></div>
      {children}
    </section>);
}
const L = ({ items }: { items: ReactNode[] }) => (
  <ol className="flex flex-col gap-2.5 text-15 leading-relaxed text-[var(--color-ink-2)] list-decimal pl-5 marker:text-[var(--color-gold)] marker:font-bold">
    {items.filter((x) => x !== false && x != null).map((x, i) => <li key={i}>{x}</li>)}
  </ol>);
const B = ({ children }: { children: ReactNode }) => <strong className="text-[var(--color-ink)]">{children}</strong>;

/* the one screen to read before the first question */
function First30({ noTv = false }: { noTv?: boolean }) {
  const steps: [string, ReactNode][] = [
    ["Pick a side", <>Tap Team A or Team B on your phone. One of you taps <B>Make me captain</B>.</>],
    ["The captain types", <>Only the captain&rsquo;s answer counts. It goes in once, from the captain&rsquo;s phone.</>],
    ["Everyone else suggests", <>Type your idea on your phone: it lands on your captain&rsquo;s screen. Shout too, why not.</>],
    noTv ? ["No TV tonight", <>Questions, clocks, scores and results are all on your phone. The game runs on the phone of whoever made the room: they keep that phone awake and on the game screen.</>]
      : ["Watch the TV", <>Questions, clocks, scores and reveals are on the TV. Your phone shows what you can do right now.</>],
  ];
  return (
    <section className="card flex flex-col gap-3" style={{ borderColor: "rgba(245,197,24,.5)" }}>
      <h2 className="display text-26" style={{ color: "var(--color-gold)" }}>Your first 30 seconds</h2>
      <ol className="flex flex-col gap-2.5">
        {steps.map(([t, x], i) => (
          <li key={t} className="flex gap-3 items-baseline">
            <span className="display text-22 shrink-0 w-6 text-center" style={{ color: "var(--color-gold)" }}>{i + 1}</span>
            <span className="text-15 leading-relaxed text-[var(--color-ink-2)]"><B>{t}.</B> {x}</span>
          </li>))}
      </ol>
      <p className="text-13 text-[var(--color-ink-3)]">That&rsquo;s all you need. The rules are below, short.</p>
    </section>);
}

/* the game: on How to Play, and in the lobby while people wait */
export function Rules({ fixing = true, noTv = false }: { fixing?: boolean; noTv?: boolean }) {
  return (
    <>
      <First30 noTv={noTv} />
      <Rule n="01" title="The setup">
        <L items={[
          <><B>Two teams</B>, any size. {noTv ? <>Everyone joins on their phone with the code or the QR; the phone that made the room runs the game.</> : <>The TV is a laptop with the game open, put up big; everyone else joins on their phone with the code or the QR.</>} Each team picks a <B>captain</B>: the captain gives the final answer, nobody else.</>,
          <>Want a host? One person taps <B>I&rsquo;m the host</B>: they see every answer and rule on it. No host? The app rules, and the captains can contest its calls (see <B>Fixing a call</B>).</>,
          <>Phones are for the game only: no searching, no asking anyone outside the room. A phone that leaves the game screen during a question is flagged{noTv ? " on the host's list" : " on the TV"}.</>,
          <><B>4 to 12</B> standard rounds, one theme each, plus the mini-games on the card. Or no standard rounds at all: a night of mini-games back to back.</>,
        ]} />
      </Rule>

      <Rule n="02" title="A standard round">
        <L items={[
          <>One theme, one question for each team at the same difficulty. <B>Team A always answers first</B>, every round; then Team B gets their own question.</>,
          <><B>60 seconds.</B> The team sends ideas to the captain; the captain types the answer and sends it. <B>One go:</B> sent is locked. Typed but not sent when the clock runs out? What&rsquo;s in the box counts as sent (on every clock, mini-games too).</>,
          <>Wrong or out of time? The other team can <B>steal</B>: <B>30 seconds</B>, no lifelines. A steal pays what the question was worth: 1 point, or 2 if Double Points was armed on it. <B>Both miss</B>, and nobody scores; the answer comes up and the night moves on.</>,
          <>The answer stays hidden until the question is finished, so a stealing team can never read it off a screen. A point per right answer (2 with Double Points), whoever gets it. A 🔥 beside a team: on fire, three right in a row.</>,
        ]} />
      </Rule>

      <Rule n="03" title="Lifelines: three each, once each">
        <L items={[
          <><B>Call a Friend</B>: <B>30 seconds</B>. Before the captain speaks, tell the friend: no ChatGPT, no Google, no asking the room.</>,
          <><B>Double Dip</B>: two answers; either one right counts. Burned either way.</>,
          <><B>Double Points</B>: armed on the captain&rsquo;s phone before the round starts. Right: 2 points. Stolen from you: they get 2. The other two still work that round: use all three at once if you like.</>,
          <>No lifelines on a steal, none after an answer is sent, and none in the mini-games.</>,
        ]} />
      </Rule>

      <Rule n="04" title="The mini-games">
        <p className="text-15 leading-relaxed text-[var(--color-ink-2)]">Chosen in Setup and announced at the start, they drop in between the rounds; the Battle always closes the night. Whoever wins one takes its points (Setup shows how many; the Battle is worth double). Won with legs to spare? The points are paid at once and you choose: keep playing for fun, or stop. Tied at the end? One more to settle it, or a point each. The host decides; with no host, either captain, and if nobody picks in 10 seconds, it&rsquo;s a point each (or keep playing, for a game won early). The app checks every typed answer; a call it got wrong can be contested on the reveal. Each reveal waits for Next, so there&rsquo;s time to argue.</p>
        <L items={[
          <><B>Closest To Wins.</B> The same number question for both captains, <B>60 s</B> on the number pad. Closest takes the leg. 5 legs.</>,
          <><B>The Auction.</B> &ldquo;How many countries can you name?&rdquo; Captains bid up to 100, raise or pass; whoever holds the bid has <B>30 s</B> to name that many, out loud, counted by the host (or the other captain). Make it or lose it. 3 categories.</>,
          <><B>Don&rsquo;t Say the Same as Me.</B> &ldquo;Name a cheese.&rdquo; <B>20 s</B> to type one, hidden from each other. The app has a common word in mind: say it and the leg goes to the other captain (you both say it: a point each). Your answer must be a real one for the prompt. Best of 7.</>,
          <><B>Guess the Map.</B> A map with no title, <B>60 s</B>. Type what it shows: the idea counts, not the wording. With a host, one hint per map. Best of 3.</>,
          <><B>Guess the Flag.</B> <B>15 s</B> to type the country. Best of 10.</>,
          <><B>Drop the Pin.</B> A landmark photo, <B>45 s</B>. Drop a pin on the world map on your phone, zoom right in, Lock in. The nearer pin takes the leg. Best of 7.</>,
          <><B>Guess the Airport.</B> A departures board, <B>30 s</B>: the destinations, the airlines and the language are the clues. The city is enough, unless it has more than one airport. Best of 5.</>,
          <><B>Majority Rules.</B> Everyone plays, on their own phone: 15 questions, four answers, <B>15 s</B> each, one tap and it&rsquo;s locked. No answer counts as wrong. Each team scores the share of its answers that are right, so a small team isn&rsquo;t at a disadvantage.</>,
          <><B>Guess the Cocktail or Dish.</B> The ingredients come up one every <B>3 s</B>, the giveaway last. Captain, hit <B>BUZZ</B> and type it in <B>10 s</B>. Wrong, and you&rsquo;re out of that one. Best of 5.</>,
          <><B>Battle of the Captains.</B> Captains only, the room says nothing. Ten questions each: <B>7 s</B> out loud with a host, <B>15 s</B> typed without. Best score takes double points; tied? One question to settle it (both captains type, the first right answer takes it), or a point each: the host decides, or either captain with no host. Always last.</>,
        ]} />
      </Rule>

      <Rule n="05" title="Winning">
        <L items={[
          <>Highest score after the last game takes the night: confetti on every screen, the night in a nutshell, then <B>Play again</B> or <B>Exit</B>.</>,
          <>Tie? <B>Sudden death</B>: one question at a time, captains only. Both type their answer and send it: <B>the first right answer wins the night</B>. Wrong, and you&rsquo;re out of that question; nobody right, another one.</>,
        ]} />
      </Rule>

      {fixing && <FixingACall noTv={noTv} />}
    </>);
}

/* when something needs changing: who taps what, and what happens if they don't */
export function FixingACall({ standalone = false, noTv = false }: { standalone?: boolean; noTv?: boolean }) {
  return (
    <>
      {!standalone && <h2 className="display text-32 mt-2" style={{ color: "var(--color-gold)" }}>Fixing a call</h2>}
      <Rule n="A" title="With a host">
        <L items={[
          <>The host&rsquo;s phone shows the answer and what the captain typed, then two buttons, <B>RIGHT</B> and <B>WRONG</B>. The app&rsquo;s call is already picked (&ldquo;App suggests&rdquo;); the other button changes it. The host can change any call until Next.</>,
          <>A captain who disagrees taps <B>Contest</B> where the call is shown; <B>the host decides</B>.</>,
          <>Scores wrong? <B>Players &rarr; Adjust the scores</B> on the host&rsquo;s phone. A question nobody wants (a repeat, a broken picture)? The host&rsquo;s <B>Change question</B>, before anyone answers it.</>,
          <>The host can pause any clock, and pause a Call a Friend.</>,
        ]} />
      </Rule>
      <Rule n="B" title="No host: contesting a call">
        <L items={[
          <>The app checks every answer at once. Where its calls are shown (the answer card after a steal, every reveal, the Battle review), a captain can tap <B>Contest</B> on one: <B>their own team&rsquo;s WRONG, or the other team&rsquo;s RIGHT</B>, never the reverse.</>,
          <>The other captain gets <B>Agree</B> or <B>No</B>. No answer in <B>15 seconds</B>, and the app&rsquo;s call stands. One contest at a time, each call once, and Next waits for it.</>,
          <>A changed call moves the points with it, and the night carries on from there. Sudden death and the Battle tie-breaker settle at once; a call there can still be contested on the screen after.</>,
        ]} />
      </Rule>
      <Rule n="C" title="No host: the two captains agree">
        <L items={[
          <>Scores wrong? Either captain: <B>your name (top left) &rarr; Adjust the scores</B>. The other captain gets Agree or No; no answer in <B>20 seconds</B>, nothing changes.</>,
          <>A question nobody wants? Before anyone has answered it, either captain taps <B>Change the question</B> (or the flag, landmark, board, cocktail or dish, map or prompt). The clock stops while the other captain decides. Agree, and a new one, just as hard, comes with a fresh clock; No, or no answer in 20 seconds, and it carries on.</>,
          <>Team A&rsquo;s captain moves the night on (Start, Next). If they haven&rsquo;t after a while, the other captain can. At a tie or a game decided early, either captain picks.</>,
          <>Majority Rules: someone who has gone home comes off their team&rsquo;s list before Start, with the other captain&rsquo;s agreement.</>,
        ]} />
      </Rule>
      <Rule n="D" title={noTv ? "Phones" : "Phones and the TV"}>
        <L items={[
          <><B>Phone died?</B> Join again with the same name and tap &ldquo;take my seat back&rdquo;. A host&rsquo;s or a captain&rsquo;s seat only frees up once that phone has been silent for a minute and a half, so nobody can take it by typing the name.</>,
          <><B>Captain gone?</B> After a while the armband passes to a teammate who is still here. <B>Host gone?</B> With two teams the captains run the night meanwhile; with three teams or more it waits. The host comes back by opening the game again, or joining again with the same name; after 90 seconds anyone in the room can tap <B>Be the host</B> instead.</>,
          noTv ? <><B>The phone running the game went to sleep or lost Wi-Fi?</B> The clocks stand still until it&rsquo;s back; after a while the host&rsquo;s or a captain&rsquo;s phone carries the night on from its last save, by itself.</>
            : <><B>The TV&rsquo;s Wi-Fi dropped, or its screen went to sleep?</B> The clocks stand still until it&rsquo;s back; nothing times out meanwhile. A TV reloaded or reopened picks the night up where it was.</>,
          <><B>No peeking, no pasting.</B> A phone that leaves the game screen during a question, or pastes an answer, is flagged{noTv ? "" : " on the TV"}; the host sees the list.</>,
          !noTv && <><B>The TV laptop died?</B> The host (with no host, either captain) taps <B>their name (top left) &rarr; The TV died? &rarr; Get a code</B>. On another laptop, open the site, tap <B>Join a game</B>, then <B>The TV died?</B> at the very bottom, and type the room code and that code: the night carries on from the TV&rsquo;s last save.</>,
        ]} />
      </Rule>
    </>);
}
