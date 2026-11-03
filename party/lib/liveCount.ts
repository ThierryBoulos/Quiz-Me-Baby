"use client";
/* The Auction's count, straight from the counting phone to every screen (3 Nov: "takes 0.5 s or 1 s to update on
   the others' phones"). A +1 goes to the game as before (it's the count that counts, and it goes on the record),
   and the same moment the counting phone says its number on the room's live channel; every other phone, and the
   TV, shows that number at once, until the game's own count catches up (or a few seconds pass). One hop instead
   of two: phone to phone, not phone to game to phones. Nothing is stored, and only a number goes. */
import { useEffect, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { sb } from "./supabase";

type Live = { leg: string; n: number; at: number };
const subs = new Set<(l: Live) => void>();
let ch: RealtimeChannel | null = null, room = "", users = 0;

/* the room's live channel, open while a room page or the TV is (one per browser tab) */
export function useLiveRoom(code: string | undefined) {
  useEffect(() => {
    if (!code) return;
    if (room !== code) {
      if (ch) void sb().removeChannel(ch);
      room = code;
      ch = sb().channel("count:" + code, { config: { broadcast: { self: false } } })
        .on("broadcast", { event: "count" }, (m) => { const l = m.payload as Live | undefined; if (l && typeof l.n === "number") subs.forEach((f) => f({ ...l, at: Date.now() })); });
      ch.subscribe();
    }
    users++;
    return () => { if (--users === 0 && ch) { void sb().removeChannel(ch); ch = null; room = ""; } };
  }, [code]);
}

/* the counting phone, on every tap: its number, for this leg */
export function sayCount(leg: string, n: number) {
  if (!ch) return;
  void ch.send({ type: "broadcast", event: "count", payload: { leg, n, at: Date.now() } }).catch(() => { /* the game's count still comes */ });
}

/* what to show for this leg: the counting phone's latest number while it's fresher than the game's, else the game's */
export function useLiveCount(leg: string, official: number) {
  const [live, setLive] = useState<Live | null>(null);
  useEffect(() => { const f = (l: Live) => setLive(l); subs.add(f); return () => { subs.delete(f); }; }, []);
  /* the game has caught up (or moved on to another leg): its count again */
  useEffect(() => { if (live && (live.leg !== leg || live.n === official)) setLive(null); }, [official, leg, live]);
  /* a number that never got confirmed doesn't stay: after 3 s the game's count stands */
  useEffect(() => { if (!live) return; const t = setTimeout(() => setLive(null), 3000); return () => clearTimeout(t); }, [live]);
  return live && live.leg === leg ? live.n : official;
}
