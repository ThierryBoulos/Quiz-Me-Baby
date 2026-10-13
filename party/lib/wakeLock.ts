"use client";
import { useEffect, useState } from "react";

/* Keep the TV awake: the browser's Screen Wake Lock stops the laptop dimming
   and sleeping while the game is on screen. Browsers drop it when the page is
   hidden, so it's asked for again whenever the page comes back; some only
   grant it after a tap, so any tap asks again too.
   -> true (held), false (not available here), null (not yet known) */
export function useWakeLock(on = true) {
  const [held, setHeld] = useState<boolean | null>(null);
  useEffect(() => {
    if (!on) return;
    type Sentinel = { released: boolean; release: () => Promise<void>; addEventListener: (t: string, f: () => void) => void };
    const wl = (navigator as unknown as { wakeLock?: { request: (t: "screen") => Promise<Sentinel> } }).wakeLock;
    if (!wl) { setHeld(false); return; }
    let lock: Sentinel | null = null, alive = true;
    const ask = async () => {
      if (!alive || document.visibilityState !== "visible" || (lock && !lock.released)) return;
      try { lock = await wl.request("screen"); setHeld(true); lock.addEventListener("release", () => { if (alive) setHeld(false); }); }
      catch { setHeld(false); }
    };
    void ask();
    const vis = () => void ask();
    document.addEventListener("visibilitychange", vis);
    window.addEventListener("pointerdown", vis);
    window.addEventListener("keydown", vis);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", vis); window.removeEventListener("pointerdown", vis); window.removeEventListener("keydown", vis);
      void lock?.release().catch(() => {});
    };
  }, [on]);
  return held;
}
