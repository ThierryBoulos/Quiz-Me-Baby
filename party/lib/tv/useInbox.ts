/* The TV's inbox: everything the phones sent since the last action handled on
   this TV, in the order the server received it (that order decides who buzzed
   first). Each one goes to handle(), once, one at a time. */
import { useEffect } from "react";
import { joinLive, sb } from "../supabase";
import { serverMs, type Action } from "./rules";

/* a read the server hasn't answered in this long is stuck: another goes out beside it */
const READ_STUCK_MS = 4000, READS_AT_ONCE = 3;

export function useInbox(code: string, isTv: boolean, handle: (a: Action) => Promise<void>) {
  useEffect(() => {
    if (!isTv) return;
    const key = "qmb.tv." + code + ".last";
    let last = 0;
    try { last = Number(localStorage.getItem(key) || 0); } catch { /* no storage: start from the top */ }
    /* Two taps sent at once (a fast +1, two buzzes) can be numbered in one order and land in the
       other, so reading only "after the last id" would skip the slower one for good. So each read
       also looks back 10 seconds (by the server's clock) for late arrivals, and remembers what it
       has handled, so nothing is lost and nothing is done twice. */
    const before = last, seen = new Set<number>();
    let newest = 0;                                   // the server time of the newest action handled (ms)
    /* the server's timestamps, in either spelling ("…T12:00:00.123456+00:00" or "… 12:00:00.123456+00"), as ms */
    const ms = serverMs;
    const take = async (a: Action) => {
      try { await handle(a); } catch (e) { console.error("action refused", a, e); }
      if (a.id > last) { last = a.id; try { localStorage.setItem(key, String(last)); } catch { /* in memory only */ } }
      const t = ms(a.at); if (t > newest) newest = t;
    };
    /* One at a time, in the order they came in. Nothing here waits on the network: a tap the push
       brings is handled straight away, even while a read is out (GRF2, 20:00: a read the server sat
       on for 28 s held two of the host's taps back, and then they landed together). */
    const queue: Action[] = [];
    let running = false, off = false;               // off: this inbox is closed (a late read brings it nothing)
    const run = async () => {
      if (running) return;
      running = true;
      try { while (queue.length) await take(queue.shift()!); } finally { running = false; }
    };
    const enqueue = (a: Action) => {
      if (off || a.id <= before || seen.has(a.id) || a.kind === "suggest") return false;
      seen.add(a.id); queue.push(a); void run();
      return true;
    };
    /* a live feed gone quiet (it looks joined and brings nothing): a safety-net read finds taps no push
       brought, even a moment later. Then it joins again, and reads every 3 s for a minute meanwhile. */
    const pushed = new Set<number>();
    let quietUntil = 0;
    const quiet = (ids: number[]) => setTimeout(() => {
      if (!ids.some((id) => pushed.has(id)) && Date.now() > quietUntil) { quietUntil = Date.now() + 60000; close(); live = false; close = open(); }
    }, 2500);
    /* The safety-net read. One at a time, and one asked for meanwhile goes straight after. But one
       the server sits on isn't waited for: after 4 s another goes out beside it, and whatever either
       brings is taken (each action once). */
    let out = 0, lastStart = 0, again = false;
    const read = async (byPoll = false) => {
      if (off) return;
      if (out && (Date.now() - lastStart < READ_STUCK_MS || out >= READS_AT_ONCE)) { again = true; return; }
      out++; lastStart = Date.now(); again = false;
      const stuck = setTimeout(() => void read(byPoll), READ_STUCK_MS);
      try {
        let q = sb().from("actions").select("*").eq("room", code).neq("kind", "suggest");
        q = newest ? q.or(`id.gt.${last},at.gt.${new Date(newest - 10000).toISOString()}`) : q.gt("id", last);
        const { data } = await q.order("id");
        const found: number[] = [];
        for (const a of (data || []) as Action[]) if (enqueue(a)) found.push(a.id);
        if (byPoll && live && found.length) quiet(found);
        if (seen.size > 2000) { const keep = [...seen].slice(-500); seen.clear(); keep.forEach((x) => seen.add(x)); }
        if (pushed.size > 2000) pushed.clear();
      } catch { /* offline: the next read tries again */ }
      finally { clearTimeout(stuck); out--; }
      if (again) void read();
    };
    void read();
    let live = false, polled = Date.now();
    const open = () => joinLive(() => sb().channel("actions:" + code)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "actions", filter: "room=eq." + code },
        (m: { new?: Partial<Action> }) => { if (m.new?.id && m.new.kind) { pushed.add(m.new.id); enqueue(m.new as Action); } void read(); })
      .subscribe((status) => { const was = live; live = status === "SUBSCRIBED"; if (live && !was) void read(); }));
    let close = open();
    /* every tap arrives with the push and is handled at once; this read is the safety net:
       every 20 s while the live connection is up (a tap it missed is picked up by the next push
       anyway), every 3 s while it's down */
    const poll = setInterval(() => { if (Date.now() - polled >= (live && Date.now() > quietUntil ? 20000 : 3000)) { polled = Date.now(); void read(true); } }, 1000);
    return () => { off = true; clearInterval(poll); close(); };
  }, [code, isTv, handle]);
}
