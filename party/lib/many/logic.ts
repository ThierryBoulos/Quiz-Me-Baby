/* MANY TEAMS (3 to 8), phase 1: the night's rules, pure. No React, no network: the TV's hook
   (lib/many/useTvMany.ts) feeds it taps and the clock, the simulator (sim/many.mjs) feeds it bots.
   Nothing here is shared with the two-team game but the matcher and the distance (engine/core.js).
   Always with a host. Four games, all simultaneous, all judged by the app (the host can flip a flag):
   Majority Rules, Guess the Flag, Closest To Wins, Drop the Pin. The winner of each takes 2 points;
   a tie at the top is a point each. */
import { QMB } from "../engine";

export const MANY_MINIS = ["majority", "flag", "closest", "pin"] as const;
export type ManyKey = (typeof MANY_MINIS)[number];
export const MANY_TITLES: Record<ManyKey, string> = { majority: "Majority Rules", flag: "Guess the Flag", closest: "Closest To Wins", pin: "Drop the Pin" };
export const MANY_LEGS: Record<ManyKey, number> = { majority: 15, flag: 10, closest: 5, pin: 7 };
export const MANY_MIN = 3, MANY_MAX = 8, MANY_PLAYERS = 60, MANY_PTS = 2;
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
export type MiniM = { key: ManyKey; qs: Q[]; i: number; wins: number[]; right: number[]; of: number[]; award?: number[] };
export type Screen = "intro" | "q" | "reveal" | "summary" | "final";
export type StateM = {
  v: 1; teams: TeamM[]; minis: MiniM[]; mi: number; screen: Screen; step: number;
  deadline: number | null; left: number; total: number;
  typed: (string | null)[]; nums: (number | null)[]; pins: (LatLon | null)[];
  ok: (boolean | null)[];                       // this leg's call per team (the app's, then the host's)
  roster: { name: string; team: number }[];     // Majority Rules: who plays (fixed at its start)
  votes: Record<string, string>;
  who: Record<string, { r: number; of: number; team: number }>;
  toast: { id: number; text: string } | null; toastN: number;
  exit?: boolean; log: number[][];            // the scores after each game, for the final chart
};
export type Timers = { flag: number; closest: number; pin: number; majority: number };

const n = (k: number, v = 0) => Array.from({ length: k }, () => v);
export const miniOf = (s: StateM) => s.minis[s.mi] as MiniM | undefined;
export const qOf = (s: StateM) => { const m = miniOf(s); return m ? m.qs[m.i] : null; };

export function newNight(teams: { name: string; captain: string }[], decks: Partial<Record<ManyKey, Q[]>>, order: ManyKey[]): StateM {
  const k = teams.length;
  const minis: MiniM[] = order.filter((key) => (decks[key] || []).length).map((key) => ({ key, qs: (decks[key] || []).slice(0, MANY_LEGS[key]), i: 0, wins: n(k), right: n(k), of: n(k) }));
  return { v: 1, teams: teams.map((t) => ({ ...t, score: 0 })), minis, mi: 0, screen: minis.length ? "intro" : "final", step: 1,
    deadline: null, left: 0, total: 0, typed: Array(k).fill(null), nums: Array(k).fill(null), pins: Array(k).fill(null), ok: Array(k).fill(null),
    roster: [], votes: {}, who: {}, toast: null, toastN: 0, log: [n(k)] };
}

const clear = (s: StateM) => { const k = s.teams.length; s.typed = Array(k).fill(null); s.nums = Array(k).fill(null); s.pins = Array(k).fill(null); s.ok = Array(k).fill(null); s.votes = {}; };
const toast = (s: StateM, text: string) => { s.toast = { id: ++s.toastN, text }; };

/* the host taps Start on a game's intro: its first question */
export function startMini(s: StateM, now: number, t: Timers, roster: { name: string; team: number }[]) {
  const m = miniOf(s); if (!m || s.screen !== "intro") return false;
  if (m.key === "majority") s.roster = roster.filter((r) => r.team >= 0 && r.team < s.teams.length).slice(0, MANY_PLAYERS);
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
    s.typed[team] = text; return true;
  }
  if (m.key === "closest") {
    if (s.nums[team] != null) return "Your number is in.";
    const v = QMB.parseNumber(String(p.n ?? ""), qOf(s)?.question); if (v == null || !Number.isFinite(v)) return "That isn't a number.";
    s.nums[team] = v; return true;
  }
  if (m.key === "pin") {
    if (s.pins[team]) return "Your pin is in.";
    const q = p.pin as LatLon | undefined;
    if (!q || !Number.isFinite(Number(q.lat)) || !Number.isFinite(Number(q.lon)) || Math.abs(q.lat) > 90 || Math.abs(q.lon) > 180) return "That isn't a pin.";
    s.pins[team] = { lat: Number(q.lat), lon: Number(q.lon) }; return true;
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
      toast(s, w.length === 0 ? "Nobody got it." : w.length === 1 ? `${s.teams[w[0]].name} takes leg ${m.i + 1}.` : `${w.length} teams take leg ${m.i + 1}.`);
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
/* a game's points: the top team takes 2; a tie at the top is a point each */
export function award(s: StateM, m: MiniM) {
  const val = s.teams.map((_, t) => (m.key === "majority" ? share(m, t) : m.wins[t]));
  const best = Math.max(...val), top = val.map((v, t) => (Math.abs(v - best) < 1e-9 ? t : -1)).filter((t) => t >= 0);
  m.award = s.teams.map((_, t) => (top.includes(t) ? (top.length === 1 ? MANY_PTS : 1) : 0));
  if (best <= 0) m.award = s.teams.map(() => 0);          // nobody scored anything: nobody is paid
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
