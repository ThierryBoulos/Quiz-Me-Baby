"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { note, sb } from "./supabase";

export type Role = "player" | "captain" | "host";
export type Member = { room: string; user_id: string; name: string; team: 0 | 1 | null; role: Role; avatar: string | null; joined_at: string };
export type RoomState = { teamNames?: [string, string]; [k: string]: unknown };
export type Room = { code: string; tv_id: string; status: "lobby" | "playing" | "done"; mode: "classic" | "host" | "nohost" | null; state: RoomState; version: number };

export const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const cleanCode = (s: string) => s.toUpperCase().split("").filter((c) => CODE_ALPHABET.includes(c)).join("").slice(0, 4);
/* names always start with a capital ("sanofi" shows as "Sanofi") */
export const cap1 = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
export const teamName = (room: Room | null, t: 0 | 1) => cap1(room?.state?.teamNames?.[t] || (t === 0 ? "Team A" : "Team B"));

/* The room and its line-up, kept live: Supabase pushes every change, and a
   slow poll sits underneath as a safety net (SNAKED does the same) so a
   dropped socket on a phone never leaves the screen frozen. */
export function useRoom(code: string) {
  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [missing, setMissing] = useState(false);
  const alive = useRef(true);

  /* The TV stamps every view it publishes (pub.at); a slower poll answer that
     arrives after a newer push never rolls the screen back. */
  const stamp = (r: Room | null) => ((r?.state as { pub?: { at?: number } } | undefined)?.pub?.at) ?? 0;
  const takeRoom = useCallback((r: Room | null) => setRoom((cur) => (r && cur && stamp(r) < stamp(cur) ? cur : r)), []);
  const pullMembers = useCallback(async () => {
    const m = await sb().from("members").select("*").eq("room", code).order("joined_at");
    if (alive.current && !m.error) setMembers(((m.data || []) as Member[]).map((x) => ({ ...x, name: cap1(x.name) })));
  }, [code]);
  const pull = useCallback(async () => {
    const [r] = await Promise.all([sb().from("rooms").select("*").eq("code", code).maybeSingle(), pullMembers()]);
    if (!alive.current) return;
    if (!r.error) { takeRoom(r.data as Room | null); setMissing(!r.data); }
  }, [code, pullMembers, takeRoom]);

  useEffect(() => {
    alive.current = true;
    void pull();
    const ch = sb()
      .channel("room:" + code)
      /* the push carries the new row: use it straight away (no second trip to the server) */
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: "code=eq." + code }, (e) => {
        const n = e.new as Room | undefined;
        if (n && n.code === code && n.state) { takeRoom(n); setMissing(false); } else void pull();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "members", filter: "room=eq." + code }, () => void pullMembers())
      .subscribe();
    const poll = setInterval(() => void pull(), 3000);
    return () => { alive.current = false; clearInterval(poll); void sb().removeChannel(ch); };
  }, [code, pull]);

  return { room, members, missing, refresh: pull };
}

/* "I'm here": while its page is open and on screen, each phone tells the TV
   every 15 seconds, so the TV can tell a captain who has gone (phone off,
   page closed) from one who is just slow. Nobody is ever removed for it; a
   captain who's been gone a minute hands the armband to a teammate who's
   still here. A fresh page says "hello" (a reload: they're back). */
export type AwayMeta = { away?: { qid?: string } | null; back?: { qid?: string; ms: number } | null };
export function usePresence(code: string, me: string | null) {
  useEffect(() => {
    if (!me) return;
    note(code, { hello: 1 });
    const beat = () => { if (document.visibilityState === "visible") note(code, { here: 1 }); };
    const t = setInterval(beat, 15000);
    document.addEventListener("visibilitychange", beat);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", beat); };
  }, [code, me]);
  return useCallback((m: AwayMeta) => note(code, m as Record<string, unknown>), [code]);
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
        report({ back: { qid: q, ms: Date.now() - since } }); since = 0;
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
