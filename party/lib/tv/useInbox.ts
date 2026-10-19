/* The TV's inbox: everything the phones sent since the last action handled on
   this TV, in the order the server received it (that order decides who buzzed
   first). Each one goes to handle(), once. */
import { useEffect } from "react";
import { joinLive, sb } from "../supabase";
import { serverMs, type Action } from "./rules";

export function useInbox(code: string, isTv: boolean, handle: (a: Action) => Promise<void>) {
  useEffect(() => {
    if (!isTv) return;
    const key = "qmb.tv." + code + ".last";
    let last = 0, busy = false, again = false;
    try { last = Number(localStorage.getItem(key) || 0); } catch { /* no storage: start from the top */ }
    /* Two taps sent at once (a fast +1, two buzzes) can be numbered in one order and land in the
       other, so reading only "after the last id" would skip the slower one for good. So each read
       also looks back 10 seconds (by the server's clock) for late arrivals, and remembers what it
       has handled, so nothing is lost and nothing is done twice. */
    const before = last, seen = new Set<number>();
    let newest = 0;                                   // the server time of the newest action handled (ms)
    /* the server's timestamps, in either spelling ("…T12:00:00.123456+00:00" or "… 12:00:00.123456+00"), as ms */
    const ms = serverMs;
    /* an action that lands while the last batch is still being read is picked up straight after, not at the next poll */
    const fresh: Action[] = [];                        // straight from the realtime message: handled before the read
    const take = async (a: Action) => {
      if (a.id <= before || seen.has(a.id) || a.kind === "suggest") return;
      seen.add(a.id);
      try { await handle(a); } catch (e) { console.error("action refused", a, e); }
      if (a.id > last) { last = a.id; try { localStorage.setItem(key, String(last)); } catch { /* in memory only */ } }
      const t = ms(a.at); if (t > newest) newest = t;
    };
    /* a live feed gone quiet (it looks joined and brings nothing): a safety-net read finds taps no push
       brought, even a moment later. Then it joins again, and reads every 3 s for a minute meanwhile. */
    const pushed = new Set<number>();
    let quietUntil = 0;
    const quiet = (ids: number[]) => setTimeout(() => {
      if (!ids.some((id) => pushed.has(id)) && Date.now() > quietUntil) { quietUntil = Date.now() + 60000; close(); live = false; close = open(); }
    }, 2500);
    const drain = async (byPoll = false) => {
      if (busy) { again = true; return; }
      busy = true;
      try {
        do {
          again = false;
          while (fresh.length) await take(fresh.shift()!);
          let q = sb().from("actions").select("*").eq("room", code).neq("kind", "suggest");
          q = newest ? q.or(`id.gt.${last},at.gt.${new Date(newest - 10000).toISOString()}`) : q.gt("id", last);
          const { data } = await q.order("id");
          const found: number[] = [];
          for (const a of (data || []) as Action[]) { if (!seen.has(a.id) && a.id > before && a.kind !== "suggest") found.push(a.id); await take(a); }
          if (byPoll && live && found.length) quiet(found);
          if (seen.size > 2000) { const keep = [...seen].slice(-500); seen.clear(); keep.forEach((x) => seen.add(x)); }
          if (pushed.size > 2000) pushed.clear();
        } while (again);
      } finally { busy = false; }
    };
    void drain();
    let live = false, read = Date.now();
    const open = () => joinLive(() => sb().channel("actions:" + code)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "actions", filter: "room=eq." + code },
        (m: { new?: Partial<Action> }) => { if (m.new?.id && m.new.kind) { pushed.add(m.new.id); fresh.push(m.new as Action); } void drain(); })
      .subscribe((status) => { const was = live; live = status === "SUBSCRIBED"; if (live && !was) void drain(); }));
    let close = open();
    /* every tap arrives with the push and is handled at once; this read is the safety net:
       every 20 s while the live connection is up (a tap it missed is picked up by the next push
       anyway), every 3 s while it's down */
    const poll = setInterval(() => { if (Date.now() - read >= (live && Date.now() > quietUntil ? 20000 : 3000)) { read = Date.now(); void drain(true); } }, 1000);
    return () => { clearInterval(poll); close(); };
  }, [code, isTv, handle]);
}
