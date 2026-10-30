import { QMB } from "../engine";
import { MINI_TITLES, showNum, type MiniKey, type Pub, type Two } from "../game";
import { other, type G } from "./rules";
import type { TvState } from "./state";

/* the night in a few lines: how close it was, lead changes, steals, mini-games won, the most one-sided mini-game */
export function recap(s: TvState): NonNullable<Pub["recap"]> {
  const g = s.g, steals: Two<number> = [0, 0], minis: Two<number> = [0, 0], seatOpts = () => ({ alternateFirst: !!g.alternateFirst });
  g.rounds.forEach((rd: G) => (rd.res || []).forEach((r: G, seat: number) => { if (r?.stolen) steals[other(QMB.seatTeam(g, rd, seat, seatOpts()))]++; }));
  let best: NonNullable<Pub["recap"]>["best"];
  const won = (title: string, award: G, legs?: Two<number>) => {
    if (!award) return;
    const w = award[0] > award[1] ? 0 : award[1] > award[0] ? 1 : null;
    if (w == null) return;
    minis[w]++;
    /* "most one-sided" only for a clear win (2+ legs apart): a 3-2 is a close one */
    if (legs && Math.abs(legs[0] - legs[1]) >= 2 && (!best || Math.abs(legs[0] - legs[1]) > Math.abs(best.legs[0] - best.legs[1]))) best = { title, team: w, legs };
  };
  ([["closest", g.mini], ["saysame", g.saySame], ["flag", g.flagGame], ["map", g.mapGame], ["pin", g.pinGame], ["airport", g.airportGame], ["majority", g.majorityGame], ["dish", g.dishGame]] as [MiniKey, G][])
    .forEach(([k, m]) => won(MINI_TITLES[k], m?.award, m && k !== "majority" ? [m.wins[0], m.wins[1]] : undefined));   // (Majority Rules: shares, not legs)
  if (g.auction) won(MINI_TITLES.auction, g.auction.award, [g.auction.wins[0], g.auction.wins[1]]);
  if (g.battle) won(MINI_TITLES.battle, g.battle.award);
  let changes = 0, lead = 0;
  s.scoreLog.forEach(([a, b]) => { const now = Math.sign(a - b); if (now && lead && now !== lead) changes++; if (now) lead = now; });
  const segs = segsOf(s);
  return { margin: Math.abs(g.teams[0].score - g.teams[1].score), sudden: !!g.sdRounds, leadChanges: changes, steals, minis, best, chart: chartOf(s.scoreLog), segs, awards: awardsOf(s, steals, best) };
}

/* the night by its parts, each with its scores (at most 8, the last always in) */
function segsOf(s: TvState): { label: string; pts: Two<number>[] }[] {
  const L = s.scoreLog, S = s.segLog || [];
  return S.map((seg, k) => {
    const pts = L.slice(seg.at, k + 1 < S.length ? S[k + 1].at : L.length);
    if (pts.length <= 8) return { label: seg.label, pts };
    const step = (pts.length - 1) / 7;
    return { label: seg.label, pts: Array.from({ length: 8 }, (_, i) => pts[Math.round(i * step)]) };
  });
}

/* the scores through the night, at most 48 points (the first and the last always in) */
function chartOf(L: Two<number>[]): Two<number>[] {
  const pts: Two<number>[] = [[0, 0], ...L];
  if (pts.length <= 48) return pts;
  const out: Two<number>[] = []; const step = (pts.length - 1) / 47;
  for (let i = 0; i < 48; i++) out.push(pts[Math.round(i * step)]);
  return out;
}
/* names in a sentence: "Lea", "Lea & Omar", "Lea, Dana & Omar"; more than three, counted */
const names = (L: string[]) => (L.length > 3 ? `${L.length} players` : L.length > 1 ? `${L.slice(0, -1).join(", ")} & ${L[L.length - 1]}` : L.join(""));
/* where in the night: "R2" says "Round 2" */
const where = (label: string) => (/^R\d+$/.test(label) ? "Round " + label.slice(1) : label === "Sudden death" ? "sudden death" : /^Battle/.test(label) ? "the " + label : label);
type Award = NonNullable<NonNullable<Pub["recap"]>["awards"]>[number];
/* the awards: fun to read, each only when it's true (the owner, 30 Oct: the nutshell's facts become awards, with
   the comeback, the night going down to the wire, the most one-sided mini-game, the wildest guess and the furthest
   pin; up to eight cards). Majority Rules' sharpest player and its wooden spoon close them */
function awardsOf(s: TvState, steals: Two<number>, best: NonNullable<Pub["recap"]>["best"]): Award[] {
  const g = s.g, nm = (t: 0 | 1) => g.teams[t].name, w: 0 | 1 | null = g.winner ?? null, L = s.scoreLog, S = s.segLog || [];
  const segAt = (i: number) => { let k = 0; while (k + 1 < S.length && S[k + 1].at <= i) k++; return S[k]?.label ?? ""; };
  const A: Record<string, Award> = {};
  /* the comeback: the winner, the furthest behind they were */
  if (w != null) {
    let d = 0, at = -1; L.forEach((p, i) => { const x = p[other(w)] - p[w]; if (x > d) { d = x; at = i; } });
    if (d >= 3 && S.length) A.comeback = { t: "Comeback", who: `${nm(w)}, ${d} points down in ${where(segAt(at))}`, team: w };
  }
  /* down to the wire: sudden death, a single point, or the lead taken for good in the night's last part */
  if (w != null) {
    const margin = Math.abs(g.teams[0].score - g.teams[1].score);
    let last = -1; L.forEach((p, i) => { if (p[w] <= p[other(w)]) last = i; });
    const took = last + 1 < L.length && S.length > 1 && segAt(last + 1) === S[S.length - 1].label ? segAt(last + 1) : null;
    const how = g.sdRounds ? "Settled in sudden death" : margin === 1 ? "Won by a single point" : took ? `${nm(w)} took the lead for good in ${where(took)}` : null;
    if (how) A.wire = { t: "Down to the wire", who: how, team: w };
  }
  /* the most one-sided mini-game, when it really was (the other side on a third of the legs or fewer): a whitewash when they got none */
  if (best && Math.max(...best.legs) >= 3 && Math.min(...best.legs) * 3 <= Math.max(...best.legs)) { const hi = Math.max(...best.legs), lo = Math.min(...best.legs);
    A.oneSided = { t: lo === 0 ? "Whitewash" : "One-way traffic", who: `${best.title}, ${nm(best.team)} ${hi}–${lo}`, team: best.team }; }
  if (steals[0] !== steals[1]) { const t = steals[0] > steals[1] ? 0 : 1; A.thief = { t: "Best thief", who: `${nm(t)}, ${steals[t]} steal${steals[t] === 1 ? "" : "s"}`, team: t }; }
  const b = g.battle;
  if (b?.done && b.winner != null) A.battle = { t: "Battle of the Captains", who: `${g.teams[b.winner].captain || nm(b.winner)}, ${b.score[b.winner]} of ${b.n}`, team: b.winner };
  const pg = g.pinGame;
  if (pg?.done && pg.km && pg.km[0] !== pg.km[1]) { const t = pg.km[0] < pg.km[1] ? 0 : 1; A.aim = { t: "Best aim, Drop the Pin", who: `${nm(t)}, ${Math.round(pg.km[t]).toLocaleString("en")} km off in all`, team: t }; }
  /* the furthest pin of the night (500 km off or more) */
  { let far = 0, ft: 0 | 1 = 0, fq: G = null;
    for (const sub of (pg?.subs || []) as G[]) ([0, 1] as const).forEach((t) => { const km = sub.km?.[t]; if (km != null && km > far) { far = km; ft = t; fq = sub.q; } });
    if (far >= 500 && fq) A.far = { t: "Furthest pin", who: `${nm(ft)}, ${Math.round(far).toLocaleString("en")} km off`, team: ft, note: fq.answer ? (fq.place ? `${fq.answer} (${fq.place})` : String(fq.answer)) : undefined }; }
  /* the wildest guess in Closest To Wins: the furthest off for its size (half the answer away or more) */
  { let wild = 0, wt: 0 | 1 = 0, wg = 0, wq: G = null;
    for (const sub of (g.mini?.subs || []) as G[]) { const ans = Number(sub.q?.answer); if (!Number.isFinite(ans)) continue;
      ([sub.gA, sub.gB] as (number | null)[]).forEach((x, t) => { if (x == null) return; const r = Math.abs(x - ans) / Math.max(Math.abs(ans), 1e-9); if (r > wild) { wild = r; wt = t as 0 | 1; wg = x; wq = sub.q; } }); }
    if (wild >= 0.5 && wq) { const Q = String(wq.question || "");
      A.wild = { t: "Wildest guess, Closest To Wins", who: `${nm(wt)} said ${showNum(wg)}, it was ${showNum(Number(wq.answer))}`, team: wt, note: Q.length > 80 ? Q.slice(0, 79) + "…" : Q || undefined }; } }
  /* Majority Rules: the sharpest player, and the wooden spoon with a word from the judges (29 Oct) */
  const who = (g.majorityGame?.who || {}) as Record<string, { r: number; of: number; team: 0 | 1 }>;
  const mr = Object.entries(who).filter(([, x]) => x.of > 0);
  if (mr.length >= 2) {
    const hi = Math.max(...mr.map(([, x]) => x.r)), lo = Math.min(...mr.map(([, x]) => x.r)), of = Math.max(...mr.map(([, x]) => x.of));
    const top = mr.filter(([, x]) => x.r === hi), worst = mr.filter(([, x]) => x.r === lo), one = (M: typeof mr) => (M.length === 1 ? M[0][1].team : null);
    if (hi > lo) {
      A.sharp = { t: "Sharpest in Majority Rules", who: `${names(top.map(([k]) => k))}, ${hi} of ${of}`, team: one(top) };
      const coin = Math.round(of / 4), quip = lo === 0 ? `Zero. Guessing blind gets about ${coin}.` : lo < coin ? `Guessing blind gets about ${coin}. Just saying.` : lo === coin ? "Exactly what a coin would get. Respect." : "Last, but with dignity.";
      A.spoon = { t: "Wooden spoon, Majority Rules", who: `${names(worst.map(([k]) => k))}, ${lo} of ${of}`, team: one(worst), note: quip, spoon: true };
    }
  }
  /* in this order; more than eight, the plainest go first (best aim, then the thief) */
  const keys = ["comeback", "wire", "oneSided", "thief", "battle", "aim", "far", "wild", "sharp", "spoon"].filter((k) => A[k]);
  for (const k of ["aim", "thief", "battle"]) if (keys.length > 8 && keys.includes(k)) keys.splice(keys.indexOf(k), 1);
  return keys.map((k) => A[k]);
}
