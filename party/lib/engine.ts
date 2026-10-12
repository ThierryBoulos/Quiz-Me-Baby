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
export function loadBank(): Promise<Bank> {
  if (!bankP) bankP = fetch("/bank.json").then((r) => r.json());
  return bankP;
}
/* themes that have at least two standard questions at a difficulty */
export function themeCounts(bank: Bank, diff: string) {
  const out: Record<string, number> = {};
  bank.bank.forEach((q) => { if (q.type === "standard" && q.theme && (diff === "mixed" || q.difficulty === diff)) out[q.theme] = (out[q.theme] || 0) + 1; });
  return out;
}
