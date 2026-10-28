"use client";
/* The TV's motion (28 Oct): the points flying up to the score, and the "Lead change" banner. Everything here
   only shows what already happened: the game itself never waits for it, and a reloaded TV shows the scores as
   they are, with nothing to replay. With "reduce motion" on, the scores just change. */
import { useEffect, useRef, useState, type RefObject } from "react";
import { FLY_MS, flyAt, type Pub, type Two } from "@/lib/game";
import { playSound, Snd } from "@/lib/sound";

/* when the screen on show came up (a new screen, round or turn) */
export function useScreenAt(key: string) {
  const at = useRef({ key, t: Date.now() });
  if (at.current.key !== key) at.current = { key, t: Date.now() };
  return at.current.t;
}

const reduced = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/* the points, from the line that says "+2" up to the team's score: one "+2" for a question, a coin a point for a
   mini-game (up to 6). Says whether it could fly (no line on screen, no flight). */
function launch(root: HTMLElement | null, t: 0 | 1, n: number, pts: number) {
  if (!root || reduced() || typeof root.animate !== "function") return false;
  const src = root.querySelector(`[data-fly-src~="${t}"]`), dst = root.querySelector(`[data-score="${t}"]`);
  if (!src || !dst) return false;
  const R = root.getBoundingClientRect(), k = R.width / (root.offsetWidth || R.width) || 1;
  const a = src.getBoundingClientRect(), b = dst.getBoundingClientRect();
  const x0 = (a.left + a.width / 2 - R.left) / k, y0 = (a.top + a.height / 2 - R.top) / k;
  const x1 = (b.left + b.width / 2 - R.left) / k, y1 = (b.top + b.height / 2 - R.top) / k;
  for (let i = 0; i < n; i++) {
    const el = document.createElement("div");
    el.className = "fly " + (t ? "b" : "a") + (n > 1 ? " coin" : "");
    el.textContent = n > 1 ? "" : `+${pts}`;
    el.style.left = x0 + "px"; el.style.top = y0 + "px";
    root.appendChild(el);
    /* up first, then across: a curve, not a straight line (each coin a little apart) */
    const spread = (i - (n - 1) / 2) * 26, mx = x0 + (x1 - x0) * 0.25 + spread, my = y0 + (y1 - y0) * 0.75;
    const at = (x: number, y: number, s: number) => `translate(${x - x0}px, ${y - y0}px) translate(-50%, -50%) scale(${s})`;
    el.animate([
      { transform: at(x0, y0, 0.6), opacity: 0 },
      { transform: at(x0, y0 - 14, 1.15), opacity: 1, offset: 0.15 },
      { transform: at(mx, my, 1.05), opacity: 1, offset: 0.6 },
      { transform: at(x1, y1, 0.45), opacity: 0.35 },
    ], { duration: FLY_MS, delay: i * 90, easing: "cubic-bezier(.4,0,.6,1)", fill: "both" }).onfinish = () => el.remove();
  }
  return true;
}

/* The scores the top bar shows: the real ones, except that one going up waits for its points to land. Down (a
   ruling changed, a score corrected) it just rolls back. sound: this is the TV (coins clink as they land). */
export function useFlyingPoints(root: RefObject<HTMLDivElement | null>, pub: Pub, screenAt: number, sound: boolean): Two<number> {
  const a = pub.teams[0].score, b = pub.teams[1].score;
  const [shown, setShown] = useState<Two<number>>([a, b]);
  const last = useRef<Two<number>>([a, b]);
  const scr = useRef({ screen: pub.screen, at: screenAt });
  scr.current = { screen: pub.screen, at: screenAt };
  useEffect(() => {
    const prev = last.current, now: Two<number> = [a, b];
    last.current = now;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const set = (t: 0 | 1, v: number) => setShown((s) => (t ? [s[0], v] : [v, s[1]]) as Two<number>);
    ([0, 1] as const).forEach((t) => {
      const d = now[t] - prev[t];
      if (d < 0) { set(t, now[t]); return; }
      if (d === 0) return;
      const wait = Math.max(0, scr.current.at + flyAt(scr.current.screen) - Date.now());
      timers.push(setTimeout(() => {
        const n = d >= 3 ? Math.min(d, 6) : 1;
        if (!launch(root.current, t, n, d)) { set(t, now[t]); return; }
        for (let i = 0; i < n; i++) timers.push(setTimeout(() => {
          set(t, i === n - 1 ? now[t] : prev[t] + Math.round((d * (i + 1)) / n));
          if (sound && n > 1 && i < n - 1) { try { Snd.coin(i); } catch { /* no audio */ } }
        }, FLY_MS + i * 90));
      }, wait));
    });
    /* a newer change, or the TV leaves the game: show these scores as they are */
    return () => { timers.forEach(clearTimeout); setShown(now); };
  }, [a, b]);   // eslint-disable-line react-hooks/exhaustive-deps
  return shown;
}

/* "Lead change": when the team ahead changes (on the scores as shown, so once the points have landed), a band
   in the new leader's colour sweeps across, with the whoosh. A level score doesn't count as a change. */
/* lift: a little higher, over the last line of a summary (on an answer the "+2" sits just above, so it stays low) */
export function LeadBanner({ shown, names, sound, lift }: { shown: Two<number>; names: [string, string]; sound: boolean; lift?: boolean }) {
  const lead = shown[0] > shown[1] ? 0 : shown[1] > shown[0] ? 1 : null;
  const prev = useRef<0 | 1 | null>(null);
  const [b, setB] = useState<{ t: 0 | 1; id: number } | null>(null);
  useEffect(() => {
    if (lead == null) return;
    if (prev.current != null && prev.current !== lead) { setB({ t: lead, id: Date.now() }); if (sound) playSound("whoosh"); }
    prev.current = lead;
  }, [lead, sound]);
  useEffect(() => { if (!b) return; const x = setTimeout(() => setB(null), 1900); return () => clearTimeout(x); }, [b]);
  if (!b) return null;
  return (
    <div key={b.id} className={"lead-banner " + (b.t ? "b" : "a") + (lift ? " lift" : "")} role="status" aria-live="polite">
      <span>Lead change</span><b><bdi>{names[b.t]}</bdi></b>
    </div>);
}
