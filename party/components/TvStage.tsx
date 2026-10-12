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
      <div ref={ref} className="tv-stage" style={{ transform: `scale(${k})` }}>{children}</div>
    </div>
  );
}
