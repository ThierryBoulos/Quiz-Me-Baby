/* Who's present: every phone on screen is on the room's realtime channel (see
   usePresence in lib/room.ts). Each second the TV marks them as here. */
import { useEffect, useRef, type RefObject } from "react";
import { sb } from "../supabase";
import { presenceChannel, type Member } from "../room";

export function usePresent(code: string, isTv: boolean, here: RefObject<{ at: Record<string, number> }>, members: Member[]) {
  const mem = useRef(members);
  mem.current = members;
  useEffect(() => {
    if (!isTv) return;
    let live = false, down = Date.now();
    /* a presence listener is what makes the channel keep the list (without one, the joins are dropped) */
    const ch = sb().channel(presenceChannel(code)).on("presence", { event: "sync" }, () => {});
    ch.subscribe((status) => { live = status === "SUBSCRIBED"; if (!live) down = Date.now(); });
    const t = setInterval(() => {
      const H = here.current, now = Date.now();
      if (live) { for (const k of Object.keys(ch.presenceState())) H.at[k] = now; return; }
      /* the TV can't see who's present (its realtime link is down): nobody is taken for away
         meanwhile, since the phones that are present aren't writing to the log */
      if (now - down > 5000) for (const m of mem.current) H.at[m.user_id] = now;
    }, 1000);
    return () => { clearInterval(t); void sb().removeChannel(ch); };
  }, [isTv, code, here]);
}
