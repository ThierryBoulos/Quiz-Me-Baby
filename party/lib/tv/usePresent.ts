/* Who's present: every phone on screen is on the room's realtime channel (see
   usePresence in lib/room.ts). Each second the TV marks them as here. Every
   30 s it also tells the database which host and captains it has seen lately
   (qmb_seen), so a seat whose phone is still here can't be taken over from the
   join screen; one whose phone died for 90 s can (29 Oct). */
import { useEffect, useRef, type RefObject } from "react";
import { sb } from "../supabase";
import { presenceChannel, type Member } from "../room";

const SEEN_EVERY_MS = 30000, SEEN_WITHIN_MS = 35000;

/* phone: the game runs on a phone in the room (no TV, 3 Nov). That phone is on the channel already as a player
   (usePresence, which listens for the list when it runs the game): it reads that channel's list rather than
   joining the same channel a second time (one channel per name per phone: a second join would break the first). */
export function usePresent(code: string, isTv: boolean, here: RefObject<{ at: Record<string, number> }>, members: Member[], phone = false) {
  const mem = useRef(members);
  mem.current = members;
  useEffect(() => {
    if (!isTv) return;
    let live = false, down = Date.now();
    const topic = presenceChannel(code);
    /* a presence listener is what makes the channel keep the list (without one, the joins are dropped) */
    const own = phone ? null : sb().channel(topic).on("presence", { event: "sync" }, () => {});
    own?.subscribe((status) => { live = status === "SUBSCRIBED"; if (!live) down = Date.now(); });
    const t = setInterval(() => {
      const H = here.current, now = Date.now();
      const ch = own ?? sb().getChannels().find((c) => c.topic === "realtime:" + topic);
      if (phone) { const was = live; live = ch?.state === "joined"; if (was && !live) down = now; }
      /* (only the room's own phones: a key that isn't one of its members is someone else's, and a phone could
         claim a captain's to look present: the 4 Nov audit, 4.4) */
      if (live && ch) { const ids = new Set(mem.current.map((m) => m.user_id)); for (const k of Object.keys(ch.presenceState())) if (ids.has(k)) H.at[k] = now; return; }
      /* the TV can't see who's present (its realtime link is down): nobody is taken for away
         meanwhile, since the phones that are present aren't writing to the log */
      if (now - down > 5000) for (const m of mem.current) H.at[m.user_id] = now;
    }, 1000);
    const seen = setInterval(() => {
      const H = here.current, now = Date.now();
      const ids = mem.current.filter((m) => (m.role === "host" || m.role === "captain") && now - (H.at[m.user_id] ?? 0) < SEEN_WITHIN_MS).map((m) => m.user_id);
      if (ids.length) void sb().rpc("qmb_seen", { r: code, ids }).then(() => {}, () => { /* the next one */ });
    }, SEEN_EVERY_MS);
    return () => { clearInterval(t); clearInterval(seen); if (own) void sb().removeChannel(own); };
  }, [isTv, code, here, phone]);
}
