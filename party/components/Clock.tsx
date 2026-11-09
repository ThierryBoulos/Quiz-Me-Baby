"use client";
import { useEffect, useState } from "react";

/* Every deadline is the TV's time. A phone whose own clock is set wrong (by
   more than a few seconds) would count down wrong, so phones learn how far
   off they are from each update the TV sends (the smallest gap seen is the
   closest to the truth) and correct for it. */
/* (the smallest of the last 20 gaps, not of the whole night: after the game moves to another TV or phone, whose
   clock may be set differently, the old one's gaps age out. The 4 Nov audit, 1.16) */
let skew = 0;
const gaps: number[] = [];
export function noteTvTime(tvNowAt?: number) {
  if (!tvNowAt) return;
  gaps.push(Date.now() - tvNowAt);
  if (gaps.length > 20) gaps.shift();
  const best = Math.min(...gaps);
  /* (three updates first: a phone opening mid-question reads the update already stored, which can be many seconds
   old, and one old gap looked like a wrong clock: its countdown ran long until the next update. 5 Nov review) */
  skew = gaps.length >= 3 && Math.abs(best) > 3000 ? best : 0;
}
export const tvNow = () => Date.now() - skew;

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
/* The clock: a ring that drains as the time goes (the full ring is the most time it has shown: a new question,
   or +10 s, fills it again), red for the last 10 seconds, and the number jumps on each of those ticks. */
const TOPS = new Map<number, number>();
const BULBS = 30;
export function Clock({ deadline, left, timeUp, size = 120 }: { deadline?: number | null; left?: number; timeUp?: boolean; size?: number }) {
  const s = useSecondsLeft(deadline, left);
  const [now, setNow] = useState(tvNow());
  useEffect(() => { if (!deadline) return; const t = setInterval(() => setNow(tvNow()), 250); return () => clearInterval(t); }, [deadline]);
  const ms = timeUp ? 0 : deadline ? Math.max(0, deadline - now) : (left || 0) * 1000;
  /* how long this clock started at, kept by its deadline so a screen built afresh (an answer coming in) doesn't
     start the ring again from full (1 Nov: the host's ring stayed full) */
  const key = deadline ?? -1, top = Math.max(TOPS.get(key) ?? 0, ms);
  TOPS.set(key, top); if (TOPS.size > 40) TOPS.delete(TOPS.keys().next().value!);
  const frac = top ? ms / top : 0;
  const paused = !deadline && !!left;
  const col = timeUp ? "var(--color-no)" : s <= 10 ? "var(--color-no)" : "var(--color-gold)";
  const w = Math.max(4, size / 22), r = (size - w) / 2, C = 2 * Math.PI * r;
  return (
    <div className="clock grid place-items-center rounded-full relative" style={{ width: size, height: size, boxShadow: `0 0 30px -6px ${col}` }}>
      <svg className="absolute inset-0" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.1)" strokeWidth={w} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth={w} strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - frac)} transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset .3s linear, stroke .3s" }} />
      </svg>
      {/* the house look (phase 3): the ring is a ring of bulbs, one going out as each part of the time goes */}
      <svg className="clock-bulbs absolute inset-0" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        {Array.from({ length: BULBS }, (_, i) => { const a = -Math.PI / 2 + (2 * Math.PI * i) / BULBS, br = Math.max(2, w * 0.62), R = size / 2 - br - 1;
          return <circle key={i} cx={size / 2 + R * Math.cos(a)} cy={size / 2 + R * Math.sin(a)} r={br} className={i < Math.round(frac * BULBS) ? "on" : ""} style={i < Math.round(frac * BULBS) ? { fill: s <= 10 || timeUp ? "var(--color-no)" : undefined } : undefined} />; })}
      </svg>
      <div className="text-center leading-none relative">
        <div key={s <= 10 && !paused && !timeUp ? s : "n"} className={"display " + (s <= 10 && s > 0 && !paused && !timeUp ? "tick-pop" : "")} style={{ fontSize: size * 0.42, color: col }}>{timeUp ? "0" : s}</div>
        {size >= 90 && <div className="eyebrow" style={{ fontSize: Math.max(9, size / 9) }}>{timeUp ? "time up" : paused ? "paused" : "seconds"}</div>}
      </div>
    </div>
  );
}
