/* Secret Stakes (11 Nov, the owner): what both setups share on screen. The rules themselves are the engine's
   (engine/core.js: the deal, the size of a bet, the points); this is a round as the screens show it, and its timing.
   A round: three themes go up and each captain bets, in secret, on one theme and one level (the pick, 20 s); then
   each team gets the question it bet on, on its own phones only (45 s); then the reveal, one team at a time, from
   last place up, the points going straight on or off the night's totals. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { QMB } from "./engine";

export const SK_ROUNDS: number = QMB.STAKES_ROUNDS;
export const SK_LEVELS: string[] = QMB.STAKES_LEVELS;
export type SkPick = { k: number; level: string; auto?: boolean };
/* the engine's game: rounds of {themes, qs: per theme {easy, medium, hard, expert}}; picks this round; log of rounds */
export type SkGame = { rounds: { themes: string[]; qs: Record<string, any>[] }[]; spare: unknown[]; i: number; base: number; unit: number;
  picks: (SkPick | null)[]; log: { i: number; themes: string[]; picks: SkPick[]; ok: boolean[]; bet: number[]; delta: number[]; before: number[] }[]; net: number[]; done: boolean };

/* a round as the screens show it */
export type SkPub = {
  round: number; rounds: number;                  // this round (1, 2, 3) of rounds
  unit: number;                                   // one bet: Medium wins or loses it, Hard twice, Expert three times
  themes: string[];                               // this round's three themes
  locked: boolean[];                              // per team: its bet is in
  /* per team: its bet. In the room for every phone, but a phone only ever draws its own team's (and the host's
     phone all of them); the TV shows them at the reveal (COMMERCIAL.md, section 2: keep them off other phones) */
  picks?: (SkPick | null)[];
  q?: (string | null)[];                          // the question each team bet on (stakesQ, the reveal)
  /* the reveal: in the order the teams come up (last place first), what each bet, said, and won or lost */
  rev?: { order: number[]; theme: string[]; level: string[]; bet: number[]; answer: string[]; notes: (string | undefined)[];
    ok: boolean[]; typed: (string | null)[]; delta: number[]; before: number[]; after: number[] };
  /* the game's end: each team's total won or lost, and each round's bet */
  sum?: { net: number[]; rounds: { theme: string; level: string; ok: boolean; delta: number }[][] };
};

/* what a level's bet is worth (Easy 0) */
export const skBet = (unit: number, level: string): number => QMB.stakesBet(unit, level);
/* the question a team bet on (null: no bet yet) */
export const skQ = (s: SkGame | null | undefined, t: number): any => {
  const R = s?.rounds?.[s.i], p = s?.picks?.[t];
  return R && p ? R.qs[p.k]?.[p.level] ?? null : null;
};
/* the round's questions as one key: the phones tag their answers with it, so a late one can't count for the next */
export const skKey = (s: SkGame): string => `sk${s.i}:${(s.picks || []).map((_, t) => skQ(s, t)?.id ?? "-").join(",")}`;
/* the round's result, for every team, by the calls as they stand (scores: each team's total before it) */
export const skResult = (s: SkGame, scores: number[], ok: (boolean | null)[]) =>
  QMB.stakesResult(scores, s.picks, ok.map((v) => !!v), s.unit) as { bet: number[]; ok: boolean[]; before: number[]; after: number[]; delta: number[] };

/* the view of a round. screen: which part of it is up; scores: each team's night total as the engine has it (the
   round's points aren't on it yet at the reveal); ok and typed: each team's call and answer at the reveal */
export function skPub(s: SkGame, screen: string, scores: number[], ok?: (boolean | null)[] | null, typed?: (string | null)[] | null): SkPub {
  const R = s.rounds[Math.min(s.i, s.rounds.length - 1)], k = scores.length;
  const p: SkPub = { round: Math.min(s.i + 1, s.base), rounds: s.base, unit: s.unit || 1, themes: R ? R.themes.slice() : [],
    locked: Array.from({ length: k }, (_, t) => !!s.picks?.[t]) };
  if (/^stakes(Pick|Q|Reveal)$/.test(screen)) p.picks = Array.from({ length: k }, (_, t) => (s.picks?.[t] ? { ...s.picks[t]! } : null));
  if (screen === "stakesQ" || screen === "stakesReveal") p.q = Array.from({ length: k }, (_, t) => (skQ(s, t)?.question as string) ?? null);
  if (screen === "stakesReveal" && ok && R) {
    const res = skResult(s, scores, ok);
    p.rev = { order: QMB.stakesOrder(scores), theme: Array.from({ length: k }, (_, t) => R.themes[s.picks?.[t]?.k ?? 0] || ""),
      level: Array.from({ length: k }, (_, t) => s.picks?.[t]?.level || "easy"), bet: res.bet,
      answer: Array.from({ length: k }, (_, t) => String(skQ(s, t)?.answer ?? "")), notes: Array.from({ length: k }, (_, t) => skQ(s, t)?.notes || undefined),
      ok: res.ok, typed: Array.from({ length: k }, (_, t) => typed?.[t] ?? null), delta: res.delta, before: res.before, after: res.after };
  }
  if (screen === "stakesSummary") p.sum = { net: Array.from({ length: k }, (_, t) => s.net?.[t] || 0),
    rounds: Array.from({ length: k }, (_, t) => (s.log || []).map((L) => ({ theme: L.themes?.[L.picks[t]?.k ?? 0] || "", level: L.picks[t]?.level || "easy", ok: !!L.ok[t], delta: L.delta[t] || 0 }))) };
  return p;
}

/* the reveal's timing (TV and phones alike): the k-th team up shows at skRowAt(k); a bigger room goes a little faster */
export const skRowAt = (k: number, teams: number) => 600 + k * (teams > 4 ? 850 : 1300);
export const skRevealMs = (teams: number) => skRowAt(teams - 1, teams) + 700;
/* a level said plainly, and what it's worth: "Hard ±16", "Easy · safe" */
export const skLevelWord = (level: string) => level[0].toUpperCase() + level.slice(1);
export const skWorth = (unit: number, level: string) => (level === "easy" ? "safe" : `±${skBet(unit, level)}`);
export const signedPts = (v: number) => (v > 0 ? `+${v}` : v < 0 ? `−${-v}` : "0");
