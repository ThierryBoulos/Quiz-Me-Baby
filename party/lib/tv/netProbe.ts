/* Is the TV still online? (19 Nov review.) The TV only found out it had lost the internet when a write failed, and
   in a quiet question nothing is written: the clock ran out, and the phones saw the reveal only after the TV came
   back. So while a clock runs, every 4 s, the TV asks the server for the time (qmb_now: a read, nothing written).
   No answer in 6 s, or an error: offline from when it asked, and the clocks wait (each game's own `offline`). An
   answer while offline: the game publishes, and that write landing puts the clocks right and takes the banner off.
   Used by both games: two teams (lib/tvGame.ts) and 3 to 8 teams (lib/many/useTvMany.ts). */
import { useEffect, useRef } from "react";
import { sb } from "../supabase";

export const PROBE_EVERY = 4000, PROBE_WAIT = 6000;

export function useNetProbe(on: boolean, o: { running: () => boolean; offline: () => boolean; lost: (since: number) => void; back: () => void }) {
  const opts = useRef(o);
  opts.current = o;
  useEffect(() => {
    if (!on) return;
    let busy = false;
    const t = setInterval(() => {
      const x = opts.current;
      if (busy || !(x.running() || x.offline())) return;
      busy = true;
      const t0 = Date.now();
      let wait: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<boolean>((r) => { wait = setTimeout(() => r(false), PROBE_WAIT); });
      const ask = Promise.resolve(sb().rpc("qmb_now")).then((r: { error?: unknown }) => !r?.error, () => false);
      void Promise.race([ask, timeout]).then((ok) => {
        clearTimeout(wait); busy = false;
        const y = opts.current;
        if (!ok) { if (!y.offline()) y.lost(t0); }
        else if (y.offline()) y.back();
      });
    }, PROBE_EVERY);
    return () => clearInterval(t);
  }, [on]);
}
