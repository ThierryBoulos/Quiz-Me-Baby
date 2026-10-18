/* What the TV's state says, without changing it: the question in play, whose turn
   it is, who leads the night with no host, who won the leg on screen. */
import { QMB, acceptFor } from "../engine";
import type { Member } from "../room";
import { other, type G, type W } from "./rules";
import type { TvState } from "./state";

/* who answers first: fixed for the whole game when it starts (Settings → alternate) */
export const seatOf = (g: G) => ({ alternateFirst: !!g?.alternateFirst });
/* the question in play right now, whatever the game */
export function currentQ(s: TvState): G {
  const g = s.g;
  if (!g) return null;
  const sc = s.screen;
  if (["ask", "steal", "answer"].includes(sc)) return g.rounds[g.r]?.q[g.seat];
  if (sc === "sudden") return g.sdReady ? g.sd?.q : null;
  if (["miniQ", "closestReveal"].includes(sc)) return g.mini.qs[g.mini.i];
  if (["flagQ", "flagReveal"].includes(sc)) return g.flagGame.qs[g.flagGame.i];
  if (["mapQ", "mapReveal"].includes(sc)) return g.mapGame.qs[g.mapGame.i];
  if (["dishQ", "dishCheck"].includes(sc)) return g.dishGame.qs[g.dishGame.i];
  if (sc === "dishReveal") { const subs = g.dishGame.subs; return subs[subs.length - 1]?.q; }
  if (/^auction(Bid|Run)$/.test(sc)) return g.auction?.q;
  if (sc === "sayQ" || sc === "sayReveal") return g.saySame.qs[g.saySame.i];
  if (sc === "battleQ") return g.battle?.qs[g.battle.cap][g.battle.i];
  if (sc === "battleTie") return g.battle?.tb?.q;
  return null;
}
/* right if it matches the answer or any other answer that counts (see acceptFor) */
export const matchQ = (texts: string[] | null, q: G) => (texts && q ? texts.some((t) => QMB.isMatch(t, q.answer, acceptFor(q))) : null);
/* the captain who moves the night on with no host: Team A's, or B's if A has none */
export const leadOf = (members: Member[]): 0 | 1 => (members.some((m) => m.team === 0 && m.role === "captain") ? 0 : 1);
export function turnOf(s: TvState): 0 | 1 {
  const g = s.g, rd = g.rounds[g.r];
  if (s.screen === "auctionBid" || s.screen === "auctionRun") return g.auction.turn;
  if (s.screen === "battleQ") return g.battle.cap;
  if (!rd) return 0;
  const owner = QMB.seatTeam(g, rd, g.seat, seatOf(g));
  return s.screen === "steal" ? other(owner) : owner;
}

/* Closest: nearer wins; level is a point each; nobody wrote anything, nobody scores */
export function closestW(s: TvState): W {
  const q = s.g.mini.qs[s.g.mini.i], [a, b] = s.guesses;
  if (a == null && b == null) return "none";
  if (a == null) return 1;
  if (b == null) return 0;
  const ans = Number(q.answer), da = Math.abs(a - ans), db = Math.abs(b - ans);
  return da === db ? "tie" : da < db ? 0 : 1;
}
/* Say Same: ok = dodged the word. One team dodging alone takes it; otherwise a point each */
export const sayWin = (s: TvState): W => { const [a, b] = s.ok; return a && !b ? 0 : b && !a ? 1 : "tie"; };
export const okWin = (s: TvState): W => { const [a, b] = s.ok; return a && b ? "tie" : a ? 0 : b ? 1 : "none"; };

/* The calls on this screen that can be contested: the answer card (the first team's answer, and
   the steal), each team's flag, word or map, each answer of a dish leg, every Battle answer at the
   review. A call with nothing typed, or already looked at, can't be contested again. */
export type Call = { id: string; team: 0 | 1; text: string; ok: boolean; done?: boolean; note?: string };
export function callsOf(s: TvState): Call[] {
  const g = s.g, sc = s.screen, out: Call[] = [];
  if (!g) return out;
  const said = (x: string[] | null | undefined) => (x || []).join(" / ");
  if (sc === "answer") {
    const rd = g.rounds[g.r], res = rd?.res?.[g.seat];
    if (!res) return out;
    const owner = QMB.seatTeam(g, rd, g.seat, seatOf(g)) as 0 | 1, th = other(owner);
    out.push({ id: "first", team: owner, text: said(s.typed[owner]), ok: !!res.correct, done: !!res.fresh, note: res.fresh ? "the first question" : undefined });
    /* a steal with the first team's own answer gave it back to them: one call, theirs */
    if (res.steal && !res.same) out.push({ id: "steal", team: th, text: said(s.typed[th]), ok: !!res.stolen, done: !!res.correct, note: res.fresh ? "a new question" : "steal" });
  } else if (sc === "flagReveal" || sc === "sayReveal" || sc === "mapReveal") {
    for (const t of [0, 1] as const) out.push({ id: "t" + t, team: t, text: said(s.typed[t]), ok: !!s.ok[t] });
  } else if (sc === "dishReveal") {
    (s.legLog || []).forEach((e, i) => out.push({ id: "d" + i, team: e.team, text: e.text, ok: e.ok }));
  } else if (sc === "battleReview" && g.battle) {
    (g.battle.log as G[][]).forEach((L, cap) => (L || []).forEach((e: G, i: number) => {
      if (e) out.push({ id: `b${cap}-${i}`, team: cap as 0 | 1, text: e.said || "", ok: !!e.got, note: String(i + 1) });
    }));
  }
  for (const c of out) if (!c.text || (s.contested || []).includes(c.id)) c.done = true;
  return out;
}
