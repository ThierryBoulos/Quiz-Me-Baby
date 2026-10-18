/* What the phones see: the TV's state turned into the public view (Pub, in the
   room for every phone) and the secret (the answer, for the TV and the host only). */
import { QMB, acceptFor } from "../engine";
import { getSettings } from "../settings";
import type { Member } from "../room";
import { DECIDED, iso, MINI_TITLES, T_NEXT_FALLBACK, type MiniKey, type Pub, type Secret, type Two } from "../game";
import { WAITS_FOR_NEXT, dishKind, miniOf, miniState, other, type G, type W } from "./rules";
import { closestW, currentQ, leadOf, matchQ, okWin, sayWin, seatOf } from "./reads";
import { recap } from "./recap";
import type { TvState } from "./state";

/* The question in play goes out under a number that means nothing outside this game (D5): its
   real id would find the answer in a bank file. The phones use it only to tell questions apart. */
const qk = (s: TvState, id: string) => "k" + (s.qkeys[id] ??= Object.keys(s.qkeys).length + 1);
export function buildView(s: TvState, mem: Member[]): [Pub, Secret] | null {
  const g = s.g;
  if (!g) return null;
  const rd = g.rounds[g.r];
  const owner = rd ? QMB.seatTeam(g, rd, g.seat, seatOf(g)) : 0;
  const q = currentQ(s);
  const p: Pub = {
    screen: s.screen, step: s.step, r: g.r, N: g.rounds.length, theme: rd?.theme, mode: s.nohost ? "nohost" : "host",
    /* names go out isolated, so a right-to-left (Arabic) name can't scramble the sentence it lands in */
    teams: g.teams.map((t: G) => ({ name: iso(t.name), score: t.score, ll: { ...t.ll } })),
    deadline: s.deadline, left: s.left, timeUp: s.timeUp, lifeline: s.lifeline, toast: s.toast, winner: g.winner ?? null,
    sent: [!!s.typed[0] || s.guesses[0] != null, !!s.typed[1] || s.guesses[1] != null],
    pending: s.pending ? { team: s.pending.team, text: s.pending.text, v: s.pending.v, until: s.pending.until } : null,
    autoAt: s.autoAt, paused: s.paused, lead: leadOf(mem), imad: s.imad || undefined, flags: s.flags.slice(-30), tvAway: !!s.tvAway,
  };
  /* with a host: the typed answer rides with the screen (the host's phone shows it at once; the app's opinion follows with the secret) */
  if (!s.nohost && ["ask", "steal", "dishQ", "battleQ", "sudden", "battleTie"].includes(s.screen)) p.said = [s.typed[0], s.typed[1]];
  /* the next pictures, fetched ahead on every screen (the TV takes the whole deck at the intro) */
  { const fg = g.flagGame, mg = g.mapGame, sc = s.screen, all = /Intro$/.test(sc);
    if (fg && /^flag/.test(sc)) p.preload = { flags: fg.qs.slice(fg.i, all ? undefined : fg.i + 3).map((x: G) => x.flag).filter(Boolean) };
    if (mg && /^map/.test(sc)) p.preload = { maps: mg.qs.slice(mg.i, all ? undefined : mg.i + 2).map((x: G) => x.id) }; }
  /* every change of score, for the recap's lead changes */
  { const L = s.scoreLog, now: Two<number> = [g.teams[0].score, g.teams[1].score], last = L[L.length - 1];
    if (!last || last[0] !== now[0] || last[1] !== now[1]) L.push(now); }
  if (s.screen === "final") p.recap = recap(s);
  /* no host, the answer card: the first team can appeal once if its answer went down as wrong */
  if (s.nohost && s.screen === "answer" && rd) {
    const res = rd.res?.[g.seat];
    p.appeal = s.appeal;
    if (!s.appeal && res && !res.correct && !res.appealed && s.typed[owner]) p.appealable = owner;
  }
  /* the tracker: every round and mini-game of the night, in order (Classic's schedule/pipState) */
  const live = s.screen === DECIDED ? s.decided?.key ?? null : miniOf(s.screen);
  const sched: { kind: "std" | "mini"; i?: number; key?: string }[] = [];
  g.rounds.forEach((_: G, i: number) => { sched.push({ kind: "std", i }); (g.plan || []).forEach((pl: G) => { if (pl.after === i) sched.push({ kind: "mini", key: pl.key }); }); });
  if (!g.rounds.length) (g.plan || []).forEach((pl: G) => sched.push({ kind: "mini", key: pl.key }));
  if (g.hasBattle) sched.push({ kind: "mini", key: "battle" });
  p.pips = sched.map((x) => ({ kind: x.kind, state: x.kind === "mini"
    ? (live === x.key ? "now" : g.done[x.key!] ? "done" : "todo")
    : (x.i === g.r && !live && s.screen !== "final" && s.screen !== "sudden" ? "now" : g.rounds[x.i!]?.done ? "done" : "todo") }));
  p.captains = [0, 1].map((t) => { const n = mem.find((m) => m.team === t && m.role === "captain")?.name; return n ? iso(n) : null; }) as [string | null, string | null];
  { const t = getSettings();
    p.tMini = t.tMini;
    p.timers = { question: t.tQuestion, steal: t.tSteal, friend: t.tFriend, contest: t.tContest, sudden: t.tSudden, mini: t.tMini, flag: t.tFlag, map: t.tMap, say: t.tSay,
      auction: t.tAuction, dishStep: t.tDishStep, dishType: t.tDishType, battleHost: t.tBattleHost, battleTyped: t.tBattleTyped }; }
  /* no host: whose Start or Next the room is waiting for */
  if (s.nohost && !s.pending && WAITS_FOR_NEXT.has(s.screen) && !(s.screen === "sudden" && g.sdReady)
    && !(s.screen === "mapReveal" && (s.ok[0] == null || s.ok[1] == null))) {
    p.nextBy = p.captains[leadOf(mem)] || "The captain";
    p.nextOpenAt = s.waitSince + T_NEXT_FALLBACK * 1000; p.nextOther = p.captains[other(leadOf(mem))];
  }
  const secret: Secret = { step: s.step, typed: s.typed, match: [matchQ(s.typed[0], q), matchQ(s.typed[1], q)], guesses: s.guesses };
  if (q) { p.qid = secret.qid = qk(s, q.id); secret.answer = q.answer; secret.notes = q.notes; secret.accept = acceptFor(q).slice(0, 8); }
  if (rd) {
    p.first = QMB.seatTeam(g, rd, 0, seatOf(g));
    p.dbl = [...rd.dbl] as Two<boolean>;
    p.llUsed = [[...rd.llUsed[0]], [...rd.llUsed[1]]];
    if (["ask", "steal", "answer"].includes(s.screen)) {
      p.question = q.question;
      p.turn = s.screen === "steal" ? other(owner) : owner;
    }
    if (s.screen === "answer") {
      const res = rd.res[g.seat] || { correct: false, stolen: false };
      p.result = { answer: q.answer, notes: q.notes, correct: res.correct, stolen: res.stolen, typed: s.typed,
        by: res.correct ? owner : res.stolen ? other(owner) : null, pts: QMB.pointValue(rd, owner), owner };
    }
    if (s.screen === "roundScore") p.roundPts = [...rd.pts] as Two<number>;
    if (s.screen === "roundIntro") p.turn = p.first;
  }
  if (s.screen === "sudden" && g.sd) {
    p.question = g.sdReady ? g.sd.q.question : undefined;
    p.sudden = { ready: !!g.sdReady, shown: !!g.sd.shown, n: g.sd.n, answer: g.sd.shown ? g.sd.q.answer : undefined };
    p.buzz = s.sdBuzz; p.out = [...s.sdOut] as Two<boolean>;
    secret.qid = p.qid = qk(s, g.sd.q.id); secret.answer = g.sd.q.answer; secret.notes = g.sd.q.notes;
  }
  /* the mini-games */
  const key = s.screen === DECIDED ? s.decided?.key ?? null : miniOf(s.screen);
  if (s.screen === DECIDED && s.decided) {
    const d = s.decided;
    p.decided = { key: d.key, title: MINI_TITLES[d.key as MiniKey], winner: d.winner, spare: d.spare, pts: g.miniPts };
  }
  if (key === "auction" && g.auction) {
    const a = g.auction;
    p.mini = { key, title: MINI_TITLES[key], leg: Math.min(a.leg + 1, a.n), of: a.n, wins: [...a.wins] as Two<number>, pts: g.miniPts, fun: !!a.fun };
    const last = a.legs[a.legs.length - 1];
    p.auction = { cat: a.q?.question || "", notes: a.q?.notes, bid: a.bid, by: a.by, turn: a.turn, count: a.count, leg: a.leg, n: a.n, wins: [...a.wins] as Two<number>,
      bids: (() => { const b = (s.bids.leg === a.leg ? [...s.bids.by] : [null, null]) as Two<number | null>; if (a.by != null && a.bid > 0) b[a.by as 0 | 1] = a.bid; return b; })(),
      last: s.screen === "auctionLeg" && last ? { bid: last.bid, by: last.by, count: last.count, made: last.made, won: last.won } : undefined,
      winner: a.done ? a.winner : null, award: a.award };
    /* who counts: the host, or with no host the other captain — named, so the room can call it out */
    if (a.by != null) { const h = mem.find((m) => m.role === "host"); p.auction.countedBy = s.nohost ? p.captains?.[other(a.by as 0 | 1)] || undefined : h ? iso(h.name) : undefined; }
    p.turn = a.turn;
    secret.answer = a.q?.notes || ""; secret.notes = "";
  } else if (key === "battle" && g.battle) {
    const b = g.battle;
    p.mini = { key, title: MINI_TITLES[key], leg: Math.min(b.i + 1, b.n), of: b.n, wins: [...b.score] as Two<number>, pts: g.battlePts || g.miniPts };
    p.battle = { cap: b.cap, i: b.i, n: b.n, score: [...b.score] as Two<number>, last: s.lastAns,
      tb: b.tb?.n, winner: b.done ? b.winner : null, note: b.note, award: b.award };
    if (s.screen === "battleQ" || s.screen === "battleTie") { p.question = q?.question; p.turn = s.screen === "battleQ" ? b.cap : undefined; }
    if (s.screen === "battleTie") { p.buzz = s.sdBuzz; p.out = [...s.sdOut] as Two<boolean>; }
  } else if (key) {
    const m = miniState(g, key);
    p.mini = { key, title: MINI_TITLES[key], leg: Math.min(m.i + 1, m.qs.length), of: m.base, wins: [...m.wins] as Two<number>, pts: g.miniPts, tie: m.i >= m.base, fun: !!m.fun };
    if (key === "dish") p.mini.kinds = m.levels.some((l: string) => l[0] === "c") && m.levels.some((l: string) => l[0] === "d") ? "Cocktails + dishes" : m.levels[0][0] === "c" ? "Cocktails" : "Dishes";
    if (/Summary$/.test(s.screen) && m.verdict) p.summary = { wins: [...m.wins] as Two<number>, winner: m.verdict.winner, needsHost: m.verdict.needsHost, note: m.verdict.note || "", award: m.award };
  }
  /* a reveal's leg counts in the tracker straight away (and moves with the ruling until Next) */
  const prov: W | null = s.screen === "closestReveal" ? closestW(s) : s.screen === "flagReveal" || s.screen === "mapReveal" ? okWin(s) : s.screen === "sayReveal" ? sayWin(s) : null;
  if (prov != null && p.mini) { if (prov === "tie") { p.mini.wins[0]++; p.mini.wins[1]++; } else if (prov === 0 || prov === 1) p.mini.wins[prov]++; }
  if (s.screen === "miniQ" || s.screen === "sayQ") p.question = q?.question;
  if (s.screen === "sayReveal" && q) { p.question = q.question; p.reveal = { answer: q.answer, typed: s.typed, ok: s.ok, app: s.app, w: sayWin(s), offList: s.offList }; }
  if (s.screen === "closestReveal" && q) {
    p.question = q.question;
    p.reveal = { answer: q.answer, guesses: s.guesses, w: closestW(s) };
  }
  if ((s.screen === "flagQ" || s.screen === "flagReveal") && q) p.flag = q.flag;
  if (s.screen === "flagReveal" && q) p.reveal = { answer: q.answer, typed: s.typed, ok: s.ok, app: s.app, w: okWin(s) };
  if ((s.screen === "mapQ" || s.screen === "mapReveal") && q) {
    const reveal = s.screen === "mapReveal";
    p.map = { id: q.id, reveal, hint: (g.mapGame.hints || {})[q.id] ? "on" : undefined, title: reveal ? q.question : undefined, notes: reveal ? q.notes : undefined };
    if (reveal) { p.map.ruled = s.ok; p.reveal = { answer: q.question, typed: s.typed, ok: s.ok, app: s.app, w: okWin(s) }; }
    secret.answer = q.question; secret.notes = q.answer;
  }
  if ((s.screen === "dishQ" || s.screen === "dishReveal" || s.screen === "dishCheck") && q) {
    const L = g.dishGame.leg, shown = s.screen === "dishQ" ? L.shown : q.ings.length;
    p.dish = { kind: dishKind(q), ings: q.ings.slice(0, shown), n: q.ings.length, late: s.late };
    p.buzz = L.buzz; p.out = [...L.out] as Two<boolean>;
    if (s.screen === "dishReveal") { const sub = g.dishGame.subs[g.dishGame.subs.length - 1]; p.reveal = { answer: q.answer, typed: s.typed, w: sub?.winner ?? "none" }; }
  }
  if (s.exit) p.exit = true;
  if (Object.keys(s.ack).length) p.ack = s.ack;
  return [p, secret];
}
