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
    {items.map((x, i) => <li key={i}>{x}</li>)}
  </ol>);
const B = ({ children }: { children: ReactNode }) => <strong className="text-[var(--color-ink)]">{children}</strong>;

/* the one screen to read before the first question */
function First30() {
  const steps: [string, ReactNode][] = [
    ["Pick a side", <>Tap Team A or Team B on your phone. One of you taps <B>Make me captain</B>.</>],
    ["The captain types", <>Only the captain&rsquo;s answer counts. It goes in once, from the captain&rsquo;s phone.</>],
    ["Everyone else suggests", <>Type your idea on your phone: it lands on your captain&rsquo;s screen. Shout too, why not.</>],
    ["Watch the TV", <>Questions, clocks, scores and reveals are on the TV. Your phone shows what you can do right now.</>],
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
export function Rules({ fixing = true }: { fixing?: boolean }) {
  return (
    <>
      <First30 />
      <Rule n="01" title="The setup">
        <L items={[
          <><B>Two teams</B>, any size. The TV is a laptop with the game open, put up big; everyone else joins on their phone with the code or the QR. Each team picks a <B>captain</B>: the captain gives the final answer, nobody else.</>,
          <>Want a host? One person taps <B>I&rsquo;m the host</B>: they see every answer and rule on it. No host? The app rules, and the captains can contest its calls (see <B>Fixing a call</B>).</>,
          <>Phones are for the game only: no searching, no asking anyone outside the room. A phone that leaves the game screen during a question is flagged on the TV.</>,
          <><B>4 to 12</B> standard rounds, one theme each, plus the mini-games on the card. Or no standard rounds at all: a night of mini-games back to back.</>,
        ]} />
      </Rule>

      <Rule n="02" title="A standard round">
        <L items={[
          <>One theme, one question for each team at the same difficulty. <B>Team A always answers first</B>, every round; then Team B gets their own question.</>,
          <><B>60 seconds.</B> The team sends ideas to the captain; the captain types the answer and sends it. <B>One go:</B> sent is locked. Typed but not sent when the clock runs out? What&rsquo;s in the box counts as sent (on every clock, mini-games too).</>,
          <>Wrong or out of time? The other team can <B>steal</B>: <B>30 seconds</B>, no lifelines. A steal pays what the question was worth: 1 point, or 2 if Double Points was armed on it. <B>Both miss</B>, and nobody scores; the answer comes up and the night moves on.</>,
          <>The answer stays hidden until the question is finished, so a stealing team can never read it off a screen. One point per right answer, whoever gets it.</>,
        ]} />
      </Rule>

      <Rule n="03" title="Lifelines: three each, once each">
        <L items={[
          <><B>Call a Friend</B>: <B>30 seconds</B>. Before the captain speaks, tell the friend: no ChatGPT, no Google, no asking the room.</>,
          <><B>Double Dip</B>: two answers; either one right counts. Burned either way.</>,
          <><B>Double Points</B>: armed on the captain&rsquo;s phone before the round starts. Right: 2 points. Stolen from you: they get 2. With it armed you may use only one of the other two that round.</>,
          <>No lifelines on a steal, none after an answer is sent, and none in the mini-games.</>,
        ]} />
      </Rule>

      <Rule n="04" title="The mini-games">
        <p className="text-15 leading-relaxed text-[var(--color-ink-2)]">Chosen in Setup and announced at the start, they drop in between the rounds; the Battle always closes the night. Whoever wins one takes its points (Setup shows how many; the Battle is worth double). Won with legs to spare? The points are paid at once and you choose: keep playing for fun, or stop. Tied at the end? One more to settle it, or a point each. The host decides, or Team A&rsquo;s captain with no host. The app checks every typed answer; a call it got wrong can be contested on the reveal. With no host, a leg&rsquo;s reveal moves on by itself after 8 seconds (or sooner, with Next).</p>
        <L items={[
          <><B>Closest To Wins.</B> The same number question for both captains, <B>60 s</B> on the number pad. Closest takes the leg. 5 legs.</>,
          <><B>The Auction.</B> &ldquo;How many countries can you name?&rdquo; Captains bid up to 100, raise or pass; whoever holds the bid has <B>30 s</B> to name that many, out loud, counted by the host (or the other captain). Make it or lose it. 3 categories.</>,
          <><B>Don&rsquo;t Say the Same as Me.</B> &ldquo;Name a cheese.&rdquo; <B>20 s</B> to type one, hidden from each other. The app has a common word in mind: say it and you&rsquo;ve lost the leg. Your answer must be a real one for the prompt. Best of 7.</>,
          <><B>Guess the Map.</B> A map with no title, <B>60 s</B>. Type what it shows: the idea counts, not the wording. With a host, one hint per map. Best of 3.</>,
          <><B>Guess the Flag.</B> <B>15 s</B> to type the country. Best of 10.</>,
          <><B>Drop the Pin.</B> A landmark photo, <B>45 s</B>. Drop a pin on the world map on your phone, zoom right in, Lock in. The nearer pin takes the leg. Best of 7.</>,
          <><B>Guess the Airport.</B> A departures board, <B>30 s</B>: the destinations, the airlines and the language are the clues. The city is enough, unless it has more than one airport. Best of 5.</>,
          <><B>Majority Rules.</B> Everyone plays, on their own phone: 15 questions, four answers, <B>15 s</B> each, one tap and it&rsquo;s locked. No answer counts as wrong. Each team scores the share of its answers that are right, so a small team isn&rsquo;t at a disadvantage.</>,
          <><B>Guess the Cocktail or Dish.</B> The ingredients come up one every <B>3 s</B>, the giveaway last. Captain, hit <B>BUZZ</B> and type it in <B>10 s</B>. Wrong, and you&rsquo;re out of that one. Best of 5.</>,
          <><B>Battle of the Captains.</B> Captains only, the room says nothing. Ten questions each: <B>7 s</B> out loud with a host, <B>15 s</B> typed without. Best score takes double points; level is a buzzer tie-breaker. Always last.</>,
        ]} />
      </Rule>

      <Rule n="05" title="Winning">
        <L items={[
          <>Highest score after the last game takes the night: confetti on every screen, the night in a nutshell, then <B>Play again</B> or <B>Exit</B>.</>,
          <>Tie? <B>Sudden death</B>: one question, both captains, first to buzz answers, <B>10 s</B> to type it. Wrong, and the other captain can buzz. Repeats until somebody gets one.</>,
        ]} />
      </Rule>

      <Rule n="06" title="Your data">
        <L items={[
          <><B>No accounts.</B> Each phone gets an anonymous sign-in. No email, no phone number. A room keeps the names, teams, answers and scores for three days, then it&rsquo;s deleted; a sign-in unused for 7 days is deleted too.</>,
          <>The TV keeps the game in progress, and which questions it has played, in its own browser. Server: Supabase (EU, Ireland); site: Vercel. No ads, no trackers, nothing sold or shared.</>,
        ]} />
      </Rule>

      {fixing && <FixingACall />}
    </>);
}

/* when something needs changing: who taps what, and what happens if they don't */
export function FixingACall({ standalone = false }: { standalone?: boolean }) {
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
          <>Scores wrong? Either captain: <B>Team Members &rarr; Adjust the scores</B>. The other captain gets Agree or No; no answer in <B>20 seconds</B>, nothing changes.</>,
          <>A question nobody wants? Before anyone has answered it, either captain taps <B>Change the question</B> (or the flag, landmark, board, dish, map or prompt). The clock stops while the other captain decides. Agree, and a new one comes at the same level with a fresh clock; No, or no answer in 20 seconds, and it carries on.</>,
          <>Team A&rsquo;s captain moves the night on (Start, Next, the choices at a tie or a game decided early). If they haven&rsquo;t after a while, the other captain can.</>,
          <>Majority Rules: someone who has gone home comes off their team&rsquo;s list before Start, with the other captain&rsquo;s agreement.</>,
        ]} />
      </Rule>
      <Rule n="D" title="Phones and the TV">
        <L items={[
          <><B>Phone died?</B> Join again with the same name and tap &ldquo;take my seat back&rdquo;. A host&rsquo;s or a captain&rsquo;s seat only frees up once that phone has been silent for a minute and a half, so nobody can take it by typing the name.</>,
          <><B>Captain gone?</B> After a while the armband passes to a teammate who is still here. <B>Host gone?</B> The captains run the night meanwhile; the host picks it back up on return.</>,
          <><B>The TV&rsquo;s Wi-Fi dropped, or its screen went to sleep?</B> The clocks stand still until it&rsquo;s back; nothing times out meanwhile. A TV reloaded or reopened picks the night up where it was.</>,
          <><B>No peeking, no pasting.</B> A phone that leaves the game screen during a question, or pastes an answer, is flagged on the TV; the host sees the list.</>,
          <><B>The TV laptop died?</B> The host taps <B>Team Members &rarr; The TV died? &rarr; Get a code</B>. On another laptop, open the site, tap <B>Take over as the TV</B>, and type the room code and that code: the night carries on from the TV&rsquo;s last save.</>,
          <>A new version of the game waits for the night to end before any screen reloads itself.</>,
        ]} />
      </Rule>
    </>);
}
