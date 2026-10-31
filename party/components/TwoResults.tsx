"use client";
/* A two-team result in the look the 3-8 team night gave each game (the owner, 31 Oct): the bars, the flag pole, the
   ruler, the pins on the map, the departures board, the glasses, the speech bubbles; and for the two-team night's own
   games, the Auction's bidding paddles, the Battle's two shields, and a round's game-show lecterns. Every one in the
   same layout: the title, the picture with each team's place and what it adds under it, then the line the coins fly
   from. It makes plain that these numbers are this game's (or this round's), not the night's. */
import { Fragment } from "react";
import type { Pub, Two } from "@/lib/game";
import { MANY_COLORS } from "@/lib/many/logic";
import type { PubMany } from "@/lib/many/view";
import { BarsMany, BubblesMany, Caption, DeparturesMany, FlagPoleMany, GlassesMany, LecternsMany, PinsMapMany, revealOf } from "./many/PartsMany";
import { PinMap } from "./PinMap";
import { Ruler } from "./Ruler";

/* when the line under a two-team picture comes in: once the second team (the winner) has landed; a tie, both at once */
export const twoDone = (winner: 0 | 1 | null | undefined) => revealOf({ places: winner == null ? [1, 1] : [1, 2] }, 2).done;

/* the mini-games with a look of their own */
export const TWO_LOOKS = ["majority", "flag", "closest", "pin", "map", "airport", "dish", "saysame"];

/* a two-team result, as the 3-8 team pieces read it: each team's points (or share), its place (a tie shares 1st),
   and what the place adds to the night */
function two(pub: Pub, pts: Two<number>, winner: 0 | 1 | null | undefined, award: number[], opts: { pct?: boolean; noAward?: boolean } = {}): PubMany {
  const places = [0, 1].map((t) => (winner == null ? 1 : winner === t ? 1 : 2));
  return {
    teams: pub.teams.map((t, i) => ({ name: t.name, score: t.score, color: MANY_COLORS[i] })),
    summary: { wins: [...pts], pts: [...pts], shares: opts.pct ? pts.map((x) => x / 100) : undefined, places, award, noAward: opts.noAward },
  } as unknown as PubMany;
}
const awardOf = (pub: Pub, winner: 0 | 1 | null | undefined, award?: Two<number>) => (award ?? [winner === 0 ? pub.mini?.pts ?? 0 : 0, winner === 1 ? pub.mini?.pts ?? 0 : 0]) as number[];

export function TwoResult({ pub }: { pub: Pub }) {
  const key = pub.mini?.key, S0 = pub.summary;
  if (!S0 || !key || !TWO_LOOKS.includes(key)) return null;
  const P = two(pub, S0.wins, S0.winner, awardOf(pub, S0.winner, S0.award), { pct: !!pub.mini?.pct }), S = P.summary!;
  if (key === "majority") return <BarsMany pub={P} />;
  if (key === "flag") return <FlagPoleMany pub={P} />;
  if (key === "closest") return <Ruler ans={0} scale teams={P.teams.map((t, i) => ({ name: t.name, color: t.color, letter: "AB"[i], guess: S.pts[i], win: S.places[i] === 1 && S.award[i] > 0, pts: S.award[i] || undefined }))} />;
  if (key === "pin" || key === "map") return <PinsMapMany pub={P} map={<PinMap marks={[]} interactive={false} height="100%" label="The world" bare />} />;
  if (key === "airport") return <DeparturesMany pub={P} />;
  if (key === "dish") return <GlassesMany pub={P} />;
  return <BubblesMany pub={P} />;
}

/* the end of a round of questions: the question-round lecterns, each lit with what the team scored this round */
export function RoundLecterns({ pub }: { pub: Pub }) {
  const p = (pub.roundPts ?? [0, 0]) as Two<number>, w = p[0] === p[1] ? null : p[0] > p[1] ? 0 : 1;
  return <LecternsMany pub={two(pub, p, w, [...p], { noAward: true })} />;
}

/* the Auction: a bidding paddle a team, the lots it won on it; the winner's held up high */
export function AuctionPaddles({ pub }: { pub: Pub }) {
  const A = pub.auction!, P = two(pub, A.wins, A.winner, awardOf(pub, A.winner, A.award)), S = P.summary!, T = P.teams;
  return (
    <div className="flex items-end justify-center gap-24" role="list" aria-label={"Lots won: " + T.map((t, i) => `${t.name} ${S.pts[i]}`).join(", ")}>
      {[0, 1].map((t) => { const lit = S.award[t] > 0 && S.places[t] === 1, c = T[t].color; return (
        <div key={t} role="listitem" className="lectern-in flex flex-col items-center gap-1" style={{ width: 200, animationDelay: revealOf(S, 2).at(t) + "s" }}>
          {/* the winner's paddle held up: the trophy rides above it */}
          <span className="text-28 leading-none relative z-10" style={{ visibility: lit ? "visible" : "hidden", marginBottom: lit ? 34 : 0 }} role={lit ? "img" : undefined} aria-label={lit ? "takes it" : undefined}>🏆</span>
          <svg viewBox="0 0 120 190" width={150} height={238} aria-hidden style={{ overflow: "visible", transform: lit ? "translateY(-28px) rotate(-6deg)" : "rotate(4deg)", transition: "transform .6s" }}>
            <rect x="52" y="104" width="16" height="80" rx="6" fill="#c9a26b" stroke="rgba(0,0,0,.35)" />
            {/* a solid paddle under the colour, so a dimmed one never shows its handle through it (the owner, 31 Oct) */}
            <circle cx="60" cy="58" r="54" fill="#0b0e24" />
            <circle cx="60" cy="58" r="54" fill={c} opacity={S.award[t] > 0 ? 1 : 0.45} style={{ filter: lit ? `drop-shadow(0 0 18px ${c})` : undefined }} />
            <circle cx="60" cy="58" r="44" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="2" />
            <text x="60" y="76" textAnchor="middle" fontFamily="var(--font-display)" fontSize="52" fill="#04050e">{S.pts[t]}</text>
          </svg>
          <Caption pub={P} t={t} dense={false} />
        </div>); })}
    </div>);
}

/* Battle of the Captains: two shields face to face, each captain's score on it; the winner's lit, a trophy over it */
export function BattleShields({ pub }: { pub: Pub }) {
  const B = pub.battle!, P = two(pub, B.score, B.winner, awardOf(pub, B.winner, B.award)), S = P.summary!, T = P.teams;
  const shield = "M60 6 L110 22 L106 84 Q100 132 60 154 Q20 132 14 84 L10 22 Z";
  return (
    <div className="flex items-end justify-center gap-10" role="list" aria-label={"Battle of the Captains: " + T.map((t, i) => `${t.name} ${S.pts[i]}`).join(", ")}>
      {[0, 1].map((t) => { const lit = S.award[t] > 0 && S.places[t] === 1, c = T[t].color; return (<Fragment key={t}>
        {t === 1 && <div className="display text-44 self-center mb-24" style={{ color: "var(--color-ink-3)" }}>VS</div>}
        <div role="listitem" className="lectern-in flex flex-col items-center gap-1" style={{ width: 200, animationDelay: revealOf(S, 2).at(t) + "s" }}>
          <span className="text-28 leading-none" style={{ visibility: lit ? "visible" : "hidden" }} role={lit ? "img" : undefined} aria-label={lit ? "takes it" : undefined}>🏆</span>
          <svg viewBox="0 0 120 160" width={160} height={213} aria-hidden style={{ overflow: "visible" }}>
            <defs><linearGradient id={"sh" + t} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={c} /><stop offset="1" stopColor={c} stopOpacity=".35" /></linearGradient></defs>
            <path d={shield} fill="#0b0e24" />
            <path d={shield} fill={`url(#sh${t})`} opacity={S.award[t] > 0 ? 1 : 0.45} stroke="rgba(255,255,255,.7)" strokeWidth="2.5" style={{ filter: lit ? `drop-shadow(0 0 18px ${c})` : undefined }} />
            <text x="60" y="98" textAnchor="middle" fontFamily="var(--font-display)" fontSize="60" fill="#04050e">{S.pts[t]}</text>
          </svg>
          <Caption pub={P} t={t} dense={false} />
        </div></Fragment>); })}
    </div>);
}
