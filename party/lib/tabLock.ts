"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/* One TV per room per browser. Two tabs of the TV would both run the night
   (two clocks, two inboxes, two sets of decisions), so the first tab holds a
   browser lock on the room and a second one waits, offering to take over.
   A browser without locks (old Safari) just runs, as before. */
export function useTabLock(code: string, want: boolean) {
  const [state, setState] = useState<"pending" | "mine" | "other">("pending");
  const release = useRef<(() => void) | null>(null);
  const grab = useCallback((steal: boolean) => {
    const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
    if (!locks) { setState("mine"); return; }
    void locks.request("qmb.tv." + code, steal ? { steal: true } : { ifAvailable: true }, (lock) => {
      if (!lock) { setState("other"); return; }
      setState("mine");
      /* held until this tab closes, or another tab takes over */
      return new Promise<void>((resolve) => { release.current = resolve; });
    }).catch(() => setState("other"));           // another tab took it over
  }, [code]);
  useEffect(() => {
    if (!want) return;
    grab(false);
    return () => { release.current?.(); release.current = null; };
  }, [want, grab]);
  return { state, takeOver: () => grab(true) };
}
