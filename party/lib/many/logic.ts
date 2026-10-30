/* MANY TEAMS (3 to 8), phase 1: the night's rules, pure. No React, no network: the TV's hook
   (lib/many/useTvMany.ts) feeds it taps and the clock, the simulator (sim/many.mjs) feeds it bots.
   Nothing here is shared with the two-team game but the matcher and the distance (engine/core.js).
   Always with a host. Four games, all simultaneous, all judged by the app (the host can flip a flag):
   Majority Rules, Guess the Flag, Closest To Wins, Drop the Pin.
   Points by place (the owner's pick, 30 Oct: one winner taking 2 left 2nd and 8th level). Every question ranks
   the teams and pays this game's tally by place: with 8 teams the nearest (Closest, Pin) or the first right
   (Flags: the fastest typist) takes 8, the next 7, down to 1; wrong or no answer, nothing. Majority Rules ranks
   by the share of answers right. At the end of a game its places pay the night: 10, 8, 6, 5, 4, 3, 2, 1
   (3 teams: 10, 8, 6). Level teams share the better place. */
import { QMB } from "../engine";

export const MANY_MINIS = ["majority", "flag", "closest", "pin"] as const;
export type ManyKey = (typeof MANY_MINIS)[number];
export const MANY_TITLES: Record<ManyKey, string> = { majority: "Majority Rules", flag: "Guess the Flag", closest: "Closest To Wins", pin: "Drop the Pin" };
export const MANY_LEGS: Record<ManyKey, number> = { majority: 15, flag: 10, closest: 5, pin: 7 };
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
export type MiniM = { key: ManyKey; qs: Q[]; i: number; wins: number[]; right: number[]; of: number[]; pts: number[]; award?: number[]; places?: number[] };
/* the night's numbers for the awards: legs placed 1st and 2nd, the fastest right flags, Drop the Pin's km
   (and how many pins), the run of 1st places now (on fire at 3; a new game starts cold) and the best run */
export type Stats = { firsts: number[]; seconds: number[]; fastest: number[]; km: number[]; kmN: number[]; run: number[]; best: number[] };
export type Screen = "intro" | "q" | "reveal" | "summary" | "final";
export type StateM = {
  v: 2; teams: TeamM[]; minis: MiniM[]; mi: number; screen: Screen; step: number;
  deadline: number | null; left: number; total: number;
  typed: (string | null)[]; nums: (number | null)[]; pins: (LatLon | null)[];
  at: (number | null)[]; seq: number;           // the order this leg's answers came in (Flags: the fastest right first)
  ok: (boolean | null)[];                       // this leg's call per team (the app's, then the host's)
  roster: { name: string; team: number }[];     // Majority Rules: who plays (fixed at its start)
  votes: Record<string, string>;
  who: Record<string, { r: number; of: number; team: number }>;
  toast: { id: number; text: string } | null; toastN: number;
  exit?: boolean; log: number[][];            // the scores after each game, for the final chart
  stats: Stats;
};
export type Timers = { flag: number; closest: number; pin: number; majority: number };

const n = (k: number, v = 0) => Array.from({ length: k }, () => v);
export const miniOf = (s: StateM) => s.minis[s.mi] as MiniM | undefined;
export const qOf = (s: StateM) => { const m = miniOf(s); return m ? m.qs[m.i] : null; };

export function newNight(teams: { name: string; captain: string }[], decks: Partial<Record<ManyKey, Q[]>>, order: ManyKey[]): StateM {
  const k = teams.length;
  const minis: MiniM[] = order.filter((key) => (decks[key] || []).length).map((key) => ({ key, qs: (decks[key] || []).slice(0, MANY_LEGS[key]), i: 0, wins: n(k), right: n(k), of: n(k), pts: n(k) }));
  return { v: 2, teams: teams.map((t) => ({ ...t, score: 0 })), minis, mi: 0, screen: minis.length ? "intro" : "final", step: 1,
    deadline: null, left: 0, total: 0, typed: Array(k).fill(null), nums: Array(k).fill(null), pins: Array(k).fill(null), ok: Array(k).fill(null),
    at: Array(k).fill(null), seq: 0, roster: [], votes: {}, who: {}, toast: null, toastN: 0, log: [n(k)],
    stats: { firsts: n(k), seconds: n(k), fastest: n(k), km: n(k), kmN: n(k), run: n(k), best: n(k) } };
}

const clear = (s: StateM) => { const k = s.teams.length; s.typed = Array(k).fill(null); s.nums = Array(k).fill(null); s.pins = Array(k).fill(null); s.ok = Array(k).fill(null); s.at = Array(k).fill(null); s.votes = {}; };
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
  s.screen = "q"; s.total = t[m.key]; s.deadline = now + s.total * 1000; s.left = 0; s.step++;
}

/* a captain's answer (one each, the first stands) */
export function captainAnswer(s: StateM, team: number, p: { text?: unknown; n?: unknown; pin?: unknown }): true | string {
  const m = miniOf(s); if (!m || s.screen !== "q" || team < 0 || team >= s.teams.length) return "Not now.";
  if (m.key === "flag") {
    if (s.typed[team] != null) return "Your answer is in.";
    const text = String(p.text ?? "").trim().slice(0, 60); if (!text) return "Type an answer first.";
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
  return s.teams.map((_, t) => (m.key === "flag" ? s.typed[t] != null : m.key === "closest" ? s.nums[t] != null : m.key === "pin" ? !!s.pins[t]
    : s.roster.filter((r) => r.team === t).every((r) => s.votes[r.name] != null)));
};
export const allIn = (s: StateM) => s.screen === "q" && (miniOf(s)?.key === "majority" ? s.roster.length > 0 && s.roster.every((r) => s.votes[r.name] != null) : answered(s).every(Boolean));

/* the reveal: the app's calls (the host can flip a flag's) */
export function reveal(s: StateM, accept: (q: Q) => string[]) {
  const m = miniOf(s), q = qOf(s); if (!m || !q || s.screen !== "q") return false;
  if (m.key === "flag") s.ok = s.typed.map((x) => (x == null ? false : !!QMB.isMatch(x, q.answer, accept(q))));
  s.screen = "reveal"; s.deadline = null; s.left = 0; s.step++; return true;
}
/* this leg: who takes it (closest and pin: the nearest, ties all take it; flag: everyone right) */
export function legWinners(s: StateM): number[] {
  const m = miniOf(s), q = qOf(s); if (!m || !q) return [];
  if (m.key === "flag") return s.ok.map((v, t) => (v ? t : -1)).filter((t) => t >= 0);
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
/* this leg's places: Closest and Drop the Pin by how far off; Flags, the right answers in the order they came in
   (a call the host turned RIGHT for a team that sent nothing goes last of the right ones); wrong or none, no place */
export function legPlaces(s: StateM): (number | null)[] {
  const m = miniOf(s), q = qOf(s); if (!m || !q || m.key === "majority") return s.teams.map(() => null);
  if (m.key === "flag") return placesBy(s.ok.map((v, t) => (v ? s.at[t] ?? 1e9 : null)));
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

/* the host flips one flag call on the reveal */
export function flip(s: StateM, t: number) { if (s.screen !== "reveal" || miniOf(s)?.key !== "flag" || t < 0 || t >= s.teams.length) return false; s.ok[t] = !s.ok[t]; return true; }

/* Next: the leg counts, then the next question, or the game's summary (its points paid), then the next game */
export function next(s: StateM, now: number, t: Timers) {
  const m = miniOf(s); if (!m) return false;
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
      toast(s, !first.length ? "Nobody got it." : first.length === 1 ? (m.key === "flag" ? `${s.teams[first[0]].name}, first right: +${pts[first[0]]}.` : `${s.teams[first[0]].name} takes leg ${m.i + 1}: +${pts[first[0]]}.`) : `${first.length} teams share leg ${m.i + 1}.`);
    }
    m.i++;
    if (m.i < m.qs.length) { ask(s, now, t); return true; }
    award(s, m); s.screen = "summary"; s.step++; return true;
  }
  if (s.screen === "summary") {
    s.log.push(s.teams.map((x) => x.score));
    s.mi++; s.toast = null;
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
/* Majority Rules: the sharpest player and the wooden spoon, over the game */
export function mrLine(s: StateM): string {
  const all = Object.entries(s.who).filter(([, w]) => w.of > 0); if (all.length < 2) return "";
  const hi = Math.max(...all.map(([, w]) => w.r)), lo = Math.min(...all.map(([, w]) => w.r)), of = Math.max(...all.map(([, w]) => w.of));
  const names = (v: number) => { const L = all.filter(([, w]) => w.r === v).map(([k]) => k); return L.length > 3 ? `${L.length} players` : L.join(" & "); };
  return hi === lo ? `Everyone got ${hi} of ${of}.` : `Most right: ${names(hi)}, ${hi} of ${of} · Wooden spoon: ${names(lo)}, ${lo} of ${of}`;
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
    const at = (v: number) => mr.filter(([, w]) => w.r === v), names = (L: typeof mr) => (L.length > 3 ? `${L.length} players` : L.map(([k]) => k).join(" & "));
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
