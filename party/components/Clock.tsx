"use client";
import { useEffect, useState } from "react";

/* Every deadline is the TV's time. A phone whose own clock is set wrong (by
   more than a few seconds) would count down wrong, so phones learn how far
   off they are from each update the TV sends (the smallest gap seen is the
   closest to the truth) and correct for it. */
let skew = 0, best: number | null = null;
export function noteTvTime(tvAt?: number) {
  if (!tvAt) return;
  const gap = Date.now() - tvAt;
  if (best == null || gap < best) best = gap;
  skew = Math.abs(best) > 3000 ? best : 0;
}
const tvNow = () => Date.now() - skew;

/* Seconds left, from the TV's deadline. Paused shows the frozen number. */
export function useSecondsLeft(deadline?: number | null, left?: number) {
  const [now, setNow] = useState(tvNow());
  useEffect(() => { const t = setInterval(() => setNow(tvNow()), 250); return () => clearInterval(t); }, []);
  if (deadline) return Math.max(0, Math.ceil((deadline - now) / 1000));
  return left ? Math.ceil(left) : 0;
}
/* true once the TV's time `at` has passed (re-renders right then) */
export function useAfter(at?: number | null) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!at) { setOn(false); return; }
    const d = at - tvNow();
    if (d <= 0) { setOn(true); return; }
    setOn(false);
    const t = setTimeout(() => setOn(true), d);
    return () => clearTimeout(t);
  }, [at]);
  return on;
}
export function Clock({ deadline, left, timeUp, size = 120 }: { deadline?: number | null; left?: number; timeUp?: boolean; size?: number }) {
  const s = useSecondsLeft(deadline, left);
  const paused = !deadline && !!left;
  const col = timeUp ? "var(--color-no)" : s <= 10 ? "var(--color-no)" : "var(--color-gold)";
  return (
    <div className="grid place-items-center rounded-full" style={{ width: size, height: size, border: `${Math.max(4, size / 22)}px solid ${col}`, boxShadow: `0 0 30px -6px ${col}` }}>
      <div className="text-center leading-none">
        <div className="display" style={{ fontSize: size * 0.42, color: col }}>{timeUp ? "0" : s}</div>
        {size >= 90 && <div className="eyebrow" style={{ fontSize: Math.max(9, size / 12) }}>{timeUp ? "time up" : paused ? "paused" : "seconds"}</div>}
      </div>
    </div>
  );
}
