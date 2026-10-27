#!/usr/bin/env node
/* fetch-pins.mjs — Drop the Pin's photos: our own copies of the Wikimedia Commons files named in Classic's
   PINS catalogue (index.html), resized for the TV (<photo>.jpg) and the phones (<photo>-s.jpg), under names
   that don't say what they show, with CREDITS.md beside them (each licence asks for its credit).
   Usage: node scripts/fetch-pins.mjs [--force]   (run it after adding a landmark; it skips the ones it has)
   Needs the network. Wikimedia asks for an identifying User-Agent and a gentle pace: one file every 3 s. */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const sharp = require("sharp");

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const out = join(root, "party/public/pins");
const force = process.argv.includes("--force");
const src = readFileSync(join(root, "classic.html"), "utf8");
const PINS = Function(`return ${src.match(/const PINS = (\[[\s\S]*?\n\]);/)[1]}`)();
const UA = "QuizMeBabyParty/1.0 (private party quiz app)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(out, { recursive: true });

let got = 0;
for (const [key, name, , , , , photo, , , page] of PINS) {
  const big = join(out, photo + ".jpg"), small = join(out, photo + "-s.jpg");
  if (!force && existsSync(big) && existsSync(small)) continue;
  const file = decodeURIComponent(page.split("/wiki/")[1]).replace(/^File:/, "");
  const url = "https://commons.wikimedia.org/wiki/Special:FilePath/" + encodeURIComponent(file) + "?width=1920";
  let buf = null;
  for (let i = 0; i < 4 && !buf; i++) {
    const r = await fetch(url, { headers: { "User-Agent": UA } });
    if (r.ok) buf = Buffer.from(await r.arrayBuffer());
    else { console.log(`  ${key}: ${r.status}, waiting`); await sleep(10000 * (i + 1)); }
  }
  if (!buf) { console.error(`FAILED ${key} (${name})`); process.exitCode = 1; continue; }
  /* the TV: up to 1600 x 1000; the phones: up to 720 x 540. Both JPEG, metadata stripped */
  await sharp(buf).rotate().resize({ width: 1600, height: 1000, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 80, mozjpeg: true }).toFile(big);
  await sharp(buf).rotate().resize({ width: 720, height: 540, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 74, mozjpeg: true }).toFile(small);
  got++;
  console.log(`  ${key}: ok`);
  await sleep(3000);
}

/* the credits: who took each photo, its licence, and where it came from */
const lines = ["# Drop the Pin: photo credits", "",
  "Every photo here is a copy of a file on Wikimedia Commons, used under the licence named beside it.",
  "The file name is a hash, so it doesn't give away the landmark. Written by `scripts/fetch-pins.mjs`.", "",
  "| File | Landmark | Photo by | Licence | Source |", "|---|---|---|---|---|",
  ...PINS.map(([, name, , , , , photo, credit, licence, page]) => `| ${photo}.jpg | ${name} | ${credit} | ${licence} | ${page} |`), ""];
writeFileSync(join(out, "CREDITS.md"), lines.join("\n"));
console.log(`pins/: ${got} fetched, ${PINS.length} in the catalogue`);
