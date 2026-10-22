"use client";
import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import { friendly } from "./errors";

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

/* A live channel has to join with this device's sign-in: the database's rules hide every change
   from an anonymous one, and nothing says so (it looks joined). On a page load the session comes
   out of storage a beat after the page starts, and a join sent meanwhile goes out without it, for
   good (the library only updates channels already joined): GRF2, 18 Oct, the host's phone got no
   live update for 24 minutes after a reload. So: the session first, then the join. Returns the cleanup. */
export function joinLive(make: () => RealtimeChannel): () => void {
  let ch: RealtimeChannel | null = null, off = false;
  void (async () => {
    try { const { data } = await sb().auth.getSession(); if (data.session) await sb().realtime.setAuth(data.session.access_token); }
    catch { /* offline: the reads underneath carry on */ }
    if (!off) ch = make();
  })();
  return () => { off = true; if (ch) void sb().removeChannel(ch); };
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

export const newTap = () => Math.random().toString(36).slice(2, 10);

/* Supabase's free servers sometimes sit on a request for 5 to 28 s (GRF2, 18 Oct: an answer took
   17 s to be saved). So a tap the server hasn't answered in 4 s goes again, and again after 6 more,
   then the last copy is waited for, as before. Every copy carries the tap's tag, and the TV takes
   whichever lands first and only that one (lib/tv/useInbox.ts). A send that fails outright (no
   connection) isn't repeated: the phone says so at once. */
const RESEND_AFTER = [4000, 6000];
async function insistInsert(row: Record<string, unknown>): Promise<{ message: string } | null> {
  for (let i = 0; ; i++) {
    const wait = RESEND_AFTER[i], ac = new AbortController();
    const t = wait ? setTimeout(() => ac.abort(), wait) : undefined;
    let error: { message: string } | null = null;
    try { ({ error } = await sb().from("actions").insert(row).abortSignal(ac.signal)); }
    catch (e) { error = { message: e instanceof Error ? e.message : String(e) }; }
    finally { clearTimeout(t); }
    if (!error || !ac.signal.aborted) return error;
  }
}

/* a phone telling the TV something: a buzz, an answer, a team name, "start" */
export async function sendAction(room: string, kind: string, payload: Record<string, unknown> = {}): Promise<string> {
  /* a tag the TV hands back once it has dealt with this tap (pub.ack), taken or not */
  const tap = typeof payload.tap === "string" ? payload.tap : newTap();
  payload = { ...payload, tap };
  /* about to go: the room page notes the TV's latest update now, as the TV's reply can land before the send returns */
  if (typeof window !== "undefined" && kind !== "suggest") window.dispatchEvent(new Event("qmb:sending"));
  /* (a suggestion isn't sent twice: the captain's list would show it twice, and it's never in a hurry) */
  const error = kind === "suggest"
    ? await sb().from("actions").insert({ room, kind, payload }).then((r) => r.error, (e) => ({ message: e instanceof Error ? e.message : String(e) }))
    : await insistInsert({ room, kind, payload });
  if (error) {
    /* never silent: the phone says the tap didn't go (see the room page) */
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("qmb:failed", { detail: friendly(error.message) }));
    throw Object.assign(new Error(error.message), { announced: true });
  }
  /* sent — the phone now waits for the TV's answer (see useWaiting) */
  /* except quick same-screen taps (+1, undo, marking right/wrong, pause): counting names fast must stay fast */
  const move = (payload.move as { type?: string } | undefined)?.type || "";
  const quick = ["auction/tick", "auction/untick", "ui/flagOk", "ui/mapOk", "ui/sayOk", "ui/airportOk", "ui/pause"].includes(move);
  if (typeof window !== "undefined" && kind !== "suggest" && !quick) window.dispatchEvent(new Event("qmb:sent"));
  return tap;
}

/* What a captain has typed so far, sent quietly (no waiting bar, no receipt): if the clock runs out
   before they press Send, the TV takes the last of these as their answer. Numbered, so one the
   server held back that lands after a newer one doesn't replace it. */
let draftN = 0;
export function sendDraft(room: string, payload: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  draftN = Math.max(draftN + 1, Date.now());
  void insistInsert({ room, kind: "draft", payload: { ...payload, seq: draftN } }).catch(() => {});
}

/* "I'm here" / "I left the screen" / "I'm back": small notes from a phone to
   the TV, sent through the same log as every other action (the TV reads it
   every 1.5 s, so none get lost), quietly (no waiting bar), and with
   keepalive so the note still goes out when the phone is about to sleep. */
let token: string | null = null;
async function freshToken() { try { const { data } = await sb().auth.getSession(); token = data.session?.access_token ?? token; } catch { /* offline */ } }
export function note(room: string, payload: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const send = () => { if (!token) return; void fetch(URL + "/rest/v1/actions", { method: "POST", keepalive: true,
    headers: { apikey: KEY, Authorization: "Bearer " + token, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ room, kind: "count", payload }) }).catch(() => {}); };
  if (token) { send(); void freshToken(); } else void freshToken().then(send);
}
