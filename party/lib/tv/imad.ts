/* Imad, the MC: one line per moment, never the same twice in a night (until a
   moment's lines run out), real names and numbers filled in. Lines from the same
   instant ("Correct!" then "LEAD CHANGE!") go up as one. (Classic's Host) */
import { QMB } from "../engine";
import { getSettings } from "../settings";
import { HOST_LINES } from "../imadLines";
import { iso } from "../game";
import { miniOf, miniState, other, type G } from "./rules";
import { seatOf } from "./reads";
import type { TvState } from "./state";

export function imadSay(s: TvState, moments: string[] | string, extra?: G) {
  const g = s.g;
  if (!g || !getSettings().imad) return;
  const T = g.teams.map((t: G) => ({ ...t, name: iso(t.name), captain: t.captain ? iso(t.captain) : t.captain })),
    cap = (i: 0 | 1) => (T[i].captain || "").trim() || T[i].name, v: G = { ...(extra || {}) };
  if (v.t === 0 || v.t === 1) { v.team = T[v.t].name; v.other = T[1 - v.t].name; v.captain = cap(v.t); v.othercap = cap(other(v.t)); }
  else { v.team = v.team || T[0].name; v.other = v.other || T[1].name; v.captain = v.captain || cap(0); v.othercap = v.othercap || cap(1); }
  const d = T[0].score - T[1].score;
  v.leader = T[d >= 0 ? 0 : 1].name; v.trailer = T[d >= 0 ? 1 : 0].name; v.gap = Math.abs(d);
  for (const m of ([] as string[]).concat(moments)) {
    const pool = HOST_LINES[m]; if (!pool?.length) continue;
    const seen: number[] = ((g.hostUsed = g.hostUsed || {})[m] = g.hostUsed[m] || []);
    let free = pool.map((_, i) => i).filter((i) => !seen.includes(i));
    if (!free.length) { seen.length = 0; free = pool.map((_, i) => i); }
    const i = free[Math.floor(Math.random() * free.length)];
    seen.push(i);
    s.imadQ.push(pool[i].replace(/\{(\w+)\}/g, (_x, k) => (v[k] != null ? String(v[k]) : "")));
  }
}
/* once per game, keyed: a screen shown again stays quiet */
export function imadOnce(s: TvState, key: string, moments: string[] | string, extra?: G) {
  const g = s.g; g.hostOnce = g.hostOnce || {};
  if (g.hostOnce[key]) return false;
  g.hostOnce[key] = true; imadSay(s, moments, extra); return true;
}
/* after every move: the screen's own moment, a change of leader, then up it goes */
export function imadNarrate(s: TvState) {
  const g = s.g;
  if (!g) return;
  const sc = s.screen, rd = g.rounds[g.r];
  const opener = () => (g.hostHello ? [] : ((g.hostHello = true), ["start"]));
  if (sc === "roundIntro" && rd && !g.hostOnce?.["r" + g.r]) imadOnce(s, "r" + g.r, [...opener(), "round"], { t: QMB.seatTeam(g, rd, 0, seatOf(g)), theme: rd.theme, n: g.r + 1, N: g.rounds.length });
  const intro = ({ miniIntro: "closest", auctionIntro: "auction", sayIntro: "saysame", mapIntro: "map", flagIntro: "flag", pinIntro: "pin", airportIntro: "airport", majorityIntro: "majority", dishIntro: "dish", battleIntro: "battle" } as Record<string, string>)[sc];
  if (intro && !g.hostOnce?.["mi:" + intro]) imadOnce(s, "mi:" + intro, [...opener(), "mini_" + intro]);
  if (/Summary$|^auctionResult$/.test(sc)) {
    const m = sc === "auctionResult" ? g.auction : sc === "battleSummary" ? g.battle : miniState(g, miniOf(sc));
    if (m?.award) { const w = m.award[0] > m.award[1] ? 0 : m.award[1] > m.award[0] ? 1 : null; if (w != null) imadOnce(s, "mw:" + sc, "miniwin", { t: w, pts: Math.max(m.award[0], m.award[1]) }); }
  }
  if (sc === "roundScore") { const d = Math.abs(g.teams[0].score - g.teams[1].score); if (d >= 5) imadOnce(s, "rs" + g.r, "big"); else if (d === 1) imadOnce(s, "rs" + g.r, "close"); else if (d === 0) imadOnce(s, "rs" + g.r, "level"); }
  if (sc === "sudden") imadOnce(s, "sd" + (g.sdRounds || 1), "sudden");
  if (sc === "final") imadOnce(s, "final", g.winner == null ? "finaltie" : "final");
  const d = g.teams[0].score - g.teams[1].score, lead = d > 0 ? 0 : d < 0 ? 1 : null;
  if (lead != null) { if (g.hostLeader != null && g.hostLeader !== lead) imadSay(s, "lead"); g.hostLeader = lead; }
  if (s.imadQ.length) { s.imad = { id: ++s.imadN, text: s.imadQ.join(" ") }; s.imadQ = []; }
}
