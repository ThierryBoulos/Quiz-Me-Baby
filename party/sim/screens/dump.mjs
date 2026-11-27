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
/* 2 teams: the longest names a captain can give (14 letters, app/room), wide letters, so a screen that only fits short
   names gets flagged (27 Nov, the big test: "This game" ran off a 360-wide phone; 3 to 8 teams have long ones already) */
const LONG = ["⁨Wonder Wombats⁩", "⁨Quizzical Owls⁩"];
for (const [k, rec] of Object.entries(pubs)) if (/^(nh|h)\w*\./.test(k) && Array.isArray(rec?.pub?.teams)) rec.pub.teams.forEach((t, i) => { if (t && LONG[i]) t.name = LONG[i]; });
writeFileSync(join(out, "pubs.json"), JSON.stringify(pubs));
process.exit(0);
