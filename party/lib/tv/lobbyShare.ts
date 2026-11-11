"use client";
import { useEffect, useRef } from "react";
import { sb } from "../supabase";
import { getSettings } from "../settings";
import { usedCount } from "../settings";
import { getCustom } from "../custom";
import type { Thin } from "../game";

/* In the lobby, the TV's settings and its own questions go to the host's phone (the secrets row: the host's alone,
   as the answers are), so the host can pick the TV's questions and change its settings (Setup, Advanced). Sent again
   whenever any of them changes here; the game's first update replaces it. With them, what's nearly played out, and
   the host's setup as last sent (11 Nov, the owner: a host who drops out or changes phones finds it waiting).
   The same for two teams and for 3-8 (it was the two-team game's alone, so a 3-8 host had no Settings). */
const DKEY = (code: string) => `qmb.party.lobbyDraft.${code}`;
const drafts: Record<string, unknown> = {};
const readDraft = (code: string) => {
  if (code in drafts) return drafts[code];
  try { return (drafts[code] = JSON.parse(localStorage.getItem(DKEY(code)) || "null")); } catch { return null; }
};
/* the host's setup, as their phone sent it (never trusted beyond its size: it only ever goes back to a host) */
export function saveLobbyDraft(code: string, d: unknown) {
  if (!d || typeof d !== "object") return;
  const j = JSON.stringify(d); if (j.length > 24000) return;
  drafts[code] = d;
  try { localStorage.setItem(DKEY(code), j); } catch { /* in memory */ }
  window.dispatchEvent(new Event("qmb:lobbydraft"));
}

type Opts = { thin?: Thin[] | null; lastSecret?: { current: string }; stamp?: () => number };
export function useLobbyShare(code: string, on: boolean, status: string | undefined, opts: Opts = {}) {
  const { thin, lastSecret } = opts;
  const thinRef = useRef(thin), stampRef = useRef(opts.stamp);
  thinRef.current = thin; stampRef.current = opts.stamp;
  useEffect(() => {
    if (!on || status !== "lobby") return;
    let t: ReturnType<typeof setTimeout> | undefined, gone = false;
    const share = () => { clearTimeout(t); t = setTimeout(() => {
      const at = stampRef.current ? stampRef.current() : Date.now();
      if (lastSecret) lastSecret.current = "";       // the game's first answer goes out whatever it is
      void sb().from("secrets").update({ data: { at, lobby: { settings: getSettings(), custom: getCustom(), played: usedCount(), thin: thinRef.current || undefined, draft: readDraft(code) || undefined } } }).eq("room", code)
        .or(`data.is.null,data->>at.is.null,data->>at.lt.${at}`).then(({ error }) => { if (error) console.error("lobby share failed", error); });
    }, 250); };
    /* a phone that has just taken the game over (no TV) has no copy of the host's setup: it keeps the one already shared */
    if (readDraft(code) == null) {
      void sb().from("secrets").select("data").eq("room", code).maybeSingle().then(({ data }) => {
        const d = (data?.data as { lobby?: { draft?: unknown } } | null)?.lobby?.draft;
        if (!gone && d && readDraft(code) == null) { drafts[code] = d; try { localStorage.setItem(DKEY(code), JSON.stringify(d)); } catch { /* in memory */ } }
        if (!gone) share();
      }, () => { if (!gone) share(); });
    } else share();
    window.addEventListener("qmb:thin", share);
    const onStorage = (e: StorageEvent) => { if (!e.key || e.key.startsWith("qmb.party.")) share(); };
    window.addEventListener("qmb:settings", share); window.addEventListener("qmb:custom", share); window.addEventListener("qmb:lobbydraft", share); window.addEventListener("storage", onStorage);
    return () => { gone = true; clearTimeout(t); window.removeEventListener("qmb:thin", share); window.removeEventListener("qmb:settings", share); window.removeEventListener("qmb:custom", share); window.removeEventListener("qmb:lobbydraft", share); window.removeEventListener("storage", onStorage); };
  }, [on, status, code, lastSecret]);
  /* a new thin list goes to the host too */
  useEffect(() => { if (on) window.dispatchEvent(new Event("qmb:thin")); }, [on, thin]);
}
