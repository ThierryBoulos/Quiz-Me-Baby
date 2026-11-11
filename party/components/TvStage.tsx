"use client";
import { useEffect, useRef, useState } from "react";

/* SNAKED's TV: the screen is drawn on a fixed 1280×720 stage and scaled to
   whatever it's shown on, so a laptop and a 65" telly see the same layout. */
export function TvStage({ children }: { children: React.ReactNode }) {
  const [k, setK] = useState(1);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fit = () => setK(Math.min(window.innerWidth / 1280, window.innerHeight / 720));
    fit(); window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  return (
    <div className="tv-wrap">
      <div ref={ref} className="tv-stage" style={{ transform: `translate(-50%, -50%) scale(${k})` }}>{children}</div>
    </div>
  );
}

/* THE SCREEN'S BODY, KEPT ON THE STAGE (11 Nov, the owner: "check that every screen fits on a 16:10 screen... this
   should always not be an issue"). Between the top bar and the strip along the bottom: as it was when it fits; when a
   screen's content would be taller (eight long team names, a long answer, the end's chart and awards), it is drawn a
   little smaller, just enough to fit, so nothing ever goes off the stage or pushes the bottom strip off it. */
export function FitBody({ className, children }: { className: string; children: React.ReactNode }) {
  const outer = useRef<HTMLDivElement>(null), inner = useRef<HTMLDivElement>(null);
  const [k, setK] = useState(1);
  useEffect(() => {
    const o = outer.current, i = inner.current; if (!o || !i) return;
    const fit = () => {
      const need = i.offsetHeight, have = o.clientHeight;
      const nk = need > have + 1 && have > 0 ? Math.max(0.5, have / need) : 1;
      setK((x) => (Math.abs(x - nk) > 0.004 ? nk : x));
    };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(o); ro.observe(i);
    return () => ro.disconnect();
  }, []);
  /* (the entrance on the outer box: its animation would hold the inner one's scale) */
  const cls = className.replace(/(^|\s)(flex-1|enter|min-h-0)(?=\s|$)/g, " ");
  return (
    <div ref={outer} className="flex-1 min-h-0 flex flex-col justify-center enter">
      <div ref={inner} className={cls} style={{ flex: "none", minHeight: "100%", transform: k < 1 ? `scale(${k})` : undefined, transformOrigin: "50% 50%" }}>{children}</div>
    </div>);
}
