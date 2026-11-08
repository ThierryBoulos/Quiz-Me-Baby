/* Imad, the MC, with 3-8 teams (8 Nov, the owner: as with two teams, and off unless Settings turns him on). His own
   lines (lib/imadLines.ts), never the same twice in a night until a moment's lines run out. With many teams {other}
   is "everyone else", {leader} the team on top, {trailer} the team at the bottom; a line that only makes sense with
   two teams or a buzzer ("Both right", "buzz", the other captain) is left out. */
import { getSettings } from "../settings";
import { HOST_LINES } from "../imadLines";
import { miniOf, type StateM } from "./logic";

let dice = (Date.now() ^ 0x5bd1e995) >>> 0;
const rnd = () => { dice = (Math.imul(dice, 1664525) + 1013904223) >>> 0; return dice / 4294967296; };
const MOOD: Record<string, string> = { miniwin: "yes", final: "yes", lead: "yes", sudden: "lean", close: "lean" };
const TWO_ONLY = /\{othercap\}|\bboth\b|\bbuzz/i;
const MINI: Record<string, string> = { closest: "mini_closest", say: "mini_saysame", map: "mini_map", flag: "mini_flag", pin: "mini_pin",
  airport: "mini_airport", majority: "mini_majority", dish: "mini_dish", sudden: "sudden" };

type V = Record<string, string | number | undefined>;
function say(s: StateM, moments: string[], extra: V = {}) {
  if (!getSettings().imad || !moments.length) return;
  const T = s.teams, order = T.map((_, i) => i).sort((a, b) => T[b].score - T[a].score || a - b);
  const v: V = { other: "everyone else", leader: T[order[0]].name, trailer: T[order[order.length - 1]].name, gap: T[order[0]].score - T[order[1]].score, ...extra };
  const t = typeof extra.t === "number" ? extra.t : Math.floor(rnd() * T.length);
  v.team = v.team ?? T[t].name; v.captain = v.captain ?? ((T[t].captain || "").trim() || T[t].name);
  const used = (s.imadUsed = s.imadUsed || {}), out: string[] = [];
  let mood = "";
  for (const m of moments) {
    const pool = (HOST_LINES[m] || []).map((x, i) => ({ x, i })).filter((e) => !TWO_ONLY.test(e.x));
    if (!pool.length) continue;
    const seen = (used[m] = used[m] || []);
    let free = pool.filter((e) => !seen.includes(e.i));
    if (!free.length) { seen.length = 0; free = pool; }
    const e = free[Math.floor(rnd() * free.length)];
    seen.push(e.i);
    out.push(e.x.replace(/\{(\w+)\}/g, (_k, k) => (v[k] != null ? String(v[k]) : "")));
    if (MOOD[m]) mood = MOOD[m];
  }
  if (out.length) s.imad = { id: (s.imadN = (s.imadN || 0) + 1), text: out.join(" "), ...(mood ? { mood } : {}) };
}

/* after every move: the screen's own moment (once each), and a change of leader */
export function imadMany(s: StateM) {
  if (!getSettings().imad || s.intro) return;
  const once = (s.imadOnce = s.imadOnce || {}), m = miniOf(s), moments: string[] = [], extra: V = {};
  if (s.screen === "intro" && m && !once["i" + s.mi]) {
    once["i" + s.mi] = true;
    if (!once.hello) { once.hello = true; moments.push("start"); }
    if (m.key === "quiz") {
      const rounds = s.minis.filter((x) => x.key === "quiz");
      moments.push("round");
      extra.theme = [...new Set(m.qs.map((q) => String(q.theme || "")).filter(Boolean))].join(" & ");
      extra.n = s.minis.slice(0, s.mi + 1).filter((x) => x.key === "quiz").length; extra.N = rounds.length;
    } else if (MINI[m.key]) moments.push(MINI[m.key]);
  }
  /* a mini-game won (a question round has no "mini-game" to win) */
  if (s.screen === "summary" && m && m.award && m.key !== "quiz" && m.key !== "sudden" && !once["s" + s.mi]) {
    once["s" + s.mi] = true;
    const w = (m.places || []).indexOf(1);
    if (w >= 0 && (m.places || []).filter((p) => p === 1).length === 1) { moments.push("miniwin"); extra.t = w; extra.pts = m.award[w]; extra.ptsWord = `${m.award[w]} points`; }
  }
  const T = s.teams, top = Math.max(...T.map((x) => x.score)), lead = T.filter((x) => x.score === top).length === 1 ? T.findIndex((x) => x.score === top) : null;
  if (s.screen === "final" && !once.final) { once.final = true; moments.push(lead == null ? "finaltie" : "final"); }
  else if (lead != null && top > 0) { if (s.imadLeader != null && s.imadLeader !== lead) moments.push("lead"); s.imadLeader = lead; }
  say(s, moments, extra);
}
/* a contest ruled on */
export const imadContest = (s: StateM) => say(s, ["contest"]);
