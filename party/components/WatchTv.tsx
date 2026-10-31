"use client";
/* Phones wait for the TV (the owner, 31 Oct): a game's result plays out on the TV one team at a time, the winner
   last, so a phone showing it at once would spoil it. For as long as the TV's reveal takes, phones show "Eyes on
   the TV", then the result as before. Only the result waits: the host's buttons stay where they are. */
import { useEffect, useState } from "react";

/* true while the result for `key` should wait (secs from when it first came up); a new key starts a new wait,
   null means nothing to hold */
export function useRevealHold(key: string | null, secs: number) {
  const [done, setDone] = useState<string | null>(null);
  useEffect(() => {
    if (!key) return;
    const t = setTimeout(() => setDone(key), Math.max(0, secs) * 1000);
    return () => clearTimeout(t);
  }, [key]);   // eslint-disable-line react-hooks/exhaustive-deps
  /* held from the first render of a new key until its wait is over, so the result never flashes up early */
  return !!key && done !== key;
}

export function WatchTv() {
  return (
    <div className="watch-tv text-center flex flex-col items-center gap-2 py-6" role="status" aria-live="polite">
      <svg viewBox="0 0 48 40" width="56" height="46" aria-hidden fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round">
        <rect x="3" y="4" width="42" height="27" rx="4" /><path d="M17 37h14M24 31v6" />
      </svg>
      <div className="display text-32 leading-tight" style={{ color: "var(--color-gold)" }}>Eyes on the TV</div>
      <div className="text-13 text-[var(--color-ink-2)]">The result is coming up there first.</div>
    </div>);
}
