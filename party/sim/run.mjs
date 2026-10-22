/* Plays a set of whole nights in the simulator (sim/night.jsx) and checks each
   one's trace against the one saved in sim/golden. Every night must reach the
   final screen; with the same seed, the same screens must come in the same order
   with the same scores.
     node sim/run.mjs            check every night
     node sim/run.mjs --update   save the traces as the new golden ones (after a change meant to alter play)
     node sim/run.mjs 3          only night 3 (prints its trace) */
import { build } from "esbuild";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, ".out/night.mjs");
await build({
  entryPoints: [join(here, "night.jsx")], outfile: out, bundle: true, platform: "node", format: "esm", jsx: "automatic",
  packages: "external", logLevel: "error", define: { "process.env.NEXT_PUBLIC_BUILD": '"sim"' },
  /* the app's Supabase client becomes the fake one */
  plugins: [{ name: "fake-supabase", setup(b) {
    b.onResolve({ filter: /^(\.{1,2}\/)+(lib\/)?supabase$|^@\/lib\/supabase$/ }, () => ({ path: join(here, "fakeSupabase.js") }));
    /* never the real one, whatever the path */
    b.onResolve({ filter: /^@supabase\// }, (a) => ({ errors: [{ text: `the simulator must not load ${a.path} (from ${a.importer})` }] }));
  } }],
});
/* each night gets fresh modules (the engine and the bank keep things between games, as on a real TV) */
const load = async (n) => (await import(pathToFileURL(out).href + "?night=" + n)).night;

const DEFAULT = ["flag", "closest", "auction", "battle"];
const NIGHTS = [
  { seed: 1, minis: DEFAULT },
  { seed: 2, minis: DEFAULT, again: true },
  { seed: 3, minis: ["dish", "saysame", "map"] },
  { seed: 4, minis: ["flag", "closest", "dish", "auction", "saysame", "map", "battle"], rounds: 4 },
  { seed: 5, minis: [] },
  { seed: 6, minis: DEFAULT, host: true },
  { seed: 7, minis: ["dish", "saysame", "map", "closest"], host: true, rounds: 4 },
  { seed: 8, minis: DEFAULT, rounds: 8 },
  /* slow captains: questions time out, overrule windows close on their own */
  { seed: 9, minis: ["flag", "closest", "dish", "auction", "saysame", "map", "battle"], slow: 0.97 },
  { seed: 10, minis: DEFAULT, host: true, slow: 0.95 },
  /* the TV reloads mid-game, twice over */
  { seed: 11, minis: DEFAULT, reload: 40 },
  { seed: 12, minis: ["dish", "saysame", "map"], host: true, reload: 25 },
  /* the TV's screen sleeps during a question: the answer sent meanwhile counts, a Resume can't start the clock */
  { seed: 13, minis: DEFAULT, sleep: 2 },
  /* 22 Oct: Drop the Pin and Guess the Airport, with and without a host, and with slow captains (pins taken at time-up) */
  { seed: 14, minis: ["pin", "airport", "battle"] },
  { seed: 15, minis: ["closest", "pin", "airport"], host: true, rounds: 4 },
  { seed: 16, minis: ["pin", "airport"], slow: 0.97 },
  /* 23 Oct: Majority Rules: everyone answers; with no host one player never turns up (their captain asks, the other agrees) */
  { seed: 17, minis: ["majority", "battle"], crowd: 5, absent: "Joe" },
  { seed: 18, minis: ["closest", "majority"], host: true, rounds: 4, crowd: 3, absent: "Karim" },
  { seed: 19, minis: ["majority"], crowd: 2, slow: 0.9 },
];

const args = process.argv.slice(2), update = args.includes("--update"), only = args.filter((a) => /^\d+$/.test(a)).map(Number);
const gold = join(here, "golden");
mkdirSync(gold, { recursive: true });
let bad = 0;
for (const n of NIGHTS) {
  if (only.length && !only.includes(n.seed)) continue;
  const t = performance.now();
  /* a clock never sits past zero with nothing happening (while the TV is on) */
  const check = (p, now, vis) => (vis === "visible" && p.deadline && !p.paused && !p.pending && now - p.deadline > 6000 ? `${p.screen}: the clock is ${Math.round((now - p.deadline) / 1000)} s past zero and nothing happened` : null);
  const r = await (await load(n.seed))({ ...n, check });
  const file = join(gold, `night-${n.seed}.txt`), text = r.trace.join("\n") + "\n";
  const label = `night ${n.seed} (${n.host ? "host" : "no host"}, ${n.rounds || 6} rounds, ${n.minis.join(" ") || "no mini-games"})`;
  const ends = r.outcome === "final" || r.outcome === "sudden-cap";
  let verdict;
  if (!ends) { verdict = `NEVER ENDED (${r.outcome}${r.stuckOn ? " on " + r.stuckOn : ""})`; bad++; }
  else if (update || !existsSync(file)) { writeFileSync(file, text); verdict = "saved"; }
  else {
    const want = readFileSync(file, "utf8").split("\n"), got = text.split("\n");
    const i = want.findIndex((l, k) => l !== got[k]);
    if (i === -1 && want.length === got.length) verdict = "same as golden";
    else { verdict = `DIFFERS at line ${i + 1}:\n    golden: ${want[i] ?? "(end)"}\n    now:    ${got[i] ?? "(end)"}`; bad++; }
  }
  console.log(`${label}: ${r.outcome}, ${r.score}, ${r.minutes.toFixed(1)} min played in ${((performance.now() - t) / 1000).toFixed(2)} s, ${r.trace.length} screens, ${r.actions} taps, ${r.writes} writes — ${verdict}`);
  if (only.length) console.log(r.trace.join("\n"), "\nrecap:", JSON.stringify(r.recap));
}
process.exit(bad ? 1 : 0);
