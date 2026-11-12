/* The night's intro (the owner, 1 Nov): before the first round, the TV shows the plan. The tracker's dots
   (question rounds) and dashes (mini-games) big across the top; then, one by one, each round lights up with
   its theme, and each mini-game with its name and what it is; then how to win. A host can talk over it, and it
   explains itself without one. The host (with no host, the lead captain) taps Let's go. Both modes. */
export type IntroItem = { kind: "q" | "mini"; key: string; game: string; title: string; themes?: string[]; rounds?: number[] };   // key: unique; game: which game; rounds: 3-8 teams, the round numbers a game plays
export type IntroPub = {
  items: IntroItem[];            // the night in order (the tracker's order)
  many?: boolean;                // 3 to 8 teams: games are scored by places
  teams: number;
  miniPts?: number; battlePts?: number;   // two teams: what a mini-game (and the Battle) pays its winner
  go?: number | null;            // no host: the team whose captain taps Let's go (null: the host does)
};
/* what each game is, in a line (the TV's intro; the long rules are in How to play) */
const TWO: Record<string, string> = {
  closest: "A number question. The nearest guess takes the leg.",
  auction: "Bid how many you can name, then name them against the clock.",
  saysame: "Give a real answer, but not the app's hidden word.",
  map: "A map with no title. Say what it shows.",
  flag: "Name the country from its flag.",
  pin: "A landmark photo. Pin it on the world map.",
  airport: "A departures board. Name the airport.",
  majority: "Everyone plays on their own phone. Four options, one tap.",
  dish: "Ingredients one at a time. Buzz and name it.",
  see: "A picture gets clearer. Know it? Buzz, say it out loud and type it.",
  roulette: "Spin the barrel: a theme and a question each. One chamber is the bullet.",
  battle: "Captains only, ten questions each.",
  stakes: "The night's last game: bet on a theme and a level, in secret.",
};
const MANY: Record<string, string> = {
  ...TWO,
  say: "Give a real answer nobody else gives, and not the app's word.",
  dish: "Ingredients one at a time. The faster right, the more points.",
};
export const introLine = (key: string, many?: boolean) => (many ? MANY : TWO)[key] || "";
/* when each item lights up (seconds from the start): the rounds first, then the mini-games, then the footer */
export function introTimes(items: IntroItem[]) {
  const T0 = 1.1, STEP_Q = 0.5, GAP = 0.6, STEP_M = 0.95;
  const qs = items.filter((x) => x.kind === "q"), ms = items.filter((x) => x.kind === "mini");
  const at: Record<string, number> = {};
  qs.forEach((x, i) => { at[x.key] = T0 + 0.4 + i * STEP_Q; });
  const mStart = qs.length ? T0 + 0.4 + qs.length * STEP_Q + GAP : T0;
  ms.forEach((x, i) => { at[x.key] = mStart + 0.4 + i * STEP_M; });
  const end = (ms.length ? mStart + 0.4 + ms.length * STEP_M : mStart) + 0.5;
  return { at, qHead: T0, mHead: mStart, end };
}
