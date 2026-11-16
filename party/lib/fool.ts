/* FOOL ME TWICE (the owner, 16 Nov): a strange true fact with a blank. Every team writes a lie to fill it; then the
   lies, a few of ours and the truth come up together, shuffled, and every team picks the one it thinks is true.
   +2 for the truth, +1 for each team your lie fools, nothing for falling for one of ours; and with your lie you say
   which team will fall for it: if it does, that team loses 1 (3 to 8 teams; with two teams nobody names a team, and
   falling for the other team's lie costs nothing: the owner, 16 Nov). 6 facts, the last 2 hard. The rules themselves are the engine's (engine/core.js: foolOptions, foolScore), shared by the
   two-team TV (lib/tvGame.ts) and the 3-8 team one (lib/many/logic.ts). */
export type FoolOpt = { text: string; truth?: boolean; ours?: boolean; by: number[] };
export type FoolRev = { opts: FoolOpt[]; fooled: number[][]; pts: number[]; hits: { by: number; on: number }[]; lost: number[];
  predicts: (number | null)[]; answer: string; notes?: string };
export type FoolPub = {
  fact: string; n: number; of: number;     // the fact, which one, of how many
  hard?: boolean;                          // one of the night's last two (ours: shown only as "Hard one")
  name?: boolean;                          // the truth is a name or a title: it keeps its capital in the sentence
  wrote: boolean[];                        // who has written their lie
  opts?: string[];                         // picking: the answers, shuffled (whose they are stays on the TV)
  picked?: boolean[];                      // who has picked
  rev?: FoolRev;                           // the reveal
  total: number[];                         // this game's points so far (at the reveal, with this fact's)
};
/* a lie's longest (16 Nov, the owner: so every answer fits in its box, two lines at most on the narrowest phone; our own
   answers are 25 at most too). The phone says "Limit reached." when it's reached, never the number */
export const FOOL_MAX = 25;

/* THE RESULT (16 Nov, the owner's pick: the lie detector, and four awards under it). The game's numbers: each team's
   points after each fact (the pens), how many times it found the truth, how many times its lie fooled a team, how many
   times it fell for a lie (a team's or one of ours), how many times it named the team that fell for its lie */
export type FoolSum = { tally: number[][]; truths: number[]; fooled: number[]; falls: number[]; called: number[] };
/* one fact's part in them: the answers, each team's pick, the predictions that came true, the points */
export function foolFact(opts: FoolOpt[], picks: (number | null)[], hits: { by: number; on: number }[], pts: number[]) {
  const k = picks.length, fooled = Array(k).fill(0), called = Array(k).fill(0);
  picks.forEach((p, t) => { const o = p == null ? null : opts[p]; if (!o || o.truth || o.by.includes(t)) return; o.by.forEach((w) => { fooled[w]++; }); });
  hits.forEach((h) => { called[h.by]++; });
  return { pts: [...pts], truth: picks.map((p) => p != null && !!opts[p]?.truth), fell: picks.map((p, t) => p != null && !!opts[p] && !opts[p].truth && !opts[p].by.includes(t)), fooled, called };
}
export type FoolFactSum = ReturnType<typeof foolFact>;
export function foolSum(facts: FoolFactSum[], k: number): FoolSum {
  const z = () => Array(k).fill(0), S: FoolSum = { tally: [], truths: z(), fooled: z(), falls: z(), called: z() };
  let run = z();
  for (const F of facts) {
    run = run.map((v, t) => v + (F.pts[t] || 0)); S.tally.push(run);
    F.truth.forEach((x, t) => { if (x) S.truths[t]++; }); F.fell.forEach((x, t) => { if (x) S.falls[t]++; });
    F.fooled.forEach((n, t) => { S.fooled[t] += n; }); F.called.forEach((n, t) => { S.called[t] += n; });
  }
  return S;
}
/* the awards: the most truths found, the best liars (the most times fooling a team), the best prediction (3 to 8 teams:
   with 2 the team is always the other one), and the team fooled the most. Tied teams share one; none for 0 */
export type FoolAward = { t: string; teams: number[]; n: number; spoon?: boolean };
export function foolAwards(S: FoolSum, two: boolean): FoolAward[] {
  const best = (v: number[]) => { const m = Math.max(0, ...v); return m > 0 ? { teams: v.map((x, i) => (x === m ? i : -1)).filter((i) => i >= 0), n: m } : null; };
  const out: FoolAward[] = [], a = best(S.truths), b = best(S.fooled), c = two ? null : best(S.called), d = best(S.falls);
  if (a) out.push({ t: "Most correct", ...a });
  if (b) out.push({ t: "Best liars", ...b });
  if (c) out.push({ t: "Best prediction", ...c });
  if (d) out.push({ t: "Fooled the most", ...d, spoon: true });
  return out;
}
export const foolAwardWhat = (a: FoolAward, two: boolean) => {
  const n = a.n, x = (one: string, many: string) => (n === 1 ? one : many.replace("#", String(n)));
  return a.t === "Most correct" ? x("found the truth once", "found the truth # times")
    : a.t === "Best liars" ? (two ? x("fooled the other team once", "fooled the other team # times") : x("fooled a team once", "fooled teams # times"))
    : a.t === "Best prediction" ? x("called it once", "called it # times")
    : x("fell for 1 lie", "fell for # lies");
};
/* the result's beat: the pens draw the six facts (2.6 s), then the teams' labels come in, last place first, the winner
   last; then the winner's line, and the points fly into the totals (the TV's tracker and the phones wait for it) */
export const FOOL_PEN_END = 2.6;
export const rvFool = (places: number[], k: number) => { const step = k <= 3 ? 0.6 : 0.35, ps = [...new Set(places)].sort((a, b) => b - a);
  return { at: (t: number) => Math.max(0, ps.indexOf(places[t])) * step, done: (ps.length - 1) * step + 1 }; };
export const foolDone = (places: number[], k: number) => FOOL_PEN_END + rvFool(places, k).done;
