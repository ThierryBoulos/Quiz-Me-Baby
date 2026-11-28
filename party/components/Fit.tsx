"use client";
/* ONE LINE THAT ALWAYS FITS (28 Nov, the owner: "all mini-games, the longest names, and any game added later"): a team's
   name where it has one line and a box of its own (the winner's card, a bid tile, a button, a list's heading). As it
   was when it fits; too wide for its box (14 wide letters on a 360-wide phone), it is drawn a little smaller, just
   enough to fit, down to `min` of its size, and only then cut with "…". Never off the screen, never over its
   neighbour. Use it for any name on a line of its own; the screen check's worst case (sim/screens/dump.mjs) shows
   where one is missing. */
import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";

export function FitLine({ children, className = "", style, size, min = 0.5 }: {
  children: ReactNode; className?: string; style?: CSSProperties;
  size?: number;   // its size in px when it's set here and not by its class
  min?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    /* the text's exact width against its box's (a part of a pixel too wide is enough for the browser to cut it with
       "…"); a few passes: letter spacing doesn't shrink with the text, so one pass falls a little short */
    const fit = () => {
      el.style.fontSize = size ? size + "px" : "";
      const base = parseFloat(getComputedStyle(el).fontSize) || 16, r = document.createRange(); r.selectNodeContents(el);
      for (let i = 0, f = 1; i < 5; i++) {
        const box = el.getBoundingClientRect().width, text = r.getBoundingClientRect().width;
        if (!box || text <= box - 0.5 || f <= min) break;
        f = Math.max(min, (f * (box - 2)) / text); el.style.fontSize = base * f + "px";
      }
    };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(el);
    void document.fonts?.ready.then(fit);
    return () => ro.disconnect();
  });
  return <span ref={ref} className={"fit-line " + className} style={{ ...style, ...(size ? { fontSize: size } : null) }}>{children}</span>;
}
