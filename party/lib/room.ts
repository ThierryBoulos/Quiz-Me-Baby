"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { sb } from "./supabase";

export type Role = "player" | "captain" | "host";
export type Member = { room: string; user_id: string; name: string; team: 0 | 1 | null; role: Role; avatar: string | null; joined_at: string };
export type RoomState = { teamNames?: [string, string]; [k: string]: unknown };
export type Room = { code: string; tv_id: string; status: "lobby" | "playing" | "done"; mode: "classic" | "host" | "nohost" | null; state: RoomState; version: number };

export const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const cleanCode = (s: string) => s.toUpperCase().split("").filter((c) => CODE_ALPHABET.includes(c)).join("").slice(0, 4);
export const teamName = (room: Room | null, t: 0 | 1) => room?.state?.teamNames?.[t] || (t === 0 ? "Team A" : "Team B");

/* The room and its line-up, kept live: Supabase pushes every change, and a
   slow poll sits underneath as a safety net (SNAKED does the same) so a
   dropped socket on a phone never leaves the screen frozen. */
export function useRoom(code: string) {
  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [missing, setMissing] = useState(false);
  const alive = useRef(true);

  const pull = useCallback(async () => {
    const [r, m] = await Promise.all([
      sb().from("rooms").select("*").eq("code", code).maybeSingle(),
      sb().from("members").select("*").eq("room", code).order("joined_at"),
    ]);
    if (!alive.current) return;
    if (!r.error) { setRoom(r.data as Room | null); setMissing(!r.data); }
    if (!m.error) setMembers((m.data || []) as Member[]);
  }, [code]);

  useEffect(() => {
    alive.current = true;
    void pull();
    const ch = sb()
      .channel("room:" + code)
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: "code=eq." + code }, () => void pull())
      .on("postgres_changes", { event: "*", schema: "public", table: "members", filter: "room=eq." + code }, () => void pull())
      .subscribe();
    const poll = setInterval(() => void pull(), 3000);
    return () => { alive.current = false; clearInterval(poll); void sb().removeChannel(ch); };
  }, [code, pull]);

  return { room, members, missing, refresh: pull };
}

/* "I'm here": each phone keeps a presence in the room while its page is open,
   so the TV can tell a captain who has gone (phone off, page closed) from one
   who is just slow. Nobody is ever removed for it; a captain who's been gone
   a minute hands the armband to a teammate who's still here. */
export type AwayMeta = { away?: { qid?: string } | null; last?: { qid?: string; ms: number; at: number } | null };
export function usePresence(code: string, me: string | null) {
  const ref = useRef<{ ch: ReturnType<ReturnType<typeof sb>["channel"]> | null; meta: AwayMeta }>({ ch: null, meta: {} });
  useEffect(() => {
    if (!me) return;
    const ch = sb().channel("presence:" + code, { config: { presence: { key: me } } });
    ref.current.ch = ch;
    const track = () => void ch.track({ ...ref.current.meta, at: Date.now() });
    ch.subscribe((status) => { if (status === "SUBSCRIBED") track(); });
    const vis = () => { if (document.visibilityState === "visible") track(); };
    document.addEventListener("visibilitychange", vis);
    return () => { document.removeEventListener("visibilitychange", vis); ref.current.ch = null; void sb().removeChannel(ch); };
  }, [code, me]);
  /* tell the TV something about this phone, straight away (it may be about to sleep) */
  return useCallback((meta: AwayMeta) => { ref.current.meta = meta; void ref.current.ch?.track({ ...meta, at: Date.now() }); }, []);
}

/* Leaving the game screen during a question (another app, another tab, a
   search) is reported to the TV, which flags it for the room and the host.
   Not during Call a Friend for your own team: that one is allowed. */
export function useAwayWatch(report: (m: AwayMeta) => void, live: boolean, qid?: string) {
  const now = useRef({ live, qid });
  now.current = { live, qid };
  useEffect(() => {
    let since = 0, q: string | undefined;
    const vis = () => {
      if (document.visibilityState === "hidden") {
        if (now.current.live && !since) { since = Date.now(); q = now.current.qid; report({ away: { qid: q } }); }
      } else if (since) {
        report({ away: null, last: { qid: q, ms: Date.now() - since, at: Date.now() } }); since = 0;
      }
    };
    document.addEventListener("visibilitychange", vis);
    return () => document.removeEventListener("visibilitychange", vis);
  }, [report]);
}

/* who starts the game: the host, or with no host Team A's captain */
export function starter(members: Member[]): Member | null {
  return members.find((m) => m.role === "host") || members.find((m) => m.role === "captain" && m.team === 0) || null;
}
/* the game can start once both teams have a captain; with no host the app
   checks the answers */
export function readyToStart(members: Member[]) {
  return [0, 1].every((t) => members.some((m) => m.team === t && m.role === "captain"));
}
export function notReadyWhy(members: Member[]) {
  if (![0, 1].every((t) => members.some((m) => m.team === t && m.role === "captain"))) return "Each team needs a captain first.";
  return "";
}
