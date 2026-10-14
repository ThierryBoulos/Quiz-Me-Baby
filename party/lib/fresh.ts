"use client";
import { useEffect, useRef } from "react";

/* A TV or phone left open across a deploy keeps running the old code — and
   the TV runs the game, so an old TV means old rules for everyone. Every
   minute (and when the screen comes back) each page asks which deploy is
   live; if it isn't the one it came from, it reloads at the next calm moment
   (`safe`: not while someone is typing an answer or a clock is running). A
   reload is safe mid-game: the TV restores the night, phones take their seat. */
const MINE = process.env.NEXT_PUBLIC_BUILD || "";
/* once per new deploy at most: if a reload still doesn't bring the new code (a cache), never loop */
const reload = (to: string) => {
  try { if (sessionStorage.getItem("qmb.reloadedFor") === to) return; sessionStorage.setItem("qmb.reloadedFor", to); } catch { return; }
  location.reload();
};
export function useFreshBuild(safe: boolean) {
  const stale = useRef(""), safeRef = useRef(safe);
  safeRef.current = safe;
  useEffect(() => {
    if (!MINE) return;
    const check = async () => {
      try {
        const r = await fetch("/api/build", { cache: "no-store" });
        const { build } = (await r.json()) as { build?: string };
        if (build && build !== MINE) stale.current = build;
      } catch { /* offline: try again later */ }
      if (stale.current && safeRef.current) reload(stale.current);
    };
    const t = setInterval(() => void check(), 60000);
    const vis = () => { if (document.visibilityState === "visible") void check(); };
    document.addEventListener("visibilitychange", vis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", vis); };
  }, []);
  /* already known to be old, and now it's calm: reload */
  useEffect(() => { if (safe && stale.current) reload(stale.current); }, [safe]);
}
