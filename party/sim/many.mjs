/* MANY TEAMS: whole nights of the phase-1 rules (lib/many/logic.ts) with bot captains and a crowd, checked
   against saved traces (sim/golden/many-*.txt), plus a load run: 60 players answering one Majority Rules
   question. Run: node sim/many.mjs (--update to save new traces). The two-team nights are sim/run.mjs. */
import { build } from "esbuild";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

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
const T = { quiz: 60, flag: 15, airport: 30, map: 60, closest: 60, pin: 45, majority: 15, say: 30, dish: 3, dishLast: 8 };
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
      else if (m.key === "dish") { for (let t = 0; t < k && s.screen === "q"; t++) { if (r() < 0.2) continue; L.captainAnswer(s, t, { text: typedFor("dish", q, r) }); if (L.dishRight(s, t)) break; } }
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
