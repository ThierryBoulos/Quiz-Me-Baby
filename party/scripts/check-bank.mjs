#!/usr/bin/env node
/* check-bank.mjs — lint the question bank (party/public/bank.json, exported from Classic) before a push.
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
const bank = JSON.parse(readFileSync(join(root, "party/public/bank.json"), "utf8"));
const accept = existsSync(join(root, "party/public/accept.json")) ? JSON.parse(readFileSync(join(root, "party/public/accept.json"), "utf8")) : { byId: {}, byAnswer: {} };
const flagsDir = join(root, "party/public/flags"), mapsDir = join(root, "party/public/maps");

const errors = [], warns = [];
const err = (id, msg) => errors.push(`${id}: ${msg}`);
const warn = (id, msg) => warns.push(`${id}: ${msg}`);
const tidy = QMB.tidy;

const DIFF = ["easy", "medium", "hard"], TYPES = ["standard", "closest", "auction", "saysame", "map", "flag", "dish"];
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
