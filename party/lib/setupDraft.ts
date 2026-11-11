"use client";
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { sendQuiet } from "./supabase";

/* THE LOBBY SETUP, KEPT (11 Nov, the owner: "make all selections saved if I do any changes to the lobby, including
   advanced settings"). Every choice on the setup screen (rounds, themes, levels, mini-games, the host's picks) lives
   here rather than in the screen itself, so it survives the screen being rebuilt: the team count going from two to
   three and back, a reload, the phone sleeping. Kept on this phone per room (localStorage), and, for the host, also
   on the TV (or the phone running the game), which hands it back to whichever phone is the host next: a host who
   drops out or changes phones finds their setup waiting.
   Fields are named "two.rounds", "many.themes", "picks": the two-team and the 3-8 team setups each have their own,
   and the host's picks are shared by both. */
export type Draft = { at: number; v: Record<string, unknown> };
const KEY = (code: string) => `qmb.setup.${code}`;
const DAYS3 = 3 * 864e5;
const mem: Record<string, Draft> = {};
const subs = new Set<() => void>();
const ping = () => subs.forEach((f) => f());

function load(code: string): Draft {
  if (mem[code]) return mem[code];
  let d: Draft = { at: 0, v: {} };
  try { const raw = JSON.parse(localStorage.getItem(KEY(code)) || "null"); if (raw && typeof raw.v === "object" && raw.v) d = { at: Number(raw.at) || 0, v: raw.v }; } catch { /* none */ }
  return (mem[code] = d);
}
function save(code: string, d: Draft) {
  mem[code] = d;
  try {
    localStorage.setItem(KEY(code), JSON.stringify(d));
    /* rooms last three days: older setups go */
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith("qmb.setup.") || k === KEY(code)) continue;
      try { if (Date.now() - (Number(JSON.parse(localStorage.getItem(k) || "{}").at) || 0) > DAYS3) localStorage.removeItem(k); } catch { localStorage.removeItem(k); }
    }
  } catch { /* in memory only */ }
  ping();
}

/* the host's copy goes to the TV a moment after the last change (a burst of taps is one send) */
const sendTimer: Record<string, ReturnType<typeof setTimeout>> = {};
let hostOf: Record<string, boolean> = {};
function share(code: string) {
  if (!hostOf[code]) return;
  clearTimeout(sendTimer[code]);
  sendTimer[code] = setTimeout(() => { void sendQuiet(code, "setup", { draft: load(code) }).catch(() => { /* kept here; goes with the next change */ }); }, 800);
}

export function setDraftField(code: string, key: string, value: unknown) {
  const d = load(code);
  if (JSON.stringify(d.v[key]) === JSON.stringify(value)) return;
  save(code, { at: Date.now(), v: { ...d.v, [key]: value } });
  share(code);
}
export const readDraft = (code: string) => load(code);

/* this phone is the host's: its changes go to the TV too */
export function useDraftHost(code: string, isHost: boolean) {
  useEffect(() => { hostOf = { ...hostOf, [code]: isHost }; if (isHost && load(code).at) share(code); }, [code, isHost]);
}

/* The TV's copy (handed to the host's phone with the TV's settings): taken when it's newer than this phone's, as
   on a new phone (nothing here yet), or after another phone hosted for a while. */
export function adoptDraft(code: string, remote: unknown) {
  const r = remote as Draft | null | undefined;
  if (!r || typeof r !== "object" || typeof r.v !== "object" || !r.v) return;
  const d = load(code);
  if ((Number(r.at) || 0) > d.at) save(code, { at: Number(r.at) || 0, v: r.v });
}

/* one setup choice, as useState: the stored value, or the default until one is set */
export function useDraft<T>(code: string, key: string, dflt: T): [T, (v: T | ((cur: T) => T)) => void] {
  /* (the default kept from the first render: an inline [..] would be a new value every render) */
  const d0 = useRef(dflt).current;
  const sub = useCallback((f: () => void) => { subs.add(f); return () => { subs.delete(f); }; }, []);
  const raw = useSyncExternalStore(sub, () => load(code).v[key], () => undefined);
  const value = (raw === undefined ? d0 : raw) as T;
  const set = useCallback((v: T | ((cur: T) => T)) => {
    const cur = load(code).v[key], now = (cur === undefined ? d0 : cur) as T;
    setDraftField(code, key, typeof v === "function" ? (v as (c: T) => T)(now) : v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, key]);
  return [value, set];
}
