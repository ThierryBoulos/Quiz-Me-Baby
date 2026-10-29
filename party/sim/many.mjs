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
const decks = { majority: pick("majority", 15, (q) => q.options?.length === 4), flag: pick("flag", 10), closest: pick("closest", 5), pin: pick("pin", 7, (q) => Number.isFinite(q.lat)) };
function rng(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
const T = { flag: 15, closest: 60, pin: 45, majority: 15 };

function night(k, crowd, seed) {
  const r = rng(seed), trace = [];
  const teams = Array.from({ length: k }, (_, t) => ({ name: L.defaultName(t), captain: "Cap" + t }));
  const roster = Array.from({ length: crowd }, (_, i) => ({ name: "P" + i, team: i % k }));
  const s = L.newNight(teams, decks, ["majority", "flag", "closest", "pin"]);
  let now = 0;
  const line = (what) => trace.push(`${what} | ${s.screen} | ${s.teams.map((x) => x.score).join("-")}`);
  for (let guard = 0; guard < 2000 && s.screen !== "final"; guard++) {
    if (s.screen === "intro") { L.startMini(s, now, T, roster); line("start " + L.miniOf(s).key); continue; }
    if (s.screen === "q") {
      const m = L.miniOf(s), q = L.qOf(s);
      if (m.key === "majority") for (const p of s.roster) { if (r() < 0.1) continue; L.vote(s, p.name, r() < 0.5 ? q.answer : q.options[Math.floor(r() * 4)]); }
      else for (let t = 0; t < k; t++) {
        if (r() < 0.1) continue;
        if (m.key === "flag") L.captainAnswer(s, t, { text: r() < 0.5 ? q.answer : "Atlantis" });
        if (m.key === "closest") L.captainAnswer(s, t, { n: String(Math.round(Number(q.answer) * (0.5 + r()))) });
        if (m.key === "pin") L.captainAnswer(s, t, { pin: { lat: q.lat + (r() - 0.5) * 20, lon: q.lon + (r() - 0.5) * 20 } });
      }
      now += 10000; L.reveal(s, () => []);
      line(`reveal ${m.key} ${m.i + 1} won by ${L.legWinners(s).join(",") || "-"}`); continue;
    }
    if (s.screen === "reveal" || s.screen === "summary") { const was = s.screen; L.next(s, now, T); if (was === "summary") line("next game"); else if (s.screen === "summary") line(`summary ${L.miniOf(s).key} award ${L.miniOf(s).award.join(",")}`); continue; }
  }
  trace.push("final " + L.ranking(s).map((x) => `${x.place}:${s.teams[x.team].name}`).join(" "));
  if (L.mrLine(s)) trace.push("majority: " + L.mrLine(s));
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
