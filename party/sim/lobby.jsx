/* The lobby in the simulator (11 Nov): the real TVs (lib/tvGame.ts for two teams, lib/many/useTvMany.ts for 3-8)
   with the fake Supabase, checking what the phones send before a night starts:
   - the host's setup is kept on the TV and handed back in the host's secrets (a new host phone finds it);
   - with no host, the captain who starts the game can change the timers (and only the timers), and they're in the room;
   - 3-8 teams: 5 standard rounds are three games (two rounds, two rounds, one), one theme a round, in order; the host's
     picked pair and own question are played; the TV's settings change from the host's phone.
   Run with node sim/lobby.mjs. */
import { advance, flush, resetClock, seedRandom } from "./env.js";
import { act, useEffect, useState } from "react";
import TestRenderer from "react-test-renderer";
import * as fake from "./fakeSupabase.js";
import { useTvGame } from "../lib/tvGame";
import { useTvMany } from "../lib/many/useTvMany";
import { getSettings } from "../lib/settings";
import fullBank from "../data/bank.json";
import accept from "../data/accept.json";
import liteBank from "../public/bank.json";

/* (the lobby passes changes on by window events, which sim/env.js leaves silent: real ones here) */
{ const et = new EventTarget(); globalThis.addEventListener = et.addEventListener.bind(et); globalThis.removeEventListener = et.removeEventListener.bind(et); globalThis.dispatchEvent = et.dispatchEvent.bind(et); }
globalThis.fetch = async (url) => {
  const body = String(url).includes("/api/bank") ? { bank: fullBank, accept } : liteBank;
  return { ok: true, status: 200, json: async () => structuredClone(body) };
};
const CODE = "LOBY";
const read = () => ({ room: structuredClone(fake.db.rooms.find((r) => r.code === CODE) || null), members: structuredClone(fake.db.members.filter((m) => m.room === CODE)) });
function Tv({ many }) {
  const [snap, setSnap] = useState(() => read());
  useEffect(() => fake.onChange((t) => { if (t === "rooms" || t === "members") setSnap(read()); }), []);
  useTvGame(CODE, !many, snap.room, snap.members);
  useTvMany(CODE, !!many, snap.room, snap.members);
  return null;
}
const send = (who, kind, payload) => fake.insert("actions", { room: CODE, user_id: who, kind, payload });
const tick = (ms) => act(async () => { await advance(ms); });
const out = [];
const check = (name, ok, more = "") => out.push(`${ok ? "ok  " : "FAIL"} ${name}${more ? ": " + more : ""}`);

export async function run() {
  /* ---- two teams, no host ---- */
  fake.reset(); resetClock(); localStorage.clear(); seedRandom(5);
  fake.db.rooms.push({ code: CODE, status: "lobby", mode: null, state: { teamNames: ["Lions", "Owls"] } });
  fake.db.secrets.push({ room: CODE, data: null });
  fake.db.members.push({ room: CODE, user_id: "capA", name: "Rami", team: 0, role: "captain", face: null },
    { room: CODE, user_id: "capB", name: "Lea", team: 1, role: "captain", face: null });
  fake.setPresence(["capA", "capB"]);
  let tree;
  await act(async () => { tree = TestRenderer.create(<Tv />); await flush(); });
  await tick(1500);
  check("the TV's timers are in the room", fake.db.rooms[0].state?.timers?.tQuestion === 60, JSON.stringify(fake.db.rooms[0].state?.timers?.tQuestion));
  send("capA", "setup", { timers: { tQuestion: 45, sound: false } });
  send("capB", "setup", { timers: { tSteal: 10 } });
  await tick(1500);
  const s1 = getSettings();
  check("no host: the starting captain changes a timer", s1.tQuestion === 45);
  check("...and only timers", s1.sound === true);
  check("...and only the starting captain", s1.tSteal === 30);
  check("the new timer shows in the room", fake.db.rooms[0].state?.timers?.tQuestion === 45);
  check("the team names are kept", fake.db.rooms[0].state?.teamNames?.[0] === "Lions");
  send("capA", "setup", { start: true, cfg: { standard: true, rounds: 1, difficulty: "easy+medium+hard", themes: ["Music"], minis: [] } });
  await tick(3000);
  const p1 = fake.db.rooms[0].state?.pub;
  check("two teams: a one-round night starts", fake.db.rooms[0].status === "playing" && !!p1, p1?.screen);
  await act(async () => { tree.unmount(); await flush(); });

  /* ---- 3-8 teams, with a host ---- */
  fake.reset(); resetClock(); localStorage.clear(); seedRandom(6);
  fake.db.rooms.push({ code: CODE, status: "lobby", mode: null, state: { teamCount: 4 } });
  fake.db.secrets.push({ room: CODE, data: null });
  fake.db.members.push({ room: CODE, user_id: "host", name: "Nour", team: null, role: "host", face: null });
  for (let t = 0; t < 4; t++) fake.db.members.push({ room: CODE, user_id: "c" + t, name: "Cap" + t, team: t, role: "captain", face: null });
  fake.setPresence(fake.db.members.map((m) => m.user_id));
  await act(async () => { tree = TestRenderer.create(<Tv many />); await flush(); });
  await tick(1500);
  const draft = { at: 123, v: { "many.rounds": 5, picks: { picks: {} } } };
  send("host", "setup", { draft });
  send("host", "setup", { settings: { tFlag: 20 } });
  await tick(1500);
  const lobby = fake.db.secrets[0].data?.lobby;
  check("3-8: the host's setup is kept and handed back", lobby?.draft?.at === 123 && lobby?.draft?.v?.["many.rounds"] === 5);
  check("3-8: the TV's settings reach the host", lobby?.settings?.tFlag === 20);
  const themes = ["Music", "Geography", "History", "Science", "Sports"];
  const music = fullBank.bank.filter((q) => q.type === "standard" && q.theme === "Music" && ["easy", "medium"].includes(q.difficulty)).slice(0, 2).map((q) => q.id);
  const mine = { type: "standard", theme: "Science", question: "What does the host's cat chase most?", answer: "Laser dot", difficulty: "medium", notes: "", id: "qhostcat", src: "manual" };
  send("host", "setup", { start: true, cfg: { minis: ["quiz", "flag"], rounds: 5, quizLevels: ["easy", "medium", "hard"], themes, flagLevels: ["easy"], pinLevels: [], majorityLevels: [], airportLevels: [], mapLevels: [], dishLevels: [],
    picks: { Music: music }, custom: [mine] } });
  await tick(4000);
  const room = fake.db.rooms[0], st = room.state;
  check("3-8: the night starts", room.status === "playing", room.status);
  const items = st?.pub?.intro?.items || [];
  const qItems = items.filter((x) => x.kind === "q");
  check("3-8: 5 rounds are three games", qItems.length === 3, qItems.map((x) => x.title).join(", "));
  check("...named by their rounds", qItems.map((x) => x.title).join(", ") === "Rounds 1 and 2, Rounds 3 and 4, Round 5");
  const got = qItems.map((x) => x.themes || []);
  check("...one theme a round, each theme once", got.map((t) => t.length).join(",") === "2,2,1" && [...got.flat()].sort().join() === [...themes].sort().join(), got.map((t) => t.join("+")).join(", "));
  /* the host's picked pair is played, and their own question is in the TV's bank (kept for next time) */
  const night = JSON.parse(localStorage.getItem("qmb.tv." + CODE + ".many") || "null");
  const quiz = (night?.s?.minis || []).filter((m) => m.key === "quiz").flatMap((m) => m.qs.map((q) => q.id));
  check("3-8: the host's picked Music pair is played", music.every((id) => quiz.includes(id)), quiz.length + " questions");
  check("3-8: the host's own question is kept on the TV", (JSON.parse(localStorage.getItem("qmb.party.custom") || "[]")).some((q) => q.question === mine.question));
  await act(async () => { tree.unmount(); await flush(); });
  return out;
}
