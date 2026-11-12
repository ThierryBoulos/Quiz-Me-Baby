/* MANY TEAMS: whole nights of the phase-1 rules (lib/many/logic.ts) with bot captains and a crowd, checked
   against saved traces (sim/golden/many-*.txt), plus a load run: 60 players answering one Majority Rules
   question. Run: node sim/many.mjs (--update to save new traces). The two-team nights are sim/run.mjs. */
import { build } from "esbuild";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, ".out/many.mjs");
await build({ entryPoints: [join(here, "../lib/many/logic.ts")], outfile: out, bundle: true, platform: "node", format: "esm", logLevel: "error", alias: { "@": join(here, "..") } });
const L = await import(pathToFileURL(out).href);
const bank = JSON.parse(readFileSync(join(here, "../data/bank.json"), "utf8")).bank;
const update = process.argv.includes("--update");

/* a fixed deal: the first legs' worth of each kind, by id (the dealer's shuffle is the two-team game's business) */
const pick = (type, k, ok = () => true) => bank.filter((q) => q.type === type && ok(q)).sort((a, b) => (a.id < b.id ? -1 : 1)).slice(0, k);
const decks = { majority: pick("majority", 15, (q) => q.options?.length === 4), flag: pick("flag", 10), closest: pick("closest", 5), pin: pick("pin", 7, (q) => Number.isFinite(q.lat)),
  /* phase 2: two question rounds' worth, airports, maps, the wide prompts (the app's word: the first on the list), recipes */
  quiz: pick("standard", 12, (q) => q.theme !== "Know the Host"), airport: pick("airport", 6), map: pick("map", 6),
  say: pick("saysame", 6, (q) => (q.pool || []).length >= 5).map((q) => ({ ...q, answer: q.pool[0] })), dish: pick("dish", 5) };
function rng(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
const T = { quiz: 60, flag: 15, airport: 30, map: 60, closest: 60, pin: 45, majority: 15, say: 30, dish: 3, dishLast: 8, roulette: 60, stakes: 45, stakesPick: 20, see: 20 };
/* a bot's typed answer: right about half the time (a map by its title; a prompt, any word on its list) */
const typedFor = (key, q, r) => key === "say" ? q.pool[Math.floor(r() * Math.min(4, q.pool.length))] : r() < 0.5 ? (key === "map" ? q.question : q.answer) : "Atlantis";

function night(k, crowd, seed, order = ["majority", "flag", "closest", "pin"]) {
  const r = rng(seed), trace = [];
  const teams = Array.from({ length: k }, (_, t) => ({ name: L.defaultName(t), captain: "Cap" + t }));
  const roster = Array.from({ length: crowd }, (_, i) => ({ name: "P" + i, team: i % k }));
  const s = L.newNight(teams, decks, order);
  let now = 0;
  const line = (what) => trace.push(`${what} | ${s.screen} | ${s.teams.map((x) => x.score).join("-")}`);
  for (let guard = 0; guard < 2000 && s.screen !== "final"; guard++) {
    if (s.screen === "intro") { L.startMini(s, now, T, roster); line("start " + L.miniOf(s).key); continue; }
    if (s.screen === "q") {
      const m = L.miniOf(s), q = L.qOf(s);
      if (m.key === "majority") for (const p of s.roster) { if (r() < 0.1) continue; L.vote(s, p.name, r() < 0.5 ? q.answer : q.options[Math.floor(r() * 4)]); }
      /* the Cocktail or Dish: guesses come in one by one; the first right one ends the race */
      else if (m.key === "dish") { for (let t = 0; t < k && s.screen === "q"; t++) { if (r() < 0.2) continue; L.captainAnswer(s, t, { text: typedFor("dish", q, r) }); } }
      else for (let t = 0; t < k; t++) {
        if (r() < 0.1) continue;
        if (L.typedKey(m.key)) L.captainAnswer(s, t, { text: typedFor(m.key, q, r) });
        if (m.key === "closest") L.captainAnswer(s, t, { n: String(Math.round(Number(q.answer) * (0.5 + r()))) });
        if (m.key === "pin") L.captainAnswer(s, t, { pin: { lat: q.lat + (r() - 0.5) * 20, lon: q.lon + (r() - 0.5) * 20 } });
      }
      now += 10000; L.reveal(s);
      line(`reveal ${m.key} ${m.i + 1} won by ${L.legWinners(s).join(",") || "-"}`); continue;
    }
    if (s.screen === "reveal" || s.screen === "summary") { const was = s.screen; L.next(s, now, T); if (was === "summary") line("next game"); else if (s.screen === "summary") line(`summary ${L.miniOf(s).key} award ${L.miniOf(s).award.join(",")}`); continue; }
  }
  if (order.length > 4) trace.push("games: " + s.minis.map((_, i) => L.titleOf(s.minis, i)).join(", "));
  trace.push("final " + L.ranking(s).map((x) => `${x.place}:${s.teams[x.team].name}`).join(" "));
  if (L.mrLine(s)) trace.push("majority: " + L.mrLine(s));
  trace.push("awards: " + L.recapMany(s).map((x) => `${x.t}: ${x.who}`).join(" | "));
  return { s, trace };
}

let bad = 0;
mkdirSync(join(here, "golden"), { recursive: true });
for (const [k, crowd, seed] of [[3, 9, 1], [5, 20, 2], [8, 40, 3]]) {
  const { s, trace } = night(k, crowd, seed), file = join(here, `golden/many-${k}.txt`), text = trace.join("\n") + "\n";
  const ends = s.screen === "final";
  let verdict;
  if (!ends) { verdict = "NEVER ENDED"; bad++; }
  else if (update || !existsSync(file)) { writeFileSync(file, text); verdict = "saved"; }
  else { const want = readFileSync(file, "utf8"); verdict = want === text ? "same as golden" : "DIFFERS"; if (want !== text) bad++; }
  console.log(`many ${k} teams, ${crowd} players: ${s.teams.map((x) => x.score).join("-")} — ${verdict}`);
}
/* 12 Nov: What Do You See? with 3, 6 and 8 teams, with its buzzer (the owner): the first team to buzz stops the clock
   and answers. Right ends the picture and pays as many points as there are teams (a 1st place); wrong, or no answer in
   its 10 seconds, puts that team out, the clock goes on and another team can buzz; every team out, or the clock run
   out: nobody */
{
  decks.see = pick("see", 7);
  for (const [k, seed] of [[3, 5], [6, 6], [8, 7]]) {
    const r = rng(seed), teams = Array.from({ length: k }, (_, t) => ({ name: L.defaultName(t), captain: "Cap" + t }));
    const s = L.newNight(teams, decks, ["see"]), trace = [];
    let now = 0, odd = "";
    L.startMini(s, now, T, []);
    for (let guard = 0; guard < 100 && s.screen !== "final"; guard++) {
      if (s.screen === "q") {
        const q = L.qOf(s), order = [...Array(k).keys()].sort(() => r() - 0.5), late = Array(k).fill(false);
        for (const t of order) {
          if (s.screen !== "q") break;
          if (r() < 0.15) continue;                                   // (this team never buzzes)
          now += 1000 + Math.floor(r() * 2000);
          if (s.deadline && now >= s.deadline) break;                 // (the clock ran out first)
          if (L.captainAnswer(s, t, { text: q.answer }, undefined, now) === true) odd ||= "an answer taken with no buzz";
          /* (any player on the team can buzz: every other team's is a player's, Maya's; else the captain's) */
          if (L.buzzSee(s, t, now, t % 2 ? "Maya" : null) !== true) { odd ||= "a buzz refused"; continue; }
          if (s.buzzBy !== (t % 2 ? "Maya" : "Cap" + t)) odd ||= "who buzzed isn't kept";
          const u = order.find((x) => x !== t && !s.out[x]);
          if (u != null && L.buzzSee(s, u, now) === true) odd ||= "a second buzz taken";
          if (s.deadline != null) odd ||= "the clock ran on during a buzz";
          if (L.pause(s, now)) odd ||= "paused while a team that buzzed was answering";
          /* now and then nothing in the 10 seconds (the TV's tick puts the team out); else an answer, right or wrong */
          if (r() < 0.12) { now += 11000; late[t] = true; L.seeMiss(s, t, now, true); }
          else { now += 2000 + Math.floor(r() * 3000); if (L.captainAnswer(s, t, { text: r() < 0.45 ? q.answer : "Atlantis" }, undefined, now) !== true) odd ||= "the answer of the team that buzzed refused"; }
          if (s.screen === "q") {
            if (!s.out[t] || s.buzz != null) odd ||= "a wrong answer didn't put the team out";
            if (s.deadline == null) odd ||= "the clock didn't go on after a wrong answer";
            if (L.buzzSee(s, t, now) === true) odd ||= "a team out of the picture buzzed again";
          }
        }
        if (s.screen === "q") L.reveal(s);
        const pl = L.legPlaces(s), pts = L.legPoints(s), right = s.teams.map((_, t) => !!s.ok[t]);
        /* one team at most gets a picture: it is 1st, and is paid as many points as there are teams; the rest nothing */
        if (right.filter(Boolean).length > 1) odd ||= "two teams got the same picture";
        const got = right.indexOf(true);
        if (got >= 0 && (pl[got] !== 1 || pts[got] !== k)) odd ||= `picture ${L.miniOf(s).i + 1}: the team that got it isn't 1st on ${k} points`;
        if (s.teams.some((_, t) => !right[t] && pts[t] !== 0)) odd ||= "a wrong answer scored";
        if (s.ms.some((v, t) => (s.typed[t] != null || late[t]) && !(v >= 0 && v <= T.see * 1000))) odd ||= "a buzz's time is off the clock";
        trace.push(`picture ${L.miniOf(s).i + 1}: ${s.teams.map((_, t) => (right[t] ? `#${pl[t]}` : late[t] ? "late" : s.typed[t] != null ? "x" : "-")).join(" ")} | pts ${pts.join(",")}`);
        L.next(s, now, T); continue;
      }
      if (s.screen === "summary") { trace.push(`summary award ${L.miniOf(s).award.join(",")}`); L.next(s, now, T); continue; }
      if (s.screen === "reveal") { L.next(s, now, T); continue; }
    }
    const file = join(here, `golden/many-see-${k}.txt`), text = trace.join("\n") + "\n";
    let verdict;
    if (s.screen !== "final") { verdict = "NEVER ENDED"; bad++; }
    else if (odd) { verdict = "WRONG: " + odd; bad++; }
    else if (update || !existsSync(file)) { writeFileSync(file, text); verdict = "saved"; }
    else { const want = readFileSync(file, "utf8"); verdict = want === text ? "same as golden" : "DIFFERS"; if (want !== text) bad++; }
    console.log(`many ${k} teams, What Do You See? (${L.miniOf(s)?.qs.length ?? s.minis[0]?.qs.length} pictures): ${s.teams.map((x) => x.score).join("-")} — ${verdict}`);
  }
}
/* phase 2: a whole evening, every game and two question rounds spread through it */
{
  const order = L.lineup(2, ["majority", "flag", "airport", "map", "closest", "pin", "say", "dish"]);
  const { s, trace } = night(4, 12, 4, order), file = join(here, "golden/many-all-4.txt"), text = trace.join("\n") + "\n";
  let verdict;
  if (s.screen !== "final") { verdict = "NEVER ENDED"; bad++; }
  else if (update || !existsSync(file)) { writeFileSync(file, text); verdict = "saved"; }
  else { const want = readFileSync(file, "utf8"); verdict = want === text ? "same as golden" : "DIFFERS"; if (want !== text) bad++; }
  console.log(`many 4 teams, every game (${order.length}): ${s.teams.map((x) => x.score).join("-")} — ${verdict}`);
}
/* sudden death: a night that ends level at the top. Only the tied teams answer; nobody right brings another
   question; the fastest right answer wins it (+1) */
{
  const teams = [0, 1, 2].map((t) => ({ name: L.defaultName(t), captain: "Cap" + t }));
  const s = L.newNight(teams, { quiz: decks.quiz.slice(0, 6), sudden: decks.quiz.slice(6, 12) }, ["quiz"]);
  L.startMini(s, 0, T, []);
  while (s.screen !== "summary") { if (s.screen === "q") L.reveal(s); L.next(s, 0, T); }
  s.teams[0].score = 10; s.teams[1].score = 10; s.teams[2].score = 6;
  L.next(s, 0, T);
  const m = L.miniOf(s), intro = s.screen === "intro" && m?.key === "sudden" && m.only.join() === "0,1";
  L.startMini(s, 0, T, []);
  const refused = L.captainAnswer(s, 2, { text: "x" }) !== true;
  L.captainAnswer(s, 0, { text: "Atlantis" }); L.captainAnswer(s, 1, { text: "Atlantis" });
  const allIn = L.allIn(s); L.reveal(s); L.next(s, 0, T);
  const again = s.screen === "q" && L.miniOf(s).i === 1;
  const q = L.qOf(s); L.captainAnswer(s, 0, { text: "Atlantis" }); L.captainAnswer(s, 1, { text: q.answer }); L.reveal(s); L.next(s, 0, T);
  const won = s.screen === "final" && s.teams[1].score === 11 && L.ranking(s)[0].team === 1 && s.log.length === 3;
  const ok = intro && refused && allIn && again && won;
  if (!ok) bad++;
  console.log(`sudden death: tied teams only ${intro}, a third team refused ${refused}, nobody right brings another ${again}, the fastest right wins (+1) ${won} — ${ok ? "ok" : "FAILED"}`);
}
/* 8 Nov: a captain contests a call on the reveal, the host decides (as with two teams): own WRONG or another team's
   RIGHT only, one at a time, each call once; agreed, the call (and the points) move; Next with one open, it stands */
{
  const teams = [0, 1, 2].map((t) => ({ name: L.defaultName(t), captain: "Cap" + t }));
  const s = L.newNight(teams, { quiz: decks.quiz.slice(0, 4) }, ["quiz"]);
  L.startMini(s, 0, T, []);
  let q = L.qOf(s); L.captainAnswer(s, 0, { text: "Atlantis" }); L.captainAnswer(s, 1, { text: q.answer }); L.reveal(s);
  const own = L.contestCall(s, 0, 0) === true, twice = L.contestCall(s, 2, 1) !== true;
  const agreed = L.decideContest(s, true) && s.ok[0] === true && L.legWinners(s).includes(0) && /Call changed/.test(s.toast?.text || "");
  const once = L.contestCall(s, 0, 0) !== true, ownRight = L.contestCall(s, 1, 1) !== true, nothing = L.contestCall(s, 0, 2) !== true;
  const theirs = L.contestCall(s, 2, 1) === true && L.decideContest(s, false) && s.ok[1] === true;
  L.next(s, 0, T);
  q = L.qOf(s); L.captainAnswer(s, 0, { text: q.answer }); L.captainAnswer(s, 1, { text: "Atlantis" }); L.reveal(s);
  const open = L.contestCall(s, 1, 1) === true; L.next(s, 0, T);
  const stands = !s.contest && s.screen === "q";
  const ok = own && twice && agreed && once && ownRight && nothing && theirs && open && stands;
  if (!ok) bad++;
  console.log(`contest: own WRONG ${own}, one at a time ${twice}, agreed moves the call ${agreed}, once each ${once}, not your own RIGHT ${ownRight}, nothing typed ${nothing}, another team's RIGHT kept ${theirs}, Next leaves it standing ${open && stands} — ${ok ? "ok" : "FAILED"}`);
}
/* 8 Nov: the host sets the totals by hand (as with two teams): a number per team, nothing else */
{
  const teams = [0, 1, 2].map((t) => ({ name: L.defaultName(t), captain: "Cap" + t }));
  const s = L.newNight(teams, { quiz: decks.quiz.slice(0, 4) }, ["quiz"]);
  const set = L.setScores(s, [5, 3, 12]) && s.teams.map((x) => x.score).join() === "5,3,12" && /set the scores/.test(s.toast?.text || "");
  const bad1 = !L.setScores(s, [1, 2]) && !L.setScores(s, [1, -2, 3]) && !L.setScores(s, ["x", 2, 3]) && !L.setScores(s, [5, 3, 12]);
  const ok = set && bad1;
  if (!ok) bad++;
  console.log(`scores by hand: set ${set}, a wrong list or no change refused ${bad1} — ${ok ? "ok" : "FAILED"}`);
}
/* 8 Nov: Majority Rules, someone who has left comes off their team's list at the intro (the host), and back again */
{
  const teams = [0, 1, 2].map((t) => ({ name: L.defaultName(t), captain: "Cap" + t }));
  const s = L.newNight(teams, { majority: decks.majority }, ["majority"]);
  const off = L.toggleMrOut(s, "Joe") && (s.mrOut || []).includes("Joe"), back = L.toggleMrOut(s, "Joe") && !(s.mrOut || []).includes("Joe");
  L.toggleMrOut(s, "Joe"); L.startMini(s, 0, T, [{ name: "Ann", team: 0 }]);
  const notNow = !L.toggleMrOut(s, "Ann");
  const ok = off && back && notNow;
  if (!ok) bad++;
  console.log(`Majority Rules list: off ${off}, back ${back}, only before Start ${notNow} — ${ok ? "ok" : "FAILED"}`);
}
/* 8 Nov: Imad with 3-8 teams (Settings on): a line at each game's intro, a mini-game won, a new leader, the final;
   every placeholder filled, nothing only two teams have ("both", a buzzer) */
{
  const store = { "qmb.party.settings": JSON.stringify({ v: 99, imad: true }) };
  globalThis.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  const io = join(here, ".out/imad.mjs");
  await build({ entryPoints: [join(here, "../lib/many/imad.ts")], outfile: io, bundle: true, platform: "node", format: "esm", logLevel: "error", alias: { "@": join(here, "..") } });
  const I = await import(pathToFileURL(io).href);
  const teams = [0, 1, 2, 3].map((t) => ({ name: L.defaultName(t), captain: "Cap" + t }));
  const s = L.newNight(teams, { quiz: decks.quiz.slice(0, 4), flag: decks.flag, closest: decks.closest }, ["quiz", "flag", "closest"]);
  const said = []; let last = 0;
  const look = () => { I.imadMany(s); if (s.imad && s.imad.id !== last) { last = s.imad.id; said.push(s.imad.text); } };
  for (let guard = 0; s.screen !== "final" && guard < 400; guard++) {
    look();
    if (s.screen === "intro") L.startMini(s, 0, T, []);
    else if (s.screen === "q") { const q = L.qOf(s), m = L.miniOf(s); for (let t = 0; t < 4; t++) L.captainAnswer(s, t, m.key === "closest" ? { n: String(Number(q.answer) + t) } : { text: t === guard % 4 ? (m.key === "map" ? q.question : q.answer) : "Atlantis" }); L.reveal(s); }
    else L.next(s, 0, T);
  }
  look();
  const ok = said.length >= 4 && said.every((x) => !/\{\w+\}/.test(x) && !/\bboth\b|buzz/i.test(x));
  if (!ok) bad++;
  console.log(`Imad, 3-8 teams: ${said.length} lines, all filled in and fit for many teams ${ok} — ${ok ? "ok" : "FAILED"}`);
  delete globalThis.localStorage;
}
/* 9 Nov: Russian Roulette, 3 to 8 teams: one barrel (6 chambers, 8 with 7 or 8 teams), every team its own chamber
   each spin and its own question; at least one bullet fires (6 and 8 teams: all three); a chamber pays Medium 2,
   Hard 3, the bullet +5 or -3 (wrong or no answer, whatever the total); at the end the most points takes 10 */
{
  const Q = createRequire(import.meta.url)("../../engine/core.js");
  let ok = true; const seen = {};
  for (const k of [3, 4, 5, 6, 7, 8]) {
    const n = Q.rouletteChambers(k);
    for (let seed = 1; seed <= 12; seed++) {
      const r = rng(seed * 31 + k);
      const D = Q.createDealer({ bank: () => bank, used: () => new Set(), noRepeat: () => true, rng: r });
      const g = D.buildGame({ standard: false, rounds: 0, themes: [], minis: ["roulette"], rouletteChambers: n, teamA: { name: "A" }, teamB: { name: "B" } });
      const laps = [...g.rouletteGame.qs, ...g.rouletteGame.spare];
      if (laps.length < 3 || laps.some((l) => l.ch.length !== n || new Set(l.ch.map((c) => c.theme)).size !== n)) ok = false;
      const teams = Array.from({ length: k }, (_, t) => ({ name: L.defaultName(t), captain: "Cap" + t }));
      const s = L.newNight(teams, { roulette: laps }, ["roulette"]);
      L.startMini(s, 0, T, []);
      let hits = 0;
      for (let guard = 0; s.screen !== "summary" && guard < 10; guard++) {
        const m = L.miniOf(s), lap = L.qOf(s);
        if (!lap.draw || new Set(lap.draw).size !== k || s.spinAt == null) ok = false;
        for (let t = 0; t < k; t++) { const q = lap.ch[lap.draw[t]].q; L.captainAnswer(s, t, { text: r() < 0.5 ? q.answer : "Atlantis" }); }
        const was = [...m.pts]; L.reveal(s);
        /* (each call is on the team's own chamber's question: "Atlantis" never right, the answer as the matcher takes it) */
        for (let t = 0; t < k; t++) if (s.ok[t] !== (s.typed[t] !== "Atlantis" && L.rightOf("quiz", s.typed[t], lap.ch[lap.draw[t]].q))) ok = false;
        const okNow = [...s.ok], hit = lap.draw.indexOf(lap.bullet); if (hit >= 0) hits++;
        L.next(s, 0, T);
        for (let t = 0; t < k; t++) { const j = lap.draw[t], w = j === lap.bullet ? (okNow[t] ? 5 : -3) : okNow[t] ? (lap.ch[j].level === "medium" ? 2 : 3) : 0;
          if (m.pts[t] !== was[t] + w) ok = false; }
      }
      const m = L.miniOf(s), top = Math.max(...m.pts);
      if (hits < 1 || hits > 3 || ((k === 6 || k === 8) && hits !== 3)) ok = false;
      if (top > 0 && m.pts.some((p, t) => p === top && m.award[t] !== 10)) ok = false;
      (seen[k] = seen[k] || []).push(hits);
    }
  }
  if (!ok) bad++;
  console.log(`Russian Roulette, 3-8 teams: own chambers, calls on each team's own question, the bullet (${Object.entries(seen).map(([k, h]) => `${k} teams ${Math.min(...h)}-${Math.max(...h)}`).join(", ")}), the points and the places — ${ok ? "ok" : "FAILED"}`);
}
/* 11 Nov: Secret Stakes, 3 to 8 teams: the night's last game. A bet is fixed at its start (a tenth of the leader's
   total); each round every captain bets (no bet by time-up: Easy on the first theme), answers the question it bet
   on, and wins or loses its bet straight on the night's total (never below 0); no places paid on top; Change
   question deals three new themes; Pause holds the bets' clock */
{
  const Q = createRequire(import.meta.url)("../../engine/core.js");
  let ok = true; const why = [];
  const fail = (w) => { ok = false; if (why.length < 6) why.push(w); };
  for (const k of [3, 5, 8]) for (let seed = 1; seed <= 6; seed++) {
    const r = rng(seed * 97 + k);
    const D = Q.createDealer({ bank: () => bank, used: () => new Set(), noRepeat: () => true, rng: r });
    const g = D.buildGame({ standard: false, rounds: 0, themes: [], minis: ["stakes"], teamA: { name: "A" }, teamB: { name: "B" } });
    const rounds = [...g.stakesGame.rounds, ...g.stakesGame.spare];
    if (rounds.length < 4) fail("deal short");
    const teams = Array.from({ length: k }, (_, t) => ({ name: L.defaultName(t), captain: "Cap" + t }));
    const s = L.newNight(teams, { stakes: rounds }, ["stakes"]);
    s.teams.forEach((x, t) => { x.score = 20 + t * 9; });                   // (the leader on 20 + 9(k-1): 38, 56, 83)
    L.startMini(s, 0, T, []);
    const m = L.miniOf(s), top = Math.max(...s.teams.map((x) => x.score));
    if (m.unit !== Q.stakesUnit(top)) fail(`unit ${m.unit} for ${top}`);
    if (s.screen !== "pick" || s.deadline !== 20000) fail("not on the bets with a 20 s clock");
    /* Change question on the bets: three new themes, the bets cleared */
    const was = m.qs[0].themes.join();
    L.stakesBet(s, 0, 1, "hard", 0, T);
    if (L.swapQ(s, 0, T) !== true || m.qs[0].themes.join() === was || s.picks.some(Boolean)) fail("swap");
    /* Pause: the bets' clock stops, a bet waits */
    L.pause(s, 1000); if (!s.paused || L.stakesBet(s, 0, 0, "easy", 1000, T) === true) fail("pause"); L.pause(s, 2000);
    for (let round = 0; round < 3; round++) {
      const before = s.teams.map((x) => x.score);
      /* every team bets but the last, which lets the clock run out */
      for (let t = 0; t < k - 1; t++) if (L.stakesBet(s, t, Math.floor(r() * 3), ["easy", "medium", "hard", "expert"][Math.floor(r() * 4)], 0, T) !== true) fail("bet refused");
      if (L.stakesBet(s, 0, 0, "expert", 0, T) === true) fail("a second bet taken");
      if (s.screen !== "pick") fail("questions up before every bet");
      L.lockStakes(s, 0, T);
      if (s.screen !== "q" || s.picks[k - 1].level !== "easy" || s.picks[k - 1].k !== 0) fail("no bet: not the safe one");
      for (let t = 0; t < k; t++) { const q = L.skQm(s, t); if (!q || q.difficulty !== s.picks[t].level) fail("a level's question isn't that level");
        L.captainAnswer(s, t, { text: r() < 0.5 ? q.answer : "Atlantis" }); }
      L.reveal(s);
      for (let t = 0; t < k; t++) if (s.ok[t] !== (s.typed[t] !== "Atlantis" && L.rightOf("quiz", s.typed[t], L.skQm(s, t)))) fail("a call on another question");
      const okNow = [...s.ok], picks = s.picks.map((p) => ({ ...p }));
      L.next(s, 0, T);
      for (let t = 0; t < k; t++) { const bet = Q.stakesBet(m.unit, picks[t].level), want = Math.max(0, before[t] + (okNow[t] ? bet : -bet));
        if (s.teams[t].score !== want) fail(`round ${round + 1} team ${t}: ${s.teams[t].score}, not ${want}`); }
      if (round < 2 && s.screen !== "pick") fail("not back on the bets");
    }
    if (s.screen !== "summary") fail("no summary");
    const at = s.teams.map((x) => x.score);
    L.next(s, 0, T);
    if (s.screen !== "final" && L.miniOf(s)?.key !== "sudden") fail("not the end");
    if (s.teams.some((x, t) => x.score !== at[t])) fail("places paid on top");
    if (m.net.some((v, t) => at[t] - (20 + t * 9) !== v)) fail("net");
  }
  /* a total never below 0 */
  { const D = Q.createDealer({ bank: () => bank, used: () => new Set(), noRepeat: () => true, rng: rng(5) });
    const g = D.buildGame({ standard: false, rounds: 0, themes: [], minis: ["stakes"], teamA: { name: "A" }, teamB: { name: "B" } });
    const s = L.newNight([0, 1, 2].map((t) => ({ name: L.defaultName(t), captain: "" })), { stakes: [...g.stakesGame.rounds] }, ["stakes"]);
    s.teams[0].score = 90; s.teams[1].score = 4; s.teams[2].score = 0;
    L.startMini(s, 0, T, []);
    for (let t = 0; t < 3; t++) L.stakesBet(s, t, 0, "expert", 0, T);
    L.reveal(s); L.next(s, 0, T);
    if (s.teams.map((x) => x.score).join() !== "63,0,0") fail("below 0: " + s.teams.map((x) => x.score).join()); }
  if (!ok) bad++;
  console.log(`Secret Stakes, 3-8 teams: the bet from the scoreboard, the bets, the safe bet at time-up, each team's own question, the totals (never below 0), Change question, Pause, no places on top — ${ok ? "ok" : "FAILED: " + why.join("; ")}`);
}
/* the cap: 60 players on one Majority Rules question, every one of them in, in one go */
{
  const k = 8, roster = Array.from({ length: 60 }, (_, i) => ({ name: "P" + i, team: i % k }));
  const s = L.newNight(Array.from({ length: k }, (_, t) => ({ name: L.defaultName(t), captain: "" })), { majority: decks.majority }, ["majority"]);
  L.startMini(s, 0, T, [...roster, { name: "late", team: 0 }, ...Array.from({ length: 5 }, (_, i) => ({ name: "X" + i, team: 1 }))]);
  const t0 = performance.now(); let took = 0;
  for (const p of roster) if (L.vote(s, p.name, L.qOf(s).options[0]) === true) took++;
  const dup = L.vote(s, "P0", L.qOf(s).options[1]);
  const ms = performance.now() - t0, all = L.allIn(s);
  const ok = s.roster.length === 60 && took === 60 && all && dup !== true && ms < 200;
  console.log(`load: ${s.roster.length} on the list (cap 60), ${took} answers taken in ${ms.toFixed(1)} ms, all in: ${all}, a second tap refused: ${dup !== true} — ${ok ? "ok" : "FAILED"}`);
  if (!ok) bad++;
}
process.exit(bad ? 1 : 0);
