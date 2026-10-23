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
   it (data/accept.json, served with the full bank): by question id, and by
   answer for flags, dishes, maps and Say-the-Same words ("United States"
   also takes "USA"). */
type Accept = { byId: Record<string, string[]>; byAnswer: Record<string, string[]>; mapKeys?: Record<string, string[][]> };
let accept: Accept = { byId: {}, byAnswer: {} };
export const acceptFor = (q: { id?: string; answer?: string; accept?: string[] } | null | undefined) =>
  !q ? [] : [...(q.accept || []), ...(accept.byId[q.id || ""] || []), ...(accept.byAnswer[q.answer || ""] || [])];
/* Guess the Map: the idea counts, not the wording. Each map has a few key ideas (data/accept.json,
   mapKeys), each a handful of word stems; an answer has the idea when every stem of one of them is
   among its words, in any order: "they drive on the left" has [driv], "kings and queens" has [king].
   A stem matches the start of a word, with one slip allowed from five letters ("vikinks"); one marked
   "=" must be the whole word ("no" isn't "north"); one marked "!" must not be there at all
   ("nuclear", but not "nuclear energy"). */
export function mapHit(text: string, keys: string[][] | undefined) {
  if (!keys?.length) return false;
  const words = String(QMB.tidy(text)).split(" ").filter(Boolean);
  const has = (stem: string): boolean => {
    if (stem.startsWith("!")) return !has(stem.slice(1));
    const exact = stem.startsWith("="), s = stem.replace(/^=/, "");
    return words.some((w) => exact ? w === s || w === s + "s"
      : w.startsWith(s) || (s.length >= 5 && w.length >= s.length - 1 && QMB.distance(w.slice(0, s.length), s) <= 1));
  };
  return keys.some((k) => k.every(has));
}
export const mapKeysFor = (q: { answer?: string } | null | undefined) => (q ? accept.mapKeys?.[q.answer || ""] : undefined);
/* The house bank any phone may have (public/bank.json): ids, types, themes and
   levels, enough for Setup and Settings. No questions, no answers (D5). */
export function loadBaseBank(): Promise<Bank> {
  if (!bankP) bankP = fetch("/bank.json").then((r) => r.json())
    .catch((e) => { bankP = null; throw e; });      // a failed fetch (Wi-Fi blip) is tried again next time
  return bankP;
}
/* The bank with the answers, for this room's TV or its host only: the server
   checks who's asking (app/api/bank). */
const fullP: Record<string, Promise<Bank>> = {};
export function loadFullBank(room: string): Promise<Bank> {
  if (!fullP[room]) fullP[room] = (async () => {
    const { sb } = await import("./supabase");
    const { data } = await sb().auth.getSession();
    const r = await fetch("/api/bank", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + (data.session?.access_token || "") },
      body: JSON.stringify({ room }) });
    if (!r.ok) throw new Error(r.status === 403 ? "not allowed" : "Could not load the questions (" + r.status + ")");
    const j = (await r.json()) as { bank: Bank; accept: Accept };
    accept = j.accept;
    return j.bank;
  })().catch((e) => { delete fullP[room]; throw e; });
  return fullP[room];
}
/* the house bank plus questions of your own (custom themes join the theme list) */
export function withCustom(base: Bank, list: Q[]): Bank {
  if (!list.length) return base;
  const ids = new Set(list.map((q) => q.id));
  const themes = [...base.themes];
  list.forEach((q) => { if (q.theme && !themes.includes(q.theme)) themes.push(q.theme); });
  return { ...base, themes, bank: [...base.bank.filter((q) => !ids.has(q.id)), ...list] };
}
/* the bank on this device: the house bank and whatever was added here; with a
   room, the full one (the TV, the host) */
export async function loadBank(room?: string): Promise<Bank> {
  const base = room ? await loadFullBank(room) : await loadBaseBank();
  if (typeof window === "undefined") return base;
  const { getCustom } = await import("./custom");
  return withCustom(base, getCustom());
}
/* themes that have at least two standard questions at a difficulty (a mix without Expert counts its
   Expert ones too: they're dealt once the rest of the theme runs out) */
export function themeCounts(bank: Bank, diff: string) {
  const out: Record<string, number> = {}, lv: string[] = QMB.diffsOf(diff);
  const fallback = diff !== "mixed" && lv.length > 1 && !lv.includes("expert");
  bank.bank.forEach((q) => { if (q.type === "standard" && q.theme && (diff === "mixed" || lv.includes(q.difficulty || "") || (fallback && q.difficulty === "expert"))) out[q.theme] = (out[q.theme] || 0) + 1; });
  return out;
}

/* Questions only a person can judge: answers in an order ("Rank these…"), answers in several
   parts, and the host's own trivia. With no host the app would rule every sane answer WRONG, so
   they're only dealt when someone is hosting. */
const HOST_ONLY_IDS = new Set(["qzr4hzp", "q789ar9", "q8p4fti", "q1716tok", "q1po4l94", "qhpf4ri", "q14dop1c", "q1s7n34n", "q12k9xj3"]);
export const HOST_ONLY_THEMES = ["Know the Host"];
export const hostOnly = (q: Q) => HOST_ONLY_IDS.has(q.id) || HOST_ONLY_THEMES.includes(q.theme || "");
export const withoutHostOnly = (b: Bank): Bank => ({ ...b, bank: b.bank.filter((q) => !hostOnly(q)) });
/* A theme made up on a phone or the TV (Settings, "Your questions"): like Know the Host, only in a
   game with a host. Its questions go, and the theme with them; a question of one's own filed under a
   house theme stays. */
export function withoutCustomThemes(b: Bank): Bank {
  const house = new Set(b.bank.filter((q) => q.src !== "manual").map((q) => q.theme).filter(Boolean));
  return { ...b, themes: b.themes.filter((t) => house.has(t)), bank: b.bank.filter((q) => q.src !== "manual" || !q.theme || house.has(q.theme)) };
}
/* everything a game with no host leaves out */
export const forNoHost = (b: Bank): Bank => withoutCustomThemes(withoutHostOnly(b));
/* the host's own trivia: every answer is "Host knows this one", and the host says if it's right */
export const aboutHost = (q: Q) => HOST_ONLY_THEMES.includes(q.theme || "");
