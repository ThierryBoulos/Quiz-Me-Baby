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

/* the rules themselves: on How to Play, and in the lobby while people wait */
export function Rules() {
  return (
    <>
      <Rule n="01" title="The setup">
        <L items={[
          <><B>Two teams</B>, as many players each as you like. One screen everyone can see is the TV: tap <B>Create game</B> on it. Everyone else joins on their phone with the code or the QR.</>,
          <>Each team picks a <B>captain</B> on their phone. The captain gives the final answer. Nobody else. If the captain hasn&rsquo;t sent it, it hasn&rsquo;t been said.</>,
          <>Want a host? One person taps <B>I&rsquo;m the host</B>. They see every answer and rule on it. No host? The app checks the answers and the captains referee each other.</>,
          <>Settle who goes first by chance, not by argument. Coin toss, rock paper scissors, anything, as long as it&rsquo;s luck. The winner chooses Team A, who answers first, or Team B, who gets the first steal. (Settings can make the teams take turns going first.)</>,
          <>Phones are for the game only. No searching, no asking anyone outside the room.</>,
          <>Between <B>4 and 12</B> standard rounds, one theme each, plus however many mini-games are on the card. Or switch the standard rounds off in Setup for a night of nothing but mini-games, back to back.</>,
        ]} />
      </Rule>

      <Rule n="02" title="A standard round">
        <L items={[
          <>One theme per round. One question for each team, always the same kind of question at the same difficulty.</>,
          <>Team A gets their question: <B>60 seconds</B>. The team sends suggestions to the captain; the captain types the answer and sends it. <B>One go:</B> once it&rsquo;s sent it&rsquo;s locked, no changing it and no lifeline after it.</>,
          <>Wrong or out of time? Team B can steal it: <B>30 seconds</B>, no lifelines on a steal.</>,
          <>The answer stays hidden until the question is finished, so a stealing team can never read it off a screen.</>,
          <>Then Team B gets their own question, with Team A stealing. One point per correct answer, whoever gets it.</>,
        ]} />
      </Rule>

      <Rule n="03" title="Lifelines: three each, once each">
        <L items={[
          <><B>Call a Friend</B>: <B>30 seconds</B>. Before the captain speaks, tell the friend: no ChatGPT, no Google, no asking the room. The host (or Team A&rsquo;s captain, with no host) can pause the call.</>,
          <><B>Double Dip</B>: two answers. Either one right counts. Burned either way.</>,
          <><B>Double Points</B>: armed on the captain&rsquo;s phone before the round starts. Once the question is up, it&rsquo;s too late.</>,
          <>With Double Points armed you may use only one of the other two that round. Miss it, and a steal is worth 2 to the other team.</>,
          <>No lifelines on a steal, none after an answer is sent, and none in the mini-games.</>,
        ]} />
      </Rule>

      <Rule n="04" title="The mini-games">
        <L items={[
          <>Chosen in Setup and announced at the start, not sprung on you. They drop in between the standard rounds; the Battle always closes the night.</>,
          <>Each is worth 2 to 4 points to whoever wins it. No lifelines in any of them. A small &ldquo;This game&rdquo; score sits under the night&rsquo;s score while one is on.</>,
          <>Tied at the end of any of them? <B>One more to settle it, or a point each</B>: the host decides, or Team A&rsquo;s captain with no host.</>,
        ]} />
      </Rule>

      <Rule n="05" title="Closest To Wins">
        <L items={[
          <>Both captains get the same number question: <B>90 seconds</B> to lock in one number on the phone.</>,
          <>The real answer comes up with both guesses and how far off each one was. Closest takes the leg; level is a point each.</>,
          <>Most legs after 7 wins.</>,
        ]} />
      </Rule>

      <Rule n="06" title="The Auction">
        <L items={[
          <>3 categories: &ldquo;How many countries can you name?&rdquo;</>,
          <>The captains bid on their phones: raise, or pass. Whoever is left holding the bid has <B>30 seconds</B> to name that many, out loud.</>,
          <>The host counts with the +1 button on their phone. No host? The other captain counts. They have every reason to be strict.</>,
          <>Make it and you take the category; fall short and the other team takes it. Most of the 3 wins.</>,
        ]} />
      </Rule>

      <Rule n="07" title="Don't Say the Same as Me">
        <L items={[
          <>A prompt: &ldquo;Name a cheese.&rdquo; <B>20 seconds</B> for both captains to type an answer, hidden from each other.</>,
          <>The app already has a word in mind. Matching each other is fine; only matching the app costs you.</>,
          <>Dodged it while the other team didn&rsquo;t? You take the leg. Both dodged, or both said it? A point each. The host (or, with no host, the other captain) can change the app&rsquo;s DODGED IT or SAID IT. Best of 7.</>,
        ]} />
      </Rule>

      <Rule n="08" title="Guess the Map">
        <L items={[
          <>A map goes up, no title, on the TV and every phone: <B>60 seconds</B>. Tap <B>Enlarge</B> to see it full screen, then tap, pinch or drag to zoom in. Both captains type what it shows.</>,
          <>The idea counts, not the exact wording. The host rules RIGHT or WRONG; with no host, each captain rules on the other team&rsquo;s answer.</>,
          <>With a host, one hint per map (the host&rsquo;s button): the map&rsquo;s subject. Best of 3.</>,
        ]} />
      </Rule>

      <Rule n="09" title="Guess the Flag">
        <L items={[
          <>A flag goes up: <B>15 seconds</B>. Both captains type the country, no list of names to pick from.</>,
          <>The app checks them, and the host (or the other captain) can change the call. Both right is a point each. Best of 10.</>,
        ]} />
      </Rule>

      <Rule n="10" title="Guess the Cocktail or Dish">
        <L items={[
          <>The ingredients come up one at a time, a new one every <B>3 seconds</B>, the giveaway last.</>,
          <>Know it? Captain, hit <B>BUZZ</B>. The first buzz answers, and has <B>10 seconds</B> to type it. Wrong or out of time, and you&rsquo;re out of that one; the list keeps coming for the other team.</>,
          <>Best of 5.</>,
        ]} />
      </Rule>

      <Rule n="11" title="Battle of the Captains">
        <L items={[
          <>Captains only. The room says nothing, and that means nothing.</>,
          <>Ten questions each, one captain at a time: <B>7 seconds</B> a shot out loud with a host, or <B>15 seconds</B> typed with no host. The TV shows each answer once it&rsquo;s settled.</>,
          <>Best score wins. It always runs last.</>,
        ]} />
      </Rule>

      <Rule n="12" title="Winning">
        <L items={[
          <>Highest score after the last round takes the night: confetti on every screen, then <B>Exit</B> sends everyone back to the home screen.</>,
          <>Tie? <B>Sudden death</B>: one question, both captains, first to buzz answers (<B>30 seconds</B> to buzz with no host). Wrong, and the other captain can buzz. Repeats until somebody gets one.</>,
        ]} />
      </Rule>

      <Rule n="13" title="The phones">
        <L items={[
          <><B>The TV</B> is the show: questions, clocks, scores, reveals. It never shows an answer early.</>,
          <><B>The host&rsquo;s phone</B> shows the answer and what the captain typed. Once the team has answered, two buttons, <B>RIGHT</B> and <B>WRONG</B>: the app&rsquo;s call is already picked (&ldquo;App suggests&rdquo;), and the other button changes it.</>,
          <><B>The captain&rsquo;s phone</B> sends the answers, the bids, the buzzes and the lifelines.</>,
          <><B>Everyone else</B> sees the question and can send the captain a suggestion.</>,
          <><B>No host?</B> The app checks every answer, and the other captain has <B>15 seconds</B> (8 in the Battle) to tap RIGHT or WRONG to change the call. Team A&rsquo;s captain taps Start and Next to move the night on (the other captain can, after a while).</>,
          <><B>No peeking, no pasting.</B> A phone that leaves the game screen during a question (another app, a search), or tries to paste an answer, is flagged on the TV, and the host sees the list.</>,
          <>Phone died during the game? Join again with the same name and tap &ldquo;take my seat back&rdquo;. A screen left open through an update refreshes itself between questions, and the night carries on.</>,
        ]} />
      </Rule>
    </>);
}
