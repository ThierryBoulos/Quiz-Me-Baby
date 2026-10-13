"use client";
import { useEffect, useState } from "react";

/* Seconds left, from the TV's deadline. Paused shows the frozen number. */
export function useSecondsLeft(deadline?: number | null, left?: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, []);
  if (deadline) return Math.max(0, Math.ceil((deadline - now) / 1000));
  return left ? Math.ceil(left) : 0;
}
/* true once the TV's time `at` has passed (re-renders right then) */
export function useAfter(at?: number | null) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!at) { setOn(false); return; }
    const d = at - Date.now();
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
