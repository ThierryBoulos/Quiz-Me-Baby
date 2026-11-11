/* The screen check's first step, in a process of its own (the simulated nights put a fake clock and a fake network
   in place, which the browser part mustn't have): play the nights, keep every screen they reach, write them to
   sim/.out/screens/pubs.json. Run by sim/screens/run.mjs. */
import { build } from "esbuild";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
writeFileSync(join(out, "pubs.json"), JSON.stringify(pubs));
process.exit(0);
