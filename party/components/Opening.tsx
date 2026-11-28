"use client";
/* HOW A GAME OPENS ON THE TV (28 Nov, the owner's picks from four drawings): a mini-game opens with the stage's red
   curtains parting; a round of standard questions with two spotlights sweeping the dark stage and landing on the
   round's title, which sits in a marquee whose bulbs light up one by one and whose letters flicker on like neon.
   One copy for every setup (the 2-team TV and 3 to 8 teams), on the TV only. The score bar at the top is never
   covered: the curtains and the dark start under it. Everything else on the screen is as it was; with Motion off in
   Settings, nothing plays and the title shows as before. */
import { Fragment, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motionOff } from "./Marquee";

/* where the stage's body starts: just under the score bar (the stage is 1280 by 720, scaled to the screen) */
function useUnderBar(on: boolean) {
  const [at, setAt] = useState<{ el: HTMLElement; top: number } | null>(null);
  useLayoutEffect(() => {
    if (!on) return;
    const st = document.querySelector<HTMLElement>(".tv-stage"); if (!st) return;
    const bar = st.querySelector<HTMLElement>(".hud"), s = st.getBoundingClientRect(), k = s.height / 720 || 1;
    setAt({ el: st, top: bar ? Math.round((bar.getBoundingClientRect().bottom - s.top) / k) + 4 : 0 });
  }, [on]);
  return at;
}
/* the marquee's corner, as in the styles (.op-marquee border-radius) */
const R = 22;
/* plays once, from when the screen comes up; gone when it's done */
function useOnce(ms: number) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (motionOff()) return;
    setOn(true); const t = window.setTimeout(() => setOn(false), ms); return () => clearTimeout(t);
  }, [ms]);
  return on;
}

/* ---- A mini-game: the curtains part ----
   (28 Nov, the owner: "the first option of the curtains was better"; "open completely off the screen"; nothing wavy)
   Two velvet curtains with a gold fringe meet in the middle under the score bar, then slide apart, all the way off the
   screen, each to its own side. */
export function Curtains() {
  const on = useOnce(2300), at = useUnderBar(on);
  if (!on || !at) return null;
  return createPortal(
    <div className="op-curtains" style={{ top: at.top }} aria-hidden>
      <div className="op-rod" />
      <div className="op-curtain l"><span className="op-fringe" /></div>
      <div className="op-curtain r"><span className="op-fringe" /></div>
    </div>, at.el);
}

/* ---- A round of questions: the dark stage, the two spotlights sweeping in and landing on the title ---- */
export function Spotlights() {
  const on = useOnce(3000), at = useUnderBar(on);
  if (!on || !at) return null;
  return createPortal(
    <div className="op-lights" style={{ top: at.top }} aria-hidden>
      <div className="op-dark" />
      <div className="op-beam l" /><div className="op-beam r" />
    </div>, at.el);
}

/* the round's title in its marquee: the bulbs light one by one all the way round once the spotlights have landed,
   then the letters flicker on like neon; then the bulbs twinkle. The bulbs sit on the frame's edge, a bulb every
   step, so the frame can be any size (a long theme on two lines too) */
export function MarqueeTitle({ children, text, style, at = 1.4 }: { children?: ReactNode; text: string; style?: CSSProperties; at?: number }) {
  const box = useRef<HTMLDivElement>(null), [pts, setPts] = useState<{ x: number; y: number }[]>([]);
  const still = useRef(true);
  useLayoutEffect(() => {
    still.current = motionOff();
    const el = box.current; if (!el) return;
    /* the bulbs follow the frame's own rounded edge, corners too (28 Nov, the owner: "exactly rounded as the shape"), and
       the same on every side (the owner: "exactly like on the left side"): each straight side gets its own bulbs, evenly
       spaced with half a gap at each end, and each corner one bulb in the middle of its curve, so the left and the
       right, the top and the bottom mirror each other */
    const place = () => {
      const w = el.offsetWidth, h = el.offsetHeight, r = Math.min(R, w / 2, h / 2), GAP = 34, out: { x: number; y: number }[] = [];
      const side = (len: number, pt: (t: number) => { x: number; y: number }) => {
        const n = Math.max(1, Math.round(len / GAP)), g = len / n;
        for (let j = 0; j < n; j++) out.push(pt(g / 2 + j * g));
      };
      const corner = (cx: number, cy: number, a: number) => out.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
      side(w - 2 * r, (t) => ({ x: r + t, y: 0 }));                 // the top, left to right
      corner(w - r, r, -Math.PI / 4);
      side(h - 2 * r, (t) => ({ x: w, y: r + t }));                 // the right, top to bottom
      corner(w - r, h - r, Math.PI / 4);
      side(w - 2 * r, (t) => ({ x: w - r - t, y: h }));             // the bottom, right to left
      corner(r, h - r, (3 * Math.PI) / 4);
      side(h - 2 * r, (t) => ({ x: 0, y: h - r - t }));             // the left, bottom to top
      corner(r, r, (5 * Math.PI) / 4);
      setPts(out);
    };
    place(); void document.fonts?.ready.then(place);
  }, [text]);
  const n = pts.length;
  return (
    <div ref={box} className={"op-marquee" + (still.current ? " still" : "")} style={{ ["--at" as string]: at + "s" }}>
      <div className="op-bulbs" aria-hidden>{pts.map((p, j) => <i key={j} className={j % 2 ? "odd" : undefined} style={{ left: p.x, top: p.y, ["--on" as string]: at + (j / n) * 0.9 + "s" }} />)}</div>
      <h1 className="display op-neon" style={style} aria-label={text}>
        {/* (word by word, so a long theme still breaks between its words) */}
        {children ?? (() => { let i = 0; return text.split(" ").map((w, j) => <Fragment key={j}>{j ? " " : ""}<span className="w" aria-hidden>{[...w].map((c) => <span key={i} style={{ animationDelay: at + 0.5 + (i++) * 0.05 + "s" }}>{c}</span>)}</span></Fragment>); })()}
      </h1>
    </div>);
}
