/* 3-8 TEAMS, THE REAL REFEREE: lib/many/useTvMany.ts itself (the hook the TV, or the game phone with no TV, runs),
   in Node with the fake Supabase (sim/fakeSupabase.js) and the virtual clock (sim/env.js). Captains, players and the
   host send their taps as actions, as their phones do; the checks read what the room shows (state.pub) and what the
   referee keeps (its save). For 3 and 8 teams, each with a TV and with no TV (the game phone, which also keeps a
   copy on the server for a takeover):
     What Do You See?   a buzz kept through a sleep, a reload, and a phone takeover; a RIGHT turned down with other
                        teams still to go: a new picture for everyone, in the same slot
     Secret Stakes      the bets' clock through a reload; the last bet landing while the screen is away (the
                        question clock waits); a bet on themes that have just changed, refused
     Majority Rules     Change question at the same level; a vote while paused kept; Start refused with nobody on the list
     Fool Me Twice      the truth refused as a lie, a missing lie, the screen asleep, a reload and a takeover on the picks,
                        own lie and no prediction refused, the points, Change fact, Reveal now, Pause, the places
     Russian Roulette   a reload mid-spin and mid-question, the screen asleep, a phone takeover from the server's copy
                        mid-question; each spin's points, the game's points, summary.spins and the night's award
   Run: node sim/manytv.mjs (built and run by it). */
import { advance, clock, flush, resetClock, seedRandom, setVisible } from "./env.js";
import { act, useEffect, useState } from "react";
import TestRenderer from "react-test-renderer";
import * as fake from "./fakeSupabase.js";
import { useTvMany } from "../lib/many/useTvMany";
import { PLACE_PTS } from "../lib/many/logic";
import { storeTakenSave } from "../lib/takeSave";
import fullBank from "../data/bank.json";
import accept from "../data/accept.json";
import liteBank from "../public/bank.json";

/* the window's own events (the settings' "qmb:settings"), and the bank as the app's /api/bank serves it */
{ const et = new EventTarget(); globalThis.addEventListener = et.addEventListener.bind(et); globalThis.removeEventListener = et.removeEventListener.bind(et); globalThis.dispatchEvent = et.dispatchEvent.bind(et); }
globalThis.fetch = async (url) => ({ ok: true, status: 200, json: async () => structuredClone(String(url).includes("/api/bank") ? { bank: fullBank, accept } : liteBank) });

const CODE = "MANY", KEY = "qmb.tv." + CODE + ".many";
const read = () => ({ room: structuredClone(fake.db.rooms.find((r) => r.code === CODE) || null), members: structuredClone(fake.db.members.filter((m) => m.room === CODE)) });
let phoneMode = false;
function Tv() {
  const [snap, setSnap] = useState(() => read());
  useEffect(() => fake.onChange((t) => { if (t === "rooms" || t === "members") setSnap(read()); }), []);
  useTvMany(CODE, true, snap.room, snap.members, phoneMode);
  return null;
}
/* the server's copy (qmb_tv_backup): the game phone sends one; the fake server keeps the last */
let backup = null;
fake.sb().rpc = (name, args) => {
  /* (no internet: every call fails, the TV's online check too, lib/tv/netProbe.ts) */
  if (fake.net.failWrites) return Promise.resolve({ data: null, error: { message: "Failed to fetch" } });
  if (name === "qmb_tv_backup") backup = structuredClone({ ...args.s, at: clock() }); return Promise.resolve({ data: null, error: null }); };

const send = (who, kind, payload) => fake.insert("actions", { room: CODE, user_id: who, kind, payload });
const tick = (ms) => act(async () => { await advance(ms); });
const pub = () => fake.db.rooms[0].state?.pub;
const saved = () => JSON.parse(localStorage.getItem(KEY) || "null")?.s;
const mini = () => { const s = saved(); return s.minis[s.mi]; };
let tree = null, tapN = 0;
const mount = () => act(async () => { tree = TestRenderer.create(<Tv />); await flush(); });
const unmount = () => act(async () => { tree?.unmount(); tree = null; await flush(); });
const hide = (on) => act(async () => { setVisible(!on); await flush(); });
/* a reload: the page hides first (as a browser's reload does), then comes back as a new page */
async function reload() { await hide(true); await unmount(); await tick(500); await hide(false); await mount(); await tick(600); }
/* the screen asleep (a call, another app), then back */
async function sleep(ms) { await hide(true); await tick(ms); await hide(false); await tick(300); }
/* the game phone gone mid-game (no goodbye); another phone takes over from the server's copy, agoMs after it was made */
async function takeover(agoMs) {
  const copy = backup; await unmount();
  await tick(Math.max(0, agoMs - (clock() - copy.at)));
  localStorage.clear();
  storeTakenSave(CODE, copy, (clock() - copy.at) / 1000);
  await mount(); await tick(600);
  return copy;
}
const judge = async (type, extra = {}) => { send("host", "judge", { move: { type, ...extra }, step: pub().step }); await tick(600); };
const tap = () => "t" + (++tapN);

const out = [];
const check = (name, ok, more = "") => out.push(`${ok ? "ok  " : "FAIL"} ${name}${more !== "" ? "  -- " + more : ""}`);

/* a room: the host, k captains, a player on each team; the host starts a night of the given games */
async function setup(k, phone, minis, seed = 3, more = {}) {
  await unmount();
  fake.reset(); resetClock(); localStorage.clear(); seedRandom(seed); phoneMode = phone; backup = null;
  fake.db.rooms.push({ code: CODE, status: "lobby", mode: null, state: { teamCount: k } });
  fake.db.secrets.push({ room: CODE, data: null });
  fake.db.members.push({ room: CODE, user_id: "host", name: "Nour", team: null, role: "host", face: null });
  for (let t = 0; t < k; t++) fake.db.members.push({ room: CODE, user_id: "c" + t, name: "Cap" + t, team: t, role: "captain", face: null },
    { room: CODE, user_id: "p" + t, name: "Pl" + t, team: t, role: "player", face: null });
  fake.setPresence(fake.db.members.map((m) => m.user_id));
  await mount(); await tick(1500);
  send("host", "setup", { start: true, cfg: { minis, rounds: 0, themes: [], ...more } });
  await tick(3000);
  await judge("m/go");
}

/* ---------- What Do You See? ---------- */
const seeAns = () => { const m = mini(); return m.qs[m.i].answer; };
async function see(k, phone, tag) {
  await setup(k, phone, ["see"]); await judge("m/start");
  check(`${tag} See: the picture is up`, pub()?.screen === "q" && !!pub()?.see, pub()?.screen);
  send("host", "buzz", {}); await tick(300);
  check(`${tag} See: the host can't buzz`, pub().see.buzz == null);
  send("p1", "buzz", {}); send("c2", "buzz", {}); await tick(300);
  check(`${tag} See: a player's buzz taken, another team's in the same instant not`, pub().see.buzz === 1 && pub().see.by === "Pl1", `${pub().see.buzz} ${pub().see.by}`);
  send("p1", "answer", { text: seeAns() }); await tick(300);
  check(`${tag} See: a player's typed answer refused (the captain types)`, pub().screen === "q" && pub().see.buzz === 1);
  await tick(10400); check(`${tag} See: still buzzed at 10.7 s (the grace)`, pub().see.buzz === 1);
  await tick(800); check(`${tag} See: silent 10 s: out`, pub().see.out[1] && pub().see.buzz == null, JSON.stringify(pub().see.out));
  send("c2", "buzz", {}); await tick(300); send("c2", "answer", { text: seeAns(), k: `${pub().qid}|q` }); await tick(400);
  check(`${tag} See: right: the reveal, team 2 first`, pub().screen === "reveal" && pub().see.rev?.who === 2, `${pub().screen} ${JSON.stringify(pub().see?.rev?.who)}`);
  await judge("m/next");

  /* the screen asleep 30 s mid-buzz: the team keeps what was left of its 10 s */
  send("c0", "buzz", {}); await tick(3300);
  await sleep(30000);
  check(`${tag} See: asleep 30 s mid-buzz, back: still buzzed`, pub().see.buzz === 0 && !pub().see.out[0], `buzz ${pub().see.buzz} out ${JSON.stringify(pub().see.out)}`);
  await tick(8000); check(`${tag} See: ...and out once the rest of its 10 s is up`, pub().see.out[0]);
  /* asleep 30 s mid-buzz, back as a reload (a phone's browser drops a tab it had in the background) */
  send("c1", "buzz", {}); await tick(3300);
  await hide(true); await unmount(); await tick(30000); await hide(false); await mount(); await tick(600);
  check(`${tag} See: asleep 30 s mid-buzz, back as a reload: still buzzed`, pub().see.buzz === 1 && !pub().see.out[1], `buzz ${pub().see.buzz} out ${JSON.stringify(pub().see.out)}`);
  await tick(8000); check(`${tag} See: ...and out once the rest is up`, pub().see.out[1]);

  if (phone) {
    /* the game phone gone mid-buzz; another phone takes over from the server's copy 25 s later */
    /* (the copy goes at once on a new screen, else at most every 4 s: a buzz 5 s into the picture is in it) */
    await setup(k, true, ["see"], 9); await judge("m/start");
    await tick(5000); send("c0", "buzz", {}); await tick(1000);
    check(`${tag} See: the game phone's copy has the buzz in it`, backup?.s?.buzz === 0, JSON.stringify(backup?.s?.buzz));
    await takeover(25000);
    check(`${tag} See: taken over 25 s later mid-buzz: still buzzed`, pub().see.buzz === 0 && !pub().see.out[0], `buzz ${pub().see.buzz} out ${JSON.stringify(pub().see.out)}`);
    /* (its 10 s from the copy's time: the 25 s the game was between phones don't count) */
    await tick(8500); check(`${tag} See: ...8.5 s after the takeover still buzzed`, pub().see.buzz === 0 && !pub().see.out[0]);
    await tick(3000); check(`${tag} See: ...and out once its 10 s are up`, pub().see.out[0]);
    /* a buzz within 4 s of the last copy isn't in it: the phone taking over reads it again from the taps after the
       copy, and the team has its 10 s from then */
    await setup(k, true, ["see"], 10); await judge("m/start");
    send("c1", "buzz", {}); await tick(1000);
    check(`${tag} See: a buzz 1 s after the picture went up isn't in the copy yet`, backup?.s?.buzz == null, JSON.stringify(backup?.s?.buzz));
    await takeover(25000);
    check(`${tag} See: taken over: the buzz read again from the taps, still buzzed`, pub().see.buzz === 1 && !pub().see.out[1], `buzz ${pub().see.buzz} out ${JSON.stringify(pub().see.out)}`);
    await tick(12000); check(`${tag} See: ...and out after its 10 s`, pub().see.out[1] && pub().screen === "q");
  }

  /* a RIGHT turned down by the host with other teams still to go: a new picture for everyone, in the same slot */
  await setup(k, phone, ["see"], 4); await judge("m/start");
  const n0 = pub().see.n, photo0 = pub().see.photo ?? JSON.stringify(pub().see), id0 = mini().qs[mini().i].id;
  send("c1", "buzz", {}); await tick(300); send("c1", "answer", { text: seeAns() }); await tick(300);
  check(`${tag} See: right: reveal`, pub().screen === "reveal" && pub().see.rev?.who === 1, JSON.stringify(pub().see.rev?.who));
  await judge("m/flip", { t: 1 });
  check(`${tag} See: turned down: nobody first on the reveal`, pub().see.rev?.who == null, JSON.stringify(pub().see.rev?.who));
  await judge("m/next");
  const id1 = mini().qs[mini().i].id;
  check(`${tag} See: Next: a new picture for everyone, at the same picture number`, pub().screen === "q" && pub().see.n === n0 && id1 !== id0 && (pub().see.photo ?? "") !== (photo0 ?? "") && pub().see.out.every((x) => !x),
    `n ${n0} -> ${pub().see.n}, ${id0} -> ${id1}, toast "${pub().toast?.text}"`);
  check(`${tag} See: the toast says so`, /new picture for everyone/.test(pub().toast?.text || ""), pub().toast?.text);
  check(`${tag} See: nobody scored for the picture turned down`, mini().pts.every((p) => p === 0), String(mini().pts));
  send("c2", "buzz", {}); await tick(300);
  check(`${tag} See: the teams can buzz on the new picture`, pub().see.buzz === 2);
}

/* ---------- Secret Stakes ---------- */
const bet = async (t, k, level, extra = {}) => { const id = tap(); send("c" + t, "next", { move: { type: "m/bet", k, level, ...extra }, tap: id }); await tick(600); return pub().ack?.["c" + t]?.[id]; };
async function stakes(k, phone, tag) {
  /* the bets' clock through a reload: it runs on from where it was */
  await setup(k, phone, ["stakes"]); await judge("m/start");
  check(`${tag} Stakes: the bets are up`, pub().screen === "pick" && !!pub().deadline, pub().screen);
  const left0 = pub().deadline - clock();
  await bet(0, 1, "hard");
  await tick(3000);
  await reload();
  const left1 = pub().deadline ? pub().deadline - clock() : null;
  check(`${tag} Stakes: reload on the bets: the clock runs on (left ${Math.round(left0 / 1000)} s, after ${left1 == null ? "none" : Math.round(left1 / 1000) + " s"})`,
    left1 != null && left1 > left0 - 6000 && left1 < left0, `deadline ${pub().deadline}`);
  check(`${tag} Stakes: ...and the bet placed before it is kept`, saved().picks?.[0]?.k === 1 && saved().picks[0].level === "hard", JSON.stringify(saved().picks?.[0]));
  await tick(left1 + 1500);
  check(`${tag} Stakes: ...and when it runs out the questions go up (the rest take the safe bet)`, pub().screen === "q" && saved().picks.slice(1).every((p) => p?.auto), pub().screen);

  /* the last bet lands while the screen is away: the question clock waits for the screen */
  await setup(k, phone, ["stakes"], 5); await judge("m/start");
  await hide(true); await tick(1000);
  for (let t = 0; t < k; t++) await bet(t, 0, "medium");
  check(`${tag} Stakes: every bet in while the screen is away: the questions are up, the clock waiting`, saved().screen === "q" && !saved().deadline && saved().left > 40, `screen ${saved().screen} deadline ${saved().deadline} left ${saved().left}`);
  await tick(60000); await hide(false); await tick(1000);
  const left = pub().deadline ? (pub().deadline - clock()) / 1000 : null;
  check(`${tag} Stakes: away 60 s, back: still on the question, its clock from the start`, pub().screen === "q" && left != null && left > 40, `screen ${pub().screen} left ${left}`);

  /* a bet tapped on the themes as they were, landing after the host's Change question: refused */
  await setup(k, phone, ["stakes"], 6); await judge("m/start");
  const old = [...pub().stakes.themes];
  await judge("m/swap");
  const now = pub().stakes.themes;
  check(`${tag} Stakes: Change question: three new themes`, now.join("/") !== old.join("/"), `${old.join("/")} -> ${now.join("/")}`);
  const r = await bet(0, 2, "expert", { theme: old[2] });
  check(`${tag} Stakes: a bet with an old theme's name refused, and said so`, !saved().picks?.[0] && /themes changed/.test(r || ""), `pick ${JSON.stringify(saved().picks?.[0])} reply "${r}"`);
  const r2 = await bet(0, 2, "expert", { theme: now[2] });
  check(`${tag} Stakes: ...the same bet on the new theme taken`, r2 === "+" && saved().picks?.[0]?.k === 2, `reply "${r2}"`);
}

/* ---------- Majority Rules ---------- */
async function majority(k, phone, tag) {
  await setup(k, phone, ["majority"]); await judge("m/start");
  check(`${tag} Majority: the question is up`, pub().screen === "q", pub().screen);
  const q = () => mini().qs[mini().i];
  /* Change question: one at the same level, from every spare the deck has left, said on the TV (as with 2 teams: 25 Nov) */
  { const was = q(), lv = was.level, left = (saved().extra?.majority || []).length, same = (saved().extra?.majority || []).some((x) => x.level === lv);
    await judge("m/swap");
    check(`${tag} Majority: Change question, the same level, "New question."`, q().id !== was.id && (!same || q().level === lv) && /^New question\.$/.test(pub().toast?.text || "") && left > 4,
      `level ${lv} -> ${q().level}, ${left} spares, toast "${pub().toast?.text}"`); }
  await judge("m/pause");
  check(`${tag} Majority: paused`, saved().paused === true);
  const id = tap(); send("p0", "answer", { pick: q().answer, tap: id }); await tick(1500);
  /* (a vote that lands while paused is kept, and the reveal waits for Resume, as with 2 teams: 22 Nov, the owner) */
  check(`${tag} Majority: a vote while paused is kept, still on the question`, saved().votes?.Pl0 === q().answer && pub().ack?.p0?.[id] === "+" && pub().screen === "q", `vote ${saved().votes?.Pl0} reply "${pub().ack?.p0?.[id]}"`);
  await judge("m/pause");
  send("p0", "answer", { pick: q().answer }); await tick(1500);
  check(`${tag} Majority: resumed: the vote counts`, saved().votes?.Pl0 === q().answer);

  /* everyone taken off the list before Start: Start refused, the game waits */
  await setup(k, phone, ["majority"], 8);
  for (const m of fake.db.members) if (m.role !== "host") await judge("m/mrOut", { name: m.name });
  check(`${tag} Majority: everyone off the list`, (saved().mrOut || []).length === 2 * k, String((saved().mrOut || []).length));
  const step = pub().step, id2 = tap();
  send("host", "judge", { move: { type: "m/start" }, step, tap: id2 }); await tick(600);
  check(`${tag} Majority: Start refused with nobody on the list`, pub().screen === "intro" && /Nobody/.test(pub().ack?.host?.[id2] || ""), `screen ${pub().screen} reply "${pub().ack?.host?.[id2]}"`);
  /* who comes back (25 Nov, the owner): taken off while on the game screen, they stay off whoever else comes or goes;
     seen away and then back on the game screen, they're put back, and the TV says so; never back: they stay off */
  /* (with a TV: the test room's game phone can't see who's on the game screen, so there nobody is ever away) */
  if (!phone) { const all = fake.db.members.map((m) => m.user_id), id = (n) => fake.db.members.find((m) => m.name === n).user_id;
    await tick(10000);
    check(`${tag} Majority: taken off while on the game screen: they stay off`, (saved().mrOut || []).length === 2 * k, String((saved().mrOut || []).length));
    fake.setPresence(all.filter((x) => x !== id("Pl1") && x !== id("Pl2"))); await tick(40000);
    check(`${tag} Majority: two of them go away: still off`, (saved().mrOut || []).includes("Pl1") && (saved().mrOut || []).includes("Pl2"));
    fake.setPresence(all.filter((x) => x !== id("Pl2"))); await tick(4000);
    check(`${tag} Majority: one comes back to the game screen: back on the list, and the TV says so`, !(saved().mrOut || []).includes("Pl1") && /Pl1 is back on the list/.test(pub().toast?.text || "") && pub().mrList?.some((x) => x.name === "Pl1" && !x.out),
      `out ${(saved().mrOut || []).includes("Pl1")}, toast "${pub().toast?.text}"`);
    check(`${tag} Majority: the one who never came back stays off, the others too`, (saved().mrOut || []).length === 2 * k - 1 && (saved().mrOut || []).includes("Pl2"), String((saved().mrOut || []).length));
    await judge("m/mrOut", { name: "Pl1" }); await tick(4000);
    check(`${tag} Majority: taken off again while here: stays off`, (saved().mrOut || []).includes("Pl1"));
    fake.setPresence(all); await tick(4000);
    check(`${tag} Majority: the other one comes back later: back on the list too`, !(saved().mrOut || []).includes("Pl2"));
    await judge("m/mrOut", { name: "Pl2" }); await tick(4000);
    check(`${tag} Majority: ...and taken off again while here: stays off`, (saved().mrOut || []).includes("Pl2") && (saved().mrOut || []).length === 2 * k); }
  await judge("m/mrOut", { name: "Pl0" });
  await judge("m/start");
  check(`${tag} Majority: one back on the list: Start goes`, pub().screen === "q" && saved().roster.length === 1, `screen ${pub().screen} roster ${saved().roster?.length}`);
}

/* who counts after Start (25 Nov, the owner): taken off during the game, or out of the room as a question goes up:
   not counted from the next question; back in the room with the same name: counted again from the next one; the
   host's Take them off and start */
async function majorityDuring(k, phone, tag) {
  await setup(k, phone, ["majority"]);
  const on = () => pub().roster || [], next = async () => { await judge("m/reveal"); await judge("m/next"); };
  /* Take them off and start: Pl1 isn't on the game screen, so comes off, and the rest start */
  if (!phone) { fake.setPresence(fake.db.members.map((m) => m.user_id).filter((u) => u !== "p1")); await tick(40000); }
  await judge("m/start", phone ? {} : { drop: true });
  check(`${tag} Majority: Take them off and start: who's away is off, the rest play`, pub().screen === "q" && (phone || (!on().includes("Pl1") && on().includes("Pl0"))), `screen ${pub().screen}, on ${on().join(",")}`);
  fake.setPresence(fake.db.members.map((m) => m.user_id));
  /* the host takes Pl0 off during the question: still counted on this one, not from the next */
  await judge("m/mrOut", { name: "Pl0" });
  check(`${tag} Majority: taken off during a question: still counted on it`, on().includes("Pl0") && /Pl0 is off the list from the next question/.test(pub().toast?.text || ""), pub().toast?.text);
  await next();
  check(`${tag} Majority: ...and not from the next one`, pub().screen === "q" && !on().includes("Pl0") && pub().mrNot?.some((x) => x.name === "Pl0" && x.why === "off"), on().join(","));
  const id = tap(); send("p0", "answer", { pick: (pub().options || [])[0], tap: id }); await tick(1500);
  check(`${tag} Majority: their tap is turned away, and says why`, pub().ack?.p0?.[id] === "You\u2019re off the list for this one: watch.", pub().ack?.p0?.[id]);
  /* Cap1 leaves the room during a question: counted on it, not from the next; back with the same name: counted again
     from the one after */
  const cap = fake.db.members.find((m) => m.user_id === "c1");
  fake.db.members = fake.db.members.filter((m) => m.user_id !== "c1"); await tick(3000);
  check(`${tag} Majority: left the room during a question: still counted on it`, on().includes("Cap1"));
  await next();
  check(`${tag} Majority: ...and not from the next one`, !on().includes("Cap1"), on().join(","));
  fake.db.members.push(cap); await tick(3000);
  check(`${tag} Majority: back in the room: not on this question, and told so`, !on().includes("Cap1") && pub().mrNot?.some((x) => x.name === "Cap1" && x.why === "back"));
  await next();
  check(`${tag} Majority: ...counted again from the next one`, on().includes("Cap1"), on().join(","));
  /* the host puts Pl0 back: from the next question */
  await judge("m/mrOut", { name: "Pl0" }); await next();
  check(`${tag} Majority: put back during the game: counted from the next question`, on().includes("Pl0"), on().join(","));
  /* each team's number of answers is the question's own: a team's share isn't pulled down by someone who left */
  const t1 = (pub().mrAnswered || [])[1];
  check(`${tag} Majority: each team's count is who counts now`, Array.isArray(t1) && t1[1] === (phone ? 2 : 1), JSON.stringify(t1));
}

/* ---------- Russian Roulette ---------- */
/* what a chamber pays (engine/core.js roulettePts): the bullet +5 right, -3 wrong or none; Medium 2, Hard 3 */
const worth = (level, ok) => (level === "bullet" ? (ok ? 5 : -3) : !ok ? 0 : level === "medium" ? 2 : 3);
async function roulette(k, phone, tag) {
  await setup(k, phone, ["roulette"], 11); await judge("m/start");
  const lapAns = (t) => { const m = mini(), lap = m.qs[m.i]; return lap.ch[lap.draw[t]].q.answer; };
  const want = Array.from({ length: k }, () => []);
  for (let lap = 0; lap < 3; lap++) {
    const L = `${tag} Roulette spin ${lap + 1}:`;
    check(`${L} the barrel spins`, pub().screen === "q" && pub().roulette?.lap === lap + 1 && pub().roulette.spinAt != null, `${pub().screen} lap ${pub().roulette?.lap}`);
    const draw0 = JSON.stringify(pub().roulette.draw), dl0 = pub().deadline;
    /* the disruption of this spin */
    let what;
    if (lap === 0) { await tick(1500); await reload(); what = "a reload mid-spin"; }
    else if (lap === 1) { await tick(12000); await reload(); await sleep(30000); what = "a reload mid-question, then the screen asleep 30 s"; }
    else if (phone) {
      await tick(9000); const copy = await takeover(20000); what = "a phone takeover from the server's copy mid-question, 20 s on";
      const was = copy.s.deadline - copy.at, now = pub().deadline - clock() + 600;
      check(`${L} taken over: the clock has what it had in the copy (the time between phones doesn't count)`, Math.abs(now - was) < 50, `copy ${was} ms left, now ${now}`);
    }
    else { await tick(2000); await sleep(45000); what = "the screen asleep 45 s mid-spin"; }
    check(`${L} after ${what}: the same chambers`, JSON.stringify(pub().roulette.draw) === draw0 && pub().screen === "q");
    const rest = pub().deadline ? pub().deadline - clock() : null;
    check(`${L} after ${what}: the clock runs on, none of it lost to the wait`, rest != null && rest > 0 && rest <= dl0 - pub().roulette.spinAt && rest > 20000, `left ${rest}`);
    /* the answers: most right, every third team wrong, the last team silent (the clock has to end it) */
    const plan = Array.from({ length: k }, (_, t) => (t === k - 1 ? "none" : (t + lap) % 3 === 2 ? "wrong" : "right"));
    for (let t = 0; t < k; t++) if (plan[t] !== "none") send("c" + t, "answer", { text: plan[t] === "right" ? lapAns(t) : "Atlantis", k: `${pub().qid}|q` });
    await tick(1500);
    check(`${L} the answers in, still on the question for the silent team`, pub().screen === "q");
    /* the silent team's captain has typed but not sent: at time's up, after the second's grace, it counts (as with 2
       teams: 22 Nov, the owner) */
    send("c" + (k - 1), "draft", { k: `${pub().qid}|q`, text: "Atlantis", seq: 1 }); await tick(300);
    await tick((pub().deadline - clock()) + 400);
    check(`${L} time up: the second's grace, the clock says time up`, pub().screen === "q" && pub().timeUp === true, pub().screen);
    await tick(1100);
    check(`${L} time up: the reveal`, pub().screen === "reveal" && !!pub().roulette?.rev, pub().screen);
    check(`${L} the silent team's unsent answer counts`, pub().reveal?.typed?.[k - 1] === "Atlantis", String(pub().reveal?.typed?.[k - 1]));
    const levels = pub().roulette.draw.map((d) => d.level), got = plan.map((p, t) => worth(levels[t], p === "right"));
    check(`${L} each team's points on the reveal (+2, +3, the bullet +5 or -3)`, JSON.stringify(pub().roulette.rev.got) === JSON.stringify(got), `levels ${levels.join(",")} got ${pub().roulette.rev.got} want ${got}`);
    got.forEach((g, t) => want[t].push(g));
    await judge("m/next");
  }
  check(`${tag} Roulette: the summary after 3 spins`, pub().screen === "summary", pub().screen);
  const pts = want.map((w) => w.reduce((a, b) => a + b, 0)), sum = pub().summary;
  check(`${tag} Roulette: summary.spins, spin by spin`, JSON.stringify(sum?.spins) === JSON.stringify(want), `${JSON.stringify(sum?.spins)} want ${JSON.stringify(want)}`);
  check(`${tag} Roulette: the game's points`, JSON.stringify(sum?.pts) === JSON.stringify(pts) && JSON.stringify(mini().pts) === JSON.stringify(pts), `${sum?.pts} want ${pts}`);
  const award = pts.map((v) => PLACE_PTS[v > 0 ? pts.filter((x) => x > v).length : pts.length - 1]);
  check(`${tag} Roulette: the night's points paid by place (none for 0 or below)`, JSON.stringify(sum?.award) === JSON.stringify(award) && saved().teams.every((x, t) => x.score === award[t]),
    `${sum?.award} want ${award}`);
}

/* ---------- Fool Me Twice (the owner, 16 Nov) ---------- */
const ackOf = (who, id) => pub().ack?.[who]?.[id];
async function fool(k, phone, tag) {
  await setup(k, phone, ["fool"], 12); await judge("m/start");
  const F = () => pub().fool, fact = () => mini().qs[mini().i];
  check(`${tag} Fool: the fact is up, its blank, no answers yet`, pub().screen === "q" && !!F()?.fact?.includes("____") && !F().opts, pub().screen);
  check(`${tag} Fool: 6 facts, the last 2 hard`, mini().qs.length === 6 && mini().qs.map((q) => (q.level === "hard" ? "h" : "n")).join("") === "nnnnhh", mini().qs.map((q) => q.level).join(","));
  /* the truth, typed as a lie: refused, and said so */
  let id = tap(); send("c0", "answer", { text: fact().answer.toLowerCase() + ".", k: `${pub().qid}|q`, tap: id }); await tick(1300);
  check(`${tag} Fool: the truth as a lie: "That's the truth, write a lie!"`, ackOf("c0", id) === "That's the truth, write a lie!" && !pub().sent[0], `reply "${ackOf("c0", id)}"`);
  /* a player can't write it; the captains can, the last one late */
  send("p1", "answer", { text: "A player's lie", k: `${pub().qid}|q` }); await tick(600);
  check(`${tag} Fool: a player's lie refused (the captain writes it)`, !pub().sent[1]);
  for (let t = 0; t < k - 1; t++) send("c" + t, "answer", { text: t === 1 ? "Hamster" : t === 2 ? "hamstr" : "Lie " + t, k: `${pub().qid}|q` });
  await tick(1500);
  check(`${tag} Fool: still on the lies for the last team`, pub().screen === "q" && pub().sent.filter(Boolean).length === k - 1);
  /* the screen asleep 30 s: the clock waits */
  const left0 = pub().deadline - clock();
  await sleep(30000);
  const left1 = pub().deadline - clock();
  check(`${tag} Fool: asleep 30 s on the lies: none of the clock lost`, pub().screen === "q" && left1 > left0 - 2000, `${Math.round(left0 / 1000)} s, then ${Math.round(left1 / 1000)} s`);
  await tick(left1 + 1000);
  check(`${tag} Fool: time's up: the answers are up, ${k + 1 + (k <= 3 ? 1 : 0)} of them`, pub().screen === "pick" && F().opts?.length === k + 1 + (k <= 3 ? 1 : 0), `${pub().screen} ${F()?.opts?.length}`);
  /* (the truth is one of the answers, of course: nothing says which) */
  check(`${tag} Fool: the phones can't tell whose answer is whose, nor which is the truth`, !/"by"|"truth"|"ours"|"rev"/.test(JSON.stringify(pub())) && F().opts.includes(fact().answer));
  const opts = saved().fool.opts;
  check(`${tag} Fool: the last team's missing lie: one of ours instead`, saved().fool.lost.includes(k - 1) && opts.filter((o) => o.by.length).length === (k > 3 ? k - 2 : k - 1), JSON.stringify(opts.map((o) => o.by)));
  /* a lie landing now (sent for the lies) isn't taken */
  id = tap(); send("c" + (k - 1), "answer", { text: "Too late", k: `${pub().qid}|q`, tap: id }); await tick(1300);
  check(`${tag} Fool: a lie landing on the picks refused`, /Too late/.test(ackOf("c" + (k - 1), id) || "") && !opts.some((o) => o.text === "Too late"), `reply "${ackOf("c" + (k - 1), id)}"`);
  /* a reload on the picks: the same answers, the same order */
  const order0 = JSON.stringify(F().opts);
  await reload();
  check(`${tag} Fool: reload on the picks: the same answers in the same order`, pub().screen === "pick" && JSON.stringify(F().opts) === order0);
  /* its own lie: refused; with no prediction: refused; then a pick and a prediction each */
  const own = opts.findIndex((o) => o.by.includes(0)), truth = opts.findIndex((o) => o.truth);
  id = tap(); send("c0", "answer", { pick: own, pred: 1, k: `${pub().qid}|pick`, tap: id }); await tick(1300);
  check(`${tag} Fool: its own lie as its pick refused`, ackOf("c0", id) === "That's your own lie: pick another one." && !pub().sent[0], `reply "${ackOf("c0", id)}"`);
  id = tap(); send("c0", "answer", { pick: truth, k: `${pub().qid}|pick`, tap: id }); await tick(1300);
  check(`${tag} Fool: a pick with no prediction refused`, /Say which team/.test(ackOf("c0", id) || ""), `reply "${ackOf("c0", id)}"`);
  /* team 0 finds the truth; every other team falls for team 0's lie, team 0 having named team 1 */
  send("c0", "answer", { pick: truth, pred: 1, k: `${pub().qid}|pick` });
  for (let t = 1; t < k; t++) send("c" + t, "answer", { pick: own, ...(saved().fool.opts.some((o) => o.by.includes(t)) ? { pred: 0 } : {}), k: `${pub().qid}|pick` });
  await tick(1500);
  check(`${tag} Fool: every pick in: the reveal`, pub().screen === "reveal" && !!F().rev, pub().screen);
  /* +2 the truth, +1 each team fooled (k-1); team 1 fell for it as team 0 said: -1 to it, +1 more to team 0 (19 Nov) */
  check(`${tag} Fool: the points: +2, +${k - 1} and +1 for the right call to team 0, -1 to team 1 (named), 0 to the rest`, F().rev.pts[0] === 2 + (k - 1) + 1 && F().rev.pts[1] === -1 && F().rev.pts.slice(2).every((p) => p === 0), String(F().rev.pts));
  check(`${tag} Fool: the reveal says whose lie it was and who fell for it`, F().rev.opts[own].by.includes(0) && F().rev.fooled[own].length === k - 1 && F().rev.hits.some((h) => h.by === 0 && h.on === 1));
  check(`${tag} Fool: the tracker counts the fact on the reveal`, pub().game.pts[0] === 2 + (k - 1) + 1, String(pub().game.pts));
  await judge("m/next");
  check(`${tag} Fool: Next: the second fact`, pub().screen === "q" && F().n === 2 && !F().opts, `${pub().screen} ${F()?.n}`);
  /* Change fact, before any lie: another; with one in, another too (the lie cleared) */
  const was = fact().id; await judge("m/swap");
  check(`${tag} Fool: Change fact`, fact().id !== was && pub().screen === "q");
  send("c0", "answer", { text: "Something", k: `${pub().qid}|q` }); await tick(600);
  id = tap(); send("host", "judge", { move: { type: "m/swap" }, step: pub().step, tap: id }); await tick(600);
  /* (a lie in no longer stops it: the new fact clears it, 23 Nov, the owner) */
  check(`${tag} Fool: Change fact with a lie in: a new fact, the lie cleared`, ackOf("host", id) === "+" && !pub().sent[0] && pub().screen === "q", `reply "${ackOf("host", id)}"`);
  /* the host's Reveal now: the answers go up; again: the reveal */
  await judge("m/reveal");
  check(`${tag} Fool: Reveal now on the lies: the answers go up`, pub().screen === "pick", pub().screen);
  await judge("m/pause");
  id = tap(); send("c1", "answer", { pick: 0, pred: 0, k: `${pub().qid}|pick`, tap: id }); await tick(1300);
  check(`${tag} Fool: a pick while paused is kept, still picking`, ackOf("c1", id) === "+" && !!pub().sent[1] && pub().screen === "pick", `reply "${ackOf("c1", id)}"`);
  await judge("m/pause");
  if (phone) {
    /* the game phone gone on the picks; another takes over from the server's copy: the same answers */
    await tick(4500); const ord = JSON.stringify(F().opts);
    await takeover(15000);
    check(`${tag} Fool: taken over on the picks: the same answers, still picking`, pub().screen === "pick" && JSON.stringify(F().opts) === ord, pub().screen);
  }
  await judge("m/reveal");
  check(`${tag} Fool: Reveal now on the picks: the reveal`, pub().screen === "reveal", pub().screen);
  /* the rest, nobody writing or picking: ours fill every place, nobody scores */
  for (let f = 2; f < 6; f++) { await judge("m/next"); await tick((pub().deadline - clock()) + 1300); await tick((pub().deadline - clock()) + 800);
    if (f === 2) check(`${tag} Fool: nobody writes: the answers are the truth and ours`, saved().fool.opts.every((o) => o.truth || o.ours) && saved().fool.opts.length === k + 1 + (k <= 3 ? 1 : 0)); }
  await judge("m/next");
  check(`${tag} Fool: the summary after 6 facts`, pub().screen === "summary", pub().screen);
  const pts = mini().pts, award = pts.map((v) => PLACE_PTS[v > 0 ? pts.filter((x) => x > v).length : pts.length - 1]);
  check(`${tag} Fool: the night's points paid by place (none for 0 or below)`, JSON.stringify(pub().summary.award) === JSON.stringify(award) && saved().teams.every((x, t) => x.score === award[t]), `${pub().summary.award} want ${award}`);
}

/* ---------- Repeat a theme (the owner, 15 Nov): Geography three times, History twice, Music once ---------- */
async function repeat(k, phone, tag) {
  const want = ["Geography", "Geography", "Geography", "History", "History", "Music"];
  await setup(k, phone, ["quiz"], 3, { rounds: 6, themes: want });
  const qs = saved().minis.filter((m) => m.key === "quiz").flatMap((m) => m.qs);
  const rounds = Array.from({ length: qs.length / 2 }, (_, r) => qs.slice(r * 2, r * 2 + 2));
  const got = rounds.map((p) => p[0].theme);
  check(`${tag} Repeat a theme: six rounds, each its theme's two questions`, rounds.length === 6 && rounds.every((p) => p[0].theme === p[1].theme) && [...got].sort().join() === [...want].sort().join(), got.join(", "));
  check(`${tag} Repeat a theme: never the same question twice`, new Set(qs.map((q) => q.id)).size === qs.length);
  check(`${tag} Repeat a theme: never the same theme twice in a row (nor both rounds of one game)`, got.every((t, i) => i === 0 || t !== got[i - 1]), got.join(", "));
}

/* ---------- What Do You See?'s pictures (the owner, 15 Nov: chosen under the game): only the kinds left on ---------- */
async function kinds(k, phone, tag) {
  await setup(k, phone, ["see"], 3, { seeKinds: ["face"] });
  const m = saved().minis.find((x) => x.key === "see"), got = [...new Set((m?.qs || []).map((q) => q.kind))];
  check(`${tag} Pictures: only Celebrities on: every picture is one`, (m?.qs || []).length > 0 && got.join() === "face", got.join(", "));
}

/* ---------- Drop the Pin: time's up (23 Nov, the owner, as with 2 teams) ---------- */
/* one captain locks in, one drops a pin but never locks it in (it counts where it is), the rest
   drop nothing (no pin, no point); no message about it */
async function pin(k, phone, tag) {
  await setup(k, phone, ["pin"], 5); await judge("m/start");
  await tick(8000);
  check(`${tag} Pin: the landmark is up`, pub().screen === "q" && mini()?.key === "pin", pub().screen);
  const q = mini().qs[mini().i], kq = `${pub().qid}|q`;
  send("c0", "answer", { pin: { lat: q.lat + 1, lon: q.lon }, k: kq });
  send("c1", "draft", { k: kq, text: "", pin: { lat: q.lat + 2, lon: q.lon }, seq: 1 });
  await tick(1500);
  await tick((pub().deadline - clock()) + 400);
  await tick(1100);
  const sv = saved();
  check(`${tag} Pin: time up, the reveal`, pub().screen === "reveal", pub().screen);
  check(`${tag} Pin: the pin dropped but not locked in counts`, !!sv.pins?.[1] && Math.abs(sv.pins[1].lat - (q.lat + 2)) < 1e-6, JSON.stringify(sv.pins?.[1]));
  check(`${tag} Pin: the teams that dropped nothing have no pin`, Array.from({ length: k - 2 }, (_, i) => sv.pins?.[i + 2]).every((x) => !x), JSON.stringify(sv.pins));
  check(`${tag} Pin: no message, it just goes in (23 Nov, the owner)`, !/^Time's up/.test(pub().toast?.text || ""), pub().toast?.text);
}

/* ---------- The comeback (17 Nov, the owner) ---------- */
/* the TV, 3-8 teams, with a TV and with the game phone: its questions dealt (not when the Setup switched it off), it
   comes at the middle of a massacre, 15 seconds a question, only the captains in it answer, the host can't be
   skipped past it by a stale tap, all three right moves the team up, and the night carries on */
async function comeback(k, phone, tag) {
  await setup(k, phone, ["flag", "closest", "pin", "airport"], 3, { comeback: false });
  check(`${tag} Comeback: switched off in the Setup, no questions dealt`, !saved().cbQs);
  await setup(k, phone, ["flag", "closest", "pin", "airport"]);
  const qs = saved().cbQs || [], ids = new Set(saved().minis.flatMap((m) => m.qs.map((q) => q.id)));
  check(`${tag} Comeback: three easy questions dealt, none of tonight's`, qs.length === 3 && qs.every((q) => q.difficulty === "easy" && q.type === "standard" && !ids.has(q.id)), qs.map((q) => q.difficulty).join());
  /* two of the four games: nobody answers, the clock runs out on every question */
  for (let g = 0; g < 2; g++) { await judge("m/start");
    for (let guard = 0; guard < 40 && pub().screen !== "summary"; guard++) { if (pub().screen === "q") await judge("m/reveal"); else await judge("m/next"); }
    if (g === 0) await judge("m/next"); }
  /* the middle: the last team far behind everyone */
  const sc = Array.from({ length: k }, (_, t) => (t === k - 1 ? 4 : 40 - t));
  await judge("m/setScores", { scores: sc });
  await judge("m/next");
  const c0 = pub().comeback;
  check(`${tag} Comeback: it comes at the middle, for the team far behind`, pub().screen === "intro" && pub().game?.key === "comeback" && c0?.teams.join() === String(k - 1), `${pub().screen} ${pub().game?.key} ${c0?.teams}`);
  check(`${tag} Comeback: what it can reach: 85% of the leader, behind the team above`, c0?.target[k - 1] === Math.min(34, 40 - (k - 2) - 1), String(c0?.target));
  await judge("m/start");
  check(`${tag} Comeback: 15 seconds on the clock`, pub().screen === "q" && Math.round((pub().deadline - clock()) / 1000) === 15, String((pub().deadline - clock()) / 1000));
  send("c0", "answer", { text: "x", k: pub().qid + "|q" }); await tick(300);
  check(`${tag} Comeback: a captain who isn't in it can't answer`, !saved().typed[0]);
  for (let i = 0; i < 3; i++) {
    const m = mini(); send("c" + (k - 1), "answer", { text: m.qs[m.i].answer, k: pub().qid + "|q" }); await tick(1500);
    if (i === 0) check(`${tag} Comeback: its answer in, the reveal comes (nobody else to wait for)`, pub().screen === "reveal" && pub().reveal?.ok?.[k - 1] === true, pub().screen);
    await judge("m/next");
  }
  const c1 = pub().comeback, want = Math.min(34, 40 - (k - 2) - 1);
  check(`${tag} Comeback: all three right, it moves up, and passes nobody`, pub().screen === "summary" && c1?.made?.[k - 1] === true && pub().teams[k - 1].score === want && pub().teams[k - 2].score > want, `${pub().screen} ${pub().teams.map((t) => t.score)}`);
  await judge("m/next");
  check(`${tag} Comeback: the night carries on with its third game`, pub().screen === "intro" && pub().game?.key === "pin" && pub().game.index === 2 && pub().game.count === 4 && !pub().comeback, `${pub().screen} ${pub().game?.key} ${pub().game?.index}`);
  /* a time-up with nothing sent: out at once, and the result */
  await setup(k, phone, ["flag", "closest", "pin", "airport"]);
  for (let g = 0; g < 2; g++) { await judge("m/start");
    for (let guard = 0; guard < 40 && pub().screen !== "summary"; guard++) { if (pub().screen === "q") await judge("m/reveal"); else await judge("m/next"); }
    if (g === 0) await judge("m/next"); }
  await judge("m/setScores", { scores: sc }); await judge("m/next"); await judge("m/start");
  await tick(16500);   // (15 seconds, then the second's grace)
  check(`${tag} Comeback: 15 seconds and nothing sent: the reveal, by itself`, pub().screen === "reveal" && pub().reveal?.ok?.[k - 1] === false, pub().screen);
  await judge("m/next");
  check(`${tag} Comeback: a miss ends it: no comeback, the score as it was`, pub().screen === "summary" && pub().comeback?.made?.[k - 1] === false && pub().teams[k - 1].score === 4, `${pub().screen} ${pub().teams.map((t) => t.score)}`);
  /* the TV's page reloads on a comeback question, then the game phone dies on its reveal and another takes over from
     the server's copy: the comeback carries on where it was (18 Nov) */
  await setup(k, phone, ["flag", "closest", "pin", "airport"]);
  for (let g = 0; g < 2; g++) { await judge("m/start");
    for (let guard = 0; guard < 40 && pub().screen !== "summary"; guard++) { if (pub().screen === "q") await judge("m/reveal"); else await judge("m/next"); }
    if (g === 0) await judge("m/next"); }
  await judge("m/setScores", { scores: sc }); await judge("m/next"); await judge("m/start");
  { let m = mini(); send("c" + (k - 1), "answer", { text: m.qs[m.i].answer, k: pub().qid + "|q" }); await tick(1500); await judge("m/next");
    await reload();
    check(`${tag} Comeback: a reload on its 2nd question: still on it, the team still in`, pub().screen === "q" && pub().game?.key === "comeback" && mini().i === 1 && !pub().comeback?.out[k - 1], `${pub().screen} ${mini()?.i}`);
    m = mini(); send("c" + (k - 1), "answer", { text: m.qs[m.i].answer, k: pub().qid + "|q" }); await tick(1500);
    /* (the server's copy is the game phone's: with a TV, the TV's page reloads again instead) */
    /* (with a TV: "The TV died?", a new laptop taking over from the server's copy, 19 Nov review) */
    await takeover(4000);
    check(`${tag} Comeback: ${phone ? "the game phone taken over" : "a new laptop taking over (The TV died?)"} on a reveal: still there`, pub().screen === "reveal" && pub().game?.key === "comeback", pub().screen);
    await judge("m/next"); m = mini(); send("c" + (k - 1), "answer", { text: m.qs[m.i].answer, k: pub().qid + "|q" }); await tick(1500); await judge("m/next");
    check(`${tag} Comeback: ...and made, after both`, pub().screen === "summary" && pub().comeback?.made?.[k - 1] === true && pub().teams[k - 1].score === Math.min(34, 40 - (k - 2) - 1), `${pub().screen} ${pub().teams.map((t) => t.score)}`); }
  /* the host's skip, on its intro */
  await setup(k, phone, ["flag", "closest", "pin", "airport"]);
  for (let g = 0; g < 2; g++) { await judge("m/start");
    for (let guard = 0; guard < 40 && pub().screen !== "summary"; guard++) { if (pub().screen === "q") await judge("m/reveal"); else await judge("m/next"); }
    if (g === 0) await judge("m/next"); }
  await judge("m/setScores", { scores: sc }); await judge("m/next"); await judge("m/cbSkip");
  check(`${tag} Comeback: the host skips it: straight to the third game`, pub().screen === "intro" && pub().game?.key === "pin" && pub().teams[k - 1].score === 4, `${pub().screen} ${pub().game?.key}`);
}

/* no internet (19 Nov review): the TV's writes and calls fail in the middle of a question, past the end of its clock.
   The question waits (no reveal nobody could see), the banner says so; back, the clock carries on with what it had
   left, and the question ends when that's up. Then "The TV died?" (a TV) or another phone (none): the server's copy */
async function net(k, phone, tag) {
  for (const game of ["roulette", "fool", "stakes", "see", "flag"]) {
    await setup(k, phone, [game], 21); await judge("m/start"); await tick(game === "roulette" ? 6000 : 2000);
    const s0 = saved(), scr = s0.screen, left = Math.round((s0.deadline - clock()) / 1000);
    fake.net.failWrites = true; await tick((left + 5) * 1000);
    const s1 = saved();
    check(`${tag} No internet, ${game}: the question waits past its clock`, s1.screen === scr && s1.step === s0.step, `${scr} -> ${s1.screen}`);
    fake.net.failWrites = false; await tick(6000);
    const s2 = saved(), left2 = s2.deadline ? (s2.deadline - clock()) / 1000 : null;
    check(`${tag} No internet, ${game}: back, the clock carries on with what it had left`, pub().screen === scr && left2 != null && left2 > left - 8 && left2 <= left + 1, `${pub().screen}, ${left2?.toFixed(1)} s left of ${left}`);
    await tick((left2 ?? 0) * 1000 + 2000);
    check(`${tag} No internet, ${game}: ...and the question ends when that's up`, pub().screen !== scr || pub().step > s0.step, `${pub().screen} step ${pub().step}`);
  }
  await setup(k, phone, ["closest"], 22); await judge("m/start"); await tick(16000);
  check(`${tag} The server's copy of the game is kept${phone ? "" : " with a TV too (The TV died?)"}`, !!backup?.many && backup.s?.screen === "q", backup ? backup.s?.screen : "none");
}

export async function run(only) {
  for (const k of [3, 4, 5, 6, 7, 8]) for (const phone of [false, true]) {   // (every count, 19 Nov review: 4 to 7 never ran through the real referee)
    const tag = `[${k} teams, ${phone ? "no TV" : "TV"}]`;
    for (const [name, f] of [["see", see], ["stakes", stakes], ["majority", majority], ["majorityDuring", majorityDuring], ["roulette", roulette], ["fool", fool], ["comeback", comeback], ["repeat", repeat], ["kinds", kinds], ["pin", pin], ["net", net]]) {
      if (only && only !== name) continue;
      try { await f(k, phone, tag); } catch (e) { check(`${tag} ${name}: ran to the end`, false, String(e?.stack || e).split("\n").slice(0, 3).join(" | ")); }
    }
  }
  await unmount();
  return out;
}
