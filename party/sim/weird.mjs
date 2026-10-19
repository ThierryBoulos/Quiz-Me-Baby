/* Weird nights: everything that goes wrong at a real party, on purpose. The TV switched off
   (for a minute, for five), reloaded mid-ruling, reloaded while off; a captain's phone gone for
   good; the host's phone dying and coming back; no internet for the TV; pushes arriving twice
   or out of order; both captains tapping at the same instant; answers landing the moment the
   clock runs out. On top of each, chaos taps. Every night must end, with no error on the TV,
   no clock running away, and a receipt for every tap.
     node sim/weird.mjs          all of them
     node sim/weird.mjs 7        one, with its trace (7:2 for its seed 2)
     node sim/weird.mjs --quick  one seed each (npm test) */
import { build } from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const here = dirname(fileURLToPath(import.meta.url)), out = join(here, ".out/weird.mjs");
await build({ entryPoints: [join(here, "night.jsx")], outfile: out, bundle: true, platform: "node", format: "esm", jsx: "automatic", packages: "external", logLevel: "error",
  define: { "process.env.NEXT_PUBLIC_BUILD": '"sim"' },
  plugins: [{ name: "fake-supabase", setup(b) { b.onResolve({ filter: /^(\.{1,2}\/)+(lib\/)?supabase$|^@\/lib\/supabase$/ }, () => ({ path: join(here, "fakeSupabase.js") })); } }] });

const ALL = ["flag", "closest", "dish", "auction", "saysame", "map", "battle"], DEF = ["flag", "closest", "auction", "battle"];
/* the TV switched off at many moments of the night: every 37 s, for 20 s to 5 min */
const offs = (n, len) => Array.from({ length: n }, (_, i) => ({ at: 15 + i * 37, type: "tvOff", for: len[i % len.length] }));
const W = [
  { name: "TV off 20 s, again and again, all through the night", minis: ALL, events: offs(14, [20, 45, 8]) },
  { name: "TV off for 5 minutes, twice", minis: DEF, events: [{ at: 30, type: "tvOff", for: 300 }, { at: 90, type: "tvOff", for: 300 }] },
  { name: "TV reloads 8 times (mid-ruling, mid-lifeline, mid-mini-game)", minis: ALL, events: Array.from({ length: 8 }, (_, i) => ({ at: 12 + i * 23, type: "reload" })) },
  { name: "TV goes off and comes back as a fresh page, 5 times", minis: ALL, events: Array.from({ length: 5 }, (_, i) => ({ at: 20 + i * 40, type: "offReload", for: 15 })) },
  { name: "Team A's captain's phone gone for good (a teammate takes the armband)", minis: DEF, events: [{ at: 25, type: "capGone", team: 0 }] },
  { name: "Team B's captain gone, nobody to take over", minis: DEF, events: [{ at: 25, type: "capGone", team: 1 }] },
  { name: "the host's phone dies for 2 minutes, then comes back", minis: DEF, host: true, events: [{ at: 20, type: "hostGone", for: 120 }] },
  { name: "the host gone for good", minis: ["dish", "saysame", "map"], host: true, events: [{ at: 15, type: "hostGone", for: 100000 }] },
  { name: "no internet for the TV: 30 s, then 90 s", minis: DEF, events: [{ at: 20, type: "writesFail", for: 30 }, { at: 80, type: "writesFail", for: 90 }] },
  { name: "every push sent twice", minis: ALL, net: { dup: 1 } },
  { name: "pushes up to 3 s late, out of order", minis: ALL, net: { delay: 3000, dup: 0.3 } },
  { name: "both captains tap Next, buzz and rule at the same instant", minis: ALL, simul: true },
  { name: "answers land the very moment the clock runs out", minis: DEF, edge: true },
  { name: "everything at once (no host)", minis: ALL, simul: true, net: { delay: 2000, dup: 0.3 }, events: [...offs(5, [25, 60]), { at: 50, type: "reload" }, { at: 140, type: "offReload", for: 20 }, { at: 70, type: "writesFail", for: 20 }] },
  { name: "everything at once (with a host)", minis: ALL, host: true, simul: true, net: { delay: 2000, dup: 0.3 }, events: [...offs(5, [25, 60]), { at: 50, type: "reload" }, { at: 100, type: "hostGone", for: 60 }, { at: 70, type: "writesFail", for: 20 }] },
];

const only = process.argv.slice(2).filter((a) => /^\d+(:\d+)?$/.test(a)).map((a) => Number(a.split(":")[0]));
const seedArg = process.argv.slice(2).map((a) => /^\d+:(\d+)$/.exec(a)?.[1]).find(Boolean);
let bad = 0;
for (let i = 0; i < W.length; i++) {
  if (only.length && !only.includes(i + 1)) continue;
  for (const seed of seedArg ? [Number(seedArg)] : only.length || process.argv.includes("--quick") ? [1] : [1, 2, 3]) {
    const w = W[i], errors = [];
    const err = console.error;
    console.error = (...a) => { const t = a.map(String).join(" "); if (/react-test-renderer is deprecated/.test(t)) return; if (!/publish failed/.test(t) || !w.events?.some((e) => e.type === "writesFail")) errors.push(t.slice(0, 160)); };
    /* a clock never runs away: what's left is never more than the longest timer, nor long past zero while the TV is on */
    const check = (p, now, vis) => {
      /* no internet: the phones can't hear from the TV meanwhile; only what comes after counts */
      if (vis !== "visible" || !p.deadline || offline(now)) return null;
      const left = (p.deadline - now) / 1000;
      if (left > 400) return `${p.screen}: ${Math.round(left)} s left on the clock`;
      if (left < -6 && !p.paused && !p.pending) return `${p.screen}: the clock is ${Math.round(-left)} s past zero and nothing happened`;
      return null;
    };
    const { night } = await import(pathToFileURL(out).href + `?w=${i}-${seed}`);
    let t0 = null;
    const fails = (w.events || []).filter((e) => e.type === "writesFail");
    const offline = (now) => { t0 ??= now; return fails.some((e) => now - t0 >= e.at * 1000 - 2000 && now - t0 <= (e.at + e.for) * 1000 + 8000); };
    const r = await night({ seed: 500 + i * 10 + seed, minis: w.minis, rounds: 4, host: !!w.host, events: structuredClone(w.events || []), net: w.net, simul: w.simul, edge: w.edge, chaos: 0.15, check });
    console.error = err;
    const lost = r.taps.filter((t) => !t.done).length;
    const ok = (r.outcome === "final" || r.outcome === "sudden-cap") && !errors.length && !lost;
    if (!ok) bad++;
    console.log(`${ok ? "ok  " : "FAIL"} ${i + 1}. ${w.name} [seed ${seed}]: ${r.outcome}${r.stuckOn ? " (" + r.stuckOn + ")" : ""}, ${r.score}, ${r.minutes.toFixed(1)} min, ${r.taps.length} taps${lost ? ", " + lost + " without a receipt" : ""}${errors.length ? ", errors: " + [...new Set(errors)].slice(0, 3).join(" | ") : ""}`);
    if (lost) console.log("     taps without a receipt:", JSON.stringify(r.taps.filter((t) => !t.done).slice(0, 3).map((t) => ({ kind: t.kind, screen: t.screen, move: t.payload?.move?.type, at: Math.round(t.at / 1000) % 100000 }))));
    if (only.length) console.log(r.trace.slice(-25).join("\n"));
  }
}
process.exit(bad ? 1 : 0);
