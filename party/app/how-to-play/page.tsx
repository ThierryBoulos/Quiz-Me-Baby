import Link from "next/link";
import type { ReactNode } from "react";

/* HOW TO PLAY — Classic's rules (index.html, SCREENS.rules), section for
   section, with the wording changed only where phones change the game. */
function Rule({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <section className="card flex flex-col gap-3">
      <div className="flex items-baseline gap-3"><span className="eyebrow" style={{ color: "var(--color-gold)" }}>{n}</span><h2 className="display text-[26px]">{title}</h2></div>
      {children}
    </section>);
}
const L = ({ items }: { items: ReactNode[] }) => (
  <ol className="flex flex-col gap-2.5 text-[15px] leading-relaxed text-[var(--color-ink-2)] list-decimal pl-5 marker:text-[var(--color-gold)] marker:font-bold">
    {items.map((x, i) => <li key={i}>{x}</li>)}
  </ol>);
const B = ({ children }: { children: ReactNode }) => <strong className="text-[var(--color-ink)]">{children}</strong>;

export default function HowToPlay() {
  return (
    <main className="screen !max-w-[720px]">
      <header className="flex items-end justify-between gap-3">
        <div><div className="eyebrow" style={{ color: "var(--color-gold)" }}>How to Play</div><h1 className="display text-[40px]">How the night works</h1></div>
        <Link className="btn btn-sm btn-ghost" href="/">Back</Link>
      </header>

      <Rule n="01" title="The setup">
        <L items={[
          <><B>Two teams</B>, as many players each as you like. One screen everyone can see is the TV: tap <B>Play</B> on it. Everyone else joins on their phone with the code or the QR.</>,
          <>Each team picks a <B>captain</B> on their phone. The captain gives the final answer. Nobody else. If the captain hasn&rsquo;t sent it, it hasn&rsquo;t been said.</>,
          <>Want a host? One person taps <B>I&rsquo;m the host</B>. They see every answer and judge. No host? The app checks the answers and the captains referee each other.</>,
          <>Settle who goes first by chance, not by argument. Coin toss, rock paper scissors, anything, as long as it&rsquo;s luck. The winner chooses Team A, who answers first every round, or Team B, who gets the first steal.</>,
          <>Phones are for the game only. No searching, no asking anyone outside the room.</>,
          <>Between <B>4 and 12</B> standard rounds, one theme each, plus however many mini-games are on the card. Or switch the standard rounds off in Setup for a night of nothing but mini-games, back to back.</>,
        ]} />
      </Rule>

      <Rule n="02" title="A standard round">
        <L items={[
          <>One theme per round. One question for each team, always the same kind of question at the same difficulty.</>,
          <>Team A gets their question. <B>60 seconds.</B> The captain types the answer and sends it; the team can send suggestions to the captain.</>,
          <>Wrong or out of time? Team B can steal it, <B>30 seconds</B>, no lifelines on a steal.</>,
          <>The answer stays hidden until the question is finished, so a stealing team can never read it off a screen.</>,
          <>Then Team B gets their own question, with Team A stealing. One point per correct answer, whoever gets it.</>,
        ]} />
      </Rule>

      <Rule n="03" title="Lifelines: three each, once each">
        <L items={[
          <><B>Call a Friend</B>: 30 seconds. Before the captain speaks, tell the friend: no ChatGPT, no Google, no asking the room.</>,
          <><B>Double Dip</B>: two answers. Either one right counts. Burned either way.</>,
          <><B>Double Points</B>: armed on the captain&rsquo;s phone before the round starts. Once the question is up, it&rsquo;s too late.</>,
          <>With Double Points armed you may use only one of the other two that round. Miss it, and a steal is worth 2 to the other team.</>,
          <>No lifelines on a steal, and none in the mini-games.</>,
        ]} />
      </Rule>

      <Rule n="04" title="The mini-games">
        <L items={[
          <>Chosen in Setup and announced at the start, not sprung on you. They drop in between the standard rounds; the Battle always closes the night.</>,
          <>Each is worth 2 to 4 points to whoever wins it. No lifelines in any of them.</>,
        ]} />
      </Rule>

      <Rule n="05" title="Closest To Wins">
        <L items={[
          <>Both captains get the same number question. <B>90 seconds</B> to lock in one number on the phone.</>,
          <>The app shows both on the TV with the real answer. Closest takes the leg; level is a point each.</>,
          <>Most legs wins. Still level? A tie-breaker question comes straight out.</>,
        ]} />
      </Rule>

      <Rule n="06" title="The Auction">
        <L items={[
          <>3 categories: &ldquo;How many countries can you name?&rdquo;</>,
          <>The captains bid on their phones: raise, or pass. Whoever is left holding the bid has <B>30 seconds</B> to name that many, out loud.</>,
          <>The host counts on their phone. No host? The other captain counts. They have every reason to be strict.</>,
          <>Make it and you take the category; fall short and the other team takes it. Most of the 3 wins.</>,
        ]} />
      </Rule>

      <Rule n="07" title="Don't Say the Same as Me">
        <L items={[
          <>A prompt: &ldquo;Name a cheese.&rdquo; <B>20 seconds</B> for both captains to type an answer, hidden from each other.</>,
          <>The app already has a word in mind. Matching each other is fine; only matching the app costs you.</>,
          <>Dodged it while the other team didn&rsquo;t? You take the leg. Both dodged, or both said it? A point each. Most of 9 legs wins.</>,
        ]} />
      </Rule>

      <Rule n="08" title="Guess the Map">
        <L items={[
          <>A map goes up, no title, on the TV and every phone. <B>60 seconds.</B> Both captains type what it shows.</>,
          <>The idea counts, not the exact wording. The host rules; with no host, each captain rules on the other team&rsquo;s answer.</>,
          <>One hint per map (the host&rsquo;s button): the map&rsquo;s subject. Best of 3.</>,
        ]} />
      </Rule>

      <Rule n="09" title="Guess the Flag">
        <L items={[
          <>A flag goes up. <B>15 seconds.</B> Both captains type the country; names come up as you type.</>,
          <>The app checks them, and the host (or the other captain) can overrule. Both right is a point each. Best of 10.</>,
        ]} />
      </Rule>

      <Rule n="10" title="Guess the Cocktail or Dish">
        <L items={[
          <>The ingredients come up one at a time, a new one every 3 seconds, the giveaway last.</>,
          <>Know it? Captain, hit <B>BUZZ</B>. The first buzz answers. Wrong, and you&rsquo;re out of that one; the list keeps coming for the other team.</>,
          <>Best of 7. Level at the end? One more, or a point each.</>,
        ]} />
      </Rule>

      <Rule n="11" title="Battle of the Captains">
        <L items={[
          <>Captains only. The room says nothing, and that means nothing.</>,
          <>Ten questions each, one captain at a time: <B>7 seconds</B> a shot out loud with a host, or <B>15 seconds</B> typed with no host.</>,
          <>Best score wins. Level after twenty? A buzzer question, first captain in takes it. It always runs last.</>,
        ]} />
      </Rule>

      <Rule n="12" title="Winning">
        <L items={[
          <>Highest score after the last round takes the night.</>,
          <>Tie? <B>Sudden death</B>: one question, both captains, first to buzz answers. Wrong, and the other captain can buzz. Repeats until somebody gets one.</>,
        ]} />
      </Rule>

      <Rule n="13" title="The phones">
        <L items={[
          <><B>The TV</B> is the show: questions, clocks, scores, reveals. It never shows an answer early.</>,
          <><B>The host&rsquo;s phone</B> shows the answer and what the captain typed, with the app&rsquo;s opinion, then Right or Wrong.</>,
          <><B>The captain&rsquo;s phone</B> sends the answers, the bids, the buzzes and the lifelines.</>,
          <><B>Everyone else</B> sees the question and can send the captain a suggestion.</>,
          <><B>No host?</B> The app checks every answer, and the other captain has 15 seconds to agree or overrule. Team A&rsquo;s captain taps Start and Next to move the night on.</>,
          <><B>No peeking.</B> A phone that leaves the game screen during a question (another app, a search) is flagged on the TV, and the host sees the list.</>,
          <>Phone died? Join again with the same name and tap &ldquo;take my seat back&rdquo;.</>,
        ]} />
      </Rule>

      <Link className="btn btn-gold btn-lg btn-block" href="/">Right, start a game</Link>
    </main>
  );
}
