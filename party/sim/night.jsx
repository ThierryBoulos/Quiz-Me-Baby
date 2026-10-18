/* The simulator: the real TV (lib/tvGame.ts) in Node, with a fake Supabase and a
   virtual clock, and two bot captains (and, for a hosted night, a bot host)
   sending what phones send. A whole night takes seconds. Each night leaves a
   trace (every screen the phones were shown, with the score); with the same
   seed the trace must not change unless the game is meant to.
   Run it with: npm run sim (node sim/run.mjs) */
import { advance, clock, flush, resetClock, rng, seedRandom, setVisible } from "./env.js";
import { act, useEffect, useState } from "react";
import TestRenderer from "react-test-renderer";
import * as fake from "./fakeSupabase.js";
import { useTvGame } from "../lib/tvGame";
import fullBank from "../data/bank.json";
import accept from "../data/accept.json";
import liteBank from "../public/bank.json";

globalThis.fetch = async (url) => {
  const body = String(url).includes("/api/bank") ? { bank: fullBank, accept } : liteBank;
  return { ok: true, status: 200, json: async () => structuredClone(body) };
};

const CODE = "SIMS";
/* as many themes as rounds, as Setup sends (a fixed set, so the deal is the same each run) */
const THEMES = ["Movies", "Music", "Geography", "History", "Science", "Sports", "Lebanon", "Food & Drink", "Tech", "Nature", "Friends", "Pop Culture"];
const api = { current: null };
function Tv() {
  const [snap, setSnap] = useState(() => read());
  useEffect(() => fake.onChange((t) => { if (t === "rooms" || t === "members") setSnap(read()); }), []);
  api.current = useTvGame(CODE, true, snap.room, snap.members);
  return null;
}
function read() {
  return { room: structuredClone(fake.db.rooms.find((r) => r.code === CODE) || null), members: structuredClone(fake.db.members.filter((m) => m.room === CODE)) };
}

/* the next tap the night moves on with, screen by screen (as scratch tests did on the live site) */
const NEXT = { roundIntro: "round/begin", miniIntro: "closest/start", flagIntro: "flag/start", dishIntro: "dish/start", mapIntro: "map/start", auctionIntro: "auction/begin",
  sayIntro: "say/start", battleIntro: "battle/start", battleHandoff: "battle/start", sayReveal: "ui/next", mapReveal: "ui/next", saySummary: "say/done", battleSummary: "battle/done",
  answer: "round/afterAnswer", roundScore: "round/next", closestReveal: "ui/next", flagReveal: "ui/next", dishReveal: "dish/next", auctionLeg: "auction/nextLeg",
  auctionResult: "auction/done", miniSummary: "closest/done", flagSummary: "flag/done", dishSummary: "dish/done", mapSummary: "map/done" };

/* the answer to what's on screen, from the TV's own game (bots peek, so some answers are right) */
function answerNow(g, pub) {
  try {
    const sc = pub.screen;
    if (sc === "ask" || sc === "steal") return g.rounds[g.r].q[g.seat]?.answer;
    if (sc === "flagQ") return g.flagGame.qs[g.flagGame.i]?.answer;
    if (sc === "mapQ") return g.mapGame.qs[g.mapGame.i]?.answer;
    if (sc === "miniQ") return String(g.mini.qs[g.mini.i]?.answer ?? "");
    if (sc === "dishQ") return g.dishGame.qs[g.dishGame.i]?.answer;
    if (sc === "battleQ") return g.battle.qs[g.battle.cap]?.[g.battle.i]?.answer;
    if (sc === "sudden") return g.sd?.q?.answer;
    if (sc === "battleTie") return g.battle.tb?.q?.answer;
  } catch { /* the bot just guesses */ }
  return null;
}

export async function night({ seed, minis, rounds = 6, host = false, again = false, slow = 0, reload = 0, sleep = 0, chaos = 0 }) {
  fake.reset(); resetClock(); localStorage.clear(); seedRandom(seed);
  const bot = rng(seed * 7919 + 1);
  const t0 = clock(), trace = [], seen = {};
  const caps = ["capA", "capB"];
  fake.db.rooms.push({ code: CODE, status: "lobby", mode: null, state: { teamNames: ["Lions", "Owls"] } });
  fake.db.secrets.push({ room: CODE, data: null });
  fake.db.members.push({ room: CODE, user_id: "capA", name: "Rami", team: 0, role: "captain", face: null },
    { room: CODE, user_id: "capB", name: "Lea", team: 1, role: "captain", face: null },
    { room: CODE, user_id: "p1", name: "Sam", team: 0, role: "player", face: null });
  if (host) fake.db.members.push({ room: CODE, user_id: "host", name: "Nour", team: null, role: "host", face: null });
  fake.setPresence(fake.db.members.map((m) => m.user_id));
  let last = "";
  fake.onChange((t) => {
    if (t !== "rooms") return;
    const room = fake.db.rooms[0], p = room.state?.pub;
    const line = p ? [p.screen, p.step, p.teams?.map((x) => x.score).join("-"), p.mini?.wins?.join("-") || "", p.toast?.text || "", p.pending ? "pending" : ""].join(" | ") : `room ${room.status}`;
    if (line === last) return;
    last = line; trace.push(`${((clock() - t0) / 1000).toFixed(2)} ${line}`);
    if (p) seen[p.screen] = (seen[p.screen] || 0) + 1;
  });

  let tree;
  await act(async () => { tree = TestRenderer.create(<Tv />); await flush(); });
  /* chaos: every tap carries a tag, as phones' do, and each must come back in the TV's receipts (pub.ack) */
  const taps = [], tapN = { n: 0 };
  const send = (who, kind, payload) => {
    if (chaos) { const tap = "t" + (++tapN.n); const p0 = fake.db.rooms[0].state?.pub; taps.push({ tap, who, kind, payload, screen: p0?.screen, q: `${p0?.qid}|${p0?.screen}`, at: clock() }); payload = { ...payload, tap }; }
    return fake.insert("actions", { room: CODE, user_id: who, kind, payload });
  };
  const checkAcks = () => {
    const p0 = fake.db.rooms[0].state?.pub; if (!p0?.ack) return;
    for (const t of taps) if (!t.done) { const a = p0.ack[t.who]; if (a && a.tap === t.tap) { t.done = clock(); t.no = a.no; t.sent = !!p0.sent?.[t.who === "capA" ? 0 : 1]; t.pend = p0.pending?.team === (t.who === "capA" ? 0 : 1); t.buzz = p0.buzz; t.after = p0.screen; t.moved = `${p0.qid}|${p0.screen}` !== t.q;
      /* a phone only waits on its latest tap: older ones from it are settled too */
      for (const o of taps) if (!o.done && o.who === t.who && Number(o.tap.slice(1)) < Number(t.tap.slice(1))) { o.done = clock(); o.superseded = true; } } }
  };
  const tick = (ms) => act(async () => { await advance(ms); });
  await tick(1000);
  send(host ? "host" : "capA", "setup", { start: true, cfg: { standard: true, rounds, difficulty: "mixed", themes: THEMES.slice(0, rounds), minis } });

  let reloaded = false;
  const appealed = new Set(), armed = new Set(), asked = new Set();
  let asks = 0, lastAsk = -1;
  /* each new question counts once */
  const sc0 = (p) => (p.screen === "ask" && p.step !== lastAsk ? ((lastAsk = p.step), "ask") : "");
  let outcome = "timeout", recap = null, score = "", stuckOn = "", same = 0, prevKey = "", playedAgain = false;
  while (clock() - t0 < 90 * 60000) {
    await tick(900);
    /* the TV's page reloads (the game comes back from this laptop's storage) */
    if (reload && !reloaded && clock() - t0 > reload * 1000) {
      reloaded = true; trace.push("(the TV reloads)");
      await act(async () => { tree.unmount(); await flush(); });
      await act(async () => { tree = TestRenderer.create(<Tv />); await flush(); });
      await tick(2000);
    }
    const pub = fake.db.rooms[0].state?.pub, g = api.current?.game;
    if (chaos) checkAcks();
    if (!pub || !g) continue;
    /* chaos: now and then a captain taps something at the wrong moment */
    if (chaos && bot() < chaos) {
      const who = bot() < 0.5 ? "capA" : "capB", r = bot();
      const MOVES = ["round/begin", "round/afterAnswer", "round/next", "ui/next", "ui/rule", "ui/appeal", "decided/stop", "tie/stop", "auction/pass", "auction/raise", "ui/pause", "flag/done", "closest/done", "battle/start", "sudden/go"];
      /* only what a phone can send on this screen: a number on Closest, words elsewhere; BUZZ where there's a buzzer */
      if (r < 0.3) send(who, "answer", pub.screen === "miniQ" ? { n: "12" } : { texts: ["Paris"] });
      else if (r < 0.45) { if (["dishQ", "sudden", "battleTie"].includes(pub.screen)) send(who, "buzz", {}); }
      else if (r < 0.6) send(who, "lifeline", { key: ["dbl", "friend", "dip"][Math.floor(bot() * 3)] });
      else send(who, "next", { move: { type: MOVES[Math.floor(bot() * MOVES.length)], v: bot() < 0.5, n: 3 }, step: pub.step - (bot() < 0.3 ? 1 : 0) });
    }
    /* the TV's screen goes to sleep during the sleep-th question; the captain answers meanwhile and
       the other captain taps Resume (the phones show the game as paused); then the TV wakes (18 Oct) */
    if (sleep && !host && sc0(pub) === "ask" && ++asks === sleep && !pub.sent?.[pub.turn]) {
      const t = pub.turn, left = Math.round((pub.deadline - clock()) / 1000);
      await act(async () => { setVisible(false); await flush(); }); await tick(1500);
      trace.push(`(the TV sleeps, ${left} s left)`);
      send(caps[t], "answer", { texts: ["Dane"] }); await tick(1500);
      send(caps[1 - t], "next", { move: { type: "ui/pause", on: "resume" }, step: fake.db.rooms[0].state.pub.step });
      send(caps[1 - t], "next", { move: { type: "ui/pause" }, step: fake.db.rooms[0].state.pub.step });   // an older phone: no "on"
      await tick(60000);
      await act(async () => { setVisible(true); await flush(); }); await tick(1500);
      const p2 = fake.db.rooms[0].state.pub;
      trace.push(`(the TV wakes: ${p2.screen}, answer in: ${!!(p2.sent?.[t] || p2.pending || p2.screen !== "ask")}, clock ${p2.deadline ? Math.round((p2.deadline - clock()) / 1000) + " s" : "stopped"})`);
      continue;
    }
    /* slow captains: this beat, nobody taps (so the clocks run out now and then) */
    if (slow && bot() < slow) continue;
    const sc = pub.screen, step = pub.step, lead = pub.lead ?? 0, other = (t) => 1 - t;
    const key = JSON.stringify([sc, step, pub.pending, pub.sent, pub.buzz, pub.auction?.count, pub.auction?.bid, pub.map?.ruled, pub.ok]);
    if (key === prevKey) { if (++same > 120) { outcome = "stuck"; stuckOn = sc; break; } } else { same = 0; prevKey = key; }
    const C = (t) => caps[t];
    const next = (t, type, extra = {}) => send(host && !["auction/raise", "auction/pass"].includes(type) ? "host" : C(t), host ? "judge" : "next", { move: { type, ...extra }, step });
    const guess = (right) => (bot() < 0.45 && right ? right : bot() < 0.5 ? "xyz" : "Paris");
    if (sc === "final") {
      recap = pub.recap || null; score = pub.teams.map((x) => x.score).join("-");
      trace.push(`recap: ${JSON.stringify(recap)}`);
      if (again && !playedAgain) {
        playedAgain = true; await tick(8000); next(1, "ui/again"); await tick(4000);
        trace.push(`again: room ${fake.db.rooms[0].status}, pub ${fake.db.rooms[0].state.pub ? "kept" : "gone"}`);
      }
      outcome = "final"; break;
    }
    if (sc === "sudden" && (pub.sudden?.n || 0) > 6) { outcome = "sudden-cap"; break; }
    const right = answerNow(g, pub);
    if (pub.pending && !host) next(other(pub.pending.team), "ui/rule", { v: pub.pending.v || bot() < 0.25 });
    /* a lifeline card up (Call a Friend): the team closes it, or its clock does */
    else if (pub.lifeline) { if (bot() < 0.4) next(pub.turn ?? 0, "ui/closeLifeline"); }
    /* after the steal: the first team sometimes appeals, the other captain agrees or not */
    else if (sc === "answer" && !host && pub.appeal) next(other(pub.appeal.team), "ui/appealOk", { v: bot() < 0.5 });
    else if (sc === "answer" && !host && pub.appealable != null && !appealed.has(step) && bot() < 0.5) { appealed.add(step); next(pub.appealable, "ui/appeal"); }
    /* Double Points: armed now and then before a round */
    else if (sc === "roundIntro" && !armed.has(step) && bot() < 0.3) { armed.add(step); send(C(bot() < 0.5 ? 0 : 1), "lifeline", { key: "dbl" }); }
    else if (sc === "decided") next(lead, bot() < 0.5 ? "decided/more" : "decided/stop");
    else if (sc === "mapReveal" && !host && (pub.map?.ruled || [null, null]).some((x) => x == null)) { for (const t of [0, 1]) next(t, "ui/mapRule", { v: bot() < 0.6 }); }
    else if (NEXT[sc]) next(lead, NEXT[sc]);
    else if (/Tie$|Level$/.test(sc) && sc !== "battleTie") next(lead, "tie/stop");
    else if (sc === "ask" || sc === "steal") {
      if (!pub.sent?.[pub.turn] && sc === "ask" && !asked.has(step) && bot() < 0.15) { asked.add(step); send(C(pub.turn), "lifeline", { key: bot() < 0.5 ? "dip" : "friend" }); }
      else if (!pub.sent?.[pub.turn]) send(C(pub.turn), "answer", { texts: [guess(right), guess(right)] });
      else if (host) next(0, sc === "ask" ? "round/judge" : "round/judgeSteal", { v: bot() < 0.5 });
    }
    else if (sc === "miniQ") { for (const t of [0, 1]) if (!pub.sent?.[t]) send(C(t), "answer", { n: String(Math.round((Number(right) || 100) * (0.6 + bot() * 0.8))) }); }
    else if (["flagQ", "mapQ", "sayQ"].includes(sc)) {
      for (const t of [0, 1]) if (!pub.sent?.[t]) send(C(t), "answer", { text: guess(right) });
      if (host && pub.sent?.[0] && pub.sent?.[1]) next(0, "ui/reveal");
    }
    else if (sc === "dishQ") {
      if (pub.buzz == null) { const t = pub.out?.[0] ? 1 : 0; if (!pub.out?.[t]) send(C(t), "buzz", {}); }
      else if (!pub.sent?.[pub.buzz]) send(C(pub.buzz), "answer", { text: guess(right) });
      else if (host) next(0, bot() < 0.5 ? "dish/right" : "dish/wrong");
    }
    else if (sc === "auctionBid") { const a = pub.auction; if (a.bid === 0) send(C(a.turn), "next", { move: { type: "auction/raise", n: 2 + Math.floor(bot() * 4) }, step }); else send(C(a.turn), "next", { move: { type: "auction/pass" }, step }); }
    else if (sc === "auctionRun") { const a = pub.auction; if (a.count < a.bid) next(other(a.by), "auction/tick"); else if (host) next(0, "auction/resolve"); }
    else if (sc === "battleQ") { if (host) next(0, "battle/mark", { got: bot() < 0.5 }); else send(C(pub.battle.cap), "answer", { text: guess(right) }); }
    else if (sc === "sudden" || sc === "battleTie") {
      if (sc === "sudden" && !pub.sudden?.ready) next(lead, "sudden/go");
      else if (pub.buzz == null) { const t = pub.out?.[0] ? 1 : 0; send(C(t), "buzz", {}); }
      else if (host) next(0, bot() < 0.5 ? "ui/sdRight" : "ui/sdWrong");
      else send(C(pub.buzz), "answer", { text: guess(right) });
    }
  }
  await act(async () => { tree.unmount(); await flush(); });
  resetClock();
  checkAcks();
  return { taps, outcome, stuckOn, trace, recap, screens: Object.keys(seen), score: score || fake.db.rooms[0].state?.pub?.teams?.map((x) => x.score).join("-"), minutes: (clock() - t0) / 60000, writes: fake.db.writes, actions: fake.db.actions.length };
}
