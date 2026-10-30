/* MANY TEAMS (3 to 8), phase 1: the night's rules, pure. No React, no network: the TV's hook
   (lib/many/useTvMany.ts) feeds it taps and the clock, the simulator (sim/many.mjs) feeds it bots.
   Nothing here is shared with the two-team game but the matcher and the distance (engine/core.js).
   Always with a host. Every game simultaneous, judged by the app (the host can flip a typed answer's call):
   Majority Rules, Guess the Flag, Closest To Wins, Drop the Pin; and (phase 2, 30 Oct) question rounds, Guess
   the Airport, Guess the Map, Don't Say the Same as Me (an answer scores only if no other team said it too) and
   Guess the Cocktail or Dish (a race: one guess a team, the first right ends it).
   Points by place (the owner's pick, 30 Oct: one winner taking 2 left 2nd and 8th level). Every question ranks
   the teams and pays this game's tally by place: with 8 teams the nearest (Closest, Pin) or the first right
   (Flags: the fastest typist) takes 8, the next 7, down to 1; wrong or no answer, nothing. Majority Rules ranks
   by the share of answers right. At the end of a game its places pay the night: 10, 8, 6, 5, 4, 3, 2, 1
   (3 teams: 10, 8, 6). Level teams share the better place. */
import { QMB, acceptFor, mapHit, mapKeysFor } from "../engine";
import { matchQ } from "../tv/reads";

export const MANY_MINIS = ["quiz", "majority", "flag", "airport", "map", "closest", "pin", "say", "dish"] as const;
/* sudden death isn't picked: it comes when the night ends with teams level at the top */
export type ManyKey = (typeof MANY_MINIS)[number] | "sudden";
export const MANY_TITLES: Record<ManyKey, string> = { sudden: "Sudden death", quiz: "Question round", majority: "Majority Rules", flag: "Guess the Flag", airport: "Guess the Airport", map: "Guess the Map",
  closest: "Closest To Wins", pin: "Drop the Pin", say: "Don't Say the Same as Me", dish: "Guess the Cocktail or Dish" };
export const MANY_LEGS: Record<ManyKey, number> = { sudden: 6, quiz: 6, majority: 15, flag: 10, airport: 6, map: 6, closest: 5, pin: 7, say: 6, dish: 5 };
/* the games where each captain types one answer (the app calls it, the host can flip the call) */
export const TYPED: readonly ManyKey[] = ["quiz", "flag", "airport", "map", "say", "dish", "sudden"];
export const typedKey = (k: ManyKey | undefined) => !!k && TYPED.includes(k);
/* a game's name on screen: the question rounds numbered when there's more than one */
export const titleOf = (minis: { key: ManyKey }[], i: number) => {
  const key = minis[i]?.key; if (!key) return "";
  const rounds = minis.filter((m) => m.key === "quiz").length;
  return key === "quiz" && rounds > 1 ? `Question round ${minis.slice(0, i + 1).filter((m) => m.key === "quiz").length}` : MANY_TITLES[key];
};
export const MANY_MIN = 3, MANY_MAX = 8, MANY_PLAYERS = 60;
/* what a game's places pay the night (1st, 2nd, ...); fewer teams take the top of the same table */
export const PLACE_PTS = [10, 8, 6, 5, 4, 3, 2, 1];
/* team colours: Team A's cyan and Team B's pink exactly (--color-a, --color-b), then six more that sit apart
   from each other and from the show's gold, the green of RIGHT and the red of WRONG; a letter in every dot too
   (colour-blind). A canvas can't read CSS variables, so they're hex. */
export const MANY_COLORS = ["#31c9f7", "#ff4d82", "#7ce35b", "#ff9a3c", "#a97cff", "#5b8cff", "#2dd4bf", "#e879f9"];
export const LETTERS = "ABCDEFGH";
export const defaultName = (t: number) => "Team " + LETTERS[t];

/* eslint-disable @typescript-eslint/no-explicit-any */
type Q = any;
export type LatLon = { lat: number; lon: number };
export type TeamM = { name: string; captain: string; score: number };
/* wins: legs taken (flag: legs right); pts: this game's place points so far; places: its final places */
export type MiniM = { key: ManyKey; qs: Q[]; i: number; wins: number[]; right: number[]; of: number[]; pts: number[]; award?: number[]; places?: number[];
  only?: number[] };                              // sudden death: the teams level at the top, the only ones who answer
/* the night's numbers for the awards: legs placed 1st and 2nd, the fastest right flags, Drop the Pin's km
   (and how many pins), the run of 1st places now (on fire at 3; a new game starts cold) and the best run */
export type Stats = { firsts: number[]; seconds: number[]; fastest: number[]; km: number[]; kmN: number[]; run: number[]; best: number[] };
export type Screen = "intro" | "q" | "reveal" | "summary" | "final";
export type StateM = {
  v: 2; teams: TeamM[]; minis: MiniM[]; mi: number; screen: Screen; step: number;
  deadline: number | null; left: number; total: number;
  typed: (string | null)[]; nums: (number | null)[]; pins: (LatLon | null)[];
  why: (string | null)[];                       // Don't Say the Same: why an answer doesn't score ("said", "off", "same")
  shown: number;                                // the Cocktail or Dish: the ingredients up so far
  at: (number | null)[]; seq: number;           // the order this leg's answers came in (Flags: the fastest right first)
  ok: (boolean | null)[];                       // this leg's call per team (the app's, then the host's)
  roster: { name: string; team: number }[];     // Majority Rules: who plays (fixed at its start)
  votes: Record<string, string>;
  who: Record<string, { r: number; of: number; team: number }>;
  toast: { id: number; text: string } | null; toastN: number;
  exit?: boolean; log: number[][];            // the scores after each game, for the final chart
  spare: Q[];                                   // questions held back for sudden death
  stats: Stats;
};
/* seconds to answer (the Cocktail or Dish: each ingredient's, and the last one's) */
export type Timers = { sudden: number; quiz: number; flag: number; airport: number; map: number; closest: number; pin: number; majority: number; say: number; dish: number; dishLast: number };

const n = (k: number, v = 0) => Array.from({ length: k }, () => v);
export const miniOf = (s: StateM) => s.minis[s.mi] as MiniM | undefined;
export const qOf = (s: StateM) => { const m = miniOf(s); return m ? m.qs[m.i] : null; };

export function newNight(teams: { name: string; captain: string }[], decks: Partial<Record<ManyKey, Q[]>>, order: ManyKey[]): StateM {
  const k = teams.length;
  /* a game that comes more than once (the question rounds) takes the next questions of its deck each time */
  const used: Partial<Record<ManyKey, number>> = {};
  const minis: MiniM[] = order.map((key) => { const at = used[key] ?? 0; used[key] = at + MANY_LEGS[key];
    return { key, qs: (decks[key] || []).slice(at, at + MANY_LEGS[key]), i: 0, wins: n(k), right: n(k), of: n(k), pts: n(k) }; }).filter((m) => m.qs.length);
  return { v: 2, teams: teams.map((t) => ({ ...t, score: 0 })), minis, mi: 0, screen: minis.length ? "intro" : "final", step: 1,
    deadline: null, left: 0, total: 0, typed: Array(k).fill(null), nums: Array(k).fill(null), pins: Array(k).fill(null), ok: Array(k).fill(null), why: Array(k).fill(null), shown: 0,
    at: Array(k).fill(null), seq: 0, roster: [], votes: {}, who: {}, toast: null, toastN: 0, log: [n(k)], spare: (decks.sudden || []).slice(0, MANY_LEGS.sudden),
    stats: { firsts: n(k), seconds: n(k), fastest: n(k), km: n(k), kmN: n(k), run: n(k), best: n(k) } };
}

/* the night's order: the question rounds spread through it, one leading each run of the other games */
export function lineup(rounds: number, games: ManyKey[]): ManyKey[] {
  if (rounds <= 0) return games;
  const out: ManyKey[] = [], per = Math.ceil(games.length / rounds);
  for (let r = 0; r < rounds; r++) out.push("quiz", ...games.slice(r * per, (r + 1) * per));
  return out;
}
const clear = (s: StateM) => { const k = s.teams.length; s.typed = Array(k).fill(null); s.nums = Array(k).fill(null); s.pins = Array(k).fill(null); s.ok = Array(k).fill(null); s.why = Array(k).fill(null); s.at = Array(k).fill(null); s.votes = {}; s.shown = 1; };
const toast = (s: StateM, text: string) => { s.toast = { id: ++s.toastN, text }; };

/* the host taps Start on a game's intro: its first question */
export function startMini(s: StateM, now: number, t: Timers, roster: { name: string; team: number }[]) {
  const m = miniOf(s); if (!m || s.screen !== "intro") return false;
  if (m.key === "majority") s.roster = roster.filter((r) => r.team >= 0 && r.team < s.teams.length).slice(0, MANY_PLAYERS);
  s.stats.run = n(s.teams.length);                 // a new game starts cold
  ask(s, now, t); return true;
}
function ask(s: StateM, now: number, t: Timers) {
  const m = miniOf(s)!; clear(s);
  /* the Cocktail or Dish: an ingredient every few seconds, the last one with longer to think */
  s.total = m.key === "dish" ? Math.max(0, ((qOf(s)?.ings || []).length - 1)) * t.dish + t.dishLast : t[m.key];
  s.screen = "q"; s.deadline = now + s.total * 1000; s.left = 0; s.step++;
}
/* the Cocktail or Dish: how many ingredients are up at this moment (the clock's tick moves it on) */
export function dishShown(s: StateM, now: number, t: Timers): number {
  const q = qOf(s), n = (q?.ings || []).length; if (!n || !s.deadline) return n;
  const gone = s.total * 1000 - (s.deadline - now);
  return Math.max(1, Math.min(n, 1 + Math.floor(gone / (t.dish * 1000))));
}
/* is a typed answer right? The question rounds, flags, airports and dishes as the two-team game checks them
   (lib/tv/reads.ts); a map by its title and its short forms */
export function rightOf(key: ManyKey, text: string, q: Q): boolean {
  if (key === "map") return QMB.isMatch(text, q.answer, [...acceptFor(q), q.question]) || mapHit(text, mapKeysFor(q));
  return !!matchQ([text], q);
}
/* Don't Say the Same: the word on the prompt's list an answer is (typos allowed), or null if it isn't on it */
const listWord = (text: string, q: Q): string | null => (q.pool || []).find((w: string) => QMB.isMatch(text, w, acceptFor({ answer: w }))) ?? null;

/* a captain's answer (one each, the first stands) */
export function captainAnswer(s: StateM, team: number, p: { text?: unknown; n?: unknown; pin?: unknown }): true | string {
  const m = miniOf(s); if (!m || s.screen !== "q" || team < 0 || team >= s.teams.length) return "Not now.";
  if (m.only && !m.only.includes(team)) return "Only the teams level at the top answer this one.";
  if (typedKey(m.key)) {
    if (s.typed[team] != null) return m.key === "dish" ? "Your team has had its guess at this one." : "Your answer is in.";
    const text = String(p.text ?? "").trim().slice(0, 80); if (!text) return "Type an answer first.";
    s.typed[team] = text; s.at[team] = ++s.seq; return true;
  }
  if (m.key === "closest") {
    if (s.nums[team] != null) return "Your number is in.";
    const v = QMB.parseNumber(String(p.n ?? ""), qOf(s)?.question); if (v == null || !Number.isFinite(v)) return "That isn't a number.";
    s.nums[team] = v; s.at[team] = ++s.seq; return true;
  }
  if (m.key === "pin") {
    if (s.pins[team]) return "Your pin is in.";
    const q = p.pin as LatLon | undefined;
    if (!q || !Number.isFinite(Number(q.lat)) || !Number.isFinite(Number(q.lon)) || Math.abs(q.lat) > 90 || Math.abs(q.lon) > 180) return "That isn't a pin.";
    s.pins[team] = { lat: Number(q.lat), lon: Number(q.lon) }; s.at[team] = ++s.seq; return true;
  }
  return "Everyone answers this one on their own phone.";
}
/* Majority Rules: every player on the list taps one of the four (one each) */
export function vote(s: StateM, name: string, pick: unknown): true | string {
  const m = miniOf(s); if (!m || m.key !== "majority" || s.screen !== "q") return "Not now.";
  if (!s.roster.some((r) => r.name === name)) return "You joined after this game started: watch this one.";
  if (s.votes[name] != null) return "Your answer is in.";
  const q = qOf(s), opts: string[] = q?.options || [];
  if (typeof pick !== "string" || !opts.includes(pick)) return "Pick one of the four.";
  s.votes[name] = pick; return true;
}
export const answered = (s: StateM): boolean[] => {
  const m = miniOf(s); if (!m) return [];
  return s.teams.map((_, t) => (m.only && !m.only.includes(t) ? true : typedKey(m.key) ? s.typed[t] != null : m.key === "closest" ? s.nums[t] != null : m.key === "pin" ? !!s.pins[t]
    : s.roster.filter((r) => r.team === t).every((r) => s.votes[r.name] != null)));
};
export const allIn = (s: StateM) => s.screen === "q" && (miniOf(s)?.key === "majority" ? s.roster.length > 0 && s.roster.every((r) => s.votes[r.name] != null) : answered(s).every(Boolean));

/* the reveal: the app's calls (the host can flip any typed answer's) */
export function reveal(s: StateM) {
  const m = miniOf(s), q = qOf(s); if (!m || !q || s.screen !== "q") return false;
  if (m.key === "say") sayCalls(s, q);
  else if (typedKey(m.key)) s.ok = s.typed.map((x) => (x == null ? false : rightOf(m.key, x, q)));
  if (m.key === "dish") s.shown = (q.ings || []).length;
  s.screen = "reveal"; s.deadline = null; s.left = 0; s.step++; return true;
}
/* Don't Say the Same, with many teams (the plan's idea 5): an answer scores if it's on the prompt's list, isn't the
   word the app picked, and no other team said it too. Two teams on the same word both lose it */
function sayCalls(s: StateM, q: Q) {
  const word = s.typed.map((x) => (x == null ? null : listWord(x, q)));
  s.why = s.typed.map((x, t) => x == null ? null : !word[t] ? "off" : rightOf("say", x, q) ? "said"
    : word.some((w, u) => u !== t && w === word[t] && !rightOf("say", s.typed[u]!, q)) ? "same" : null);
  s.ok = s.typed.map((x, t) => x != null && s.why[t] == null);
}
/* the Cocktail or Dish: a team's guess is in. Right ends the leg (the caller shows the reveal); wrong, that team is out */
export const dishRight = (s: StateM, team: number) => { const q = qOf(s), x = s.typed[team]; return !!q && x != null && rightOf("dish", x, q); };
/* this leg: who takes it (closest and pin: the nearest, ties all take it; a typed answer: everyone right) */
export function legWinners(s: StateM): number[] {
  const m = miniOf(s), q = qOf(s); if (!m || !q) return [];
  if (typedKey(m.key)) return s.ok.map((v, t) => (v ? t : -1)).filter((t) => t >= 0);
  const d = m.key === "closest" ? s.nums.map((v) => (v == null ? null : Math.abs(v - Number(q.answer))))
    : m.key === "pin" ? s.pins.map((p) => (p ? QMB.kmBetween(p, q) as number : null)) : [];
  if (m.key === "majority") return [];
  const best = Math.min(...d.filter((x): x is number => x != null));
  return Number.isFinite(best) ? d.map((x, t) => (x != null && Math.abs(x - best) < 1e-9 ? t : -1)).filter((t) => t >= 0) : [];
}
export const distances = (s: StateM): (number | null)[] => {
  const m = miniOf(s), q = qOf(s); if (!m || !q) return [];
  return m.key === "closest" ? s.nums.map((v) => (v == null ? null : Math.abs(v - Number(q.answer)))) : m.key === "pin" ? s.pins.map((p) => (p ? Math.round(QMB.kmBetween(p, q)) : null)) : [];
};
/* on fire: 1st three legs in a row in this game */
export const fireOfMany = (s: StateM): boolean[] => s.teams.map((_, i) => (s.stats?.run?.[i] ?? 0) >= 3);
/* places by a key, lower better (null: no place); level keys share the better place (1, 1, 3) */
export function placesBy(keys: (number | null)[]): (number | null)[] {
  return keys.map((x) => (x == null ? null : 1 + keys.filter((y) => y != null && y < x - 1e-9).length));
}
/* this leg's places: Closest and Drop the Pin by how far off; a typed answer, the right ones in the order they came
   in (the fastest right first; a call the host turned RIGHT for a team that sent nothing goes last of them); Don't
   Say the Same, every answer that scores shares 1st; wrong or none, no place */
export function legPlaces(s: StateM): (number | null)[] {
  const m = miniOf(s), q = qOf(s); if (!m || !q || m.key === "majority") return s.teams.map(() => null);
  if (m.key === "say") return placesBy(s.ok.map((v) => (v ? 0 : null)));
  if (typedKey(m.key)) return placesBy(s.ok.map((v, t) => (v ? s.at[t] ?? 1e9 : null)));
  const d = m.key === "closest" ? s.nums.map((v) => (v == null ? null : Math.abs(v - Number(q.answer)))) : s.pins.map((p) => (p ? QMB.kmBetween(p, q) as number : null));
  return placesBy(d);
}
/* ...and what they pay this game's tally: 1st as many points as there are teams, one less a place, down to 1 */
export const legPoints = (s: StateM): number[] => legPlaces(s).map((p) => (p == null ? 0 : s.teams.length - p + 1));

/* Majority Rules, this question: right answers per team, and how many play */
export function mrCount(s: StateM) {
  const q = qOf(s), k = s.teams.length, right = n(k), of = n(k), counts: number[] = (q?.options || []).map(() => 0);
  for (const r of s.roster) { of[r.team]++; const v = s.votes[r.name]; if (v == null) continue; if (v === q?.answer) right[r.team]++; const i = (q?.options || []).indexOf(v); if (i >= 0) counts[i]++; }
  return { right, of, counts };
}
export const share = (m: MiniM, t: number) => (m.of[t] ? m.right[t] / m.of[t] : 0);

/* the host flips one typed answer's call on the reveal */
export function flip(s: StateM, t: number) { if (s.screen !== "reveal" || !typedKey(miniOf(s)?.key) || t < 0 || t >= s.teams.length) return false; s.ok[t] = !s.ok[t]; return true; }

/* Next: the leg counts, then the next question, or the game's summary (its points paid), then the next game */
export function next(s: StateM, now: number, t: Timers) {
  const m = miniOf(s); if (!m) return false;
  /* sudden death: the fastest right answer wins the night (+1, so the standings say so); nobody right, another
     question; none left, the win stays shared */
  if (s.screen === "reveal" && m.key === "sudden") {
    const pl = legPlaces(s), w = pl.findIndex((p) => p === 1);
    if (w >= 0) { s.teams[w].score += 1; toast(s, `${s.teams[w].name} wins it in sudden death.`); }
    else toast(s, "Nobody got it.");
    m.i++;
    if (w < 0 && m.i < m.qs.length) { ask(s, now, t); return true; }
    s.log.push(s.teams.map((x) => x.score)); s.screen = "final"; s.step++; return true;
  }
  if (s.screen === "reveal") {
    if (m.key === "majority") {
      const c = mrCount(s);
      c.right.forEach((v, i) => { m.right[i] += v; m.of[i] += c.of[i]; });
      const q = qOf(s);
      for (const r of s.roster) { const w = (s.who[r.name] = s.who[r.name] || { r: 0, of: 0, team: r.team }); w.of++; if (s.votes[r.name] === q?.answer) w.r++; }
    } else {
      const w = legWinners(s); w.forEach((i) => m.wins[i]++);
      const pl = legPlaces(s), pts = legPoints(s), S = s.stats, q = qOf(s);
      pts.forEach((p, i) => { m.pts[i] += p; });
      pl.forEach((p, i) => {
        if (p === 1) { S.firsts[i]++; S.run[i]++; S.best[i] = Math.max(S.best[i], S.run[i]); } else S.run[i] = 0;
        if (p === 2) S.seconds[i]++;
        if (p === 1 && m.key === "flag") S.fastest[i]++;
        if (m.key === "pin" && s.pins[i] && q) { S.km[i] += QMB.kmBetween(s.pins[i]!, q) as number; S.kmN[i]++; }
      });
      const first = pl.map((p, i) => (p === 1 ? i : -1)).filter((i) => i >= 0);
      toast(s, !first.length ? (m.key === "say" ? "Nobody dodged it." : "Nobody got it.") : m.key === "say" ? `${first.length === 1 ? s.teams[first[0]].name : first.length + " teams"} dodged it: +${pts[first[0]]}${first.length > 1 ? " each" : ""}.`
        : first.length === 1 ? (typedKey(m.key) ? `${s.teams[first[0]].name}, first right: +${pts[first[0]]}.` : `${s.teams[first[0]].name} takes leg ${m.i + 1}: +${pts[first[0]]}.`) : `${first.length} teams share leg ${m.i + 1}.`);
    }
    m.i++;
    if (m.i < m.qs.length) { ask(s, now, t); return true; }
    award(s, m); s.screen = "summary"; s.step++; return true;
  }
  if (s.screen === "summary") {
    s.log.push(s.teams.map((x) => x.score));
    s.mi++; s.toast = null;
    /* the last game played and teams level at the top: sudden death between them, with the questions held back */
    if (s.mi >= s.minis.length) { const top = Math.max(...s.teams.map((x) => x.score)), tied = s.teams.map((x, i) => (x.score === top ? i : -1)).filter((i) => i >= 0);
      if (tied.length > 1 && top > 0 && (s.spare || []).length) { const k = s.teams.length;
        s.minis.push({ key: "sudden", qs: s.spare, i: 0, wins: n(k), right: n(k), of: n(k), pts: n(k), only: tied }); s.spare = []; } }
    s.screen = s.mi < s.minis.length ? "intro" : "final"; s.step++; return true;
  }
  return false;
}
/* a game's result: its places (the tally, or Majority Rules' share right), paid by PLACE_PTS. A team that scored
   nothing in the game (no answer that placed, no right answer) gets nothing */
export const gameVal = (m: MiniM, t: number) => (m.key === "majority" ? share(m, t) : m.pts[t]);
export function award(s: StateM, m: MiniM) {
  const val = s.teams.map((_, t) => gameVal(m, t));
  const pl = placesBy(val.map((v) => (v > 0 ? -v : null)));
  m.places = pl.map((p) => p ?? s.teams.length);
  m.award = pl.map((p) => (p == null ? 0 : PLACE_PTS[p - 1] ?? 0));
  m.award.forEach((p, t) => { s.teams[t].score += p; });
}
/* the final order: score, then games won; places shared on a tie */
export function ranking(s: StateM): { team: number; place: number }[] {
  const order = s.teams.map((_, t) => t).sort((a, b) => s.teams[b].score - s.teams[a].score || a - b);
  let place = 0, last = -1;
  return order.map((t, i) => { if (s.teams[t].score !== last) { place = i + 1; last = s.teams[t].score; } return { team: t, place }; });
}
/* names in a sentence: "Lea", "Lea & Omar", "Lea, Dana & Omar" */
const andList = (L: string[]) => (L.length > 1 ? `${L.slice(0, -1).join(", ")} & ${L[L.length - 1]}` : L.join(""));
/* Majority Rules: the sharpest player and the wooden spoon, over the game */
export function mrLine(s: StateM): string {
  const all = Object.entries(s.who).filter(([, w]) => w.of > 0); if (all.length < 2) return "";
  const hi = Math.max(...all.map(([, w]) => w.r)), lo = Math.min(...all.map(([, w]) => w.r)), of = Math.max(...all.map(([, w]) => w.of));
  const names = (v: number) => { const L = all.filter(([, w]) => w.r === v).map(([k]) => k); return L.length > 3 ? `${L.length} players` : andList(L); };
  return hi === lo ? `Everyone got ${hi} of ${of}.` : `Most right: ${names(hi)}, ${hi} of ${of}. Wooden spoon: ${names(lo)}, ${lo} of ${of}.`;
}

/* ---- the end of the night (the two-team night's recap, for N teams): the award cards ---- */
export type AwardM = { t: string; who: string; team: number | null; note?: string; spoon?: boolean };
/* the wooden spoon's word from the judges, as the two-team night says it (lib/tv/recap.ts) */
const spoonQuip = (lo: number, of: number) => { const coin = Math.round(of / 4);
  return lo === 0 ? `Zero. Guessing blind gets about ${coin}.` : lo < coin ? `Guessing blind gets about ${coin}. Just saying.` : lo === coin ? "Exactly what a coin would get. Respect." : "Last, but with dignity."; };
/* the one team with the most of something (a tie, nobody) */
const topOf = (v: number[], min = 1): number | null => { const best = Math.max(...v); const at = v.filter((x) => x === best).length; return best >= min && at === 1 ? v.indexOf(best) : null; };
export function recapMany(s: StateM): AwardM[] {
  const S = s.stats, T = s.teams, nm = (t: number) => T[t].name, out: AwardM[] = [], has = (k: ManyKey) => s.minis.some((m) => m.key === k);
  let t: number | null;
  if ((t = topOf(S.firsts, 2)) != null) out.push({ t: "Most questions won", who: `${nm(t)}, ${S.firsts[t]}`, team: t });
  if ((t = topOf(S.seconds, 2)) != null && t !== topOf(S.firsts, 2)) out.push({ t: "Always the bridesmaid", who: `${nm(t)}, 2nd ${S.seconds[t]} times`, team: t });
  if (has("pin")) {
    const legs = s.minis.find((m) => m.key === "pin")!.qs.length, avg = T.map((_, i) => (S.kmN[i] >= Math.ceil(legs / 2) ? S.km[i] / S.kmN[i] : Infinity));
    const lo = Math.min(...avg); if (Number.isFinite(lo) && avg.filter((x) => x === lo).length === 1) { t = avg.indexOf(lo); out.push({ t: "Best aim, Drop the Pin", who: `${nm(t)}, ${lo < 1 ? "under 1 km" : Math.round(lo).toLocaleString("en") + " km"} off on average`, team: t }); }
  }
  /* Majority Rules' players, one by one (the owner, 30 Oct: these over the flag and streak cards): the sharpest and the
     wooden spoon, shared by up to three, more than that counted */
  const mr = Object.entries(s.who).filter(([, w]) => w.of > 0);
  const hi = Math.max(0, ...mr.map(([, w]) => w.r)), lo = Math.min(...mr.map(([, w]) => w.r)), of = Math.max(0, ...mr.map(([, w]) => w.of));
  const mrOn = mr.length >= 2 && hi > lo;
  if (mrOn) {
    const at = (v: number) => mr.filter(([, w]) => w.r === v), names = (L: typeof mr) => (L.length > 3 ? `${L.length} players` : andList(L.map(([k]) => k)));
    const top = at(hi), low = at(lo), one = (L: typeof mr) => (L.length === 1 ? L[0][1].team : null);
    out.push({ t: "Sharpest in Majority Rules", who: `${names(top)}, ${hi} of ${of}`, team: one(top) });
    out.push({ t: "Wooden spoon, Majority Rules", who: `${names(low)}, ${lo} of ${of}`, team: one(low), note: spoonQuip(lo, of), spoon: true });
  } else {
    /* no Majority Rules tonight (or everyone level): the quickest flags and the longest run instead */
    if (has("flag") && (t = topOf(S.fastest, 2)) != null) out.push({ t: "Fastest fingers, Guess the Flag", who: `${nm(t)}, first right ${S.fastest[t]} times`, team: t });
    if ((t = topOf(S.best, 3)) != null) out.push({ t: "Hot streak", who: `${nm(t)}, ${S.best[t]} in a row`, team: t });
  }
  return out.slice(0, 5);
}
