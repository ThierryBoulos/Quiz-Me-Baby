/* Classic on the same site as Party: before every build, copy the Classic
   app from the repo root into public/classic/, so it's served at /classic.
   One source of truth — index.html at the root — and nothing to keep in
   sync by hand. A <base href="/classic/"> keeps its relative paths
   (engine/core.js, flags/, maps-geo.js, version.json) pointing there. */
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const party = join(dirname(fileURLToPath(import.meta.url)), "..");
const root = join(party, "..");
const out = join(party, "public", "classic");
const FILES = ["maps-geo.js", "maps-night.png", "manifest.webmanifest", "version.json", "icon-180.png", "icon-512.png", "alt-icon-b-180.png", "alt-icon-b-512.png", "host-imad.png"];

if (!existsSync(join(root, "index.html"))) { console.log("copy-classic: no Classic beside Party, skipped"); process.exit(0); }
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, "engine"), { recursive: true });
const html = readFileSync(join(root, "index.html"), "utf8");
writeFileSync(join(out, "index.html"), html.replace(/<head>/i, '<head>\n<base href="/classic/">'));
cpSync(join(root, "engine", "core.js"), join(out, "engine", "core.js"));
cpSync(join(root, "flags"), join(out, "flags"), { recursive: true });
for (const f of FILES) if (existsSync(join(root, f))) cpSync(join(root, f), join(out, f));
console.log("copy-classic: Classic copied to public/classic");
