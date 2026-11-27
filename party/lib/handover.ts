/* Who's carrying the night when someone goes quiet, the same in every setup (27 Nov, the merge): the host gone (the
   teams sheet says so; from 90 s anyone can take over as the host), and a captain gone while their team has to answer
   (the armband passes to a teammate who's still here). */
import { sb } from "./supabase";

export type HostGone = { name: string | null; since: number; openAt: number };
/* the host's state: gone 20 s since last heard (or no host at all) while the night is on. host: the host on the
   members' list (none: left); last: when it was last heard; was: what the screens show now */
export function hostGoneNow(host: { name: string } | undefined, last: number | null, playing: boolean, was: HostGone | null | undefined, now: number): HostGone | null {
  const gone = playing && (!host || now - (last as number) >= 20000);
  if (!gone) return null;
  if (host) return { name: host.name, since: last as number, openAt: (last as number) + 90000 };
  const none = !!was && was.name == null;
  return { name: null, since: none ? was!.since : now, openAt: none ? was!.openAt : now };
}
/* ...the same as shown already (nothing to publish) */
export const sameHostGone = (a: HostGone | null | undefined, b: HostGone | null | undefined) => (!a && !b) || (!!a && !!b && a.name === b.name && a.since === b.since);

/* the armband: the captain becomes a player and the teammate the captain; if the second step fails, the first is put
   back. True once both are done */
export async function passArmband(code: string, from: string, to: string): Promise<boolean> {
  const a = await sb().from("members").update({ role: "player" }).eq("room", code).eq("user_id", from);
  if (a.error) return false;
  const b = await sb().from("members").update({ role: "captain" }).eq("room", code).eq("user_id", to);
  if (b.error) { await sb().from("members").update({ role: "captain" }).eq("room", code).eq("user_id", from); return false; }
  return true;
}

/* a phone's note, every setup: it left the game screen during a question, it's back (and for how long, by its own clock),
   a fresh page said hello (a reload: back too), or it tried to paste an answer (flagged once a question). k: the phone;
   name: whose; away: who's out of sight now (and their flag); flag(qid, ms, kind): flags it (the setup's own), giving
   its id. True if the flags changed */
export type Away = Record<string, { at: number; qid?: string; flag?: number }>;
export type PhoneNote = { away?: { qid?: string }; back?: { qid?: string; ms: number }; hello?: number; paste?: { qid?: string } };
type Flagged = { id: number; name: string; kind?: string; qid?: string; ms: number | null };
export function phoneNote(s: { flags?: Flagged[] }, away: Away, k: string, name: string | undefined, n: PhoneNote, now: number,
  flag: (qid: string | undefined, ms: number | null, kind?: "away" | "paste") => number | undefined): boolean {
  let changed = false;
  const setMs = (id: number, ms: number) => { s.flags = (s.flags || []).map((f) => (f.id === id ? { ...f, ms } : f)); changed = true; };
  if (n.away && !away[k]) away[k] = { at: now, qid: n.away.qid };
  if (n.paste && !(s.flags || []).some((f) => f.kind === "paste" && f.qid === n.paste!.qid && f.name === name) && flag(n.paste.qid, null, "paste")) changed = true;
  if (n.hello && away[k]) { const a = away[k]; delete away[k]; if (a.flag && a.flag > 0) setMs(a.flag, now - a.at); }
  if (n.back) {
    const a = away[k]; delete away[k];
    const ms = Math.max(0, Number(n.back.ms) || 0);
    /* the phone's own clock decides: a glance under two seconds flagged while its "back" was on the way is taken back */
    if (a?.flag && a.flag > 0 && ms < 2000) { s.flags = (s.flags || []).filter((f) => f.id !== a.flag); changed = true; }
    else if (a?.flag && a.flag > 0) setMs(a.flag, ms);
    else if (!a?.flag && ms >= 2000 && flag(n.back.qid, ms)) changed = true;
  }
  return changed;
}
