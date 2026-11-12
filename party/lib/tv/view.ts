/* What the phones see: the TV's state turned into the public view (Pub, in the
   room for every phone) and the secret (the answer, for the TV and the host only). */
import { QMB, aboutHost, acceptFor, hostOnly, revOf } from "../engine";
import { getSettings } from "../settings";
import type { Member } from "../room";
import { DECIDED, iso, MINI_TITLES, T_NEXT_FALLBACK, type MiniKey, type Pub, type Secret, type Two, poss } from "../game";
import { CONTEST_SCREENS, WAITS_FOR_NEXT, dishKind, miniOf, miniState, other, type G, type W } from "./rules";
import { callsOf, closestW, currentQ, fireOf, leadOf, matchQ, mrTally, okWin, pinW, sayWin, seatOf } from "./reads";
import { recap } from "./recap";
import { rrGot, rrPub, rrQ, type RrLap } from "../roulette";
import { skKey, skPub, skQ, skResult, type SkGame } from "../stakes";
import { SEE_TYPE, sePic, seeWinner } from "../see";
import type { TvState } from "./state";

/* The question in play goes out under a number that means nothing outside this game (D5): its
   real id would find the answer in a bank file. The phones use it only to tell questions apart. */
export const qk = (s: TvState, id: string) => "k" + (s.qkeys[id] ??= Object.keys(s.qkeys).length + 1);
/* the question on screen as one id: its own, or where each team has its own (Russian Roulette, Secret Stakes) the
   set of them; Secret Stakes' bets, the round's themes. The phones tag what they send with it (qk), and the TV checks
   the tag against this (tvGame's draftKey), so the two must agree */
export function screenQid(s: TvState): string | null {
  const g = s.g, sc = s.screen;
  if (!g) return null;
  if ((sc === "rouletteQ" || sc === "rouletteReveal") && g.rouletteGame) {
    const m = g.rouletteGame, lap = m.qs[m.i] as RrLap | undefined;
    return lap?.draw ? `rr${m.i}:${[rrQ(lap, 0), rrQ(lap, 1)].map((x: G) => x?.id).join(",")}` : null;
  }
  if ((sc === "stakesQ" || sc === "stakesReveal") && g.stakesGame) return skKey(g.stakesGame as SkGame);
  if (sc === "stakesPick" && g.stakesGame) { const S = g.stakesGame as SkGame; return `skp${S.i}:${(S.rounds[S.i]?.themes || []).join(",")}`; }
  return currentQ(s)?.id ?? null;
}
/* which part of the night a screen is in: a round ("R2"), a mini-game (its name), sudden death; the end tie's
   question (One more / A point each) stays with the part before it */
const segOf = (s: TvState): string | null => {
  const sc = s.screen, k = sc === DECIDED ? s.decided?.key ?? null : miniOf(sc);
  if (k) return MINI_TITLES[k];
  if (sc === "sudden") return "Sudden death";
  return ["roundIntro", "ask", "steal", "answer", "roundScore"].includes(sc) ? `R${s.g.r + 1}` : null;
};
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
    sent: [!!s.typed[0] || s.guesses[0] != null || !!s.pins?.[0], !!s.typed[1] || s.guesses[1] != null || !!s.pins?.[1]],
    pending: s.pending ? { team: s.pending.team, text: s.pending.text, v: s.pending.v, until: s.pending.until } : null,
    autoAt: s.autoAt, paused: s.paused, ...(s.skipHostQ ? { skipHostQ: true } : {}), ...(s.paused && s.pausedBy ? { pausedBy: s.pausedBy } : {}), lead: leadOf(mem), imad: s.imad || undefined, flags: s.flags.slice(-30), tvAway: !!s.tvAway,
  };
  if (s.hostGone) p.hostGone = s.hostGone;
  if (s.agree) { const A = s.agree; p.agree = { id: A.id, kind: A.kind, team: A.team, until: A.until, ...(A.kind === "score" ? { a: A.a, b: A.b } : { what: A.what }) }; }
  /* with a host: the typed answer rides with the screen (the host's phone shows it at once; the app's opinion follows with the secret) */
  if (!s.nohost && ["ask", "steal", "dishQ", "battleQ", "sudden", "battleTie"].includes(s.screen)) { p.said = [s.typed[0], s.typed[1]]; if (s.typedLate != null) p.saidLate = s.typedLate; }
  /* the next pictures, fetched ahead on every screen (the TV takes the whole deck at the intro) */
  { const fg = g.flagGame, mg = g.mapGame, sc = s.screen, all = /Intro$/.test(sc);
    if (fg && /^flag/.test(sc)) p.preload = { flags: fg.qs.slice(fg.i, all ? undefined : fg.i + 3).map((x: G) => x.flag).filter(Boolean) };
    if (mg && /^map/.test(sc)) p.preload = { maps: mg.qs.slice(mg.i, all ? undefined : mg.i + 2).map((x: G) => x.id) };
    /* Drop the Pin: the photos, and the world map itself (big: from the intro on) */
    const pg = g.pinGame;
    if (pg && /^pin/.test(sc)) p.preload = { pins: pg.qs.slice(pg.i, all ? undefined : pg.i + 2).map((x: G) => x.photo).filter(Boolean), world: true };
    /* What Do You See?: the next two pictures (the TV fetches its size, a phone its own) */
    const eg = g.seeGame;
    if (eg && /^see/.test(sc)) p.preload = { sees: eg.qs.slice(eg.i, eg.i + 2).map((x: G) => x.photo).filter(Boolean) }; }
  /* every change of score, for the recap's chart and lead changes; then the part of the night this screen is in (a
     new one starts where the score log is now). The score first: a mini-game's points land as its result screen
     gives way to the next part's, and they're the mini-game's */
  { const L = s.scoreLog, now: Two<number> = [g.teams[0].score, g.teams[1].score], last = L[L.length - 1];
    if (!last || last[0] !== now[0] || last[1] !== now[1]) L.push(now); }
  { const seg = segOf(s), S = (s.segLog ||= []); if (seg && S[S.length - 1]?.label !== seg) S.push({ label: seg, at: s.scoreLog.length }); }
  if (s.screen === "final") p.recap = recap(s);
  /* on fire (29 Oct), and the glow between questions in the leader's colour: intros, reveals, summaries, the
     answer card and the round score; never while a clock runs or a question is up */
  { const f = fireOf(s); if (f[0] || f[1]) p.fire = f; }
  /* Majority Rules: a player right ten in a row (counting this one) gets a flame on the reveal (29 Oct) */
  if (s.screen === "majorityReveal" && g.majorityGame && s.mrList) {
    const q = currentQ(s), W = (g.majorityGame.who || {}) as Record<string, { run?: number }>;
    const hot = s.mrList.map((e) => ({ name: e.name, n: q && s.votes[e.name] === q.answer ? (W[e.name]?.run || 0) + 1 : 0 })).filter((x) => x.n >= 10);
    if (hot.length) p.mrFire = hot;
  }
  if (/Intro$|Reveal$|Summary$|^(answer|roundScore|decided|auctionLeg|auctionResult|battleHandoff)$/.test(s.screen)) {
    const d = g.teams[0].score - g.teams[1].score; p.glow = d > 0 ? 0 : d < 0 ? 1 : null;
  }
  /* the app's calls on this screen, and one being contested */
  if (CONTEST_SCREENS.includes(s.screen)) { p.calls = callsOf(s); p.contest = s.contest; }
  /* the tracker: every round and mini-game of the night, in order (Classic's schedule/pipState) */
  const live = s.screen === DECIDED ? s.decided?.key ?? null : miniOf(s.screen);
  const sched: { kind: "std" | "mini"; i?: number; key?: string }[] = [];
  g.rounds.forEach((_: G, i: number) => { sched.push({ kind: "std", i }); (g.plan || []).forEach((pl: G) => { if (pl.after === i) sched.push({ kind: "mini", key: pl.key }); }); });
  if (!g.rounds.length) (g.plan || []).forEach((pl: G) => sched.push({ kind: "mini", key: pl.key }));
  if (g.hasBattle) sched.push({ kind: "mini", key: "battle" });
  if (g.hasStakes) sched.push({ kind: "mini", key: "stakes" });
  p.pips = sched.map((x) => ({ kind: x.kind, state: x.kind === "mini"
    ? (live === x.key ? "now" : g.done[x.key!] ? "done" : "todo")
    : (x.i === g.r && !live && s.screen !== "final" && s.screen !== "sudden" ? "now" : g.rounds[x.i!]?.done ? "done" : "todo") }));
  /* the night's intro: the same order, each round with its theme, each mini-game named */
  if (g.nightIntro) {
    let r = 0;
    p.intro = { teams: 2, miniPts: g.miniPts, battlePts: g.battlePts || g.miniPts, go: s.nohost ? leadOf(mem) : null,
      items: sched.map((x) => x.kind === "std" ? { kind: "q" as const, key: "q" + x.i, game: "quiz", title: `Round ${++r}`, themes: [String(g.rounds[x.i!]?.theme || "")].filter(Boolean) }
        : { kind: "mini" as const, key: x.key!, game: x.key!, title: MINI_TITLES[x.key as MiniKey] }) };
  }
  p.captains = [0, 1].map((t) => { const n = mem.find((m) => m.team === t && m.role === "captain")?.name; return n ? iso(n) : null; }) as [string | null, string | null];
  { const t = getSettings();
    p.tMini = t.tMini;
    p.timers = { question: t.tQuestion, steal: t.tSteal, friend: t.tFriend, contest: t.tContest, sudden: t.tSudden, mini: t.tMini, flag: t.tFlag, map: t.tMap, say: t.tSay,
      auction: t.tAuction, dishStep: t.tDishStep, dishType: t.tDishType, battleHost: t.tBattleHost, battleTyped: t.tBattleTyped, pin: t.tPin, airport: t.tAirport, majority: t.tMajority, roulette: t.tRoulette,
      stakesPick: t.tStakesPick, stakesQ: t.tStakesQ, see: t.tSee }; }
  /* no host: whose Start or Next the room is waiting for */
  if (s.nohost && !s.pending && WAITS_FOR_NEXT.has(s.screen) && !(s.screen === "sudden" && g.sdReady)
    && !(s.screen === "mapReveal" && (s.ok[0] == null || s.ok[1] == null))) {
    p.nextBy = p.captains[leadOf(mem)] || "The captain";
    p.nextOpenAt = s.waitSince + T_NEXT_FALLBACK * 1000; p.nextOther = p.captains[other(leadOf(mem))];
  }
  /* a question only a person can judge: the app has no call to suggest */
  const judged = !!q && hostOnly(q);
  const secret: Secret = { step: s.step, typed: s.typed, match: judged ? [null, null] : [matchQ(s.typed[0], q), matchQ(s.typed[1], q)], guesses: s.guesses };
  if (q) { p.qid = secret.qid = qk(s, q.id); secret.answer = q.answer; secret.notes = q.notes; secret.accept = acceptFor(q).slice(0, 8); if (aboutHost(q)) secret.you = true; }
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
    if (s.screen === "battleSummary") { const pr = predictLine(s, g); if (pr) p.battle.predict = pr; }
    /* halfway: all ten of the first captain's, not just the last (20 Oct) */
    if (s.screen === "battleHandoff") p.battle.half = ((b.log?.[0] || []) as G[]).filter(Boolean).map((e) => ({ said: e.said || "", got: !!e.got, answer: e.q?.answer || "" }));
    if (s.screen === "battleQ" || s.screen === "battleTie") { p.question = q?.question; p.turn = s.screen === "battleQ" ? b.cap : undefined; }
    if (s.screen === "battleTie") { p.buzz = s.sdBuzz; p.out = [...s.sdOut] as Two<boolean>; }
  } else if (key === "stakes" && g.stakesGame) {
    /* Secret Stakes: points, not legs, and straight on the night's totals (no "this game" tally, no winner's bonus) */
    const S = g.stakesGame as SkGame, sc = s.screen, scores = [g.teams[0].score, g.teams[1].score];
    p.mini = { key, title: MINI_TITLES[key], leg: Math.min(S.i + 1, S.base), of: S.base, wins: [S.net[0] || 0, S.net[1] || 0], pts: 0 };
    p.stakes = skPub(S, sc, scores, sc === "stakesReveal" ? s.ok : null, sc === "stakesReveal" ? [s.typed[0]?.[0] ?? null, s.typed[1]?.[0] ?? null] : null);
    if (sc === "stakesPick") p.sent = [!!S.picks[0], !!S.picks[1]];
    if (sc === "stakesQ" || sc === "stakesReveal") {
      const qs = [skQ(S, 0), skQ(S, 1)];
      p.qid = secret.qid = qk(s, skKey(S));
      secret.answers = [String(qs[0]?.answer ?? ""), String(qs[1]?.answer ?? "")];
      secret.match = [matchQ(s.typed[0], qs[0]), matchQ(s.typed[1], qs[1])];
      secret.answer = ""; secret.notes = "";
      if (sc === "stakesReveal") {
        p.reveal = { answer: "", typed: s.typed, ok: s.ok, app: s.app, w: okWin(s) };
        /* the round's points go on the night's totals as the reveal comes up, and move with a call changed (the
           engine adds them for good at Next) */
        const res = skResult(S, scores, s.ok);
        p.teams = p.teams.map((t, i) => ({ ...t, score: res.after[i] })) as Pub["teams"];
      }
    }
    if (sc === "stakesPick") p.qid = secret.qid = qk(s, screenQid(s) || "skp");
  } else if (key) {
    const m = miniState(g, key);
    p.mini = { key, title: MINI_TITLES[key], leg: Math.min(m.i + 1, m.qs.length), of: m.base, wins: [...m.wins] as Two<number>, pts: g.miniPts, tie: m.i >= m.base, fun: !!m.fun };
    if (key === "dish") p.mini.kinds = m.levels.some((l: string) => l[0] === "c") && m.levels.some((l: string) => l[0] === "d") ? "Cocktails + dishes" : m.levels[0][0] === "c" ? "Cocktails" : "Dishes";
    if (/Summary$/.test(s.screen) && m.verdict) p.summary = { wins: [...m.wins] as Two<number>, winner: m.verdict.winner, needsHost: m.verdict.needsHost, note: m.verdict.note || "", award: m.award };
    if (s.screen === "majoritySummary" && p.summary) { const who = mrWhoLine(g); if (who) p.summary.who = who; }
    /* Russian Roulette keeps points, not legs: the tracker and the result show them (this lap's counted from its reveal) */
    if (key === "roulette") {
      const lap = m.qs[m.i] as RrLap | undefined, rev = s.screen === "rouletteReveal" && lap?.draw;
      p.mini.wins = (rev ? rrGot(lap!, m.pts, s.ok).map((v, t) => m.pts[t] + v) : [...m.pts]) as Two<number>;
      if (p.summary) p.summary.wins = [...m.pts] as Two<number>;
      if ((s.screen === "rouletteQ" || s.screen === "rouletteReveal") && lap?.draw) {
        p.roulette = rrPub(lap, m.i, m.base, m.n || lap.ch.length, m.pts, s.screen === "rouletteQ" ? s.spinAt : null, rev ? s.ok : null, m.qs.slice(0, m.i));
        const qs = [rrQ(lap, 0), rrQ(lap, 1)];
        p.qid = secret.qid = qk(s, `rr${m.i}:${qs.map((x: G) => x?.id).join(",")}`);
        secret.answers = [String(qs[0]?.answer ?? ""), String(qs[1]?.answer ?? "")];
        secret.match = [matchQ(s.typed[0], qs[0]), matchQ(s.typed[1], qs[1])];
        secret.answer = ""; secret.notes = "";
        if (rev) p.reveal = { answer: "", typed: s.typed, ok: s.ok, app: s.app, w: okWin(s) };
      }
    }
  }
  /* a reveal's leg counts in the tracker straight away (and moves with the ruling until Next) */
  const prov: W | null = s.screen === "closestReveal" ? closestW(s) : s.screen === "flagReveal" || s.screen === "mapReveal" || s.screen === "airportReveal" ? okWin(s)
    : s.screen === "seeReveal" ? seeWinner(s.ok, s.seeAt)
    : s.screen === "sayReveal" ? sayWin(s) : s.screen === "pinReveal" ? pinW(s) : null;
  if (prov != null && p.mini) { if (prov === "tie") { p.mini.wins[0]++; p.mini.wins[1]++; } else if (prov === 0 || prov === 1) p.mini.wins[prov]++; }
  if (s.screen === "miniQ" || s.screen === "sayQ") p.question = q?.question;
  if (s.screen === "sayReveal" && q) { p.question = q.question; p.reveal = { answer: q.answer, typed: s.typed, ok: s.ok, app: s.app, w: sayWin(s), offList: s.offList }; }
  if (s.screen === "closestReveal" && q) {
    p.question = q.question;
    p.reveal = { answer: q.answer, guesses: s.guesses, w: closestW(s), notes: q.notes };
  }
  if ((s.screen === "flagQ" || s.screen === "flagReveal") && q) p.flag = q.flag;
  /* What Do You See?: the picture and how it clears (never its answer); a wrong guess, out; at the reveal what it
     was, its credit, who got it and how fast (the fastest right answer, as the calls stand) */
  if ((s.screen === "seeQ" || s.screen === "seeReveal") && q && g.seeGame) {
    const m = g.seeGame;
    p.see = { ...sePic(q), total: s.total || getSettings().tSee, n: m.i + 1, of: m.base, out: [...s.seeOut] };
    /* (the buzzer, 12 Nov: who buzzed and until when they have to say it and type it; out, as the Cocktail or Dish) */
    if (s.screen === "seeQ") { p.buzz = s.seeBuzz; p.out = [...s.seeOut] as Two<boolean>;
      p.see.buzz = s.seeBuzz; p.see.by = s.seeBuzz != null ? s.seeBy : null; p.see.typeBy = s.seeBuzz != null && s.buzzAt && !s.typed[s.seeBuzz] ? s.buzzAt + SEE_TYPE * 1000 : null; }
    if (s.screen === "seeReveal") {
      const w = seeWinner(s.ok, s.seeAt);
      p.see.rev = { answer: q.answer, notes: q.notes || undefined, credit: q.credit, licence: q.licence, who: w === "none" ? null : w, ms: w === "none" ? null : s.seeAt[w], at: [...s.seeAt] };
      p.reveal = { answer: q.answer, typed: s.typed, ok: s.ok, app: s.app, w, notes: q.notes };
    }
  }
  if (s.screen === "flagReveal" && q) p.reveal = { answer: q.answer, typed: s.typed, ok: s.ok, app: s.app, w: okWin(s) };
  /* Drop the Pin: the photo alone, at every level (24 Oct: no name on the hard ones); at the reveal, where it is and both pins */
  if ((s.screen === "pinQ" || s.screen === "pinReveal") && q) {
    p.pin = { photo: q.photo, credit: q.credit, licence: q.licence };
    if (s.screen === "pinReveal") {
      const L = QMB.pinLeg(q, s.pins);
      p.pin.reveal = { at: { lat: q.lat, lon: q.lon }, name: q.answer, place: q.place, pins: [s.pins[0], s.pins[1]], km: L.km };
      p.reveal = { answer: q.answer, w: L.w, notes: q.place };
    }
  }
  /* Majority Rules: the join screen lists everyone on each team as it stands; from Start, the list is fixed */
  if (s.screen === "majorityIntro") {
    const out = new Set(s.mrOut || []), here = new Set(s.mrHere || []);
    p.majority = { list: mem.filter((m) => (m.team === 0 || m.team === 1) && m.role !== "host")
      .map((m) => ({ name: iso(m.name), team: m.team as 0 | 1, here: here.has(m.user_id), out: out.has(m.name) || undefined })),
      ask: s.mrAsk ? { name: iso(s.mrAsk.name), team: s.mrAsk.team, until: s.mrAsk.until } : null };
  }
  if ((s.screen === "majorityQ" || s.screen === "majorityReveal") && q) {
    const m = g.majorityGame, t = mrTally(s);
    p.question = q.question;
    p.majority = { on: (s.mrList || []).map((e) => e.name), options: q.options, n: [m.n[0], m.n[1]], answered: t.answered,
      totals: { right: [m.right[0], m.right[1]], of: [m.of[0], m.of[1]] } };
    /* the reveal counts this question in the totals straight away (the engine adds it at Next) */
    if (s.screen === "majorityReveal") {
      p.majority.reveal = { answer: q.answer, counts: t.counts, right: t.right, notes: q.notes || undefined };
      p.majority.totals = { right: [m.right[0] + t.right[0], m.right[1] + t.right[1]], of: [m.of[0] + m.n[0], m.of[1] + m.n[1]] };
      if (p.mini) p.mini.wins = [0, 1].map((k) => Math.round((100 * p.majority!.totals!.right[k]) / (p.majority!.totals!.of[k] || 1))) as Two<number>;
    }
  }
  if (key === "majority" && p.mini) p.mini.pct = true;
  /* Guess the Airport: the board (never its name, nor its code: they're the answer); at the reveal, all of it */
  if ((s.screen === "airportQ" || s.screen === "airportReveal") && q) {
    const reveal = s.screen === "airportReveal";
    p.airport = { title: q.boardTitle, board: q.board, code: reveal ? q.code : undefined, city: reveal ? q.city : undefined };
    if (reveal) p.airport.cityOk = acceptFor(q).some((a) => QMB.tidy(a) === QMB.tidy(q.city || ""));
    if (reveal) p.reveal = { answer: q.answer, typed: s.typed, ok: s.ok, app: s.app, w: okWin(s), notes: q.notes };
  }
  if ((s.screen === "mapQ" || s.screen === "mapReveal") && q) {
    const reveal = s.screen === "mapReveal";
    p.map = { id: q.id, reveal, hint: (g.mapGame.hints || {})[q.id] ? "on" : undefined, title: reveal ? q.question : undefined, notes: reveal ? q.notes : undefined, ...(reveal && revOf(q) ? { rev: revOf(q) } : {}) };
    if (reveal) { p.map.ruled = s.ok; p.reveal = { answer: q.question, typed: s.typed, ok: s.ok, app: s.app, w: okWin(s) }; }
    secret.answer = q.question; secret.notes = q.answer;
  }
  if ((s.screen === "dishQ" || s.screen === "dishReveal" || s.screen === "dishCheck") && q) {
    const L = g.dishGame.leg, shown = s.screen === "dishQ" ? L.shown : q.ings.length;
    p.dish = { kind: dishKind(q), ings: q.ings.slice(0, shown), n: q.ings.length, late: s.late,
      typeBy: s.screen === "dishQ" && L.buzz != null && s.buzzAt && !s.typed[L.buzz as 0 | 1] && !s.pending ? s.buzzAt + getSettings().tDishType * 1000 : null };
    p.buzz = L.buzz; p.out = [...L.out] as Two<boolean>;
    if (s.screen === "dishReveal") { const sub = g.dishGame.subs[g.dishGame.subs.length - 1]; p.reveal = { answer: q.answer, typed: s.typed, w: sub?.winner ?? "none" }; }
  }
  if (s.exit) p.exit = true;
  if (Object.keys(s.ack).length) p.ack = s.ack;
  return [p, secret];
}

/* Majority Rules: the players with the most and the fewest right answers over the game (29 Oct) */
function mrWhoLine(g: G): string {
  const W = (g.majorityGame?.who || {}) as Record<string, { r: number; of: number }>;
  const all = Object.entries(W).filter(([, w]) => w.of > 0);
  if (all.length < 2) return "";
  const hi = Math.max(...all.map(([, w]) => w.r)), lo = Math.min(...all.map(([, w]) => w.r));
  const names = (n: number) => { const L = all.filter(([, w]) => w.r === n).map(([k]) => k); return L.length > 3 ? `${L.length} players` : L.join(" & "); };
  const of = Math.max(...all.map(([, w]) => w.of));
  return hi === lo ? `Everyone got ${hi} of ${of}.` : `Most right: ${names(hi)}, ${hi} of ${of} · Fewest: ${names(lo)}, ${lo} of ${of}`;
}
/* the Battle: whose call on their captain's score was closest, per team (29 Oct) */
function predictLine(s: TvState, g: G): string {
  const b = g.battle; if (!b) return "";
  const out: string[] = [];
  for (const t of [0, 1] as const) {
    const ps = Object.values(s.predict || {}).filter((p) => p.team === t);
    if (!ps.length) continue;
    const got = b.score[t], best = Math.min(...ps.map((p) => Math.abs(p.n - got)));
    const w = ps.filter((p) => Math.abs(p.n - got) === best);
    out.push(best === 0 ? `${w.map((p) => p.name).join(" & ")} called ${poss(g.teams[t].name)} ${got} spot on`
      : `${w.map((p) => p.name).join(" & ")} closest for ${g.teams[t].name}: ${w[0].n} (they got ${got})`);
  }
  return out.join(" · ");
}
