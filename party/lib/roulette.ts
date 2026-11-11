/* Russian Roulette (9 Nov, the owner): what both setups share on screen. The rules themselves are the engine's
   (engine/core.js: the barrels, the spin, the bullet, the points); this is the timing and the view of a lap.
   A lap: the barrel spins (SPIN_MS, on the TV and every phone at once), each team lands on a chamber of its own and
   gets that chamber's question; then the reveal: the chambers click one by one (STEP_MS apart), the bullet last. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { QMB } from "./engine";

export const SPIN_MS = 2600, STEP_MS = 650;
export const RR_LAPS: number = QMB.ROULETTE_LAPS;
export type RrChamber = { theme: string; level: string; q: any };
export type RrLap = { ch: RrChamber[]; bullet: number; blank?: boolean; draw?: number[]; ok?: boolean[]; got?: number[] };   // blank: a tie-breaker spin, no bullet

/* a lap as the screens show it: each team's chamber (its place in the barrel, its theme, its question); and at the
   reveal, what's behind them (the level, the bullet, the right answer) and what each team's call is worth */
export type RrPub = {
  n: number; lap: number; laps: number;           // chambers; this lap (1, 2, 3; 4 on: a tie-breaker) of laps
  spinAt: number | null;                          // TV time the barrel started spinning (the question's up SPIN_MS later)
  draw: { j: number; theme: string; q: string; level: string }[];   // per team; level: medium, hard, or "bullet" (shown from the spin on: 11 Nov, the owner)
  hit: number;                                    // the team that drew the bullet this lap (-1: nobody); everyone sees it once the barrel stops
  blank?: boolean;                                // a tie-breaker spin: no bullet in it
  pts: number[];                                  // the game's points before this lap
  rev?: { bullet: number; level: string[]; answer: string[]; notes: (string | undefined)[]; got: number[]; hit: number };   // hit: the team that drew the bullet, -1 none
};
/* what a chamber pays, by the call as it stands (the game's total never goes below 0) */
export const rrWorth = (lap: RrLap, t: number, ok: boolean): number => (lap.draw ? QMB.roulettePts(lap, lap.draw[t], ok) : 0);
export const rrGot = (lap: RrLap, pts: number[], ok: (boolean | null)[]): number[] =>
  pts.map((_, t) => rrWorth(lap, t, !!ok[t]));   // (the bullet costs 3 whatever the total: it can go below 0)
export function rrPub(lap: RrLap, i: number, laps: number, n: number, pts: number[], spinAt: number | null, ok: (boolean | null)[] | null): RrPub {
  const lvl = (j: number) => (j === lap.bullet && !lap.blank ? "bullet" : lap.ch[j].level === "expert" ? "hard" : lap.ch[j].level);
  const draw = (lap.draw || []).map((j) => ({ j, theme: lap.ch[j].theme, q: String(lap.ch[j].q?.question || ""), level: lvl(j) }));
  const p: RrPub = { n, lap: i + 1, laps, spinAt, draw, pts: [...pts], hit: lap.blank || !lap.draw ? -1 : lap.draw.indexOf(lap.bullet), blank: !!lap.blank || undefined };
  if (ok && lap.draw) p.rev = { bullet: lap.blank ? -1 : lap.bullet, level: lap.draw.map(lvl),
    answer: lap.draw.map((j) => String(lap.ch[j].q?.answer ?? "")), notes: lap.draw.map((j) => lap.ch[j].q?.notes || undefined),
    got: rrGot(lap, pts, ok), hit: lap.blank ? -1 : lap.draw.indexOf(lap.bullet) };
  return p;
}
/* the question each team answers this lap (null before the spin) */
export const rrQ = (lap: RrLap | null | undefined, t: number) => (lap?.draw ? lap.ch[lap.draw[t]]?.q ?? null : null);
