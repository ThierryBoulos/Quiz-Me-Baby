"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { QMB, acceptFor, loadBank, withCustom, withoutHostOnly, type Bank, type Q } from "./engine";
import { cleanList } from "./custom";
import { HOST_LINES } from "./imadLines";
import { sb } from "./supabase";
import { playSound, type SoundName } from "./sound";
import { getSettings, USED_KEY } from "./settings";
const BUILD_ID = process.env.NEXT_PUBLIC_BUILD || "dev";
import { cap1, notReadyWhy, readyToStart, starter, type Member, type Room } from "./room";
import { DISH_LAST, iso, MINI_TITLES, PARTY_LEGS, TIE_SCREENS, T_AWAY, T_MAP_RULE, T_NEXT_FALLBACK, T_OVERRULE_BATTLE,
  type MiniKey, type Pub, type Secret, type Two } from "./game";

/* the house timers come from Settings on this TV */
const T = () => getSettings();
type Action = { id: number; room: string; user_id: string; kind: string; payload: Record<string, unknown>; at: string };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type G = any;
type W = 0 | 1 | "tie" | "none";
type PKind = "ask" | "steal" | "dish" | "sudden" | "battle" | "battleTie";
type Where = string | string[];
const inScreen = (where: Where, sc: string) => where === "*" || (Array.isArray(where) ? where : [where]).includes(sc);

/* Moves the host's phone may send, and the screen each one belongs to.
   "ui/…" moves are the TV's own (clocks, reveals, overrules); the rest go
   straight to the shared engine. Anything else is refused. */
const HOST_MOVES: Record<string, Where> = {
  "round/armDbl": "roundIntro", "round/begin": "roundIntro", "round/swap": "ask", "round/lifeline": "ask",
  "round/judge": "ask", "round/judgeSteal": "steal", "round/afterAnswer": "answer", "round/next": "roundScore",
  "sudden/go": "sudden", "sudden/show": "sudden", "sudden/swap": "sudden", "sudden/win": "sudden",
  "closest/start": "miniIntro", "closest/swap": "miniQ", "closest/award": "miniSummary", "closest/done": "miniSummary",
  "flag/start": "flagIntro", "flag/swap": "flagQ", "flag/award": "flagSummary", "flag/done": "flagSummary",
  "dish/start": "dishIntro", "dish/swap": "dishQ", "dish/right": "dishQ", "dish/wrong": "dishQ", "dish/next": "dishReveal",
  "dish/more": "dishTie", "dish/stop": "dishTie", "dish/award": "dishSummary", "dish/done": "dishSummary",
  "map/start": "mapIntro", "map/hint": "mapQ", "map/swap": "mapQ", "map/more": "mapTie", "map/stop": "mapTie", "map/award": "mapSummary", "map/done": "mapSummary",
  "auction/begin": "auctionIntro", "auction/skip": "auctionBid", "auction/tick": "auctionRun", "auction/untick": "auctionRun",
  "auction/resolve": "auctionRun", "auction/nextLeg": "auctionLeg", "auction/done": "auctionResult",
  "say/start": "sayIntro", "say/swap": "sayQ", "say/award": "saySummary", "say/done": "saySummary",
  "battle/start": ["battleIntro", "battleHandoff"], "battle/mark": "battleQ", "battle/swap": "battleQ", "battle/tbSwap": "battleTie", "battle/tbWin": "battleTie", "battle/done": "battleSummary",
  "ui/sayOk": "sayReveal",
  "ui/closeLifeline": "*", "ui/timeUp": ["ask", "steal"], "ui/pause": ["ask", "steal", "miniQ", "flagQ", "dishQ", "mapQ", "auctionRun", "sayQ", "battleQ"],
  "ui/reveal": ["miniQ", "flagQ", "mapQ", "sayQ"], "ui/flagOk": "flagReveal", "ui/mapOk": "mapReveal", "ui/next": ["closestReveal", "flagReveal", "mapReveal", "sayReveal"],
  "ui/sdRight": ["sudden", "battleTie"], "ui/sdWrong": ["sudden", "battleTie"],
  "ui/exit": "final",
  /* level at the end of a mini-game: one more, or a point each */
  "tie/more": TIE_SCREENS, "tie/stop": TIE_SCREENS,
  /* Call a Friend's clock */
  "ui/pauseFriend": "ask",
};
/* What a CAPTAIN may tap, and who: "any" captain, the team whose "turn" it
   is, the "other" one (the referee), or the "lead": Team A's captain (Team
   B's if A has none), who starts and moves the night on, like a host would.
   The Auction's bidding is always the captains'; everything else here only
   exists when there's no host. */
type Who = "any" | "turn" | "other" | "lead";
const CAPTAIN_MOVES: Record<string, { where: Where; who: Who; nohostOnly?: boolean }> = {
  "auction/raise": { where: "auctionBid", who: "turn" },
  "auction/pass": { where: "auctionBid", who: "turn" },
  "round/begin": { where: "roundIntro", who: "lead", nohostOnly: true },
  "closest/start": { where: "miniIntro", who: "lead", nohostOnly: true },
  "flag/start": { where: "flagIntro", who: "lead", nohostOnly: true },
  "dish/start": { where: "dishIntro", who: "lead", nohostOnly: true },
  "map/start": { where: "mapIntro", who: "lead", nohostOnly: true },
  "auction/begin": { where: "auctionIntro", who: "lead", nohostOnly: true },
  "sudden/go": { where: "sudden", who: "lead", nohostOnly: true },
  "say/start": { where: "sayIntro", who: "lead", nohostOnly: true },
  "battle/start": { where: ["battleIntro", "battleHandoff"], who: "lead", nohostOnly: true },
  "say/done": { where: "saySummary", who: "lead", nohostOnly: true },
  "battle/done": { where: "battleSummary", who: "lead", nohostOnly: true },
  "ui/sayOk": { where: "sayReveal", who: "other", nohostOnly: true },
  "round/afterAnswer": { where: "answer", who: "lead", nohostOnly: true },
  "round/next": { where: "roundScore", who: "lead", nohostOnly: true },
  "ui/next": { where: ["closestReveal", "flagReveal", "sayReveal", "mapReveal"], who: "lead", nohostOnly: true },
  "dish/next": { where: "dishReveal", who: "lead", nohostOnly: true },
  "auction/nextLeg": { where: "auctionLeg", who: "lead", nohostOnly: true },
  "auction/done": { where: "auctionResult", who: "lead", nohostOnly: true },
  "closest/done": { where: "miniSummary", who: "lead", nohostOnly: true },
  "flag/done": { where: "flagSummary", who: "lead", nohostOnly: true },
  "dish/done": { where: "dishSummary", who: "lead", nohostOnly: true },
  "map/done": { where: "mapSummary", who: "lead", nohostOnly: true },
  "ui/pause": { where: ["ask", "steal", "miniQ", "flagQ", "dishQ", "mapQ", "auctionRun", "sayQ", "battleQ"], who: "any", nohostOnly: true },
  "ui/closeLifeline": { where: "*", who: "turn", nohostOnly: true },
  /* the other captain's call on what was sent: v is RIGHT (true) or WRONG; the app's own call is pre-selected */
  "ui/rule": { where: ["ask", "steal", "dishQ", "sudden", "battleQ", "battleTie"], who: "other", nohostOnly: true },
  "ui/flagOk": { where: "flagReveal", who: "other", nohostOnly: true },
  "ui/mapRule": { where: "mapReveal", who: "other", nohostOnly: true },
  "auction/tick": { where: "auctionRun", who: "other", nohostOnly: true },
  "auction/untick": { where: "auctionRun", who: "other", nohostOnly: true },
  "ui/exit": { where: "final", who: "any", nohostOnly: true },
  "tie/more": { where: TIE_SCREENS, who: "lead", nohostOnly: true },
  "tie/stop": { where: TIE_SCREENS, who: "lead", nohostOnly: true },
  "ui/pauseFriend": { where: "ask", who: "lead", nohostOnly: true },
};
/* Taps that adjust the screen they're on — counting names, marking a team
   right or wrong, pausing. They skip the stale-tap check (and don't bump the
   step): a host tapping +1 five times fast must get five, and a tap on
   "Next" straight after marking a team must not be refused as stale. */
const SAME_SCREEN = new Set(["auction/tick", "auction/untick", "ui/flagOk", "ui/mapOk", "ui/mapRule", "ui/sayOk", "ui/pause", "ui/pauseFriend"]);
/* no host: the screens that wait for the lead captain's Start or Next (nothing moves on by itself) */
const WAITS_FOR_NEXT = new Set(["roundIntro", "miniIntro", "flagIntro", "dishIntro", "mapIntro", "auctionIntro", "sayIntro", "battleIntro", "battleHandoff",
  "answer", "roundScore", "closestReveal", "flagReveal", "mapReveal", "sayReveal", "dishReveal", "auctionLeg", "auctionResult",
  "miniSummary", "flagSummary", "dishSummary", "mapSummary", "saySummary", "battleSummary", "sudden", ...TIE_SCREENS]);
const other = (t: 0 | 1) => (t === 0 ? 1 : 0) as 0 | 1;
const DIFFS = ["easy", "medium", "hard", "mixed"];
/* a picture game's levels from the phone: known ones only, or the default */
const levels = (x: unknown, keys: string[], dflt: string[]) => { const v = (Array.isArray(x) ? x : []).filter((k) => keys.includes(k)); return v.length ? v : dflt; };
const PARTY_MINIS = ["closest", "auction", "saysame", "map", "flag", "dish", "battle"];
/* the server's timestamps, in either spelling ("…T12:00:00.123456+00:00" from a read, "… 12:00:00.123456+00" from a push), as ms */
const serverMs = (x: string) => Date.parse(String(x || "").replace(" ", "T").replace(/(\.\d{3})\d+/, "$1").replace(/([+-]\d\d)$/, "$1:00"));
const dishKind = (q: G) => ((q?.level || "")[0] === "c" ? "Cocktail" : "Dish");
const dishTotal = (q: G) => (q.ings.length - 1) * T().tDishStep + DISH_LAST;
/* how long the other captain has to change the app's call: the Battle is rapid fire, so never more than 8 s there */
const contestSecs = (battle: boolean) => (battle ? Math.min(T().tContest, T_OVERRULE_BATTLE) : T().tContest);
const miniOf = (sc: string): MiniKey | null => /^(mini|closest)/.test(sc) ? "closest" : /^flag/.test(sc) ? "flag" : /^dish/.test(sc) ? "dish"
  : /^map/.test(sc) ? "map" : /^auction/.test(sc) ? "auction" : /^say/.test(sc) ? "saysame" : /^battle/.test(sc) ? "battle" : null;
/* the engine's move prefix for each mini-game */
const PREFIX: Record<MiniKey, string> = { closest: "closest", flag: "flag", dish: "dish", map: "map", auction: "auction", saysame: "say", battle: "battle" };
/* Closest, Say the Same and Flag: the engine goes straight into a tie-breaker leg when level at the end;
   Party stops there first and asks (One more / A point each), as Dish and Map already do */
const TIES: Record<string, { key: MiniKey; q: string; summary: string; award: string }> = {
  miniTie: { key: "closest", q: "miniQ", summary: "miniSummary", award: "closest/award" },
  sayTie: { key: "saysame", q: "sayQ", summary: "saySummary", award: "say/award" },
  flagTie: { key: "flag", q: "flagQ", summary: "flagSummary", award: "flag/award" },
};
const miniState = (g: G, k: MiniKey | null) => k === "closest" ? g.mini : k === "flag" ? g.flagGame : k === "map" ? g.mapGame : k === "dish" ? g.dishGame : k === "saysame" ? g.saySame : null;

/* THE TV RUNS THE NIGHT. It holds the game, plays every move through the
   shared engine (exactly as Classic does), carries out what the engine says
   — screens, clocks, pop-ups — and publishes a view for the phones. It is the
   only device that writes the room, and it checks who sent each action.
   With no host, the TV is the host too: it checks answers, runs the clocks
   and moves the night along, and the captains referee each other. */
export function useTvGame(code: string, isTv: boolean, room: Room | null, members: Member[]) {
  const ctx = useRef({ room, members });
  ctx.current = { room, members };
  const st = useRef({
    g: null as G, nohost: false, screen: "", step: 0, deadline: null as number | null, left: 0, timeUp: false, total: 0,
    lifeline: null as Pub["lifeline"], toast: null as Pub["toast"], toastN: 0, bank: null as Bank | null,
    typed: [null, null] as Two<string[] | null>,       // what each captain sent for the question on screen
    guesses: [null, null] as Two<number | null>,       // Closest To Wins
    ok: [null, null] as Two<boolean | null>,           // Flag / Map / Say verdicts, as they stand
    app: [null, null] as Two<boolean | null>,          // ...and what the app said first (the "App suggests" tag)
    sdBuzz: null as 0 | 1 | null, sdOut: [false, false] as Two<boolean>,
    pending: null as null | { kind: PKind; team: 0 | 1; text: string; v: boolean; until: number },
    autoAt: null as number | null,                     // no host: when an unruled map answer stands as right
    paused: false,                                     // the clock stopped by a Pause (the question hides meanwhile)
    bids: { leg: -1, by: [null, null] as Two<number | null> },   // the Auction: each captain's latest bid this leg
    waitSince: 0,                                      // no host: when this screen started waiting for a Start or Next
    flags: [] as NonNullable<Pub["flags"]>, flagN: 0,  // phones that left the game screen during a question
    tvAway: 0, awayPaused: false,                      // when the TV's screen went to sleep (0: it's on), and whether that paused the clock
    imad: null as Pub["imad"] | null, imadN: 0, imadQ: [] as string[],   // Imad's latest line, and the ones waiting to go up together
    custom: [] as Q[],                                 // questions of their own, sent by the phone that started
    buzzAt: 0, late: null as 0 | 1 | null,             // Cocktail or Dish: when the buzz came (10 s to type), and who ran out
    lastAns: null as null | { answer: string; got: boolean | null },   // the Battle: the last question's answer, shown once it's settled
    exit: false,                                       // the night is over and Exit was tapped: every screen goes home
  });
  const [pub, setPub] = useState<Pub | null>(null);
  const isTvRef = useRef(isTv);
  isTvRef.current = isTv;
  const saveKey = "qmb.tv." + code + ".game", usedKey = USED_KEY;
  /* who answers first: fixed for the whole game when it starts (Settings → alternate) */
  const seat = () => ({ alternateFirst: !!st.current.g?.alternateFirst });

  /* questions already played on this TV (kept in memory too, for a browser that won't store anything) */
  const usedMem = useRef(new Set<string>());
  const used = useCallback((): Set<string> => {
    try { return new Set([...JSON.parse(localStorage.getItem(usedKey) || "[]"), ...usedMem.current]); } catch { return new Set(usedMem.current); }
  }, []);
  const env = useCallback(() => {
    const bank = st.current.bank!;
    const deal = QMB.createDealer({ bank: () => bank.bank, used, noRepeat: () => getSettings().noRepeat,
      ok: { map: (q: G) => q.type === "map", flag: (q: G) => q.type === "flag", dish: (q: G) => q.type === "dish" } });
    return { deal, settings: seat() };
  }, [used]);

  /* the question in play right now, whatever the game */
  const current = useCallback((): G => {
    const s = st.current, g = s.g;
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
  }, []);
  /* right if it matches the answer or any other answer that counts (see acceptFor) */
  const match = (texts: string[] | null, q: G) => (texts && q ? texts.some((t) => QMB.isMatch(t, q.answer, acceptFor(q))) : null);
  /* the captain who moves the night on with no host: Team A's, or B's if A has none */
  const leadTeam = (): 0 | 1 => (ctx.current.members.some((m) => m.team === 0 && m.role === "captain") ? 0 : 1);
  const turnTeam = (): 0 | 1 => {
    const s = st.current, g = s.g, rd = g.rounds[g.r];
    if (s.screen === "auctionBid" || s.screen === "auctionRun") return g.auction.turn;
    if (s.screen === "battleQ") return g.battle.cap;
    if (!rd) return 0;
    const owner = QMB.seatTeam(g, rd, g.seat, seat());
    return s.screen === "steal" ? other(owner) : owner;
  };

  /* Closest: nearer wins; level, or nobody wrote anything, is a point each */
  const closestWinner = (): W => {
    const s = st.current, q = s.g.mini.qs[s.g.mini.i], [a, b] = s.guesses;
    if (a == null && b == null) return "tie";
    if (a == null) return 1;
    if (b == null) return 0;
    const ans = Number(q.answer), da = Math.abs(a - ans), db = Math.abs(b - ans);
    return da === db ? "tie" : da < db ? 0 : 1;
  };
  /* Say Same: ok = dodged the word. One team dodging alone takes it; otherwise a point each */
  const sayW = (): W => { const [a, b] = st.current.ok; return a && !b ? 0 : b && !a ? 1 : "tie"; };
  const okW = (): W => { const [a, b] = st.current.ok; return a && b ? "tie" : a ? 0 : b ? 1 : "none"; };

  /* ---- what the phones see ---- */
  const view = useCallback((): [Pub, Secret] | null => {
    const s = st.current, g = s.g;
    if (!g) return null;
    const rd = g.rounds[g.r];
    const owner = rd ? QMB.seatTeam(g, rd, g.seat, seat()) : 0;
    const q = current();
    const p: Pub = {
      screen: s.screen, step: s.step, r: g.r, N: g.rounds.length, theme: rd?.theme, mode: s.nohost ? "nohost" : "host",
      teams: g.teams.map((t: G) => ({ name: t.name, score: t.score, ll: { ...t.ll } })),
      deadline: s.deadline, left: s.left, timeUp: s.timeUp, lifeline: s.lifeline, toast: s.toast, winner: g.winner ?? null,
      sent: [!!s.typed[0] || s.guesses[0] != null, !!s.typed[1] || s.guesses[1] != null],
      pending: s.pending ? { team: s.pending.team, text: s.pending.text, v: s.pending.v, until: s.pending.until } : null,
      autoAt: s.autoAt, paused: s.paused, lead: leadTeam(), imad: s.imad || undefined, flags: s.flags.slice(-30), tvAway: !!s.tvAway,
    };
    /* the tracker: every round and mini-game of the night, in order (Classic's schedule/pipState) */
    const live = miniOf(s.screen);
    const sched: { kind: "std" | "mini"; i?: number; key?: string }[] = [];
    g.rounds.forEach((_: G, i: number) => { sched.push({ kind: "std", i }); (g.plan || []).forEach((pl: G) => { if (pl.after === i) sched.push({ kind: "mini", key: pl.key }); }); });
    if (!g.rounds.length) (g.plan || []).forEach((pl: G) => sched.push({ kind: "mini", key: pl.key }));
    if (g.hasBattle) sched.push({ kind: "mini", key: "battle" });
    p.pips = sched.map((x) => ({ kind: x.kind, state: x.kind === "mini"
      ? (live === x.key ? "now" : g.done[x.key!] ? "done" : "todo")
      : (x.i === g.r && !live && s.screen !== "final" && s.screen !== "sudden" ? "now" : g.rounds[x.i!]?.done ? "done" : "todo") }));
    const mem = ctx.current.members;
    p.captains = [0, 1].map((t) => mem.find((m) => m.team === t && m.role === "captain")?.name || null) as [string | null, string | null];
    { const t = getSettings();
      p.tMini = t.tMini;
      p.timers = { question: t.tQuestion, steal: t.tSteal, friend: t.tFriend, contest: t.tContest, sudden: t.tSudden, mini: t.tMini, flag: t.tFlag, map: t.tMap, say: t.tSay,
        auction: t.tAuction, dishStep: t.tDishStep, dishType: t.tDishType, battleHost: t.tBattleHost, battleTyped: t.tBattleTyped }; }
    /* no host: whose Start or Next the room is waiting for */
    if (s.nohost && !s.pending && WAITS_FOR_NEXT.has(s.screen) && !(s.screen === "sudden" && g.sdReady)
      && !(s.screen === "mapReveal" && (s.ok[0] == null || s.ok[1] == null))) {
      p.nextBy = p.captains[leadTeam()] || "The captain";
      p.nextOpenAt = s.waitSince + T_NEXT_FALLBACK * 1000; p.nextOther = p.captains[other(leadTeam())];
    }
    const secret: Secret = { step: s.step, typed: s.typed, match: [match(s.typed[0], q), match(s.typed[1], q)], guesses: s.guesses };
    if (q) { p.qid = q.id; secret.qid = q.id; secret.answer = q.answer; secret.notes = q.notes; secret.accept = acceptFor(q).slice(0, 8); }
    if (rd) {
      p.first = QMB.seatTeam(g, rd, 0, seat());
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
      secret.qid = p.qid = g.sd.q.id; secret.answer = g.sd.q.answer; secret.notes = g.sd.q.notes;
    }
    /* the mini-games */
    const key = miniOf(s.screen);
    if (key === "auction" && g.auction) {
      const a = g.auction;
      p.mini = { key, title: MINI_TITLES[key], leg: Math.min(a.leg + 1, a.n), of: a.n, wins: [...a.wins] as Two<number>, pts: g.miniPts };
      const last = a.legs[a.legs.length - 1];
      p.auction = { cat: a.q?.question || "", notes: a.q?.notes, bid: a.bid, by: a.by, turn: a.turn, count: a.count, leg: a.leg, n: a.n, wins: [...a.wins] as Two<number>,
        bids: (() => { const b = (s.bids.leg === a.leg ? [...s.bids.by] : [null, null]) as Two<number | null>; if (a.by != null && a.bid > 0) b[a.by as 0 | 1] = a.bid; return b; })(),
        last: s.screen === "auctionLeg" && last ? { bid: last.bid, by: last.by, count: last.count, made: last.made, won: last.won } : undefined,
        winner: a.done ? a.winner : null, award: a.award };
      p.turn = a.turn;
      secret.answer = a.q?.notes || ""; secret.notes = "";
    } else if (key === "battle" && g.battle) {
      const b = g.battle;
      p.mini = { key, title: MINI_TITLES[key], leg: Math.min(b.i + 1, b.n), of: b.n, wins: [...b.score] as Two<number>, pts: g.miniPts };
      p.battle = { cap: b.cap, i: b.i, n: b.n, score: [...b.score] as Two<number>, last: s.lastAns,
        tb: b.tb?.n, winner: b.done ? b.winner : null, note: b.note, award: b.award };
      if (s.screen === "battleQ" || s.screen === "battleTie") { p.question = q?.question; p.turn = s.screen === "battleQ" ? b.cap : undefined; }
      if (s.screen === "battleTie") { p.buzz = s.sdBuzz; p.out = [...s.sdOut] as Two<boolean>; }
    } else if (key) {
      const m = miniState(g, key);
      p.mini = { key, title: MINI_TITLES[key], leg: Math.min(m.i + 1, m.qs.length), of: m.base, wins: [...m.wins] as Two<number>, pts: g.miniPts, tie: m.i >= m.base };
      if (key === "dish") p.mini.kinds = m.levels.some((l: string) => l[0] === "c") && m.levels.some((l: string) => l[0] === "d") ? "Cocktails + dishes" : m.levels[0][0] === "c" ? "Cocktails" : "Dishes";
      if (/Summary$/.test(s.screen) && m.verdict) p.summary = { wins: [...m.wins] as Two<number>, winner: m.verdict.winner, needsHost: m.verdict.needsHost, note: m.verdict.note || "", award: m.award };
    }
    /* a reveal's leg counts in the tracker straight away (and moves with the ruling until Next) */
    const prov: W | null = s.screen === "closestReveal" ? closestWinner() : s.screen === "flagReveal" || s.screen === "mapReveal" ? okW() : s.screen === "sayReveal" ? sayW() : null;
    if (prov != null && p.mini) { if (prov === "tie") { p.mini.wins[0]++; p.mini.wins[1]++; } else if (prov === 0 || prov === 1) p.mini.wins[prov]++; }
    if (s.screen === "miniQ" || s.screen === "sayQ") p.question = q?.question;
    if (s.screen === "sayReveal" && q) { p.question = q.question; p.reveal = { answer: q.answer, typed: s.typed, ok: s.ok, app: s.app, w: sayW() }; }
    if (s.screen === "closestReveal" && q) {
      p.question = q.question;
      p.reveal = { answer: q.answer, guesses: s.guesses, w: closestWinner() };
    }
    if ((s.screen === "flagQ" || s.screen === "flagReveal") && q) p.flag = q.flag;
    if (s.screen === "flagReveal" && q) p.reveal = { answer: q.answer, typed: s.typed, ok: s.ok, app: s.app, w: okW() };
    if ((s.screen === "mapQ" || s.screen === "mapReveal") && q) {
      const reveal = s.screen === "mapReveal";
      p.map = { id: q.id, reveal, hint: (g.mapGame.hints || {})[q.id] ? "on" : undefined, title: reveal ? q.question : undefined, notes: reveal ? q.notes : undefined };
      if (reveal) { p.map.ruled = s.ok; p.reveal = { answer: q.question, typed: s.typed, ok: s.ok, app: s.app, w: okW() }; }
      secret.answer = q.question; secret.notes = q.answer;
    }
    if ((s.screen === "dishQ" || s.screen === "dishReveal" || s.screen === "dishCheck") && q) {
      const L = g.dishGame.leg, shown = s.screen === "dishQ" ? L.shown : q.ings.length;
      p.dish = { kind: dishKind(q), ings: q.ings.slice(0, shown), n: q.ings.length, late: s.late };
      p.buzz = L.buzz; p.out = [...L.out] as Two<boolean>;
      if (s.screen === "dishReveal") { const sub = g.dishGame.subs[g.dishGame.subs.length - 1]; p.reveal = { answer: q.answer, typed: s.typed, w: sub?.winner ?? "none" }; }
    }
    if (s.exit) p.exit = true;
    return [p, secret];
  }, [current]);

  /* One write at a time, each built from the latest state when its turn
     comes. Two overlapping writes could otherwise land out of order and leave
     the phones a step behind the TV — and a host tap from a stale step is
     refused, which would freeze the game. */
  const chain = useRef<{ p: Promise<void>; queued: boolean }>({ p: Promise.resolve(), queued: false });
  const lastSecret = useRef(""), lastSave = useRef(""), offline = useRef(false);
  /* a line across the TV when something's wrong that the room should know about */
  const [banner, setBanner] = useState<null | "offline" | "cantSave" | "oldSave">(null);
  /* the lobby: why a Start didn't start (a captain left a second ago) */
  const [lobbyNote, setLobbyNote] = useState<string | null>(null);
  useEffect(() => { if (!lobbyNote) return; const t = setTimeout(() => setLobbyNote(null), 6000); return () => clearTimeout(t); }, [lobbyNote]);
  const publish = useCallback(() => {
    /* this TV shows the change at once; the phones get it with the next write */
    const now = view(); if (now) { now[0].at = Date.now(); setPub(now[0]); }
    const c = chain.current;
    if (c.queued) return c.p;              // a write that hasn't started yet will pick up this change too
    c.queued = true;
    c.p = c.p.then(async () => {
      c.queued = false;
      const v = view(); if (!v) return;
      v[0].at = Date.now();
      setPub(v[0]);
      const s = st.current;
      /* the game, kept on this laptop so a refresh picks it up (only written when it changed);
         stamped with the app's version, so an update mid-night can't load a game it doesn't understand */
      try {
        if (s.exit) { localStorage.removeItem(saveKey); lastSave.current = ""; }
        else {
          const save = JSON.stringify({ build: BUILD_ID, g: s.g, nohost: s.nohost, step: s.step, screen: s.screen, deadline: s.deadline, left: s.left, timeUp: s.timeUp,
            total: s.total, lifeline: s.lifeline, typed: s.typed, guesses: s.guesses, ok: s.ok, sdBuzz: s.sdBuzz, sdOut: s.sdOut, pending: s.pending, autoAt: s.autoAt, paused: s.paused, custom: s.custom, waitSince: s.waitSince, flags: s.flags, flagN: s.flagN, tvAway: s.tvAway, awayPaused: s.awayPaused, bids: s.bids,
            app: s.app, buzzAt: s.buzzAt, late: s.late, lastAns: s.lastAns });
          if (save !== lastSave.current) { localStorage.setItem(saveKey, save); lastSave.current = save; }
        }
      } catch { setBanner("cantSave"); }
      const room = ctx.current.room;
      /* the answer and the screen go out together (the host's phone shows "Getting the answer…" until
         an answer for this very step lands), and the answer only when it changed: a +1, a pause,
         a ruling leave it as it was — one write, not two */
      const sec = JSON.stringify(v[1]);
      const writes = [sb().from("rooms").update({ state: { ...(room?.state || {}), pub: v[0] } }).eq("code", code)];
      if (sec !== lastSecret.current) writes.push(sb().from("secrets").update({ data: v[1] }).eq("room", code));
      const res = await Promise.all(writes);
      const bad = res.find((r) => r.error);
      if (bad) throw bad.error;
      lastSecret.current = sec;
      if (offline.current) { offline.current = false; setBanner((b) => (b === "offline" ? null : b)); }
    }).catch((e) => {
      /* The phones didn't get it (Wi-Fi dropped, the server hiccupped): say so on the TV and keep
         trying, so a reveal or a final screen with nothing after it still reaches everyone. */
      console.error("publish failed", e);
      offline.current = true; setBanner((b) => b ?? "offline");
      setTimeout(() => void publishRef.current(), 2000);
    });
    return c.p;
  }, [code, saveKey, view]);
  const publishRef = useRef(publish);
  publishRef.current = publish;

  /* ---- Imad: one line per moment, never the same twice in a night (until a
     moment's lines run out), real names and numbers filled in. Lines from the
     same instant ("Correct!" then "LEAD CHANGE!") go up as one. (Classic's Host) ---- */
  const say = (moments: string[] | string, extra?: G) => {
    const s = st.current, g = s.g;
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
  };
  /* once per game, keyed: a screen shown again stays quiet */
  const once = (key: string, moments: string[] | string, extra?: G) => {
    const g = st.current.g; g.hostOnce = g.hostOnce || {};
    if (g.hostOnce[key]) return false;
    g.hostOnce[key] = true; say(moments, extra); return true;
  };
  /* after every move: the screen's own moment, a change of leader, then up it goes */
  const narrate = () => {
    const s = st.current, g = s.g;
    if (!g) return;
    const sc = s.screen, rd = g.rounds[g.r];
    const opener = () => (g.hostHello ? [] : ((g.hostHello = true), ["start"]));
    if (sc === "roundIntro" && rd && !g.hostOnce?.["r" + g.r]) once("r" + g.r, [...opener(), "round"], { t: QMB.seatTeam(g, rd, 0, seat()), theme: rd.theme, n: g.r + 1, N: g.rounds.length });
    const intro = ({ miniIntro: "closest", auctionIntro: "auction", sayIntro: "saysame", mapIntro: "map", flagIntro: "flag", dishIntro: "dish", battleIntro: "battle" } as Record<string, string>)[sc];
    if (intro && !g.hostOnce?.["mi:" + intro]) once("mi:" + intro, [...opener(), "mini_" + intro]);
    if (/Summary$|^auctionResult$/.test(sc)) {
      const m = sc === "auctionResult" ? g.auction : sc === "battleSummary" ? g.battle : miniState(g, miniOf(sc));
      if (m?.award) { const w = m.award[0] > m.award[1] ? 0 : m.award[1] > m.award[0] ? 1 : null; if (w != null) once("mw:" + sc, "miniwin", { t: w, pts: Math.max(m.award[0], m.award[1]) }); }
    }
    if (sc === "roundScore") { const d = Math.abs(g.teams[0].score - g.teams[1].score); if (d >= 5) once("rs" + g.r, "big"); else if (d === 1) once("rs" + g.r, "close"); else if (d === 0) once("rs" + g.r, "level"); }
    if (sc === "sudden") once("sd" + (g.sdRounds || 1), "sudden");
    if (sc === "final") once("final", g.winner == null ? "finaltie" : "final");
    const d = g.teams[0].score - g.teams[1].score, lead = d > 0 ? 0 : d < 0 ? 1 : null;
    if (lead != null) { if (g.hostLeader != null && g.hostLeader !== lead) say("lead"); g.hostLeader = lead; }
    if (s.imadQ.length) { s.imad = { id: ++s.imadN, text: s.imadQ.join(" ") }; s.imadQ = []; }
  };

  /* ---- carrying out what the engine says ---- */
  const applyFx = useCallback((fx: G[]) => {
    const s = st.current, now = Date.now();
    for (const f of fx || []) {
      if (f.timer === "stop") { s.deadline = null; s.left = 0; }
      else if (f.timer === "pause" && s.deadline) { s.left = Math.max(0, (s.deadline - now) / 1000); s.deadline = null; }
      else if (f.timer === "resume" && s.left) { s.deadline = now + s.left * 1000; s.left = 0; }
      if (f.used) { usedMem.current.add(f.used.id); try { const u = used(); localStorage.setItem(usedKey, JSON.stringify([...u])); } catch { /* kept in memory */ } }
      if (f.lifeline) {
        const rd = s.g.rounds[s.g.r];
        s.lifeline = { key: f.lifeline, team: QMB.seatTeam(s.g, rd, s.g.seat, seat()), deadline: f.lifeline === "friend" ? now + T().tFriend * 1000 : null };
      }
      if (f.toast) s.toast = { id: ++s.toastN, text: f.toast };
      if (f.host) say(f.host, f.vars);
      if (f.sound && isTvRef.current) playSound(f.sound as SoundName);
      if (f.go && isTvRef.current) {
        if (f.go === "roundIntro" || /Intro$/.test(f.go) || (f.go === "sudden" && !s.g.sdReady)) { playSound("whoosh"); playSound("jingle"); }
        else if (f.go === "answer" || f.go === "dishReveal" || f.go === "auctionLeg") playSound("drumroll");
      }
      if (f.go) {
        s.screen = f.go; s.timeUp = false; s.left = 0; s.lifeline = null; s.deadline = null; s.pending = null; s.autoAt = null; s.paused = false; s.waitSince = now;
        /* a fresh question: nothing typed yet (a steal keeps the first team's answer to show at the reveal) */
        if (["ask", "roundIntro", "miniQ", "flagQ", "dishQ", "mapQ", "sudden", "sayQ", "battleQ", "battleTie"].includes(f.go)) { s.typed = [null, null]; s.guesses = [null, null]; s.ok = [null, null]; s.app = [null, null]; s.buzzAt = 0; s.late = null; }
        if (f.go === "sudden" || f.go === "battleTie") { s.sdBuzz = null; s.sdOut = [false, false]; }
        const g = s.g;
        const secs = f.go === "ask" ? T().tQuestion : f.go === "steal" ? T().tSteal : f.go === "miniQ" ? T().tMini : f.go === "flagQ" ? T().tFlag
          : f.go === "mapQ" ? T().tMap : f.go === "auctionRun" ? T().tAuction
          : f.go === "dishQ" ? dishTotal(g.dishGame.qs[g.dishGame.i])
          : f.go === "sayQ" ? T().tSay : f.go === "battleQ" ? (s.nohost ? T().tBattleTyped : T().tBattleHost)
          : ((f.go === "sudden" && g.sdReady) || f.go === "battleTie") && s.nohost ? T().tSudden : 0;
        if (secs) { s.deadline = now + secs * 1000; s.total = secs; }
        if (f.go === "flagQ") applyFx([{ used: g.flagGame.qs[g.flagGame.i] }]);
        if (f.go === "dishQ") applyFx([{ used: g.dishGame.qs[g.dishGame.i] }]);
        if (f.go === "miniQ") applyFx([{ used: g.mini.qs[g.mini.i] }]);
        if (f.go === "mapQ") applyFx([{ used: g.mapGame.qs[g.mapGame.i] }]);
        if (f.go === "sayQ") applyFx([{ used: g.saySame.qs[g.saySame.i] }]);
      }
      if (f.finalize) { s.screen = "final"; s.deadline = null; s.autoAt = null; s.pending = null; if (isTvRef.current) playSound("win"); }
    }
  }, [used]);

  const play = useCallback((move: G) => {
    const s = st.current;
    if (!s.g || !s.bank) return;
    /* the Battle: the answer goes up once the question is settled ("Answer: X") */
    const b = s.g.battle;
    if (b && move.type === "battle/mark") { const q = b.qs[b.cap]?.[b.i]; if (q) s.lastAns = { answer: q.answer, got: !!move.got }; }
    else if (b && move.type === "battle/tbWin" && b.tb?.q) s.lastAns = { answer: b.tb.q.answer, got: move.w !== "none" };
    else if (move.type === "battle/start" && s.screen === "battleIntro") s.lastAns = null;
    const was = s.screen;
    applyFx(QMB.play(s.g, move, env()));
    /* level at the end: stop and ask before a tie-breaker (see TIES); the Battle too, unless the host just asked for another */
    const g = s.g, tie = Object.entries(TIES).find(([, x]) => x.q === s.screen);
    const level = (screen: string) => {      // the screen itself says "Level at N each"
      s.screen = screen; s.deadline = null; s.left = 0; s.total = 0; s.timeUp = false; s.paused = false; s.waitSince = Date.now(); s.toast = null;
    };
    if (tie && /^(closest\/win|say\/verdict|flag\/verdict)$/.test(move.type)) { const m = miniState(g, tie[1].key); if (m && m.i >= m.base) level(tie[0]); }
    if (s.screen === "battleTie" && (was === "battleQ" || (move.type === "battle/tbWin" && !move.byHost))) level("battleLevel");
    narrate();
    /* no host: the table's calls that a host would make, made at once */
    if (!s.nohost) return;
    if (/Summary$/.test(s.screen)) {
      const k = miniOf(s.screen), m = miniState(g, k);
      if (k && m?.verdict?.needsHost) play({ type: PREFIX[k] + "/award", w: "split" });
    }
  }, [applyFx, env]);

  /* the clock ran out, or every captain is in: show what they said */
  const reveal = useCallback(() => {
    const s = st.current, g = s.g;
    if (s.screen === "miniQ") s.screen = "closestReveal";
    else if (s.screen === "flagQ") {
      const q = g.flagGame.qs[g.flagGame.i];
      s.ok = [0, 1].map((t) => !!match(s.typed[t], q)) as Two<boolean>;
      s.app = [...s.ok] as Two<boolean>;
      s.screen = "flagReveal";
    } else if (s.screen === "sayQ") {
      /* dodged = wrote something, and it isn't the app's word; nothing written can't win */
      const q = g.saySame.qs[g.saySame.i];
      s.ok = [0, 1].map((t) => !!s.typed[t] && !match(s.typed[t], q)) as Two<boolean>;
      s.app = [...s.ok] as Two<boolean>;
      s.screen = "sayReveal";
    } else if (s.screen === "mapQ") {
      /* the app doesn't judge a map: the host rules (with no host, each captain on the other's
         answer); nothing written is simply wrong */
      s.ok = [s.typed[0] ? null : false, s.typed[1] ? null : false];
      s.app = [null, null];
      s.screen = "mapReveal";
    } else return;
    s.deadline = null; s.left = 0; s.paused = false;
    playSound("drumroll");
    /* no host: each captain rules on the other's map answer; one left unruled stands as right after a while */
    s.autoAt = s.nohost && s.screen === "mapReveal" && (s.ok[0] == null || s.ok[1] == null) ? Date.now() + T_MAP_RULE * 1000 : null;
  }, []);

  /* no host: the app's verdict on what a captain sent; the other captain may overrule */
  const settle = useCallback((flip: boolean) => {
    const s = st.current, P = s.pending;
    if (!P) return;
    s.pending = null;
    const v = flip ? !P.v : P.v;
    if (flip) s.toast = { id: ++s.toastN, text: `${iso(s.g.teams[other(P.team)].name)} changed the call: ${v ? "RIGHT" : "WRONG"}.` };
    if (P.kind === "ask") play({ type: "round/judge", v });
    else if (P.kind === "steal") play({ type: "round/judgeSteal", v });
    else if (P.kind === "dish") { play({ type: v ? "dish/right" : "dish/wrong" }); if (!v) s.typed[P.team] = null; }
    else if (P.kind === "battle") play({ type: "battle/mark", got: v });
    else if (P.kind === "sudden" || P.kind === "battleTie") {
      const tb = P.kind === "battleTie";
      if (v) play(tb ? { type: "battle/tbWin", w: P.team } : { type: "sudden/win", w: P.team });
      else {
        s.sdOut[P.team] = true; s.typed[P.team] = null; s.sdBuzz = null;
        if (s.sdOut[0] && s.sdOut[1]) play(tb ? { type: "battle/tbWin", w: "none" } : { type: "sudden/win", w: "none" });
        else { s.toast = { id: ++s.toastN, text: "Wrong. The other captain can buzz." }; s.deadline = Date.now() + T().tSudden * 1000; }
      }
    }
  }, [play]);

  /* the night is over and somebody tapped Exit: every screen goes home, and
     this TV forgets the game (a reload must not bring it back) */
  const exitGame = () => {
    const s = st.current;
    s.exit = true; s.deadline = null; s.pending = null; s.autoAt = null;
    void sb().from("rooms").update({ status: "done" }).eq("code", code);
  };

  /* the moves a host makes — from the host's phone, or a captain's with no host */
  const hostMove = useCallback((move: G) => {
    const s = st.current, g = s.g;
    const t = move.type as string;
    if (t === "ui/closeLifeline") { s.lifeline = null; s.paused = false; applyFx([{ timer: "resume" }]); }
    else if (t === "ui/timeUp") { s.deadline = null; s.left = 0; s.timeUp = true; }
    else if (t === "ui/pause") { if (s.lifeline || (!s.deadline && !s.paused)) return; applyFx([{ timer: s.deadline ? "pause" : "resume" }]); s.paused = !s.deadline && s.left > 0; }
    else if (t === "ui/reveal") reveal();
    /* a ruling: v sets it (RIGHT/WRONG, DODGED IT/SAID IT); without v it flips */
    else if (t === "ui/flagOk" || t === "ui/mapOk" || t === "ui/sayOk") { const i = move.t === 1 ? 1 : 0; s.ok[i] = typeof move.v === "boolean" ? move.v : !s.ok[i]; }
    else if (t === "ui/exit") exitGame();
    else if (t === "ui/pauseFriend") {
      const L = s.lifeline;
      if (!L || L.key !== "friend") return;
      if (L.deadline) s.lifeline = { ...L, deadline: null, left: Math.max(0, (L.deadline - Date.now()) / 1000) };
      else if (L.left) s.lifeline = { ...L, deadline: Date.now() + L.left * 1000, left: undefined };
    }
    else if (t === "tie/more" || t === "tie/stop") {
      const more = t === "tie/more", sc = s.screen;
      if (sc === "dishTie") play({ type: more ? "dish/more" : "dish/stop" });
      else if (sc === "mapTie") play({ type: more ? "map/more" : "map/stop" });
      else if (sc === "battleLevel") {
        if (more) applyFx([{ go: "battleTie" }]);
        else {
          /* called there: half the Battle's points each */
          const b = g.battle, half = Math.floor(g.miniPts / 2);
          b.stage = "done"; b.done = true; b.winner = null; b.awarded = true; b.award = [half, half];
          g.teams[0].score += half; g.teams[1].score += half;
          b.note = `Tie: called there, ${half} point${half === 1 ? "" : "s"} each.`;
          applyFx([{ sound: "point" }, { go: "battleSummary" }]);
        }
      } else if (TIES[sc]) {
        const T = TIES[sc];
        if (more) applyFx([{ go: T.q }]);              // the tie-breaker the engine already lined up
        else {
          const m = miniState(g, T.key);
          m.qs.pop(); m.tieLegs = Math.max(0, (m.tieLegs || 1) - 1);
          m.done = true; m.verdict = { winner: null, needsHost: false, note: "" };
          play({ type: T.award, w: "split" });
          applyFx([{ go: T.summary }]);
        }
      }
      narrate();
    }
    else if (t === "ui/next") {
      if (s.screen === "closestReveal") play({ type: "closest/win", w: closestWinner(), gA: s.guesses[0], gB: s.guesses[1] });
      else if (s.screen === "flagReveal") play({ type: "flag/verdict", w: okW() });
      else if (s.screen === "mapReveal") play({ type: "map/verdict", w: okW() });
      else if (s.screen === "sayReveal") play({ type: "say/verdict", w: sayW() });
    }
    else if (t === "ui/sdRight" && s.sdBuzz != null) play(s.screen === "battleTie" ? { type: "battle/tbWin", w: s.sdBuzz } : { type: "sudden/win", w: s.sdBuzz });
    else if (t === "ui/sdWrong" && s.sdBuzz != null) {
      s.sdOut[s.sdBuzz] = true; s.typed[s.sdBuzz] = null; s.sdBuzz = null;
      if (s.sdOut[0] && s.sdOut[1]) play(s.screen === "battleTie" ? { type: "battle/tbWin", w: "none" } : { type: "sudden/win", w: "none" });
      else s.toast = { id: ++s.toastN, text: "Wrong. The other captain can have a go." };
    }
    else if (t === "dish/wrong") { const b = g.dishGame.leg.buzz; play(move); if (b != null) s.typed[b] = null; s.buzzAt = 0; }
    else if (t === "battle/tbWin") play({ ...move, byHost: true });
    else play(move);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyFx, play, reveal]);

  /* ---- a captain's own moves: answers, buzzes, lifelines (no step bump:
     a captain typing doesn't change what the host is deciding) ---- */
  /* Returns true when taken, false to drop it quietly (a stale or doubled tap), or a short
     reason the TV puts up as a toast, so a refused tap is never a mystery. */
  const captainInput = useCallback((kind: string, team: 0 | 1, p: G): boolean | string => {
    const s = st.current, g = s.g, sc = s.screen;
    const nm = (t: 0 | 1) => iso(g.teams[t].name);
    if (s.tvAway) return false;                        // the TV is asleep: it catches up when it wakes
    if (s.paused) return "The game is paused.";        // nothing goes in while the clock is stopped
    const rd = g.rounds[g.r];
    if (kind === "lifeline") {
      if (p.key === "dbl" && sc === "roundIntro") { play({ type: "round/armDbl", i: team }); return true; }
      /* lifelines before the answer goes in, not after */
      if ((p.key === "friend" || p.key === "dip") && sc === "ask" && !s.lifeline && !s.pending && turnTeam() === team && !s.typed[team]) {
        const usedLl = rd.llUsed[team] || [];
        if (!g.teams[team].ll[p.key] || (rd.dbl[team] && usedLl.length >= 1)) return false;
        play({ type: "round/lifeline", key: p.key, i: team });
        /* Double Dip needs no pause card here: the captain's phone simply shows a second box */
        if (p.key === "dip") { s.lifeline = null; applyFx([{ timer: "resume" }]); }
        return true;
      }
      return false;
    }
    if (kind === "buzz") {
      if (sc === "dishQ") {
        const L = g.dishGame.leg;
        if (L.out[team]) return `${nm(team)} is out of this one.`;
        if (L.buzz != null) return L.buzz === team ? false : `${nm(L.buzz)} buzzed first.`;
        play({ type: "dish/buzz", w: team }); s.buzzAt = Date.now(); return true;
      }
      if ((sc === "sudden" && g.sdReady) || sc === "battleTie") {
        if (s.sdOut[team]) return `${nm(team)} is out of this one.`;
        if (s.sdBuzz != null) return s.sdBuzz === team ? false : `${nm(s.sdBuzz)} buzzed first.`;
        s.sdBuzz = team; s.deadline = null; playSound("soft"); return true;
      }
      return false;
    }
    if (kind !== "answer") return false;
    const texts = (Array.isArray(p.texts) ? p.texts : [p.text]).map((x: unknown) => String(x ?? "").trim().slice(0, 80)).filter(Boolean);
    /* no host: the first answer sent is the one checked — and the other captain gets a few seconds to overrule */
    const check = (kindP: PKind, q: G) => {
      if (!s.nohost) return;
      const v = !!match(s.typed[team], q);
      applyFx([{ timer: "pause" }]);
      s.pending = { kind: kindP, team, text: (s.typed[team] || []).join(" / "), v, until: Date.now() + contestSecs(kindP === "battle") * 1000 };
    };
    if (sc === "ask" || sc === "steal") {
      /* one answer: once it's sent it's locked, host or no host */
      if (!texts.length) return false;
      if (team !== turnTeam()) return `It's ${nm(turnTeam())}'s turn to answer.`;
      if (s.typed[team]) return `${nm(team)}'s answer is already in.`;
      if (s.pending) return "Wait for the call on the last answer.";
      if (s.lifeline) return "Wait for the lifeline to finish.";
      const dip = sc === "ask" && (rd.llUsed[team] || []).includes("dip");
      s.typed[team] = texts.slice(0, dip ? 2 : 1);
      check(sc, current());
      return true;
    }
    if (sc === "miniQ") {
      const n = Number(String(p.n ?? "").replace(/[\s,]/g, ""));
      if (s.guesses[team] != null) return `${nm(team)}'s guess is already in.`;
      if (!Number.isFinite(n)) return "That isn't a number.";
      s.guesses[team] = n;
      if (s.guesses[0] != null && s.guesses[1] != null) reveal();
      return true;
    }
    if (sc === "battleQ") {
      if (!texts.length) return false;
      if (team !== g.battle.cap) return `It's ${nm(g.battle.cap)}'s turn in the Battle.`;
      if (s.pending) return "Wait for the call on the last answer.";
      s.typed[team] = texts.slice(0, 1);
      check("battle", current());
      return true;
    }
    if (sc === "flagQ" || sc === "mapQ" || sc === "sayQ") {
      if (!texts.length) return false;
      if (s.typed[team]) return `${nm(team)}'s answer is already in.`;
      s.typed[team] = texts.slice(0, 1);
      if (s.typed[0] && s.typed[1]) reveal();
      return true;
    }
    if (sc === "dishQ" && g.dishGame.leg.buzz === team && texts.length && !s.pending) { s.typed[team] = texts.slice(0, 1); check("dish", current()); return true; }
    if ((sc === "sudden" || sc === "battleTie") && s.sdBuzz === team && texts.length && !s.pending) { s.typed[team] = texts.slice(0, 1); check(sc === "sudden" ? "sudden" : "battleTie", current()); return true; }
    return false;
  }, [applyFx, current, play, reveal]);

  /* a captain's tap on a host-style button: who may, where, and when */
  const captainMove = useCallback((team: 0 | 1, move: G): boolean | string => {
    const s = st.current, g = s.g, sc = s.screen;
    const rule = CAPTAIN_MOVES[move.type];
    if (!rule || (rule.nohostOnly && !s.nohost) || !inScreen(rule.where, sc)) return false;
    const t = move.type as string;
    /* the lead captain moves the night on; if they haven't after a while, the other captain may */
    if (rule.who === "lead" && leadTeam() !== team && Date.now() - s.waitSince < T_NEXT_FALLBACK * 1000) {
      const lead = g.teams[leadTeam()];
      return `${iso(lead.captain || lead.name)} moves the game on. You can in ${Math.max(1, Math.ceil(T_NEXT_FALLBACK - (Date.now() - s.waitSince) / 1000))} s.`;
    }
    if (t === "ui/closeLifeline") { if (!s.lifeline || s.lifeline.team !== team) return false; }
    else if (t === "ui/rule") { if (!s.pending || s.pending.team === team || typeof move.v !== "boolean") return false; }
    else if (t === "sudden/go") { if (g.sdReady) return false; }
    else if (t === "ui/flagOk" || t === "ui/sayOk") { if (move.t !== other(team)) return false; }
    else if (t === "ui/mapRule") { /* each captain rules on the other team's map answer, and can change it until Next */ }
    else if (t === "ui/pauseFriend") { if (!s.lifeline || s.lifeline.key !== "friend" || leadTeam() !== team) return false; }
    else if (t === "ui/exit") { /* either captain, with no host */ }
    else if (t === "ui/next" && sc === "mapReveal") { if (s.ok[0] == null || s.ok[1] == null) return "Rule on both map answers first."; }
    else if (rule.who === "turn" && turnTeam() !== team) return false;
    else if (rule.who === "other" && turnTeam() === team) return false;

    if (t === "ui/rule") settle(move.v !== s.pending!.v);
    else if (t === "ui/mapRule") {
      s.ok[other(team)] = !!move.v;
      if (s.ok[0] != null && s.ok[1] != null) { s.autoAt = null; s.waitSince = Date.now(); }
    }
    else if (t === "auction/raise") {
      const n = Math.floor(Number(move.n));
      if (!(n > g.auction.bid)) return `Bid more than ${g.auction.bid}.`;
      if (n > 999) return "Bids go up to 999.";
      if (s.bids.leg !== g.auction.leg) s.bids = { leg: g.auction.leg, by: [null, null] };
      s.bids.by[team] = n;
      play({ type: t, n });
    }
    else hostMove(move);
    return true;
  }, [hostMove, play, settle]);

  /* a tap the TV won't take: say why on the TV (and the update ends the phone's "Sending…") */
  const refuse = useCallback((why: string) => { const s = st.current; s.toast = { id: ++s.toastN, text: why }; void publish(); }, [publish]);

  /* ---- the inbox ---- */
  const handle = useCallback(async (a: Action) => {
    const { room } = ctx.current, s = st.current;
    let { members } = ctx.current;
    if (!room) return;
    let from = members.find((m) => m.user_id === a.user_id);
    /* the line-up here can be a beat behind the phones (a captain who claimed a second ago, a
       player who just joined): before refusing or ignoring a tap for that, read it fresh */
    if ((!from && a.kind !== "count") || (a.kind === "setup" && !readyToStart(members))) {
      const { data } = await sb().from("members").select("*").eq("room", code);
      if (data) { members = data as Member[]; ctx.current.members = members; from = members.find((m) => m.user_id === a.user_id); }
    }
    /* anything a phone sends (its 15-second "I'm here" included) proves it's here */
    /* Fresh by the server's clock, not this laptop's: a TV clock running fast must not decide that
       everyone is away. The gap between "now here" and "sent there" is the clock skew plus the delay;
       the smallest gap seen lately is the skew, so an action is fresh when it's within 30 s of that. */
    { const H = here.current, sent = serverMs(a.at);
      if (sent) { const lag = Date.now() - sent; H.lags = [...H.lags.slice(-29), lag]; if (lag - Math.min(...H.lags) < 30000) H.at[a.user_id] = Date.now(); } }
    if (a.kind === "count") { if (isTvRef.current) onNote(a.user_id, a.payload as Parameters<typeof onNote>[1]); return; }
    if (a.kind === "team_name" && from?.role === "captain" && from.team === a.payload.team && room.status === "lobby") {
      const names = [...(room.state.teamNames || ["Team A", "Team B"])] as [string, string];
      names[from.team as 0 | 1] = cap1(String(a.payload.name || "").trim().slice(0, 18)) || names[from.team as 0 | 1];
      await sb().from("rooms").update({ state: { ...room.state, teamNames: names } }).eq("code", code);
      return;
    }
    if (a.kind === "setup" && a.payload.start && room.status === "lobby" && starter(members)?.user_id === a.user_id && !readyToStart(members)) {
      setLobbyNote(notReadyWhy(members) || "Not ready yet.");
      return;
    }
    if (a.kind === "setup" && a.payload.start && room.status === "lobby" && starter(members)?.user_id === a.user_id && readyToStart(members)) {
      const cfgIn = (a.payload.cfg || {}) as G;
      /* the house bank, this TV's own questions, and the starter's (cleaned: never trust a phone) */
      const base = await loadBank();
      s.custom = cleanList(cfgIn.custom, base.themes);
      s.bank = withCustom(members.some((m) => m.role === "host") ? base : withoutHostOnly(base), s.custom);
      const names = room.state.teamNames || ["Team A", "Team B"];
      const team = (t: 0 | 1) => ({ name: cap1(names[t]), captain: cap1(members.find((m) => m.team === t && m.role === "captain")?.name || ""),
        players: members.filter((m) => m.team === t).map((m) => m.name).join(", ") });
      const diff = DIFFS.includes(cfgIn.difficulty) ? cfgIn.difficulty : "mixed";
      const minis = (Array.isArray(cfgIn.minis) ? cfgIn.minis : []).filter((k: string) => PARTY_MINIS.includes(k));
      /* standard rounds can be off (a mini-games-only night), as in Classic */
      const standard = cfgIn.standard !== false;
      if (!standard && !minis.length) return;
      const rounds = Math.max(4, Math.min(12, Math.floor(Number(cfgIn.rounds) || 8)));
      /* the host's hand-picked questions and per-theme difficulty (only a host can send them: the picker shows answers) */
      const byHost = members.find((m) => m.user_id === a.user_id)?.role === "host";
      const ids = (x: unknown) => (Array.isArray(x) ? x.filter((v) => typeof v === "string").slice(0, 20) : []) as string[];
      const pickIn = (byHost && cfgIn.picks && typeof cfgIn.picks === "object" ? cfgIn.picks : {}) as Record<string, unknown>;
      const picks = Object.fromEntries(Object.entries(pickIn).map(([t, v]) => [t, ids(v).slice(0, 2)]).filter(([, v]) => v.length === 2));
      const themeDiff = byHost && cfgIn.themeDiff && typeof cfgIn.themeDiff === "object"
        ? Object.fromEntries(Object.entries(cfgIn.themeDiff as Record<string, string>).filter(([, d]) => ["easy", "medium", "hard", "mixed"].includes(d))) : {};
      const hand = (k: string) => (byHost ? ids(cfgIn[k]) : []);
      const cfg = { rounds, themes: cfgIn.themes || [], difficulty: diff, standard,
        /* maps, flags and dishes each have their own levels, set with the mini-games (as in Classic) */
        minis, mapLevels: levels(cfgIn.mapLevels, QMB.MAP_ORDER, QMB.MAP_ORDER), flagLevels: levels(cfgIn.flagLevels, QMB.FLAG_LEVEL_KEYS, ["easy", "medium"]),
        dishLevels: levels(cfgIn.dishLevels, QMB.DISH_LEVEL_KEYS, ["c-medium", "d-medium"]), teamA: team(0), teamB: team(1), picks, themeDiff,
        pickClosest: hand("pickClosest"), pickAuction: hand("pickAuction"), pickSaySame: hand("pickSaySame"), pickMap: hand("pickMap"), pickFlag: hand("pickFlag"), pickDish: hand("pickDish") };
      const g = env().deal.buildGame(cfg);
      /* Party plays Don't Say the Same best of 7 (the coin-flip prompt stays last) and
         Cocktail or Dish best of 5. The engine deals Classic's lengths; the legs left
         over are dropped (Say) or kept back for swaps and tie-breakers (Dish). The
         host's own picks are the last to go. */
      const trim = (m: G, n: number | undefined, mine: string[], keepLast: boolean) => {
        if (!m || !n || m.qs.length <= n) return [];
        const own = new Set(mine), last = keepLast ? m.qs.pop() : null, cut: G[] = [];
        while (m.qs.length > n - (last ? 1 : 0)) { const i = m.qs.map((q: G) => own.has(q.id)).lastIndexOf(false); cut.unshift(m.qs.splice(i >= 0 ? i : m.qs.length - 1, 1)[0]); }
        if (last) m.qs.push(last);
        m.base = m.qs.length;
        return cut;
      };
      trim(g.saySame, PARTY_LEGS.saysame, cfg.pickSaySame, true);
      if (g.dishGame) g.dishGame.spare = [...trim(g.dishGame, PARTY_LEGS.dish, cfg.pickDish, false), ...(g.dishGame.spare || [])];
      /* The engine always plays "hosted" here: with no host the TV is the host
         (it checks the answers), so steals and buzzers work as with one. */
      g.hostless = false;
      g.alternateFirst = getSettings().alternateFirst;
      s.nohost = !members.some((m) => m.role === "host");
      s.g = g; s.screen = ""; s.lifeline = null; s.pending = null; s.autoAt = null; s.step = 1;
      g.rounds.forEach((r: G) => r.q.forEach((q: G) => applyFx([{ used: q }])));
      play({ type: "game/start" });
      await sb().from("rooms").update({ status: "playing", mode: s.nohost ? "nohost" : "host" }).eq("code", code);
      await publish();
      return;
    }
    if (!s.g || !from) return;
    if (a.kind === "judge" && from.role === "host") {
      const move = (a.payload.move || {}) as G;
      const where = HOST_MOVES[move.type];
      if (!where || !inScreen(where, s.screen)) return;
      /* a tap made on an earlier screen (a double tap, a slow phone) is ignored */
      if (!SAME_SCREEN.has(move.type)) { if (a.payload.step !== s.step) return; s.step++; }
      hostMove(move);
      void publish();
      return;
    }
    if (from.role !== "captain" || (from.team !== 0 && from.team !== 1)) return;
    if (a.kind === "next") {
      const move = (a.payload.move || {}) as G, free = SAME_SCREEN.has(move.type);
      if (!free && a.payload.step !== s.step) return;
      const ok = captainMove(from.team, move);
      if (ok === true) { if (!free) s.step++; void publish(); }
      else if (ok) refuse(ok);
      return;
    }
    if (["answer", "buzz", "lifeline"].includes(a.kind)) {
      const ok = captainInput(a.kind, from.team, a.payload as G);
      if (ok === true) void publish();
      else if (ok) refuse(ok);
    }
  }, [applyFx, captainInput, captainMove, code, env, hostMove, play, publish, refuse]);

  /* fetch the questions while everyone's still joining, not when Start is tapped */
  useEffect(() => { if (isTv) void loadBank().catch(() => { /* tried again at Start */ }); }, [isTv]);

  /* restore a game in progress after a refresh of the TV */
  useEffect(() => {
    if (!isTv) return;
    try {
      const saved = JSON.parse(localStorage.getItem(saveKey) || "null");
      if (saved?.g) {
        const before = { ...st.current };
        delete saved.build;
        Object.assign(st.current, saved);
        /* A reload (or a sleep) hides the page first, which pauses everyone; the
           new page must take that pause back, or the game stays frozen. */
        const s = st.current;
        if (s.tvAway) {
          const d = Date.now() - s.tvAway;
          if (s.pending) s.pending = { ...s.pending, until: s.pending.until + d };
          if (s.lifeline?.deadline) s.lifeline = { ...s.lifeline, deadline: s.lifeline.deadline + d };
          if (s.autoAt) s.autoAt += d;
          if (s.waitSince) s.waitSince += d;
          if (s.buzzAt) s.buzzAt += d;
          if (s.awayPaused && s.left) { s.deadline = Date.now() + s.left * 1000; s.left = 0; s.paused = false; }
          s.tvAway = 0; s.awayPaused = false;
        }
        /* the bank, then the view, to this TV and to every phone (they may still show "paused") */
        void loadBank().then(async (b) => {
          st.current.bank = withCustom(b, st.current.custom || []);
          /* a game saved by an older version of the app that this one can't read: say so, don't crash */
          try { setPub(view()?.[0] || null); }
          catch (e) { console.error("saved game unreadable", e); Object.assign(st.current, before); try { localStorage.removeItem(saveKey); } catch { /* */ } setBanner("oldSave"); return; }
          /* publish once the room is loaded: its state carries the team names too */
          for (let i = 0; i < 40 && !ctx.current.room; i++) await new Promise((r) => setTimeout(r, 250));
          if (ctx.current.room) void publish();
        });
      }
    } catch { /* nothing saved */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTv, saveKey]);

  /* the inbox: everything since the last action handled on this TV, in the
     order the server received it — that order decides who buzzed first */
  useEffect(() => {
    if (!isTv) return;
    const key = "qmb.tv." + code + ".last";
    let last = 0, busy = false, again = false;
    try { last = Number(localStorage.getItem(key) || 0); } catch { /* no storage: start from the top */ }
    /* Two taps sent at once (a fast +1, two buzzes) can be numbered in one order and land in the
       other, so reading only "after the last id" would skip the slower one for good. So each read
       also looks back 10 seconds (by the server's clock) for late arrivals, and remembers what it
       has handled, so nothing is lost and nothing is done twice. */
    const before = last, seen = new Set<number>();
    let newest = 0;                                   // the server time of the newest action handled (ms)
    /* the server's timestamps, in either spelling ("…T12:00:00.123456+00:00" or "… 12:00:00.123456+00"), as ms */
    const ms = serverMs;
    /* an action that lands while the last batch is still being read is picked up straight after, not at the next poll */
    const fresh: Action[] = [];                        // straight from the realtime message: handled before the read
    const take = async (a: Action) => {
      if (a.id <= before || seen.has(a.id) || a.kind === "suggest") return;
      seen.add(a.id);
      try { await handle(a); } catch (e) { console.error("action refused", a, e); }
      if (a.id > last) { last = a.id; try { localStorage.setItem(key, String(last)); } catch { /* in memory only */ } }
      const t = ms(a.at); if (t > newest) newest = t;
    };
    const drain = async () => {
      if (busy) { again = true; return; }
      busy = true;
      try {
        do {
          again = false;
          while (fresh.length) await take(fresh.shift()!);
          let q = sb().from("actions").select("*").eq("room", code).neq("kind", "suggest");
          q = newest ? q.or(`id.gt.${last},at.gt.${new Date(newest - 10000).toISOString()}`) : q.gt("id", last);
          const { data } = await q.order("id");
          for (const a of (data || []) as Action[]) await take(a);
          if (seen.size > 2000) { const keep = [...seen].slice(-500); seen.clear(); keep.forEach((x) => seen.add(x)); }
        } while (again);
      } finally { busy = false; }
    };
    void drain();
    const ch = sb().channel("actions:" + code)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "actions", filter: "room=eq." + code },
        (m: { new?: Partial<Action> }) => { if (m.new?.id && m.new.kind) fresh.push(m.new as Action); void drain(); })
      .subscribe();
    /* every tap arrives with the push and is handled at once; this read is the safety net */
    const poll = setInterval(() => void drain(), 3000);
    return () => { clearInterval(poll); void sb().removeChannel(ch); };
  }, [code, isTv, handle]);

  /* Who's here: every phone says so every 15 s, through the action log (see usePresence). A
     captain gone for T_AWAY hands over to the first teammate still here, so a
     phone left in a pocket never stalls the night. Nobody is removed. */
  const here = useRef({ at: {} as Record<string, number>, since: Date.now(), busy: false, checked: 0, lags: [] as number[],
    away: {} as Record<string, { at: number; qid?: string; flag?: number }> });
  /* Left the game screen during a question: flagged once they've been gone two
     seconds (a glance at a notification doesn't count), with how long when
     they come back. The TV says it; the host's phone keeps the list. */
  const flag = (k: string, qid: string | undefined, ms: number | null, kind: "away" | "paste" = "away") => {
    const s = st.current, g = s.g, m = ctx.current.members.find((x) => x.user_id === k);
    if (!g || !m || m.role === "host" || !getSettings().flagAway) return undefined;
    const mk = miniOf(s.screen), rd = g.rounds[g.r];
    const label = s.screen === "sudden" ? "Sudden death" : mk ? MINI_TITLES[mk] : rd ? `Round ${g.r + 1} · ${rd.theme}` : "A question";
    const f = { id: ++s.flagN, name: m.name, team: m.team, label, qid, ms, kind };
    s.flags = [...s.flags, f].slice(-60);
    playSound("wrong");                              // the red flag, bottom left, says who
    return f.id;
  };
  /* a phone's note: "I left the screen", "I'm back" (and for how long, by
     its own clock), or "hello" from a fresh page (a reload: back too) */
  const onNote = (k: string, n: { away?: { qid?: string }; back?: { qid?: string; ms: number }; hello?: number; paste?: { qid?: string } }) => {
    const H = here.current, s = st.current, now = Date.now();
    let changed = false;
    const setMs = (id: number, ms: number) => { s.flags = s.flags.map((f) => (f.id === id ? { ...f, ms } : f)); changed = true; };
    if (n.away && !H.away[k]) H.away[k] = { at: now, qid: n.away.qid };
    /* a paste into an answer box: flagged once per question */
    if (n.paste && !s.flags.some((f) => f.kind === "paste" && f.qid === n.paste!.qid && f.name === ctx.current.members.find((m) => m.user_id === k)?.name) && flag(k, n.paste.qid, null, "paste")) changed = true;
    if (n.hello && H.away[k]) { const a = H.away[k]; delete H.away[k]; if (a.flag && a.flag > 0) setMs(a.flag, now - a.at); }
    if (n.back) {
      const a = H.away[k]; delete H.away[k];
      const ms = Math.max(0, Number(n.back.ms) || 0);
      /* the phone's own clock decides: a glance under two seconds flagged while its "back" was on the way is taken back */
      if (a?.flag && a.flag > 0 && ms < 2000) { s.flags = s.flags.filter((f) => f.id !== a.flag); changed = true; }
      else if (a?.flag && a.flag > 0) setMs(a.flag, ms);
      else if (!a?.flag && ms >= 2000 && flag(k, n.back.qid, ms)) changed = true;
    }
    if (changed) void publish();
  };
  /* is the night waiting on this team's captain right now? (their question, their buzz, their ruling, their Next) */
  const waitsOn = (t: 0 | 1) => {
    const s = st.current, g = s.g, sc = s.screen;
    if (!g) return false;
    if (s.pending) return s.pending.team !== t;                                   // the other captain rules
    if (sc === "ask" || sc === "steal") return turnTeam() === t;
    if (["miniQ", "flagQ", "mapQ", "sayQ", "dishQ", "sudden", "battleTie"].includes(sc)) return true;
    if (sc === "battleQ") return g.battle?.cap === t;
    if (sc === "auctionBid") return g.auction?.turn === t;
    if (sc === "auctionRun") return s.nohost && g.auction?.by != null && g.auction.by !== t;   // the counter
    if (s.nohost && WAITS_FOR_NEXT.has(sc)) return leadTeam() === t;
    if (s.nohost && sc === "mapReveal") return s.ok[other(t)] == null;
    return false;
  };
  const handOver = useCallback(async () => {
    const H = here.current, s = st.current, { room, members } = ctx.current, now = Date.now();
    if (H.busy || !s.g || room?.status !== "playing") return;
    const fresh = (k: string) => now - (H.at[k] ?? 0) < 40000;
    /* The host's phone gone a minute (or the host left): the app checks the
       answers, as in a game with no host, until the host is back. */
    const hostM = members.find((m) => m.role === "host");
    const hostHere = !!hostM && now - (H.at[hostM.user_id] ?? H.since) < T_AWAY * 1000;
    if (s.nohost === hostHere && !s.pending) {
      s.nohost = !hostHere;
      s.toast = { id: ++s.toastN, text: s.nohost ? "The host is away, so the app checks the answers for now." : "The host is back." };
      if (s.nohost) {
        /* an answer already typed for the host to judge: the app checks it now */
        const sc = s.screen, g = s.g, q = current();
        const who: 0 | 1 | null = sc === "ask" || sc === "steal" || sc === "battleQ" ? turnTeam() : sc === "dishQ" ? g.dishGame.leg.buzz : sc === "sudden" || sc === "battleTie" ? s.sdBuzz : null;
        const kind = ({ ask: "ask", steal: "steal", battleQ: "battle", dishQ: "dish", sudden: "sudden", battleTie: "battleTie" } as Record<string, PKind>)[sc];
        if (kind && who != null && s.typed[who] && q) {
          applyFx([{ timer: "pause" }]);
          s.pending = { kind, team: who, text: (s.typed[who] || []).join(" / "), v: !!match(s.typed[who], q), until: now + contestSecs(kind === "battle") * 1000 };
        } else if (s.timeUp && (sc === "ask" || sc === "steal")) {
          /* the clock had run out, waiting for the host: with no host that's a wrong answer */
          s.timeUp = false; s.step++;
          play({ type: sc === "ask" ? "round/judge" : "round/judgeSteal", v: false });
        }
      }
      void publish();
    }
    for (const t of [0, 1] as const) {
      const cap = members.find((m) => m.team === t && m.role === "captain");
      if (!cap || now - (H.at[cap.user_id] ?? H.since) < T_AWAY * 1000) continue;
      /* only when the game is waiting on this captain: a phone asleep in a pocket between rounds keeps its armband */
      if (!waitsOn(t)) continue;
      const next = members.find((m) => m.team === t && m.role === "player" && fresh(m.user_id));   // first to join, still here
      if (!next) continue;
      H.busy = true;
      try {
        const a = await sb().from("members").update({ role: "player" }).eq("room", code).eq("user_id", cap.user_id);
        if (a.error) continue;
        const b = await sb().from("members").update({ role: "captain" }).eq("room", code).eq("user_id", next.user_id);
        if (b.error) { await sb().from("members").update({ role: "captain" }).eq("room", code).eq("user_id", cap.user_id); continue; }
        H.at[next.user_id] = now;
        s.g.teams[t].captain = next.name;
        s.toast = { id: ++s.toastN, text: `${iso(cap.name)} seems to be away. ${iso(next.name)} is ${iso(s.g.teams[t].name)}'s captain now.` };
        void publish();
      } finally { H.busy = false; }
      return;
    }
  }, [code, publish, current, play, applyFx]);
  /* the line-up changed (a new captain, a move): the phones' view changes with it */
  const lineup = ctx.current.members.map((m) => `${m.user_id}:${m.team}:${m.role}:${m.name}`).join("|");
  const lastLineup = useRef(lineup);
  useEffect(() => {
    if (!isTv || !st.current.g || lastLineup.current === lineup) return;
    lastLineup.current = lineup; void publish();
  }, [isTv, lineup, publish]);

  /* The TV's screen goes to sleep or out of sight (the laptop dozes, someone
     switches tab): everyone pauses, the question hides, and nothing times out.
     When it's back, every clock picks up exactly where it was. */
  useEffect(() => {
    if (!isTv) return;
    const vis = () => {
      const s = st.current, now = Date.now();
      if (!s.g) return;
      if (document.visibilityState === "hidden" && !s.tvAway) {
        s.tvAway = now;
        s.awayPaused = !!s.deadline && !s.paused && !s.lifeline;
        if (s.awayPaused) { applyFx([{ timer: "pause" }]); s.paused = true; }
        void publish();
      } else if (document.visibilityState === "visible" && s.tvAway) {
        const d = now - s.tvAway;
        s.tvAway = 0;
        if (s.pending) s.pending = { ...s.pending, until: s.pending.until + d };
        if (s.lifeline?.deadline) s.lifeline = { ...s.lifeline, deadline: s.lifeline.deadline + d };
        if (s.autoAt) s.autoAt += d;
        if (s.waitSince) s.waitSince += d;
        if (s.buzzAt) s.buzzAt += d;
        if (s.awayPaused) { s.paused = false; s.awayPaused = false; applyFx([{ timer: "resume" }]); }
        void publish();
      }
    };
    document.addEventListener("visibilitychange", vis);
    return () => document.removeEventListener("visibilitychange", vis);
  }, [isTv, applyFx, publish]);

  const lastWhole = useRef<number | null>(null);
  /* The clocks. A standard question running out is only "time's up" when
     there's a host to judge; with no host it's a wrong answer. Closest, Flag
     and Map reveal; a dish leg ends; the Auction settles. The dish ingredients
     come up one every few seconds while its clock runs. With no host, an
     overrule window closes, and results screens move on by themselves. */
  useEffect(() => {
    if (!isTv) return;
    const t = setInterval(() => {
      const s = st.current, now = Date.now(), g = s.g;
      if (!g || s.tvAway) return;                     // the TV is asleep: nothing moves
      let changed = false;
      /* the last ten seconds tick; the bells ring at zero */
      const whole = s.deadline ? Math.ceil((s.deadline - now) / 1000) : null;
      if (whole !== lastWhole.current) { if (whole != null && whole <= 10 && whole > 0) playSound("tick"); lastWhole.current = whole; }
      if (s.deadline && now >= s.deadline) playSound("alarm");
      if (s.screen === "dishQ" && s.deadline) {
        const q = g.dishGame.qs[g.dishGame.i], L = g.dishGame.leg;
        const want = Math.min(q.ings.length, 1 + Math.floor((s.total - (s.deadline - now) / 1000) / T().tDishStep + 1e-6));
        if (want > L.shown) { L.shown = want; changed = true; }
      }
      if (s.pending && now >= s.pending.until) { s.step++; settle(false); changed = true; }
      /* Cocktail or Dish: a buzz gets 10 seconds to type it (no clock on screen); then it's wrong */
      if (s.screen === "dishQ" && s.buzzAt && !s.pending) {
        const b = g.dishGame.leg.buzz;
        if (b == null || s.typed[b]) s.buzzAt = 0;
        else if (now - s.buzzAt >= T().tDishType * 1000) {
          s.buzzAt = 0; s.step++; changed = true;
          hostMove({ type: "dish/wrong" });
          s.late = b;
          s.toast = { id: ++s.toastN, text: `Time's up. ${iso(g.teams[b].name)} is out of this one.` };
        }
      }
      if (s.deadline && now >= s.deadline) {
        s.deadline = null; s.step++; changed = true;
        if (s.screen === "ask" || s.screen === "steal") { say("timeup", { t: turnTeam() }); if (!s.nohost) narrate(); }
        if (["miniQ", "flagQ", "mapQ", "sayQ"].includes(s.screen)) reveal();
        else if (s.screen === "battleQ" && s.nohost) { s.toast = { id: ++s.toastN, text: "Time's up." }; play({ type: "battle/mark", got: false }); }
        else if (s.screen === "battleTie" && s.nohost) play({ type: "battle/tbWin", w: "none" });
        else if (s.screen === "dishQ") play({ type: "dish/timeUp" });
        else if (s.screen === "auctionRun") play({ type: "auction/resolve" });
        else if (s.screen === "sudden" && s.nohost) play({ type: "sudden/win", w: "none" });
        else if (s.nohost && (s.screen === "ask" || s.screen === "steal")) {
          s.toast = { id: ++s.toastN, text: "Time's up." };
          play({ type: s.screen === "ask" ? "round/judge" : "round/judgeSteal", v: false });
        }
        else s.timeUp = true;
      }
      if (s.lifeline?.deadline && now >= s.lifeline.deadline) {
        if (s.nohost) { s.lifeline = null; applyFx([{ timer: "resume" }]); s.step++; }
        else s.lifeline = { ...s.lifeline, deadline: null };
        changed = true;
      }
      /* no host: a map answer the other captain never ruled on stands as right; then the lead captain taps Next */
      if (s.nohost && s.autoAt && now >= s.autoAt) {
        s.autoAt = null; changed = true;
        if (s.screen === "mapReveal") { s.ok = [s.ok[0] ?? true, s.ok[1] ?? true]; s.waitSince = now; }
      }
      if (now - here.current.checked > 2000) { here.current.checked = now; void handOver(); }
      /* away for two seconds during a question: flag it now (how long comes when they're back) */
      for (const [k, a] of Object.entries(here.current.away)) {
        if (!a.flag && now - a.at >= 3000) { a.flag = flag(k, a.qid, null) ?? -1; if (a.flag > 0) changed = true; }
      }
      if (changed) void publish();
    }, 250);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTv, publish, play, reveal, settle, hostMove, applyFx, handOver]);

  /* Exit on the TV itself (it has a mouse): the same as the host's Exit */
  const exit = useCallback(() => { if (st.current.screen !== "final") return; exitGame(); void publish(); }, [publish]);  // eslint-disable-line react-hooks/exhaustive-deps
  return { pub, game: st.current.g as G, exit, banner, lobbyNote };
}
