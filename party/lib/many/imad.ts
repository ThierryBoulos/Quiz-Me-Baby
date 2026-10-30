/* MANY TEAMS: Imad, the MC (lib/tv/imad.ts, for 3 to 8 teams). The same lines, word for word, but only the ones
   that make sense with more than two teams: none that speak of "the other team" ({other}, {othercap},
   {trailer}) or of "both". One line per moment, never the same twice in a night until a moment runs out. Pure:
   the TV's hook calls it after every move; the simulator never does, so its nights stay the same. */
import { HOST_LINES } from "../imadLines";
import { iso } from "../game";
import { legPlaces, miniOf, type StateM } from "./logic";

const TWO = /\{(other|othercap|trailer)\}|\bboth\b|\bversus\b/i;
const POOL: Record<string, string[]> = Object.fromEntries(Object.entries(HOST_LINES).map(([k, v]) => [k, v.filter((l) => !TWO.test(l))]));
const MOOD: Record<string, string> = { leg: "yes", miniwin: "yes", fire: "yes", final: "yes", lead: "yes", nobody: "no", close: "lean" };
let dice = (Date.now() ^ 0x9e3779b9) >>> 0;
const rnd = () => { dice = (Math.imul(dice, 1664525) + 1013904223) >>> 0; return dice / 4294967296; };

/* who leads the night (one team; nobody on a shared top) */
export const leaderOf = (s: StateM): number | null => { const b = Math.max(...s.teams.map((t) => t.score)); const at = s.teams.map((t, i) => (t.score === b ? i : -1)).filter((i) => i >= 0); return b > 0 && at.length === 1 ? at[0] : null; };
/* on fire: 1st three legs in a row in this game */
export const fireOfMany = (s: StateM): boolean[] => s.teams.map((_, i) => (s.stats?.run?.[i] ?? 0) >= 3);

function say(s: StateM, q: string[], moment: string, v: Record<string, string | number> = {}) {
  const pool = POOL[moment]; if (!pool?.length) return "";
  const used = ((s.imadUsed = s.imadUsed || {})[moment] = s.imadUsed[moment] || []);
  let free = pool.map((_, i) => i).filter((i) => !used.includes(i));
  if (!free.length) { used.length = 0; free = pool.map((_, i) => i); }
  const i = free[Math.floor(rnd() * free.length)]; used.push(i);
  const L = leaderOf(s), sorted = s.teams.map((t) => t.score).sort((a, b) => b - a);
  const vars: Record<string, string | number> = { leader: L != null ? iso(s.teams[L].name) : "", gap: (sorted[0] ?? 0) - (sorted[1] ?? 0), ...v };
  q.push(pool[i].replace(/\{(\w+)\}/g, (_x, k) => (vars[k] != null ? String(vars[k]) : "")));
  return MOOD[moment] || "";
}
const once = (s: StateM, key: string) => { s.imadOnce = s.imadOnce || {}; if (s.imadOnce[key]) return false; s.imadOnce[key] = true; return true; };

/* after every move: the screen's own moment, a leg now and then, on fire, a change of leader; then up it goes */
export function imadMany(s: StateM, on: boolean) {
  const q: string[] = []; let mood = "";
  const m = miniOf(s), T = s.teams, team = (t: number) => iso(T[t].name);
  const add = (moment: string, v?: Record<string, string | number>) => { const md = say(s, q, moment, v); if (md) mood = md; };
  if (s.screen === "intro" && m && once(s, "intro" + s.mi)) { if (s.mi === 0) add("start", { team: team(0) }); add("mini_" + m.key); }
  if (s.screen === "reveal" && m && m.key !== "majority" && once(s, `r${s.mi}.${m.i}`)) {
    const first = legPlaces(s).map((p, i) => (p === 1 ? i : -1)).filter((i) => i >= 0);
    if (!first.length) { if (rnd() < 0.5) add("nobody"); }
    else if (first.length === 1 && rnd() < 0.3) add("leg", { team: team(first[0]) });
  }
  if (s.screen === "summary" && m?.award && once(s, "s" + s.mi)) {
    const top = m.award.map((p, i) => (p === Math.max(...m.award!) && p > 0 ? i : -1)).filter((i) => i >= 0);
    if (top.length === 1) add("miniwin", { team: team(top[0]), pts: m.award[top[0]] });
  }
  if (s.screen === "final" && once(s, "final")) { if (leaderOf(s) != null) add("final"); else add("finaltie"); }
  /* a new leader: said when the night's top changes hands (a shared top changes nothing) */
  const L = leaderOf(s);
  if (L != null && s.screen !== "final") { if (s.leader != null && s.leader !== L) add("lead"); s.leader = L; }
  /* on fire: said once each time it lights */
  const fire = fireOfMany(s), was = s.fireWas || [];
  fire.forEach((f, i) => { if (f && !was[i]) add("fire", { team: team(i) }); });
  s.fireWas = fire;
  if (on && q.length) s.imad = { id: (s.imadN = (s.imadN || 0) + 1), text: q.join(" "), ...(mood ? { mood } : {}) };
}
