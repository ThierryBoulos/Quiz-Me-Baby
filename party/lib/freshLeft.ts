"use client";
/* Setup's "no new questions left at this level" note (11 Nov, the owner): the TV knows what it has played, the phones
   don't. So in the lobby the TV puts, for each theme, how many standard questions it hasn't played yet at each level
   (Easy, Medium, Hard, Expert) in the room's state, for the host's or Team A's captain's Setup. Counts only: no
   question, no answer. */
import { useEffect, useRef } from "react";
import { loadBank } from "./engine";
import { USED_KEY } from "./settings";

export type FreshLeft = Record<string, number[]>;
export const LEVELS = ["easy", "medium", "hard", "expert"] as const;

export function freshLeft(bank: { bank: { id: string; type?: string; theme?: string; difficulty?: string }[] }, used: Set<string>): FreshLeft {
  const out: FreshLeft = {};
  for (const q of bank.bank) {
    if (q.type !== "standard" || !q.theme || used.has(q.id)) continue;
    const i = LEVELS.indexOf(q.difficulty as (typeof LEVELS)[number]); if (i < 0) continue;
    (out[q.theme] ||= [0, 0, 0, 0])[i]++;
  }
  return out;
}
const readUsed = () => { try { return new Set<string>(JSON.parse(localStorage.getItem(USED_KEY) || "[]")); } catch { return new Set<string>(); } };

/* the TV (or the phone running a game with no TV), in the lobby: worked out again when the played list changes */
export function useFreshLeftShare(code: string, on: boolean, status: string | undefined, write: (left: FreshLeft) => void) {
  const last = useRef(""), w = useRef(write);
  w.current = write;
  useEffect(() => {
    if (!on || status !== "lobby") return;
    let live = true;
    const check = () => { void loadBank(code).then((b) => {
      if (!live) return;
      const left = freshLeft(b, readUsed()), j = JSON.stringify(left);
      if (j !== last.current) { last.current = j; w.current(left); }
    }).catch(() => { /* no note, then */ }); };
    check();
    const onStorage = (e: StorageEvent) => { if (!e.key || e.key === USED_KEY) check(); };
    window.addEventListener("qmb:settings", check); window.addEventListener("qmb:custom", check); window.addEventListener("storage", onStorage);
    return () => { live = false; window.removeEventListener("qmb:settings", check); window.removeEventListener("qmb:custom", check); window.removeEventListener("storage", onStorage); };
  }, [code, on, status]);
}
