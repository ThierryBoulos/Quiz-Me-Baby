#!/usr/bin/env node
/* check-bank.mjs — lint the question bank (party/data/bank.json, exported from Classic; the full one, answers included) before a push.
   Usage: node scripts/check-bank.mjs [--warnings]       (run by `npm test`)
   Exit code 1 on any ERROR; warnings are counted, and listed with --warnings.
   Checks: schema, difficulty/level values, use_with pair parity per difficulty, ≥2 per theme per
   difficulty, number-word answers without a digit accept, ordering/multi-part answers, flag and
   map assets, dish ingredient lists (giveaway position, duplicates, answer leaking early),
   Say-the-Same pools, closest answers numeric, duplicate answers per theme, matcher false
   positives between flag names, volatile wording, spreadsheet-serial notes, missing apostrophes. */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const showWarnings = process.argv.includes("--warnings");
/* the questions only a host can judge are dealt only with a host (lib/engine.ts): not errors here */
const HOST_ONLY = new Set([...readFileSync(join(root, "party/lib/engine.ts"), "utf8").match(/HOST_ONLY_IDS = new Set\(\[([^\]]*)\]/)[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]));
const QMB = require(join(root, "engine/core.js"));
const bank = JSON.parse(readFileSync(join(root, "party/data/bank.json"), "utf8"));
const accept = existsSync(join(root, "party/data/accept.json")) ? JSON.parse(readFileSync(join(root, "party/data/accept.json"), "utf8")) : { byId: {}, byAnswer: {} };
const flagsDir = join(root, "party/public/flags"), mapsDir = join(root, "party/public/maps"), pinsDir = join(root, "party/public/pins");

const errors = [], warns = [];
const err = (id, msg) => errors.push(`${id}: ${msg}`);
const warn = (id, msg) => warns.push(`${id}: ${msg}`);
const tidy = QMB.tidy;

const DIFF = ["easy", "medium", "hard"], TYPES = ["standard", "closest", "auction", "saysame", "map", "flag", "dish", "pin", "airport", "majority"];
const VOLATILE = /\b(most|latest|current|currently|record|to date|as of|best-selling|most-streamed|most-viewed|most-subscribed|most liked|most-watched|set to host|still)\b/i;
const APOSTROPHE = /\b(Ross|Monica|Chandler|Phoebe|Joey|Rachel|Mickey|Simba|Spider-Man|Batman|YouTube|dog|Arab world)\s+(profession|pet|twin|most famous|job|daughter|twins|official|uncle|real name|parents|view counter)\b/;

/* ---------- schema ---------- */
const ids = new Set();
for (const q of bank.bank) {
  const id = q.id || "(no id)";
  if (!q.id) err(id, "missing id");
  if (ids.has(q.id)) err(id, "duplicate id"); ids.add(q.id);
  if (!TYPES.includes(q.type)) err(id, `unknown type ${q.type}`);
  if (!q.question) err(id, "missing question");
  if (q.type !== "saysame" && !q.answer) err(id, "missing answer");
  if (q.type === "standard" || q.type === "closest") {
    if (!DIFF.includes(q.difficulty)) err(id, `difficulty must be easy|medium|hard, got ${q.difficulty}`);
    if (!q.theme) err(id, "missing theme");
    else if (!bank.themes.includes(q.theme)) err(id, `theme "${q.theme}" not in bank.themes`);
  }
  if (q.type === "closest" && QMB.asNumber(q.answer) == null) err(id, `closest answer is not a number: ${q.answer}`);
  if (q.type === "flag") {
    if (!QMB.FLAG_LEVEL_KEYS.includes(q.level)) err(id, `flag level ${q.level}`);
    if (!existsSync(join(flagsDir, q.flag + ".svg"))) err(id, `flag file missing: ${q.flag}.svg`);
  }
  if (q.type === "map") {
    if (!QMB.MAP_ORDER.includes(q.level)) err(id, `map level ${q.level}`);
    if (!existsSync(join(mapsDir, q.id + ".json"))) err(id, "map json missing");
  }
  if (q.type === "dish") {
    if (!QMB.DISH_LEVEL_KEYS.includes(q.level)) err(id, `dish level ${q.level}`);
    const ings = q.ings || [];
    if (ings.length < 3) warn(id, `only ${ings.length} ingredients: the leg is over before it starts`);
    const names = ings.map((s) => tidy(s.split("—").pop()));
    names.forEach((n, i) => names.slice(0, i).forEach((m, j) => { if (n && n === m) warn(id, `ingredient ${i + 1} repeats ingredient ${j + 1} ("${ings[i]}")`); }));
    /* the answer's key word must not appear before the last ingredient */
    const key = tidy(q.answer).split(" ").filter((w) => w.length > 3);
    ings.slice(0, -1).forEach((s, i) => { const t = tidy(s); key.forEach((w) => { if (t.includes(w)) warn(id, `answer word "${w}" leaks at ingredient ${i + 1} of ${ings.length}`); }); });
  }
  if (q.type === "pin") {
    if (!DIFF.includes(q.level)) err(id, `pin level ${q.level}`);
    if (!(Math.abs(q.lat) <= 85 && Math.abs(q.lon) <= 180)) err(id, `pin coordinates out of range: ${q.lat}, ${q.lon}`);
    if (!q.place) err(id, "pin needs its place (\"city, country\")");
    if (!q.credit || !q.licence || !/^https:\/\/commons\.wikimedia\.org\//.test(q.page || "")) err(id, "pin photo needs its credit, licence and Commons page");
    for (const f of [q.photo + ".jpg", q.photo + "-s.jpg"]) if (!existsSync(join(pinsDir, f))) err(id, `pin photo missing: pins/${f}`);
  }
  if (q.type === "airport") {
    if (!DIFF.includes(q.level)) err(id, `airport level ${q.level}`);
    const rows = q.board || [];
    if (rows.length < 6) err(id, `only ${rows.length} rows on the board`);
    rows.forEach((r, i) => { if (!Array.isArray(r) || r.length !== 5 || !r[0] || !r[2] || !r[3]) err(id, `board row ${i + 1} must be [time, status, destination, flight, gate]`); });
    if (!(q.accept || []).includes(q.code)) warn(id, `the code ${q.code} should be accepted`);
    /* you can't fly to yourself: no destination is the airport's own city, and none reads as the answer */
    rows.forEach((r, i) => { if ([q.answer, q.city, ...(q.accept || [])].some((a) => a.length > 3 && QMB.isMatch(String(r[2]), a))) err(id, `board row ${i + 1} (${r[2]}) gives the answer away`); });
  }
  /* Majority Rules: four different answers, the right one among them, and not a question the standard rounds ask too */
  if (q.type === "majority") {
    if (!DIFF.includes(q.level)) err(id, `majority level ${q.level}`);
    const o = q.options || [];
    if (o.length !== 4 || new Set(o.map(tidy)).size !== 4) err(id, "majority needs four different answers");
    if (!o.includes(q.answer)) err(id, "majority: the right answer isn't one of the four");
    const twin = bank.bank.find((x) => x.type === "standard" && tidy(x.question) === tidy(q.question));
    if (twin) err(id, `majority repeats a standard question: ${twin.question}`);
  }
  if (q.type === "saysame") {
    const pool = q.pool || [];
    if (pool.length < 2) err(id, "saysame pool needs 2+ words");
    const t = pool.map(tidy); if (new Set(t).size !== t.length) err(id, "duplicate words in pool");
    pool.forEach((a) => pool.forEach((b) => { if (a !== b && QMB.isMatch(a, b, accept.byAnswer[b] || [])) warn(id, `pool word "${a}" is accepted as "${b}" by the matcher`); }));
  }
  if (q.type === "standard") {
    if (/→/.test(q.answer) || /^rank /i.test(q.question) || /^name (three|the four|two)/i.test(q.question) || /, and who /.test(q.question)) (HOST_ONLY.has(q.id) ? () => {} : err)(id, "ordering / multi-part answer: the matcher cannot check it (host-only question, or split it)");
    if (/\/(?! )/.test(q.answer) || / \/(?! )/.test(q.answer)) warn(id, `"${q.answer}": alternatives must be separated by " / " (space, slash, space) to be split`);
    if (/Host knows/i.test(q.answer)) warn(id, "host-only answer: unplayable without a host");
    if (/^(what|which|who|where|when|how|in which|name one)/i.test(q.question) && !/[?]$/.test(q.question.trim())) warn(id, "question does not end with ?");
    if (VOLATILE.test(q.question + " " + (q.notes || ""))) warn(id, `volatile fact, re-verify yearly: ${q.question.slice(0, 60)}`);
    if (/^\d{5}(\.\d+)?$/.test((q.notes || "").trim())) err(id, `notes look like a spreadsheet date serial: ${q.notes}`);
  }
  for (const f of ["question", "notes"]) if (APOSTROPHE.test(q[f] || "")) warn(id, `missing possessive apostrophe in ${f}: "${q[f].slice(0, 60)}"`);
  if (/ - /.test(q.question || "")) warn(id, "hyphen used as a dash; use —");
}

/* ---------- pairs per theme and difficulty ---------- */
const std = bank.bank.filter((q) => q.type === "standard");
for (const t of bank.themes) {
  for (const d of DIFF) {
    const n = std.filter((q) => q.theme === t && q.difficulty === d).length;
    if (n < 2) warn(`theme ${t}`, `${d}: only ${n} question(s), cannot fill a round at that difficulty`);
    if (n % 2) warn(`theme ${t}`, `${d}: odd count (${n}), one question can never be dealt at that difficulty`);
  }
  const groups = {};
  std.filter((q) => q.theme === t && (q.use_with || "").trim()).forEach((q) => { const k = q.use_with.trim() + "||" + q.difficulty; (groups[k] = groups[k] || []).push(q.id); });
  for (const [k, v] of Object.entries(groups)) if (v.length % 2) warn(`theme ${t}`, `use_with "${k.split("||")[0]}" at ${k.split("||")[1]} has ${v.length} question(s) (${v.join(", ")}): the odd one falls back to a loose pair`);
}
/* duplicate answers within a theme (the second is a giveaway after the first) */
const seen = {};
for (const q of std) { const k = q.theme + "|" + tidy(q.answer); (seen[k] = seen[k] || []).push(q.id); }
for (const [k, v] of Object.entries(seen)) if (v.length > 1) warn(v.join("+"), `same answer "${k.split("|")[1]}" twice in ${k.split("|")[0]}`);

/* ---------- flags: names the matcher confuses ---------- */
const flags = bank.bank.filter((q) => q.type === "flag");
for (const x of flags) for (const y of flags) if (x !== y && x.answer.replace(/\s*\(.*$/, "") !== y.answer.replace(/\s*\(.*$/, "")) {
  for (const typed of [x.answer, ...(accept.byAnswer[x.answer] || [])]) if (QMB.isMatch(typed, y.answer, accept.byAnswer[y.answer] || [])) warn(`flag ${y.flag}`, `typing "${typed}" (${x.answer}) is accepted for ${y.answer}`);
}
const flagFiles = readdirSync(flagsDir).filter((f) => f.endsWith(".svg")).map((f) => f.slice(0, -4));
const used = new Set(flags.map((q) => q.flag));
flagFiles.filter((f) => !used.has(f)).forEach((f) => warn(`flag ${f}`, "svg present but not in the bank"));

/* ---------- report ---------- */
const counts = {};
bank.bank.forEach((q) => { counts[q.type] = (counts[q.type] || 0) + 1; });
console.log("bank", bank.version, "—", bank.bank.length, "rows", JSON.stringify(counts));
if (showWarnings) warns.forEach((w) => console.log("WARN ", w));
errors.forEach((e) => console.log("ERROR", e));
console.log(`${errors.length} error(s), ${warns.length} warning(s)${showWarnings || !warns.length ? "" : " (npm run check-bank -- --warnings to list them)"}`);
process.exit(errors.length ? 1 : 0);
