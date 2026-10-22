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
  ([["closest", g.mini], ["saysame", g.saySame], ["flag", g.flagGame], ["map", g.mapGame], ["pin", g.pinGame], ["airport", g.airportGame], ["dish", g.dishGame]] as [MiniKey, G][])
    .forEach(([k, m]) => won(MINI_TITLES[k], m?.award, m ? [m.wins[0], m.wins[1]] : undefined));
  if (g.auction) won(MINI_TITLES.auction, g.auction.award, [g.auction.wins[0], g.auction.wins[1]]);
  if (g.battle) won(MINI_TITLES.battle, g.battle.award);
  let changes = 0, lead = 0;
  s.scoreLog.forEach(([a, b]) => { const now = Math.sign(a - b); if (now && lead && now !== lead) changes++; if (now) lead = now; });
  return { margin: Math.abs(g.teams[0].score - g.teams[1].score), sudden: !!g.sdRounds, leadChanges: changes, steals, minis, best };
}
