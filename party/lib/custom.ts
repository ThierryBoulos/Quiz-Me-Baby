"use client";
/* YOUR OWN QUESTIONS — Classic's "Add a question" (index.html, ACT.qAdd /
   qSave), kept on this device. They join the bank here (so the setup's themes
   and the host's picker see them), and travel to the TV with "Start the
   game". Up to four custom themes, as in Classic: a custom theme exists as
   long as a question is filed under it. Maps aren't offered: Party draws its
   maps from its own set. */
import type { Q } from "./engine";

export const CUSTOM_KEY = "qmb.party.custom";
export const MAX_CUSTOM_THEMES = 4;
export const MAX_CUSTOM = 300;
export const CUSTOM_TYPES = [["standard", "Standard"], ["closest", "Closest To Wins"], ["auction", "Auction"], ["saysame", "Don't Say the Same as Me"]] as const;
const TYPES: string[] = CUSTOM_TYPES.map(([k]) => k);
const DIFFS = ["easy", "medium", "hard", "expert"];

/* Classic's id, so a question typed in both apps is the same question */
export function hash(str: string) { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0; return "q" + (h >>> 0).toString(36); }

const cut = (x: unknown, n: number) => String(x ?? "").replace(/\s+/g, " ").trim().slice(0, n);
/* One record, cleaned: anything malformed is dropped. The TV runs this on what
   a phone sends, so it must not trust the shape. */
export function cleanOne(x: unknown): Q | null {
  if (!x || typeof x !== "object") return null;
  const r = x as Record<string, unknown>, type = String(r.type);
  if (!TYPES.includes(type)) return null;
  const question = cut(r.question, 300);
  if (!question) return null;
  const q: Q = { id: hash(question), type, question, answer: "", src: "manual" };
  const notes = cut(r.notes, 200); if (notes) q.notes = notes;
  if (type === "standard" || type === "closest") {
    q.theme = cut(r.theme, 24);
    q.difficulty = DIFFS.includes(String(r.difficulty)) ? String(r.difficulty) : "medium";
    if (!q.theme) return null;
  }
  if (type === "standard") { q.answer = cut(r.answer, 120); if (!q.answer) return null; const u = cut(r.use_with, 40); if (u) q.use_with = u; }
  else if (type === "closest") { const n = Number(String(r.answer ?? "").replace(/[,\s]/g, "")); if (!String(r.answer ?? "").trim() || !Number.isFinite(n)) return null; q.answer = String(n); }
  else if (type === "auction") q.answer = "Host counts";
  else if (type === "saysame") {
    const pool = [...new Set((Array.isArray(r.pool) ? r.pool : []).map((p) => cut(p, 40)).filter(Boolean))].slice(0, 40);
    if (pool.length < 2) return null;
    q.pool = pool;
  }
  return q;
}
export function cleanList(x: unknown, builtIn: string[] = []): Q[] {
  const out: Q[] = [], seen = new Set<string>(), themes = new Set<string>();
  for (const r of Array.isArray(x) ? x : []) {
    const q = cleanOne(r);
    if (!q || seen.has(q.id)) continue;
    /* no more than four themes of their own */
    if (q.theme && !builtIn.includes(q.theme) && !themes.has(q.theme)) { if (themes.size >= MAX_CUSTOM_THEMES) continue; themes.add(q.theme); }
    seen.add(q.id); out.push(q);
    if (out.length >= MAX_CUSTOM) break;
  }
  return out;
}

export function getCustom(): Q[] {
  try { return cleanList(JSON.parse(localStorage.getItem(CUSTOM_KEY) || "[]")); } catch { return []; }
}
function save(list: Q[]) {
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event("qmb:custom"));
}
/* the themes made up on this device, from the questions filed under them */
export function customThemes(builtIn: string[], list = getCustom()) {
  return [...new Set(list.map((q) => q.theme).filter((t): t is string => !!t && !builtIn.includes(t)))].sort();
}
/* add one: an error in plain words, or null when it's in */
export function addCustom(raw: Record<string, unknown>, builtIn: string[], bankIds: Set<string>): string | null {
  const q = cleanOne(raw);
  const type = String(raw.type);
  if (!cut(raw.question, 300)) return "The question is required.";
  if (!q) return type === "closest" ? "Closest To Wins needs a number as the answer."
    : type === "saysame" ? "At least two possible answers, one per line."
    : type === "standard" && !cut(raw.answer, 120) ? "The answer is required." : "Pick a theme for this question.";
  const list = getCustom();
  if (list.length >= MAX_CUSTOM) return `${MAX_CUSTOM} questions is the limit on one device.`;
  if (bankIds.has(q.id) || list.some((x) => x.id === q.id)) return "That question is already in the bank.";
  if (q.theme && !builtIn.includes(q.theme) && !customThemes(builtIn, list).includes(q.theme) && customThemes(builtIn, list).length >= MAX_CUSTOM_THEMES)
    return `${MAX_CUSTOM_THEMES} custom themes is the limit. Clear one out to free a slot.`;
  try { save([...list, q]); } catch { return "Not enough room on this device."; }
  return null;
}
export function removeCustom(id: string) { save(getCustom().filter((q) => q.id !== id)); }
