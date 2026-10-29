import { QMB } from "../engine";
import { MINI_TITLES, type MiniKey, type Pub, type Two } from "../game";
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
  return { margin: Math.abs(g.teams[0].score - g.teams[1].score), sudden: !!g.sdRounds, leadChanges: changes, steals, minis, best, chart: chartOf(s.scoreLog), awards: awardsOf(s, steals) };
}

/* the scores through the night, at most 48 points (the first and the last always in) */
function chartOf(L: Two<number>[]): Two<number>[] {
  const pts: Two<number>[] = [[0, 0], ...L];
  if (pts.length <= 48) return pts;
  const out: Two<number>[] = []; const step = (pts.length - 1) / 47;
  for (let i = 0; i < 48; i++) out.push(pts[Math.round(i * step)]);
  return out;
}
/* the awards (29 Oct): the sharpest player in Majority Rules, the best aim in Drop the Pin, the best thief, the Battle's captain */
function awardsOf(s: TvState, steals: Two<number>): NonNullable<Pub["recap"]>["awards"] {
  const g = s.g, out: NonNullable<NonNullable<Pub["recap"]>["awards"]> = [], nm = (t: 0 | 1) => g.teams[t].name;
  const who = (g.majorityGame?.who || {}) as Record<string, { r: number; of: number; team: 0 | 1 }>;
  const mr = Object.entries(who).filter(([, w]) => w.of > 0).sort((a, b) => b[1].r - a[1].r);
  if (mr.length >= 2 && mr[0][1].r > mr[1][1].r) out.push({ t: "Sharpest in Majority Rules", who: `${mr[0][0]}, ${mr[0][1].r} of ${mr[0][1].of}`, team: mr[0][1].team });
  /* ...and the wooden spoon: the fewest right, with a word from the judges (29 Oct) */
  if (mr.length >= 2) {
    const lo = mr[mr.length - 1][1].r, worst = mr.filter(([, w]) => w.r === lo);
    if (worst.length <= 2 && lo < mr[0][1].r) {
      const of = worst[0][1].of, coin = Math.round(of / 4), names = worst.map(([k]) => k).join(" & ");
      const quip = lo === 0 ? `Zero. Guessing blind gets about ${coin}.` : lo < coin ? `Guessing blind gets about ${coin}. Just saying.` : lo === coin ? "Exactly what a coin would get. Respect." : "Last, but with dignity.";
      out.push({ t: "Wooden spoon, Majority Rules", who: `${names}, ${lo} of ${of}`, team: worst.length === 1 ? worst[0][1].team : null, note: quip, spoon: true });
    }
  }
  const pg = g.pinGame;
  if (pg?.done && pg.km && pg.km[0] !== pg.km[1]) { const t = pg.km[0] < pg.km[1] ? 0 : 1; out.push({ t: "Best aim, Drop the Pin", who: `${nm(t)}, ${Math.round(pg.km[t]).toLocaleString("en")} km off in all`, team: t }); }
  if (g.mini?.done && g.mini.wins[0] !== g.mini.wins[1]) { const t = g.mini.wins[0] > g.mini.wins[1] ? 0 : 1; out.push({ t: "Closest To Wins", who: `${nm(t)}, ${g.mini.wins[t]} legs to ${g.mini.wins[other(t)]}`, team: t }); }
  if (steals[0] !== steals[1]) { const t = steals[0] > steals[1] ? 0 : 1; out.push({ t: "Best thief", who: `${nm(t)}, ${steals[t]} steal${steals[t] === 1 ? "" : "s"}`, team: t }); }
  const b = g.battle;
  if (b?.done && b.winner != null) out.push({ t: "Battle of the Captains", who: `${g.teams[b.winner].captain || nm(b.winner)}, ${b.score[b.winner]} of ${b.n}`, team: b.winner });
  return out.slice(0, 5);
}
