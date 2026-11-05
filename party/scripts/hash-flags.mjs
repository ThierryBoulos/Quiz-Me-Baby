/* The flags under names that say nothing (D5): before each build, every
   public/flags/<code>.svg is copied to public/fx/<name>.svg, where <name> is
   a keyed hash of the code. The TV and the host learn a flag's name from
   /api/bank; a phone only ever sees the name, never "lu" for Luxembourg.
   The same key and hash are in app/api/bank/route.ts: keep them in step. */
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const KEY = process.env.QMB_FLAG_KEY || "qmb-fx-2026-wave2";
const name = (code) => createHash("sha256").update(KEY + ":" + code).digest("hex").slice(0, 16);
const pub = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
rmSync(join(pub, "fx"), { recursive: true, force: true });
mkdirSync(join(pub, "fx"));
let n = 0;
for (const f of readdirSync(join(pub, "flags"))) if (f.endsWith(".svg")) { cpSync(join(pub, "flags", f), join(pub, "fx", name(f.slice(0, -4)) + ".svg")); n++; }
console.log(`hash-flags: ${n} flags in public/fx`);
/* ...and each map's reveal drawing (data/maps-r/<id>.json, from scripts/export-maps.js) under public/maps/r/<name>.json,
   the name keyed the same way ("map:" + id): /api/bank hands it to the TV, which puts it out only at the reveal */
const data = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "maps-r");
rmSync(join(pub, "maps", "r"), { recursive: true, force: true });
mkdirSync(join(pub, "maps", "r"), { recursive: true });
let m = 0;
for (const f of readdirSync(data)) if (f.endsWith(".json")) { cpSync(join(data, f), join(pub, "maps", "r", name("map:" + f.slice(0, -5)) + ".json")); m++; }
console.log(`hash-flags: ${m} map reveals in public/maps/r`);
