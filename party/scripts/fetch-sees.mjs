#!/usr/bin/env node
/* fetch-sees.mjs — What Do You See?'s pictures: our own copies of the files named in Classic's SEES catalogue
   (classic.html), framed at 4:3, for the TV (<photo>.jpg) and the phones (<photo>-s.jpg), under names that don't say
   what they show, with CREDITS.md beside them (each licence asks for its credit).
     a face: the crop given (head and shoulders), grown to 4:3 around its centre
     a logo: the symbol (cropped first if the file has a word beside it) on a plain light card
     a close-up: as a face, but bigger (the game zooms right in, so it has to stay sharp): 1920 wide on the TV
   Usage: node scripts/fetch-sees.mjs [--force] [key ...]   (it skips the ones it has; keys: only those)
   Needs the network. Wikimedia asks for an identifying User-Agent and a gentle pace: one file every 3 s. */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const sharp = require("sharp");

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const out = join(root, "party/public/see");
const args = process.argv.slice(2), force = args.includes("--force"), only = args.filter((a) => !a.startsWith("--"));
const src = readFileSync(join(root, "classic.html"), "utf8");
export const SEES = Function(`return ${src.match(/const SEES = (\[[\s\S]*?\n\]);/)[1]}`)();
const UA = "QuizMeBabyParty/1.0 (private party quiz app)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CARD = "#f6f1e7";
/* the sizes: [TV, phone], 4:3 */
const SIZE = { face: [[1280, 960], [640, 480]], logo: [[1280, 960], [640, 480]], close: [[1920, 1440], [960, 720]] };

/* the part of the original to keep, grown to 4:3 around its centre and kept inside the picture (in pixels) */
export function frame43(w, h, crop) {
  const [x0, y0, x1, y1] = crop || [0, 0, 1, 1];
  const cx = ((x0 + x1) / 2) * w, cy = ((y0 + y1) / 2) * h;
  let cw = (x1 - x0) * w, ch = (y1 - y0) * h;
  if (cw / ch > 4 / 3) ch = (cw * 3) / 4; else cw = (ch * 4) / 3;
  if (cw > w) { cw = w; ch = (cw * 3) / 4; }
  if (ch > h) { ch = h; cw = (ch * 4) / 3; }
  const left = Math.round(Math.min(Math.max(cx - cw / 2, 0), w - cw)), top = Math.round(Math.min(Math.max(cy - ch / 2, 0), h - ch));
  return { left, top, width: Math.round(cw), height: Math.round(ch) };
}
/* one picture, finished, at one size */
export async function render(buf, kind, f, [W, H]) {
  const img = sharp(buf, { density: 300 }).rotate();
  const m = await img.metadata();
  let w = m.width, h = m.height;
  if (m.orientation && m.orientation >= 5) [w, h] = [h, w];
  if (f.card) {
    let sym = sharp(buf, { density: 300 }).rotate();
    if (f.crop) { const [x0, y0, x1, y1] = f.crop; sym = sharp(await sym.extract({ left: Math.round(x0 * w), top: Math.round(y0 * h), width: Math.round((x1 - x0) * w), height: Math.round((y1 - y0) * h) }).toBuffer()); }
    const flat = await sym.flatten({ background: CARD }).resize({ width: Math.round(W * 0.62), height: Math.round(H * 0.62), fit: "inside" }).raw().toBuffer({ resolveWithObject: true });
    /* (a logo drawn on a white square: the white becomes the card, so no box shows round it) */
    const px = flat.data, [cr, cg, cb] = [0xf6, 0xf1, 0xe7];
    for (let i = 0; i < px.length; i += flat.info.channels) {
      const lo = Math.min(px[i], px[i + 1], px[i + 2]);
      if (lo >= 224) { const t = Math.min(1, (lo - 224) / 12); px[i] += (cr - px[i]) * t; px[i + 1] += (cg - px[i + 1]) * t; px[i + 2] += (cb - px[i + 2]) * t; }
    }
    const s = await sharp(px, { raw: flat.info }).png().toBuffer();
    return sharp({ create: { width: W, height: H, channels: 3, background: CARD } }).composite([{ input: s, gravity: "center" }]).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  }
  const r = frame43(w, h, f.crop);
  return sharp(buf).rotate().extract(r).resize(W, H, { fit: "fill" }).flatten({ background: "#000" }).jpeg({ quality: kind === "close" ? 84 : 80, mozjpeg: true }).toBuffer();
}
/* the download: the file page names the host (Commons, or English Wikipedia for a logo Commons hasn't got); big
   enough that the part kept is at least the TV's size */
function urlOf(page, kind, f) {
  const host = /en\.wikipedia\.org/.test(page) ? "en.wikipedia.org" : "commons.wikimedia.org";
  const file = decodeURIComponent(page.split("/wiki/")[1]).replace(/^File:/, "");
  const part = f.crop ? Math.max(0.05, f.crop[2] - f.crop[0]) : 1;
  const want = f.card ? 1800 : Math.min(6000, Math.ceil(SIZE[kind][0][0] / part));
  return `https://${host}/wiki/Special:FilePath/${encodeURIComponent(file)}?width=${want}`;
}

async function main() {
  mkdirSync(out, { recursive: true });
  let got = 0;
  for (const [key, , kind, , photo, , , page, f = {}] of SEES) {
    if (only.length && !only.includes(key)) continue;
    const big = join(out, photo + ".jpg"), small = join(out, photo + "-s.jpg");
    if (!force && existsSync(big) && existsSync(small)) continue;
    let buf = null;
    for (let i = 0; i < 4 && !buf; i++) {
      const r = await fetch(urlOf(page, kind, f), { headers: { "User-Agent": UA } });
      if (r.ok) buf = Buffer.from(await r.arrayBuffer());
      else { console.log(`  ${key}: ${r.status}, waiting`); await sleep(10000 * (i + 1)); }
    }
    if (!buf) { console.error(`FAILED ${key}`); process.exitCode = 1; continue; }
    writeFileSync(big, await render(buf, kind, f, SIZE[kind][0]));
    writeFileSync(small, await render(buf, kind, f, SIZE[kind][1]));
    got++;
    console.log(`  ${key}: ok`);
    await sleep(3000);
  }
  /* the credits: who made each picture, its licence, and where it came from */
  const lines = ["# What Do You See?: picture credits", "",
    "Every picture here is a copy of a file on Wikimedia Commons (a few logos: English Wikipedia), used under the licence",
    "named beside it. Quiz Me Baby isn't associated with any brand, celebrity or person shown. To have a picture removed,",
    "write to Thierryboulos@hotmail.com. The file name is a hash, so it doesn't give the answer away. Written by",
    "`scripts/fetch-sees.mjs`.", "",
    "| File | What it is | By | Licence | Source |", "|---|---|---|---|---|",
    ...SEES.map(([, answer, , , photo, credit, licence, page]) => `| ${photo}.jpg | ${answer} | ${String(credit).replace(/\|/g, "/")} | ${licence} | ${page} |`), ""];
  writeFileSync(join(out, "CREDITS.md"), lines.join("\n"));
  console.log(`see/: ${got} fetched, ${SEES.length} in the catalogue`);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
