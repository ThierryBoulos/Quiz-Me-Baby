"use client";
/* THE LIVE LINES (the owner's yes, 16 Nov): a faster copy of what the database already carries.
     "pub:<code>"  the TV (or the phone running a game with no TV) sends each new screen straight to the phones;
     "act:<code>"  the database sends each tap to the TV as it's written (so who sent it is the signed-in phone).
   The database stays the record and the backup: a screen or a tap that the line drops still comes the old way, a
   moment later, and whichever copy lands first is used (the second is nothing). Who may send and hear on a line is
   the database's rule (supabase/migrations/20261116_live_lines.sql).
   THE SWITCH: LIVE_LINES = false and the game is exactly as it was before 16 Nov (database only). To take the
   database side away too: docs/sql/2026-11-16-rollback.sql.
   It also keeps count of how much sooner the line was than the database, for the owner's "is it worth it" (the TV
   writes its count into the room, each phone sends its own once at the end of a game). */
import { useCallback, useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { joinLive, sb } from "./supabase";

export const LIVE_LINES = true;
export const pubLine = (code: string) => "pub:" + code, actLine = (code: string) => "act:" + code;
const OPTS = { config: { private: true, broadcast: { self: false, ack: false } } };

/* ---- the count: for each screen (by its stamp) or tap (by its id), which copy came first and how much sooner ---- */
type Seen = { via: "line" | "db"; t: number; both?: boolean };
function counter() {
  const seen = new Map<string, Seen>(), gaps: number[] = [];
  let line = 0, db = 0;
  return {
    /* true: this is the first copy (use it); false: the second (nothing to do) */
    note(key: string, via: "line" | "db"): boolean {
      const now = performance.now(), x = seen.get(key);
      if (!x) {
        seen.set(key, { via, t: now }); if (via === "line") line++; else db++;
        if (seen.size > 600) { const old = [...seen.keys()].slice(0, 200); old.forEach((k) => seen.delete(k)); }
        return true;
      }
      if (!x.both && x.via !== via) { x.both = true; gaps.push(x.via === "line" ? now - x.t : -(now - x.t)); }
      return false;
    },
    /* n: copies matched; ms: median ms the line was sooner (minus: the database was); first: which came first */
    summary() {
      const s = [...gaps].sort((a, b) => a - b), q = (p: number) => (s.length ? Math.round(s[Math.min(s.length - 1, Math.floor(p * s.length))]) : null);
      return { n: s.length, ms: q(0.5), p10: q(0.1), p90: q(0.9), lineFirst: line, dbFirst: db };
    },
  };
}
export const pubCount = counter(), actCount = counter();

/* the TV: a line to the phones, open while it runs the game; send() is the screen it has just written */
export function usePubLine(code: string, on: boolean) {
  const ch = useRef<RealtimeChannel | null>(null), ready = useRef(false);
  useEffect(() => {
    if (!on || !LIVE_LINES) return;
    const close = joinLive(() => {
      const c = sb().channel(pubLine(code), OPTS); ch.current = c;
      return c.subscribe((st) => { ready.current = st === "SUBSCRIBED"; });
    });
    return () => { ready.current = false; ch.current = null; close(); };
  }, [code, on]);
  return useCallback((pub: unknown, at: number) => {
    if (!ready.current || !ch.current) return;
    void ch.current.send({ type: "broadcast", event: "pub", payload: { pub, at } }).catch(() => { /* the database brings it */ });
  }, []);
}

/* a phone: the screens as the TV sends them (each with its stamp) */
export function hearPubLine(code: string, take: (pub: unknown, at: number) => void): () => void {
  if (!LIVE_LINES) return () => {};
  return joinLive(() => sb().channel(pubLine(code), OPTS)
    .on("broadcast", { event: "pub" }, (m) => { const p = m.payload as { pub?: unknown; at?: number } | undefined; if (p?.pub && typeof p.at === "number") take(p.pub, p.at); })
    .subscribe());
}

/* the TV: the taps as the database writes them */
export function hearActLine(code: string, take: (a: Record<string, unknown>) => void): () => void {
  if (!LIVE_LINES) return () => {};
  return joinLive(() => sb().channel(actLine(code), OPTS)
    .on("broadcast", { event: "action" }, (m) => { const a = m.payload as Record<string, unknown> | undefined; if (a && typeof a.id === "number" && a.kind) take(a); })
    .subscribe());
}
