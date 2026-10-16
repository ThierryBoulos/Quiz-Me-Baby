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
