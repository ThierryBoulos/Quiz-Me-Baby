"use client";
/* A two-team mini-game's result in the look the 3-8 team night gave each game (the owner, 31 Oct): the bars, the
   flag pole, the ruler, the pins on the map, the departures board, the glasses, the speech bubbles. It makes plain
   that these numbers are this game's, not the night's. The night's total still gets its "+2" from the line under it. */
import type { Pub } from "@/lib/game";
import { MANY_COLORS } from "@/lib/many/logic";
import type { PubMany } from "@/lib/many/view";
import { BarsMany, BubblesMany, DeparturesMany, FlagPoleMany, GlassesMany, PinsMapMany } from "./many/PartsMany";
import { PinMap } from "./PinMap";
import { Ruler } from "./Ruler";

/* the games that have a look of their own; Auction and Battle keep their board */
export const TWO_LOOKS = ["majority", "flag", "closest", "pin", "map", "airport", "dish", "saysame"];

/* the two-team result, as the 3-8 team pieces read it: each team's points this game, its place (a tie shares 1st),
   and what the place pays the night */
function asMany(pub: Pub): PubMany {
  const S = pub.summary!, m = pub.mini!, w = S.wins, pct = !!m.pct;
  const award = (S.award ?? [S.winner === 0 ? m.pts : 0, S.winner === 1 ? m.pts : 0]) as number[];
  const places = [0, 1].map((t) => (S.winner == null ? 1 : S.winner === t ? 1 : 2));
  return {
    teams: pub.teams.map((t, i) => ({ name: t.name, score: t.score, color: MANY_COLORS[i] })),
    summary: { wins: [...w], pts: [...w], shares: pct ? w.map((x) => x / 100) : undefined, places, award },
  } as unknown as PubMany;
}

export function TwoResult({ pub }: { pub: Pub }) {
  const key = pub.mini?.key;
  if (!pub.summary || !key || !TWO_LOOKS.includes(key)) return null;
  const P = asMany(pub), S = P.summary!;
  if (key === "majority") return <BarsMany pub={P} />;
  if (key === "flag") return <FlagPoleMany pub={P} />;
  if (key === "closest") return <Ruler ans={0} scale teams={P.teams.map((t, i) => ({ name: t.name, color: t.color, letter: "AB"[i], guess: S.pts[i], win: S.places[i] === 1 && S.award[i] > 0, pts: S.award[i] || undefined }))} />;
  if (key === "pin" || key === "map") return <PinsMapMany pub={P} map={<PinMap marks={[]} interactive={false} height="100%" label="The world" bare />} />;
  if (key === "airport") return <DeparturesMany pub={P} />;
  if (key === "dish") return <GlassesMany pub={P} />;
  return <BubblesMany pub={P} />;
}
