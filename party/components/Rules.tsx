import type { ReactNode } from "react";

/* HOW TO PLAY, in the owner's own words (8 Nov: "This is how they should be written. Follow my wording going
   forward"). Don't reword it: propose the exact change to the owner first. Two parts: the night (How to Play, and the
   lobby while people wait), and WHEN THINGS GO WRONG (its own page, and the lobby after the night). */
function Rule({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <section className="card flex flex-col gap-3">
      <div className="flex items-baseline gap-3"><span className="eyebrow" style={{ color: "var(--color-gold)" }}>{n}</span><h2 className="display text-26">{title}</h2></div>
      {children}
    </section>);
}
const P = ({ children }: { children: ReactNode }) => <p className="text-15 leading-relaxed text-[var(--color-ink-2)]">{children}</p>;
const B = ({ children }: { children: ReactNode }) => <strong className="text-[var(--color-ink)]">{children}</strong>;
const Sub = ({ children }: { children: ReactNode }) => <h3 className="text-16 font-bold text-[var(--color-ink)] mt-1">{children}</h3>;
const UL = ({ items }: { items: ReactNode[] }) => (
  <ul className="flex flex-col gap-2 text-15 leading-relaxed text-[var(--color-ink-2)] list-disc pl-5 marker:text-[var(--color-gold)]">
    {items.map((x, i) => <li key={i}>{x}</li>)}
  </ul>);
const OL = ({ items }: { items: ReactNode[] }) => (
  <ol className="flex flex-col gap-2 text-15 leading-relaxed text-[var(--color-ink-2)] list-decimal pl-5 marker:text-[var(--color-gold)] marker:font-bold">
    {items.map((x, i) => <li key={i}>{x}</li>)}
  </ol>);
/* a mini-game: its name in bold, then its line */
const Mini = ({ name, children }: { name: string; children: ReactNode }) => <P><B>{name}:</B> {children}</P>;

/* the night: on How to Play, and in the lobby while people wait */
export function Rules({ fixing = true, noTv = false }: { fixing?: boolean; noTv?: boolean }) {
  return (
    <>
      <section className="card flex flex-col gap-3" style={{ borderColor: "rgba(245,197,24,.5)" }}>
        <P>Welcome to Quiz Me Baby! Get your team together, go head-to-head against the others, and see who comes out on top.</P>
        <P>The night is made up of different types of games: standard trivia rounds and mini-games. Trivia tests your knowledge across different themes, while mini-games bring a variety of challenges, from guessing and bidding to quick-fire questions.</P>
        <P>You decide how to build your night. Play trivia and mini-games together, or choose just one type. As you play, your team earns points. The goal is simple: finish with the highest score and take the top spot!</P>
        <P>You can play with 2–8 teams, using a TV as your main screen or just your phones. Each team chooses a captain to submit its final answers, while teammates can suggest answers from their own phones.</P>
        <P><B>Ready? Here’s how to get started.</B></P>
      </section>

      <Rule n="1" title="Get everyone in">
        <P>Open Quiz Me Baby on the main screen if you’re using a TV or laptop. Everyone else joins using the game code or QR code.</P>
        <P>You can play with 2–8 teams. Each team chooses a captain, who submits the team’s final answers. Teammates can suggest answers from their own phones, and those suggestions appear on the captain’s screen.</P>
        <P>If you’re playing with 2 teams, having a host is optional. With 3–8 teams, a host is required. The host follows the game on their phone and can review answers and make decisions when needed.</P>
      </Rule>

      <Rule n="2" title="Set up your night">
        <P>The host (or Captain A) decides how you want to play:</P>
        <UL items={[
          <><B>Standard trivia rounds:</B> Choose up to 12 rounds, each with its own themes.</>,
          <><B>Mini-games:</B> Pick the mini-games you want to include. They’ll be played between standard rounds.</>,
          <><B>Mix and match:</B> You can play with both or choose either one.</>,
        ]} />
        <P>You can also adjust the default timings in Settings → Timers on the TV screen.</P>
        <P><B>Scoring with 3–8 teams:</B> Throughout the night, teams are ranked in each game, earning 10 points for 1st place, 8 for 2nd, then 6, 5, 4, 3, 2 and 1 point respectively. Teams tied for a position share the points for the higher-ranked place; incorrect answers earn no points, and the fastest correct answer gets the highest score.</P>
      </Rule>

      <Rule n="3" title="Standard trivia rounds">
        <P>Each round has a theme, and teams compete to answer questions and earn points. Every question has a 60-second timer. Your team discusses the answer, and the captain submits the final response before time runs out.</P>
        <Sub>Playing with 2 teams:</Sub>
        <P>Teams take turns answering different questions at the same difficulty. If a team answers incorrectly or runs out of time, the other team gets 30 seconds to steal the point. If both teams miss, nobody scores.</P>
        <P>You can also use lifelines to give your team an advantage. Lifelines cannot be used on a steal or during mini-games, and each can be used once.</P>
        <UL items={[
          <><B>Call a Friend:</B> Get 30 extra seconds to call someone for help.</>,
          <><B>Double Dip:</B> Submit two answers instead of one. Either answer being correct earns the points.</>,
          <><B>Double Points:</B> Activate this on the captain’s phone before the round starts. A correct answer earns double points. If your opponent steals the question, they get the 2 points instead.</>,
        ]} />
        <Sub>Playing with 3–8 teams:</Sub>
        <P>All teams receive the same question and answer simultaneously within 60 seconds. There are no steals or lifelines—just a straight-up trivia showdown.</P>
      </Rule>

      <Rule n="4" title="Mini-games">
        <P>Mini-games are selected during setup and appear between trivia rounds.</P>
        <Mini name="Closest To Wins">Teams get the same number-based question and have 60 seconds to enter their estimates. The closest answer wins the leg. Best of 5.</Mini>
        <Mini name="The Auction">2-team setup only. The question is something like: “How many countries can you name?” Captains take turns bidding, raising the number or passing. The highest bidder has 30 seconds to name that many answers aloud. The host or the other captain counts them. Make your bid and you win the leg; fail and you lose it. Best of 3.</Mini>
        <Mini name="Don’t Say the Same as Me">You’ll be given a prompt such as “Name a cheese.” Each team has 20 seconds to secretly enter one answer. The app has an answer in mind. If your answer matches the app’s answer, you lose the point. With 3–8 teams, matching another team’s answer loses it too. Answers must be real and valid. Best of 7.</Mini>
        <Mini name="Guess the Map">A map appears without its title. You have 60 seconds to identify what it represents and type your answer. The general idea counts, not necessarily the exact wording. Best of 3.</Mini>
        <Mini name="Guess the Flag">Identify the country or region shown by typing its name within 15 seconds. Best of 10.</Mini>
        <Mini name="Drop the Pin">A landmark photo appears. You have 45 seconds to find the location on the world map on your phone, zoom in and lock in your pin. The closest pin wins. Best of 7.</Mini>
        <Mini name="Guess the Airport">A departures board appears. You have 30 seconds to identify the airport using clues such as destinations, airlines and language. Naming the city is enough unless it has more than one airport. Best of 5.</Mini>
        <Mini name="Majority Rules">Everyone plays individually on their own phone. Answer 15 questions, each with four options and 15 seconds to choose. Tapping an answer locks it in. No answer counts as wrong. Each team’s score is based on the percentage of its members’ answers that are correct, so smaller teams aren’t disadvantaged.</Mini>
        <Mini name="Guess the Cocktail or Dish">Ingredients appear one at a time, every 3 seconds, with the giveaway ingredient appearing last. The fastest team to answer wins. With 3–8 teams, each team gets one guess. Best of 5.</Mini>
        <Mini name="Battle of the Captains">2-team setup only. The captains go head-to-head. Everyone else stays quiet. Each captain gets 10 questions. With a host, answers are given aloud within 7 seconds; without a host, captains type their answers within 15 seconds. The captain with the highest score wins double points. This is always the last mini-game.</Mini>
        <P>In a 2-team setup, if the game is tied, you can play one more to settle it or award a point to each team.</P>
      </Rule>

      <Rule n="5" title="Who wins?">
        <P>The team with the highest score at the end wins. If there’s a tie, it’s time for sudden death: the tied teams’ captains get one question at a time, and the first to answer correctly wins.</P>
        <P>At the end, enjoy the confetti, check out the recap, and play again!</P>
      </Rule>

      <section className="card flex flex-col gap-3">
        <h2 className="display text-26">A few ground rules</h2>
        <P>No Googling, no searching, and no asking people outside the room. If a phone leaves the game screen during a question, the game flags it on the main screen.</P>
        <P>The app checks every typed answer. If you think a call is wrong, you can contest it when the answer is revealed.</P>
      </section>

      {fixing && <FixingACall noTv={noTv} />}
    </>);
}

/* when things go wrong: its own page (How to Play links to it), and the lobby after the night */
export function FixingACall({ standalone = false, noTv = false }: { standalone?: boolean; noTv?: boolean }) {
  return (
    <>
      {!standalone && <h2 className="display text-32 mt-2" style={{ color: "var(--color-gold)" }}>When things go wrong</h2>}
      {!standalone && <P>Disagree with an answer? Need to change a score? Someone’s phone died? Here’s how to sort things out and keep the game moving.</P>}

      <Rule n="01" title="Who decides?">
        <Sub>Playing with a host</Sub>
        <P>The host has the final say on answers.</P>
        <OL items={[
          <>The host’s phone displays the correct answer and the captain’s submitted answer, along with two buttons: <B>RIGHT</B> and <B>WRONG</B>.</>,
          <>The app automatically suggests a decision. The host can accept it or choose the other option.</>,
          <>A captain who disagrees can tap <B>Contest</B> on the result. The host makes the final decision.</>,
          <>The host can change a decision at any point before tapping <B>Next</B>.</>,
        ]} />
        <Sub>Playing without a host (2-team setup)</Sub>
        <P>The app checks answers automatically. Captains can challenge certain decisions:</P>
        <OL items={[
          <>Where a decision can be challenged, tap <B>Contest</B> on the result. This applies to your team’s answers marked WRONG or the other team’s answers marked RIGHT.</>,
          <>The other captain gets 15 seconds to respond with <B>Agree</B> or <B>No</B>.</>,
          <>If the other captain doesn’t respond within 15 seconds, the app’s original decision stands.</>,
        ]} />
        <P>If a contest changes the result, the score is automatically updated.</P>
      </Rule>

      <Rule n="02" title="Need to change something?">
        <Sub>Adjusting the score</Sub>
        <UL items={[
          <><B>With a host:</B> The host taps their name (top left) → <B>Adjust the scores</B>.</>,
          <><B>Without a host:</B> Either captain can tap their name (top left) → <B>Adjust the scores</B>. The other captain must agree to the change.</>,
          <>The other captain has 20 seconds to <B>Agree</B> or <B>No</B>. If they don’t respond, the scores remain unchanged.</>,
        ]} />
        <Sub>Changing a question</Sub>
        <P>Sometimes a question is repeated, an image is broken or you simply don’t like the question.</P>
        <UL items={[
          <><B>With a host:</B> The host can tap <B>Change question</B> before anyone answers.</>,
          <><B>Without a host:</B> Either captain can request a replacement before anyone has answered. This also applies to flags, landmarks, airport boards, cocktails, dishes, maps and other prompts. The clock pauses while the other captain decides.</>,
          <>A new question of comparable difficulty appears with a fresh timer.</>,
        ]} />
        <Sub>Pausing the game</Sub>
        <P>The host can pause any timer. Without a host, either captain can.</P>
      </Rule>

      <Rule n="03" title="Players and phones">
        <Sub>Phone disconnected or died?</Sub>
        <P>No problem. Rejoin the game using the same name and tap <B>Take my seat back</B>.</P>
        <Sub>The captain disconnected</Sub>
        <P>If a captain is gone for a while, the captain role automatically passes to a teammate who is still connected.</P>
        <Sub>The host disconnected</Sub>
        <P>In a 2-team setup, the captains can keep the game going while the host is away. In a 3-8-team setup, the game waits for the host. When the host reconnects, they can resume their role. If they’re gone for 90 seconds, anyone can tap Be the host and take over.</P>
        <Sub>Someone left during Majority Rules?</Sub>
        <P>Before starting the next set of questions, a player who has left can be removed from their team’s list.</P>
      </Rule>

      {/* (no TV tonight: nothing here applies, the owner, 8 Nov) */}
      {!noTv && <Rule n="04" title="The TV and connection">
        <Sub>The TV lost Wi-Fi or went to sleep</Sub>
        <P>The game pauses automatically. Timers stop, and no answers time out while the TV is disconnected. Once the TV reconnects, the game resumes.</P>
        <Sub>The TV page reloaded or closed</Sub>
        <P>Simply reopen the game on the TV. It will pick up from the last saved state.</P>
        <Sub>The TV laptop stopped working</Sub>
        <P>You can move the game to another laptop without losing your progress.</P>
        <OL items={[
          <>On the host’s phone (no host: either captain’s), tap their name (top left) → <B>The TV died?</B> → <B>Get a code</B>.</>,
          <>On the replacement laptop, open the Quiz Me Baby! website.</>,
          <>Select <B>Join a game</B>.</>,
          <>Scroll to the bottom and select <B>The TV died?</B>.</>,
          <>Enter the room code and the recovery code generated on the host’s phone. The game will resume from the TV’s last saved state.</>,
        ]} />
      </Rule>}

      <Rule n="05" title="Fair play">
        <P>Quiz Me Baby! is more fun when everyone plays fair.</P>
        <UL items={[
          <>No Googling or AI tools.</>,
          <>No asking people outside the game for answers.</>,
          <>Don’t leave the game screen during a question.</>,
          <>Don’t copy and paste answers.</>,
        ]} />
        <P>If a player leaves the game screen during a question or pastes an answer, the activity is flagged on the TV. The host can review the list.</P>
      </Rule>

      <section className="card flex flex-col gap-3">
        <h2 className="display text-26">Still having trouble?</h2>
        <P>Ask the host to pause the game while you sort things out. No host? Get both captains to agree on how to proceed.</P>
      </section>
    </>);
}
