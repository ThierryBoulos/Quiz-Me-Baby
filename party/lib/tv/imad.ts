/* Imad, the MC: one line per moment, never the same twice in a night (until a
   moment's lines run out), real names and numbers filled in. Lines from the same
   instant ("Correct!" then "LEAD CHANGE!") go up as one. (Classic's Host) */
import { QMB } from "../engine";
import { getSettings } from "../settings";
import { HOST_LINES } from "../imadLines";
import { iso } from "../game";
import { miniOf, miniState, other, type G } from "./rules";
import { fireOf, seatOf } from "./reads";
import type { TvState } from "./state";

/* Imad's own dice, so his chatter never touches Math.random (the simulator seeds that one for the bots) */
let dice = (Date.now() ^ 0x9e3779b9) >>> 0;
const rnd = () => { dice = (Math.imul(dice, 1664525) + 1013904223) >>> 0; return dice / 4294967296; };
export function imadSay(s: TvState, moments: string[] | string, extra?: G) {
  const g = s.g;
  if (!g || !getSettings().imad) return;
  for (const m of ([] as string[]).concat(moments)) if (MOOD[m]) s.imadMood = MOOD[m];
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
    const i = free[Math.floor(rnd() * free.length)];
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
  if (sc === "decided" && s.decided && !g.hostOnce?.["dec:" + s.decided.key]) imadOnce(s, "dec:" + s.decided.key, "decided", { t: s.decided.winner });
  if (sc === "battleHandoff" && g.battle) imadOnce(s, "bh", "battle_half", { t: g.battle.cap });
  /* on fire: said once each time it lights */
  if (/Intro$/.test(sc)) s.streak = [0, 0];
  const fire = fireOf(s);
  for (const t of [0, 1] as const) if (fire[t] && !s.fireWas[t]) imadSay(s, "fire", { t });
  s.fireWas = fire;
  imadFlush(s);
}
export function imadFlush(s: TvState) {
  if (s.imadQ.length) { s.imad = { id: ++s.imadN, text: s.imadQ.join(" "), ...(s.imadMood ? { mood: s.imadMood } : {}) }; s.imadQ = []; s.imadMood = ""; }
}
/* the legs taken in a row, from the engine's own words; a new mini-game starts cold (29 Oct) */
export function fireLeg(s: TvState, text: string) {
  const g = s.g; if (!g) return;
  const m = /^(.+?) takes (?:leg|map|flag|landmark|board|number) \d+\.$/.exec(text);
  if (m) { const t = g.teams.findIndex((x: G) => x.name === m[1]); if (t === 0 || t === 1) { s.streak[t]++; s.streak[other(t)] = 0; } }
  else if (/^Nobody got it/.test(text)) s.streak = [0, 0];
}
/* a leg's outcome, as the engine says it in a toast; a contest settled. Not every time: he'd never shut up. (29 Oct) */
export function imadOnToast(s: TvState, text: string) {
  const g = s.g; if (!g) return;
  const r = rnd(), m = /^(.+?) takes (?:leg|map|flag|landmark|board|number) \d+\.$/.exec(text);
  if (m) { const t = g.teams.findIndex((x: G) => x.name === m[1]); if (t >= 0 && r < 0.3) imadSay(s, "leg", { t }); }
  else if (/^Both got it/.test(text)) { if (r < 0.4) imadSay(s, "both"); }
  else if (/^Nobody got it/.test(text)) { if (r < 0.4) imadSay(s, "nobody"); }
  else if (/^Call changed/.test(text)) imadSay(s, "contest");
  imadFlush(s);
}
