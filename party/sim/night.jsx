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
  auctionResult: "auction/done", miniSummary: "closest/done", flagSummary: "flag/done", dishSummary: "dish/done", mapSummary: "map/done", battleReview: "battle/reviewDone" };

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

/* Weird nights (sim/weird.mjs): events at set times (seconds into the night):
     { at, type: "tvOff", for }       the TV's screen off for a while (phones carry on)
     { at, type: "reload" }           the TV's page reloads
     { at, type: "offReload", for }   the TV goes off, and comes back as a fresh page
     { at, type: "capGone", team }    that team's captain's phone is gone for good
     { at, type: "hostGone", for }    the host's phone is gone for a while
     { at, type: "writesFail", for }  the TV's writes fail (no internet) for a while
   net: { dup, delay, stall }  pushes sent twice / up to delay ms late (out of order) / that share of reads held 5-28 s
   simul: both captains tap Next, buzz, rule at the very same moment
   edge: answers land at the exact moment the clock runs out */
export async function night({ seed, minis, rounds = 6, host = false, again = false, slow = 0, reload = 0, sleep = 0, chaos = 0, events = [], net = null, simul = false, edge = false, check = null }) {
  fake.reset(); resetClock(); localStorage.clear(); seedRandom(seed);
  const bot = rng(seed * 7919 + 1);
  const t0 = clock(), trace = [], seen = {};
  const caps = ["capA", "capB"], gone = new Set();
  if (net) Object.assign(fake.net, net, { rnd: rng(seed * 31 + 7) });
  /* the captain now (the armband can move to a teammate when a captain's phone is gone) */
  const capOf = (t) => fake.db.members.find((m) => m.team === t && m.role === "captain" && !gone.has(m.user_id))?.user_id;
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
    for (const t of taps) if (!t.done) { const a = p0.ack[t.who]; if (a && a[t.tap] !== undefined) { t.done = clock(); t.took = a[t.tap] === "+"; t.no = ["+", "-"].includes(a[t.tap]) ? undefined : a[t.tap]; const tm = fake.db.members.find((m) => m.user_id === t.who)?.team ?? 0; t.sent = !!p0.sent?.[tm]; t.pend = p0.pending?.team === tm; t.buzz = p0.buzz; t.after = p0.screen; t.moved = `${p0.qid}|${p0.screen}` !== t.q;
      /* a phone only waits on its latest tap: older ones from it are settled too */
      for (const o of taps) if (!o.done && o.who === t.who && Number(o.tap.slice(1)) < Number(t.tap.slice(1))) { o.done = clock(); o.superseded = true; } } }
  };
  const tick = (ms) => act(async () => { await advance(ms); });
  await tick(1000);
  send(host ? "host" : "capA", "setup", { start: true, cfg: { standard: true, rounds, difficulty: "mixed", themes: THEMES.slice(0, rounds), minis } });

  let reloaded = false;
  const armed = new Set(), asked = new Set(), edged = new Set(), contested = new Set(), contestSeen = new Set();
  let contestSilent = false;
  /* while the TV is off, the phones still tap: a captain answers or buzzes what they see */
  const playOnce = (p) => {
    const t = p.turn ?? 0, who = capOf(t);
    if (!who) return;
    if ((p.screen === "ask" || p.screen === "steal") && !p.sent?.[t]) send(who, "answer", { texts: ["Paris"] });
    else if (["dishQ", "sudden", "battleTie"].includes(p.screen) && p.buzz == null) send(capOf(0) || who, "buzz", {});
    else if (["flagQ", "mapQ", "sayQ"].includes(p.screen)) { for (const k of [0, 1]) if (!p.sent?.[k] && capOf(k)) send(capOf(k), "answer", { text: "France" }); }
    else if (p.screen === "miniQ") { for (const k of [0, 1]) if (!p.sent?.[k] && capOf(k)) send(capOf(k), "answer", { n: "50" }); }
    else if (p.pending && capOf(1 - p.pending.team)) send(capOf(1 - p.pending.team), "next", { move: { type: "ui/rule", v: true }, step: p.step });
  };
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
    /* the weird things, when their time comes */
    for (const e of events) {
      if (e.done || clock() - t0 < e.at * 1000) continue;
      e.done = true; trace.push(`(${e.type}${e.for ? " " + e.for + " s" : ""}${e.team != null ? " team " + e.team : ""})`);
      if (e.type === "tvOff" || e.type === "offReload") {
        await act(async () => { setVisible(false); await flush(); });
        /* the phones carry on meanwhile */
        const until = clock() + e.for * 1000;
        while (clock() < until) { await tick(900); const p1 = fake.db.rooms[0].state?.pub; if (p1 && bot() < 0.5) playOnce(p1); }
        if (e.type === "offReload") { await act(async () => { tree.unmount(); await flush(); }); await act(async () => { setVisible(true); tree = TestRenderer.create(<Tv />); await flush(); }); }
        else await act(async () => { setVisible(true); await flush(); });
        await tick(1500);
      }
      if (e.type === "reload") { await act(async () => { tree.unmount(); await flush(); }); await act(async () => { tree = TestRenderer.create(<Tv />); await flush(); }); await tick(1500); }
      if (e.type === "capGone") { const id = capOf(e.team); if (id) { gone.add(id); fake.setPresence(fake.presence.filter((x) => x !== id)); } }
      if (e.type === "hostGone") {
        fake.setPresence(fake.presence.filter((x) => x !== "host")); gone.add("host");
        setTimeout(() => { gone.delete("host"); fake.setPresence([...fake.presence, "host"]); trace.push("(the host is back)"); }, e.for * 1000);
      }
      if (e.type === "writesFail") { fake.net.failWrites = true; setTimeout(() => { fake.net.failWrites = false; }, e.for * 1000); }
    }
    const pub = fake.db.rooms[0].state?.pub, g = api.current?.game;
    if (chaos) checkAcks();
    if (check && pub) { const bad = check(pub, clock(), document.visibilityState); if (bad) { outcome = "broken"; stuckOn = bad; break; } }
    if (!pub || !g) continue;
    /* chaos: now and then a captain taps something at the wrong moment */
    if (chaos && bot() < chaos) {
      const who = capOf(bot() < 0.5 ? 0 : 1) || capOf(0) || capOf(1), r = bot();
      const MOVES = ["round/begin", "round/afterAnswer", "round/next", "ui/next", "ui/contest", "ui/contestOk", "battle/reviewDone", "decided/stop", "tie/stop", "auction/pass", "auction/raise", "ui/pause", "flag/done", "closest/done", "battle/start", "sudden/go"];
      /* only what a phone can send on this screen: a number on Closest, words elsewhere; BUZZ where there's a buzzer */
      if (r < 0.3) send(who, "answer", pub.screen === "miniQ" ? { n: "12" } : { texts: ["Paris"] });
      else if (r < 0.45) { if (["dishQ", "sudden", "battleTie"].includes(pub.screen)) send(who, "buzz", {}); }
      else if (r < 0.6) send(who, "lifeline", { key: ["dbl", "friend", "dip"][Math.floor(bot() * 3)] });
      else send(who, "next", { move: { type: MOVES[Math.floor(bot() * MOVES.length)], v: bot() < 0.5, n: 3, id: ["first", "steal", "t0", "t1", "d0", "b0-3", "s0", "s1"][Math.floor(bot() * 8)] }, step: pub.step - (bot() < 0.3 ? 1 : 0) });
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
    /* slow captains: this beat, nobody taps (so the clocks run out now and then)... but now and then
       one has typed an answer and never presses Send: the TV takes it at time-up */
    if (slow && bot() < slow) {
      const sc = pub.screen;
      if (["ask", "steal", "miniQ", "flagQ", "mapQ", "sayQ", "battleQ", "dishQ"].includes(sc) && bot() < 0.08) {
        const t = sc === "battleQ" ? pub.battle?.cap : sc === "dishQ" ? pub.buzz : sc === "ask" || sc === "steal" ? pub.turn : bot() < 0.5 ? 0 : 1;
        if (t != null && !pub.sent?.[t] && capOf(t)) fake.insert("actions", { room: CODE, user_id: capOf(t), kind: "draft", payload: { k: `${pub.qid}|${sc}`, ...(sc === "miniQ" ? { n: "12" } : { texts: [bot() < 0.5 ? answerNow(g, pub) || "Paris" : "xyz"] }) } });
      }
      continue;
    }
    const sc = pub.screen, step = pub.step, lead = pub.lead ?? 0, other = (t) => 1 - t;
    const key = JSON.stringify([sc, step, pub.pending, pub.sent, pub.buzz, pub.auction?.count, pub.auction?.bid, pub.map?.ruled, pub.ok]);
    if (key === prevKey) { if (++same > 120) { outcome = "stuck"; stuckOn = `${sc}${pub.paused ? ", paused" : ""}${pub.pending ? ", call pending" : ""}${pub.lifeline ? ", lifeline " + pub.lifeline.key + (pub.lifeline.deadline ? " running" : " stopped") : ""}${pub.deadline ? ", clock " + Math.round((pub.deadline - clock()) / 1000) + " s" : ", no clock"}${pub.nextBy ? ", waiting for " + pub.nextBy : ""}`; break; } } else { same = 0; prevKey = key; }
    const C = (t) => capOf(t);
    /* the lead captain gone: the other one moves the night on (the TV lets them after a while) */
    const by = (t, type) => (host && !gone.has("host") && !["auction/raise", "auction/pass"].includes(type) ? "host" : C(t) || C(1 - t));
    const next = (t, type, extra = {}) => {
      const who = by(t, type), kind = who === "host" ? "judge" : "next";
      if (!who) return;
      send(who, kind, { move: { type, ...extra }, step });
      /* the same tap from the other captain, at the very same moment */
      if (simul && kind === "next" && C(1 - t) && C(1 - t) !== who) send(C(1 - t), "next", { move: { type, ...extra }, step });
    };
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
    /* whoever paused resumes (a real person does) */
    if (pub.paused && !pub.tvAway && bot() < 0.3) { const w = host && !gone.has("host") ? "host" : C(0) || C(1); if (w) send(w, w === "host" ? "judge" : "next", { move: { type: "ui/pause", on: "resume" }, step }); continue; }
    /* a contest open: the other captain (or the host) agrees, says no, or (now and then) doesn't answer at all */
    if (pub.contest) {
      const K = pub.contest;
      if (!contestSeen.has(K.id + step)) { contestSeen.add(K.id + step); contestSilent = bot() < 0.2; }
      /* a host who lets it go simply moves on: Next closes the contest */
      if (contestSilent && host && !gone.has("host") && NEXT[sc] && bot() < 0.3) { send("host", "judge", { move: { type: NEXT[sc] }, step }); continue; }
      if (!contestSilent && bot() < 0.6) {
        const v = bot() < 0.5;
        if (host && !gone.has("host")) send("host", "judge", { move: { type: "ui/contestOk", v }, step });
        else if (C(1 - K.by)) send(C(1 - K.by), "next", { move: { type: "ui/contestOk", v }, step });
      }
      continue;
    }
    /* a lifeline card up (Call a Friend): the team closes it, or its clock does */
    else if (pub.lifeline) { if (bot() < 0.4) next(pub.turn ?? 0, "ui/closeLifeline"); }
    /* where the app's calls are shown: now and then a captain contests one (once per screen) */
    else if ((pub.calls || []).some((c) => !c.done) && !contested.has(sc + step) && bot() < 0.35) {
      contested.add(sc + step);
      /* (a captain contests their own team's call, or the other team's RIGHT) */
      const open = pub.calls.filter((c) => !c.done), c = open[Math.floor(bot() * open.length)], by = c.ok && bot() < 0.5 ? 1 - c.team : c.team;
      if (C(by)) send(C(by), "next", { move: { type: "ui/contest", id: c.id }, step });
    }
    /* Double Points: armed now and then before a round */
    else if (sc === "roundIntro" && !armed.has(step) && bot() < 0.3) { armed.add(step); send(C(bot() < 0.5 ? 0 : 1), "lifeline", { key: "dbl" }); }
    else if (sc === "decided") next(lead, bot() < 0.5 ? "decided/more" : "decided/stop");
    else if (NEXT[sc]) next(lead, NEXT[sc]);
    else if (/Tie$|Level$/.test(sc) && sc !== "battleTie") next(lead, "tie/stop");
    else if (sc === "ask" || sc === "steal") {
      if (!pub.sent?.[pub.turn] && sc === "ask" && !asked.has(step) && bot() < 0.15) { asked.add(step); send(C(pub.turn), "lifeline", { key: bot() < 0.5 ? "dip" : "friend" }); }
      /* edge: the answer lands at the very moment the clock runs out */
      else if (!pub.sent?.[pub.turn] && edge && pub.deadline && !edged.has(step)) { edged.add(step); const who = C(pub.turn), txt = guess(right); setTimeout(() => send(who, "answer", { texts: [txt] }), Math.max(0, pub.deadline - clock())); }
      else if (!pub.sent?.[pub.turn] && !edge) send(C(pub.turn), "answer", { texts: [guess(right), guess(right)] });
      else if (host) next(0, sc === "ask" ? "round/judge" : "round/judgeSteal", { v: bot() < 0.5 });
    }
    else if (sc === "miniQ") { for (const t of [0, 1]) if (!pub.sent?.[t]) send(C(t), "answer", { n: String(Math.round((Number(right) || 100) * (0.6 + bot() * 0.8))) }); }
    else if (["flagQ", "mapQ", "sayQ"].includes(sc)) {
      for (const t of [0, 1]) if (!pub.sent?.[t]) send(C(t), "answer", { text: guess(right) });
      if (host && pub.sent?.[0] && pub.sent?.[1]) next(0, "ui/reveal");
    }
    else if (sc === "dishQ") {
      if (pub.buzz == null) { const t = pub.out?.[0] ? 1 : 0; if (!pub.out?.[t]) send(C(t), "buzz", {}); if (simul && !pub.out?.[1 - t]) send(C(1 - t), "buzz", {}); }
      else if (!pub.sent?.[pub.buzz]) send(C(pub.buzz), "answer", { text: guess(right) });
      else if (host) next(0, bot() < 0.5 ? "dish/right" : "dish/wrong");
    }
    else if (sc === "auctionBid") { const a = pub.auction; if (a.bid === 0) send(C(a.turn), "next", { move: { type: "auction/raise", n: 2 + Math.floor(bot() * 4) }, step }); else send(C(a.turn), "next", { move: { type: "auction/pass" }, step }); }
    else if (sc === "auctionRun") { const a = pub.auction; if (a.count < a.bid) next(other(a.by), "auction/tick"); else if (host) next(0, "auction/resolve"); }
    else if (sc === "battleQ") { if (host) next(0, "battle/mark", { got: bot() < 0.5 }); else send(C(pub.battle.cap), "answer", { text: guess(right) }); }
    else if (sc === "sudden" || sc === "battleTie") {
      if (sc === "sudden" && !pub.sudden?.ready) next(lead, "sudden/go");
      else if (pub.buzz == null) { const t = pub.out?.[0] ? 1 : 0; send(C(t), "buzz", {}); if (simul && !pub.out?.[1 - t]) send(C(1 - t), "buzz", {}); }
      else if (host) next(0, bot() < 0.5 ? "ui/sdRight" : "ui/sdWrong");
      else send(C(pub.buzz), "answer", { text: guess(right) });
    }
  }
  await tick(5000); checkAcks();                       // the last taps' late pushes land
  await act(async () => { tree.unmount(); await flush(); });
  resetClock();
  return { taps, outcome, stuckOn, trace, recap, screens: Object.keys(seen), score: score || fake.db.rooms[0].state?.pub?.teams?.map((x) => x.score).join("-"), minutes: (clock() - t0) / 60000, writes: fake.db.writes, actions: fake.db.actions.length, stalls: fake.db.stalls };
}
