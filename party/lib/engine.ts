/* The shared engine — the very file Classic loads (../engine/core.js), so
   Party plays by the same rules, move for move. */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — plain JavaScript, no types
import core from "../../engine/core.js";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const QMB: any = core;

export type Q = { id: string; type: string; theme?: string; difficulty?: string; question: string; answer: string; notes?: string; use_with?: string; [k: string]: unknown };
export type Bank = { version: string; themes: string[]; bank: Q[] };

let bankP: Promise<Bank> | null = null;
/* Other answers that count, for questions with more than one fair way to say
   it (public/accept.json): by question id, and by answer for flags, dishes,
   maps and Say-the-Same words ("United States" also takes "USA"). */
type Accept = { byId: Record<string, string[]>; byAnswer: Record<string, string[]> };
let accept: Accept = { byId: {}, byAnswer: {} };
export const acceptFor = (q: { id?: string; answer?: string; accept?: string[] } | null | undefined) =>
  !q ? [] : [...(q.accept || []), ...(accept.byId[q.id || ""] || []), ...(accept.byAnswer[q.answer || ""] || [])];
/* the house bank, as shipped */
export function loadBaseBank(): Promise<Bank> {
  if (!bankP) bankP = Promise.all([
    fetch("/bank.json").then((r) => r.json()),
    fetch("/accept.json").then((r) => (r.ok ? r.json() : null)).catch(() => null),
  ]).then(([b, a]) => { if (a) accept = a; return b; });
  return bankP;
}
/* the house bank plus questions of your own (custom themes join the theme list) */
export function withCustom(base: Bank, list: Q[]): Bank {
  if (!list.length) return base;
  const ids = new Set(list.map((q) => q.id));
  const themes = [...base.themes];
  list.forEach((q) => { if (q.theme && !themes.includes(q.theme)) themes.push(q.theme); });
  return { ...base, themes, bank: [...base.bank.filter((q) => !ids.has(q.id)), ...list] };
}
/* the bank on this device: the house bank and whatever was added here */
export async function loadBank(): Promise<Bank> {
  const base = await loadBaseBank();
  if (typeof window === "undefined") return base;
  const { getCustom } = await import("./custom");
  return withCustom(base, getCustom());
}
/* themes that have at least two standard questions at a difficulty */
export function themeCounts(bank: Bank, diff: string) {
  const out: Record<string, number> = {};
  bank.bank.forEach((q) => { if (q.type === "standard" && q.theme && (diff === "mixed" || q.difficulty === diff)) out[q.theme] = (out[q.theme] || 0) + 1; });
  return out;
}
