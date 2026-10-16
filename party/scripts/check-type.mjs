/* One type scale for the TV and the phones: every size of 32px or less (reading text,
   labels, buttons) is a step on the scale in app/globals.css (--text-*), in the
   classes (text-13), the CSS (var(--text-13)) and inline styles (fontSize: 13).
   Bigger, display sizes are tuned per screen and may sit between the steps.
   Usage: node scripts/check-type.mjs (part of npm test). */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const css = readFileSync(join(root, "app/globals.css"), "utf8");
const steps = new Set([...css.matchAll(/--text-(\d+): (\d+)px;/g)].map((m) => Number(m[2])));
const files = (dir) => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) ? [p] : []; });
const bad = [];
const at = (file, src, i) => `${file.replace(root, "")}:${src.slice(0, i).split("\n").length}`;
const off = (n) => n <= 32 && !steps.has(n);

for (const f of [...files(join(root, "components")), ...files(join(root, "app"))]) {
  if (/opengraph-image/.test(f)) continue;                       // a picture, drawn at 1200x630
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)) bad.push(`${at(f, src, m.index)} ${m[0]}: use a step (text-<n>)`);
  for (const m of src.matchAll(/\btext-(\d+)\b/g)) if (!steps.has(Number(m[1]))) bad.push(`${at(f, src, m.index)} ${m[0]}: not on the scale`);
  /* fontSize: 13, fontSize: tv ? 22 : 13 — the fixed sizes (a size worked out from another, size * 0.42, is free) */
  for (const m of src.matchAll(/fontSize: ([^,}]+)/g)) {
    const e = m[1].trim(), branches = (e.includes("?") ? e.slice(e.lastIndexOf("?") + 1) : e).split(":").map((x) => x.trim());
    for (const b of branches) if (/^\d+(\.\d+)?$/.test(b) && off(Number(b))) bad.push(`${at(f, src, m.index)} fontSize ${b}: not on the scale`);
  }
}
for (const m of css.matchAll(/font-size: ?(\d+(?:\.\d+)?)px/g)) if (off(Number(m[1]))) bad.push(`app/globals.css:${css.slice(0, m.index).split("\n").length} ${m[0]}: not on the scale`);

console.log(`type scale: ${[...steps].sort((a, b) => a - b).join(" ")} — ${bad.length} off it`);
if (bad.length) { console.log(bad.join("\n")); process.exit(1); }
