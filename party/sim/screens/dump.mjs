/* The screen check's first step, in a process of its own (the simulated nights put a fake clock and a fake network
   in place, which the browser part mustn't have): play the nights, keep every screen they reach, write them to
   sim/.out/screens/pubs.json. Run by sim/screens/run.mjs. */
import { build } from "esbuild";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { bundleNight } from "../bundle.mjs";
import { dumpTwo } from "./two.mjs";

const here = dirname(fileURLToPath(import.meta.url)), party = join(here, "../.."), out = join(party, "sim/.out/screens");
mkdirSync(out, { recursive: true });
const nightFile = join(out, "night.mjs"), manyFile = join(out, "many.mjs");
await bundleNight(nightFile);
await build({ entryPoints: [join(here, "many.ts")], outfile: manyFile, bundle: true, platform: "node", format: "esm", logLevel: "error",
  alias: { "@": party }, banner: { js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);" } });
const two = await dumpTwo(async (n) => (await import(pathToFileURL(nightFile).href + "?n=" + n)).night);
const { dumpMany } = await import(pathToFileURL(manyFile).href);
const pubs = { ...two, ...dumpMany(JSON.parse(readFileSync(join(party, "data/bank.json"), "utf8"))) };
/* the flags under their hidden names, as the game hands them out (scripts/hash-flags.mjs, app/api/bank): the nights
   have the country codes ("ca"), which public/fx doesn't have, so no flag was drawn in the pictures (24 Nov) */
const KEY = process.env.QMB_FLAG_KEY || "qmb-fx-2026-wave2";
const fx = (code) => createHash("sha256").update(KEY + ":" + code).digest("hex").slice(0, 16);
for (const rec of Object.values(pubs)) { const p = rec?.pub; if (p && typeof p.flag === "string" && existsSync(join(party, "public/flags", p.flag + ".svg"))) p.flag = fx(p.flag); }
/* 2 teams: the longest names a captain can give (12 letters since 28 Nov, lib/room TEAM_MAX), wide letters, so a screen that only fits short
   names gets flagged (27 Nov, the big test: "This game" ran off a 360-wide phone; 3 to 8 teams have long ones already) */
const LONG = ["⁨Brainy Bunch⁩", "⁨Smarty Pants⁩"];
for (const [k, rec] of Object.entries(pubs)) if (/^(nh|h)\w*\./.test(k) && Array.isArray(rec?.pub?.teams)) rec.pub.teams.forEach((t, i) => { if (t && LONG[i]) t.name = LONG[i]; });
/* THE WORST CASE, every setup by itself (27 Nov, the owner: "all mini-games, the longest night, the longest names, and
   any game added later"): each screen again, its setup's tag + "w" (nhw, hw, m3w...), with the widest names a captain
   can give (12 W's and M's, wider than any real name), the longest night the setup allows (14 question rounds and
   every game: 28 marks) and the bank's longest theme. The game's own name and line are the screen's own, so a game
   added to the nights is in here too. TV and phones (the narrowest and sideways: the widest phone is never harder) */
const bank = JSON.parse(readFileSync(join(party, "data/bank.json"), "utf8"));
const themes = new Set(); (function walk(o) { if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) { if (/theme/i.test(k) && typeof v === "string") themes.add(v); walk(v); } })(bank);
const THEME = [...themes].sort((a, b) => b.length - a.length)[0] || "Mythology & Folklore";
const WIDE = ["⁨WWWWWWWWWWWW⁩", "⁨MMMMMMMMMMMM⁩"], MARKS = 28;
for (const [k, rec] of Object.entries(pubs)) {
  const m = /^([a-z]+\d*)\.(.*)$/.exec(k); if (!m || !rec?.pub || !Array.isArray(rec.pub.teams)) continue;
  const c = JSON.parse(JSON.stringify(rec)), p = c.pub, many = !("r" in p);
  p.teams.forEach((t, i) => { if (t) t.name = WIDE[i % 2]; });
  if (!many) {
    if (typeof p.theme === "string") p.theme = THEME;
    if (Array.isArray(p.pips) && p.pips.length) {
      /* the same moment of the night, on a night of 28: a question round, a game, a round, a game... */
      const at = p.pips.findIndex((x) => x.state === "now"), kind = at >= 0 ? p.pips[at].kind : null, done = p.pips.every((x) => x.state === "done");
      let now = at < 0 ? -1 : Math.round(at / Math.max(1, p.pips.length - 1) * (MARKS - 1)); if (now >= 0 && (now % 2 === 0) !== (kind === "std")) now = Math.min(MARKS - 1, now + 1);
      p.pips = Array.from({ length: MARKS }, (_, i) => ({ kind: i % 2 ? "mini" : "std", state: done || (now >= 0 && i < now) ? "done" : i === now ? "now" : "todo" }));
    }
    if (typeof p.N === "number") { p.r = Math.round(p.r / Math.max(1, p.N - 1) * 13); p.N = 14; }
  } else if (p.game && typeof p.game.count === "number") {
    const g = p.game, keys = Array.from({ length: MARKS }, (_, i) => (i % 2 ? (g.key === "quiz" ? "flag" : g.key) : "quiz"));
    g.index = Math.min(MARKS - 1, Math.round(g.index / Math.max(1, g.count - 1) * (MARKS - 1))); if ((keys[g.index] === "quiz") !== (g.key === "quiz")) g.index = Math.min(MARKS - 1, g.index + 1);
    g.count = MARKS; g.keys = keys;
    if (Array.isArray(g.themes)) g.themes = g.themes.map(() => THEME);
  }
  pubs[m[1] + "w." + m[2]] = c;
}
writeFileSync(join(out, "pubs.json"), JSON.stringify(pubs));
process.exit(0);
