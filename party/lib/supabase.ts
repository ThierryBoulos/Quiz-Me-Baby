"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/* The project's public address and publishable key. Both are meant to be in
   the page — row-level security in the database is what protects the
   answers, not secrecy here. Vercel can override them with env vars. */
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ryefabglqhdobqtlmkfx.supabase.co";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY || "sb_publishable_eGQwRBjnVd4yHKf_dBP3vQ_G-Nv79ZD";

let cached: SupabaseClient | null = null;
export function sb(): SupabaseClient {
  if (!cached) cached = createClient(URL, KEY, { auth: { persistSession: true, storageKey: "qmb.party.auth" } });
  return cached;
}

/* Nobody signs up. An anonymous session gives each device its own id — the
   thing every security rule keys on — and it is kept on the device, so
   coming back to the page puts you back in your seat. */
export async function ensureSession(): Promise<string> {
  const { data } = await sb().auth.getSession();
  if (data.session?.user) return data.session.user.id;
  const { data: signed, error } = await sb().auth.signInAnonymously();
  if (error) throw error;
  return signed.user!.id;
}

export async function rpc<T = unknown>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await sb().rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

/* a phone telling the TV something: a buzz, an answer, a team name, "start" */
export async function sendAction(room: string, kind: string, payload: Record<string, unknown> = {}) {
  const { error } = await sb().from("actions").insert({ room, kind, payload });
  if (error) throw new Error(error.message);
  /* sent — the phone now waits for the TV's answer (see useWaiting) */
  /* except quick same-screen taps (+1, undo, marking right/wrong, pause): counting names fast must stay fast */
  const move = (payload.move as { type?: string } | undefined)?.type || "";
  const quick = ["auction/tick", "auction/untick", "ui/flagOk", "ui/mapOk", "ui/sayOk", "ui/pause"].includes(move);
  if (typeof window !== "undefined" && kind !== "suggest" && !quick) window.dispatchEvent(new Event("qmb:sent"));
}
