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

/* who starts the game: the host, or with no host Team A's captain */
export function starter(members: Member[]): Member | null {
  return members.find((m) => m.role === "host") || members.find((m) => m.role === "captain" && m.team === 0) || null;
}
/* the game can start once both teams have a captain — and, until no-host
   Party mode is built (step 3), a host */
export function readyToStart(members: Member[]) {
  return members.some((m) => m.role === "host") && [0, 1].every((t) => members.some((m) => m.team === t && m.role === "captain"));
}
export function notReadyWhy(members: Member[]) {
  if (![0, 1].every((t) => members.some((m) => m.team === t && m.role === "captain"))) return "Each team needs a captain first.";
  if (!members.some((m) => m.role === "host")) return "Party needs a host for now — playing without one comes next.";
  return "";
}
