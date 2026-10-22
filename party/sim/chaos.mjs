/* Chaos nights: captains also tap things at the wrong moment, all night. Every tap must get the TV's
   receipt; an answer or a buzz the TV didn't take must come back with a reason (or the phone is told
   in general terms); and the night must still end. Usage: node sim/chaos.mjs [nights] */
import { build } from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const here = dirname(fileURLToPath(import.meta.url)), out = join(here, ".out/chaos.mjs");
await build({ entryPoints: [join(here, "night.jsx")], outfile: out, bundle: true, platform: "node", format: "esm", jsx: "automatic", packages: "external", logLevel: "error",
  define: { "process.env.NEXT_PUBLIC_BUILD": '"sim"' },
  plugins: [{ name: "fake-supabase", setup(b) { b.onResolve({ filter: /^(\.{1,2}\/)+(lib\/)?supabase$|^@\/lib\/supabase$/ }, () => ({ path: join(here, "fakeSupabase.js") })); } }] });
const N = Number(process.argv[2] || 24);
const ALL = ["flag", "closest", "dish", "auction", "saysame", "map", "battle", "pin", "airport"];
let bad = 0;
const reasons = {}, silent = {};
for (let seed = 100; seed < 100 + N; seed++) {
  const { night } = await import(pathToFileURL(out).href + "?n=" + seed);
  const minis = ALL.filter((_, i) => (seed >> i) & 1 || seed % 3 === 0);
  const r = await night({ seed, minis, rounds: 4 + (seed % 3) * 2, host: process.argv.includes("--host") || seed % 5 === 0, chaos: 0.35, slow: seed % 4 === 0 ? 0.6 : 0 });
  const missing = r.taps.filter((t) => !t.done);
  for (const t of r.taps) if (t.no) reasons[t.no.replace(/⁨|⁩/g, "").replace(/(Lions|Owls|Rami|Lea)/g, "X")] = (reasons[t.no.replace(/⁨|⁩/g, "").replace(/(Lions|Owls|Rami|Lea)/g, "X")] || 0) + 1;
  /* answers / buzzes not taken, with no reason given: where? */
  const TYPE = ["ask", "steal", "miniQ", "flagQ", "mapQ", "sayQ", "dishQ", "battleQ", "sudden", "battleTie"];
  for (const t of r.taps) if (t.done && !t.superseded && !t.no && !t.took && !t.moved && TYPE.includes(t.screen)
    && ((t.kind === "answer" && !t.sent && !t.pend) || (t.kind === "buzz" && t.buzz !== (t.who === "capA" ? 0 : 1)))) silent[`${t.kind} on ${t.screen}`] = (silent[`${t.kind} on ${t.screen}`] || 0) + 1;
  const ends = r.outcome === "final" || r.outcome === "sudden-cap";
  if (!ends || missing.length) bad++;
  console.log(`chaos night ${seed}: ${r.outcome}${r.stuckOn ? " on " + r.stuckOn : ""}, ${r.taps.length} taps, ${missing.length} without a receipt${missing.length ? " (e.g. " + JSON.stringify(missing.slice(0, 2).map((t) => [t.kind, t.screen, t.payload?.move?.type])) + ")" : ""}`);
}
console.log("\nturned down, with the reason the phone shows:"); Object.entries(reasons).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${v}× ${k}`));
console.log("\nanswers/buzzes not taken without a reason (the phone says \"didn't take that\"):"); Object.entries(silent).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${v}× ${k}`));
process.exit(bad ? 1 : 0);
