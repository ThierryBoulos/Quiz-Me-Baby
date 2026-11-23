/* How long tonight's game should take, for the Setup screen's small print (the owner, 14 Nov): from what's picked and
   the TV's timers, with time for reveals, rulings, intros and a buffer. Nobody uses every clock to the end, so each
   timer counts for part of its length; and it's a range, not one number. Seconds throughout; the line is in minutes. */
import { DEFAULTS, type Settings } from "./settings";
import { quizSizes } from "./many/logic";

/* how much of a clock a question takes, on the whole: two teams answer when they're ready; with many, the slowest counts */
const PART_TWO = 0.55, PART_MANY = 0.7;
/* a game's rules screen before it, and its result after */
const INTRO = 35, RESULT = 25;
/* the night's own intro, and its end (the final, the awards, the recap) */
const NIGHT = 75 + 150;
/* chatter, a phone reconnecting, a call argued over */
const BUFFER = 1.1;

/* each game: how many questions (legs), and the time one takes (its clock, a reveal, the next one) */
type Leg = { n: number; t: (s: Settings, part: number, over: number) => number };
const timed = (n: number, clock: (s: Settings) => number, over = 1): Leg => ({ n, t: (s, part, o) => clock(s) * part + o * over });
const TWO: Record<string, Leg> = {
  /* (2 teams play 5 of Closest To Wins, 7 of Don't Say the Same and 5 recipes, PARTY_LEGS: it counted 7, 9 and 7, 23 Nov) */
  closest: timed(5, (s) => s.tMini),
  auction: { n: 3, t: () => 100 },                                   // bids back and forth, then naming them, and the count
  saysame: timed(7, (s) => s.tSay),
  map: timed(3, (s) => s.tMap),
  flag: timed(10, (s) => s.tFlag),
  dish: { n: 5, t: (s, _p, o) => s.tDishStep * 7 + s.tDishType * 0.6 + o },   // the ingredients come in until someone calls it (5 recipes: PARTY_LEGS)
  pin: timed(7, (s) => s.tPin),
  airport: timed(5, (s) => s.tAirport),
  majority: timed(10, (s) => s.tMajority, 0.6),
  see: timed(12, (s) => s.tSee),
  fool: { n: 6, t: (s, p, o) => s.tFoolWrite * p + s.tFoolPick * p + 25 + o },   // write a lie, pick the truth, the reveal
  roulette: { n: 3, t: (s, p, o) => 10 + s.tRoulette * p + o },      // the spin, then each team's chamber
  stakes: { n: 3, t: (s, p, o) => s.tStakesPick * p + s.tStakesQ * p + o },
};
const MANY: Record<string, Leg> = {
  quiz: timed(4, (s) => s.tQuestion),
  majority: timed(10, (s) => s.tMajority, 0.6),
  flag: timed(10, (s) => s.tFlag),
  airport: timed(6, (s) => s.tAirport),
  map: timed(6, (s) => s.tMap),
  closest: timed(5, (s) => s.tMini),
  pin: timed(7, (s) => s.tPin),
  say: timed(6, (s) => s.tSay),
  dish: { n: 5, t: (s, _p, o) => s.tDishStep * 7 + s.tDishType * 0.6 + o },
  see: timed(12, (s) => s.tSee),
  fool: { n: 6, t: (s, p, o) => s.tFoolWrite * p + s.tFoolPick * p + 30 + o },
  roulette: { n: 3, t: (s, p, o) => 10 + s.tRoulette * p + o },
  stakes: { n: 3, t: (s, p, o) => s.tStakesPick * p + s.tStakesQ * p + o },
};
const game = (L: Leg, s: Settings, part: number, over: number) => INTRO + L.n * L.t(s, part, over) + RESULT;

/* two teams: the standard rounds (a question each, and a steal now and then), the mini-games, the Battle */
export function estimateTwo(o: { standard: boolean; rounds: number; minis: string[]; host: boolean; timers?: Partial<Settings> }): number {
  const s = { ...DEFAULTS, ...(o.timers || {}) }, over = 20 + (o.host ? 0 : 8);     // with no host, a moment for the other captain's say
  const question = s.tQuestion * PART_TWO + over + 0.4 * (s.tSteal * PART_TWO + 12);
  let t = NIGHT + (o.standard ? o.rounds * (15 + 2 * question + 15) : 0);
  for (const k of o.minis) {
    if (k === "battle") t += INTRO + 20 * ((o.host ? s.tBattleHost : s.tBattleTyped) * 0.75 + 3) + 100 + RESULT;   // ten each, the handoff, the review
    else if (TWO[k]) t += game(TWO[k], s, PART_TWO, over);
  }
  return t * BUFFER;
}
/* three to eight teams (always a host): every team answers every question; the more teams, the longer each reveal */
export function estimateMany(o: { minis: string[]; rounds: number; teams: number; timers?: Partial<Settings> }): number {
  const s = { ...DEFAULTS, ...(o.timers || {}) }, over = 25 + 1.5 * Math.max(0, o.teams - 2);
  let t = NIGHT;
  for (const k of o.minis) {
    if (k === "quiz") for (const n of quizSizes(o.rounds)) t += game({ ...MANY.quiz, n }, s, PART_MANY, over);   // the rounds play two at a time, an odd one with the last pair
    else if (MANY[k]) t += game(MANY[k], s, PART_MANY, over);
  }
  return t * BUFFER;
}

/* the line: a range around the estimate (12% either side), to the nearest five minutes: "50 min–1h05", "1h10–1h25" */
const hm = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`);
export function timeLine(seconds: number): string {
  const lo = Math.max(5, Math.floor((seconds * 0.88) / 60 / 5) * 5), hi = Math.max(lo + 5, Math.ceil((seconds * 1.12) / 60 / 5) * 5);
  const span = lo < 60 && hi < 60 ? `${lo}–${hi} min` : `${hm(lo)}–${hm(hi)}`;
  return `Game time: about ${span}`;
}
